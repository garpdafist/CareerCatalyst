import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Basic schema without defaults or minimums
const resumeAnalysisResponseSchema = z.object({
  score: z.number(),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string(),
      keywords: z.array(z.string())
    }),
    achievementsMetrics: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string(),
      highlights: z.array(z.string())
    }),
    structureReadability: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string()
    }),
    summaryClarity: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string()
    }),
    overallPolish: z.object({
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string()
    })
  }),
  identifiedSkills: z.array(z.string()),
  primaryKeywords: z.array(z.string()),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.object({
    overall: z.string(),
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

const SYSTEM_PROMPT = `You are an expert resume analyzer. Analyze the provided resume carefully and return a JSON response with EXACTLY these fields:

{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "analyze keyword usage in detail",
      "keywords": ["list ALL relevant keywords found"]
    },
    "achievementsMetrics": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "analyze quantifiable achievements",
      "highlights": ["list ALL achievements found"]
    },
    "structureReadability": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "analyze resume structure"
    },
    "summaryClarity": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "analyze professional summary"
    },
    "overallPolish": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "analyze overall presentation"
    }
  },
  "identifiedSkills": ["list ALL technical and soft skills found"],
  "primaryKeywords": ["list ALL important keywords found"],
  "suggestedImprovements": ["list ALL specific improvements needed"],
  "generalFeedback": {
    "overall": "provide detailed analysis of strengths and weaknesses",
    "strengths": ["list ALL key strengths found"],
    "actionItems": ["list ALL priority actions needed"]
  }
}

CRITICAL REQUIREMENTS:
1. Return ALL fields exactly as shown
2. Include as many items as possible in each array
3. Provide detailed feedback in each section
4. Don't skip any fields
5. Return ONLY valid JSON`;

const JOB_ANALYSIS_PROMPT = `Also analyze how well the resume matches the job requirements. Add to your response:

"jobAnalysis": {
  "alignmentAndStrengths": ["list ALL matches with requirements"],
  "gapsAndConcerns": ["list ALL gaps and mismatches"],
  "recommendationsToTailor": ["list ALL specific suggestions"],
  "overallFit": "provide detailed assessment of fit"
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
            content: "Summarize while keeping all key information about skills, experience, and achievements."
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

    // Log the constructed prompt
    console.log('Analysis prompt:', {
      prompt,
      timestamp: new Date().toISOString()
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: processedContent }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Log the raw API response
    console.log('Raw OpenAI Response:', {
      content: response.choices[0].message.content,
      timestamp: new Date().toISOString()
    });

    try {
      // Parse response and log the structure
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      console.log('Parsed Response Structure:', {
        hasScore: typeof parsedResponse.score === 'number',
        hasScores: typeof parsedResponse.scores === 'object',
        hasKeywordsRelevance: !!parsedResponse.scores?.keywordsRelevance,
        hasAchievementsMetrics: !!parsedResponse.scores?.achievementsMetrics,
        hasStructureReadability: !!parsedResponse.scores?.structureReadability,
        hasSummaryClarity: !!parsedResponse.scores?.summaryClarity,
        hasOverallPolish: !!parsedResponse.scores?.overallPolish,
        identifiedSkillsCount: parsedResponse.identifiedSkills?.length,
        primaryKeywordsCount: parsedResponse.primaryKeywords?.length,
        suggestedImprovementsCount: parsedResponse.suggestedImprovements?.length,
        hasGeneralFeedback: typeof parsedResponse.generalFeedback === 'object',
        generalFeedbackKeys: Object.keys(parsedResponse.generalFeedback || {}),
        hasJobAnalysis: typeof parsedResponse.jobAnalysis === 'object',
        timestamp: new Date().toISOString()
      });

      // Validate against schema
      return resumeAnalysisResponseSchema.parse(parsedResponse);

    } catch (error) {
      console.error('Response processing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined,
        zodErrorDetails: error instanceof z.ZodError ? JSON.stringify(error.errors, null, 2) : undefined,
        timestamp: new Date().toISOString()
      });
      throw error; // Re-throw to see the actual error
    }
  } catch (error) {
    console.error('Resume analysis error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw error; // Re-throw to see the actual error
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