/**
 * PlanPanel — «Produksjonsplan» (Fase 7d, Pro/Studio): Gantt per bane
 * (sticky etikettkolonne, i-dag-markør, zoom uke/måned/kvartal, klikk på bar →
 * popover med datoer/ansvarlig/status), listevisning med sortering,
 * «Ny milepæl» og «Uten dato»-gruppe. Lesing er åpen; mutasjoner gates av
 * `production_plan` (402 → banner).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Popover, Select, Skeleton, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, EventOutlined as EventIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import { NARRATIVE_LANE_LABELS, NARRATIVE_MILESTONE_LANES, NARRATIVE_MILESTONE_STATUS_LABELS, type NarrativeMilestone, type NarrativeMilestoneLane, type NarrativeMilestoneStatus, type NarrativeSceneSummary } from '../narrativeTypes';
import { createMilestone, deleteMilestone, listMilestones, listScenes, patchMilestone, patchScene, setMilestoneScenes, NarrativeApiError } from '../narrativeService';
import { PlanGateBanner } from '../../game/GameBillingPanels';
import { useGamePlanGate } from '../../game/useGamePlanGate';
import { MemberPicker, useMembersLite } from '../components/MemberPicker';
import { AutosaveField, EmptyHint, sceneFieldSx } from '../scenes/sceneUi';
import { SCENE_STATUS_COLORS } from '../scenes/sceneOps';
import { ZOOM_LABELS, ZOOM_LEVELS, dateInputToIso, dateToPercent, isoToDateInput, laneRows, monthBands, planWindow, sortMilestones, weekBands, type PlanBar, type SortKey, type ZoomLevel } from './planOps';

const MS_STATUS_COLOR: Record<NarrativeMilestoneStatus, string> = { planned: '#9ca3af', in_progress: '#93a4dc', done: narrativeColors.accent, blocked: narrativeColors.error };
const menuProps = { PaperProps: { sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text } } };
const LABEL_W = 180;

export function PlanPanel({ projectId, refreshKey = 0, onOpenScene, onNotice }: { projectId: string; refreshKey?: number; onOpenScene: (sceneId: string) => void; onNotice: (m: string, s: 'error' | 'warning' | 'success') => void }): React.ReactElement {
  const gate = useGamePlanGate();
  const locked = !gate.loading && !gate.has('production_plan');
  const [view, setView] = useState<'gantt' | 'list'>(() => { try { return new URLSearchParams(window.location.search).get('plan') === 'list' ? 'list' : 'gantt'; } catch { return 'gantt'; } });
  useEffect(() => { try { const url = new URL(window.location.href); url.searchParams.set('plan', view); window.history.replaceState({}, '', url.toString()); } catch { /* ignore */ } }, [view]);
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [milestones, setMilestones] = useState<NarrativeMilestone[]>([]);
  const [scenes, setScenes] = useState<NarrativeSceneSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { members } = useMembersLite(projectId);
  const load = useCallback(async () => {
    setLoading(true);
    try { const [m, s] = await Promise.all([listMilestones(projectId), listScenes(projectId)]); setMilestones(m); setScenes(s.scenes); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke hente planen.'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); await load(); if (ok) onNotice(ok, 'success'); }
    catch (err) { onNotice(err instanceof NarrativeApiError && err.code === 'plan_required' ? 'Produksjonsplan krever Pro eller Studio.' : err instanceof Error ? err.message : 'Kunne ikke lagre.', 'error'); }
  };

  const win = useMemo(() => planWindow([...milestones, ...scenes], zoom), [milestones, scenes, zoom]);
  const { rows, undated } = useMemo(() => laneRows(milestones, scenes, win), [milestones, scenes, win]);
  const bands = useMemo(() => (zoom === 'week' ? weekBands(win) : monthBands(win)), [win, zoom]);
  const todayPct = dateToPercent(Date.now(), win);
  const sorted = useMemo(() => sortMilestones(milestones, sortKey), [milestones, sortKey]);

  const [popover, setPopover] = useState<{ anchor: HTMLElement; bar: PlanBar } | null>(null);
  const [creating, setCreating] = useState<{ title: string; lane: NarrativeMilestoneLane; dueAt: string } | null>(null);
  const popMilestone = popover?.bar.kind === 'milestone' ? milestones.find((m) => m.id === popover.bar.id) ?? null : null;
  const popScene = popover?.bar.kind === 'scene' ? scenes.find((s) => s.id === popover.bar.id) ?? null : null;

  if (loading && milestones.length === 0 && scenes.length === 0) return <Box sx={{ p: 3 }} data-testid="narrative-plan-loading"><Skeleton variant="rounded" height={200} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} /></Box>;
  if (error && milestones.length === 0) return <Box sx={{ p: 3 }} data-testid="narrative-plan-error"><Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>Prøv igjen</Button>}>{error}</Alert></Box>;

  const memberName = (id: string | null) => (id ? members.find((m) => m.userId === id)?.displayName ?? id : '—');
  const statusChip = (status: NarrativeMilestoneStatus, onChange?: (s: NarrativeMilestoneStatus) => void, testId?: string) => onChange ? (
    <Select size="small" value={status} onChange={(e) => onChange(e.target.value as NarrativeMilestoneStatus)} sx={{ ...sceneFieldSx, minWidth: 130, '& .MuiSelect-select': { py: 0.5, fontSize: 12, color: MS_STATUS_COLOR[status], fontWeight: 700 } }} MenuProps={menuProps} inputProps={{ 'data-testid': testId }} disabled={locked}>
      {(Object.keys(NARRATIVE_MILESTONE_STATUS_LABELS) as NarrativeMilestoneStatus[]).map((s) => <MenuItem key={s} value={s}>{NARRATIVE_MILESTONE_STATUS_LABELS[s]}</MenuItem>)}
    </Select>
  ) : <Chip size="small" label={NARRATIVE_MILESTONE_STATUS_LABELS[status]} sx={{ bgcolor: `${MS_STATUS_COLOR[status]}22`, color: MS_STATUS_COLOR[status], fontWeight: 700 }} />;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }} data-testid="narrative-plan" data-locked={locked ? 'plan' : undefined}>
      <PlanGateBanner feature="production_plan" />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Tabs value={view} onChange={(_e, v) => setView(v as 'gantt' | 'list')} sx={{ minHeight: 32, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: narrativeColors.textDim, minHeight: 32, fontSize: 13, py: 0, borderRadius: '6px 6px 0 0' }, '& .Mui-selected': { color: '#e6fff0', bgcolor: 'rgba(34,197,94,0.14)' }, '& .MuiTabs-indicator': { bgcolor: narrativeColors.accent } }}>
          <Tab value="gantt" label="Gantt" data-testid="narrative-plan-view-gantt" /><Tab value="list" label="Liste" data-testid="narrative-plan-view-list" />
        </Tabs>
        <Box sx={{ flex: 1 }} />
        {view === 'gantt' ? (
          <ToggleButtonGroup size="small" exclusive value={zoom} onChange={(_e, v) => { if (v) setZoom(v as ZoomLevel); }} sx={{ '& .MuiToggleButton-root': { color: narrativeColors.textDim, borderColor: narrativeColors.borderStrong, textTransform: 'none', fontSize: 12, py: 0.25 }, '& .Mui-selected': { color: '#fff !important', bgcolor: `${narrativeColors.accentSoft} !important` } }}>
            {ZOOM_LEVELS.map((z) => <ToggleButton key={z} value={z} data-testid={`narrative-plan-zoom-${z}`}>{ZOOM_LABELS[z]}</ToggleButton>)}
          </ToggleButtonGroup>
        ) : (
          <Select size="small" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} sx={{ ...sceneFieldSx, width: 160, '& .MuiSelect-select': { py: 0.5, fontSize: 12 } }} MenuProps={menuProps} SelectDisplayProps={{ 'data-testid': 'narrative-plan-sort' } as React.HTMLAttributes<HTMLDivElement>}>
            <MenuItem value="due">Sorter: frist</MenuItem><MenuItem value="lane">Sorter: bane</MenuItem><MenuItem value="status">Sorter: status</MenuItem><MenuItem value="title">Sorter: tittel</MenuItem>
          </Select>
        )}
        <Tooltip title={locked ? 'Krever Pro eller Studio' : ''}><span><Button size="small" variant="contained" startIcon={<AddIcon />} disabled={locked} onClick={() => setCreating({ title: '', lane: 'story', dueAt: '' })} sx={{ bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 700 }} data-testid="narrative-plan-new" data-locked={locked ? 'plan' : undefined}>Ny milepæl</Button></span></Tooltip>
      </Stack>

      {milestones.length === 0 && scenes.every((s) => !s.startAt && !s.dueAt) ? (
        <EmptyHint title="Ingen milepæler ennå" body="Legg inn baner som manus, gråboks, karakterer, gjennomspilling, bilde/lyd og teknikk — og sett datoer på scener." testId="narrative-plan-empty" />
      ) : null}

      {view === 'gantt' && (rows.length > 0) ? (
        <Box sx={{ border: `1px solid ${narrativeColors.borderStrong}`, borderRadius: 2, overflow: 'hidden', bgcolor: narrativeColors.bgPanel }} data-testid="narrative-plan-gantt">
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: 900 }}>
              {/* Header med bånd */}
              <Box sx={{ display: 'flex', borderBottom: `1px solid ${narrativeColors.borderStrong}` }}>
                <Box sx={{ width: LABEL_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2, bgcolor: narrativeColors.bgPanel, borderRight: `1px solid ${narrativeColors.borderStrong}`, px: 1.5, py: 0.75, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: narrativeColors.textDim, fontWeight: 700 }}>Bane</Box>
                <Box sx={{ flex: 1, position: 'relative', height: 30 }}>
                  {bands.map((b) => <Box key={b.key} sx={{ position: 'absolute', left: `${b.leftPct}%`, width: `${b.widthPct}%`, top: 0, bottom: 0, borderLeft: `1px solid ${narrativeColors.borderStrong}`, px: 0.5, fontSize: 10, color: narrativeColors.textDim, whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: '30px' }}>{b.label}</Box>)}
                </Box>
              </Box>
              {rows.map((row) => (
                <Box key={row.lane} sx={{ display: 'flex', borderBottom: `1px solid ${narrativeColors.borderStrong}`, minHeight: 36 }} data-testid={`narrative-plan-lane-${row.lane}`}>
                  <Box sx={{ width: LABEL_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2, bgcolor: narrativeColors.bgPanel, borderRight: `1px solid ${narrativeColors.borderStrong}`, px: 1.5, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700 }}>{NARRATIVE_LANE_LABELS[row.lane]} <Typography component="span" sx={{ fontSize: 10, color: narrativeColors.textDim, ml: 0.5 }}>{row.bars.length}</Typography></Box>
                  <Box sx={{ flex: 1, position: 'relative', py: 0.5 }}>
                    {bands.map((b) => <Box key={b.key} sx={{ position: 'absolute', left: `${b.leftPct}%`, top: 0, bottom: 0, borderLeft: `1px solid rgba(255,255,255,0.04)` }} />)}
                    <Box sx={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: `2px solid ${narrativeColors.warning}`, opacity: 0.8 }} data-testid="narrative-plan-today" />
                    <Stack spacing={0.5} sx={{ position: 'relative' }}>
                      {row.bars.map((bar) => {
                        const color = bar.kind === 'scene' ? SCENE_STATUS_COLORS[bar.status as keyof typeof SCENE_STATUS_COLORS] ?? narrativeColors.textDim : MS_STATUS_COLOR[bar.status as NarrativeMilestoneStatus] ?? narrativeColors.textDim;
                        return (
                          <Box key={bar.key} onClick={(e) => setPopover({ anchor: e.currentTarget, bar })} data-testid={`narrative-plan-bar-${bar.id}`} data-overdue={bar.overdue ? 'true' : undefined}
                            sx={{ position: 'relative', height: 22, cursor: 'pointer' }}>
                            <Box sx={{ position: 'absolute', left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, minWidth: 8, height: 22, borderRadius: 1, bgcolor: `${color}33`, border: `1px solid ${bar.overdue ? narrativeColors.error : color}`, display: 'flex', alignItems: 'center', px: 0.75, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 11, color: narrativeColors.text, '&:hover': { bgcolor: `${color}55` } }}>
                              {bar.kind === 'scene' ? '▸ ' : ''}{bar.title}
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      ) : null}

      {view === 'gantt' && undated.length > 0 ? (
        <Box sx={{ mt: 2 }} data-testid="narrative-plan-undated">
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>Uten dato ({undated.length})</Typography>
          <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mb: 1 }}>Klikk på en scene eller milepæl for å sette start og frist — da dukker den opp i Gantt-visningen.</Typography>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }} useFlexGap>
            {undated.map((bar) => (
              <Chip
                key={bar.key}
                size="small"
                variant="outlined"
                icon={<EventIcon sx={{ fontSize: 15 }} />}
                label={bar.title}
                onClick={(e) => setPopover({ anchor: e.currentTarget, bar })}
                role="button"
                aria-label={`Sett datoer for ${bar.title}`}
                sx={{
                  color: narrativeColors.text,
                  borderColor: narrativeColors.borderStrong,
                  '& .MuiChip-icon': { color: narrativeColors.textDim },
                  '&:hover': { borderColor: narrativeColors.accent, bgcolor: narrativeColors.accentSoft },
                }}
                data-testid={`narrative-plan-undated-${bar.id}`}
              />
            ))}
          </Stack>
        </Box>
      ) : null}

      {view === 'list' ? (
        <Box sx={{ overflowX: 'auto' }} data-testid="narrative-plan-list">
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, '& th': { textAlign: 'left', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: narrativeColors.textDim, fontWeight: 700, py: 0.75, px: 1, borderBottom: `1px solid ${narrativeColors.borderStrong}` }, '& td': { py: 0.5, px: 1, borderBottom: `1px solid ${narrativeColors.borderStrong}`, fontSize: 12, verticalAlign: 'middle' } }}>
            <thead><tr><th>Milepæl</th><th>Bane</th><th>Start</th><th>Frist</th><th>Status</th><th>Ansvarlig</th><th>Scener</th><th /></tr></thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id} data-testid={`narrative-plan-row-${m.id}`}>
                  <td><Typography sx={{ fontSize: 13, fontWeight: 600, cursor: 'pointer', '&:hover': { color: narrativeColors.accent } }} onClick={(e) => setPopover({ anchor: e.currentTarget, bar: { key: `m:${m.id}`, kind: 'milestone', id: m.id, title: m.title, lane: m.lane, startAt: m.startAt, dueAt: m.dueAt, status: m.status, leftPct: 0, widthPct: 0, overdue: false } })} data-testid={`narrative-plan-row-title-${m.id}`}>{m.title}</Typography></td>
                  <td>{NARRATIVE_LANE_LABELS[m.lane]}</td>
                  <td>{isoToDateInput(m.startAt) || '—'}</td>
                  <td style={{ color: m.status !== 'done' && m.dueAt && new Date(m.dueAt).getTime() < Date.now() ? narrativeColors.error : undefined }}>{isoToDateInput(m.dueAt) || '—'}</td>
                  <td>{statusChip(m.status, (s) => void run(() => patchMilestone(projectId, m.id, { status: s })), `narrative-plan-status-${m.id}`)}</td>
                  <td>{memberName(m.ownerUserId)}</td>
                  <td>{m.sceneIds.length}</td>
                  <td><Tooltip title="Slett"><span><IconButton size="small" disabled={locked} onClick={() => { if (window.confirm(`Slette «${m.title}»?`)) void run(() => deleteMilestone(projectId, m.id)); }} sx={{ color: narrativeColors.error }} aria-label="Slett"><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></span></Tooltip></td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      ) : null}

      {/* Popover: milepæl / scene */}
      <Popover open={!!popover} anchorEl={popover?.anchor ?? null} onClose={() => setPopover(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} PaperProps={{ sx: { p: 2, width: 380, maxWidth: '92vw', bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` } }} data-testid="narrative-plan-popover">
        {popMilestone ? (
          <Stack spacing={1.5}>
            <AutosaveField label="Tittel" value={popMilestone.title} onSave={(v) => patchMilestone(projectId, popMilestone.id, { title: v.trim() || popMilestone.title }).then(load)} testId="narrative-plan-pop-title" maxLength={300} />
            <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{NARRATIVE_LANE_LABELS[popMilestone.lane]}{popMilestone.description ? ` · ${popMilestone.description}` : ''}</Typography>
            <Stack direction="row" spacing={1}>
              <AutosaveField label="Start" type="date" value={isoToDateInput(popMilestone.startAt)} onSave={(v) => patchMilestone(projectId, popMilestone.id, { startAt: dateInputToIso(v) }).then(load)} testId="narrative-plan-pop-start" />
              <AutosaveField label="Frist" type="date" value={isoToDateInput(popMilestone.dueAt)} onSave={(v) => patchMilestone(projectId, popMilestone.id, { dueAt: dateInputToIso(v) }).then(load)} testId="narrative-plan-pop-due" />
            </Stack>
            {statusChip(popMilestone.status, (s) => void run(() => patchMilestone(projectId, popMilestone.id, { status: s })), 'narrative-plan-pop-status')}
            <MemberPicker projectId={projectId} value={popMilestone.ownerUserId} onChange={(id) => void run(() => patchMilestone(projectId, popMilestone.id, { ownerUserId: id }))} disabled={locked} testId="narrative-plan-pop-owner" />
            <AutosaveField label="Akseptkriterium" multiline minRows={2} value={popMilestone.acceptance} onSave={(v) => patchMilestone(projectId, popMilestone.id, { acceptance: v }).then(load)} maxLength={20_000} />
            <AutosaveField label="Bevis" multiline minRows={2} value={popMilestone.evidence} onSave={(v) => patchMilestone(projectId, popMilestone.id, { evidence: v }).then(load)} maxLength={20_000} />
            <Box>
              <Typography sx={{ fontSize: 11, color: narrativeColors.textDim, mb: 0.5 }}>Scener ({popMilestone.sceneIds.length})</Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
                {scenes.filter((s) => popMilestone.sceneIds.includes(s.id)).map((s) => <Chip key={s.id} size="small" label={s.code} onClick={() => onOpenScene(s.id)} onDelete={locked ? undefined : () => void run(() => setMilestoneScenes(projectId, popMilestone.id, popMilestone.sceneIds.filter((x) => x !== s.id)))} sx={{ bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} />)}
                <Select size="small" displayEmpty value="" onChange={(e) => { const id = String(e.target.value); if (id) void run(() => setMilestoneScenes(projectId, popMilestone.id, [...popMilestone.sceneIds, id])); }} sx={{ ...sceneFieldSx, minWidth: 140, '& .MuiSelect-select': { py: 0.25, fontSize: 11 } }} MenuProps={menuProps} disabled={locked} inputProps={{ 'data-testid': 'narrative-plan-pop-add-scene' }}>
                  <MenuItem value=""><em>Legg til scene…</em></MenuItem>
                  {scenes.filter((s) => !popMilestone.sceneIds.includes(s.id)).map((s) => <MenuItem key={s.id} value={s.id}>{s.code} · {s.title}</MenuItem>)}
                </Select>
              </Stack>
            </Box>
          </Stack>
        ) : popScene ? (
          <Stack spacing={1.5}>
            <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{popScene.code} · {popScene.title}</Typography>
            <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>Scene-datoer lagres på scenen (ugatet).</Typography>
            <Stack direction="row" spacing={1}>
              <SceneDateField projectId={projectId} scene={popScene} field="startAt" label="Start" onSaved={load} />
              <SceneDateField projectId={projectId} scene={popScene} field="dueAt" label="Frist" onSaved={load} />
            </Stack>
            <Button size="small" onClick={() => onOpenScene(popScene.id)} sx={{ color: narrativeColors.accent, alignSelf: 'flex-start' }}>Åpne scenen</Button>
          </Stack>
        ) : null}
      </Popover>

      <Dialog open={!!creating} onClose={() => setCreating(null)} PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, minWidth: 400 } }}>
        <DialogTitle sx={{ fontSize: 15 }}>Ny milepæl</DialogTitle>
        <DialogContent><Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField size="small" label="Tittel" autoFocus value={creating?.title ?? ''} onChange={(e) => setCreating((v) => v && { ...v, title: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-plan-new-title' }} />
          <Select size="small" value={creating?.lane ?? 'story'} onChange={(e) => setCreating((v) => v && { ...v, lane: e.target.value as NarrativeMilestoneLane })} sx={sceneFieldSx} MenuProps={menuProps} inputProps={{ 'data-testid': 'narrative-plan-new-lane' }}>{NARRATIVE_MILESTONE_LANES.map((l) => <MenuItem key={l} value={l}>{NARRATIVE_LANE_LABELS[l]}</MenuItem>)}</Select>
          <TextField size="small" type="date" label="Frist" InputLabelProps={{ shrink: true }} value={creating?.dueAt ?? ''} onChange={(e) => setCreating((v) => v && { ...v, dueAt: e.target.value })} sx={sceneFieldSx} inputProps={{ 'data-testid': 'narrative-plan-new-due' }} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setCreating(null)} sx={{ color: narrativeColors.textDim }}>Avbryt</Button><Button variant="contained" disabled={!creating?.title.trim()} onClick={() => { if (creating) { void run(() => createMilestone(projectId, { title: creating.title.trim(), lane: creating.lane, dueAt: dateInputToIso(creating.dueAt) }), 'Milepæl opprettet.'); setCreating(null); } }} sx={{ bgcolor: narrativeColors.accent, color: '#03150a' }} data-testid="narrative-plan-create">Opprett</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

function SceneDateField({ projectId, scene, field, label, onSaved }: { projectId: string; scene: NarrativeSceneSummary; field: 'startAt' | 'dueAt'; label: string; onSaved: () => Promise<void> }) {
  return <AutosaveField label={label} type="date" value={isoToDateInput(scene[field])} onSave={(v) => patchScene(projectId, scene.id, { [field]: dateInputToIso(v) }).then(onSaved)} testId={`narrative-plan-scene-${field}`} />;
}

export default PlanPanel;
