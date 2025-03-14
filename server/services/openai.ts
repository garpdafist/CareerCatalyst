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

    const basePrompt = `You are an expert resume analyzer. Analyze the provided resume and return a detailed JSON response with the following structure:

{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": { "score": (1-10), "maxScore": 10, "feedback": "detailed feedback", "keywords": ["list", "of", "keywords"] },
    "achievementsMetrics": { "score": (1-10), "maxScore": 10, "feedback": "detailed feedback", "highlights": ["major", "achievements"] },
    "structureReadability": { "score": (1-10), "maxScore": 10, "feedback": "detailed feedback" },
    "summaryClarity": { "score": (1-10), "maxScore": 10, "feedback": "detailed feedback" },
    "overallPolish": { "score": (1-10), "maxScore": 10, "feedback": "detailed feedback" }
  },
  "resumeSections": {
    "professionalSummary": "detailed analysis",
    "workExperience": "detailed analysis",
    "technicalSkills": "detailed analysis",
    "education": "detailed analysis",
    "keyAchievements": "detailed analysis"
  },
  "identifiedSkills": ["list", "of", "skills"],
  "importantKeywords": ["important", "keywords"],
  "suggestedImprovements": ["list", "of", "improvements"],
  "generalFeedback": "detailed feedback"
}

Rules:
1. Include AT LEAST 8-10 identified skills
2. Include AT LEAST 5-7 suggested improvements
3. Provide detailed, actionable feedback in each section
4. Each feedback section should be at least 50 words
5. General feedback should be at least 200 words
6. Never return empty arrays or placeholder text`;

    const jobSpecificPrompt = parsedJobDescription ? `
Additionally, analyze how well this resume matches the following job requirements:

Role Title: ${parsedJobDescription.roleTitle}
Years of Experience: ${parsedJobDescription.yearsOfExperience}
Industry: ${parsedJobDescription.industry}
Required Skills: ${parsedJobDescription.skills?.join(', ')}
Key Requirements: ${parsedJobDescription.requirements?.join('\n')}

Focus your analysis on:
1. Skills alignment with job requirements
2. Experience level match
3. Industry relevance
4. Keyword optimization for ATS
5. Specific improvements needed for this role` : '';

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: basePrompt + jobSpecificPrompt
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

    let parsedResponse: any;
    try {
      const content = response.choices[0].message.content.trim();
      parsedResponse = JSON.parse(content);

      // Get additional job-specific analysis if job description was provided
      if (parsedJobDescription) {
        const jobAnalysis = await analyzeResumeWithJobDescription(content, parsedJobDescription);
        parsedResponse.jobSpecificFeedback = jobAnalysis;
      }

      return resumeAnalysisResponseSchema.parse(parsedResponse);

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