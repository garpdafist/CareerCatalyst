import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";
import { Brain, FileText, Upload, ChevronRight, CheckCircle, XCircle, AlertCircle, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeAnalysisSkeleton } from "@/components/ui/resume-analysis-skeleton";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import ResumeAnalysisInline from "@/components/ui/resume-analysis-inline";
import ResumeAnalysisPopup from "@/components/ui/resume-analysis-popup";

// Create a proper iOS-style toggle with accurate styling and animations
const iosSwitch = `
  peer h-[32px] w-[52px] shrink-0 cursor-pointer appearance-none rounded-full 
  bg-[#e9e9ea] transition-colors duration-200 ease-in-out
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
  checked:bg-[#34C759] relative
  after:absolute after:left-[2px] after:top-[2px]
  after:h-[28px] after:w-[28px] after:rounded-full 
  after:border-none after:bg-white
  after:shadow-[0_2px_2px_rgba(0,0,0,0.2)]
  after:transition-transform after:duration-200 after:ease-in-out
  checked:after:translate-x-[20px] hover:cursor-pointer
  disabled:cursor-not-allowed disabled:opacity-50
`;

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

// Helper to ensure arrays have a maximum length
const limitArrayLength = (arr: string[] | null | undefined, maxLength: number = 5): string[] => {
  if (!arr) return [];
  return arr.slice(0, maxLength);
};

// Add helper function for score-based color
const getScoreColor = (score: number): string => {
  if (score <= 50) return 'bg-red-500 hover:bg-red-600';
  if (score <= 70) return 'bg-yellow-500 hover:bg-yellow-600';
  return 'bg-green-500 hover:bg-green-600';
};

// Update the getFeedbackColor helper function for more subtle styling
const getFeedbackColor = (improvement: string): { text: string; bg: string; border: string } => {
  const isPositive = /increase|improve|enhance|success|achieve/i.test(improvement);
  return isPositive
    ? { text: 'text-green-700', bg: 'bg-green-50/50', border: 'border-green-100' }
    : { text: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-100' };
};

export default function ResumeAnalyzer() {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isApplyingForJob, setIsApplyingForJob] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isPopupOpen, setIsPopupOpen] = useState(false); // State for popup visibility (will be removed)
  const { toast } = useToast();
  const [, navigate] = useLocation(); // For navigation to all-analyses page
  
  // Use saved analysis hook to support persistent analyses
  const { 
    savedAnalysis, 
    isLoadingSavedAnalysis,
    analysisId,
    setAnalysisId,
    refetchUserAnalyses
  } = useSavedAnalysis();
  
  // State to hold the displayed analysis (either from mutation or from saved analysis)
  const [displayedAnalysis, setDisplayedAnalysis] = useState<ResumeAnalysis | null>(null);
  
  // Import additional functions for data retrieval
  const { findAnalysisInCache } = useSavedAnalysis();
  
  const analyzeMutation = useMutation({
    mutationFn: async (data: { content: string; jobDescription?: string } | FormData) => {
      setAnalysisProgress(0);

      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      try {
        // If we have job description, append it to the FormData or include in the request body
        if (data instanceof FormData && isApplyingForJob && jobDescription) {
          data.append('jobDescription', jobDescription);
        } else if (!(data instanceof FormData) && isApplyingForJob && jobDescription) {
          data = { ...data, jobDescription };
        }

        // Use a 3-minute timeout for resume analysis (180000ms)
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
      // If the analysis has an ID, update state
      if (result.id) {
        setAnalysisId(result.id);
        // Refresh user analyses list to include the new one
        refetchUserAnalyses();
        // Open the popup to show results immediately - this is just to keep the code compiling,
        // in reality we're using inline display so we don't need to show a popup
        setIsPopupOpen(true);
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

  // Effect to load saved analysis and set displayed analysis state
  useEffect(() => {
    console.log('Resume Analyzer useEffect:', {
      savedAnalysis,
      analyzeMutation: analyzeMutation.data,
      isLoadingSavedAnalysis,
      displayedAnalysis,
      analysisId
    });

    const handleAnalysisDisplay = () => {
      if (analyzeMutation.data) {
        console.log('Setting analysis from mutation');
        setDisplayedAnalysis(analyzeMutation.data);
        return;
      }

      if (savedAnalysis) {
        console.log('Setting analysis from API');
        setDisplayedAnalysis(savedAnalysis);
        // If we received a saved analysis by API, open the popup
        if (!isPopupOpen && analysisId) {
          setIsPopupOpen(true);
        }
        return;
      }

      if (analysisId) {
        const cachedAnalysis = findAnalysisInCache(analysisId);
        if (cachedAnalysis) {
          console.log('Setting analysis from cache');
          setDisplayedAnalysis(cachedAnalysis);
          // If we received a cached analysis, open the popup
          if (!isPopupOpen) {
            setIsPopupOpen(true);
          }
          return;
        }
      }
    };

    handleAnalysisDisplay();
  }, [
    savedAnalysis, 
    analyzeMutation.data, 
    isLoadingSavedAnalysis, 
    analysisId, 
    findAnalysisInCache,
    isPopupOpen
  ]);
  
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
    <div className="min-h-screen bg-background px-4 py-8 md:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-8 md:mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 md:mb-4">
              Resume Analyzer
            </h1>
            <p className="text-base md:text-lg text-muted-foreground">
              Get instant AI-powered feedback on your resume
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 md:space-y-6"
        >
          {/* Loading States - Either for a new analysis or loading a saved one */}
          {(analyzeMutation.isPending || isLoadingSavedAnalysis) && (
            <Card>
              <CardContent className="pt-6">
                {/* Show different skeletons based on what's loading */}
                {analyzeMutation.isPending ? (
                  // Loading state for new analysis
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
                ) : (
                  // Loading state for viewing saved analysis
                  <ResumeAnalysisSkeleton
                    progress={95} // High progress to indicate we're almost done
                    status="Loading your saved analysis..."
                    funMessage="Just a moment while we retrieve your saved analysis."
                    includesJobDescription={false}
                    expectedTime="just a moment"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Submit Form - Only show when not analyzing AND when there are no analysis results */}
          {!analyzeMutation.isPending && !isLoadingSavedAnalysis && !displayedAnalysis && (
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                // Only submit if it was the submit button that was clicked
                if (e.nativeEvent.submitter && e.nativeEvent.submitter.type === "submit") {
                  handleSubmit();
                }
              }} 
              className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <Tabs defaultValue="paste" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="paste" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Paste Content
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload File
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="paste">
                      <div className="space-y-4">
                        <Textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          className="h-64"
                          placeholder="Paste your resume here..."
                        />
                        <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-border/30">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="job-description-toggle"
                              checked={isApplyingForJob}
                              onChange={(e) => {
                                e.preventDefault();
                                setIsApplyingForJob(e.target.checked);
                              }}
                              className={iosSwitch}
                            />
                            <Label
                              htmlFor="job-description-toggle"
                              className="text-sm font-medium cursor-pointer select-none"
                            >
                              Add Job Description
                            </Label>
                          </div>
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
                                className="min-h-[100px] resize-none mt-4 transition-all duration-300"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </TabsContent>

                    <TabsContent value="upload">
                      <div className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
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
                        {file && (
                          <p className="text-sm text-muted-foreground text-center">
                            File loaded: {file.name}
                          </p>
                        )}
                        <div className="flex items-center justify-between p-3 bg-muted/10 rounded-lg border border-border/30">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="job-description-toggle-upload"
                              checked={isApplyingForJob}
                              onChange={(e) => {
                                e.preventDefault();
                                setIsApplyingForJob(e.target.checked);
                              }}
                              className={iosSwitch}
                            />
                            <Label
                              htmlFor="job-description-toggle-upload"
                              className="text-sm font-medium cursor-pointer select-none"
                            >
                              Add Job Description
                            </Label>
                          </div>
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
                                className="min-h-[100px] resize-none mt-4 transition-all duration-300"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Button
                type="submit"
                size="lg"
                disabled={analyzeMutation.isPending}
                className="w-full"
              >
                {analyzeMutation.isPending ? (
                  "Analyzing..."
                ) : (
                  "Analyze Resume"
                )}
              </Button>
              
              {/* Less prominent "View All Analyses" link below the submit button */}
              <div className="text-center mt-6">
                <div 
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  onClick={() => navigate('/all-analyses')}
                >
                  <History className="h-4 w-4 mr-1" />
                  View your previous resume analyses
                </div>
              </div>
            </form>
          )}

          {/* Analysis Results Section - Show inline results when analysis is available */}
          {displayedAnalysis && !analyzeMutation.isPending && !isLoadingSavedAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-6 md:mt-8"
            >
              <ResumeAnalysisInline 
                analysisData={displayedAnalysis}
                isLoading={false}
                onImproveResume={() => {
                  // Navigate to the resume editor (this would be implemented in a future update)
                  toast({
                    title: "Coming Soon",
                    description: "The resume editor feature will be available soon.",
                  });
                }}
                onGenerateCoverLetter={() => {
                  // Navigate to the cover letter generator (this would be implemented in a future update)
                  toast({
                    title: "Coming Soon",
                    description: "The cover letter generator feature will be available soon.",
                  });
                }}
              />
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}