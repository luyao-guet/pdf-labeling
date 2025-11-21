package com.annotationplatform.repository;

import com.annotationplatform.entity.Annotation;
import com.annotationplatform.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    Page<Task> findByCreatedById(Long userId, Pageable pageable);

    Page<Task> findByStatus(Task.TaskStatus status, Pageable pageable);

    Page<Task> findByCategoryId(Long categoryId, Pageable pageable);

    @Query("SELECT t FROM Task t WHERE " +
           "(:documentId IS NULL OR t.document.id = :documentId) AND " +
           "(:categoryId IS NULL OR t.category.id = :categoryId) AND " +
           "(:formConfigId IS NULL OR t.formConfig.id = :formConfigId) AND " +
           "(:status IS NULL OR t.status = :status) AND " +
           "(:priority IS NULL OR t.priority = :priority) AND " +
           "(:createdBy IS NULL OR t.createdBy.id = :createdBy) AND " +
           "(:startDate IS NULL OR t.createdAt >= :startDate) AND " +
           "(:endDate IS NULL OR t.createdAt <= :endDate)")
    Page<Task> findWithFilters(@Param("documentId") Long documentId,
                              @Param("categoryId") Long categoryId,
                              @Param("formConfigId") Long formConfigId,
                              @Param("status") Task.TaskStatus status,
                              @Param("priority") Task.Priority priority,
                              @Param("createdBy") Long createdBy,
                              @Param("startDate") LocalDateTime startDate,
                              @Param("endDate") LocalDateTime endDate,
                              Pageable pageable);

    List<Task> findByDocumentIdAndStatus(Long documentId, Task.TaskStatus status);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.status = :status")
    Long countByStatus(@Param("status") Task.TaskStatus status);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.createdBy.id = :userId")
    Long countByCreatedById(@Param("userId") Long userId);

    @Query("SELECT a FROM Annotation a WHERE a.task.id = :taskId AND a.taskAssignment.id = :taskAssignmentId")
    Optional<Annotation> findAnnotationsByTaskIdAndTaskAssignmentId(@Param("taskId") Long taskId, @Param("taskAssignmentId") Long taskAssignmentId);

    // 性能优化查询方法
    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.category LEFT JOIN FETCH t.formConfig WHERE t.id = :id")
    Optional<Task> findByIdWithCategoryAndFormConfig(@Param("id") Long id);

    @Query("SELECT t FROM Task t WHERE t.status IN :statuses ORDER BY t.priority DESC, t.createdAt DESC")
    List<Task> findActiveTasks(@Param("statuses") List<Task.TaskStatus> statuses);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.createdBy.id = :userId AND t.status = :status")
    Long countByCreatedByIdAndStatus(@Param("userId") Long userId, @Param("status") Task.TaskStatus status);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.status = :status AND t.createdAt >= :startDate")
    Long countByStatusAndCreatedAtAfter(@Param("status") Task.TaskStatus status, @Param("startDate") LocalDateTime startDate);

    List<Task> findByBatchId(String batchId);
}
