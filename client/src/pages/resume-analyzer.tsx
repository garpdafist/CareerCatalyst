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
import { Brain, FileText, ListChecks, Tags, Upload, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { AnimatedProgressPath } from "@/components/ui/animated-progress-path";

// Helper to ensure arrays have a maximum length
const limitArrayLength = (arr: string[] | null | undefined, maxLength: number = 10): string[] => {
  if (!arr) return [];
  return arr.slice(0, maxLength);
};

// Add sample data for testing UI
const sampleAnalysis: ResumeAnalysis = {
  score: 85,
  scores: {
    keywordsRelevance: {
      score: 8,
      maxScore: 10,
      feedback: "Good use of industry-specific keywords",
      keywords: ["project management", "agile", "stakeholder management"]
    },
    achievementsMetrics: {
      score: 9,
      maxScore: 10,
      feedback: "Strong quantifiable achievements",
      highlights: ["Increased revenue by 25%", "Led team of 10"]
    },
    structureReadability: {
      score: 8,
      maxScore: 10,
      feedback: "Clear and well-organized structure"
    },
    summaryClarity: {
      score: 9,
      maxScore: 10,
      feedback: "Compelling professional summary"
    },
    overallPolish: {
      score: 8,
      maxScore: 10,
      feedback: "Professional tone and presentation"
    }
  },
  resumeSections: {
    professionalSummary: "Experienced project manager with proven track record...",
    workExperience: "Senior Project Manager | ABC Corp\n- Led cross-functional teams...",
    technicalSkills: "Project Management: Jira, Confluence\nTechnical: Agile, Scrum",
    education: "MBA, Business Administration | XYZ University",
    keyAchievements: "- Successfully delivered $2M project under budget\n- Improved team efficiency by 30%"
  },
  identifiedSkills: ["Project Management", "Agile", "Scrum", "Leadership", "Stakeholder Management"],
  importantKeywords: ["ROI", "KPI", "Agile", "Digital Transformation", "Change Management"],
  suggestedImprovements: [
    "Add more specific metrics to achievements",
    "Include relevant certifications",
    "Highlight technical tools used in projects"
  ],
  generalFeedback: "Strong resume with clear achievements. Consider adding more technical details and certifications to strengthen your profile."
};

export default function ResumeAnalyzer() {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (data: { content: string } | FormData) => {
      setAnalysisProgress(0);

      if (!data) {
        throw new Error("Resume content is required");
      }

      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      try {
        const headers: Record<string, string> = {
          Authorization: "Bearer mock-token-for-testing"
        };

        const res = await apiRequest("POST", "/api/resume-analyze", data, { headers });
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        const jsonData = await res.json() as ResumeAnalysis;
        return jsonData;
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
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setRetryCount(prev => prev + 1);
              handleSubmit();
            }}
          >
            Retry
          </Button>
        ),
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

  // Test UI with sample data
  const testUI = () => {
    setAnalysisProgress(100);
    analyzeMutation.data = sampleAnalysis;
  };

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-accent mb-4">
              Resume Analyzer
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get instant AI-powered analysis and optimization suggestions for your resume
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {analyzeMutation.isPending && (
            <Card className="border-border/20">
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

          <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
            <Card className="border-border/20">
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
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/80">
                        Paste your resume content below
                      </label>
                      <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="h-64 bg-background/50 border-border/20"
                        placeholder="Paste your resume here..."
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="upload">
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-border/30 rounded-lg p-8 text-center transition-colors hover:border-primary/40">
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
                            className="mx-auto max-w-xs bg-background/50 border-border/20"
                          />
                        </div>
                      </div>
                      {file && (
                        <p className="text-sm text-muted-foreground text-center">
                          File loaded: {file.name}
                        </p>
                      )}
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
                <>
                  <span className="mr-2">Analyzing...</span>
                  <span className="animate-spin">⚪</span>
                </>
              ) : (
                "Analyze Resume"
              )}
            </Button>
          </form>

          {analyzeMutation.data && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-8 space-y-6"
            >
              <Card className="border-border/20">
                <CardContent className="space-y-6 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-6 w-6 text-primary" />
                      <h2 className="text-xl font-semibold text-foreground">Analysis Results</h2>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div className="text-2xl font-bold text-primary flex items-center">
                        {analyzeMutation.data.score}/100
                        <Star className="h-4 w-4 ml-1 fill-current" />
                      </div>
                    </div>
                  </div>

                  <Progress value={analyzeMutation.data.score || 0} className="h-2" />

                  {/* Detailed Scores */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {analyzeMutation.data.scores && Object.entries(analyzeMutation.data.scores).map(([key, score]) => (
                      <div key={key} className="bg-muted/50 rounded-lg p-4">
                        <h3 className="font-medium mb-2 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </h3>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">
                            {score.score}/{score.maxScore}
                          </span>
                        </div>
                        <Progress
                          value={(score.score / score.maxScore) * 100}
                          className="h-1"
                        />
                        <p className="text-sm mt-2 text-muted-foreground">
                          {score.feedback}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Skills and Keywords */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium flex items-center gap-2 mb-3">
                          <ListChecks className="h-5 w-5 text-primary" />
                          Identified Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {limitArrayLength(analyzeMutation.data.identifiedSkills).map((skill, index) => (
                            <Badge key={index} variant="secondary" className="bg-primary/10 text-primary border-0">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium flex items-center gap-2 mb-3">
                          <Tags className="h-5 w-5 text-primary" />
                          Important Keywords
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {limitArrayLength(analyzeMutation.data.importantKeywords).map((keyword, index) => (
                            <Badge key={index} variant="outline" className="border-border/40">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Improvements and Feedback */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium flex items-center gap-2 mb-3">
                          <ListChecks className="h-5 w-5 text-primary" />
                          Suggested Improvements
                        </h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {limitArrayLength(analyzeMutation.data.suggestedImprovements).map((improvement, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              {improvement}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-medium flex items-center gap-2 mb-3">
                          <Brain className="h-5 w-5 text-primary" />
                          General Feedback
                        </h3>
                        <div className="text-sm text-muted-foreground">
                          {analyzeMutation.data.generalFeedback}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-border/20">
                    <Button
                      onClick={() => {
                        localStorage.setItem('resumeAnalysis', JSON.stringify(analyzeMutation.data));
                        window.location.href = '/resume-editor';
                      }}
                      size="lg"
                      className="w-full bg-primary/90 hover:bg-primary text-white"
                    >
                      Edit Resume with Suggestions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* Add test button during development */}
        {process.env.NODE_ENV === 'development' && (
          <Button onClick={testUI} className="mb-4">
            Test UI with Sample Data
          </Button>
        )}
      </div>
    </div>
  );
}