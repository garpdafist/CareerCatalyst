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

  // Enhanced debugging for job description and analysis
  console.log("Critical Job Data Debug:", {
    // Basic resume data check
    hasScore: !!analysisData.score,
    hasPrimaryKeywords: Array.isArray(analysisData.primaryKeywords) && analysisData.primaryKeywords.length > 0,
    hasGeneralFeedback: !!analysisData.generalFeedback,
    
    // Job description debug
    hasJobDescProperty: 'jobDescription' in analysisData,
    jobDescriptionExists: !!analysisData.jobDescription,
    jobDescriptionType: typeof analysisData.jobDescription,
    jobDescriptionIsNull: analysisData.jobDescription === null,
    jobDescriptionIsEmpty: analysisData.jobDescription === '',
    
    // Job analysis debug
    hasJobAnalysisProperty: 'jobAnalysis' in analysisData,
    jobAnalysisExists: !!analysisData.jobAnalysis,
    jobAnalysisType: typeof analysisData.jobAnalysis,
    jobAnalysisIsNull: analysisData.jobAnalysis === null,
    jobAnalysisKeys: analysisData.jobAnalysis ? Object.keys(analysisData.jobAnalysis) : [],
    
    // Job section display logic
    shouldShowJobSection: !!analysisData.jobDescription || !!analysisData.jobAnalysis,
    jobDescriptionPreview: analysisData.jobDescription ? 
      (typeof analysisData.jobDescription === 'string' ? 
        analysisData.jobDescription.substring(0, 50) + '...' : 
        JSON.stringify(analysisData.jobDescription).substring(0, 50) + '...') : 
      'null/undefined',
    jobAnalysisPreview: analysisData.jobAnalysis ? 
      JSON.stringify(analysisData.jobAnalysis).substring(0, 50) + '...' : 
      'null/undefined'
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
          <h3 className="text-lg font-medium mb-2">Key Skills</h3>
          {Array.isArray(analysisData.primaryKeywords) && analysisData.primaryKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analysisData.primaryKeywords.slice(0, 5).map((keyword, i) => {
                // Convert to propercase (capitalize first letter of each word)
                const propercaseKeyword = keyword.split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
                
                return (
                  <span 
                    key={i} 
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    {propercaseKeyword}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                No key skills were identified in your resume. This might indicate that your resume lacks industry-specific terminology
                or that there was an issue with the analysis process.
              </p>
            </div>
          )}
        </div>

        {/* Identified Skills - Always shown with fallback */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Primary Keywords</h3>
          {Array.isArray(analysisData.identifiedSkills) && analysisData.identifiedSkills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analysisData.identifiedSkills.slice(0, 5).map((skill, i) => {
                // Convert to propercase (capitalize first letter of each word)
                const propercaseSkill = skill.split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
                
                return (
                  <span 
                    key={i} 
                    className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                  >
                    {propercaseSkill}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                No primary keywords were identified in your resume. Consider revising your resume to clearly highlight your technical 
                and soft skills using industry-standard terminology.
              </p>
            </div>
          )}
        </div>

        {/* Suggested Improvements - Always show section with appropriate fallback content */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">Suggested Improvements</h3>
          {Array.isArray(analysisData.suggestedImprovements) && analysisData.suggestedImprovements.length > 0 ? (
            <div className="space-y-2">
              {analysisData.suggestedImprovements.map((improvement, i) => (
                <div key={i} className="p-4 bg-amber-50/50 rounded-md border border-amber-100">
                  <div className="flex items-start">
                    <span className="text-amber-600 mr-2">›</span>
                    <p className="text-amber-800">{improvement}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                We weren't able to generate specific improvement suggestions for this resume. This might be due to an analysis issue or insufficient data in your resume.
                Try adding more detailed information to your resume, or analyze again with a job description for more targeted improvements.
              </p>
            </div>
          )}
        </div>
        
        {/* General Feedback - New section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-2">General Feedback</h3>
          {analysisData.generalFeedback ? (
            <div className="p-4 bg-gray-50 rounded-md border border-gray-100">
              <p className="text-gray-700">
                {typeof analysisData.generalFeedback === 'string' 
                  ? analysisData.generalFeedback 
                  : analysisData.generalFeedback?.overall || 'No overall feedback available.'}
              </p>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-700">
                No general feedback was generated for this resume. This might be due to an analysis issue or insufficient data in your resume.
                Try adding more detailed information to your resume, or analyze again with a job description for more targeted feedback.
              </p>
            </div>
          )}
        </div>

        {/* Job Analysis Section - Check if job description exists */}
        {/* Debug display - Hidden in production */}
        <div className="mb-1 hidden">
          <pre className="text-xs">
            Has job description: {JSON.stringify(!!analysisData.jobDescription)}
            Job description type: {JSON.stringify(typeof analysisData.jobDescription)}
            Has job analysis: {JSON.stringify(!!analysisData.jobAnalysis)}
          </pre>
        </div>

        {/* Always show job analysis section if EITHER job description OR job analysis exists */}
        {(analysisData.jobDescription || analysisData.jobAnalysis) ? (
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-2">Job Match Analysis</h3>
            
            {/* Show job analysis content if it exists */}
            {analysisData.jobAnalysis && typeof analysisData.jobAnalysis === 'object' ? (
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
                  <strong>Job Analysis Information:</strong> We detected a job description in your submission, but we weren't able to generate 
                  a complete job-specific analysis for your resume.
                </p>
                <p className="text-amber-700 mt-2">
                  This might be due to an analysis processing issue or insufficient details in the job description.
                  Try providing a more detailed job description with clear requirements and responsibilities for better matching results.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Action Buttons - Streamlined layout */}
      <div className="mt-6">
        {/* Primary CTA Container with heading */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-100 shadow-sm mb-6">
          <h3 className="text-lg font-medium text-green-700 mb-4 text-center sm:text-left">Ready to Improve Your Resume?</h3>
          
          {/* Button Group: Primary and Secondary CTAs side by side on desktop, stacked on mobile */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Primary CTA - More prominent styling with gradient background */}
            <Button 
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white 
                         flex items-center justify-center shadow-sm transition-all duration-200"
              onClick={onImproveResume}
              size="lg"
            >
              <FileText className="h-4 w-4 mr-2" />
              <span>Improve My Resume</span>
            </Button>
            
            {/* Secondary CTA - Complementary but less prominent styling */}
            <Button 
              variant="outline"
              onClick={onGenerateCoverLetter}
              size="lg"
              className="flex-1 border-green-200 text-green-700 hover:bg-green-50 flex items-center justify-center
                         transition-all duration-200"
            >
              <span>Generate Cover Letter</span>
            </Button>
          </div>
        </div>
        
        {/* Lower CTAs: Additional Options - More balanced layout */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-3">
          {/* Do Another Analysis Button - Using a button styled like a link for functionality */}
          <button 
            onClick={() => {
              // Navigate to the resume analyzer page
              window.location.href = "/resume-analyzer";
            }}
            className="text-sm flex items-center text-muted-foreground hover:text-primary transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Do another analysis
          </button>
          
          {/* View Previous Analyses Link */}
          <Link 
            href="/all-analyses" 
            className="text-sm flex items-center text-muted-foreground hover:text-primary transition-colors"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            View your previous analyses
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResumeAnalysisInline;