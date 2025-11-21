package com.annotationplatform.controller;

import com.annotationplatform.entity.Annotation;
import com.annotationplatform.entity.Task;
import com.annotationplatform.entity.TaskAssignment;
import com.annotationplatform.entity.User;
import com.annotationplatform.entity.Document;
import com.annotationplatform.repository.AnnotationRepository;
import com.annotationplatform.repository.TaskRepository;
import com.annotationplatform.repository.TaskAssignmentRepository;
import com.annotationplatform.repository.UserRepository;
import com.annotationplatform.repository.DocumentRepository;
import com.annotationplatform.service.TaskAssignmentService;
import com.annotationplatform.service.WorkflowService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.RandomAccessFile;
import java.math.BigDecimal;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/annotations")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AnnotationController {

    private static final Logger logger = LoggerFactory.getLogger(AnnotationController.class);

    @Autowired
    private AnnotationRepository annotationRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskAssignmentRepository taskAssignmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private TaskAssignmentService taskAssignmentService;

    @Autowired
    private WorkflowService workflowService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping
    @PreAuthorize("hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT') or hasRole('ADMIN')")
    public ResponseEntity<?> submitAnnotation(@RequestBody Map<String, Object> request,
                                             Authentication authentication) {
        logger.info("=== submitAnnotation called ===");
        logger.info("Request: taskId={}, taskAssignmentId={}, documentId={}", 
                   request.get("taskId"), request.get("taskAssignmentId"), request.get("documentId"));
        try {
            Long taskId = Long.valueOf(request.get("taskId").toString());
            Long taskAssignmentId = Long.valueOf(request.get("taskAssignmentId").toString());
            Object annotationData = request.get("annotationData");
            BigDecimal confidenceScore = request.get("confidenceScore") != null ?
                new BigDecimal(request.get("confidenceScore").toString()) : null;
            // Get document ID from request if provided, otherwise use task's document
            Long documentId = request.get("documentId") != null ? 
                Long.valueOf(request.get("documentId").toString()) : null;
            
            logger.info("Parsed: taskId={}, taskAssignmentId={}, documentId={}", taskId, taskAssignmentId, documentId);

            if (annotationData == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "标注数据不能为空"));
            }

            // Get current user
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            // Validate task exists
            Optional<Task> taskOpt = taskRepository.findById(taskId);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Task task = taskOpt.get();

            // Validate task assignment exists and belongs to current user
            Optional<TaskAssignment> assignmentOpt = taskAssignmentRepository.findById(taskAssignmentId);
            if (assignmentOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务分配不存在"));
            }
            TaskAssignment assignment = assignmentOpt.get();

            if (!assignment.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "无权限提交此标注"));
            }

            // Allow resubmission even if assignment is COMPLETED
            boolean isResubmission = assignment.getStatus() == TaskAssignment.AssignmentStatus.COMPLETED;

            // Check if annotation already exists for this assignment
            Optional<Annotation> existingAnnotation = annotationRepository.findByTaskIdAndTaskAssignmentId(taskId, taskAssignmentId);

            Annotation annotation;
            if (existingAnnotation.isPresent()) {
                // Update existing annotation (allow resubmission)
                annotation = existingAnnotation.get();
                annotation.setAnnotationData(objectMapper.writeValueAsString(annotationData));
                annotation.setVersion(annotation.getVersion() + 1);
                annotation.setConfidenceScore(confidenceScore);
                annotation.setUpdatedAt(LocalDateTime.now());
            } else {
                // Create new annotation
                annotation = new Annotation();
                annotation.setTask(task);
                annotation.setTaskAssignment(assignment);
                annotation.setAnnotationData(objectMapper.writeValueAsString(annotationData));
                annotation.setConfidenceScore(confidenceScore);
                annotation.setVersion(1); // Initialize version to 1 for new annotations
            }

            // Set submission timestamp
            annotation.setSubmittedAt(LocalDateTime.now());
            annotation.setStatus(Annotation.AnnotationStatus.SUBMITTED);
            // Clear review information when resubmitting
            if (isResubmission) {
                annotation.setReviewer(null);
                annotation.setReviewedAt(null);
                annotation.setReviewNotes(null);
            }

            Annotation savedAnnotation = annotationRepository.save(annotation);

            // Update JSON archive with file lock for concurrent writes
            // Use documentId from request if provided, otherwise use task's document
            Document document = null;
            if (documentId != null) {
                logger.info("Looking for document with ID: {}", documentId);
                Optional<Document> documentOpt = documentRepository.findById(documentId);
                if (documentOpt.isPresent()) {
                    document = documentOpt.get();
                    logger.info("Found document: {} - {}", document.getId(), document.getOriginalFilename());
                } else {
                    logger.error("Document not found with ID: {}", documentId);
                }
            }
            // Fallback to task's document if documentId not provided or not found
            if (document == null) {
                logger.info("Document ID not provided or not found, using task's document");
                document = task.getDocument();
                if (document != null) {
                    logger.info("Using task's document: {} - {}", document.getId(), document.getOriginalFilename());
                }
            }
            if (document != null) {
                logger.info("Updating archive for document: {}", document.getId());
                updateArchiveForAnnotation(document, task, assignment, savedAnnotation, annotationData);
            } else {
                logger.error("WARNING: Cannot update archive - no document found for task {}", task.getId());
                logger.error("  documentId from request: {}", documentId);
                logger.error("  task.getDocument(): {}", task.getDocument() != null ? task.getDocument().getId() : "null");
            }

            // Update assignment status
            if (isResubmission) {
                assignment.setStatus(TaskAssignment.AssignmentStatus.IN_PROGRESS);
                assignment.setCompletedAt(null);
            } else {
                assignment.setStatus(TaskAssignment.AssignmentStatus.COMPLETED);
                assignment.setCompletedAt(LocalDateTime.now());
            }
            taskAssignmentRepository.save(assignment);

            // Generate batch ID if not set
            LocalDateTime now = LocalDateTime.now();
            if (task.getBatchId() == null || task.getBatchId().isEmpty()) {
                String batchId = String.format("BATCH_%04d%02d%02d_%02d%02d",
                    now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
                    now.getHour(), now.getMinute());
                task.setBatchId(batchId);
                
                String batchName = String.format("提交批次_%04d-%02d-%02d %02d:%02d",
                    now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
                    now.getHour(), now.getMinute());
                task.setBatchName(batchName);
            }
            
            task.setSubmittedAt(now);
            taskRepository.save(task);

            taskAssignmentService.checkForQualityControl(task);
            workflowService.handleAnnotationSubmission(task, savedAnnotation);

            return ResponseEntity.ok(Map.of(
                "message", "标注提交成功",
                "annotation", convertAnnotationToMap(savedAnnotation)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "提交标注失败: " + e.getMessage()));
        }
    }

    @PostMapping("/draft")
    @PreAuthorize("hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT') or hasRole('ADMIN')")
    public ResponseEntity<?> saveDraftAnnotation(@RequestBody Map<String, Object> request,
                                                Authentication authentication) {
        logger.info("=== saveDraftAnnotation called ===");
        logger.info("Request: taskId={}, taskAssignmentId={}, documentId={}", 
                   request.get("taskId"), request.get("taskAssignmentId"), request.get("documentId"));
        try {
            Long taskId = Long.valueOf(request.get("taskId").toString());
            Long taskAssignmentId = Long.valueOf(request.get("taskAssignmentId").toString());
            Object annotationData = request.get("annotationData");
            BigDecimal confidenceScore = request.get("confidenceScore") != null ?
                new BigDecimal(request.get("confidenceScore").toString()) : null;
            Long documentId = request.get("documentId") != null ? 
                Long.valueOf(request.get("documentId").toString()) : null;
            
            logger.info("Parsed: taskId={}, taskAssignmentId={}, documentId={}", taskId, taskAssignmentId, documentId);

            if (annotationData == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "标注数据不能为空"));
            }

            // Get current user
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            // Validate task exists
            Optional<Task> taskOpt = taskRepository.findById(taskId);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Task task = taskOpt.get();

            // Validate task assignment exists and belongs to current user
            Optional<TaskAssignment> assignmentOpt = taskAssignmentRepository.findById(taskAssignmentId);
            if (assignmentOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务分配不存在"));
            }
            TaskAssignment assignment = assignmentOpt.get();

            if (!assignment.getUser().getId().equals(user.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "无权限保存此标注"));
            }

            // Check if annotation already exists for this assignment
            Optional<Annotation> existingAnnotation = annotationRepository.findByTaskIdAndTaskAssignmentId(taskId, taskAssignmentId);

            Annotation annotation;
            if (existingAnnotation.isPresent()) {
                // Update existing annotation
                annotation = existingAnnotation.get();
                annotation.setAnnotationData(objectMapper.writeValueAsString(annotationData));
                annotation.setVersion(annotation.getVersion() + 1);
                annotation.setConfidenceScore(confidenceScore);
                annotation.setUpdatedAt(LocalDateTime.now());
            } else {
                // Create new annotation
                annotation = new Annotation();
                annotation.setTask(task);
                annotation.setTaskAssignment(assignment);
                annotation.setAnnotationData(objectMapper.writeValueAsString(annotationData));
                annotation.setConfidenceScore(confidenceScore);
                annotation.setVersion(1);
            }

            // Set status to DRAFT (not SUBMITTED)
            annotation.setStatus(Annotation.AnnotationStatus.DRAFT);
            // Don't set submittedAt for draft
            annotation.setSubmittedAt(null);

            Annotation savedAnnotation = annotationRepository.save(annotation);

            // Update JSON archive with file lock for concurrent writes
            Document document = null;
            if (documentId != null) {
                logger.info("Looking for document with ID: {}", documentId);
                Optional<Document> documentOpt = documentRepository.findById(documentId);
                if (documentOpt.isPresent()) {
                    document = documentOpt.get();
                    logger.info("Found document: {} - {}", document.getId(), document.getOriginalFilename());
                } else {
                    logger.error("Document not found with ID: {}", documentId);
                }
            }
            // Fallback to task's document if documentId not provided or not found
            if (document == null) {
                logger.info("Document ID not provided or not found, using task's document");
                document = task.getDocument();
                if (document != null) {
                    logger.info("Using task's document: {} - {}", document.getId(), document.getOriginalFilename());
                }
            }
            if (document != null) {
                logger.info("Updating archive for draft annotation, document: {}", document.getId());
                updateArchiveForAnnotation(document, task, assignment, savedAnnotation, annotationData);
            } else {
                logger.error("WARNING: Cannot update archive - no document found for task {}", task.getId());
            }

            // Don't update assignment status for draft - keep it as is
            // Don't update task status for draft

            return ResponseEntity.ok(Map.of(
                "message", "标注已暂存",
                "annotation", convertAnnotationToMap(savedAnnotation)
            ));

        } catch (Exception e) {
            logger.error("Failed to save draft annotation: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "暂存标注失败: " + e.getMessage()));
        }
    }

    @GetMapping("/task/{taskId}")
    public ResponseEntity<?> getTaskAnnotations(@PathVariable Long taskId,
                                               Authentication authentication) {
        try {
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            Optional<TaskAssignment> assignment = taskAssignmentRepository.findByTaskIdAndUserIdAndAssignmentType(
                taskId, user.getId(), TaskAssignment.AssignmentType.ANNOTATION);
            
            if (assignment.isEmpty()) {
                assignment = taskAssignmentRepository.findByTaskIdAndUserIdAndAssignmentType(
                    taskId, user.getId(), TaskAssignment.AssignmentType.AI_ANNOTATION);
            }
            
            boolean isAdmin = user.getRole() == User.Role.ADMIN;
            
            if (assignment.isEmpty() && !isAdmin) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "无权限查看此任务的标注"));
            }

            List<Annotation> annotations = annotationRepository.findByTaskId(taskId);

            List<Map<String, Object>> annotationMaps = annotations.stream()
                    .map(this::convertAnnotationToMap)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("annotations", annotationMaps));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取任务标注失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getAnnotation(@PathVariable Long id,
                                          Authentication authentication) {
        try {
            Optional<Annotation> annotationOpt = annotationRepository.findById(id);
            if (annotationOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Annotation annotation = annotationOpt.get();

            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            boolean hasAccess = user.getRole() == User.Role.ADMIN ||
                               annotation.getTaskAssignment().getUser().getId().equals(user.getId()) ||
                               taskAssignmentRepository.findByTaskIdAndUserIdAndAssignmentType(
                                   annotation.getTask().getId(), user.getId(), TaskAssignment.AssignmentType.REVIEW).isPresent();

            if (!hasAccess) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "无权限查看此标注"));
            }

            return ResponseEntity.ok(Map.of("annotation", convertAnnotationToMap(annotation)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取标注详情失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/review")
    @PreAuthorize("hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> reviewAnnotation(@PathVariable Long id,
                                             @RequestBody Map<String, Object> request,
                                             Authentication authentication) {
        try {
            String status = (String) request.get("status");
            String reviewNotes = (String) request.get("reviewNotes");

            if (status == null || status.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "审核状态不能为空"));
            }

            Annotation.AnnotationStatus annotationStatus;
            try {
                annotationStatus = Annotation.AnnotationStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("message", "无效的审核状态"));
            }

            if (annotationStatus != Annotation.AnnotationStatus.APPROVED &&
                annotationStatus != Annotation.AnnotationStatus.REJECTED) {
                return ResponseEntity.badRequest().body(Map.of("message", "审核状态必须是APPROVED或REJECTED"));
            }

            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            Optional<Annotation> annotationOpt = annotationRepository.findById(id);
            if (annotationOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Annotation annotation = annotationOpt.get();

            Optional<TaskAssignment> reviewAssignment = taskAssignmentRepository.findByTaskIdAndUserIdAndAssignmentType(
                annotation.getTask().getId(), user.getId(), TaskAssignment.AssignmentType.REVIEW);

            if (reviewAssignment.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "无权限审核此标注"));
            }

            annotation.setStatus(annotationStatus);
            annotation.setReviewedAt(LocalDateTime.now());
            annotation.setReviewer(user);
            annotation.setReviewNotes(reviewNotes);

            Annotation savedAnnotation = annotationRepository.save(annotation);

            // Update archive for review with file lock
            Task task = annotation.getTask();
            Document document = task.getDocument();
            if (document != null) {
                updateArchiveForReview(document, task, reviewAssignment.get(), annotation, reviewNotes);
            }

            return ResponseEntity.ok(Map.of(
                "message", "标注审核完成",
                "annotation", convertAnnotationToMap(savedAnnotation)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "审核标注失败: " + e.getMessage()));
        }
    }

    @GetMapping("/my-annotations")
    @PreAuthorize("hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getMyAnnotations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "submittedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            Authentication authentication) {

        try {
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            Sort.Direction direction = Sort.Direction.fromString(sortDir);
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

            Page<TaskAssignment> assignmentPage = taskAssignmentRepository.findByUserId(user.getId(), pageable);

            List<Map<String, Object>> result = assignmentPage.getContent().stream()
                    .map(assignment -> {
                        Map<String, Object> item = new HashMap<>();
                        item.put("assignment", convertAssignmentToMap(assignment));
                        item.put("task", convertTaskToMap(assignment.getTask()));

                        Optional<Annotation> latestAnnotation = annotationRepository.findByTaskIdAndTaskAssignmentId(
                            assignment.getTask().getId(), assignment.getId());

                        if (latestAnnotation.isPresent()) {
                            item.put("annotation", convertAnnotationToMap(latestAnnotation.get()));
                        }

                        return item;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> response = new HashMap<>();
            response.put("items", result);
            response.put("currentPage", assignmentPage.getNumber());
            response.put("totalItems", assignmentPage.getTotalElements());
            response.put("totalPages", assignmentPage.getTotalPages());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取我的标注失败: " + e.getMessage()));
        }
    }

    @GetMapping("/document/{documentId}/history")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getDocumentAnnotationHistory(@PathVariable Long documentId,
                                                         Authentication authentication) {
        try {
            Path archivePath = Paths.get("./uploads/documents", documentId + "_archive.json");
            File archiveFile = archivePath.toFile();
            
            if (!archiveFile.exists()) {
                return ResponseEntity.ok(Map.of("history", Collections.emptyList()));
            }

            JsonNode archive = objectMapper.readTree(archiveFile);
            
            List<Map<String, Object>> historyList = new ArrayList<>();

            // Try new format first (annotation_records)
            JsonNode annotationRecords = archive.path("annotation_records");
            
            if (!annotationRecords.isMissingNode() && annotationRecords.isObject()) {
                Iterator<String> fieldNamesIter = annotationRecords.fieldNames();
                while (fieldNamesIter.hasNext()) {
                    String fieldName = fieldNamesIter.next();
                    JsonNode entries = annotationRecords.path(fieldName);
                    
                    if (!entries.isMissingNode() && entries.isArray()) {
                        for (int i = 0; i < entries.size(); i++) {
                            JsonNode entry = entries.get(i);
                            if (entry == null) continue;
                            
                            Map<String, Object> historyMap = new HashMap<>();
                            historyMap.put("id", i + 1);
                            historyMap.put("fieldName", fieldName);
                            historyMap.put("fieldLabel", fieldName);
                            
                            // Get old and new values
                            JsonNode annotationContent = entry.path("annotation_content");
                            Object newValue = null;
                            if (annotationContent.isTextual()) {
                                newValue = annotationContent.asText();
                            } else if (annotationContent.isNumber()) {
                                newValue = annotationContent.isDouble() ? annotationContent.asDouble() : annotationContent.asLong();
                            } else if (annotationContent.isBoolean()) {
                                newValue = annotationContent.asBoolean();
                            } else if (annotationContent.isArray() || annotationContent.isObject()) {
                                newValue = objectMapper.convertValue(annotationContent, Object.class);
                            }
                            
                            Object oldValue = null;
                            if (i > 0) {
                                JsonNode prevEntry = entries.get(i - 1);
                                JsonNode prevContent = prevEntry.path("annotation_content");
                                if (prevContent.isTextual()) {
                                    oldValue = prevContent.asText();
                                } else if (prevContent.isNumber()) {
                                    oldValue = prevContent.isDouble() ? prevContent.asDouble() : prevContent.asLong();
                                } else if (prevContent.isBoolean()) {
                                    oldValue = prevContent.asBoolean();
                                } else if (prevContent.isArray() || prevContent.isObject()) {
                                    oldValue = objectMapper.convertValue(prevContent, Object.class);
                                }
                            }
                            
                            historyMap.put("oldValue", oldValue);
                            historyMap.put("newValue", newValue);
                            historyMap.put("actionType", i == 0 ? "CREATE" : "UPDATE");
                            historyMap.put("version", i + 1);
                            historyMap.put("createdAt", entry.path("operation_time").asText(null));
                            
                            // Extract task info
                            String taskIdStr = entry.path("task_id").asText("");
                            Long taskId = 0L;
                            if (taskIdStr.startsWith("TASK-")) {
                                try {
                                    taskId = Long.parseLong(taskIdStr.substring(5));
                                } catch (NumberFormatException e) {
                                    // ignore
                                }
                            }
                            
                            historyMap.put("task", Map.of(
                                "id", taskId,
                                "title", entry.path("task_name").asText("")
                            ));
                            
                            historyMap.put("roleType", entry.path("role_type").asText(""));
                            
                            // Extract user info
                            Long userId = entry.path("user_id").asLong(0L);
                            String username = entry.path("username").asText("");
                            if (userId == 0L && username.isEmpty()) {
                                // Fallback: try to get user from task assignment if available
                                username = "未知用户";
                            }
                            historyMap.put("user", Map.of(
                                "id", userId,
                                "username", username.isEmpty() ? "未知用户" : username
                            ));
                            
                            // Add optional fields
                            if (entry.has("review_comment")) {
                                historyMap.put("reviewComment", entry.path("review_comment").asText());
                            }
                            if (entry.has("expert_note")) {
                                historyMap.put("expertNote", entry.path("expert_note").asText());
                            }
                            if (entry.has("adjustment_reason")) {
                                historyMap.put("adjustmentReason", entry.path("adjustment_reason").asText());
                            }
                            
                            historyList.add(historyMap);
                        }
                    }
                }
            } else {
                // Fallback to old format (fields)
                JsonNode fields = archive.path("fields");
                
                if (!fields.isMissingNode() && fields.isObject()) {
                    Iterator<String> fieldNamesIter = fields.fieldNames();
                    while (fieldNamesIter.hasNext()) {
                        String fieldName = fieldNamesIter.next();
                        JsonNode entries = fields.path(fieldName);
                        
                        if (!entries.isMissingNode() && entries.isArray()) {
                            for (int i = 0; i < entries.size(); i++) {
                                JsonNode entry = entries.get(i);
                                if (entry == null) continue;
                                
                                Map<String, Object> historyMap = new HashMap<>();
                                historyMap.put("id", i + 1);
                                historyMap.put("fieldName", fieldName);
                                historyMap.put("fieldLabel", fieldName);
                                historyMap.put("oldValue", i > 0 ? entries.get(i-1).path("annotationValue").asText(null) : null);
                                historyMap.put("newValue", entry.path("annotationValue").asText(null));
                                historyMap.put("actionType", i == 0 ? "CREATE" : "UPDATE");
                                historyMap.put("version", i + 1);
                                historyMap.put("createdAt", entry.path("timestamp").asText(null));
                                
                                historyMap.put("user", Map.of("id", entry.path("userId").asLong(0L), "username", "User " + entry.path("userId").asLong(0L)));
                                
                                historyMap.put("task", Map.of("id", entry.path("taskId").asLong(0L), "title", "Task " + entry.path("taskId").asLong(0L)));
                                
                                historyList.add(historyMap);
                            }
                        }
                    }
                }
            }

            historyList.sort(Comparator.comparing((Map<String, Object> m) -> {
                Object dateObj = m.get("createdAt");
                String dateStr = dateObj != null ? dateObj.toString() : null;
                return dateStr != null ? LocalDateTime.parse(dateStr) : LocalDateTime.MIN;
            }).reversed());

            return ResponseEntity.ok(Map.of("history", historyList));
            
        } catch (Exception e) {
            logger.error("Error in getDocumentAnnotationHistory: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.ok(Map.of("history", Collections.emptyList()));
        }
    }

    @GetMapping("/document/{documentId}/field/{fieldName}/history")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getFieldHistory(@PathVariable Long documentId,
                                            @PathVariable String fieldName,
                                            Authentication authentication) {
        try {
            Path archivePath = Paths.get("./uploads/documents", documentId + "_archive.json");
            File archiveFile = archivePath.toFile();
            
            if (!archiveFile.exists()) {
                return ResponseEntity.ok(Map.of("history", Collections.emptyList()));
            }

            JsonNode archive = objectMapper.readTree(archiveFile);
            
            List<Map<String, Object>> historyList = new ArrayList<>();

            // Try new format first (annotation_records)
            JsonNode entries = archive.path("annotation_records").path(fieldName);
            
            if (!entries.isMissingNode() && entries.isArray()) {
                for (int i = 0; i < entries.size(); i++) {
                    JsonNode entry = entries.get(i);
                    if (entry == null) continue;
                    
                    Map<String, Object> historyMap = new HashMap<>();
                    historyMap.put("id", i + 1);
                    historyMap.put("fieldName", fieldName);
                    historyMap.put("fieldLabel", fieldName);
                    
                    // Get old and new values
                    JsonNode annotationContent = entry.path("annotation_content");
                    Object newValue = null;
                    if (annotationContent.isTextual()) {
                        newValue = annotationContent.asText();
                    } else if (annotationContent.isNumber()) {
                        newValue = annotationContent.isDouble() ? annotationContent.asDouble() : annotationContent.asLong();
                    } else if (annotationContent.isBoolean()) {
                        newValue = annotationContent.asBoolean();
                    } else if (annotationContent.isArray() || annotationContent.isObject()) {
                        newValue = objectMapper.convertValue(annotationContent, Object.class);
                    }
                    
                    Object oldValue = null;
                    if (i > 0) {
                        JsonNode prevEntry = entries.get(i - 1);
                        JsonNode prevContent = prevEntry.path("annotation_content");
                        if (prevContent.isTextual()) {
                            oldValue = prevContent.asText();
                        } else if (prevContent.isNumber()) {
                            oldValue = prevContent.isDouble() ? prevContent.asDouble() : prevContent.asLong();
                        } else if (prevContent.isBoolean()) {
                            oldValue = prevContent.asBoolean();
                        } else if (prevContent.isArray() || prevContent.isObject()) {
                            oldValue = objectMapper.convertValue(prevContent, Object.class);
                        }
                    }
                    
                    historyMap.put("oldValue", oldValue);
                    historyMap.put("newValue", newValue);
                    historyMap.put("actionType", i == 0 ? "CREATE" : "UPDATE");
                    historyMap.put("version", i + 1);
                    historyMap.put("createdAt", entry.path("operation_time").asText(null));
                    
                    // Extract task info
                    String taskIdStr = entry.path("task_id").asText("");
                    Long taskId = 0L;
                    if (taskIdStr.startsWith("TASK-")) {
                        try {
                            taskId = Long.parseLong(taskIdStr.substring(5));
                        } catch (NumberFormatException e) {
                            // ignore
                        }
                    }
                    
                    historyMap.put("task", Map.of(
                        "id", taskId,
                        "title", entry.path("task_name").asText("")
                    ));
                    
                    historyMap.put("roleType", entry.path("role_type").asText(""));
                    
                    // Add optional fields
                    if (entry.has("review_comment")) {
                        historyMap.put("reviewComment", entry.path("review_comment").asText());
                    }
                    if (entry.has("expert_note")) {
                        historyMap.put("expertNote", entry.path("expert_note").asText());
                    }
                    if (entry.has("adjustment_reason")) {
                        historyMap.put("adjustmentReason", entry.path("adjustment_reason").asText());
                    }
                    
                    historyList.add(historyMap);
                }
            } else {
                // Fallback to old format (fields)
                JsonNode oldEntries = archive.path("fields").path(fieldName);
                
                if (!oldEntries.isMissingNode() && oldEntries.isArray()) {
                    for (int i = 0; i < oldEntries.size(); i++) {
                        JsonNode entry = oldEntries.get(i);
                        if (entry == null) continue;
                        
                        Map<String, Object> historyMap = new HashMap<>();
                        historyMap.put("id", i + 1);
                        historyMap.put("fieldName", fieldName);
                        historyMap.put("fieldLabel", fieldName);
                        historyMap.put("oldValue", i > 0 ? oldEntries.get(i-1).path("annotationValue").asText(null) : null);
                        historyMap.put("newValue", entry.path("annotationValue").asText(null));
                        historyMap.put("actionType", i == 0 ? "CREATE" : "UPDATE");
                        historyMap.put("version", i + 1);
                        historyMap.put("createdAt", entry.path("timestamp").asText(null));
                        
                        historyMap.put("user", Map.of("id", entry.path("userId").asLong(0L), "username", "User " + entry.path("userId").asLong(0L)));
                        
                        historyMap.put("task", Map.of("id", entry.path("taskId").asLong(0L), "title", "Task " + entry.path("taskId").asLong(0L)));
                        
                        historyList.add(historyMap);
                    }
                }
            }

            historyList.sort(Comparator.comparing((Map<String, Object> m) -> {
                Object dateObj = m.get("createdAt");
                String dateStr = dateObj != null ? dateObj.toString() : null;
                return dateStr != null ? LocalDateTime.parse(dateStr) : LocalDateTime.MIN;
            }).reversed());

            return ResponseEntity.ok(Map.of("history", historyList));
            
        } catch (Exception e) {
            logger.error("Error in getFieldHistory: {}", e.getMessage(), e);
            e.printStackTrace();
            return ResponseEntity.ok(Map.of("history", Collections.emptyList()));
        }
    }

    private Map<String, Object> convertAnnotationToMap(Annotation annotation) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", annotation.getId());
        map.put("taskId", annotation.getTask().getId());
        map.put("taskAssignmentId", annotation.getTaskAssignment().getId());
        map.put("annotationData", annotation.getAnnotationData());
        map.put("version", annotation.getVersion());
        map.put("status", annotation.getStatus());
        map.put("submittedAt", annotation.getSubmittedAt());
        map.put("reviewedAt", annotation.getReviewedAt());
        map.put("confidenceScore", annotation.getConfidenceScore());
        map.put("reviewNotes", annotation.getReviewNotes());

        if (annotation.getReviewer() != null) {
            map.put("reviewer", Map.of(
                "id", annotation.getReviewer().getId(),
                "username", annotation.getReviewer().getUsername()
            ));
        }

        return map;
    }

    private Map<String, Object> convertTaskToMap(Task task) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", task.getId());
        map.put("title", task.getTitle());
        map.put("description", task.getDescription());
        map.put("status", task.getStatus());
        map.put("priority", task.getPriority());
        map.put("deadline", task.getDeadline());
        map.put("createdAt", task.getCreatedAt());

        map.put("document", Map.of(
            "id", task.getDocument().getId(),
            "filename", task.getDocument().getOriginalFilename()
        ));

        map.put("category", Map.of(
            "id", task.getCategory().getId(),
            "name", task.getCategory().getName()
        ));

        return map;
    }

    private Map<String, Object> convertAssignmentToMap(TaskAssignment assignment) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", assignment.getId());
        map.put("assignmentType", assignment.getAssignmentType());
        map.put("status", assignment.getStatus());
        map.put("assignedAt", assignment.getAssignedAt());
        map.put("completedAt", assignment.getCompletedAt());
        map.put("notes", assignment.getNotes());

        map.put("user", Map.of(
            "id", assignment.getUser().getId(),
            "username", assignment.getUser().getUsername(),
            "role", assignment.getUser().getRole()
        ));

        return map;
    }

    /**
     * 将 AssignmentType 映射为 role_type 字符串
     */
    private String mapAssignmentTypeToRoleType(TaskAssignment.AssignmentType assignmentType) {
        switch (assignmentType) {
            case ANNOTATION:
                return "ordinary_annotator";
            case AI_ANNOTATION:
                return "ai_annotator";
            case REVIEW:
                return "reviewer";
            case EXPERT_REVIEW:
                return "expert";
            case INSPECTION:
                return "reviewer"; // INSPECTION 也映射为 reviewer
            default:
                return "ordinary_annotator";
        }
    }

    /**
     * 更新审核存档（在审核标注时调用）
     */
    private void updateArchiveForReview(Document document, Task task, TaskAssignment assignment, 
                                       Annotation annotation, String reviewNotes) {
        try {
            JsonNode annotationDataJson = objectMapper.readTree(annotation.getAnnotationData());
            
            updateArchiveWithLock(document.getId(), archive -> {
                // Initialize annotation_records if not exists
                JsonNode annotationRecordsNode = archive.path("annotation_records");
                ObjectNode annotationRecords;
                if (annotationRecordsNode.isMissingNode() || !(annotationRecordsNode instanceof ObjectNode)) {
                    annotationRecords = archive.putObject("annotation_records");
                } else {
                    annotationRecords = (ObjectNode) annotationRecordsNode;
                }

                // Get role type
                TaskAssignment.AssignmentType assignmentType = assignment.getAssignmentType();
                String roleType = mapAssignmentTypeToRoleType(assignmentType);
                
                String taskName = task.getTitle();
                String taskIdStr = "TASK-" + task.getId().toString();
                String operationTime = LocalDateTime.now().toString();

                // For each field in annotation data
                Iterator<String> fieldNames = annotationDataJson.fieldNames();
                while (fieldNames.hasNext()) {
                    String fieldName = fieldNames.next();
                    JsonNode valueNode = annotationDataJson.path(fieldName);

                    // Get or create field array
                    JsonNode fieldNode = annotationRecords.path(fieldName);
                    ArrayNode fieldArray;
                    if (fieldNode instanceof ArrayNode) {
                        fieldArray = (ArrayNode) fieldNode;
                    } else {
                        fieldArray = annotationRecords.putArray(fieldName);
                    }

                    // Create review record entry
                    ObjectNode entry = JsonNodeFactory.instance.objectNode();
                    entry.put("task_id", taskIdStr);
                    entry.put("task_name", taskName);
                    entry.put("role_type", roleType);
                    entry.put("operation_time", operationTime);
                    
                    // Set annotation_content (same as last entry or from annotation data)
                    if (valueNode.isTextual()) {
                        entry.put("annotation_content", valueNode.asText());
                    } else if (valueNode.isNumber()) {
                        if (valueNode.isDouble() || valueNode.isFloat()) {
                            entry.put("annotation_content", valueNode.asDouble());
                        } else {
                            entry.put("annotation_content", valueNode.asLong());
                        }
                    } else if (valueNode.isBoolean()) {
                        entry.put("annotation_content", valueNode.asBoolean());
                    } else if (valueNode.isArray() || valueNode.isObject()) {
                        entry.set("annotation_content", valueNode);
                    } else {
                        entry.put("annotation_content", valueNode.asText(""));
                    }

                    // Add review_comment or expert_note
                    if (roleType.equals("reviewer") && reviewNotes != null && !reviewNotes.trim().isEmpty()) {
                        entry.put("review_comment", reviewNotes);
                    } else if (roleType.equals("expert") && reviewNotes != null && !reviewNotes.trim().isEmpty()) {
                        entry.put("expert_note", reviewNotes);
                    }

                    fieldArray.add(entry);
                }

                // Update last_modified_time
                archive.put("last_modified_time", LocalDateTime.now().toString());
                
                return archive;
            });
        } catch (Exception e) {
            logger.error("Failed to update archive for review: {}", e.getMessage(), e);
            e.printStackTrace();
            // Don't fail review
        }
    }

    /**
     * 更新标注存档（在提交标注时调用）
     */
    private void updateArchiveForAnnotation(Document document, Task task, TaskAssignment assignment, 
                                            Annotation annotation, Object annotationData) {
        try {
            logger.info("=== updateArchiveForAnnotation START ===");
            logger.info("Document ID: {}, Task ID: {}, Annotation ID: {}", 
                       document.getId(), task.getId(), annotation.getId());
            
            JsonNode dataJson = objectMapper.valueToTree(annotationData);
            // Log annotation data keys (collect to list first to avoid consuming iterator)
            List<String> fieldNamesList = new ArrayList<>();
            dataJson.fieldNames().forEachRemaining(fieldNamesList::add);
            logger.info("Annotation data keys: {}, size: {}", fieldNamesList, dataJson.size());
            
            boolean success = updateArchiveWithLock(document.getId(), archive -> {
                // Initialize file_info if not exists
                JsonNode fileInfoNode = archive.path("file_info");
                ObjectNode fileInfo;
                if (fileInfoNode.isMissingNode() || !(fileInfoNode instanceof ObjectNode)) {
                    fileInfo = archive.putObject("file_info");
                    fileInfo.put("file_id", "doc-" + document.getId().toString());
                    fileInfo.put("file_name", document.getOriginalFilename());
                    fileInfo.put("storage_path", document.getFilePath());
                    fileInfo.put("upload_time", document.getCreatedAt() != null ? 
                        document.getCreatedAt().toString() : LocalDateTime.now().toString());
                    fileInfo.put("file_size_bytes", document.getFileSize());
                    if (task.getFormConfig() != null) {
                        fileInfo.put("template_id", "template_" + task.getFormConfig().getId().toString());
                    }
                }

                // Initialize annotation_records if not exists
                JsonNode annotationRecordsNode = archive.path("annotation_records");
                ObjectNode annotationRecords;
                if (annotationRecordsNode.isMissingNode() || !(annotationRecordsNode instanceof ObjectNode)) {
                    annotationRecords = archive.putObject("annotation_records");
                } else {
                    annotationRecords = (ObjectNode) annotationRecordsNode;
                }

                // Get role type
                String roleType = mapAssignmentTypeToRoleType(assignment.getAssignmentType());
                
                // Get task name
                String taskName = task.getTitle();
                String taskIdStr = "TASK-" + task.getId().toString();
                
                // Get operation time
                String operationTime = annotation.getSubmittedAt() != null ? 
                    annotation.getSubmittedAt().toString() : LocalDateTime.now().toString();

                // For each field in annotation data
                Iterator<String> fieldNames = dataJson.fieldNames();
                int fieldCount = 0;
                while (fieldNames.hasNext()) {
                    String fieldName = fieldNames.next();
                    fieldCount++;
                    JsonNode valueNode = dataJson.path(fieldName);
                    logger.debug("  Processing field: {} (type: {})", fieldName, valueNode.getNodeType());

                    // Get or create field array
                    JsonNode fieldNode = annotationRecords.path(fieldName);
                    ArrayNode fieldArray;
                    if (fieldNode instanceof ArrayNode) {
                        fieldArray = (ArrayNode) fieldNode;
                    } else {
                        fieldArray = annotationRecords.putArray(fieldName);
                    }

                    // Check if there's an existing record with the same task_id and role_type
                    boolean foundExisting = false;
                    for (int i = 0; i < fieldArray.size(); i++) {
                        JsonNode existingEntry = fieldArray.get(i);
                        if (existingEntry != null && 
                            taskIdStr.equals(existingEntry.path("task_id").asText()) &&
                            roleType.equals(existingEntry.path("role_type").asText())) {
                            // Update existing entry instead of adding a new one
                            ObjectNode existingObj = (ObjectNode) existingEntry;
                            existingObj.put("task_name", taskName);
                            existingObj.put("operation_time", operationTime);
                            
                            // Update user information
                            if (assignment.getUser() != null) {
                                existingObj.put("user_id", assignment.getUser().getId());
                                existingObj.put("username", assignment.getUser().getUsername());
                            }
                            
                            // Update annotation_content based on value type
                            existingObj.remove("annotation_content");
                            if (valueNode.isTextual()) {
                                existingObj.put("annotation_content", valueNode.asText());
                            } else if (valueNode.isNumber()) {
                                if (valueNode.isDouble() || valueNode.isFloat()) {
                                    existingObj.put("annotation_content", valueNode.asDouble());
                                } else {
                                    existingObj.put("annotation_content", valueNode.asLong());
                                }
                            } else if (valueNode.isBoolean()) {
                                existingObj.put("annotation_content", valueNode.asBoolean());
                            } else if (valueNode.isArray() || valueNode.isObject()) {
                                existingObj.set("annotation_content", valueNode);
                            } else {
                                existingObj.put("annotation_content", valueNode.asText(""));
                            }

                            // Update review_comment if reviewer
                            if (roleType.equals("reviewer")) {
                                if (annotation.getReviewNotes() != null) {
                                    existingObj.put("review_comment", annotation.getReviewNotes());
                                } else {
                                    existingObj.remove("review_comment");
                                }
                            }

                            // Update expert_note if expert
                            if (roleType.equals("expert")) {
                                if (annotation.getReviewNotes() != null) {
                                    existingObj.put("expert_note", annotation.getReviewNotes());
                                } else {
                                    existingObj.remove("expert_note");
                                }
                            }

                            // Add adjustment_reason if ordinary_annotator modified AI result
                            if (roleType.equals("ordinary_annotator") && i > 0) {
                                JsonNode prevEntry = fieldArray.get(i - 1);
                                if (prevEntry != null && "ai_annotator".equals(prevEntry.path("role_type").asText())) {
                                    JsonNode prevContent = prevEntry.path("annotation_content");
                                    if (!prevContent.equals(valueNode)) {
                                        existingObj.put("adjustment_reason", "修正AI提取结果");
                                    } else {
                                        existingObj.remove("adjustment_reason");
                                    }
                                }
                            }
                            
                            foundExisting = true;
                            logger.debug("Updated existing annotation record for task={}, role={}, field={}", 
                                       taskIdStr, roleType, fieldName);
                            break;
                        }
                    }

                    // If no existing record found, create a new one
                    if (!foundExisting) {
                        ObjectNode entry = JsonNodeFactory.instance.objectNode();
                        entry.put("task_id", taskIdStr);
                        entry.put("task_name", taskName);
                        entry.put("role_type", roleType);
                        entry.put("operation_time", operationTime);
                        
                        // Add user information
                        if (assignment.getUser() != null) {
                            entry.put("user_id", assignment.getUser().getId());
                            entry.put("username", assignment.getUser().getUsername());
                        }
                        
                        // Set annotation_content based on value type
                        if (valueNode.isTextual()) {
                            entry.put("annotation_content", valueNode.asText());
                        } else if (valueNode.isNumber()) {
                            if (valueNode.isDouble() || valueNode.isFloat()) {
                                entry.put("annotation_content", valueNode.asDouble());
                            } else {
                                entry.put("annotation_content", valueNode.asLong());
                            }
                        } else if (valueNode.isBoolean()) {
                            entry.put("annotation_content", valueNode.asBoolean());
                        } else if (valueNode.isArray() || valueNode.isObject()) {
                            entry.set("annotation_content", valueNode);
                        } else {
                            entry.put("annotation_content", valueNode.asText(""));
                        }

                        // Add review_comment if reviewer
                        if (roleType.equals("reviewer") && annotation.getReviewNotes() != null) {
                            entry.put("review_comment", annotation.getReviewNotes());
                        }

                        // Add expert_note if expert
                        if (roleType.equals("expert") && annotation.getReviewNotes() != null) {
                            entry.put("expert_note", annotation.getReviewNotes());
                        }

                        // Add adjustment_reason if ordinary_annotator modified AI result
                        if (roleType.equals("ordinary_annotator") && fieldArray.size() > 0) {
                            JsonNode lastEntry = fieldArray.get(fieldArray.size() - 1);
                            if (lastEntry != null && "ai_annotator".equals(lastEntry.path("role_type").asText())) {
                                JsonNode lastContent = lastEntry.path("annotation_content");
                                if (!lastContent.equals(valueNode)) {
                                    entry.put("adjustment_reason", "修正AI提取结果");
                                }
                            }
                        }

                        fieldArray.add(entry);
                        logger.debug("Added new annotation record for task={}, role={}, field={}", 
                                   taskIdStr, roleType, fieldName);
                    }
                    logger.debug("  Processed field: {} (array size: {})", fieldName, fieldArray.size());
                }
                logger.info("Total fields processed: {} (one record per task+role+field)", fieldCount);

                // Update template_info
                if (task.getFormConfig() != null) {
                    JsonNode templateInfoNode = archive.path("template_info");
                    ObjectNode templateInfo;
                    if (templateInfoNode.isMissingNode() || !(templateInfoNode instanceof ObjectNode)) {
                        templateInfo = archive.putObject("template_info");
                    } else {
                        templateInfo = (ObjectNode) templateInfoNode;
                    }
                    templateInfo.put("template_id", "template_" + task.getFormConfig().getId().toString());
                    templateInfo.put("template_name", task.getFormConfig().getName());
                    
                    // Get field names from form config
                    ArrayNode fieldsDefined = templateInfo.putArray("fields_defined");
                    if (task.getFormConfig().getFields() != null) {
                        task.getFormConfig().getFields().forEach(field -> {
                            fieldsDefined.add(field.getFieldName());
                        });
                    }
                    
                    // Version (could be based on form config update time or version field if exists)
                    templateInfo.put("version", "v" + (task.getFormConfig().getUpdatedAt() != null ? 
                        task.getFormConfig().getUpdatedAt().toString().substring(0, 10) : "1.0"));
                }

                // Update latest_annotation_version and last_modified_time
                Integer version = annotation.getVersion();
                if (version == null) {
                    version = 1; // Default to 1 if version is null
                }
                archive.put("latest_annotation_version", "v" + version.toString());
                archive.put("last_modified_time", LocalDateTime.now().toString());
                
                return archive;
            });
            
            if (success) {
                logger.info("=== updateArchiveForAnnotation SUCCESS ===");
            } else {
                logger.error("=== updateArchiveForAnnotation FAILED: updateArchiveWithLock returned false ===");
            }
        } catch (Exception e) {
            logger.error("=== updateArchiveForAnnotation EXCEPTION ===", e);
            logger.error("Failed to update archive for annotation: {}", e.getMessage(), e);
            // Don't fail submission, but log the error
        }
    }

    /**
     * 使用文件锁安全地更新文档存档（处理并发写入）
     * @param documentId 文档ID
     * @param updateFunction 更新函数，接收当前存档并返回更新后的存档
     * @return 是否更新成功
     */
    private boolean updateArchiveWithLock(Long documentId, java.util.function.Function<ObjectNode, ObjectNode> updateFunction) {
        // Use the same path format as DocumentController for consistency
        Path archivePath = Paths.get("./uploads/documents", documentId + "_archive.json");
        File archiveFile = archivePath.toFile();
        
        logger.info("=== updateArchiveWithLock START ===");
        logger.info("Document ID: {}, Archive path: {}, exists: {}, size: {}", 
                   documentId, archivePath.toAbsolutePath(), archiveFile.exists(), archiveFile.length());
        
        // 确保目录存在
        try {
            if (archiveFile.getParentFile() != null && !archiveFile.getParentFile().exists()) {
                boolean created = archiveFile.getParentFile().mkdirs();
                logger.info("Created directory: {}", created);
            }
        } catch (Exception e) {
            logger.error("Failed to create archive directory: {}", e.getMessage(), e);
            return false;
        }

        FileLock lock = null;
        FileChannel channel = null;
        RandomAccessFile raf = null;
        
        try {
            // 使用 RandomAccessFile 和 FileChannel 来获取文件锁
            raf = new RandomAccessFile(archiveFile, "rw");
            channel = raf.getChannel();
            
            // 尝试获取独占锁，最多等待5秒
            int maxRetries = 50;
            int retryCount = 0;
            while (retryCount < maxRetries) {
                lock = channel.tryLock();
                if (lock != null) {
                    break;
                }
                // 等待100ms后重试
                Thread.sleep(100);
                retryCount++;
            }
            
            if (lock == null) {
                logger.error("Failed to acquire file lock after {} retries", maxRetries);
                return false;
            }
            
            // 读取现有存档
            ObjectNode archive = JsonNodeFactory.instance.objectNode();
            if (archiveFile.exists() && archiveFile.length() > 0) {
                try {
                    // Need to read from RandomAccessFile since we have a lock on it
                    raf.seek(0);
                    byte[] bytes = new byte[(int) raf.length()];
                    raf.readFully(bytes);
                    String content = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                    if (!content.trim().isEmpty()) {
                        JsonNode temp = objectMapper.readTree(content);
                        if (temp != null && !temp.isMissingNode() && temp instanceof ObjectNode) {
                            archive = (ObjectNode) temp;
                            logger.info("Loaded existing archive with {} fields", archive.size());
                        } else {
                            logger.warn("Archive file contains invalid JSON, creating new archive");
                            archive = JsonNodeFactory.instance.objectNode();
                        }
                    }
                } catch (Exception e) {
                    logger.error("Failed to parse existing archive, creating new one: {}", e.getMessage(), e);
                    // Continue with empty archive
                    archive = JsonNodeFactory.instance.objectNode();
                }
            } else {
                logger.info("Creating new archive file (file doesn't exist or is empty)");
            }
            
            // 应用更新函数
            archive = updateFunction.apply(archive);
            logger.info("Archive after update has {} fields", archive.size());
            
            // 先关闭RandomAccessFile和释放锁，然后再写入文件
            if (raf != null) {
                try {
                    raf.close();
                } catch (Exception e) {
                    logger.error("Failed to close RandomAccessFile: {}", e.getMessage(), e);
                }
            }
            if (channel != null) {
                try {
                    channel.close();
                } catch (Exception e) {
                    logger.error("Failed to close channel: {}", e.getMessage(), e);
                }
            }
            if (lock != null) {
                try {
                    lock.release();
                } catch (Exception e) {
                    logger.error("Failed to release lock: {}", e.getMessage(), e);
                }
            }
            // Set to null to prevent releasing again in finally block
            lock = null;
            channel = null;
            raf = null;
            
            // 写回文件（使用临时文件确保原子性）
            Path tempPath = Paths.get(archivePath.toString() + ".tmp");
            File tempFile = tempPath.toFile();
            
            logger.info("Writing to temp file: {}", tempPath.toAbsolutePath());
            // Ensure parent directory exists
            if (tempFile.getParentFile() != null && !tempFile.getParentFile().exists()) {
                tempFile.getParentFile().mkdirs();
            }
            // Convert to JSON string first, then write with UTF-8 encoding to ensure Unicode support
            String jsonString = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(archive);
            Files.write(tempPath, jsonString.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            logger.info("Temp file written, size: {}", tempFile.length());
            
            // 验证临时文件是否成功写入
            if (!tempFile.exists() || tempFile.length() == 0) {
                logger.error("Temp file was not created or is empty!");
                if (tempFile.exists()) {
                    tempFile.delete();
                }
                return false;
            }
            
            // 原子性地替换原文件
            if (archiveFile.exists()) {
                boolean deleted = archiveFile.delete();
                logger.info("Deleted old archive file: {}", deleted);
                if (!deleted) {
                    logger.error("Failed to delete old archive file!");
                    // Try to delete temp file
                    if (tempFile.exists()) {
                        tempFile.delete();
                    }
                    return false;
                }
            }
            
            // Move temp file to archive file
            try {
                Files.move(tempPath, archivePath, java.nio.file.StandardCopyOption.ATOMIC_MOVE, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                logger.info("Moved temp file to archive file");
            } catch (Exception e) {
                logger.error("Failed to move temp file: {}", e.getMessage(), e);
                // Clean up temp file
                if (tempFile.exists()) {
                    tempFile.delete();
                }
                return false;
            }
            
            // 验证文件是否成功写入
            File finalFile = archivePath.toFile();
            if (finalFile.exists() && finalFile.length() > 0) {
                logger.info("=== updateArchiveWithLock SUCCESS === Final file size: {}", finalFile.length());
                return true;
            } else {
                logger.error("=== updateArchiveWithLock FAILED: File not created or empty ===");
                return false;
            }
            
        } catch (Exception e) {
            logger.error("Failed to update archive with lock: {}", e.getMessage(), e);
            return false;
        } finally {
            // 释放锁和资源
            if (lock != null) {
                try {
                    lock.release();
                } catch (Exception e) {
                    logger.error("Failed to release lock: {}", e.getMessage(), e);
                }
            }
            if (channel != null) {
                try {
                    channel.close();
                } catch (Exception e) {
                    logger.error("Failed to close channel: {}", e.getMessage(), e);
                }
            }
            if (raf != null) {
                try {
                    raf.close();
                } catch (Exception e) {
                    logger.error("Failed to close RandomAccessFile: {}", e.getMessage(), e);
                }
            }
        }
    }

    /**
     * 获取文档的标注档案内容
     */
    @GetMapping("/document/{documentId}/archive")
    @PreAuthorize("hasRole('ADMIN') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getDocumentArchive(@PathVariable Long documentId,
                                               Authentication authentication) {
        try {
            Path archivePath = Paths.get("./uploads/documents", documentId + "_archive.json");
            File archiveFile = archivePath.toFile();
            
            if (!archiveFile.exists()) {
                return ResponseEntity.ok(Map.of(
                    "archive", Collections.emptyMap(),
                    "hasArchive", false
                ));
            }

            JsonNode archive = objectMapper.readTree(archiveFile);
            Map<String, Object> archiveMap = objectMapper.convertValue(archive, Map.class);
            
            return ResponseEntity.ok(Map.of(
                "archive", archiveMap,
                "hasArchive", true
            ));
        } catch (Exception e) {
            logger.error("Failed to get document archive: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取标注档案失败: " + e.getMessage()));
        }
    }

    /**
     * 检测文档标注冲突并返回冲突数量
     */
    @GetMapping("/document/{documentId}/conflicts")
    @PreAuthorize("hasRole('ADMIN') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getDocumentConflicts(@PathVariable Long documentId,
                                                  Authentication authentication) {
        try {
            Path archivePath = Paths.get("./uploads/documents", documentId + "_archive.json");
            File archiveFile = archivePath.toFile();
            
            if (!archiveFile.exists()) {
                return ResponseEntity.ok(Map.of(
                    "conflictCount", 0,
                    "conflicts", Collections.emptyList()
                ));
            }

            JsonNode archive = objectMapper.readTree(archiveFile);
            JsonNode annotationRecords = archive.path("annotation_records");
            
            if (annotationRecords.isMissingNode() || !annotationRecords.isObject()) {
                return ResponseEntity.ok(Map.of(
                    "conflictCount", 0,
                    "conflicts", Collections.emptyList()
                ));
            }

            List<Map<String, Object>> conflicts = new ArrayList<>();
            int conflictCount = 0;

            Iterator<String> fieldNames = annotationRecords.fieldNames();
            while (fieldNames.hasNext()) {
                String fieldName = fieldNames.next();
                JsonNode entries = annotationRecords.path(fieldName);
                
                if (!entries.isArray() || entries.size() < 2) {
                    continue; // 少于2个标注，无冲突
                }

                // 检查是否有不同的标注内容
                Set<String> uniqueValues = new HashSet<>();
                List<Map<String, Object>> fieldConflicts = new ArrayList<>();
                
                for (int i = 0; i < entries.size(); i++) {
                    JsonNode entry = entries.get(i);
                    if (entry == null) continue;
                    
                    JsonNode annotationContent = entry.path("annotation_content");
                    String value = annotationContent.isTextual() ? annotationContent.asText() : 
                                  annotationContent.toString();
                    
                    // 获取标注者信息
                    String username = entry.path("username").asText("未知");
                    String roleType = entry.path("role_type").asText("未知");
                    String taskId = entry.path("task_id").asText("");
                    String operationTime = entry.path("operation_time").asText("");
                    
                    Map<String, Object> conflictEntry = new HashMap<>();
                    conflictEntry.put("username", username);
                    conflictEntry.put("roleType", roleType);
                    conflictEntry.put("taskId", taskId);
                    conflictEntry.put("operationTime", operationTime);
                    conflictEntry.put("value", value);
                    
                    fieldConflicts.add(conflictEntry);
                    uniqueValues.add(value);
                }

                // 如果有不同的值，则存在冲突
                if (uniqueValues.size() > 1) {
                    conflictCount++;
                    Map<String, Object> conflict = new HashMap<>();
                    conflict.put("fieldName", fieldName);
                    conflict.put("entries", fieldConflicts);
                    conflicts.add(conflict);
                }
            }

            return ResponseEntity.ok(Map.of(
                "conflictCount", conflictCount,
                "conflicts", conflicts
            ));
        } catch (Exception e) {
            logger.error("Failed to get document conflicts: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "检测冲突失败: " + e.getMessage()));
        }
    }

    /**
     * 批量获取文档的冲突数量（用于文件夹统计）
     */
    @PostMapping("/documents/conflicts/batch")
    @PreAuthorize("hasRole('ADMIN') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getBatchDocumentConflicts(@RequestBody Map<String, Object> request,
                                                       Authentication authentication) {
        try {
            @SuppressWarnings("unchecked")
            List<Long> documentIds = (List<Long>) request.get("documentIds");
            
            if (documentIds == null || documentIds.isEmpty()) {
                return ResponseEntity.ok(Map.of("conflicts", Collections.emptyMap()));
            }

            Map<Long, Integer> conflictMap = new HashMap<>();
            
            for (Long documentId : documentIds) {
                try {
                    Path archivePath = Paths.get("./uploads/documents", documentId + "_archive.json");
                    File archiveFile = archivePath.toFile();
                    
                    if (!archiveFile.exists()) {
                        conflictMap.put(documentId, 0);
                        continue;
                    }

                    JsonNode archive = objectMapper.readTree(archiveFile);
                    JsonNode annotationRecords = archive.path("annotation_records");
                    
                    if (annotationRecords.isMissingNode() || !annotationRecords.isObject()) {
                        conflictMap.put(documentId, 0);
                        continue;
                    }

                    int conflictCount = 0;
                    Iterator<String> fieldNames = annotationRecords.fieldNames();
                    while (fieldNames.hasNext()) {
                        String fieldName = fieldNames.next();
                        JsonNode entries = annotationRecords.path(fieldName);
                        
                        if (!entries.isArray() || entries.size() < 2) {
                            continue;
                        }

                        Set<String> uniqueValues = new HashSet<>();
                        for (int i = 0; i < entries.size(); i++) {
                            JsonNode entry = entries.get(i);
                            if (entry == null) continue;
                            
                            JsonNode annotationContent = entry.path("annotation_content");
                            String value = annotationContent.isTextual() ? annotationContent.asText() : 
                                          annotationContent.toString();
                            uniqueValues.add(value);
                        }

                        if (uniqueValues.size() > 1) {
                            conflictCount++;
                        }
                    }
                    
                    conflictMap.put(documentId, conflictCount);
                } catch (Exception e) {
                    logger.warn("Failed to get conflicts for document {}: {}", documentId, e.getMessage());
                    conflictMap.put(documentId, 0);
                }
            }

            return ResponseEntity.ok(Map.of("conflicts", conflictMap));
        } catch (Exception e) {
            logger.error("Failed to get batch document conflicts: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "批量检测冲突失败: " + e.getMessage()));
        }
    }
}