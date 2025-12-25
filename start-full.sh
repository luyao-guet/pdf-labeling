#!/bin/bash

echo "🚀 启动数据AI自动化处理审核平台 (前后端完整版)..."

# 检查Java环境
if ! command -v java &> /dev/null; then
    echo "❌ Java 未安装，请先安装 Java 11"
    exit 1
fi

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL 未安装，请确保数据库服务正在运行"
fi

echo "📡 启动后端服务..."
cd backend
mvn spring-boot:run > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   后端PID: $BACKEND_PID"
cd ..

echo "🌐 启动前端服务..."
cd frontend

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   前端PID: $FRONTEND_PID"
cd ..

echo ""
echo "🎉 服务启动完成!"
echo ""
echo "📋 服务信息:"
echo "   前端应用: http://localhost:3000"
echo "   后端API:  http://localhost:8080/api"
echo "   数据库:   PostgreSQL (localhost:5432)"
echo ""
echo "👤 测试账号:"
echo "   管理员: admin / password"
echo "   标注员: annotator / password"
echo ""
echo "🛑 停止服务: ./stop.sh"
echo "📄 查看日志: tail -f backend.log 或 tail -f frontend.log"
echo ""

# 保存进程ID
echo "$BACKEND_PID" > .backend_pid
echo "$FRONTEND_PID" > .frontend_pid

# 等待服务启动
echo "⏳ 等待服务完全启动..."
sleep 10

# 验证服务状态
echo "🔍 验证服务状态..."
if curl -s http://localhost:8080/api/ > /dev/null; then
    echo "✅ 后端服务正常"
else
    echo "❌ 后端服务异常"
fi

if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务正常"
else
    echo "❌ 前端服务异常"
fi

echo ""
echo "🎯 现在可以打开浏览器访问 http://localhost:3000 开始使用!"
