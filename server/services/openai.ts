import OpenAI from "openai";
import { z } from "zod";
import { parseJobDescription, analyzeResumeWithJobDescription } from "./job-description";
import type { JobDescription } from "@shared/schema";

// Response validation schema
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string(),
      keywords: z.array(z.string())
    }),
    achievementsMetrics: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string(),
      highlights: z.array(z.string())
    }),
    structureReadability: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    }),
    summaryClarity: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    }),
    overallPolish: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string()
    })
  }),
  resumeSections: z.object({
    professionalSummary: z.string(),
    workExperience: z.string(),
    technicalSkills: z.string(),
    education: z.string(),
    keyAchievements: z.string()
  }),
  identifiedSkills: z.array(z.string()),
  importantKeywords: z.array(z.string()),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.string(),
  jobSpecificFeedback: z.string().optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

const SYSTEM_PROMPT = `You are an expert resume analyzer. You MUST provide a comprehensive evaluation in JSON format with EXACTLY these fields (no omissions allowed).

EXAMPLE INPUT:
"John Doe
Marketing Manager with 5+ years experience
Led digital marketing campaigns resulting in 45% increase in engagement
Skills: SEO, Content Strategy, Google Analytics
Education: MBA Marketing"

EXAMPLE OUTPUT:
{
  "score": 75,
  "scores": {
    "keywordsRelevance": {
      "score": 8,
      "maxScore": 10,
      "feedback": "Strong presence of marketing-specific keywords. Consider adding more technical marketing tools and platforms. Include specific marketing metrics and KPIs you've tracked.",
      "keywords": ["marketing manager", "digital marketing", "SEO", "content strategy", "Google Analytics", "engagement", "campaigns", "MBA Marketing"]
    },
    "achievementsMetrics": {
      "score": 7,
      "maxScore": 10,
      "feedback": "Good quantification of results (45% increase). Add more specific metrics across other achievements. Include budget managed, team size, and campaign reach.",
      "highlights": ["45% increase in engagement", "5+ years experience", "Led digital marketing campaigns", "MBA in Marketing", "Digital marketing expertise"]
    },
    "structureReadability": {
      "score": 7,
      "maxScore": 10,
      "feedback": "Clear structure with distinct sections. Consider using bullet points for better readability. Add more white space between sections."
    },
    "summaryClarity": {
      "score": 8,
      "maxScore": 10,
      "feedback": "Strong, concise summary highlighting key experience. Consider adding industry focus and target role objectives."
    },
    "overallPolish": {
      "score": 7,
      "maxScore": 10,
      "feedback": "Professional presentation but could benefit from more detailed achievement metrics and technical skill elaboration."
    }
  },
  "resumeSections": {
    "professionalSummary": "Experienced Marketing Manager with proven track record in digital marketing campaigns and measurable results. Strong analytical skills demonstrated through SEO optimization and Google Analytics expertise.",
    "workExperience": "Marketing Manager position showcasing leadership in digital campaigns with quantifiable results (45% engagement increase). Demonstrates progressive responsibility and strategic thinking in marketing initiatives.",
    "technicalSkills": "Core competencies in SEO, Content Strategy, and Google Analytics. Consider adding more specific marketing tools, social media platforms, and marketing automation software.",
    "education": "MBA with Marketing focus indicates strong theoretical foundation and business acumen.",
    "keyAchievements": "Notable success in digital campaign management with 45% engagement increase. Leadership in marketing initiatives. Advanced education in marketing field."
  },
  "identifiedSkills": [
    "Digital Marketing",
    "Campaign Management",
    "SEO",
    "Content Strategy",
    "Google Analytics",
    "Leadership",
    "Strategic Planning",
    "Performance Analysis",
    "Marketing Analytics",
    "Project Management"
  ],
  "importantKeywords": [
    "Marketing Manager",
    "Digital Marketing",
    "SEO",
    "Analytics",
    "Campaign Management",
    "Engagement",
    "Strategy",
    "Leadership"
  ],
  "suggestedImprovements": [
    "Add specific marketing tools and platforms used",
    "Include budget sizes managed in campaigns",
    "Quantify results for all major achievements",
    "Specify industry verticals worked in",
    "Add details about team leadership",
    "Include more technical marketing skills",
    "Add social media marketing metrics"
  ],
  "generalFeedback": "Your resume demonstrates strong marketing expertise with good quantifiable results. To strengthen it further: 1) Add more specific marketing tools and platforms you're proficient in, 2) Include budget sizes and team sizes managed, 3) Quantify results for all major achievements, not just the engagement increase, 4) Specify industry verticals you've worked in, 5) Elaborate on leadership experience and team sizes managed. Consider creating separate sections for digital marketing skills and traditional marketing expertise."
}

For your analysis:
1. ALWAYS populate each field with meaningful content based on the resume
2. If you find specific skills, list them in identifiedSkills
3. If you spot achievements, add them to suggestedImprovements
4. Provide detailed feedback with specific examples from the resume
5. Never return empty arrays or placeholder text
6. Keep feedback actionable and specific to the content found
7. Ensure all minimum length requirements are met

Return ONLY the JSON object, no additional text.`;

// Rate limiting helper
let lastRequestTime = 0;
const REQUEST_DELAY_MS = 500;

async function waitForRateLimit() {
  const now = Date.now();
  const timeElapsed = now - lastRequestTime;

  if (timeElapsed < REQUEST_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - timeElapsed));
  }

  lastRequestTime = Date.now();
}

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}


// Main analysis function
export async function analyzeResumeWithAI(
  content: string,
  jobDescription?: string
): Promise<ResumeAnalysisResponse> {
  try {
    console.log('Starting resume analysis...', {
      contentLength: content.length,
      hasJobDescription: !!jobDescription,
      timestamp: new Date().toISOString()
    });

    await waitForRateLimit();

    // Parse job description if provided
    let parsedJobDescription: JobDescription | undefined;
    if (jobDescription) {
      try {
        parsedJobDescription = await parseJobDescription(jobDescription);
        console.log('Job description parsed:', {
          roleTitle: parsedJobDescription.roleTitle,
          skillsCount: parsedJobDescription.skills?.length || 0
        });
      } catch (error) {
        console.error('Job description parsing failed:', error);
      }
    }

    const openai = getOpenAIClient();

    const enhancedPrompt = parsedJobDescription ? 
      `${SYSTEM_PROMPT}\n\nAnalyze this resume in context of the following job requirements:
      Role: ${parsedJobDescription.roleTitle}
      Required Experience: ${parsedJobDescription.yearsOfExperience}
      Required Skills: ${parsedJobDescription.skills?.join(', ')}
      Key Requirements: ${parsedJobDescription.requirements?.join(', ')}` :
      SYSTEM_PROMPT;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: enhancedPrompt
        },
        {
          role: "user",
          content: `Analyze this resume${parsedJobDescription ? ' for the specified job role' : ''}:\n\n${content}`
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Log raw AI response for debugging
    console.log('Raw AI Response:', {
      content: response.choices[0].message.content,
      timestamp: new Date().toISOString()
    });

    let parsedResponse: any;
    try {
      const content = response.choices[0].message.content.trim();
      parsedResponse = JSON.parse(content);

      // Log parsed structure before applying any fallbacks
      console.log('Initial parsed response structure:', {
        hasScore: typeof parsedResponse.score === 'number',
        score: parsedResponse.score,
        identifiedSkillsCount: parsedResponse.identifiedSkills?.length ?? 0,
        improvementsCount: parsedResponse.suggestedImprovements?.length ?? 0,
        hasScores: !!parsedResponse.scores,
        hasResumeSections: !!parsedResponse.resumeSections,
        timestamp: new Date().toISOString()
      });

      // Only apply fallbacks if fields are undefined (not empty)
      if (parsedResponse.scores === undefined) parsedResponse.scores = {};
      if (parsedResponse.scores.summaryClarity === undefined) {
        parsedResponse.scores.summaryClarity = {
          score: 1,
          maxScore: 10,
          feedback: "No summary clarity analysis available."
        };
      }
      if (parsedResponse.scores.overallPolish === undefined) {
        parsedResponse.scores.overallPolish = {
          score: 1,
          maxScore: 10,
          feedback: "No overall polish analysis available."
        };
      }
      if (parsedResponse.resumeSections === undefined) {
        parsedResponse.resumeSections = {
          professionalSummary: "",
          workExperience: "",
          technicalSkills: "",
          education: "",
          keyAchievements: ""
        };
      }
      if (parsedResponse.identifiedSkills === undefined) parsedResponse.identifiedSkills = [];
      if (parsedResponse.importantKeywords === undefined) parsedResponse.importantKeywords = [];
      if (parsedResponse.suggestedImprovements === undefined) parsedResponse.suggestedImprovements = [];
      if (parsedResponse.generalFeedback === undefined) parsedResponse.generalFeedback = "No general feedback available.";

      // Get additional job-specific analysis if job description was provided
      if (parsedJobDescription) {
        try {
          const jobAnalysis = await analyzeResumeWithJobDescription(content, parsedJobDescription);
          parsedResponse.jobSpecificFeedback = jobAnalysis;
        } catch (error) {
          console.error('Job-specific analysis failed:', error);
          parsedResponse.jobSpecificFeedback = "Unable to generate job-specific feedback.";
        }
      }

      // Log final structure after fallbacks
      console.log('Final response structure:', {
        score: parsedResponse.score,
        identifiedSkillsCount: parsedResponse.identifiedSkills.length,
        improvementsCount: parsedResponse.suggestedImprovements.length,
        hasJobAnalysis: !!parsedJobDescription,
        timestamp: new Date().toISOString()
      });

      return resumeAnalysisResponseSchema.parse(parsedResponse);

    } catch (error: any) {
      console.error('Resume analysis error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        validationError: error instanceof z.ZodError ? error.errors : undefined
      });
      throw new Error(`Failed to analyze resume: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Resume analysis error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
}