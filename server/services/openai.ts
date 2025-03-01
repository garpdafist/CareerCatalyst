import OpenAI from "openai";
import { z } from "zod";
import { resumeContentSchema, scoringCriteriaSchema, type ResumeContent, type ScoringCriteria } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI();

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
  const prompt = `You are an expert resume analyzer. Analyze the following resume content and provide detailed, professional feedback with structured data and scoring criteria.

Your analysis should include:
1. Detailed scoring breakdown with these criteria:
   - Keyword Usage (20% weight): Evaluate industry-relevant keywords
   - Metrics & Achievements (30% weight): Quantifiable results and impact
   - Structure & Readability (25% weight): Organization and clarity
   - Overall Impression (25% weight): Professional impact

2. Extract structured content in these sections:
   - Professional Summary
   - Work Experience (with company, position, duration, achievements)
   - Technical Skills
   - Education
   - Optional: Certifications and Projects

Return a JSON response with:
{
  "score": <overall score 0-100>,
  "scoringCriteria": {
    "keywordUsage": {
      "score": <score out of 20>,
      "maxScore": 20,
      "feedback": "<specific feedback>",
      "keywords": ["found", "relevant", "keywords"]
    },
    "metricsAndAchievements": {
      "score": <score out of 30>,
      "maxScore": 30,
      "feedback": "<specific feedback>",
      "highlights": ["quantified", "achievements"]
    },
    "structureAndReadability": {
      "score": <score out of 25>,
      "maxScore": 25,
      "feedback": "<specific feedback>"
    },
    "overallImpression": {
      "score": <score out of 25>,
      "maxScore": 25,
      "feedback": "<specific feedback>"
    }
  },
  "structuredContent": {
    "professionalSummary": "<extracted summary>",
    "workExperience": [{
      "company": "<company name>",
      "position": "<job title>",
      "duration": "<time period>",
      "achievements": ["<achievement 1>", "<achievement 2>"]
    }],
    "technicalSkills": ["<skill 1>", "<skill 2>"],
    "education": [{
      "institution": "<school name>",
      "degree": "<degree name>",
      "year": "<graduation year>"
    }],
    "certifications": ["<cert 1>", "<cert 2>"],
    "projects": [{
      "name": "<project name>",
      "description": "<project description>",
      "technologies": ["<tech 1>", "<tech 2>"]
    }]
  },
  "feedback": ["<general feedback point 1>", "<point 2>"],
  "skills": ["<identified skill 1>", "<skill 2>"],
  "improvements": ["<suggested improvement 1>", "<improvement 2>"],
  "keywords": ["<important keyword 1>", "<keyword 2>"]
}

Resume content to analyze:
${content}`;

  try {
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
    console.error('OpenAI API Error:', {
      message: error.message,
      type: error.constructor.name,
      status: error.status,
      details: error.response?.data
    });

    // Only use mock data if explicitly in development/test
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.log('Development mode: Using mock data');
      return mockResumeAnalysis;
    }

    // In production, throw the error to be handled by the calling code
    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
}

// Move mock data to a separate constant
const mockResumeAnalysis: ResumeAnalysisResponse = {
  score: 75,
  scoringCriteria: {
    keywordUsage: {
      score: 15,
      maxScore: 20,
      feedback: "Mock keyword analysis",
      keywords: ["mock", "keywords"]
    },
    metricsAndAchievements: {
      score: 20,
      maxScore: 30,
      feedback: "Mock metrics analysis",
      highlights: ["mock achievement"]
    },
    structureAndReadability: {
      score: 20,
      maxScore: 25,
      feedback: "Mock structure analysis"
    },
    overallImpression: {
      score: 20,
      maxScore: 25,
      feedback: "Mock overall impression"
    }
  },
  structuredContent: {
    professionalSummary: "[DEV MODE] Professional summary",
    workExperience: [{
      company: "Dev Company",
      position: "Test Position",
      duration: "2020-Present",
      achievements: ["Mock achievement"]
    }],
    technicalSkills: ["Dev Skill 1", "Dev Skill 2"],
    education: [{
      institution: "Dev University",
      degree: "Test Degree",
      year: "2020"
    }],
    certifications: ["Dev Certification"],
    projects: [{
      name: "Test Project",
      description: "Development mode description",
      technologies: ["Test Tech"]
    }]
  },
  feedback: [
    "Development mode: Mock feedback",
    "Please ensure OpenAI API is properly configured in production"
  ],
  skills: ["Dev Skill 1", "Dev Skill 2"],
  improvements: ["Development mode: Mock improvement suggestion"],
  keywords: ["dev", "test"]
};