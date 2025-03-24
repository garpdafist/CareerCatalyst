import { type ResumeAnalysis, type InsertResumeAnalysis, type User, type InsertUser } from "@shared/schema";
import { analyzeResumeWithAI } from "./services/openai";
import { db } from "./db";
import { users, resumeAnalyses } from "@shared/schema";
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
      resumeSections: any;
      identifiedSkills: string[];
      importantKeywords: string[];
      suggestedImprovements: string[];
      generalFeedback: string;
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
      const aiAnalysis = await analyzeResumeWithAI(content);

      console.log('Received AI analysis:', {
        score: aiAnalysis.score,
        hasScores: !!aiAnalysis.scores,
        hasResumeSections: !!aiAnalysis.resumeSections,
        skillsCount: aiAnalysis.identifiedSkills?.length || 0,
        timestamp: new Date().toISOString()
      });

      // Save the analysis
      return this.saveResumeAnalysis({
        userId,
        content,
        score: aiAnalysis.score,
        analysis: {
          scores: aiAnalysis.scores,
          resumeSections: aiAnalysis.resumeSections,
          identifiedSkills: aiAnalysis.identifiedSkills,
          importantKeywords: aiAnalysis.importantKeywords,
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
    analysis: {
      scores: any;
      resumeSections: any;
      identifiedSkills: string[];
      importantKeywords: string[];
      suggestedImprovements: string[];
      generalFeedback: string;
    };
  }): Promise<ResumeAnalysis> {
    console.log('Saving resume analysis:', {
      userId: data.userId,
      score: data.score,
      hasScores: !!data.analysis.scores,
      hasGeneralFeedback: !!data.analysis.generalFeedback,
      hasPrimaryKeywords: !!data.analysis.importantKeywords,
      timestamp: new Date().toISOString()
    });

    try {
      const [analysis] = await db
        .insert(resumeAnalyses)
        .values({
          userId: data.userId,
          content: data.content,
          score: data.score,
          scores: data.analysis.scores,
          identifiedSkills: data.analysis.identifiedSkills,
          primaryKeywords: data.analysis.importantKeywords || data.analysis.primaryKeywords || [],
          suggestedImprovements: data.analysis.suggestedImprovements,
          generalFeedback: typeof data.analysis.generalFeedback === 'object' 
            ? data.analysis.generalFeedback.overall 
            : data.analysis.generalFeedback || "",
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      console.log('Successfully saved analysis:', {
        id: analysis.id,
        userId: analysis.userId,
        score: analysis.score,
        hasPrimaryKeywords: !!analysis.primaryKeywords,
        primaryKeywordsCount: analysis.primaryKeywords?.length,
        hasGeneralFeedback: !!analysis.generalFeedback,
        generalFeedbackContent: analysis.generalFeedback,
        timestamp: new Date().toISOString()
      });

      return analysis;
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
    const [analysis] = await db
      .select()
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.id, id));
    return analysis;
  }

  async getUserAnalyses(userId: string): Promise<ResumeAnalysis[]> {
    return db
      .select()
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.userId, userId))
      .orderBy(resumeAnalyses.createdAt);
  }
}

export const storage = new DatabaseStorage();