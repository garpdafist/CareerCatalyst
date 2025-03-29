/**
 * Validation Middleware
 * 
 * This file implements request validators to ensure data integrity
 * and prevent malformed data from reaching the application.
 */

import { Request, Response, NextFunction } from 'express';
import { 
  resumeContentSchema,
  jobDescriptionSchema,
  userAuthSchema
} from '@shared/schema';
import { z } from 'zod';

/**
 * Validates a request body against a Zod schema
 */
const createValidator = <T extends z.Schema>(schema: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      } else {
        next(error);
      }
    }
  };
};

// Resume content validator
export const validateResumeContent = createValidator(resumeContentSchema);

// Job description validator
export const validateJobDescription = createValidator(jobDescriptionSchema);

// User authentication validator
export const validateUserAuth = createValidator(userAuthSchema);

// Create validators for various routes
export const validateAnalysisId = (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Invalid analysis ID' 
    });
  }
  next();
};

// Cover letter validation
export const validateCoverLetter = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, company, formats } = req.body;
    
    if (!role || !company || !formats || !Array.isArray(formats) || formats.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: [{ 
          path: 'required_fields', 
          message: 'Missing required fields: role, company, and at least one format'
        }]
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// LinkedIn profile validator
export const validateLinkedInProfile = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sections } = req.body;
    
    // Basic validation - sections must be an array
    if (!Array.isArray(sections)) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: [{ path: 'sections', message: 'Sections must be an array' }]
      });
    }
    
    // Each section should have title and content
    const invalidSections = sections.filter(s => 
      typeof s !== 'object' || 
      !s.title || 
      !s.content ||
      typeof s.title !== 'string' ||
      typeof s.content !== 'string'
    );
    
    if (invalidSections.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: [{ 
          path: 'sections', 
          message: 'Each section must have a title and content string'
        }]
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Generic ID validator for route params
export const validateParamId = (req: Request, res: Response, next: NextFunction) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID parameter',
      errors: [{ path: 'id', message: 'ID must be a positive integer' }]
    });
  }
  
  req.params.id = id.toString();
  next();
};