-- Migration: Add document_annotation_history table
-- This table tracks field-level annotation history for each document

CREATE TABLE IF NOT EXISTS document_annotation_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    task_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    annotation_id BIGINT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(200),
    old_value VARCHAR(2000),
    new_value VARCHAR(2000) NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_document_id ON document_annotation_history(document_id);
CREATE INDEX IF NOT EXISTS idx_task_id ON document_annotation_history(task_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON document_annotation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_field_name ON document_annotation_history(field_name);
CREATE INDEX IF NOT EXISTS idx_created_at ON document_annotation_history(created_at);


