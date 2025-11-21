package com.annotationplatform.service;

import com.annotationplatform.entity.*;
import com.annotationplatform.repository.ScoreHistoryRepository;
import com.annotationplatform.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ScoreService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ScoreHistoryRepository scoreHistoryRepository;

    // 积分奖励常量
    private static final int TASK_COMPLETION_SCORE = 10;    // 任务完成基础积分
    private static final int QUALITY_BONUS_SCORE = 5;       // 质量检查通过奖励
    private static final int REVIEW_BONUS_SCORE = 8;        // 审核任务奖励
    private static final int ACCURACY_BONUS_MULTIPLIER = 2; // 准确率奖励倍数
    private static final int PENALTY_SCORE = -5;            // 质量不合格扣分

    /**
     * 为任务完成奖励积分
     */
    @Transactional
    public void awardTaskCompletionScore(User user, Task task) {
        int scoreChange = TASK_COMPLETION_SCORE;
        String description = String.format("完成任务 #%d", task.getId());

        updateUserScore(user, scoreChange, ScoreHistory.ScoreType.TASK_COMPLETION, description, task, null, null);
    }

    /**
     * 为质量检查奖励积分
     */
    @Transactional
    public void awardQualityBonusScore(User user, QualityCheck qualityCheck) {
        int scoreChange = QUALITY_BONUS_SCORE;
        String description = String.format("质量检查 #%d 通过奖励", qualityCheck.getId());

        updateUserScore(user, scoreChange, ScoreHistory.ScoreType.QUALITY_BONUS, description, null, null, qualityCheck);
    }

    /**
     * 为审核任务奖励积分
     */
    @Transactional
    public void awardReviewBonusScore(User user, QualityCheck qualityCheck) {
        int scoreChange = REVIEW_BONUS_SCORE;
        String description = String.format("审核任务 #%d 完成奖励", qualityCheck.getId());

        updateUserScore(user, scoreChange, ScoreHistory.ScoreType.REVIEW_BONUS, description, null, null, qualityCheck);
    }

    /**
     * 基于准确率奖励积分
     */
    @Transactional
    public void awardAccuracyBonusScore(User user, double accuracyRate, Task task) {
        // 准确率奖励：基础分 * 准确率 * 倍数
        int baseScore = TASK_COMPLETION_SCORE;
        int scoreChange = (int) Math.round(baseScore * accuracyRate * ACCURACY_BONUS_MULTIPLIER);
        String description = String.format("准确率 %.2f%% 奖励积分", accuracyRate * 100);

        updateUserScore(user, scoreChange, ScoreHistory.ScoreType.ACCURACY_BONUS, description, task, null, null);
    }

    /**
     * 质量不合格扣分
     */
    @Transactional
    public void penalizeQualityFailure(User user, QualityCheck qualityCheck) {
        int scoreChange = PENALTY_SCORE;
        String description = String.format("质量检查 #%d 不合格扣分", qualityCheck.getId());

        updateUserScore(user, scoreChange, ScoreHistory.ScoreType.PENALTY, description, null, null, qualityCheck);
    }

    /**
     * 手动调整积分（管理员功能）
     */
    @Transactional
    public void manualScoreAdjustment(User user, int scoreChange, String reason) {
        String description = String.format("管理员手动调整：%s", reason);

        updateUserScore(user, scoreChange, ScoreHistory.ScoreType.MANUAL_ADJUSTMENT, description, null, null, null);
    }

    /**
     * 获取积分排行榜
     */
    @Cacheable(value = "scoreRankings", key = "#limit")
    public List<UserScoreRanking> getScoreRanking(int limit) {
        // 使用优化的查询方法
        List<User> users = userRepository.findAllActiveUsersOrderedByScore(User.Status.ACTIVE);

        return users.stream()
            .limit(limit)
            .map(user -> {
                UserScoreRanking ranking = new UserScoreRanking();
                ranking.setUserId(user.getId());
                ranking.setUsername(user.getUsername());
                ranking.setScore(user.getScore());
                ranking.setRole(user.getRole().toString());
                ranking.setRank(getUserRank(user.getId()));
                return ranking;
            })
            .collect(Collectors.toList());
    }

    /**
     * 获取用户的排名
     */
    @Cacheable(value = "userRanks", key = "#userId")
    public int getUserRank(Long userId) {
        // 使用优化的查询方法获取排名用户列表
        List<User> rankedUsers = userRepository.findAllActiveUsersOrderedByScore(User.Status.ACTIVE);
        for (int i = 0; i < rankedUsers.size(); i++) {
            if (rankedUsers.get(i).getId().equals(userId)) {
                return i + 1;
            }
        }
        return -1;
    }

    /**
     * 获取用户积分历史
     */
    public Page<ScoreHistory> getUserScoreHistory(User user, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return scoreHistoryRepository.findByUserOrderByCreatedAtDesc(user, pageable);
    }

    /**
     * 获取用户积分统计信息
     */
    public UserScoreStats getUserScoreStats(User user) {
        UserScoreStats stats = new UserScoreStats();
        stats.setCurrentScore(user.getScore());
        stats.setTotalEarned(getTotalEarnedScore(user));
        stats.setTotalSpent(0); // 如果有消费积分功能，这里需要计算
        stats.setRank(getUserRank(user.getId()));

        // 计算各类型积分统计
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        stats.setMonthlyScore(getMonthlyScore(user, thirtyDaysAgo));

        return stats;
    }

    /**
     * 私有方法：更新用户积分
     */
    private void updateUserScore(User user, int scoreChange, ScoreHistory.ScoreType scoreType,
                                String description, Task task, Annotation annotation, QualityCheck qualityCheck) {
        int previousScore = user.getScore() != null ? user.getScore() : 0;
        int newScore = previousScore + scoreChange;

        // 更新用户积分
        user.setScore(newScore);
        userRepository.save(user);

        // 创建积分历史记录
        ScoreHistory history = new ScoreHistory(user, scoreChange, previousScore, newScore,
                                              scoreType, description);
        history.setTask(task);
        history.setAnnotation(annotation);
        history.setQualityCheck(qualityCheck);
        scoreHistoryRepository.save(history);
    }

    /**
     * 获取用户总获得积分
     */
    private int getTotalEarnedScore(User user) {
        Integer total = scoreHistoryRepository.sumScoreChangeByUser(user);
        return total != null ? total : 0;
    }

    /**
     * 获取用户月度积分
     */
    private int getMonthlyScore(User user, LocalDateTime startDate) {
        LocalDateTime endDate = LocalDateTime.now();
        Integer total = scoreHistoryRepository.sumScoreChangeByUserAndDateRange(user, startDate, endDate);
        return total != null ? total : 0;
    }

    /**
     * 积分排行榜数据传输对象
     */
    public static class UserScoreRanking {
        private Long userId;
        private String username;
        private Integer score;
        private String role;
        private int rank;

        // Getters and Setters
        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }

        public Integer getScore() { return score; }
        public void setScore(Integer score) { this.score = score; }

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }

        public int getRank() { return rank; }
        public void setRank(int rank) { this.rank = rank; }
    }

    /**
     * 用户积分统计数据传输对象
     */
    public static class UserScoreStats {
        private Integer currentScore;
        private Integer totalEarned;
        private Integer totalSpent;
        private int rank;
        private Integer monthlyScore;

        // Getters and Setters
        public Integer getCurrentScore() { return currentScore; }
        public void setCurrentScore(Integer currentScore) { this.currentScore = currentScore; }

        public Integer getTotalEarned() { return totalEarned; }
        public void setTotalEarned(Integer totalEarned) { this.totalEarned = totalEarned; }

        public Integer getTotalSpent() { return totalSpent; }
        public void setTotalSpent(Integer totalSpent) { this.totalSpent = totalSpent; }

        public int getRank() { return rank; }
        public void setRank(int rank) { this.rank = rank; }

        public Integer getMonthlyScore() { return monthlyScore; }
        public void setMonthlyScore(Integer monthlyScore) { this.monthlyScore = monthlyScore; }
    }
}
