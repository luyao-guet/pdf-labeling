package com.annotationplatform.repository;

import com.annotationplatform.entity.DocumentAnnotationHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentAnnotationHistoryRepository extends JpaRepository<DocumentAnnotationHistory, Long> {

    List<DocumentAnnotationHistory> findByDocumentIdOrderByCreatedAtDesc(Long documentId);

    List<DocumentAnnotationHistory> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    List<DocumentAnnotationHistory> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<DocumentAnnotationHistory> findByDocumentIdAndFieldNameOrderByCreatedAtDesc(Long documentId, String fieldName);

    @Query("SELECT h FROM DocumentAnnotationHistory h WHERE h.document.id = :documentId ORDER BY h.createdAt DESC")
    Page<DocumentAnnotationHistory> findByDocumentId(@Param("documentId") Long documentId, Pageable pageable);

    @Query("SELECT DISTINCT h.fieldName FROM DocumentAnnotationHistory h WHERE h.document.id = :documentId")
    List<String> findDistinctFieldNamesByDocumentId(@Param("documentId") Long documentId);

    @Query("SELECT h FROM DocumentAnnotationHistory h WHERE h.document.id = :documentId AND h.fieldName = :fieldName ORDER BY h.createdAt DESC")
    List<DocumentAnnotationHistory> findByDocumentIdAndFieldName(@Param("documentId") Long documentId, @Param("fieldName") String fieldName);
}


