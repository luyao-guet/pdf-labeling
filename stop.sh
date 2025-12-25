#!/bin/bash

echo "🛑 停止数据AI自动化处理审核平台服务..."

# 停止后端服务
if [ -f .backend_pid ]; then
    BACKEND_PID=$(cat .backend_pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "停止后端服务 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        rm .backend_pid
        echo "✅ 后端服务已停止"
    else
        echo "⚠️  后端服务已经停止"
        rm .backend_pid
    fi
else
    echo "⚠️  未找到后端服务PID文件"
fi

# 停止前端服务
if [ -f .frontend_pid ]; then
    FRONTEND_PID=$(cat .frontend_pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "停止前端服务 (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        rm .frontend_pid
        echo "✅ 前端服务已停止"
    else
        echo "⚠️  前端服务已经停止"
        rm .frontend_pid
    fi
else
    echo "⚠️  未找到前端服务PID文件"
fi

# 强制停止所有相关进程
echo "🔍 检查并清理残留进程..."
pkill -f "spring-boot:run" 2>/dev/null && echo "清理了Spring Boot进程"
pkill -f "npm run dev" 2>/dev/null && echo "清理了npm进程"

echo "🎉 所有服务已停止!"
