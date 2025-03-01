import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase } from 'lucide-react';

interface AnimatedProgressPathProps {
  progress: number; // 0-100
  status?: string;
  showMilestones?: boolean;
}

export function AnimatedProgressPath({ 
  progress, 
  status = "Processing...",
  showMilestones = true 
}: AnimatedProgressPathProps) {
  const [pathLength, setPathLength] = useState(0);
  
  // Define milestones for visual feedback
  const milestones = [
    { position: 25, label: "Analyzing" },
    { position: 50, label: "Processing" },
    { position: 75, label: "Generating" },
    { position: 100, label: "Complete" }
  ];

  // Calculate current progress position
  const currentProgress = progress / 100;

  return (
    <div className="w-full h-24 relative">
      <svg
        viewBox="0 0 400 100"
        className="w-full h-full"
      >
        {/* Curved path background */}
        <path
          d="M 0,50 C 100,20 200,80 400,50"
          className="stroke-muted-foreground/20"
          fill="none"
          strokeWidth="2"
        />
        
        {/* Animated progress overlay */}
        <motion.path
          d="M 0,50 C 100,20 200,80 400,50"
          className="stroke-primary"
          fill="none"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: currentProgress }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {/* Moving briefcase icon */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1,
            x: 400 * currentProgress,
            y: 50 + Math.sin((currentProgress * Math.PI) * 2) * 30
          }}
          transition={{ duration: 0.5 }}
        >
          <motion.circle
            r="20"
            fill="white"
            className="stroke-primary"
            strokeWidth="2"
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />
          <Briefcase className="w-6 h-6 text-primary transform -translate-x-3 -translate-y-3" />
        </motion.g>

        {/* Milestone markers */}
        {showMilestones && milestones.map((milestone, index) => (
          <g key={index} transform={`translate(${milestone.position * 4}, 50)`}>
            <circle
              r="4"
              className={`${
                progress >= milestone.position 
                  ? "fill-primary" 
                  : "fill-muted-foreground/20"
              }`}
            />
            <text
              y="25"
              className="text-xs fill-muted-foreground text-center"
              textAnchor="middle"
            >
              {milestone.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Status text */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-sm text-muted-foreground">
        {status}
      </div>
    </div>
  );
}
