import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Utility function for exponential backoff retries
async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error?.status === 429 && attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), 8000); // Cap at 8 seconds
        console.log(`Rate limit hit (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Failed after ${maxRetries} attempts`);
}

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
  identifiedSkills: z.array(z.string()),
  primaryKeywords: z.array(z.string()),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.object({
    overall: z.string()
  }),
  jobAnalysis: z.object({
    alignmentAndStrengths: z.array(z.string()),
    gapsAndConcerns: z.array(z.string()),
    recommendationsToTailor: z.array(z.string()),
    overallFit: z.string()
  }).optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. CAREFULLY analyze the resume and provide a complete analysis in JSON format containing EXACTLY these fields:

{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed analysis of keyword usage",
      "keywords": ["extract ALL relevant keywords"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of achievements",
      "highlights": ["extract ALL achievements"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of resume structure"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of professional summary"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of overall presentation"
    }
  },
  "identifiedSkills": ["extract ALL technical and soft skills"],
  "primaryKeywords": ["extract ALL important keywords and terms"],
  "suggestedImprovements": ["list ALL specific improvements needed"],
  "generalFeedback": {
    "overall": "provide detailed analysis of strengths and weaknesses"
  }
}

CRITICAL REQUIREMENTS:
1. You MUST extract and include ALL relevant keywords in primaryKeywords array
2. You MUST provide detailed feedback in generalFeedback.overall
3. ALL arrays must contain actual content from the resume
4. Never return empty arrays or placeholder text
5. Return ONLY valid JSON`;

async function preprocessText(text: string): Promise<string> {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  try {
    const chunks = text.match(/.{1,12000}/g) || [];
    const summaries = await Promise.all(chunks.map(async (chunk) => {
      return await withExponentialBackoff(async () => {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", 
          messages: [
            {
              role: "system",
              content: "Summarize while preserving ALL key information about skills, experience, achievements, and metrics. Keep all dates and specific technical terms."
            },
            { role: "user", content: chunk }
          ],
          temperature: 0
        });
        return response.choices[0].message.content || '';
      });
    }));

    return summaries.join('\n\n');
  } catch (error) {
    console.error('Text preprocessing error:', error);
    throw error;
  }
}

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

    const processedContent = await preprocessText(content);

    let prompt = SYSTEM_PROMPT;
    if (jobDescription) {
      prompt += `\n\nAnalyze against this job description:\n${jobDescription}\n\nAdd this to your response:
"jobAnalysis": {
  "alignmentAndStrengths": ["list specific matches with requirements"],
  "gapsAndConcerns": ["list specific gaps or mismatches"],
  "recommendationsToTailor": ["list specific suggestions to align with role"],
  "overallFit": "provide detailed assessment of fit"
}`;
    }

    return await withExponentialBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", 
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: processedContent }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      if (!response.choices[0]?.message?.content) {
        throw new Error('OpenAI returned an empty response');
      }

      // Log raw response for debugging
      console.log('Raw OpenAI Response:', {
        content: response.choices[0].message.content,
        timestamp: new Date().toISOString()
      });

      // Parse and log intermediate structure
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());
      console.log('Parsed Response Structure:', {
        hasGeneralFeedback: !!parsedResponse.generalFeedback,
        generalFeedbackContent: parsedResponse.generalFeedback?.overall,
        hasPrimaryKeywords: !!parsedResponse.primaryKeywords,
        primaryKeywordsCount: parsedResponse.primaryKeywords?.length,
        primaryKeywords: parsedResponse.primaryKeywords,
        identifiedSkillsCount: parsedResponse.identifiedSkills?.length,
        timestamp: new Date().toISOString()
      });

      // Ensure required fields exist
      const validatedResponse = {
        ...parsedResponse,
        primaryKeywords: parsedResponse.primaryKeywords || [],
        generalFeedback: {
          overall: parsedResponse.generalFeedback?.overall || ''
        }
      };

      // Validate and return
      return resumeAnalysisResponseSchema.parse(validatedResponse);
    });

  } catch (error) {
    console.error('Resume analysis error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      isZodError: error instanceof z.ZodError,
      zodErrors: error instanceof z.ZodError ? error.errors : undefined,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function analyzeResumeWithJobDescription(
  resumeText: string,
  jobDescription: JobDescription
): Promise<string> {
  try {
    const prompt = `
Resume Content:
${resumeText}

Job Details:
Role: ${jobDescription.roleTitle || 'Not specified'}
Experience Required: ${jobDescription.yearsOfExperience || 'Not specified'}
Industry: ${jobDescription.industry || 'Not specified'}
Required Skills: ${jobDescription.skills?.join(', ') || 'Not specified'}

Key Requirements:
${jobDescription.requirements?.join('\n') || 'None specified'}

Provide a detailed analysis of how this resume aligns with the job requirements. Focus on:
1. Required skills present and missing
2. Experience level alignment
3. Industry relevance
4. Specific improvements needed for this role
5. Keywords and terminology optimization`;

    return await withExponentialBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Provide a detailed analysis of how well the resume matches the job description. Focus on skill matches, experience alignment, and areas for improvement."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      return response.choices[0].message.content || 'No analysis generated';
    });
  } catch (error: any) {
    console.error('Resume-job analysis error:', error);
    throw new Error(`Failed to analyze resume against job description: ${error.message}`);
  }
}