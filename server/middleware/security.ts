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

  // BALANCED SECURITY APPROACH:
  // Specific CSP that allows necessary external connections while maintaining security
  // This explicitly allows Supabase domains that are needed for authentication
  
  // Log security header application for diagnostic purposes
  console.log(`[SECURITY] Setting balanced CSP for path: ${_req.path}`);
  
  // Create a secure but functional CSP that allows necessary external services
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
  
  // Log the exact CSP being set for diagnostic purposes (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SECURITY] Applied CSP: ${cspValue}`);
  }
  
  // Set the balanced security policy
  res.setHeader('Content-Security-Policy', cspValue);
  
  next();
};