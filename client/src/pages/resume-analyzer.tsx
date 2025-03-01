import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";
import { Brain, CheckCircle, ListChecks, Tags, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { PageLayout, PageHeader, PageTitle, PageDescription } from "@/components/layout";

export default function ResumeAnalyzer() {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (data: { content: string } | FormData) => {
      if (!data) {
        throw new Error("Resume content is required");
      }

      const headers: Record<string, string> = {
        Authorization: "Bearer mock-token-for-testing"
      };

      if (!(data instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

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

  const handleFileUpload = async (file: File) => {
    try {
      setFile(file);
      const formData = new FormData();
      formData.append('file', file);
      analyzeMutation.mutate(formData);
    } catch (error) {
      console.error('File handling error:', error);
      toast({
        title: "Error",
        description: "Failed to process file. Please try a different file or paste the content directly.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && !file) {
      toast({
        title: "Error",
        description: "Please paste your resume content or upload a file",
        variant: "destructive",
      });
      return;
    }

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      analyzeMutation.mutate(formData);
    } else {
      analyzeMutation.mutate({ content: content.trim() });
    }
  };

  return (
    <PageLayout>
      <PageHeader>
        <PageTitle>AI Resume Analyzer</PageTitle>
        <PageDescription>
          Upload your resume or paste its content below for AI-powered analysis
        </PageDescription>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-border/20">
            <CardContent className="pt-6">
              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="paste">Paste Content</TabsTrigger>
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Paste your resume content below
                    </label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="h-64 bg-background/50 border-white/10"
                      placeholder="Paste your resume here..."
                    />
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">
                      Upload your resume file
                    </label>
                    <div className="grid w-full gap-4">
                      <div className="border border-dashed border-white/20 rounded-lg p-8 text-center space-y-4 transition-colors hover:border-primary/50">
                        <Upload className="mx-auto h-8 w-8 text-white/60" />
                        <div className="space-y-2">
                          <p className="text-sm text-white/60">
                            Upload your resume in TXT, DOC, DOCX, or PDF format
                          </p>
                          <Input
                            type="file"
                            accept=".txt,.doc,.docx,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file);
                            }}
                            className="mx-auto max-w-xs bg-background/50 border-white/10"
                          />
                        </div>
                      </div>
                      {file && (
                        <p className="text-sm text-white/60">
                          File loaded: {file.name}
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={analyzeMutation.isPending}
            className="w-full"
          >
            {analyzeMutation.isPending ? "Analyzing..." : "Analyze Resume"}
          </Button>
        </form>

        {analyzeMutation.data && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 space-y-6"
          >
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white/90">
                  <Brain className="h-6 w-6 text-primary" />
                  Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/80">Resume Score</span>
                    <span className="text-white/90">{analyzeMutation.data.score || 0}/100</span>
                  </div>
                  <Progress value={analyzeMutation.data.score || 0} className="h-2" />
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-medium flex items-center gap-2 text-white/90">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Identified Skills
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analyzeMutation.data?.skills?.length > 0 ? (
                        analyzeMutation.data.skills.map((skill, index) => (
                          <Badge key={index} variant="secondary" className="bg-white/5 text-white/80">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-white/60">No skills identified</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium flex items-center gap-2 text-white/90">
                      <Tags className="h-5 w-5 text-primary" />
                      Important Keywords
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analyzeMutation.data?.keywords?.length > 0 ? (
                        analyzeMutation.data.keywords.map((keyword, index) => (
                          <Badge key={index} variant="outline" className="border-white/20 text-white/80">
                            {keyword}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-white/60">No keywords found</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium flex items-center gap-2 text-white/90">
                      <ListChecks className="h-5 w-5 text-primary" />
                      Suggested Improvements
                    </h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {analyzeMutation.data?.improvements?.length > 0 ? (
                        analyzeMutation.data.improvements.map((improvement, index) => (
                          <li key={index} className="text-sm text-white/80">{improvement}</li>
                        ))
                      ) : (
                        <li className="text-sm text-white/60">No specific improvements suggested</li>
                      )}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium flex items-center gap-2 text-white/90">
                      <Brain className="h-5 w-5 text-primary" />
                      General Feedback
                    </h3>
                    <ul className="list-disc pl-5 space-y-1">
                      {analyzeMutation.data?.feedback?.length > 0 ? (
                        analyzeMutation.data.feedback.map((feedback, index) => (
                          <li key={index} className="text-sm text-white/80">{feedback}</li>
                        ))
                      ) : (
                        <li className="text-sm text-white/60">No general feedback available</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={() => {
                      localStorage.setItem('resumeAnalysis', JSON.stringify(analyzeMutation.data));
                      window.location.href = '/resume-editor';
                    }}
                    className="w-full max-w-md bg-primary/90 hover:bg-primary text-white"
                  >
                    Edit Resume with Suggestions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </PageLayout>
  );
}