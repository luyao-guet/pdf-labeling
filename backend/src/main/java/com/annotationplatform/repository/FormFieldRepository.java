package com.annotationplatform.repository;

import com.annotationplatform.entity.FormField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FormFieldRepository extends JpaRepository<FormField, Long> {

    List<FormField> findByFormConfigIdOrderBySortOrderAsc(Long formConfigId);

    @Query("SELECT ff FROM FormField ff WHERE ff.formConfig.id = :formConfigId ORDER BY ff.sortOrder ASC")
    List<FormField> findByFormConfigIdOrdered(@Param("formConfigId") Long formConfigId);

    boolean existsByFormConfigIdAndFieldName(Long formConfigId, String fieldName);
}
