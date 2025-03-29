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

interface ResumeAnalysisEnhancedProps {
  analysisData: ResumeAnalysis | null | undefined;
  isLoading?: boolean;
  onImproveResume?: () => void;
  onGenerateCoverLetter?: () => void;
}

export function ResumeAnalysisEnhanced({ 
  analysisData,
  isLoading = false,
  onImproveResume,
  onGenerateCoverLetter
}: ResumeAnalysisEnhancedProps) {
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
  
  // Debug data (can be removed in production)
  // console.log("Analysis Data:", analysisData);

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

  // Determine color scheme based on score with professional green colors
  const getScoreColor = (score: number) => {
    if (score >= 80) return {
      bg: 'bg-green-400', // Bright green for high scores
      text: 'text-green-700',
      border: 'border-green-200',
      light: 'bg-green-50',
      med: 'bg-green-100',
      dark: 'bg-green-600',
      icon: 'text-green-500'
    };
    if (score >= 60) return {
      bg: 'bg-green-400', // Medium green for medium scores
      text: 'text-green-700',
      border: 'border-green-200',
      light: 'bg-green-50',
      med: 'bg-green-100',
      dark: 'bg-green-600',
      icon: 'text-green-500'
    };
    return {
      bg: 'bg-amber-400', // Amber for low scores (warning color)
      text: 'text-amber-700',
      border: 'border-amber-200',
      light: 'bg-amber-50',
      med: 'bg-amber-100',
      dark: 'bg-amber-600',
      icon: 'text-amber-500'
    };
  };

  const scoreColors = getScoreColor(analysisData.score);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Sticky Navigation Header */}
      <div 
        ref={navRef}
        className={`${isSticky ? 'sticky top-0 z-10 shadow-md' : ''} 
                   transition-all duration-300 ease-in-out`}
      >
        <div className={`bg-gradient-to-r from-green-50 to-green-100 bg-opacity-95 backdrop-blur-sm border-b border-green-100 py-3 px-4 
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
                className="text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => toggleSection('improvements')}
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                <span>Improvements</span>
              </Button>
              
              {(analysisData.jobDescription || analysisData.jobAnalysis) ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-green-700 border-green-200 hover:bg-green-50"
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
      <div className="bg-gradient-to-b from-green-50/70 to-green-100/70 p-6 sm:p-8 rounded-b-lg border border-t-0 border-green-100 shadow-sm mb-6">
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
            <div className="flex flex-col md:flex-row md:items-center p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-100">
              <div className="mb-4 md:mb-0 md:mr-6 flex-shrink-0">
                <div className="relative w-28 h-28 mx-auto">
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
                      stroke={scoreColors.bg}
                      strokeWidth="3"
                      strokeDasharray={`${analysisData.score}, 100`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    <span className="text-3xl font-bold">{analysisData.score}</span>
                    <span className="text-xs block text-gray-500">out of 100</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-grow">
                <h3 className="text-xl font-semibold mb-2">Resume Quality Score</h3>
                <p className="text-gray-600 mb-4">
                  This score reflects how well your resume meets industry standards and best practices. 
                  A higher score indicates a stronger resume that's more likely to impress employers.
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-1000 ease-out ${scoreColors.bg}`}
                    style={{ width: `${analysisData.score}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Needs Improvement</span>
                  <span>Excellent</span>
                </div>
              </div>
            </div>
            
            {/* Score Categories */}
            {analysisData.scores && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(analysisData.scores).map(([key, scoreObj]) => {
                  if (!scoreObj || typeof scoreObj !== 'object') return null;
                  
                  // Generate a proper display name for the category
                  const displayName = key
                    .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
                    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
                    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
                    .replace(/Readability/, 'Readability') // Fix specific cases
                    .replace(/Keywords/, 'Keywords')
                    .replace(/Relevance/, 'Relevance')
                    .replace(/Metrics/, 'Metrics')
                    .replace(/Polish/, 'Polish')
                    .replace(/Clarity/, 'Clarity');
                  
                  // Safely get score and maxScore with type checking
                  const score = typeof scoreObj === 'object' && scoreObj !== null && 'score' in scoreObj 
                    ? (scoreObj.score as number) || 0 
                    : 0;
                    
                  const maxScore = typeof scoreObj === 'object' && scoreObj !== null && 'maxScore' in scoreObj 
                    ? (scoreObj.maxScore as number) || 10 
                    : 10;
                    
                  const percentage = (score / maxScore) * 100;
                  const categoryColor = getScoreColor(percentage);
                  
                  // Select an appropriate icon based on the category name
                  let Icon = CheckCircle2;
                  if (key.toLowerCase().includes('keyword')) Icon = FileCheck;
                  else if (key.toLowerCase().includes('achievement')) Icon = Award;
                  else if (key.toLowerCase().includes('structure')) Icon = PenLine;
                  else if (key.toLowerCase().includes('summary')) Icon = FileText;
                  else if (key.toLowerCase().includes('polish')) Icon = Star;
                  
                  return (
                    <div key={key} className={`p-4 rounded-lg border ${categoryColor.border}`}>
                      <div className="flex items-center mb-2">
                        <Icon className={`h-5 w-5 mr-2 ${categoryColor.icon}`} />
                        <h4 className="font-medium">{displayName}</h4>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                        <div 
                          className={`h-1.5 rounded-full ${categoryColor.bg}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {score}/{maxScore}
                        </span>
                        {typeof scoreObj === 'object' && scoreObj !== null && 'feedback' in scoreObj && (
                          <span className="text-xs text-gray-500">
                            {scoreObj.feedback ? String(scoreObj.feedback) : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* General Feedback Section */}
        <div className={`mb-8 ${expandedSections.feedback ? '' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold flex items-center text-gray-800">
              <FileText className="h-6 w-6 mr-2 text-green-600" />
              Overall Feedback
            </h2>
            <button 
              onClick={() => toggleSection('feedback')}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              {expandedSections.feedback ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          
          {analysisData.generalFeedback ? (
            <div className="p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-100 backdrop-blur-sm">
              <p className="text-gray-700 leading-relaxed">
                {typeof analysisData.generalFeedback === 'object' 
                  ? analysisData.generalFeedback.overall 
                  : analysisData.generalFeedback}
              </p>
            </div>
          ) : (
            <div className="p-5 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <Lightbulb className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-green-800">
                  We weren't able to generate overall feedback for this resume. This might be due to an analysis issue or insufficient data. 
                  Please try analyzing your resume again or contact support if this problem persists.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Skills & Keywords Section */}
        <div className={`mb-8 ${expandedSections.skills ? '' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold flex items-center text-gray-800">
              <Zap className="h-6 w-6 mr-2 text-green-600" />
              Skills & Keywords
            </h2>
            <button 
              onClick={() => toggleSection('skills')}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              {expandedSections.skills ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Skills */}
            <div className="bg-gradient-to-r from-green-50/80 to-green-100/80 p-5 rounded-lg border border-green-100">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                Key Skills
              </h3>
              
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
                        className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200 shadow-sm"
                      >
                        {propercaseKeyword}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-700 text-sm">
                    No key skills were identified in your resume. This might indicate that your resume lacks industry-specific terminology
                    or that there was an issue with the analysis process.
                  </p>
                </div>
              )}
            </div>
            
            {/* Primary Keywords */}
            <div className="bg-gradient-to-r from-green-100/80 to-green-50/80 p-5 rounded-lg border border-green-100">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <FileCheck className="h-5 w-5 mr-2 text-green-600" />
                Primary Keywords
              </h3>
              
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
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium border border-green-200 shadow-sm"
                      >
                        {propercaseSkill}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-700 text-sm">
                    No primary keywords were identified in your resume. Consider revising your resume to clearly highlight your technical 
                    and soft skills using industry-standard terminology.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Suggested Improvements Section */}
        <div className={`mb-8 ${expandedSections.improvements ? '' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold flex items-center text-gray-800">
              <Lightbulb className="h-6 w-6 mr-2 text-green-600" />
              Suggested Improvements
            </h2>
            <button 
              onClick={() => toggleSection('improvements')}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              {expandedSections.improvements ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          
          {Array.isArray(analysisData.suggestedImprovements) && analysisData.suggestedImprovements.length > 0 ? (
            <div className="space-y-3">
              {analysisData.suggestedImprovements.map((improvement, i) => (
                <div key={i} className="p-4 bg-green-50 rounded-lg border border-green-100 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-start group">
                    <span className="text-green-600 mr-2 group-hover:text-green-700 transition-colors">→</span>
                    <p className="text-green-800 group-hover:text-green-900 transition-colors">{improvement}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <Lightbulb className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-green-800">
                  We weren't able to generate specific improvement suggestions for this resume. This might be due to an analysis issue or insufficient data in your resume.
                  Try adding more detailed information to your resume, or analyze again with a job description for more targeted improvements.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Job Analysis Section */}
        {(analysisData.jobDescription || analysisData.jobAnalysis) ? (
          <div className={`mb-8 ${expandedSections.jobAnalysis ? '' : 'hidden'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold flex items-center text-gray-800">
                <Briefcase className="h-6 w-6 mr-2 text-green-600" />
                Job Match Analysis
              </h2>
              <button 
                onClick={() => toggleSection('jobAnalysis')}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                {expandedSections.jobAnalysis ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>
            
            {analysisData.jobAnalysis && typeof analysisData.jobAnalysis === 'object' ? (
              <div className="space-y-6">
                {/* Overall Fit with progress indicator */}
                {analysisData.jobAnalysis.overallFit && (
                  <div className="p-5 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-100">
                    <h3 className="text-lg font-medium text-green-800 mb-2">Overall Job Fit</h3>
                    <p className="text-gray-700 mb-4">{analysisData.jobAnalysis.overallFit}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-lg border border-green-100">
                    <h3 className="text-lg font-medium text-green-800 mb-3 flex items-center">
                      <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                      Your Resume Strengths
                    </h3>
                    
                    {Array.isArray(analysisData.jobAnalysis.alignmentAndStrengths) && 
                    analysisData.jobAnalysis.alignmentAndStrengths.length > 0 ? (
                      <ul className="space-y-2">
                        {analysisData.jobAnalysis.alignmentAndStrengths.map((strength, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-green-600 mr-2">✓</span>
                            <span className="text-gray-700">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">No specific strengths were identified for this job</p>
                    )}
                  </div>
                  
                  {/* Gaps */}
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 p-5 rounded-lg border border-orange-100">
                    <h3 className="text-lg font-medium text-orange-800 mb-3 flex items-center">
                      <span className="h-5 w-5 mr-2 text-orange-600 flex items-center justify-center">⚠</span>
                      Gaps to Address
                    </h3>
                    
                    {Array.isArray(analysisData.jobAnalysis.gapsAndConcerns) && 
                    analysisData.jobAnalysis.gapsAndConcerns.length > 0 ? (
                      <ul className="space-y-2">
                        {analysisData.jobAnalysis.gapsAndConcerns.map((gap, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-orange-600 mr-2">→</span>
                            <span className="text-gray-700">{gap}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 italic">No specific gaps were identified for this job</p>
                    )}
                  </div>
                </div>
                
                {/* Recommendations */}
                {Array.isArray(analysisData.jobAnalysis.recommendationsToTailor) && 
                analysisData.jobAnalysis.recommendationsToTailor.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-lg border border-green-100">
                    <h3 className="text-lg font-medium text-green-800 mb-3 flex items-center">
                      <Lightbulb className="h-5 w-5 mr-2 text-green-600" />
                      Tailoring Recommendations
                    </h3>
                    
                    <ul className="space-y-2">
                      {analysisData.jobAnalysis.recommendationsToTailor.map((rec, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-green-600 mr-2">→</span>
                          <span className="text-gray-700">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex">
                  <Briefcase className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-800 font-medium mb-2">
                      Job Analysis Information
                    </p>
                    <p className="text-green-700">
                      We detected a job description in your submission, but we weren't able to generate 
                      a complete job-specific analysis for your resume.
                    </p>
                    <p className="text-green-700 mt-2">
                      This might be due to an analysis processing issue or insufficient details in the job description.
                      Try providing a more detailed job description with clear requirements and responsibilities for better matching results.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Action Buttons - Enhanced styling */}
      <div className="mt-8">
        {/* Primary CTA Container with modern styling */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200 shadow-sm mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Ready to Improve Your Resume?</h3>
          
          {/* Button Group: Primary and Secondary CTAs side by side on desktop, stacked on mobile */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Primary CTA - More prominent styling with gradient background */}
            <Button 
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white 
                        flex items-center justify-center shadow-sm transition-all duration-200 text-base py-6"
              onClick={onImproveResume}
              size="lg"
            >
              <PenLine className="h-5 w-5 mr-2" />
              <span>Improve My Resume</span>
            </Button>
            
            {/* Secondary CTA - Complementary but less prominent styling */}
            <Button 
              variant="outline"
              onClick={onGenerateCoverLetter}
              size="lg"
              className="flex-1 border-green-300 text-green-800 hover:bg-green-50 flex items-center justify-center
                        transition-all duration-200 py-6 text-base"
            >
              <FileText className="h-5 w-5 mr-2" />
              <span>Generate Cover Letter</span>
            </Button>
          </div>
        </div>
        
        {/* Lower CTAs: Additional Options */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-3">
          {/* Do Another Analysis Button */}
          <button 
            onClick={() => {
              // Navigate to the resume analyzer page
              window.location.href = "/resume-analyzer";
            }}
            className="text-sm flex items-center text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Do another analysis
          </button>
          
          {/* View Previous Analyses Link */}
          <Link 
            href="/all-analyses" 
            className="text-sm flex items-center text-gray-500 hover:text-gray-800 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            View your previous analyses
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ResumeAnalysisEnhanced;