import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  // Additional detailed debug logging
  console.log("Analysis Fields:", {
    score: analysisData.score,
    hasPrimaryKeywords: Array.isArray(analysisData.primaryKeywords) && analysisData.primaryKeywords.length > 0,
    primaryKeywordsCount: Array.isArray(analysisData.primaryKeywords) ? analysisData.primaryKeywords.length : 0,
    hasGeneralFeedback: !!analysisData.generalFeedback,
    generalFeedbackType: typeof analysisData.generalFeedback,
    jobAnalysisPresent: !!analysisData.jobAnalysis,
    jobAnalysisKeys: analysisData.jobAnalysis ? Object.keys(analysisData.jobAnalysis) : []
  });

  return (
    <div className="max-w-3xl mx-auto">
      {/* Analysis Results Section */}
      <div className="mb-6 bg-white p-6 rounded-lg border shadow-sm">
        {/* Overall Score */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Resume Score</h3>
          <div className="flex items-center mb-2">
            <div className="w-full bg-gray-200 rounded-full h-4 mr-2">
              <div 
                className={`h-4 rounded-full ${
                  analysisData.score >= 80 ? 'bg-green-500' : 
                  analysisData.score >= 60 ? 'bg-yellow-500' : 
                  'bg-red-500'
                }`}
                style={{ width: `${analysisData.score}%` }}
              ></div>
            </div>
            <span className="text-lg font-bold">{analysisData.score}/100</span>
          </div>
          <p className="text-sm text-muted-foreground">
            This score reflects how well your resume meets industry standards and best practices.
          </p>
        </div>

        {/* General Feedback */}
        {analysisData.generalFeedback && (
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-2">Overall Feedback</h3>
            <p className="text-gray-700">
              {typeof analysisData.generalFeedback === 'object' 
                ? analysisData.generalFeedback.overall 
                : analysisData.generalFeedback}
            </p>
          </div>
        )}

        {/* Primary Keywords */}
        {Array.isArray(analysisData.primaryKeywords) && analysisData.primaryKeywords.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-2">Key Terms Identified</h3>
            <div className="flex flex-wrap gap-2">
              {analysisData.primaryKeywords.map((keyword, i) => (
                <span 
                  key={i} 
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Identified Skills */}
        {Array.isArray(analysisData.identifiedSkills) && analysisData.identifiedSkills.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-2">Skills Identified</h3>
            <div className="flex flex-wrap gap-2">
              {analysisData.identifiedSkills.map((skill, i) => (
                <span 
                  key={i} 
                  className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Improvements */}
        {Array.isArray(analysisData.suggestedImprovements) && analysisData.suggestedImprovements.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-2">Suggested Improvements</h3>
            <ul className="list-disc pl-5 space-y-1">
              {analysisData.suggestedImprovements.map((improvement, i) => (
                <li key={i} className="text-gray-700">{improvement}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Job Analysis Section */}
        {analysisData.jobAnalysis && (
          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-medium mb-2 text-blue-800">Job Match Analysis</h3>
            
            {/* Strengths */}
            {Array.isArray(analysisData.jobAnalysis.alignmentAndStrengths) && 
             analysisData.jobAnalysis.alignmentAndStrengths.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-blue-700 mb-1">Your Resume Strengths</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysisData.jobAnalysis.alignmentAndStrengths.map((strength, i) => (
                    <li key={i} className="text-gray-700">{strength}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Gaps */}
            {Array.isArray(analysisData.jobAnalysis.gapsAndConcerns) && 
             analysisData.jobAnalysis.gapsAndConcerns.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-blue-700 mb-1">Gaps to Address</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysisData.jobAnalysis.gapsAndConcerns.map((gap, i) => (
                    <li key={i} className="text-gray-700">{gap}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Recommendations */}
            {Array.isArray(analysisData.jobAnalysis.recommendationsToTailor) && 
             analysisData.jobAnalysis.recommendationsToTailor.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-blue-700 mb-1">Tailoring Recommendations</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {analysisData.jobAnalysis.recommendationsToTailor.map((rec, i) => (
                    <li key={i} className="text-gray-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Overall Fit */}
            {analysisData.jobAnalysis.overallFit && (
              <div>
                <h4 className="font-medium text-blue-700 mb-1">Overall Job Fit</h4>
                <p className="text-gray-700">{analysisData.jobAnalysis.overallFit}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6">
        {/* Primary CTA */}
        <div className="bg-green-50 p-6 rounded-lg border border-green-100 mb-4">
          <h3 className="text-lg font-medium text-green-700 mb-4">Ready to Improve Your Resume?</h3>
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-between"
            onClick={onImproveResume}
            size="lg"
          >
            <span>Improve My Resume</span>
            <ArrowRight className="h-4 w-4" />
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