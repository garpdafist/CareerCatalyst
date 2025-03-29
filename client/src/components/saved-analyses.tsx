import { ResumeAnalysis } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import { Loader2, Clock, FileText, Search, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AnalysisCardProps {
  analysis: ResumeAnalysis;
  onClick: () => void;
}

function AnalysisCard({ analysis, onClick }: AnalysisCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Resume Analysis #{analysis.id}
        </CardTitle>
        <CardDescription>
          <Clock className="h-4 w-4 inline-block mr-1" />
          {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">
          Score: {analysis.score}/100
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onClick} className="w-full">
          <Search className="h-4 w-4 mr-2" />
          View Results
        </Button>
      </CardFooter>
    </Card>
  );
}

export function SavedAnalyses() {
  const { 
    userAnalyses, 
    isLoadingUserAnalyses, 
    userAnalysesError,
    setAnalysisId
  } = useSavedAnalysis();

  const [expanded, setExpanded] = useState(false);

  const handleViewResults = (analysisId: number) => {
    setAnalysisId(analysisId);
    // Add URL parameter
    const url = new URL(window.location.href);
    url.searchParams.set('id', analysisId.toString());
    window.history.pushState({}, '', url);
    // Reload the page to show results
    window.location.reload();
  };

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

  if (!userAnalyses?.length) {
    return (
      <Alert className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No saved analyses</AlertTitle>
        <AlertDescription>
          Upload a resume to get started with your first analysis.
        </AlertDescription>
      </Alert>
    );
  }

  const displayedAnalyses = expanded ? userAnalyses : userAnalyses.slice(0, 2);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Previous Analyses</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedAnalyses.map((analysis) => (
          <AnalysisCard
            key={analysis.id}
            analysis={analysis}
            onClick={() => handleViewResults(analysis.id)}
          />
        ))}
      </div>
      {userAnalyses.length > 2 && (
        <Button
          variant="outline"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? "Show Less" : `Show ${userAnalyses.length - 2} More`}
        </Button>
      )}
    </div>
  );
}