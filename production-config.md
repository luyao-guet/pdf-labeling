# 生产环境配置指南

## 环境变量配置

创建 `.env` 文件并配置以下环境变量：

```bash
# 数据库配置
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=annotation_platform
DB_USERNAME=your-db-username
DB_PASSWORD=your-db-password

# JWT配置
JWT_SECRET=your-256-bit-secret-key-here
JWT_EXPIRATION=86400000

# CORS配置
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

# 应用配置
SPRING_PROFILES_ACTIVE=docker
JAVA_OPTS=-Xmx1024m -Xms512m

# 文件上传配置
FILE_UPLOAD_DIR=/app/uploads/

# 日志配置
LOG_LEVEL=com.annotationplatform=INFO
LOG_LEVEL_SPRING=WARN
```

## Docker部署配置

### 使用Docker Compose部署

1. 确保已安装Docker和Docker Compose
2. 配置环境变量文件
3. 运行部署脚本：

```bash
./deploy.sh
```

### 手动Docker部署

```bash
# 构建镜像
docker-compose -p annotation-platform build

# 启动服务
docker-compose -p annotation-platform up -d

# 查看日志
docker-compose -p annotation-platform logs -f

# 停止服务
docker-compose -p annotation-platform down
```

## 数据库配置

### PostgreSQL设置

```sql
-- 创建数据库
CREATE DATABASE annotation_platform;

-- 创建用户
CREATE USER annotation_user WITH PASSWORD 'annotation_pass';

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE annotation_platform TO annotation_user;
```

### 数据库迁移

应用启动时会自动创建表结构，无需手动迁移。

## 安全配置

### JWT密钥生成

```bash
# 生成256位密钥
openssl rand -hex 32
```

### HTTPS配置

推荐在生产环境中使用反向代理（如Nginx）配置HTTPS：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 监控和日志

### 日志配置

- 应用日志输出到控制台和文件
- 数据库慢查询日志可通过PostgreSQL配置启用
- 建议使用ELK Stack进行日志聚合和分析

### 健康检查

```bash
# API健康检查
curl http://localhost:8080/api/

# 数据库连接检查
curl http://localhost:8080/api/tasks/statistics
```

## 备份策略

### 数据库备份

```bash
# 每日备份脚本
pg_dump -h localhost -U annotation_user annotation_platform > backup_$(date +%Y%m%d).sql
```

### 文件备份

上传的文件需要定期备份到云存储或NAS设备。

## 性能优化

### JVM调优

```bash
JAVA_OPTS="-Xmx1024m -Xms512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

### 数据库优化

- 为常用查询字段创建索引
- 配置连接池参数
- 启用查询缓存

### 缓存配置

应用已配置Spring Cache，可根据需要调整缓存策略。
