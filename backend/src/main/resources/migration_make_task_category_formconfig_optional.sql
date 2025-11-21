-- Migration: Make category_id and form_config_id optional in tasks table
-- This allows creating tasks without category and form config, which can be configured later

ALTER TABLE tasks 
MODIFY COLUMN category_id BIGINT NULL,
MODIFY COLUMN form_config_id BIGINT NULL;




