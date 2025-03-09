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
    // Get the AI analysis
    const aiAnalysis = await analyzeResumeWithAI(content);

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
    const [analysis] = await db
      .insert(resumeAnalyses)
      .values({
        userId: data.userId,
        content: data.content,
        score: data.score,
        scores: data.analysis.scores,
        resumeSections: data.analysis.resumeSections,
        identifiedSkills: data.analysis.identifiedSkills,
        importantKeywords: data.analysis.importantKeywords,
        suggestedImprovements: data.analysis.suggestedImprovements,
        generalFeedback: data.analysis.generalFeedback,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return analysis;
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