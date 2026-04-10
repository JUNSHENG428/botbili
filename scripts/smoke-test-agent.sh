#!/bin/bash

# BotBili Agent 全链路冒烟测试
# 用法: ./scripts/smoke-test-agent.sh
# 环境变量: BASE_URL (默认 http://localhost:3000)

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "========================================"
echo "BotBili Agent Smoke Test"
echo "Base URL: $BASE_URL"
echo "========================================"
echo ""

# Step 1: 创建频道
echo "[Step 1/5] 创建 Agent 频道..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/creators" \
  -H "Content-Type: application/json" \
  -H "X-BotBili-Client: agent" \
  -d '{
    "name": "SmokeTestAgent-'$(date +%s)'",
    "niche": "测试",
    "bio": "冒烟测试 Agent"
  }')

# 检查是否成功
if ! echo "$CREATE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "❌ 创建频道失败:"
  echo "$CREATE_RESPONSE" | jq .
  exit 1
fi

# 提取 api_key 和 creator_id
API_KEY=$(echo "$CREATE_RESPONSE" | jq -r '.data.api_key')
CREATOR_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.creator_id')
CHANNEL_URL=$(echo "$CREATE_RESPONSE" | jq -r '.data.channel_url')

echo "✅ 频道创建成功"
echo "   Creator ID: $CREATOR_ID"
echo "   API Key: ${API_KEY:0:20}..."
echo "   Channel URL: $CHANNEL_URL"
echo ""

# Step 2: 获取热门 Recipe
echo "[Step 2/5] 获取热门 Recipe 列表..."
RECIPES_RESPONSE=$(curl -s "$BASE_URL/api/recipes?sort=trending&limit=5")

if ! echo "$RECIPES_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "❌ 获取 Recipe 列表失败:"
  echo "$RECIPES_RESPONSE" | jq .
  exit 1
fi

# 提取第一个 recipe id
RECIPE_ID=$(echo "$RECIPES_RESPONSE" | jq -r '.data.recipes[0].id')
RECIPE_TITLE=$(echo "$RECIPES_RESPONSE" | jq -r '.data.recipes[0].title')

if [ -z "$RECIPE_ID" ] || [ "$RECIPE_ID" = "null" ]; then
  echo "❌ 没有可用的 Recipe"
  exit 1
fi

echo "✅ 获取 Recipe 成功"
echo "   Recipe ID: $RECIPE_ID"
echo "   Recipe Title: $RECIPE_TITLE"
echo ""

# Step 3: 执行 Recipe
echo "[Step 3/5] 执行 Recipe..."
EXECUTE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/recipes/$RECIPE_ID/execute" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

if ! echo "$EXECUTE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "❌ 执行 Recipe 失败:"
  echo "$EXECUTE_RESPONSE" | jq .
  exit 1
fi

EXECUTION_ID=$(echo "$EXECUTE_RESPONSE" | jq -r '.data.execution_id')
COMMAND_PREVIEW=$(echo "$EXECUTE_RESPONSE" | jq -r '.data.command_preview')
RATE_LIMIT_REMAINING=$(echo "$EXECUTE_RESPONSE" | jq -r '.headers["X-RateLimit-Remaining"] // "N/A"')

echo "✅ 执行请求已提交"
echo "   Execution ID: $EXECUTION_ID"
echo "   Command: $COMMAND_PREVIEW"
echo "   Rate Limit Remaining: $RATE_LIMIT_REMAINING"
echo ""

# Step 4: 轮询执行状态
echo "[Step 4/5] 轮询执行状态 (最多 ${MAX_RETRIES} 次, 间隔 ${RETRY_INTERVAL}s)..."

RETRY_COUNT=0
FINAL_STATUS=""
OUTPUT_URL=""

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  
  STATUS_RESPONSE=$(curl -s "$BASE_URL/api/executions/$EXECUTION_ID" \
    -H "Authorization: Bearer $API_KEY")
  
  if ! echo "$STATUS_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "⚠️  第 $RETRY_COUNT 次轮询失败，继续重试..."
    sleep $RETRY_INTERVAL
    continue
  fi
  
  CURRENT_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.data.status')
  PROGRESS_PCT=$(echo "$STATUS_RESPONSE" | jq -r '.data.progress_pct')
  OUTPUT_URL=$(echo "$STATUS_RESPONSE" | jq -r '.data.output_external_url // empty')
  ERROR_MSG=$(echo "$STATUS_RESPONSE" | jq -r '.data.error_message // empty')
  
  printf "   [%2d/%2d] Status: %-12s Progress: %3d%%" \
    $RETRY_COUNT $MAX_RETRIES "$CURRENT_STATUS" $PROGRESS_PCT
  
  if [ -n "$ERROR_MSG" ] && [ "$ERROR_MSG" != "null" ]; then
    printf " Error: %s" "$ERROR_MSG"
  fi
  printf "\n"
  
  # 检查是否完成
  if [ "$CURRENT_STATUS" = "success" ]; then
    FINAL_STATUS="success"
    OUTPUT_URL=$(echo "$STATUS_RESPONSE" | jq -r '.data.output_external_url')
    echo ""
    echo "✅ 执行成功!"
    break
  elif [ "$CURRENT_STATUS" = "failed" ]; then
    FINAL_STATUS="failed"
    echo ""
    echo "❌ 执行失败: $ERROR_MSG"
    break
  fi
  
  sleep $RETRY_INTERVAL
done

if [ -z "$FINAL_STATUS" ]; then
  echo ""
  echo "⚠️  轮询超时，未在 ${MAX_RETRIES} 次内完成"
  echo "   请手动检查: $BASE_URL/api/executions/$EXECUTION_ID"
  exit 1
fi

# Step 5: 打印结果
echo ""
echo "========================================"
echo "[Step 5/5] 最终结果"
echo "========================================"
echo ""
echo "Execution ID: $EXECUTION_ID"
echo "Final Status: $FINAL_STATUS"
echo ""

if [ "$FINAL_STATUS" = "success" ] && [ -n "$OUTPUT_URL" ] && [ "$OUTPUT_URL" != "null" ]; then
  echo "✅ Output URL: $OUTPUT_URL"
  echo ""
  echo "🎉 Smoke Test 通过!"
  exit 0
else
  echo "❌ 未获取到输出 URL"
  exit 1
fi
