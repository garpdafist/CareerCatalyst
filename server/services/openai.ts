import OpenAI from "openai";
import { z } from "zod";

// Response validation schema
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string(),
      keywords: z.array(z.string())
    }),
    achievementsMetrics: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string(),
      highlights: z.array(z.string())
    }),
    structureReadability: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    }),
    summaryClarity: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    }),
    overallPolish: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
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

// Rate limiting helper
let lastRequestTime = 0;
const REQUEST_DELAY_MS = 500;

async function waitForRateLimit() {
  const now = Date.now();
  const timeElapsed = now - lastRequestTime;

  if (timeElapsed < REQUEST_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - timeElapsed));
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

const SYSTEM_PROMPT = `You are an expert resume analyzer. Provide a comprehensive evaluation in JSON format with these exact fields:

{
  "score": number (0-100) based on overall quality,
  "scores": {
    "keywordsRelevance": {
      "score": 1-10,
      "maxScore": 10,
      "feedback": "brief, actionable feedback",
      "keywords": ["relevant", "industry", "keywords"]
    },
    "achievementsMetrics": {
      "score": 1-10,
      "maxScore": 10,
      "feedback": "brief, actionable feedback",
      "highlights": ["key quantifiable achievements"]
    },
    "structureReadability": {
      "score": 1-10,
      "maxScore": 10,
      "feedback": "brief, actionable feedback"
    },
    "summaryClarity": {
      "score": 1-10,
      "maxScore": 10,
      "feedback": "brief, actionable feedback"
    },
    "overallPolish": {
      "score": 1-10,
      "maxScore": 10,
      "feedback": "brief, actionable feedback"
    }
  },
  "resumeSections": {
    "professionalSummary": "formatted summary text",
    "workExperience": "formatted experience text",
    "technicalSkills": "formatted skills text",
    "education": "formatted education text",
    "keyAchievements": "formatted achievements text"
  },
  "identifiedSkills": ["key", "skills", "found"],
  "importantKeywords": ["important", "industry", "keywords"],
  "suggestedImprovements": ["specific improvement suggestions"],
  "generalFeedback": "overall actionable feedback"
}

Return ONLY the JSON object, no additional text. Do not add any disclaimers or explanations outside the JSON structure.`;

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
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Analyze this resume and provide specific, actionable feedback:\n\n${content}`
        }
      ],
      temperature: 0,  // Changed from 0.1 to 0 for more consistent outputs
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    let parsedResponse: any;
    try {
      // Remove any potential non-JSON text before parsing
      const content = response.choices[0].message.content.trim();
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}') + 1;
      const jsonContent = content.slice(jsonStart, jsonEnd);

      parsedResponse = JSON.parse(jsonContent);

      console.log('Parsed response structure:', {
        hasScore: typeof parsedResponse.score === 'number',
        score: parsedResponse.score,
        identifiedSkillsCount: parsedResponse.identifiedSkills?.length ?? 0,
        improvementsCount: parsedResponse.suggestedImprovements?.length ?? 0,
        timestamp: new Date().toISOString()
      });
    } catch (parseError: any) {
      console.error('JSON parsing error:', {
        error: parseError.message,
        rawResponse: response.choices[0].message.content.substring(0, 200) + '...'
      });
      throw new Error('Failed to parse OpenAI response as JSON');
    }

    const validatedResponse = resumeAnalysisResponseSchema.parse(parsedResponse);

    console.log('Analysis completed successfully:', {
      score: validatedResponse.score,
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