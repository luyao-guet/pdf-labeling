package com.annotationplatform.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        // 使用简单的内存缓存管理器
        // 在生产环境中，可以考虑使用Redis等分布式缓存
        ConcurrentMapCacheManager cacheManager = new ConcurrentMapCacheManager(
            "categories",
            "formConfigs",
            "userStats",
            "scoreRankings",
            "taskStats"
        );
        return cacheManager;
    }
}





