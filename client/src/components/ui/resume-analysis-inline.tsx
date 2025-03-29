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

  return (
    <div className="max-w-3xl mx-auto">
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