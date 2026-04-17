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

# 4. Contents — single endpoint on R6 mkII, shape unknown. Capture as-is.
hit contents     "/ccapi/ver120/contents"

# 5. Event polling — stateful. Hit once to see baseline, DELETE to clear, hit again.
hit polling_initial "/ccapi/ver110/event/polling"
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
