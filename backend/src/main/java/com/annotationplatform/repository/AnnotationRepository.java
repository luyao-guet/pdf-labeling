package com.annotationplatform.repository;

import com.annotationplatform.entity.Annotation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnotationRepository extends JpaRepository<Annotation, Long> {

    // Use explicit @Query to avoid H2 database compatibility issues
    @Query("SELECT a FROM Annotation a WHERE a.task.id = :taskId")
    List<Annotation> findByTaskId(@Param("taskId") Long taskId);

    @Query("SELECT a FROM Annotation a WHERE a.task.id = :taskId ORDER BY a.version DESC")
    List<Annotation> findByTaskIdOrderByVersionDesc(@Param("taskId") Long taskId);

    List<Annotation> findByTaskAssignmentId(Long taskAssignmentId);

    Page<Annotation> findByTaskAssignmentId(Long taskAssignmentId, Pageable pageable);

    @Query("SELECT a FROM Annotation a WHERE a.task.id = :taskId AND a.taskAssignment.id = :taskAssignmentId")
    Optional<Annotation> findByTaskIdAndTaskAssignmentId(@Param("taskId") Long taskId, @Param("taskAssignmentId") Long taskAssignmentId);

    List<Annotation> findByStatus(Annotation.AnnotationStatus status);
}
