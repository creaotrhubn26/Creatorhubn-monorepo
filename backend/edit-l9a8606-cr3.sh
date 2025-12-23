#!/bin/bash
# Script to process and edit _L9A8606.CR3

RAW_FILE="/Users/usmanqazi/creatorhub-frontend/client/src/assets/_L9A8606.CR3"
API_URL="http://localhost:5050"

echo "🎯 Processing CR3 file: _L9A8606.CR3"
echo "📁 File size: $(du -h "$RAW_FILE" | cut -f1)"
echo ""

# Step 1: Process RAW file
echo "Step 1: Processing RAW file..."
RESPONSE=$(curl -s -X POST "$API_URL/api/universal-raw/process" \
  -F "rawFile=@$RAW_FILE" \
  -F "outputFormat=tiff" \
  -F "quality=95" \
  -F "colorSpace=adobe_rgb" \
  -F "whiteBalance=auto" \
  -F "lensCorrection=true" \
  -F "chromaticAberration=true" \
  -F "vignetting=true" \
  -F "distortion=true" \
  -F "enhancementType=denoise")

echo "$RESPONSE" | jq '.'
echo ""

# Extract processed path from response
PROCESSED_PATH=$(echo "$RESPONSE" | jq -r '.result.processedPath // empty')

if [ -z "$PROCESSED_PATH" ]; then
  echo "❌ Failed to process RAW file"
  exit 1
fi

echo "✅ RAW processed: $PROCESSED_PATH"
echo ""
echo "Step 2: Ready to create editing session with processed image"
echo "Use the processedPath in your photo editing session creation"
