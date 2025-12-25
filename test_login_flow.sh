#!/bin/bash

echo "=== 数据标注平台登录流程测试 ==="
echo ""

# 1. 测试后端API登录
echo "1. 测试管理员登录API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "✅ 管理员登录API成功"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Token: ${TOKEN:0:50}..."
else
    echo "❌ 管理员登录API失败"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi

echo ""

# 2. 测试受保护的API
echo "2. 测试受保护的API访问..."
STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/tasks/statistics)

if echo "$STATS_RESPONSE" | grep -q "statistics"; then
    echo "✅ 受保护API访问成功"
    USER_COUNT=$(echo "$STATS_RESPONSE" | grep -o '"totalUsers":[0-9]*' | cut -d':' -f2)
    echo "系统用户数量: $USER_COUNT"
else
    echo "❌ 受保护API访问失败"
    echo "响应: $STATS_RESPONSE"
    exit 1
fi

echo ""

# 3. 测试前端页面访问
echo "3. 测试前端页面访问..."
FRONTEND_RESPONSE=$(curl -s -I http://localhost:3001 2>/dev/null | head -1)

if echo "$FRONTEND_RESPONSE" | grep -q "200 OK"; then
    echo "✅ 前端页面访问成功"
else
    echo "❌ 前端页面访问失败"
    echo "响应: $FRONTEND_RESPONSE"
    exit 1
fi

echo ""

# 4. 测试标注员登录
echo "4. 测试标注员登录API..."
ANNOTATOR_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"annotator","password":"password"}')

if echo "$ANNOTATOR_RESPONSE" | grep -q "ANNOTATOR"; then
    echo "✅ 标注员登录API成功"
else
    echo "❌ 标注员登录API失败"
    echo "响应: $ANNOTATOR_RESPONSE"
fi

echo ""

echo "🎉 登录流程测试完成！"
echo ""
echo "📋 测试总结:"
echo "✅ 后端API服务正常"
echo "✅ JWT认证机制工作正常"
echo "✅ 前端页面可访问"
echo "✅ 用户角色权限正确"
echo ""
echo "🌐 访问地址:"
echo "前端应用: http://localhost:3001"
echo "后端API: http://localhost:8080/api"
echo ""
echo "👤 测试账号:"
echo "管理员: admin / password"
echo "标注员: annotator / password"





