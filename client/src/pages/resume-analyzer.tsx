import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";
import { FileText, Upload, History, Clock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeAnalysisSkeleton } from "@/components/ui/resume-analysis-skeleton";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import ResumeAnalysisInline from "@/components/ui/resume-analysis-inline";
import ResumeAnalysisPopup from "@/components/ui/resume-analysis-popup";

// Animation variants for the textarea with spring effect
const textAreaVariants = {
  hidden: { 
    opacity: 0, 
    y: -10, 
    height: 0,
    transition: {
      duration: 0.3,
      ease: "cubic-bezier(0.34, 1.56, 0.64, 1)" // Custom spring effect
    }
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    height: "auto",
    transition: {
      duration: 0.3,
      ease: "cubic-bezier(0.34, 1.56, 0.64, 1)" // Custom spring effect
    }
  }
};

// Helper functions
const limitArrayLength = (arr: string[] | null | undefined, maxLength: number = 5): string[] => {
  if (!arr) return [];
  return arr.slice(0, maxLength);
};

const getScoreColor = (score: number): string => {
  if (score <= 50) return 'bg-red-500 hover:bg-red-600';
  if (score <= 70) return 'bg-yellow-500 hover:bg-yellow-600';
  return 'bg-green-500 hover:bg-green-600';
};

const getFeedbackColor = (improvement: string): { text: string; bg: string; border: string } => {
  const isPositive = /increase|improve|enhance|success|achieve/i.test(improvement);
  return isPositive
    ? { text: 'text-green-700', bg: 'bg-green-50/50', border: 'border-green-100' }
    : { text: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-100' };
};

export default function ResumeAnalyzer() {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('upload');
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isApplyingForJob, setIsApplyingForJob] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Analysis state
  const { 
    savedAnalysis, 
    isLoadingSavedAnalysis,
    analysisId,
    setAnalysisId,
    refetchUserAnalyses,
    findAnalysisInCache
  } = useSavedAnalysis();

  const [displayedAnalysis, setDisplayedAnalysis] = useState<ResumeAnalysis | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async (data: { content: string; jobDescription?: string } | FormData) => {
      setAnalysisProgress(0);
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      try {
        if (data instanceof FormData && isApplyingForJob && jobDescription) {
          data.append('jobDescription', jobDescription);
        } else if (!(data instanceof FormData) && isApplyingForJob && jobDescription) {
          data = { ...data, jobDescription };
        }

        const res = await apiRequest(
          "POST", 
          "/api/resume-analyze", 
          data, 
          { timeout: 180000 }
        );
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        return await res.json() as ResumeAnalysis;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.id) {
        setAnalysisId(result.id);
        refetchUserAnalyses();
      }
    },
    onError: (error: Error) => {
      setAnalysisProgress(0);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFile(file);
    setContent("");
  };

  // Effect to load saved analysis
  useEffect(() => {
    if (analyzeMutation.data) {
      setDisplayedAnalysis(analyzeMutation.data);
      return;
    }

    if (savedAnalysis) {
      setDisplayedAnalysis(savedAnalysis);
      return;
    }

    if (analysisId) {
      const cachedAnalysis = findAnalysisInCache(analysisId);
      if (cachedAnalysis) {
        setDisplayedAnalysis(cachedAnalysis);
      }
    }
  }, [savedAnalysis, analyzeMutation.data, analysisId, findAnalysisInCache]);

  const handleSubmit = () => {
    if (!content.trim() && !file) {
      toast({
        title: "Error",
        description: "Please provide a resume file or text content",
        variant: "destructive"
      });
      return;
    }

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      analyzeMutation.mutate(formData);
    } else {
      analyzeMutation.mutate({ content });
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Resume Analyzer</h1>
          <p className="text-muted-foreground">Get instant AI-powered feedback on your resume</p>
        </div>

        {(analyzeMutation.isPending || isLoadingSavedAnalysis) ? (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <ResumeAnalysisSkeleton
                progress={analysisProgress}
                status={
                  analysisProgress < 30 ? "Analyzing resume content..." :
                  analysisProgress < 60 ? "Processing skills and experience..." :
                  analysisProgress < 90 ? "Generating recommendations..." :
                  "Finalizing analysis..."
                }
                includesJobDescription={isApplyingForJob}
                expectedTime={isApplyingForJob ? "15-20 seconds" : "10-15 seconds"}
              />
            </CardContent>
          </Card>
        ) : !displayedAnalysis ? (
          <form 
            onSubmit={(e) => { 
              console.log("Form submission event triggered");
              // Always prevent default submission
              e.preventDefault();
              
              // Only process submission if it came from the submit button
              const submitter = (e as any).nativeEvent?.submitter;
              console.log("Form submitter:", submitter?.type, submitter?.className);
              
              // Ensure the submitter is the actual submit button
              if (submitter && submitter.type === "submit" && submitter.className.includes("bg-green-600")) {
                console.log("Processing form submission from the Analyze Resume button");
                handleSubmit();
              } else {
                console.log("Ignoring form submission not from Analyze Resume button");
              }
            }} 
            className="space-y-6 bg-[#FAF9F4] rounded-lg p-6"
          >
            <div className="flex mb-4 gap-2">
              <Button
                type="button"
                variant={activeTab === 'paste' ? 'default' : 'outline'}
                className="flex items-center gap-2 rounded-md"
                onClick={() => setActiveTab('paste')}
              >
                <FileText className="h-4 w-4" />
                Paste Content
              </Button>
              <Button
                type="button" 
                variant={activeTab === 'upload' ? 'default' : 'outline'}
                className="flex items-center gap-2 rounded-md"
                onClick={() => setActiveTab('upload')}
              >
                <Upload className="h-4 w-4" />
                Upload File
              </Button>
            </div>

            <div className="space-y-4">
              {activeTab === 'paste' ? (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="h-64 bg-white"
                  placeholder="Paste your resume here..."
                />
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-white">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Upload your resume in TXT, DOC, DOCX, or PDF format
                    </p>
                    <Input
                      type="file"
                      accept=".txt,.doc,.docx,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="mx-auto max-w-xs"
                    />
                  </div>
                </div>
              )}

              {file && (
                <p className="text-sm text-muted-foreground text-center">
                  File loaded: {file.name}
                </p>
              )}

              <div className="flex items-center mt-4">
                {/* Custom toggle switch that won't trigger form submission */}
                <button 
                  type="button" // Explicitly set as button type to prevent form submission
                  className="relative inline-block w-12 h-6 mr-2"
                  onClick={(e) => {
                    console.log("Toggle container clicked");
                    e.preventDefault();
                    e.stopPropagation();
                    // Use functional state update to ensure we always get the latest state
                    setIsApplyingForJob(prev => {
                      console.log("Toggling job description from", prev, "to", !prev);
                      return !prev;
                    });
                  }}
                >
                  {/* Hidden input for accessibility - purely visual, not functional */}
                  <input
                    type="checkbox"
                    id="job-description-toggle"
                    checked={isApplyingForJob}
                    readOnly
                    className="peer sr-only"
                    // Prevent any possible click events by stopping propagation
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                  {/* Styled label that works as the visible toggle */}
                  <div
                    className="absolute cursor-pointer rounded-full bg-gray-200 peer-checked:bg-[#34C759] w-full h-full transition-colors duration-300"
                  >
                    <span className="block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 translate-x-0.5 translate-y-0.5 peer-checked:translate-x-6"></span>
                  </div>
                </button>
                {/* Text label that also toggles state - converted to button to prevent form submission */}
                <button
                  type="button" // Explicitly set as button type
                  className="text-sm font-medium cursor-pointer"
                  onClick={(e) => {
                    console.log("Text label clicked");
                    e.preventDefault();
                    e.stopPropagation();
                    setIsApplyingForJob(prev => !prev);
                  }}
                >
                  Add Job Description
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isApplyingForJob && (
                  <motion.div
                    variants={textAreaVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <Textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the job description here to get tailored suggestions..."
                      className="mt-4 bg-white min-h-[100px] resize-none"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Primary CTA - Analyze Resume Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 text-white mt-6 py-6 text-lg font-semibold shadow-lg"
                disabled={analyzeMutation.isPending}
                onClick={(e) => {
                  // Extra logging to track button click events
                  console.log("Analyze Resume button clicked");
                }}
              >
                {analyzeMutation.isPending ? 
                  <span className="flex items-center">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Analyzing...
                  </span> : 
                  "Analyze Resume"
                }
              </Button>
            </div>

            <div className="text-center mt-4">
              <div 
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                onClick={() => navigate('/all-analyses')}
              >
                <Clock className="h-4 w-4 mr-1" />
                View your previous resume analyses
              </div>
            </div>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ResumeAnalysisInline 
              analysisData={displayedAnalysis}
              isLoading={false}
              onImproveResume={() => {
                toast({
                  title: "Coming Soon",
                  description: "The resume editor feature will be available soon.",
                });
              }}
              onGenerateCoverLetter={() => {
                toast({
                  title: "Coming Soon",
                  description: "The cover letter generator feature will be available soon.",
                });
              }}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}