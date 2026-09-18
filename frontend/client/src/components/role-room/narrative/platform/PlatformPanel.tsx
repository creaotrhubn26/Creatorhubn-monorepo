/**
 * PlatformPanel — «Plattform» (Fase 7c, alle planer): målplattform(er) med
 * engine/OS/enhet, ytelsesbudsjett, kravliste med status og bevis, visuell
 * retning og inputmodell. Primært mål markeres; hjem viser «krav verifisert x/y».
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Skeleton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon, StarOutline as StarIcon, Star as StarFilledIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import { NARRATIVE_PLATFORMS, NARRATIVE_PLATFORM_LABELS, type NarrativePlatform, type NarrativePlatformRequirement, type NarrativePlatformTarget } from '../narrativeTypes';
import { createPlatformTarget, deletePlatformTarget, listPlatformTargets, patchPlatformTarget } from '../narrativeService';
import { AutosaveField, EmptyHint, SectionTitle, sceneFieldSx } from '../scenes/sceneUi';

const BUDGET_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'fps', label: 'Bilder/sek' }, { key: 'frameMs', label: 'Bildetid (ms)' }, { key: 'gpuMs', label: 'GPU (ms)' }, { key: 'cpuMs', label: 'CPU (ms)' },
  { key: 'internalResolutionPct', label: 'Intern oppløsning (%)' }, { key: 'memoryGb', label: 'Minne (GB)' }, { key: 'warmTestMinutes', label: 'Varmtest (min)' }, { key: 'filmFormat', label: 'Filmformat' },
];
const VISUAL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'lookAndFeel', label: 'Look & feel' }, { key: 'lighting', label: 'Lys' }, { key: 'materials', label: 'Materialer' }, { key: 'camera', label: 'Kamera' },
  { key: 'fog', label: 'Tåke / atmosfære' }, { key: 'ui', label: 'UI' }, { key: 'audio', label: 'Lyd' },
];
const REQ_STATUS_COLOR = { unverified: narrativeColors.warning, verified: narrativeColors.accent, failed: narrativeColors.error } as const;
const REQ_STATUS_LABEL = { unverified: 'Uverifisert', verified: 'Verifisert', failed: 'Feilet' } as const;
const menuProps = { PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } };
const str = (v: unknown) => (v == null ? '' : String(v));

export function PlatformPanel({ projectId, refreshKey = 0, onNotice }: { projectId: string; refreshKey?: number; onNotice: (m: string, s: 'error' | 'warning' | 'success') => void }): React.ReactElement {
  const [targets, setTargets] = useState<NarrativePlatformTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTarget, setNewTarget] = useState<{ name: string; platform: NarrativePlatform } | null>(null);
  const [newReq, setNewReq] = useState<{ code: string; text: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const t = await listPlatformTargets(projectId); setTargets(t); setError(null); setSelectedId((cur) => cur && t.some((x) => x.id === cur) ? cur : (t.find((x) => x.isPrimary) ?? t[0])?.id ?? null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke hente plattformmål.'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const selected = useMemo(() => targets.find((t) => t.id === selectedId) ?? null, [targets, selectedId]);
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); await load(); if (ok) onNotice(ok, 'success'); } catch (err) { onNotice(err instanceof Error ? err.message : 'Kunne ikke lagre.', 'error'); } };
  const patch = (p: Parameters<typeof patchPlatformTarget>[2]) => (selected ? patchPlatformTarget(projectId, selected.id, p).then(load) : Promise.resolve());
  const setReq = async (i: number, next: Partial<NarrativePlatformRequirement>) => {
    if (!selected) return;
    const reqs = selected.requirements.map((r, idx) => (idx === i ? { ...r, ...next } : r));
    await run(() => patchPlatformTarget(projectId, selected.id, { requirements: reqs }));
  };

  if (loading && targets.length === 0) return <Box sx={{ p: 3 }} data-testid="narrative-platform-loading"><Skeleton variant="rounded" height={120} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /></Box>;
  if (error && targets.length === 0) return <Box sx={{ p: 3 }} data-testid="narrative-platform-error"><Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>Prøv igjen</Button>}>{error}</Alert></Box>;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200 }} data-testid="narrative-platform">
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, flex: 1 }}>Hvilken plattform lager vi spillet for, hva kreves, og hvordan skal det se ut. Krav er verifisert bare med bevis.</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setNewTarget({ name: '', platform: 'ipad' })} sx={{ color: narrativeColors.accent }} data-testid="narrative-platform-new">Nytt mål</Button>
      </Stack>
      {targets.length === 0 ? <EmptyHint title="Ingen målplattform ennå" body="Legg inn f.eks. «iPad Pro M1» med engine, OS-minimum, budsjett og krav — så vet alle hva spillet skal kjøre på." testId="narrative-platform-empty" action={<Button size="small" variant="outlined" onClick={() => setNewTarget({ name: '', platform: 'ipad' })} sx={{ color: narrativeColors.accent, borderColor: narrativeColors.accent }}>Nytt mål</Button>} /> : null}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }} useFlexGap>
        {targets.map((t) => (
          <Chip key={t.id} icon={t.isPrimary ? <StarFilledIcon sx={{ fontSize: 14 }} /> : undefined} label={`${t.name} · ${NARRATIVE_PLATFORM_LABELS[t.platform]}`} onClick={() => setSelectedId(t.id)} sx={{ bgcolor: t.id === selectedId ? narrativeColors.accentSoft : 'rgba(255,255,255,0.06)', color: t.id === selectedId ? narrativeColors.accent : narrativeColors.text, fontWeight: 700 }} data-testid={`narrative-platform-target-${t.id}`} />
        ))}
      </Stack>

      {selected ? (
        <Stack spacing={2.5} data-testid="narrative-platform-detail">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ flex: 1 }}><AutosaveField label="Navn" value={selected.name} onSave={(v) => patch({ name: v.trim() || selected.name })} testId="narrative-platform-name" maxLength={200} /></Box>
            <Select size="small" value={selected.platform} onChange={(e) => void patch({ platform: e.target.value as NarrativePlatform })} sx={{ ...sceneFieldSx, width: 140 }} MenuProps={menuProps} inputProps={{ 'data-testid': 'narrative-platform-kind' }}>{NARRATIVE_PLATFORMS.map((p) => <MenuItem key={p} value={p}>{NARRATIVE_PLATFORM_LABELS[p]}</MenuItem>)}</Select>
            <Tooltip title={selected.isPrimary ? 'Primært mål' : 'Sett som primært mål'}><span><IconButton size="small" disabled={selected.isPrimary} onClick={() => void run(() => patchPlatformTarget(projectId, selected.id, { isPrimary: true }), 'Primært mål satt.')} sx={{ color: narrativeColors.warning }} aria-label="Primær" data-testid="narrative-platform-primary">{selected.isPrimary ? <StarFilledIcon /> : <StarIcon />}</IconButton></span></Tooltip>
            <Tooltip title="Slett mål"><IconButton size="small" onClick={() => { if (window.confirm(`Slette ${selected.name}?`)) void run(() => deletePlatformTarget(projectId, selected.id)); }} sx={{ color: narrativeColors.error }} aria-label="Slett"><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
            <AutosaveField label="Engine / rammeverk" value={selected.engine} onSave={(v) => patch({ engine: v })} testId="narrative-platform-engine" maxLength={200} />
            <AutosaveField label="OS-minimum" value={selected.osMin} onSave={(v) => patch({ osMin: v })} testId="narrative-platform-os" maxLength={200} />
            <AutosaveField label="Minste enhet" value={selected.deviceMin} onSave={(v) => patch({ deviceMin: v })} testId="narrative-platform-device" maxLength={200} />
          </Box>
          <AutosaveField label="Inputmodell" multiline minRows={2} value={selected.inputModel} onSave={(v) => patch({ inputModel: v })} placeholder="Berøring, venstre styrespak, kamera-drag, assisterte gåruter …" maxLength={2000} />

          <Box>
            <SectionTitle>Ytelsesbudsjett</SectionTitle>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }} data-testid="narrative-platform-budgets">
              {BUDGET_FIELDS.map((f) => <AutosaveField key={f.key} label={f.label} value={str(selected.budgets[f.key])} onSave={(v) => patch({ budgets: { ...selected.budgets, [f.key]: v } })} testId={`narrative-platform-budget-${f.key}`} maxLength={300} />)}
            </Box>
          </Box>

          <Box data-testid="narrative-platform-requirements">
            <SectionTitle action={<Button size="small" startIcon={<AddIcon />} onClick={() => setNewReq({ code: `R${selected.requirements.length + 1}`, text: '' })} sx={{ color: narrativeColors.accent, fontSize: 11 }} data-testid="narrative-platform-req-new">Nytt krav</Button>}>
              Krav ({selected.requirements.filter((r) => r.status === 'verified').length}/{selected.requirements.length} verifisert)
            </SectionTitle>
            {selected.requirements.length === 0 ? <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>Ingen krav ennå — f.eks. «Varmtest 30–45 min uten throttling» med kilde.</Typography> : null}
            <Stack spacing={0.75}>
              {selected.requirements.map((r, i) => (
                <Stack key={`${r.code}-${i}`} direction="row" spacing={1} alignItems="flex-start" sx={{ p: 1.25, borderRadius: 2, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid={`narrative-platform-req-${r.code}`} data-status={r.status}>
                  <Chip size="small" label={r.code} sx={{ fontFamily: 'monospace', fontWeight: 800, bgcolor: 'rgba(255,255,255,0.06)', color: narrativeColors.text }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13 }}>{r.text}</Typography>
                    {r.source ? <Typography sx={{ fontSize: 10, color: narrativeColors.textDim }}>Kilde: {r.source}</Typography> : null}
                    <TextField size="small" fullWidth placeholder="Bevis (måling, byggfil, rapport)" defaultValue={r.evidence ?? ''} onBlur={(e) => { if (e.target.value !== (r.evidence ?? '')) void setReq(i, { evidence: e.target.value }); }} sx={{ ...sceneFieldSx, mt: 0.5, '& .MuiInputBase-input': { fontSize: 11, py: 0.5 } }} inputProps={{ 'data-testid': `narrative-platform-req-evidence-${r.code}` }} />
                  </Box>
                  <Select size="small" value={r.status} onChange={(e) => { const st = e.target.value as NarrativePlatformRequirement['status']; if (st === 'verified' && !(r.evidence ?? '').trim()) { onNotice('Et krav kan ikke settes verifisert uten bevis.', 'warning'); return; } void setReq(i, { status: st }); }} sx={{ ...sceneFieldSx, width: 140, '& .MuiSelect-select': { py: 0.5, fontSize: 12, color: REQ_STATUS_COLOR[r.status], fontWeight: 700 } }} MenuProps={menuProps} inputProps={{ 'data-testid': `narrative-platform-req-status-${r.code}` }}>
                    {(['unverified', 'verified', 'failed'] as const).map((s) => <MenuItem key={s} value={s}>{REQ_STATUS_LABEL[s]}</MenuItem>)}
                  </Select>
                  <IconButton size="small" onClick={() => void run(() => patchPlatformTarget(projectId, selected.id, { requirements: selected.requirements.filter((_, idx) => idx !== i) }))} sx={{ color: narrativeColors.error }} aria-label="Fjern krav"><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box>
            <SectionTitle>Visuell retning — hvordan spillet skal se ut</SectionTitle>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }} data-testid="narrative-platform-visual">
              {VISUAL_FIELDS.map((f) => <AutosaveField key={f.key} label={f.label} multiline minRows={2} value={str(selected.visualDirection[f.key])} onSave={(v) => patch({ visualDirection: { ...selected.visualDirection, [f.key]: v } })} testId={`narrative-platform-visual-${f.key}`} maxLength={5000} />)}
            </Box>
          </Box>
          <AutosaveField label="Forbehold / notater" multiline minRows={2} value={selected.notes} onSave={(v) => patch({ notes: v })} maxLength={20_000} />
        </Stack>
      ) : null}

      <Dialog open={!!newTarget} onClose={() => setNewTarget(null)} PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, minWidth: 380 } }}>
        <DialogTitle sx={{ fontSize: 15 }}>Nytt plattformmål</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField size="small" label="Navn" autoFocus value={newTarget?.name ?? ''} onChange={(e) => setNewTarget((v) => v && { ...v, name: e.target.value })} placeholder="iPad Pro M1 (minste målmodell)" sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-platform-new-name' }} />
          <Select size="small" value={newTarget?.platform ?? 'ipad'} onChange={(e) => setNewTarget((v) => v && { ...v, platform: e.target.value as NarrativePlatform })} sx={sceneFieldSx} MenuProps={menuProps}>{NARRATIVE_PLATFORMS.map((p) => <MenuItem key={p} value={p}>{NARRATIVE_PLATFORM_LABELS[p]}</MenuItem>)}</Select>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setNewTarget(null)} sx={{ color: narrativeColors.textDim }}>Avbryt</Button><Button variant="contained" disabled={!newTarget?.name.trim()} onClick={() => { if (newTarget) { void run(() => createPlatformTarget(projectId, { name: newTarget.name.trim(), platform: newTarget.platform, isPrimary: targets.length === 0 }), 'Plattformmål opprettet.'); setNewTarget(null); } }} sx={{ bgcolor: narrativeColors.accent, color: '#03150a' }} data-testid="narrative-platform-create">Opprett</Button></DialogActions>
      </Dialog>
      <Dialog open={!!newReq} onClose={() => setNewReq(null)} PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, minWidth: 420 } }}>
        <DialogTitle sx={{ fontSize: 15 }}>Nytt krav</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField size="small" label="Kode" value={newReq?.code ?? ''} onChange={(e) => setNewReq((v) => v && { ...v, code: e.target.value })} sx={sceneFieldSx} />
          <TextField size="small" label="Krav" autoFocus multiline minRows={2} value={newReq?.text ?? ''} onChange={(e) => setNewReq((v) => v && { ...v, text: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-platform-req-new-text' }} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setNewReq(null)} sx={{ color: narrativeColors.textDim }}>Avbryt</Button><Button variant="contained" disabled={!newReq?.text.trim() || !newReq?.code.trim()} onClick={() => { if (newReq && selected) { void run(() => patchPlatformTarget(projectId, selected.id, { requirements: [...selected.requirements, { code: newReq.code.trim(), text: newReq.text.trim(), status: 'unverified' }] }), 'Krav lagt til.'); setNewReq(null); } }} sx={{ bgcolor: narrativeColors.accent, color: '#03150a' }} data-testid="narrative-platform-req-create">Legg til</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default PlatformPanel;
