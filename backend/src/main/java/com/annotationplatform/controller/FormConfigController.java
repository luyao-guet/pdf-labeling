package com.annotationplatform.controller;

import com.annotationplatform.entity.Category;
import com.annotationplatform.entity.FormConfig;
import com.annotationplatform.entity.FormField;
import com.annotationplatform.entity.User;
import com.annotationplatform.repository.CategoryRepository;
import com.annotationplatform.repository.FormConfigRepository;
import com.annotationplatform.repository.FormFieldRepository;
import com.annotationplatform.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/form-configs")
@CrossOrigin(origins = "*", maxAge = 3600)
public class FormConfigController {

    @Autowired
    private FormConfigRepository formConfigRepository;

    @Autowired
    private FormFieldRepository formFieldRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getFormConfigs(@RequestParam(required = false) Long categoryId,
                                           @RequestParam(defaultValue = "true") Boolean activeOnly) {
        try {
            List<FormConfig> formConfigs;

            if (categoryId != null) {
                if (activeOnly) {
                    formConfigs = formConfigRepository.findByCategoryIdAndIsActiveTrueOrderByCreatedAtDesc(categoryId);
                } else {
                    formConfigs = formConfigRepository.findByCategoryIdOrderByCreatedAtDesc(categoryId);
                }
            } else {
                // When categoryId is null, only return independent form configs (category IS NULL)
                if (activeOnly) {
                    formConfigs = formConfigRepository.findIndependentFormConfigs();
                } else {
                    formConfigs = formConfigRepository.findAllIndependentFormConfigs();
                }
                // Debug log
                System.out.println("Found " + formConfigs.size() + " independent form configs (activeOnly=" + activeOnly + ")");
            }

            List<Map<String, Object>> result = formConfigs.stream()
                    .map(this::convertToMap)
                    .collect(Collectors.toList());

            // Debug: log all form configs
            System.out.println("Returning " + result.size() + " form configs:");
            result.forEach(fc -> System.out.println("  - ID: " + fc.get("id") + ", Name: " + fc.get("name") + ", Active: " + fc.get("isActive") + ", Category: " + fc.get("categoryId")));

            return ResponseEntity.ok(Map.of("formConfigs", result));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取表单配置失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getFormConfig(@PathVariable Long id) {
        try {
            Optional<FormConfig> formConfigOpt = formConfigRepository.findById(id);
            if (formConfigOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            FormConfig formConfig = formConfigOpt.get();
            return ResponseEntity.ok(Map.of("formConfig", convertToMap(formConfig)));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取表单配置详情失败: " + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createFormConfig(@RequestBody Map<String, Object> request,
                                             Authentication authentication) {
        try {
            // Log request for debugging
            System.out.println("=== Received form config creation request: " + request);
            System.out.println("=== Request keys: " + request.keySet());
            
            Object nameObj = request.get("name");
            String name = nameObj != null ? nameObj.toString().trim() : null;
            
            if (name == null || name.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "表单配置名称不能为空"));
            }
            
            String description = null;
            Object descriptionObj = request.get("description");
            if (descriptionObj != null && !descriptionObj.toString().trim().isEmpty()) {
                description = descriptionObj.toString().trim();
            }
            
            Object categoryIdObj = request.get("categoryId");
            Long categoryId = null;
            if (categoryIdObj != null && !categoryIdObj.toString().trim().isEmpty() && !"null".equals(categoryIdObj.toString())) {
                try {
                    categoryId = Long.valueOf(categoryIdObj.toString());
                } catch (NumberFormatException e) {
                    return ResponseEntity.badRequest().body(Map.of("message", "分类ID格式错误"));
                }
            }
            
            String promptTemplate = null;
            Object promptTemplateObj = request.get("promptTemplate");
            if (promptTemplateObj != null && !promptTemplateObj.toString().trim().isEmpty()) {
                promptTemplate = promptTemplateObj.toString().trim();
            }
            
            Object isActiveObj = request.get("isActive");
            Boolean isActive = true; // Default to true
            if (isActiveObj != null) {
                if (isActiveObj instanceof Boolean) {
                    isActive = (Boolean) isActiveObj;
                } else if (isActiveObj instanceof String) {
                    isActive = Boolean.parseBoolean((String) isActiveObj);
                }
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

            // Get category if provided
            Category category = null;
            if (categoryId != null) {
                Optional<Category> categoryOpt = categoryRepository.findById(categoryId);
                if (categoryOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "分类不存在"));
                }
                category = categoryOpt.get();
                
                // Check for duplicate name in same category
                if (formConfigRepository.existsByNameAndCategoryId(name, categoryId)) {
                    return ResponseEntity.badRequest().body(Map.of("message", "同一分类下已存在相同名称的表单配置"));
                }
            } else {
                // Check for duplicate name only among independent form configs (category IS NULL)
                long count = formConfigRepository.countByNameAndCategoryIsNull(name.trim());
                System.out.println("Checking duplicate for name: " + name.trim() + ", count: " + count);
                if (count > 0) {
                    // Find the existing configs for better error message
                    List<FormConfig> allIndependent = formConfigRepository.findAllIndependentFormConfigs();
                    System.out.println("Found " + allIndependent.size() + " independent form configs");
                    allIndependent.forEach(fc -> System.out.println("  - ID: " + fc.getId() + ", Name: " + fc.getName() + ", Category: " + (fc.getCategory() != null ? fc.getCategory().getId() : "NULL")));
                    
                    List<FormConfig> existingConfigs = allIndependent.stream()
                        .filter(fc -> fc.getName().equals(name.trim()))
                        .collect(Collectors.toList());
                    System.out.println("Filtered to " + existingConfigs.size() + " matching configs");
                    
                    // If no matching configs found in independent list, try to find all configs with this name
                    if (existingConfigs.isEmpty()) {
                        System.out.println("No matching configs in independent list, searching all configs...");
                        List<FormConfig> allConfigs = formConfigRepository.findAll();
                        System.out.println("Total form configs in database: " + allConfigs.size());
                        allConfigs.forEach(fc -> System.out.println("  - ID: " + fc.getId() + ", Name: " + fc.getName() + ", Category: " + (fc.getCategory() != null ? fc.getCategory().getId() : "NULL")));
                        
                        existingConfigs = allConfigs.stream()
                            .filter(fc -> fc.getName().equals(name.trim()))
                            .collect(Collectors.toList());
                        System.out.println("Found " + existingConfigs.size() + " matching configs in all configs");
                    }
                    
                    String existingInfo = existingConfigs.stream()
                        .map(fc -> "ID:" + fc.getId() + (fc.getIsActive() ? " (启用)" : " (禁用)") + 
                             (fc.getCategory() != null ? " [分类:" + fc.getCategory().getName() + "]" : " [独立]"))
                        .collect(Collectors.joining(", "));
                    
                    // Return detailed error with existing config IDs for deletion
                    List<Long> existingIds = existingConfigs.stream()
                        .map(FormConfig::getId)
                        .collect(Collectors.toList());
                    
                    Map<String, Object> errorResponse = new HashMap<>();
                    if (existingConfigs.isEmpty()) {
                        errorResponse.put("message", "表单配置名称已存在: " + name.trim() + " (但无法找到具体配置)");
                    } else {
                        errorResponse.put("message", "已存在相同名称的表单配置: " + name.trim() + " (" + existingInfo + ")");
                    }
                    errorResponse.put("existingIds", existingIds);
                    errorResponse.put("existingCount", existingConfigs.size());
                    System.out.println("Returning error response with " + existingIds.size() + " existing IDs: " + existingIds);
                    return ResponseEntity.badRequest().body(errorResponse);
                }
            }

            // Create form config
            FormConfig formConfig = new FormConfig();
            formConfig.setName(name.trim());
            formConfig.setDescription(description != null ? description.trim() : null);
            // Explicitly set category - if null, set to null (for independent form configs)
            formConfig.setCategory(category); // category can be null for independent form configs
            formConfig.setPromptTemplate(promptTemplate);
            formConfig.setIsActive(isActive);
            formConfig.setCreatedBy(user);
            
            System.out.println("=== Creating FormConfig: name=" + formConfig.getName() + ", category=" + (category != null ? category.getId() : "NULL") + ", createdBy=" + user.getId());

            FormConfig savedFormConfig = formConfigRepository.save(formConfig);

            return ResponseEntity.ok(Map.of(
                "message", "表单配置创建成功",
                "formConfig", convertToMap(savedFormConfig)
            ));

        } catch (IllegalArgumentException e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("message", "请求参数错误: " + e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            System.out.println("=== EXCEPTION STACK TRACE ===");
            e.printStackTrace();
            System.out.println("=== EXCEPTION CAUSE ===");
            if (e.getCause() != null) {
                e.getCause().printStackTrace();
            }
            String errorMessage = e.getMessage();
            
            // Extract name and categoryId from request for error message
            String nameForError = null;
            Long categoryIdForError = null;
            try {
                Object nameObj = request.get("name");
                if (nameObj != null) {
                    nameForError = nameObj.toString().trim();
                }
                Object categoryIdObj = request.get("categoryId");
                if (categoryIdObj != null && !categoryIdObj.toString().trim().isEmpty() && !"null".equals(categoryIdObj.toString())) {
                    try {
                        categoryIdForError = Long.valueOf(categoryIdObj.toString());
                    } catch (NumberFormatException ex) {
                        // Ignore
                    }
                }
            } catch (Exception ex) {
                // Ignore
            }
            final String finalNameForError = nameForError; // Make final for lambda usage
            final Long finalCategoryIdForError = categoryIdForError; // Make final for lambda usage
            
            System.out.println("=== CATCH BLOCK: Error message: " + errorMessage);
            System.out.println("=== CATCH BLOCK: Exception class: " + e.getClass().getName());
            System.out.println("=== CATCH BLOCK: Name for error: " + finalNameForError);
            System.out.println("=== CATCH BLOCK: CategoryId for error: " + finalCategoryIdForError);
            
            if (errorMessage != null) {
                if (errorMessage.contains("ConstraintViolationException") || errorMessage.contains("Duplicate") || 
                    errorMessage.contains("DataIntegrityViolationException")) {
                    System.out.println("=== CATCH BLOCK: Matched duplicate error pattern");
                    // Try to find the existing config to provide better error message
                    if (finalNameForError != null && !finalNameForError.isEmpty()) {
                        try {
                            System.out.println("=== CATCH BLOCK: Searching for existing configs...");
                            List<FormConfig> existingConfigs;
                            if (finalCategoryIdForError != null) {
                                System.out.println("=== CATCH BLOCK: Searching in category: " + finalCategoryIdForError);
                                // Search in specific category
                                existingConfigs = formConfigRepository.findByCategoryIdOrderByCreatedAtDesc(finalCategoryIdForError).stream()
                                    .filter(fc -> fc.getName().equals(finalNameForError))
                                    .collect(Collectors.toList());
                            } else {
                                System.out.println("=== CATCH BLOCK: Searching independent configs...");
                                // Search independent form configs (category IS NULL)
                                List<FormConfig> allIndependent = formConfigRepository.findAllIndependentFormConfigs();
                                System.out.println("=== CATCH BLOCK: Found " + allIndependent.size() + " independent configs");
                                existingConfigs = allIndependent.stream()
                                    .filter(fc -> fc.getName().equals(finalNameForError))
                                    .collect(Collectors.toList());
                                System.out.println("=== CATCH BLOCK: Filtered to " + existingConfigs.size() + " matching configs");
                            }
                            
                            if (!existingConfigs.isEmpty()) {
                                System.out.println("=== CATCH BLOCK: Found " + existingConfigs.size() + " existing configs");
                                String existingInfo = existingConfigs.stream()
                                    .map(fc -> "ID:" + fc.getId() + (fc.getIsActive() ? " (启用)" : " (禁用)"))
                                    .collect(Collectors.joining(", "));
                                
                                List<Long> existingIds = existingConfigs.stream()
                                    .map(FormConfig::getId)
                                    .collect(Collectors.toList());
                                
                                Map<String, Object> errorResponse = new HashMap<>();
                                if (finalCategoryIdForError != null) {
                                    errorResponse.put("message", "同一分类下已存在相同名称的表单配置: " + finalNameForError + " (" + existingInfo + ")");
                                } else {
                                    errorResponse.put("message", "已存在相同名称的独立表单配置: " + finalNameForError + " (" + existingInfo + ")");
                                }
                                errorResponse.put("existingIds", existingIds);
                                errorResponse.put("existingCount", existingConfigs.size());
                                return ResponseEntity.badRequest().body(errorResponse);
                            }
                        } catch (Exception ex) {
                            ex.printStackTrace();
                            // Fall through to default message
                        }
                    }
                    // If we couldn't find existing configs, still return error with name
                    System.out.println("=== CATCH BLOCK: First search didn't find configs, trying again...");
                    Map<String, Object> errorResponse = new HashMap<>();
                    errorResponse.put("message", "表单配置名称已存在" + (finalNameForError != null ? ": " + finalNameForError : ""));
                    // Try one more time to find existing configs by name only (any category)
                    if (finalNameForError != null && !finalNameForError.isEmpty()) {
                        try {
                            System.out.println("=== CATCH BLOCK: Second search - looking for name: " + finalNameForError);
                            // First try to find independent configs (category IS NULL)
                            List<FormConfig> independentConfigs = formConfigRepository.findAllIndependentFormConfigs().stream()
                                .filter(fc -> fc.getName().equals(finalNameForError))
                                .collect(Collectors.toList());
                            System.out.println("=== CATCH BLOCK: Found " + independentConfigs.size() + " independent configs with name: " + finalNameForError);
                            
                            // If not found, try to find all configs with this name
                            List<FormConfig> allExistingConfigs = independentConfigs;
                            if (allExistingConfigs.isEmpty()) {
                                System.out.println("=== CATCH BLOCK: No independent configs found, searching all configs...");
                                List<FormConfig> allConfigs = formConfigRepository.findAll();
                                System.out.println("=== CATCH BLOCK: Total configs in database: " + allConfigs.size());
                                allConfigs.forEach(fc -> System.out.println("  - ID: " + fc.getId() + ", Name: " + fc.getName() + ", Category: " + (fc.getCategory() != null ? fc.getCategory().getId() : "NULL")));
                                allExistingConfigs = allConfigs.stream()
                                    .filter(fc -> fc.getName().equals(finalNameForError))
                                    .collect(Collectors.toList());
                                System.out.println("=== CATCH BLOCK: Found " + allExistingConfigs.size() + " configs with name: " + finalNameForError);
                            }
                            
                            if (!allExistingConfigs.isEmpty()) {
                                String existingInfo = allExistingConfigs.stream()
                                    .map(fc -> "ID:" + fc.getId() + (fc.getIsActive() ? " (启用)" : " (禁用)") + 
                                         (fc.getCategory() != null ? " [分类:" + fc.getCategory().getName() + "]" : " [独立]"))
                                    .collect(Collectors.joining(", "));
                                
                                List<Long> existingIds = allExistingConfigs.stream()
                                    .map(FormConfig::getId)
                                    .collect(Collectors.toList());
                                
                                errorResponse.put("message", "表单配置名称已存在: " + finalNameForError + " (" + existingInfo + ")");
                                errorResponse.put("existingIds", existingIds);
                                errorResponse.put("existingCount", allExistingConfigs.size());
                            }
                        } catch (Exception ex) {
                            ex.printStackTrace();
                            // Ignore, use default message
                        }
                    }
                    return ResponseEntity.badRequest().body(errorResponse);
                }
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "创建表单配置失败: " + (errorMessage != null ? errorMessage : "未知错误")));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateFormConfig(@PathVariable Long id,
                                             @RequestBody Map<String, Object> request) {
        try {
            Optional<FormConfig> formConfigOpt = formConfigRepository.findById(id);
            if (formConfigOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            FormConfig formConfig = formConfigOpt.get();

            String name = (String) request.get("name");
            String description = (String) request.get("description");
            String promptTemplate = (String) request.get("promptTemplate");
            Boolean isActive = request.get("isActive") != null ? (Boolean) request.get("isActive") : null;

            if (name != null && !name.trim().isEmpty()) {
                // Check for duplicate name (excluding current config)
                Long categoryId = formConfig.getCategory() != null ? formConfig.getCategory().getId() : null;
                boolean exists = formConfigRepository.existsByNameAndCategoryId(name.trim(), categoryId);
                if (exists && !name.trim().equals(formConfig.getName())) {
                    return ResponseEntity.badRequest().body(Map.of("message", "已存在相同名称的表单配置"));
                }
                formConfig.setName(name.trim());
            }

            if (description != null) {
                formConfig.setDescription(description.trim());
            }

            if (promptTemplate != null) {
                formConfig.setPromptTemplate(promptTemplate);
            }

            if (isActive != null) {
                formConfig.setIsActive(isActive);
            }

            FormConfig savedFormConfig = formConfigRepository.save(formConfig);

            return ResponseEntity.ok(Map.of(
                "message", "表单配置更新成功",
                "formConfig", convertToMap(savedFormConfig)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新表单配置失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFormConfig(@PathVariable Long id) {
        try {
            Optional<FormConfig> formConfigOpt = formConfigRepository.findById(id);
            if (formConfigOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            FormConfig formConfig = formConfigOpt.get();

            // Check if form config is being used by tasks
            // For now, we'll allow deletion - in production, you might want to check dependencies

            formConfigRepository.delete(formConfig);

            return ResponseEntity.ok(Map.of("message", "表单配置删除成功"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除表单配置失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/fields")
    public ResponseEntity<?> getFormFields(@PathVariable Long id) {
        try {
            Optional<FormConfig> formConfigOpt = formConfigRepository.findById(id);
            if (formConfigOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            List<FormField> fields = formConfigOpt.get().getFields();
            List<Map<String, Object>> fieldMaps = fields.stream()
                    .map(this::convertFieldToMap)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("fields", fieldMaps));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取表单字段失败: " + e.getMessage()));
        }
    }

    @PostMapping("/{id}/fields")
    public ResponseEntity<?> addFormField(@PathVariable Long id,
                                         @RequestBody Map<String, Object> request) {
        try {
            Optional<FormConfig> formConfigOpt = formConfigRepository.findById(id);
            if (formConfigOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            FormConfig formConfig = formConfigOpt.get();

            String fieldName = (String) request.get("fieldName");
            String fieldType = (String) request.get("fieldType");
            String label = (String) request.get("label");
            Boolean required = (Boolean) request.get("required");
            Integer sortOrder = (Integer) request.get("sortOrder");

            if (fieldName == null || fieldName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "字段名称不能为空"));
            }

            if (fieldType == null || fieldType.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "字段类型不能为空"));
            }

            if (label == null || label.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "字段标签不能为空"));
            }

            // Check for duplicate field name in this form config
            boolean fieldExists = formConfig.getFields().stream()
                    .anyMatch(field -> field.getFieldName().equals(fieldName.trim()));
            if (fieldExists) {
                return ResponseEntity.badRequest().body(Map.of("message", "字段名称已存在"));
            }

            // Create form field
            FormField formField = new FormField();
            formField.setFormConfig(formConfig);
            formField.setFieldName(fieldName.trim());
            formField.setFieldType(FormField.FieldType.valueOf(fieldType.toUpperCase()));
            formField.setLabel(label.trim());
            formField.setRequired(required != null ? required : false);
            formField.setSortOrder(sortOrder != null ? sortOrder : 0);

            // Set optional fields
            if (request.get("placeholder") != null) {
                formField.setPlaceholder((String) request.get("placeholder"));
            }
            if (request.get("validationRules") != null) {
                formField.setValidationRules(request.get("validationRules").toString());
            }
            if (request.get("options") != null) {
                formField.setOptions(request.get("options").toString());
            }

            FormField savedField = formFieldRepository.save(formField);

            return ResponseEntity.ok(Map.of(
                "message", "表单字段添加成功",
                "field", convertFieldToMap(savedField)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "添加表单字段失败: " + e.getMessage()));
        }
    }

    @PutMapping("/fields/{fieldId}")
    public ResponseEntity<?> updateFormField(@PathVariable Long fieldId,
                                            @RequestBody Map<String, Object> request) {
        try {
            Optional<FormField> fieldOpt = formFieldRepository.findById(fieldId);
            if (fieldOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            FormField field = fieldOpt.get();

            String fieldName = (String) request.get("fieldName");
            String label = (String) request.get("label");
            Boolean required = (Boolean) request.get("required");
            Integer sortOrder = (Integer) request.get("sortOrder");

            if (fieldName != null && !fieldName.trim().isEmpty()) {
                // Check for duplicate field name (excluding current field)
                boolean nameExists = field.getFormConfig().getFields().stream()
                        .anyMatch(f -> f.getId() != fieldId && f.getFieldName().equals(fieldName.trim()));
                if (nameExists) {
                    return ResponseEntity.badRequest().body(Map.of("message", "字段名称已存在"));
                }
                field.setFieldName(fieldName.trim());
            }

            if (label != null && !label.trim().isEmpty()) {
                field.setLabel(label.trim());
            }

            if (required != null) {
                field.setRequired(required);
            }

            if (sortOrder != null) {
                field.setSortOrder(sortOrder);
            }

            // Update optional fields
            if (request.get("placeholder") != null) {
                field.setPlaceholder((String) request.get("placeholder"));
            }
            if (request.get("validationRules") != null) {
                field.setValidationRules(request.get("validationRules").toString());
            }
            if (request.get("options") != null) {
                field.setOptions(request.get("options").toString());
            }

            FormField savedField = formFieldRepository.save(field);

            return ResponseEntity.ok(Map.of(
                "message", "表单字段更新成功",
                "field", convertFieldToMap(savedField)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新表单字段失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/fields/{fieldId}")
    public ResponseEntity<?> deleteFormField(@PathVariable Long fieldId) {
        try {
            Optional<FormField> fieldOpt = formFieldRepository.findById(fieldId);
            if (fieldOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            formFieldRepository.delete(fieldOpt.get());

            return ResponseEntity.ok(Map.of("message", "表单字段删除成功"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除表单字段失败: " + e.getMessage()));
        }
    }

    private Map<String, Object> convertToMap(FormConfig formConfig) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", formConfig.getId());
        map.put("name", formConfig.getName());
        map.put("description", formConfig.getDescription());
        if (formConfig.getCategory() != null) {
            map.put("categoryId", formConfig.getCategory().getId());
            map.put("categoryName", formConfig.getCategory().getName());
        } else {
            map.put("categoryId", null);
            map.put("categoryName", null);
        }
        map.put("promptTemplate", formConfig.getPromptTemplate());
        map.put("isActive", formConfig.getIsActive());
        map.put("createdAt", formConfig.getCreatedAt());
        map.put("updatedAt", formConfig.getUpdatedAt());
        // Safely get field count - handle case where table doesn't exist yet
        try {
            map.put("fieldCount", formConfig.getFields().size());
        } catch (Exception e) {
            // If fields table doesn't exist or can't be accessed, default to 0
            map.put("fieldCount", 0);
        }
        return map;
    }

    private Map<String, Object> convertFieldToMap(FormField field) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", field.getId());
        map.put("formConfigId", field.getFormConfig().getId());
        map.put("fieldName", field.getFieldName());
        map.put("fieldType", field.getFieldType());
        map.put("label", field.getLabel());
        map.put("placeholder", field.getPlaceholder());
        map.put("required", field.getRequired());
        map.put("validationRules", field.getValidationRules());
        map.put("options", field.getOptions());
        map.put("sortOrder", field.getSortOrder());
        return map;
    }
}
