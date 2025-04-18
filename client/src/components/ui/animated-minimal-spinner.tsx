import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface AnimatedMinimalSpinnerProps {
  progress: number; // 0-100
  status?: string;
}

export function AnimatedMinimalSpinner({ 
  progress, 
  status = "Processing..." 
}: AnimatedMinimalSpinnerProps) {
  // Define the steps
  const steps = [
    { threshold: 25, label: "Analyzing..." },
    { threshold: 50, label: "Processing..." },
    { threshold: 75, label: "Generating..." },
    { threshold: 100, label: "Complete!" }
  ];

  // Get current step
  const currentStep = steps.find(step => progress < step.threshold) || steps[steps.length - 1];
  
  // Determine step index for animation
  const stepIndex = steps.findIndex(step => step.label === currentStep.label);

  return (
    <div className="w-full flex flex-col items-center justify-center py-8">
      {/* Spinning loader with progress indicator */}
      <div className="relative mb-4">
        {/* Background circle */}
        <svg className="w-24 h-24">
          <circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            strokeWidth="4"
            stroke="hsl(var(--muted))"
            className="opacity-25"
          />
          
          {/* Progress circle */}
          <motion.circle
            cx="48"
            cy="48"
            r="40"
            fill="none"
            strokeWidth="4"
            stroke="hsl(var(--primary))"
            strokeLinecap="round"
            initial={{ strokeDasharray: 251.2, strokeDashoffset: 251.2 }}
            animate={{
              strokeDashoffset: 251.2 - (progress / 100) * 251.2
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="origin-center -rotate-90"
            style={{ strokeDasharray: 251.2 }}
          />
        </svg>

        {/* Center spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>

        {/* Percentage */}
        <div className="absolute inset-0 flex items-center justify-center mt-14">
          <span className="text-sm font-medium text-foreground">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Step label with fade transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <span className="text-lg font-medium text-primary">{currentStep.label}</span>
          
          {/* Optional status message */}
          {status && status !== currentStep.label && (
            <p className="text-sm text-muted-foreground mt-1">{status}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}