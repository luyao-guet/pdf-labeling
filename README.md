# 数据标注平台

一个基于 React + Spring Boot 的企业级数据标注平台，支持大规模PDF文档管理、多用户协作标注、质量控制、积分评价和深度统计分析。

## 🚀 快速开始

### 环境要求
- **Java 11** (推荐使用 OpenJDK 11)
- **Node.js 18+**
- **PostgreSQL 14+**
- **Maven 3.6+**

### 一键启动
```bash
# 克隆项目 (如果需要)
# git clone <repository-url>
# cd 数据标注

# 启动完整应用 (前后端)
./start-full.sh

# 或者分别启动
./start.sh          # 只启动前端
# 手动启动后端: cd backend && mvn spring-boot:run
```

### 访问应用
- **前端应用**: http://localhost:3000
- **后端API**: http://localhost:8080/api

### 测试账号
- **管理员**: `admin` / `password`
- **标注员**: `annotator` / `password`
- **检查员**: `reviewer` / `password`
- **专家**: `expert` / `password`

### 支持功能
- 📁 **文件管理** - PDF上传、分类管理、文档预览
- 📝 **标注工作台** - 动态表单、任务分配、质量控制
- 👥 **用户管理** - 角色权限、多用户协作
- 📊 **统计分析** - 图表可视化、深度报告
- 🏆 **积分系统** - 自动评分、排行榜展示
- 🎨 **表单设计器** - 拖拽设计、字段配置 (管理员)

## 📁 项目结构

```
数据标注/
├── frontend/                 # React前端应用
│   ├── src/
│   │   ├── components/       # 公共组件
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API服务层
│   │   └── store/           # Redux状态管理
│   └── package.json
├── backend/                  # Spring Boot后端
│   ├── src/main/java/com/annotationplatform/
│   │   ├── controller/      # REST控制器
│   │   ├── entity/          # JPA实体
│   │   ├── repository/      # 数据仓库
│   │   ├── service/         # 业务服务
│   │   ├── config/          # 配置类
│   │   └── utils/           # 工具类
│   └── pom.xml
├── system_design.md         # 系统设计文档
├── phase1_completion_report.md    # 第一阶段报告
├── phase2_completion_report.md    # 第二阶段报告
├── phase3_completion_report.md    # 第三阶段报告
├── phase4_completion_report.md    # 第四阶段报告
├── phase5_completion_report.md    # 第五阶段报告
├── project_status_summary.md      # 项目状态总结
├── start.sh                  # 前端启动脚本
├── start-full.sh             # 完整应用启动脚本
└── stop.sh                   # 停止脚本
```

## 🛠️ 技术栈

### 前端
- **React 18** - 用户界面框架
- **TypeScript** - 类型安全
- **Ant Design** - UI组件库
- **Redux Toolkit** - 状态管理
- **React Router** - 路由管理
- **Axios** - HTTP客户端
- **Vite** - 构建工具
- **ECharts** - 图表可视化 ⭐
- **@hello-pangea/dnd** - 拖拽功能 ⭐

### 后端
- **Spring Boot 2.7** - Java框架
- **PostgreSQL** - 数据库
- **Spring Security** - 安全框架
- **JWT** - 无状态认证
- **Spring Data JPA** - 数据访问
- **Spring Cache** - 缓存管理 ⭐
- **Maven** - 项目管理

## 🔧 开发命令

### 前端开发
```bash
cd frontend
npm install          # 安装依赖
npm run dev         # 启动开发服务器
npm run build       # 构建生产版本
npm run lint        # 代码检查
```

### 后端开发
```bash
cd backend
mvn clean compile   # 编译项目
mvn spring-boot:run # 启动应用
mvn test           # 运行测试
```

### 数据库管理
```bash
# 连接数据库
psql -d annotation_platform

# 查看用户表
SELECT * FROM users;

# 重置数据
DROP TABLE users;
# 然后重启应用重新创建表
```

## 📋 API文档

### 认证接口
```bash
# 用户登录
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

### 新增高级功能API
```bash
# 积分排行榜
GET /api/scores/ranking
GET /api/scores/stats
GET /api/scores/history

# 表单配置
GET /api/form-configs
POST /api/form-configs
GET /api/form-configs/{id}
PUT /api/form-configs/{id}
GET /api/form-configs/{id}/fields
POST /api/form-configs/{id}/fields

# 统计分析
GET /api/tasks/statistics
GET /api/tasks/user-performance
```

### 测试接口
```bash
# 公开测试接口
GET /api/test/all

# 需要认证的接口
GET /api/test/user
Authorization: Bearer <jwt-token>
```

## 🎯 功能特性

### ✅ 已实现功能
- [x] 用户认证和JWT授权
- [x] 角色权限管理 (管理员/标注员/检查员/专家)
- [x] 响应式前端界面
- [x] PostgreSQL数据库集成
- [x] RESTful API设计
- [x] 文件上传和管理
- [x] PDF文档预览
- [x] 智能任务分配算法
- [x] 动态表单标注工作台
- [x] 双人标注质量控制
- [x] 工作流自动化引擎
- [x] **积分评价系统** ⭐
- [x] **深度统计分析** ⭐
- [x] **可视化表单设计器** ⭐
- [x] **性能优化** ⭐

### 🔄 开发中功能
- [ ] 集成测试和端到端测试
- [ ] Docker容器化部署
- [ ] 生产环境监控

## 🚀 部署说明

### 生产环境部署
```bash
# 1. 构建前端
cd frontend && npm run build

# 2. 构建后端
cd ../backend && mvn clean package -DskipTests

# 3. 配置生产数据库
# 修改 application.properties 中的数据库配置

# 4. 启动应用
java -jar backend/target/backend-0.0.1-SNAPSHOT.jar
```

### Docker部署 (可选)
```bash
# 构建镜像
docker build -t annotation-platform .

# 运行容器
docker run -p 8080:8080 -p 3000:3000 annotation-platform
```

## 🤝 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

项目维护者 - [your-email@example.com]

项目链接: [https://github.com/your-username/annotation-platform](https://github.com/your-username/annotation-platform)

---

## 🎉 感谢

感谢所有为这个项目做出贡献的开发者！

**当前版本**: v1.0.0 (第六阶段完成 - 生产就绪)
**最后更新**: 2025年11月17日
