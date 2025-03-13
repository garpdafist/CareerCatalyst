import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Trophy,
  Sparkles,
  ArrowRight,
  Loader2,
  HelpCircle,
  Briefcase,
  FileText,
  User,
  Link as LinkIcon
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { PageLayout, PageHeader, PageTitle, PageDescription } from "@/components/layout";

type ProfileData = {
  headline: string;
  about: string;
  currentJob: JobExperience;
  previousJob: JobExperience;
  jobDescription?: string; // Added optional job description
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
  achievements: "Use action verbs and include metrics/numbers. Example: 'Increased sales by 25% through digital marketing initiatives'",
  jobDescription: "Optional: Add a target job description to tailor your profile specifically to your desired role"
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

const LinkedInOptimizer = () => {
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
    },
    jobDescription: "" // Initialize optional job description
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
            { id: "previousJob", content: JSON.stringify(profileData.previousJob) },
            { id: "jobDescription", content: profileData.jobDescription } // Include job description in analysis
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
    <PageLayout>
      <PageHeader>
        <PageTitle>LinkedIn Profile Optimizer</PageTitle>
        <PageDescription>
          Transform your professional presence with AI-powered optimization. Get tailored suggestions to make your profile stand out.
        </PageDescription>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        {/* Optional Job Description Input */}
        <Card className="border-2 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Target Job Description (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Textarea
                        value={profileData.jobDescription}
                        onChange={(e) => setProfileData({ ...profileData, jobDescription: e.target.value })}
                        placeholder="Paste a job description here to receive tailored optimization suggestions for your target role..."
                        className="min-h-[100px]"
                      />
                      <HelpCircle className="absolute right-2 top-2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{tooltips.jobDescription}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleAnalyzeContent}
            disabled={isAnalyzing}
            className="min-w-[160px] relative overflow-hidden group"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                Analyze Profile
              </>
            )}
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="w-full grid grid-cols-4 gap-4">
            <TabsTrigger value="headline" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="mr-2 h-4 w-4" />
              Headline
            </TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <User className="mr-2 h-4 w-4" />
              About
            </TabsTrigger>
            <TabsTrigger value="current" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Briefcase className="mr-2 h-4 w-4" />
              Current Role
            </TabsTrigger>
            <TabsTrigger value="previous" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Briefcase className="mr-2 h-4 w-4" />
              Previous Role
            </TabsTrigger>
          </TabsList>

          <TabsContent value="headline">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Professional Headline
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {profileData.headline.length}/220 characters
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative">
                              <Input
                                value={profileData.headline}
                                onChange={(e) => setProfileData({ ...profileData, headline: e.target.value })}
                                placeholder="Marketing Director | Digital Growth Strategy | Performance Marketing | B2B SaaS Expert"
                                maxLength={220}
                                className="pr-8"
                              />
                              <HelpCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{tooltips.headline}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-primary/5 rounded-lg p-4 border border-primary/10 hover:border-primary/20 transition-colors">
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-primary">
                          <Sparkles className="h-4 w-4" />
                          Best Practices
                        </h4>
                        <ul className="space-y-3">
                          {bestPractices.headline.map((practice, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-start gap-2 text-sm"
                            >
                              <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{practice}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                      {suggestions.headlineSuggestions?.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-primary/5 rounded-lg p-4 border border-primary/10 hover:border-primary/20 transition-colors"
                        >
                          <h4 className="font-medium mb-3 flex items-center gap-2 text-primary">
                            <Sparkles className="h-4 w-4" />
                            AI Suggestions
                          </h4>
                          <ul className="space-y-3">
                            {suggestions.headlineSuggestions.map((suggestion, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-start gap-2 text-sm"
                              >
                                <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{suggestion}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="about">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      About Section
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {profileData.about.length}/2600 characters
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative">
                              <RichTextEditor
                                value={profileData.about}
                                onChange={(value) => setProfileData({ ...profileData, about: value })}
                                placeholder="Driving digital transformation through data-driven marketing strategies. As a Marketing Director with 8+ years of experience, I've helped B2B SaaS companies achieve measurable results..."
                                className="min-h-[200px] pr-8"
                              />
                              <HelpCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{tooltips.about}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-primary/5 rounded-lg p-4 border border-primary/10 hover:border-primary/20 transition-colors">
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-primary">
                          <Sparkles className="h-4 w-4" />
                          Best Practices
                        </h4>
                        <ul className="space-y-3">
                          {bestPractices.about.map((practice, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-start gap-2 text-sm"
                            >
                              <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{practice}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                      {suggestions.aboutSuggestions?.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-primary/5 rounded-lg p-4 border border-primary/10 hover:border-primary/20 transition-colors"
                        >
                          <h4 className="font-medium mb-3 flex items-center gap-2 text-primary">
                            <Sparkles className="h-4 w-4" />
                            AI Suggestions
                          </h4>
                          <ul className="space-y-3">
                            {suggestions.aboutSuggestions.map((suggestion, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-start gap-2 text-sm"
                              >
                                <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <span className="text-muted-foreground">{suggestion}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="current">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Current Role
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <JobForm isCurrentJob={true} />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="previous">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Previous Role
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <JobForm isCurrentJob={false} />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {suggestions.experienceSuggestions?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Experience Optimization Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {suggestions.experienceSuggestions.map((suggestion, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-1" />
                      <span className="text-muted-foreground">{suggestion}</span>
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </PageLayout>
  );
};

export default LinkedInOptimizer;