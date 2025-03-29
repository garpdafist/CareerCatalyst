import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { randomBytes } from "crypto";
import { ResumeAnalysis } from "@shared/schema";
import session from "express-session";
import nodemailer from 'nodemailer';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import OpenAI from "openai";
import { parsePdf } from "./services/pdf-parser";
import { analyzeResume } from "./services/resume-analyzer";

// Import our comprehensive security middleware
import { 
  createMiddlewarePipeline 
} from './middleware';

// Import data privacy handlers
import {
  privacyPolicyHandler,
  termsOfServiceHandler,
  handleDataAccessRequest,
  handleDataDeletionRequest
} from './middleware/data-privacy';

// Import rate limiters
import {
  generalLimiter,
  resumeAnalysisLimiter,
  jobAnalysisLimiter,
  authLimiter,
  coverLetterLimiter,
  linkedInLimiter,
  getAnalysesLimiter,
  skipRateLimitForStatic,
  configLimiter,
  userDataLimiter,
  healthLimiter
} from './middleware/rate-limit';

// Import validation middleware
import {
  validateResumeContent,
  validateJobDescription,
  validateUserAuth,
  validateLinkedInProfile,
  validateParamId,
  validateCoverLetter,
  validateAnalysisId
} from './middleware/validation';

// Import logging middleware
import {
  requestId,
  apiLogger,
  securityLogger,
  errorLogger
} from './middleware/logger';

// Import security middleware
import { 
  addSecurityHeaders, 
  cspViolationReporter, 
  handleCSRFError,
  setupCSRFTokenRoute 
} from './middleware/security';

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
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Resume analysis request received`, {
    method: req.method,
    path: req.path,
    headers: req.headers['content-type'],
    hasBody: !!req.body,
    hasFile: !!req.file,
    bodySize: req.body ? JSON.stringify(req.body).length : 0
  });
  
  // Set timeout for the request - 180 seconds (3 minutes)
  const TIMEOUT = 180000;
  const timeoutTimer = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] [${requestId}] Request manually timed out after ${TIMEOUT}ms`);
    if (!res.headersSent) {
      return res.status(408).json({
        message: "Analysis timed out",
        details: "The operation took too long to complete. Please try with a smaller document or try again later."
      });
    }
  }, TIMEOUT);
  
  try {
    let content = req.body?.content || '';
    let contentSource = 'body';

    // Handle file upload
    if (req.file) {
      console.log(`[${new Date().toISOString()}] [${requestId}] Processing uploaded file: ${req.file.originalname}, size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);
      
      // Detect file type and extract content accordingly
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'pdf') {
        // Use our specialized PDF parser for PDF files
        try {
          console.log(`[${new Date().toISOString()}] [${requestId}] Parsing PDF file`);
          content = await parsePdf(req.file.buffer, { 
            cleanText: true
          });
          console.log(`[${new Date().toISOString()}] [${requestId}] PDF parsed successfully: ${content.length} chars extracted`);
        } catch (pdfError: any) {
          console.error(`[${new Date().toISOString()}] [${requestId}] PDF parsing error:`, pdfError);
          clearTimeout(timeoutTimer);
          return res.status(400).json({
            message: "Failed to parse PDF file",
            details: pdfError.message,
            solution: "Please ensure your PDF is not corrupted and try again."
          });
        }
      } else {
        // For text files, use simple UTF-8 encoding
        content = req.file.buffer.toString('utf-8');
        console.log(`[${new Date().toISOString()}] [${requestId}] Text file parsed: ${content.length} chars extracted`);
      }
      
      contentSource = 'file';
    }

    if (!content?.trim()) {
      console.warn(`[${new Date().toISOString()}] [${requestId}] Missing resume content`);
      clearTimeout(timeoutTimer);
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
      if (!res.headersSent) {
        console.log(`[${new Date().toISOString()}] [${requestId}] Sending keepalive ping`);
        res.write(':keepalive\n\n');
      }
    }, 30000); // Send keepalive every 30 seconds
    
    try {
      console.log(`[${new Date().toISOString()}] [${requestId}] Starting AI analysis`);
      
      // For debugging, check if OpenAI API key is valid (don't log the actual key)
      const keyFirstChars = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 3) : 'undefined';
      const keyLastChars = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 3) : 'undefined';
      console.log(`[${new Date().toISOString()}] [${requestId}] Using OpenAI API key: ${keyFirstChars}...${keyLastChars}`);
      
      // Capture small sample of text being sent (for debugging)
      const contentSample = content.length > 200 ? content.substring(0, 200) + '...' : content;
      console.log(`[${new Date().toISOString()}] [${requestId}] Content sample: "${contentSample}"`);
      
      // Get job description from request if available
      const jobDescription = req.body?.jobDescription;
      
      // Set a timeout specifically for the AI analysis
      const analysisPromise = analyzeResume(content, jobDescription);
      
      // Create a race between the analysis and a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout (inner)')), TIMEOUT - 10000); // 10s less than outer timeout
      });
      
      // Wait for either the analysis to complete or the timeout to occur
      const analysis = await Promise.race([analysisPromise, timeoutPromise]);
      
      console.log(`[${new Date().toISOString()}] [${requestId}] AI analysis completed successfully`);

      // Ensure critical fields exist in response
      const typedAnalysis = analysis as ResumeAnalysis;
      
      // Format the response object
      const response = {
        ...typedAnalysis,
        primaryKeywords: typedAnalysis.primaryKeywords || [],
        generalFeedback: {
          overall: typedAnalysis?.generalFeedback 
            ? (typeof typedAnalysis.generalFeedback === 'object'
              ? (typedAnalysis.generalFeedback as any).overall || ''
              : String(typedAnalysis.generalFeedback || ''))
            : ''
        }
      };

      // Persist the analysis to the database
      console.log(`[${new Date().toISOString()}] [${requestId}] Saving analysis to database for user ${req.session.userId}`);
      try {
        // Format data for storage
        const savedAnalysis = await storage.saveResumeAnalysis({
          userId: req.session.userId,
          content: content,
          score: typedAnalysis.score,
          jobDescription: req.body?.jobDescription, // Save job description if provided
          analysis: {
            scores: typedAnalysis.scores,
            identifiedSkills: typedAnalysis.identifiedSkills || [],
            primaryKeywords: typedAnalysis.primaryKeywords || [],
            suggestedImprovements: typedAnalysis.suggestedImprovements || [],
            generalFeedback: typedAnalysis.generalFeedback 
              ? (typeof typedAnalysis.generalFeedback === 'object' 
                  ? (typedAnalysis.generalFeedback as any).overall || '' 
                  : String(typedAnalysis.generalFeedback)) 
              : '',
            jobAnalysis: typedAnalysis.jobAnalysis // Include job analysis if available
          }
        });
        
        // Add the ID to the response
        response.id = savedAnalysis.id;
        
        console.log(`[${new Date().toISOString()}] [${requestId}] Analysis saved to database with ID: ${savedAnalysis.id}`);
      } catch (saveError: any) {
        console.error(`[${new Date().toISOString()}] [${requestId}] Error saving analysis:`, saveError);
        // We still want to return the analysis even if saving fails
      }

      clearInterval(keepAliveInterval);
      clearTimeout(timeoutTimer);
      
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] [${requestId}] Resume analysis completed in ${duration}ms`);
      
      return res.json(response);

    } catch (analysisError: any) {
      clearInterval(keepAliveInterval);
      clearTimeout(timeoutTimer);
      
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
      if (analysisError.message?.includes('timeout') || analysisError.code === 'ETIMEDOUT' || analysisError.message?.includes('Analysis timeout')) {
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
    clearTimeout(timeoutTimer);
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
  // Add request ID for request tracking
  app.use(requestId);
  
  // Add API logging middleware
  app.use(apiLogger);
  
  // Add security middleware
  app.use(helmet());
  app.use(cookieParser());
  
  // Add session middleware
  app.use(sessionMiddleware);
  
  // Add CSRF protection for all routes except file uploads
  const csrfProtection = csrf({ cookie: true });
  
  // Set up CSRF token route
  setupCSRFTokenRoute(app);
  
  // Add Content Security Policy violation reporter
  app.post('/api/csp-report', cspViolationReporter);
  
  // Add rate limiting middleware with static asset exclusion
  app.use(skipRateLimitForStatic);
  
  // Apply general rate limiting only to routes that pass through skipRateLimitForStatic
  app.use(generalLimiter);

  // Add a simple ping route for testing (no rate limit needed for health checks)
  app.get("/api/ping", healthLimiter, (_req, res) => {
    res.json({ message: "pong", timestamp: new Date().toISOString() });
  });

  // Resume analysis routes with timeout middleware
  app.post("/api/resume-analyze",
    requestTimeout,
    requireAuth,
    resumeAnalysisLimiter, // Apply specific rate limiting
    validateResumeContent, // Validate input
    upload.single('file'),
    handleAnalysis
  );

  app.get("/api/resume-analysis/:id", 
    requireAuth, 
    getAnalysesLimiter,
    validateAnalysisId,
    async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid analysis ID" });
      }

      const analysis = await storage.getResumeAnalysis(id);
      console.log(`Retrieved analysis for ID ${id}:`, {
        found: !!analysis,
        userId: analysis?.userId,
        requestUserId: req.session.userId
      });

      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      if (analysis.userId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Ensure all required fields are present
      const sanitizedAnalysis = {
        ...analysis,
        scores: analysis.scores || {},
        identifiedSkills: analysis.identifiedSkills || [],
        primaryKeywords: analysis.primaryKeywords || [],
        suggestedImprovements: analysis.suggestedImprovements || [],
        generalFeedback: analysis.generalFeedback || ''
      };

      res.json(sanitizedAnalysis);
    } catch (error: any) {
      console.error('Error retrieving resume analysis:', error);
      res.status(500).json({ 
        message: "Failed to retrieve analysis",
        error: error.message 
      });
    }
  });

  app.get("/api/user/analyses", 
    requireAuth, 
    getAnalysesLimiter,
    async (req: any, res: any) => {
      const analyses = await storage.getUserAnalyses(req.session.userId!);
      
      // Add security logging
      securityLogger.logDataAccess(req, 'analyses', req.session.userId);
      
      res.json(analyses);
    }
  );

  app.get("/api/config", configLimiter, (_req: any, res: any) => {
    res.json({
      supabaseUrl: process.env.VITE_SUPABASE_URL || "",
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || ""
    });
  });

  app.post("/api/generate-cover-letter", 
    requireAuth, 
    coverLetterLimiter,
    validateCoverLetter,
    csrfProtection,
    async (req: any, res: any) => {
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


  app.post("/api/analyze-linkedin-content", 
    requireAuth, 
    linkedInLimiter,
    validateLinkedInProfile,
    csrfProtection,
    async (req: any, res: any) => {
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

  // Privacy and data management endpoints
  // Public policy endpoints with general rate limiting
  app.get("/api/privacy-policy", generalLimiter, privacyPolicyHandler);
  app.get("/api/terms-of-service", generalLimiter, termsOfServiceHandler);
  
  // CSRF protected data management routes
  app.get("/api/user/data", 
    requireAuth,
    userDataLimiter, // Apply stricter rate limiting for data access
    csrfProtection, 
    handleDataAccessRequest
  );
  
  app.delete("/api/user/data", 
    requireAuth,
    userDataLimiter, // Apply stricter rate limiting for data deletion
    csrfProtection, 
    handleDataDeletionRequest
  );
  
  // Create WebSocket Server for real-time communication
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Set up WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      console.log('WebSocket message received:', message.toString());
      // Handle messages here if needed
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
    
    // Send initial welcome message
    ws.send(JSON.stringify({
      type: 'connection_established',
      message: 'Connected to Resume Analyzer WebSocket server',
      timestamp: new Date().toISOString()
    }));
  });
  
  return httpServer;
}