import { JobDescription, jobDescriptionSchema } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Response validation schema for job-specific analysis
const jobAnalysisSchema = z.object({
  alignmentAndStrengths: z.array(z.string()).min(1),
  gapsAndConcerns: z.array(z.string()).min(1),
  recommendationsToTailor: z.array(z.string()).min(1),
  overallFit: z.string().min(1)
});

// Base resume analysis schema
const baseResumeAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(50),
      keywords: z.array(z.string()).min(3)
    }),
    achievementsMetrics: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(50),
      highlights: z.array(z.string()).min(3)
    }),
    structureReadability: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(50)
    }),
    summaryClarity: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(50)
    }),
    overallPolish: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(50)
    })
  }),
  identifiedSkills: z.array(z.string()).min(3),
  primaryKeywords: z.array(z.string()).min(3),
  suggestedImprovements: z.array(z.string()).min(3),
  generalFeedback: z.object({
    overall: z.string().min(100),
    strengths: z.array(z.string()).min(2),
    actionItems: z.array(z.string()).min(2)
  })
});

// Combined schema with job analysis
const resumeAnalysisResponseSchema = z.object({
  ...baseResumeAnalysisSchema.shape,
  jobAnalysis: jobAnalysisSchema.optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const BASE_SYSTEM_PROMPT = `You are an expert resume analyzer. Analyze the resume and return a JSON response with these exact fields:

{
  "score": (number 0-100, be conservative - most resumes score 60-75),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)",
      "keywords": ["at least 3 keywords"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)",
      "highlights": ["at least 3 achievements"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (min 50 words)"
    }
  },
  "identifiedSkills": ["min 3 specific skills"],
  "primaryKeywords": ["min 3 important keywords"],
  "suggestedImprovements": ["min 3 actionable suggestions"],
  "generalFeedback": {
    "overall": "comprehensive feedback (min 100 words)",
    "strengths": ["2-3 specific strengths"],
    "actionItems": ["2-3 prioritized actions"]
  }
}`;

const JOB_ANALYSIS_PROMPT = `Additionally, analyze how this resume matches the job requirements. Add this section to your JSON response:

"jobAnalysis": {
  "alignmentAndStrengths": ["list specific areas where resume matches job requirements"],
  "gapsAndConcerns": ["list specific mismatches or missing requirements"],
  "recommendationsToTailor": ["specific suggestions to align resume with role"],
  "overallFit": "brief assessment of candidate's suitability for the role"
}

Guidelines for job analysis:
1. Be specific - reference exact requirements from the job description
2. Compare candidate's experience level to requirements
3. Note any missing technical skills or qualifications
4. Provide actionable suggestions for improvement
5. Be direct about fit - don't inflate assessment`;

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
        const processedJobDesc = await preprocessText(jobDescription);
        parsedJobDescription = await parseJobDescription(processedJobDesc);
      } catch (error) {
        console.error('Job description processing error:', error);
        throw new Error(`Failed to process job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Build the complete prompt
    const finalPrompt = parsedJobDescription 
      ? `${BASE_SYSTEM_PROMPT}\n\nJob Description:\nRole: ${parsedJobDescription.roleTitle}\nExperience: ${parsedJobDescription.yearsOfExperience}\nSkills: ${parsedJobDescription.skills?.join(', ')}\nRequirements: ${parsedJobDescription.requirements?.join('\n')}\n\n${JOB_ANALYSIS_PROMPT}`
      : BASE_SYSTEM_PROMPT;

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

    // Parse and validate response
    const parsedResponse = JSON.parse(response.choices[0].message.content.trim());
    return resumeAnalysisResponseSchema.parse(parsedResponse);

  } catch (error) {
    console.error('Resume analysis error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to analyze resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: JOB_ANALYSIS_PROMPT
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return response.choices[0].message.content || 'No analysis generated';
  } catch (error: any) {
    console.error('Resume-job analysis error:', error);
    throw new Error(`Failed to analyze resume against job description: ${error.message}`);
  }
}