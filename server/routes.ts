import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { randomBytes } from "crypto";
import session from "express-session";
import nodemailer from 'nodemailer';
import multer from 'multer';
import { analyzeResumeWithAI } from "./services/openai";

// Add scoring weights after imports
const SCORING_WEIGHTS = {
  keywordsRelevance: 0.30,  // 30%
  achievementsMetrics: 0.25, // 25%
  structureReadability: 0.20, // 20%
  summaryClarity: 0.15,     // 15%
  overallPolish: 0.10       // 10%
};

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

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    const allowedExtensions = ['pdf', 'txt'];
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    if (allowedTypes.includes(file.mimetype) ||
        (fileExtension && allowedExtensions.includes(fileExtension))) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported. Please upload PDF or TXT files.`));
    }
  }
});

// Simplified auth middleware for testing
const requireAuth = async (req: any, res: any, next: any) => {
  req.session.userId = "test-user-123";
  req.session.email = "test@example.com";
  next();
};

// Add timeout middleware after other imports
const requestTimeout = (req: any, res: any, next: any) => {
  res.setTimeout(30000, () => {
    res.status(408).json({
      message: "Request timeout",
      details: "The analysis is taking longer than expected. Please try with a smaller document or try again later."
    });
  });
  next();
};

// Modified handleAnalysis function
const handleAnalysis = async (req: any, res: any) => {
  try {
    let content = req.body?.content || '';

    // Handle file upload
    if (req.file) {
      content = req.file.buffer.toString('utf-8');
    }

    if (!content?.trim()) {
      return res.status(400).json({
        message: "Resume content is required",
        details: "Please provide either a file upload or text content"
      });
    }

    // Send keep-alive headers
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=30');

    // Process content
    try {
      const analysis = await analyzeResumeWithAI(content);

      // Ensure critical fields exist in response
      const response = {
        ...analysis,
        primaryKeywords: analysis.primaryKeywords || [],
        generalFeedback: {
          overall: typeof analysis.generalFeedback === 'object'
            ? analysis.generalFeedback.overall
            : analysis.generalFeedback || ''
        }
      };

      return res.json(response);

    } catch (analysisError: any) {
      // Enhanced error handling for rate limits
      if (analysisError?.status === 429) {
        console.warn('Rate limit reached:', {
          error: analysisError.message,
          retryAfter: analysisError.response?.headers?.['retry-after'],
          timestamp: new Date().toISOString()
        });

        return res.status(429).json({
          message: "Service is temporarily busy",
          details: "Please try again in a few moments",
          retryAfter: analysisError.response?.headers?.['retry-after'] || 60
        });
      }

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

export function registerRoutes(app: Express): Server {
  // Add session middleware
  app.use(sessionMiddleware);

  // Add a simple ping route for testing
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "pong" });
  });

  // Resume analysis routes with timeout middleware
  app.post("/api/resume-analyze",
    requestTimeout,
    requireAuth,
    upload.single('file'),
    handleAnalysis
  );

  app.get("/api/resume-analysis/:id", requireAuth, async (req: any, res: any) => {
    const id = parseInt(req.params.id);
    const analysis = await storage.getResumeAnalysis(id);

    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    if (analysis.userId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(analysis);
  });

  app.get("/api/user/analyses", requireAuth, async (req: any, res: any) => {
    const analyses = await storage.getUserAnalyses(req.session.userId!);
    res.json(analyses);
  });

  app.get("/api/config", (_req: any, res: any) => {
    res.json({
      supabaseUrl: process.env.VITE_SUPABASE_URL || "",
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || ""
    });
  });

  app.post("/api/generate-cover-letter", requireAuth, async (req: any, res: any) => {
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


  app.post("/api/analyze-linkedin-content", requireAuth, async (req: any, res: any) => {
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