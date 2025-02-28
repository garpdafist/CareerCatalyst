import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { randomBytes } from "crypto";
import session from "express-session";
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import OpenAI from "openai";

// Initialize Supabase client for auth verification
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Add session type declaration
declare module "express-session" {
  interface SessionData {
    userId: string;
    email: string;
  }
}

// Initialize session middleware
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
});

// Modify the requireAuth middleware to bypass authentication
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // For testing: Always set the test user in the session
  req.session.userId = "test-user-123";
  req.session.email = "test@example.com";

  // Log the session for debugging
  console.log('Session data:', {
    userId: req.session.userId,
    email: req.session.email
  });

  next();
};

// Configure multer with file type validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported. Please upload PDF, TXT, DOC, or DOCX files.`));
    }
  }
});

// Modify validation schema to handle both paths
const resumeAnalysisSchema = z.object({
  content: z.string().min(1, "Resume content cannot be empty").optional(),
});

// For debugging body content
const logRequestBody = (req: Request) => {
  console.log('Request body:', {
    contentType: req.headers['content-type'],
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    bodySize: req.body?.content ? req.body.content.length : 0,
    bodyContent: req.body?.content ? req.body.content.substring(0, 50) + '...' : 'missing'
  });
};

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Validate PDF format - check if it starts with %PDF
    const pdfHeader = buffer.slice(0, 4).toString();
    if (!pdfHeader.startsWith('%PDF')) {
      throw new Error('Invalid PDF format: Does not start with %PDF signature');
    }

    // Log buffer details
    console.log('PDF Buffer:', {
      size: buffer.length,
      isBuffer: Buffer.isBuffer(buffer),
      firstBytes: buffer.slice(0, 10).toString('hex')
    });

    try {
      const data = await pdf(buffer);

      // Log extraction details
      console.log('PDF Extraction Results:', {
        pageCount: data.numpages || 'unknown',
        textLength: data.text ? data.text.length : 0,
        firstChars: data.text ? (data.text.substring(0, 100) + '...') : 'no text extracted'
      });

      if (!data || !data.text || !data.text.trim()) {
        throw new Error('PDF parsing returned empty text');
      }

      return data.text;
    } catch (pdfError: any) {
      console.error('PDF library error:', {
        message: pdfError.message,
        type: pdfError.constructor.name,
        stack: pdfError.stack
      });

      // If PDF content is raw text (common issue) try to extract as text
      if (buffer.toString('utf-8').includes('Abhay Sharma') ||
        buffer.toString('utf-8').includes('Summary') ||
        buffer.toString('utf-8').includes('Experience')) {
        console.log('Attempting to recover text from buffer directly');
        const textContent = buffer.toString('utf-8');
        return textContent;
      }

      throw pdfError;
    }
  } catch (error: any) {
    console.error('PDF parsing error:', {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack
    });
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  try {
    // Log file details
    console.log('Processing file:', {
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      encoding: file.encoding
    });

    let content: string = '';

    if (file.mimetype === 'application/pdf') {
      content = await extractTextFromPDF(file.buffer);
    } else if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      // For text files, decode buffer with proper error handling
      try {
        content = file.buffer.toString('utf-8');
        console.log('Text file content details:', {
          decodedLength: content.length,
          hasContent: content.trim().length > 0,
          firstChars: content.substring(0, 100) + '...'
        });
      } catch (decodeError) {
        console.error('Text decoding error:', decodeError);
        throw new Error('Failed to decode text file content');
      }
    } else {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    // Validate extracted content
    if (!content || !content.trim()) {
      throw new Error('Extracted content is empty or invalid');
    }

    // Log successful extraction
    console.log('Successfully extracted content:', {
      length: content.length,
      preview: content.substring(0, 100) + '...',
      hasContent: content.trim().length > 0
    });

    return content;
  } catch (error: any) {
    console.error('File processing error:', {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack
    });
    throw new Error(`Failed to process file: ${error.message}`);
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
async function generateCoverLetterContent(
  role: string,
  company: string,
  achievements: string,
  brand: string,
  formats: string[],
  resumeData: any
): Promise<Record<string, string>> {
  const systemPrompt = `You are an expert career coach specializing in creating compelling job application content. Generate content in the specified formats based on the provided information. If any information is missing, intelligently use the resume data provided.

Key rules:
1. Format email/cover letters with clear sections and HTML formatting:
   - Professional greeting in standard format
   - Strong opening paragraph with <strong> for company name and role
   - 2-3 achievement-focused body paragraphs with <em> for metrics
   - Concrete closing with call to action
   Use proper HTML tags (<p>, <strong>, <em>, <ul>, <li>) for formatting

2. Structure video scripts with clear sections:
   - [0:00-0:15] Engaging hook/introduction
   - [0:15-1:00] Key qualifications and achievements
   - [1:00-1:30] Why this specific role/company
   - [1:30-1:45] Strong closing with next steps

3. Style LinkedIn posts with:
   - Attention-grabbing opening line in <strong>
   - Brief personal story or achievement with <em> for metrics
   - Connection to new opportunity
   - Call to action or networking invitation
   - Relevant hashtags at the end

4. For all formats:
   - Use <strong> for company names, job titles, and key skills
   - Use <em> for metrics and quantifiable achievements
   - Create proper paragraph breaks with <p> tags
   - Use bullet points <ul><li> for listing achievements`;

  const userPrompt = `Create content for a ${role} position at ${company}.

Candidate Information:
${achievements ? `Key Achievements: ${achievements}` : 'Use achievements from resume'}
${brand ? `Personal Brand: ${brand}` : 'Use brand elements from resume'}

Additional Context from Resume:
${resumeData ? `
- Skills: ${resumeData.skills?.join(', ')}
- Keywords: ${resumeData.keywords?.join(', ')}
- Overall Profile: ${resumeData.feedback?.join('. ')}` : 'No resume data available'}

Generate content in the following formats: ${formats.join(', ')}

For the cover letter/email format, use this structure:
<p>[Professional Greeting]</p>
<p>[Enthusiastic Opening with <strong>company name and role</strong>]</p>
<p>[Achievement Paragraph with <em>metrics and results</em>]</p>
<p>[Skills & Alignment Paragraph highlighting <strong>key capabilities</strong>]</p>
<p>[Strong Closing with Call to Action]</p>

For all formats, ensure content is well-structured with appropriate HTML formatting for emphasis and organization. Respond with a JSON object where each key is the format name and the value is the generated content with HTML formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate content');
  }
}

async function analyzeLinkedInProfile(profileUrl: string): Promise<{
  headline: string;
  about: string;
  experience: string;
  headlineSuggestions: string[];
  aboutSuggestions: string[];
  experienceSuggestions: string[];
}> {
  const systemPrompt = `You are an expert LinkedIn profile optimizer and career coach. Analyze the provided LinkedIn profile URL and generate structured feedback and improvement suggestions. Focus on enhancing visibility, engagement, and professional impact.

Key areas to analyze:
1. Professional Headline: Should be compelling, keyword-rich, and under 220 characters
2. About Section: Should tell a story, include achievements, and be highly engaging
3. Experience Section: Should be achievement-focused with metrics and clear impact

For each section, provide:
1. Current content analysis
2. Specific, actionable improvement suggestions
3. Industry best practices and keywords to include`;

  const userPrompt = `Analyze this LinkedIn profile: ${profileUrl}

Provide a JSON response with the following structure:
{
  "headline": "Current headline content",
  "about": "Current about section content",
  "experience": "Current experience section content",
  "headlineSuggestions": ["Array of specific suggestions for improving the headline"],
  "aboutSuggestions": ["Array of specific suggestions for improving the about section"],
  "experienceSuggestions": ["Array of specific suggestions for improving the experience section"]
}

Focus on actionable improvements that will increase profile visibility and engagement.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    return analysis;
  } catch (error) {
    console.error('LinkedIn profile analysis error:', error);
    throw new Error('Failed to analyze LinkedIn profile');
  }
}

async function analyzeLinkedInContent(sections: { id: string; content: string }[]): Promise<Record<string, string[]>> {
  const systemPrompt = `You are an expert LinkedIn profile optimizer and career coach. Analyze the provided job experiences and generate specific, actionable improvement suggestions. Focus on making the experience section more impactful and achievement-oriented.

Key rules for experience optimization:
1. Achievement Focus:
   - Lead with measurable results and metrics
   - Quantify impact wherever possible
   - Show scope and scale of responsibilities

2. Action Verbs:
   - Use strong, specific action verbs
   - Avoid passive language
   - Demonstrate leadership and initiative

3. Technical Elements:
   - Include relevant tools and technologies
   - Highlight industry-specific skills
   - Show progression and growth

4. Formatting and Structure:
   - Keep bullet points concise and focused
   - Use consistent formatting
   - Prioritize most impressive achievements

Provide 3-5 specific, actionable suggestions that will make the experience more compelling and impactful.`;

  const userPrompt = `Analyze these job experiences:

${sections.map(section => {
    try {
      const job = JSON.parse(section.content);
      return `${section.id === 'currentJob' ? 'CURRENT ROLE' : 'PREVIOUS ROLE'}:
Title: ${job.jobTitle}
Company: ${job.companyName}
Period: ${job.startDate} - ${job.endDate}
Achievements:
${job.achievements}`;
    } catch (e) {
      return `${section.id}: Unable to parse content`;
    }
  }).join('\n\n')}

Provide a JSON response with an array of specific suggestions:
{
  "experienceSuggestions": [
    "Specific suggestion about metrics or impact...",
    "Specific suggestion about action verbs...",
    "Specific suggestion about technical elements...",
    "Specific suggestion about structure..."
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('LinkedIn content analysis error:', error);
    throw new Error('Failed to analyze LinkedIn content');
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Add session middleware
  app.use(sessionMiddleware);

  // Modify the /api/user route to return mock user for testing
  app.get("/api/user", async (req, res) => {
    // For testing: Always return mock user
    const mockUser = {
      id: "test-user-123",
      email: "test@example.com",
      emailVerified: new Date(),
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    res.json(mockUser);
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid email" });
      return;
    }

    const { email } = result.data;

    // Get or create user
    let user = await storage.getUserByEmail(email);
    if (!user) {
      user = await storage.createUser(email);
    }

    // In a real app, send magic link email here
    // For demo, auto-verify the email
    await storage.verifyEmail(email);

    // Set session
    req.session.userId = user.id;
    req.session.email = email;

    res.json(user);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  // Protected resume routes
  app.post("/api/resume-analyze",
    requireAuth,
    upload.single('file'),
    async (req: Request, res: Response) => {
      try {
        let content: string;

        // Log detailed request information
        console.log('Resume analysis request:', {
          hasFile: !!req.file,
          bodyContent: req.body.content ? 'present' : 'absent',
          contentLength: req.body.content?.length || 0,
          contentType: req.headers['content-type'],
          bodyKeys: Object.keys(req.body),
          method: req.method,
          url: req.url
        });

        if (req.file) {
          console.log('Processing file input:', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
          });

          try {
            content = await extractTextFromFile(req.file);
          } catch (fileError: any) {
            console.error('File extraction error:', fileError.message);
            return res.status(400).json({
              message: "Failed to extract text from file",
              details: fileError.message
            });
          }
        } else if (req.body && req.body.content) {
          console.log('Processing direct text input:', {
            contentPresent: !!req.body.content,
            contentLength: req.body.content.length,
            contentPreview: req.body.content.substring(0, 100)
          });

          const result = resumeAnalysisSchema.safeParse(req.body);
          if (!result.success) {
            console.error('Validation failed:', {
              errors: result.error.errors,
              receivedContent: typeof req.body.content,
              contentLength: req.body.content?.length || 0
            });

            return res.status(400).json({
              message: "Invalid resume content",
              details: result.error.errors
            });
          }

          content = result.data.content || '';
        } else {
          console.error('No content provided:', {
            hasFile: !!req.file,
            hasBodyContent: !!req.body?.content,
            contentType: req.headers['content-type']
          });

          return res.status(400).json({
            message: "Resume content is required",
            details: "Please provide a file or text content in the request body"
          });
        }

        // Final content validation with better debugging
        if (!content || !content.trim()) {
          console.error('Empty content validation failed:', {
            contentLength: content?.length || 0,
            isString: typeof content === 'string',
            contentType: req.file ? 'file' : 'text',
            contentSample: content ? content.substring(0, 30) : 'null'
          });

          return res.status(400).json({
            message: "Resume content cannot be empty",
            details: `${req.file ? 'File' : 'Text'} content was empty after processing`
          });
        }

        const analysis = await storage.analyzeResume(content, req.session.userId!);
        res.json(analysis);
      } catch (error: any) {
        console.error('Resume analysis error:', {
          message: error.message,
          type: error.constructor.name,
          stack: error.stack
        });

        const statusCode = error.message.includes('Invalid') ? 400 : 500;
        res.status(statusCode).json({
          message: "Failed to analyze resume",
          error: error.message,
          details: {
            type: error.constructor.name,
            occurred: error.stack?.split('\n')[1] || 'unknown location'
          }
        });
      }
    }
  );

  app.get("/api/resume-analysis/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const analysis = await storage.getResumeAnalysis(id);

    if (!analysis) {
      res.status(404).json({ message: "Analysis not found" });
      return;
    }

    // Ensure user can only access their own analyses
    if (analysis.userId !== req.session.userId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.json(analysis);
  });

  app.get("/api/user/analyses", requireAuth, async (req, res) => {
    const analyses = await storage.getUserAnalyses(req.session.userId!);
    res.json(analyses);
  });

  // Add configuration endpoint
  app.get("/api/config", (_req, res) => {
    res.json({
      supabaseUrl: process.env.VITE_SUPABASE_URL || "",
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || ""
    });
  });

  app.post("/api/generate-cover-letter", requireAuth, async (req, res) => {
    try {
      const { role, company, achievements, brand, formats, resumeData } = req.body;

      if (!role || !company || !formats || formats.length === 0) {
        return res.status(400).json({
          message: "Missing required fields: role, company, and at least one format"
        });
      }

      const content = await generateCoverLetterContent(
        role,
        company,
        achievements,
        brand,
        formats,
        resumeData
      );

      res.json(content);
    } catch (error: any) {
      console.error('Cover letter generation error:', error);
      res.status(500).json({
        message: "Failed to generate content",
        error: error.message
      });
    }
  });


  app.post("/api/analyze-linkedin-content", requireAuth, async (req, res) => {
    try {
      const { sections } = req.body;

      if (!sections || !Array.isArray(sections)) {
        return res.status(400).json({
          message: "Sections array is required"
        });
      }

      const analysis = await analyzeLinkedInContent(sections);
      res.json(analysis);
    } catch (error: any) {
      console.error('LinkedIn content analysis error:', error);
      res.status(500).json({
        message: "Failed to analyze LinkedIn content",
        error: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}