import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { randomBytes } from "crypto";
import session from "express-session";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for auth verification
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Add session type declaration
declare module "express-session" {
  interface SessionData {
    userId: string; // Changed from number to string since Supabase uses string IDs
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
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
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

// Add this validation schema for the resume content
const resumeAnalysisSchema = z.object({
  content: z.string().min(1),
  contentType: z.enum(["application/pdf", "text/plain"]).default("text/plain")
});

// Add this helper function to clean content
function cleanContent(content: string): string {
  // Remove null bytes and invalid UTF-8 characters
  return content
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[^\x20-\x7E\x0A\x0D]/g, ' ') // Replace non-printable chars with space
    .trim();
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
    req.session.email = email; // Added storing email in session

    res.json(user); // Return user object instead of success message
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  // Protected resume routes
  app.post("/api/resume-analyze", requireAuth, async (req, res) => {
    // Log the session and request for debugging
    console.log('Resume analyze request:', {
      session: req.session,
      body: {
        contentType: req.body.contentType,
        contentLength: req.body?.content?.length
      }
    });

    const result = resumeAnalysisSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid resume content" });
      return;
    }

    try {
      let processedContent = result.data.content;

      // If content is PDF, clean it
      if (result.data.contentType === "application/pdf") {
        // Remove PDF header and clean content
        processedContent = cleanContent(
          processedContent.replace(/^%PDF[^]*?(?=\w)/i, '').trim()
        );
      }

      const analysis = await storage.analyzeResume(
        processedContent,
        req.session.userId!
      );
      res.json(analysis);
    } catch (error: any) {
      console.error('Analysis error:', error);
      res.status(500).json({
        message: "Failed to analyze resume",
        error: error.message
      });
    }
  });

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
    // Use the non-VITE prefixed environment variables for server-side
    res.json({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}