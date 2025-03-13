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
  jobSpecificFeedback: z.string().optional() // Added field for job-specific analysis
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
        // Continue with resume analysis even if job parsing fails
      }
    }

    const openai = getOpenAIClient();

    // Enhance system prompt with job context if available
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
        // Continue without job-specific feedback
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