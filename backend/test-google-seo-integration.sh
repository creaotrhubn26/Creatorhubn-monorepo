#!/bin/bash

# Test Google SEO Integration
# This script tests the Google SEO API endpoints

echo "🧪 Testing Google SEO Integration"
echo "=================================="
echo ""

# Base URL
BASE_URL="http://localhost:5050"

# Test URL (encode it)
TEST_URL="https://creatorhubn.com"
ENCODED_URL=$(echo -n "$TEST_URL" | jq -sRr @uri)

echo "📍 Test URL: $TEST_URL"
echo "🔗 Encoded URL: $ENCODED_URL"
echo ""

# Check if server is running
echo "1️⃣  Checking if server is running..."
if curl -s -f "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo "✅ Server is running"
else
  echo "❌ Server is not running at $BASE_URL"
  echo "   Please start the server first: npm run dev"
  exit 1
fi
echo ""

# Test PageSpeed Insights endpoint
echo "2️⃣  Testing PageSpeed Insights endpoint..."
echo "   GET /api/seo-crawler/google/pagespeed/$ENCODED_URL"
PAGESPEED_RESPONSE=$(curl -s "$BASE_URL/api/seo-crawler/google/pagespeed/$ENCODED_URL?strategy=mobile")
if echo "$PAGESPEED_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ PageSpeed endpoint is working"
  echo "   Performance Score: $(echo "$PAGESPEED_RESPONSE" | jq -r '.data.performanceScore')"
  echo "   LCP: $(echo "$PAGESPEED_RESPONSE" | jq -r '.data.lcp')ms"
  echo "   CLS: $(echo "$PAGESPEED_RESPONSE" | jq -r '.data.cls')"
else
  echo "⚠️  PageSpeed endpoint returned an error:"
  echo "$PAGESPEED_RESPONSE" | jq '.'
fi
echo ""

# Test CrUX endpoint
echo "3️⃣  Testing CrUX endpoint..."
echo "   GET /api/seo-crawler/google/crux/$ENCODED_URL"
CRUX_RESPONSE=$(curl -s "$BASE_URL/api/seo-crawler/google/crux/$ENCODED_URL?formFactor=PHONE")
if echo "$CRUX_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ CrUX endpoint is working"
  if echo "$CRUX_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    echo "   Form Factor: $(echo "$CRUX_RESPONSE" | jq -r '.data.formFactor')"
    echo "   LCP (p75): $(echo "$CRUX_RESPONSE" | jq -r '.data.metrics.largest_contentful_paint.percentiles.p75')ms"
  else
    echo "   ℹ️  No CrUX data available for this URL"
  fi
else
  echo "⚠️  CrUX endpoint returned an error:"
  echo "$CRUX_RESPONSE" | jq '.'
fi
echo ""

# Test GSC endpoint
echo "4️⃣  Testing Google Search Console endpoint..."
echo "   GET /api/seo-crawler/google/gsc/$ENCODED_URL"
GSC_RESPONSE=$(curl -s "$BASE_URL/api/seo-crawler/google/gsc/$ENCODED_URL")
if echo "$GSC_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ GSC endpoint is working"
  echo "   Clicks: $(echo "$GSC_RESPONSE" | jq -r '.data.clicks')"
  echo "   Impressions: $(echo "$GSC_RESPONSE" | jq -r '.data.impressions')"
  echo "   CTR: $(echo "$GSC_RESPONSE" | jq -r '.data.ctr')"
  echo "   Position: $(echo "$GSC_RESPONSE" | jq -r '.data.position')"
else
  echo "⚠️  GSC endpoint returned an error (expected if not authenticated):"
  echo "$GSC_RESPONSE" | jq -r '.error'
fi
echo ""

# Test GA4 endpoint
echo "5️⃣  Testing Google Analytics 4 endpoint..."
echo "   GET /api/seo-crawler/google/ga4/$ENCODED_URL"
GA4_RESPONSE=$(curl -s "$BASE_URL/api/seo-crawler/google/ga4/$ENCODED_URL")
if echo "$GA4_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ GA4 endpoint is working"
  echo "   Page Views: $(echo "$GA4_RESPONSE" | jq -r '.data.pageViews')"
  echo "   Bounce Rate: $(echo "$GA4_RESPONSE" | jq -r '.data.bounceRate')"
else
  echo "⚠️  GA4 endpoint returned an error (expected if not authenticated):"
  echo "$GA4_RESPONSE" | jq -r '.error'
fi
echo ""

# Test comprehensive endpoint
echo "6️⃣  Testing Comprehensive SEO Data endpoint..."
echo "   GET /api/seo-crawler/google/comprehensive/$ENCODED_URL"
COMPREHENSIVE_RESPONSE=$(curl -s "$BASE_URL/api/seo-crawler/google/comprehensive/$ENCODED_URL")
if echo "$COMPREHENSIVE_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
  echo "✅ Comprehensive endpoint is working"
  echo "   PageSpeed: $(echo "$COMPREHENSIVE_RESPONSE" | jq -r '.data.pageSpeed != null')"
  echo "   CrUX: $(echo "$COMPREHENSIVE_RESPONSE" | jq -r '.data.crux != null')"
  echo "   GSC: $(echo "$COMPREHENSIVE_RESPONSE" | jq -r '.data.gsc != null')"
  echo "   GA4: $(echo "$COMPREHENSIVE_RESPONSE" | jq -r '.data.ga4 != null')"
else
  echo "⚠️  Comprehensive endpoint returned an error:"
  echo "$COMPREHENSIVE_RESPONSE" | jq '.'
fi
echo ""

echo "=================================="
echo "✅ Google SEO Integration Test Complete"
echo ""
echo "📝 Notes:"
echo "   - PageSpeed/CrUX require GOOGLE_API_KEY"
echo "   - GSC/GA4 require ADC_JSON or GOOGLE_WORKSPACE_REFRESH_TOKEN"
echo "   - Set these in Render environment variables"
echo ""

