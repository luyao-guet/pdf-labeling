#!/bin/bash

echo "=== PDF预览认证问题修复验证 ==="
echo ""

# 1. 测试登录和token获取
echo "1. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "   ✅ 管理员登录成功"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    echo "   📋 用户ID: $USER_ID"
else
    echo "   ❌ 登录失败"
    exit 1
fi

echo ""

# 2. 测试API访问权限
echo "2. 测试API访问权限..."
STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/tasks/statistics)

if echo "$STATS_RESPONSE" | grep -q "statistics"; then
    echo "   ✅ API访问正常"
else
    echo "   ❌ API访问失败"
    echo "响应: $STATS_RESPONSE"
    exit 1
fi

echo ""

# 3. 测试PDF下载权限
echo "3. 测试PDF下载权限..."
PDF_RESPONSE=$(curl -s -I -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/documents/1/download | head -1)

if echo "$PDF_RESPONSE" | grep -q "200 OK"; then
    echo "   ✅ PDF下载权限正常"
else
    echo "   ❌ PDF下载权限不足"
    echo "响应: $PDF_RESPONSE"
    exit 1
fi

echo ""

# 4. 测试前端页面访问
echo "4. 测试前端页面访问..."
FRONTEND_RESPONSE=$(curl -s -I http://localhost:3000 | head -1)

if echo "$FRONTEND_RESPONSE" | grep -q "200 OK"; then
    echo "   ✅ 前端页面正常"
else
    echo "   ❌ 前端页面异常"
    echo "响应: $FRONTEND_RESPONSE"
fi

echo ""

echo "🎉 PDF预览认证问题修复验证完成！"
echo ""
echo "📋 修复内容:"
echo "1. ✅ 使用Redux store检查认证状态"
echo "2. ✅ 改进token获取和错误处理逻辑"
echo "3. ✅ 添加详细的错误信息和调试日志"
echo "4. ✅ 优化认证失败时的用户体验"
echo "5. ✅ 添加Content-Type检查确保返回PDF格式"
echo ""
echo "🧪 测试步骤:"
echo "1. 打开浏览器访问: http://localhost:3000"
echo "2. 登录管理员账号 (admin/password)"
echo "3. 进入文件管理页面"
echo "4. 点击PDF文件的预览按钮"
echo "5. 应该能正常显示PDF，不会被重定向到登录页"
echo ""
echo "🔍 如果仍有问题，请检查浏览器控制台的日志信息"





