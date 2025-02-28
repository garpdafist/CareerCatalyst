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

type ProfileData = {
  headline: string;
  about: string;
  currentJob: JobExperience;
  previousJob: JobExperience;
};

type JobExperience = {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  achievements: string;
};

const tooltips = {
  headline: "Keep under 220 characters, include your role, industry, and key specializations",
  about: "Tell your professional story, highlight achievements, and include a clear call to action",
  jobTitle: "Use a clear, industry-standard title (e.g., 'Senior Marketing Manager' rather than 'Marketing Ninja')",
  companyName: "Include the official company name, avoiding abbreviations unless widely recognized",
  startDate: "Format: MM/YYYY",
  endDate: "Use 'Present' for current role",
  achievements: "Use action verbs and include metrics/numbers. Example: 'Increased sales by 25% through digital marketing initiatives'"
};

const bestPractices = {
  headline: [
    "Include your current role and industry",
    "Add 2-3 key specializations",
    "Use industry-relevant keywords",
    "Keep it under 220 characters",
    "Avoid buzzwords like 'guru' or 'ninja'"
  ],
  about: [
    "Start with a compelling hook",
    "Include key achievements with metrics",
    "Describe your unique value proposition",
    "Add a clear call to action",
    "Use industry-specific keywords",
    "Break text into short paragraphs"
  ],
  experience: [
    "Start with strong action verbs (Led, Developed, Implemented)",
    "Include at least one metric or data point per bullet",
    "Focus on achievements rather than duties",
    "Keep bullet points concise and impactful",
    "Highlight leadership and scope when applicable"
  ]
};

export default function LinkedInOptimizer() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("headline");
  const [profileData, setProfileData] = useState<ProfileData>({
    headline: "",
    about: "",
    currentJob: {
      jobTitle: "",
      companyName: "",
      startDate: "",
      endDate: "",
      achievements: ""
    },
    previousJob: {
      jobTitle: "",
      companyName: "",
      startDate: "",
      endDate: "",
      achievements: ""
    }
  });
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const { toast } = useToast();

  const handleAnalyzeContent = async () => {
    if (!profileData.headline.trim() && !profileData.about.trim() && !profileData.currentJob.jobTitle) {
      toast({
        title: "Error",
        description: "Please fill in at least one section before analyzing",
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
            { id: "headline", content: profileData.headline },
            { id: "about", content: profileData.about },
            { id: "currentJob", content: JSON.stringify(profileData.currentJob) },
            { id: "previousJob", content: JSON.stringify(profileData.previousJob) }
          ]
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze content");
      }

      const analysis = await response.json();
      setSuggestions(analysis);

      toast({
        title: "Success",
        description: "Your LinkedIn profile has been analyzed successfully!",
      });
    } catch (error) {
      console.error("Content analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze your profile content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const JobForm = ({ isCurrentJob }: { isCurrentJob: boolean }) => {
    const job = isCurrentJob ? profileData.currentJob : profileData.previousJob;
    const setJob = (newJob: JobExperience) => {
      setProfileData(prev => ({
        ...prev,
        [isCurrentJob ? 'currentJob' : 'previousJob']: newJob
      }));
    };

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
        <h1 className="text-3xl font-bold">LinkedIn Profile Optimizer</h1>
        <p className="text-muted-foreground mt-2">
          Enhance your professional presence with AI-powered optimization
        </p>
      </div>

      <div className="mb-6 flex justify-end">
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
            "Analyze Profile"
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="headline" className="flex-1">Headline</TabsTrigger>
          <TabsTrigger value="about" className="flex-1">About</TabsTrigger>
          <TabsTrigger value="current" className="flex-1">Current Role</TabsTrigger>
          <TabsTrigger value="previous" className="flex-1">Previous Role</TabsTrigger>
        </TabsList>

        <TabsContent value="headline">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Professional Headline
                <span className="text-sm text-muted-foreground">
                  {profileData.headline.length}/220 characters
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>{tooltips.headline}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      value={profileData.headline}
                      onChange={(e) => setProfileData({ ...profileData, headline: e.target.value })}
                      placeholder="Marketing Director | Digital Growth Strategy | Performance Marketing | B2B SaaS Expert"
                      maxLength={220}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      Best Practices
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {bestPractices.headline.map((practice, i) => (
                        <li key={i} className="flex items-start gap-2 text-muted-foreground">
                          <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {practice}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {suggestions.headlineSuggestions && suggestions.headlineSuggestions.length > 0 && (
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                        <Sparkles className="h-4 w-4" />
                        AI Suggestions
                      </h4>
                      <ul className="space-y-2 text-sm">
                        {suggestions.headlineSuggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-start gap-2 text-muted-foreground">
                            <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                About Section
                <span className="text-sm text-muted-foreground">
                  {profileData.about.length}/2600 characters
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>{tooltips.about}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <RichTextEditor
                      value={profileData.about}
                      onChange={(value) => setProfileData({ ...profileData, about: value })}
                      placeholder="Driving digital transformation through data-driven marketing strategies. As a Marketing Director with 8+ years of experience, I've helped B2B SaaS companies achieve measurable results..."
                      className="min-h-[200px]"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      Best Practices
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {bestPractices.about.map((practice, i) => (
                        <li key={i} className="flex items-start gap-2 text-muted-foreground">
                          <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {practice}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {suggestions.aboutSuggestions && suggestions.aboutSuggestions.length > 0 && (
                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                        <Sparkles className="h-4 w-4" />
                        AI Suggestions
                      </h4>
                      <ul className="space-y-2 text-sm">
                        {suggestions.aboutSuggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-start gap-2 text-muted-foreground">
                            <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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

      {suggestions.experienceSuggestions && suggestions.experienceSuggestions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Experience Optimization Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suggestions.experienceSuggestions.map((suggestion, index) => (
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