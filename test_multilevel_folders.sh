#!/bin/bash

echo "测试多级文件夹创建功能"

# 等待服务启动
echo "等待服务启动..."
sleep 10

# 测试登录
echo "测试登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "登录失败，无法获取token"
    exit 1
fi

echo "登录成功，获取到token"

# 测试创建多级文件夹
echo "测试创建多级文件夹 '项目A/子项目B/任务C'..."

CREATE_RESPONSE=$(curl -s -X POST http://localhost:8080/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"项目A/子项目B/任务C","description":"测试多级文件夹创建"}')

echo "创建响应: $CREATE_RESPONSE"

# 检查是否创建成功
if echo "$CREATE_RESPONSE" | grep -q "成功"; then
    echo "✅ 多级文件夹创建成功"
else
    echo "❌ 多级文件夹创建失败"
fi

# 测试获取文件夹列表
echo "测试获取文件夹列表..."
LIST_RESPONSE=$(curl -s http://localhost:8080/api/categories \
  -H "Authorization: Bearer $TOKEN")

echo "文件夹列表响应长度: ${#LIST_RESPONSE}"

# 检查是否包含新创建的文件夹
if echo "$LIST_RESPONSE" | grep -q "项目A" && echo "$LIST_RESPONSE" | grep -q "子项目B" && echo "$LIST_RESPONSE" | grep -q "任务C"; then
    echo "✅ 文件夹树结构正确"
else
    echo "❌ 文件夹树结构不正确"
    echo "响应内容: $LIST_RESPONSE"
fi

echo "测试完成"
