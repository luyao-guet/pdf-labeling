package com.annotationplatform.repository;

import com.annotationplatform.entity.ScoreHistory;
import com.annotationplatform.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ScoreHistoryRepository extends JpaRepository<ScoreHistory, Long> {

    // 查找用户的积分历史记录
    Page<ScoreHistory> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);

    // 查找用户在指定时间范围内的积分历史
    List<ScoreHistory> findByUserAndCreatedAtBetweenOrderByCreatedAtDesc(
        User user, LocalDateTime startDate, LocalDateTime endDate);

    // 统计用户积分变化的总和
    @Query("SELECT COALESCE(SUM(s.scoreChange), 0) FROM ScoreHistory s WHERE s.user = :user")
    Integer sumScoreChangeByUser(@Param("user") User user);

    // 统计用户在指定时间范围内的积分变化
    @Query("SELECT COALESCE(SUM(s.scoreChange), 0) FROM ScoreHistory s WHERE s.user = :user AND s.createdAt BETWEEN :startDate AND :endDate")
    Integer sumScoreChangeByUserAndDateRange(@Param("user") User user,
                                             @Param("startDate") LocalDateTime startDate,
                                             @Param("endDate") LocalDateTime endDate);

    // 查找指定类型的积分记录
    List<ScoreHistory> findByScoreTypeOrderByCreatedAtDesc(ScoreHistory.ScoreType scoreType);

    // 查找用户指定类型的积分记录
    List<ScoreHistory> findByUserAndScoreTypeOrderByCreatedAtDesc(User user, ScoreHistory.ScoreType scoreType);
}




