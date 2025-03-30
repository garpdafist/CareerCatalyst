/**
 * Unified Resume Analysis Service
 * 
 * This service provides a comprehensive resume analysis with features:
 * 1. Consolidated functionality for analyzing resumes with or without job descriptions
 * 2. Efficient text chunking for large resumes to prevent timeouts
 * 3. Smart caching using MD5 hashing
 * 4. Configurable APIs (GPT-3.5 for initial extraction, GPT-4 for deep analysis)
 * 5. Robust error handling with exponential backoff 
 * 6. Detailed logging for performance monitoring
 */

import { JobDescription } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { openai, withExponentialBackoff, requestQueue } from "./openai";

// Use type from openai.ts but define our schema-validated type here
import type { ResumeAnalysisResponse as OpenAIResponse } from "./openai";

// Resume analysis constants
const MAX_TEXT_LENGTH = 7000;
const CHUNK_SIZE = 3500;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hour cache TTL

// Import requestQueue from openai.ts

// Cache for resume analyses to avoid redundant processing
const analysisCache = new Map<string, { timestamp: number, result: any }>();

/**
 * Create MD5 hash for caching purposes
 */
function createMD5Hash(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Generate cache key for analysis that includes job description if present
 */
function generateCacheKey(resumeText: string, jobDescription?: JobDescription): string {
  if (!jobDescription) {
    return createMD5Hash(resumeText);
  }
  
  // If job description is a string, use it directly
  if (typeof jobDescription === 'string') {
    // Take first 100 chars of job description for cache key to avoid excessive key length
    const jobPreview = jobDescription.length > 100 ? 
      jobDescription.substring(0, 100) : jobDescription;
    return createMD5Hash(`${resumeText}-job:${jobPreview}`);
  }
  
  // If it's an object, include job description details in the cache key
  const typedJobDesc = jobDescription as {
    roleTitle?: string;
    companyName?: string;
    skills?: string[];
  };
  
  const jobKey = 
    `${typedJobDesc.roleTitle || ''}-${typedJobDesc.companyName || ''}-${(typedJobDesc.skills || []).join(',')}`;
  
  return createMD5Hash(`${resumeText}-${jobKey}`);
}

/**
 * Smart resume text preprocessing
 * - Handles large resumes by chunking
 * - Preserves key content like skills, experience, and achievements
 * - Attempts multiple preprocessing strategies with fallbacks
 */
async function preprocessText(text: string): Promise<string> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Preprocessing text of length: ${text.length}`);
  
  // If text is short enough, return it as is
  if (text.length <= MAX_TEXT_LENGTH) {
    console.log(`[${new Date().toISOString()}] Text under threshold, skipping preprocessing`);
    return text;
  }

  try {
    // Split text into paragraphs to maintain semantic coherence
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    
    // Group paragraphs into chunks
    let currentChunk = '';
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    console.log(`[${new Date().toISOString()}] Split text into ${chunks.length} chunks for summarization`);
    
    // Process chunks with GPT-3.5 in parallel with retries
    const summaries = await Promise.all(chunks.map(async (chunk, index) => {
      return await withExponentialBackoff(async () => {
        console.log(`[${new Date().toISOString()}] Summarizing chunk ${index+1}/${chunks.length}`);
        
        // Use GPT-3.5 for summarization to save time and costs
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a resume preprocessing assistant. Extract and preserve key information including skills, job titles, employment dates, education, and quantifiable achievements. Maintain all relevant keywords, technical skills, and metrics."
            },
            { role: "user", content: chunk }
          ],
          temperature: 0
        });
        
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
    
    // Fallback: if full preprocessing fails, try a simpler strategy
    try {
      console.log(`[${new Date().toISOString()}] Attempting fallback preprocessing`);
      // Simple chunking by splitting the text
      const simpleChunks = [];
      for (let i = 0; i < text.length; i += 5000) {
        simpleChunks.push(text.substring(i, i + 5000));
      }
      
      let simpleSummary = '';
      // Process one chunk at a time
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
          console.warn(`[${new Date().toISOString()}] Failed to process fallback chunk ${i+1}`);
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

/**
 * Optimized system prompt with concise instructions for resume analysis
 */
const RESUME_ANALYSIS_PROMPT = `You are an expert resume analyzer. Provide a complete analysis in JSON format containing these fields:
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

/**
 * Job-specific analysis prompt for resume-job matching
 */
const JOB_ANALYSIS_PROMPT = `You are an expert resume analyzer comparing a resume to a job description. Provide a complete analysis in JSON format:
{
  "score": (overall match score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of keyword alignment",
      "keywords": ["matching keywords"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analysis of achievements relevance",
      "highlights": ["relevant achievements"]
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
  "identifiedSkills": ["skills found in resume"],
  "primaryKeywords": ["important keywords found in resume"],
  "suggestedImprovements": ["specific improvements needed for this job"],
  "generalFeedback": {
    "overall": "analysis of overall match"
  },
  "jobAnalysis": {
    "alignmentAndStrengths": ["areas where resume aligns well with job"],
    "gapsAndConcerns": ["missing skills or experience needed for job"],
    "recommendationsToTailor": ["how to better target resume to this job"],
    "overallFit": "summary of how well resume matches job requirements"
  }
}

Requirements: Be specific about job match, highlight relevant skills and gaps, provide actionable recommendations.`;

/**
 * Schema for resume analysis response validation
 */
export const resumeAnalysisResponseSchema = z.object({
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
  // CRITICAL FIX: Allow null for jobAnalysis to match our implementation
  jobAnalysis: z.union([
    z.object({
      alignmentAndStrengths: z.array(z.string()),
      gapsAndConcerns: z.array(z.string()),
      recommendationsToTailor: z.array(z.string()),
      overallFit: z.string()
    }),
    z.null()
  ])
});

/**
 * Custom interface for job analysis to ensure consistent typing 
 */
export interface JobAnalysis {
  alignmentAndStrengths: string[];
  gapsAndConcerns: string[];
  recommendationsToTailor: string[];
  overallFit: string;
}

/**
 * Type for resume analysis response
 */
export type ResumeAnalysisResponse = Omit<z.infer<typeof resumeAnalysisResponseSchema>, 'jobAnalysis'> & {
  // Override the jobAnalysis type to always be null or JobAnalysis (never undefined)
  jobAnalysis: JobAnalysis | null;
};

/**
 * Unified resume analysis function that handles both basic and job-targeted analysis
 * 
 * @param content The resume text to analyze
 * @param jobDescription Optional job description for targeted analysis
 * @returns Comprehensive resume analysis
 */
export async function analyzeResume(
  content: string,
  jobDescription?: JobDescription
): Promise<ResumeAnalysisResponse> {
  // Add start timestamp for debugging
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting resume analysis for content of length ${content.length}`);
  
  // Enhanced job description logging (this is a critical tracing point)
  console.log(`[${new Date().toISOString()}] JOB DESCRIPTION DEBUG TRACE:`, {
    exists: !!jobDescription,
    type: typeof jobDescription,
    isNull: jobDescription === null,
    isUndefined: jobDescription === undefined,
    length: jobDescription ? (typeof jobDescription === 'string' ? jobDescription.length : JSON.stringify(jobDescription).length) : 0,
    preview: jobDescription ? (typeof jobDescription === 'string' ? 
      (jobDescription.substring(0, 100) + (jobDescription.length > 100 ? '...' : '')) : 
      JSON.stringify(jobDescription).substring(0, 100) + '...') : 'undefined'
  });
  
  // Generate a cache key based on content and job description (if present)
  const cacheKey = generateCacheKey(content, jobDescription);
  
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

    // Use GPT-3.5-turbo for initial extraction
    console.log(`[${new Date().toISOString()}] Performing initial analysis with GPT-3.5...`);
    const initialAnalysis = await withExponentialBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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

    // Stage 2: In-depth Analysis with GPT-4
    console.log(`[${new Date().toISOString()}] Performing comprehensive analysis with GPT-4...`);
    
    // Prepare analysis prompt based on whether we have a job description
    const systemPrompt = jobDescription ? JOB_ANALYSIS_PROMPT : RESUME_ANALYSIS_PROMPT;
    
    let enhancedPrompt = `
Resume Content:
${processedContent}

Initial Analysis:
${JSON.stringify(initialAnalysis, null, 2)}
`;

    // Add job description details if available
    if (jobDescription) {
      // If job description is a string, use it directly
      if (typeof jobDescription === 'string') {
        console.log(`[${new Date().toISOString()}] Job description is a string of length: ${jobDescription.length}`);
        enhancedPrompt += `
Job Description:
${jobDescription}

Compare this resume with the job description and provide a comprehensive evaluation.
`;
      } 
      // If it's an object, format it nicely
      else {
        console.log(`[${new Date().toISOString()}] Job description is an object with properties: ${Object.keys(jobDescription).join(', ')}`);
        enhancedPrompt += `
Job Details:
Role: ${jobDescription.roleTitle || 'Not specified'}
Experience Required: ${jobDescription.yearsOfExperience || 'Not specified'}
Industry: ${jobDescription.industry || 'Not specified'}
Company: ${jobDescription.companyName || 'Not specified'}
Required Skills: ${jobDescription.skills?.join(', ') || 'Not specified'}

Key Requirements:
${jobDescription.requirements?.join('\n') || 'None specified'}

Compare this resume with the job description and provide a comprehensive evaluation.
`;
      }
    } else {
      enhancedPrompt += `
Provide a comprehensive evaluation of this resume based on the initial analysis and full content.
`;
    }

    const finalResult = await withExponentialBackoff(async () => {
      console.log(`[${new Date().toISOString()}] Creating GPT-4 chat completion for final evaluation...`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use GPT-4 for final in-depth analysis and scoring
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: enhancedPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      console.log(`[${new Date().toISOString()}] Final analysis received.`);
      
      try {
        // Parse and validate the response
        const parsedResponse = JSON.parse(response.choices[0].message.content || '{}');
        
        // Enhance response with data from initial analysis if anything is missing
        if (!parsedResponse.identifiedSkills || parsedResponse.identifiedSkills.length === 0) {
          parsedResponse.identifiedSkills = [
            ...(initialAnalysis.technicalSkills || []),
            ...(initialAnalysis.softSkills || [])
          ];
        }
        
        if (!parsedResponse.primaryKeywords || parsedResponse.primaryKeywords.length === 0) {
          parsedResponse.primaryKeywords = initialAnalysis.keywords || [];
        }
        
        // Ensure we have suggested improvements
        if (!parsedResponse.suggestedImprovements || parsedResponse.suggestedImprovements.length === 0) {
          parsedResponse.suggestedImprovements = [
            "Add more quantifiable achievements to showcase your impact",
            "Improve your skills section with more relevant technologies",
            "Ensure your resume summary clearly communicates your value proposition",
            "Use more industry-specific keywords throughout your resume"
          ];
        }
        
        // Ensure we have general feedback
        if (!parsedResponse.generalFeedback || !parsedResponse.generalFeedback.overall) {
          parsedResponse.generalFeedback = {
            overall: "Your resume shows your experience and skills, but could benefit from more specific achievements and clearer formatting. Consider tailoring it more specifically to your target roles and highlighting your unique value proposition."
          };
        }
        
        // Critical fix: Ensure jobAnalysis is populated when a job description is provided
        if (jobDescription && (!parsedResponse.jobAnalysis || parsedResponse.jobAnalysis === null)) {
          console.log(`[${new Date().toISOString()}] WARNING: Job description was provided but jobAnalysis is missing in the response`);
          parsedResponse.jobAnalysis = {
            alignmentAndStrengths: ["Your skills match some of the requirements in the job description."],
            gapsAndConcerns: ["There may be requirements in the job description that aren't reflected in your resume."],
            recommendationsToTailor: [
              "Tailor your resume to highlight experience relevant to this position",
              "Incorporate keywords from the job description into your resume",
              "Quantify achievements that demonstrate skills mentioned in the job posting"
            ],
            overallFit: "The AI was unable to generate a complete job match analysis. To get better results, try analyzing your resume against a more detailed job description."
          };
        }
        
        console.log(`[${new Date().toISOString()}] Response parsed and enhanced successfully`);
        return parsedResponse;
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Error parsing OpenAI response:`, error);
        
        // Fallback to a simplified response if parsing fails
        // Make sure to include the jobAnalysis property (set to null) even when it's not present
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
          },
          // When job description exists, always populate jobAnalysis with meaningful content
          jobAnalysis: jobDescription ? {
            alignmentAndStrengths: ["Your resume contains some relevant skills."],
            gapsAndConcerns: ["There may be gaps between your resume and the job requirements."],
            recommendationsToTailor: [
              "Tailor your resume to highlight experience relevant to this position",
              "Incorporate keywords from the job description into your resume"
            ],
            overallFit: "We encountered difficulty analyzing your resume against this job description. Try reviewing both documents to ensure they are well-structured."
          } : null
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
    
    // If it's an error we want to show to the user (like an OpenAI API issue), 
    // create a safe fallback response instead of throwing
    if (error.statusCode === 429 || error.statusCode === 503 || error.statusCode === 500) {
      console.log(`[${new Date().toISOString()}] Creating emergency fallback analysis response`);
      // Return minimal viable analysis with safe fallback values
      return {
        score: 50,
        scores: {
          keywordsRelevance: { score: 5, maxScore: 10, feedback: "Analysis encountered an error", keywords: [] },
          achievementsMetrics: { score: 5, maxScore: 10, feedback: "Analysis encountered an error", highlights: [] },
          structureReadability: { score: 5, maxScore: 10, feedback: "Analysis encountered an error" },
          summaryClarity: { score: 5, maxScore: 10, feedback: "Analysis encountered an error" },
          overallPolish: { score: 5, maxScore: 10, feedback: "Analysis encountered an error" }
        },
        identifiedSkills: [],
        primaryKeywords: [],
        suggestedImprovements: ["Try analyzing your resume again", "Check that your resume is formatted properly"],
        generalFeedback: {
          overall: "We encountered an error analyzing your resume. This might be due to temporary service limitations or issues with the resume format."
        },
        // When job description exists, always provide meaningful job analysis content
        jobAnalysis: jobDescription ? {
          alignmentAndStrengths: ["Your resume may contain skills relevant to this job."],
          gapsAndConcerns: ["Service error prevented detailed gap analysis."],
          recommendationsToTailor: [
            "Try analyzing again with the job description", 
            "Ensure your resume highlights skills mentioned in the job posting",
            "Format your resume clearly to help our AI analyze it better"
          ],
          overallFit: "We encountered a service error while analyzing your job fit. Please try again later."
        } : null
      };
    }
    
    // For other errors, rethrow
    throw error;
  }
}

// Note: Enhanced API request with retry logic and exponential backoff
// has been moved to openai.ts