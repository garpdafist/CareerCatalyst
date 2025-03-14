import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

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
  identifiedSkills: z.array(z.string()).min(5),
  primaryKeywords: z.array(z.string()).min(5),
  suggestedImprovements: z.array(z.string()).min(3),
  generalFeedback: z.object({
    overall: z.string().min(100),
    strengths: z.array(z.string()).min(2),
    actionItems: z.array(z.string()).min(2)
  }),
  jobAnalysis: z.object({
    alignmentAndStrengths: z.array(z.string()).min(1),
    gapsAndConcerns: z.array(z.string()).min(1),
    recommendationsToTailor: z.array(z.string()).min(1),
    overallFit: z.string().min(50)
  }).optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. You MUST provide a comprehensive analysis in JSON format containing EXACTLY these fields:

{
  "score": (number between 0-100, be conservative - most resumes score 60-75),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback about keyword usage (minimum 50 words)",
      "keywords": ["REQUIRED: at least 5 relevant industry keywords found"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback about achievements (minimum 50 words)",
      "highlights": ["REQUIRED: at least 3 quantifiable achievements"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback about structure (minimum 50 words)"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback about summary (minimum 50 words)"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback about presentation (minimum 50 words)"
    }
  },
  "identifiedSkills": ["REQUIRED: at least 5 specific skills found in resume"],
  "primaryKeywords": ["REQUIRED: at least 5 important keywords from resume"],
  "suggestedImprovements": ["REQUIRED: at least 3 specific, actionable improvements"],
  "generalFeedback": {
    "overall": "comprehensive analysis of the resume (minimum 100 words)",
    "strengths": ["REQUIRED: 2-3 specific key strengths with examples"],
    "actionItems": ["REQUIRED: 2-3 specific priority actions"]
  }
}

CRITICAL REQUIREMENTS:
1. Every field marked as REQUIRED must contain the minimum number of items specified
2. All feedback text must meet minimum word counts
3. Never return empty arrays or placeholder text
4. Be specific and actionable in all feedback
5. Include exact phrases or sections from the resume in your feedback
6. For missing or weak areas, suggest specific improvements`;

const JOB_ANALYSIS_PROMPT = `Additionally, analyze how well this resume matches the job requirements. Add this to your response:

"jobAnalysis": {
  "alignmentAndStrengths": ["at least 3 specific matches with job requirements"],
  "gapsAndConcerns": ["at least 3 specific gaps or mismatches"],
  "recommendationsToTailor": ["at least 3 specific suggestions to align with role"],
  "overallFit": "detailed assessment of candidate fit (minimum 50 words)"
}

Your job analysis must:
1. Reference specific requirements from the job description
2. Point out exact matches and mismatches
3. Provide actionable suggestions
4. Be direct about fit - don't inflate assessment`;

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
            content: "Summarize this text while preserving key information about skills, experience, achievements, and metrics. Keep all dates and specific technical terms."
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
    return text;
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

    const prompt = jobDescription
      ? `${SYSTEM_PROMPT}\n\nJob Description:\n${jobDescription}\n\n${JOB_ANALYSIS_PROMPT}`
      : SYSTEM_PROMPT;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: processedContent }
      ],
      temperature: 0.2, // Slightly increased for more varied responses
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
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      // Log parsed structure before validation
      console.log('Initial parsed response structure:', {
        hasScore: typeof parsedResponse.score === 'number',
        hasScores: !!parsedResponse.scores,
        skillsCount: parsedResponse.identifiedSkills?.length || 0,
        keywordsCount: parsedResponse.primaryKeywords?.length || 0,
        improvementsCount: parsedResponse.suggestedImprovements?.length || 0,
        timestamp: new Date().toISOString()
      });

      // Validate against schema
      return resumeAnalysisResponseSchema.parse(parsedResponse);

    } catch (error) {
      console.error('Response validation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to validate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
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