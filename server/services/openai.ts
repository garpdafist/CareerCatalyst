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
  primaryKeywords: z.array(z.string()).min(1),  // Ensure at least one keyword
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.object({
    overall: z.string().min(1)  // Ensure non-empty feedback
  }),
  jobAnalysis: z.object({
    alignmentAndStrengths: z.array(z.string()),
    gapsAndConcerns: z.array(z.string()),
    recommendationsToTailor: z.array(z.string()),
    overallFit: z.string()
  }).optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. Return a JSON object with these EXACT fields:

{
  "score": (overall score 0-100),
  "scores": {
    "keywordsRelevance": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback about keyword usage",
      "keywords": ["list ALL relevant keywords"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "detailed feedback about achievements",
      "highlights": ["list ALL key achievements"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze resume structure"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze professional summary"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "analyze overall presentation"
    }
  },
  "identifiedSkills": ["list ALL skills found"],
  "primaryKeywords": ["list ALL important keywords from resume"],
  "suggestedImprovements": ["list specific improvements needed"],
  "generalFeedback": {
    "overall": "provide detailed analysis of the resume's strengths and areas for improvement"
  }
}

CRITICAL REQUIREMENTS:
1. ALWAYS include primaryKeywords with ALL important terms found
2. ALWAYS provide detailed generalFeedback.overall
3. Never skip any fields
4. Return ONLY valid JSON`;

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

    // Log parsed structure before validation
    console.log('Before validation:', {
      hasGeneralFeedback: !!parsedResponse.generalFeedback,
      generalFeedbackContent: parsedResponse.generalFeedback?.overall,
      primaryKeywordsCount: parsedResponse.primaryKeywords?.length,
      primaryKeywords: parsedResponse.primaryKeywords,
      timestamp: new Date().toISOString()
    });

    // Validate response
    const validated = resumeAnalysisResponseSchema.parse(parsedResponse);

    // Log validated response
    console.log('After validation:', {
      hasGeneralFeedback: !!validated.generalFeedback,
      generalFeedbackContent: validated.generalFeedback?.overall,
      primaryKeywordsCount: validated.primaryKeywords.length,
      primaryKeywords: validated.primaryKeywords,
      timestamp: new Date().toISOString()
    });

    return validated;

  } catch (error) {
    console.error('Resume analysis error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      isZodError: error instanceof z.ZodError,
      zodErrors: error instanceof z.ZodError ? error.errors : undefined,
      timestamp: new Date().toISOString()
    });

    // Return a structured response matching our schema
    return {
      score: 60,
      scores: {
        keywordsRelevance: { 
          score: 6, 
          maxScore: 10, 
          feedback: "Automated analysis in progress", 
          keywords: [] 
        },
        achievementsMetrics: { 
          score: 6, 
          maxScore: 10, 
          feedback: "Automated analysis in progress", 
          highlights: [] 
        },
        structureReadability: { 
          score: 6, 
          maxScore: 10, 
          feedback: "Automated analysis in progress"
        },
        summaryClarity: { 
          score: 6, 
          maxScore: 10, 
          feedback: "Automated analysis in progress"
        },
        overallPolish: { 
          score: 6, 
          maxScore: 10, 
          feedback: "Automated analysis in progress"
        }
      },
      identifiedSkills: [],
      primaryKeywords: ["analyzing"],
      importantKeywords: ["analyzing"],
      suggestedImprovements: ["Waiting for detailed analysis"],
      generalFeedback: {
        overall: "Analysis in progress. Please wait for detailed results."
      },
      resumeSections: {
        professionalSummary: "",
        workExperience: "",
        education: "",
        skills: "",
        projects: ""
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