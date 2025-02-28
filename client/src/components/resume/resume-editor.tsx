import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GripVertical, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ResumeAnalysis } from "@shared/schema";

// Define resume section structure
type ResumeSection = {
  id: string;
  title: string;
  content: string;
  suggestion?: string;
};

// Standard ATS-friendly sections
const initialSections: ResumeSection[] = [
  { id: "summary", title: "Professional Summary", content: "" },
  { id: "experience", title: "Work Experience", content: "" },
  { id: "skills", title: "Technical Skills", content: "" },
  { id: "education", title: "Education", content: "" },
  { id: "certifications", title: "Certifications", content: "" },
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
        if (section.id === "skills" && parsedAnalysis.skills?.length > 0) {
          return {
            ...section,
            content: parsedAnalysis.skills.join(", "),
            suggestion: "Consider organizing skills by category and highlighting those most relevant to your target role."
          };
        }
        if (section.id === "summary") {
          return {
            ...section,
            suggestion: "Include your years of experience, key achievements, and target role objectives."
          };
        }
        return section;
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Resume Editor</h2>
        <p className="text-muted-foreground">
          Drag sections to reorder. Click to edit content. Follow ATS suggestions for better results.
        </p>
      </div>

      {analysis && (
        <Alert className="mb-6">
          <AlertDescription>
            Resume Score: {analysis.score}/100. 
            {analysis.improvements && analysis.improvements[0]}
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
                        <Textarea
                          value={section.content}
                          onChange={(e) => {
                            const newSections = [...sections];
                            newSections[index].content = e.target.value;
                            setSections(newSections);
                          }}
                          placeholder={`Add your ${section.title.toLowerCase()} here...`}
                          className="min-h-[100px] mb-2"
                        />
                        {section.suggestion && (
                          <p className="text-sm text-muted-foreground mt-2">
                            💡 Tip: {section.suggestion}
                          </p>
                        )}
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