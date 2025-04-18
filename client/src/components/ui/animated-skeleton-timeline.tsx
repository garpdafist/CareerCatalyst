import React from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  Cog, 
  Lightbulb, 
  CheckCircle2 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AnimatedSkeletonTimelineProps {
  progress: number; // 0-100
  status?: string;
  showSkeletons?: boolean;
  funMessage?: string;
  includesJobDescription?: boolean;
  expectedTime?: string;
}

export function AnimatedSkeletonTimeline({ 
  progress, 
  status = "Processing...",
  showSkeletons = true,
  funMessage = "Hang tight while we rummage through your resume for hidden talents…",
  includesJobDescription = false,
  expectedTime = "10-15 seconds"
}: AnimatedSkeletonTimelineProps) {
  // Define the steps in the timeline
  const steps = [
    { 
      id: "analyzing", 
      label: "Analyzing", 
      threshold: 25, 
      icon: Search,
      animation: "pulse" 
    },
    { 
      id: "processing", 
      label: "Processing", 
      threshold: 50, 
      icon: Cog,
      animation: "spin"
    },
    { 
      id: "generating", 
      label: "Generating", 
      threshold: 75, 
      icon: Lightbulb,
      animation: "glow"
    },
    { 
      id: "complete", 
      label: "Complete", 
      threshold: 100, 
      icon: CheckCircle2,
      animation: "check"
    }
  ];

  // Calculate current active step
  const activeStepIndex = steps.findIndex(step => progress < step.threshold) - 1;
  const activeStep = activeStepIndex >= 0 ? steps[activeStepIndex] : steps[steps.length - 1];

  return (
    <div className="space-y-6">
      {/* Fun loading message with animation */}
      <div className="text-center mb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-100"
        >
          <p className="text-lg font-medium text-blue-700 mb-1">
            {funMessage}
          </p>
          {includesJobDescription && (
            <p className="text-sm text-blue-600">
              We're also matching your resume against the job listing to see how you stack up.
            </p>
          )}
        </motion.div>
      </div>
      
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

      {/* Timeline container */}
      <div className="relative">
        {/* Horizontal line */}
        <div className="absolute top-10 left-0 right-0 h-1 bg-muted rounded-full" />
        
        {/* Active progress line */}
        <motion.div 
          className="absolute top-10 left-0 h-1 bg-primary rounded-full origin-left" 
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progress / 100 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {/* Steps */}
        <div className="flex justify-between relative">
          {steps.map((step, index) => {
            const isActive = progress >= step.threshold || 
                           (index === activeStepIndex + 1 && progress > steps[index - 1]?.threshold || 0);
            const isCompleted = progress >= step.threshold;
            const isCurrent = activeStep.id === step.id;

            return (
              <div key={step.id} className="flex flex-col items-center w-1/4">
                {/* Icon and circle container */}
                <div className="relative mb-2">
                  {/* Background circle */}
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {/* Icon */}
                    <step.icon 
                      className={`w-8 h-8 ${isCurrent ? "text-primary-foreground" : ""}`} 
                    />
                    
                    {/* Animations for current step */}
                    {isCurrent && (
                      <>
                        {step.animation === "pulse" && (
                          <motion.div
                            className="absolute inset-0 rounded-full bg-primary"
                            initial={{ opacity: 0.5, scale: 1 }}
                            animate={{ opacity: 0, scale: 1.3 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                        {step.animation === "spin" && (
                          <motion.div
                            className="absolute inset-0 flex items-center justify-center"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          >
                            <Cog className="w-10 h-10 text-primary-foreground" />
                          </motion.div>
                        )}
                        {step.animation === "glow" && (
                          <motion.div
                            className="absolute inset-0 rounded-full bg-primary"
                            initial={{ opacity: 0.3 }}
                            animate={{ opacity: 0.7 }}
                            transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
                          />
                        )}
                        {step.animation === "check" && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                          >
                            <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
                          </motion.div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Label */}
                <motion.span
                  className={`text-sm font-medium ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  initial={{ opacity: 0.6 }}
                  animate={{ 
                    opacity: isCurrent ? 1 : 0.6,
                    scale: isCurrent ? 1.1 : 1
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {step.label}
                </motion.span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skeleton placeholders for content that is loading */}
      {showSkeletons && (
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
                <Skeleton className="h-16 w-16 rounded-full" />
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
                  animate={{ 
                    x: ['-100%', '100%'],
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1.5, 
                    ease: "linear" 
                  }}
                />
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
            <Skeleton className="h-6 w-32 mb-4" /> {/* "Key Skills" heading */}
            <div className="flex flex-wrap gap-2">
              {/* Skill pill placeholders */}
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton 
                  key={i} 
                  className="h-8 w-20 md:w-24 rounded-full" // Pill-shaped for skills badges
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
            <Skeleton className="h-6 w-40 mb-4" /> {/* "Primary Keywords" heading */}
            <Skeleton className="h-4 w-60 mb-3" /> {/* "Keywords from your resume:" subtitle */}
            <div className="flex flex-wrap gap-2 mb-4">
              {/* Keyword pill placeholders */}
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton 
                  key={i} 
                  className="h-7 w-28 rounded-full" // Pill-shaped for keyword badges
                />
              ))}
            </div>
            
            {includesJobDescription && (
              <>
                <Skeleton className="h-4 w-64 mb-3 mt-6" /> {/* "Target keywords from job description" subtitle */}
                <div className="flex flex-wrap gap-2">
                  {/* Target keyword pill placeholders */}
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton 
                      key={i} 
                      className="h-7 w-24 rounded-full" // Pill-shaped for keyword badges
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
            <Skeleton className="h-6 w-56 mb-4" /> {/* "Suggested Improvements" heading */}
            <div className="space-y-4">
              {/* Improvement bullet point placeholders */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-5 w-5 mt-1 rounded-full flex-shrink-0" /> {/* Bullet point icon */}
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[85%]" />
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
              <Skeleton className="h-6 w-44 mb-6" /> {/* "Job Match Analysis" heading */}
              
              {/* Strengths Section */}
              <Skeleton className="h-5 w-48 mb-3" /> {/* "Alignment & Strengths" subheading */}
              <div className="space-y-3 mb-6">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-5 w-5 mt-1 rounded-full flex-shrink-0" /> {/* Icon */}
                    <Skeleton className="h-4 w-full flex-1" />
                  </div>
                ))}
              </div>
              
              {/* Gaps Section */}
              <Skeleton className="h-5 w-36 mb-3" /> {/* "Gaps & Concerns" subheading */}
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-5 w-5 mt-1 rounded-full flex-shrink-0" /> {/* Icon */}
                    <Skeleton className="h-4 w-full flex-1" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}