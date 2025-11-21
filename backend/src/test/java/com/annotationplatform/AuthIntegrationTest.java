package com.annotationplatform;

import com.annotationplatform.entity.User;
import com.annotationplatform.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureWebMvc
@ActiveProfiles("test")
@Transactional
public class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Test
    public void testUserRegistrationAndLogin() throws Exception {
        // Test user registration
        String signupRequest = "{"
                + "\"username\": \"testuser\","
                + "\"email\": \"test@example.com\","
                + "\"password\": \"password123\","
                + "\"role\": \"ANNOTATOR\""
                + "}";

        mockMvc.perform(post("/api/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(signupRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully!"));

        // Verify user was created
        User createdUser = userRepository.findByUsername("testuser").orElse(null);
        assert createdUser != null;
        assert createdUser.getEmail().equals("test@example.com");
        assert createdUser.getRole().toString().equals("ANNOTATOR");

        // Test login
        String loginRequest = "{"
                + "\"username\": \"testuser\","
                + "\"password\": \"password123\""
                + "}";

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.username").value("testuser"))
                .andExpect(jsonPath("$.roles").isArray());
    }

    @Test
    public void testAdminLogin() throws Exception {
        // Test admin login with predefined admin user
        String loginRequest = "{"
                + "\"username\": \"admin\","
                + "\"password\": \"password\""
                + "}";

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.roles").isArray());
    }
}
