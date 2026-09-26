#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly SOURCE_DIR="$REPO_ROOT/apps/creatorhub-protools-aax"
readonly TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/creatorhub-aax-identity-test.XXXXXX")"

cleanup() {
  local temp_root="${TMPDIR:-/tmp}"
  if [[ "$TEST_ROOT" == "$temp_root"/creatorhub-aax-identity-test.* && -d "$TEST_ROOT" ]]; then
    rm -rf -- "$TEST_ROOT"
  fi
}
trap cleanup EXIT

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$2" "$1"
}

cmake -S "$SOURCE_DIR" -B "$TEST_ROOT/default" >/dev/null
default_manifest="$TEST_ROOT/default/generated/CreatorHubAAXIdentity.plist"
plutil -lint "$default_manifest" >/dev/null
[[ "$(plist_value "$default_manifest" AvidApproved)" == "false" ]]
[[ "$(plist_value "$default_manifest" ManufacturerID)" == "CrHb" ]]

if cmake -S "$SOURCE_DIR" -B "$TEST_ROOT/missing-reference" \
  -DCREATORHUB_AAX_IDS_AVID_APPROVED=ON >/dev/null 2>&1; then
  echo "Approved AAX identities must require an Avid approval reference." >&2
  exit 1
fi

cmake -S "$SOURCE_DIR" -B "$TEST_ROOT/approved" \
  -DCREATORHUB_AAX_MANUFACTURER_ID=ABCD \
  -DCREATORHUB_AAX_PRODUCT_ID=EFGH \
  -DCREATORHUB_AAX_MONO_NATIVE_ID=IJKL \
  -DCREATORHUB_AAX_STEREO_NATIVE_ID=MNOP \
  -DCREATORHUB_AAX_IDS_AVID_APPROVED=ON \
  -DCREATORHUB_AAX_AVID_APPROVAL_REFERENCE=AVID-TEST-123 >/dev/null
approved_manifest="$TEST_ROOT/approved/generated/CreatorHubAAXIdentity.plist"
plutil -lint "$approved_manifest" >/dev/null
[[ "$(plist_value "$approved_manifest" AvidApproved)" == "true" ]]
[[ "$(plist_value "$approved_manifest" AvidApprovalReference)" == "AVID-TEST-123" ]]

if cmake -S "$SOURCE_DIR" -B "$TEST_ROOT/invalid" \
  -DCREATORHUB_AAX_MANUFACTURER_ID=ABC >/dev/null 2>&1; then
  echo "AAX identities must contain exactly four supported characters." >&2
  exit 1
fi

if cmake -S "$SOURCE_DIR" -B "$TEST_ROOT/unsafe-reference" \
  -DCREATORHUB_AAX_IDS_AVID_APPROVED=ON \
  -DCREATORHUB_AAX_AVID_APPROVAL_REFERENCE='AVID<script>' >/dev/null 2>&1; then
  echo "AAX approval references must be safe for the embedded manifest." >&2
  exit 1
fi

echo "AAX production identity guard: PASS"
