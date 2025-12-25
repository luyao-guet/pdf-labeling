#!/bin/bash

echo "=== 前端PDF加载问题诊断 ==="
echo ""

# 1. 获取token
echo "1. 获取管理员token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
ROLE=$(echo "$LOGIN_RESPONSE" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "   ✅ Token获取成功"
    echo "   📋 角色: $ROLE"
    echo "   🔑 Token长度: ${#TOKEN} 字符"
else
    echo "   ❌ Token获取失败"
    exit 1
fi

echo ""

# 2. 测试后端PDF下载API
echo "2. 测试后端PDF下载API..."
PDF_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/pdf,*/*" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  http://localhost:8080/api/documents/1/download)

HTTP_STATUS=$(echo "$PDF_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
CONTENT=$(echo "$PDF_RESPONSE" | grep -v "HTTP_STATUS:")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ 后端API正常 (HTTP $HTTP_STATUS)"
    echo "   📄 响应长度: ${#CONTENT} 字节"
else
    echo "   ❌ 后端API失败 (HTTP $HTTP_STATUS)"
    echo "   📄 响应内容: $CONTENT"
fi

echo ""

# 3. 模拟前端请求（使用完整URL）
echo "3. 模拟前端PDF请求..."
FRONTEND_PDF_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/pdf,*/*" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  "http://localhost:3000/api/documents/1/download")

FRONTEND_HTTP_STATUS=$(echo "$FRONTEND_PDF_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$FRONTEND_HTTP_STATUS" = "200" ]; then
    echo "   ✅ 前端代理正常 (HTTP $FRONTEND_HTTP_STATUS)"
else
    echo "   ❌ 前端代理失败 (HTTP $FRONTEND_HTTP_STATUS)"
    echo "   📄 响应内容: $(echo "$FRONTEND_PDF_RESPONSE" | grep -v "HTTP_STATUS:")"
fi

echo ""

# 4. 检查前端页面访问
echo "4. 检查前端页面访问..."
FRONTEND_PAGE=$(curl -s -I http://localhost:3000 | head -1)

if echo "$FRONTEND_PAGE" | grep -q "200 OK"; then
    echo "   ✅ 前端页面可访问"
else
    echo "   ❌ 前端页面不可访问"
    echo "   📄 响应: $FRONTEND_PAGE"
fi

echo ""

echo "🎯 诊断结果:"
echo "如果后端API返回200但前端代理返回403，则问题在于前端代理配置"
echo "如果两个都返回200，则问题在于前端JavaScript代码"
echo ""
echo "🔧 建议解决方案:"
echo "1. 清除浏览器缓存重新登录"
echo "2. 检查浏览器Network面板的PDF请求"
echo "3. 确认token在localStorage中正确存储"
echo ""
echo "📊 当前状态:"
echo "后端API: $([ "$HTTP_STATUS" = "200" ] && echo "✅ 正常" || echo "❌ 异常")"
echo "前端代理: $([ "$FRONTEND_HTTP_STATUS" = "200" ] && echo "✅ 正常" || echo "❌ 异常")"
echo "前端页面: $(echo "$FRONTEND_PAGE" | grep -q "200 OK" && echo "✅ 正常" || echo "❌ 异常")"





