#!/bin/bash
# Start Virtual Studio AI Workers
# This script starts both scene analysis and pose detection workers

echo "🚀 Starting Virtual Studio AI Workers..."

# Check if Redis is available
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redis is not running. Please start Redis first."
    exit 1
fi

# Check Python dependencies
echo "📦 Checking Python dependencies..."
python3 -c "import sam2" 2>/dev/null || echo "⚠️  SAM 2 not installed"
python3 -c "import mediapipe" 2>/dev/null || echo "⚠️  MediaPipe not installed - run: pip install mediapipe"

# Start workers in background
echo "🔧 Starting Scene Analysis Worker..."
cd "$(dirname "$0")"
python3 server/workers/scene-analysis-worker.py &
SCENE_WORKER_PID=$!
echo "   PID: $SCENE_WORKER_PID"

echo "🔧 Starting Pose Detection Worker..."
python3 server/workers/pose-detection-worker.py &
POSE_WORKER_PID=$!
echo "   PID: $POSE_WORKER_PID"

echo ""
echo "✅ Workers started!"
echo "   Scene Analysis Worker PID: $SCENE_WORKER_PID"
echo "   Pose Detection Worker PID: $POSE_WORKER_PID"
echo ""
echo "To stop workers:"
echo "   kill $SCENE_WORKER_PID $POSE_WORKER_PID"
echo ""
echo "To view logs, check the terminal output or run:"
echo "   tail -f /tmp/virtual-studio-*.log"

# Save PIDs to file for easy stopping
echo "$SCENE_WORKER_PID $POSE_WORKER_PID" > /tmp/virtual-studio-workers.pid


























