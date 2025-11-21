package com.annotationplatform.controller;

import com.annotationplatform.entity.*;
import com.annotationplatform.repository.*;
import com.annotationplatform.service.TaskAssignmentService;
import com.annotationplatform.service.WorkflowService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.core.type.TypeReference;
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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/tasks")
@CrossOrigin(origins = "*", maxAge = 3600)
public class TaskController {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskAssignmentRepository taskAssignmentRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private FormConfigRepository formConfigRepository;

    @Autowired
    private DocumentTypeRepository documentTypeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private QualityCheckRepository qualityCheckRepository;

    @Autowired
    private TaskAssignmentService taskAssignmentService;

    @Autowired
    private WorkflowService workflowService;

    @Autowired
    private AnnotationRepository annotationRepository;

    private final ObjectMapper objectMapper;
    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(TaskController.class);
    
    public TaskController() {
        this.objectMapper = new ObjectMapper();
        this.objectMapper.registerModule(new JavaTimeModule());
        this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @GetMapping
    public ResponseEntity<?> getTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) Long documentId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long formConfigId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            Authentication authentication) {

        try {
            Sort.Direction direction = Sort.Direction.fromString(sortDir);
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

            Task.TaskStatus taskStatus = null;
            if (status != null && !status.isEmpty()) {
                try {
                    taskStatus = Task.TaskStatus.valueOf(status.toUpperCase());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "无效的任务状态"));
                }
            }

            Task.Priority taskPriority = null;
            if (priority != null && !priority.isEmpty()) {
                try {
                    taskPriority = Task.Priority.valueOf(priority.toUpperCase());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "无效的任务优先级"));
                }
            }

            LocalDateTime startDate = null;
            LocalDateTime endDate = null;

            Page<Task> taskPage;
            if (documentId != null || categoryId != null || formConfigId != null ||
                taskStatus != null || taskPriority != null) {
                // Use filtered query when filters are provided
                taskPage = taskRepository.findWithFilters(
                    documentId, categoryId, formConfigId, taskStatus, taskPriority,
                    null, startDate, endDate, pageable);
            } else {
                // Use simple findAll when no filters
                taskPage = taskRepository.findAll(pageable);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("tasks", taskPage.getContent().stream().map(this::convertTaskToMap));
            response.put("currentPage", taskPage.getNumber());
            response.put("totalItems", taskPage.getTotalElements());
            response.put("totalPages", taskPage.getTotalPages());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取任务列表失败: " + e.getMessage()));
        }
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createTask(@RequestBody Map<String, Object> request,
                                       Authentication authentication) {
        try {
            String title = (String) request.get("title");
            String description = (String) request.get("description");
            Long documentId = Long.valueOf(request.get("documentId").toString());
            
            // Category and form config are optional
            Long categoryId = null;
            if (request.get("categoryId") != null) {
                categoryId = Long.valueOf(request.get("categoryId").toString());
            }
            Long formConfigId = null;
            if (request.get("formConfigId") != null) {
                formConfigId = Long.valueOf(request.get("formConfigId").toString());
            }

            if (title == null || title.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务标题不能为空"));
            }

            // Get current user
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            // Validate document exists and is processed
            Optional<Document> documentOpt = documentRepository.findById(documentId);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "文档不存在"));
            }
            Document document = documentOpt.get();

            // Validate category (optional)
            Category category = null;
            if (categoryId != null) {
                Optional<Category> categoryOpt = categoryRepository.findById(categoryId);
                if (categoryOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "分类不存在"));
                }
                category = categoryOpt.get();
            }

            // Validate form config (optional)
            FormConfig formConfig = null;
            if (formConfigId != null) {
                Optional<FormConfig> formConfigOpt = formConfigRepository.findById(formConfigId);
                if (formConfigOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "表单配置不存在"));
                }
                formConfig = formConfigOpt.get();
            }

            // Check if task already exists for this document
            List<Task> existingTasks = taskRepository.findByDocumentIdAndStatus(documentId, Task.TaskStatus.CREATED);
            if (!existingTasks.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "该文档已存在进行中的任务"));
            }

            // Create task
            Task task = new Task();
            task.setTitle(title.trim());
            task.setDescription(description != null ? description.trim() : null);
            task.setDocument(document);
            task.setCategory(category);
            task.setFormConfig(formConfig);
            task.setCreatedBy(user);

            // Save document index information as JSON
            // This preserves document information even if the document is deleted
            Map<String, Object> documentIndex = new HashMap<>();
            documentIndex.put("id", document.getId());
            documentIndex.put("filename", document.getFilename());
            documentIndex.put("originalFilename", document.getOriginalFilename());
            documentIndex.put("filePath", document.getFilePath());
            documentIndex.put("fileSize", document.getFileSize());
            documentIndex.put("mimeType", document.getMimeType());
            documentIndex.put("checksum", document.getChecksum());
            documentIndex.put("folderPath", document.getFolderPath());
            if (document.getFolder() != null) {
                documentIndex.put("folderId", document.getFolder().getId());
            }
            documentIndex.put("status", document.getStatus().name());
            documentIndex.put("priority", document.getPriority().name());
            if (document.getCategory() != null) {
                documentIndex.put("categoryId", document.getCategory().getId());
            }
            if (document.getDocumentType() != null) {
                documentIndex.put("documentTypeId", document.getDocumentType().getId());
            }
            documentIndex.put("createdAt", document.getCreatedAt());
            documentIndex.put("savedAt", LocalDateTime.now());
            
            task.setDocumentIndex(objectMapper.writeValueAsString(documentIndex));

            Task savedTask = taskRepository.save(task);

            return ResponseEntity.ok(Map.of(
                "message", "任务创建成功",
                "task", convertTaskToMap(savedTask)
            ));

        } catch (Exception e) {
            e.printStackTrace(); // Print stack trace for debugging
            String errorMessage = e.getMessage();
            if (errorMessage != null && errorMessage.contains("ConstraintViolationException")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "数据库约束错误，请检查分类和表单配置是否存在"));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "创建任务失败: " + errorMessage));
        }
    }

    @PostMapping("/batch")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createBatchTasks(@RequestBody Map<String, Object> request,
                                            Authentication authentication) {
        try {
            String batchName = (String) request.get("batchName");
            
            if (batchName == null || batchName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "批次名称不能为空"));
            }
            
            // Handle both List<Integer> and List<Long> from frontend
            Object documentIdsObj = request.get("documentIds");
            if (documentIdsObj == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "文档ID列表不能为空"));
            }
            
            List<Long> documentIds = new ArrayList<>();
            if (documentIdsObj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Object> ids = (List<Object>) documentIdsObj;
                for (Object id : ids) {
                    if (id instanceof Number) {
                        documentIds.add(((Number) id).longValue());
                    } else {
                        return ResponseEntity.badRequest().body(Map.of("message", "文档ID格式错误"));
                    }
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("message", "文档ID列表格式错误"));
            }
            
            if (documentIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "文档ID列表不能为空"));
            }

            // Get current user
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            // Generate batch ID
            String batchId = "BATCH_" + System.currentTimeMillis() + "_" + user.getId();

            // Category and form config are optional
            Long categoryId = null;
            if (request.get("categoryId") != null) {
                categoryId = Long.valueOf(request.get("categoryId").toString());
            }
            Long formConfigId = null;
            if (request.get("formConfigId") != null) {
                formConfigId = Long.valueOf(request.get("formConfigId").toString());
            }

            // Validate category (optional)
            Category category = null;
            if (categoryId != null) {
                Optional<Category> categoryOpt = categoryRepository.findById(categoryId);
                if (categoryOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "分类不存在"));
                }
                category = categoryOpt.get();
            }

            // Validate form config (optional)
            FormConfig formConfig = null;
            if (formConfigId != null) {
                Optional<FormConfig> formConfigOpt = formConfigRepository.findById(formConfigId);
                if (formConfigOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "表单配置不存在"));
                }
                formConfig = formConfigOpt.get();
            }

            List<String> errors = new ArrayList<>();
            int skipCount = 0;
            List<Map<String, Object>> allDocuments = new ArrayList<>();
            Document firstDocument = null;

            // Collect all document information
            for (Long documentId : documentIds) {
                try {
                    // Validate document exists
                    Optional<Document> documentOpt = documentRepository.findById(documentId);
                    if (documentOpt.isEmpty()) {
                        errors.add("文档 " + documentId + ": 文档不存在");
                        continue;
                    }
                    Document document = documentOpt.get();

                    // Check if task already exists for this document
                    List<Task> existingTasks = taskRepository.findByDocumentIdAndStatus(documentId, Task.TaskStatus.CREATED);
                    if (!existingTasks.isEmpty()) {
                        skipCount++;
                        continue;
                    }

                    // Save first document for the parent task
                    if (firstDocument == null) {
                        firstDocument = document;
                    }

                    // Build document index for this document
                    Map<String, Object> documentIndex = new HashMap<>();
                    documentIndex.put("id", document.getId());
                    documentIndex.put("filename", document.getFilename());
                    documentIndex.put("originalFilename", document.getOriginalFilename());
                    documentIndex.put("filePath", document.getFilePath());
                    documentIndex.put("fileSize", document.getFileSize());
                    documentIndex.put("mimeType", document.getMimeType());
                    documentIndex.put("checksum", document.getChecksum());
                    documentIndex.put("folderPath", document.getFolderPath());
                    if (document.getFolder() != null) {
                        documentIndex.put("folderId", document.getFolder().getId());
                    }
                    documentIndex.put("status", document.getStatus() != null ? document.getStatus().name() : null);
                    documentIndex.put("priority", document.getPriority() != null ? document.getPriority().name() : "NORMAL");
                    if (document.getCategory() != null) {
                        documentIndex.put("categoryId", document.getCategory().getId());
                    }
                    if (document.getDocumentType() != null) {
                        documentIndex.put("documentTypeId", document.getDocumentType().getId());
                    }
                    documentIndex.put("createdAt", document.getCreatedAt());
                    documentIndex.put("savedAt", LocalDateTime.now());
                    
                    allDocuments.add(documentIndex);
                } catch (Exception e) {
                    e.printStackTrace();
                    String errorMsg = e.getMessage();
                    if (errorMsg == null || errorMsg.isEmpty()) {
                        errorMsg = e.getClass().getSimpleName();
                    }
                    // Add more details for constraint violations
                    if (e.getCause() != null) {
                        errorMsg += " (" + e.getCause().getMessage() + ")";
                    }
                    errors.add("文档 " + documentId + ": " + errorMsg);
                }
            }

            // Create a single parent task with all documents information
            Task parentTask = null;
            if (firstDocument != null && !allDocuments.isEmpty()) {
                try {
                    parentTask = new Task();
                    parentTask.setTitle(batchName.trim());
                    parentTask.setDocument(firstDocument); // Use first document as placeholder (required field)
                    parentTask.setCategory(category);
                    parentTask.setFormConfig(formConfig);
                    parentTask.setBatchId(batchId);
                    parentTask.setBatchName(batchName.trim());
                    parentTask.setCreatedBy(user);

                    // Save all documents information as JSON array in documentIndex
                    Map<String, Object> batchDocumentIndex = new HashMap<>();
                    batchDocumentIndex.put("documents", allDocuments);
                    batchDocumentIndex.put("totalCount", allDocuments.size());
                    batchDocumentIndex.put("createdAt", LocalDateTime.now());
                    
                    parentTask.setDocumentIndex(objectMapper.writeValueAsString(batchDocumentIndex));

                    parentTask = taskRepository.save(parentTask);
                } catch (Exception e) {
                    e.printStackTrace();
                    String errorMsg = e.getMessage();
                    if (errorMsg == null || errorMsg.isEmpty()) {
                        errorMsg = e.getClass().getSimpleName();
                    }
                    if (e.getCause() != null) {
                        errorMsg += " (" + e.getCause().getMessage() + ")";
                    }
                    errors.add("创建父任务失败: " + errorMsg);
                }
            }

            Map<String, Object> response = new HashMap<>();
            if (parentTask != null) {
                response.put("message", "批量创建任务完成");
                response.put("batchId", batchId);
                response.put("batchName", batchName);
                response.put("successCount", allDocuments.size());
                response.put("skipCount", skipCount);
                response.put("failCount", errors.size());
                response.put("task", convertTaskToMap(parentTask));
                if (!errors.isEmpty()) {
                    response.put("errors", errors);
                }
            } else {
                response.put("message", "批量创建任务失败：没有可用的文档");
                response.put("batchId", batchId);
                response.put("batchName", batchName);
                response.put("successCount", 0);
                response.put("skipCount", skipCount);
                response.put("failCount", errors.size() + allDocuments.size());
                if (!errors.isEmpty()) {
                    response.put("errors", errors);
                }
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "批量创建任务失败: " + e.getMessage()));
        }
    }

    @GetMapping("/batch/{batchId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getTasksByBatchId(@PathVariable String batchId) {
        try {
            List<Task> tasks = taskRepository.findByBatchId(batchId);
            if (tasks.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            // Get the parent task (should be only one now)
            Task parentTask = tasks.get(0);
            String batchName = parentTask.getBatchName();

            // Extract documents from documentIndex
            List<Map<String, Object>> documentList = new ArrayList<>();
            if (parentTask.getDocumentIndex() != null && !parentTask.getDocumentIndex().isEmpty()) {
                try {
                    Map<String, Object> documentIndexMap = objectMapper.readValue(
                        parentTask.getDocumentIndex(), 
                        new TypeReference<Map<String, Object>>() {}
                    );
                    
                    // Check if it's the new format with documents array
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> documents = (List<Map<String, Object>>) documentIndexMap.get("documents");
                    if (documents != null) {
                        // New format: documents array
                        for (Map<String, Object> doc : documents) {
                            Map<String, Object> docMap = new HashMap<>();
                            String folderPath = (String) doc.get("folderPath");
                            String filename = (String) doc.get("originalFilename");
                            if (filename == null) {
                                filename = (String) doc.get("filename");
                            }
                            
                            // Build absolute path
                            String absolutePath;
                            if (folderPath != null && !folderPath.isEmpty()) {
                                absolutePath = folderPath + "/" + filename;
                            } else {
                                absolutePath = "/" + filename;
                            }
                            
                            docMap.put("documentId", doc.get("id"));
                            docMap.put("absolutePath", absolutePath);
                            docMap.put("filename", filename);
                            docMap.put("folderPath", folderPath);
                            docMap.put("fileSize", doc.get("fileSize"));
                            docMap.put("mimeType", doc.get("mimeType"));
                            documentList.add(docMap);
                        }
                    } else {
                        // Old format: single document
                        String folderPath = (String) documentIndexMap.get("folderPath");
                        String filename = (String) documentIndexMap.get("originalFilename");
                        if (filename == null) {
                            filename = (String) documentIndexMap.get("filename");
                        }
                        
                        String absolutePath;
                        if (folderPath != null && !folderPath.isEmpty()) {
                            absolutePath = folderPath + "/" + filename;
                        } else {
                            absolutePath = "/" + filename;
                        }
                        
                        Map<String, Object> docMap = new HashMap<>();
                        docMap.put("documentId", documentIndexMap.get("id"));
                        docMap.put("absolutePath", absolutePath);
                        docMap.put("filename", filename);
                        docMap.put("folderPath", folderPath);
                        docMap.put("fileSize", documentIndexMap.get("fileSize"));
                        docMap.put("mimeType", documentIndexMap.get("mimeType"));
                        documentList.add(docMap);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    // Fallback to document filename
                    Map<String, Object> docMap = new HashMap<>();
                    docMap.put("documentId", parentTask.getDocument().getId());
                    docMap.put("absolutePath", parentTask.getDocument().getOriginalFilename());
                    docMap.put("filename", parentTask.getDocument().getOriginalFilename());
                    documentList.add(docMap);
                }
            } else {
                // Fallback to document filename
                Map<String, Object> docMap = new HashMap<>();
                docMap.put("documentId", parentTask.getDocument().getId());
                docMap.put("absolutePath", parentTask.getDocument().getOriginalFilename());
                docMap.put("filename", parentTask.getDocument().getOriginalFilename());
                documentList.add(docMap);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("batchId", batchId);
            response.put("batchName", batchName);
            response.put("taskId", parentTask.getId());
            response.put("documents", documentList);
            response.put("totalCount", documentList.size());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取批次任务失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteTask(@PathVariable Long id) {
        try {
            Optional<Task> taskOpt = taskRepository.findById(id);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Task task = taskOpt.get();
            
            // Delete related assignments first (cascade delete should handle this, but explicit is safer)
            List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskId(id);
            taskAssignmentRepository.deleteAll(assignments);

            // Delete the task
            taskRepository.delete(task);

            return ResponseEntity.ok(Map.of("message", "任务删除成功"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除任务失败: " + e.getMessage()));
        }
    }

    @PostMapping("/batch/delete")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteBatchTasks(@RequestBody Map<String, Object> request) {
        try {
            Object taskIdsObj = request.get("taskIds");
            if (taskIdsObj == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务ID列表不能为空"));
            }

            // Handle both List<Integer> and List<Long> from frontend
            List<Long> taskIds = new ArrayList<>();
            if (taskIdsObj instanceof List) {
            @SuppressWarnings("unchecked")
                List<Object> ids = (List<Object>) taskIdsObj;
                for (Object id : ids) {
                    if (id instanceof Number) {
                        taskIds.add(((Number) id).longValue());
                    } else {
                        return ResponseEntity.badRequest().body(Map.of("message", "任务ID格式错误"));
                    }
                }
            } else {
                return ResponseEntity.badRequest().body(Map.of("message", "任务ID列表格式错误"));
            }
            
            if (taskIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务ID列表不能为空"));
            }

            int successCount = 0;
            int failCount = 0;
            List<String> errors = new ArrayList<>();

            for (Long taskId : taskIds) {
                try {
                    Optional<Task> taskOpt = taskRepository.findById(taskId);
                    if (taskOpt.isEmpty()) {
                        errors.add("任务 " + taskId + ": 任务不存在");
                        failCount++;
                        continue;
                    }

                    Task task = taskOpt.get();
                    
                    // Delete related assignments first
                    List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskId(taskId);
                    if (assignments != null && !assignments.isEmpty()) {
                    taskAssignmentRepository.deleteAll(assignments);
                    }

                    // Delete the task
                    taskRepository.delete(task);
                    successCount++;
                } catch (Exception e) {
                    e.printStackTrace();
                    String errorMsg = e.getMessage();
                    if (errorMsg == null || errorMsg.isEmpty()) {
                        errorMsg = e.getClass().getSimpleName();
                    }
                    errors.add("任务 " + taskId + ": " + errorMsg);
                    failCount++;
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "批量删除任务完成");
            response.put("successCount", successCount);
            response.put("failCount", failCount);
            if (!errors.isEmpty()) {
                response.put("errors", errors);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            String errorMsg = e.getMessage();
            if (errorMsg == null || errorMsg.isEmpty()) {
                errorMsg = e.getClass().getSimpleName();
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "批量删除任务失败: " + errorMsg));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTask(@PathVariable Long id) {
        try {
            Optional<Task> taskOpt = taskRepository.findById(id);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Task task = taskOpt.get();
            Map<String, Object> taskMap = convertTaskToMap(task);

            // Add assignments
            List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskId(id);
            taskMap.put("assignments", assignments.stream().map(this::convertAssignmentToMap));

            return ResponseEntity.ok(Map.of("task", taskMap));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取任务详情失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateTask(@PathVariable Long id,
                                       @RequestBody Map<String, Object> request) {
        try {
            Optional<Task> taskOpt = taskRepository.findById(id);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Task task = taskOpt.get();

            String title = (String) request.get("title");
            String description = (String) request.get("description");
            String status = (String) request.get("status");
            String priority = (String) request.get("priority");
            Object formConfigIdObj = request.get("formConfigId");
            Object documentTypeIdObj = request.get("documentTypeId");

            if (title != null && !title.trim().isEmpty()) {
                task.setTitle(title.trim());
            }

            if (description != null) {
                task.setDescription(description.trim());
            }

            if (status != null && !status.isEmpty()) {
                try {
                    task.setStatus(Task.TaskStatus.valueOf(status.toUpperCase()));
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "无效的任务状态"));
                }
            }

            if (priority != null && !priority.isEmpty()) {
                try {
                    task.setPriority(Task.Priority.valueOf(priority.toUpperCase()));
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "无效的任务优先级"));
                }
            }

            // Update form config
            if (formConfigIdObj != null) {
                Long formConfigId = null;
                if (formConfigIdObj instanceof Number) {
                    formConfigId = ((Number) formConfigIdObj).longValue();
                } else if (formConfigIdObj instanceof String && !((String) formConfigIdObj).trim().isEmpty()) {
                    formConfigId = Long.parseLong((String) formConfigIdObj);
                }
                
                if (formConfigId != null && formConfigId > 0) {
                    Optional<FormConfig> formConfigOpt = formConfigRepository.findById(formConfigId);
                    if (formConfigOpt.isEmpty()) {
                        return ResponseEntity.badRequest().body(Map.of("message", "表单配置不存在"));
                    }
                    task.setFormConfig(formConfigOpt.get());
                } else if (formConfigId != null && formConfigId == 0) {
                    // Allow setting to null
                    task.setFormConfig(null);
                }
            }

            // Update document type
            if (documentTypeIdObj != null && task.getDocument() != null) {
                Long documentTypeId = null;
                if (documentTypeIdObj instanceof Number) {
                    documentTypeId = ((Number) documentTypeIdObj).longValue();
                } else if (documentTypeIdObj instanceof String && !((String) documentTypeIdObj).trim().isEmpty()) {
                    documentTypeId = Long.parseLong((String) documentTypeIdObj);
                }
                
                if (documentTypeId != null && documentTypeId > 0) {
                    Optional<DocumentType> documentTypeOpt = documentTypeRepository.findById(documentTypeId);
                    if (documentTypeOpt.isEmpty()) {
                        return ResponseEntity.badRequest().body(Map.of("message", "文档类型不存在"));
                    }
                    task.getDocument().setDocumentType(documentTypeOpt.get());
                    documentRepository.save(task.getDocument());
                } else if (documentTypeId != null && documentTypeId == 0) {
                    // Allow setting to null
                    task.getDocument().setDocumentType(null);
                    documentRepository.save(task.getDocument());
                }
            }

            Task savedTask = taskRepository.save(task);

            return ResponseEntity.ok(Map.of(
                "message", "任务更新成功",
                "task", convertTaskToMap(savedTask)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新任务失败: " + e.getMessage()));
        }
    }

    @PostMapping("/{taskId}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> assignTask(@PathVariable Long taskId,
                                       @RequestBody Map<String, Object> request) {
        try {
            // Handle multiple user IDs
            List<Long> userIds = new ArrayList<>();
            if (request.containsKey("userIds")) {
                Object userIdsObj = request.get("userIds");
                if (userIdsObj instanceof List) {
                    List<?> list = (List<?>) userIdsObj;
                    for (Object item : list) {
                        if (item != null) {
                            userIds.add(Long.valueOf(item.toString()));
                        }
                    }
                }
            } else if (request.containsKey("userId")) {
                Object userIdObj = request.get("userId");
                if (userIdObj != null) {
                    userIds.add(Long.valueOf(userIdObj.toString()));
                }
            }

            if (userIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "未选择用户"));
            }

            String assignmentType = (String) request.get("assignmentType");

            if (assignmentType == null || assignmentType.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "分配类型不能为空"));
            }

            TaskAssignment.AssignmentType type;
            try {
                type = TaskAssignment.AssignmentType.valueOf(assignmentType.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("message", "无效的分配类型"));
            }

            // Validate task exists
            Optional<Task> taskOpt = taskRepository.findById(taskId);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Task task = taskOpt.get();

            List<TaskAssignment> createdAssignments = new ArrayList<>();
            List<String> errors = new ArrayList<>();

            for (Long userId : userIds) {
                try {
                    // Validate user exists
                    Optional<User> userOpt = userRepository.findById(userId);
                    if (userOpt.isEmpty()) {
                        errors.add("用户ID " + userId + " 不存在");
                        continue;
                    }
                    User user = userOpt.get();

                    // Check if assignment already exists
                    Optional<TaskAssignment> existing = taskAssignmentRepository.findByTaskIdAndUserIdAndAssignmentType(
                        taskId, userId, type);
                    if (existing.isPresent()) {
                        errors.add("用户 " + user.getUsername() + " 已被分配此类型任务");
                        continue;
                    }

                    // Create assignment
                    TaskAssignment assignment = new TaskAssignment();
                    assignment.setTask(task);
                    assignment.setUser(user);
                    assignment.setAssignmentType(type);

                    TaskAssignment savedAssignment = taskAssignmentRepository.save(assignment);
                    createdAssignments.add(savedAssignment);
                } catch (Exception e) {
                    errors.add("分配给用户ID " + userId + " 失败: " + e.getMessage());
                }
            }

            // Update task status if this is the first assignment and status was CREATED
            if (!createdAssignments.isEmpty() && task.getStatus() == Task.TaskStatus.CREATED) {
                // For AI annotation, move to AI_PROCESSING
                if (type == TaskAssignment.AssignmentType.AI_ANNOTATION) {
                    task.setStatus(Task.TaskStatus.AI_PROCESSING);
                } else {
                    task.setStatus(Task.TaskStatus.ASSIGNED);
                }
                taskRepository.save(task);
            } else if (!createdAssignments.isEmpty()) {
                // Trigger workflow update to ensure correct status
                workflowService.advanceTaskWorkflow(task);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "任务分配完成");
            response.put("successCount", createdAssignments.size());
            response.put("assignments", createdAssignments.stream().map(this::convertAssignmentToMap).collect(Collectors.toList()));
            
            if (!errors.isEmpty()) {
                response.put("errors", errors);
                if (createdAssignments.isEmpty()) {
                    return ResponseEntity.badRequest().body(response);
                }
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "任务分配失败: " + e.getMessage()));
        }
    }

    @PostMapping("/{taskId}/auto-assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> autoAssignTask(@PathVariable Long taskId) {
        try {
            // Validate task exists
            Optional<Task> taskOpt = taskRepository.findById(taskId);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Task task = taskOpt.get();

            // Check if task is already assigned
            List<TaskAssignment> existingAssignments = taskAssignmentRepository.findByTaskId(taskId);
            if (!existingAssignments.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务已被手动分配，无法使用自动分配"));
            }

            // Auto assign to 2 annotators
            List<TaskAssignment> assignments = taskAssignmentService.autoAssignAnnotationTasks(task);

            return ResponseEntity.ok(Map.of(
                "message", "自动分配成功",
                "assignments", assignments.stream().map(this::convertAssignmentToMap).collect(Collectors.toList()),
                "task", convertTaskToMap(task)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "自动分配失败: " + e.getMessage()));
        }
    }

    @GetMapping("/my-tasks")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getMyTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "assignedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            Authentication authentication) {

        try {
            // Get current user
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            Sort.Direction direction = Sort.Direction.fromString(sortDir);
            
            // For admin users, show all tasks with their assignments
            // For other users, only show their own assignments
            List<Map<String, Object>> assignmentMaps = new ArrayList<>();
            
            if (user.getRole() == User.Role.ADMIN) {
                // Admin can see all tasks
                // Map sortBy field from assignment field to task field
                String taskSortBy = sortBy;
                if ("assignedAt".equals(sortBy)) {
                    taskSortBy = "createdAt"; // Use createdAt as fallback for tasks
                }
                
                // Validate sort field exists in Task entity
                // Use default sort if field doesn't exist
                Pageable pageable;
                try {
                    pageable = PageRequest.of(page, size, Sort.by(direction, taskSortBy));
                } catch (Exception e) {
                    // If sort field is invalid, use default sort by createdAt
                    pageable = PageRequest.of(page, size, Sort.by(direction, "createdAt"));
                }
                
                Page<Task> taskPage = taskRepository.findAll(pageable);
                
                for (Task task : taskPage.getContent()) {
                    // Get all assignments for this task
                    List<TaskAssignment> taskAssignments = taskAssignmentRepository.findByTaskId(task.getId());
                    
                    // Find assignment for current user, or use the first one if none
                    Optional<TaskAssignment> userAssignment = taskAssignments.stream()
                        .filter(a -> a.getUser().getId().equals(user.getId()))
                        .findFirst();
                    
                    TaskAssignment assignment = userAssignment.orElse(
                        taskAssignments.isEmpty() ? null : taskAssignments.get(0)
                    );
                    
                    Map<String, Object> itemMap = new HashMap<>();
                    
                    // Only include assignment if it exists
                    if (assignment != null) {
                        itemMap.put("assignment", convertAssignmentToMap(assignment));
                    } else {
                        // Set assignment to null for tasks without assignments
                        itemMap.put("assignment", null);
                    }
                    
                    itemMap.put("task", convertTaskToMap(task));
                    
                    // Get the latest annotation for this assignment (if exists)
                    if (assignment != null) {
                        List<Annotation> annotations = annotationRepository.findByTaskAssignmentId(assignment.getId());
                        if (!annotations.isEmpty()) {
                            Annotation latestAnnotation = annotations.stream()
                                .max((a1, a2) -> {
                                    int versionCompare = Integer.compare(
                                        a1.getVersion() != null ? a1.getVersion() : 0,
                                        a2.getVersion() != null ? a2.getVersion() : 0
                                    );
                                    if (versionCompare != 0) return versionCompare;
                                    
                                    if (a1.getSubmittedAt() != null && a2.getSubmittedAt() != null) {
                                        return a1.getSubmittedAt().compareTo(a2.getSubmittedAt());
                                    }
                                    if (a1.getSubmittedAt() != null) return 1;
                                    if (a2.getSubmittedAt() != null) return -1;
                                    return 0;
                                })
                                .orElse(annotations.get(0));
                            
                            itemMap.put("annotation", convertAnnotationToMap(latestAnnotation));
                        }
                    }
                    
                    assignmentMaps.add(itemMap);
                }
                
                Map<String, Object> response = new HashMap<>();
                response.put("assignments", assignmentMaps);
                response.put("currentPage", taskPage.getNumber());
                response.put("totalItems", taskPage.getTotalElements());
                response.put("totalPages", taskPage.getTotalPages());
                
                return ResponseEntity.ok(response);
            } else {
                // Non-admin users: only show their own assignments
                Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
                Page<TaskAssignment> assignmentPage = taskAssignmentRepository.findByUserId(user.getId(), pageable);

                Map<String, Object> response = new HashMap<>();
                response.put("assignments", assignmentPage.getContent().stream().map(assignment -> {
                    Map<String, Object> assignmentMap = convertAssignmentToMap(assignment);
                    assignmentMap.put("task", convertTaskToMap(assignment.getTask()));
                    
                    // Get the latest annotation for this assignment
                    List<Annotation> annotations = annotationRepository.findByTaskAssignmentId(assignment.getId());
                    if (!annotations.isEmpty()) {
                        Annotation latestAnnotation = annotations.stream()
                            .max((a1, a2) -> {
                                int versionCompare = Integer.compare(
                                    a1.getVersion() != null ? a1.getVersion() : 0,
                                    a2.getVersion() != null ? a2.getVersion() : 0
                                );
                                if (versionCompare != 0) return versionCompare;
                                
                                if (a1.getSubmittedAt() != null && a2.getSubmittedAt() != null) {
                                    return a1.getSubmittedAt().compareTo(a2.getSubmittedAt());
                                }
                                if (a1.getSubmittedAt() != null) return 1;
                                if (a2.getSubmittedAt() != null) return -1;
                                return 0;
                            })
                            .orElse(annotations.get(0));
                        
                        assignmentMap.put("annotation", convertAnnotationToMap(latestAnnotation));
                    }
                    
                    return assignmentMap;
                }));
                response.put("currentPage", assignmentPage.getNumber());
                response.put("totalItems", assignmentPage.getTotalElements());
                response.put("totalPages", assignmentPage.getTotalPages());

                return ResponseEntity.ok(response);
            }

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取我的任务失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/workflow-status")
    public ResponseEntity<?> getWorkflowStatus(@PathVariable Long id) {
        try {
            Optional<Task> taskOpt = taskRepository.findById(id);
            if (taskOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Task task = taskOpt.get();
            WorkflowService.WorkflowStatus status = workflowService.getWorkflowStatus(task);

            return ResponseEntity.ok(Map.of("workflowStatus", convertWorkflowStatusToMap(status)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取工作流状态失败: " + e.getMessage()));
        }
    }

    @GetMapping("/user-performance")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getUserPerformanceStatistics() {
        try {
            List<User> users = userRepository.findAll();
            List<Map<String, Object>> userStats = users.stream().map(user -> {
                Map<String, Object> stat = new HashMap<>();
                stat.put("userId", user.getId());
                stat.put("username", user.getUsername());
                stat.put("role", user.getRole());

                // Count user's task assignments
                List<TaskAssignment> assignments = taskAssignmentRepository.findByUserId(user.getId());
                stat.put("totalAssignments", assignments.size());
                stat.put("completedAssignments", assignments.stream()
                    .filter(a -> a.getStatus() == TaskAssignment.AssignmentStatus.COMPLETED).count());

                // Calculate completion rate
                double completionRate = assignments.isEmpty() ? 0 :
                    (double) assignments.stream().filter(a -> a.getStatus() == TaskAssignment.AssignmentStatus.COMPLETED).count() / assignments.size() * 100;
                stat.put("completionRate", Math.round(completionRate * 100.0) / 100.0);

                return stat;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("userPerformance", userStats));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取用户绩效统计失败: " + e.getMessage()));
        }
    }

    @GetMapping("/statistics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getTaskStatistics() {
        try {
            Map<String, Object> stats = new HashMap<>();

            // Count tasks by status
            for (Task.TaskStatus status : Task.TaskStatus.values()) {
                try {
                    Long count = taskRepository.countByStatus(status);
                    stats.put("total" + status.name(), count != null ? count : 0L);
                } catch (Exception e) {
                    stats.put("total" + status.name(), 0L);
                }
            }

            // Count assignments by status
            for (TaskAssignment.AssignmentStatus status : TaskAssignment.AssignmentStatus.values()) {
                try {
                    List<TaskAssignment> assignments = taskAssignmentRepository.findByStatus(status);
                    stats.put("assignment" + status.name(), assignments != null ? assignments.size() : 0);
                } catch (Exception e) {
                    stats.put("assignment" + status.name(), 0);
                }
            }

            // User statistics
            try {
                List<User> allUsers = userRepository.findAll();
                stats.put("totalUsers", allUsers != null ? allUsers.size() : 0);
                stats.put("activeUsers", allUsers != null ? allUsers.stream()
                    .filter(u -> u.getStatus() != null && u.getStatus() == User.Status.ACTIVE).count() : 0);
                stats.put("annotators", allUsers != null ? allUsers.stream()
                    .filter(u -> u.getRole() != null && u.getRole() == User.Role.ANNOTATOR).count() : 0);
                stats.put("reviewers", allUsers != null ? allUsers.stream()
                    .filter(u -> u.getRole() != null && u.getRole() == User.Role.REVIEWER).count() : 0);
                stats.put("experts", allUsers != null ? allUsers.stream()
                    .filter(u -> u.getRole() != null && u.getRole() == User.Role.EXPERT).count() : 0);
            } catch (Exception e) {
                stats.put("totalUsers", 0);
                stats.put("activeUsers", 0);
                stats.put("annotators", 0);
                stats.put("reviewers", 0);
                stats.put("experts", 0);
            }

            // Document statistics
            try {
                List<Document> allDocuments = documentRepository.findAll();
                stats.put("totalDocuments", allDocuments != null ? allDocuments.size() : 0);
                stats.put("processedDocuments", allDocuments != null ? allDocuments.stream()
                    .filter(d -> d.getStatus() != null && d.getStatus() == Document.DocumentStatus.PROCESSED).count() : 0);
            } catch (Exception e) {
                stats.put("totalDocuments", 0);
                stats.put("processedDocuments", 0);
            }

            // Quality check statistics
            for (QualityCheck.QualityCheckStatus status : QualityCheck.QualityCheckStatus.values()) {
                try {
                    Long count = qualityCheckRepository.countByStatus(status);
                    stats.put("qualityCheck" + status.name(), count != null ? count : 0L);
                } catch (Exception e) {
                    stats.put("qualityCheck" + status.name(), 0L);
                }
            }

            for (QualityCheck.ComparisonResult result : QualityCheck.ComparisonResult.values()) {
                try {
                    Long count = qualityCheckRepository.countByComparisonResult(result);
                    stats.put("comparison" + result.name(), count != null ? count : 0L);
                } catch (Exception e) {
                    stats.put("comparison" + result.name(), 0L);
                }
            }

            return ResponseEntity.ok(Map.of("statistics", stats));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取任务统计失败: " + e.getMessage()));
        }
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
        map.put("updatedAt", task.getUpdatedAt());

        map.put("document", Map.of(
            "id", task.getDocument().getId(),
            "filename", task.getDocument().getOriginalFilename()
        ));

        // Category is optional, handle null case
        if (task.getCategory() != null) {
            map.put("category", Map.of(
                "id", task.getCategory().getId(),
                "name", task.getCategory().getName()
            ));
        } else {
            map.put("category", null);
        }

        // FormConfig is optional, handle null case
        if (task.getFormConfig() != null) {
            map.put("formConfig", Map.of(
                "id", task.getFormConfig().getId(),
                "name", task.getFormConfig().getName()
            ));
        } else {
            map.put("formConfig", null);
        }

        // Batch information
        map.put("batchId", task.getBatchId());
        map.put("batchName", task.getBatchName());
        map.put("submittedAt", task.getSubmittedAt());

        // Document index information (preserved even if document is deleted)
        if (task.getDocumentIndex() != null && !task.getDocumentIndex().isEmpty()) {
            try {
                Map<String, Object> documentIndexMap = objectMapper.readValue(
                    task.getDocumentIndex(), 
                    new TypeReference<Map<String, Object>>() {}
                );
                map.put("documentIndex", documentIndexMap);
            } catch (Exception e) {
                // If parsing fails, just include the raw string
                map.put("documentIndex", task.getDocumentIndex());
            }
        }

        map.put("createdBy", Map.of(
            "id", task.getCreatedBy().getId(),
            "username", task.getCreatedBy().getUsername()
        ));

        // Add assignments information
        List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskId(task.getId());
        map.put("assignments", assignments.stream()
            .map(this::convertAssignmentToMap)
            .collect(Collectors.toList()));

        return map;
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
        map.put("reviewNotes", annotation.getReviewNotes());
        map.put("confidenceScore", annotation.getConfidenceScore());
        map.put("createdAt", annotation.getCreatedAt());
        map.put("updatedAt", annotation.getUpdatedAt());

        if (annotation.getReviewer() != null) {
            map.put("reviewer", Map.of(
                "id", annotation.getReviewer().getId(),
                "username", annotation.getReviewer().getUsername()
            ));
        }

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

    private Map<String, Object> convertWorkflowStatusToMap(WorkflowService.WorkflowStatus status) {
        Map<String, Object> map = new HashMap<>();
        map.put("taskId", status.getTaskId());
        map.put("currentStatus", status.getCurrentStatus());
        
        // Map new fields
        map.put("aiAssignments", status.getAiAssignments());
        map.put("aiCompleted", status.getAiCompleted());
        map.put("annotationAssignments", status.getAnnotationAssignments());
        map.put("annotationCompleted", status.getAnnotationCompleted());
        map.put("inspectionAssignments", status.getInspectionAssignments());
        map.put("inspectionCompleted", status.getInspectionCompleted());
        map.put("expertAssignments", status.getExpertAssignments());
        map.put("expertCompleted", status.getExpertCompleted());
        
        map.put("progressPercentage", status.getProgressPercentage());
        return map;
    }

    /**
     * 批量创建审核任务（从质量审核页面）
     */
    @PostMapping("/review/batch")
    @PreAuthorize("hasRole('ADMIN') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> createReviewTasks(@RequestBody Map<String, Object> request,
                                               Authentication authentication) {
        try {
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            @SuppressWarnings("unchecked")
            List<Long> documentIds = (List<Long>) request.get("documentIds");
            String taskTitle = (String) request.get("taskTitle");
            String description = (String) request.get("description");
            Long formConfigId = request.get("formConfigId") != null ? 
                Long.valueOf(request.get("formConfigId").toString()) : null;

            if (documentIds == null || documentIds.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "请至少选择一个文档"));
            }

            if (taskTitle == null || taskTitle.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "任务标题不能为空"));
            }

            List<Task> createdTasks = new ArrayList<>();
            List<String> errors = new ArrayList<>();

            for (Long documentId : documentIds) {
                try {
                    Optional<Document> documentOpt = documentRepository.findById(documentId);
                    if (documentOpt.isEmpty()) {
                        errors.add("文档 " + documentId + " 不存在");
                        continue;
                    }
                    Document document = documentOpt.get();

                    // 检查是否已存在进行中的审核任务
                    List<Task> existingTasks = taskRepository.findAll().stream()
                        .filter(task -> task.getDocument() != null && task.getDocument().getId().equals(documentId))
                        .collect(Collectors.toList());
                    boolean hasReviewTask = existingTasks.stream()
                        .anyMatch(task -> {
                            List<TaskAssignment> assignments = taskAssignmentRepository.findByTaskId(task.getId());
                            return assignments.stream()
                                .anyMatch(assignment -> assignment.getAssignmentType() == TaskAssignment.AssignmentType.REVIEW ||
                                                       assignment.getAssignmentType() == TaskAssignment.AssignmentType.EXPERT_REVIEW);
                        });

                    if (hasReviewTask) {
                        errors.add("文档 " + document.getOriginalFilename() + " 已存在审核任务");
                        continue;
                    }

                    // 获取文档的表单配置（如果未指定，使用文档的默认配置）
                    FormConfig formConfig = null;
                    if (formConfigId != null) {
                        Optional<FormConfig> formConfigOpt = formConfigRepository.findById(formConfigId);
                        if (formConfigOpt.isPresent()) {
                            formConfig = formConfigOpt.get();
                        }
                    }
                    // 如果未指定表单配置，尝试从文档类型获取
                    // 注意：这里简化处理，实际可能需要通过中间表查询
                    if (formConfig == null && document.getDocumentType() != null) {
                        // 可以尝试查找该文档类型关联的表单配置
                        // 由于FormConfig和DocumentType是多对多关系，需要通过中间表查询
                        // 这里暂时跳过，使用null（任务创建时可以后续指定）
                    }

                    // 创建审核任务
                    Task task = new Task();
                    task.setTitle(taskTitle.trim() + " - " + document.getOriginalFilename());
                    task.setDescription(description != null ? description.trim() : null);
                    task.setDocument(document);
                    task.setCategory(document.getCategory());
                    task.setFormConfig(formConfig);
                    task.setCreatedBy(user);
                    task.setStatus(Task.TaskStatus.CREATED);

                    // 保存文档索引信息
                    Map<String, Object> documentIndex = new HashMap<>();
                    documentIndex.put("id", document.getId());
                    documentIndex.put("filename", document.getFilename());
                    documentIndex.put("originalFilename", document.getOriginalFilename());
                    documentIndex.put("filePath", document.getFilePath());

                    ObjectMapper objectMapper = new ObjectMapper();
                    objectMapper.registerModule(new JavaTimeModule());
                    objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
                    task.setDocumentIndex(objectMapper.writeValueAsString(documentIndex));

                    task = taskRepository.save(task);
                    createdTasks.add(task);

                } catch (Exception e) {
                    logger.error("Failed to create review task for document {}: {}", documentId, e.getMessage(), e);
                    errors.add("文档 " + documentId + " 创建任务失败: " + e.getMessage());
                }
            }

            Map<String, Object> response = new HashMap<>();
            response.put("message", "成功创建 " + createdTasks.size() + " 个审核任务");
            response.put("createdCount", createdTasks.size());
            response.put("errors", errors);
            response.put("tasks", createdTasks.stream()
                .map(this::convertTaskToMap)
                .collect(Collectors.toList()));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to create review tasks: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "创建审核任务失败: " + e.getMessage()));
        }
    }
}
