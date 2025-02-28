import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Trophy,
  Sparkles,
  ArrowRight,
  Loader2,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type JobExperience = {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  achievements: string;
};

const tooltips = {
  jobTitle: "Use a clear, industry-standard title (e.g., 'Senior Marketing Manager' rather than 'Marketing Ninja')",
  companyName: "Include the official company name, avoiding abbreviations unless widely recognized",
  startDate: "Format: MM/YYYY",
  endDate: "Use 'Present' for current role",
  achievements: "Use action verbs and include metrics/numbers. Example: 'Increased sales by 25% through digital marketing initiatives'"
};

const jobFieldBestPractices = [
  "Start with strong action verbs (Led, Developed, Implemented)",
  "Include at least one metric or data point per bullet",
  "Focus on achievements rather than duties",
  "Keep bullet points concise and impactful",
  "Highlight leadership and scope when applicable"
];

export default function LinkedInOptimizer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentJob, setCurrentJob] = useState<JobExperience>({
    jobTitle: "",
    companyName: "",
    startDate: "",
    endDate: "",
    achievements: ""
  });
  const [previousJob, setPreviousJob] = useState<JobExperience>({
    jobTitle: "",
    companyName: "",
    startDate: "",
    endDate: "",
    achievements: ""
  });
  const [activeTab, setActiveTab] = useState("current");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const { toast } = useToast();

  const handleAnalyzeContent = async () => {
    if (!currentJob.jobTitle || !currentJob.achievements) {
      toast({
        title: "Error",
        description: "Please fill in at least the current job details",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze-linkedin-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sections: [
            {
              id: "currentJob",
              content: JSON.stringify(currentJob)
            },
            {
              id: "previousJob",
              content: JSON.stringify(previousJob)
            }
          ]
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze content");
      }

      const analysis = await response.json();
      setAiSuggestions(analysis.experienceSuggestions || []);

      toast({
        title: "Success",
        description: "Your experience has been analyzed successfully!",
      });
    } catch (error) {
      console.error("Content analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze your experience. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const JobForm = ({ isCurrentJob }: { isCurrentJob: boolean }) => {
    const job = isCurrentJob ? currentJob : previousJob;
    const setJob = isCurrentJob ? setCurrentJob : setPreviousJob;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Job Title</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltips.jobTitle}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              value={job.jobTitle}
              onChange={(e) => setJob({ ...job, jobTitle: e.target.value })}
              placeholder="e.g., Senior Marketing Manager"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Company Name</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltips.companyName}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              value={job.companyName}
              onChange={(e) => setJob({ ...job, companyName: e.target.value })}
              placeholder="e.g., Acme Corporation"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Start Date</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltips.startDate}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              value={job.startDate}
              onChange={(e) => setJob({ ...job, startDate: e.target.value })}
              placeholder="MM/YYYY"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">End Date</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltips.endDate}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              value={job.endDate}
              onChange={(e) => setJob({ ...job, endDate: e.target.value })}
              placeholder={isCurrentJob ? "Present" : "MM/YYYY"}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Key Achievements (2-3 bullet points)</label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{tooltips.achievements}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <RichTextEditor
            value={job.achievements}
            onChange={(value) => setJob({ ...job, achievements: value })}
            placeholder="• Increased sales by 25% through implementing new digital marketing strategies
• Led a team of 5 marketing specialists, achieving 40% improvement in campaign ROI
• Developed and executed content strategy resulting in 2M+ impressions"
            className="min-h-[200px]"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">LinkedIn Experience Optimizer</h1>
        <p className="text-muted-foreground mt-2">
          Add your last two jobs to receive AI-powered suggestions for optimizing your experience section
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Best Practices for Job Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {jobFieldBestPractices.map((practice, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-1" />
                <span>{practice}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="current" className="flex-1">Current Role</TabsTrigger>
          <TabsTrigger value="previous" className="flex-1">Previous Role</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <Card>
            <CardHeader>
              <CardTitle>Current Role</CardTitle>
            </CardHeader>
            <CardContent>
              <JobForm isCurrentJob={true} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="previous">
          <Card>
            <CardHeader>
              <CardTitle>Previous Role</CardTitle>
            </CardHeader>
            <CardContent>
              <JobForm isCurrentJob={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={handleAnalyzeContent}
          disabled={isAnalyzing}
          className="min-w-[120px]"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Analyze Experience"
          )}
        </Button>
      </div>

      {aiSuggestions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {aiSuggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-1" />
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}