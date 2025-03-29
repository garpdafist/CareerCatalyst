import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";
import { Brain, FileText, Upload, ChevronRight, CheckCircle, XCircle, AlertCircle, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { ResumeAnalysisSkeleton } from "@/components/ui/resume-analysis-skeleton";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useSavedAnalysis } from "@/hooks/use-saved-analysis";
import { formatDistanceToNow } from "date-fns";
import { SavedAnalyses } from "@/components/saved-analyses";

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

// Update the keywords section to handle conditional rendering
const KeywordsSection = ({ data }: { data: ResumeAnalysis }) => {
  // Safely extract keywords with proper type handling
  const primaryKeywords = data.primaryKeywords || [];
  const targetKeywords = (data as any).targetKeywords || [];
  const hasJobDescription = targetKeywords.length > 0;

  return (
    <div>
      <h3 className="text-lg font-medium mb-3">
        {hasJobDescription ? "Primary & Target Keywords" : "Primary Keywords"}
      </h3>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Keywords from your resume:</p>
          <div className="flex flex-wrap gap-2">
            {limitArrayLength(primaryKeywords).map((keyword, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        </div>

        {hasJobDescription && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Target keywords from job description:</p>
            <div className="flex flex-wrap gap-2">
              {limitArrayLength(targetKeywords).map((keyword, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Update the general feedback section to show only overall feedback
const GeneralFeedbackSection = ({ data }: { data: ResumeAnalysis }) => {
  // Safely extract the feedback content with proper type handling
  let feedback = "No general feedback available";
  
  if (data.generalFeedback) {
    if (typeof data.generalFeedback === 'string') {
      feedback = data.generalFeedback;
    } else if (typeof data.generalFeedback === 'object' && data.generalFeedback !== null) {
      // If it's an object, try to get the 'overall' property if it exists
      const feedbackObj = data.generalFeedback as { overall?: string };
      if (feedbackObj.overall) {
        feedback = feedbackObj.overall;
      }
    }
  }

  return (
    <div>
      <h3 className="text-lg font-medium mb-3">General Feedback</h3>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <p className="text-sm md:text-base text-gray-600">
            {feedback}
          </p>
        </div>
      </div>
    </div>
  );
};

// New component for job analysis results with proper typing
const JobAnalysisSection = ({ data }: { data: ResumeAnalysis }) => {
  // Return null if jobAnalysis is null or undefined
  if (!data.jobAnalysis) return null;
  
  // The jobAnalysis field is now properly typed in the schema

  return (
    <div className="space-y-6">
      {data.jobAnalysis?.alignmentAndStrengths && data.jobAnalysis.alignmentAndStrengths.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Alignment & Strengths</h3>
          <ul className="space-y-2">
            {data.jobAnalysis.alignmentAndStrengths.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm bg-green-50/50 rounded-lg p-3 border border-green-100">
                <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                <span className="text-green-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.jobAnalysis?.gapsAndConcerns && data.jobAnalysis.gapsAndConcerns.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Gaps & Concerns</h3>
          <ul className="space-y-2">
            {data.jobAnalysis.gapsAndConcerns.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm bg-red-50/50 rounded-lg p-3 border border-red-100">
                <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                <span className="text-red-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.jobAnalysis?.recommendationsToTailor && data.jobAnalysis.recommendationsToTailor.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">How to Tailor Your Resume</h3>
          <ul className="space-y-2">
            {data.jobAnalysis.recommendationsToTailor.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                <ChevronRight className="h-5 w-5 mt-0.5 flex-shrink-0 text-blue-600" />
                <span className="text-blue-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.jobAnalysis?.overallFit && (
        <div>
          <h3 className="text-lg font-medium mb-3">Overall Fit Assessment</h3>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-1 flex-shrink-0 text-gray-600" />
              <p className="text-sm md:text-base text-gray-600">
                {data.jobAnalysis.overallFit}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

  // State to hold the displayed analysis (either from mutation or from saved analysis)
  const [displayedAnalysis, setDisplayedAnalysis] = useState<ResumeAnalysis | null>(null);
  
  // Create a default empty analysis for TypeScript (not actually used)
  const emptyAnalysis: ResumeAnalysis = {
    id: 0,
    userId: "",
    content: "",
    score: 0,
    identifiedSkills: [],
    primaryKeywords: [],
    suggestedImprovements: [],
    generalFeedback: "",
    createdAt: null,
    updatedAt: null,
  };

  // Effect to load saved analysis from URL parameter
  useEffect(() => {
    console.log('Resume Analyzer useEffect:');
    console.log('- savedAnalysis:', savedAnalysis);
    console.log('- analyzeMutation.data:', analyzeMutation.data);
    console.log('- isLoadingSavedAnalysis:', isLoadingSavedAnalysis);
    console.log('- displayedAnalysis:', displayedAnalysis);
    
    // If we have a saved analysis and no current mutation data, use the saved one
    if (savedAnalysis && !analyzeMutation.data && !isLoadingSavedAnalysis) {
      console.log('Setting displayed analysis to savedAnalysis');
      setDisplayedAnalysis(savedAnalysis);
    } else if (analyzeMutation.data) {
      console.log('Setting displayed analysis to analyzeMutation.data');
      setDisplayedAnalysis(analyzeMutation.data);
    }
  }, [savedAnalysis, analyzeMutation.data, isLoadingSavedAnalysis]);
  
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
          {/* Loading State */}
          {analyzeMutation.isPending && (
            <Card>
              <CardContent className="pt-6">
                {/* Single, unified skeleton-based loading state */}
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

          {/* Results Section */}
          {displayedAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-6 md:mt-8"
            >
              <Card>
                <CardContent className="pt-6">
                  {/* Analysis Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
                      <Brain className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                      Analysis Results
                    </h2>
                    <span className={`text-2xl md:text-3xl font-bold ${
                      displayedAnalysis.score > 70 ? 'text-green-600' :
                        displayedAnalysis.score > 50 ? 'text-yellow-600' :
                          'text-red-600'
                    }`}>
                      {displayedAnalysis.score}/100
                    </span>
                  </div>

                  <div className="mt-6 md:mt-8 space-y-6 md:space-y-8">
                    {/* Key Skills */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">Key Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {limitArrayLength(displayedAnalysis.identifiedSkills || []).map((skill, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                          >
                            {skill}
                          </Badge>
                        ))}
                        {(displayedAnalysis.identifiedSkills || []).length === 0 && (
                          <p className="text-sm text-gray-500">No key skills identified</p>
                        )}
                      </div>
                    </div>

                    {/* Updated Keywords Section */}
                    <KeywordsSection data={displayedAnalysis} />

                    {/* Suggested Improvements */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">Suggested Improvements</h3>
                      <ul className="space-y-2 md:space-y-3">
                        {limitArrayLength(displayedAnalysis.suggestedImprovements || []).map((improvement, index) => {
                          const colors = getFeedbackColor(improvement);
                          return (
                            <li
                              key={index}
                              className={`flex items-start gap-2 rounded-lg p-2 md:p-3 ${colors.bg} ${colors.text} border ${colors.border}`}
                            >
                              <ChevronRight className={`h-5 w-5 mt-0.5 flex-shrink-0 ${colors.text}`} />
                              <span className="text-sm md:text-base">{improvement}</span>
                            </li>
                          );
                        })}
                        {(displayedAnalysis.suggestedImprovements || []).length === 0 && (
                          <li className="text-sm text-gray-500">No improvements suggested</li>
                        )}
                      </ul>
                    </div>

                    {/* Job-Specific Recommendations Section */}
                    {displayedAnalysis.jobSpecificFeedback && (
                      <div>
                        <h3 className="text-lg font-medium mb-3">Job-Specific Recommendations</h3>
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                          <p className="text-sm md:text-base text-blue-700 whitespace-pre-line">
                            {displayedAnalysis.jobSpecificFeedback}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Updated General Feedback Section */}
                    <GeneralFeedbackSection data={displayedAnalysis} />

                    {/* Add new Job Analysis section */}
                    {displayedAnalysis.jobAnalysis && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <h2 className="text-xl md:text-2xl font-semibold mb-6">
                          Job Match Analysis
                        </h2>
                        <JobAnalysisSection data={displayedAnalysis} />
                      </div>
                    )}

                    {/* Add CTA Section */}
                    <div className="mt-8 pt-6 border-t border-gray-100">
                      <Link href="/resume-editor" className="block">
                        <div className="group bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-xl p-6 transition-all duration-300 border border-green-100 hover:border-green-200 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-semibold text-green-700 mb-2">
                                Ready to Improve Your Resume?
                              </h3>
                              <p className="text-green-600">
                                Use our AI-powered resume editor to implement these suggestions and create a stronger resume
                              </p>
                            </div>
                            <ArrowRight className="w-6 h-6 text-green-600 transform group-hover:translate-x-1 transition-transform duration-300" />
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}