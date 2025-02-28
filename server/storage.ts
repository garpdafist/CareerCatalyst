import { type ResumeAnalysis, type InsertResumeAnalysis } from "@shared/schema";
import { analyzeResumeWithAI } from "./services/openai";

export interface IStorage {
  analyzeResume(content: string, userId?: string): Promise<ResumeAnalysis>;
  getResumeAnalysis(id: number): Promise<ResumeAnalysis | undefined>;
  getUserAnalyses(userId: string): Promise<ResumeAnalysis[]>;
}

export class MemStorage implements IStorage {
  private resumeAnalyses: Map<number, ResumeAnalysis>;
  private analysisId: number;

  constructor() {
    this.resumeAnalyses = new Map();
    this.analysisId = 1;
  }

  async analyzeResume(content: string, userId?: string): Promise<ResumeAnalysis> {
    const aiAnalysis = await analyzeResumeWithAI(content);

    const analysis: ResumeAnalysis = {
      id: this.analysisId++,
      userId: userId || null,
      content,
      ...aiAnalysis,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.resumeAnalyses.set(analysis.id, analysis);
    return analysis;
  }

  async getResumeAnalysis(id: number): Promise<ResumeAnalysis | undefined> {
    return this.resumeAnalyses.get(id);
  }

  async getUserAnalyses(userId: string): Promise<ResumeAnalysis[]> {
    return Array.from(this.resumeAnalyses.values())
      .filter(analysis => analysis.userId === userId);
  }
}

export const storage = new MemStorage();