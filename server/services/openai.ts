import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Base validation schema
const baseScoreSchema = {
  score: z.number().min(1).max(10),
  maxScore: z.literal(10),
  feedback: z.string().min(1)
};

// Response validation schema
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      ...baseScoreSchema,
      keywords: z.array(z.string())
    }),
    achievementsMetrics: z.object({
      ...baseScoreSchema,
      highlights: z.array(z.string())
    }),
    structureReadability: z.object(baseScoreSchema),
    summaryClarity: z.object(baseScoreSchema),
    overallPolish: z.object(baseScoreSchema)
  }),
  identifiedSkills: z.array(z.string()),
  primaryKeywords: z.array(z.string()),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.object({
    overall: z.string().min(1),
    strengths: z.array(z.string()),
    actionItems: z.array(z.string())
  }),
  jobAnalysis: z.object({
    alignmentAndStrengths: z.array(z.string()),
    gapsAndConcerns: z.array(z.string()),
    recommendationsToTailor: z.array(z.string()),
    overallFit: z.string()
  }).optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

// Default values
const defaultScoreSection = {
  score: 1,
  maxScore: 10,
  feedback: "No analysis available"
};

const defaultResponse = {
  score: 0,
  scores: {
    keywordsRelevance: { ...defaultScoreSection, keywords: [] },
    achievementsMetrics: { ...defaultScoreSection, highlights: [] },
    structureReadability: defaultScoreSection,
    summaryClarity: defaultScoreSection,
    overallPolish: defaultScoreSection
  },
  identifiedSkills: [],
  primaryKeywords: [],
  suggestedImprovements: [],
  generalFeedback: {
    overall: "No feedback available",
    strengths: [],
    actionItems: []
  }
};

const SYSTEM_PROMPT = `You are an expert resume analyzer. Return ONLY a JSON object with these EXACT fields:

{
  "score": (number between 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback",
      "keywords": ["relevant keywords"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback",
      "highlights": ["key achievements"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback"
    }
  },
  "identifiedSkills": ["list of skills"],
  "primaryKeywords": ["important keywords"],
  "suggestedImprovements": ["improvement suggestions"],
  "generalFeedback": {
    "overall": "detailed feedback",
    "strengths": ["key strengths"],
    "actionItems": ["action items"]
  }
}

CRITICAL REQUIREMENTS:
1. ALL fields shown above are required
2. Never omit any field in the scores object
3. Always include summaryClarity and overallPolish
4. For any missing data, use these defaults:
   - For scores: use score=1 and feedback="No analysis available"
   - For arrays: use empty array []
   - For strings: use "No data available"
5. Return ONLY valid JSON`;

const JOB_ANALYSIS_PROMPT = `Additionally, analyze how this resume matches the job requirements. Add this to your JSON response:

"jobAnalysis": {
  "alignmentAndStrengths": ["specific matches with job requirements"],
  "gapsAndConcerns": ["specific mismatches or gaps"],
  "recommendationsToTailor": ["specific suggestions to align with role"],
  "overallFit": "assessment of candidate fit"
}`;

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
            content: "Summarize this text while preserving key information about skills, experience, and achievements."
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

// Main analysis function
export async function analyzeResumeWithAI(
  content: string,
  jobDescription?: string
): Promise<ResumeAnalysisResponse> {
  try {
    const processedContent = await preprocessText(content);

    let prompt = SYSTEM_PROMPT;
    if (jobDescription) {
      const processedJobDesc = await preprocessText(jobDescription);
      prompt = `${SYSTEM_PROMPT}\n\nJob Description:\n${processedJobDesc}\n\n${JOB_ANALYSIS_PROMPT}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: processedContent }
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
      // Parse response and merge with defaults
      const parsedResponse = JSON.parse(response.choices[0].message.content);
      const enhancedResponse = {
        ...defaultResponse,
        ...parsedResponse,
        scores: {
          ...defaultResponse.scores,
          ...parsedResponse.scores
        },
        generalFeedback: {
          ...defaultResponse.generalFeedback,
          ...parsedResponse.generalFeedback
        }
      };

      // Validate final response
      return resumeAnalysisResponseSchema.parse(enhancedResponse);

    } catch (error) {
      console.error('Response processing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined
      });
      throw new Error(`Failed to process AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Resume analysis error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
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