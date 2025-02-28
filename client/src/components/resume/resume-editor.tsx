import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical } from "lucide-react";

// Define the section type
type ResumeSection = {
  id: string;
  title: string;
  content: string;
};

// Initial sections data
const initialSections: ResumeSection[] = [
  { id: "education", title: "Education", content: "" },
  { id: "experience", title: "Experience", content: "" },
  { id: "skills", title: "Skills", content: "" },
  { id: "summary", title: "Professional Summary", content: "" },
  { id: "projects", title: "Projects", content: "" },
];

export default function ResumeEditor() {
  const [sections, setSections] = useState(initialSections);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSections(items);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Resume Editor</h2>
      <p className="text-muted-foreground mb-6">
        Drag and drop sections to reorder your resume. Click to edit each section.
      </p>

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
                        <div className="min-h-[100px] p-4 rounded-md bg-muted/50">
                          {section.content || `Add your ${section.title.toLowerCase()} details here...`}
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
          onClick={() => console.log("Current section order:", sections)}
          className="w-full"
        >
          Save Order
        </Button>
      </div>
    </div>
  );
}
