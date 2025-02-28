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

export async function analyzeResumeWithAI(content: string): Promise<ResumeAnalysisResponse> {
  const prompt = `Analyze the following resume and provide detailed feedback. Return the response in JSON format with the following structure:
  {
    "score": <number between 0-100>,
    "feedback": [<array of general feedback points>],
    "skills": [<array of identified skills>],
    "improvements": [<array of specific improvement suggestions>],
    "keywords": [<array of important keywords found>]
  }

  Resume content:
  ${content}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return resumeAnalysisResponseSchema.parse(result);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to analyze resume');
  }
}
