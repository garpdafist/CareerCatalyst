import OpenAI from "openai";
import { z } from "zod";

// Response validation schema
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string(),
      keywords: z.array(z.string())
    }),
    achievementsMetrics: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string(),
      highlights: z.array(z.string())
    }),
    structureReadability: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string()
    }),
    summaryClarity: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string()
    }),
    overallPolish: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string()
    })
  }),
  resumeSections: z.object({
    professionalSummary: z.string(),
    workExperience: z.string(),
    technicalSkills: z.string(),
    education: z.string(),
    keyAchievements: z.string()
  }),
  identifiedSkills: z.array(z.string()),
  importantKeywords: z.array(z.string()),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.string()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

// Rate limiting
const MIN_REQUEST_INTERVAL = 200;
let lastRequestTime = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

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