import OpenAI from "openai";
import { z } from "zod";
import { resumeContentSchema, scoringCriteriaSchema, type ResumeContent, type ScoringCriteria } from "@shared/schema";

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
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key missing');
      throw new Error('OpenAI API key is not configured');
    }

    // Log analysis start
    console.log('Starting resume analysis:', {
      contentLength: content.length,
      hasApiKey: !!process.env.OPENAI_API_KEY
    });

    await waitForRateLimit();

    const response = await openai.chat.completions.create({
      model: "gpt-4", // Using the standard GPT-4 model
      messages: [
        {
          role: "system",
          content: `You are an expert resume analyzer. Analyze the resume content and provide structured feedback.
Your response must be a valid JSON object with the following structure:
{
  "score": number between 0-100,
  "feedback": array of feedback strings,
  "skills": array of identified skills,
  "improvements": array of improvement suggestions,
  "keywords": array of relevant keywords,
  "scoringCriteria": {
    "keywordUsage": {
      "score": number (max 20),
      "maxScore": 20,
      "feedback": string,
      "keywords": array of strings
    },
    "metricsAndAchievements": {
      "score": number (max 30),
      "maxScore": 30,
      "feedback": string,
      "highlights": array of strings
    },
    "structureAndReadability": {
      "score": number (max 25),
      "maxScore": 25,
      "feedback": string
    },
    "overallImpression": {
      "score": number (max 25),
      "maxScore": 25,
      "feedback": string
    }
  },
  "structuredContent": {
    "professionalSummary": string,
    "workExperience": array of {
      company: string,
      position: string,
      duration: string,
      achievements: array of strings
    },
    "technicalSkills": array of strings,
    "education": array of {
      institution: string,
      degree: string,
      year: string
    },
    "certifications": array of strings,
    "projects": array of objects
  }
}`
        },
        {
          role: "user",
          content: `Analyze this resume and provide detailed feedback with the following structure:

${content}`
        }
      ],
      temperature: 0.7
    });

    // Log API response
    console.log('OpenAI API response received:', {
      status: 'success',
      responseId: response.id,
      model: response.model,
      hasContent: !!response.choices[0]?.message?.content
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('OpenAI returned an empty response');
    }

    try {
      const parsedResponse = JSON.parse(responseContent);

      // Validate response structure
      const validatedResponse = resumeAnalysisResponseSchema.parse(parsedResponse);

      console.log('Analysis completed successfully:', {
        score: validatedResponse.score,
        skillsCount: validatedResponse.skills.length,
        hasStructuredContent: !!validatedResponse.structuredContent,
        hasScoringCriteria: !!validatedResponse.scoringCriteria
      });

      return validatedResponse;
    } catch (parseError: any) {
      console.error('Response parsing/validation error:', {
        error: parseError.message,
        response: responseContent.substring(0, 200) + '...'
      });
      throw new Error('Failed to parse OpenAI response: ' + parseError.message);
    }

  } catch (error: any) {
    console.error('OpenAI API Error:', {
      message: error.message,
      status: error.status,
      type: error.constructor.name
    });

    if (error.status === 429) {
      throw new Error('Service is temporarily busy. Please try again in a few moments.');
    } else if (error.status === 401 || error.status === 403) {
      throw new Error('Authentication failed. Please try again or contact support.');
    } else {
      throw new Error(`Failed to analyze resume: ${error.message}`);
    }
  }
}