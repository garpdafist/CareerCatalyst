-- Add the job_analysis column to resume_analyses table if it doesn't exist
ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS job_analysis JSONB DEFAULT NULL;