package com.annotationplatform.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;

@Service
@Order(1)
public class DatabaseMigrationService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void migrate() {
        try (Connection connection = jdbcTemplate.getDataSource().getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            
            // Check if category_id is NOT NULL
            boolean categoryIdNeedsMigration = false;
            boolean formConfigIdNeedsMigration = false;
            
            try (ResultSet columns = metaData.getColumns(null, null, "TASKS", "CATEGORY_ID")) {
                if (columns.next()) {
                    String isNullable = columns.getString("IS_NULLABLE");
                    categoryIdNeedsMigration = "NO".equalsIgnoreCase(isNullable);
                }
            }
            
            try (ResultSet columns = metaData.getColumns(null, null, "TASKS", "FORM_CONFIG_ID")) {
                if (columns.next()) {
                    String isNullable = columns.getString("IS_NULLABLE");
                    formConfigIdNeedsMigration = "NO".equalsIgnoreCase(isNullable);
                }
            }
            
            // Execute migration if needed
            // For H2 database, we need to use SET NULL to make columns nullable
            if (categoryIdNeedsMigration) {
                try {
                    // H2 syntax: ALTER TABLE ... ALTER COLUMN ... SET NULL
                    jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN category_id SET NULL");
                    System.out.println("Migration: Made category_id nullable in tasks table");
                } catch (Exception e) {
                    // Try alternative syntax if SET NULL doesn't work
                    try {
                        jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN category_id BIGINT NULL");
                        System.out.println("Migration: Made category_id nullable in tasks table (alternative syntax)");
                    } catch (Exception e2) {
                        System.out.println("Migration category_id failed: " + e2.getMessage());
                    }
                }
            }
            
            if (formConfigIdNeedsMigration) {
                try {
                    jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN form_config_id SET NULL");
                    System.out.println("Migration: Made form_config_id nullable in tasks table");
                } catch (Exception e) {
                    // Try alternative syntax if SET NULL doesn't work
                    try {
                        jdbcTemplate.execute("ALTER TABLE tasks ALTER COLUMN form_config_id BIGINT NULL");
                        System.out.println("Migration: Made form_config_id nullable in tasks table (alternative syntax)");
                    } catch (Exception e2) {
                        System.out.println("Migration form_config_id failed: " + e2.getMessage());
                    }
                }
            }
            
            // Check if documents.priority column exists
            boolean priorityColumnExists = false;
            try (ResultSet columns = metaData.getColumns(null, null, "DOCUMENTS", "PRIORITY")) {
                priorityColumnExists = columns.next();
            }
            
            if (!priorityColumnExists) {
                try {
                    jdbcTemplate.execute("ALTER TABLE documents ADD COLUMN priority VARCHAR(10) DEFAULT 'NORMAL'");
                    System.out.println("Migration: Added priority column to documents table");
                } catch (Exception e) {
                    System.out.println("Migration priority column (may already exist): " + e.getMessage());
                }
            }
            
            // Check if tasks.batch_id column exists
            boolean batchIdColumnExists = false;
            try (ResultSet columns = metaData.getColumns(null, null, "TASKS", "BATCH_ID")) {
                batchIdColumnExists = columns.next();
            }
            
            if (!batchIdColumnExists) {
                try {
                    jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN batch_id VARCHAR(100)");
                    System.out.println("Migration: Added batch_id column to tasks table");
                } catch (Exception e) {
                    System.out.println("Migration batch_id column (may already exist): " + e.getMessage());
                }
            }
            
            // Check if tasks.batch_name column exists
            boolean batchNameColumnExists = false;
            try (ResultSet columns = metaData.getColumns(null, null, "TASKS", "BATCH_NAME")) {
                batchNameColumnExists = columns.next();
            }
            
            if (!batchNameColumnExists) {
                try {
                    jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN batch_name VARCHAR(200)");
                    System.out.println("Migration: Added batch_name column to tasks table");
                } catch (Exception e) {
                    System.out.println("Migration batch_name column (may already exist): " + e.getMessage());
                }
            }
            
            // Check if tasks.document_index column exists
            boolean documentIndexColumnExists = false;
            try (ResultSet columns = metaData.getColumns(null, null, "TASKS", "DOCUMENT_INDEX")) {
                documentIndexColumnExists = columns.next();
            }
            
            if (!documentIndexColumnExists) {
                try {
                    jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN document_index TEXT");
                    System.out.println("Migration: Added document_index column to tasks table");
                } catch (Exception e) {
                    System.out.println("Migration document_index column (may already exist): " + e.getMessage());
                }
            }
            
            // Check if tasks.submitted_at column exists
            boolean submittedAtColumnExists = false;
            try (ResultSet columns = metaData.getColumns(null, null, "TASKS", "SUBMITTED_AT")) {
                submittedAtColumnExists = columns.next();
            }
            
            if (!submittedAtColumnExists) {
                try {
                    jdbcTemplate.execute("ALTER TABLE tasks ADD COLUMN submitted_at TIMESTAMP");
                    System.out.println("Migration: Added submitted_at column to tasks table");
                } catch (Exception e) {
                    System.out.println("Migration submitted_at column (may already exist): " + e.getMessage());
                }
            }
            
        } catch (Exception e) {
            System.err.println("Database migration failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

