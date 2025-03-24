import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Basic validation schema with required fields
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

const SYSTEM_PROMPT = `You are an expert resume analyzer. Analyze the resume and return a JSON object with EXACTLY these fields:

{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze keywords",
      "keywords": ["found keywords"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze achievements",
      "highlights": ["found achievements"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze structure"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze summary"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze polish"
    }
  },
  "identifiedSkills": ["found skills"],
  "primaryKeywords": ["found keywords"],
  "suggestedImprovements": ["found improvements"],
  "generalFeedback": {
    "overall": "general analysis feedback"
  }
}

Critical: You MUST include primaryKeywords and generalFeedback.overall in your response.`;

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
      prompt += `\n\nAnalyze against this job description:\n${jobDescription}\n\nAdd this to your response:
"jobAnalysis": {
  "alignmentAndStrengths": ["matches"],
  "gapsAndConcerns": ["gaps"],
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

    // Log raw response and parsed structure
    const rawResponse = response.choices[0].message.content;
    console.log('Raw OpenAI Response:', {
      content: rawResponse,
      timestamp: new Date().toISOString()
    });

    const parsedResponse = JSON.parse(rawResponse.trim());

    // Log parsed response before validation
    console.log('Parsed Response Structure:', {
      hasGeneralFeedback: !!parsedResponse.generalFeedback,
      generalFeedbackContent: parsedResponse.generalFeedback?.overall,
      hasPrimaryKeywords: !!parsedResponse.primaryKeywords,
      primaryKeywordsCount: parsedResponse.primaryKeywords?.length,
      primaryKeywords: parsedResponse.primaryKeywords,
      timestamp: new Date().toISOString()
    });

    // Clean and validate the response
    const cleanedResponse = {
      ...parsedResponse,
      primaryKeywords: Array.isArray(parsedResponse.primaryKeywords) ? parsedResponse.primaryKeywords : [],
      generalFeedback: {
        overall: parsedResponse.generalFeedback?.overall || "No feedback available"
      }
    };

    // Validate and return
    return resumeAnalysisResponseSchema.parse(cleanedResponse);

  } catch (error) {
    console.error('Resume analysis error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      isZodError: error instanceof z.ZodError,
      zodErrors: error instanceof z.ZodError ? error.errors : undefined,
      timestamp: new Date().toISOString()
    });

    // Return basic response on error
    return {
      score: 60,
      scores: {
        keywordsRelevance: { score: 1, maxScore: 10, feedback: "Analysis unavailable", keywords: [] },
        achievementsMetrics: { score: 1, maxScore: 10, feedback: "Analysis unavailable", highlights: [] },
        structureReadability: { score: 1, maxScore: 10, feedback: "Analysis unavailable" },
        summaryClarity: { score: 1, maxScore: 10, feedback: "Analysis unavailable" },
        overallPolish: { score: 1, maxScore: 10, feedback: "Analysis unavailable" }
      },
      identifiedSkills: [],
      primaryKeywords: ["Analysis unavailable"],
      suggestedImprovements: [],
      generalFeedback: {
        overall: "Analysis unavailable"
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