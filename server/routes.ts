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

// Supabase auth middleware
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "No authorization header" });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      throw error || new Error('User not found');
    }

    // Store user info in session using string ID
    req.session.userId = user.id;
    req.session.email = user.email || '';
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Add session middleware
  app.use(sessionMiddleware);

  // Add this route before the auth routes
  app.get("/api/user", async (req, res) => {
    if (!req.session.userId) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    // Get user from database
    const user = await storage.getUserByEmail(req.session.email);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    res.json(user);
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
    const schema = z.object({
      content: z.string().min(1),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid resume content" });
      return;
    }

    try {
      const analysis = await storage.analyzeResume(
        result.data.content,
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