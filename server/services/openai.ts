import { JobDescription, jobDescriptionSchema } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Maximum text length before chunking
const MAX_TEXT_LENGTH = 12000; // About 3000 tokens

const SYSTEM_PROMPT = `You are an expert resume analyzer. You MUST analyze the resume critically and provide specific, actionable feedback. Return ONLY a JSON object with these exact fields:

{
  "score": (number between 0-100, be conservative - most resumes should score 60-75 unless exceptional),
  "scores": {
    "keywordsRelevance": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (minimum 50 words)",
      "keywords": ["at least 5 relevant keywords"]
    },
    "achievementsMetrics": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (minimum 50 words)",
      "highlights": ["at least 3 quantifiable achievements"]
    },
    "structureReadability": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (minimum 50 words)"
    },
    "summaryClarity": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (minimum 50 words)"
    },
    "overallPolish": {
      "score": (number between 1-10),
      "maxScore": 10,
      "feedback": "detailed feedback (minimum 50 words)"
    }
  },
  "resumeSections": {
    "professionalSummary": "detailed analysis (minimum 100 words)",
    "workExperience": "detailed analysis (minimum 150 words)",
    "education": "detailed analysis (minimum 50 words)",
    "technicalSkills": "detailed analysis (minimum 100 words)",
    "keyAchievements": "detailed analysis (minimum 100 words)"
  },
  "identifiedSkills": ["minimum 5 specific skills"],
  "primaryKeywords": ["minimum 5 important keywords"],
  "suggestedImprovements": ["minimum 3 actionable suggestions"],
  "generalFeedback": {
    "overall": "comprehensive feedback (minimum 200 words)",
    "strengths": ["REQUIRED: 2-3 specific key strengths"],
    "actionItems": ["REQUIRED: 2-3 prioritized action items"]
  },
  "jobSpecificRecommendations": {
    "requiredSkillsMatch": "Analysis of required skill match (minimum 100 words)",
    "experienceLevel": "Analysis of experience level alignment (minimum 50 words)",
    "industryAlignment": "Analysis of industry alignment (minimum 50 words)",
    "keyRequirements": "Analysis of key requirements met/unmet (minimum 100 words)",
    "atsOptimization": "Suggestions for ATS optimization (minimum 50 words)"
  }
}

CRITICAL SCORING GUIDELINES:
1. Be conservative with scoring - most resumes should score between 60-75
2. Only give scores above 80 if the resume is exceptional and matches job requirements perfectly
3. Deduct points for:
   - Missing or vague quantifiable achievements
   - Generic statements without specifics
   - Poor formatting or structure
   - Missing key industry keywords
   - Lack of relevant experience

CRITICAL FEEDBACK REQUIREMENTS:
1. All feedback must be specific and actionable
2. Include exact phrases or sections that need improvement
3. Provide concrete examples for suggested changes
4. Never return empty arrays or generic placeholders
5. Ensure all minimum word counts are met`;

const JOB_ANALYSIS_PROMPT = `Additionally, analyze how well this resume matches the provided job requirements. Pay special attention to:

1. Required Skills Match:
   - Which specific required skills are present/missing?
   - How closely do the candidate's skills align?
   - What technical competencies need strengthening?

2. Experience Level:
   - Does the experience match the requirements?
   - Are there gaps in required experience areas?
   - How relevant is the candidate's background?

3. Industry Alignment:
   - How well does the experience match the industry?
   - What industry-specific knowledge is present/missing?
   - Are there transferable skills to highlight?

4. Key Requirements:
   - Which job requirements are met/unmet?
   - What specific areas need strengthening?
   - How can existing experience be better aligned?

5. ATS Optimization:
   - Which job-specific keywords are missing?
   - How can the resume be better optimized?
   - What terms should be added/modified?

Be critical and specific. Score conservatively if job requirements are not fully met.`;

// Response validation schema
const resumeAnalysisResponseSchema = z.object({
  score: z.number().min(0).max(100),
  scores: z.object({
    keywordsRelevance: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1),
      keywords: z.array(z.string())
    }),
    achievementsMetrics: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1),
      highlights: z.array(z.string())
    }),
    structureReadability: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1)
    }),
    summaryClarity: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1)
    }),
    overallPolish: z.object({
      score: z.number().min(1).max(10),
      maxScore: z.literal(10),
      feedback: z.string().min(1)
    })
  }),
  resumeSections: z.object({
    professionalSummary: z.string().min(1),
    workExperience: z.string().min(1),
    education: z.string().min(1),
    technicalSkills: z.string().min(1),
    keyAchievements: z.string().min(1)
  }),
  identifiedSkills: z.array(z.string()),
  primaryKeywords: z.array(z.string()),
  targetKeywords: z.array(z.string()).optional(),
  suggestedImprovements: z.array(z.string()),
  generalFeedback: z.object({
    overall: z.string().min(1),
    strengths: z.array(z.string()).min(1),
    actionItems: z.array(z.string()).min(1)
  }),
  jobSpecificRecommendations: z.object({
    requiredSkillsMatch: z.string().min(1),
    experienceLevel: z.string().min(1),
    industryAlignment: z.string().min(1),
    keyRequirements: z.string().min(1),
    atsOptimization: z.string().min(1)
  }).optional(),
  jobSpecificFeedback: z.string().optional()
});

type ResumeAnalysisResponse = z.infer<typeof resumeAnalysisResponseSchema>;

// Chunk and summarize long text
async function preprocessText(text: string): Promise<string> {
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  try {
    const chunks = text.match(/.{1,12000}/g) || [];
    const summaries = await Promise.all(chunks.map(async (chunk) => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", 
        messages: [
          {
            role: "system",
            content: "Summarize this text while preserving all key information about skills, experience, and achievements. Keep all dates, metrics, and specific technical terms."
          },
          {
            role: "user",
            content: chunk
          }
        ],
        temperature: 0
      });
      return response.choices[0].message.content || '';
    }));

    return summaries.join('\n\n');
  } catch (error) {
    console.error('Text preprocessing error:', error);
    return text; 
  }
}

// Default values for missing fields
const defaultScoreSection = {
  score: 1,
  maxScore: 10,
  feedback: "No analysis available"
};

const defaultScores = {
  keywordsRelevance: { ...defaultScoreSection, keywords: [] },
  achievementsMetrics: { ...defaultScoreSection, highlights: [] },
  structureReadability: defaultScoreSection,
  summaryClarity: defaultScoreSection,
  overallPolish: defaultScoreSection
};

const defaultResumeSections = {
  professionalSummary: "No summary available",
  workExperience: "No experience details available",
  education: "No education details available",
  technicalSkills: "No skills details available",
  keyAchievements: "No achievements available"
};

const defaultGeneralFeedback = {
  overall: "No general feedback available",
  strengths: ["Demonstrates professional experience", "Has relevant education"], 
  actionItems: ["Add more quantifiable achievements", "Enhance skills section"] 
};

const defaultJobSpecificRecommendations = {
  requiredSkillsMatch: "No analysis available",
  experienceLevel: "No analysis available",
  industryAlignment: "No analysis available",
  keyRequirements: "No analysis available",
  atsOptimization: "No analysis available"
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

    // Preprocess and chunk long text if needed
    const processedContent = await preprocessText(content);

    // Parse job description if provided
    let parsedJobDescription: JobDescription | undefined;
    if (jobDescription) {
      try {
        parsedJobDescription = await parseJobDescription(jobDescription);
      } catch (error) {
        console.error('Job description parsing failed:', error);
        throw new Error(`Failed to parse job description: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Build the complete prompt
    const jobContext = parsedJobDescription ? `
Additionally, analyze this resume against these job requirements:
- Role: ${parsedJobDescription.roleTitle}
- Experience Required: ${parsedJobDescription.yearsOfExperience}
- Industry: ${parsedJobDescription.industry}
- Required Skills: ${parsedJobDescription.skills?.join(', ')}
- Key Requirements: ${parsedJobDescription.requirements?.join('\n')}` : '';

    const finalPrompt = SYSTEM_PROMPT + jobContext;

    // Make the API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: finalPrompt
        },
        {
          role: "user",
          content: processedContent
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('OpenAI returned an empty response');
    }

    // Log raw response for debugging
    console.log('Raw AI Response:', {
      content: response.choices[0].message.content,
      timestamp: new Date().toISOString()
    });

    try {
      // Parse and validate response
      const parsedResponse = JSON.parse(response.choices[0].message.content.trim());

      // Log parsed structure before applying defaults
      console.log('Initial parsed response structure:', {
        hasScores: !!parsedResponse.scores,
        hasSummaryClarity: !!parsedResponse.scores?.summaryClarity,
        hasOverallPolish: !!parsedResponse.scores?.overallPolish,
        timestamp: new Date().toISOString()
      });

      // Add fallback values for required fields
      const enhancedResponse = {
        score: parsedResponse.score || 0,
        scores: {
          ...defaultScores,
          ...parsedResponse.scores,
          summaryClarity: parsedResponse.scores?.summaryClarity || defaultScores.summaryClarity,
          overallPolish: parsedResponse.scores?.overallPolish || defaultScores.overallPolish
        },
        resumeSections: {
          ...defaultResumeSections,
          ...parsedResponse.resumeSections
        },
        identifiedSkills: parsedResponse.identifiedSkills || [],
        primaryKeywords: parsedResponse.primaryKeywords || [],
        suggestedImprovements: parsedResponse.suggestedImprovements || [],
        generalFeedback: {
          ...defaultGeneralFeedback,
          ...parsedResponse.generalFeedback,
          strengths: parsedResponse.generalFeedback?.strengths || defaultGeneralFeedback.strengths, 
          actionItems: parsedResponse.generalFeedback?.actionItems || defaultGeneralFeedback.actionItems 
        },
        jobSpecificRecommendations: parsedResponse.jobSpecificRecommendations || defaultJobSpecificRecommendations
      };

      // Add job-specific data if available
      if (parsedJobDescription) {
        const jobAnalysis = await analyzeResumeWithJobDescription(processedContent, parsedJobDescription);
        enhancedResponse.jobSpecificFeedback = jobAnalysis;
        enhancedResponse.targetKeywords = parsedResponse.targetKeywords || [];
      }

      // Log final structure before validation
      console.log('Final response structure:', {
        hasScores: true,
        hasSummaryClarity: true,
        hasOverallPolish: true,
        timestamp: new Date().toISOString()
      });

      // Validate enhanced response
      return resumeAnalysisResponseSchema.parse(enhancedResponse);

    } catch (error) {
      console.error('Response processing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        isZodError: error instanceof z.ZodError,
        zodErrors: error instanceof z.ZodError ? error.errors : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Failed to process AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Resume analysis error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to analyze resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

Provide a detailed analysis of how this resume aligns with the job requirements. Focus on:
1. Required skills present and missing
2. Experience level alignment
3. Industry relevance
4. Specific improvements needed for this role
5. Keywords and terminology optimization`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: JOB_ANALYSIS_PROMPT
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return response.choices[0].message.content || 'No analysis generated';
  } catch (error: any) {
    console.error('Resume-job analysis error:', error);
    throw new Error(`Failed to analyze resume against job description: ${error.message}`);
  }
}