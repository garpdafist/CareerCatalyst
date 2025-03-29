import { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, Download, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ResumeAnalysis } from '@shared/schema';

interface ResumeAnalysisPopupProps {
  isOpen: boolean;
  onClose: () => void;
  analysisData: ResumeAnalysis | null;
  isLoading?: boolean;
}

export function ResumeAnalysisPopup({ 
  isOpen, 
  onClose, 
  analysisData,
  isLoading = false
}: ResumeAnalysisPopupProps) {
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');

  // Control animation states based on isOpen prop
  useEffect(() => {
    if (isOpen) {
      setAnimationState('opening');
      const timer = setTimeout(() => setAnimationState('open'), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimationState('closing');
      const timer = setTimeout(() => setAnimationState('closed'), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (animationState === 'closed') return null;

  // Get score color based on score value 
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop with blur effect */}
      <div 
        className={`absolute inset-0 backdrop-blur-sm bg-black/30 transition-opacity duration-300 ${
          animationState === 'opening' || animationState === 'closing' 
            ? 'opacity-0' 
            : 'opacity-100'
        }`}
        onClick={onClose}
      />
      
      {/* Popup content with Apple-inspired design */}
      <div 
        className={`relative bg-background/95 dark:bg-background/95 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] transform transition-all duration-300 mx-4 overflow-hidden ${
          animationState === 'opening' ? 'scale-95 opacity-0' :
          animationState === 'closing' ? 'scale-95 opacity-0' :
          'scale-100 opacity-100'
        }`}
      >
        {/* Header with score */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold">Analysis Results</h2>
          </div>
          
          <div className="flex items-center">
            {!isLoading && analysisData && (
              <Badge 
                variant="outline" 
                className={`${getScoreColor(analysisData.score)} text-lg px-3 py-1 mr-2`}
              >
                {analysisData.score}/100
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="ml-2">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content area with scrolling */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 150px)' }}>
          {isLoading ? (
            <div className="p-6 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="text-lg font-medium text-center">
                Analyzing your resume for strengths and opportunities...
              </p>
              <p className="text-muted-foreground text-center mt-2">
                This typically takes 10-15 seconds. We're extracting your skills, achievements, and providing targeted feedback.
              </p>
            </div>
          ) : analysisData ? (
            <div className="p-6 space-y-8">
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

              {/* Score Breakdown Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Score Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisData.scores && Object.entries(analysisData.scores).map(([key, value]: [string, any]) => (
                    <Card key={key} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h4>
                          <Badge variant="outline">
                            {value.score}/{value.maxScore}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{value.feedback}</p>
                      </CardContent>
                    </Card>
                  ))}
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
                      <h4 className="font-medium text-green-700 mb-2">Strengths & Alignment</h4>
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
                      <h4 className="font-medium text-blue-700 mb-2">Recommendations</h4>
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
                        <h4 className="font-medium mb-2">Overall Fit</h4>
                        <p className="text-muted-foreground">{analysisData.jobAnalysis.overallFit}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-muted-foreground">No analysis data available</p>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="p-6 border-t bg-muted/50">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
            <Button 
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
            {!isLoading && analysisData && (
              <div className="flex gap-3">
                <Button>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResumeAnalysisPopup;