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
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds in milliseconds

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

const ANALYSIS_MODEL = "gpt-3.5-turbo"; // Define the model to use here.  This should be configured elsewhere ideally

export async function analyzeResumeWithAI(content: string): Promise<ResumeAnalysisResponse> {
  try {
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key missing');
      throw new Error('OpenAI API key is not configured');
    }

    // Log analysis start
    console.log('Starting resume analysis:', {
      contentLength: content.length,
      hasApiKey: !!process.env.OPENAI_API_KEY
    });

    await waitForRateLimit();

    const response = await openai.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: `You are an expert resume analyzer who provides constructive feedback to improve job application documents. Analyze the resume content and respond with a JSON object containing:
{
  "score": a number from 0-100 representing the overall quality,
  "feedback": an array of strings with general feedback about the resume,
  "skills": an array of strings identifying technical and soft skills present,
  "improvements": an array of strings with specific improvement suggestions,
  "keywords": an array of important industry keywords found,
  "structuredContent": {
    "summary": extracted professional summary,
    "experience": array of work experiences,
    "education": array of education entries,
    "skills": array of skills mentioned,
    "certifications": array of certifications if present,
    "projects": array of objects
  }
}`
        },
        {
          role: "user",
          content: `Analyze this resume and provide detailed feedback with the following structure:

${content}`
        }
      ],
      temperature: 0.7
      // The response_format parameter was removed as it's not compatible with all models
    });

    // Log API response
    console.log('OpenAI API response received:', {
      status: 'success',
      responseId: response.id,
      model: response.model,
      hasContent: !!response.choices[0]?.message?.content
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Parse the response content
    try {
      // Clean the response to handle potential markdown code blocks
      let jsonContent = content.trim();

      // Remove any markdown code block indicators if present
      if (jsonContent.startsWith("```json")) {
        jsonContent = jsonContent.substring(7);
      } else if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.substring(3);
      }

      if (jsonContent.endsWith("```")) {
        jsonContent = jsonContent.substring(0, jsonContent.length - 3);
      }

      jsonContent = jsonContent.trim();

      const parsedData = JSON.parse(jsonContent);

      // Validate response structure
      const validatedResponse = resumeAnalysisResponseSchema.parse(parsedData);

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
        response: content.substring(0, 200) + '...'
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