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

// Rate limiting function
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

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

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

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert resume analyzer. Analyze resumes based on these criteria:

1. Relevance & Targeting (20%): How well the resume matches intended roles
2. Achievements & Metrics (25%): Quantifiable results and impact
3. Structure & Organization (15%): Logical flow and readability
4. Summary (10%): Clear and impactful professional summary
5. Skills (10%): Relevant technical and soft skills
6. Education (5%): Academic qualifications and relevance
7. Formatting/ATS (10%): ATS compatibility and clean formatting
8. Professional Tone (5%): Appropriate language and presentation

Return a JSON response with exact scores and feedback for each criterion.`
        },
        {
          role: "user",
          content: `Analyze this resume and provide detailed scores and feedback:

${content}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    console.log('OpenAI API response received:', {
      status: 'success',
      responseId: response.id,
      model: response.model,
      hasContent: !!response.choices[0]?.message?.content
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('OpenAI returned an empty response');
    }

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
      console.error('Response parsing/validation error:', {
        error: parseError.message,
        response: responseContent.substring(0, 200) + '...'
      });
      throw new Error('Failed to parse OpenAI response: ' + parseError.message);
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
      throw new Error('Authentication failed. Please try again or contact support.');
    } else {
      throw new Error(`Failed to analyze resume: ${error.message}`);
    }
  }
}