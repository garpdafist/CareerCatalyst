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
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { PDFExtract } from 'pdf.js-extract';

// Initialize PDF extraction tools
const pdfExtract = new PDFExtract();

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

// Configure multer with enhanced file type validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Allow common PDF variations
      'application/x-pdf',
      'application/acrobat',
      'application/vnd.pdf',
      'text/pdf',
      'text/x-pdf'
    ];

    // Check file extension as a backup verification method
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'txt', 'doc', 'docx'];

    // Log file details for debugging
    console.log('Uploaded file details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      extension: fileExtension
    });

    if (allowedTypes.includes(file.mimetype) || (fileExtension && allowedExtensions.includes(fileExtension))) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" not supported. Please upload PDF, TXT, DOC, or DOCX files. Your file: ${file.originalname}`));
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
    // Enhanced PDF validation
    const pdfHeader = buffer.slice(0, 10).toString();
    if (!pdfHeader.includes('%PDF')) {
      console.error('PDF validation failed: Invalid header signature');
      throw new Error('Invalid PDF format: The file does not appear to be a valid PDF document');
    }

    // More detailed buffer logging
    console.log('PDF Buffer details:', {
      size: buffer.length,
      isBuffer: Buffer.isBuffer(buffer),
      firstBytes: buffer.slice(0, 20).toString('hex'),
      headerString: pdfHeader
    });

    // Try pdf-parse with more robust error handling
    try {
      // Ensure the buffer is properly passed to pdf-parse
      if (!Buffer.isBuffer(buffer)) {
        console.log('Converting to proper buffer format');
        buffer = Buffer.from(buffer);
      }

      // Add timeout to prevent hanging on problematic PDFs
      const pdfOptions = { 
        max: 0, // No page limit
        timeout: 30000 // 30 second timeout
      };

      const data = await pdf(buffer, pdfOptions);

      // Enhanced logging for successful parsing
      console.log('PDF extracted successfully:', {
        pageCount: data.numpages || 'unknown',
        metadata: data.metadata ? 'available' : 'not available',
        info: data.info ? Object.keys(data.info) : 'not available',
        textLength: data.text ? data.text.length : 0,
        firstChars: data.text ? (data.text.substring(0, 150) + '...') : 'no text extracted'
      });

      if (data && data.text && data.text.trim()) {
        return data.text;
      }

      throw new Error('PDF parsing returned empty text. The PDF may be scanned or contain only images.');
    } catch (pdfError: any) {
      console.error('Primary PDF parser error:', {
        message: pdfError.message,
        type: pdfError.constructor.name,
        stack: pdfError.stack?.substring(0, 500)
      });

      // Try alternative approach with more specific error messages
      if (pdfError.message.includes('Invalid PDF structure')) {
        console.log('Attempting to repair corrupted PDF structure...');
        // Simple repair attempt: look for PDF objects manually
        const pdfString = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
        const containsObjects = pdfString.includes('obj') && pdfString.includes('endobj');

        if (containsObjects) {
          console.log('PDF contains valid objects, trying text extraction from specific parts');
          // Extract text from parts that might contain readable content
          const textFragments = pdfString.match(/\((.*?)\)/g) || [];
          if (textFragments.length > 10) { // Arbitrary threshold for meaningful content
            const extractedText = textFragments
              .map(frag => frag.substring(1, frag.length - 1))
              .join(' ')
              .replace(/\\n/g, '\n');

            if (extractedText.length > 100) { // Another arbitrary threshold
              console.log('Recovered partial text from corrupted PDF');
              return extractedText;
            }
          }
        }
      }

      // Fallback: Try to extract as plain text with enhanced resume keyword detection
      try {
        const textContent = buffer.toString('utf-8');
        const resumeKeywords = [
          'resume', 'experience', 'education', 'skills', 'summary', 'work', 
          'job', 'professional', 'contact', 'objective', 'profile', 'achievement',
          'qualification', 'project', 'reference', 'certification', 'email', 'phone'
        ];

        // More sophisticated content detection - need several keywords
        let keywordCount = 0;
        for (const keyword of resumeKeywords) {
          if (textContent.toLowerCase().includes(keyword)) {
            keywordCount++;
          }
        }

        if (keywordCount >= 3) { // If at least 3 resume keywords are found
          console.log('Extracted text using direct method (found resume keywords)');
          return textContent;
        }
      } catch (textError) {
        console.error('Text extraction fallback failed:', textError);
      }

      // Try PDF.js as a last resort method
      try {
        console.log('Attempting to extract text using PDF.js...');

        // Load the PDF document
        const loadingTask = pdfjs.getDocument({ data: buffer });
        const pdfDocument = await loadingTask.promise;

        console.log(`PDF loaded successfully with PDF.js. Page count: ${pdfDocument.numPages}`);

        // Extract text from all pages
        let extractedText = '';
        for (let i = 1; i <= pdfDocument.numPages; i++) {
          const page = await pdfDocument.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          extractedText += strings.join(' ') + '\n';
        }

        if (extractedText.trim().length > 0) {
          console.log('Successfully extracted text using PDF.js fallback method');
          return extractedText;
        }
      } catch (pdfjsError) {
        console.error('PDF.js extraction failed:', pdfjsError);
      }

      // If all methods fail, provide a detailed error message
      throw new Error(`Unable to extract text from PDF. The document may be encrypted, password-protected, or contains only scanned images. Error details: ${pdfError.message}`);
    }
  } catch (error: any) {
    console.error('PDF processing error:', {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack
    });

    // Provide a user-friendly error message
    throw new Error(`Failed to process PDF: ${error.message}. Please ensure the document is not password-protected, encrypted, or contains only images without text.`);
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
  const systemPrompt = `You are an expert LinkedIn profile optimizer and career coach. Analyze each section of the LinkedIn profile and provide specific, actionable improvement suggestions.

Key rules for each section:

1. Professional Headline (under 220 chars):
   - Should include current role and industry
   - Add key specializations that show expertise
   - Use relevant keywords for visibility
   - Maintain professional tone, avoid buzzwords
   - Must be impactful yet concise

2. About Section:
   - Should start with a compelling hook
   - Include measurable achievements
   - Show unique value proposition
   - Add clear call to action
   - Use industry keywords strategically
   - Structure in clear paragraphs

3. Experience Entries:
   - Lead with measurable results and metrics
   - Use strong action verbs
   - Show scope and scale of responsibilities
   - Include relevant tools and technologies
   - Highlight leadership and initiative
   - Keep entries concise and focused

Provide 3-5 specific, actionable suggestions for each section that will increase profile impact and visibility.`;

  const userPrompt = `Analyze these LinkedIn profile sections:

${sections.map(section => {
    if (section.id === 'currentJob' || section.id === 'previousJob') {
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
    } else {
      return `${section.id.toUpperCase()}:
${section.content || '[Empty section]'}`;
    }
  }).join('\n\n')}

Provide a JSON response with specific suggestions for each section:
{
  "headlineSuggestions": ["Specific suggestion about headline format...", "Suggestion about keywords..."],
  "aboutSuggestions": ["Specific suggestion about story structure...", "Suggestion about achievements..."],
  "experienceSuggestions": ["Specific suggestion about metrics...", "Suggestion about action verbs..."]
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
    (req, res, next) => {
      upload.single('file')(req, res, (err) => {
        if (err) {
          // Enhanced multer error handling with more specific messages
          console.error('File upload error:', {
            message: err.message,
            stack: err.stack,
            code: err.code,
            field: err.field,
            type: err.constructor.name
          });

          // Provide specific error messages based on error type
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              message: "File upload failed: Document exceeds the maximum file size of 15MB",
              error: "File too large",
              code: "FILE_SIZE_ERROR",
              limit: "15MB"
            });
          } else if (err.message.includes('File type') || err.message.includes('mimetype')) {
            return res.status(400).json({
              message: "File upload failed: Invalid file format",
              error: err.message,
              code: "FILE_FORMAT_ERROR",
              acceptedFormats: "PDF, TXT, DOC, DOCX"
            });
          } else {
            return res.status(400).json({
              message: "File upload failed",
              error: err.message,
              code: "FILE_UPLOAD_ERROR",
              details: "Please check your file and try again"
            });
          }
        }
        next();
      });
    },
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
            console.error('File extraction error:', fileError);
            return res.status(400).json({
              message: "Failed to extract text from file",
              error: fileError.message,
              code: "FILE_EXTRACTION_ERROR",
              details: {
                filename: req.file.originalname,
                fileType: req.file.mimetype,
                fileSize: req.file.size
              }
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
              errors: result.error.errors,
              code: "VALIDATION_ERROR"
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
            details: "Please provide a file or text content in the request body",
            code: "MISSING_CONTENT"
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
            details: `${req.file ? 'File' : 'Text'} content was empty after processing`,
            code: "EMPTY_CONTENT"
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
          code: statusCode === 400 ? "INVALID_INPUT" : "SERVER_ERROR",
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