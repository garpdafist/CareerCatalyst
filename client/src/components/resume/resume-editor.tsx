import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ResumeAnalysis } from "@shared/schema";

// Define resume section structure
type ResumeSection = {
  id: string;
  title: string;
  content: string;
  suggestions: string[];
  keywords?: string[];
};

// Standard ATS-friendly sections
const initialSections: ResumeSection[] = [
  { 
    id: "summary", 
    title: "Professional Summary", 
    content: "",
    suggestions: ["Keep your summary concise and impactful", "Highlight your key achievements"],
  },
  { 
    id: "experience", 
    title: "Work Experience", 
    content: "",
    suggestions: ["Use action verbs to start bullet points", "Include measurable achievements"],
  },
  { 
    id: "skills", 
    title: "Technical Skills", 
    content: "",
    suggestions: ["Group skills by category", "Prioritize skills mentioned in job descriptions"],
  },
  { 
    id: "education", 
    title: "Education", 
    content: "",
    suggestions: ["List degrees in reverse chronological order", "Include relevant coursework"],
  },
  { 
    id: "certifications", 
    title: "Certifications", 
    content: "",
    suggestions: ["Include expiration dates if applicable", "Highlight industry-recognized certifications"],
  },
];

export default function ResumeEditor() {
  const [sections, setSections] = useState(initialSections);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

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
              keywords: parsedAnalysis.skills
            };
          case "summary":
            return {
              ...section,
              suggestions: [
                ...section.suggestions,
                ...sectionSuggestions,
                "Include years of experience",
                "Highlight key achievements"
              ]
            };
          default:
            return {
              ...section,
              suggestions: [...section.suggestions, ...sectionSuggestions],
              keywords: relevantKeywords
            };
        }
      }));
    }
  }, []);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSections(items);
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

      {analysis && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Resume Score: {analysis.score}/100. 
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
                      className="border"
                    >
                      <CardHeader className="flex flex-row items-center gap-4 py-3">
                        <div
                          {...provided.dragHandleProps}
                          className="cursor-grab"
                        >
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <Textarea
                              value={section.content}
                              onChange={(e) => {
                                const newSections = [...sections];
                                newSections[index].content = e.target.value;
                                setSections(newSections);
                              }}
                              placeholder={`Add your ${section.title.toLowerCase()} here...`}
                              className="min-h-[200px] mb-2"
                            />
                          </div>
                          <div className="space-y-4">
                            <div className="bg-muted/50 rounded-lg p-4">
                              <h4 className="font-medium mb-2">📝 Suggestions</h4>
                              <ul className="space-y-2 text-sm text-muted-foreground">
                                {section.suggestions.map((suggestion, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    {suggestion}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {section.keywords && section.keywords.length > 0 && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <h4 className="font-medium mb-2">🎯 Keywords</h4>
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