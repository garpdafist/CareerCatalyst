import { ResumeAnalysis } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import { 
  Loader2, Clock, FileText, Search, AlertCircle, 
  ArrowUpDown, PlusCircle, CalendarDays, Tag, 
  Activity, Briefcase 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Select, SelectContent, SelectGroup, SelectItem, 
  SelectLabel, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Define filter and sort options
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';
type FilterOption = 'all' | 'withJob' | 'withoutJob';

interface AnalysisCardProps {
  analysis: ResumeAnalysis;
  onClick: () => void;
}

function AnalysisCard({ analysis, onClick }: AnalysisCardProps) {
  // Extract a resume preview from content - just first 30 characters
  const resumePreview = analysis.content?.substring(0, 30) + "...";
  
  // Extract job title if available
  const hasJobDescription = !!analysis.jobDescription;
  const jobTitle = hasJobDescription 
    ? (typeof analysis.jobDescription === 'object' && analysis.jobDescription !== null 
      ? (analysis.jobDescription as any).roleTitle || 'Job Analysis' 
      : 'Job Analysis')
    : null;
    
  // Define score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };
  
  const scoreColorClass = getScoreColor(analysis.score);
  
  // Get the identified skills/keywords with a maximum of 2 (reduced from 3)
  const skills = (analysis.identifiedSkills || []).slice(0, 2);
  
  // Format the date for display
  const formattedDate = analysis.createdAt
    ? formatDistanceToNow(new Date(analysis.createdAt as Date), { addSuffix: true })
    : "Unknown date";
    
  return (
    <Card 
      className="transition-all duration-300 hover:shadow-md cursor-pointer group border border-border/60 relative overflow-hidden" 
      onClick={onClick}
    >
      {/* Score Badge - Positioned in top right corner */}
      <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full font-bold ${scoreColorClass}`}>
        {analysis.score}/100
      </div>
      
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg flex items-start gap-2 pr-16">
          <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="line-clamp-1">
            Analysis #{analysis.id}
          </div>
        </CardTitle>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Clock className="h-3.5 w-3.5" /> {formattedDate}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-3">
        {/* Resume preview */}
        <div className="line-clamp-1 text-sm text-muted-foreground mb-3">
          {resumePreview}
        </div>
        
        {/* Skills preview */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {skills.map((skill, index) => (
              <Badge 
                key={index} 
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-secondary/30"
              >
                {skill}
              </Badge>
            ))}
            {analysis.identifiedSkills && analysis.identifiedSkills.length > 2 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{analysis.identifiedSkills.length - 2} more
              </Badge>
            )}
          </div>
        )}
        
        {/* Job title badge if available */}
        {jobTitle && (
          <div className="mt-1">
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5 w-fit">
              <Briefcase className="h-3 w-3" />
              {jobTitle}
            </Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0">
        <Button 
          variant="secondary" 
          size="sm" 
          className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation(); // Prevent double firing with card click
            onClick();
          }}
        >
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

  // State for expanded view, sorting, and filtering
  const [expanded, setExpanded] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  
  // Handle view results click - optimized to avoid full page reload when possible
  const handleViewResults = (analysisId: number) => {
    console.log('Clicked analysis card, setting analysisId to:', analysisId);
    
    // Update state and URL parameters (which will trigger query)
    setAnalysisId(analysisId);
    
    // Scroll to top for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Process analyses based on current sort and filter options
  const processedAnalyses = useMemo(() => {
    if (!userAnalyses) return [];
    
    // First filter the analyses
    let filtered = [...userAnalyses];
    
    if (filterOption === 'withJob') {
      filtered = filtered.filter(analysis => analysis.jobDescription);
    } else if (filterOption === 'withoutJob') {
      filtered = filtered.filter(analysis => !analysis.jobDescription);
    }
    
    // Then sort the filtered analyses
    return filtered.sort((a, b) => {
      // Sorting logic
      // Define helper functions to safely convert dates
      const getDateA = () => {
        if (!a.createdAt) return new Date(0);
        return new Date(a.createdAt.toString());
      };
      
      const getDateB = () => {
        if (!b.createdAt) return new Date(0);
        return new Date(b.createdAt.toString());
      };
      
      switch (sortOption) {
        case 'newest':
          return getDateB().getTime() - getDateA().getTime();
        case 'oldest':
          return getDateA().getTime() - getDateB().getTime();
        case 'highest':
          return b.score - a.score;
        case 'lowest':
          return a.score - b.score;
        default:
          return 0;
      }
    });
  }, [userAnalyses, sortOption, filterOption]);
  
  // Display only the 2 most recent analyses unless expanded (decreased from 6)
  const displayedAnalyses = expanded 
    ? processedAnalyses 
    : processedAnalyses.slice(0, 2);

  // Loading state
  if (isLoadingUserAnalyses) {
    return (
      <div className="space-y-4 my-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      </div>
    );
  }

  // Error state
  if (userAnalysesError) {
    return (
      <Alert variant="destructive" className="my-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading saved analyses</AlertTitle>
        <AlertDescription>
          {userAnalysesError instanceof Error ? userAnalysesError.message : "Something went wrong"}
        </AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (!userAnalyses?.length) {
    return (
      <Alert className="my-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No saved analyses</AlertTitle>
        <AlertDescription>
          Upload a resume to get started with your first analysis.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 my-8">
      {/* Header section with welcome message and control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground/90">Your Recent Analyses</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back! You have {userAnalyses.length} saved {userAnalyses.length === 1 ? 'analysis' : 'analyses'}.
          </p>
        </div>
        
        {/* New Analysis CTA */}
        <Button 
          variant="default" 
          size="sm" 
          className="shrink-0"
          onClick={() => {
            // Clear any existing analysis ID 
            setAnalysisId(null);
            
            // Remove ID from URL without a page reload
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('id');
              window.history.pushState({}, '', url);
            }
            
            // Scroll to the form section
            const formElement = document.querySelector('form');
            if (formElement) {
              formElement.scrollIntoView({ behavior: 'smooth' });
              
              // Reset form fields programmatically (if needed)
              // This assumes we can access the form's reset functionality
              setTimeout(() => {
                const textArea = document.querySelector('textarea');
                if (textArea) {
                  (textArea as HTMLTextAreaElement).value = '';
                }
                
                // Reset job toggle if it exists
                const jobToggle = document.querySelector('input[type="checkbox"]');
                if (jobToggle) {
                  (jobToggle as HTMLInputElement).checked = false;
                }
              }, 100);
            }
          }}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Analysis
        </Button>
      </div>
      
      {/* Filter and Sort Controls */}
      {userAnalyses.length > 1 && (
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <div className="flex gap-2">
            <Select
              value={filterOption}
              onValueChange={(value) => setFilterOption(value as FilterOption)}
            >
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <Tag className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Filter analyses" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Filter by</SelectLabel>
                  <SelectItem value="all">All analyses</SelectItem>
                  <SelectItem value="withJob">With job description</SelectItem>
                  <SelectItem value="withoutJob">Without job description</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            
            <Select
              value={sortOption}
              onValueChange={(value) => setSortOption(value as SortOption)}
            >
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                <SelectValue placeholder="Sort analyses" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Sort by</SelectLabel>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="highest">Highest score</SelectItem>
                  <SelectItem value="lowest">Lowest score</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {/* Analysis cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {displayedAnalyses.map((analysis) => (
          <AnalysisCard
            key={analysis.id}
            analysis={analysis}
            onClick={() => handleViewResults(analysis.id)}
          />
        ))}
      </div>
      
      {/* Show more/less button when necessary */}
      {processedAnalyses.length > 2 && (
        <Button
          variant="outline"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded 
            ? "Show Less" 
            : `View All ${processedAnalyses.length} Analyses`}
        </Button>
      )}
    </div>
  );
}