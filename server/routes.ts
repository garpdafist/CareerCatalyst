import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { randomBytes } from "crypto";
import session from "express-session";
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import pdf from 'pdf-parse/lib/pdf-parse.js';

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
    bodyContent: req.body?.content ? req.body.content.substring(0, 50) + '...' : 'missing'
  });
};

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Log buffer details
    console.log('PDF Buffer:', {
      size: buffer.length,
      isBuffer: Buffer.isBuffer(buffer),
      firstBytes: buffer.slice(0, 4).toString('hex')
    });

    const data = await pdf(buffer);

    // Log extraction details
    console.log('PDF Extraction Results:', {
      pageCount: data.numpages,
      textLength: data.text.length,
      firstChars: data.text.substring(0, 100) + '...'
    });

    if (!data.text.trim()) {
      throw new Error('PDF parsing returned empty text');
    }

    return data.text;
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
    } else if (file.mimetype === 'text/plain') {
      // For text files, just decode the buffer
      content = file.buffer.toString('utf-8');
    } else {
      // For now, handle DOC/DOCX as text (you might want to add proper DOC parsing)
      content = file.buffer.toString('utf-8');
    }

    // Log extracted content details
    console.log('Extracted content:', {
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

        // Log request details with more information
        console.log('Resume analysis request:', {
          hasFile: !!req.file,
          bodyContent: req.body.content ? 'present' : 'absent',
          contentLength: req.body.content?.length || 0,
          contentType: req.headers['content-type'],
          bodyKeys: Object.keys(req.body)
        });
        
        // Log full request body for debugging
        logRequestBody(req);

        if (req.file) {
          content = await extractTextFromFile(req.file);
        } else {
          console.log('Processing direct text input:', {
            contentPresent: !!req.body.content,
            contentLength: req.body.content?.length || 0,
            contentPreview: req.body.content?.substring(0, 100)
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

          if (!result.data.content) {
            return res.status(400).json({
              message: "Resume content is required",
              details: "No content provided in request body"
            });
          }

          content = result.data.content;
        }

        // Final content validation
        if (!content.trim()) {
          console.error('Empty content validation failed:', {
            contentLength: content.length,
            isString: typeof content === 'string',
            contentType: req.file ? 'pdf' : 'text'
          });

          return res.status(400).json({
            message: "Resume content cannot be empty",
            details: `${req.file ? 'PDF' : 'Text'} content was empty after processing`
          });
        }

        // Log content before analysis
        console.log('Content ready for analysis:', {
          length: content.length,
          preview: content.substring(0, 100) + '...'
        });

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

  const httpServer = createServer(app);
  return httpServer;
}