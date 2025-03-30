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
  // HSTS header - enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // UPDATED: Set very permissive CSP for ALL endpoints to fix authentication issues
  // This allows connections to all Supabase domains needed for authentication
  console.log(`[SECURITY] Setting permissive CSP for path: ${_req.path}`);
  
  // CRITICAL FIX: Highly permissive Content Security Policy that explicitly allows
  // connections to all Supabase domains including the specific project URL
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.supabase.com " +
    "https://pwiysqqirjnjqacevzfp.supabase.co https://api.openai.com wss://*.supabase.co " + 
    "https://identity.supabase.com https://api.supabase.io *; " + // Added wildcard as fallback
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "object-src 'none'; " +
    "media-src 'self'"
  );
  
  next();
};