#!/bin/bash
set -e

echo "🚀 Starting Python ML Service..."
cd /Users/usmanqazi/creatorhub-backend/python_ml_service
python main.py > /tmp/python_ml_service.log 2>&1 &
SERVICE_PID=$!
echo $SERVICE_PID > /tmp/python_ml_service.pid
echo "✅ Service started (PID: $SERVICE_PID)"
echo "⏳ Waiting for service to initialize..."
sleep 10

echo ""
echo "🔍 Checking service health..."
curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null || echo "Service not ready yet"

echo ""
echo "🔍 Checking eye bag removal service..."
curl -s http://localhost:8000/api/eye-bag-removal/health | python3 -m json.tool 2>/dev/null || echo "Eye bag service not ready"

echo ""
echo "🎨 Running portrait enhancement with eye bag removal..."
cd /Users/usmanqazi/creatorhub-backend
npx tsx scripts/enhance-portrait.ts

echo ""
echo "✅ Complete! Check the output files."

