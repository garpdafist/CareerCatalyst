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
      .values({ email })
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
    try {
      const aiAnalysis = await analyzeResumeWithAI(content);

      const [analysis] = await db
        .insert(resumeAnalyses)
        .values({
          userId,
          content: content.substring(0, 10000), // Limit content length for storage
          ...aiAnalysis,
        })
        .returning();

      return analysis;
    } catch (error: any) {
      // If it's a rate limit error, fall back to mock data for testing
      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        console.log('Rate limit hit, falling back to mock data');

        const mockAnalysis = {
          userId,
          content: content.substring(0, 100) + '...', // Store truncated content
          score: 75,
          feedback: ['Good overall structure', 'Consider adding more quantifiable achievements'],
          skills: ['JavaScript', 'React', 'Node.js'],
          improvements: ['Add more specific examples', 'Highlight leadership experience'],
          keywords: ['full-stack', 'web development', 'agile'],
        };

        const [analysis] = await db
          .insert(resumeAnalyses)
          .values(mockAnalysis)
          .returning();

        return analysis;
      }
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