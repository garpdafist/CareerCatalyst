import React from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface ResumeAnalysisSkeletonProps {
  progress: number; // 0-100
  status?: string;
  funMessage?: string;
  includesJobDescription?: boolean;
  expectedTime?: string;
}

/**
 * A unified skeleton loading component for resume analysis
 * - Displays fun loading messages
 * - Shows skeleton placeholders that match the final results
 * - Includes conditional elements for job description analysis
 */
export function ResumeAnalysisSkeleton({ 
  progress, 
  status = "Processing...",
  funMessage = "Hang tight while we rummage through your resume for hidden talents…",
  includesJobDescription = false,
  expectedTime = "10-15 seconds"
}: ResumeAnalysisSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Fun loading message with animation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-100"
      >
        <p className="text-lg font-medium text-blue-700 mb-1">
          {/* Dynamic fun message based on progress */}
          {progress < 30 ? "Hunting for hidden skills in your resume..." :
           progress < 60 ? "Matching your experience with industry standards..." :
           progress < 90 ? "Crafting personalized suggestions..." :
           "Polishing the final recommendations..."}
        </p>
        {includesJobDescription && (
          <p className="text-sm text-blue-600">
            We're also matching your resume against the job listing to see how you stack up.
          </p>
        )}
      </motion.div>
      
      {/* What to expect panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-center text-sm text-muted-foreground mb-6 bg-muted/30 p-3 rounded-md"
      >
        <p>
          We're extracting your strengths, suggesting improvements
          {includesJobDescription ? ", and comparing your resume with job requirements" : ""}. 
          This usually takes about {expectedTime}.
        </p>
      </motion.div>

      {/* Status text */}
      <div className="text-center text-base font-medium text-foreground mb-4">
        {status}
      </div>

      {/* Skeleton placeholders for content that is loading */}
      <div className="space-y-8 mt-8">
        {/* Score skeleton - Representing the overall score section */}
        <motion.div 
          className="p-6 border border-gray-100 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-48 mb-2" /> {/* Analysis Results heading */}
              <Skeleton className="h-4 w-32" /> {/* Subtitle */}
            </div>
            
            {/* Circle score indicator - will display final score, e.g. "65/100" */}
            <div className="relative">
              <Skeleton className="h-16 w-16 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.div>

        {/* Key Skills Section - Pills representing skills */}
        <motion.div 
          className="p-6 border border-gray-100 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: progress >= 30 ? 1 : 0.6
          }}
          transition={{ duration: 0.5 }}
        >
          <Skeleton className="h-6 w-32 mb-4 animate-pulse" /> {/* "Key Skills" heading */}
          <div className="flex flex-wrap gap-2">
            {/* Skill pill placeholders */}
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton 
                key={i} 
                className="h-8 w-20 md:w-24 rounded-full animate-pulse" // Pill-shaped for skills badges
              />
            ))}
          </div>
        </motion.div>

        {/* Keywords Section */}
        <motion.div 
          className="p-6 border border-gray-100 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: progress >= 50 ? 1 : 0.6
          }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Skeleton className="h-6 w-40 mb-4 animate-pulse" /> {/* "Primary Keywords" heading */}
          <Skeleton className="h-4 w-60 mb-3 animate-pulse" /> {/* "Keywords from your resume:" subtitle */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Keyword pill placeholders */}
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton 
                key={i} 
                className="h-7 w-28 rounded-full animate-pulse" // Pill-shaped for keyword badges
              />
            ))}
          </div>
          
          {includesJobDescription && (
            <>
              <Skeleton className="h-4 w-64 mb-3 mt-6 animate-pulse" /> {/* "Target keywords from job description" subtitle */}
              <div className="flex flex-wrap gap-2">
                {/* Target keyword pill placeholders */}
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton 
                    key={i} 
                    className="h-7 w-24 rounded-full animate-pulse" // Pill-shaped for keyword badges
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>

        {/* Suggested Improvements Section - Horizontal bars for bullet points */}
        <motion.div 
          className="p-6 border border-gray-100 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: progress >= 75 ? 1 : 0.6
          }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Skeleton className="h-6 w-56 mb-4 animate-pulse" /> {/* "Suggested Improvements" heading */}
          <div className="space-y-4">
            {/* Improvement bullet point placeholders */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 mt-1 rounded-full flex-shrink-0 animate-pulse" /> {/* Bullet point icon */}
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full animate-pulse" />
                  <Skeleton className="h-4 w-[85%] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Job Match Analysis (conditionally rendered) */}
        {includesJobDescription && (
          <motion.div 
            className="p-6 border border-gray-100 rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: progress >= 85 ? 1 : 0.6
            }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Skeleton className="h-6 w-44 mb-6 animate-pulse" /> {/* "Job Match Analysis" heading */}
            
            {/* Strengths Section */}
            <Skeleton className="h-5 w-48 mb-3 animate-pulse" /> {/* "Alignment & Strengths" subheading */}
            <div className="space-y-3 mb-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-5 w-5 mt-1 rounded-full flex-shrink-0 animate-pulse" /> {/* Icon */}
                  <Skeleton className="h-4 w-full flex-1 animate-pulse" />
                </div>
              ))}
            </div>
            
            {/* Gaps Section */}
            <Skeleton className="h-5 w-36 mb-3 animate-pulse" /> {/* "Gaps & Concerns" subheading */}
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-5 w-5 mt-1 rounded-full flex-shrink-0 animate-pulse" /> {/* Icon */}
                  <Skeleton className="h-4 w-full flex-1 animate-pulse" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}