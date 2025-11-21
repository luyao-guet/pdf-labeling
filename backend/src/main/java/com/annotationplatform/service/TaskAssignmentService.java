package com.annotationplatform.service;

import com.annotationplatform.entity.*;
import com.annotationplatform.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class TaskAssignmentService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskAssignmentRepository taskAssignmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private QualityCheckRepository qualityCheckRepository;

    /**
     * 智能分配标注任务
     * 算法：根据用户当前工作量和角色优先级进行分配
     */
    @Transactional
    public TaskAssignment assignAnnotationTask(Task task) throws Exception {
        List<User> availableAnnotators = getAvailableAnnotators();

        if (availableAnnotators.isEmpty()) {
            throw new Exception("没有可用的标注员");
        }

        // 选择工作量最少的标注员
        User selectedAnnotator = selectLeastLoadedUser(availableAnnotators, TaskAssignment.AssignmentType.ANNOTATION);

        // 创建任务分配
        TaskAssignment assignment = new TaskAssignment();
        assignment.setTask(task);
        assignment.setUser(selectedAnnotator);
        assignment.setAssignmentType(TaskAssignment.AssignmentType.ANNOTATION);

        TaskAssignment savedAssignment = taskAssignmentRepository.save(assignment);

        // 检查是否需要触发质量检查（已有2个标注员完成）
        checkForQualityControl(task);

        return savedAssignment;
    }

    /**
     * 智能分配审查任务
     * 分配给最适合的审查员（REVIEWER或EXPERT角色）
     */
    @Transactional
    public TaskAssignment assignReviewTask(Task task) throws Exception {
        List<User> availableReviewers = getAvailableReviewers();

        if (availableReviewers.isEmpty()) {
            throw new Exception("没有可用的审查员");
        }

        // 优先选择EXPERT角色，否则选择REVIEWER
        User selectedReviewer = selectBestReviewer(availableReviewers);

        // 创建审查任务分配
        TaskAssignment assignment = new TaskAssignment();
        assignment.setTask(task);
        assignment.setUser(selectedReviewer);
        assignment.setAssignmentType(TaskAssignment.AssignmentType.REVIEW);

        return taskAssignmentRepository.save(assignment);
    }

    /**
     * 自动分配任务给多个标注员
     * 默认分配给2个标注员进行双人标注
     */
    @Transactional
    public List<TaskAssignment> autoAssignAnnotationTasks(Task task) throws Exception {
        List<User> availableAnnotators = getAvailableAnnotators();

        if (availableAnnotators.size() < 2) {
            throw new Exception("需要至少2个可用的标注员进行双人标注");
        }

        // 选择2个工作量最少的标注员
        List<User> selectedAnnotators = selectLeastLoadedUsers(availableAnnotators, 2, TaskAssignment.AssignmentType.ANNOTATION);

        // 创建任务分配
        List<TaskAssignment> assignments = selectedAnnotators.stream()
            .map(annotator -> {
                TaskAssignment assignment = new TaskAssignment();
                assignment.setTask(task);
                assignment.setUser(annotator);
                assignment.setAssignmentType(TaskAssignment.AssignmentType.ANNOTATION);
                return assignment;
            })
            .collect(Collectors.toList());

        List<TaskAssignment> savedAssignments = taskAssignmentRepository.saveAll(assignments);

        // 更新任务状态为已分配
        task.setStatus(Task.TaskStatus.ASSIGNED);
        taskRepository.save(task);

        return savedAssignments;
    }

    /**
     * 获取可用的标注员列表
     */
    private List<User> getAvailableAnnotators() {
        return userRepository.findByRoleInAndStatus(List.of(User.Role.ANNOTATOR, User.Role.EXPERT), User.Status.ACTIVE);
    }

    /**
     * 获取可用的审查员列表
     */
    private List<User> getAvailableReviewers() {
        return userRepository.findByRoleInAndStatus(List.of(User.Role.REVIEWER, User.Role.EXPERT), User.Status.ACTIVE);
    }

    /**
     * 选择工作量最少的用户
     */
    private User selectLeastLoadedUser(List<User> users, TaskAssignment.AssignmentType assignmentType) {
        return users.stream()
            .min((u1, u2) -> {
                long count1 = taskAssignmentRepository.countByUserIdAndAssignmentTypeAndStatus(
                    u1.getId(), assignmentType, TaskAssignment.AssignmentStatus.ASSIGNED);
                long count2 = taskAssignmentRepository.countByUserIdAndAssignmentTypeAndStatus(
                    u2.getId(), assignmentType, TaskAssignment.AssignmentStatus.ASSIGNED);
                return Long.compare(count1, count2);
            })
            .orElse(users.get(0));
    }

    /**
     * 选择指定数量的工作量最少的用户
     */
    private List<User> selectLeastLoadedUsers(List<User> users, int count, TaskAssignment.AssignmentType assignmentType) {
        return users.stream()
            .sorted((u1, u2) -> {
                long count1 = taskAssignmentRepository.countByUserIdAndAssignmentTypeAndStatus(
                    u1.getId(), assignmentType, TaskAssignment.AssignmentStatus.ASSIGNED);
                long count2 = taskAssignmentRepository.countByUserIdAndAssignmentTypeAndStatus(
                    u2.getId(), assignmentType, TaskAssignment.AssignmentStatus.ASSIGNED);
                return Long.compare(count1, count2);
            })
            .limit(count)
            .collect(Collectors.toList());
    }

    /**
     * 选择最佳审查员（优先选择EXPERT）
     */
    private User selectBestReviewer(List<User> reviewers) {
        // 优先选择EXPERT角色
        Optional<User> expert = reviewers.stream()
            .filter(user -> user.getRole() == User.Role.EXPERT)
            .findFirst();

        if (expert.isPresent()) {
            return expert.get();
        }

        // 如果没有EXPERT，选择工作量最少的REVIEWER
        return selectLeastLoadedUser(reviewers, TaskAssignment.AssignmentType.REVIEW);
    }

    /**
     * 检查是否需要触发质量控制
     */
    public void checkForQualityControl(Task task) {
        try {
            // 获取所有标注类型的任务分配
            List<TaskAssignment> annotationAssignments = taskAssignmentRepository
                .findByTaskIdAndAssignmentType(task.getId(), TaskAssignment.AssignmentType.ANNOTATION);

            // 检查是否有至少2个标注员完成了标注
            long completedCount = annotationAssignments.stream()
                .filter(assignment -> assignment.getStatus() == TaskAssignment.AssignmentStatus.COMPLETED)
                .count();

            if (completedCount >= 2) {
                // 获取对应的标注记录
                List<Annotation> annotations = annotationAssignments.stream()
                    .filter(assignment -> assignment.getStatus() == TaskAssignment.AssignmentStatus.COMPLETED)
                    .map(assignment -> {
                        Optional<Annotation> annotation = taskRepository
                            .findAnnotationsByTaskIdAndTaskAssignmentId(task.getId(), assignment.getId());
                        return annotation.orElse(null);
                    })
                    .filter(annotation -> annotation != null)
                    .collect(Collectors.toList());

                if (annotations.size() >= 2) {
                    // 触发质量检查
                    triggerQualityCheck(task, annotationAssignments, annotations);
                }
            }
        } catch (Exception e) {
            // 记录错误但不影响主流程
            System.err.println("Quality control check failed: " + e.getMessage());
        }
    }

    /**
     * 触发质量检查
     */
    private void triggerQualityCheck(Task task, List<TaskAssignment> assignments, List<Annotation> annotations) {
        try {
            User annotatorA = assignments.get(0).getUser();
            User annotatorB = assignments.get(1).getUser();
            Annotation annotationA = annotations.get(0);
            Annotation annotationB = annotations.get(1);

            // 创建质量检查记录
            QualityCheck qualityCheck = new QualityCheck();
            qualityCheck.setTask(task);
            qualityCheck.setAnnotatorA(annotatorA);
            qualityCheck.setAnnotatorB(annotatorB);
            qualityCheck.setAnnotationA(annotationA);
            qualityCheck.setAnnotationB(annotationB);

            // 简单的冲突检测（可以后续优化为更复杂的算法）
            boolean hasConflict = detectConflicts(annotationA, annotationB);
            if (hasConflict) {
                qualityCheck.setComparisonResult(QualityCheck.ComparisonResult.CONFLICT);

                // 分配给审查员
                assignReviewTask(task);
            } else {
                qualityCheck.setComparisonResult(QualityCheck.ComparisonResult.MATCH);
            }

            qualityCheckRepository.save(qualityCheck);

        } catch (Exception e) {
            System.err.println("Failed to trigger quality check: " + e.getMessage());
        }
    }

    /**
     * 简单的冲突检测算法
     * 可以根据实际需求实现更复杂的比较逻辑
     */
    private boolean detectConflicts(Annotation annotationA, Annotation annotationB) {
        // 简单的字符串比较，如果标注数据完全相同则无冲突
        return !annotationA.getAnnotationData().equals(annotationB.getAnnotationData());
    }
}
