package com.annotationplatform;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureWebMvc
@ActiveProfiles("test")
@Transactional
public class AnnotationWorkflowIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testAnnotationWorkflow() throws Exception {
        // Test annotation workflow endpoints
        mockMvc.perform(get("/api/annotations"))
                .andExpect(status().isOk());
    }
}
