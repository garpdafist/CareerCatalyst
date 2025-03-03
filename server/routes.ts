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
    // Log detailed buffer information to help debug
    console.log('PDF Buffer details:', {
      size: buffer.length,
      isBuffer: Buffer.isBuffer(buffer),
      firstBytesHex: buffer.slice(0, 20).toString('hex'),
      firstBytesStr: buffer.slice(0, 20).toString()
    });

    // First attempt: Use pdf-parse
    try {
      console.log('Attempting to extract text with pdf-parse');
      // Ensure proper buffer format
      if (!Buffer.isBuffer(buffer)) {
        buffer = Buffer.from(buffer);
      }

      const data = await pdf(buffer, {
        max: 0,       // No page limit
        timeout: 30000 // 30 second timeout
      });

      if (data && data.text && data.text.trim().length > 0) {
        console.log('PDF extraction successful with pdf-parse');
        return data.text;
      }
      console.log('pdf-parse returned empty text, trying alternative methods');
    } catch (err) {
      console.error('pdf-parse extraction failed:', err.message);
    }

    // Second attempt: Try PDF.js extract
    try {
      console.log('Attempting extraction with pdf.js-extract');

      return new Promise((resolve, reject) => {
        pdfExtract.extractBuffer(buffer, {}, (err, data) => {
          if (err) {
            console.error('pdf.js-extract failed:', err);
            reject(err);
            return;
          }

          const text = data.pages
            .map(page => page.content.map(item => item.str).join(' '))
            .join('\n\n');

          if (text && text.trim().length > 0) {
            console.log('PDF extraction successful with pdf.js-extract');
            resolve(text);
          } else {
            reject(new Error('pdf.js-extract returned empty text'));
          }
        });
      });
    } catch (err) {
      console.error('pdf.js-extract error:', err.message);
    }

    // Third attempt: Try pdfjs-dist
    try {
      console.log('Attempting extraction with pdfjs-dist');

      // Configure worker
      const pdfjsLib = pdfjs;

      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdfDocument = await loadingTask.promise;

      let extractedText = '';

      // Extract text from all pages
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        extractedText += pageText + '\n\n';
      }

      if (extractedText.trim().length > 0) {
        console.log('PDF extraction successful with pdfjs-dist');
        return extractedText;
      }
      console.log('pdfjs-dist returned empty text');
    } catch (err) {
      console.error('pdfjs-dist extraction failed:', err.message);
    }

    // Last attempt: Try PDF-Lib
    try {
      console.log('Attempting extraction with pdf-lib');

      const pdfDoc = await PDFDocument.load(buffer);
      const pageCount = pdfDoc.getPageCount();

      let extractedText = `PDF with ${pageCount} pages. `;
      extractedText += 'This PDF appears to contain only images or scanned content. ';
      extractedText += 'For best results, please provide a text-based PDF or direct text input.';

      // We're returning something even if extraction failed
      console.log('Returning fallback text content for image-based PDF');
      return extractedText;
    } catch (err) {
      console.error('pdf-lib extraction failed:', err.message);
    }

    // If all methods fail, return a descriptive error that can be saved as content
    console.error('All PDF extraction methods failed');
    return "Unable to extract text from this PDF. The document may be encrypted, password-protected, or contains only scanned images with no embedded text.";
  } catch (error: any) {
    console.error('PDF processing error:', error);
    // Return error as content rather than throwing
    return `Error processing PDF: ${error.message}. Please ensure the document is not password-protected, encrypted, or contains only images without text.`;
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

For all formats, ensure content is well-structured with appropriate HTML formatting for emphasis and organization. IMPORTANT: Your response must be ONLY a JSON object where each key is the format name and the value is the generated content with HTML formatting. Provide no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Try to extract JSON from response content
    let jsonContent = content.trim();

    // Remove any markdown code block indicators if present
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.substring(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.substring(3);
    }

    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.substring(0, jsonContent.length - 3);
    }

    jsonContent = jsonContent.trim();

    try {
      return JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', jsonContent.substring(0, 100) + '...');
      throw new Error('Failed to parse OpenAI response as JSON');
    }
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

IMPORTANT: Your response must ONLY be the JSON object with no other text before or after.
Focus on actionable improvements that will increase profile visibility and engagement.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Try to extract JSON from response content
    let jsonContent = content.trim();

    // Remove any markdown code block indicators if present
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.substring(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.substring(3);
    }

    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.substring(0, jsonContent.length - 3);
    }

    jsonContent = jsonContent.trim();

    try {
      return JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', jsonContent.substring(0, 100) + '...');
      throw new Error('Failed to parse OpenAI response as JSON');
    }
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

IMPORTANT: Your response must ONLY be a JSON object with no other text before or after. Provide specific suggestions for each section:
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
      ]
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Try to extract JSON from response content
    let jsonContent = content.trim();

    // Remove any markdown code block indicators if present
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.substring(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.substring(3);
    }

    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.substring(0, jsonContent.length - 3);
    }

    jsonContent = jsonContent.trim();

    try {
      return JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', jsonContent.substring(0, 100) + '...');
      throw new Error('Failed to parse OpenAI response as JSON');
    }
  } catch (error) {
    console.error('LinkedIn content analysis error:', error);
    throw new Error('Failed to analyze LinkedIn content');
  }
}

const handleAnalysis = async (req: Request, res: Response) => {
  try {
    let content: string = '';

    // Enhanced request logging
    console.log('Resume analysis request details:', {
      method: req.method,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      isMultipart: req.headers['content-type']?.includes('multipart/form-data'),
      hasFile: !!req.file,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : []
    });

    // Handle file upload
    if (req.file) {
      console.log('Processing uploaded file:', {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        encoding: req.file.encoding,
        hasBuffer: !!req.file.buffer,
        bufferSize: req.file.buffer?.length
      });

      try {
        content = await extractTextFromFile(req.file);
        console.log('File content extracted:', {
          success: true,
          contentLength: content.length,
          preview: content.substring(0, 100) + '...'
        });
      } catch (fileError: any) {
        console.error('File processing error:', {
          error: fileError.message,
          stack: fileError.stack,
          type: fileError.constructor.name
        });
        return res.status(400).json({
          message: "Failed to process file",
          error: fileError.message,
          details: "Please ensure the file is a valid PDF or text document"
        });
      }
    } else if (req.body?.content) {
      content = req.body.content;
      console.log('Using direct text input:', {
        contentLength: content.length,
        preview: content.substring(0, 100) + '...'
      });
    }

    // Validate content
    if (!content?.trim()) {
      console.error('Content validation failed:', {
        hasFile: !!req.file,
        hasContent: !!req.body?.content,
        contentLength: content?.length || 0
      });

      return res.status(400).json({
        message: "Resume content is required",
        details: "Please provide either a file upload or text content"
      });
    }

    // Process content
    console.log('Processing resume content:', {
      contentLength: content.length,
      userId: req.session.userId
    });

    try {
      const analysis = await storage.analyzeResume(content, req.session.userId!);
      console.log('Analysis completed successfully:', {
        analysisId: analysis.id,
        score: analysis.score,
        hasStructuredContent: !!analysis.structuredContent,
        hasScoringCriteria: !!analysis.scoringCriteria
      });
      return res.json(analysis);
    } catch (analysisError: any) {
      console.error('Analysis failed:', {
        error: analysisError.message,
        type: analysisError.constructor.name,
        stack: analysisError.stack
      });
      throw analysisError;
    }

  } catch (error: any) {
    console.error('Resume analysis error:', {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack
    });

    return res.status(500).json({
      message: "Failed to analyze resume",
      error: error.message
    });
  }
};

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
    // Clear the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error during logout:', err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.json({ message: "Logged out successfully" });
    });
  });

  // Protected resume routes
  app.post("/api/resume-analyze",
    requireAuth,
    upload.single('file'),
    handleAnalysis
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