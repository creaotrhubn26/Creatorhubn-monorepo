#!/usr/bin/env bash
# Archive CreatorHub One + upload to TestFlight without fastlane.
# Use this when setting up CI on a box where installing the
# fastlane gem is friction (e.g. sandboxed CI image).
#
# Prereqs on the running machine:
#   - Xcode 16.4+
#   - An App Store Connect API key in ~/.appstoreconnect/private_keys/
#   - Automatic signing enabled for the CaptureApp target, or a
#     provisioning profile matching com.creatorhubn.capture
#
# Env vars this script expects:
#   APP_STORE_CONNECT_API_KEY_ID
#   APP_STORE_CONNECT_API_ISSUER_ID
#   APP_STORE_CONNECT_API_KEY_PATH   # absolute path to .p8 file
#
# Usage:
#   ./scripts/archive-and-upload.sh [build_number]
#     build_number defaults to seconds since epoch so each run
#     produces a unique CFBundleVersion.
set -euo pipefail

BUILD_NUMBER="${1:-$(date +%s)}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${PROJECT_DIR}/build"
ARCHIVE_PATH="${BUILD_DIR}/CaptureApp.xcarchive"
IPA_PATH="${BUILD_DIR}/CreatorHubOne.ipa"

mkdir -p "${BUILD_DIR}"

echo "▶ Archiving (build ${BUILD_NUMBER})…"
xcodebuild \
  -project "${PROJECT_DIR}/CaptureApp.xcodeproj" \
  -scheme CaptureApp \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "${ARCHIVE_PATH}" \
  CURRENT_PROJECT_VERSION="${BUILD_NUMBER}" \
  archive

echo "▶ Exporting IPA…"
xcodebuild \
  -exportArchive \
  -archivePath "${ARCHIVE_PATH}" \
  -exportOptionsPlist "${PROJECT_DIR}/ExportOptions.plist" \
  -exportPath "${BUILD_DIR}"

# xcodebuild names the IPA after the scheme; rename for clarity.
if [[ -f "${BUILD_DIR}/CaptureApp.ipa" ]]; then
  mv "${BUILD_DIR}/CaptureApp.ipa" "${IPA_PATH}"
fi

echo "▶ Validating…"
xcrun altool --validate-app \
  -f "${IPA_PATH}" \
  -t ios \
  --apiKey "${APP_STORE_CONNECT_API_KEY_ID}" \
  --apiIssuer "${APP_STORE_CONNECT_API_ISSUER_ID}"

echo "▶ Uploading to TestFlight…"
xcrun altool --upload-app \
  -f "${IPA_PATH}" \
  -t ios \
  --apiKey "${APP_STORE_CONNECT_API_KEY_ID}" \
  --apiIssuer "${APP_STORE_CONNECT_API_ISSUER_ID}"

echo "✓ Upload complete. TestFlight needs ~10 minutes to process."
