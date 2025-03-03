import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define constant for the model to use
const ANALYSIS_MODEL = "gpt-4o"; // Use the newest model that supports all parameter types

// Rate limiting function to prevent hitting API limits
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // ms between requests

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

// Define schema for the AI analysis response
const resumeAnalysisResponseSchema = z.object({
  structuredContent: z.record(z.any()).optional(),
  scoringCriteria: z.record(z.any()).optional(),
  score: z.number(),
  feedback: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

// Main function to analyze resume content with AI
export async function analyzeResumeWithAI(content: string) {
  try {
    if (!content || content.trim().length === 0) {
      throw new Error("Resume content is empty");
    }

    // Log content length for debugging
    console.log(`Analyzing resume content of length ${content.length}`);

    await waitForRateLimit();

    // Prepare the system prompt and user message
    const systemPrompt = `You are an expert resume analyst and career coach. Analyze the provided resume content and provide structured feedback.

Your analysis should include:
1. Structured content extracted from the resume
2. Overall score out of 100
3. Scoring criteria with subscores
4. Key feedback points
5. Skills identified
6. Areas for improvement
7. Important keywords for ATS optimization

Format your response as a clean JSON object with these keys: structuredContent, scoringCriteria, score, feedback, skills, improvements, keywords.`;

    const userPrompt = `Please analyze this resume:

${content}

Provide a comprehensive analysis with all the required sections. Return ONLY a clean JSON object with no markdown formatting or extra text outside the JSON.`;

    // Create the request payload - log it for debugging
    const requestPayload = {
      model: ANALYSIS_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7
    };

    console.log("OpenAI API request:", {
      model: requestPayload.model,
      messageCount: requestPayload.messages.length,
      temperatur: requestPayload.temperature
    });

    // Make the API request
    const response = await openai.chat.completions.create(requestPayload);

    // Log API response for debugging
    console.log("OpenAI API response received:", {
      status: "success",
      model: response.model,
      choicesCount: response.choices.length,
      hasContent: !!response.choices[0]?.message?.content,
      contentLength: response.choices[0]?.message?.content?.length || 0
    });

    // Extract the content from the response
    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("Empty response from OpenAI API");
    }

    // Parse and sanitize the JSON response - handle potential formatting issues
    let jsonData;
    try {
      // Strip any markdown code block markers if present
      let cleanedContent = responseContent.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.substring(7);
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.substring(3);
      }

      if (cleanedContent.endsWith("```")) {
        cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3);
      }

      jsonData = JSON.parse(cleanedContent.trim());
      console.log("Successfully parsed OpenAI response as JSON");
    } catch (error) {
      console.error("Failed to parse JSON from OpenAI response:", error);
      console.error("Response content:", responseContent.substring(0, 200) + "...");
      throw new Error("Unable to parse analysis results from OpenAI");
    }

    // Validate the parsed data against our schema
    try {
      const validatedData = resumeAnalysisResponseSchema.parse(jsonData);
      console.log("Successfully validated OpenAI response against schema");
      return validatedData;
    } catch (validationError) {
      console.error("Schema validation error:", validationError);
      throw new Error("Analysis results did not match expected format");
    }
  } catch (error: any) {
    // Enhance error handling and logging
    console.error("OpenAI API Error:", {
      message: error.message,
      status: error.status,
      type: error.constructor.name
    });

    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
}