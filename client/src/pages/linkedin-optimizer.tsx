import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Trophy, Sparkles, ArrowRight, Loader2 } from "lucide-react";

// Define profile section structure
type ProfileSection = {
  id: string;
  title: string;
  content: string;
  bestPractices: string[];
  score: number;
  placeholder: string;
  characterLimit?: number;
  aiSuggestions?: string[];
};

export default function LinkedInOptimizer() {
  const [profileUrl, setProfileUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sections, setSections] = useState<ProfileSection[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [activeSection, setActiveSection] = useState<string>("headline");
  const { toast } = useToast();

  // Calculate scores based on content analysis
  const calculateSectionScore = (content: string, section: ProfileSection): number => {
    let score = 0;
    const text = content.toLowerCase();

    // Basic scoring criteria
    if (content.length > 0) score += 20;
    if (content.length > 100) score += 10;

    // Check for metrics and numbers
    if (/\d+%|\$\d+|\d+x/i.test(text)) score += 20;

    // Check for action verbs
    if (/led|managed|developed|implemented|created|launched|achieved/i.test(text)) score += 15;

    // Check for industry keywords
    if (/marketing|strategy|growth|analytics|optimization|leadership/i.test(text)) score += 15;

    // Character limit compliance
    if (section.characterLimit && content.length <= section.characterLimit) score += 20;

    return Math.min(100, score);
  };

  // Update scores when content changes
  useEffect(() => {
    if (sections.length > 0) {
      const updatedSections = sections.map(section => ({
        ...section,
        score: calculateSectionScore(section.content, section)
      }));

      setSections(updatedSections);

      // Calculate overall profile score
      const totalScore = updatedSections.reduce((acc, section) => acc + section.score, 0);
      setOverallScore(Math.round(totalScore / updatedSections.length));
    }
  }, [sections]);

  const handleAnalyzeProfile = async () => {
    if (!profileUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter your LinkedIn profile URL",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze-linkedin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze profile");
      }

      const analysis = await response.json();

      // Update sections with AI analysis
      setSections([
        {
          id: "headline",
          title: "Professional Headline",
          content: analysis.headline || "",
          bestPractices: [
            "Include your current role and industry",
            "Add 2-3 key specializations",
            "Use industry-relevant keywords",
            "Keep it under 220 characters",
            "Avoid buzzwords like 'guru' or 'ninja'"
          ],
          score: 0,
          placeholder: "Marketing Director | Digital Growth Strategy | Performance Marketing | B2B SaaS Expert",
          characterLimit: 220,
          aiSuggestions: analysis.headlineSuggestions || [],
        },
        {
          id: "about",
          title: "About Section",
          content: analysis.about || "",
          bestPractices: [
            "Start with a compelling hook",
            "Include key achievements with metrics",
            "Describe your unique value proposition",
            "Add a clear call to action",
            "Use industry-specific keywords",
            "Break text into short paragraphs"
          ],
          score: 0,
          placeholder: "Driving digital transformation through data-driven marketing strategies...",
          characterLimit: 2600,
          aiSuggestions: analysis.aboutSuggestions || [],
        },
        {
          id: "experience",
          title: "Experience",
          content: analysis.experience || "",
          bestPractices: [
            "Lead with impactful achievements",
            "Use metrics and percentages",
            "Include scope of responsibility",
            "Highlight leadership and team size",
            "Mention key tools and technologies",
            "Keep bullets concise and focused"
          ],
          score: 0,
          placeholder: "Marketing Director | CloudTech Solutions\nJan 2022 - Present...",
          aiSuggestions: analysis.experienceSuggestions || [],
        }
      ]);

      toast({
        title: "Success",
        description: "Your LinkedIn profile has been analyzed successfully!",
      });
    } catch (error) {
      console.error("Profile analysis error:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze your LinkedIn profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">LinkedIn Profile Optimizer</h1>
        <p className="text-muted-foreground mt-2">
          Enhance your professional presence with AI-powered optimization
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <Input
                type="url"
                placeholder="Enter your LinkedIn profile URL"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyzeProfile}
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
          </div>
        </CardContent>
      </Card>

      {sections.length > 0 && (
        <>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Profile Strength
                  </h3>
                  <span className="text-sm font-medium">
                    {overallScore}% {overallScore >= 90 ? "✨" : ""}
                  </span>
                </div>
                <Progress value={overallScore} className="h-2" />
                {overallScore < 90 && (
                  <p className="text-sm text-muted-foreground">
                    Improve your profile score by following the AI suggestions and best practices
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeSection} onValueChange={setActiveSection}>
            <TabsList className="w-full">
              {sections.map((section) => (
                <TabsTrigger key={section.id} value={section.id} className="flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <span>{section.title}</span>
                    <Badge variant={section.score >= 90 ? "default" : "secondary"}>
                      {section.score}%
                    </Badge>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((section) => (
              <TabsContent key={section.id} value={section.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {section.title}
                      {section.characterLimit && (
                        <span className="text-sm text-muted-foreground">
                          {section.content.length}/{section.characterLimit} characters
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2">
                        <RichTextEditor
                          value={section.content}
                          onChange={(value) => {
                            const newSections = sections.map(s =>
                              s.id === section.id ? { ...s, content: value } : s
                            );
                            setSections(newSections);
                          }}
                          placeholder={section.placeholder}
                          className="min-h-[200px]"
                        />
                      </div>
                      <div className="space-y-4">
                        {section.aiSuggestions && section.aiSuggestions.length > 0 && (
                          <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                            <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                              <Sparkles className="h-4 w-4" />
                              AI Suggestions
                            </h4>
                            <ul className="space-y-2 text-sm">
                              {section.aiSuggestions.map((suggestion, i) => (
                                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                                  <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                            <Sparkles className="h-4 w-4" />
                            Best Practices
                          </h4>
                          <ul className="space-y-2 text-sm">
                            {section.bestPractices.map((practice, i) => (
                              <li key={i} className="flex items-start gap-2 text-muted-foreground">
                                <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                {practice}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}