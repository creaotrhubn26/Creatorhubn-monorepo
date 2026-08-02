#!/usr/bin/env bash
#
# capture-mockups.sh — lag landing-mockups fra EKTE app-UI, med full kontroll
# over hva som vises inne i dem.
#
#   ./capture-mockups.sh <recipe>
#   ./capture-mockups.sh oversikt          # ett skjermbilde
#   ./capture-mockups.sh all               # alle recipes under
#
# Hvordan du styrer innholdet (kort):
#   • QA_TAB   = hvilken skjerm (0 Oversikt · 1 Kart · 2 Leads · 3 Møter ·
#                4 Leadbook · 5 Go · 6 Salgsledelse · 7 Kvalitet)
#   • QA_DEMO=1  seeder demo-data (leads/dørsalg/selgere) uten backend
#   • QA_TOUR=<navn>  hopper over innlogging (demo-token) — kreves i sim
#   • QA_CAPTURE=1    kollapser sidepanel → rent «detalj»-utsnitt
#   Endre QA-verdiene i recipe-tabellen under for å bestemme hva som vises.
#
# Apple-konsistent chrome (09:41, fullt signal/batteri) settes via
# `simctl status_bar override`, så klokka er alltid riktig og lik Apples egne.
#
# Krever: Xcode-sim, python3 + Pillow (pip3 install pillow), et bygget
# LeadMapApp.app (se BUILD under).
set -euo pipefail

BUNDLE_ID="com.creatorhubn.LeadMapApp"
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJ_DIR="$(cd "$HERE/.." && pwd)"
OUT_DIR="${OUT_DIR:-$PROJ_DIR/../../frontend/client/public/leadgrid}"
FRAMER="$HERE/frame_mockup.py"
TMP="$(mktemp -d)"

# Simulator-enheter (bytt om du vil ha andre modeller — bruk `xcrun simctl list`)
IPHONE_NAME="${IPHONE_NAME:-iPhone 17 Pro}"
IPAD_NAME="${IPAD_NAME:-iPad Pro 13-inch (M5)}"

# Bygg .app om den ikke er oppgitt. Overstyr med APP_PATH=… for å gjenbruke.
APP_PATH="${APP_PATH:-}"
build_app() {
  [ -n "$APP_PATH" ] && [ -d "$APP_PATH" ] && return
  echo "→ bygger LeadMapApp (Debug, simulator)…"
  ( cd "$PROJ_DIR" && xcodegen generate >/dev/null 2>&1 || true
    xcodebuild build -project LeadMapApp.xcodeproj -scheme LeadMapApp \
      -destination "generic/platform=iOS Simulator" \
      -derivedDataPath "$TMP/dd" -quiet )
  APP_PATH="$TMP/dd/Build/Products/Debug-iphonesimulator/LeadMapApp.app"
}

udid_for() { xcrun simctl list devices available | grep -F "$1 (" | head -1 | grep -oE "[0-9A-F-]{36}"; }
boot()    { xcrun simctl bootstatus "$1" -b >/dev/null 2>&1 || xcrun simctl boot "$1" >/dev/null 2>&1 || true; }

# capture <udid> <QA-env-string> <radius> <bezel> <out-navn>
capture() {
  local udid="$1" env="$2" radius="$3" bezel="$4" name="$5"
  xcrun simctl install "$udid" "$APP_PATH" >/dev/null
  # Apple-konsistent status-bar (samme klokke som Apples marketing).
  xcrun simctl status_bar "$udid" override \
    --time "09:41" --dataNetwork "5g" --wifiMode active --wifiBars 3 \
    --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100 >/dev/null
  xcrun simctl terminate "$udid" "$BUNDLE_ID" >/dev/null 2>&1 || true
  # shellcheck disable=SC2086
  env $env xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null
  sleep 6
  xcrun simctl io "$udid" screenshot "$TMP/$name-raw.png" >/dev/null
  python3 "$FRAMER" "$TMP/$name-raw.png" "$OUT_DIR/app/$name.png" --radius "$radius" --bezel "$bezel"
  # webp-variant (landing bruker .webp)
  sips -s format webp "$OUT_DIR/app/$name.png" --out "$OUT_DIR/app/$name.webp" >/dev/null 2>&1 || true
  echo "✓ $name → $OUT_DIR/app/$name.{png,webp}"
}

# ── Recipes ──────────────────────────────────────────────────────────────
# Rediger QA-strengen for å bestemme skjerm + data. Legg til egne linjer.
run_recipe() {
  case "$1" in
    oversikt) capture "$IP" "SIMCTL_CHILD_QA_TOUR=demo SIMCTL_CHILD_QA_DEMO=1 SIMCTL_CHILD_QA_TAB=0" 0.09 16 "shot-oversikt" ;;
    leads)    capture "$IP" "SIMCTL_CHILD_QA_TOUR=demo SIMCTL_CHILD_QA_DEMO=1 SIMCTL_CHILD_QA_TAB=2" 0.09 16 "shot-leads" ;;
    kvalitet) capture "$IP" "SIMCTL_CHILD_QA_TOUR=demo SIMCTL_CHILD_QA_DEMO=1 SIMCTL_CHILD_QA_TAB=7" 0.09 16 "shot-kvalitet" ;;
    *) echo "ukjent recipe: $1 (se tabellen i scriptet)"; exit 1 ;;
  esac
}

build_app
IP="$(udid_for "$IPHONE_NAME")"; [ -z "$IP" ] && { echo "fant ikke sim: $IPHONE_NAME"; exit 1; }
boot "$IP"

if [ "${1:-}" = "all" ]; then
  for r in oversikt leads kvalitet; do run_recipe "$r"; done
else
  run_recipe "${1:?bruk: capture-mockups.sh <recipe|all>}"
fi

# Rydd status-bar-override så simulatoren er normal etterpå.
xcrun simctl status_bar "$IP" clear >/dev/null 2>&1 || true
rm -rf "$TMP"
echo "ferdig."
