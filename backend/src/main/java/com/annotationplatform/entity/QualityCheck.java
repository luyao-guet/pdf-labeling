package com.annotationplatform.entity;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "quality_checks")
public class QualityCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "annotator_a_id")
    private User annotatorA;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "annotator_b_id")
    private User annotatorB;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "annotation_a_id")
    private Annotation annotationA;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "annotation_b_id")
    private Annotation annotationB;

    @Enumerated(EnumType.STRING)
    @Column(name = "comparison_result")
    private ComparisonResult comparisonResult;

    @Column(name = "conflict_fields", columnDefinition = "JSONB")
    private String conflictFields; // JSON string

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private QualityCheckStatus status = QualityCheckStatus.PENDING;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ComparisonResult {
        MATCH, PARTIAL_MATCH, CONFLICT
    }

    public enum QualityCheckStatus {
        PENDING, RESOLVED, ESCALATED
    }

    // Constructors
    public QualityCheck() {}

    public QualityCheck(Task task, User annotatorA, User annotatorB) {
        this.task = task;
        this.annotatorA = annotatorA;
        this.annotatorB = annotatorB;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public User getAnnotatorA() {
        return annotatorA;
    }

    public void setAnnotatorA(User annotatorA) {
        this.annotatorA = annotatorA;
    }

    public User getAnnotatorB() {
        return annotatorB;
    }

    public void setAnnotatorB(User annotatorB) {
        this.annotatorB = annotatorB;
    }

    public Annotation getAnnotationA() {
        return annotationA;
    }

    public void setAnnotationA(Annotation annotationA) {
        this.annotationA = annotationA;
    }

    public Annotation getAnnotationB() {
        return annotationB;
    }

    public void setAnnotationB(Annotation annotationB) {
        this.annotationB = annotationB;
    }

    public ComparisonResult getComparisonResult() {
        return comparisonResult;
    }

    public void setComparisonResult(ComparisonResult comparisonResult) {
        this.comparisonResult = comparisonResult;
    }

    public String getConflictFields() {
        return conflictFields;
    }

    public void setConflictFields(String conflictFields) {
        this.conflictFields = conflictFields;
    }

    public User getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(User resolvedBy) {
        this.resolvedBy = resolvedBy;
    }

    public String getResolutionNotes() {
        return resolutionNotes;
    }

    public void setResolutionNotes(String resolutionNotes) {
        this.resolutionNotes = resolutionNotes;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(LocalDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public QualityCheckStatus getStatus() {
        return status;
    }

    public void setStatus(QualityCheckStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}





