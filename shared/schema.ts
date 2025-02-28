import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Resume analysis table with user relation
export const resumeAnalyses = pgTable("resume_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  score: integer("score").notNull(),
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
  score: true,
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