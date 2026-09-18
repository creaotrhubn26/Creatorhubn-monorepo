#!/usr/bin/env bash
# Story Graph — send gate-bevis fra CI (Fase 8c).
#
# Setter en leveransegate på en scene i Story Graph med bevis, signert med HMAC-SHA256
# over rå JSON-body. Valgfritt lastes en artefakt (xcresult-zip, rapport, skjermbilde)
# opp først og legges i evidenceRefs som «asset:<id>» så den kan lastes ned fra gate-fanen.
#
# Bruk:
#   STORYGRAPH_HOOK_URL=https://<backend>/api/role-room/narrative/hooks/ci/<hookId> \
#   STORYGRAPH_HOOK_SECRET=sgh_… \
#   post-gate-evidence.sh --scene P01 --gate greybox --status passed \
#     --evidence "68 bestått, 0 feil (Prologue-P01-Final)" \
#     [--artifact build/Prologue-P01-Final.xcresult.zip] [--commit "$GITHUB_SHA"] \
#     [--run-url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"] [--build 1.0.42]
#
# Gater: script_coverage | greybox | characters_animation | playthrough | picture | audio
# Status: passed | failed | in_progress   («passed» krever --evidence, ellers avvises leveringen)
# Krever: curl, openssl, python3 (JSON-bygging). Hemmeligheten logges aldri.
set -euo pipefail

scene=""; gate=""; status=""; evidence=""; artifact=""; commit=""; run_url=""; build=""
while [ $# -gt 0 ]; do
  case "$1" in
    --scene) scene="$2"; shift 2;;
    --gate) gate="$2"; shift 2;;
    --status) status="$2"; shift 2;;
    --evidence) evidence="$2"; shift 2;;
    --artifact) artifact="$2"; shift 2;;
    --commit) commit="$2"; shift 2;;
    --run-url) run_url="$2"; shift 2;;
    --build) build="$2"; shift 2;;
    -h|--help) sed -n 2,20p "$0"; exit 0;;
    *) echo "Ukjent argument: $1" >&2; exit 2;;
  esac
done
: "${STORYGRAPH_HOOK_URL:?STORYGRAPH_HOOK_URL mangler}"
: "${STORYGRAPH_HOOK_SECRET:?STORYGRAPH_HOOK_SECRET mangler}"
[ -n "$scene" ] && [ -n "$gate" ] && [ -n "$status" ] || { echo "--scene, --gate og --status er påkrevd" >&2; exit 2; }

hook_id="${STORYGRAPH_HOOK_URL##*/}"
refs=()

if [ -n "$artifact" ]; then
  [ -f "$artifact" ] || { echo "Artefakt finnes ikke: $artifact" >&2; exit 2; }
  upload="$(curl -fsS -X POST "${STORYGRAPH_HOOK_URL}/evidence" \
    -H "X-StoryGraph-Hook: ${hook_id}:${STORYGRAPH_HOOK_SECRET}" \
    -F "scene=${scene}" -F "gate=${gate}" -F "file=@${artifact}")"
  ref="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("ref",""))' <<<"$upload")"
  [ -n "$ref" ] || { echo "Opplasting ga ingen asset-ref: $upload" >&2; exit 1; }
  refs+=("$ref")
  echo "Artefakt lastet opp: $ref"
fi

body="$(SCENE="$scene" GATE="$gate" STATUS="$status" EVIDENCE="$evidence" COMMIT="$commit" RUN_URL="$run_url" BUILD="$build" REFS="$(IFS=$'\n'; echo "${refs[*]:-}")" python3 - <<'PY'
import json, os
p = {"scene": os.environ["SCENE"], "gate": os.environ["GATE"], "status": os.environ["STATUS"]}
if os.environ.get("EVIDENCE"): p["evidence"] = os.environ["EVIDENCE"]
refs = [r for r in os.environ.get("REFS", "").split("\n") if r]
if refs: p["evidenceRefs"] = refs
if os.environ.get("COMMIT"): p["commitSha"] = os.environ["COMMIT"]
if os.environ.get("RUN_URL"): p["runUrl"] = os.environ["RUN_URL"]
if os.environ.get("BUILD"): p["build"] = os.environ["BUILD"]
print(json.dumps(p, ensure_ascii=False, separators=(",", ":")))
PY
)"

signature="sha256=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$STORYGRAPH_HOOK_SECRET" | sed 's/^.* //')"
response="$(curl -sS -o /tmp/storygraph-gate-response.json -w '%{http_code}' -X POST "$STORYGRAPH_HOOK_URL" \
  -H "Content-Type: application/json" -H "X-StoryGraph-Signature-256: ${signature}" \
  --data-binary "$body")"
cat /tmp/storygraph-gate-response.json; echo
case "$response" in
  200) echo "Gate ${gate} på ${scene} satt til ${status}."; exit 0;;
  401) echo "Avvist: ugyldig signatur eller tilbakekalt hook." >&2; exit 1;;
  422) echo "Avvist av Story Graph (se svar over: ukjent scene eller «bestått» uten bevis)." >&2; exit 1;;
  *)   echo "Uventet svar ${response}." >&2; exit 1;;
esac
