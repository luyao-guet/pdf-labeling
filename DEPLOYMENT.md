# 数据标注平台部署指南

## 📋 目录

- [快速开始](#快速开始)
- [系统要求](#系统要求)
- [Docker部署](#docker部署)
- [手动部署](#手动部署)
- [配置说明](#配置说明)
- [监控和维护](#监控和维护)
- [故障排除](#故障排除)

## 🚀 快速开始

### 使用Docker部署（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd 数据标注

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置数据库密码等敏感信息

# 3. 一键部署
./deploy.sh

# 4. 访问应用
open http://localhost:3000
```

### 手动部署

```bash
# 1. 启动PostgreSQL
# 2. 配置数据库
createdb annotation_platform
createuser annotation_user
# 授予权限...

# 3. 启动后端
cd backend
mvn spring-boot:run

# 4. 启动前端
cd ../frontend
npm install
npm run build
npm run preview
# 或者开发模式: npm run dev
```

## 🖥️ 系统要求

### 最低配置
- **CPU**: 2核心
- **内存**: 4GB RAM
- **磁盘**: 20GB 可用空间
- **网络**: 1Mbps 带宽

### 推荐配置
- **CPU**: 4核心
- **内存**: 8GB RAM
- **磁盘**: 100GB SSD
- **网络**: 10Mbps 带宽

### 软件要求
- **操作系统**: Linux/macOS/Windows
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Java**: 11+ (仅手动部署)
- **Node.js**: 18+ (仅手动部署)
- **PostgreSQL**: 14+ (仅手动部署)

## 🐳 Docker部署

### 环境准备

```bash
# 检查Docker安装
docker --version
docker-compose --version

# 启动Docker服务
# Linux: sudo systemctl start docker
# macOS: Docker Desktop启动
```

### 配置文件

创建 `.env` 文件：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=annotation_platform
DB_USERNAME=annotation_user
DB_PASSWORD=your_secure_password

# JWT配置
JWT_SECRET=your_256_bit_secret_key_here
JWT_EXPIRATION=86400000

# 应用配置
JAVA_OPTS=-Xmx1024m -Xms512m
```

### 部署步骤

```bash
# 1. 构建镜像
docker-compose -p annotation-platform build

# 2. 启动服务
docker-compose -p annotation-platform up -d

# 3. 查看启动状态
docker-compose -p annotation-platform ps

# 4. 查看日志
docker-compose -p annotation-platform logs -f
```

### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| frontend | 3000 | React前端应用 |
| backend | 8080 | Spring Boot后端API |
| db | 5432 | PostgreSQL数据库 |

## 🔧 手动部署

### 数据库设置

```bash
# 安装PostgreSQL
# Ubuntu/Debian:
sudo apt update && sudo apt install postgresql postgresql-contrib

# macOS:
brew install postgresql

# 启动服务
sudo systemctl start postgresql  # Linux
brew services start postgresql  # macOS

# 创建数据库和用户
sudo -u postgres psql
```

```sql
CREATE DATABASE annotation_platform;
CREATE USER annotation_user WITH PASSWORD 'annotation_pass';
GRANT ALL PRIVILEGES ON DATABASE annotation_platform TO annotation_user;
\q
```

### 后端部署

```bash
cd backend

# 编译项目
mvn clean package -DskipTests

# 运行应用
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

### 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 启动生产服务器
npm run preview
# 或者开发服务器
npm run dev
```

## ⚙️ 配置说明

### 应用配置

#### 后端配置 (application.properties)

```properties
# 服务器配置
server.port=8080
server.servlet.context-path=/api

# 数据库配置
spring.datasource.url=jdbc:postgresql://localhost:5432/annotation_platform
spring.datasource.username=annotation_user
spring.datasource.password=annotation_pass

# JWT配置
jwt.secret=mySecretKey1234567890123456789012345678901234567890
jwt.expiration=86400000

# 文件上传
file.upload-dir=./uploads/
spring.servlet.multipart.max-file-size=50MB
```

#### 前端配置 (src/services/api.ts)

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
```

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | 数据库主机 | localhost |
| `DB_PORT` | 数据库端口 | 5432 |
| `DB_NAME` | 数据库名 | annotation_platform |
| `DB_USERNAME` | 数据库用户 | annotation_user |
| `DB_PASSWORD` | 数据库密码 | annotation_pass |
| `JWT_SECRET` | JWT密钥 | - |
| `JWT_EXPIRATION` | JWT过期时间(ms) | 86400000 |
| `JAVA_OPTS` | JVM参数 | -Xmx512m -Xms256m |

## 📊 监控和维护

### 健康检查

```bash
# API健康检查
curl http://localhost:8080/api/

# 数据库连接检查
curl http://localhost:8080/api/tasks/statistics

# Docker容器状态
docker-compose -p annotation-platform ps
```

### 日志查看

```bash
# Docker日志
docker-compose -p annotation-platform logs -f backend
docker-compose -p annotation-platform logs -f frontend

# 应用日志文件
tail -f backend.log
tail -f frontend.log
```

### 备份策略

```bash
# 数据库备份
docker exec annotation-platform_db_1 pg_dump -U annotation_user annotation_platform > backup_$(date +%Y%m%d).sql

# 文件备份
docker cp annotation-platform_backend_1:/app/uploads ./backup/uploads
```

### 更新部署

```bash
# 停止服务
docker-compose -p annotation-platform down

# 拉取最新代码
git pull

# 重新构建和启动
docker-compose -p annotation-platform build --no-cache
docker-compose -p annotation-platform up -d
```

## 🔧 故障排除

### 常见问题

#### 端口占用
```bash
# 检查端口占用
lsof -i :8080
lsof -i :3000
lsof -i :5432

# 杀死进程
kill -9 <PID>
```

#### 数据库连接失败
```bash
# 检查PostgreSQL状态
sudo systemctl status postgresql

# 检查数据库存在
psql -U annotation_user -d annotation_platform -c "SELECT 1;"
```

#### Docker问题
```bash
# 清理Docker资源
docker system prune -a

# 重启Docker服务
sudo systemctl restart docker
```

#### 内存不足
```bash
# 检查系统内存
free -h

# 调整JVM参数
export JAVA_OPTS="-Xmx256m -Xms128m"
```

### 性能优化

#### JVM调优
```bash
JAVA_OPTS="-Xmx1024m -Xms512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

#### 数据库优化
```sql
-- 创建索引
CREATE INDEX idx_task_status ON tasks(status);
CREATE INDEX idx_document_category ON documents(category_id);
CREATE INDEX idx_annotation_task ON annotations(task_id);
```

#### 缓存配置
```properties
# 启用Redis缓存 (可选)
spring.cache.type=redis
spring.redis.host=localhost
spring.redis.port=6379
```

## 📞 支持

如遇到部署问题，请：

1. 查看日志文件获取详细错误信息
2. 检查系统要求是否满足
3. 参考故障排除部分
4. 在GitHub Issues中提交问题

---

**最后更新**: 2025年11月17日
