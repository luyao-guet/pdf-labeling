package com.annotationplatform.controller;

import com.annotationplatform.entity.Document;
import com.annotationplatform.entity.User;
import com.annotationplatform.entity.Category;
import com.annotationplatform.entity.Folder;
import com.annotationplatform.entity.DocumentType;
import com.annotationplatform.repository.DocumentRepository;
import com.annotationplatform.repository.FolderRepository;
import com.annotationplatform.repository.UserRepository;
import com.annotationplatform.repository.CategoryRepository;
import com.annotationplatform.repository.DocumentTypeRepository;
import com.annotationplatform.service.FolderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/documents")
@CrossOrigin(origins = "*", maxAge = 3600)
public class DocumentController {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private DocumentTypeRepository documentTypeRepository;

    @Autowired
    private FolderRepository folderRepository;

    @Autowired
    private FolderService folderService;

    private static final String UPLOAD_DIR = "./uploads/documents/";
    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    @PostMapping("/upload")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    @Transactional
    public ResponseEntity<?> uploadDocument(@RequestParam("file") MultipartFile file,
                                           @RequestParam(value = "categoryId", required = false) Long categoryId,
                                           @RequestParam(value = "folderPath", required = false) String folderPath,
                                           @RequestParam(value = "folderId", required = false) Long folderId,
                                           Authentication authentication) {
        Path filePath = null;
        try {
            // Log upload request for debugging
            System.out.println("UPLOAD REQUEST: file=" + file.getOriginalFilename() +
                             ", size=" + file.getSize() +
                             ", contentType=" + file.getContentType() +
                             ", categoryId=" + categoryId);

            // Validate file
            if (file.isEmpty()) {
                System.out.println("UPLOAD ERROR: File is empty");
                return ResponseEntity.badRequest().body(Map.of("message", "文件不能为空"));
            }

            if (file.getSize() > MAX_FILE_SIZE) {
                System.out.println("UPLOAD ERROR: File too large, size=" + file.getSize());
                return ResponseEntity.badRequest().body(Map.of("message", "文件大小不能超过50MB"));
            }

            // Check file type (PDF, JPG, PNG)
            String contentType = file.getContentType();
            if (!"application/pdf".equals(contentType) &&
                !"image/jpeg".equals(contentType) &&
                !"image/jpg".equals(contentType) &&
                !"image/png".equals(contentType)) {
                System.out.println("UPLOAD ERROR: Unsupported file type: " + contentType);
                return ResponseEntity.badRequest().body(Map.of("message", "只支持PDF、JPG、PNG文件上传"));
            }

            // Get current user
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            // Get category if provided
            Category category = null;
            if (categoryId != null) {
                System.out.println("UPLOAD: Looking for category with ID: " + categoryId);
                Optional<Category> categoryOpt = categoryRepository.findById(categoryId);
                if (categoryOpt.isEmpty()) {
                    System.out.println("UPLOAD ERROR: Category not found with ID: " + categoryId);
                    return ResponseEntity.badRequest().body(Map.of("message", "选择的分类不存在"));
                }
                category = categoryOpt.get();
                System.out.println("UPLOAD: Found category: " + category.getName());
            }

            // Get folder if provided
            Folder folder = null;
            if (folderId != null) {
                Optional<Folder> folderOpt = folderRepository.findById(folderId);
                if (folderOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "选择的文件夹不存在"));
                }
                folder = folderOpt.get();
            }

            // Create upload directory if not exists
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Generate filename and checksum
            String originalFilename = file.getOriginalFilename();
            String fileExtension = getFileExtension(originalFilename);
            
            // Calculate checksum from input stream to avoid loading entire file into memory
            String checksum;
            try (InputStream inputStream = file.getInputStream()) {
                checksum = calculateChecksumFromStream(inputStream);
            } catch (IOException e) {
                System.out.println("UPLOAD ERROR: Failed to read file for checksum calculation: " + e.getMessage());
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("message", "文件读取失败，请稍后重试"));
            }
            
            String filename = checksum + "." + fileExtension;

            // Check if file already exists
            List<Document> existingDocs = documentRepository.findByChecksum(checksum);
            if (!existingDocs.isEmpty()) {
                // Find documents where physical file still exists
                for (Document existingDoc : existingDocs) {
                    Path existingFilePath = Paths.get(existingDoc.getFilePath());
                    if (Files.exists(existingFilePath)) {
                        // File already exists, return existing document info
                        Map<String, Object> response = new HashMap<>();
                        response.put("message", "文件已存在");
                        response.put("document", convertToMap(existingDoc));
                        response.put("documentId", existingDoc.getId());
                        return ResponseEntity.ok(response);
                    }
                }
                // All existing records have no physical file, remove orphaned records
                documentRepository.deleteAll(existingDocs);
                // Continue with upload
            }

            // Save file to disk first
            filePath = uploadPath.resolve(filename);
            System.out.println("UPLOAD: Saving file to: " + filePath.toString());
            try (InputStream fileInputStream = file.getInputStream()) {
                Files.copy(fileInputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
            }
            System.out.println("UPLOAD: File saved successfully");

            // Create document record
            Document document = new Document();
            document.setFilename(filename);
            document.setOriginalFilename(originalFilename);
            // Use absolute path for persistence
            document.setFilePath(filePath.toAbsolutePath().toString());
            document.setFileSize(file.getSize());
            document.setMimeType(contentType);
            document.setChecksum(checksum);
            document.setFolder(folder);
            document.setFolderPath(folder != null ? folder.getPath() : folderPath);
            document.setStatus(Document.DocumentStatus.UPLOADED);
            document.setCategory(category);
            document.setUploadedBy(user);

            // Validate all required fields before saving
            System.out.println("UPLOAD: Validating document fields...");
            System.out.println("UPLOAD: filename=" + filename);
            System.out.println("UPLOAD: originalFilename=" + originalFilename);
            System.out.println("UPLOAD: filePath=" + filePath.toAbsolutePath().toString());
            System.out.println("UPLOAD: fileSize=" + file.getSize());
            System.out.println("UPLOAD: contentType=" + contentType);
            System.out.println("UPLOAD: checksum=" + checksum);
            System.out.println("UPLOAD: category=" + (category != null ? category.getId() : "null"));
            System.out.println("UPLOAD: user=" + (user != null ? user.getId() : "null"));

            // Save to database - this is transactional, will rollback if fails
            Document savedDocument = documentRepository.save(document);
            // Flush to ensure data is persisted immediately
            documentRepository.flush();
            System.out.println("UPLOAD: Document saved successfully with ID: " + savedDocument.getId());

            Map<String, Object> response = new HashMap<>();
            response.put("message", "文件上传成功");
            response.put("document", convertToMap(savedDocument));

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            System.out.println("UPLOAD ERROR: IOException - " + e.getMessage());
            e.printStackTrace();
            // Clean up file if database save failed
            if (filePath != null && Files.exists(filePath)) {
                try {
                    Files.delete(filePath);
                    System.out.println("UPLOAD: Cleaned up file due to error: " + filePath);
                } catch (IOException cleanupError) {
                    System.out.println("UPLOAD ERROR: Failed to cleanup file: " + cleanupError.getMessage());
                }
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "文件上传失败: 文件保存过程中出现I/O错误，请稍后重试"));
        } catch (Exception e) {
            System.out.println("UPLOAD ERROR: Unexpected exception - " + e.getMessage());
            e.printStackTrace();
            // Clean up file if database save failed
            if (filePath != null && Files.exists(filePath)) {
                try {
                    Files.delete(filePath);
                    System.out.println("UPLOAD: Cleaned up file due to error: " + filePath);
                } catch (IOException cleanupError) {
                    System.out.println("UPLOAD ERROR: Failed to cleanup file: " + cleanupError.getMessage());
                }
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "文件上传失败: 服务器内部错误，请联系管理员"));
        }
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getDocuments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String filename,
            @RequestParam(required = false) Long folderId,
            @RequestParam(defaultValue = "false") boolean root) {

        try {
            Sort.Direction direction = Sort.Direction.fromString(sortDir);
            Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

            Document.DocumentStatus docStatus = null;
            if (status != null && !status.isEmpty()) {
                try {
                    docStatus = Document.DocumentStatus.valueOf(status.toUpperCase());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "无效的状态值"));
                }
            }

            // Use filtered query to support category filtering
            // When categoryId is null, show all documents (root directory)
            // When categoryId is provided, show documents in that specific category
            Page<Document> documentPage;
            if (folderId != null) {
                documentPage = documentRepository.findByFolder_Id(folderId, pageable);
            } else if (root) {
                documentPage = documentRepository.findByFolderIsNull(pageable);
            } else if (categoryId != null) {
                documentPage = documentRepository.findByCategoryId(categoryId, pageable);
            } else {
                // Find all documents for root directory
                documentPage = documentRepository.findAll(pageable);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("documents", documentPage.getContent()
                    .stream()
                    .map(this::convertToMap)
                    .collect(Collectors.toList()));
            response.put("currentPage", documentPage.getNumber());
            response.put("totalItems", documentPage.getTotalElements());
            response.put("totalPages", documentPage.getTotalPages());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取文档列表失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getDocument(@PathVariable Long id) {
        try {
            Optional<Document> documentOpt = documentRepository.findById(id);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Document document = documentOpt.get();
            return ResponseEntity.ok(convertToMap(document));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取文档详情失败: " + e.getMessage()));
        }
    }

    @PostMapping("/create-folder")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createFolder(@RequestParam Long categoryId,
                                         @RequestParam String folderName) {
        try {
            // Validate category exists
            Optional<Category> categoryOpt = categoryRepository.findById(categoryId);
            if (categoryOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "选择的分类不存在"));
            }

            // Check if folder name is valid
            if (folderName == null || folderName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "文件夹名称不能为空"));
            }

            // Check if folder already exists (by checking if any documents have this folder path)
            List<Document> existingDocs = documentRepository.findByCategoryIdAndFolderPath(categoryId, folderName.trim());
            if (!existingDocs.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "文件夹已存在"));
            }

            return ResponseEntity.ok(Map.of(
                "message", "文件夹创建成功",
                "folderName", folderName.trim(),
                "categoryId", categoryId
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "创建文件夹失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/category")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> updateDocumentCategory(@PathVariable Long id,
                                                   @RequestBody Map<String, Object> request,
                                                   Authentication authentication) {
        try {
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }

            Optional<Document> documentOpt = documentRepository.findById(id);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Document document = documentOpt.get();

            // Check if user can modify this document (owner or admin)
            boolean isAdmin = userOpt.get().getRole().name().equals("ADMIN");
            boolean isOwner = document.getUploadedBy().getId().equals(userOpt.get().getId());
            if (!isAdmin && !isOwner) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "无权限修改此文档"));
            }

            Long categoryId = request.get("categoryId") != null ? Long.valueOf(request.get("categoryId").toString()) : null;

            Category category = null;
            if (categoryId != null) {
                Optional<Category> categoryOpt = categoryRepository.findById(categoryId);
                if (categoryOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "选择的分类不存在"));
                }
                category = categoryOpt.get();
            }

            document.setCategory(category);
            Document savedDocument = documentRepository.save(document);

            return ResponseEntity.ok(Map.of(
                "message", "文档分类更新成功",
                "document", convertToMap(savedDocument)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新文档分类失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/document-type")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> updateDocumentType(@PathVariable Long id,
                                               @RequestBody Map<String, Object> request,
                                               Authentication authentication) {
        try {
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }

            Optional<Document> documentOpt = documentRepository.findById(id);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Document document = documentOpt.get();

            // Check if user can modify this document (owner or admin)
            boolean isAdmin = userOpt.get().getRole().name().equals("ADMIN");
            boolean isOwner = document.getUploadedBy().getId().equals(userOpt.get().getId());
            if (!isAdmin && !isOwner) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "无权限修改此文档"));
            }

            Long documentTypeId = request.get("documentTypeId") != null ? Long.valueOf(request.get("documentTypeId").toString()) : null;

            DocumentType documentType = null;
            if (documentTypeId != null) {
                Optional<DocumentType> documentTypeOpt = documentTypeRepository.findById(documentTypeId);
                if (documentTypeOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "选择的文档类型不存在"));
                }
                documentType = documentTypeOpt.get();
            }

            document.setDocumentType(documentType);
            Document savedDocument = documentRepository.save(document);

            return ResponseEntity.ok(Map.of(
                "message", "文档类型更新成功",
                "document", convertToMap(savedDocument)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新文档类型失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/priority")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> updateDocumentPriority(@PathVariable Long id,
                                                   @RequestBody Map<String, Object> request,
                                                   Authentication authentication) {
        try {
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }

            Optional<Document> documentOpt = documentRepository.findById(id);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Document document = documentOpt.get();

            // Check if user can modify this document (owner or admin)
            boolean isAdmin = userOpt.get().getRole().name().equals("ADMIN");
            boolean isOwner = document.getUploadedBy().getId().equals(userOpt.get().getId());
            if (!isAdmin && !isOwner) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "无权限修改此文档"));
            }

            String priorityStr = request.get("priority") != null ? request.get("priority").toString() : null;
            if (priorityStr == null || priorityStr.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "优先级不能为空"));
            }

            try {
                Document.Priority priority = Document.Priority.valueOf(priorityStr.toUpperCase());
                document.setPriority(priority);
                documentRepository.save(document);
                return ResponseEntity.ok(Map.of("message", "优先级更新成功", "document", convertToMap(document)));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("message", "无效的优先级值: " + priorityStr));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新优先级失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteDocument(@PathVariable Long id) {
        try {
            Optional<Document> documentOpt = documentRepository.findById(id);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Document document = documentOpt.get();

            // Delete physical file
            Path filePath = Paths.get(document.getFilePath());
            Files.deleteIfExists(filePath);

            // Delete database record
            documentRepository.delete(document);

            return ResponseEntity.ok(Map.of("message", "文档删除成功"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除文档失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/folder")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteFolder(@RequestParam(required = false) Long categoryId,
                                         @RequestParam(required = false) String folderPath,
                                         @RequestParam(required = false) Long folderId) {
        try {
            if (folderId != null) {
                Map<String, Object> result = folderService.deleteFolder(folderId);
                return ResponseEntity.ok(result);
            }

            if (categoryId == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "必须提供文件夹信息"));
            }

            // Find all documents in the specified folder
            List<Document> documentsToDelete;
            if (folderPath != null && !folderPath.trim().isEmpty()) {
                // Delete specific subfolder within category
                documentsToDelete = documentRepository.findByCategoryIdAndFolderPath(categoryId, folderPath);
            } else {
                // Delete all documents in the category (effectively clearing the folder)
                documentsToDelete = documentRepository.findByCategoryId(categoryId);
            }

            if (documentsToDelete.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "文件夹为空或不存在"));
            }

            int deletedCount = 0;
            for (Document document : documentsToDelete) {
                try {
                    // Delete physical file
                    Path filePath = Paths.get(document.getFilePath());
                    Files.deleteIfExists(filePath);

                    // Delete database record
                    documentRepository.delete(document);
                    deletedCount++;
                } catch (Exception e) {
                    System.out.println("Failed to delete document " + document.getId() + ": " + e.getMessage());
                    // Continue with other files
                }
            }

            String folderName = folderPath != null ? folderPath : "整个文件夹";
            return ResponseEntity.ok(Map.of(
                "message", "文件夹删除成功",
                "deletedCount", deletedCount,
                "folderName", folderName
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除文件夹失败: " + e.getMessage()));
        }
    }

    private String getFileExtension(String filename) {
        if (filename != null && filename.contains(".")) {
            return filename.substring(filename.lastIndexOf(".") + 1);
        }
        return "pdf";
    }

    private String calculateChecksum(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private String calculateChecksumFromStream(InputStream inputStream) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192]; // 8KB buffer
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
            byte[] hash = digest.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    @GetMapping("/folders")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getFolders(@RequestParam(required = false) Long categoryId) {
        try {
            List<Map<String, Object>> folders = new ArrayList<>();

            if (categoryId != null) {
                // Get distinct folder paths for a specific category
                List<String> folderPaths = documentRepository.findDistinctFolderPathsByCategoryId(categoryId);
                for (String folderPath : folderPaths) {
                    if (folderPath != null && !folderPath.trim().isEmpty()) {
                        Map<String, Object> folderInfo = new HashMap<>();
                        folderInfo.put("name", folderPath);
                        folderInfo.put("path", folderPath);
                        folderInfo.put("categoryId", categoryId);

                        // Count files in this folder
                        List<Document> docs = documentRepository.findByCategoryIdAndFolderPath(categoryId, folderPath);
                        folderInfo.put("fileCount", docs.size());

                        folders.add(folderInfo);
                    }
                }
            } else {
                // Get folders for all categories
                List<Category> categories = categoryRepository.findAll();
                for (Category category : categories) {
                    List<String> folderPaths = documentRepository.findDistinctFolderPathsByCategoryId(category.getId());
                    for (String folderPath : folderPaths) {
                        if (folderPath != null && !folderPath.trim().isEmpty()) {
                            Map<String, Object> folderInfo = new HashMap<>();
                            folderInfo.put("name", folderPath);
                            folderInfo.put("path", folderPath);
                            folderInfo.put("categoryId", category.getId());
                            folderInfo.put("categoryName", category.getName());

                            // Count files in this folder
                            List<Document> docs = documentRepository.findByCategoryIdAndFolderPath(category.getId(), folderPath);
                            folderInfo.put("fileCount", docs.size());

                            folders.add(folderInfo);
                        }
                    }
                }
            }

            return ResponseEntity.ok(Map.of("folders", folders));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取文件夹列表失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> downloadDocument(@PathVariable Long id) {
        try {
            Optional<Document> documentOpt = documentRepository.findById(id);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Document document = documentOpt.get();
            Path filePath = Paths.get(document.getFilePath());

            if (!Files.exists(filePath)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "文件不存在"));
            }

            Resource resource = new org.springframework.core.io.FileSystemResource(filePath);

            // Determine content type based on file's MIME type
            MediaType contentType = MediaType.APPLICATION_OCTET_STREAM; // default
            String mimeType = document.getMimeType();
            if (mimeType != null) {
                try {
                    contentType = MediaType.parseMediaType(mimeType);
                } catch (Exception e) {
                    // If parsing fails, use default
                    contentType = MediaType.APPLICATION_OCTET_STREAM;
                }
            }

            return ResponseEntity.ok()
                    .contentType(contentType)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + document.getOriginalFilename() + "\"")
                    .body(resource);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "文件下载失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/preview")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> previewDocument(@PathVariable Long id) {
        try {
            Optional<Document> documentOpt = documentRepository.findById(id);
            if (documentOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Document document = documentOpt.get();
            Path filePath = Paths.get(document.getFilePath());

            if (!Files.exists(filePath)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "文件不存在"));
            }

            Resource resource = new org.springframework.core.io.FileSystemResource(filePath);

            // Determine content type based on file's MIME type
            MediaType contentType = MediaType.APPLICATION_OCTET_STREAM; // default
            String mimeType = document.getMimeType();
            if (mimeType != null) {
                try {
                    contentType = MediaType.parseMediaType(mimeType);
                } catch (Exception e) {
                    // If parsing fails, use default
                    contentType = MediaType.APPLICATION_OCTET_STREAM;
                }
            }

            return ResponseEntity.ok()
                    .contentType(contentType)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + document.getOriginalFilename() + "\"")
                    .body(resource);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "文件预览失败: " + e.getMessage()));
        }
    }

    private Map<String, Object> convertToMap(Document document) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", document.getId());
        map.put("filename", document.getOriginalFilename());
        map.put("fileSize", document.getFileSize());
        map.put("mimeType", document.getMimeType());
        map.put("status", document.getStatus());
        map.put("priority", document.getPriority() != null ? document.getPriority().name() : "NORMAL");
        map.put("uploadedAt", document.getCreatedAt());
        map.put("uploadedBy", document.getUploadedBy().getUsername());
        map.put("folderPath", document.getFolderPath());
        if (document.getFolder() != null) {
            map.put("folder", Map.of(
                    "id", document.getFolder().getId(),
                    "name", document.getFolder().getName(),
                    "path", document.getFolder().getPath()
            ));
        }
        if (document.getCategory() != null) {
            map.put("category", Map.of(
                "id", document.getCategory().getId(),
                "name", document.getCategory().getName()
            ));
        }
        if (document.getDocumentType() != null) {
            map.put("documentType", Map.of(
                "id", document.getDocumentType().getId(),
                "name", document.getDocumentType().getName(),
                "description", document.getDocumentType().getDescription() != null ? document.getDocumentType().getDescription() : ""
            ));
        }
        return map;
    }
}
