import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { GripVertical, Download, AlertCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { ResumeAnalysis } from "@shared/schema";
import { motion } from "framer-motion";
import { PageLayout, PageHeader, PageTitle, PageDescription } from "@/components/layout";

// Define resume section structure
type ResumeSection = {
  id: string;
  title: string;
  content: string;
  suggestions: string[];
  keywords?: string[];
  isCollapsed?: boolean;
  placeholder?: string;
};

// Standard ATS-friendly sections with consulting-style guidance
const initialSections: ResumeSection[] = [
  { 
    id: "summary", 
    title: "Professional Summary", 
    content: "",
    suggestions: [
      "Start with years of marketing experience and key specializations",
      "Include 2-3 quantifiable achievements (e.g., 'Drove 40% YoY growth')",
      "Mention specific marketing tools and platforms mastered",
      "Keep to 2-3 impactful sentences maximum"
    ],
    placeholder: "Marketing professional with X years of experience in [specialization]. Achieved [specific metric]% growth in [key area] through [strategy]. Expert in [tools/platforms] with proven success in [specific achievement with numbers].",
    isCollapsed: false,
  },
  { 
    id: "experience", 
    title: "Work Experience", 
    content: "",
    suggestions: [
      "Start bullets with strong action verbs (Launched, Optimized, Spearheaded)",
      "Include metrics: ROI, CTR, CPC, conversion rates",
      "Quantify team size and budget managed",
      "Show progression: 'Increased engagement by X% YoY'"
    ],
    placeholder: "• Spearheaded digital campaign delivering 45% ROI, reducing CPC from $2.30 to $1.15\n• Led 5-person team to achieve 150% YoY growth in user acquisition\n• Optimized conversion funnel, improving CTR by 60% through A/B testing",
    isCollapsed: false,
  },
  { 
    id: "skills", 
    title: "Technical Skills", 
    content: "",
    suggestions: [
      "Group by category: Analytics, Paid Media, Content, etc.",
      "List tools with proficiency levels",
      "Include relevant marketing certifications",
      "Highlight data analysis capabilities"
    ],
    placeholder: "Analytics: Google Analytics, Firebase, AppsFlyer (Advanced)\nPaid Media: Meta Ads, Google Ads, LinkedIn Ads (Expert)\nTools: HubSpot, Salesforce, Mailchimp (Proficient)\nAnalysis: SQL, Excel, Tableau (Advanced)",
    isCollapsed: false,
  },
  { 
    id: "education", 
    title: "Education", 
    content: "",
    suggestions: [
      "List degrees in reverse chronological order",
      "Include GPA if above 3.5",
      "Highlight marketing coursework and projects",
      "Add relevant honors/awards"
    ],
    placeholder: "MBA, Marketing Analytics (GPA: 3.8)\nUniversity Name, Year\n• Led market research project resulting in 25% improvement in campaign targeting\n• Selected for Marketing Leadership Program (Top 5%)",
    isCollapsed: false,
  },
  { 
    id: "achievements", 
    title: "Key Achievements", 
    content: "",
    suggestions: [
      "List 2-3 most impressive quantifiable wins",
      "Focus on revenue impact and growth metrics",
      "Include awards and recognition",
      "Highlight innovation and leadership"
    ],
    placeholder: "• Youngest marketing manager to achieve $1M+ quarterly revenue\n• Winner, Industry Marketing Excellence Award 2024\n• Patent pending for innovative customer segmentation model",
    isCollapsed: false,
  }
];

export default function ResumeEditor() {
  const [sections, setSections] = useState(initialSections);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [completionScore, setCompletionScore] = useState(0);

  useEffect(() => {
    // Load analysis results from localStorage
    const savedAnalysis = localStorage.getItem('resumeAnalysis');
    if (savedAnalysis) {
      const parsedAnalysis = JSON.parse(savedAnalysis);
      setAnalysis(parsedAnalysis);

      // Update sections with analysis feedback
      setSections(sections.map(section => {
        const sectionSuggestions = [];

        // Add section-specific suggestions from analysis
        if (parsedAnalysis.improvements) {
          sectionSuggestions.push(
            ...parsedAnalysis.improvements.filter(imp => 
              imp.toLowerCase().includes(section.id.toLowerCase())
            )
          );
        }

        // Add keywords relevant to this section
        const relevantKeywords = parsedAnalysis.keywords?.filter(keyword =>
          keyword.toLowerCase().includes(section.id.toLowerCase())
        );

        switch (section.id) {
          case "skills":
            return {
              ...section,
              content: parsedAnalysis.skills?.join(", ") || "",
              suggestions: [
                ...section.suggestions,
                ...sectionSuggestions,
                "Match skills with job requirements",
                "Include both technical and soft skills"
              ],
              keywords: parsedAnalysis.skills,
              isCollapsed: false
            };
          case "summary":
            return {
              ...section,
              suggestions: [
                ...section.suggestions,
                ...sectionSuggestions,
                "Include years of experience",
                "Highlight key achievements"
              ],
              isCollapsed: false
            };
          default:
            return {
              ...section,
              suggestions: [...section.suggestions, ...sectionSuggestions],
              keywords: relevantKeywords,
              isCollapsed: false
            };
        }
      }));
    }
  }, []);

  // Calculate completion score based on filled sections and metrics usage
  useEffect(() => {
    const filledSections = sections.filter(s => s.content.trim().length > 0).length;
    const hasMetrics = sections.some(s => 
      /\d+%|\$\d+|\d+x/i.test(s.content) || // Check for percentages, dollar amounts, or multipliers
      /increased|decreased|improved|reduced/i.test(s.content) // Check for improvement-related words
    );
    const baseScore = (filledSections / sections.length) * 80; // Base score out of 80
    const metricsBonus = hasMetrics ? 20 : 0; // Bonus 20 points for using metrics
    setCompletionScore(Math.round(baseScore + metricsBonus));
  }, [sections]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSections(items);
  };

  const toggleSection = (index: number) => {
    const newSections = [...sections];
    newSections[index].isCollapsed = !newSections[index].isCollapsed;
    setSections(newSections);
  };

  const handleDownload = () => {
    // Create formatted resume content
    const stripHtml = (html: string) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || '';
    };

    const resumeContent = sections
      .map(section => `${section.title.toUpperCase()}\n${stripHtml(section.content)}\n\n`)
      .join('');

    // Create and download file
    const blob = new Blob([resumeContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marketing_resume.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <PageLayout>
      <PageHeader>
        <PageTitle>Resume Editor</PageTitle>
        <PageDescription>
          Follow consulting-style best practices: quantify achievements, use action verbs, and highlight metrics.
        </PageDescription>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        <Card className="border-white/10 bg-card/95 backdrop-blur">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white/90">Resume Quality Score</h3>
                <span className="text-sm font-medium text-white/80">
                  {completionScore}% {completionScore >= 90 ? "✨" : ""}
                </span>
              </div>
              <Progress value={completionScore} className="h-2" />
              {completionScore < 90 && (
                <p className="text-sm text-white/60">
                  Pro tip: Add specific metrics (%, $, growth rates) to improve your score
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {analysis && (
          <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary">
              ATS Score: {analysis.score}/100
              <br />
              Make the suggested improvements to increase your ATS compatibility score.
            </AlertDescription>
          </Alert>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="resume-sections">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {sections.map((section, index) => (
                  <Draggable
                    key={section.id}
                    draggableId={section.id}
                    index={index}
                  >
                    {(provided) => (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      >
                        <Card
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="border-white/10 bg-card/95 backdrop-blur transition-all duration-200 hover:border-primary/20"
                        >
                          <CardHeader 
                            className="flex flex-row items-center gap-4 py-3 cursor-pointer"
                            onClick={() => toggleSection(index)}
                          >
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab hover:text-primary transition-colors"
                              title="Drag to reorder sections"
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-lg flex items-center gap-2 text-white/90">
                              {section.title}
                              {section.isCollapsed ? (
                                <ChevronDown className="h-4 w-4 ml-2" />
                              ) : (
                                <ChevronUp className="h-4 w-4 ml-2" />
                              )}
                            </CardTitle>
                          </CardHeader>
                          {!section.isCollapsed && (
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                  <RichTextEditor
                                    value={section.content}
                                    onChange={(value) => {
                                      const newSections = [...sections];
                                      newSections[index].content = value;
                                      setSections(newSections);
                                    }}
                                    placeholder={section.placeholder}
                                    className="mb-2 bg-background/50 border-white/10"
                                  />
                                </div>
                                <div className="space-y-4">
                                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                                    <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                                      <Sparkles className="h-4 w-4" />
                                      Best Practices
                                    </h4>
                                    <ul className="space-y-2 text-sm">
                                      {section.suggestions.map((suggestion, i) => (
                                        <li key={i} className="flex items-start gap-2 text-white/70">
                                          <span className="text-primary">•</span>
                                          {suggestion}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  {section.keywords && section.keywords.length > 0 && (
                                    <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                                      <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                                        <Sparkles className="h-4 w-4" />
                                        Key Terms to Include
                                      </h4>
                                      <div className="flex flex-wrap gap-2">
                                        {section.keywords.map((keyword, i) => (
                                          <span 
                                            key={i}
                                            className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                                          >
                                            {keyword}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      </motion.div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 bg-primary/90 hover:bg-primary text-white"
          >
            <Download className="h-4 w-4" />
            Download Resume
          </Button>
        </motion.div>
      </motion.div>
    </PageLayout>
  );
}