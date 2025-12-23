#!/bin/bash

# Quick script to start backend for face detection testing

echo "🚀 Starting CreatorHub Backend Server..."
echo ""

cd /Users/usmanqazi/creatorhub-backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Python ML service is needed
echo "💡 Starting backend server..."
echo "   This will start on http://localhost:3000"
echo ""
echo "   Face Analysis API will be at:"
echo "   http://localhost:3000/api/face-analysis/analyze"
echo ""

# Start the server
npm run dev
