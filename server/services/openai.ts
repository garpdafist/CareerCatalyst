import OpenAI from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.array(z.string()),
  skills: z.array(z.string()),
  improvements: z.array(z.string()),
  keywords: z.array(z.string()),
});

export type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000; // 1 second minimum between requests

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysisResponse> {
  try {
    // Implement rate limiting
    const now = Date.now();
    const timeElapsed = now - lastRequestTime;
    if (timeElapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeElapsed));
    }
    lastRequestTime = Date.now();

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a professional resume analyzer. Analyze the resume and provide feedback."
        },
        {
          role: "user",
          content: `Analyze this resume and provide the following:
          1. A score from 0-100
          2. A list of identified skills
          3. A list of suggested improvements
          4. A list of feedback points
          5. A list of important keywords
          
          Resume: ${resumeText}`
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the response
    const responseText = completion.choices[0]?.message?.content || '{}';
    const parsedResponse = JSON.parse(responseText);
    
    // Validate with zod schema
    const validatedResponse = resumeAnalysisResponseSchema.parse({
      score: parsedResponse.score || 0,
      feedback: parsedResponse.feedback || [],
      skills: parsedResponse.skills || [],
      improvements: parsedResponse.improvements || [],
      keywords: parsedResponse.keywords || [],
    });

    return validatedResponse;
  } catch (error: any) {
    console.error('OpenAI API error:', {
      message: error.message,
      type: error.constructor.name,
      status: error.status,
      details: error.response?.data
    });
    
    // Return a default response on error
    return {
      score: 0,
      feedback: ["Error analyzing resume. Please try again."],
      skills: [],
      improvements: ["Unable to analyze resume due to an error."],
      keywords: []
    };
  }
}
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
  const prompt = `You are an expert resume analyzer. Analyze the following resume content and provide detailed, professional feedback. 

Your analysis should focus on:
1. Overall resume strength and effectiveness
2. Technical and soft skills identified
3. Key industry-relevant keywords
4. Specific areas for improvement
5. General professional advice

Return the response in JSON format with the following structure:
{
  "score": <number between 0-100 based on overall resume strength>,
  "feedback": [<array of detailed, actionable feedback points>],
  "skills": [<array of all identified technical and soft skills>],
  "improvements": [<array of specific, actionable improvement suggestions>],
  "keywords": [<array of important industry-relevant keywords found>]
}

Resume content to analyze:
${content}`;

  try {
    // Wait for rate limit before making the request
    await waitForRateLimit();

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);
    return resumeAnalysisResponseSchema.parse(result);
  } catch (error: any) {
    console.error('OpenAI API Error:', error);

    // Handle rate limit errors specially
    if (error.status === 429) {
      console.log('Rate limit hit, falling back to mock data');
    }

    // Fallback to mock analysis when OpenAI fails
    return {
      score: 75,
      feedback: [
        "Unable to perform AI analysis at the moment",
        "Please try again later",
        "Using sample feedback in the meantime"
      ],
      skills: ["Sample Skill 1", "Sample Skill 2"],
      improvements: ["This is a sample improvement suggestion"],
      keywords: ["sample", "keywords"]
    };
  }
}