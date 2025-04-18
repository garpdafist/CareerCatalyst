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

// Import authentication middleware
import { requireAuth, getCurrentUserId, initializeSession } from './middleware/auth';

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
  
  // Enhanced logging for debugging job description issues
  console.log(`[${new Date().toISOString()}] [${requestId}] Resume analysis request received`, {
    method: req.method,
    path: req.path,
    headers: req.headers['content-type'],
    hasBody: !!req.body,
    hasFile: !!req.file,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    jobDescriptionPresent: !!req.body?.jobDescription,
    jobDescriptionType: req.body?.jobDescription ? typeof req.body.jobDescription : 'none',
    jobDescriptionLength: req.body?.jobDescription ? (typeof req.body.jobDescription === 'string' ? 
                        req.body.jobDescription.length : 
                        JSON.stringify(req.body.jobDescription).length) : 0,
    jobDescriptionSample: req.body?.jobDescription ? (typeof req.body.jobDescription === 'string' ? 
                         req.body.jobDescription.substring(0, 100) + '...' : 
                         JSON.stringify(req.body.jobDescription).substring(0, 100) + '...') : 'none'
  });
  
  // Log detailed information about the request body for debugging
  console.log(`[${new Date().toISOString()}] [${requestId}] Request body debug:`, {
    bodyKeys: req.body ? Object.keys(req.body) : [],
    contentKey: req.body?.content ? "present" : "missing",
    contentType: req.body?.content ? typeof req.body.content : "N/A",
    contentLength: req.body?.content ? req.body.content.length : 0,
    isResumeObject: req.body?.professionalSummary ? "yes" : "no",
    bodyPreview: req.body ? JSON.stringify(req.body).substring(0, 200) + '...' : 'empty'
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
    let content = '';
    let contentSource = 'body';
    
    // Enhanced content extraction to handle different request formats
    if (req.body?.content) {
      // Direct content field (simple string format)
      content = req.body.content;
      contentSource = 'body.content';
    } else if (req.body?.professionalSummary) {
      // Structured resume format - convert to text for analysis
      try {
        // For structured resume submission, combine different sections
        const structuredContent = [
          `Professional Summary: ${req.body.professionalSummary}`,
          
          // Work Experience
          'Work Experience:',
          ...(req.body.workExperience?.map((job: { position: string; company: string; duration: string; achievements?: string[] }) => 
            `${job.position} at ${job.company} (${job.duration})\n` +
            `Achievements: ${job.achievements?.join(', ') || 'None listed'}`
          ) || []),
          
          // Skills
          'Technical Skills:',
          ...(req.body.technicalSkills || []),
          
          // Education
          'Education:',
          ...(req.body.education?.map((edu: { degree: string; institution: string; year: string }) => 
            `${edu.degree} from ${edu.institution} (${edu.year})`
          ) || []),
          
          // Optional sections
          ...(req.body.certifications?.length > 0 ? ['Certifications:', ...req.body.certifications] : []),
          
          // Projects
          ...(req.body.projects?.length > 0 ? [
            'Projects:',
            ...(req.body.projects.map((proj: { name: string; description: string; technologies?: string[] }) => 
              `${proj.name}: ${proj.description}\nTechnologies: ${proj.technologies?.join(', ') || 'None listed'}`
            ))
          ] : [])
        ].join('\n\n');
        
        content = structuredContent;
        contentSource = 'structured';
      } catch (error) {
        console.error(`[${new Date().toISOString()}] [${requestId}] Error processing structured resume:`, error);
        // If we can't process the structured format, try to extract as much as we can
        content = `${req.body.professionalSummary || ''}\n\n${req.body.technicalSkills?.join(', ') || ''}`;
        contentSource = 'structured-fallback';
      }
    }

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
      // Extract and log job description information
      // IMPORTANT: We're capturing job description from req.body.jobDescription
      const jobDescription = req.body?.jobDescription;
      
      // Enhanced debug log for job description tracing - step 1: request extraction
      console.log(`[${new Date().toISOString()}] [${requestId}] 1. JOB DESC TRACE - Extract from request:`, {
        exists: !!jobDescription,
        type: typeof jobDescription,
        isNull: jobDescription === null,
        isUndefined: jobDescription === undefined,
        isEmpty: jobDescription === '',
        length: jobDescription ? (typeof jobDescription === 'string' ? jobDescription.length : JSON.stringify(jobDescription).length) : 0,
        preview: jobDescription ? (typeof jobDescription === 'string' ? 
          (jobDescription.length > 100 ? jobDescription.substring(0, 100) + '...' : jobDescription) :
          JSON.stringify(jobDescription).substring(0, 100) + '...') : 'undefined',
        fullBodyKeys: Object.keys(req.body || {}),
        isFormData: req.is('multipart/form-data') === 'multipart/form-data',
        contentType: req.headers['content-type'] || 'none',
        // Raw body logging attempts (useful for multipart/form-data debugging)
        rawJobDescField: req.body.jobDescription,
        rawJobDescType: typeof req.body.jobDescription,
        bodyHasJobDescKey: 'jobDescription' in req.body
      });
      
      // IMPORTANT: Always pass the exact job description as provided, never set to null
      // Pass undefined if no job description is explicitly provided
      const jobDescToPass = jobDescription;
      
      // Enhanced debug log for job description tracing - step 2: before API call
      console.log(`[${new Date().toISOString()}] [${requestId}] 2. JOB DESC TRACE - Before API call:`, {
        passing: !!jobDescToPass,
        type: typeof jobDescToPass,
        isExplicitNull: jobDescToPass === null,
        isUndefined: jobDescToPass === undefined,
        valueCheck: jobDescToPass ? 'has value' : 'no value',
        stringLength: typeof jobDescToPass === 'string' ? jobDescToPass.length : 'not a string',
        objectKeys: typeof jobDescToPass === 'object' && jobDescToPass !== null ? Object.keys(jobDescToPass) : []
      });
      
      // Set a timeout specifically for the AI analysis
      const analysisPromise = analyzeResume(content, jobDescToPass);
      
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
      // Log the full analysis for debugging
      console.log(`[${new Date().toISOString()}] [${requestId}] Analysis result:`, {
        score: typedAnalysis.score,
        hasScores: !!typedAnalysis.scores,
        scoresKeys: typedAnalysis.scores ? Object.keys(typedAnalysis.scores) : [],
        hasIdentifiedSkills: Array.isArray(typedAnalysis.identifiedSkills) && typedAnalysis.identifiedSkills.length > 0,
        identifiedSkillsCount: Array.isArray(typedAnalysis.identifiedSkills) ? typedAnalysis.identifiedSkills.length : 0,
        hasPrimaryKeywords: Array.isArray(typedAnalysis.primaryKeywords) && typedAnalysis.primaryKeywords.length > 0, 
        primaryKeywordsCount: Array.isArray(typedAnalysis.primaryKeywords) ? typedAnalysis.primaryKeywords.length : 0,
        hasSuggestedImprovements: Array.isArray(typedAnalysis.suggestedImprovements) && typedAnalysis.suggestedImprovements.length > 0,
        hasGeneralFeedback: !!typedAnalysis.generalFeedback,
        generalFeedbackType: typedAnalysis.generalFeedback ? typeof typedAnalysis.generalFeedback : 'none',
        hasJobAnalysis: !!typedAnalysis.jobAnalysis,
        jobAnalysisKeys: typedAnalysis.jobAnalysis ? Object.keys(typedAnalysis.jobAnalysis) : []
      });
      
      const response = {
        ...typedAnalysis,
        primaryKeywords: typedAnalysis.primaryKeywords || [],
        generalFeedback: {
          overall: typedAnalysis?.generalFeedback 
            ? (typeof typedAnalysis.generalFeedback === 'object'
              ? (typedAnalysis.generalFeedback as any).overall || ''
              : String(typedAnalysis.generalFeedback || ''))
            : ''
        },
        // Make sure the job analysis is included in the response
        jobAnalysis: typedAnalysis.jobAnalysis || null
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
  
  // Initialize user sessions with auth info
  app.use(initializeSession);
  
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
    upload.single('file'), // Move file upload before validation
    // Custom middleware to adapt the request for validation when a file is uploaded
    (req: any, res: any, next: any) => {
      // If a file was uploaded, adapt the request body to match our schema
      if (req.file) {
        console.log('Adapting request with file upload to match schema:', {
          filePresent: !!req.file,
          bodyExists: !!req.body,
          bodyKeys: req.body ? Object.keys(req.body) : [],
          hasJobDesc: req.body && 'jobDescription' in req.body,
          jobDescType: req.body?.jobDescription ? typeof req.body.jobDescription : 'undefined'
        });
        
        // Create a content field if it doesn't exist
        req.body = req.body || {};
        req.body.content = 'File uploaded, content will be extracted';
        
        // Log job description if present
        if (req.body.jobDescription) {
          console.log('Job description included with file upload:', {
            length: typeof req.body.jobDescription === 'string' ? req.body.jobDescription.length : 0,
            preview: typeof req.body.jobDescription === 'string' ? 
              (req.body.jobDescription.substring(0, 100) + (req.body.jobDescription.length > 100 ? '...' : '')) : 
              'Not a string'
          });
        }
      }
      next();
    },
    validateResumeContent, // Validate input after adapting for file uploads
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
      // Enhanced logging for job description/analysis debugging
      console.log(`Retrieved detailed analysis for ID ${id}:`, {
        hasJobDescription: !!analysis.jobDescription,
        jobDescriptionType: analysis.jobDescription ? typeof analysis.jobDescription : 'none',
        jobDescriptionIsNull: analysis.jobDescription === null,
        jobDescriptionIsUndefined: analysis.jobDescription === undefined,
        jobDescriptionIsEmpty: analysis.jobDescription === '',
        hasJobAnalysis: !!analysis.jobAnalysis,
        jobAnalysisType: typeof analysis.jobAnalysis,
        jobAnalysisIsNull: analysis.jobAnalysis === null,
        jobAnalysisIsUndefined: analysis.jobAnalysis === undefined,
        jobAnalysisKeys: analysis.jobAnalysis ? Object.keys(analysis.jobAnalysis) : []
      });
      
      // IMPORTANT: For job description, we must preserve null values
      // Don't set default values for jobDescription or jobAnalysis if they're null
      // as this breaks the UI conditional logic
      const sanitizedAnalysis = {
        ...analysis,
        scores: analysis.scores || {},
        identifiedSkills: analysis.identifiedSkills || [],
        primaryKeywords: analysis.primaryKeywords || [],
        suggestedImprovements: analysis.suggestedImprovements || [],
        generalFeedback: analysis.generalFeedback || '',
        // CRITICAL FIX: Always include jobDescription and jobAnalysis fields in the response
        // When they're not present, explicitly set them to null (not undefined)
        // This ensures the UI can reliably check for these fields without undefined errors
        jobDescription: analysis.jobDescription ?? null,
        jobAnalysis: analysis.jobAnalysis ?? null
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

  app.get("/api/config", configLimiter, async (req: any, res: any) => {
    console.log('[API CONFIG] Request received from:', req.ip);
    console.log('[API CONFIG] Environment variables status:',  {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? `exists (starts with ${process.env.VITE_SUPABASE_URL.substring(0, 10)}...)` : 'missing',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? `exists (length: ${process.env.VITE_SUPABASE_ANON_KEY.length})` : 'missing',
      SUPABASE_URL: process.env.SUPABASE_URL ? `exists (starts with ${process.env.SUPABASE_URL.substring(0, 10)}...)` : 'missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? `exists (length: ${process.env.SUPABASE_ANON_KEY.length})` : 'missing',
    });
    
    // Try to use VITE_ prefixed vars first, fall back to non-prefixed versions
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    
    // Test DNS connectivity to Supabase from the server
    let dnsStatus: {
      canResolve: boolean;
      error: string | null;
      canConnect: boolean;
      serviceName: string; // Generic service reference instead of domain
    } = {
      canResolve: false,
      error: null,
      canConnect: false,
      serviceName: "authentication service" // Generic name instead of exposing hostname
    };
    
    if (supabaseUrl) {
      try {
        // Extract hostname from URL for internal use only
        const urlObj = new URL(supabaseUrl);
        const hostname = urlObj.hostname;
        // Don't store the actual domain in the response object
        
        console.log(`[API CONFIG] Testing DNS resolution for ${hostname}`);
        
        // Use a simpler, browser-compatible approach to test connectivity
        try {
          // Use fetch API instead of Node.js modules for browser compatibility
          console.log(`[API CONFIG] Testing connectivity to ${hostname}`);
          
          // Simple connectivity test using fetch API
          // First create a test function that returns a promise
          const testDomainConnectivity = async () => {
            try {
              // Try a simple no-cors HEAD request to test connectivity
              const testUrl = `https://${hostname}/auth/v1/health`;
              console.log(`[API CONFIG] Testing connection to ${testUrl}`);
              
              // Use fetch with a timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              const response = await fetch(testUrl, {
                method: 'HEAD',
                signal: controller.signal,
                // Mode no-cors doesn't provide response details but won't fail on CORS issues
                mode: 'no-cors'
              });
              
              clearTimeout(timeoutId);
              console.log(`[API CONFIG] Connected to ${hostname}, status: ${response.status}`);
              return { success: true, statusCode: response.status };
            } catch (error: any) {
              console.error(`[API CONFIG] Connection error:`, error);
              
              // Check for specific error types
              let isDnsError = false;
              
              if (error.name === 'AbortError') {
                console.log('[API CONFIG] Request timed out');
                return { success: false, error: 'Connection timed out' };
              }
              
              if (error.message) {
                isDnsError = error.message.includes('ENOTFOUND') || 
                             error.message.includes('ECONNREFUSED') || 
                             error.message.includes('resolve') ||
                             error.message.includes('DNS');
              }
              
              if (isDnsError) {
                return { success: false, error: error.message || 'DNS resolution error' };
              } else {
                // For other errors, DNS resolution may have worked
                return { success: true, error: error.message || 'Connection error' };
              }
            }
          };
          
          // Execute the test
          const dnsResult = await testDomainConnectivity();
          dnsStatus.canResolve = dnsResult.success;
          
          if (!dnsResult.success) {
            dnsStatus.error = `Cannot resolve hostname ${hostname}`;
            console.error(`[API CONFIG] DNS resolution failed for ${hostname}`);
          } else {
            console.log(`[API CONFIG] DNS resolution successful for ${hostname}`);
            
            // Test direct connectivity with a proper fetch request
            try {
              console.log(`[API CONFIG] Testing connection to ${supabaseUrl}/health`);
              
              // Set up a timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              // Make the request
              const response = await fetch(`${supabaseUrl}/health`, {
                method: 'HEAD',
                signal: controller.signal,
                mode: 'no-cors'
              });
              
              clearTimeout(timeoutId);
              dnsStatus.canConnect = true;
              console.log(`[API CONFIG] Connection successful to ${supabaseUrl}`);
            } catch (connErr: any) {
              dnsStatus.canConnect = false;
              console.error(`[API CONFIG] Connection test error:`, connErr);
            }
          }
        } catch (err: any) {
          console.error(`[API CONFIG] DNS test execution error: ${err.message}`);
          dnsStatus.error = err.message;
        }
      } catch (urlErr: any) {
        console.error(`[API CONFIG] URL parsing error: ${urlErr.message}`);
        dnsStatus.error = urlErr.message;
      }
    }
    
    console.log('[API CONFIG] DNS connectivity test results:', dnsStatus);
    
    console.log('[API CONFIG] Sending response with URL and key availability:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 10) + '...' : 'empty',
      keyLength: supabaseAnonKey?.length || 0,
      dnsStatus: {
        canResolve: dnsStatus.canResolve,
        canConnect: dnsStatus.canConnect,
        serviceName: dnsStatus.serviceName
      }
    });
    
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
    
    res.json({
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
      diagnostics: {
        dnsStatus
      }
    });
  });

  // Endpoint to test authentication service connectivity
  app.get("/api/auth-service-test", configLimiter, async (req: any, res: any) => {
    console.log('[AUTH TEST] Running authentication service test from server');
    
    // Try to use VITE_ prefixed vars first, fall back to non-prefixed versions
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    
    if (!supabaseUrl) {
      console.error('[AUTH TEST] No Supabase URL available in environment');
      return res.json({
        success: false,
        error: 'Missing configuration',
        errorType: 'CONFIG_MISSING'
      });
    }
    
    try {
      // Extract hostname from URL
      const urlObj = new URL(supabaseUrl);
      const hostname = urlObj.hostname;
      
      console.log(`[AUTH TEST] Testing direct connectivity to ${hostname}`);
      
      try {
        // Use node-fetch with timeout for server-side testing
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`[AUTH TEST] Auth service response:`, {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        });
        
        // 401 is actually expected for health endpoints that require auth
        const isSuccessful = response.status === 200 || response.status === 401;
        
        if (isSuccessful) {
          return res.json({
            success: true,
            status: response.status,
            message: 'Successfully connected to authentication service'
          });
        } else {
          return res.json({
            success: false,
            status: response.status,
            error: `Authentication service returned error status: ${response.status}`,
            errorType: 'SERVICE_ERROR'
          });
        }
      } catch (error: any) {
        console.error('[AUTH TEST] Error connecting to auth service:', error);
        
        // Determine error type
        let errorType = 'CONNECTION_ERROR';
        
        if (error.name === 'AbortError') {
          errorType = 'TIMEOUT';
        } else if (error.code === 'ENOTFOUND') {
          errorType = 'ENOTFOUND';
        } else if (error.code === 'ETIMEDOUT') {
          errorType = 'ETIMEDOUT';
        } else if (error.code === 'ECONNREFUSED') {
          errorType = 'ECONNREFUSED';
        }
        
        return res.json({
          success: false,
          error: error.message || 'Unknown error',
          errorType,
          code: error.code
        });
      }
    } catch (error: any) {
      console.error('[AUTH TEST] Error parsing Supabase URL:', error);
      return res.json({
        success: false,
        error: 'Invalid Supabase URL format',
        errorType: 'CONFIG_INVALID'
      });
    }
  });

  // Add a simple health endpoint
  app.get("/api/health", healthLimiter, (_req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });
  
  // Add a CSP debugging endpoint to check sent headers
  app.get("/api/debug-csp", healthLimiter, (req, res) => {
    // Create a simpler approach to get CSP info
    console.log('[DEBUG-CSP] Executing CSP debug endpoint');
    
    // Use the same balanced CSP as our security middleware
    // This matches what our app is actually using now
    const cspValue = [
      // Default fallback - only allow same origin by default
      "default-src 'self'",
      
      // Connect sources - Allow API connections to Supabase and our own domain
      // This is the most critical part for authentication to work
      "connect-src 'self' https://*.supabase.co https://*.supabase.in " +
      "https://api.supabase.com https://api.supabase.io https://identity.supabase.com " + 
      "https://pwiysqqirjnjqacevzfp.supabase.co wss://*.supabase.co https://api.openai.com " +
      "https://*.algolia.net https://*.algolia.com data: blob:",
      
      // Script sources - Allow inline scripts for our own functionality and specific CDNs
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      
      // Style sources - Allow inline styles and Google fonts  
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      
      // Font sources - Allow Google fonts
      "font-src 'self' https://fonts.gstatic.com data:",
      
      // Image sources - Allow images from our domain, data URIs, and HTTPS sources
      "img-src 'self' data: https: blob:",
      
      // Object sources - Disallow all plugin types
      "object-src 'none'",
      
      // Media sources - Only allow from our domain
      "media-src 'self'"
    ].join("; ");
    
    // Set the CSP header for this response
    res.setHeader('Content-Security-Policy', cspValue);
    
    // Get all headers from the request for debugging
    const requestHeaders: Record<string, string | string[] | undefined> = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      requestHeaders[key] = value;
    });
    
    // Return CSP debug information
    res.json({
      message: "CSP Debugging Information",
      requestHeaders,
      appliedCsp: cspValue,
      note: "A balanced CSP policy has been applied that allows Supabase domains while maintaining security",
      temporaryFix: false,
      timestamp: new Date().toISOString()
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