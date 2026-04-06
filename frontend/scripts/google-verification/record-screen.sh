#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <output.mov> [seconds] [display]"
  exit 1
fi

OUTPUT_PATH="$1"
DURATION="${2:-180}"
DISPLAY_ID="${3:-1}"

mkdir -p "$(dirname "$OUTPUT_PATH")"
rm -f "$OUTPUT_PATH"

echo "Recording display ${DISPLAY_ID} for ${DURATION}s to ${OUTPUT_PATH}"
screencapture -V "$DURATION" -D "$DISPLAY_ID" -x "$OUTPUT_PATH"
echo "Saved recording to ${OUTPUT_PATH}"
