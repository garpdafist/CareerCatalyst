import OpenAI from "openai";
import { z } from "zod";
import { parseJobDescription, analyzeResumeWithJobDescription } from "./job-description";
import type { JobDescription } from "@shared/schema";

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
    strengths: z.array(z.string()),
    actionItems: z.array(z.string())
  }),
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
      "feedback": "detailed feedback",
      "keywords": ["at least 3 keywords"]
    },
    "achievementsMetrics": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback",
      "highlights": ["at least 3 achievements"]
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
  "identifiedSkills": ["list of skills"],
  "primaryKeywords": ["important keywords"],
  "targetKeywords": ["only if job description provided"],
  "suggestedImprovements": ["improvement suggestions"],
  "generalFeedback": {
    "overall": "comprehensive feedback",
    "strengths": ["key strengths"],
    "actionItems": ["action items"]
  }
}

Rules:
1. ALL fields are required except targetKeywords and jobSpecificFeedback
2. Return ONLY valid JSON, no other text
3. Never omit any required field
4. Use empty arrays [] if no items found
5. Use descriptive text "No [x] available" for empty text fields
6. Provide specific, actionable feedback`;

// Chunk and summarize long text
async function preprocessText(text: string): Promise<string> {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  try {
    const chunks = text.match(/.{1,12000}/g) || [];
    const summaries = await Promise.all(chunks.map(async (chunk) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", 
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
    console.log('Content processed:', {
      originalLength: content.length,
      processedLength: processedContent.length,
      wasChunked: content.length !== processedContent.length
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
- Key Requirements: ${parsedJobDescription.requirements?.join('\n')}

Focus on:
1. Skills alignment and gaps
2. Experience level match
3. Industry relevance
4. Required vs. present keywords
5. Specific improvements for this role` : '';

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

      // Add fallback values for required fields if missing
      parsedResponse.score = parsedResponse.score || 0;
      parsedResponse.scores = parsedResponse.scores || {
        keywordsRelevance: { score: 1, maxScore: 10, feedback: "No analysis available", keywords: [] },
        achievementsMetrics: { score: 1, maxScore: 10, feedback: "No analysis available", highlights: [] },
        structureReadability: { score: 1, maxScore: 10, feedback: "No analysis available" },
        summaryClarity: { score: 1, maxScore: 10, feedback: "No analysis available" },
        overallPolish: { score: 1, maxScore: 10, feedback: "No analysis available" }
      };
      parsedResponse.resumeSections = parsedResponse.resumeSections || {
        professionalSummary: "No summary available",
        workExperience: "No experience details available",
        education: "No education details available",
        technicalSkills: "No skills details available",
        keyAchievements: "No achievements available"
      };
      parsedResponse.identifiedSkills = parsedResponse.identifiedSkills || [];
      parsedResponse.primaryKeywords = parsedResponse.primaryKeywords || [];
      parsedResponse.suggestedImprovements = parsedResponse.suggestedImprovements || [];
      parsedResponse.generalFeedback = parsedResponse.generalFeedback || {
        overall: "No general feedback available",
        strengths: [],
        actionItems: []
      };

      // Get job-specific analysis if needed
      if (parsedJobDescription) {
        const jobAnalysis = await analyzeResumeWithJobDescription(processedContent, parsedJobDescription);
        parsedResponse.jobSpecificFeedback = jobAnalysis;
        parsedResponse.targetKeywords = parsedResponse.targetKeywords || [];
      }

      // Log final structure for debugging
      console.log('Final response structure:', {
        hasScore: typeof parsedResponse.score === 'number',
        hasScores: !!parsedResponse.scores,
        hasResumeSections: !!parsedResponse.resumeSections,
        hasGeneralFeedback: !!parsedResponse.generalFeedback,
        skillsCount: parsedResponse.identifiedSkills.length,
        timestamp: new Date().toISOString()
      });

      // Validate against schema
      return resumeAnalysisResponseSchema.parse(parsedResponse);

    } catch (error) {
      console.error('Response parsing/validation error:', {
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