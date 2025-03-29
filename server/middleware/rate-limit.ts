/**
 * Rate Limiting Configuration
 * 
 * This file implements specific rate limiters for different API endpoints
 * to prevent abuse, DoS attacks, and excessive API usage.
 * 
 * It contains special handling for development mode and excludes static assets.
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { securityLogger } from './logger';

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Skip rate limiting for static assets and source files in development
export const skipRateLimitForStatic = (req: Request, res: Response, next: NextFunction) => {
  // Skip rate limiting for non-API paths and static assets
  const path = req.path;
  const isApiPath = path.startsWith('/api/');
  
  // Always apply rate limiting to API paths
  if (isApiPath) {
    return next();
  }
  
  // In development, skip rate limiting for non-API paths
  if (isDevelopment && !isApiPath) {
    return next('route');
  }
  
  // In production, let the rate limiter handle it
  next();
};

// Helper to create a consistent rate limiter with logging
const createLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  keyGenerator?: (req: Request) => string;
  devMax?: number; // Optional higher limit for development
}) => {
  // Use higher limits in development
  const effectiveMax = isDevelopment && options.devMax !== undefined 
    ? options.devMax 
    : options.max;

  return rateLimit({
    windowMs: options.windowMs,
    max: effectiveMax,
    standardHeaders: options.standardHeaders ?? true,
    legacyHeaders: options.legacyHeaders ?? false,
    keyGenerator: options.keyGenerator ?? ((req) => req.ip || 'unknown'),
    skip: (req) => {
      // Skip non-API paths in development
      if (isDevelopment && !req.path.startsWith('/api/')) {
        return true;
      }
      return false;
    },
    handler: (req: Request, res: Response) => {
      // Only log rate limit violations for API paths
      if (req.path.startsWith('/api/')) {
        securityLogger.logSuspiciousActivity(req, 'Rate limit exceeded', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(429).json({
          status: 'error',
          message: options.message,
          retryAfter: Math.ceil(options.windowMs / 1000)
        });
      } else {
        // For non-API paths, just pass through in development
        // This should not happen with the skip function, but just in case
        if (isDevelopment) {
          res.status(200).end();
        } else {
          res.status(429).json({
            status: 'error',
            message: 'Too many requests',
            retryAfter: Math.ceil(options.windowMs / 1000)
          });
        }
      }
    }
  });
};

// General API rate limiter (100 requests per minute in production, 500 in development)
export const generalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  devMax: 500, // Much higher limit in development
  message: 'Too many requests, please try again after a minute'
});

// More restrictive rate limiter for resume analysis (5 requests per minute in production, 20 in development)
export const resumeAnalysisLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  devMax: 20, // Higher limit in development
  message: 'You can only analyze 5 resumes per minute, please try again shortly'
});

// Rate limiter for job description analysis
export const jobAnalysisLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  devMax: 20, // Higher limit in development
  message: 'You can only analyze 5 job descriptions per minute, please try again shortly'
});

// Authentication rate limiter (10 attempts per 15 minutes in production, 50 in development)
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  devMax: 50, // Higher limit in development
  message: 'Too many authentication attempts, please try again after 15 minutes'
});

// Cover letter generation rate limiter (3 per minute in production, 10 in development)
export const coverLetterLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 3,
  devMax: 10, // Higher limit in development
  message: 'You can only generate 3 cover letters per minute, please try again shortly'
});

// User data access rate limiter (3 per hour in production, 10 in development)
export const userDataLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  devMax: 10, // Higher limit in development
  message: 'You can only request your data 3 times per hour, please try again later'
});

// Configuration endpoints rate limiter
export const configLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  devMax: 100, // Higher limit in development
  message: 'Too many configuration requests, please try again after a minute'
});

// Health/status endpoint rate limiter
export const healthLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  devMax: 150, // Higher limit in development
  message: 'Too many status check requests, please try again after a minute'
});

// LinkedIn profile optimizer rate limiter
export const linkedInLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 3,
  devMax: 10, // Higher limit in development
  message: 'You can only optimize your LinkedIn profile 3 times per minute, please try again shortly'
});

// Get analyses limiter
export const getAnalysesLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  devMax: 100, // Higher limit in development
  message: 'You can only retrieve your analyses 20 times per minute, please try again shortly'
});