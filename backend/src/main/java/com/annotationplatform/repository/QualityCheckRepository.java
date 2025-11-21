package com.annotationplatform.repository;

import com.annotationplatform.entity.QualityCheck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QualityCheckRepository extends JpaRepository<QualityCheck, Long> {

    List<QualityCheck> findByTaskId(Long taskId);

    List<QualityCheck> findByStatus(QualityCheck.QualityCheckStatus status);

    @Query("SELECT qc FROM QualityCheck qc WHERE qc.annotatorA.id = :userId OR qc.annotatorB.id = :userId")
    List<QualityCheck> findByAnnotator(@Param("userId") Long userId);

    @Query("SELECT qc FROM QualityCheck qc WHERE qc.resolvedBy.id = :userId")
    List<QualityCheck> findByResolver(@Param("userId") Long userId);

    @Query("SELECT COUNT(qc) FROM QualityCheck qc WHERE qc.status = :status")
    Long countByStatus(@Param("status") QualityCheck.QualityCheckStatus status);

    @Query("SELECT COUNT(qc) FROM QualityCheck qc WHERE qc.comparisonResult = :result")
    Long countByComparisonResult(@Param("result") QualityCheck.ComparisonResult result);

    @Query("SELECT qc FROM TaskAssignment ta " +
           "JOIN ta.task t " +
           "JOIN QualityCheck qc ON qc.task.id = t.id " +
           "WHERE ta.user.id = :userId AND ta.assignmentType = 'REVIEW' AND qc.status = 'PENDING' " +
           "ORDER BY qc.createdAt DESC")
    List<QualityCheck> findByUserReviewTasks(@Param("userId") Long userId);

    @Query("SELECT qc FROM QualityCheck qc " +
           "WHERE (:taskId IS NULL OR qc.task.id = :taskId) " +
           "AND (:status IS NULL OR qc.status = :status)")
    Page<QualityCheck> findWithFilters(@Param("taskId") Long taskId,
                                      @Param("status") QualityCheck.QualityCheckStatus status,
                                      Pageable pageable);
}
