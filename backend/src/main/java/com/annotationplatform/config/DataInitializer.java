package com.annotationplatform.config;

import com.annotationplatform.entity.User;
import com.annotationplatform.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        System.out.println("Initializing default users...");

        // Create default users with password "password"
        String defaultPassword = passwordEncoder.encode("password");

        // Admin user
        createIfNotExists("admin", "admin@example.com", defaultPassword, User.Role.ADMIN);

        // Create multiple users for each role
        for (int i = 1; i <= 3; i++) {
            createIfNotExists("annotator" + i, "annotator" + i + "@example.com", defaultPassword, User.Role.ANNOTATOR);
            createIfNotExists("reviewer" + i, "reviewer" + i + "@example.com", defaultPassword, User.Role.REVIEWER);
            createIfNotExists("expert" + i, "expert" + i + "@example.com", defaultPassword, User.Role.EXPERT);
            createIfNotExists("ai_annotator" + i, "ai_annotator" + i + "@example.com", defaultPassword, User.Role.AI_ANNOTATOR);
        }

        System.out.println("Default users initialized successfully");
    }

    private void createIfNotExists(String username, String email, String password, User.Role role) {
        if (!userRepository.findByUsername(username).isPresent()) {
            User user = new User();
            user.setUsername(username);
            user.setEmail(email);
            user.setPassword(password);
            user.setRole(role);
            user.setScore(role == User.Role.ADMIN ? 100 : 0);
            user.setStatus(User.Status.ACTIVE);
            userRepository.save(user);
            System.out.println("Created user: " + username);
        }
    }
}

