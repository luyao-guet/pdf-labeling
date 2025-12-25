package com.annotationplatform.controller;

import com.annotationplatform.entity.User;
import com.annotationplatform.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder encoder;

    @GetMapping
    public ResponseEntity<?> getUsers() {
        try {
            List<User> users = userRepository.findAll();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "获取用户列表失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable Long id) {
        try {
            Optional<User> userOpt = userRepository.findById(id);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(userOpt.get());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "获取用户信息失败: " + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody User user) {
        try {
            if (userRepository.existsByUsername(user.getUsername())) {
                return ResponseEntity.badRequest().body(Map.of("message", "用户名已存在"));
            }
            if (userRepository.existsByEmail(user.getEmail())) {
                return ResponseEntity.badRequest().body(Map.of("message", "邮箱已存在"));
            }

            if (user.getPassword() != null) {
                user.setPassword(encoder.encode(user.getPassword()));
            } else {
                return ResponseEntity.badRequest().body(Map.of("message", "密码不能为空"));
            }

            User savedUser = userRepository.save(user);
            return ResponseEntity.ok(savedUser);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "创建用户失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody User userDetails) {
        try {
            Optional<User> userOpt = userRepository.findById(id);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            User user = userOpt.get();
            
            // 检查用户名是否被其他用户使用
            if (userDetails.getUsername() != null && !userDetails.getUsername().equals(user.getUsername())) {
                if (userRepository.existsByUsername(userDetails.getUsername())) {
                    return ResponseEntity.badRequest().body(Map.of("message", "用户名已存在"));
                }
                user.setUsername(userDetails.getUsername());
            }
            
            // 检查邮箱是否被其他用户使用
            if (userDetails.getEmail() != null && !userDetails.getEmail().equals(user.getEmail())) {
                if (userRepository.existsByEmail(userDetails.getEmail())) {
                    return ResponseEntity.badRequest().body(Map.of("message", "邮箱已存在"));
                }
                user.setEmail(userDetails.getEmail());
            }
            
            // 更新密码（如果提供了新密码）
            if (userDetails.getPassword() != null && !userDetails.getPassword().isEmpty()) {
                user.setPassword(encoder.encode(userDetails.getPassword()));
            }
            
            // 更新角色
            if (userDetails.getRole() != null) {
                user.setRole(userDetails.getRole());
            }
            
            // 更新积分
            if (userDetails.getScore() != null) {
                user.setScore(userDetails.getScore());
            }
            
            // 更新状态
            if (userDetails.getStatus() != null) {
                user.setStatus(userDetails.getStatus());
            }

            User updatedUser = userRepository.save(user);
            return ResponseEntity.ok(updatedUser);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "更新用户失败: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        try {
            Optional<User> userOpt = userRepository.findById(id);
            if (userOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            userRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "用户删除成功"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", "删除用户失败: " + e.getMessage()));
        }
    }
}




