#!/usr/bin/env bash
# Usage: ./ccapi-probe.sh [base-url]
# Default: https://192.168.1.2:443 (Canon AP-mode default)
#
# Run while Mac is joined to the camera's Access Point. Saves every response
# to /tmp/ccapi-probe-<timestamp>/ so you only need to visit the AP once.
# After running, reconnect to regular Wi-Fi and cat the files into chat.

set -u

BASE="${1:-https://192.168.1.2:443}"
OUT="/tmp/ccapi-probe-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

echo "Probing $BASE → $OUT"
echo

hit() {
  local name="$1" path="$2" method="${3:-GET}"
  local file="$OUT/${name}.json"
  local headers="$OUT/${name}.headers"
  echo "==> $method $path"
  curl -sS -k -m 10 \
    -X "$method" \
    -D "$headers" \
    -o "$file" \
    -w "HTTP %{http_code} · %{size_download}B · %{time_total}s\n" \
    "$BASE$path" || echo "(request failed)"
}

# 1. Capability discovery
hit inventory "/ccapi"

# 2. Device identity
hit deviceinformation "/ccapi/ver100/deviceinformation"

# 3. Status
hit battery      "/ccapi/ver100/devicestatus/battery"
hit batterylist  "/ccapi/ver110/devicestatus/batterylist"
hit lens         "/ccapi/ver100/devicestatus/lens"
hit temperature  "/ccapi/ver100/devicestatus/temperature"
hit storage      "/ccapi/ver110/devicestatus/storage"
hit currentstore "/ccapi/ver110/devicestatus/currentstorage"
hit currentdir   "/ccapi/ver110/devicestatus/currentdirectory"

# 4. Contents walk — top-level returns storage paths, then drill into card+dir.
hit contents_root    "/ccapi/ver120/contents"
hit contents_card1   "/ccapi/ver120/contents/card1"
hit contents_dcim    "/ccapi/ver120/contents/card1/100CANON"
# Canon usually supports ?type=filter and ?kind=list|info; capture both variants.
hit contents_dcim_list "/ccapi/ver120/contents/card1/100CANON?kind=list"
hit contents_dcim_info "/ccapi/ver120/contents/card1/100CANON?kind=info"

# 5. Event polling — stateful. Snapshot, capture a frame, then diff.
hit polling_initial "/ccapi/ver110/event/polling"

echo "==> POST /ccapi/ver100/shooting/control/shutterbutton/manual full_press (af:false)"
curl -sS -k -m 10 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"full_press","af":false}' \
  -D "$OUT/shutter.headers" \
  -o "$OUT/shutter.json" \
  -w "HTTP %{http_code} · %{size_download}B · %{time_total}s\n" \
  "$BASE/ccapi/ver100/shooting/control/shutterbutton/manual" || true

echo "==> POST /ccapi/ver100/shooting/control/shutterbutton/manual release"
curl -sS -k -m 10 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"release","af":false}' \
  -D "$OUT/shutter_release.headers" \
  -o "$OUT/shutter_release.json" \
  -w "HTTP %{http_code} · %{size_download}B · %{time_total}s\n" \
  "$BASE/ccapi/ver100/shooting/control/shutterbutton/manual" || true

# Wait for camera to write to card, then poll for the diff.
sleep 3
hit polling_after_capture "/ccapi/ver110/event/polling"
hit contents_dcim_after   "/ccapi/ver120/contents/card1/100CANON"

hit polling_clear   "/ccapi/ver110/event/polling" DELETE
hit polling_after   "/ccapi/ver110/event/polling"

# 6. Event monitoring — separate endpoint. Likely SSE; GET will just return
#    whatever the camera considers the current snapshot, or block. 5s timeout.
echo "==> GET /ccapi/ver100/event/monitoring (5s cap)"
curl -sS -k -m 5 \
  -D "$OUT/monitoring.headers" \
  -o "$OUT/monitoring.raw" \
  -w "HTTP %{http_code} · %{size_download}B · %{time_total}s\n" \
  "$BASE/ccapi/ver100/event/monitoring" || true

echo
echo "Done. Files:"
ls -la "$OUT"
echo
echo "Paste the following into chat:"
echo "  for f in $OUT/*.json $OUT/*.headers $OUT/monitoring.raw; do"
echo "    echo \"=== \$f ===\"; cat \"\$f\"; echo;"
echo "  done"
