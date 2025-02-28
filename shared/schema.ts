import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const resumeAnalysis = pgTable("resume_analysis", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  content: text("content").notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback").array(),
  skills: text("skills").array(),
  improvements: text("improvements").array(),
  keywords: text("keywords").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertResumeAnalysisSchema = createInsertSchema(resumeAnalysis).pick({
  userId: true,
  content: true,
  score: true,
  feedback: true,
  skills: true,
  improvements: true,
  keywords: true,
});

export type ResumeAnalysis = typeof resumeAnalysis.$inferSelect;
export type InsertResumeAnalysis = z.infer<typeof insertResumeAnalysisSchema>;