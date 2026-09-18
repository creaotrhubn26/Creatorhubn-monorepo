/**
 * SceneLinesTab — «Replikker» som data: cue-ID · taler · type · EN · NB ·
 * opptaksstatus. Inline-redigering, ny linje, opp/ned, slett. Fase 7c.
 */
import React, { useMemo, useState } from 'react';
import { Autocomplete, Box, Button, IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, ArrowUpward as UpIcon, ArrowDownward as DownIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import {
  NARRATIVE_CUE_ID_RE, NARRATIVE_LINE_SOURCE_TYPES, NARRATIVE_RECORDING_LABELS, NARRATIVE_SOURCE_TAG_LABELS,
  type NarrativeGraph, type NarrativeLineRecordingStatus, type NarrativeLineSourceType, type NarrativeSceneDetail, type NarrativeSceneLine,
} from '../narrativeTypes';
import { createSceneLine, deleteSceneLine, patchSceneLine, reorderSceneLines, NarrativeApiError } from '../narrativeService';
import type { UseNarrativeScenesResult } from './useNarrativeScenes';
import { EmptyHint, sceneFieldSx } from './sceneUi';

const RECORDING: NarrativeLineRecordingStatus[] = ['none', 'needs_take', 'recorded', 'approved'];
const RECORDING_COLOR: Record<NarrativeLineRecordingStatus, string> = { none: narrativeColors.textDim, needs_take: narrativeColors.warning, recorded: '#93a4dc', approved: narrativeColors.accent };
const selectSx = { ...sceneFieldSx, '& .MuiSelect-select': { py: 0.5, fontSize: 12 } } as const;
const menuProps = { PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } };

interface SpeakerOption { id: string | null; label: string }

function InlineText({ value, onSave, testId, placeholder, multiline }: { value: string; onSave: (v: string) => Promise<void>; testId?: string; placeholder?: string; multiline?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  React.useEffect(() => { if (!dirty) setDraft(value); }, [value, dirty]);
  return (
    <TextField size="small" fullWidth multiline={multiline} value={draft} placeholder={placeholder} onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
      onBlur={() => { if (dirty && draft !== value) void onSave(draft).finally(() => setDirty(false)); else setDirty(false); }}
      inputProps={{ 'data-testid': testId }} sx={{ ...sceneFieldSx, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }} />
  );
}

export function SceneLinesTab({ projectId, graph, detail, scenes, onNotice }: { projectId: string; graph: NarrativeGraph; detail: NarrativeSceneDetail; scenes: UseNarrativeScenesResult; onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void }) {
  const sceneId = detail.scene.id;
  const lines = detail.lines;
  const speakers = useMemo<SpeakerOption[]>(() => [
    { id: null, label: '— Ingen komponent (STEMMEN, PÅSKRIFT …)' },
    ...graph.components.filter((c) => c.kind === 'character').map((c) => ({ id: c.id, label: c.name })),
  ], [graph.components]);
  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const [cue, setCue] = useState(() => suggestNextCue(lines));
  const [speaker, setSpeaker] = useState<SpeakerOption>(speakers[0]);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [sourceType, setSourceType] = useState<NarrativeLineSourceType>('T');
  const [adding, setAdding] = useState(false);
  const cueValid = NARRATIVE_CUE_ID_RE.test(cue.trim());
  const cueTaken = lines.some((l) => l.cueId === cue.trim().toUpperCase());

  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    try { await fn(); await scenes.reloadDetail(); if (okMsg) onNotice(okMsg, 'success'); }
    catch (err) {
      if (err instanceof NarrativeApiError && err.code === 'duplicate_cue') onNotice('Replikk-ID-en finnes allerede i scenen.', 'error');
      else onNotice(err instanceof Error ? err.message : 'Kunne ikke lagre replikken.', 'error');
    }
  };
  const add = async () => {
    if (!cueValid || cueTaken) return;
    setAdding(true);
    await run(() => createSceneLine(projectId, sceneId, { cueId: cue.trim(), speakerComponentId: speaker.id, speakerLabel: label.trim() || (speaker.id ? speaker.label.toUpperCase() : ''), textEn: text.trim(), sourceType }));
    setAdding(false); setText(''); setCue(suggestNextCue([...lines, { cueId: cue.trim().toUpperCase() } as NarrativeSceneLine]));
  };
  const move = async (line: NarrativeSceneLine, dir: -1 | 1) => {
    const ids = lines.map((l) => l.id); const i = ids.indexOf(line.id); const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await run(() => reorderSceneLines(projectId, sceneId, ids));
  };

  return (
    <Stack spacing={2} data-testid="narrative-scene-lines">
      <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>
        Type: E = bevart engelsk, T = ny oversettelse, E+T = bevart med tillegg, U = brukertillegg, A = forslag. Ingen linje strykes stille — slett bare når kilden er kontrollert.
      </Typography>
      {lines.length === 0 ? <EmptyHint title="Ingen replikker ennå" body="Legg inn dialog-linjer med cue-ID (W01.01) så opptak, oversettelse og kildestatus kan følges per linje." testId="narrative-scene-lines-empty" /> : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, '& th': { textAlign: 'left', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: narrativeColors.textDim, fontWeight: 700, py: 0.5, px: 0.75, borderBottom: `1px solid ${narrativeColors.borderStrong}` }, '& td': { py: 0.5, px: 0.75, verticalAlign: 'top', borderBottom: `1px solid ${narrativeColors.borderStrong}` } }}>
            <thead><tr><th style={{ width: 90 }}>Cue</th><th style={{ width: 170 }}>Taler</th><th style={{ width: 70 }}>Type</th><th>Engelsk</th><th>Norsk</th><th style={{ width: 130 }}>Opptak</th><th style={{ width: 96 }} /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} data-testid={`narrative-line-${l.cueId}`}>
                  <td><Typography sx={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: narrativeColors.accent }}>{l.cueId}</Typography>{l.perspective ? <Typography sx={{ fontSize: 10, color: narrativeColors.textDim }}>{l.perspective}</Typography> : null}</td>
                  <td>
                    <InlineText value={l.speakerLabel} onSave={(v) => run(() => patchSceneLine(projectId, sceneId, l.id, { speakerLabel: v }))} testId={`narrative-line-speaker-${l.cueId}`} placeholder="NORA, 12" />
                    <Typography sx={{ fontSize: 10, color: narrativeColors.textDim }}>{l.speakerComponentId ? speakerById.get(l.speakerComponentId)?.label ?? '(slettet)' : 'uten karakter'}</Typography>
                  </td>
                  <td>
                    <Select size="small" value={l.sourceType} onChange={(e) => void run(() => patchSceneLine(projectId, sceneId, l.id, { sourceType: e.target.value as NarrativeLineSourceType }))} sx={selectSx} MenuProps={menuProps} inputProps={{ 'data-testid': `narrative-line-type-${l.cueId}` }}>
                      {NARRATIVE_LINE_SOURCE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </td>
                  <td><InlineText multiline value={l.textEn} onSave={(v) => run(() => patchSceneLine(projectId, sceneId, l.id, { textEn: v }))} testId={`narrative-line-en-${l.cueId}`} /></td>
                  <td><InlineText multiline value={l.textNb} onSave={(v) => run(() => patchSceneLine(projectId, sceneId, l.id, { textNb: v }))} testId={`narrative-line-nb-${l.cueId}`} placeholder="(valgfritt)" /></td>
                  <td>
                    <Select size="small" value={l.recordingStatus} onChange={(e) => void run(() => patchSceneLine(projectId, sceneId, l.id, { recordingStatus: e.target.value as NarrativeLineRecordingStatus }))} sx={{ ...selectSx, '& .MuiSelect-select': { py: 0.5, fontSize: 12, color: RECORDING_COLOR[l.recordingStatus], fontWeight: 700 } }} MenuProps={menuProps} inputProps={{ 'data-testid': `narrative-line-recording-${l.cueId}` }}>
                      {RECORDING.map((r) => <MenuItem key={r} value={r}>{NARRATIVE_RECORDING_LABELS[r]}</MenuItem>)}
                    </Select>
                  </td>
                  <td>
                    <Stack direction="row" spacing={0}>
                      <IconButton size="small" disabled={i === 0} onClick={() => void move(l, -1)} sx={{ color: narrativeColors.textDim }} aria-label="Flytt opp"><UpIcon sx={{ fontSize: 14 }} /></IconButton>
                      <IconButton size="small" disabled={i === lines.length - 1} onClick={() => void move(l, 1)} sx={{ color: narrativeColors.textDim }} aria-label="Flytt ned"><DownIcon sx={{ fontSize: 14 }} /></IconButton>
                      <Tooltip title={l.note || 'Slett replikk'}><IconButton size="small" onClick={() => { if (window.confirm(`Slette ${l.cueId}? Kilden skal være kontrollert først.`)) void run(() => deleteSceneLine(projectId, sceneId, l.id)); }} sx={{ color: narrativeColors.error }} aria-label="Slett"><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1 }}>Ny replikk</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap alignItems="flex-start">
          <TextField size="small" label="Cue-ID" value={cue} onChange={(e) => setCue(e.target.value)} error={!!cue && (!cueValid || cueTaken)} helperText={cue && !cueValid ? 'F.eks. W01.08' : cueTaken ? 'Finnes allerede' : ' '} sx={{ ...sceneFieldSx, width: 120 }} inputProps={{ 'data-testid': 'narrative-line-new-cue' }} />
          <Autocomplete size="small" options={speakers} value={speaker} onChange={(_e, v) => { if (v) setSpeaker(v); }} getOptionLabel={(o) => o.label} isOptionEqualToValue={(a, b) => a.id === b.id} sx={{ width: 240 }}
            renderInput={(params) => <TextField {...params} label="Taler (karakter)" sx={sceneFieldSx} inputProps={{ ...params.inputProps, 'data-testid': 'narrative-line-new-speaker' }} />} />
          <TextField size="small" label="Talerbetegnelse" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="NORA, 12" sx={{ ...sceneFieldSx, width: 160 }} inputProps={{ 'data-testid': 'narrative-line-new-label' }} />
          <Select size="small" value={sourceType} onChange={(e) => setSourceType(e.target.value as NarrativeLineSourceType)} sx={{ ...sceneFieldSx, width: 90 }} MenuProps={menuProps} inputProps={{ 'data-testid': 'narrative-line-new-type' }} title={NARRATIVE_SOURCE_TAG_LABELS.T}>
            {NARRATIVE_LINE_SOURCE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
          <TextField size="small" label="Engelsk tekst" value={text} onChange={(e) => setText(e.target.value)} sx={{ ...sceneFieldSx, flex: 1, minWidth: 240 }} inputProps={{ 'data-testid': 'narrative-line-new-text' }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void add(); } }} />
          <Button size="small" variant="contained" startIcon={<AddIcon />} disabled={adding || !cueValid || cueTaken} onClick={() => void add()} sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }} data-testid="narrative-line-add">Legg til</Button>
        </Stack>
      </Box>
    </Stack>
  );
}

/** Foreslår neste cue i samme serie som siste linje (W01.07 → W01.08), ellers tom. */
export function suggestNextCue(lines: readonly Pick<NarrativeSceneLine, 'cueId'>[]): string {
  const last = lines[lines.length - 1]?.cueId ?? '';
  const m = /^([A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?)\.([0-9]{1,3})$/.exec(last);
  if (!m) return '';
  const n = Number(m[2]) + 1;
  return `${m[1]}.${String(n).padStart(m[2].length, '0')}`;
}
