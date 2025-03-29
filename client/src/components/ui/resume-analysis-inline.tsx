import { Check, AlertCircle, ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResumeAnalysis } from '@shared/schema';
import { Link } from 'wouter';

interface ResumeAnalysisInlineProps {
  analysisData: ResumeAnalysis | null | undefined;
  isLoading?: boolean;
  onImproveResume?: () => void;
  onGenerateCoverLetter?: () => void;
}

export function ResumeAnalysisInline({ 
  analysisData,
  isLoading = false,
  onImproveResume,
  onGenerateCoverLetter
}: ResumeAnalysisInlineProps) {
  // Get score color based on score value 
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };
  
  // Helper to limit array length
  const limitArrayLength = (arr: string[] | null | undefined, maxLength: number = 5): string[] => {
    if (!arr) return [];
    return arr.slice(0, maxLength);
  };

  // Debug data
  console.log("Analysis Data:", analysisData);

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-medium text-center">
          Analyzing your resume for strengths and opportunities...
        </p>
        <p className="text-muted-foreground text-center mt-2">
          This typically takes 10-15 seconds. We're extracting your skills, achievements, and providing targeted feedback.
        </p>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">No analysis data available</p>
      </div>
    );
  }
  
  // Extract optional data with fallbacks
  const identifiedSkills = analysisData.identifiedSkills || [];
  const primaryKeywords = analysisData.primaryKeywords || [];
  const suggestedImprovements = analysisData.suggestedImprovements || [];
  const generalFeedback = analysisData.generalFeedback || "No general feedback available";
  
  // Normalize optional scores and fields
  if (!analysisData.score && analysisData.scores) {
    // Try to extract score from scores field if available
    const totalScore = analysisData.scores.keywordsRelevance?.score + 
                      analysisData.scores.achievementsMetrics?.score +
                      analysisData.scores.structureReadability?.score +
                      analysisData.scores.summaryClarity?.score +
                      analysisData.scores.overallPolish?.score;
    analysisData.score = totalScore || 70; // Default to 70 if we can't calculate
  }
  
  // Helper to check if an array exists and has items
  const hasItems = (arr?: string[] | null): boolean => {
    return Boolean(arr && arr.length > 0);
  };
  
  // Check if we have job description analysis
  const jobAnalysis = analysisData.jobAnalysis || null;
  const hasJobAnalysis = jobAnalysis && (
    hasItems(jobAnalysis.alignmentAndStrengths) || 
    hasItems(jobAnalysis.gapsAndConcerns) || 
    hasItems(jobAnalysis.recommendationsToTailor) || 
    Boolean(jobAnalysis.overallFit)
  );

  return (
    <div className="space-y-8 bg-[#faf9f4] p-6 rounded-lg">
      {/* Header with Analysis title and score */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-green-600">✦</span> Analysis Results
        </h2>
        <span className={`text-2xl font-bold ${getScoreColor(analysisData.score)}`}>
          {analysisData.score}/100
        </span>
      </div>

      {/* Key Skills Section */}
      <div>
        <h3 className="text-lg font-medium mb-3">Key Skills</h3>
        <div className="flex flex-wrap gap-2">
          {limitArrayLength(analysisData.identifiedSkills, 5).map((skill, index) => (
            <Badge 
              key={index} 
              variant="secondary"
              className="bg-green-50 text-green-700 border-green-100 font-normal py-1.5 px-3"
            >
              {skill}
            </Badge>
          ))}
          {(!analysisData.identifiedSkills || analysisData.identifiedSkills.length === 0) && (
            <p className="text-muted-foreground">No specific skills identified</p>
          )}
        </div>
      </div>

      {/* Primary Keywords Section */}
      {analysisData.primaryKeywords && analysisData.primaryKeywords.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Primary Keywords</h3>
          <p className="text-sm text-muted-foreground mb-2">Keywords from your resume:</p>
          <div className="flex flex-wrap gap-2">
            {limitArrayLength(analysisData.primaryKeywords, 5).map((keyword, index) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="bg-blue-50/50 text-blue-700 border-blue-100 font-normal py-1.5 px-3"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Improvements Section */}
      {analysisData.suggestedImprovements && analysisData.suggestedImprovements.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Suggested Improvements</h3>
          <div className="space-y-2 bg-amber-50/50 p-4 rounded-lg border border-amber-100">
            {analysisData.suggestedImprovements.map((improvement, index) => (
              <div key={index} className="flex items-start py-2">
                <span className="text-amber-700 mr-2">❯</span>
                <span className="text-amber-700">{improvement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Feedback Section */}
      {analysisData.generalFeedback && (
        <div>
          <h3 className="text-lg font-medium mb-3">General Feedback</h3>
          <div className="p-4 bg-white rounded-lg border border-border/30">
            <p className="text-muted-foreground">
              {typeof analysisData.generalFeedback === 'object' 
                ? analysisData.generalFeedback.overall 
                : analysisData.generalFeedback}
            </p>
          </div>
        </div>
      )}

      {/* Job Match Analysis Section (only if job analysis is available) */}
      {hasJobAnalysis && (
        <>
          <h2 className="text-xl font-bold mt-10 pt-6 border-t">Job Match Analysis</h2>
          
          {/* Alignment & Strengths */}
          {analysisData.jobAnalysis?.alignmentAndStrengths && analysisData.jobAnalysis.alignmentAndStrengths.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3">Alignment & Strengths</h3>
              <div className="space-y-1">
                {analysisData.jobAnalysis.alignmentAndStrengths.map((strength, index) => (
                  <div key={index} className="flex items-start p-2 bg-green-50/50 rounded-lg border border-green-100">
                    <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-green-700">{strength}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Gaps & Concerns */}
          {analysisData.jobAnalysis?.gapsAndConcerns && analysisData.jobAnalysis.gapsAndConcerns.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3">Gaps & Concerns</h3>
              <div className="space-y-1">
                {analysisData.jobAnalysis.gapsAndConcerns.map((concern, index) => (
                  <div key={index} className="flex items-start p-2 bg-red-50/50 rounded-lg border border-red-100">
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-red-700">{concern}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* How to Tailor Your Resume */}
          {analysisData.jobAnalysis?.recommendationsToTailor && analysisData.jobAnalysis.recommendationsToTailor.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3">How to Tailor Your Resume</h3>
              <div className="space-y-1">
                {analysisData.jobAnalysis.recommendationsToTailor.map((recommendation, index) => (
                  <div key={index} className="flex items-start p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                    <span className="text-blue-700 mr-2">❯</span>
                    <span className="text-blue-700">{recommendation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Overall Fit Assessment */}
          {analysisData.jobAnalysis?.overallFit && (
            <div>
              <h3 className="text-lg font-medium mb-3">Overall Fit Assessment</h3>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex">
                <Info className="h-5 w-5 text-gray-500 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground">{analysisData.jobAnalysis.overallFit}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div className="mt-8 pt-6 border-t border-border/30">
        {/* Primary CTA */}
        <div className="bg-green-50 p-6 rounded-lg border border-green-100 mb-4">
          <h3 className="text-lg font-medium text-green-700 mb-4">Ready to Improve Your Resume?</h3>
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-between"
            onClick={onImproveResume}
            size="lg"
          >
            <span>Improve My Resume</span>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        
        {/* Secondary CTA */}
        <Button 
          variant="outline"
          onClick={onGenerateCoverLetter}
          size="lg"
          className="w-full border-green-200 text-green-700 hover:bg-green-50 mb-6"
        >
          Generate Cover Letter
        </Button>
        
        {/* Less prominent link */}
        <div className="w-full text-center">
          <Link href="/all-analyses" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            View your previous resume analyses
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResumeAnalysisInline;