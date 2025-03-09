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
const REQUEST_DELAY_MS = 500; // 500ms delay between requests

async function waitForRateLimit() {
  const now = Date.now();
  const timeElapsed = now - lastRequestTime;

  if (timeElapsed < REQUEST_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - timeElapsed));
  }

  lastRequestTime = Date.now();
}

// Initialize OpenAI client
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

const SYSTEM_PROMPT = `You are an expert resume analyzer. Return a JSON object with EXACTLY these fields and structure:

{
  "score": number from 0-100 representing overall quality,
  "scores": {
    "keywordsRelevance": {
      "score": number from 1-10,
      "maxScore": 10,
      "feedback": "detailed feedback on keyword usage",
      "keywords": ["array", "of", "relevant", "keywords"]
    },
    "achievementsMetrics": {
      "score": number from 1-10,
      "maxScore": 10,
      "feedback": "feedback on quantifiable achievements",
      "highlights": ["array", "of", "key", "achievements"]
    },
    "structureReadability": {
      "score": number from 1-10,
      "maxScore": 10,
      "feedback": "feedback on resume structure and formatting"
    },
    "summaryClarity": {
      "score": number from 1-10,
      "maxScore": 10,
      "feedback": "feedback on professional summary"
    },
    "overallPolish": {
      "score": number from 1-10,
      "maxScore": 10,
      "feedback": "feedback on overall presentation"
    }
  },
  "resumeSections": {
    "professionalSummary": "extracted and improved summary",
    "workExperience": "formatted work experience",
    "technicalSkills": "organized technical skills",
    "education": "formatted education details",
    "keyAchievements": "highlighted achievements"
  },
  "identifiedSkills": ["array", "of", "skills"],
  "importantKeywords": ["array", "of", "keywords"],
  "suggestedImprovements": ["array", "of", "improvements"],
  "generalFeedback": "overall feedback and recommendations"
}

Return ONLY this JSON structure. No markdown formatting or additional text.`;

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
      model: "gpt-4", // Use gpt-4 instead of gpt-4o which was causing issues
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Analyze this resume and provide a detailed evaluation following the exact JSON structure specified. Be specific and actionable in your feedback:\n\n${content}`
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

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      // Log the structure before validation
      console.log('Parsed response structure:', {
        hasScore: typeof parsedResponse.score === 'number',
        hasScores: !!parsedResponse.scores,
        scoresKeys: parsedResponse.scores ? Object.keys(parsedResponse.scores) : [],
        hasResumeSections: !!parsedResponse.resumeSections,
        resumeSectionsKeys: parsedResponse.resumeSections ? Object.keys(parsedResponse.resumeSections) : [],
        identifiedSkillsCount: parsedResponse.identifiedSkills?.length ?? 0,
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