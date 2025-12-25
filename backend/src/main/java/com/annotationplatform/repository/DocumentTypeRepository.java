package com.annotationplatform.repository;

import com.annotationplatform.entity.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentTypeRepository extends JpaRepository<DocumentType, Long> {
    Optional<DocumentType> findByName(String name);
    List<DocumentType> findByIsActiveTrueOrderByCreatedAtDesc();
    List<DocumentType> findAllByOrderByCreatedAtDesc();
    boolean existsByName(String name);
}





