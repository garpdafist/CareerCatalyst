import OpenAI from "openai";
import { z } from "zod";
import { parseJobDescription, analyzeResumeWithJobDescription } from "./job-description";
import type { JobDescription } from "@shared/schema";

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
  generalFeedback: z.string(),
  jobSpecificFeedback: z.string().optional()
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

const SYSTEM_PROMPT = `You are an expert resume analyzer. You MUST provide a comprehensive evaluation in JSON format with EXACTLY these fields (no omissions allowed):

{
  "score": (required number 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (required number 1-10),
      "maxScore": 10,
      "feedback": (required string, min 50 words),
      "keywords": (required array of strings, min 8 items)
    },
    "achievementsMetrics": {
      "score": (required number 1-10),
      "maxScore": 10,
      "feedback": (required string, min 50 words),
      "highlights": (required array of strings, min 5 items)
    },
    "structureReadability": {
      "score": (required number 1-10),
      "maxScore": 10,
      "feedback": (required string, min 50 words)
    },
    "summaryClarity": {
      "score": (required number 1-10),
      "maxScore": 10,
      "feedback": (required string, min 50 words)
    },
    "overallPolish": {
      "score": (required number 1-10),
      "maxScore": 10,
      "feedback": (required string, min 50 words)
    }
  },
  "resumeSections": {
    "professionalSummary": (required string, min 100 words),
    "workExperience": (required string, min 150 words),
    "technicalSkills": (required string, min 100 words),
    "education": (required string, min 50 words),
    "keyAchievements": (required string, min 100 words)
  },
  "identifiedSkills": (required array of strings, min 10 items),
  "importantKeywords": (required array of strings, min 8 items),
  "suggestedImprovements": (required array of strings, min 5 items),
  "generalFeedback": (required string, min 200 words)
}

IMPORTANT:
1. ALL fields marked as required MUST be present
2. Return ONLY the JSON object, no additional text
3. If you cannot extract certain information, use empty strings or arrays, but NEVER omit fields
4. Never add fields that are not in this schema
5. Ensure all minimum length/item requirements are met`;

// Main analysis function
export async function analyzeResumeWithAI(
  content: string,
  jobDescription?: string
): Promise<ResumeAnalysisResponse> {
  try {
    console.log('Starting resume analysis...', {
      contentLength: content.length,
      hasJobDescription: !!jobDescription,
      timestamp: new Date().toISOString()
    });

    await waitForRateLimit();

    // Parse job description if provided
    let parsedJobDescription: JobDescription | undefined;
    if (jobDescription) {
      try {
        parsedJobDescription = await parseJobDescription(jobDescription);
        console.log('Job description parsed:', {
          roleTitle: parsedJobDescription.roleTitle,
          skillsCount: parsedJobDescription.skills?.length || 0
        });
      } catch (error) {
        console.error('Job description parsing failed:', error);
      }
    }

    const openai = getOpenAIClient();

    const enhancedPrompt = parsedJobDescription ? 
      `${SYSTEM_PROMPT}\n\nAnalyze this resume in context of the following job requirements:
      Role: ${parsedJobDescription.roleTitle}
      Required Experience: ${parsedJobDescription.yearsOfExperience}
      Required Skills: ${parsedJobDescription.skills?.join(', ')}
      Key Requirements: ${parsedJobDescription.requirements?.join(', ')}` :
      SYSTEM_PROMPT;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: enhancedPrompt
        },
        {
          role: "user",
          content: `Analyze this resume${parsedJobDescription ? ' for the specified job role' : ''}:\n\n${content}`
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    let parsedResponse: any;
    try {
      const content = response.choices[0].message.content.trim();
      parsedResponse = JSON.parse(content);

      // Add fallback values for required fields if missing
      if (!parsedResponse.scores) parsedResponse.scores = {};
      if (!parsedResponse.scores.summaryClarity) {
        parsedResponse.scores.summaryClarity = {
          score: 1,
          maxScore: 10,
          feedback: "No summary clarity analysis available."
        };
      }
      if (!parsedResponse.scores.overallPolish) {
        parsedResponse.scores.overallPolish = {
          score: 1,
          maxScore: 10,
          feedback: "No overall polish analysis available."
        };
      }
      if (!parsedResponse.resumeSections) {
        parsedResponse.resumeSections = {
          professionalSummary: "",
          workExperience: "",
          technicalSkills: "",
          education: "",
          keyAchievements: ""
        };
      }
      parsedResponse.identifiedSkills = parsedResponse.identifiedSkills || [];
      parsedResponse.importantKeywords = parsedResponse.importantKeywords || [];
      parsedResponse.suggestedImprovements = parsedResponse.suggestedImprovements || [];
      parsedResponse.generalFeedback = parsedResponse.generalFeedback || "No general feedback available.";

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

    // Get additional job-specific analysis if job description was provided
    if (parsedJobDescription) {
      try {
        const jobAnalysis = await analyzeResumeWithJobDescription(content, parsedJobDescription);
        parsedResponse.jobSpecificFeedback = jobAnalysis;
      } catch (error) {
        console.error('Job-specific analysis failed:', error);
        parsedResponse.jobSpecificFeedback = "Unable to generate job-specific feedback.";
      }
    }

    const validatedResponse = resumeAnalysisResponseSchema.parse(parsedResponse);

    console.log('Analysis completed successfully:', {
      score: validatedResponse.score,
      skillsCount: validatedResponse.identifiedSkills.length,
      hasJobAnalysis: !!parsedJobDescription,
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