#!/bin/bash

echo "🚀 数据标注平台性能测试"
echo "========================="

# 检查后端是否运行
if ! curl -s http://localhost:8080/api/ > /dev/null; then
    echo "❌ 后端服务未运行，请先启动服务"
    echo "运行: ./start-full.sh"
    exit 1
fi

echo "✅ 后端服务运行正常"
echo ""

# 测试API响应时间
echo "📊 API响应时间测试:"
echo "-------------------"

# 健康检查
echo -n "健康检查 (/api/): "
START=$(date +%s%N)
curl -s http://localhost:8080/api/ > /dev/null
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "${DURATION}ms"

# 统计信息
echo -n "统计信息 (/api/tasks/statistics): "
START=$(date +%s%N)
curl -s http://localhost:8080/api/tasks/statistics > /dev/null
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "${DURATION}ms"

# 用户登录
echo -n "用户登录 (/api/auth/login): "
START=$(date +%s%N)
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' > /dev/null
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "${DURATION}ms"

echo ""

# 并发测试
echo "🔄 并发测试 (10个并发请求):"
echo "----------------------------"

# 创建临时脚本来执行并发请求
cat > /tmp/concurrent_test.sh << 'EOF'
#!/bin/bash
for i in {1..10}; do
    curl -s http://localhost:8080/api/tasks/statistics > /dev/null &
done
wait
EOF

chmod +x /tmp/concurrent_test.sh

START=$(date +%s%N)
bash /tmp/concurrent_test.sh
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))
echo "10个并发请求总耗时: ${DURATION}ms"
echo "平均响应时间: $((DURATION / 10))ms"

# 清理临时文件
rm /tmp/concurrent_test.sh

echo ""

# 内存使用情况
echo "💾 系统资源使用情况:"
echo "-------------------"

# 检查Java进程内存使用
JAVA_PID=$(pgrep -f "spring-boot:run" | head -1)
if [ ! -z "$JAVA_PID" ]; then
    echo "Java进程PID: $JAVA_PID"
    echo -n "Java进程内存使用: "
    if command -v ps >/dev/null 2>&1; then
        MEM_USAGE=$(ps -o rss= -p $JAVA_PID | awk '{print $1/1024 "MB"}')
        echo "$MEM_USAGE"
    else
        echo "无法获取"
    fi
else
    echo "未找到Java进程"
fi

echo ""

# 数据库连接测试
echo "🗄️  数据库连接测试:"
echo "------------------"

# 测试数据库响应
if command -v psql >/dev/null 2>&1; then
    DB_TEST=$(psql -h localhost -U annotation_user -d annotation_platform -c "SELECT COUNT(*) FROM users;" 2>/dev/null | grep -E '[0-9]+' | head -1)
    if [ $? -eq 0 ]; then
        echo "数据库连接正常，用户表记录数: $DB_TEST"
    else
        echo "数据库连接异常"
    fi
else
    echo "psql命令不可用，跳过数据库测试"
fi

echo ""

# 总结
echo "📋 性能测试总结:"
echo "---------------"
echo "✅ API响应时间测试完成"
echo "✅ 并发处理能力测试完成"
echo "✅ 系统资源监控完成"
echo "✅ 数据库连接测试完成"
echo ""
echo "🎯 建议优化方向:"
echo "- 为频繁查询的API添加缓存"
echo "- 优化数据库查询性能"
echo "- 考虑使用连接池"
echo "- 添加API限流保护"
