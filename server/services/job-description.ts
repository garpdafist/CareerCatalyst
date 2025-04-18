import { JobDescription, jobDescriptionSchema } from "@shared/schema";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Clean and preprocess job description text
function preprocessJobText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Prompts for job description parsing
const JOB_DESCRIPTION_SYSTEM_PROMPT = `You are an expert job description analyzer. Parse the provided job description text into a structured format, identifying key components like title, experience requirements, and skills.

Follow these rules:
1. Extract information only if it's explicitly stated or strongly implied
2. Leave fields empty if information is not found
3. For years of experience, include any range or minimum requirement mentioned
4. For skills, include both technical and soft skills mentioned
5. Keep the summary concise but informative
6. Include only clear, explicit requirements in the requirements array

Return ONLY a JSON object with the following structure:
{
  "roleTitle": "Extracted job title",
  "yearsOfExperience": "Extracted experience requirement",
  "industry": "Identified industry",
  "companyName": "Company name if mentioned",
  "primaryKeywords": ["Key terms", "and phrases"],
  "summary": "Brief job summary",
  "requirements": ["Requirement 1", "Requirement 2"],
  "skills": ["Skill 1", "Skill 2"]
}`;

const ANALYSIS_SYSTEM_PROMPT = `You are an expert resume and job matching analyzer. Provide a detailed, comprehensive comparison of the resume against the job requirements.

Your analysis must include (minimum 500 words total):

1. Skills and Requirements Match:
   - Exact skills matches found
   - Critical missing skills
   - Relevant transferable skills
   - Technical competency alignment

2. Experience Alignment:
   - Years of experience match
   - Industry relevance
   - Role responsibility overlap
   - Leadership/management requirements

3. Keywords and Terminology:
   - Key job posting phrases found in resume
   - Missing important keywords
   - Industry-specific terminology alignment
   - Technical vocabulary matches

4. Specific Recommendations:
   - Skills to add or emphasize
   - Experience to highlight
   - Achievements to showcase
   - Format and structure suggestions

5. Action Items:
   - Prioritized list of changes
   - Specific examples from both resume and job posting
   - Concrete steps for improvement
   - Timeline suggestions

Each section should provide specific examples from both the resume and job description.
Focus on actionable insights that will improve the candidate's match for this specific role.`;

export async function parseJobDescription(text: string): Promise<JobDescription> {
  try {
    const cleanedText = preprocessJobText(text);

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: JOB_DESCRIPTION_SYSTEM_PROMPT },
        { role: "user", content: cleanedText }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Parse and validate response
    const parsedData = JSON.parse(content);
    return jobDescriptionSchema.parse(parsedData);
  } catch (error: any) {
    console.error('Job description parsing error:', error);
    throw new Error(`Failed to parse job description: ${error.message}`);
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

Analyze how this resume aligns with the specific job requirements. Focus on:
1. Skills alignment and gaps
2. Experience level match
3. Industry relevance
4. Keyword optimization
5. Specific improvements needed for this role`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ]
    });

    return response.choices[0].message.content || 'No analysis generated';
  } catch (error: any) {
    console.error('Resume-job analysis error:', error);
    throw new Error(`Failed to analyze resume against job description: ${error.message}`);
  }
}