import { ArrowRight, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResumeAnalysis } from '@shared/schema';
import { Link, useLocation } from 'wouter';

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
    hasJobDescription: !!analysisData.jobDescription,
    jobDescriptionType: typeof analysisData.jobDescription,
    hasJobAnalysis: !!analysisData.jobAnalysis,
    jobAnalysisType: analysisData.jobAnalysis ? typeof analysisData.jobAnalysis : 'undefined',
    jobAnalysisKeys: analysisData.jobAnalysis ? Object.keys(analysisData.jobAnalysis) : []
  });
  
  // Debug message for job analysis section - enhanced logging
  console.log("Job Analysis Section Debug:", {
    shouldShowJobSection: !!analysisData.jobDescription || !!analysisData.jobAnalysis,
    jobDescriptionValue: analysisData.jobDescription,
    jobDescriptionType: typeof analysisData.jobDescription,
    jobDescriptionJson: analysisData.jobDescription ? JSON.stringify(analysisData.jobDescription).substring(0, 100) : null,
    jobAnalysisValue: analysisData.jobAnalysis,
    jobAnalysisType: typeof analysisData.jobAnalysis,
    jobAnalysisKeys: analysisData.jobAnalysis ? Object.keys(analysisData.jobAnalysis) : [],
    jobAnalysisJson: analysisData.jobAnalysis ? JSON.stringify(analysisData.jobAnalysis).substring(0, 100) : null
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

        {/* General Feedback - Always show section with appropriate fallback content */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Overall Feedback</h3>
          {analysisData.generalFeedback ? (
            <p className="text-gray-700">
              {typeof analysisData.generalFeedback === 'object' 
                ? analysisData.generalFeedback.overall 
                : analysisData.generalFeedback}
            </p>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                We weren't able to generate overall feedback for this resume. This might be due to an analysis issue or insufficient data. 
                Please try analyzing your resume again or contact support if this problem persists.
              </p>
            </div>
          )}
        </div>

        {/* Primary Keywords - Always shown with fallback */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Key Terms Identified</h3>
          {Array.isArray(analysisData.primaryKeywords) && analysisData.primaryKeywords.length > 0 ? (
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
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                No key terms were identified in your resume. This might indicate that your resume lacks industry-specific terminology
                or that there was an issue with the analysis process.
              </p>
            </div>
          )}
        </div>

        {/* Identified Skills - Always shown with fallback */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Skills Identified</h3>
          {Array.isArray(analysisData.identifiedSkills) && analysisData.identifiedSkills.length > 0 ? (
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
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                No skills were identified in your resume. Consider revising your resume to clearly highlight your technical 
                and soft skills using industry-standard terminology.
              </p>
            </div>
          )}
        </div>

        {/* Suggested Improvements - Always show section with appropriate fallback content */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Suggested Improvements</h3>
          {Array.isArray(analysisData.suggestedImprovements) && analysisData.suggestedImprovements.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1">
              {analysisData.suggestedImprovements.map((improvement, i) => (
                <li key={i} className="text-gray-700">{improvement}</li>
              ))}
            </ul>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                We weren't able to generate specific improvement suggestions for this resume. This might be due to an analysis issue or insufficient data in your resume.
                Try adding more detailed information to your resume, or analyze again with a job description for more targeted improvements.
              </p>
            </div>
          )}
        </div>

        {/* Job Analysis Section - Check if job description exists */}
        {/* Add explicit debug display */}
        <div className="mb-1 hidden">
          <pre className="text-xs">
            Has job description: {JSON.stringify(!!analysisData.jobDescription)}
            Job description type: {JSON.stringify(typeof analysisData.jobDescription)}
            Has job analysis: {JSON.stringify(!!analysisData.jobAnalysis)}
          </pre>
        </div>

        {/* Show job analysis if EITHER job description OR job analysis data exists */}
        {(analysisData.jobDescription || analysisData.jobAnalysis) ? (
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-2">Job Match Analysis</h3>
            
            {analysisData.jobAnalysis ? (
              <div className="p-4 bg-blue-50 rounded-lg">
                {/* Strengths */}
                {Array.isArray(analysisData.jobAnalysis.alignmentAndStrengths) && 
                analysisData.jobAnalysis.alignmentAndStrengths.length > 0 ? (
                  <div className="mb-4">
                    <h4 className="font-medium text-blue-700 mb-1">Your Resume Strengths</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {analysisData.jobAnalysis.alignmentAndStrengths.map((strength, i) => (
                        <li key={i} className="text-gray-700">{strength}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-4">
                    <h4 className="font-medium text-blue-700 mb-1">Your Resume Strengths</h4>
                    <p className="text-gray-700 italic">No specific strengths were identified for this job</p>
                  </div>  
                )}
                
                {/* Gaps */}
                {Array.isArray(analysisData.jobAnalysis.gapsAndConcerns) && 
                analysisData.jobAnalysis.gapsAndConcerns.length > 0 ? (
                  <div className="mb-4">
                    <h4 className="font-medium text-blue-700 mb-1">Gaps to Address</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {analysisData.jobAnalysis.gapsAndConcerns.map((gap, i) => (
                        <li key={i} className="text-gray-700">{gap}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-4">
                    <h4 className="font-medium text-blue-700 mb-1">Gaps to Address</h4>
                    <p className="text-gray-700 italic">No specific gaps were identified for this job</p>
                  </div>
                )}
                
                {/* Recommendations */}
                {Array.isArray(analysisData.jobAnalysis.recommendationsToTailor) && 
                analysisData.jobAnalysis.recommendationsToTailor.length > 0 ? (
                  <div className="mb-4">
                    <h4 className="font-medium text-blue-700 mb-1">Tailoring Recommendations</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {analysisData.jobAnalysis.recommendationsToTailor.map((rec, i) => (
                        <li key={i} className="text-gray-700">{rec}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-4">
                    <h4 className="font-medium text-blue-700 mb-1">Tailoring Recommendations</h4>
                    <p className="text-gray-700 italic">No specific recommendations were generated</p>
                  </div>
                )}
                
                {/* Overall Fit */}
                {analysisData.jobAnalysis.overallFit ? (
                  <div>
                    <h4 className="font-medium text-blue-700 mb-1">Overall Job Fit</h4>
                    <p className="text-gray-700">{analysisData.jobAnalysis.overallFit}</p>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-medium text-blue-700 mb-1">Overall Job Fit</h4>
                    <p className="text-gray-700 italic">No overall job fit analysis was generated</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-amber-700">
                  <strong>Job Analysis Failed:</strong> We weren't able to generate a job-specific analysis for your resume with the provided job description. 
                  This might be due to an analysis issue or insufficient data in the job description.
                </p>
                <p className="text-amber-700 mt-2">
                  Try providing a more detailed job description with clear requirements and responsibilities, 
                  or try analyzing again with the existing job description.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Action Buttons - Revamped layout */}
      <div className="mt-6">
        {/* Primary CTA Container with heading */}
        <div className="bg-green-50 p-6 rounded-lg border border-green-100 mb-6">
          <h3 className="text-lg font-medium text-green-700 mb-4">Ready to Improve Your Resume?</h3>
          
          {/* Button Group: Primary and Secondary CTAs side by side */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Primary CTA - More prominent styling */}
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
              onClick={onImproveResume}
              size="lg"
            >
              <FileText className="h-4 w-4 mr-2" />
              <span>Improve My Resume</span>
            </Button>
            
            {/* Secondary CTA - Less prominent but visually balanced */}
            <Button 
              variant="outline"
              onClick={onGenerateCoverLetter}
              size="lg"
              className="flex-1 border-green-200 text-green-700 hover:bg-green-50 flex items-center justify-center"
            >
              <span>Generate Cover Letter</span>
            </Button>
          </div>
        </div>
        
        {/* Lower CTAs: Additional Options */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-2">
          {/* Navigation Links */}
          <Link href="/resume-analyzer" className="text-sm flex items-center text-muted-foreground hover:text-primary transition-colors">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Do another analysis
          </Link>
          
          <Link href="/all-analyses" className="text-sm flex items-center text-muted-foreground hover:text-primary transition-colors">
            <FileText className="h-3.5 w-3.5 mr-1" />
            View your previous analyses
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResumeAnalysisInline;