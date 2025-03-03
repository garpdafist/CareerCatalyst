import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scoringCriteria: z.object({
    relevanceAndTargeting: z.object({
      score: z.number(),
      maxScore: z.literal(20),
      feedback: z.string()
    }),
    achievementsAndMetrics: z.object({
      score: z.number(),
      maxScore: z.literal(25),
      feedback: z.string()
    }),
    structureAndOrganization: z.object({
      score: z.number(),
      maxScore: z.literal(15),
      feedback: z.string()
    }),
    summary: z.object({
      score: z.number(),
      maxScore: z.literal(10),
      feedback: z.string()
    }),
    skills: z.object({
      score: z.number(),
      maxScore: z.literal(10),
      feedback: z.string()
    }),
    education: z.object({
      score: z.number(),
      maxScore: z.literal(5),
      feedback: z.string()
    }),
    formattingAndATS: z.object({
      score: z.number(),
      maxScore: z.literal(10),
      feedback: z.string()
    }),
    professionalTone: z.object({
      score: z.number(),
      maxScore: z.literal(5),
      feedback: z.string()
    })
  }),
  structuredContent: z.object({
    professionalSummary: z.string(),
    workExperience: z.array(z.object({
      company: z.string(),
      position: z.string(),
      duration: z.string(),
      achievements: z.array(z.string())
    })),
    technicalSkills: z.array(z.string()),
    education: z.array(z.object({
      institution: z.string(),
      degree: z.string(),
      year: z.string()
    })),
    certifications: z.array(z.string()).optional(),
    projects: z.array(z.object({
      name: z.string(),
      description: z.string(),
      technologies: z.array(z.string())
    })).optional()
  }),
  feedback: z.array(z.string()),
  skills: z.array(z.string()),
  improvements: z.array(z.string()),
  keywords: z.array(z.string())
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200;

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

export async function analyzeResumeWithAI(content: string): Promise<ResumeAnalysisResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key missing');
      throw new Error('OpenAI API key is not configured');
    }

    console.log('Starting resume analysis:', {
      contentLength: content.length,
      hasApiKey: !!process.env.OPENAI_API_KEY
    });

    await waitForRateLimit();

    const systemPrompt = `You are an expert resume analyzer. Return ONLY a JSON object with no additional text. The JSON must follow this exact format:
{
  "score": number (0-100),
  "scoringCriteria": {
    "relevanceAndTargeting": { "score": number, "maxScore": 20, "feedback": string },
    "achievementsAndMetrics": { "score": number, "maxScore": 25, "feedback": string },
    "structureAndOrganization": { "score": number, "maxScore": 15, "feedback": string },
    "summary": { "score": number, "maxScore": 10, "feedback": string },
    "skills": { "score": number, "maxScore": 10, "feedback": string },
    "education": { "score": number, "maxScore": 5, "feedback": string },
    "formattingAndATS": { "score": number, "maxScore": 10, "feedback": string },
    "professionalTone": { "score": number, "maxScore": 5, "feedback": string }
  },
  "structuredContent": {
    "professionalSummary": string,
    "workExperience": array of objects with company, position, duration, and achievements,
    "technicalSkills": array of strings,
    "education": array of objects with institution, degree, and year
  },
  "feedback": array of strings,
  "skills": array of strings,
  "improvements": array of strings,
  "keywords": array of strings
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analyze this resume and return only a JSON object with the exact structure specified. Do not include any text outside the JSON:

${content}`
        }
      ],
      temperature: 0.7
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    let responseContent = response.choices[0].message.content.trim();

    responseContent = responseContent.replace(/```json\n?|\n?```/g, '').trim();

    console.log('Attempting to parse response:', {
      responseLength: responseContent.length,
      firstChars: responseContent.substring(0, 50)
    });

    try {
      const parsedResponse = JSON.parse(responseContent);
      const validatedResponse = resumeAnalysisResponseSchema.parse(parsedResponse);

      console.log('Analysis completed successfully:', {
        score: validatedResponse.score,
        skillsCount: validatedResponse.skills.length,
        hasStructuredContent: !!validatedResponse.structuredContent,
        hasScoringCriteria: !!validatedResponse.scoringCriteria
      });

      return validatedResponse;
    } catch (parseError: any) {
      console.error('Response parsing error:', {
        error: parseError.message,
        response: responseContent.substring(0, 200)
      });
      throw new Error('Failed to parse OpenAI response');
    }

  } catch (error: any) {
    console.error('OpenAI API Error:', {
      message: error.message,
      status: error.status,
      type: error.constructor.name
    });

    if (error.status === 429) {
      throw new Error('Service is temporarily busy. Please try again in a few moments.');
    } else if (error.status === 401 || error.status === 403) {
      throw new Error('Authentication failed. Please check your API key configuration.');
    } else {
      throw new Error(`Resume analysis failed: ${error.message}`);
    }
  }
}