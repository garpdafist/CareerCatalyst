import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
import { createHash } from 'crypto';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced retry configuration
const MAX_RETRIES = 3;  // Reduced from 5
const INITIAL_RETRY_DELAY = 1000; // Reduced from 2000ms to 1000ms
const MAX_RETRY_DELAY = 10000; // Reduced from 30s to 10s

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 7000; // About 1750 tokens, reduced from 12000

// Constants for text processing
const CHUNK_SIZE = 3500; // Optimal size for GPT-3.5-turbo processing

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

// Improved text preprocessing with smart chunking and parallel processing
async function preprocessText(text: string): Promise<string> {
  console.log(`[${new Date().toISOString()}] Preprocessing text of length: ${text.length}`);
  
  // If text is short enough, return it as is
  if (text.length <= MAX_TEXT_LENGTH) {
    console.log(`[${new Date().toISOString()}] Text under threshold, skipping preprocessing`);
    return text;
  }

  try {
    // Split text into paragraphs first to maintain semantic coherence
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    
    // Group paragraphs into chunks without breaking paragraphs
    let currentChunk = '';
    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds chunk size and we already have content, 
      // finalize the current chunk and start a new one
      if (currentChunk.length + paragraph.length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        // Otherwise add to the current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    console.log(`[${new Date().toISOString()}] Split text into ${chunks.length} chunks for summarization`);
    
    // Process chunks with GPT-3.5 in parallel with timeouts and retries
    const summaries = await Promise.all(chunks.map(async (chunk, index) => {
      return await withExponentialBackoff(async () => {
        console.log(`[${new Date().toISOString()}] Summarizing chunk ${index+1}/${chunks.length}, size: ${chunk.length}`);
        
        // Use GPT-3.5 for summarization to save time and costs
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo", // Use 3.5 for summarization instead of 4
          messages: [
            {
              role: "system",
              content: "You are a resume preprocessing assistant. Extract and preserve key information including skills, job titles, employment dates, education, and quantifiable achievements. Maintain all relevant keywords, technical skills, and metrics."
            },
            { role: "user", content: chunk }
          ],
          temperature: 0
        });
        
        console.log(`[${new Date().toISOString()}] Completed summarizing chunk ${index+1}`);
        return response.choices[0].message.content || '';
      }, 2, 500, 30000); // 2 retries, 500ms initial delay, 30s timeout
    }));

    const combinedSummary = summaries.join('\n\n');
    console.log(`[${new Date().toISOString()}] Successfully summarized all chunks. Final size: ${combinedSummary.length}`);
    
    return combinedSummary;
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Text preprocessing error:`, {
      message: error.message,
      type: error.constructor.name
    });
    // Fallback: if full preprocessing fails, try a simpler chunking strategy
    try {
      console.log(`[${new Date().toISOString()}] Attempting fallback preprocessing strategy`);
      // Simple chunking by splitting the text into smaller pieces
      const simpleChunks = text.match(/.{1,5000}/g) || [text];
      
      let simpleSummary = '';
      // Process one chunk at a time to avoid overwhelming the API
      for (let i = 0; i < simpleChunks.length; i++) {
        const chunk = simpleChunks[i];
        console.log(`[${new Date().toISOString()}] Processing fallback chunk ${i+1}/${simpleChunks.length}`);
        
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", 
            messages: [
              {
                role: "system", 
                content: "Extract only the most important information from this resume text."
              },
              { role: "user", content: chunk }
            ],
            temperature: 0
          });
          
          const content = response.choices[0].message.content || '';
          simpleSummary += (simpleSummary ? '\n\n' : '') + content;
        } catch (chunkError) {
          console.warn(`[${new Date().toISOString()}] Failed to process fallback chunk ${i+1}, skipping`);
          // Include a portion of the raw chunk if processing fails
          simpleSummary += (simpleSummary ? '\n\n' : '') + 
            `[Resume content section ${i+1}]: ` + chunk.substring(0, 1000) + '...';
        }
      }
      
      console.log(`[${new Date().toISOString()}] Fallback preprocessing completed. Final size: ${simpleSummary.length}`);
      return simpleSummary;
    } catch (fallbackError) {
      console.error(`[${new Date().toISOString()}] Fallback preprocessing failed:`, fallbackError);
      // Final fallback: return a truncated version of the original text
      console.warn(`[${new Date().toISOString()}] Using truncated original text`);
      return text.substring(0, MAX_TEXT_LENGTH) + 
        '\n\n[Note: The resume was truncated due to its length. Some information may be missing.]';
    }
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

// Cache for resume analyses to avoid redundant processing
const analysisCache = new Map<string, { timestamp: number, result: any }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hour cache TTL

// Create MD5 hash for caching
function createHash(str: string): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(str).digest('hex');
}

// Optimized system prompt with more concise instructions
const OPTIMIZED_SYSTEM_PROMPT = `You are an expert resume analyzer. Provide a complete analysis in JSON format containing these fields:
{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of keyword usage",
      "keywords": ["all relevant keywords"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of achievements",
      "highlights": ["key achievements"]
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
  "identifiedSkills": ["technical and soft skills"],
  "primaryKeywords": ["important keywords and terms"],
  "suggestedImprovements": ["specific improvements needed"],
  "generalFeedback": {
    "overall": "analysis of strengths and weaknesses"
  }
}

Requirements: Extract all relevant keywords, provide detailed feedback, include actual content from resume, no empty arrays, return valid JSON only.`;

// Legacy system prompt kept for reference
const SYSTEM_PROMPT = OPTIMIZED_SYSTEM_PROMPT;

// Optimized two-stage analysis process using GPT-3.5 and GPT-4
export async function analyzeResumeWithAI(
  content: string,
  jobDescription?: string
): Promise<any> {
  // Add start timestamp for debugging
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting resume analysis for content of length ${content.length}`);
  
  // Generate a cache key based on content
  const cacheKey = createHash(content);
  
  // Check if we have a recent cached result
  const cachedResult = analysisCache.get(cacheKey);
  if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
    console.log(`[${new Date().toISOString()}] Using cached analysis from ${new Date(cachedResult.timestamp).toISOString()}`);
    return cachedResult.result;
  }
  
  try {
    // Stage 1: Preprocessing and Initial Analysis
    console.log(`[${new Date().toISOString()}] Preprocessing text...`);
    const processedContent = await preprocessText(content);
    console.log(`[${new Date().toISOString()}] Text preprocessing complete. Processing length: ${processedContent.length}`);

    // Use GPT-3.5-turbo for initial extraction of skills, experience and keywords
    console.log(`[${new Date().toISOString()}] Performing initial analysis with GPT-3.5...`);
    const initialAnalysis = await withExponentialBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Use 3.5 for faster initial extraction
        messages: [
          {
            role: "system",
            content: `Extract the following information from this resume:
1. A list of technical skills
2. A list of soft skills
3. A list of all important keywords
4. Key achievements with metrics
5. Educational qualifications
6. Employment history summary

Format as JSON with these exact fields:
{
  "technicalSkills": [],
  "softSkills": [],
  "keywords": [],
  "achievements": [],
  "education": [],
  "experience": []
}`
          },
          { role: "user", content: processedContent }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });
      
      console.log(`[${new Date().toISOString()}] Initial analysis received. Parsing...`);
      return JSON.parse(response.choices[0].message.content || '{}');
    }, 2, 1000, 45000);

    // Stage 2: In-depth Analysis and Scoring with GPT-4
    console.log(`[${new Date().toISOString()}] Performing comprehensive analysis with GPT-4...`);
    const finalResult = await makeOpenAIRequest(async () => {
      // Prepare a more focused prompt with the extracted data
      const enhancedPrompt = `
Resume Content:
${processedContent}

Initial Analysis:
${JSON.stringify(initialAnalysis, null, 2)}

Provide a comprehensive evaluation of this resume based on the initial analysis and full content.`;

      console.log(`[${new Date().toISOString()}] Creating GPT-4 chat completion for final evaluation...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use GPT-4 for final in-depth analysis and scoring
        messages: [
          {
            role: "system",
            content: OPTIMIZED_SYSTEM_PROMPT
          },
          { role: "user", content: enhancedPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      console.log(`[${new Date().toISOString()}] Final analysis received. Content length: ${response.choices[0].message.content?.length || 0}`);
      
      try {
        // Parse and validate the response
        const parsedResponse = JSON.parse(response.choices[0].message.content || '{}');
        
        // Enhance response with any data from initial analysis that might be missing
        if (!parsedResponse.identifiedSkills || parsedResponse.identifiedSkills.length === 0) {
          parsedResponse.identifiedSkills = [
            ...(initialAnalysis.technicalSkills || []),
            ...(initialAnalysis.softSkills || [])
          ];
        }
        
        if (!parsedResponse.primaryKeywords || parsedResponse.primaryKeywords.length === 0) {
          parsedResponse.primaryKeywords = initialAnalysis.keywords || [];
        }
        
        console.log(`[${new Date().toISOString()}] Response parsed and enhanced successfully`);
        return parsedResponse;
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Error parsing OpenAI response:`, error);
        
        // Fallback to a simplified response if parsing fails
        return {
          score: 65, // Default middle score
          identifiedSkills: [...(initialAnalysis.technicalSkills || []), ...(initialAnalysis.softSkills || [])],
          primaryKeywords: initialAnalysis.keywords || [],
          suggestedImprovements: ["Add more quantifiable achievements", "Update skills section"],
          generalFeedback: { 
            overall: "Unable to generate detailed feedback. Please try again with a more structured resume format." 
          },
          scores: {
            keywordsRelevance: { score: 6, maxScore: 10, feedback: "Moderate keyword usage", keywords: initialAnalysis.keywords || [] },
            achievementsMetrics: { score: 5, maxScore: 10, feedback: "Limited metrics", highlights: initialAnalysis.achievements || [] },
            structureReadability: { score: 7, maxScore: 10, feedback: "Good structure" },
            summaryClarity: { score: 6, maxScore: 10, feedback: "Adequate summary" },
            overallPolish: { score: 7, maxScore: 10, feedback: "Reasonably polished" }
          }
        };
      }
    });
    
    // Cache the result
    analysisCache.set(cacheKey, {
      timestamp: Date.now(),
      result: finalResult
    });
    
    // Log completion
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Resume analysis completed in ${duration}ms`);
    
    return finalResult;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Resume analysis failed after ${duration}ms:`, {
      message: error.message,
      type: error.constructor.name,
      status: error.status,
      stack: error.stack
    });
    throw error;
  }
}

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
  initialDelay: number = INITIAL_RETRY_DELAY,
  timeout: number = 120000 // 2 minute default timeout
): Promise<T> {
  return requestQueue.add(async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create a promise that rejects in <timeout> milliseconds
        const timeoutPromise = new Promise<T>((_, reject) => {
          const id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error('Operation timed out'));
          }, timeout);
        });

        // Returns a race between our operation and the timeout
        return await Promise.race([
          operation(),
          timeoutPromise
        ]);
      } catch (error: any) {
        const isRateLimit = error?.status === 429;
        const isServerError = error?.status >= 500;
        const isTimeout = error?.message === 'Operation timed out';

        // Retry on rate limits, server errors, or timeouts
        if ((isRateLimit || isServerError || isTimeout) && attempt < maxRetries) {
          const baseDelay = Math.min(
            initialDelay * Math.pow(2, attempt - 1),
            MAX_RETRY_DELAY
          );
          const delay = baseDelay;

          console.log(`API error (attempt ${attempt}/${maxRetries}):`, {
            status: error?.status,
            message: error?.message,
            retryIn: delay,
            isTimeout: isTimeout,
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