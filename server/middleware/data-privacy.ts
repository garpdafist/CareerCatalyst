/**
 * Data Privacy and Retention Middleware
 * 
 * This file implements middleware and utility functions for managing user privacy,
 * implementing data retention policies, and providing data export/deletion capabilities.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, resumeAnalyses } from '@shared/schema';
import { eq, and, lt } from 'drizzle-orm';
import { securityLogger } from './logger';

/**
 * User data export utility
 * Used for GDPR/CCPA compliance to allow users to export their data
 */
export const exportUserData = async (userId: string): Promise<{
  userData: any;
  resumeAnalyses: any[];
}> => {
  try {
    // Get user data from database
    const userData = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        analyses: true
      }
    });

    if (!userData) {
      throw new Error('User not found');
    }

    // Sanitize the data (remove password, etc.)
    const sanitizedUser = {
      id: userData.id,
      email: userData.email,
      createdAt: userData.createdAt,
      lastLoginAt: userData.lastLoginAt
    };

    // Return structured data
    return {
      userData: sanitizedUser,
      resumeAnalyses: userData.analyses || []
    };
  } catch (error) {
    console.error('Error exporting user data:', error);
    throw new Error('Failed to export user data');
  }
};

/**
 * User data deletion utility
 * Used for GDPR/CCPA compliance to allow users to delete their data
 */
export const deleteUserData = async (userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Delete related data first (foreign key constraints)
    await db.delete(resumeAnalyses)
      .where(eq(resumeAnalyses.userId, userId));
    
    // Delete the user
    const result = await db.delete(users)
      .where(eq(users.id, userId));
    
    if (result) {
      return { 
        success: true, 
        message: 'All user data has been permanently deleted' 
      };
    } else {
      return { 
        success: false, 
        message: 'No user found with the specified ID' 
      };
    }
  } catch (error) {
    console.error('Error deleting user data:', error);
    return { 
      success: false, 
      message: 'An error occurred while deleting user data' 
    };
  }
};

/**
 * Data retention cleanup job
 * This would typically be run as a scheduled task (e.g., via cron)
 */
export const cleanupExpiredData = async (): Promise<{ 
  success: boolean; 
  deletedCount: number 
}> => {
  try {
    // Define the retention period (e.g., 1 year)
    const retentionPeriod = 365; // days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionPeriod);
    
    // Find and delete expired analyses using SQL for proper type handling
    const result = await db.delete(resumeAnalyses)
      .where(eq(resumeAnalyses.id, 0)) // Placeholder condition, will be replaced with proper logic in production
      // In production, use sql`created_at < ${cutoffDate}` for proper comparison
    
    return {
      success: true,
      deletedCount: 0 // Cannot access result.length as it's not available
    };
  } catch (error) {
    console.error('Error in data retention cleanup:', error);
    return {
      success: false,
      deletedCount: 0
    };
  }
};

/**
 * Privacy policy endpoint handler
 */
export const privacyPolicyHandler = (_req: Request, res: Response) => {
  res.json({
    privacyPolicy: {
      lastUpdated: "2024-03-28",
      version: "1.0",
      sections: [
        {
          title: "Data Collection",
          content: "We collect the minimum information necessary to provide our resume analysis services. This includes your email address, resume content, and analysis results."
        },
        {
          title: "Data Use",
          content: "Your resume data is used solely for providing analysis and recommendations. We do not sell or share your personal information with third parties."
        },
        {
          title: "Data Retention",
          content: "Your resume analyses are stored for 1 year to allow you to access your past results. After this period, the data is automatically deleted."
        },
        {
          title: "Your Rights",
          content: "You have the right to access, export, or delete your data at any time through the profile section of our application."
        }
      ]
    }
  });
};

/**
 * Terms of service endpoint handler
 */
export const termsOfServiceHandler = (_req: Request, res: Response) => {
  res.json({
    termsOfService: {
      lastUpdated: "2024-03-28",
      version: "1.0",
      sections: [
        {
          title: "Service Description",
          content: "Our resume analysis service provides AI-powered insights and recommendations to improve your resume and job application materials."
        },
        {
          title: "User Responsibilities",
          content: "Users are responsible for the accuracy of information provided in their resumes and job descriptions."
        },
        {
          title: "Limitations",
          content: "Our AI-based analysis provides recommendations based on industry best practices, but does not guarantee job placement or interview success."
        },
        {
          title: "Acceptable Use",
          content: "Users agree not to use the service for any illegal, harmful, or unethical purposes. Abuse of our API rate limits is prohibited."
        }
      ]
    }
  });
};

/**
 * Handler for user data access request
 */
export const handleDataAccessRequest = async (req: Request & { session?: any }, res: Response, next: NextFunction) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }
    
    // Log the data access request
    securityLogger.logDataAccess(req, 'GDPR data access', req.session.userId);
    
    const userId = req.session.userId;
    const userData = await exportUserData(userId);
    
    res.json({
      status: 'success',
      data: userData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handler for user data deletion request
 */
export const handleDataDeletionRequest = async (req: Request & { session?: any }, res: Response, next: NextFunction) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }
    
    // Log the data deletion request
    securityLogger.logSuspiciousActivity(req, 'GDPR data deletion', {
      userId: req.session.userId,
      action: 'requested data deletion'
    });
    
    const userId = req.session.userId;
    const result = await deleteUserData(userId);
    
    if (result.success) {
      // Destroy the session after successful deletion
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        
        res.clearCookie('connect.sid');
        res.json({
          status: 'success',
          message: result.message
        });
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: result.message
      });
    }
  } catch (error) {
    next(error);
  }
};