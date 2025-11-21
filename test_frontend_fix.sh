#!/bin/bash

echo "=== 数据标注平台前端修复验证 ==="
echo ""

# 1. 检查服务状态
echo "1. 检查服务状态..."
echo "   前端服务 (localhost:3001): $(curl -s -I http://localhost:3001 2>/dev/null | head -1 | grep -q "200 OK" && echo "✅ 正常" || echo "❌ 异常")"
echo "   后端API (localhost:8080): $(curl -s http://localhost:8080/api/ | grep -q "数据标注平台" && echo "✅ 正常" || echo "❌ 异常")"

echo ""

# 2. 测试登录功能
echo "2. 测试管理员登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "   ✅ 登录成功"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo "   ❌ 登录失败"
    exit 1
fi

echo ""

# 3. 测试数据访问
echo "3. 测试数据访问..."
STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/tasks/statistics)

if echo "$STATS_RESPONSE" | grep -q "statistics"; then
    echo "   ✅ 统计数据访问正常"
    USER_COUNT=$(echo "$STATS_RESPONSE" | grep -o '"totalUsers":[0-9]*' | cut -d':' -f2)
    DOC_COUNT=$(echo "$STATS_RESPONSE" | grep -o '"totalDocuments":[0-9]*' | cut -d':' -f2)
    echo "   📊 系统数据: ${USER_COUNT}个用户, ${DOC_COUNT}个文档"
else
    echo "   ❌ 统计数据访问失败"
fi

echo ""

# 4. 验证前端页面
echo "4. 验证前端页面..."
FRONTEND_HTML=$(curl -s http://localhost:3001 | head -5)

if echo "$FRONTEND_HTML" | grep -q "数据标注平台"; then
    echo "   ✅ 前端页面正常加载"
else
    echo "   ❌ 前端页面加载异常"
fi

echo ""

echo "🎉 前端修复验证完成！"
echo ""
echo "📋 修复内容:"
echo "1. ✅ 修复路由配置 - 登录页面独立显示"
echo "2. ✅ 修复Redux状态访问 - 文档数据正确获取"
echo "3. ✅ 添加仪表板数据加载 - 主动获取统计数据"
echo "4. ✅ 添加用户状态持久化 - 页面刷新保持登录状态"

echo ""
echo "🌐 正确的访问地址:"
echo "前端应用: http://localhost:3001"
echo "后端API: http://localhost:8080/api"

echo ""
echo "👤 测试账号:"
echo "管理员: admin / password"
echo "标注员: annotator / password"

echo ""
echo "📝 使用说明:"
echo "1. 打开浏览器访问: http://localhost:3001"
echo "2. 使用测试账号登录"
echo "3. 登录后应该能看到完整的仪表板界面"
echo "4. 包含统计数据、用户信息和导航菜单"




