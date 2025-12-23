#!/bin/bash

# Run Blender generation script for photorealistic modifiers
# This script checks for Blender installation and runs the generation

echo "=========================================="
echo "🎨 Blender Modifier Generator"
echo "=========================================="
echo ""

# Check if Blender is installed
if command -v blender &> /dev/null; then
    BLENDER_CMD="blender"
    echo "✅ Found Blender: $(blender --version | head -n 1)"
elif [ -f "/Applications/Blender.app/Contents/MacOS/Blender" ]; then
    BLENDER_CMD="/Applications/Blender.app/Contents/MacOS/Blender"
    echo "✅ Found Blender (macOS): $BLENDER_CMD"
elif [ -f "/usr/bin/blender" ]; then
    BLENDER_CMD="/usr/bin/blender"
    echo "✅ Found Blender (Linux): $BLENDER_CMD"
else
    echo "❌ ERROR: Blender not found!"
    echo ""
    echo "Please install Blender 3.0+ from:"
    echo "  https://www.blender.org/download/"
    echo ""
    echo "Installation options:"
    echo "  • macOS: Download from website or 'brew install --cask blender'"
    echo "  • Linux: 'sudo apt install blender' or 'sudo snap install blender'"
    echo "  • Windows: Download from website"
    exit 1
fi

echo ""
echo "🚀 Starting generation..."
echo ""

# Run Blender in background mode with the Python script
$BLENDER_CMD --background --python generate_modifiers_blender.py

echo ""
echo "=========================================="
echo "✅ Generation Complete!"
echo "=========================================="
echo ""
echo "📁 Check output in:"
echo "   ../public/models/modifiers/"
echo ""

