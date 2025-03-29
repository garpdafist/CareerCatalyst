import { ResumeAnalysis } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import { Loader2, Clock, FileText, Search, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SavedAnalyses() {
  const { 
    userAnalyses, 
    isLoadingUserAnalyses, 
    userAnalysesError,
    setAnalysisId
  } = useSavedAnalysis();
  
  const [expanded, setExpanded] = useState(false);

  if (isLoadingUserAnalyses) {
    return (
      <div className="space-y-2 my-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (userAnalysesError) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading saved analyses</AlertTitle>
        <AlertDescription>
          {userAnalysesError instanceof Error ? userAnalysesError.message : "Something went wrong"}
        </AlertDescription>
      </Alert>
    );
  }

  if (!userAnalyses || userAnalyses.length === 0) {
    return null; // Don't show anything if no analyses
  }

  // Sort analyses with newest first
  const sortedAnalyses = [...userAnalyses].sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  // Display only the most recent 3 analyses unless expanded
  const displayedAnalyses = expanded ? sortedAnalyses : sortedAnalyses.slice(0, 3);

  return (
    <div className="my-6">
      <h3 className="text-xl font-semibold mb-3">Your Recent Analyses</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedAnalyses.map((analysis) => (
          <AnalysisCard 
            key={analysis.id} 
            analysis={analysis} 
            onClick={() => setAnalysisId(analysis.id)} 
          />
        ))}
      </div>
      
      {userAnalyses.length > 3 && (
        <Button 
          variant="ghost" 
          onClick={() => setExpanded(!expanded)}
          className="mt-3"
        >
          {expanded ? "Show Less" : `Show ${userAnalyses.length - 3} More`}
        </Button>
      )}
    </div>
  );
}

interface AnalysisCardProps {
  analysis: ResumeAnalysis;
  onClick: () => void;
}

function AnalysisCard({ analysis, onClick }: AnalysisCardProps) {
  // Format the date for display
  const formattedDate = analysis.createdAt
    ? formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })
    : "Unknown date";

  // Get the first 100 characters of content for preview
  const contentPreview = analysis.content?.substring(0, 100) + "...";

  // Get job title if available
  const jobTitle = analysis.jobDescription 
    ? (analysis.jobDescription as any).text?.substring(0, 30)
    : null;

  return (
    <Card 
      className="transition-all duration-300 hover:shadow-md cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-medium">
            Analysis #{analysis.id}
          </CardTitle>
          <div className="bg-primary/10 text-primary font-medium rounded-full px-2 py-1 text-sm">
            {analysis.score}/10
          </div>
        </div>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" /> {formattedDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="line-clamp-2 text-sm opacity-80">
          {contentPreview}
        </div>
        {jobTitle && (
          <div className="mt-2 text-xs border border-primary/20 rounded px-2 py-1 bg-primary/5 inline-block">
            Job: {jobTitle}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="ghost" size="sm" className="w-full gap-2">
          <Search className="h-4 w-4" />
          View Results
        </Button>
      </CardFooter>
    </Card>
  );
}