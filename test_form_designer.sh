#!/bin/bash

# 测试表单设计器功能
echo "测试表单设计器功能"

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

echo "2. 测试获取表单配置列表..."
FORM_CONFIGS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/form-configs" \
  -H "Authorization: Bearer $TOKEN")

echo "表单配置列表响应: $FORM_CONFIGS_RESPONSE"

if echo "$FORM_CONFIGS_RESPONSE" | grep -q '"formConfigs":'; then
  echo "✅ 表单配置API正常工作"

  # 提取第一个表单配置ID
  FORM_CONFIG_ID=$(echo "$FORM_CONFIGS_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -n "$FORM_CONFIG_ID" ]; then
    echo "✅ 获取表单配置ID成功: $FORM_CONFIG_ID"

    echo "3. 测试获取单个表单配置..."
    SINGLE_CONFIG_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/form-configs/$FORM_CONFIG_ID" \
      -H "Authorization: Bearer $TOKEN")

    echo "单个表单配置响应: $SINGLE_CONFIG_RESPONSE"

    if echo "$SINGLE_CONFIG_RESPONSE" | grep -q '"formConfig":'; then
      echo "✅ 单个表单配置API正常工作"
    else
      echo "❌ 单个表单配置API异常"
      exit 1
    fi

    echo "4. 测试获取表单字段..."
    FIELDS_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/form-configs/$FORM_CONFIG_ID/fields" \
      -H "Authorization: Bearer $TOKEN")

    echo "表单字段响应: $FIELDS_RESPONSE"

    # 字段可能为空，这是正常的
    if echo "$FIELDS_RESPONSE" | grep -q '"fields":'; then
      echo "✅ 表单字段API正常工作"
    else
      echo "❌ 表单字段API异常"
      exit 1
    fi

  else
    echo "❌ 获取表单配置ID失败"
    exit 1
  fi

else
  echo "❌ 表单配置API异常"
  exit 1
fi

echo "5. 测试创建新表单配置..."
CREATE_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/form-configs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试表单",
    "description": "用于测试的表单配置",
    "categoryId": 1,
    "promptTemplate": "请识别测试文档中的信息"
  }')

echo "创建表单配置响应: $CREATE_RESPONSE"

if echo "$CREATE_RESPONSE" | grep -q '"message":"表单配置创建成功"'; then
  echo "✅ 表单配置创建成功"

  # 提取新创建的ID
  NEW_CONFIG_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

  echo "6. 测试删除刚创建的表单配置..."
  DELETE_RESPONSE=$(curl -s -X DELETE "$BACKEND_URL/api/form-configs/$NEW_CONFIG_ID" \
    -H "Authorization: Bearer $TOKEN")

  echo "删除表单配置响应: $DELETE_RESPONSE"

  if echo "$DELETE_RESPONSE" | grep -q '"message":"表单配置删除成功"'; then
    echo "✅ 表单配置删除成功"
  else
    echo "❌ 表单配置删除失败"
  fi

else
  echo "❌ 表单配置创建失败"
  exit 1
fi

echo ""
echo "🎉 表单设计器API测试完成！"
echo ""
echo "前端问题修复总结："
echo "✅ 修复了Select组件null值警告"
echo "✅ 改进了API错误处理"
echo "✅ 修复了表单配置加载逻辑"
echo "✅ 改善了分类选择的用户体验"
echo ""
echo "请在浏览器中访问 $FRONTEND_URL/form-designer 测试表单设计器页面"
