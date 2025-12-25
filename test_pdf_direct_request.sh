#!/bin/bash

echo "=== PDFViewer直接请求后端修复验证 ==="
echo ""

# 1. 获取token
echo "1. 获取管理员token..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "   ✅ Token获取成功"
else
    echo "   ❌ Token获取失败"
    exit 1
fi

echo ""

# 2. 测试直接请求后端API
echo "2. 测试直接请求后端PDF API..."
DIRECT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/pdf,*/*" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  http://localhost:8080/api/documents/2/download)

DIRECT_HTTP_STATUS=$(echo "$DIRECT_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$DIRECT_HTTP_STATUS" = "200" ]; then
    echo "   ✅ 直接请求后端成功 (HTTP $DIRECT_HTTP_STATUS)"
    echo "   📄 PDF文件大小: $(echo "$DIRECT_RESPONSE" | grep -v "HTTP_STATUS:" | wc -c) bytes"
else
    echo "   ❌ 直接请求后端失败 (HTTP $DIRECT_HTTP_STATUS)"
    echo "   📄 响应内容: $(echo "$DIRECT_RESPONSE" | grep -v "HTTP_STATUS:")"
fi

echo ""

# 3. 测试前端代理请求
echo "3. 测试前端代理请求 (旧方法)..."
PROXY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/pdf,*/*" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  http://localhost:3000/api/documents/2/download)

PROXY_HTTP_STATUS=$(echo "$PROXY_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)

if [ "$PROXY_HTTP_STATUS" = "200" ]; then
    echo "   ✅ 前端代理成功 (HTTP $PROXY_HTTP_STATUS)"
else
    echo "   ❌ 前端代理失败 (HTTP $PROXY_HTTP_STATUS)"
    echo "   📄 响应内容: $(echo "$PROXY_RESPONSE" | grep -v "HTTP_STATUS:")"
fi

echo ""

echo "🔧 修复方案:"
echo "修改PDFViewer直接请求后端地址，避免前端代理问题"
echo "从: http://localhost:3000/api/documents/2/download"
echo "到:   http://localhost:8080/api/documents/2/download"
echo ""

echo "📋 验证结果:"
echo "直接后端请求: $([ "$DIRECT_HTTP_STATUS" = "200" ] && echo "✅ 正常" || echo "❌ 失败")"
echo "前端代理请求: $([ "$PROXY_HTTP_STATUS" = "200" ] && echo "✅ 正常" || echo "❌ 失败")"
echo ""

if [ "$DIRECT_HTTP_STATUS" = "200" ] && [ "$PROXY_HTTP_STATUS" != "200" ]; then
    echo "🎯 问题确认: 前端代理有问题，直接请求后端是解决方案"
elif [ "$DIRECT_HTTP_STATUS" = "200" ] && [ "$PROXY_HTTP_STATUS" = "200" ]; then
    echo "🎯 问题解决: 两种方法都正常工作"
else
    echo "🎯 需要进一步调查: 两种方法都有问题"
fi





