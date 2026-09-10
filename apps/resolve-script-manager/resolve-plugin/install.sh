#!/bin/bash
# Installerer Post Agent Bryllup-plugin i DaVinci Resolve (Studio).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/com.creatorhubn.postagent.bryllup"
PY_SRC="$(cd "$SCRIPT_DIR/../python" && pwd)"
SAMPLE="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations/Examples/SamplePlugin"
DEST="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/com.creatorhubn.postagent.bryllup"

if [ ! -f "$SAMPLE/WorkflowIntegration.node" ]; then
  echo "Mangler siste WorkflowIntegration.node fra Resolve-installasjonen: $SAMPLE" >&2
  exit 1
fi
if [ ! -f "$PY_SRC/registry.json" ]; then
  echo "Mangler Post Agent Python-motor: $PY_SRC" >&2
  exit 1
fi

if [ -d "$DEST" ]; then
  BACKUP="${DEST}.backup-$(date +%Y%m%d-%H%M%S)"
  cp -R "$DEST" "$BACKUP"
  echo "Sikkerhetskopi: $BACKUP"
fi

mkdir -p "$DEST" "$DEST/python"
cp -R "$SRC/." "$DEST/"
/usr/bin/rsync -a --exclude __pycache__ --exclude "*.pyc" "$PY_SRC/" "$DEST/python/"
# Alltid bruk binary som følger den installerte Resolve-versjonen. Kilden kan
# inneholde en eldre utviklingskopi og skal aldri vinne ved installasjon.
cp "$SAMPLE/WorkflowIntegration.node" "$DEST/WorkflowIntegration.node"

if ! cmp -s "$SAMPLE/WorkflowIntegration.node" "$DEST/WorkflowIntegration.node"; then
  echo "WorkflowIntegration.node kunne ikke verifiseres etter kopiering" >&2
  exit 1
fi

echo "Installert med aktuell Resolve Workflow Integration + bundlet Python-motor"
echo "Restart Resolve → Workspace → Workflow Integrations → Post Agent — Bryllup"
