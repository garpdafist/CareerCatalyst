import { 
  ArrowRight, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BarChart3,
  Award,
  Briefcase,
  Star,
  Sparkles,
  Zap,
  PenLine,
  FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResumeAnalysis } from '@shared/schema';
import { Link, useLocation } from 'wouter';
import { useState, useRef, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

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
  // State for accordion sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    score: true,
    feedback: true,
    skills: true,
    keywords: true,
    improvements: true,
    jobAnalysis: false
  });
  
  // Ref for sticky navigation
  const navRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  
  // Handle scroll for sticky nav
  useEffect(() => {
    const handleScroll = () => {
      if (navRef.current) {
        const { top } = navRef.current.getBoundingClientRect();
        setIsSticky(top <= 0);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Toggle accordion sections
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Debug data (console.log in a production environment isn't ideal, consider removing)
  console.log("Analysis Data:", analysisData);

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center animate-fade-in">
        <div className="w-16 h-16 border-4 border-t-primary rounded-full animate-spin mb-6"></div>
        <p className="text-xl font-medium text-center mb-2">
          Analyzing your resume...
        </p>
        <p className="text-muted-foreground text-center max-w-md">
          This typically takes 10-15 seconds. We're extracting your skills, achievements, and providing targeted feedback.
        </p>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
        <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">No Analysis Data Available</p>
        <p className="text-muted-foreground max-w-md mx-auto">
          Please upload your resume to get a detailed analysis of your skills, experience, and opportunities for improvement.
        </p>
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
    <div className="max-w-4xl mx-auto">
      {/* Sticky Navigation Header */}
      <div 
        ref={navRef}
        className={`${isSticky ? 'sticky top-0 z-10 shadow-md' : ''} 
                   transition-all duration-300 ease-in-out`}
      >
        <div className={`bg-white bg-opacity-95 backdrop-blur-sm border-b border-gray-200 py-3 px-4 
                       ${isSticky ? 'rounded-b-lg' : 'rounded-t-lg border-t border-x'}`}>
          {/* Quick Navigation */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center">
              <div className="mr-4">
                <div className="text-sm text-gray-500 uppercase tracking-wider font-medium mb-1">Score</div>
                <div className="flex items-center">
                  <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center relative mr-3">
                    <svg className="w-full h-full absolute top-0 left-0" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={analysisData.score >= 80 ? '#10B981' : analysisData.score >= 60 ? '#FBBF24' : '#EF4444'}
                        strokeWidth="3"
                        strokeDasharray={`${analysisData.score}, 100`}
                      />
                    </svg>
                    <span className="text-lg font-bold">{analysisData.score}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Resume Score</div>
                    <div className="text-xs text-gray-500">out of 100</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-gray-700 border-gray-300 hover:bg-gray-50"
                onClick={() => toggleSection('score')}
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                <span>Score Details</span>
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                className="text-amber-700 border-amber-200 hover:bg-amber-50"
                onClick={() => toggleSection('improvements')}
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                <span>Improvements</span>
              </Button>
              
              {(analysisData.jobDescription || analysisData.jobAnalysis) ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-blue-700 border-blue-200 hover:bg-blue-50"
                  onClick={() => toggleSection('jobAnalysis')}
                >
                  <Briefcase className="h-4 w-4 mr-1" />
                  <span>Job Match</span>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      
      {/* Analysis Results Container */}
      <div className="bg-white p-6 sm:p-8 rounded-b-lg border border-t-0 border-gray-200 shadow-sm mb-6">
        {/* Score Section */}
        <div className={`mb-8 ${expandedSections.score ? '' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold flex items-center text-gray-800">
              <BarChart3 className="h-6 w-6 mr-2 text-gray-600" />
              Resume Score
            </h2>
            <button 
              onClick={() => toggleSection('score')}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              {expandedSections.score ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Overall Score with circular indicator */}
            <div className="flex flex-col md:flex-row md:items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="mb-4 md:mb-0 md:mr-6 flex-shrink-0">
                <div className="relative w-24 h-24 mx-auto">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={analysisData.score >= 80 ? '#10B981' : analysisData.score >= 60 ? '#FBBF24' : '#EF4444'}
                      strokeWidth="3"
                      strokeDasharray={`${analysisData.score}, 100`}
                    />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    <span className="text-2xl font-bold">{analysisData.score}</span>
                    <span className="text-xs block text-gray-500">out of 100</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-grow">
                <h3 className="text-lg font-semibold mb-2">Resume Quality Score</h3>
                <p className="text-gray-600 mb-3">
                  This score reflects how well your resume meets industry standards and best practices.
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                      analysisData.score >= 80 ? 'bg-green-500' : 
                      analysisData.score >= 60 ? 'bg-amber-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${analysisData.score}%` }}
                  ></div>
                </div>
              </div>
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