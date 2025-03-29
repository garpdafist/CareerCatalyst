/**
 * Rate Limiting Configuration
 * 
 * This file implements specific rate limiters for different API endpoints
 * to prevent abuse, DoS attacks, and excessive API usage.
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { securityLogger } from './logger';

// Helper to create a consistent rate limiter with logging
const createLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: options.standardHeaders ?? true,
    legacyHeaders: options.legacyHeaders ?? false,
    keyGenerator: options.keyGenerator ?? ((req) => req.ip || 'unknown'),
    handler: (req: Request, res: Response) => {
      // Log rate limit violation
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
    }
  });
};

// General API rate limiter (100 requests per minute)
export const generalLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again after a minute'
});

// More restrictive rate limiter for resume analysis (5 requests per minute)
export const resumeAnalysisLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'You can only analyze 5 resumes per minute, please try again shortly'
});

// Rate limiter for job description analysis
export const jobAnalysisLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'You can only analyze 5 job descriptions per minute, please try again shortly'
});

// Authentication rate limiter (10 attempts per 15 minutes)
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, please try again after 15 minutes'
});

// Cover letter generation rate limiter (3 per minute)
export const coverLetterLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'You can only generate 3 cover letters per minute, please try again shortly'
});

// LinkedIn profile optimizer rate limiter
export const linkedInLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'You can only optimize your LinkedIn profile 3 times per minute, please try again shortly'
});

// Get analyses limiter
export const getAnalysesLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'You can only retrieve your analyses 20 times per minute, please try again shortly'
});