# 数据持久化说明

## 概述

系统已配置为使用持久化数据库存储，确保所有上传的文件和元数据在服务重启后仍然保留。

## 数据库配置

### 开发环境（application.properties）

- **数据库类型**: H2 文件数据库
- **数据库路径**: `./data/annotationdb.mv.db`
- **持久化**: 数据存储在本地文件中，服务重启后数据不会丢失

### 生产环境（application-docker.properties）

- **数据库类型**: PostgreSQL
- **数据卷**: Docker volume `postgres_data`
- **持久化**: 数据存储在 Docker volume 中，容器重启后数据保留

## 数据存储位置

### 数据库文件
- **开发环境**: `backend/data/annotationdb.mv.db`
- **生产环境**: Docker volume `postgres_data`

### 上传文件
- **开发环境**: `backend/uploads/documents/`
- **生产环境**: `./backend/uploads` (映射到容器内的 `/app/uploads/`)

## 数据持久化保证

### 1. 事务管理
- 所有文件上传操作使用 `@Transactional` 注解
- 如果数据库保存失败，已保存的文件会被自动清理
- 确保文件系统和数据库的一致性

### 2. 立即持久化
- 使用 `documentRepository.flush()` 确保数据立即写入数据库
- 文件路径使用绝对路径存储，避免路径问题

### 3. 数据完整性
- 所有文档记录包含：
  - 文件名和原始文件名
  - 文件路径（绝对路径）
  - 文件大小和类型
  - 校验和（用于重复检测）
  - 文件夹关联
  - 分类关联
  - 上传用户信息
  - 创建和更新时间

## 备份建议

### 开发环境
1. 定期备份 `backend/data/annotationdb.mv.db` 文件
2. 定期备份 `backend/uploads/documents/` 目录

### 生产环境
1. 定期备份 PostgreSQL 数据库
2. 定期备份上传文件目录
3. 使用 Docker volume 备份工具

## 数据迁移

如果需要从开发环境迁移到生产环境：

1. **数据库迁移**:
   ```bash
   # 导出 H2 数据
   # 导入到 PostgreSQL
   ```

2. **文件迁移**:
   ```bash
   # 复制 uploads 目录到生产环境
   ```

## 故障恢复

如果数据库文件损坏：

1. 从备份恢复数据库文件
2. 检查文件系统中的文件是否完整
3. 运行数据一致性检查脚本（如需要）

## 注意事项

- **不要删除** `backend/data/` 目录，这会导致数据丢失
- **不要删除** `backend/uploads/` 目录，这会导致文件丢失
- 定期备份重要数据
- 在生产环境中使用 PostgreSQL 而不是 H2

