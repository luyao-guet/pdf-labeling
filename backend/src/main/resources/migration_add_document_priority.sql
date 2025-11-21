-- Migration: Add priority column to documents table
-- This allows assigning priority to documents in file management

ALTER TABLE documents 
ADD COLUMN priority VARCHAR(10) DEFAULT 'NORMAL';




