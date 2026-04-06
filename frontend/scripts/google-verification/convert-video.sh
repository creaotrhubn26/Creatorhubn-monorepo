#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <input.mov> <output.mp4>"
  exit 1
fi

INPUT_PATH="$1"
OUTPUT_PATH="$2"

mkdir -p "$(dirname "$OUTPUT_PATH")"
rm -f "$OUTPUT_PATH"

ffmpeg -y -i "$INPUT_PATH" \
  -c:v libx264 \
  -preset medium \
  -crf 22 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  "$OUTPUT_PATH"

echo "Converted ${INPUT_PATH} -> ${OUTPUT_PATH}"
