/**
 * AssignmentsTab.tsx — «Oppgaver» (redesign, CMS-koblet).
 *
 * Faglærer lager en oppgave (tittel, brief, læringsmål, frist, kobling til kull/
 * produksjon) og følger innleveringer. Design speiler mockup: KPI-kort, filter-
 * bar og oppgave-tabell (oppgave / kull / frist / status / innleveringer / åpne).
 * Ekte data + CRUD via educationAssignmentsService. Filtrene er visuelle (statisk).
 *
 * 🔑 CMS: stabile data-edit-id (edu-op-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Collapse, TextField, MenuItem,
  CircularProgress, Alert, InputBase, LinearProgress, Select, Menu, ListItemText, Chip,
} from '@mui/material';
import {
  Assignment as AssignmentIcon, Add as AddIcon, GridView as TemplateIcon,
  Grading as ReviewIcon, EventBusy as DueIcon, ReportProblem as MissingIcon,
  Search as SearchIcon, OpenInNew as OpenIcon, Delete as DeleteIcon,
  KeyboardArrowDown as CaretIcon, CheckCircle as ActiveIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { educationProductionsService, openProductionInRoleRoom, type Production } from './educationProductionsService';
import { educationAssignmentsService, type Assignment, type AssignmentStatus } from './educationAssignmentsService';
import { ASSIGNMENT_TEMPLATES } from './educationTemplates';
import { ACCENT, Panel, T } from './_eduUi';

// Produksjons-artefakt en oppgave kan peke på (fane-nøkkel i produksjonsverktøyet).
const ARTIFACT_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Fri leveranse' },
  { key: 'story-arc', label: 'Story Arc' },
  { key: 'storyboard', label: 'Storyboard' },
  { key: 'shotlist', label: 'Shot list' },
  { key: 'callsheet', label: 'Call sheet' },
  { key: 'roles', label: 'Roller' },
  { key: 'candidates', label: 'Kandidater' },
  { key: 'delivery', label: 'Levering' },
];
const artifactLabel = (k: string | null) => ARTIFACT_OPTIONS.find((o) => o.key === k)?.label ?? null;

const STATUS_META: Record<AssignmentStatus, { label: string; color: string }> = {
  draft: { label: 'Utkast', color: 'rgba(255,255,255,0.55)' },
  published: { label: 'Pågår', color: '#38bdf8' },
  archived: { label: 'Arkivert', color: 'rgba(255,255,255,0.4)' },
};

function relDue(dueAt: string | null): { text: string; overdue: boolean } {
  if (!dueAt) return { text: 'Ingen frist', overdue: false };
  const due = new Date(dueAt).getTime();
  const now = new Date().getTime();
  const days = Math.round((due - now) / 86_400_000);
  if (days < 0) return { text: `${Math.abs(days)} dager på overtid`, overdue: true };
  if (days === 0) return { text: 'I dag', overdue: false };
  if (days === 1) return { text: 'I morgen', overdue: false };
  return { text: `Om ${days} dager`, overdue: false };
}

export function AssignmentsTab({ prefillProductionId, onPrefillConsumed }: { prefillProductionId?: string | null; onPrefillConsumed?: () => void } = {}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({ title: '', cohortId: '', productionId: '', brief: '', learningGoals: '', dueAt: '', artifactKind: '' });
  const setField = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentStatus>('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [tmplAnchor, setTmplAnchor] = useState<null | HTMLElement>(null);

  const applyTemplate = (t: { name: string; brief: string; learningGoals: string }) => {
    setF((p) => ({ ...p, title: t.name, brief: t.brief, learningGoals: t.learningGoals }));
    setCreating(true); setTmplAnchor(null);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [a, c, p] = await Promise.all([
        educationAssignmentsService.listAssignments(),
        educationCohortsService.listCohorts(),
        educationProductionsService.listProductions(),
      ]);
      setAssignments(a); setCohorts(c); setProductions(p);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente oppgaver'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // «Legg til oppgave» fra en produksjon → forhåndsvelg produksjon + kull, åpne skjema.
  useEffect(() => {
    if (!prefillProductionId || productions.length === 0) return;
    const prod = productions.find((p) => p.id === prefillProductionId);
    setF((prev) => ({ ...prev, productionId: prefillProductionId, cohortId: prod?.cohortId ?? prev.cohortId }));
    setCreating(true);
    onPrefillConsumed?.();
  }, [prefillProductionId, productions, onPrefillConsumed]);

  const handleCreate = async () => {
    if (!f.title.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      await educationAssignmentsService.createAssignment({
        title: f.title.trim(), cohortId: f.cohortId || null, productionId: f.productionId || null,
        brief: f.brief.trim() || undefined, learningGoals: f.learningGoals.trim() || undefined,
        dueAt: f.dueAt || null, status: 'published',
        artifactKind: (f.productionId && f.artifactKind) ? f.artifactKind : undefined,
      });
      setF({ title: '', cohortId: '', productionId: '', brief: '', learningGoals: '', dueAt: '', artifactKind: '' });
      setCreating(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette oppgave'); }
    finally { setBusy(false); }
  };
  const handleDelete = async (id: string) => {
    try { await educationAssignmentsService.deleteAssignment(id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke slette'); }
  };
  const cohortName = (id: string | null) => cohorts.find((c) => c.id === id)?.name ?? null;

  const kpis = useMemo(() => {
    const active = assignments.filter((a) => a.status === 'published').length;
    const toReview = assignments.reduce((n, a) => n + Math.max(0, a.submittedCount - a.reviewedCount), 0);
    const dueThisWeek = assignments.filter((a) => { const d = relDue(a.dueAt); return !d.overdue && a.dueAt && (new Date(a.dueAt).getTime() - Date.now()) < 7 * 86_400_000; }).length;
    const missing = assignments.reduce((n, a) => n + Math.max(0, a.submittedCount - a.reviewedCount), 0);
    return [
      { id: 'aktive', label: 'Aktive oppgaver', value: active, hint: 'Publisert og pågående', icon: <ActiveIcon />, bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd' },
      { id: 'vurder', label: 'Til vurdering', value: toReview, hint: 'Innleveringer venter', icon: <ReviewIcon />, bg: 'rgba(245,158,11,0.16)', c: '#f59e0b' },
      { id: 'frist', label: 'Forfaller denne uken', value: dueThisWeek, hint: 'Kommende frister', icon: <DueIcon />, bg: 'rgba(56,189,248,0.16)', c: '#38bdf8' },
      { id: 'mangler', label: 'Manglende innleveringer', value: missing, hint: 'Krever oppfølging', icon: <MissingIcon />, bg: 'rgba(236,72,153,0.16)', c: '#ec4899' },
    ];
  }, [assignments]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assignments.filter((a) => {
      if (q && !a.title.toLowerCase().includes(q) && !(a.brief ?? '').toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (cohortFilter !== 'all' && a.cohortId !== cohortFilter) return false;
      return true;
    });
  }, [assignments, query, statusFilter, cohortFilter]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><AssignmentIcon /></Box>
          <Box>
            <T eid="edu-op-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Oppgaver</T>
            <T eid="edu-op-subtitle" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, mt: 0.4 }}>Oppgave-brief → student-leveranse → frist, koblet til kull, produksjon og læringsmål.</T>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<TemplateIcon />} onClick={(e) => setTmplAnchor(e.currentTarget)} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            <T eid="edu-op-btn-template" component="span" sx={{ fontWeight: 600 }}>Opprett fra mal</T>
          </Button>
          <Menu anchorEl={tmplAnchor} open={!!tmplAnchor} onClose={() => setTmplAnchor(null)}
            PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', maxWidth: 320 } }}>
            {ASSIGNMENT_TEMPLATES.map((t) => (
              <MenuItem key={t.id} onClick={() => applyTemplate(t)} sx={{ display: 'block', py: 1 }}>
                <ListItemText primary={t.name} secondary={t.description}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
                  secondaryTypographyProps={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', sx: { whiteSpace: 'normal' } }} />
              </MenuItem>
            ))}
          </Menu>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            <T eid="edu-op-btn-new" component="span" sx={{ fontWeight: 700 }}>Ny oppgave</T>
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Collapse in={creating}>
        <Panel sx={{ border: '1px solid rgba(139,92,246,0.35)' }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" label="Tittel" value={f.title} onChange={(e) => setField('title', e.target.value)} fullWidth />
              <TextField size="small" type="date" label="Frist" InputLabelProps={{ shrink: true }} value={f.dueAt} onChange={(e) => setField('dueAt', e.target.value)} sx={{ minWidth: 170 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" select label="Kull" value={f.cohortId} onChange={(e) => setField('cohortId', e.target.value)} fullWidth>
                <MenuItem value="">Ingen</MenuItem>
                {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Produksjon" value={f.productionId} onChange={(e) => setField('productionId', e.target.value)} fullWidth>
                <MenuItem value="">Ingen</MenuItem>
                {productions.map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Artefakt" value={f.artifactKind} onChange={(e) => setField('artifactKind', e.target.value)} disabled={!f.productionId} helperText={!f.productionId ? 'Velg produksjon først' : undefined} sx={{ minWidth: 150 }}>
                {ARTIFACT_OPTIONS.map((o) => <MenuItem key={o.key || 'free'} value={o.key}>{o.label}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField size="small" label="Brief" value={f.brief} onChange={(e) => setField('brief', e.target.value)} multiline minRows={2} fullWidth />
            <TextField size="small" label="Læringsmål" value={f.learningGoals} onChange={(e) => setField('learningGoals', e.target.value)} fullWidth />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={() => setCreating(false)} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!f.title.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}>{busy ? 'Oppretter…' : 'Publiser oppgave'}</Button>
            </Stack>
          </Stack>
        </Panel>
      </Collapse>

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        {kpis.map((k) => (
          <Panel key={k.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <T eid={`edu-op-kpi-${k.id}-label`} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k.label}</T>
              <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: k.bg, color: k.c, '& svg': { fontSize: 19 } }}>{k.icon}</Box>
            </Stack>
            <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{k.value}</Typography>
            <T eid={`edu-op-kpi-${k.id}-hint`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', mt: 0.75 }}>{k.hint}</T>
          </Panel>
        ))}
      </Box>

      {/* Filter + tabell */}
      <Panel sx={{ p: 0, overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | AssignmentStatus)} size="small" IconComponent={CaretIcon}
            sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}>
            <MenuItem value="all" sx={{ fontSize: 12.5 }}>Alle status</MenuItem>
            <MenuItem value="published" sx={{ fontSize: 12.5 }}>Pågår</MenuItem>
            <MenuItem value="draft" sx={{ fontSize: 12.5 }}>Utkast</MenuItem>
            <MenuItem value="archived" sx={{ fontSize: 12.5 }}>Arkivert</MenuItem>
          </Select>
          <Select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} size="small" IconComponent={CaretIcon}
            sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, minWidth: 130, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}>
            <MenuItem value="all" sx={{ fontSize: 12.5 }}>Alle kull</MenuItem>
            {cohorts.map((c) => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12.5 }}>{c.name}</MenuItem>)}
          </Select>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
            <SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
            <InputBase placeholder="Søk i oppgaver" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ color: '#fff', fontSize: 12.5, width: 160, '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 } }} />
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1fr 1fr 1.2fr 120px', px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['oppgave', 'Oppgave'], ['kull', 'Knyttet kull'], ['frist', 'Frist'], ['status', 'Status'], ['innlev', 'Innleveringer'], ['open', '']].map(([id, label]) => (
            <T key={id} eid={`edu-op-th-${id}`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label}</T>
          ))}
        </Box>

        {assignments.length === 0 ? (
          <T eid="edu-op-empty" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13.5, display: 'block' }}>Ingen oppgaver ennå — opprett din første over.</T>
        ) : visible.length === 0 ? (
          <T eid="edu-op-nomatch" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13.5, display: 'block' }}>Ingen oppgaver matcher filteret.</T>
        ) : visible.map((a) => {
          const sm = STATUS_META[a.status];
          const due = relDue(a.dueAt);
          const pct = a.submittedCount > 0 ? Math.round((a.reviewedCount / a.submittedCount) * 100) : 0;
          return (
            <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: '2.4fr 1.4fr 1fr 1fr 1.2fr 120px', alignItems: 'center', px: 2, py: 1.75, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Box sx={{ minWidth: 0, pr: 2 }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</Typography>
                  {artifactLabel(a.artifactKind) && <Chip label={artifactLabel(a.artifactKind)} size="small" sx={{ height: 18, fontSize: 9.5, fontWeight: 700, bgcolor: 'rgba(139,92,246,0.18)', color: '#c4b5fd', flexShrink: 0 }} />}
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.productionTitle ? `Produksjon · ${a.productionTitle}` : (a.brief || 'Oppgave')}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{cohortName(a.cohortId) ?? '—'}</Typography>
              <Typography sx={{ fontSize: 12.5, color: due.overdue ? '#ec4899' : 'text.secondary', fontWeight: due.overdue ? 700 : 400 }}>{due.text}</Typography>
              <Box><Box sx={{ display: 'inline-block', px: 1.25, py: 0.4, borderRadius: 5, bgcolor: `${sm.color}22`, color: sm.color, fontSize: 11.5, fontWeight: 600 }}>{sm.label}</Box></Box>
              <Box sx={{ pr: 2 }}>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mb: 0.5 }}>{a.reviewedCount}/{a.submittedCount} vurdert</Typography>
                <LinearProgress variant="determinate" value={pct} sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5} justifyContent="flex-end">
                <Button size="small" variant="outlined" startIcon={<OpenIcon sx={{ fontSize: '14px !important' }} />} onClick={() => a.productionProjectId && openProductionInRoleRoom(a.productionProjectId, a.artifactKind || undefined)} disabled={!a.productionProjectId} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', borderRadius: 2, fontSize: 12, whiteSpace: 'nowrap' }}>Åpne</Button>
                <IconButton size="small" onClick={() => handleDelete(a.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
            </Box>
          );
        })}
      </Panel>
    </Box>
  );
}

export default AssignmentsTab;
