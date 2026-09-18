/**
 * SceneGatesTab — leveransegater med reell status og bevis. «Bestått» er
 * deaktivert til bevis-feltet er fylt (forebygg feil; serveren avviser også).
 */
import React, { useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { narrativeColors } from '../narrativeTheme';
import { NARRATIVE_GATE_KEYS, NARRATIVE_GATE_LABELS, NARRATIVE_GATE_STATUS_LABELS, type NarrativeGateKey, type NarrativeGateStatus, type NarrativeSceneDetail, type NarrativeSceneGate } from '../narrativeTypes';
import { setSceneGate } from '../narrativeService';
import type { UseNarrativeScenesResult } from './useNarrativeScenes';
import { sceneFieldSx } from './sceneUi';

export const GATE_STATUS_COLOR: Record<NarrativeGateStatus, string> = { not_started: narrativeColors.textDim, in_progress: '#93a4dc', passed: narrativeColors.accent, failed: narrativeColors.error };
const STATUSES: NarrativeGateStatus[] = ['not_started', 'in_progress', 'passed', 'failed'];

function GateRow({ projectId, gate, onSaved, onNotice }: { projectId: string; gate: NarrativeSceneGate; onSaved: () => Promise<void>; onNotice: (m: string, s: 'error' | 'warning' | 'success') => void }) {
  const [evidence, setEvidence] = useState(gate.evidence);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setEvidence(gate.evidence); }, [gate.evidence]);
  const hasEvidence = evidence.trim().length > 0;
  const set = async (status: NarrativeGateStatus) => {
    if (status === 'passed' && !hasEvidence) return;
    setSaving(true);
    try { await setSceneGate(projectId, gate.sceneId, gate.gateKey, { status, evidence, evidenceRefs: gate.evidenceRefs }); await onSaved(); onNotice(`${NARRATIVE_GATE_LABELS[gate.gateKey]}: ${NARRATIVE_GATE_STATUS_LABELS[status]}`, 'success'); }
    catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke lagre gaten.', 'error'); }
    finally { setSaving(false); }
  };
  const saveEvidence = async () => {
    if (evidence === gate.evidence) return;
    try { await setSceneGate(projectId, gate.sceneId, gate.gateKey, { status: gate.status, evidence, evidenceRefs: gate.evidenceRefs }); await onSaved(); }
    catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke lagre beviset.', 'error'); }
  };
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${gate.status === 'passed' ? narrativeColors.accent + '66' : gate.status === 'failed' ? narrativeColors.error + '66' : narrativeColors.borderStrong}` }} data-testid={`narrative-gate-${gate.gateKey}`} data-status={gate.status}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }} useFlexGap>
        <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 180 }}>{NARRATIVE_GATE_LABELS[gate.gateKey]}</Typography>
        <Chip size="small" label={NARRATIVE_GATE_STATUS_LABELS[gate.status]} sx={{ bgcolor: `${GATE_STATUS_COLOR[gate.status]}22`, color: GATE_STATUS_COLOR[gate.status], fontWeight: 700 }} data-testid={`narrative-gate-status-${gate.gateKey}`} />
        {STATUSES.filter((s) => s !== gate.status).map((s) => (
          <Tooltip key={s} title={s === 'passed' && !hasEvidence ? 'Bestått krever bevis (byggfil, testantall, verifikasjonsrapport).' : ''}>
            <span>
              <Button size="small" disabled={saving || (s === 'passed' && !hasEvidence)} onClick={() => void set(s)} sx={{ color: GATE_STATUS_COLOR[s], fontSize: 11 }} data-testid={`narrative-gate-set-${gate.gateKey}-${s}`}>{NARRATIVE_GATE_STATUS_LABELS[s]}</Button>
            </span>
          </Tooltip>
        ))}
      </Stack>
      <TextField size="small" fullWidth multiline minRows={1} label="Bevis" value={evidence} onChange={(e) => setEvidence(e.target.value)} onBlur={() => void saveEvidence()} placeholder="build/Prologue-P01-Final.xcresult: 68 bestått, 0 feil — eller sitat fra verifikasjonsrapporten" sx={{ ...sceneFieldSx, mt: 1 }} inputProps={{ 'data-testid': `narrative-gate-evidence-${gate.gateKey}` }} />
      {gate.checkedAt ? <Typography sx={{ fontSize: 10, color: narrativeColors.textDim, mt: 0.5 }}>Sist satt {new Date(gate.checkedAt).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{gate.evidenceRefs.length ? ` · refs: ${gate.evidenceRefs.join(', ')}` : ''}</Typography> : null}
    </Box>
  );
}

export function SceneGatesTab({ projectId, detail, scenes, onNotice }: { projectId: string; detail: NarrativeSceneDetail; scenes: UseNarrativeScenesResult; onNotice: (m: string, s: 'error' | 'warning' | 'success') => void }) {
  const byKey = new Map(detail.gates.map((g) => [g.gateKey, g]));
  const passed = detail.gates.filter((g) => g.status === 'passed').length;
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 900 }} data-testid="narrative-scene-gates">
      <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>
        {passed}/{NARRATIVE_GATE_KEYS.length} bestått. Ingen gate er bestått fordi dokumentet finnes — bevis er en byggfil, et testantall eller en verifikasjonsrapport.
      </Typography>
      {NARRATIVE_GATE_KEYS.map((key: NarrativeGateKey) => {
        const gate = byKey.get(key) ?? { sceneId: detail.scene.id, projectId, gateKey: key, status: 'not_started' as const, evidence: '', evidenceRefs: [], checkedBy: null, checkedAt: null, updatedAt: null };
        return <GateRow key={key} projectId={projectId} gate={gate} onSaved={scenes.reloadDetail} onNotice={onNotice} />;
      })}
    </Stack>
  );
}
