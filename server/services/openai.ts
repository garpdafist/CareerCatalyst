import OpenAI from "openai";
import { z } from "zod";
import { parseJobDescription, analyzeResumeWithJobDescription } from "./job-description";
import type { JobDescription } from "@shared/schema";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Chunk and summarize long text
async function preprocessText(text: string): Promise<string> {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  try {
    const chunks = text.match(/.{1,12000}/g) || [];
    const summaries = await Promise.all(chunks.map(async (chunk) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", 
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

// Response validation schema
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(50),
      keywords: z.array(z.string()).min(8)
    }),
    achievementsMetrics: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(50),
      highlights: z.array(z.string()).min(5)
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
  resumeSections: z.object({
    professionalSummary: z.string().min(100),
    workExperience: z.string().min(150),
    technicalSkills: z.string().min(100),
    education: z.string().min(50),
    keyAchievements: z.string().min(100)
  }),
  identifiedSkills: z.array(z.string()).min(10),
  importantKeywords: z.array(z.string()).min(8),
  suggestedImprovements: z.array(z.string()).min(5),
  generalFeedback: z.string().min(200),
  jobSpecificFeedback: z.string().optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. Extract meaningful insights and provide detailed feedback. Return ONLY a JSON object with these exact fields:

{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Specific feedback about keyword usage and industry alignment",
      "keywords": ["list of identified keywords, minimum 8"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Analysis of quantifiable achievements and impact",
      "highlights": ["key achievements found, minimum 5"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Analysis of resume structure and format"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Evaluation of professional summary effectiveness"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Assessment of overall professional presentation"
    }
  },
  "resumeSections": {
    "professionalSummary": "Analysis of career summary and objectives",
    "workExperience": "Detailed review of work history and accomplishments",
    "technicalSkills": "Evaluation of technical competencies",
    "education": "Analysis of educational background",
    "keyAchievements": "Notable career highlights and accomplishments"
  },
  "identifiedSkills": ["Extract at least 10 specific skills"],
  "importantKeywords": ["List minimum 8 important terms"],
  "suggestedImprovements": ["Provide at least 5 actionable suggestions"],
  "generalFeedback": "Comprehensive feedback (minimum 200 words)"
}

Requirements:
1. Each feedback field must provide specific examples from the resume
2. Feedback sections should be actionable and detailed (minimum 50 words each)
3. Include metrics and specific achievements where found
4. Keep feedback professional and constructive
5. Analyze both technical skills and soft skills
6. Return ONLY the JSON object, no additional text`;

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
    console.log('Content processed:', {
      originalLength: content.length,
      processedLength: processedContent.length,
      wasChunked: content.length !== processedContent.length
    });

    // Parse job description if provided
    let parsedJobDescription: JobDescription | undefined;
    if (jobDescription) {
      try {
        parsedJobDescription = await parseJobDescription(jobDescription);
        console.log('Job description parsed:', {
          roleTitle: parsedJobDescription.roleTitle,
          skillsCount: parsedJobDescription.skills?.length || 0
        });
      } catch (error) {
        console.error('Job description parsing failed:', error);
        throw new Error(`Failed to parse job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Build the complete prompt
    const jobContext = parsedJobDescription ? `
Additionally, analyze how well this resume matches these job requirements:
- Role: ${parsedJobDescription.roleTitle}
- Experience Required: ${parsedJobDescription.yearsOfExperience}
- Industry: ${parsedJobDescription.industry}
- Required Skills: ${parsedJobDescription.skills?.join(', ')}
- Key Requirements: ${parsedJobDescription.requirements?.join('\n')}

Focus on:
1. Skills match and gaps
2. Experience level alignment
3. Industry relevance
4. Role-specific improvements` : '';

    const finalPrompt = SYSTEM_PROMPT + jobContext;

    // Make the API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
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

    try {
      // Parse and validate response
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      // Get job-specific analysis if needed
      if (parsedJobDescription) {
        const jobAnalysis = await analyzeResumeWithJobDescription(processedContent, parsedJobDescription);
        parsedResponse.jobSpecificFeedback = jobAnalysis;
      }

      // Validate against schema
      return resumeAnalysisResponseSchema.parse(parsedResponse);

    } catch (error) {
      console.error('Response parsing/validation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to process AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
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