package com.annotationplatform.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/test")
public class TestController {

    @GetMapping("/all")
    public ResponseEntity<?> allAccess() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Public Content.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/auth-test")
    public ResponseEntity<?> authTest(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Auth test successful");
        response.put("received", request);
        return ResponseEntity.ok(response);
    }


    @GetMapping("/user")
    @PreAuthorize("hasRole('USER') or hasRole('ANNOTATOR') or hasRole('REVIEWER') or hasRole('EXPERT') or hasRole('ADMIN')")
    public ResponseEntity<?> userAccess() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "User Content.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/annotator")
    @PreAuthorize("hasRole('ANNOTATOR')")
    public ResponseEntity<?> annotatorAccess() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Annotator Board.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/reviewer")
    @PreAuthorize("hasRole('REVIEWER')")
    public ResponseEntity<?> reviewerAccess() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Reviewer Board.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminAccess() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Admin Board.");
        return ResponseEntity.ok(response);
    }
}
