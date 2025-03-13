import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";
import { Brain, FileText, Upload, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedProgressPath } from "@/components/ui/animated-progress-path";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Enhanced iOS-style switch with proper styling
const iosSwitch = `
  peer h-[24px] w-[44px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-transparent 
  bg-gray-300 transition-colors duration-200 ease-in-out
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
  checked:bg-green-500 relative
  after:absolute after:left-[-2px] after:top-[-2px]
  after:h-[24px] after:w-[24px] after:rounded-full 
  after:border-2 after:border-transparent
  after:bg-white after:shadow-md
  after:transition-all after:duration-200 after:ease-in-out
  checked:after:translate-x-[22px] hover:cursor-pointer
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
        } else if (!data instanceof FormData && isApplyingForJob && jobDescription) {
          data = { ...data, jobDescription };
        }

        const res = await apiRequest("POST", "/api/resume-analyze", data);
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        return await res.json() as ResumeAnalysis;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
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
          {analyzeMutation.isPending && (
            <Card>
              <CardContent className="pt-6">
                <AnimatedProgressPath
                  progress={analysisProgress}
                  status={
                    analysisProgress < 30 ? "Analyzing resume content..." :
                      analysisProgress < 60 ? "Processing skills and experience..." :
                        analysisProgress < 90 ? "Generating recommendations..." :
                          "Finalizing analysis..."
                  }
                />
              </CardContent>
            </Card>
          )}

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
                          <Switch
                            id="job-description-toggle"
                            checked={isApplyingForJob}
                            onCheckedChange={setIsApplyingForJob}
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
                          <Switch
                            id="job-description-toggle-upload"
                            checked={isApplyingForJob}
                            onCheckedChange={setIsApplyingForJob}
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

          {analyzeMutation.data && (
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
                      analyzeMutation.data.score > 70 ? 'text-green-600' :
                        analyzeMutation.data.score > 50 ? 'text-yellow-600' :
                          'text-red-600'
                    }`}>
                      {analyzeMutation.data.score}/100
                    </span>
                  </div>

                  <div className="mt-6 md:mt-8 space-y-6 md:space-y-8">
                    {/* Key Skills */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">Key Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {limitArrayLength(analyzeMutation.data.identifiedSkills).map((skill, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 transition-colors"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Suggested Improvements */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">Suggested Improvements</h3>
                      <ul className="space-y-2 md:space-y-3">
                        {limitArrayLength(analyzeMutation.data.suggestedImprovements).map((improvement, index) => {
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
                      </ul>
                    </div>

                    {/* General Feedback */}
                    <div>
                      <h3 className="text-lg font-medium mb-3">General Feedback</h3>
                      <p className="text-sm md:text-base text-gray-600 bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-100">
                        {analyzeMutation.data.generalFeedback}
                      </p>
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