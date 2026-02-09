#!/bin/bash

# LinkedIn Integration - Setup Verification Script
# This script verifies that your LinkedIn integration is properly configured

set -e

echo "========================================"
echo "LinkedIn Integration Setup Verification"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for checks
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Function to check if file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $description - NOT FOUND: $file"
        ((CHECKS_FAILED++))
    fi
}

# Function to check environment variable
check_env() {
    local var=$1
    local description=$2
    local file=$3
    
    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}!${NC} $description - NOT SET in $file"
        echo "  Set it with: export $var=your_value"
        ((CHECKS_WARNING++))
    else
        echo -e "${GREEN}✓${NC} $description is configured"
        ((CHECKS_PASSED++))
    fi
}

# Function to check if command exists
check_command() {
    local cmd=$1
    local description=$2
    
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $description is installed"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $description is NOT installed"
        ((CHECKS_FAILED++))
    fi
}

# Function to check port
check_port() {
    local port=$1
    local description=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${GREEN}✓${NC} $description is running on port $port"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}!${NC} $description is NOT running on port $port"
        ((CHECKS_WARNING++))
    fi
}

# Function to check JSON validity
check_json() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        if python3 -m json.tool "$file" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $description is valid JSON"
            ((CHECKS_PASSED++))
        else
            echo -e "${RED}✗${NC} $description has invalid JSON"
            ((CHECKS_FAILED++))
        fi
    else
        echo -e "${YELLOW}!${NC} $description not found"
        ((CHECKS_WARNING++))
    fi
}

echo "1. Checking Core Files..."
echo "=========================="
check_file "frontend/client/src/services/LinkedInService.ts" "LinkedInService.ts"
check_file "frontend/client/src/hooks/useLinkedIn.ts" "useLinkedIn hook"
check_file "frontend/client/src/pages/LinkedInCallback.tsx" "LinkedInCallback handler"
check_file "frontend/client/src/components/resume/ResumeBuilder.tsx" "ResumeBuilder component"
check_file "frontend/client/src/utils/linkedin-data-extractor.ts" "Data extractor"
echo ""

echo "2. Checking Documentation..."
echo "============================"
check_file "README_LINKEDIN.md" "Main documentation"
check_file "LINKEDIN_OAUTH_SETUP.md" "OAuth setup guide"
check_file "QUICK_START_LINKEDIN.md" "Quick start guide"
check_file "LINKEDIN_INTEGRATION_SUMMARY.md" "Technical summary"
check_file "IMPLEMENTATION_CHECKLIST.md" "Implementation checklist"
echo ""

echo "3. Checking Configuration Files..."
echo "==================================="
check_file "frontend/client/.env.local" "Frontend environment file"
check_file "backend/.env" "Backend environment file"
echo ""

echo "4. Checking Environment Variables..."
echo "====================================="

# Check frontend env
if [ -f "frontend/client/.env.local" ]; then
    echo "Frontend configuration:"
    if grep -q "VITE_LINKEDIN_CLIENT_ID" frontend/client/.env.local; then
        echo -e "${GREEN}✓${NC} VITE_LINKEDIN_CLIENT_ID is set"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}!${NC} VITE_LINKEDIN_CLIENT_ID is NOT in .env.local"
        ((CHECKS_WARNING++))
    fi
    
    if grep -q "VITE_LINKEDIN_REDIRECT_URI" frontend/client/.env.local; then
        echo -e "${GREEN}✓${NC} VITE_LINKEDIN_REDIRECT_URI is set"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}!${NC} VITE_LINKEDIN_REDIRECT_URI is NOT in .env.local"
        ((CHECKS_WARNING++))
    fi
else
    echo -e "${YELLOW}!${NC} Frontend .env.local not found"
    ((CHECKS_WARNING++))
fi

# Check backend env
if [ -f "backend/.env" ]; then
    echo "Backend configuration:"
    if grep -q "VITE_LINKEDIN_CLIENT_SECRET" backend/.env; then
        echo -e "${GREEN}✓${NC} VITE_LINKEDIN_CLIENT_SECRET is set"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}!${NC} VITE_LINKEDIN_CLIENT_SECRET is NOT in .env"
        ((CHECKS_WARNING++))
    fi
else
    echo -e "${YELLOW}!${NC} Backend .env not found"
    ((CHECKS_WARNING++))
fi
echo ""

echo "5. Checking Dependencies..."
echo "============================"
check_command "node" "Node.js"
check_command "npm" "npm"
check_command "git" "Git"

# Check if packages are installed
if [ -d "frontend/client/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Frontend dependencies installed"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}!${NC} Frontend dependencies NOT installed (run: npm install)"
    ((CHECKS_WARNING++))
fi

if [ -d "backend/node_modules" ]; then
    echo -e "${GREEN}✓${NC} Backend dependencies installed"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}!${NC} Backend dependencies NOT installed (run: npm install)"
    ((CHECKS_WARNING++))
fi
echo ""

echo "6. Checking Running Servers..."
echo "=============================="
check_port 5000 "Frontend server"
check_port 3001 "Backend server"
echo ""

echo "7. Checking package.json..."
echo "============================"
check_json "frontend/client/package.json" "Frontend package.json"
check_json "backend/package.json" "Backend package.json"
echo ""

echo "========================================"
echo "Verification Results"
echo "========================================"
echo ""

# Summary
TOTAL=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))
echo "Total Checks: $TOTAL"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo ""

# Recommendations
if [ $CHECKS_FAILED -eq 0 ] && [ $CHECKS_WARNING -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! You're ready to go!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Navigate to http://localhost:5000/resume-builder"
    echo "2. Click 'Importer fra LinkedIn'"
    echo "3. Complete the OAuth flow"
    echo "4. Import your profile data"
    exit 0
elif [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Some warnings found. Please review the steps below.${NC}"
    echo ""
    echo "Action items:"
    if ! [ -f "frontend/client/.env.local" ]; then
        echo "- Create frontend/.env.local with VITE_LINKEDIN_CLIENT_ID and VITE_LINKEDIN_REDIRECT_URI"
    fi
    if ! [ -f "backend/.env" ]; then
        echo "- Create backend/.env with VITE_LINKEDIN_CLIENT_SECRET"
    fi
    if ! [ -d "frontend/client/node_modules" ]; then
        echo "- Run: cd frontend/client && npm install"
    fi
    if ! [ -d "backend/node_modules" ]; then
        echo "- Run: cd backend && npm install"
    fi
    if ! lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "- Start frontend: cd frontend/client && npm run dev"
    fi
    if ! lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "- Start backend: cd backend && npm start"
    fi
    exit 0
else
    echo -e "${RED}✗ Critical errors found. Please fix them before proceeding.${NC}"
    echo ""
    echo "Required actions:"
    if [ ! -f "frontend/client/src/services/LinkedInService.ts" ]; then
        echo "- LinkedInService.ts is missing"
    fi
    if [ ! -f "frontend/client/src/hooks/useLinkedIn.ts" ]; then
        echo "- useLinkedIn.ts is missing"
    fi
    if [ ! -f "frontend/client/src/pages/LinkedInCallback.tsx" ]; then
        echo "- LinkedInCallback.tsx is missing"
    fi
    echo ""
    echo "See QUICK_START_LINKEDIN.md for setup instructions"
    exit 1
fi
