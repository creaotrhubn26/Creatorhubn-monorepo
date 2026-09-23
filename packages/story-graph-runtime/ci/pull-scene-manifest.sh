#!/usr/bin/env bash
# pull-scene-manifest.sh — hent scene-manifestet (manus, replikker, gate-status)
# fra Story Graph inn i spillrepoet. Brukes lokalt og i CI i campfire-games.
#
#   STORY_GRAPH_API_KEY=rri_…            # Role Room API-nøkkel med projects.read
#   STORY_GRAPH_PROJECT_ID=what-follows-us-ep1-2026
#   STORY_GRAPH_BASE_URL=https://theroleroom.com   (valgfri)
#   ./pull-scene-manifest.sh Resources/StoryGraph/wfu-manifest.json
#
# Går via MCP-endepunktet (API-nøkkel, ikke brukersesjon), verktøy
# rr_export_scene_manifest. Skriver bare fila når contentHash er endret, så
# bygget ikke får diff uten innholdsendring. Exit 0 = ok/uendret, 1 = feil.
set -euo pipefail

OUT="${1:?Bruk: pull-scene-manifest.sh <utfil.json>}"
BASE="${STORY_GRAPH_BASE_URL:-https://theroleroom.com}"
: "${STORY_GRAPH_API_KEY:?STORY_GRAPH_API_KEY mangler}"
: "${STORY_GRAPH_PROJECT_ID:?STORY_GRAPH_PROJECT_ID mangler}"
command -v jq >/dev/null || { echo "jq er påkrevd" >&2; exit 1; }

body=$(jq -n --arg p "$STORY_GRAPH_PROJECT_ID" \
  '{jsonrpc:"2.0", id:1, method:"tools/call", params:{name:"rr_export_scene_manifest", arguments:{projectId:$p}}}')

resp=$(curl -fsS -X POST "$BASE/api/role-room/mcp" \
  -H "Authorization: Bearer $STORY_GRAPH_API_KEY" \
  -H "Content-Type: application/json" \
  --data "$body")

if [ "$(jq -r '.error.message // empty' <<<"$resp")" != "" ]; then
  echo "Story Graph svarte med feil: $(jq -r '.error.message' <<<"$resp")" >&2
  exit 1
fi

manifest=$(jq '.result.structuredContent' <<<"$resp")
schema=$(jq -r '.schema // empty' <<<"$manifest")
if [ "$schema" != "story-graph.scene-manifest" ]; then
  echo "Uventet svar (schema=$schema)" >&2
  exit 1
fi

new_hash=$(jq -r '.contentHash' <<<"$manifest")
old_hash=""
[ -f "$OUT" ] && old_hash=$(jq -r '.contentHash // empty' "$OUT" 2>/dev/null || true)
if [ "$new_hash" = "$old_hash" ]; then
  echo "Uendret ($new_hash)"
  exit 0
fi

mkdir -p "$(dirname "$OUT")"
jq '.' <<<"$manifest" > "$OUT"
echo "Skrev $OUT: $(jq '.scenes | length' "$OUT") scener, $(jq '[.scenes[].lines | length] | add // 0' "$OUT") replikker ($new_hash)"
