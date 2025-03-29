import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnimatedTimeline } from "@/components/ui/animated-timeline";
import { AnimatedSkeletonTimeline } from "@/components/ui/animated-skeleton-timeline";
import { AnimatedMinimalSpinner } from "@/components/ui/animated-minimal-spinner";
import { cn } from "@/lib/utils";

export type LoadingStateStyle = "timeline" | "skeleton" | "minimal";

interface AnalysisLoadingStateProps {
  progress: number;
  status?: string;
  style?: LoadingStateStyle;
  allowStyleSelection?: boolean;
  className?: string;
  funMessage?: string;
  includesJobDescription?: boolean;
  expectedTime?: string;
}

export function AnalysisLoadingState({ 
  progress, 
  status = "Processing...",
  style = "timeline",
  allowStyleSelection = false,
  className,
  funMessage = "Hang tight while we rummage through your resume for hidden talents…",
  includesJobDescription = false,
  expectedTime = "10-15 seconds"
}: AnalysisLoadingStateProps) {
  const [selectedStyle, setSelectedStyle] = useState<LoadingStateStyle>(style);

  const renderLoadingState = (type: LoadingStateStyle) => {
    switch (type) {
      case "timeline":
        return <AnimatedTimeline progress={progress} status={status} />;
      case "skeleton":
        return (
          <AnimatedSkeletonTimeline 
            progress={progress} 
            status={status} 
            funMessage={funMessage}
            includesJobDescription={includesJobDescription}
            expectedTime={expectedTime}
          />
        );
      case "minimal":
        return <AnimatedMinimalSpinner progress={progress} status={status} />;
      default:
        return <AnimatedTimeline progress={progress} status={status} />;
    }
  };

  if (!allowStyleSelection) {
    return (
      <div className={cn("w-full", className)}>
        {renderLoadingState(selectedStyle)}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <Tabs 
        defaultValue={selectedStyle} 
        onValueChange={(value) => setSelectedStyle(value as LoadingStateStyle)}
      >
        <TabsList className="mb-4 grid grid-cols-3 w-full">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="skeleton">Skeleton</TabsTrigger>
          <TabsTrigger value="minimal">Minimal</TabsTrigger>
        </TabsList>
        
        <TabsContent value="timeline">
          <AnimatedTimeline progress={progress} status={status} />
        </TabsContent>
        
        <TabsContent value="skeleton">
          <AnimatedSkeletonTimeline 
            progress={progress} 
            status={status} 
            funMessage={funMessage}
            includesJobDescription={includesJobDescription}
            expectedTime={expectedTime}
          />
        </TabsContent>
        
        <TabsContent value="minimal">
          <AnimatedMinimalSpinner progress={progress} status={status} />
        </TabsContent>
      </Tabs>
    </div>
  );
}