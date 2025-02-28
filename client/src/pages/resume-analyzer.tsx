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

      // If data is FormData (file upload), don't set Content-Type
      // Let the browser set it with the boundary
      if (!(data instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      console.log('Sending resume for analysis:', 
        data instanceof FormData ? 
        { type: 'file', fileName: file?.name } : 
        { type: 'text', length: (data as {content: string}).content.length }
      );

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
      console.log('Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      const formData = new FormData();
      formData.append('file', file); // Make sure this matches the field name expected by multer
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

    console.log('Form submission:', {
      hasFile: !!file,
      hasContent: !!content.trim(),
      contentLength: content.length
    });

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI Resume Analyzer</h1>
        <p className="mt-2 text-muted-foreground">
          Upload your resume or paste its content below for AI-powered analysis
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue="paste" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">Paste Content</TabsTrigger>
            <TabsTrigger value="upload">Upload File</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Paste your resume content below
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-64"
                placeholder="Paste your resume here..."
              />
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Upload your resume file
              </label>
              <div className="grid w-full gap-4">
                <div className="border rounded-lg p-8 text-center space-y-4">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Upload your resume in TXT, DOC, DOCX, or PDF format
                    </p>
                    <Input
                      type="file"
                      accept=".txt,.doc,.docx,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          console.log('Selected file:', {
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            lastModified: new Date(file.lastModified).toISOString()
                          });
                          handleFileUpload(file);
                        }
                      }}
                      className="mx-auto max-w-xs"
                    />
                  </div>
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    File loaded: {file.name}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          type="submit"
          disabled={analyzeMutation.isPending}
          className="w-full"
        >
          {analyzeMutation.isPending ? "Analyzing..." : "Analyze Resume"}
        </Button>
      </form>

      {analyzeMutation.data && (
        <div className="mt-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-6 w-6" />
                Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Resume Score</span>
                  <span>{analyzeMutation.data.score || 0}/100</span>
                </div>
                <Progress value={analyzeMutation.data.score || 0} />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Identified Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analyzeMutation.data?.skills?.length > 0 ? (
                      analyzeMutation.data.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No skills identified</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <Tags className="h-5 w-5" />
                    Important Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analyzeMutation.data?.keywords?.length > 0 ? (
                      analyzeMutation.data.keywords.map((keyword, index) => (
                        <Badge key={index} variant="outline">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No keywords found</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    Suggested Improvements
                  </h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {analyzeMutation.data?.improvements?.length > 0 ? (
                      analyzeMutation.data.improvements.map((improvement, index) => (
                        <li key={index} className="text-sm">{improvement}</li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">No specific improvements suggested</li>
                    )}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    General Feedback
                  </h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {analyzeMutation.data?.feedback?.length > 0 ? (
                      analyzeMutation.data.feedback.map((feedback, index) => (
                        <li key={index} className="text-sm">{feedback}</li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">No general feedback available</li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}