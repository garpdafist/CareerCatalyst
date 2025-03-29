import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";
import { Brain, FileText, Upload, ChevronRight, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeAnalysisSkeleton } from "@/components/ui/resume-analysis-skeleton";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import { SavedAnalyses } from "@/components/saved-analyses";
import { ResumeAnalysisPopup } from "@/components/ui/resume-analysis-popup";

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
      ease: [0.34, 1.56, 0.64, 1] // Custom spring effect
    }
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    height: "auto",
    transition: {
      duration: 0.3,
      ease: [0.34, 1.56, 0.64, 1] // Custom spring effect
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
  const { toast } = useToast();
  
  // Use saved analysis hook to support deep linking and persistent analyses
  const { 
    savedAnalysis, 
    isLoadingSavedAnalysis,
    analysisId,
    setAnalysisId,
    refetchUserAnalyses
  } = useSavedAnalysis();
  
  // State to hold the displayed analysis (either from mutation or from saved analysis)
  const [displayedAnalysis, setDisplayedAnalysis] = useState<ResumeAnalysis | null>(null);
  
  // State to control the visibility of the analysis popup
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  // Import additional functions
  const { 
    findAnalysisInCache, 
    analysisStatus 
  } = useSavedAnalysis();
  
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
      // If the analysis has an ID, update the URL for deep linking
      if (result.id) {
        setAnalysisId(result.id);
        // Refresh user analyses list to include the new one
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

  // Enhanced effect to load saved analysis with optimized loading
  useEffect(() => {
    console.log('Resume Analyzer useEffect:');
    console.log('- savedAnalysis:', savedAnalysis);
    console.log('- analyzeMutation.data:', analyzeMutation.data);
    console.log('- isLoadingSavedAnalysis:', isLoadingSavedAnalysis);
    console.log('- displayedAnalysis:', displayedAnalysis);
    console.log('- analysisStatus:', analysisStatus);
    console.log('- analysisId:', analysisId);
    
    // Always open the popup when an analysis ID is set (this enables clicking from SavedAnalyses)
    if (analysisId && !isPopupOpen) {
      setIsPopupOpen(true);
    }
    
    if (analyzeMutation.data) {
      // New analysis results have priority
      console.log('Setting displayed analysis to analyzeMutation.data');
      setDisplayedAnalysis(analyzeMutation.data);
      setIsPopupOpen(true); // Automatically open popup for new analyses
    } 
    else if (savedAnalysis) {
      // We have data from the API
      console.log('Setting displayed analysis to savedAnalysis from API');
      setDisplayedAnalysis(savedAnalysis);
      setIsPopupOpen(true); // Automatically open popup for saved analyses
    } 
    else if (analysisId) {
      // Try to find in cache for immediate display while API loads
      const cachedAnalysis = findAnalysisInCache(analysisId);
      if (cachedAnalysis && !displayedAnalysis) {
        console.log('Setting displayed analysis from cache');
        setDisplayedAnalysis(cachedAnalysis);
        setIsPopupOpen(true); // Automatically open popup for cached analyses
      }
    }
  }, [
    savedAnalysis, 
    analyzeMutation.data, 
    isLoadingSavedAnalysis, 
    analysisId, 
    findAnalysisInCache,
    analysisStatus,
    displayedAnalysis,
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

          {/* Saved Analyses - Show when not analyzing and not displaying results */}
          {!analyzeMutation.isPending && !displayedAnalysis && (
            <SavedAnalyses />
          )}
          
          {/* Submit Form - Only show when not analyzing */}
          {!analyzeMutation.isPending && (
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
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
                              onChange={(e) => setIsApplyingForJob(e.target.checked)}
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
                              onChange={(e) => setIsApplyingForJob(e.target.checked)}
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
            </form>
          )}

          {/* Results Section - Just display a button to show the popup */}
          {displayedAnalysis && !analyzeMutation.isPending && !isLoadingSavedAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-6 md:mt-8"
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-1">
                        <Brain className="h-5 w-5 text-green-600" />
                        Analysis Complete
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        Your resume analysis is ready to view
                      </p>
                    </div>
                    <Button 
                      className={getScoreColor(displayedAnalysis.score)}
                      onClick={() => setIsPopupOpen(true)}
                    >
                      View Results <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
      
      {/* Add the ResumeAnalysisPopup component */}
      <ResumeAnalysisPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        analysisData={displayedAnalysis}
        isLoading={isLoadingSavedAnalysis} 
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        analysisData={displayedAnalysis}
        isLoading={analyzeMutation.isPending || isLoadingSavedAnalysis}
      />
    </div>
  );
}