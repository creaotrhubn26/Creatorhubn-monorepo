#!/bin/bash

# Setup Google SEO API Environment Variables in Render
# This script adds the required Google API environment variables to Render

RENDER_API_KEY="rnd_rH0675zL2giMgpYDbsrxEAMXSWxe"
SERVICE_ID="srv-d47s5lur433s739mr9j0"
BASE_URL="https://api.render.com/v1"

echo "🔧 Setting up Google SEO API Environment Variables in Render"
echo "=============================================================="
echo ""

# Function to add or update an environment variable
add_env_var() {
  local key=$1
  local value=$2
  local description=$3
  
  echo "📝 Setting $key..."
  
  # Check if the env var already exists
  existing=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    "$BASE_URL/services/$SERVICE_ID/env-vars" | \
    jq -r ".[] | select(.key == \"$key\") | .id")
  
  if [ -n "$existing" ]; then
    # Update existing
    response=$(curl -s -X PUT \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"value\": \"$value\"}" \
      "$BASE_URL/services/$SERVICE_ID/env-vars/$existing")
    
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
      echo "   ✅ Updated $key"
    else
      echo "   ❌ Failed to update $key"
      echo "   Error: $(echo "$response" | jq -r '.message // .error // "Unknown error"')"
    fi
  else
    # Create new
    response=$(curl -s -X POST \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"key\": \"$key\", \"value\": \"$value\"}" \
      "$BASE_URL/services/$SERVICE_ID/env-vars")
    
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
      echo "   ✅ Created $key"
    else
      echo "   ❌ Failed to create $key"
      echo "   Error: $(echo "$response" | jq -r '.message // .error // "Unknown error"')"
    fi
  fi
}

echo "1️⃣  Adding GOOGLE_API_KEY (placeholder - needs real key)"
add_env_var "GOOGLE_API_KEY" "your_google_api_key_here" "Google API Key for PageSpeed Insights and CrUX"
echo ""

echo "2️⃣  Adding GA4_PROPERTY_ID (placeholder - needs real ID)"
add_env_var "GA4_PROPERTY_ID" "123456789" "Google Analytics 4 Property ID (numeric)"
echo ""

echo "3️⃣  Adding GSC_SITE_URL"
add_env_var "GSC_SITE_URL" "sc-domain:creatorhubn.com" "Google Search Console Site URL"
echo ""

echo "4️⃣  Adding ADC_JSON (placeholder - needs real service account JSON)"
add_env_var "ADC_JSON" "{\"type\":\"service_account\",\"project_id\":\"your-project\",\"private_key_id\":\"placeholder\",\"private_key\":\"placeholder\",\"client_email\":\"placeholder@your-project.iam.gserviceaccount.com\"}" "Google Service Account JSON for GSC/GA4 authentication"
echo ""

echo "=============================================================="
echo "✅ Environment variables setup complete!"
echo ""
echo "⚠️  IMPORTANT: You need to replace the placeholder values with real credentials:"
echo ""
echo "1. GOOGLE_API_KEY:"
echo "   - Go to: https://console.cloud.google.com/"
echo "   - Enable: PageSpeed Insights API & Chrome UX Report API"
echo "   - Create API Key"
echo ""
echo "2. GA4_PROPERTY_ID:"
echo "   - Go to: GA4 Admin → Property Settings"
echo "   - Copy the numeric Property ID (NOT the G-xxxxx measurement ID)"
echo ""
echo "3. ADC_JSON:"
echo "   - Go to: Google Cloud Console → IAM & Admin → Service Accounts"
echo "   - Create service account with Search Console API & Analytics API permissions"
echo "   - Create JSON key and copy the entire JSON content"
echo ""
echo "4. Update these values in Render Dashboard:"
echo "   https://dashboard.render.com/web/$SERVICE_ID/env"
echo ""

