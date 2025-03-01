import OpenAI from "openai";
import { z } from "zod";
import { resumeContentSchema, scoringCriteriaSchema, type ResumeContent, type ScoringCriteria } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.array(z.string()),
  skills: z.array(z.string()),
  improvements: z.array(z.string()),
  keywords: z.array(z.string()),
  structuredContent: resumeContentSchema,
  scoringCriteria: scoringCriteriaSchema
});

export type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 210; // 0.21 seconds in milliseconds

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

export async function analyzeResumeWithAI(content: string): Promise<ResumeAnalysisResponse> {
  try {
    await waitForRateLimit();

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const systemPrompt = `You are an expert resume analyzer. Analyze resumes and provide detailed feedback with specific scoring criteria. ALWAYS return a complete JSON response with ALL required fields.

Required fields and their format:
{
  "score": (number between 0-100),
  "feedback": (array of strings with general feedback),
  "skills": (array of strings listing identified skills),
  "improvements": (array of strings with specific suggestions),
  "keywords": (array of relevant industry keywords),
  "scoringCriteria": {
    "keywordUsage": {
      "score": (number out of 20),
      "maxScore": 20,
      "feedback": (specific feedback string),
      "keywords": (array of found keywords)
    },
    "metricsAndAchievements": {
      "score": (number out of 30),
      "maxScore": 30,
      "feedback": (specific feedback string),
      "highlights": (array of achievements)
    },
    "structureAndReadability": {
      "score": (number out of 25),
      "maxScore": 25,
      "feedback": (specific feedback string)
    },
    "overallImpression": {
      "score": (number out of 25),
      "maxScore": 25,
      "feedback": (specific feedback string)
    }
  },
  "structuredContent": {
    "professionalSummary": (string),
    "workExperience": [{
      "company": (string),
      "position": (string),
      "duration": (string),
      "achievements": (array of strings)
    }],
    "technicalSkills": (array of strings),
    "education": [{
      "institution": (string),
      "degree": (string),
      "year": (string)
    }],
    "certifications": (optional array of strings),
    "projects": (optional array of project objects)
  }
}`;

    const userPrompt = `Analyze this resume content and provide a complete analysis with ALL required fields as specified. If any section of the resume is missing, provide appropriate feedback about the missing information:

${content}`;

    console.log('Making OpenAI request with content length:', content.length);

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4", // Fixed model name
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        });

        const responseContent = response.choices[0].message.content;
        if (!responseContent) {
          throw new Error('OpenAI returned an empty response');
        }

        console.log('OpenAI raw response:', {
          contentLength: responseContent.length,
          preview: responseContent.substring(0, 200) + '...'
        });

        let parsedResponse;
        try {
          parsedResponse = JSON.parse(responseContent);
          console.log('Parsed response structure:', {
            hasScore: 'score' in parsedResponse,
            hasFeedback: Array.isArray(parsedResponse.feedback),
            hasSkills: Array.isArray(parsedResponse.skills),
            hasScoringCriteria: typeof parsedResponse.scoringCriteria === 'object',
            hasStructuredContent: typeof parsedResponse.structuredContent === 'object'
          });
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          throw new Error('Failed to parse OpenAI response as JSON');
        }

        const validatedResponse = resumeAnalysisResponseSchema.parse(parsedResponse);
        return validatedResponse;

      } catch (error: any) {
        lastError = error;
        console.error(`OpenAI API Error (attempt ${retryCount + 1}/${maxRetries}):`, {
          message: error.message,
          type: error.constructor.name,
          status: error.status,
          details: error.response?.data
        });

        if (error.status === 429 || error.status === 503) {
          // Rate limit or service temporarily unavailable, retry after delay
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        }

        // Don't retry other types of errors
        break;
      }
    }

    // If we get here, all retries failed
    if (lastError.status === 429) {
      throw new Error('Service is experiencing high load. Please try again in a few moments.');
    } else if (lastError.status === 401 || lastError.status === 403) {
      throw new Error('API authentication failed. Please try again or contact support.');
    } else {
      throw new Error(`Failed to analyze resume: ${lastError.message}`);
    }

  } catch (error: any) {
    console.error('Final OpenAI API Error:', {
      message: error.message,
      type: error.constructor.name,
      status: error.status,
      details: error.response?.data
    });
    throw error;
  }
}