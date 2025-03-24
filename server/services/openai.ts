import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Enhanced retry configuration
const MAX_RETRIES = 3;  // Reduced from 5
const INITIAL_RETRY_DELAY = 1000; // Reduced from 2000ms to 1000ms
const MAX_RETRY_DELAY = 10000; // Reduced from 30s to 10s

// Simplified request queue implementation
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 500; // Reduced from 1000ms to 500ms

  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(r => setTimeout(r, this.minRequestInterval - timeSinceLastRequest));
          }

          const result = await operation();
          this.lastRequestTime = Date.now();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const nextOperation = this.queue.shift();
      if (nextOperation) {
        await nextOperation();
      }
    }
    this.processing = false;
  }
}

const requestQueue = new RequestQueue();

// Optimized text preprocessing
async function preprocessText(text: string): Promise<string> {
  // Only preprocess if text is too long
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  try {
    const chunks = text.match(/.{1,12000}/g) || [];
    const summaries = await Promise.all(chunks.map(async (chunk) => {
      return await requestQueue.add(async () => {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", 
          messages: [
            {
              role: "system",
              content: "Summarize while preserving key information about skills, experience, and metrics."
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
    // Return original text if preprocessing fails
    return text;
  }
}

// Streamlined API request with retries
async function makeOpenAIRequest<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestQueue.add(operation);
    } catch (error: any) {
      lastError = error;

      if (error?.status === 429 && attempt < maxRetries) {
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1),
          MAX_RETRY_DELAY
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function analyzeResumeWithAI(
  content: string,
  jobDescription?: string
): Promise<any> {
  try {
    const processedContent = await preprocessText(content);

    return await makeOpenAIRequest(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert resume analyzer. Analyze the resume and provide detailed feedback focusing on:
1. Key skills and qualifications
2. Experience and achievements
3. Areas for improvement`
          },
          { role: "user", content: processedContent }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    });
  } catch (error) {
    console.error('Resume analysis error:', error);
    throw error;
  }
}

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

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

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

async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  return requestQueue.add(async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isRateLimit = error?.status === 429;
        const isServerError = error?.status >= 500;

        if ((isRateLimit || isServerError) && attempt < maxRetries) {
          const baseDelay = Math.min(
            initialDelay * Math.pow(2, attempt - 1),
            MAX_RETRY_DELAY
          );
          const delay = baseDelay; // Removed jitter

          console.log(`API error (attempt ${attempt}/${maxRetries}):`, {
            status: error?.status,
            message: error?.message,
            retryIn: delay,
            timestamp: new Date().toISOString()
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Failed after ${maxRetries} attempts`);
  });
}