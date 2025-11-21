#!/bin/bash

# 测试文件管理和分类管理关联功能
echo "测试文件管理和分类管理关联功能"

# 设置变量
BACKEND_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:3000"

# 测试账号
USERNAME="admin"
PASSWORD="password"

echo "1. 获取认证token..."
TOKEN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 获取token失败"
  exit 1
fi

echo "✅ 获取token成功"

echo "2. 获取分类列表..."
CATEGORIES_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/categories" \
  -H "Authorization: Bearer $TOKEN")

echo "分类列表: $CATEGORIES_RESPONSE"

# 提取第一个分类ID
CATEGORY_ID=$(echo $CATEGORIES_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$CATEGORY_ID" ]; then
  echo "❌ 获取分类ID失败"
  exit 1
fi

echo "✅ 获取分类ID成功: $CATEGORY_ID"

echo "3. 上传文件并指定分类..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf" \
  -F "categoryId=$CATEGORY_ID")

echo "上传响应: $UPLOAD_RESPONSE"

# 检查是否上传成功
if echo "$UPLOAD_RESPONSE" | grep -q '"message":"文件上传成功"'; then
  echo "✅ 文件上传成功"

  # 提取文档ID
  DOCUMENT_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

  echo "4. 获取文档详情，验证分类关联..."
  DOCUMENT_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/documents/$DOCUMENT_ID" \
    -H "Authorization: Bearer $TOKEN")

  echo "文档详情: $DOCUMENT_RESPONSE"

  # 检查文档是否有关联的分类
  if echo "$DOCUMENT_RESPONSE" | grep -q '"category"'; then
    echo "✅ 文档分类关联成功"
  else
    echo "❌ 文档分类关联失败"
    exit 1
  fi

  echo "5. 获取按分类筛选的文档列表..."
  FILTERED_DOCS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/documents?categoryId=$CATEGORY_ID&page=0&size=10" \
    -H "Authorization: Bearer $TOKEN")

  echo "筛选后的文档列表: $FILTERED_DOCS_RESPONSE"

  # 检查筛选是否工作
  if echo "$FILTERED_DOCS_RESPONSE" | grep -q "$DOCUMENT_ID"; then
    echo "✅ 分类筛选功能正常"
  else
    echo "❌ 分类筛选功能异常"
    exit 1
  fi

  echo "6. 获取分类统计信息..."
  STATS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/categories/$CATEGORY_ID/stats" \
    -H "Authorization: Bearer $TOKEN")

  echo "分类统计: $STATS_RESPONSE"

  # 检查统计信息
  if echo "$STATS_RESPONSE" | grep -q '"documentCount":[1-9]'; then
    echo "✅ 分类统计功能正常"
  else
    echo "❌ 分类统计功能异常"
    exit 1
  fi

else
  echo "❌ 文件上传失败"
  exit 1
fi

echo ""
echo "🎉 所有测试通过！文件管理和分类管理关联功能正常工作。"




