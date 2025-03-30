/**
 * Security Middleware
 * 
 * This file implements security-related middleware to protect against
 * common web vulnerabilities and enforce secure practices.
 */

import { Request, Response, NextFunction } from 'express';
import { securityLogger } from './logger';
import csrf from 'csurf';

/**
 * CSRF error handler middleware
 * Intercepts CSRF token validation errors and returns a friendly error
 */
export const handleCSRFError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Log the CSRF error
  securityLogger.logAccessDenied(req, 'CSRF token', 'Invalid or missing CSRF token');
  
  // Return a user-friendly error
  res.status(403).json({
    status: 'error',
    message: 'Form session has expired or is invalid',
    details: 'Please refresh the page and try again',
    code: 'CSRF_ERROR'
  });
};

/**
 * Generate CSRF token middleware
 * Adds a route to request a new CSRF token
 */
export const setupCSRFTokenRoute = (app: any) => {
  app.get('/api/csrf-token', (req: Request, res: Response) => {
    res.json({
      csrfToken: req.csrfToken()
    });
  });
};

/**
 * Content Security Policy violation reporter
 */
export const cspViolationReporter = (req: Request, res: Response) => {
  // Log the CSP violation report
  const report = req.body;
  console.warn('CSP Violation:', {
    'blocked-uri': report['blocked-uri'],
    'violated-directive': report['violated-directive'],
    'source-file': report['source-file'],
    referrer: req.headers.referer || req.headers.referrer,
    userAgent: req.headers['user-agent']
  });
  
  res.status(204).end();
};

/**
 * Add security headers middleware
 * Adds various security headers to all responses
 */
export const addSecurityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  // Already using Helmet which sets most of these, but can customize or add more
  
  // Strict Transport Security - enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Always enable connectivity to Supabase regardless of environment
  // This is essential for authentication to work properly
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  
  // Skip CSP for auth endpoints completely to avoid blocking Supabase connections
  if (_req.path === '/auth' || _req.path.startsWith('/auth/')) {
    console.log(`[SECURITY] Relaxing CSP for auth endpoint: ${_req.path}`);
    // Set very permissive CSP for authentication pages
    res.setHeader('Content-Security-Policy', 
      "default-src * 'unsafe-inline' 'unsafe-eval'; " +
      "connect-src * 'unsafe-inline'; " +
      "script-src * 'unsafe-inline' 'unsafe-eval'; " +
      "style-src * 'unsafe-inline'; " +
      "img-src * data: blob:; " +
      "font-src * data:; " +
      "object-src 'none'; " +
      "media-src *"
    );
  }
  else if (supabaseUrl) {
    try {
      // Parse URL to get domain
      const supabaseDomain = new URL(supabaseUrl).hostname;
      console.log(`[SECURITY] Adding ${supabaseDomain} to CSP connect-src`);
      
      // More permissive CSP that allows all Supabase connections
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.supabase.io https://api.openai.com " +
        `https://${supabaseDomain} wss://${supabaseDomain} wss://*.supabase.co https://identity.supabase.com; ` +
        "report-uri /api/csp-report"
      );
    } catch (error) {
      console.error('[SECURITY] Error parsing Supabase URL for CSP:', error);
      
      // Fallback CSP configuration with all Supabase connections allowed
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.supabase.io " +
        "https://api.openai.com wss://*.supabase.co https://identity.supabase.com; " +
        "report-uri /api/csp-report"
      );
    }
  } else {
    // No Supabase URL in environment, use default CSP
    console.warn('[SECURITY] No Supabase URL found in environment variables for CSP configuration');
    
    // Default CSP for when no Supabase URL is available but still permissive for Supabase domains
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.supabase.io " +
      "https://api.openai.com wss://*.supabase.co https://identity.supabase.com; " +
      "report-uri /api/csp-report"
    );
  }
  
  next();
};