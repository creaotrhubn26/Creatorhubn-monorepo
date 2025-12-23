#!/bin/bash

# Test Render Integration & API Version Management
# Date: December 1, 2025

echo "🧪 Testing Render Integration & API Version Management System"
echo "=============================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:5050"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local expected_status=$4
  
  echo -n "Testing: $name... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
  elif [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint")
  fi
  
  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✅ PASSED${NC} (Status: $status_code)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}❌ FAILED${NC} (Expected: $expected_status, Got: $status_code)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo "📦 Testing API Version Management Endpoints"
echo "-------------------------------------------"

# Test 1: Get all API versions
test_endpoint "Get all API versions" "GET" "/api/admin/api-versions" "200"

# Test 2: Get OpenAI version
test_endpoint "Get OpenAI version" "GET" "/api/admin/api-versions/openai" "200"

# Test 3: Get Anthropic version
test_endpoint "Get Anthropic version" "GET" "/api/admin/api-versions/anthropic" "200"

# Test 4: Get Gemini version
test_endpoint "Get Gemini version" "GET" "/api/admin/api-versions/gemini" "200"

# Test 5: Get Stripe version
test_endpoint "Get Stripe version" "GET" "/api/admin/api-versions/stripe" "200"

# Test 6: Check for updates
test_endpoint "Check for updates" "POST" "/api/admin/api-versions/check" "200"

echo ""
echo "🔗 Testing Render Integration Endpoints"
echo "---------------------------------------"

# Test 7: Get Render environment variables
test_endpoint "Get Render env vars" "GET" "/api/admin/render/env-vars" "200"

# Test 8: Get configured API services
test_endpoint "Get configured APIs" "GET" "/api/admin/render/api-services" "200"

echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
  exit 1
fi

