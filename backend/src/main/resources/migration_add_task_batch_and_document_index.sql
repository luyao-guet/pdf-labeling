-- Migration: Add batch_id, batch_name, and document_index fields to tasks table
-- This migration adds support for task batching by submission time and document index preservation

-- Add batch_id and batch_name columns if they don't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_name VARCHAR(200);

-- Add document_index column to store document information as JSON
-- This preserves document information even if the document is deleted
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS document_index TEXT;

-- Add submitted_at column to track when task was submitted (for batch grouping)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;

-- Create index on batch_id for faster batch queries
CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id);

-- Create index on submitted_at for batch grouping queries
CREATE INDEX IF NOT EXISTS idx_tasks_submitted_at ON tasks(submitted_at);



