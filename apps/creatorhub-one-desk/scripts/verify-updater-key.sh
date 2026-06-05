#!/usr/bin/env bash
#
# verify-updater-key.sh — sanity-check for Creatorhub One Desk's updater
# minisign-keypar. Verifiserer at:
#
#   1. ~/.tauri/one-desk + .pub eksisterer
#   2. pubkey i tauri.conf.json matcher det offentlige innholdet av
#      ~/.tauri/one-desk.pub
#   3. (valgfritt) at signering med privatnøkkelen produserer en signatur
#      som verifiseres mot pubkey
#
# Kjøres lokalt FØR du pusher en release-tag. Hindrer skipping av
# auto-updater pga key-mismatch som ellers ville oppdaget først etter
# at brukere ikke får oppdateringen.
#
# Bruk:
#   ./scripts/verify-updater-key.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_CONF="$APP_DIR/src-tauri/tauri.conf.json"
KEY_DIR="$HOME/.tauri"
PRIV_KEY="$KEY_DIR/one-desk"
PUB_KEY="$KEY_DIR/one-desk.pub"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }

fail() {
  red "✗ $*"
  exit 1
}

ok() {
  green "✓ $*"
}

bold "Creatorhub One Desk — updater key verification"
echo

if [ ! -f "$PRIV_KEY" ]; then
  red "✗ Privat nøkkel mangler: $PRIV_KEY"
  echo
  echo "Generér nytt keypar med:"
  echo "  mkdir -p $KEY_DIR"
  echo "  minisign -G -s $PRIV_KEY -p $PUB_KEY"
  echo "  chmod 600 $PRIV_KEY"
  echo
  echo "Husk: dette skal være SEPARAT fra Post Agent's ~/.tauri/post-agent[.pub]."
  exit 1
fi
ok "Privat nøkkel funnet: $PRIV_KEY"

if [ ! -f "$PUB_KEY" ]; then
  fail "Offentlig nøkkel mangler: $PUB_KEY. Du har bare privat — kan ikke verifisere uten begge."
fi
ok "Offentlig nøkkel funnet: $PUB_KEY"

if ! command -v python3 >/dev/null; then
  fail "python3 trengs for å parse tauri.conf.json"
fi

CONF_PUBKEY=$(python3 -c "import json; c = json.load(open('$TAURI_CONF')); print(c.get('plugins',{}).get('updater',{}).get('pubkey',''), end='')")
if [ -z "$CONF_PUBKEY" ]; then
  fail "plugins.updater.pubkey er tom i $TAURI_CONF"
fi

PLACEHOLDER_CHECK=$(python3 <<EOF
import base64
import sys
conf = """$CONF_PUBKEY"""
try:
    decoded = base64.b64decode(conf).decode("utf-8", errors="ignore")
except Exception:
    print("INVALID_BASE64")
    sys.exit(0)
if "untrusted comment: minisign public key" not in decoded:
    print("NOT_MINISIGN")
    sys.exit(0)
with open("$PUB_KEY") as f:
    expected = f.read()
if decoded.strip() == expected.strip():
    print("MATCH")
else:
    print("MISMATCH")
EOF
)

case "$PLACEHOLDER_CHECK" in
  MATCH)
    ok "tauri.conf.json pubkey matcher $PUB_KEY"
    ;;
  MISMATCH)
    red "✗ tauri.conf.json pubkey matcher IKKE innholdet i $PUB_KEY"
    yellow ""
    yellow "Dette betyr at release-binæren vil signeres med en nøkkel"
    yellow "som ikke kan verifiseres av sluttbrukerens app. Auto-updater"
    yellow "vil avvise oppdateringen som unsignert."
    yellow ""
    yellow "Slik fikser du:"
    yellow "  cat $PUB_KEY | base64 | tr -d '\\n'"
    yellow ""
    yellow "Lim base64-strengen inn i plugins.updater.pubkey i:"
    yellow "  $TAURI_CONF"
    exit 1
    ;;
  NOT_MINISIGN)
    fail "tauri.conf.json pubkey er ikke et minisign-format (manglende 'untrusted comment'-header)"
    ;;
  INVALID_BASE64)
    fail "tauri.conf.json pubkey er ikke gyldig base64"
    ;;
  *)
    fail "Uventet verifikasjons-resultat: $PLACEHOLDER_CHECK"
    ;;
esac

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Creatorhub One Desk updater key round-trip $(date -u)" > "$TMP/probe.txt"

if ! command -v minisign >/dev/null; then
  yellow "⚠ minisign ikke installert lokalt — hopper over signatur-round-trip-test."
  yellow "  brew install minisign"
  exit 0
fi

SIGN_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
if echo "$SIGN_PASSWORD" | minisign -S -s "$PRIV_KEY" -m "$TMP/probe.txt" -x "$TMP/probe.txt.sig" >/dev/null 2>&1; then
  if minisign -V -p "$PUB_KEY" -m "$TMP/probe.txt" -x "$TMP/probe.txt.sig" >/dev/null 2>&1; then
    ok "Signatur-round-trip OK (privat → offentlig nøkkel-verifisering passerer)"
  else
    fail "Signatur ble laget men verifisering med offentlig nøkkel feilet — keypar er korrupt eller mismatchet"
  fi
else
  yellow "⚠ Kunne ikke signere test-fil — kanskje nøkkelen krever passord?"
  yellow "  Sett TAURI_SIGNING_PRIVATE_KEY_PASSWORD og prøv igjen, eller hopp denne sjekken."
fi

echo
bold "Alt verifisert. Klar for tag-push:"
echo "  git tag creatorhub-one-desk-v<X.Y.Z> && git push origin creatorhub-one-desk-v<X.Y.Z>"
