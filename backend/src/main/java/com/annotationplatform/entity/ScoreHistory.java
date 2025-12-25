package com.annotationplatform.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "score_history")
public class ScoreHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Integer scoreChange;

    @Column(nullable = false)
    private Integer previousScore;

    @Column(nullable = false)
    private Integer newScore;

    @Enumerated(EnumType.STRING)
    @Column(length = 50, nullable = false)
    private ScoreType scoreType;

    @Column(length = 500)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "annotation_id")
    private Annotation annotation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quality_check_id")
    private QualityCheck qualityCheck;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum ScoreType {
        TASK_COMPLETION,      // 任务完成
        QUALITY_BONUS,        // 质量奖励
        REVIEW_BONUS,         // 审核奖励
        ACCURACY_BONUS,       // 准确率奖励
        PENALTY,              // 惩罚扣分
        MANUAL_ADJUSTMENT     // 手动调整
    }

    // Constructors
    public ScoreHistory() {}

    public ScoreHistory(User user, Integer scoreChange, Integer previousScore, Integer newScore,
                       ScoreType scoreType, String description) {
        this.user = user;
        this.scoreChange = scoreChange;
        this.previousScore = previousScore;
        this.newScore = newScore;
        this.scoreType = scoreType;
        this.description = description;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Integer getScoreChange() {
        return scoreChange;
    }

    public void setScoreChange(Integer scoreChange) {
        this.scoreChange = scoreChange;
    }

    public Integer getPreviousScore() {
        return previousScore;
    }

    public void setPreviousScore(Integer previousScore) {
        this.previousScore = previousScore;
    }

    public Integer getNewScore() {
        return newScore;
    }

    public void setNewScore(Integer newScore) {
        this.newScore = newScore;
    }

    public ScoreType getScoreType() {
        return scoreType;
    }

    public void setScoreType(ScoreType scoreType) {
        this.scoreType = scoreType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Annotation getAnnotation() {
        return annotation;
    }

    public void setAnnotation(Annotation annotation) {
        this.annotation = annotation;
    }

    public QualityCheck getQualityCheck() {
        return qualityCheck;
    }

    public void setQualityCheck(QualityCheck qualityCheck) {
        this.qualityCheck = qualityCheck;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}





