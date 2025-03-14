import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Response validation schema with more lenient validation
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string(),
      keywords: z.array(z.string())
    }).optional(),
    achievementsMetrics: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string(),
      highlights: z.array(z.string())
    }).optional(),
    structureReadability: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    }).optional(),
    summaryClarity: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    }).optional(),
    overallPolish: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    }).optional()
  }).optional(),
  identifiedSkills: z.array(z.string()).optional(),
  primaryKeywords: z.array(z.string()).optional(),
  suggestedImprovements: z.array(z.string()).optional(),
  generalFeedback: z.object({
    overall: z.string()
  }).optional(),
  jobAnalysis: z.object({
    alignmentAndStrengths: z.array(z.string()),
    gapsAndConcerns: z.array(z.string()),
    recommendationsToTailor: z.array(z.string()),
    overallFit: z.string()
  }).optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. Return a JSON object with these fields:

{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed keyword analysis",
      "keywords": ["found keywords"]
    },
    "achievementsMetrics": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed achievement analysis",
      "highlights": ["key achievements"]
    },
    "structureReadability": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "structure analysis"
    },
    "summaryClarity": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "summary analysis"
    },
    "overallPolish": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "polish analysis"
    }
  },
  "identifiedSkills": ["found skills"],
  "primaryKeywords": ["important keywords"],
  "suggestedImprovements": ["suggested improvements"],
  "generalFeedback": {
    "overall": "comprehensive feedback"
  }
}`;

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
            content: "Summarize while preserving key information about skills, experience, and achievements."
          },
          { role: "user", content: chunk }
        ],
        temperature: 0
      });
      return response.choices[0].message.content || '';
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
      prompt += `\n\nAlso analyze against this job description:\n${jobDescription}\n\nAdd this to your response:
"jobAnalysis": {
  "alignmentAndStrengths": ["matching requirements"],
  "gapsAndConcerns": ["gaps found"],
  "recommendationsToTailor": ["recommendations"],
  "overallFit": "fit assessment"
}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
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

    const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

    // Log parsed structure for debugging
    console.log('Parsed Response Structure:', {
      hasScore: typeof parsedResponse.score === 'number',
      hasScores: typeof parsedResponse.scores === 'object',
      hasKeywordsRelevance: !!parsedResponse.scores?.keywordsRelevance,
      identifiedSkillsLength: parsedResponse.identifiedSkills?.length,
      primaryKeywordsLength: parsedResponse.primaryKeywords?.length,
      generalFeedbackOverall: parsedResponse.generalFeedback?.overall?.substring(0, 50),
      timestamp: new Date().toISOString()
    });

    // Validate response
    const validated = resumeAnalysisResponseSchema.parse(parsedResponse);
    return validated;

  } catch (error) {
    console.error('Resume analysis error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      isZodError: error instanceof z.ZodError,
      zodErrors: error instanceof z.ZodError ? error.errors : undefined,
      timestamp: new Date().toISOString()
    });

    // Return a minimal valid response instead of throwing
    return {
      score: 60,
      generalFeedback: {
        overall: "Analysis currently unavailable. Please try again."
      }
    };
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
          content: "Provide a detailed analysis of how well the resume matches the job description. Focus on skill matches, experience alignment, and areas for improvement."
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