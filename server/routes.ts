import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { randomBytes } from "crypto";
import session from "express-session";
import nodemailer from 'nodemailer';
import multer from 'multer';
import { analyzeResumeWithAI } from "./services/openai";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define helper functions for cover letter generation and LinkedIn content analysis
async function generateCoverLetterContent(
  role: string,
  company: string,
  achievements: string,
  brand: string,
  formats: string[],
  resumeData: any
): Promise<any> {
  try {
    let prompt = `
    Create a professional cover letter for ${role} position at ${company}.
    
    Role: ${role}
    Company: ${company}
    Key Achievements: ${achievements || 'Not provided'}
    Tone/Brand: ${brand || 'Professional'}
    
    Resume Data: ${resumeData ? JSON.stringify(resumeData) : 'Not provided'}
    
    Include: 
    - Professional greeting and introduction
    - Highlights of relevant experience 
    - Specific achievements that match the role
    - Expression of interest in the company
    - Call to action and professional closing
    `;

    // Create basic formats container
    const result: Record<string, string> = {};
    
    // Process each requested format
    for (const format of formats) {
      let formatPrompt = prompt;
      
      if (format === 'email') {
        formatPrompt += "Create this as a formal email format with subject line.";
      } else if (format === 'video') {
        formatPrompt += "Create this as a script for a video introduction. Include pauses and emphasis.";
      } else if (format === 'linkedin') {
        formatPrompt += "Create this as a LinkedIn message reaching out about the position. Keep it concise but impactful.";
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a professional cover letter writer with expertise in crafting compelling job application materials."
          },
          {
            role: "user",
            content: formatPrompt
          }
        ],
        temperature: 0.7
      });
      
      result[format] = response.choices[0].message.content || '';
    }
    
    return result;
  } catch (error) {
    console.error('Error generating cover letter:', error);
    throw error;
  }
}

async function analyzeLinkedInContent(sections: any[]): Promise<any> {
  try {
    const analysisPrompt = `
    Analyze the following LinkedIn profile sections and provide specific recommendations for improvement:
    
    ${sections.map(section => `${section.name}: ${section.content}`).join('\n\n')}
    
    For each section provide:
    1. Current strengths
    2. Specific areas for improvement
    3. Recommended revisions with examples
    4. Keywords that could be added
    5. Overall section score (1-10)
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a LinkedIn profile optimization expert who helps professionals improve their profiles for maximum impact. Provide detailed, actionable advice."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('Error analyzing LinkedIn content:', error);
    throw error;
  }
}

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
  // Increase timeout to 3 minutes (180000ms) for resume analysis operations
  res.setTimeout(180000, () => {
    res.status(408).json({
      message: "Request timeout",
      details: "The analysis is taking longer than expected. Please try with a smaller document or try again later."
    });
  });
  next();
};

// Enhanced handleAnalysis function with better logging and error handling
const handleAnalysis = async (req: any, res: any) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Resume analysis request received`);
  
  try {
    let content = req.body?.content || '';
    let contentSource = 'body';

    // Handle file upload
    if (req.file) {
      console.log(`[${new Date().toISOString()}] [${requestId}] Processing uploaded file: ${req.file.originalname}, size: ${req.file.size} bytes`);
      content = req.file.buffer.toString('utf-8');
      contentSource = 'file';
    }

    if (!content?.trim()) {
      console.warn(`[${new Date().toISOString()}] [${requestId}] Missing resume content`);
      return res.status(400).json({
        message: "Resume content is required",
        details: "Please provide either a file upload or text content"
      });
    }

    console.log(`[${new Date().toISOString()}] [${requestId}] Content received, source: ${contentSource}, length: ${content.length} chars`);
    
    // Send keep-alive headers with increased timeout (3 minutes)
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=180');
    
    // Send a periodic data event to keep the connection alive
    const keepAliveInterval = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 30000); // Send keepalive every 30 seconds
    
    try {
      console.log(`[${new Date().toISOString()}] [${requestId}] Starting AI analysis`);
      const analysis = await analyzeResumeWithAI(content);
      console.log(`[${new Date().toISOString()}] [${requestId}] AI analysis completed`);

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

      clearInterval(keepAliveInterval);
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] [${requestId}] Resume analysis completed in ${duration}ms`);
      
      return res.json(response);

    } catch (analysisError: any) {
      clearInterval(keepAliveInterval);
      
      // Enhanced error handling for rate limits
      if (analysisError?.status === 429) {
        console.warn(`[${new Date().toISOString()}] [${requestId}] Rate limit reached:`, {
          error: analysisError.message,
          retryAfter: analysisError.response?.headers?.['retry-after'],
          status: analysisError.status,
          timestamp: new Date().toISOString()
        });

        return res.status(429).json({
          message: "Service is temporarily busy",
          details: "Please try again in a few moments",
          retryAfter: analysisError.response?.headers?.['retry-after'] || 60
        });
      }

      // Handle timeout errors
      if (analysisError.message?.includes('timeout') || analysisError.code === 'ETIMEDOUT') {
        console.error(`[${new Date().toISOString()}] [${requestId}] Analysis timed out:`, {
          error: analysisError.message,
          code: analysisError.code,
          duration: Date.now() - startTime
        });
        
        return res.status(408).json({
          message: "Analysis timed out",
          details: "The operation took too long to complete. Please try with a smaller document or try again later."
        });
      }

      console.error(`[${new Date().toISOString()}] [${requestId}] Analysis failed:`, {
        error: analysisError.message,
        type: analysisError.constructor.name,
        stack: analysisError.stack,
        status: analysisError.status,
        duration: Date.now() - startTime
      });
      throw analysisError;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] [${requestId}] Resume analysis error after ${duration}ms:`, {
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