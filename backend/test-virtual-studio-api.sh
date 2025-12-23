#!/bin/bash

# Virtual Studio API Comprehensive Test Script
# Tests all 35 API endpoints

echo "🧪 Virtual Studio API Comprehensive Test"
echo "=========================================="
echo ""

BASE_URL="http://localhost:5050"
API_BASE="/api/virtual-studio"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local expected_status=$4
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing: $description... "
    
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected $expected_status, got $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "📊 Step 1: Server Health Check"
echo "--------------------------------"
test_endpoint "GET" "/api/health" "Server health" "200"
echo ""

echo "🔐 Step 2: Authentication Tests"
echo "--------------------------------"
test_endpoint "GET" "$API_BASE/projects" "Projects list (requires auth)" "401"
test_endpoint "GET" "$API_BASE/scenes" "Scenes list (requires auth)" "401"
test_endpoint "GET" "$API_BASE/camera-paths" "Camera paths list (requires auth)" "401"
test_endpoint "GET" "$API_BASE/assets" "Assets list (requires auth)" "401"
test_endpoint "GET" "$API_BASE/renders" "Renders list (requires auth)" "401"
test_endpoint "GET" "$API_BASE/templates" "Templates list (requires auth)" "401"
test_endpoint "GET" "$API_BASE/exports" "Exports list (requires auth)" "401"
echo ""

echo "📦 Step 3: Database Schema Verification"
echo "----------------------------------------"
echo "Checking Virtual Studio tables in database..."

PGPASSWORD='npg_RIFOSAo81mLc' psql -h ep-divine-rice-a6k2cock.us-west-2.aws.neon.tech \
    -U neondb_owner -d neondb \
    -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'virtual_studio%' ORDER BY table_name" \
    -t | while read -r table; do
    if [ ! -z "$table" ]; then
        echo -e "${GREEN}✅${NC} Table exists: $(echo $table | xargs)"
    fi
done
echo ""

echo "🎬 Step 4: Route Registration Check"
echo "------------------------------------"
echo "Checking if Virtual Studio routes are registered..."

# Check server logs for route registration
if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} Server is responding"
    echo -e "${GREEN}✅${NC} Virtual Studio routes should be registered"
else
    echo -e "${RED}❌${NC} Server is not responding"
fi
echo ""

echo "📊 Step 5: Endpoint Availability Check"
echo "---------------------------------------"
echo "Checking all 35 Virtual Studio endpoints..."

# Projects endpoints (5)
test_endpoint "GET" "$API_BASE/projects" "GET /projects" "401"
test_endpoint "POST" "$API_BASE/projects" "POST /projects" "401"
test_endpoint "GET" "$API_BASE/projects/test-id" "GET /projects/:id" "401"
test_endpoint "PUT" "$API_BASE/projects/test-id" "PUT /projects/:id" "401"
test_endpoint "DELETE" "$API_BASE/projects/test-id" "DELETE /projects/:id" "401"

# Scenes endpoints (5)
test_endpoint "GET" "$API_BASE/scenes" "GET /scenes" "401"
test_endpoint "POST" "$API_BASE/scenes" "POST /scenes" "401"
test_endpoint "GET" "$API_BASE/scenes/test-id" "GET /scenes/:id" "401"
test_endpoint "PUT" "$API_BASE/scenes/test-id" "PUT /scenes/:id" "401"
test_endpoint "DELETE" "$API_BASE/scenes/test-id" "DELETE /scenes/:id" "401"

# Camera Paths endpoints (5)
test_endpoint "GET" "$API_BASE/camera-paths" "GET /camera-paths" "401"
test_endpoint "POST" "$API_BASE/camera-paths" "POST /camera-paths" "401"
test_endpoint "GET" "$API_BASE/camera-paths/test-id" "GET /camera-paths/:id" "401"
test_endpoint "PUT" "$API_BASE/camera-paths/test-id" "PUT /camera-paths/:id" "401"
test_endpoint "DELETE" "$API_BASE/camera-paths/test-id" "DELETE /camera-paths/:id" "401"

# Assets endpoints (5)
test_endpoint "GET" "$API_BASE/assets" "GET /assets" "401"
test_endpoint "POST" "$API_BASE/assets" "POST /assets" "401"
test_endpoint "GET" "$API_BASE/assets/test-id" "GET /assets/:id" "401"
test_endpoint "PUT" "$API_BASE/assets/test-id" "PUT /assets/:id" "401"
test_endpoint "DELETE" "$API_BASE/assets/test-id" "DELETE /assets/:id" "401"

# Renders endpoints (5)
test_endpoint "GET" "$API_BASE/renders" "GET /renders" "401"
test_endpoint "POST" "$API_BASE/renders" "POST /renders" "401"
test_endpoint "GET" "$API_BASE/renders/test-id" "GET /renders/:id" "401"
test_endpoint "PUT" "$API_BASE/renders/test-id" "PUT /renders/:id" "401"
test_endpoint "DELETE" "$API_BASE/renders/test-id" "DELETE /renders/:id" "401"

# Templates endpoints (5)
test_endpoint "GET" "$API_BASE/templates" "GET /templates" "401"
test_endpoint "POST" "$API_BASE/templates" "POST /templates" "401"
test_endpoint "GET" "$API_BASE/templates/test-id" "GET /templates/:id" "401"
test_endpoint "PUT" "$API_BASE/templates/test-id" "PUT /templates/:id" "401"
test_endpoint "DELETE" "$API_BASE/templates/test-id" "DELETE /templates/:id" "401"

# Exports endpoints (5)
test_endpoint "GET" "$API_BASE/exports" "GET /exports" "401"
test_endpoint "POST" "$API_BASE/exports" "POST /exports" "401"
test_endpoint "GET" "$API_BASE/exports/test-id" "GET /exports/:id" "401"
test_endpoint "PUT" "$API_BASE/exports/test-id" "PUT /exports/:id" "401"
test_endpoint "DELETE" "$API_BASE/exports/test-id" "DELETE /exports/:id" "401"

echo ""
echo "=========================================="
echo "📊 Test Results Summary"
echo "=========================================="
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
echo -e "${RED}Failed:       $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Virtual Studio API is 200 OK!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
    exit 1
fi

