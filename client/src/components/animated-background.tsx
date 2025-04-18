import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedBackgroundProps {
  className?: string;
}

/**
 * A subtle animated background component that adds visual interest
 * without overwhelming the content.
 */
export function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden -z-10",
        className
      )}
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#f8f5ee]/80 via-[#f8f5ee] to-[#f2efe5]/90"
        style={{ 
          backgroundSize: "400% 400%",
          animation: "gradient 15s ease infinite"
        }}
      />
      
      {/* Subtle blurred shapes */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30" 
        style={{ animation: "blob 7s infinite" }} />
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20" 
        style={{ animation: "blob 7s infinite", animationDelay: "2000ms" }} />
      <div className="absolute bottom-0 left-20 w-64 h-64 bg-amber-50 rounded-full mix-blend-multiply filter blur-3xl opacity-20" 
        style={{ animation: "blob 7s infinite", animationDelay: "4000ms" }} />
      <div className="absolute bottom-0 right-20 w-64 h-64 bg-emerald-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30" 
        style={{ animation: "blob 7s infinite", animationDelay: "6000ms" }} />
      
      {/* Optional subtle grid pattern overlay */}
      <div 
        className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOCIgc3Ryb2tlPSIjRTJFOEYwIi8+PC9nPjwvc3ZnPg==')]"
        style={{ opacity: 0.05 }}
      />
    </div>
  );
}