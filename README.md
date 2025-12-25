# 数据AI自动化处理审核平台

一个基于 **Vue3 + Spring Boot + MySQL** 的企业级数据标注平台，支持大规模PDF文档管理、多用户协作标注、质量控制、积分评价和深度统计分析。

## 🚀 快速开始

### 环境要求
- **Java 11+** (推荐使用 OpenJDK 11)
- **Node.js 18+**
- **MySQL 8.0+**
- **Maven 3.6+**

### Docker Compose 一键部署
```bash
# 启动所有服务（MySQL + 后端 + 前端）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 本地开发启动
```bash
# 1. 启动 MySQL 数据库
docker run -d --name mysql-annotation \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=annotation_platform \
  -p 3306:3306 mysql:8.0

# 2. 启动后端
cd backend
mvn spring-boot:run

# 3. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

### 访问应用
- **前端应用**: http://localhost:3000
- **后端API**: http://localhost:8080/api

### 测试账号
- **管理员**: `admin` / `password`
- **标注员**: `annotator` / `password`
- **审核员**: `reviewer` / `password`
- **专家**: `expert` / `password`

## 🛠️ 技术栈

### 前端 (Vue3)
- **Vue 3.4** - 渐进式 JavaScript 框架
- **TypeScript** - 类型安全
- **Element Plus** - UI 组件库
- **Pinia** - 状态管理
- **Vue Router 4** - 路由管理
- **Axios** - HTTP 客户端
- **Vite 5** - 构建工具
- **ECharts** - 图表可视化

### 后端 (Spring Boot)
- **Spring Boot 2.7** - Java 框架
- **MySQL 8.0** - 关系型数据库
- **Spring Security** - 安全框架
- **JWT** - 无状态认证
- **Spring Data JPA** - 数据访问
- **Maven** - 项目管理
- **Docker** - 容器化部署

## 📁 项目结构

```
数据标注/
├── frontend/                 # Vue3 前端应用
│   ├── src/
│   │   ├── api/             # API 服务层
│   │   ├── components/      # 公共组件
│   │   ├── layouts/         # 布局组件
│   │   ├── pages/           # 页面组件 (13个)
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # Pinia 状态管理
│   │   └── types/           # TypeScript 类型
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Spring Boot 后端
│   ├── src/main/java/com/annotationplatform/
│   │   ├── controller/      # REST 控制器
│   │   ├── entity/          # JPA 实体
│   │   ├── repository/      # 数据仓库
│   │   ├── service/         # 业务服务
│   │   └── config/          # 配置类
│   └── pom.xml
├── docker-compose.yml        # Docker 编排文件
└── README.md
```

## 📋 功能特性

### ✅ 核心功能
- [x] 用户认证和 JWT 授权
- [x] 角色权限管理 (管理员/标注员/审核员/专家)
- [x] 文件上传和管理
- [x] 文件夹组织结构
- [x] PDF 文档预览
- [x] 任务创建和分配
- [x] 动态表单标注工作台
- [x] 质量审核系统
- [x] 积分评价系统
- [x] 统计分析仪表板
- [x] 表单设计器

## 🔧 开发命令

### 前端开发
```bash
cd frontend
npm install          # 安装依赖
npm run dev         # 启动开发服务器 (端口 3000)
npm run build       # 构建生产版本
npm run preview     # 预览构建结果
```

### 后端开发
```bash
cd backend
mvn clean compile   # 编译项目
mvn spring-boot:run # 启动应用 (端口 8080)
mvn test           # 运行测试
mvn package        # 打包 JAR
```

## 📋 API 接口

### 认证
```bash
POST /api/auth/login          # 用户登录
POST /api/auth/register       # 用户注册
```

### 文档管理
```bash
GET    /api/documents         # 获取文档列表
POST   /api/documents/upload  # 上传文档
DELETE /api/documents/{id}    # 删除文档
GET    /api/documents/{id}/preview  # 预览文档
```

### 任务管理
```bash
GET    /api/tasks             # 获取任务列表
POST   /api/tasks             # 创建任务
POST   /api/tasks/batch       # 批量创建任务
GET    /api/tasks/my-tasks    # 获取我的任务
POST   /api/tasks/{id}/assign # 分配任务
```

### 标注
```bash
POST   /api/annotations       # 提交标注
POST   /api/annotations/draft # 保存草稿
GET    /api/annotations/task/{taskId}  # 获取任务标注
```

## 🚀 部署说明

### Docker Compose 部署 (推荐)
```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend

# 停止并删除容器
docker-compose down

# 删除数据卷（谨慎操作）
docker-compose down -v
```

### 手动部署
```bash
# 1. 构建前端
cd frontend && npm run build

# 2. 构建后端
cd ../backend && mvn clean package -DskipTests

# 3. 运行
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

## 📞 联系方式

项目维护者 - [your-email@example.com]

---

**当前版本**: v2.0.0 (Vue3 + MySQL 迁移版本)  
**最后更新**: 2025年12月25日
