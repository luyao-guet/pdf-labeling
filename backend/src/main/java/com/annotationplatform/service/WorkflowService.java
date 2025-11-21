package com.annotationplatform.service;

import com.annotationplatform.entity.*;
import com.annotationplatform.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class WorkflowService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskAssignmentRepository taskAssignmentRepository;

    @Autowired
    private ScoreService scoreService;

    /**
     * 推进任务工作流状态
     * 根据当前任务状态和相关操作自动推进到下一个状态
     */
    @Transactional
    public void advanceTaskWorkflow(Task task) {
        Task.TaskStatus currentStatus = task.getStatus();
        Task.TaskStatus newStatus = determineNextStatus(task);

        if (newStatus != null && !newStatus.equals(currentStatus)) {
            task.setStatus(newStatus);
            task.setUpdatedAt(LocalDateTime.now());
            taskRepository.save(task);
        }
    }

    /**
     * 根据任务当前状态和条件确定下一个状态
     */
    private Task.TaskStatus determineNextStatus(Task task) {
        switch (task.getStatus()) {
            case CREATED:
                if (hasAssignments(task, TaskAssignment.AssignmentType.AI_ANNOTATION)) {
                    return Task.TaskStatus.AI_PROCESSING;
                }
                break;

            case AI_PROCESSING:
                if (areAllAssignmentsCompleted(task, TaskAssignment.AssignmentType.AI_ANNOTATION)) {
                    return Task.TaskStatus.AI_COMPLETED;
                }
                break;

            case AI_COMPLETED:
                if (hasAssignments(task, TaskAssignment.AssignmentType.ANNOTATION)) {
                    return Task.TaskStatus.ANNOTATING;
                }
                break;

            case ANNOTATING:
                if (areAllAssignmentsCompleted(task, TaskAssignment.AssignmentType.ANNOTATION)) {
                    return Task.TaskStatus.ANNOTATED;
                }
                break;

            case ANNOTATED:
                if (hasAssignments(task, TaskAssignment.AssignmentType.INSPECTION)) {
                    return Task.TaskStatus.INSPECTING;
                }
                break;

            case INSPECTING:
                if (areAllAssignmentsCompleted(task, TaskAssignment.AssignmentType.INSPECTION)) {
                    return Task.TaskStatus.INSPECTED;
                }
                break;

            case INSPECTED:
                if (hasAssignments(task, TaskAssignment.AssignmentType.EXPERT_REVIEW)) {
                    return Task.TaskStatus.EXPERT_REVIEWING;
                }
                break;

            case EXPERT_REVIEWING:
                if (areAllAssignmentsCompleted(task, TaskAssignment.AssignmentType.EXPERT_REVIEW)) {
                    return Task.TaskStatus.EXPERT_REVIEWED;
                }
                break;

            case EXPERT_REVIEWED:
            case REVIEWED:
            case CLOSED:
                break;
                
            // Compatibility with old statuses
            case ASSIGNED:
                 if (hasAssignments(task, TaskAssignment.AssignmentType.ANNOTATION)) {
                     return Task.TaskStatus.ANNOTATING;
                 }
                 break;
            case IN_PROGRESS:
                 if (areAllAssignmentsCompleted(task, TaskAssignment.AssignmentType.ANNOTATION)) {
                     return Task.TaskStatus.ANNOTATED;
                 }
                 break;
            case COMPLETED:
                 break;
        }

        return null; // 无需状态变更
    }

    private boolean hasAssignments(Task task, TaskAssignment.AssignmentType type) {
        List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskIdAndAssignmentType(task.getId(), type);
        return !assignments.isEmpty();
    }

    private boolean areAllAssignmentsCompleted(Task task, TaskAssignment.AssignmentType type) {
        List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskIdAndAssignmentType(task.getId(), type);
        if (assignments.isEmpty()) return false;
        return assignments.stream().allMatch(assignment -> assignment.getStatus() == TaskAssignment.AssignmentStatus.COMPLETED);
    }

    /**
     * 处理标注提交后的工作流推进
     */
    @Transactional
    public void handleAnnotationSubmission(Task task, Annotation annotation) {
        // 推进任务状态
        advanceTaskWorkflow(task);

        // 为用户奖励积分
        if (annotation != null && annotation.getTaskAssignment() != null &&
            annotation.getTaskAssignment().getUser() != null) {
            
            User user = annotation.getTaskAssignment().getUser();
            // 根据不同角色/阶段奖励不同积分
            scoreService.awardTaskCompletionScore(user, task);
        }
    }

    /**
     * 处理质量检查完成后的工作流推进
     */
    @Transactional
    public void handleQualityCheckResolution(Task task, QualityCheck qualityCheck) {
        // 推进任务状态
        advanceTaskWorkflow(task);

        // 为审查员奖励积分
        if (qualityCheck != null && qualityCheck.getResolvedBy() != null) {
            scoreService.awardReviewBonusScore(qualityCheck.getResolvedBy(), qualityCheck);
        }
    }

    /**
     * 关闭已完成的任务
     */
    public void closeCompletedTask(Task task) {
        try {
            task.setStatus(Task.TaskStatus.CLOSED);
            task.setUpdatedAt(LocalDateTime.now());
            taskRepository.save(task);
            System.out.println("Task " + task.getId() + " has been closed successfully");
        } catch (Exception e) {
            System.err.println("Failed to close completed task: " + e.getMessage());
        }
    }

    /**
     * 获取任务的当前工作流状态信息
     */
    public WorkflowStatus getWorkflowStatus(Task task) {
        WorkflowStatus status = new WorkflowStatus();
        status.setTaskId(task.getId());
        status.setCurrentStatus(task.getStatus());

        // 统计各阶段任务分配情况
        List<TaskAssignment> aiAssignments = taskAssignmentRepository
            .findByTaskIdAndAssignmentType(task.getId(), TaskAssignment.AssignmentType.AI_ANNOTATION);
        status.setAiAssignments(aiAssignments.size());
        status.setAiCompleted(countCompleted(aiAssignments));

        List<TaskAssignment> annotationAssignments = taskAssignmentRepository
            .findByTaskIdAndAssignmentType(task.getId(), TaskAssignment.AssignmentType.ANNOTATION);
        status.setAnnotationAssignments(annotationAssignments.size());
        status.setAnnotationCompleted(countCompleted(annotationAssignments));

        List<TaskAssignment> inspectionAssignments = taskAssignmentRepository
            .findByTaskIdAndAssignmentType(task.getId(), TaskAssignment.AssignmentType.INSPECTION);
        status.setInspectionAssignments(inspectionAssignments.size());
        status.setInspectionCompleted(countCompleted(inspectionAssignments));

        List<TaskAssignment> expertAssignments = taskAssignmentRepository
            .findByTaskIdAndAssignmentType(task.getId(), TaskAssignment.AssignmentType.EXPERT_REVIEW);
        status.setExpertAssignments(expertAssignments.size());
        status.setExpertCompleted(countCompleted(expertAssignments));

        // 计算进度百分比 (simplified)
        status.setProgressPercentage(calculateProgress(status));

        return status;
    }

    private int countCompleted(List<TaskAssignment> assignments) {
        return (int) assignments.stream()
            .filter(a -> a.getStatus() == TaskAssignment.AssignmentStatus.COMPLETED)
            .count();
    }

    /**
     * 计算任务进度百分比
     */
    private int calculateProgress(WorkflowStatus status) {
        // 简单进度计算：每个阶段占一定权重
        // AI: 10%, Annotation: 40%, Inspection: 30%, Expert: 20%
        
        double progress = 0;
        
        if (status.getAiAssignments() > 0) {
            progress += 10.0 * status.getAiCompleted() / status.getAiAssignments();
        }
        
        if (status.getAnnotationAssignments() > 0) {
            progress += 40.0 * status.getAnnotationCompleted() / status.getAnnotationAssignments();
        }
        
        if (status.getInspectionAssignments() > 0) {
            progress += 30.0 * status.getInspectionCompleted() / status.getInspectionAssignments();
        }
        
        if (status.getExpertAssignments() > 0) {
            progress += 20.0 * status.getExpertCompleted() / status.getExpertAssignments();
        }
        
        // Adjust if stages are missing
        // This is a simplified logic. A more robust one would adapt based on required stages.
        
        return (int) Math.min(100, Math.round(progress));
    }

    /**
     * 工作流状态信息类
     */
    public static class WorkflowStatus {
        private Long taskId;
        private Task.TaskStatus currentStatus;
        
        private int aiAssignments;
        private int aiCompleted;
        
        private int annotationAssignments;
        private int annotationCompleted;
        
        private int inspectionAssignments;
        private int inspectionCompleted;
        
        private int expertAssignments;
        private int expertCompleted;
        
        private int progressPercentage;

        // Getters and Setters
        public Long getTaskId() { return taskId; }
        public void setTaskId(Long taskId) { this.taskId = taskId; }

        public Task.TaskStatus getCurrentStatus() { return currentStatus; }
        public void setCurrentStatus(Task.TaskStatus currentStatus) { this.currentStatus = currentStatus; }

        public int getAiAssignments() { return aiAssignments; }
        public void setAiAssignments(int aiAssignments) { this.aiAssignments = aiAssignments; }

        public int getAiCompleted() { return aiCompleted; }
        public void setAiCompleted(int aiCompleted) { this.aiCompleted = aiCompleted; }

        public int getAnnotationAssignments() { return annotationAssignments; }
        public void setAnnotationAssignments(int annotationAssignments) { this.annotationAssignments = annotationAssignments; }

        public int getAnnotationCompleted() { return annotationCompleted; }
        public void setAnnotationCompleted(int annotationCompleted) { this.annotationCompleted = annotationCompleted; }

        public int getInspectionAssignments() { return inspectionAssignments; }
        public void setInspectionAssignments(int inspectionAssignments) { this.inspectionAssignments = inspectionAssignments; }

        public int getInspectionCompleted() { return inspectionCompleted; }
        public void setInspectionCompleted(int inspectionCompleted) { this.inspectionCompleted = inspectionCompleted; }

        public int getExpertAssignments() { return expertAssignments; }
        public void setExpertAssignments(int expertAssignments) { this.expertAssignments = expertAssignments; }

        public int getExpertCompleted() { return expertCompleted; }
        public void setExpertCompleted(int expertCompleted) { this.expertCompleted = expertCompleted; }

        public int getProgressPercentage() { return progressPercentage; }
        public void setProgressPercentage(int progressPercentage) { this.progressPercentage = progressPercentage; }
    }
}
