import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Steps, Step } from "@/components/ui/steps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, MessageSquare, LinkedinIcon, Video } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FormStep = {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
};

type OutputFormat = "email" | "video" | "linkedin";

const steps: FormStep[] = [
  {
    id: "role",
    title: "Target Role",
    description: "What position are you applying for?",
    isRequired: true,
  },
  {
    id: "company",
    title: "Company Details",
    description: "Tell us about the company and why you're interested",
    isRequired: true,
  },
  {
    id: "achievements",
    title: "Key Achievements",
    description: "Share 2-3 relevant accomplishments (or we'll use your resume)",
    isRequired: false,
  },
  {
    id: "brand",
    title: "Personal Brand",
    description: "What makes you unique? (optional - we can use resume data)",
    isRequired: false,
  },
  {
    id: "format",
    title: "Output Format",
    description: "Choose how you want your content delivered",
    isRequired: true,
  },
];

export default function CoverLetterGenerator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedFormats, setSelectedFormats] = useState<OutputFormat[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleFormatChange = (format: OutputFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  const handleNext = () => {
    const currentStepData = steps[currentStep];
    
    if (currentStepData.isRequired && !formData[currentStepData.id]) {
      toast({
        title: "Required Field",
        description: `Please provide information for ${currentStepData.title}`,
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (selectedFormats.length === 0) {
      toast({
        title: "Select Format",
        description: "Please select at least one output format",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // TODO: Implement API call to generate content
      const mockGeneratedContent = {
        email: "Dear Hiring Manager,\n\nI am writing to express my interest...",
        video: "Hello! I'm excited to share why I would be a great fit...",
        linkedin: "I'm thrilled to announce that I'm pursuing an exciting opportunity...",
      };

      setGeneratedContent(mockGeneratedContent);
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStepContent = () => {
    const currentStepData = steps[currentStep];

    if (currentStepData.id === "format") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Select one or more formats for your content
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className={`cursor-pointer transition-all ${
                selectedFormats.includes("email")
                  ? "border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleFormatChange("email")}
            >
              <CardContent className="p-4 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-medium">Email/Cover Letter</h3>
                <p className="text-sm text-muted-foreground">
                  Traditional format for applications
                </p>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all ${
                selectedFormats.includes("video")
                  ? "border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleFormatChange("video")}
            >
              <CardContent className="p-4 text-center">
                <Video className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-medium">Video Script</h3>
                <p className="text-sm text-muted-foreground">
                  For video applications
                </p>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer transition-all ${
                selectedFormats.includes("linkedin")
                  ? "border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => handleFormatChange("linkedin")}
            >
              <CardContent className="p-4 text-center">
                <LinkedinIcon className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-medium">LinkedIn Post</h3>
                <p className="text-sm text-muted-foreground">
                  Announcement post format
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    const savedResumeData = localStorage.getItem('resumeAnalysis');
    const hasResumeData = !!savedResumeData;

    return (
      <div className="space-y-4">
        {!currentStepData.isRequired && hasResumeData && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This field is optional. If skipped, we'll use relevant information from your resume.
            </AlertDescription>
          </Alert>
        )}
        
        {currentStepData.id === "achievements" ? (
          <RichTextEditor
            value={formData[currentStepData.id] || ""}
            onChange={(value) =>
              setFormData({ ...formData, [currentStepData.id]: value })
            }
            placeholder="• Increased sales by X%
• Led a team of Y people
• Reduced costs by Z%"
            className="min-h-[200px]"
          />
        ) : (
          <Textarea
            value={formData[currentStepData.id] || ""}
            onChange={(e) =>
              setFormData({ ...formData, [currentStepData.id]: e.target.value })
            }
            placeholder={`Enter ${currentStepData.title.toLowerCase()}...`}
            className="min-h-[100px]"
          />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Cover Letter Generator</h1>
        <p className="text-muted-foreground mt-2">
          Create personalized content for your job application
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Steps
            currentStep={currentStep}
            steps={steps.map((step) => ({
              label: step.title,
              description: step.description,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
        </CardHeader>
        <CardContent>
          {renderStepContent()}

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate Content"}
              </Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {Object.keys(generatedContent).length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Generated Content</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email">
              <TabsList>
                {selectedFormats.map((format) => (
                  <TabsTrigger key={format} value={format}>
                    {format.charAt(0).toUpperCase() + format.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {selectedFormats.map((format) => (
                <TabsContent key={format} value={format}>
                  <RichTextEditor
                    value={generatedContent[format] || ""}
                    onChange={() => {}}
                    className="min-h-[300px]"
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
