package com.annotationplatform.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class IndexController {

    @GetMapping("/")
    public ResponseEntity<?> root() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "数据AI自动化处理审核平台后端API运行正常!");
        response.put("status", "OK");
        response.put("version", "1.0.0");
        return ResponseEntity.ok(response);
    }
}
