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
    console.error('OpenAI API Error:', error);

    // Handle rate limit errors specially
    if (error.status === 429) {
      console.log('Rate limit hit, falling back to mock data');
    }

    // Fallback to mock analysis when OpenAI fails
    return {
      score: 75,
      scoringCriteria: {
        keywordUsage: {
          score: 15,
          maxScore: 20,
          feedback: "Unable to analyze keywords at the moment",
          keywords: ["sample", "keywords"]
        },
        metricsAndAchievements: {
          score: 20,
          maxScore: 30,
          feedback: "Unable to analyze metrics at the moment",
          highlights: ["sample achievement"]
        },
        structureAndReadability: {
          score: 20,
          maxScore: 25,
          feedback: "Unable to analyze structure at the moment"
        },
        overallImpression: {
          score: 20,
          maxScore: 25,
          feedback: "Unable to analyze overall impression at the moment"
        }
      },
      structuredContent: {
        professionalSummary: "Sample professional summary",
        workExperience: [{
          company: "Sample Company",
          position: "Sample Position",
          duration: "2020-Present",
          achievements: ["Sample achievement"]
        }],
        technicalSkills: ["Sample Skill 1", "Sample Skill 2"],
        education: [{
          institution: "Sample University",
          degree: "Sample Degree",
          year: "2020"
        }],
        certifications: ["Sample Certification"],
        projects: [{
          name: "Sample Project",
          description: "Sample description",
          technologies: ["Sample Tech"]
        }]
      },
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