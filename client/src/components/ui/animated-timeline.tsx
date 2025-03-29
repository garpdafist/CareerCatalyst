import React from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  Cog, 
  Lightbulb, 
  CheckCircle2 
} from "lucide-react";

interface AnimatedTimelineProps {
  progress: number; // 0-100
  status?: string;
}

export function AnimatedTimeline({ 
  progress, 
  status = "Processing..." 
}: AnimatedTimelineProps) {
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
    </div>
  );
}