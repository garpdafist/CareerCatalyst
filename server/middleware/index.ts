/**
 * Middleware Pipeline Factory
 * 
 * Creates a standardized middleware pipeline with proper order for route handlers.
 * Order matters - for instance, rate limiting should happen before performing 
 * expensive operations, and validation should happen before business logic.
 */

// Re-export middleware from individual files
export * from './logger';
export * from './rate-limit';
export * from './security';
export * from './validation';
export * from './data-privacy';

import { Request, Response, NextFunction } from 'express';
import { requestId, apiLogger } from './logger';
import { handleCSRFError } from './security';

/**
 * Creates a standardized middleware pipeline for a route
 */
export const createMiddlewarePipeline = (options: {
  auth?: boolean;
  rateLimiter?: (req: Request, res: Response, next: NextFunction) => void;
  validation?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  csrfProtection?: boolean;
  additionalMiddleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
}) => {
  const pipeline: Array<(req: Request, res: Response, next: NextFunction) => void> = [];
  
  // Add request ID and logging first
  pipeline.push(requestId);
  pipeline.push(apiLogger);
  
  // Add rate limiting early to prevent DoS
  if (options.rateLimiter) {
    pipeline.push(options.rateLimiter);
  }
  
  // Add validation before processing
  if (options.validation && options.validation.length > 0) {
    pipeline.push(...options.validation);
  }
  
  // Add any additional middleware
  if (options.additionalMiddleware && options.additionalMiddleware.length > 0) {
    pipeline.push(...options.additionalMiddleware);
  }
  
  return pipeline;
};