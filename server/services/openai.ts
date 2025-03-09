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
          content: `You are an expert resume analyzer. Analyze the provided resume and return a structured evaluation with specific scores and feedback. Return ONLY a JSON object with no additional text or markdown formatting.`
        },
        {
          role: "user",
          content: `Analyze this resume and provide detailed, actionable feedback:\n\n${content}`
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
      responseLength: response.choices[0].message.content.length
    });

    const parsedResponse = JSON.parse(response.choices[0].message.content);
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
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
}