#!/bin/bash

# Quick test script for face detection on Martin4k.mp4
# This extracts a frame and tests it with the FaceXFormer API

VIDEO_PATH="/Users/usmanqazi/creatorhub-backend/python_ml_service/training/test_outputs/facexformer/Martin4k.mp4"
OUTPUT_DIR="/Users/usmanqazi/creatorhub-backend/python_ml_service/training/test_outputs/facexformer"
FRAME_OUTPUT="${OUTPUT_DIR}/test_frame_$(date +%s).jpg"
API_URL="http://localhost:3000/api/face-analysis/analyze"

echo "🎬 Face Detection Test for Martin4k.mp4"
echo "========================================"
echo ""

# Check if video exists
if [ ! -f "$VIDEO_PATH" ]; then
    echo "❌ Video file not found: $VIDEO_PATH"
    exit 1
fi

echo "✅ Video file found: $(du -h "$VIDEO_PATH" | cut -f1)"
echo ""

# Check if ffmpeg is available
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg not found. Cannot extract frame automatically."
    echo "💡 Please install ffmpeg or extract a frame manually"
    echo ""
    echo "To extract a frame manually:"
    echo "  ffmpeg -i \"$VIDEO_PATH\" -ss 00:00:02.5 -vframes 1 -q:v 2 \"$FRAME_OUTPUT\""
    exit 1
fi

# Extract frame at 2.5 seconds
echo "📸 Extracting frame at 2.5 seconds..."
ffmpeg -i "$VIDEO_PATH" -ss 00:00:02.5 -vframes 1 -q:v 2 "$FRAME_OUTPUT" -y 2>/dev/null

if [ ! -f "$FRAME_OUTPUT" ]; then
    echo "❌ Failed to extract frame"
    exit 1
fi

echo "✅ Frame extracted: $FRAME_OUTPUT"
echo "   Size: $(du -h "$FRAME_OUTPUT" | cut -f1)"
echo ""

# Test with API
echo "🔍 Testing with FaceXFormer API..."
echo "   API URL: $API_URL"
echo ""

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo "⚠️  curl not found. Cannot test API automatically."
    echo "💡 Please test manually with:"
    echo "   curl -X POST $API_URL -F \"image=@$FRAME_OUTPUT\" -F \"task=all\""
    exit 1
fi

# Test the API
RESPONSE=$(curl -s -X POST "$API_URL" \
    -F "image=@$FRAME_OUTPUT" \
    -F "task=all" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📊 API Response:"
echo "   HTTP Code: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API call successful!"
    echo ""
    echo "📋 Results:"
    
    # Parse JSON response (if jq is available)
    if command -v jq &> /dev/null; then
        echo "$BODY" | jq '.'
        
        # Check for face detection
        HAS_LANDMARKS=$(echo "$BODY" | jq -r '.results.landmarks // empty')
        if [ -n "$HAS_LANDMARKS" ]; then
            LANDMARK_COUNT=$(echo "$BODY" | jq -r '.results.landmarks | length')
            echo ""
            echo "✅ Face detected! Landmarks: $LANDMARK_COUNT points"
        else
            echo ""
            echo "⚠️  No landmarks detected (might not have a face in this frame)"
        fi
        
        # Check head pose
        HAS_HEADPOSE=$(echo "$BODY" | jq -r '.results.headpose // empty')
        if [ -n "$HAS_HEADPOSE" ]; then
            PITCH=$(echo "$BODY" | jq -r '.results.headpose.pitch')
            YAW=$(echo "$BODY" | jq -r '.results.headpose.yaw')
            ROLL=$(echo "$BODY" | jq -r '.results.headpose.roll')
            echo "   Head pose: pitch=${PITCH}°, yaw=${YAW}°, roll=${ROLL}°"
        fi
    else
        echo "$BODY"
        echo ""
        echo "💡 Install 'jq' for better JSON parsing: brew install jq"
    fi
else
    echo "❌ API call failed"
    echo "Response: $BODY"
    echo ""
    echo "💡 Make sure:"
    echo "   1. Backend server is running on port 3000"
    echo "   2. FaceXFormer service is configured"
    echo "   3. API endpoint is correct: $API_URL"
fi

echo ""
echo "📁 Test frame saved at: $FRAME_OUTPUT"
echo "   You can view it or use it for further testing"
