#!/bin/bash

echo "🚀 部署数据标注平台 (Docker版本)..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动Docker"
    exit 1
fi

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose -p annotation-platform down

# 构建镜像
echo "🏗️ 构建Docker镜像..."
docker-compose -p annotation-platform build --no-cache

# 启动服务
echo "🚀 启动服务..."
docker-compose -p annotation-platform up -d

# 等待服务启动
echo "⏳ 等待服务完全启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
if docker-compose -p annotation-platform ps | grep -q "Up"; then
    echo "✅ 服务启动成功!"
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
    echo "🛑 停止服务: docker-compose -p annotation-platform down"
    echo "📄 查看日志: docker-compose -p annotation-platform logs -f"
else
    echo "❌ 服务启动失败!"
    echo "查看日志: docker-compose -p annotation-platform logs"
    exit 1
fi
