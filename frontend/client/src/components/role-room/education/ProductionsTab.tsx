/**
 * ProductionsTab.tsx — «Studentproduksjoner» (redesign, CMS-koblet).
 *
 * Hver produksjon ER et ekte Role Room-prosjekt (casting_projects) via
 * educationProductionsService. Design speiler mockup: KPI-kort m/ sparkline,
 * produksjonsrader m/ pipeline-stepper + status, «kom i gang»-bånd og høyre
 * skinne (kommende aktiviteter / hurtighandlinger / tips). Pipeline-steg + %
 * utledes fra projectStatus; kommende aktiviteter er statiske «kommer».
 *
 * 🔑 CMS: stabile data-edit-id (edu-sp-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Collapse, TextField, MenuItem,
  CircularProgress, Alert, InputBase, Select, Snackbar, Card, CardActionArea,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  MovieCreation as ProductionIcon, Add as AddIcon, CalendarMonth as CalendarIcon,
  Grading as DeliverIcon, Groups as StudentsIcon, GridView as TemplateIcon,
  Search as SearchIcon, OpenInNew as OpenIcon, Description as CallSheetIcon,
  Delete as DeleteIcon, PersonAdd as InviteIcon, PlayCircleOutline as ReviewIcon,
  RocketLaunch as RocketIcon, KeyboardArrowDown as CaretIcon,
} from '@mui/icons-material';
import { educationProductionsService, openProductionInRoleRoom, type Production } from './educationProductionsService';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { educationAssignmentsService } from './educationAssignmentsService';
import { PRODUCTION_TEMPLATES } from './educationTemplates';
import { ACCENT, Panel, T, QuickAction, RailTips } from './_eduUi';
import type { EducationTabId } from './EducationWorkspace';

const STATUS_OPTIONS = ['Alle status', 'Planlegging', 'Pre-produksjon', 'Innspilling', 'Redigering', 'Levert'];

const PIPE_LABELS = ['Brief', 'Pre-prod.', 'Opptak', 'Post', 'Levering'];

function mapPipeline(status: string | null): { stage: number; pill: string; color: string; progress: number } {
  const s = (status || '').toLowerCase();
  if (/lever|ferdig|done|complete|publish/.test(s)) return { stage: 4, pill: 'Levert', color: '#10b981', progress: 100 };
  if (/post|redig|edit/.test(s)) return { stage: 3, pill: 'Redigering', color: ACCENT, progress: 48 };
  if (/opptak|innspill|shoot|filming/.test(s)) return { stage: 2, pill: 'Innspilling', color: '#38bdf8', progress: 62 };
  if (/pre/.test(s)) return { stage: 1, pill: 'Pre-produksjon', color: '#38bdf8', progress: 34 };
  return { stage: 0, pill: status || 'Planlegging', color: '#10b981', progress: 15 };
}

function Pipeline({ stage, color }: { stage: number; color: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 210 }}>
      <Stack direction="row" alignItems="center">
        {PIPE_LABELS.map((_, i) => {
          const done = i <= stage;
          const current = i === stage;
          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', flex: i < PIPE_LABELS.length - 1 ? 1 : '0 0 auto' }}>
              <Box sx={{ width: 15, height: 15, borderRadius: '50%', flexShrink: 0, bgcolor: done ? color : '#0e0e12', border: `2px solid ${done ? color : 'rgba(255,255,255,0.18)'}`, boxShadow: current ? `0 0 0 4px ${color}40` : 'none' }} />
              {i < PIPE_LABELS.length - 1 && <Box sx={{ flex: 1, height: '2px', bgcolor: i < stage ? color : 'rgba(255,255,255,0.12)' }} />}
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
        {PIPE_LABELS.map((l) => <Typography key={l} sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', width: 56, textAlign: 'center' }}>{l}</Typography>)}
      </Stack>
    </Box>
  );
}

const THUMBS = ['linear-gradient(135deg,#1e3a5f,#2a4a6f)', 'linear-gradient(135deg,#1a4a2e,#2f6b3f)', 'linear-gradient(135deg,#3a3550,#4a4560)', 'linear-gradient(135deg,#3a1f5f,#4a2f6f)'];

export function ProductionsTab({ onNavigate }: { onNavigate?: (t: EducationTabId) => void }) {
  const [productions, setProductions] = useState<Production[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle status');

  // Maler.
  const [tmplOpen, setTmplOpen] = useState(false);
  const [tmplId, setTmplId] = useState(PRODUCTION_TEMPLATES[0].id);
  const [tmplTitle, setTmplTitle] = useState('');
  const [tmplCohortId, setTmplCohortId] = useState('');
  const [tmplBusy, setTmplBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openTemplateDialog = () => {
    const t = PRODUCTION_TEMPLATES[0];
    setTmplId(t.id); setTmplTitle(t.name); setTmplCohortId(''); setTmplOpen(true);
  };
  const selectedTmpl = PRODUCTION_TEMPLATES.find((t) => t.id === tmplId) ?? PRODUCTION_TEMPLATES[0];

  const handleCreateFromTemplate = async () => {
    if (!tmplTitle.trim() || tmplBusy) return;
    setTmplBusy(true); setError(null);
    try {
      const prod = await educationProductionsService.createProduction({ title: tmplTitle.trim(), cohortId: tmplCohortId || undefined });
      let seeded = 0;
      for (const a of selectedTmpl.assignments) {
        const dueAt = new Date(Date.now() + a.dueInDays * 86_400_000).toISOString();
        try {
          // eslint-disable-next-line no-await-in-loop -- sekvensiell så-ing holder rekkefølgen
          await educationAssignmentsService.createAssignment({
            title: a.title, productionId: prod.id, cohortId: tmplCohortId || null,
            brief: a.brief, learningGoals: a.learningGoals, dueAt, status: 'published',
          });
          seeded++;
        } catch { /* hopp over enkelt-oppgave-feil, fortsett */ }
      }
      setTmplOpen(false); await load();
      setToast(`Opprettet «${prod.title}» fra mal · ${seeded} oppgaver lagt til.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette fra mal'); }
    finally { setTmplBusy(false); }
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [prods, chs] = await Promise.all([educationProductionsService.listProductions(), educationCohortsService.listCohorts()]);
      setProductions(prods); setCohorts(chs);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente produksjoner'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      await educationProductionsService.createProduction({ title: title.trim(), cohortId: cohortId || undefined });
      setTitle(''); setCohortId(''); setCreating(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette produksjon'); }
    finally { setBusy(false); }
  };
  const handleDelete = async (id: string) => {
    try { await educationProductionsService.deleteProduction(id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke slette'); }
  };
  const cohortName = (id: string | null) => cohorts.find((c) => c.id === id)?.name ?? '—';

  const visibleProductions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productions.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'Alle status' && mapPipeline(p.projectStatus).pill !== statusFilter) return false;
      return true;
    });
  }, [productions, query, statusFilter]);

  const activeCount = productions.length;
  const inProd = productions.filter((p) => mapPipeline(p.projectStatus).stage === 2).length;
  const inPost = productions.filter((p) => mapPipeline(p.projectStatus).stage >= 3).length;
  const totalStudents = useMemo(() => cohorts.reduce((a, c) => a + (c.studentCount || 0), 0), [cohorts]);

  const kpis = [
    { id: 'aktive', label: 'Aktive produksjoner', value: activeCount, hint: `${inProd} i produksjon, ${inPost} i post`, icon: <ProductionIcon />, spark: '0,20 12,15 24,17 36,8 48,12 60,4' },
    { id: 'innspill', label: 'Innspillinger denne uken', value: inProd, hint: `${activeCount} planlagt totalt`, icon: <CalendarIcon />, spark: '0,16 12,18 24,10 36,13 48,6 60,9' },
    { id: 'leveranser', label: 'Leveranser til vurdering', value: productions.reduce((a, p) => a + (p.assignmentCount || 0), 0), hint: 'Klar for gjennomgang', icon: <DeliverIcon />, spark: '0,18 12,12 24,14 36,7 48,10 60,4' },
    { id: 'studenter', label: 'Studenter involvert', value: totalStudents, hint: 'På tvers av alle prosjekter', icon: <StudentsIcon />, spark: '0,12 12,10 24,11 36,9 48,7 60,6' },
  ];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 300px' }, gap: 2.75, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
        {/* Header */}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <T eid="edu-sp-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Studentproduksjoner</T>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1.25, py: 0.5, borderRadius: 5, bgcolor: 'rgba(16,185,129,0.13)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#10b981' }} />
                <T eid="edu-sp-canvas" sx={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Canvas-koblet</T>
              </Stack>
            </Stack>
            <T eid="edu-sp-subtitle" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, mt: 0.6 }}>Hver produksjon er et fullt Role Room-prosjekt med team, story arc, call sheet, oppgaver og leveranser.</T>
          </Box>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<TemplateIcon />} onClick={openTemplateDialog} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
              <T eid="edu-sp-btn-template" component="span" sx={{ fontWeight: 600 }}>Opprett fra mal</T>
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              <T eid="edu-sp-btn-new" component="span" sx={{ fontWeight: 700 }}>Ny produksjon</T>
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        <Collapse in={creating}>
          <Panel sx={{ border: '1px solid rgba(139,92,246,0.35)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" label="Tittel" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
              <TextField size="small" select label="Kull (valgfritt)" value={cohortId} onChange={(e) => setCohortId(e.target.value)} sx={{ minWidth: 200 }}>
                <MenuItem value="">Ingen</MenuItem>
                {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
              <Button onClick={() => setCreating(false)} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!title.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}>{busy ? 'Oppretter…' : 'Opprett'}</Button>
            </Stack>
          </Panel>
        </Collapse>

        {/* KPI-kort m/ sparkline */}
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          {kpis.map((k) => (
            <Panel key={k.id} sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', flexShrink: 0, '& svg': { fontSize: 22 } }}>{k.icon}</Box>
                <Box>
                  <T eid={`edu-sp-kpi-${k.id}-label`} sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k.label}</T>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1, mt: 0.25 }}>{k.value}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mt: 1.25 }}>
                <T eid={`edu-sp-kpi-${k.id}-hint`} sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{k.hint}</T>
                <Box component="svg" width="52" height="22" viewBox="0 0 60 22" sx={{ flexShrink: 0 }}><polyline points={k.spark} fill="none" stroke={ACCENT} strokeWidth="2" /></Box>
              </Stack>
            </Panel>
          ))}
        </Box>

        {/* Produksjoner */}
        <Panel>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <T eid="edu-sp-list-title" sx={{ fontWeight: 700, fontSize: 17 }}>Produksjoner</T>
            <Stack direction="row" spacing={1}>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} size="small" IconComponent={CaretIcon}
                sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}>
                {STATUS_OPTIONS.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 12.5 }}>{o}</MenuItem>)}
              </Select>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                <SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
                <InputBase placeholder="Søk i produksjoner" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ color: '#fff', fontSize: 12.5, width: 160, '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 } }} />
              </Stack>
            </Stack>
          </Stack>

          {productions.length === 0 ? (
            <T eid="edu-sp-empty" sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 13.5, py: 4, display: 'block' }}>Ingen produksjoner ennå — opprett din første under.</T>
          ) : visibleProductions.length === 0 ? (
            <T eid="edu-sp-nomatch" sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 13.5, py: 4, display: 'block' }}>Ingen produksjoner matcher filteret.</T>
          ) : visibleProductions.map((p, i) => {
            const pl = mapPipeline(p.projectStatus);
            return (
              <Stack key={p.id} direction="row" alignItems="center" spacing={2.25} sx={{ py: 2, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', flexWrap: { xs: 'wrap', xl: 'nowrap' } }}>
                <Box sx={{ width: 104, height: 70, borderRadius: 2.25, flexShrink: 0, background: THUMBS[i % THUMBS.length], border: '1px solid rgba(255,255,255,0.1)' }} />
                <Box sx={{ width: 240, flexShrink: 0, minWidth: 180 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{p.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{cohortName(p.cohortId)}</Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{p.assignmentCount} oppgaver</Typography>
                </Box>
                <Box sx={{ px: 1.5, py: 0.6, borderRadius: 5, flexShrink: 0, bgcolor: `${pl.color}22`, color: pl.color, fontSize: 12, fontWeight: 600, textAlign: 'center', minWidth: 96 }}>{pl.pill}</Box>
                <Box sx={{ width: 110, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>{pl.progress} %</Typography>
                  <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${pl.progress}%`, borderRadius: 3, background: `linear-gradient(90deg, ${pl.color}, #a78bfa)` }} /></Box>
                </Box>
                <Pipeline stage={pl.stage} color={pl.color} />
                <Stack spacing={1} sx={{ flexShrink: 0 }}>
                  <Button size="small" variant="outlined" startIcon={<OpenIcon />} onClick={() => openProductionInRoleRoom(p.projectId)} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>Åpne prosjekt</Button>
                  <Button size="small" variant="outlined" startIcon={<CallSheetIcon />} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>Call sheet</Button>
                </Stack>
                <IconButton size="small" onClick={() => handleDelete(p.id)} sx={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            );
          })}
        </Panel>

        {/* Kom i gang-bånd */}
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={2} sx={{ p: 2.25, borderRadius: 3, border: '1px dashed rgba(139,92,246,0.35)', bgcolor: 'rgba(139,92,246,0.05)' }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'rgba(139,92,246,0.2)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><RocketIcon /></Box>
          <Box sx={{ flex: 1 }}>
            <T eid="edu-sp-cta-title" sx={{ fontSize: 15, fontWeight: 700 }}>Kom i gang</T>
            <T eid="edu-sp-cta-body" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>Opprett din første studentproduksjon, eller bruk en av våre maler for å komme raskt i gang.</T>
          </Box>
          <Button variant="contained" onClick={() => setCreating(true)} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            <T eid="edu-sp-cta-btn" component="span" sx={{ fontWeight: 700 }}>Opprett første produksjon</T>
          </Button>
          <Button variant="outlined" startIcon={<TemplateIcon />} onClick={openTemplateDialog} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            <T eid="edu-sp-cta-template" component="span" sx={{ fontWeight: 600 }}>Bruk produksjonsmal</T>
          </Button>
        </Stack>
      </Box>

      {/* Høyre skinne */}
      <Stack spacing={2}>
        <Panel>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <T eid="edu-sp-rail-events-title" sx={{ fontWeight: 700, fontSize: 15 }}>Kommende aktiviteter</T>
            <T eid="edu-sp-rail-events-link" sx={{ color: ACCENT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Se kalender</T>
          </Stack>
          {[
            { id: 'a', bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd', icon: <CalendarIcon sx={{ fontSize: 15 }} />, t: 'Workshop: Story arc', s: 'I morgen, 10:00 – 11:30' },
            { id: 'b', bg: 'rgba(56,189,248,0.16)', c: '#38bdf8', icon: <ProductionIcon sx={{ fontSize: 15 }} />, t: 'Opptaksdag – MED101', s: 'Torsdag 2. mai, 09:00 – 17:00' },
            { id: 'c', bg: 'rgba(245,158,11,0.16)', c: '#f59e0b', icon: <StudentsIcon sx={{ fontSize: 15 }} />, t: 'Review session – MKD200', s: 'Fredag 3. mai, 13:00 – 15:00' },
            { id: 'd', bg: 'rgba(236,72,153,0.16)', c: '#ec4899', icon: <DeliverIcon sx={{ fontSize: 15 }} />, t: 'Leveransefrist – Kampanjevideo', s: '1. juni 2024' },
          ].map((e) => (
            <Stack key={e.id} direction="row" spacing={1.25} sx={{ py: 1 }}>
              <Box sx={{ width: 30, height: 30, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: e.bg, color: e.c, flexShrink: 0 }}>{e.icon}</Box>
              <Box><T eid={`edu-sp-evt-${e.id}-t`} sx={{ fontSize: 13, fontWeight: 600 }}>{e.t}</T><T eid={`edu-sp-evt-${e.id}-s`} sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.25 }}>{e.s}</T></Box>
            </Stack>
          ))}
        </Panel>
        <Panel>
          <T eid="edu-sp-rail-qa-title" sx={{ fontWeight: 700, fontSize: 14.5, mb: 1 }}>Hurtighandlinger</T>
          <QuickAction eid="edu-sp-qa-invite" icon={<InviteIcon />} label="Inviter team" onClick={() => onNavigate?.('cohorts')} />
          <QuickAction eid="edu-sp-qa-callsheet" icon={<CallSheetIcon />} label="Opprett call sheet" onClick={() => { const p = productions[0]; if (p) openProductionInRoleRoom(p.projectId); }} />
          <QuickAction eid="edu-sp-qa-deliver" icon={<DeliverIcon />} label="Legg til leveranse" onClick={() => onNavigate?.('assignments')} />
          <QuickAction eid="edu-sp-qa-review" icon={<ReviewIcon />} label="Start review" onClick={() => onNavigate?.('assessment')} />
        </Panel>
        <RailTips idPrefix="edu-sp" title="Tips fra The Role Room" body="Bruk maler for å sikre at alle prosjekter har en rød tråd og at viktige leveranser ikke glemmes." link="Se alle tips →" />
      </Stack>

      {/* Mal-dialog */}
      <Dialog open={tmplOpen} onClose={() => setTmplOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Opprett produksjon fra mal</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr', mb: 2 }}>
            {PRODUCTION_TEMPLATES.map((t) => {
              const active = t.id === tmplId;
              return (
                <Card key={t.id} sx={{ bgcolor: active ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 2.5 }}>
                  <CardActionArea onClick={() => { setTmplId(t.id); setTmplTitle(t.name); }} sx={{ p: 1.5, height: '100%' }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{t.name}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.4 }}>{t.description}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#c4b5fd', mt: 0.75, fontWeight: 600 }}>{t.assignments.length} oppgaver</Typography>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
          <Stack spacing={1.5}>
            <TextField size="small" label="Tittel på produksjonen" value={tmplTitle} onChange={(e) => setTmplTitle(e.target.value)} fullWidth />
            <TextField size="small" select label="Kull (valgfritt)" value={tmplCohortId} onChange={(e) => setTmplCohortId(e.target.value)} fullWidth>
              <MenuItem value="">Ingen</MenuItem>
              {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Såer {selectedTmpl.assignments.length} oppgaver: {selectedTmpl.assignments.map((a) => a.title).join(', ')}.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTmplOpen(false)} disabled={tmplBusy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button variant="contained" onClick={handleCreateFromTemplate} disabled={!tmplTitle.trim() || tmplBusy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}>{tmplBusy ? 'Oppretter…' : 'Opprett fra mal'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default ProductionsTab;
