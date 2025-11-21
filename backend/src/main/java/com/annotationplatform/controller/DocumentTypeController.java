package com.annotationplatform.controller;

import com.annotationplatform.entity.DocumentType;
import com.annotationplatform.entity.FormConfig;
import com.annotationplatform.entity.User;
import com.annotationplatform.repository.DocumentTypeRepository;
import com.annotationplatform.repository.FormConfigRepository;
import com.annotationplatform.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/document-types")
@CrossOrigin(origins = "*", maxAge = 3600)
public class DocumentTypeController {

    @Autowired
    private DocumentTypeRepository documentTypeRepository;

    @Autowired
    private FormConfigRepository formConfigRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getDocumentTypes(@RequestParam(defaultValue = "true") Boolean activeOnly) {
        try {
            List<DocumentType> documentTypes;
            if (activeOnly) {
                documentTypes = documentTypeRepository.findByIsActiveTrueOrderByCreatedAtDesc();
            } else {
                documentTypes = documentTypeRepository.findAllByOrderByCreatedAtDesc();
            }

            List<Map<String, Object>> result = documentTypes.stream()
                    .map(this::convertToMap)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("documentTypes", result));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取文档类型列表失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDocumentType(@PathVariable Long id) {
        try {
            Optional<DocumentType> documentTypeOpt = documentTypeRepository.findById(id);
            if (documentTypeOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            DocumentType documentType = documentTypeOpt.get();
            return ResponseEntity.ok(Map.of("documentType", convertToMap(documentType)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取文档类型详情失败: " + e.getMessage()));
        }
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createDocumentType(@RequestBody Map<String, Object> request,
                                                Authentication authentication) {
        try {
            String name = (String) request.get("name");
            String description = (String) request.get("description");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "文档类型名称不能为空"));
            }

            // Get current user
            if (authentication == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "未认证"));
            }

            String username = authentication.getName();
            if (username == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户名为空"));
            }

            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            // Check for duplicate name
            if (documentTypeRepository.existsByName(name.trim())) {
                return ResponseEntity.badRequest().body(Map.of("message", "文档类型名称已存在"));
            }

            // Create document type
            DocumentType documentType = new DocumentType();
            documentType.setName(name.trim());
            documentType.setDescription(description != null ? description.trim() : null);
            documentType.setIsActive(true);
            documentType.setCreatedBy(user);

            DocumentType savedDocumentType = documentTypeRepository.save(documentType);

            return ResponseEntity.ok(Map.of(
                "message", "文档类型创建成功",
                "documentType", convertToMap(savedDocumentType)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "创建文档类型失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateDocumentType(@PathVariable Long id,
                                               @RequestBody Map<String, Object> request) {
        try {
            Optional<DocumentType> documentTypeOpt = documentTypeRepository.findById(id);
            if (documentTypeOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            DocumentType documentType = documentTypeOpt.get();

            String name = (String) request.get("name");
            String description = (String) request.get("description");
            Boolean isActive = request.get("isActive") != null ? (Boolean) request.get("isActive") : null;

            if (name != null && !name.trim().isEmpty()) {
                // Check for duplicate name (excluding current document type)
                boolean exists = documentTypeRepository.existsByName(name.trim());
                if (exists && !name.trim().equals(documentType.getName())) {
                    return ResponseEntity.badRequest().body(Map.of("message", "文档类型名称已存在"));
                }
                documentType.setName(name.trim());
            }

            if (description != null) {
                documentType.setDescription(description.trim());
            }

            if (isActive != null) {
                documentType.setIsActive(isActive);
            }

            DocumentType savedDocumentType = documentTypeRepository.save(documentType);

            return ResponseEntity.ok(Map.of(
                "message", "文档类型更新成功",
                "documentType", convertToMap(savedDocumentType)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新文档类型失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteDocumentType(@PathVariable Long id) {
        try {
            Optional<DocumentType> documentTypeOpt = documentTypeRepository.findById(id);
            if (documentTypeOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            DocumentType documentType = documentTypeOpt.get();

            // Clear form configs association
            documentType.getFormConfigs().clear();
            documentTypeRepository.save(documentType);

            documentTypeRepository.delete(documentType);

            return ResponseEntity.ok(Map.of("message", "文档类型删除成功"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除文档类型失败: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/form-configs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> assignFormConfigs(@PathVariable Long id,
                                               @RequestBody Map<String, Object> request) {
        try {
            Optional<DocumentType> documentTypeOpt = documentTypeRepository.findById(id);
            if (documentTypeOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            DocumentType documentType = documentTypeOpt.get();

            // Handle formConfigIds - can be List<Integer> or List<Long> from JSON
            List<?> formConfigIdsRaw = (List<?>) request.get("formConfigIds");
            if (formConfigIdsRaw == null || formConfigIdsRaw.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "表单模版ID列表不能为空"));
            }

            // Convert to List<Long> - handle both Integer and Long
            List<Long> formConfigIds = new ArrayList<>();
            for (Object idObj : formConfigIdsRaw) {
                Long formConfigId;
                if (idObj instanceof Long) {
                    formConfigId = (Long) idObj;
                } else if (idObj instanceof Integer) {
                    formConfigId = ((Integer) idObj).longValue();
                } else if (idObj instanceof Number) {
                    formConfigId = ((Number) idObj).longValue();
                } else {
                    // Try to parse as string
                    try {
                        formConfigId = Long.parseLong(idObj.toString());
                    } catch (NumberFormatException e) {
                        return ResponseEntity.badRequest().body(Map.of("message", "无效的表单模版ID: " + idObj));
                    }
                }
                formConfigIds.add(formConfigId);
            }

            // Clear existing associations
            documentType.getFormConfigs().clear();

            // Add new associations
            for (Long formConfigId : formConfigIds) {
                Optional<FormConfig> formConfigOpt = formConfigRepository.findById(formConfigId);
                if (formConfigOpt.isPresent()) {
                    documentType.getFormConfigs().add(formConfigOpt.get());
                }
            }

            DocumentType savedDocumentType = documentTypeRepository.save(documentType);

            return ResponseEntity.ok(Map.of(
                "message", "表单模版配置成功",
                "documentType", convertToMap(savedDocumentType)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "配置表单模版失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/form-configs")
    public ResponseEntity<?> getDocumentTypeFormConfigs(@PathVariable Long id) {
        try {
            Optional<DocumentType> documentTypeOpt = documentTypeRepository.findById(id);
            if (documentTypeOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            DocumentType documentType = documentTypeOpt.get();
            List<Map<String, Object>> formConfigs = documentType.getFormConfigs().stream()
                    .map(this::convertFormConfigToMap)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("formConfigs", formConfigs));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取表单模版列表失败: " + e.getMessage()));
        }
    }

    private Map<String, Object> convertToMap(DocumentType documentType) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", documentType.getId());
        map.put("name", documentType.getName());
        map.put("description", documentType.getDescription());
        map.put("isActive", documentType.getIsActive());
        map.put("createdAt", documentType.getCreatedAt());
        map.put("updatedAt", documentType.getUpdatedAt());
        map.put("formConfigCount", documentType.getFormConfigs().size());
        return map;
    }

    private Map<String, Object> convertFormConfigToMap(FormConfig formConfig) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", formConfig.getId());
        map.put("name", formConfig.getName());
        map.put("description", formConfig.getDescription());
        map.put("isActive", formConfig.getIsActive());
        if (formConfig.getCategory() != null) {
            map.put("categoryId", formConfig.getCategory().getId());
            map.put("categoryName", formConfig.getCategory().getName());
        }
        return map;
    }
}

