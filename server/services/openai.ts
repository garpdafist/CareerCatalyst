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

const systemPrompt = `You are an expert resume analyzer. Analyze resumes and provide detailed feedback with specific scoring criteria. ALWAYS return a complete JSON response with ALL required fields, even if they're empty arrays.

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
    "certifications": (array of strings - MUST be included even if empty),
    "projects": (array of project objects - MUST be included even if empty)
  }
}

IMPORTANT: 
1. Every array field MUST be present, even if empty. Never return undefined for arrays.
2. For any missing data, use empty arrays ([]) instead of undefined or null.
3. Both "certifications" and "projects" fields MUST be included as arrays, even if empty.
4. All "keywords", "highlights", and "achievements" arrays MUST be included, never omitted.

Example valid response structure (partial):
{
  "score": 85,
  "feedback": ["Good professional experience", "Clear educational background"],
  "skills": ["JavaScript", "React"],
  "improvements": ["Add more metrics"],
  "keywords": ["web development", "frontend"],
  "scoringCriteria": {
    "keywordUsage": {
      "score": 15,
      "maxScore": 20,
      "feedback": "Good keyword usage",
      "keywords": ["javascript", "react"]
    },
    ...
  },
  "structuredContent": {
    ...
    "certifications": [],
    "projects": []
  }
}`;

export async function analyzeResumeWithAI(content: string): Promise<ResumeAnalysisResponse> {
  try {
    await waitForRateLimit();

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key missing');
      throw new Error('OpenAI API key is not configured');
    }

    console.log('Starting OpenAI analysis:', {
      contentLength: content.length,
      apiKeyExists: !!process.env.OPENAI_API_KEY,
      apiKeyFirstChars: process.env.OPENAI_API_KEY?.substring(0, 3)
    });

    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1}/${maxRetries} to call OpenAI API`);

        // Updated prompt to explicitly request complete JSON format with empty arrays instead of undefined
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyze this resume content and provide a complete analysis with ALL required fields as specified. If any section of the resume is missing, provide appropriate feedback about the missing information, and use empty arrays ([]) instead of undefined or null for any missing array data.

IMPORTANT: 
1. Your response must be ONLY a valid JSON object with no other text before or after
2. Every array field must be present, even if empty
3. Always include "certifications" and "projects" arrays even if they are empty
4. Never omit any field defined in the schema

Resume content to analyze:
${content}`}
          ],
          temperature: 0.7
        });

        console.log('OpenAI API response received:', {
          status: 'success',
          responseId: response.id,
          model: response.model,
          hasChoices: response.choices?.length > 0
        });

        const responseContent = response.choices[0].message.content;
        if (!responseContent) {
          throw new Error('OpenAI returned an empty response');
        }

        // Try to extract JSON from response content
        let jsonContent = responseContent.trim();
        
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
        
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(jsonContent);
          console.log('Response parsed successfully:', {
            hasScore: 'score' in parsedResponse,
            hasStructuredContent: 'structuredContent' in parsedResponse,
            hasScoringCriteria: 'scoringCriteria' in parsedResponse
          });
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'Content:', jsonContent.substring(0, 100) + '...');
          throw new Error('Failed to parse OpenAI response as JSON');
        }

        try {
          // Attempt to repair missing arrays before validation
          const repairedResponse = {
            ...parsedResponse,
            // Ensure all required arrays exist
            skills: Array.isArray(parsedResponse.skills) ? parsedResponse.skills : [],
            feedback: Array.isArray(parsedResponse.feedback) ? parsedResponse.feedback : [],
            improvements: Array.isArray(parsedResponse.improvements) ? parsedResponse.improvements : [],
            keywords: Array.isArray(parsedResponse.keywords) ? parsedResponse.keywords : [],
          };
          
          // Fix structured content if needed
          if (repairedResponse.structuredContent) {
            repairedResponse.structuredContent = {
              ...repairedResponse.structuredContent,
              certifications: Array.isArray(repairedResponse.structuredContent.certifications) 
                ? repairedResponse.structuredContent.certifications : [],
              projects: Array.isArray(repairedResponse.structuredContent.projects) 
                ? repairedResponse.structuredContent.projects : []
            };
          }
          
          // Fix scoring criteria if needed
          if (repairedResponse.scoringCriteria?.keywordUsage) {
            repairedResponse.scoringCriteria.keywordUsage.keywords = 
              Array.isArray(repairedResponse.scoringCriteria.keywordUsage.keywords) 
                ? repairedResponse.scoringCriteria.keywordUsage.keywords : [];
          }
          
          if (repairedResponse.scoringCriteria?.metricsAndAchievements) {
            repairedResponse.scoringCriteria.metricsAndAchievements.highlights = 
              Array.isArray(repairedResponse.scoringCriteria.metricsAndAchievements.highlights) 
                ? repairedResponse.scoringCriteria.metricsAndAchievements.highlights : [];
          }
          
          console.log('Attempting validation with repaired response');
          const validatedResponse = resumeAnalysisResponseSchema.parse(repairedResponse);
          console.log('Response validation successful');
          return validatedResponse;
        } catch (validationError: any) {
          console.error('Schema validation error:', {
            errors: validationError.errors,
            receivedData: parsedResponse
          });
          throw new Error('OpenAI response did not match expected schema');
        }

      } catch (error: any) {
        lastError = error;
        console.error(`OpenAI API Error (attempt ${retryCount + 1}/${maxRetries}):`, {
          message: error.message,
          type: error.constructor.name,
          status: error.status,
          details: error.response?.data
        });

        if (error.status === 429 || error.status === 503) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Rate limited, waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        }

        break;
      }
    }

    if (lastError.status === 429) {
      throw new Error('Service is experiencing high load. Please try again in a few moments.');
    } else if (lastError.status === 401 || lastError.status === 403) {
      throw new Error('API authentication failed. Please check your API key configuration.');
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