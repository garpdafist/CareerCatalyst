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
import { Brain, CheckCircle, ListChecks, Tags } from "lucide-react";

export default function ResumeAnalyzer() {
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/resume-analyze", { content });
      return res.json() as Promise<ResumeAnalysis>;
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to analyze resume. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please paste your resume content",
        variant: "destructive",
      });
      return;
    }
    analyzeMutation.mutate(content);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI Resume Analyzer</h1>
        <p className="mt-2 text-muted-foreground">
          Paste your resume content below and our AI will analyze it for improvements
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                  <span>{analyzeMutation.data.score}/100</span>
                </div>
                <Progress value={analyzeMutation.data.score} />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Identified Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analyzeMutation.data.skills?.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    )) ?? <span className="text-sm text-muted-foreground">No skills identified</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <Tags className="h-5 w-5" />
                    Important Keywords
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analyzeMutation.data.keywords?.map((keyword, index) => (
                      <Badge key={index} variant="outline">
                        {keyword}
                      </Badge>
                    )) ?? <span className="text-sm text-muted-foreground">No keywords found</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <ListChecks className="h-5 w-5" />
                    Suggested Improvements
                  </h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {analyzeMutation.data.improvements?.map((improvement, index) => (
                      <li key={index} className="text-sm">{improvement}</li>
                    )) ?? <li className="text-sm text-muted-foreground">No specific improvements suggested</li>}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    General Feedback
                  </h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {analyzeMutation.data.feedback?.map((feedback, index) => (
                      <li key={index} className="text-sm">{feedback}</li>
                    )) ?? <li className="text-sm text-muted-foreground">No general feedback available</li>}
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