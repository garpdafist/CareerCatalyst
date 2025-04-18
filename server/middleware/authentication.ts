import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { SessionData } from 'express-session';

// Extend the SessionData interface to include our custom properties
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
  }
}

// Authentication middleware that verifies Supabase session
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Skip authentication in development mode
  if (process.env.NODE_ENV === 'development') {
    // For development, set a mock user ID
    req.session.userId = 'dev-user-123';
    req.session.email = 'dev@example.com';
    return next();
  }
  
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // If no authorization header, check if we have a session
      if (req.session && req.session.userId) {
        // Use existing session
        return next();
      }
      
      console.log(`[${new Date().toISOString()}] Unauthorized: No valid authentication found for ${req.path}`);
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Extract token from header
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string
    );
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.log(`[${new Date().toISOString()}] Invalid token: ${error?.message || 'No user found'}`);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Set user info in session
    req.session.userId = user.id;
    req.session.email = user.email;
    
    // Continue to the next middleware/route handler
    next();
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Authentication error:`, error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// Utility to get the current user ID from request
export const getCurrentUserId = (req: Request): string => {
  return req.session?.userId || '';
};

// Middleware to handle check authentication without blocking (for pages that work with or without auth)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Skip authentication in development mode
  if (process.env.NODE_ENV === 'development') {
    // For development, set a mock user ID
    req.session.userId = 'dev-user-123';
    req.session.email = 'dev@example.com';
    return next();
  }
  
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // If no authorization header, check if we have a session
      if (req.session && req.session.userId) {
        // Use existing session
        return next();
      }
      
      // Continue without authentication
      return next();
    }
    
    // Extract token from header
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string
    );
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      // Set user info in session
      req.session.userId = user.id;
      req.session.email = user.email;
    }
    
    // Continue regardless of authentication result
    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};