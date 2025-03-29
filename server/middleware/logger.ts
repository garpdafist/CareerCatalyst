/**
 * Enhanced Logging Middleware
 * 
 * This file implements logging middleware for security events and API access
 * to provide better monitoring, debugging, and security auditing.
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Adds a unique ID to each request for correlation in logs
 */
export const requestId = (req: Request & { id?: string }, _res: Response, next: NextFunction) => {
  req.id = randomUUID();
  next();
};

/**
 * Logs API requests with useful information for monitoring
 */
export const apiLogger = (req: Request & { id?: string }, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Log the request
  console.log(`[${new Date().toISOString()}] [REQUEST] [${req.id}] ${req.method} ${req.url} ${req.ip}`);
  
  // Log the response when complete
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    
    console.log(`[${new Date().toISOString()}] [RESPONSE] [${req.id}] ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    
    // Log more details for errors
    if (res.statusCode >= 400) {
      console.error(`[${new Date().toISOString()}] [${logLevel}] [${req.id}] Error response: ${res.statusCode}`);
    }
  });
  
  next();
};

/**
 * Security event logger for centralized security monitoring
 */
export const securityLogger = {
  /**
   * Log authentication events
   */
  logAuth: (req: Request & { id?: string }, user: string, success: boolean, reason?: string) => {
    const level = success ? 'INFO' : 'WARN';
    const message = success 
      ? `Successful authentication for user ${user}` 
      : `Failed authentication for user ${user}: ${reason || 'Unknown reason'}`;
    
    console.log(`[${new Date().toISOString()}] [${level}] [AUTH] [${req.id}] ${message} from ${req.ip}`);
  },
  
  /**
   * Log permission/access events
   */
  logAccessDenied: (req: Request & { id?: string }, resource: string, reason: string) => {
    console.warn(`[${new Date().toISOString()}] [WARN] [ACCESS] [${req.id}] Access denied to ${resource}: ${reason} from ${req.ip}`);
  },
  
  /**
   * Log suspicious activity for security monitoring
   */
  logSuspiciousActivity: (req: Request & { id?: string }, activity: string, details: any) => {
    console.warn(`[${new Date().toISOString()}] [WARN] [SECURITY] [${req.id}] Suspicious activity: ${activity} from ${req.ip}`, details);
  }
};

/**
 * Error logger middleware for centralized error monitoring
 */
export const errorLogger = (err: any, req: Request & { id?: string }, _res: Response, next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] [ERROR] [${req.id}] Error:`, {
    message: err.message,
    stack: err.stack,
    path: req.url,
    method: req.method,
    ip: req.ip
  });
  
  next(err);
};