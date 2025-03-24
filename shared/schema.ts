import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Job description schema with structured fields
export const jobDescriptionSchema = z.object({
  roleTitle: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  industry: z.string().optional(),
  companyName: z.string().optional(),
  primaryKeywords: z.array(z.string()).optional(),
  summary: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
});

// Keep existing scoring criteria schema
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
  jobDescription: jsonb("job_description").default(null),
  score: integer("score").notNull(),
  scores: jsonb("scores").notNull(),
  resumeSections: jsonb("resume_sections").notNull(),
  identifiedSkills: text("identified_skills").array(),
  primaryKeywords: text("primary_keywords").array(),
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
export type JobDescription = z.infer<typeof jobDescriptionSchema>;

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

// Keep existing schemas
export const userAuthSchema = createInsertSchema(users).pick({
  email: true,
});

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