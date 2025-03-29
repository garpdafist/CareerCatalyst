-- Migration SQL for adding performance-optimizing indexes to existing tables

-- Add index on user_id column in resume_analyses table
CREATE INDEX IF NOT EXISTS user_id_idx ON resume_analyses (user_id);

-- Add index on created_at column in resume_analyses table
CREATE INDEX IF NOT EXISTS created_at_idx ON resume_analyses (created_at);

-- Add composite index on user_id + created_at columns for optimized list queries
CREATE INDEX IF NOT EXISTS user_time_idx ON resume_analyses (user_id, created_at);

-- Add index on score column for potential filtering/sorting
CREATE INDEX IF NOT EXISTS score_idx ON resume_analyses (score);

-- Add retention_expires_at column and index if not exists
ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS retention_idx ON resume_analyses (retention_expires_at);

-- Add index for email lookups in users table (email already has a unique constraint)
CREATE INDEX IF NOT EXISTS email_idx ON users (email);

-- Add index on last_login_at column in users table
CREATE INDEX IF NOT EXISTS last_login_idx ON users (last_login_at);

-- Add index on created_at column in users table
CREATE INDEX IF NOT EXISTS user_created_at_idx ON users (created_at);