package com.annotationplatform.controller;

import com.annotationplatform.entity.*;
import com.annotationplatform.repository.*;
import com.annotationplatform.service.WorkflowService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/quality-checks")
@CrossOrigin(origins = "*", maxAge = 3600)
public class QualityCheckController {

    @Autowired
    private QualityCheckRepository qualityCheckRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private AnnotationRepository annotationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkflowService workflowService;

    @GetMapping
    public ResponseEntity<?> getQualityChecks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) String status) {

        try {
            Sort.Direction direction = Sort.Direction.fromString(sortDir);
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

            QualityCheck.QualityCheckStatus qualityStatus = null;
            if (status != null && !status.isEmpty()) {
                try {
                    qualityStatus = QualityCheck.QualityCheckStatus.valueOf(status.toUpperCase());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "无效的质量检查状态"));
                }
            }

            Page<QualityCheck> qualityCheckPage = qualityCheckRepository.findWithFilters(
                taskId, qualityStatus, pageable);

            Map<String, Object> response = new HashMap<>();
            response.put("qualityChecks", qualityCheckPage.getContent().stream().map(this::convertQualityCheckToMap));
            response.put("currentPage", qualityCheckPage.getNumber());
            response.put("totalItems", qualityCheckPage.getTotalElements());
            response.put("totalPages", qualityCheckPage.getTotalPages());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取质量检查列表失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getQualityCheck(@PathVariable Long id) {
        try {
            Optional<QualityCheck> qualityCheckOpt = qualityCheckRepository.findById(id);
            if (qualityCheckOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            QualityCheck qualityCheck = qualityCheckOpt.get();
            Map<String, Object> qualityCheckMap = convertQualityCheckToMap(qualityCheck);

            // Add annotations for comparison
            if (qualityCheck.getAnnotationA() != null) {
                qualityCheckMap.put("annotationA", convertAnnotationToMap(qualityCheck.getAnnotationA()));
            }
            if (qualityCheck.getAnnotationB() != null) {
                qualityCheckMap.put("annotationB", convertAnnotationToMap(qualityCheck.getAnnotationB()));
            }

            return ResponseEntity.ok(Map.of("qualityCheck", qualityCheckMap));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取质量检查详情失败: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolveQualityCheck(@PathVariable Long id,
                                               @RequestBody Map<String, Object> request) {
        try {
            String selectedAnnotation = (String) request.get("selectedAnnotation"); // "A" or "B"
            String resolutionNotes = (String) request.get("resolutionNotes");

            if (selectedAnnotation == null || (!selectedAnnotation.equals("A") && !selectedAnnotation.equals("B"))) {
                return ResponseEntity.badRequest().body(Map.of("message", "请选择要采纳的标注结果"));
            }

            // For now, use a default user (since security is disabled)
            // In production, this would come from authentication
            Optional<User> userOpt = userRepository.findById(4L); // Assuming reviewer user ID
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "系统配置错误"));
            }
            User user = userOpt.get();

            Optional<QualityCheck> qualityCheckOpt = qualityCheckRepository.findById(id);
            if (qualityCheckOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            QualityCheck qualityCheck = qualityCheckOpt.get();

            if (qualityCheck.getStatus() != QualityCheck.QualityCheckStatus.PENDING) {
                return ResponseEntity.badRequest().body(Map.of("message", "此质量检查已处理完成"));
            }

            // Determine which annotation to approve
            Annotation selectedAnnotationObj;
            Annotation rejectedAnnotationObj;

            if (selectedAnnotation.equals("A")) {
                selectedAnnotationObj = qualityCheck.getAnnotationA();
                rejectedAnnotationObj = qualityCheck.getAnnotationB();
            } else {
                selectedAnnotationObj = qualityCheck.getAnnotationB();
                rejectedAnnotationObj = qualityCheck.getAnnotationA();
            }

            // Update selected annotation to APPROVED
            selectedAnnotationObj.setStatus(Annotation.AnnotationStatus.APPROVED);
            selectedAnnotationObj.setReviewedAt(LocalDateTime.now());
            selectedAnnotationObj.setReviewer(user);
            selectedAnnotationObj.setReviewNotes(resolutionNotes);

            // Update rejected annotation to REJECTED
            rejectedAnnotationObj.setStatus(Annotation.AnnotationStatus.REJECTED);
            rejectedAnnotationObj.setReviewedAt(LocalDateTime.now());
            rejectedAnnotationObj.setReviewer(user);
            rejectedAnnotationObj.setReviewNotes("被另一标注结果替代: " + resolutionNotes);

            // Update quality check
            qualityCheck.setResolvedBy(user);
            qualityCheck.setResolutionNotes(resolutionNotes);
            qualityCheck.setResolvedAt(LocalDateTime.now());
            qualityCheck.setStatus(QualityCheck.QualityCheckStatus.RESOLVED);

            // Save all changes
            annotationRepository.save(selectedAnnotationObj);
            annotationRepository.save(rejectedAnnotationObj);
            qualityCheckRepository.save(qualityCheck);

            // Handle workflow advancement
            workflowService.handleQualityCheckResolution(qualityCheck.getTask(), qualityCheck);

            return ResponseEntity.ok(Map.of(
                "message", "质量检查完成",
                "qualityCheck", convertQualityCheckToMap(qualityCheck)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "质量检查处理失败: " + e.getMessage()));
        }
    }

    @GetMapping("/my-review-tasks")
    public ResponseEntity<?> getMyReviewTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        try {
            // For now, use a default user (since security is disabled)
            // In production, this would come from authentication
            Optional<User> userOpt = userRepository.findById(4L); // Assuming reviewer user ID
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "系统配置错误"));
            }
            User user = userOpt.get();

            // Find quality checks for tasks where user is assigned as reviewer
            List<QualityCheck> allQualityChecks = qualityCheckRepository.findByUserReviewTasks(user.getId());

            // Manual pagination
            int totalItems = allQualityChecks.size();
            int totalPages = (int) Math.ceil((double) totalItems / size);
            int startIndex = page * size;
            int endIndex = Math.min(startIndex + size, totalItems);

            List<QualityCheck> paginatedQualityChecks = allQualityChecks.subList(startIndex, endIndex);

            Map<String, Object> response = new HashMap<>();
            response.put("qualityChecks", paginatedQualityChecks.stream().map(this::convertQualityCheckToMap));
            response.put("currentPage", page);
            response.put("totalItems", totalItems);
            response.put("totalPages", totalPages);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取审核任务失败: " + e.getMessage()));
        }
    }

    @GetMapping("/statistics")
    public ResponseEntity<?> getQualityStatistics() {
        try {
            Map<String, Object> stats = new HashMap<>();

            // Count quality checks by status
            for (QualityCheck.QualityCheckStatus status : QualityCheck.QualityCheckStatus.values()) {
                stats.put("total" + status.name(), qualityCheckRepository.countByStatus(status));
            }

            // Count quality checks by comparison result
            for (QualityCheck.ComparisonResult result : QualityCheck.ComparisonResult.values()) {
                stats.put("comparison" + result.name(), qualityCheckRepository.countByComparisonResult(result));
            }

            return ResponseEntity.ok(Map.of("statistics", stats));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取质量统计失败: " + e.getMessage()));
        }
    }

    private Map<String, Object> convertQualityCheckToMap(QualityCheck qualityCheck) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", qualityCheck.getId());
        map.put("comparisonResult", qualityCheck.getComparisonResult());
        map.put("conflictFields", qualityCheck.getConflictFields());
        map.put("resolutionNotes", qualityCheck.getResolutionNotes());
        map.put("status", qualityCheck.getStatus());
        map.put("createdAt", qualityCheck.getCreatedAt());
        map.put("resolvedAt", qualityCheck.getResolvedAt());

        map.put("task", Map.of(
            "id", qualityCheck.getTask().getId(),
            "title", qualityCheck.getTask().getTitle(),
            "document", Map.of(
                "id", qualityCheck.getTask().getDocument().getId(),
                "filename", qualityCheck.getTask().getDocument().getOriginalFilename()
            )
        ));

        map.put("annotatorA", Map.of(
            "id", qualityCheck.getAnnotatorA().getId(),
            "username", qualityCheck.getAnnotatorA().getUsername()
        ));

        map.put("annotatorB", Map.of(
            "id", qualityCheck.getAnnotatorB().getId(),
            "username", qualityCheck.getAnnotatorB().getUsername()
        ));

        if (qualityCheck.getResolvedBy() != null) {
            map.put("resolvedBy", Map.of(
                "id", qualityCheck.getResolvedBy().getId(),
                "username", qualityCheck.getResolvedBy().getUsername()
            ));
        }

        return map;
    }

    private Map<String, Object> convertAnnotationToMap(Annotation annotation) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", annotation.getId());
        map.put("annotationData", annotation.getAnnotationData());
        map.put("version", annotation.getVersion());
        map.put("status", annotation.getStatus());
        map.put("submittedAt", annotation.getSubmittedAt());
        map.put("reviewedAt", annotation.getReviewedAt());
        map.put("confidenceScore", annotation.getConfidenceScore());
        map.put("reviewNotes", annotation.getReviewNotes());

        map.put("user", Map.of(
            "id", annotation.getTaskAssignment().getUser().getId(),
            "username", annotation.getTaskAssignment().getUser().getUsername()
        ));

        if (annotation.getReviewer() != null) {
            map.put("reviewer", Map.of(
                "id", annotation.getReviewer().getId(),
                "username", annotation.getReviewer().getUsername()
            ));
        }

        return map;
    }
}
