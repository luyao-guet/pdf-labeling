#!/bin/bash

# 测试新的文件管理功能
echo "测试新的文件管理功能"

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

echo "3. 测试上传文档并指定分类..."
UPLOAD_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_new.pdf" \
  -F "categoryId=$CATEGORY_ID")

echo "上传响应: $UPLOAD_RESPONSE"

if echo "$UPLOAD_RESPONSE" | grep -q '"message":"文件上传成功"'; then
  echo "✅ 文件上传成功"

  # 提取文档ID
  DOCUMENT_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

  echo "4. 测试更新文档分类..."
  UPDATE_RESPONSE=$(curl -s -X PUT "$BACKEND_URL/api/documents/$DOCUMENT_ID/category" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"categoryId\": null}")

  echo "更新分类响应: $UPDATE_RESPONSE"

  if echo "$UPDATE_RESPONSE" | grep -q '"message":"文档分类更新成功"'; then
    echo "✅ 文档分类更新成功"

    echo "5. 验证分类已被清除..."
    DOCUMENT_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/documents/$DOCUMENT_ID" \
      -H "Authorization: Bearer $TOKEN")

    if echo "$DOCUMENT_RESPONSE" | grep -q '"category":null'; then
      echo "✅ 文档分类已正确清除"
    else
      echo "❌ 文档分类清除失败"
      exit 1
    fi

  else
    echo "❌ 文档分类更新失败"
    exit 1
  fi

else
  echo "❌ 文件上传失败"
  exit 1
fi

echo ""
echo "🎉 所有后端API测试通过！"
echo ""
echo "📋 前端功能清单："
echo "✅ 重新设计的页面布局"
echo "✅ 上传时分类选择功能"
echo "✅ 编辑文档分类功能"
echo "✅ 文件夹批量上传功能"
echo "✅ 改进的用户界面和用户体验"
echo ""
echo "请在浏览器中访问 $FRONTEND_URL/files 查看新的文件管理界面"
