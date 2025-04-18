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

// Session initialization with Supabase token or cookie
export const initializeSession = async (req: Request, res: Response, next: NextFunction) => {
  // In development, auto-authenticate
  if (process.env.NODE_ENV === 'development') {
    req.session.userId = 'dev-user-123';
    req.session.email = 'dev@example.com';
    return next();
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL as string,
      process.env.SUPABASE_ANON_KEY as string,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false
        }
      }
    );

    // Method 1: Check for bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        // Valid token, set session
        req.session.userId = user.id;
        req.session.email = user.email;
        return next();
      }
    }
    
    // Method 2: Check for Supabase auth cookie
    // This handles the case where users have authenticated via magic link or OTP
    const cookies = req.cookies;
    
    if (cookies && cookies['sb-access-token']) {
      try {
        // Use the cookie to get the user information
        const { data: { user }, error } = await supabase.auth.getUser(
          cookies['sb-access-token']
        );
        
        if (!error && user) {
          // Valid cookie auth, set session
          req.session.userId = user.id;
          req.session.email = user.email;
          return next();
        }
      } catch (cookieAuthError) {
        console.warn('Cookie auth error:', cookieAuthError);
        // Continue to next auth method
      }
    }
    
    // Method 3: Get the session directly from Supabase's stored session
    try {
      // This works if the client has properly set up Supabase auth with cookies
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!error && session && session.user) {
        // Session found, set in our Express session
        req.session.userId = session.user.id;
        req.session.email = session.user.email;
        return next();
      }
    } catch (sessionError) {
      console.warn('Session retrieval error:', sessionError);
    }
    
    // No valid authentication method found, continue without auth
    next();
  } catch (error) {
    // Just continue on error, don't block the request
    console.error('Auth initialization error:', error);
    next();
  }
};