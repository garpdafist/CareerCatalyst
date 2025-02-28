import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  salary: text("salary").notNull(),
});

export const resumeAnalysis = pgTable("resume_analysis", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback").array(),
  skills: text("skills").array(),
  improvements: text("improvements").array(),
  keywords: text("keywords").array(),
});

export const insertJobSchema = createInsertSchema(jobs).pick({
  title: true,
  company: true,
  location: true,
  category: true,
  description: true,
  salary: true,
});

export const insertResumeAnalysisSchema = createInsertSchema(resumeAnalysis).pick({
  content: true,
  score: true,
  feedback: true,
  skills: true,
  improvements: true,
  keywords: true,
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type ResumeAnalysis = typeof resumeAnalysis.$inferSelect;
export type InsertResumeAnalysis = z.infer<typeof insertResumeAnalysisSchema>;