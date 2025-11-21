package com.annotationplatform.controller;

import com.annotationplatform.entity.Folder;
import com.annotationplatform.entity.User;
import com.annotationplatform.repository.UserRepository;
import com.annotationplatform.service.FolderService;
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
@RequestMapping("/folders")
@CrossOrigin(origins = "*", maxAge = 3600)
public class FolderController {

    @Autowired
    private FolderService folderService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> listFolders(@RequestParam(required = false) Long parentId) {
        try {
            List<Folder> folders = folderService.getFolders(parentId);
            List<Map<String, Object>> response = folders.stream()
                    .map(this::convertFolder)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of("folders", response));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "获取文件夹列表失败: " + e.getMessage()));
        }
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> createFolder(@RequestBody Map<String, Object> request,
                                         Authentication authentication) {
        try {
            String folderName = request.get("name") != null ? request.get("name").toString() : null;
            Long parentId = request.get("parentId") != null
                    ? Long.valueOf(request.get("parentId").toString())
                    : null;

            if (folderName == null || folderName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "文件夹名称不能为空"));
            }

            Optional<User> userOpt = userRepository.findByUsername(authentication.getName());
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "用户未找到"));
            }

            Folder folder = folderService.createFolder(folderName, parentId, userOpt.get());
            return ResponseEntity.ok(Map.of(
                    "message", "文件夹创建成功",
                    "folder", convertFolder(folder)
            ));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "创建文件夹失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteFolder(@PathVariable Long id) {
        try {
            Map<String, Object> result = folderService.deleteFolder(id);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "删除文件夹失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> renameFolder(@PathVariable Long id,
                                          @RequestBody Map<String, Object> request) {
        try {
            String folderName = request.get("name") != null ? request.get("name").toString() : null;
            Folder folder = folderService.renameFolder(id, folderName);
            return ResponseEntity.ok(Map.of(
                    "message", "文件夹重命名成功",
                    "folder", convertFolder(folder)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "重命名文件夹失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/move")
    @PreAuthorize("hasRole('ADMIN') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT')")
    public ResponseEntity<?> moveFolder(@PathVariable Long id,
                                        @RequestBody Map<String, Object> request) {
        try {
            Long targetParentId = request.get("parentId") != null
                    ? Long.valueOf(request.get("parentId").toString())
                    : null;
            Folder folder = folderService.moveFolder(id, targetParentId);
            return ResponseEntity.ok(Map.of(
                    "message", "文件夹移动成功",
                    "folder", convertFolder(folder)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "移动文件夹失败: " + e.getMessage()));
        }
    }

    private Map<String, Object> convertFolder(Folder folder) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", folder.getId());
        map.put("name", folder.getName());
        map.put("path", folder.getPath());
        map.put("depth", folder.getDepth());
        map.put("parentId", folder.getParent() != null ? folder.getParent().getId() : null);
        map.put("createdAt", folder.getCreatedAt());
        if (folder.getCreatedBy() != null) {
            map.put("createdBy", folder.getCreatedBy().getUsername());
        }
        return map;
    }
}

