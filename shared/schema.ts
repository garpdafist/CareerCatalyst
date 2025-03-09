import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Scoring criteria schema with proper weighting
export const scoringCriteriaSchema = z.object({
  keywordsRelevance: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string(),
    keywords: z.array(z.string())
  }),
  achievementsMetrics: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string(),
    highlights: z.array(z.string())
  }),
  structureReadability: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string()
  }),
  summaryClarity: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string()
  }),
  overallPolish: z.object({
    score: z.number(),
    maxScore: z.number(),
    feedback: z.string()
  })
});

// Resume sections schema
export const resumeSectionsSchema = z.object({
  professionalSummary: z.string(),
  workExperience: z.string(),
  technicalSkills: z.string(),
  education: z.string(),
  keyAchievements: z.string()
});

// Resume analysis table with enhanced fields
export const resumeAnalyses = pgTable("resume_analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  score: integer("score").notNull(),
  scores: jsonb("scores").notNull(),
  resumeSections: jsonb("resume_sections").notNull(),
  identifiedSkills: text("identified_skills").array(),
  importantKeywords: text("important_keywords").array(),
  suggestedImprovements: text("suggested_improvements").array(),
  generalFeedback: text("general_feedback"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types for our application
export type ResumeAnalysis = typeof resumeAnalyses.$inferSelect;
export type InsertResumeAnalysis = typeof resumeAnalyses.$inferInsert;
export type ScoringCriteria = z.infer<typeof scoringCriteriaSchema>;
export type ResumeSections = z.infer<typeof resumeSectionsSchema>;

// Keep existing user schema and relations
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userRelations = relations(users, ({ many }) => ({
  analyses: many(resumeAnalyses),
}));

export const resumeAnalysisRelations = relations(resumeAnalyses, ({ one }) => ({
  user: one(users, {
    fields: [resumeAnalyses.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Schema for email-based authentication
export const userAuthSchema = createInsertSchema(users).pick({
  email: true,
});

// Schema for resume analysis -  This is now redundant as the insert type is derived from the table definition
// export const insertResumeAnalysisSchema = createInsertSchema(resumeAnalyses).pick({
//   userId: true,
//   content: true,
//   structuredContent: true,
//   score: true,
//   scoringCriteria: true,
//   feedback: true,
//   skills: true,
//   improvements: true,
//   keywords: true,
// });


// Define structured resume content schema  - This is not directly used in the updated schema, but might be useful elsewhere.
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

// Types for our application - These are now mostly redundant, but kept for backward compatibility.
// export type User = typeof users.$inferSelect;
// export type InsertUser = z.infer<typeof userAuthSchema>;
// export type ResumeAnalysis = typeof resumeAnalyses.$inferSelect;
// export type InsertResumeAnalysis = z.infer<typeof insertResumeAnalysisSchema>;
// export type ScoringCriteria = z.infer<typeof scoringCriteriaSchema>;
// export type ResumeContent = z.infer<typeof resumeContentSchema>;