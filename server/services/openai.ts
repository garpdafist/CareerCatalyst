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

const SYSTEM_PROMPT = `You are an expert resume analyzer. Analyze the provided resume thoroughly and return a JSON object with these EXACT fields:

{
  "score": (overall score 0-100, be conservative - most resumes score 60-75),
  "scores": {
    "keywordsRelevance": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "Detailed feedback about keyword usage",
      "keywords": ["List of found keywords"]
    },
    "achievementsMetrics": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "Analysis of quantifiable achievements",
      "highlights": ["List of key achievements"]
    },
    "structureReadability": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "Analysis of resume structure"
    },
    "summaryClarity": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "Evaluation of professional summary"
    },
    "overallPolish": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "Assessment of overall presentation"
    }
  },
  "identifiedSkills": ["List of technical and soft skills"],
  "primaryKeywords": ["List of important keywords"],
  "suggestedImprovements": ["List of specific improvements needed"],
  "generalFeedback": {
    "overall": "Comprehensive analysis of strengths and weaknesses",
    "strengths": ["List of key strengths"],
    "actionItems": ["List of priority actions"]
  }
}

CRITICAL REQUIREMENTS:
1. Provide detailed feedback for each section
2. Include specific examples from the resume
3. Make feedback actionable and clear
4. Never return empty arrays or generic placeholders
5. Score conservatively - most resumes score 60-75
6. Return ONLY valid JSON`;

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
            content: "Summarize while preserving all key information about skills, experience, and achievements."
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

    // Build the prompt
    let prompt = SYSTEM_PROMPT;
    if (jobDescription) {
      prompt += `\n\nJob Description:\n${jobDescription}\n\nAdditionally, add this to your response:
"jobAnalysis": {
  "alignmentAndStrengths": ["List matches with job requirements"],
  "gapsAndConcerns": ["List gaps or mismatches"],
  "recommendationsToTailor": ["List specific suggestions"],
  "overallFit": "Assessment of overall fit"
}`;
    }

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

    // Log parsed structure before validation
    console.log('Parsed Response Structure:', {
      hasScore: typeof parsedResponse.score === 'number',
      hasScores: !!parsedResponse.scores,
      hasGeneralFeedback: !!parsedResponse.generalFeedback,
      generalFeedbackContent: parsedResponse.generalFeedback,
      timestamp: new Date().toISOString()
    });

    // Validate the response
    return resumeAnalysisResponseSchema.parse(parsedResponse);

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