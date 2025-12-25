-- Migration: Add document_type_id column to documents table
-- Date: 2024

-- Add document_type_id column to documents table
ALTER TABLE documents 
ADD COLUMN document_type_id BIGINT NULL;

-- Add foreign key constraint
ALTER TABLE documents 
ADD CONSTRAINT fk_documents_document_type 
FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_documents_document_type_id ON documents(document_type_id);





