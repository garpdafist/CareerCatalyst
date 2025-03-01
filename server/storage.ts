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

    // Create test user during initialization
    this.ensureTestUser().catch(console.error);
  }

  private async ensureTestUser() {
    try {
      const testUser = await this.getUserByEmail("test@example.com");
      if (!testUser) {
        console.log("Creating test user...");
        await this.createUser("test@example.com", "test-user-123");
      }
    } catch (error) {
      console.error("Failed to create test user:", error);
    }
  }

  async createUser(email: string, id?: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: id || randomBytes(16).toString("hex"),
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
    try {
      // Validate content
      if (!content || content.trim().length === 0) {
        throw new Error("Resume content is empty or invalid");
      }
      
      // Log content length before analysis
      console.log('Analyzing resume content:', {
        contentLength: content.length,
        firstChars: content.substring(0, 100) + '...'
      });

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
      console.error('Analysis error:', {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack
      });

      // Instead of using mock data, throw the error with details
      throw new Error(`Resume analysis failed: ${error.message}`);
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