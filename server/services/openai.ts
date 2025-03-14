import { JobDescription } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

// Response validation schema with more lenient requirements
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100).default(0),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(0).max(10).default(1),
      maxScore: z.literal(10),
      feedback: z.string().default("No keyword analysis available"),
      keywords: z.array(z.string()).default([])
    }).default({}),
    achievementsMetrics: z.object({
      score: z.number().min(0).max(10).default(1),
      maxScore: z.literal(10),
      feedback: z.string().default("No achievement analysis available"),
      highlights: z.array(z.string()).default([])
    }).default({}),
    structureReadability: z.object({
      score: z.number().min(0).max(10).default(1),
      maxScore: z.literal(10),
      feedback: z.string().default("No structure analysis available")
    }).default({}),
    summaryClarity: z.object({
      score: z.number().min(0).max(10).default(1),
      maxScore: z.literal(10),
      feedback: z.string().default("No summary analysis available")
    }).default({}),
    overallPolish: z.object({
      score: z.number().min(0).max(10).default(1),
      maxScore: z.literal(10),
      feedback: z.string().default("No polish analysis available")
    }).default({})
  }).default({}),
  identifiedSkills: z.array(z.string()).default([]),
  primaryKeywords: z.array(z.string()).default([]),
  suggestedImprovements: z.array(z.string()).default([]),
  generalFeedback: z.object({
    overall: z.string().default("No general feedback available"),
    strengths: z.array(z.string()).default(["Professional experience demonstrated", "Educational background present"]),
    actionItems: z.array(z.string()).default(["Add more quantifiable achievements", "Enhance technical skills section"])
  }).default({}),
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
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Analyze keyword usage in detail",
      "keywords": ["List relevant keywords found"]
    },
    "achievementsMetrics": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Analyze quantifiable achievements",
      "highlights": ["List key achievements found"]
    },
    "structureReadability": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Evaluate resume structure and format"
    },
    "summaryClarity": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Assess professional summary"
    },
    "overallPolish": {
      "score": (1-10),
      "maxScore": 10,
      "feedback": "Evaluate overall presentation"
    }
  },
  "identifiedSkills": ["List ALL technical and soft skills found"],
  "primaryKeywords": ["List ALL important keywords found"],
  "suggestedImprovements": ["List specific improvements needed"],
  "generalFeedback": {
    "overall": "Provide comprehensive feedback",
    "strengths": ["List key strengths found"],
    "actionItems": ["List priority actions needed"]
  }
}

Important:
1. Include as many relevant items as possible in each array
2. Provide detailed feedback for each section
3. Don't skip any fields
4. Be specific and actionable in feedback`;

const JOB_ANALYSIS_PROMPT = `Also analyze how well the resume matches these job requirements. Add to your response:

"jobAnalysis": {
  "alignmentAndStrengths": ["List matches with requirements"],
  "gapsAndConcerns": ["List gaps and mismatches"],
  "recommendationsToTailor": ["List specific suggestions"],
  "overallFit": "Assess overall fit for the role"
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

    // Log raw response for debugging
    console.log('Raw AI Response:', {
      content: response.choices[0].message.content,
      timestamp: new Date().toISOString()
    });

    try {
      // Parse and validate response
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      // Log parsed structure
      console.log('Parsed response structure:', {
        hasScores: !!parsedResponse.scores,
        scoreKeys: Object.keys(parsedResponse.scores || {}),
        skillsCount: parsedResponse.identifiedSkills?.length,
        keywordsCount: parsedResponse.primaryKeywords?.length,
        hasGeneralFeedback: !!parsedResponse.generalFeedback,
        timestamp: new Date().toISOString()
      });

      // Use schema with defaults
      return resumeAnalysisResponseSchema.parse(parsedResponse);

    } catch (error) {
      console.error('Response validation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined,
        timestamp: new Date().toISOString()
      });

      // Return default response on error
      return resumeAnalysisResponseSchema.parse({});
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