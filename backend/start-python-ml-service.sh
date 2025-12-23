#!/bin/bash

# 🚀 Start Python ML Service for High Success Rate Eye Bag Removal
# This service provides GFPGAN + CodeFormer + RetinaFace (95%+ success rate)

echo "🚀 Starting Python ML Service..."
echo "=================================="
echo ""

cd /Users/usmanqazi/creatorhub-backend/python_ml_service

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️ Virtual environment not found. Creating..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ ! -f ".deps_installed" ]; then
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt
    touch .deps_installed
fi

# Start the service
echo ""
echo "✅ Starting Python ML Service on http://localhost:8000"
echo "   - High Success Rate Eye Bag Removal: /api/high-success-eye-bag-removal"
echo "   - Standard Eye Bag Removal: /api/eye-bag-removal"
echo "   - API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

