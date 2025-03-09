
import { z } from "zod";
import OpenAI from "openai";
import { setTimeout } from "timers/promises";

// Rate limiting helper
let lastRequestTime = 0;
const REQUEST_DELAY_MS = 500; // 500ms delay between requests

async function waitForRateLimit() {
  const now = Date.now();
  const timeElapsed = now - lastRequestTime;
  
  if (timeElapsed < REQUEST_DELAY_MS) {
    await setTimeout(REQUEST_DELAY_MS - timeElapsed);
  }
  
  lastRequestTime = Date.now();
}

// Initialize OpenAI client
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in the environment variables");
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Define validation schema for OpenAI response
const scoreEntrySchema = z.object({
  score: z.number().min(1).max(10),
  maxScore: z.number().int(),
  feedback: z.string(),
  keywords: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
});

const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(10).max(100),
  scores: z.object({
    keywordsRelevance: scoreEntrySchema,
    achievementsMetrics: scoreEntrySchema,
    structureReadability: scoreEntrySchema,
    summaryClarity: scoreEntrySchema,
    overallPolish: scoreEntrySchema,
  }),
  resumeSections: z.object({
    professionalSummary: z.string(),
    workExperience: z.string(),
    technicalSkills: z.string(),
    education: z.string(),
    keyAchievements: z.string(),
  }),
  identifiedSkills: z.array(z.string()),
  importantKeywords: z.array(z.string()),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.string(),
});

// Define response type
export type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. Analyze the provided resume and return a structured evaluation.

Your response MUST be a JSON object with EXACTLY this structure:
{
  "score": number (between 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": number (1-10),
      "maxScore": 10,
      "feedback": string,
      "keywords": string[]
    },
    "achievementsMetrics": {
      "score": number (1-10),
      "maxScore": 10,
      "feedback": string,
      "highlights": string[]
    },
    "structureReadability": {
      "score": number (1-10),
      "maxScore": 10,
      "feedback": string
    },
    "summaryClarity": {
      "score": number (1-10),
      "maxScore": 10,
      "feedback": string
    },
    "overallPolish": {
      "score": number (1-10),
      "maxScore": 10,
      "feedback": string
    }
  },
  "resumeSections": {
    "professionalSummary": string,
    "workExperience": string,
    "technicalSkills": string,
    "education": string,
    "keyAchievements": string
  },
  "identifiedSkills": string[],
  "importantKeywords": string[],
  "suggestedImprovements": string[],
  "generalFeedback": string
}`;

// Main analysis function
export async function analyzeResumeWithAI(content: string): Promise<ResumeAnalysisResponse> {
  try {
    console.log('Starting resume analysis...', {
      contentLength: content.length,
      timestamp: new Date().toISOString()
    });

    await waitForRateLimit();

    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Analyze this resume content and provide a detailed evaluation following the exact JSON structure specified. Include specific, actionable feedback:\n\n${content}`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    console.log('Received OpenAI response', {
      timestamp: new Date().toISOString(),
      responseLength: response.choices[0].message.content.length,
      previewResponse: response.choices[0].message.content.substring(0, 100) + '...'
    });

    const parsedResponse = JSON.parse(response.choices[0].message.content);

    // Log the parsed response for debugging
    console.log('Parsed OpenAI response:', {
      hasScore: typeof parsedResponse.score === 'number',
      hasScores: !!parsedResponse.scores,
      hasResumeSections: !!parsedResponse.resumeSections,
      preview: JSON.stringify(parsedResponse).substring(0, 100) + '...'
    });

    const validatedResponse = resumeAnalysisResponseSchema.parse(parsedResponse);

    console.log('Analysis completed successfully:', {
      score: validatedResponse.score,
      sectionsCount: Object.keys(validatedResponse.resumeSections).length,
      skillsCount: validatedResponse.identifiedSkills.length,
      timestamp: new Date().toISOString()
    });

    return validatedResponse;
  } catch (error: any) {
    console.error('Resume analysis error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      validationError: error instanceof z.ZodError ? error.errors : undefined
    });
    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
}
