#!/bin/bash

# Test Professional Audio Processor
# Tests loudness normalization, true peak limiting, and noise reduction

set -e

echo "🎙️  Testing Professional Audio Processor"
echo "========================================"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"
echo ""

# Check if dependencies are installed
echo "📦 Checking dependencies..."
python3 -c "import pyloudnorm" 2>/dev/null && echo "✅ pyloudnorm installed" || echo "❌ pyloudnorm NOT installed"
python3 -c "import soundfile" 2>/dev/null && echo "✅ soundfile installed" || echo "❌ soundfile NOT installed"
python3 -c "import scipy" 2>/dev/null && echo "✅ scipy installed" || echo "❌ scipy NOT installed"
python3 -c "import noisereduce" 2>/dev/null && echo "✅ noisereduce installed" || echo "⚠️  noisereduce NOT installed (optional)"
python3 -c "import librosa" 2>/dev/null && echo "✅ librosa installed" || echo "⚠️  librosa NOT installed (optional)"
echo ""

# Install missing dependencies
echo "📥 Installing missing dependencies..."
pip3 install -q pyloudnorm soundfile scipy noisereduce librosa 2>/dev/null || true
echo "✅ Dependencies installed"
echo ""

# Create test audio directory
mkdir -p test-audio
cd test-audio

# Generate test audio file (1 second sine wave at 440 Hz)
echo "🎵 Generating test audio file..."
python3 << 'EOF'
import numpy as np
import soundfile as sf

# Generate 1 second of 440 Hz sine wave
sample_rate = 44100
duration = 1.0
t = np.linspace(0, duration, int(sample_rate * duration))
audio = 0.5 * np.sin(2 * np.pi * 440 * t)  # 440 Hz (A4)

# Save as WAV
sf.write('test_input.wav', audio, sample_rate)
print("✅ Test audio generated: test_input.wav")
EOF

# Test 1: Podcast normalization (-16 LUFS)
echo ""
echo "🎚️  Test 1: Podcast Normalization (-16 LUFS)"
echo "--------------------------------------------"
python3 ../server/workers/professional-audio-processor.py \
    test_input.wav \
    test_podcast.wav \
    --target podcast

# Test 2: YouTube normalization (-14 LUFS)
echo ""
echo "🎚️  Test 2: YouTube Normalization (-14 LUFS)"
echo "--------------------------------------------"
python3 ../server/workers/professional-audio-processor.py \
    test_input.wav \
    test_youtube.wav \
    --target youtube

# Test 3: Broadcast normalization (-23 LUFS)
echo ""
echo "🎚️  Test 3: Broadcast Normalization (-23 LUFS)"
echo "-----------------------------------------------"
python3 ../server/workers/professional-audio-processor.py \
    test_input.wav \
    test_broadcast.wav \
    --target broadcast

# Test 4: Custom LUFS target
echo ""
echo "🎚️  Test 4: Custom LUFS Target (-18 LUFS)"
echo "-----------------------------------------"
python3 ../server/workers/professional-audio-processor.py \
    test_input.wav \
    test_custom.wav \
    --custom-lufs -18.0

# Test 5: With noise reduction
echo ""
echo "🎚️  Test 5: With Noise Reduction"
echo "--------------------------------"
python3 ../server/workers/professional-audio-processor.py \
    test_input.wav \
    test_denoise.wav \
    --target podcast \
    --denoise \
    --denoise-strength 0.8

# Test 6: True peak limiter
echo ""
echo "🎚️  Test 6: True Peak Limiter (-1.0 dBTP)"
echo "-----------------------------------------"
python3 ../server/workers/professional-audio-processor.py \
    test_input.wav \
    test_limited.wav \
    --target podcast \
    --true-peak-ceiling -1.0

# Summary
echo ""
echo "========================================"
echo "✅ All tests completed!"
echo ""
echo "📁 Output files:"
ls -lh *.wav | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "🎧 Listen to the files to verify quality"
echo ""

# Cleanup option
read -p "Delete test files? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd ..
    rm -rf test-audio
    echo "✅ Test files deleted"
else
    echo "📁 Test files kept in test-audio/"
fi

