#!/bin/bash
# Simple script to start service and run eye bag removal

echo "🚀 Starting Python ML Service..."
cd /Users/usmanqazi/creatorhub-backend/python_ml_service

# Start service in background
python main.py > /tmp/python_ml_service.log 2>&1 &
SERVICE_PID=$!
echo $SERVICE_PID > /tmp/python_ml_service.pid
echo "✅ Service started (PID: $SERVICE_PID)"
echo "⏳ Waiting 12 seconds for service to initialize..."

# Wait for service to start
sleep 12

# Check if service is running
if ps -p $SERVICE_PID > /dev/null; then
    echo "✅ Service is running"
    
    # Check health
    echo ""
    echo "🔍 Checking service health..."
    curl -s http://localhost:8000/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "⚠️ Service not responding yet"
    
    echo ""
    echo "🔍 Checking eye bag removal service..."
    curl -s http://localhost:8000/api/eye-bag-removal/health 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "⚠️ Eye bag service not ready"
else
    echo "❌ Service failed to start. Check /tmp/python_ml_service.log"
    exit 1
fi

echo ""
echo "🎨 Running portrait enhancement with eye bag removal..."
cd /Users/usmanqazi/creatorhub-backend
npx tsx scripts/enhance-portrait.ts

echo ""
echo "✅ Complete!"
echo "📁 Check output: /Users/usmanqazi/creatorhub-frontend/client/src/assets/daniel-qazi_enhanced.jpg"

