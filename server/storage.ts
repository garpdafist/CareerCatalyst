import { type Job, type InsertJob, type ResumeAnalysis, type InsertResumeAnalysis } from "@shared/schema";

export interface IStorage {
  getJobs(): Promise<Job[]>;
  getJobById(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  analyzeResume(content: string): Promise<ResumeAnalysis>;
}

export class MemStorage implements IStorage {
  private jobs: Map<number, Job>;
  private resumeAnalyses: Map<number, ResumeAnalysis>;
  private jobId: number;
  private analysisId: number;

  constructor() {
    this.jobs = new Map();
    this.resumeAnalyses = new Map();
    this.jobId = 1;
    this.analysisId = 1;
    this.seedJobs();
  }

  private seedJobs() {
    const mockJobs: InsertJob[] = [
      {
        title: "Frontend Developer",
        company: "TechCorp",
        location: "Remote",
        category: "Engineering",
        description: "Looking for a skilled frontend developer...",
        salary: "$80,000 - $120,000",
      },
      {
        title: "Product Manager",
        company: "StartupX",
        location: "New York, NY",
        category: "Product",
        description: "Experienced product manager needed...",
        salary: "$100,000 - $150,000",
      },
      {
        title: "Data Scientist",
        company: "DataCo",
        location: "San Francisco, CA",
        category: "Data",
        description: "Join our data science team...",
        salary: "$90,000 - $140,000",
      },
    ];

    mockJobs.forEach(job => this.createJob(job));
  }

  async getJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values());
  }

  async getJobById(id: number): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async createJob(job: InsertJob): Promise<Job> {
    const id = this.jobId++;
    const newJob = { ...job, id };
    this.jobs.set(id, newJob);
    return newJob;
  }

  async analyzeResume(content: string): Promise<ResumeAnalysis> {
    // Mock resume analysis logic
    const score = Math.floor(Math.random() * 40) + 60; // Score between 60-100
    const feedback = [
      "Consider adding more quantifiable achievements",
      "Include relevant keywords for your industry",
      "Make sure to highlight your technical skills",
    ];

    const analysis: ResumeAnalysis = {
      id: this.analysisId++,
      content,
      score,
      feedback,
    };

    this.resumeAnalyses.set(analysis.id, analysis);
    return analysis;
  }
}

export const storage = new MemStorage();
