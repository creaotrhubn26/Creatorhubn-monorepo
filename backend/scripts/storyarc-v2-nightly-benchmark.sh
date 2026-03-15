#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

MANIFEST_PATH="${STORYARC_GOLDEN_MANIFEST:-scripts/storyarc-v2-golden.manifest.example.json}"
BASE_URL="${STORYARC_BASE_URL:-http://127.0.0.1:3003}"
OUTPUT_PATH="${STORYARC_GOLDEN_OUTPUT:-tmp/storyarc-v2-golden-nightly-latest.json}"

echo "[storyarc-v2-nightly] base-url=${BASE_URL}"
echo "[storyarc-v2-nightly] manifest=${MANIFEST_PATH}"
echo "[storyarc-v2-nightly] output=${OUTPUT_PATH}"

./node_modules/.bin/tsx scripts/storyarc-v2-golden-benchmark.ts \
  --manifest "${MANIFEST_PATH}" \
  --base-url "${BASE_URL}" \
  --output "${OUTPUT_PATH}" \
  --nightly true \
  --fail-on-regression true \
  --compare-with-last-nightly true
