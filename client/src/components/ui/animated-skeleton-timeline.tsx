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
}

export function AnimatedSkeletonTimeline({ 
  progress, 
  status = "Processing...",
  showSkeletons = true
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
      {/* Status text at the top */}
      <div className="text-center text-base font-medium text-foreground">
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
        <div className="space-y-6 mt-8">
          {/* Score skeleton */}
          <div className="flex justify-between items-center">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>

          {/* Sections skeletons */}
          <div className="space-y-4">
            {/* Section 1 */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: progress >= 30 ? 1 : 0.3
              }}
              transition={{ duration: 0.5 }}
            >
              <Skeleton className="h-6 w-40 mb-2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[75%]" />
              </div>
            </motion.div>

            {/* Section 2 */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: progress >= 50 ? 1 : 0.3
              }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Skeleton className="h-6 w-40 mb-2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[85%]" />
                <Skeleton className="h-4 w-[70%]" />
              </div>
            </motion.div>

            {/* Section 3 */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: progress >= 75 ? 1 : 0.3
              }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Skeleton className="h-6 w-40 mb-2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-[65%]" />
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}