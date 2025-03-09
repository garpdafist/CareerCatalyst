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
import { Brain, FileText, ListChecks, Tags, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { AnimatedProgressPath } from "@/components/ui/animated-progress-path";

// Helper to ensure arrays have a maximum length
const limitArrayLength = (arr: string[] | null | undefined, maxLength: number = 5): string[] => {
  if (!arr) return [];
  return arr.slice(0, maxLength);
};

export default function ResumeAnalyzer() {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
              Resume Analyzer
            </h1>
            <p className="text-muted-foreground text-lg">
              Get instant AI-powered feedback on your resume
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

          <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
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
                    <div className="space-y-2">
                      <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="h-64"
                        placeholder="Paste your resume here..."
                      />
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
            >
              <Card>
                <CardContent className="space-y-6 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-6 w-6 text-primary" />
                      <h2 className="text-xl font-semibold">Analysis Results</h2>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {analyzeMutation.data.score}/100
                    </div>
                  </div>

                  <Progress value={analyzeMutation.data.score} className="h-2" />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-primary" />
                        Key Skills
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {limitArrayLength(analyzeMutation.data.identifiedSkills).map((skill, index) => (
                          <Badge key={index} variant="secondary" className="bg-primary/10 text-primary">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <Tags className="h-5 w-5 text-primary" />
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
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {analyzeMutation.data.generalFeedback}
                    </p>
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