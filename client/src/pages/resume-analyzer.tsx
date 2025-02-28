import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAnalysis } from "@shared/schema";

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
      <h1 className="text-3xl font-bold mb-8">Resume Analyzer</h1>
      
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
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Resume Score</span>
                <span>{analyzeMutation.data.score}/100</span>
              </div>
              <Progress value={analyzeMutation.data.score} />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium">Feedback</h3>
              <ul className="list-disc pl-5 space-y-1">
                {analyzeMutation.data.feedback.map((item, index) => (
                  <li key={index} className="text-sm">{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
