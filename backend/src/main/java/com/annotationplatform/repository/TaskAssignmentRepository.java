package com.annotationplatform.repository;

import com.annotationplatform.entity.TaskAssignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskAssignmentRepository extends JpaRepository<TaskAssignment, Long> {

    List<TaskAssignment> findByTaskId(Long taskId);

    List<TaskAssignment> findByUserId(Long userId);

    Page<TaskAssignment> findByUserId(Long userId, Pageable pageable);

    List<TaskAssignment> findByTaskIdAndAssignmentType(Long taskId, TaskAssignment.AssignmentType assignmentType);

    Optional<TaskAssignment> findByTaskIdAndUserIdAndAssignmentType(Long taskId, Long userId, TaskAssignment.AssignmentType assignmentType);

    @Query("SELECT ta FROM TaskAssignment ta WHERE ta.status = :status")
    List<TaskAssignment> findByStatus(@Param("status") TaskAssignment.AssignmentStatus status);

    @Query("SELECT COUNT(ta) FROM TaskAssignment ta WHERE ta.user.id = :userId AND ta.status = :status")
    Long countByUserIdAndStatus(@Param("userId") Long userId, @Param("status") TaskAssignment.AssignmentStatus status);

    @Query("SELECT COUNT(ta) FROM TaskAssignment ta WHERE ta.user.id = :userId AND ta.assignmentType = :assignmentType AND ta.status = :status")
    Long countByUserIdAndAssignmentTypeAndStatus(@Param("userId") Long userId, @Param("assignmentType") TaskAssignment.AssignmentType assignmentType, @Param("status") TaskAssignment.AssignmentStatus status);
}
