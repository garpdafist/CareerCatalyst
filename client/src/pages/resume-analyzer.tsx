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

export default function ResumeAnalyzer() {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (data: { content: string } | FormData) => {
      if (!data) {
        throw new Error("Resume content is required");
      }

      // Don't set Content-Type for FormData, browser will set it automatically with boundary
      const headers: Record<string, string> = {
        Authorization: "Bearer mock-token-for-testing"
      };

      const res = await apiRequest("POST", "/api/resume-analyze", data, { headers });
      return res.json() as Promise<ResumeAnalysis>;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to analyze resume. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (file: File) => {
    if (!file) {
      console.error("No file selected");
      return;
    }

    // Detailed file logging
    console.log("File selected:", {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    });

    setFile(file);
    // Reset content when file is selected
    setContent("");
  };

  const handleSubmit = () => {
    if (file) {
      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', file);

      // Log FormData details
      console.log("Submitting FormData:", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        isFormData: formData instanceof FormData,
        formDataEntries: Array.from(formData.entries()).map(([key]) => key)
      });

      analyzeMutation.mutate(formData);
    } else if (content.trim()) {
      analyzeMutation.mutate({ content });
    } else {
      toast({
        title: "Error",
        description: "Please provide a resume file or text content",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
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

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
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
              type="button" 
              onClick={handleSubmit}
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
                    <div className="text-right">
                      <div className="text-sm font-medium text-muted-foreground">Resume Score</div>
                      <div className="text-2xl font-bold text-primary">{analyzeMutation.data.score}/100</div>
                    </div>
                  </div>

                  <Progress value={analyzeMutation.data.score || 0} className="h-2" />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium flex items-center gap-2 mb-3">
                          <ListChecks className="h-5 w-5 text-primary" />
                          Identified Skills
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {analyzeMutation.data?.skills?.map((skill, index) => (
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
                          {analyzeMutation.data?.keywords?.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="border-border/40">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium flex items-center gap-2 mb-3">
                          <ListChecks className="h-5 w-5 text-primary" />
                          Suggested Improvements
                        </h3>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {analyzeMutation.data?.improvements?.map((improvement, index) => (
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
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {analyzeMutation.data?.feedback?.map((feedback, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary mt-1">•</span>
                              {feedback}
                            </li>
                          ))}
                        </ul>
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
      </div>
    </div>
  );
}