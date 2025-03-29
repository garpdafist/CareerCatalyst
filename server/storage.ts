import { 
  type ResumeAnalysis, 
  type InsertResumeAnalysis, 
  type User, 
  type InsertUser,
  type ResumeSections
} from "@shared/schema";
import { analyzeResume } from "./services/resume-analyzer";
import { db } from "./db";
import { users, resumeAnalyses, resumeSectionsSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { Store } from "express-session";
import connectPg from "connect-pg-simple";
import session from "express-session";

export interface IStorage {
  // User management
  createUser(email: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  verifyEmail(email: string): Promise<void>;

  // Resume analysis with string ID
  analyzeResume(content: string, userId: string): Promise<ResumeAnalysis>;
  getResumeAnalysis(id: number): Promise<ResumeAnalysis | undefined>;
  getUserAnalyses(userId: string): Promise<ResumeAnalysis[]>;

  // New method for saving analysis
  saveResumeAnalysis(data: {
    userId: string;
    content: string;
    score: number;
    analysis: {
      scores: any;
      identifiedSkills: string[];
      primaryKeywords: string[];
      suggestedImprovements: string[];
      generalFeedback: { overall: string } | string;
    };
  }): Promise<ResumeAnalysis>;

  // Session store for authentication
  sessionStore: Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: Store;

  constructor() {
    const PostgresStore = connectPg(session);
    this.sessionStore = new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });
  }

  async createUser(email: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: randomBytes(16).toString("hex"),
        email,
        emailVerified: new Date(),
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  async verifyEmail(email: string): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerified: new Date(),
        lastLoginAt: new Date()
      })
      .where(eq(users.email, email));
  }

  async analyzeResume(content: string, userId: string): Promise<ResumeAnalysis> {
    console.log('Starting resume analysis for user:', {
      userId,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    });

    try {
      // Get the AI analysis
      const aiAnalysis = await analyzeResume(content);

      console.log('Received AI analysis:', {
        score: aiAnalysis.score,
        hasScores: !!aiAnalysis.scores,
        primaryKeywordsCount: aiAnalysis.primaryKeywords?.length,
        primaryKeywords: aiAnalysis.primaryKeywords,
        timestamp: new Date().toISOString()
      });

      // Save the analysis
      return this.saveResumeAnalysis({
        userId,
        content,
        score: aiAnalysis.score,
        analysis: {
          scores: aiAnalysis.scores,
          identifiedSkills: aiAnalysis.identifiedSkills,
          primaryKeywords: aiAnalysis.primaryKeywords || [], // Ensure we use primaryKeywords consistently
          suggestedImprovements: aiAnalysis.suggestedImprovements,
          generalFeedback: aiAnalysis.generalFeedback
        }
      });
    } catch (error: any) {
      console.error('Error during resume analysis:', {
        error: error.message,
        userId,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async saveResumeAnalysis(data: {
    userId: string;
    content: string;
    score: number;
    jobDescription?: string; // Add job description parameter
    analysis: {
      scores: any;
      identifiedSkills: string[];
      primaryKeywords: string[];
      suggestedImprovements: string[];
      generalFeedback: { overall: string } | string;
      jobAnalysis?: any; // Add job analysis data
    };
  }): Promise<ResumeAnalysis> {
    console.log('Saving resume analysis:', {
      userId: data.userId,
      score: data.score,
      hasGeneralFeedback: !!data.analysis.generalFeedback,
      generalFeedbackContent: typeof data.analysis.generalFeedback === 'object'
        ? data.analysis.generalFeedback.overall
        : data.analysis.generalFeedback,
      hasPrimaryKeywords: !!data.analysis.primaryKeywords,
      primaryKeywordsCount: data.analysis.primaryKeywords?.length,
      primaryKeywords: data.analysis.primaryKeywords,
      timestamp: new Date().toISOString()
    });

    try {
      // Create valid insert object using type safety
      const insertData: InsertResumeAnalysis = {
        userId: data.userId,
        content: data.content,
        score: data.score,
        scores: data.analysis.scores,
        // Add job description if available
        jobDescription: data.jobDescription ? { 
          text: data.jobDescription 
        } : null,
        resumeSections: resumeSectionsSchema.parse({ 
          professionalSummary: "",
          workExperience: "",
          technicalSkills: "",
          education: "",
          keyAchievements: ""
        }),
        identifiedSkills: data.analysis.identifiedSkills,
        primaryKeywords: data.analysis.primaryKeywords,
        suggestedImprovements: data.analysis.suggestedImprovements,
        generalFeedback: typeof data.analysis.generalFeedback === 'object'
          ? data.analysis.generalFeedback.overall || ''
          : data.analysis.generalFeedback || '',
        // Include job analysis in the stored JSON
        // Use type assertion to handle the schema evolution
        ...(data.analysis.jobAnalysis ? { jobAnalysis: data.analysis.jobAnalysis } : {}),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Now insert with the validated data
      const [analysis] = await db
        .insert(resumeAnalyses)
        .values(insertData)
        .returning();

      console.log('Successfully saved analysis:', {
        id: analysis.id,
        userId: analysis.userId,
        score: analysis.score,
        hasPrimaryKeywords: !!analysis.primaryKeywords,
        primaryKeywordsCount: analysis.primaryKeywords?.length,
        primaryKeywords: analysis.primaryKeywords,
        hasGeneralFeedback: !!analysis.generalFeedback,
        generalFeedbackContent: analysis.generalFeedback,
        timestamp: new Date().toISOString()
      });

      // Cast to expected type - this is safe since we know the DB structure matches our type
      return analysis as unknown as ResumeAnalysis;
    } catch (error: any) {
      console.error('Error saving resume analysis:', {
        error: error.message,
        userId: data.userId,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async getResumeAnalysis(id: number): Promise<ResumeAnalysis | undefined> {
    try {
      const [analysis] = await db
        .select()
        .from(resumeAnalyses)
        .where(eq(resumeAnalyses.id, id));

      if (!analysis) return undefined;

      // Ensure proper type conversion and field presence
      return {
        ...analysis,
        id: Number(analysis.id),
        score: Number(analysis.score),
        scores: analysis.scores || {},
        identifiedSkills: Array.isArray(analysis.identifiedSkills) ? analysis.identifiedSkills : [],
        primaryKeywords: Array.isArray(analysis.primaryKeywords) ? analysis.primaryKeywords : [],
        suggestedImprovements: Array.isArray(analysis.suggestedImprovements) ? analysis.suggestedImprovements : [],
        generalFeedback: analysis.generalFeedback || '',
        createdAt: new Date(analysis.createdAt),
        updatedAt: new Date(analysis.updatedAt)
      } as ResumeAnalysis;
    } catch (error) {
      console.error('Error in getResumeAnalysis:', error);
      throw error;
    }
  }

  async getUserAnalyses(userId: string): Promise<ResumeAnalysis[]> {
    const results = await db
      .select()
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.userId, userId))
      .orderBy(resumeAnalyses.createdAt);
    return results as unknown as ResumeAnalysis[];
  }
}

export const storage = new DatabaseStorage();