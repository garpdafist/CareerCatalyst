import { Check, AlertTriangle, ArrowUpRight, ArrowRight } from 'lucide-react';
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
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

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

  return (
    <div className="space-y-8">
      {/* Header with Analysis title and score */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-green-600">✦</span> Analysis Results
        </h2>
        <Badge 
          variant="outline" 
          className={`${getScoreColor(analysisData.score)} text-xl px-4 py-1.5`}
        >
          {analysisData.score}/100
        </Badge>
      </div>

      {/* Key Skills Section */}
      <div>
        <h3 className="text-lg font-medium mb-3">Key Skills</h3>
        <div className="flex flex-wrap gap-2">
          {analysisData.identifiedSkills?.map((skill, index) => (
            <Badge 
              key={index} 
              variant="secondary"
              className="bg-green-50 text-green-700 border-green-200"
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
          <div className="flex flex-wrap gap-2">
            {analysisData.primaryKeywords.map((keyword, index) => (
              <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Improvements Section */}
      {analysisData.suggestedImprovements && analysisData.suggestedImprovements.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Suggested Improvements</h3>
          <ul className="space-y-2">
            {analysisData.suggestedImprovements.map((improvement, index) => (
              <li key={index} className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* General Feedback Section */}
      {analysisData.generalFeedback && (
        <div>
          <h3 className="text-lg font-medium mb-3">General Feedback</h3>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground">
                {typeof analysisData.generalFeedback === 'object' 
                  ? analysisData.generalFeedback.overall 
                  : analysisData.generalFeedback}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Job Analysis Section (if available) */}
      {analysisData.jobAnalysis && (
        <div>
          <h3 className="text-lg font-medium mb-3">Job Match Analysis</h3>
          
          {analysisData.jobAnalysis.alignmentAndStrengths && analysisData.jobAnalysis.alignmentAndStrengths.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-green-700 mb-2">Alignment & Strengths</h4>
              <ul className="space-y-2">
                {analysisData.jobAnalysis.alignmentAndStrengths.map((point, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {analysisData.jobAnalysis.gapsAndConcerns && analysisData.jobAnalysis.gapsAndConcerns.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-red-700 mb-2">Gaps & Concerns</h4>
              <ul className="space-y-2">
                {analysisData.jobAnalysis.gapsAndConcerns.map((point, index) => (
                  <li key={index} className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {analysisData.jobAnalysis.recommendationsToTailor && analysisData.jobAnalysis.recommendationsToTailor.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-blue-700 mb-2">How to Tailor Your Resume</h4>
              <ul className="space-y-2">
                {analysisData.jobAnalysis.recommendationsToTailor.map((point, index) => (
                  <li key={index} className="flex items-start">
                    <ArrowUpRight className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {analysisData.jobAnalysis.overallFit && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Overall Fit Assessment</h4>
                <p className="text-muted-foreground">{analysisData.jobAnalysis.overallFit}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 space-y-4">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onImproveResume}
            size="lg"
          >
            Improve My Resume <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button 
            variant="outline"
            onClick={onGenerateCoverLetter}
            size="lg"
            className="border-green-200 text-green-700 hover:bg-green-50"
          >
            Generate Cover Letter
          </Button>
        </div>
        
        <div className="w-full text-center mt-3">
          <Link href="/all-analyses" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            View all analyses
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResumeAnalysisInline;