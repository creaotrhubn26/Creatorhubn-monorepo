#!/bin/bash
# Installerer Post Agent Bryllup-plugin i DaVinci Resolve (Studio).
set -e
SRC="$(cd "$(dirname "$0")/com.creatorhubn.postagent.bryllup" && pwd)"
SAMPLE="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations/Examples/SamplePlugin"
DEST="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/com.creatorhubn.postagent.bryllup"
mkdir -p "$DEST"
cp -R "$SRC/"* "$DEST/"
[ -f "$DEST/WorkflowIntegration.node" ] || cp "$SAMPLE/WorkflowIntegration.node" "$DEST/"
echo "Installert → restart Resolve → Workspace → Workflow Integrations → Post Agent — Bryllup"
