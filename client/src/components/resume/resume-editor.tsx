import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical, Download, AlertCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { ResumeAnalysis } from "@shared/schema";

// Define resume section structure
type ResumeSection = {
  id: string;
  title: string;
  content: string;
  suggestions: string[];
  keywords?: string[];
  isCollapsed?: boolean;
};

// Standard ATS-friendly sections
const initialSections: ResumeSection[] = [
  { 
    id: "summary", 
    title: "Professional Summary", 
    content: "",
    suggestions: [
      "Keep your summary concise and impactful",
      "Highlight key campaign ROI numbers",
      "Mention brand growth achievements",
      "Include years of marketing experience"
    ],
    isCollapsed: false,
  },
  { 
    id: "experience", 
    title: "Work Experience", 
    content: "",
    suggestions: [
      "Use action verbs like 'Launched', 'Grew', 'Optimized'",
      "Include measurable marketing metrics",
      "Highlight successful campaigns",
      "Quantify audience growth and engagement"
    ],
    isCollapsed: false,
  },
  { 
    id: "skills", 
    title: "Technical Skills", 
    content: "",
    suggestions: [
      "Group skills by marketing categories",
      "Include digital marketing platforms",
      "List analytics tools proficiency",
      "Mention relevant certifications"
    ],
    isCollapsed: false,
  },
  { 
    id: "education", 
    title: "Education", 
    content: "",
    suggestions: [
      "List degrees in reverse chronological order",
      "Include marketing-specific coursework",
      "Highlight relevant projects or thesis",
      "Add marketing certifications"
    ],
    isCollapsed: false,
  },
  { 
    id: "certifications", 
    title: "Certifications", 
    content: "",
    suggestions: [
      "Include Google Analytics certification",
      "Add HubSpot or similar platform certifications",
      "List social media marketing certifications",
      "Mention industry-specific credentials"
    ],
    isCollapsed: false,
  },
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

  // Calculate completion score based on filled sections
  useEffect(() => {
    const filledSections = sections.filter(s => s.content.trim().length > 0).length;
    const newScore = Math.round((filledSections / sections.length) * 100);
    setCompletionScore(newScore);
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
    const resumeContent = sections
      .map(section => `${section.title}\n${section.content}\n\n`)
      .join('');

    // Create and download file
    const blob = new Blob([resumeContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'updated_resume.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Resume Editor</h2>
        <p className="text-muted-foreground">
          Drag sections to reorder. Edit content using the suggestions to improve ATS compatibility.
        </p>
      </div>

      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Resume Completion</h3>
          <span className="text-sm font-medium">{completionScore}%</span>
        </div>
        <Progress value={completionScore} className="h-2" />
      </div>

      {analysis && (
        <Alert className="mb-6 bg-primary/5 border-primary/20">
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
                    <Card
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="border border-muted-foreground/20 hover:border-primary/50 transition-colors"
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
                        <CardTitle className="text-lg flex items-center gap-2">
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
                              <Textarea
                                value={section.content}
                                onChange={(e) => {
                                  const newSections = [...sections];
                                  newSections[index].content = e.target.value;
                                  setSections(newSections);
                                }}
                                placeholder={`Add your ${section.title.toLowerCase()} here...`}
                                className="min-h-[200px] mb-2 resize-y"
                              />
                            </div>
                            <div className="space-y-4">
                              <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                                <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                                  <Sparkles className="h-4 w-4" />
                                  AI Suggestions
                                </h4>
                                <ul className="space-y-2 text-sm">
                                  {section.suggestions.map((suggestion, i) => (
                                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
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
                                    Recommended Keywords
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
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-6">
        <Button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download Updated Resume
        </Button>
      </div>
    </div>
  );
}