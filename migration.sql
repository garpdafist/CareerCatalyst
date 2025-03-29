-- Migration SQL for adding performance-optimizing indexes to production database

-- Resume Analyses Table Indexes
-------------------------------------------------------------------------------
-- Add index on user_id column for fast user-specific queries
CREATE INDEX IF NOT EXISTS user_id_idx ON resume_analyses (user_id);

-- Add index on created_at column for time-based sorting
CREATE INDEX IF NOT EXISTS created_at_idx ON resume_analyses (created_at);

-- Add composite index on user_id + created_at columns for optimized user history queries
CREATE INDEX IF NOT EXISTS user_time_idx ON resume_analyses (user_id, created_at);

-- Add index on score column for improved filtering by score
CREATE INDEX IF NOT EXISTS score_idx ON resume_analyses (score);

-- Add retention_expires_at column for data retention policies
ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS retention_idx ON resume_analyses (retention_expires_at);

-- Users Table Indexes
-------------------------------------------------------------------------------
-- Add index for email lookups (maintains unique constraint for emails)
CREATE INDEX IF NOT EXISTS email_idx ON users (email);

-- Add index on last_login_at column for session management and activity tracking
CREATE INDEX IF NOT EXISTS last_login_idx ON users (last_login_at);

-- Add index on created_at column for user registration analytics
CREATE INDEX IF NOT EXISTS user_created_at_idx ON users (created_at);

-- Analyze tables for better query planning
ANALYZE resume_analyses;
ANALYZE users;