package com.annotationplatform.repository;

import com.annotationplatform.entity.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByChecksum(String checksum);

    Page<Document> findByUploadedById(Long userId, Pageable pageable);

    Page<Document> findByCategoryId(Long categoryId, Pageable pageable);

    Page<Document> findByCategoryIsNull(Pageable pageable);

    Page<Document> findByStatus(Document.DocumentStatus status, Pageable pageable);

    @Query("SELECT d FROM Document d WHERE " +
           "(:categoryId IS NULL OR d.category.id = :categoryId) AND " +
           "(:status IS NULL OR d.status = :status) AND " +
           "(:uploadedBy IS NULL OR d.uploadedBy.id = :uploadedBy) AND " +
           "(:filename IS NULL OR LOWER(d.originalFilename) LIKE LOWER(CONCAT('%', :filename, '%'))) AND " +
           "(:startDate IS NULL OR d.createdAt >= :startDate) AND " +
           "(:endDate IS NULL OR d.createdAt <= :endDate)")
    Page<Document> findWithFilters(@Param("categoryId") Long categoryId,
                                  @Param("status") Document.DocumentStatus status,
                                  @Param("uploadedBy") Long uploadedBy,
                                  @Param("filename") String filename,
                                  @Param("startDate") LocalDateTime startDate,
                                  @Param("endDate") LocalDateTime endDate,
                                  Pageable pageable);

    // Simple query for testing
    Page<Document> findAll(Pageable pageable);

    @Query("SELECT COUNT(d) FROM Document d WHERE d.category.id = :categoryId")
    Long countByCategoryId(@Param("categoryId") Long categoryId);

    List<Document> findByStatus(Document.DocumentStatus status);

    List<Document> findAllByFolder_Id(Long folderId);

    List<Document> findAllByFolder_IdIn(Collection<Long> folderIds);

    Page<Document> findByFolder_Id(Long folderId, Pageable pageable);

    Page<Document> findByFolderIsNull(Pageable pageable);

    Long countByFolder_Id(Long folderId);

    // Find documents by category and folder path
    List<Document> findByCategoryIdAndFolderPath(Long categoryId, String folderPath);

    // Find all documents in a category
    List<Document> findByCategoryId(Long categoryId);

    // Find distinct folder paths for a category
    @Query("SELECT DISTINCT d.folderPath FROM Document d WHERE d.category.id = :categoryId AND d.folderPath IS NOT NULL AND d.folderPath != ''")
    List<String> findDistinctFolderPathsByCategoryId(@Param("categoryId") Long categoryId);
}
