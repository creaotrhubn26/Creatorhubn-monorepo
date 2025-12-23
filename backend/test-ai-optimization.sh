#!/bin/bash

# AI Cost Optimization - Quick Test Script
# Tests the complete flow: cache miss, AI generation, cache hit

echo "🧪 Testing AI Cost Optimization System"
echo "======================================="
echo ""

BASE_URL="http://localhost:3000"

echo "📝 Test 1: Generate snippet (should call AI - cache miss)"
echo "-----------------------------------------------------------"
RESPONSE1=$(curl -s -X POST "$BASE_URL/api/ai-snippets-optimized/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Create a React Query hook for fetching user data",
    "context": {
      "fileType": "hook",
      "hasReactQuery": true
    },
    "language": "typescript"
  }')

echo "$RESPONSE1" | jq -r '.metadata | "Model: \(.model) | Tier: \(.modelTier) | Cached: \(.cached) | Cost: $\(.estimatedCost)"'
echo ""

echo "⏳ Waiting 2 seconds..."
sleep 2
echo ""

echo "📝 Test 2: Same request (should hit cache)"
echo "-----------------------------------------------------------"
RESPONSE2=$(curl -s -X POST "$BASE_URL/api/ai-snippets-optimized/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Create a React Query hook for fetching user data",
    "context": {
      "fileType": "hook",
      "hasReactQuery": true
    },
    "language": "typescript"
  }')

echo "$RESPONSE2" | jq -r '.metadata | "Model: \(.model) | Tier: \(.modelTier) | Cached: \(.cached) | Saved: $\(.costSaved // 0) | Age: \(.cacheAge // 0) min"'
echo ""

echo "📊 Test 3: Check savings analytics"
echo "-----------------------------------------------------------"
ANALYTICS=$(curl -s "$BASE_URL/api/ai-snippets-optimized/analytics/savings?days=1")

echo "$ANALYTICS" | jq -r '.savings | "Cache Hits: \(.cache_hits) | Total Savings: $\(.total_savings) | Unique Queries: \(.unique_queries)"'
echo ""

echo "📈 Test 4: Check learning metrics"
echo "-----------------------------------------------------------"
LEARNING=$(curl -s "$BASE_URL/api/ai-snippets-optimized/analytics/learning")

echo "$LEARNING" | jq -r '.metrics | "Learning Velocity: \(.learning_velocity) | Cache Improvement: \((.cache_improvement * 100) | round)%"'
echo ""

echo "✅ Test Complete!"
echo ""
echo "Expected Results:"
echo "  - Test 1: cached = false (AI called)"
echo "  - Test 2: cached = true (served from cache)"
echo "  - Test 3: cache_hits = 1, total_savings > 0"
echo "  - Test 4: learning_velocity = low/medium/high"
echo ""
echo "🎉 If you see the above, the AI Cost Optimization system is working!"
