#!/bin/bash
# Execute this script to start service and remove eye bags
# Run in Terminal.app (not Cursor's terminal)

echo "🚀 Starting Python ML Service..."
cd /Users/usmanqazi/creatorhub-backend/python_ml_service

# Kill any existing service
pkill -f "python.*main.py" 2>/dev/null
sleep 2

# Start service
python main.py > /tmp/python_ml_service.log 2>&1 &
SERVICE_PID=$!
echo $SERVICE_PID > /tmp/python_ml_service.pid
echo "✅ Service started (PID: $SERVICE_PID)"
echo "⏳ Waiting 15 seconds for service to initialize..."
sleep 15

# Check service
echo ""
echo "🔍 Checking service status..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Main service is running"
    curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || echo "Service responding"
else
    echo "⚠️ Service not responding, check logs: /tmp/python_ml_service.log"
    tail -20 /tmp/python_ml_service.log
    exit 1
fi

echo ""
echo "🔍 Checking eye bag removal service..."
if curl -s http://localhost:8000/api/eye-bag-removal/health > /dev/null 2>&1; then
    echo "✅ Eye bag removal service is running"
    curl -s http://localhost:8000/api/eye-bag-removal/health | python3 -m json.tool 2>/dev/null
else
    echo "⚠️ Eye bag service not ready (will use GLSL fallback)"
fi

echo ""
echo "🎨 Running portrait enhancement with eye bag removal..."
echo ""
cd /Users/usmanqazi/creatorhub-backend
npx tsx scripts/enhance-portrait.ts

echo ""
echo "✅ Complete!"
echo "📁 Check output: /Users/usmanqazi/creatorhub-frontend/client/src/assets/daniel-qazi_enhanced.jpg"

