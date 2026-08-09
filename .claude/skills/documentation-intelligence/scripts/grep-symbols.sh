#!/bin/sh
# External-API usage map per vendor. Mechanical layer of repo-intelligence.
# Usage: grep-symbols.sh <vendor|all|list> [dir]
# Output: vendor, then file:count of matches.
set -e
DIR="${2:-.}"

patterns() {
  case "$1" in
    resolve)          echo 'GetResolve|ResolveScript|fusionscript|GetMediaPool|GetRenderJobList|AddRenderJob' ;;
    adobe-uxp)        echo 'batchPlay|require\("photoshop"\)|require\("uxp"\)|photoshop_[a-z]|executeAsModal' ;;
    lti)              echo 'fetchPlatform|lineitem|/lti/|id_token|deployment_id|\bNRPS\b|\bAGS\b|dynamic.?registration' ;;
    foundationmodels) echo 'FoundationModels|LanguageModelSession|@Generable|SystemLanguageModel' ;;
    apple-vision)     echo 'VNImageRequestHandler|VNRecognizeText|CIRAWFilter|PKCanvasView' ;;
    google)           echo 'googleapis|sheets\.v4|youtubeAnalytics|driveactivity|oauth2\.googleapis' ;;
    stripe)           echo 'stripe\.|Stripe\(|STRIPE_' ;;
    higgsfield)       echo 'higgsfield|fal\.ai|fal-ai|seedance' ;;
    blender)          echo 'bpy\.|cycles|blender' ;;
    moodle)           echo 'moodle|X-Frame-Options' ;;
    netlify)          echo 'netlify' ;;
    neon)             echo 'neon\.tech|@neondatabase' ;;
    *) return 1 ;;
  esac
}

VENDORS="resolve adobe-uxp lti foundationmodels apple-vision google stripe higgsfield blender moodle netlify neon"

[ "$1" = "list" ] && { echo "$VENDORS" | tr ' ' '\n'; exit 0; }

run_one() {
  echo "== $1 =="
  git -C "$DIR" grep -I -i -E -c "$(patterns "$1")" -- \
    ':!*node_modules*' ':!*.lock' ':!package-lock.json' ':!*.min.js' 2>/dev/null \
    | sort -t: -k2 -rn | head -25 || echo "(no matches)"
}

if [ "$1" = "all" ]; then
  for v in $VENDORS; do run_one "$v"; done
else
  patterns "$1" >/dev/null 2>&1 || { echo "unknown vendor: $1 (use: list)"; exit 1; }
  run_one "$1"
fi
