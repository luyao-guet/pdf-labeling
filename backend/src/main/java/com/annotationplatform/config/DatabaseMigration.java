package com.annotationplatform.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.DatabaseMetaData;
import java.sql.ResultSet;

@Component
@Order(1)
public class DatabaseMigration implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        try {
            // Check if form_configs.category_id allows NULL
            if (jdbcTemplate.getDataSource() == null) {
                System.out.println("=== Database Migration: DataSource is null, skipping migration");
                return;
            }
            var dataSource = jdbcTemplate.getDataSource();
            if (dataSource == null) {
                System.out.println("=== Database Migration: DataSource is null, skipping migration");
                return;
            }
            DatabaseMetaData metaData = dataSource.getConnection().getMetaData();
            ResultSet columns = metaData.getColumns(null, null, "FORM_CONFIGS", "CATEGORY_ID");
            
            if (columns.next()) {
                int nullable = columns.getInt("NULLABLE");
                String isNullable = columns.getString("IS_NULLABLE");
                
                System.out.println("=== Database Migration: Checking form_configs.category_id ===");
                System.out.println("NULLABLE value: " + nullable + ", IS_NULLABLE: " + isNullable);
                
                // If column doesn't allow NULL, try to alter it
                if (nullable == DatabaseMetaData.columnNoNulls || "NO".equalsIgnoreCase(isNullable)) {
                    System.out.println("=== Database Migration: category_id doesn't allow NULL, attempting to fix...");
                    try {
                        // For H2 database, we need to use ALTER TABLE ... ALTER COLUMN
                        // H2 syntax: ALTER TABLE table_name ALTER COLUMN column_name DROP NOT NULL
                        jdbcTemplate.execute("ALTER TABLE form_configs ALTER COLUMN category_id DROP NOT NULL");
                        System.out.println("=== Database Migration: Successfully modified category_id to allow NULL");
                    } catch (Exception e) {
                        System.out.println("=== Database Migration: Failed to modify category_id: " + e.getMessage());
                        System.out.println("=== Database Migration: Attempting H2-specific syntax...");
                        // Try H2-specific syntax
                        try {
                            // H2 might need to recreate the column
                            // First, check if there are any existing rows with non-null category_id
                            Integer count = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM form_configs WHERE category_id IS NOT NULL", 
                                Integer.class
                            );
                            System.out.println("=== Database Migration: Found " + count + " rows with non-null category_id");
                            
                            // For H2, we might need to recreate the table
                            // But this is complex, so we'll just log a warning
                            System.out.println("=== Database Migration: WARNING - Cannot automatically fix category_id constraint");
                            System.out.println("=== Database Migration: Please manually execute: ALTER TABLE form_configs ALTER COLUMN category_id DROP NOT NULL");
                            System.out.println("=== Database Migration: Or delete the database file to let Hibernate recreate it");
                        } catch (Exception e2) {
                            System.out.println("=== Database Migration: Alternative approach also failed: " + e2.getMessage());
                        }
                    }
                } else {
                    System.out.println("=== Database Migration: category_id already allows NULL, no action needed");
                }
            }
        } catch (Exception e) {
            System.out.println("=== Database Migration: Error checking database schema: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

