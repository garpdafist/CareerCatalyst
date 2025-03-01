import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User table for authentication
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define scoring criteria schema
export const scoringCriteriaSchema = z.object({
  keywordUsage: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string(),
    keywords: z.array(z.string())
  }),
  metricsAndAchievements: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string(),
    highlights: z.array(z.string())
  }),
  structureAndReadability: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string()
  }),
  overallImpression: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string()
  })
});

// Define structured resume content schema
export const resumeContentSchema = z.object({
  professionalSummary: z.string(),
  workExperience: z.array(z.object({
    company: z.string(),
    position: z.string(),
    duration: z.string(),
    achievements: z.array(z.string())
  })),
  technicalSkills: z.array(z.string()),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    year: z.string()
  })),
  certifications: z.array(z.string()).optional(),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string(),
    technologies: z.array(z.string())
  })).optional()
});

// Resume analysis table with user relation and enhanced scoring
export const resumeAnalyses = pgTable("resume_analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  structuredContent: jsonb("structured_content").notNull(),
  score: integer("score").notNull(),
  scoringCriteria: jsonb("scoring_criteria").notNull(),
  feedback: text("feedback").array(),
  skills: text("skills").array(),
  improvements: text("improvements").array(),
  keywords: text("keywords").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relationships
export const userRelations = relations(users, ({ many }) => ({
  analyses: many(resumeAnalyses),
}));

export const resumeAnalysisRelations = relations(resumeAnalyses, ({ one }) => ({
  user: one(users, {
    fields: [resumeAnalyses.userId],
    references: [users.id],
  }),
}));

// Schema for email-based authentication
export const userAuthSchema = createInsertSchema(users).pick({
  email: true,
});

// Schema for resume analysis
export const insertResumeAnalysisSchema = createInsertSchema(resumeAnalyses).pick({
  userId: true,
  content: true,
  structuredContent: true,
  score: true,
  scoringCriteria: true,
  feedback: true,
  skills: true,
  improvements: true,
  keywords: true,
});

// Types for our application
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof userAuthSchema>;
export type ResumeAnalysis = typeof resumeAnalyses.$inferSelect;
export type InsertResumeAnalysis = z.infer<typeof insertResumeAnalysisSchema>;
export type ScoringCriteria = z.infer<typeof scoringCriteriaSchema>;
export type ResumeContent = z.infer<typeof resumeContentSchema>;