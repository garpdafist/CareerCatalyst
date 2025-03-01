import OpenAI from "openai";
import { z } from "zod";
import { resumeContentSchema, scoringCriteriaSchema, type ResumeContent, type ScoringCriteria } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.array(z.string()),
  skills: z.array(z.string()),
  improvements: z.array(z.string()),
  keywords: z.array(z.string()),
  structuredContent: resumeContentSchema,
  scoringCriteria: scoringCriteriaSchema
});

export type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 210; // 0.21 seconds in milliseconds

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

export async function analyzeResumeWithAI(content: string): Promise<ResumeAnalysisResponse> {
  try {
    await waitForRateLimit();

    const systemPrompt = `You are an expert resume analyzer. Analyze resumes and provide detailed feedback with specific scoring criteria. ALWAYS return a complete JSON response with ALL required fields.

Required fields and their format:
{
  "score": (number between 0-100),
  "feedback": (array of strings with general feedback),
  "skills": (array of strings listing identified skills),
  "improvements": (array of strings with specific suggestions),
  "keywords": (array of relevant industry keywords),
  "scoringCriteria": {
    "keywordUsage": {
      "score": (number out of 20),
      "maxScore": 20,
      "feedback": (specific feedback string),
      "keywords": (array of found keywords)
    },
    "metricsAndAchievements": {
      "score": (number out of 30),
      "maxScore": 30,
      "feedback": (specific feedback string),
      "highlights": (array of achievements)
    },
    "structureAndReadability": {
      "score": (number out of 25),
      "maxScore": 25,
      "feedback": (specific feedback string)
    },
    "overallImpression": {
      "score": (number out of 25),
      "maxScore": 25,
      "feedback": (specific feedback string)
    }
  },
  "structuredContent": {
    "professionalSummary": (string),
    "workExperience": [{
      "company": (string),
      "position": (string),
      "duration": (string),
      "achievements": (array of strings)
    }],
    "technicalSkills": (array of strings),
    "education": [{
      "institution": (string),
      "degree": (string),
      "year": (string)
    }],
    "certifications": (optional array of strings),
    "projects": (optional array of project objects)
  }
}`;

    const userPrompt = `Analyze this resume content and provide a complete analysis with ALL required fields as specified. If any section of the resume is missing, provide appropriate feedback about the missing information:

${content}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7 // Add some variability but keep it professional
    });

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('OpenAI returned an empty response');
    }

    console.log('OpenAI raw response:', {
      contentLength: responseContent.length,
      preview: responseContent.substring(0, 200) + '...'
    });

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
      console.log('Parsed response structure:', {
        hasScore: 'score' in parsedResponse,
        hasFeedback: Array.isArray(parsedResponse.feedback),
        hasSkills: Array.isArray(parsedResponse.skills),
        hasScoringCriteria: typeof parsedResponse.scoringCriteria === 'object',
        hasStructuredContent: typeof parsedResponse.structuredContent === 'object'
      });
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    try {
      return resumeAnalysisResponseSchema.parse(parsedResponse);
    } catch (validationError: any) {
      console.error('Schema validation error:', {
        error: validationError.errors,
        receivedData: parsedResponse
      });
      throw new Error('OpenAI response did not match expected schema');
    }

  } catch (error: any) {
    console.error('OpenAI API Error:', {
      message: error.message,
      type: error.constructor.name,
      status: error.status,
      details: error.response?.data
    });

    // Only use mock data if explicitly in development/test
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.log('Development mode: Using mock data');
      return mockResumeAnalysis;
    }

    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
}

// Mock data for development/testing only
const mockResumeAnalysis: ResumeAnalysisResponse = {
  score: 75,
  scoringCriteria: {
    keywordUsage: {
      score: 15,
      maxScore: 20,
      feedback: "Mock keyword analysis",
      keywords: ["mock", "keywords"]
    },
    metricsAndAchievements: {
      score: 20,
      maxScore: 30,
      feedback: "Mock metrics analysis",
      highlights: ["mock achievement"]
    },
    structureAndReadability: {
      score: 20,
      maxScore: 25,
      feedback: "Mock structure analysis"
    },
    overallImpression: {
      score: 20,
      maxScore: 25,
      feedback: "Mock overall impression"
    }
  },
  structuredContent: {
    professionalSummary: "[DEV MODE] Professional summary",
    workExperience: [{
      company: "Dev Company",
      position: "Test Position",
      duration: "2020-Present",
      achievements: ["Mock achievement"]
    }],
    technicalSkills: ["Dev Skill 1", "Dev Skill 2"],
    education: [{
      institution: "Dev University",
      degree: "Test Degree",
      year: "2020"
    }],
    certifications: ["Dev Certification"],
    projects: [{
      name: "Test Project",
      description: "Development mode description",
      technologies: ["Test Tech"]
    }]
  },
  feedback: [
    "Development mode: Mock feedback",
    "Please ensure OpenAI API is properly configured in production"
  ],
  skills: ["Dev Skill 1", "Dev Skill 2"],
  improvements: ["Development mode: Mock improvement suggestion"],
  keywords: ["dev", "test"]
};