#!/bin/bash

echo "🚀 启动数据AI自动化处理审核平台..."

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装，请先安装 npm"
    exit 1
fi

# 进入前端目录
cd frontend

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 启动开发服务器
echo "🌐 启动前端开发服务器..."
echo "📱 应用将在 http://localhost:3000 运行"
echo "🛑 按 Ctrl+C 停止服务器"
echo ""

npm run dev
