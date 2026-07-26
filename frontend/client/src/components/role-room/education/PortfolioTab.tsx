/**
 * PortfolioTab.tsx — «Portefølje» (redesign, CMS-koblet).
 *
 * Studentenes showreels og eksamensmapper. Rader drives av EKTE kull + studenter
 * (educationCohortsService); «Del med sensor» oppretter en ekte sensor-invitasjon
 * for valgt kull (educationCensorService). Publiserings-/showreel-tellinger er
 * porteføljespesifikke og markert «kommer» til porteføljelageret er bygd.
 *
 * 🔑 CMS: stabile data-edit-id (edu-pf-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Alert, MenuItem, TextField,
  InputBase, Avatar, Snackbar,
} from '@mui/material';
import {
  CollectionsBookmark as PortfolioIcon, Add as AddIcon, IosShare as ShareIcon,
  Search as SearchIcon, KeyboardArrowDown as CaretIcon, Movie as ShowreelIcon,
  FolderSpecial as ExamIcon, Verified as PublishedIcon, OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort, type Student } from './educationCohortsService';
import { educationCensorService } from './educationCensorService';
import { educationStudentViewService } from './educationStudentViewService';
import { ACCENT, Panel, T } from './_eduUi';

type Row = { student: Student; cohort: Cohort };
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function PortfolioTab() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState('');
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const chs = await educationCohortsService.listCohorts();
      setCohorts(chs);
      const perCohort = await Promise.all(chs.map(async (c) => {
        try { return (await educationCohortsService.listStudents(c.id)).map((s) => ({ student: s, cohort: c })); }
        catch { return [] as Row[]; }
      }));
      setRows(perCohort.flat());
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente porteføljer'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shareWithCensor = async () => {
    const targetCohort = cohortFilter || cohorts[0]?.id;
    if (!targetCohort) { setError('Opprett et kull før du deler med sensor.'); return; }
    setSharing(true); setError(null);
    try {
      const invite = await educationCensorService.createInvite({ cohortId: targetCohort });
      const name = cohorts.find((c) => c.id === targetCohort)?.name ?? 'kullet';
      setToast(`Sensor-invitasjon opprettet for ${name}${invite.token ? ' — lenke klar til deling' : ''}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette sensor-invitasjon'); }
    finally { setSharing(false); }
  };

  const openStudent = async (studentId: string) => {
    try {
      const view = await educationStudentViewService.getStudentView(studentId);
      const prod = view.productions?.[0];
      if (prod?.projectId) window.open(`/theroleroom?project=${encodeURIComponent(prod.projectId)}`, '_blank', 'noopener');
      else setToast('Studenten har ingen publisert produksjon ennå.');
    } catch { setToast('Kunne ikke åpne studentens portefølje.'); }
  };

  const visible = useMemo(() => cohortFilter ? rows.filter((r) => r.cohort.id === cohortFilter) : rows, [rows, cohortFilter]);

  const kpis = [
    { id: 'porteflojer', label: 'Porteføljer', value: rows.length, hint: 'På tvers av alle kull', icon: <PortfolioIcon />, bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd' },
    { id: 'publiserte', label: 'Publiserte', value: '—', hint: 'Klare for visning', icon: <PublishedIcon />, bg: 'rgba(16,185,129,0.16)', c: '#34d399' },
    { id: 'showreels', label: 'Showreels', value: '—', hint: 'Videosammendrag', icon: <ShowreelIcon />, bg: 'rgba(236,72,153,0.16)', c: '#ec4899' },
    { id: 'eksamen', label: 'Eksamensmapper', value: '—', hint: 'Sendt til sensur', icon: <ExamIcon />, bg: 'rgba(56,189,248,0.16)', c: '#38bdf8' },
  ];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><PortfolioIcon /></Box>
          <Box>
            <T eid="edu-pf-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Portefølje</T>
            <T eid="edu-pf-subtitle" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, mt: 0.4 }}>Studentenes showreels og eksamensmapper — klare for visning og deling med sensor.</T>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<ShareIcon />} onClick={shareWithCensor} disabled={sharing} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            <T eid="edu-pf-btn-share" component="span" sx={{ fontWeight: 600 }}>{sharing ? 'Deler…' : 'Del med sensor'}</T>
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            <T eid="edu-pf-btn-new" component="span" sx={{ fontWeight: 700 }}>Ny portefølje</T>
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        {kpis.map((k) => (
          <Panel key={k.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <T eid={`edu-pf-kpi-${k.id}-label`} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k.label}</T>
              <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: k.bg, color: k.c, '& svg': { fontSize: 19 } }}>{k.icon}</Box>
            </Stack>
            <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{k.value}</Typography>
            <T eid={`edu-pf-kpi-${k.id}-hint`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', mt: 0.75 }}>{k.hint}</T>
          </Panel>
        ))}
      </Box>

      {/* Studentporteføljer */}
      <Panel sx={{ p: 0, overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
          <T eid="edu-pf-list-title" sx={{ fontWeight: 700, fontSize: 15, mr: 1 }}>Studentporteføljer</T>
          <TextField size="small" select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} SelectProps={{ displayEmpty: true }} sx={{ minWidth: 150, '& .MuiInputBase-root': { fontSize: 12.5 } }}>
            <MenuItem value="">Alle kull</MenuItem>
            {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
            <T eid="edu-pf-filter-status" component="span" sx={{ fontSize: 12.5 }}>Alle statuser</T><CaretIcon sx={{ fontSize: 15 }} />
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
            <SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
            <InputBase placeholder="Søk etter student" sx={{ color: '#fff', fontSize: 12.5, width: 150, '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 } }} />
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 100px', px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['student', 'Student'], ['prosjekt', 'Kull · prosjekt'], ['status', 'Status'], ['open', '']].map(([id, label]) => (
            <T key={id} eid={`edu-pf-th-${id}`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label}</T>
          ))}
        </Box>

        {visible.length === 0 ? (
          <T eid="edu-pf-empty" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13.5, display: 'block' }}>Ingen studentporteføljer ennå — legg til studenter i Kull &amp; studenter først.</T>
        ) : visible.map((r) => (
          <Box key={r.student.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 100px', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
              <Avatar sx={{ width: 32, height: 32, fontSize: 11.5, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff' }}>{initials(r.student.name)}</Avatar>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.student.name}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 2 }}>{r.cohort.name}</Typography>
            <Box><Box sx={{ display: 'inline-block', px: 1.25, py: 0.4, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: 600 }}>Utkast</Box></Box>
            <Button size="small" variant="outlined" startIcon={<OpenIcon sx={{ fontSize: '14px !important' }} />} onClick={() => openStudent(r.student.id)} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', borderRadius: 2, fontSize: 12, justifySelf: 'end', whiteSpace: 'nowrap' }}>Åpne</Button>
          </Box>
        ))}
      </Panel>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default PortfolioTab;
