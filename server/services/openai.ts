import { JobDescription, jobDescriptionSchema } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";
import { parseJobDescription, analyzeResumeWithJobDescription } from "./job-description";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Response validation schema
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1),
      keywords: z.array(z.string())
    }),
    achievementsMetrics: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1),
      highlights: z.array(z.string())
    }),
    structureReadability: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1)
    }),
    summaryClarity: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1)
    }),
    overallPolish: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1)
    })
  }),
  resumeSections: z.object({
    professionalSummary: z.string().min(1),
    workExperience: z.string().min(1),
    education: z.string().min(1),
    technicalSkills: z.string().min(1),
    keyAchievements: z.string().min(1)
  }),
  identifiedSkills: z.array(z.string()),
  primaryKeywords: z.array(z.string()),
  targetKeywords: z.array(z.string()).optional(),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.object({
    overall: z.string().min(1),
    strengths: z.array(z.string()).min(1),
    actionItems: z.array(z.string()).min(1)
  }),
  jobSpecificFeedback: z.string().optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. Return ONLY a JSON object with EXACTLY these fields:

{
  "score": (number between 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback",
      "keywords": ["at least 3 relevant keywords"]
    },
    "achievementsMetrics": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback",
      "highlights": ["at least 3 key achievements"]
    },
    "structureReadability": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback"
    },
    "summaryClarity": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback"
    },
    "overallPolish": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback"
    }
  },
  "resumeSections": {
    "professionalSummary": "detailed analysis",
    "workExperience": "detailed analysis",
    "education": "detailed analysis",
    "technicalSkills": "detailed analysis",
    "keyAchievements": "detailed analysis"
  },
  "identifiedSkills": ["minimum 3 specific skills"],
  "primaryKeywords": ["minimum 3 important keywords"],
  "suggestedImprovements": ["minimum 3 actionable improvements"],
  "generalFeedback": {
    "overall": "comprehensive feedback (minimum 100 words)",
    "strengths": ["REQUIRED: 2-3 specific key strengths found in resume"],
    "actionItems": ["REQUIRED: 2-3 prioritized action items"]
  }
}

CRITICAL REQUIREMENTS:
1. ALL fields are required (except targetKeywords and jobSpecificFeedback)
2. The 'generalFeedback.strengths' array MUST contain 2-3 specific strengths found in the resume
3. The 'generalFeedback.actionItems' array MUST contain 2-3 specific prioritized tasks
4. Never return empty arrays - provide at least one item
5. Return ONLY valid JSON with no additional text
6. If you can't find specific strengths or action items, use these defaults:
   - strengths: ["Demonstrates professional experience", "Has relevant education"]
   - actionItems: ["Add more quantifiable achievements", "Enhance skills section"]`;

// Chunk and summarize long text
async function preprocessText(text: string): Promise<string> {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  try {
    const chunks = text.match(/.{1,12000}/g) || [];
    const summaries = await Promise.all(chunks.map(async (chunk) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: "Summarize this text while preserving all key information about skills, experience, and achievements. Keep all dates, metrics, and specific technical terms."
          },
          {
            role: "user",
            content: chunk
          }
        ],
        temperature: 0
      });
      return response.choices[0].message.content || '';
    }));

    return summaries.join('\n\n');
  } catch (error) {
    console.error('Text preprocessing error:', error);
    return text; 
  }
}

// Default values for missing fields
const defaultScoreSection = {
  score: 1,
  maxScore: 10,
  feedback: "No analysis available"
};

const defaultScores = {
  keywordsRelevance: { ...defaultScoreSection, keywords: [] },
  achievementsMetrics: { ...defaultScoreSection, highlights: [] },
  structureReadability: defaultScoreSection,
  summaryClarity: defaultScoreSection,
  overallPolish: defaultScoreSection
};

const defaultResumeSections = {
  professionalSummary: "No summary available",
  workExperience: "No experience details available",
  education: "No education details available",
  technicalSkills: "No skills details available",
  keyAchievements: "No achievements available"
};

const defaultGeneralFeedback = {
  overall: "No general feedback available",
  strengths: ["Demonstrates professional experience", "Has relevant education"], //Added defaults
  actionItems: ["Add more quantifiable achievements", "Enhance skills section"] //Added defaults
};

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

    // Preprocess and chunk long text if needed
    const processedContent = await preprocessText(content);

    // Parse job description if provided
    let parsedJobDescription: JobDescription | undefined;
    if (jobDescription) {
      try {
        parsedJobDescription = await parseJobDescription(jobDescription);
      } catch (error) {
        console.error('Job description parsing failed:', error);
        throw new Error(`Failed to parse job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Build the complete prompt
    const jobContext = parsedJobDescription ? `
Additionally, analyze this resume against these job requirements:
- Role: ${parsedJobDescription.roleTitle}
- Experience Required: ${parsedJobDescription.yearsOfExperience}
- Industry: ${parsedJobDescription.industry}
- Required Skills: ${parsedJobDescription.skills?.join(', ')}
- Key Requirements: ${parsedJobDescription.requirements?.join('\n')}` : '';

    const finalPrompt = SYSTEM_PROMPT + jobContext;

    // Make the API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        {
          role: "system",
          content: finalPrompt
        },
        {
          role: "user",
          content: processedContent
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Log raw response for debugging
    console.log('Raw AI Response:', {
      content: response.choices[0].message.content,
      timestamp: new Date().toISOString()
    });

    try {
      // Parse and validate response
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      // Log parsed structure before applying defaults
      console.log('Initial parsed response structure:', {
        hasScores: !!parsedResponse.scores,
        hasSummaryClarity: !!parsedResponse.scores?.summaryClarity,
        hasOverallPolish: !!parsedResponse.scores?.overallPolish,
        timestamp: new Date().toISOString()
      });

      // Add fallback values for required fields
      const enhancedResponse = {
        score: parsedResponse.score || 0,
        scores: {
          ...defaultScores,
          ...parsedResponse.scores,
          summaryClarity: parsedResponse.scores?.summaryClarity || defaultScores.summaryClarity,
          overallPolish: parsedResponse.scores?.overallPolish || defaultScores.overallPolish
        },
        resumeSections: {
          ...defaultResumeSections,
          ...parsedResponse.resumeSections
        },
        identifiedSkills: parsedResponse.identifiedSkills || [],
        primaryKeywords: parsedResponse.primaryKeywords || [],
        suggestedImprovements: parsedResponse.suggestedImprovements || [],
        generalFeedback: {
          ...defaultGeneralFeedback,
          ...parsedResponse.generalFeedback,
          strengths: parsedResponse.generalFeedback?.strengths || defaultGeneralFeedback.strengths, //Added fallback
          actionItems: parsedResponse.generalFeedback?.actionItems || defaultGeneralFeedback.actionItems //Added fallback

        }
      };

      // Add job-specific data if available
      if (parsedJobDescription) {
        const jobAnalysis = await analyzeResumeWithJobDescription(processedContent, parsedJobDescription);
        enhancedResponse.jobSpecificFeedback = jobAnalysis;
        enhancedResponse.targetKeywords = parsedResponse.targetKeywords || [];
      }

      // Log final structure before validation
      console.log('Final response structure:', {
        hasScores: true,
        hasSummaryClarity: true,
        hasOverallPolish: true,
        timestamp: new Date().toISOString()
      });

      // Validate enhanced response
      return resumeAnalysisResponseSchema.parse(enhancedResponse);

    } catch (error) {
      console.error('Response processing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to process AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
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