import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";
import { FileText, Upload, History, Clock, Loader2, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeAnalysisSkeleton } from "@/components/ui/resume-analysis-skeleton";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import { ResumeAnalysisEnhanced } from "@/components/ui/resume-analysis-enhanced";
import { Switch } from "@/components/ui/switch";


// Animation variants for the textarea with spring effect
const textAreaVariants = {
  hidden: { 
    opacity: 0, 
    height: 0,
    transition: {
      duration: 0.2, // Adjusted duration
      ease: "easeInOut" // Simplified easing
    }
  },
  visible: { 
    opacity: 1, 
    height: "auto",
    transition: {
      duration: 0.2, // Adjusted duration
      ease: "easeInOut" // Simplified easing
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
      console.log("analyzeMutation called with data:", 
                  data instanceof FormData ? "FormData object" : data);
      
      setAnalysisProgress(0);
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      try {
        // We no longer need to modify the data here since we're handling it in handleSubmit
        // This avoids potential double-appending of jobDescription
        
        console.log("Making API request with data:", 
                    data instanceof FormData ? 
                    `FormData (has jobDescription: ${data.has('jobDescription')})` : 
                    JSON.stringify(data));
                    
        const res = await apiRequest(
          "POST", 
          "/api/resume-analyze", 
          data, 
          { timeout: 180000 }
        );
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        
        const jsonResponse = await res.json() as ResumeAnalysis;
        console.log("API response received:", jsonResponse);
        return jsonResponse;
      } catch (error) {
        clearInterval(progressInterval);
        console.error("API request failed:", error);
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
    console.log("handleSubmit called with isApplyingForJob:", isApplyingForJob, "jobDescription:", jobDescription);
    
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
      
      // Always append jobDescription if the toggle is on, even if it's empty
      if (isApplyingForJob) {
        console.log("Adding job description to FormData:", jobDescription);
        formData.append('jobDescription', jobDescription);
      }
      
      analyzeMutation.mutate(formData);
    } else {
      // For text content, include job description in the payload if toggle is on
      if (isApplyingForJob) {
        console.log("Adding job description to content payload:", jobDescription);
        analyzeMutation.mutate({ 
          content,
          jobDescription
        });
      } else {
        analyzeMutation.mutate({ content });
      }
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
          <div className="space-y-6 bg-[#FAF9F4] rounded-lg p-6">
            {/* Changed from form to div to prevent any form submission behaviors */}
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

              {/* Replaced toggle with Switch component */}
              <div className="flex flex-col space-y-4 mt-6">
                <div className="flex items-center">
                  <Switch
                    checked={isApplyingForJob}
                    onCheckedChange={setIsApplyingForJob}
                    className="data-[state=checked]:bg-green-500 h-6 w-11"
                  />
                  <Label htmlFor="job-description" className="ml-3 cursor-pointer">
                    Add Job Description
                  </Label>
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
                        id="job-description"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the job description here to get tailored suggestions..."
                        className="min-h-[100px] w-full bg-white resize-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>


              {/* Primary CTA - Analyze Resume Button */}
              <Button
                type="button"
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 text-white mt-6 py-6 text-lg font-semibold shadow-lg"
                disabled={analyzeMutation.isPending}
                onClick={(e) => {
                  // Explicitly call handleSubmit since we're not using a form anymore
                  e.preventDefault();
                  console.log("Analyze Resume button clicked - direct execution");
                  handleSubmit();
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
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ResumeAnalysisEnhanced 
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