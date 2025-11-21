package com.annotationplatform.repository;

import com.annotationplatform.entity.FormConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FormConfigRepository extends JpaRepository<FormConfig, Long> {

    List<FormConfig> findByCategoryIdOrderByCreatedAtDesc(Long categoryId);

    List<FormConfig> findByIsActiveTrueOrderByCreatedAtDesc();

    List<FormConfig> findByCategoryIdAndIsActiveTrueOrderByCreatedAtDesc(Long categoryId);

    @Query("SELECT fc FROM FormConfig fc WHERE fc.isActive = true ORDER BY fc.updatedAt DESC")
    List<FormConfig> findActiveFormConfigs();

    @Query("SELECT COUNT(fc) FROM FormConfig fc WHERE fc.name = :name AND ((:categoryId IS NULL AND fc.category IS NULL) OR (:categoryId IS NOT NULL AND fc.category.id = :categoryId))")
    long countByNameAndCategoryId(@Param("name") String name, @Param("categoryId") Long categoryId);
    
    default boolean existsByNameAndCategoryId(String name, Long categoryId) {
        return countByNameAndCategoryId(name, categoryId) > 0;
    }
    
    @Query("SELECT fc FROM FormConfig fc WHERE fc.category IS NULL AND fc.isActive = true ORDER BY fc.createdAt DESC")
    List<FormConfig> findIndependentFormConfigs();
    
    @Query("SELECT fc FROM FormConfig fc WHERE fc.category IS NULL ORDER BY fc.createdAt DESC")
    List<FormConfig> findAllIndependentFormConfigs();
    
    @Query("SELECT COUNT(fc) FROM FormConfig fc WHERE fc.name = :name AND fc.category IS NULL")
    long countByNameAndCategoryIsNull(@Param("name") String name);
}
