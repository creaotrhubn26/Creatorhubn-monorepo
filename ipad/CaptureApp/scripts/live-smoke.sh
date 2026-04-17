#!/usr/bin/env bash
# Usage: ./live-smoke.sh [base-url]
# Default: https://192.168.1.2
#
# Run while the Mac is joined to the camera's Access Point. Fires the
# CCAPILiveSmokeTests suite against real hardware and captures the result
# bundle so we can inspect what the camera actually returned.

set -eu

BASE="${1:-https://192.168.1.2}"
RESULT="/tmp/ccapi-live-$(date +%Y%m%d-%H%M%S).xcresult"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "Running live smoke against $BASE"
echo "Result bundle: $RESULT"
echo

TEST_RUNNER_CCAPI_LIVE_URL="$BASE" \
  xcodebuild test \
    -project CaptureApp.xcodeproj \
    -scheme CaptureApp \
    -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5)' \
    -only-testing:CaptureAppTests/CCAPILiveSmokeTests \
    -resultBundlePath "$RESULT" 2>&1 | \
  grep -E "(Test Case|LIVE ·|error:|Executed)" || true

echo
echo "Full result bundle: $RESULT"
