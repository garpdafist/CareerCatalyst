import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { SessionData } from 'express-session';

// Extend the session data interface with our custom properties
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
  }
}

// Simple auth middleware for development and production
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Check if we have a user ID in the session
  if (!req.session || !req.session.userId) {
    console.log(`[${new Date().toISOString()}] Authentication required for ${req.path}`);
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  next();
};

// Utility to get the current user ID
export const getCurrentUserId = (req: Request): string => {
  return req.session?.userId || '';
};

// Session initialization with Supabase token
export const initializeSession = async (req: Request, res: Response, next: NextFunction) => {
  // In development, auto-authenticate
  if (process.env.NODE_ENV === 'development') {
    req.session.userId = 'dev-user-123';
    req.session.email = 'dev@example.com';
    return next();
  }
  
  try {
    // Check for bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, let other middleware handle this
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string
    );
    
    // Verify the token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      // Valid token, set session
      req.session.userId = user.id;
      req.session.email = user.email;
    }
    
    next();
  } catch (error) {
    // Just continue on error, don't block
    console.error('Auth initialization error:', error);
    next();
  }
};