package com.annotationplatform.controller;

import com.annotationplatform.entity.Category;
import com.annotationplatform.entity.User;
import com.annotationplatform.repository.CategoryRepository;
import com.annotationplatform.repository.DocumentRepository;
import com.annotationplatform.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/categories")
@CrossOrigin(origins = "*", maxAge = 3600)
public class CategoryController {

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getCategories() {
        try {
            List<Category> rootCategories = categoryRepository.findRootCategories();

            List<Map<String, Object>> categoryTree = rootCategories.stream()
                    .map(this::buildCategoryTree)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("categories", categoryTree));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取分类列表失败: " + e.getMessage()));
        }
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createCategory(@RequestBody Map<String, Object> request,
                                           Authentication authentication) {
        try {
            String name = (String) request.get("name");
            String description = (String) request.get("description");
            Long parentId = request.get("parentId") != null ? Long.valueOf(request.get("parentId").toString()) : null;

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "分类名称不能为空"));
            }

            // Get current user
            String username = authentication.getName();
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "用户未找到"));
            }
            User user = userOpt.get();

            // Check if parent exists
            Category parent = null;
            if (parentId != null) {
                Optional<Category> parentOpt = categoryRepository.findById(parentId);
                if (parentOpt.isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "父分类不存在"));
                }
                parent = parentOpt.get();
            }

            // Check for duplicate name
            if (categoryRepository.existsByNameAndParent(name, parent)) {
                return ResponseEntity.badRequest().body(Map.of("message", "同级分类下已存在相同名称"));
            }

            // Create category
            Category category = new Category();
            category.setName(name.trim());
            category.setDescription(description != null ? description.trim() : null);
            category.setParent(parent);
            category.setCreatedBy(user);

            Category savedCategory = categoryRepository.save(category);

            return ResponseEntity.ok(Map.of(
                "message", "分类创建成功",
                "category", convertToMap(savedCategory)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "创建分类失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateCategory(@PathVariable Long id,
                                           @RequestBody Map<String, Object> request) {
        try {
            Optional<Category> categoryOpt = categoryRepository.findById(id);
            if (categoryOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Category category = categoryOpt.get();

            String name = (String) request.get("name");
            String description = (String) request.get("description");

            if (name != null && !name.trim().isEmpty()) {
                // Check for duplicate name (excluding current category)
                boolean exists = categoryRepository.existsByNameAndParent(name.trim(), category.getParent());
                if (exists && !name.trim().equals(category.getName())) {
                    return ResponseEntity.badRequest().body(Map.of("message", "同级分类下已存在相同名称"));
                }
                category.setName(name.trim());
            }

            if (description != null) {
                category.setDescription(description.trim());
            }

            Category savedCategory = categoryRepository.save(category);

            return ResponseEntity.ok(Map.of(
                "message", "分类更新成功",
                "category", convertToMap(savedCategory)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "更新分类失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteCategory(@PathVariable Long id) {
        try {
            Optional<Category> categoryOpt = categoryRepository.findById(id);
            if (categoryOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Category category = categoryOpt.get();

            // Check if category has documents
            Long documentCount = documentRepository.countByCategoryId(id);
            if (documentCount > 0) {
                return ResponseEntity.badRequest().body(Map.of("message", "该分类下还有文档，无法删除"));
            }

            // Check if category has subcategories
            if (!category.getChildren().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "该分类下还有子分类，无法删除"));
            }

            categoryRepository.delete(category);

            return ResponseEntity.ok(Map.of("message", "分类删除成功"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除分类失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/stats")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> getCategoryStats(@PathVariable Long id) {
        try {
            Optional<Category> categoryOpt = categoryRepository.findById(id);
            if (categoryOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Long documentCount = documentRepository.countByCategoryId(id);

            Map<String, Object> stats = new HashMap<>();
            stats.put("categoryId", id);
            stats.put("documentCount", documentCount);
            stats.put("subcategoryCount", categoryOpt.get().getChildren().size());

            return ResponseEntity.ok(stats);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取分类统计失败: " + e.getMessage()));
        }
    }

    private Map<String, Object> buildCategoryTree(Category category) {
        Map<String, Object> map = convertToMap(category);

        if (!category.getChildren().isEmpty()) {
            List<Map<String, Object>> children = category.getChildren().stream()
                    .map(this::buildCategoryTree)
                    .collect(Collectors.toList());
            map.put("children", children);
        } else {
            map.put("children", List.of());
        }

        return map;
    }

    private Map<String, Object> convertToMap(Category category) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", category.getId());
        map.put("name", category.getName());
        map.put("description", category.getDescription());
        map.put("level", category.getLevel());
        map.put("sortOrder", category.getSortOrder());
        map.put("createdAt", category.getCreatedAt());
        if (category.getParent() != null) {
            map.put("parentId", category.getParent().getId());
        }
        return map;
    }
}
