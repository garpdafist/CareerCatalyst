import OpenAI from "openai";
import { z } from "zod";
import { parseJobDescription, analyzeResumeWithJobDescription } from "./job-description";
import type { JobDescription } from "@shared/schema";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

const SYSTEM_PROMPT = `You are an expert resume analyzer. Return ONLY a JSON object with EXACTLY these fields (no explanations or additional text):

{
  "score": (number between 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)",
      "keywords": ["at least 8 keywords found in resume"]
    },
    "achievementsMetrics": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)",
      "highlights": ["at least 5 key achievements"]
    },
    "structureReadability": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)"
    },
    "summaryClarity": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)"
    },
    "overallPolish": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)"
    }
  },
  "resumeSections": {
    "professionalSummary": "detailed analysis (min 100 words)",
    "workExperience": "detailed analysis (min 150 words)",
    "technicalSkills": "detailed analysis (min 100 words)",
    "education": "detailed analysis (min 50 words)",
    "keyAchievements": "detailed analysis (min 100 words)"
  },
  "identifiedSkills": ["at least 10 skills found in resume"],
  "importantKeywords": ["at least 8 important keywords"],
  "suggestedImprovements": ["at least 5 detailed improvements"],
  "generalFeedback": "comprehensive feedback (min 200 words)"
}

Rules:
1. ALL fields are required except jobSpecificFeedback
2. Return ONLY valid JSON, no other text
3. Never omit any field
4. Meet all minimum word/item counts
5. Provide specific, actionable feedback`;

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
        throw new Error(`Failed to parse job description: ${error.message}`);
      }
    }

    const jobContext = parsedJobDescription ? `

Additionally, consider these job requirements in your analysis:
- Role: ${parsedJobDescription.roleTitle}
- Experience: ${parsedJobDescription.yearsOfExperience}
- Industry: ${parsedJobDescription.industry}
- Required Skills: ${parsedJobDescription.skills?.join(', ')}
- Requirements: ${parsedJobDescription.requirements?.join('\n')}

Ensure your feedback highlights matches and gaps between the resume and these requirements.` : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + jobContext
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Log raw AI response for debugging
    console.log('Raw AI Response:', {
      content: response.choices[0].message.content,
      timestamp: new Date().toISOString()
    });

    try {
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      // Get additional job-specific analysis if job description was provided
      if (parsedJobDescription) {
        const jobAnalysis = await analyzeResumeWithJobDescription(content, parsedJobDescription);
        parsedResponse.jobSpecificFeedback = jobAnalysis;
      }

      // Validate response against schema
      return resumeAnalysisResponseSchema.parse(parsedResponse);

    } catch (error) {
      console.error('Resume analysis parsing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Resume analysis error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to analyze resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}