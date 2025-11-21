package com.annotationplatform.controller;

import com.annotationplatform.entity.ScoreHistory;
import com.annotationplatform.entity.User;
import com.annotationplatform.service.ScoreService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/scores")
@CrossOrigin(origins = "*", maxAge = 3600)
public class ScoreController {

    @Autowired
    private ScoreService scoreService;

    @Autowired
    private com.annotationplatform.repository.UserRepository userRepository;

    /**
     * 获取积分排行榜
     */
    @GetMapping("/ranking")
    public ResponseEntity<List<ScoreService.UserScoreRanking>> getScoreRanking(
            @RequestParam(defaultValue = "10") int limit) {
        try {
            List<ScoreService.UserScoreRanking> ranking = scoreService.getScoreRanking(limit);
            return ResponseEntity.ok(ranking);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 获取当前用户的积分统计
     */
    @GetMapping("/stats")
    public ResponseEntity<ScoreService.UserScoreStats> getUserScoreStats() {
        try {
            // For now, use a default user (since security is disabled)
            // In production, this would come from authentication
            User currentUser = userRepository.findById(2L) // Assuming annotator user
                .orElseThrow(() -> new RuntimeException("用户不存在"));

            ScoreService.UserScoreStats stats = scoreService.getUserScoreStats(currentUser);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    /**
     * 获取当前用户的积分历史
     */
    @GetMapping("/history")
    public ResponseEntity<Page<ScoreHistory>> getUserScoreHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            // For now, use a default user (since security is disabled)
            // In production, this would come from authentication
            User currentUser = userRepository.findById(2L) // Assuming annotator user
                .orElseThrow(() -> new RuntimeException("用户不存在"));

            Page<ScoreHistory> history = scoreService.getUserScoreHistory(currentUser, page, size);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 管理员手动调整用户积分
     */
    @PostMapping("/admin/adjust/{userId}")
    public ResponseEntity<?> manualScoreAdjustment(
            @PathVariable Long userId,
            @RequestParam int scoreChange,
            @RequestParam String reason) {
        try {
            // 查找用户
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

            // 执行积分调整
            scoreService.manualScoreAdjustment(user, scoreChange, reason);

            return ResponseEntity.ok("积分调整成功");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("积分调整失败: " + e.getMessage());
        }
    }

}
