/**
 * PortfolioTab.tsx — «Portefølje» (CMS-koblet, ekte backend).
 *
 * Studentenes showreels og eksamensmapper — ekte porteføljeelementer via
 * educationPortfolioService (opprett, publiser/avpubliser, slett). Hver rad er
 * et porteføljeelement knyttet til en student. «Del med sensor» oppretter en
 * ekte sensor-invitasjon (educationCensorService); «Åpne» går til lenke eller
 * studentens produksjon (educationStudentViewService).
 *
 * 🔑 CMS: stabile data-edit-id (edu-pf-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Alert, MenuItem, TextField,
  InputBase, Avatar, Snackbar, Select, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  CollectionsBookmark as PortfolioIcon, Add as AddIcon, IosShare as ShareIcon,
  Search as SearchIcon, KeyboardArrowDown as CaretIcon, Movie as ShowreelIcon,
  FolderSpecial as ExamIcon, Verified as PublishedIcon, OpenInNew as OpenIcon,
  Delete as DeleteIcon, Publish as PublishIcon, Undo as UnpublishIcon,
  TheaterComedy as TalentIcon, Verified as VerifiedIcon, Storefront as ShowcaseIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort, type Student } from './educationCohortsService';
import { educationCensorService } from './educationCensorService';
import { educationStudentViewService } from './educationStudentViewService';
import { educationPortfolioService, type Portfolio, type PortfolioKind } from './educationPortfolioService';
import { educationTalentPipelineService, type PipelineRow, type ShowcaseEntry } from './educationTalentPipelineService';
import { ACCENT, Panel, T } from './_eduUi';

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export function PortfolioTab() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<{ student: Student; cohort: Cohort }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sharing, setSharing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Ny-portefølje-dialog.
  const [newOpen, setNewOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newKind, setNewKind] = useState<PortfolioKind>('showreel');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [creating, setCreating] = useState(false);

  // Avgangs-pipeline (utdanning → Talents).
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [promoteStudent, setPromoteStudent] = useState<{ id: string; name: string; program: string | null } | null>(null);
  const [promoteInstitution, setPromoteInstitution] = useState('');
  const [promoteProgram, setPromoteProgram] = useState('');
  const [promoteYear, setPromoteYear] = useState(String(new Date().getFullYear()));
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseEntry[]>([]);
  const [showcaseBusy, setShowcaseBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [chs, pfs, pipe] = await Promise.all([
        educationCohortsService.listCohorts(),
        educationPortfolioService.listPortfolios(),
        educationTalentPipelineService.getPipeline().catch(() => [] as PipelineRow[]),
      ]);
      setCohorts(chs); setPortfolios(pfs); setPipeline(pipe);
      const perCohort = await Promise.all(chs.map(async (c) => {
        try { return (await educationCohortsService.listStudents(c.id)).map((s) => ({ student: s, cohort: c })); }
        catch { return [] as { student: Student; cohort: Cohort }[]; }
      }));
      setStudents(perCohort.flat());
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente porteføljer'); }
    finally { setLoading(false); }
  }, []);

  const talentStatusFor = useCallback((studentId: string): PipelineRow['status'] => pipeline.find((r) => r.studentId === studentId)?.status ?? 'none', [pipeline]);

  const openPromote = (studentId: string, name: string, program: string | null) => {
    setPromoteStudent({ id: studentId, name, program });
    setPromoteInstitution(localStorage.getItem('rr_edu_institution') ?? '');
    setPromoteProgram(program ?? '');
    setPromoteYear(String(new Date().getFullYear()));
  };
  const confirmPromote = async () => {
    if (!promoteStudent || promoteBusy) return;
    setPromoteBusy(true); setError(null);
    try {
      if (promoteInstitution.trim()) localStorage.setItem('rr_edu_institution', promoteInstitution.trim());
      const r = await educationTalentPipelineService.promote(promoteStudent.id, {
        institution: promoteInstitution.trim() || undefined,
        program: promoteProgram.trim() || undefined,
        year: Number(promoteYear) || undefined,
      });
      setPromoteStudent(null);
      setToast(r.alreadyPromoted ? 'Studenten er allerede på Talents.' : `${promoteStudent.name} promotert til Talents (claimable)${r.hasShowreel ? ' m/ showreel' : ''}.`);
      setPipeline(await educationTalentPipelineService.getPipeline().catch(() => pipeline));
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke promotere'); }
    finally { setPromoteBusy(false); }
  };

  const openShowcase = async () => {
    const cohortId = cohortFilter || cohorts[0]?.id;
    if (!cohortId) { setError('Velg et kull for å se avgangs-showcase.'); return; }
    setShowcaseOpen(true); setShowcaseBusy(true);
    try { setShowcase(await educationTalentPipelineService.getShowcase(cohortId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente showcase'); }
    finally { setShowcaseBusy(false); }
  };
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

  const handleCreate = async () => {
    if (!newStudentId || creating) return;
    setCreating(true); setError(null);
    try {
      const pf = await educationPortfolioService.createPortfolio({ studentId: newStudentId, kind: newKind, title: newTitle.trim() || undefined, url: newUrl.trim() || undefined });
      setPortfolios((prev) => [pf, ...prev]);
      setNewOpen(false); setNewStudentId(''); setNewKind('showreel'); setNewTitle(''); setNewUrl('');
      setToast('Portefølje opprettet.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette portefølje'); }
    finally { setCreating(false); }
  };

  const togglePublish = async (p: Portfolio) => {
    setBusyId(p.id);
    try {
      const updated = await educationPortfolioService.updatePortfolio(p.id, { status: p.status === 'published' ? 'draft' : 'published' });
      setPortfolios((prev) => prev.map((x) => x.id === p.id ? updated : x));
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke endre status'); }
    finally { setBusyId(null); }
  };

  const handleDelete = async (id: string) => {
    try { await educationPortfolioService.deletePortfolio(id); setPortfolios((prev) => prev.filter((p) => p.id !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke slette'); }
  };

  const openPortfolio = async (p: Portfolio) => {
    if (p.url) { window.open(p.url, '_blank', 'noopener'); return; }
    try {
      const view = await educationStudentViewService.getStudentView(p.studentId);
      const prod = view.productions?.[0];
      if (prod?.projectId) window.open(`/theroleroom?project=${encodeURIComponent(prod.projectId)}`, '_blank', 'noopener');
      else setToast('Ingen lenke eller produksjon å åpne ennå.');
    } catch { setToast('Kunne ikke åpne porteføljen.'); }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return portfolios.filter((p) =>
      (!cohortFilter || p.cohortId === cohortFilter)
      && (statusFilter === 'all' || p.status === statusFilter)
      && (!q || p.studentName.toLowerCase().includes(q) || (p.title ?? '').toLowerCase().includes(q)));
  }, [portfolios, cohortFilter, statusFilter, query]);

  const kpis = [
    { id: 'porteflojer', label: 'Porteføljer', value: portfolios.length, hint: 'På tvers av alle kull', icon: <PortfolioIcon />, bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd' },
    { id: 'publiserte', label: 'Publiserte', value: portfolios.filter((p) => p.status === 'published').length, hint: 'Klare for visning', icon: <PublishedIcon />, bg: 'rgba(16,185,129,0.16)', c: '#34d399' },
    { id: 'showreels', label: 'Showreels', value: portfolios.filter((p) => p.kind === 'showreel').length, hint: 'Videosammendrag', icon: <ShowreelIcon />, bg: 'rgba(236,72,153,0.16)', c: '#ec4899' },
    { id: 'eksamen', label: 'Eksamensmapper', value: portfolios.filter((p) => p.kind === 'exam').length, hint: 'Sendt til sensur', icon: <ExamIcon />, bg: 'rgba(56,189,248,0.16)', c: '#38bdf8' },
  ];

  const kindLabel = (k: PortfolioKind) => k === 'exam' ? 'Eksamensmappe' : 'Showreel';

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
          <Button variant="outlined" startIcon={<ShowcaseIcon />} onClick={openShowcase} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            <T eid="edu-pf-btn-showcase" component="span" sx={{ fontWeight: 600 }}>Avgangs-showcase</T>
          </Button>
          <Button variant="outlined" startIcon={<ShareIcon />} onClick={shareWithCensor} disabled={sharing} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            <T eid="edu-pf-btn-share" component="span" sx={{ fontWeight: 600 }}>{sharing ? 'Deler…' : 'Del med sensor'}</T>
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { if (students.length === 0) { setError('Legg til studenter i Kull & studenter først.'); return; } setNewOpen(true); }} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
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
          <Select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} size="small" displayEmpty IconComponent={CaretIcon}
            sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, minWidth: 130, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}>
            <MenuItem value="" sx={{ fontSize: 12.5 }}>Alle kull</MenuItem>
            {cohorts.map((c) => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12.5 }}>{c.name}</MenuItem>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} size="small" IconComponent={CaretIcon}
            sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', borderRadius: 2, minWidth: 120, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-select': { py: 0.75 }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}>
            <MenuItem value="all" sx={{ fontSize: 12.5 }}>Alle statuser</MenuItem>
            <MenuItem value="published" sx={{ fontSize: 12.5 }}>Publisert</MenuItem>
            <MenuItem value="draft" sx={{ fontSize: 12.5 }}>Utkast</MenuItem>
          </Select>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.75, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
            <SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
            <InputBase placeholder="Søk etter student" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ color: '#fff', fontSize: 12.5, width: 150, '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 } }} />
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 150px', px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['student', 'Student'], ['prosjekt', 'Kull · portefølje'], ['status', 'Status'], ['open', '']].map(([id, label]) => (
            <T key={id} eid={`edu-pf-th-${id}`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label}</T>
          ))}
        </Box>

        {portfolios.length === 0 ? (
          <T eid="edu-pf-empty" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13.5, display: 'block' }}>Ingen porteføljer ennå — trykk «Ny portefølje» for å opprette den første.</T>
        ) : visible.length === 0 ? (
          <T eid="edu-pf-nomatch" sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13.5, display: 'block' }}>Ingen porteføljer matcher filteret.</T>
        ) : visible.map((p) => {
          const published = p.status === 'published';
          const tstatus = talentStatusFor(p.studentId);
          const tMeta = tstatus === 'claimed'
            ? { title: 'På Talents ✓ (studenten har overtatt)', color: '#34d399', icon: <VerifiedIcon fontSize="small" /> }
            : tstatus === 'claimable'
              ? { title: 'Claimable på Talents — venter på at studenten overtar', color: '#f59e0b', icon: <TalentIcon fontSize="small" /> }
              : { title: 'Promoter til Talents-registeret', color: 'rgba(255,255,255,0.5)', icon: <TalentIcon fontSize="small" /> };
          return (
            <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 150px', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                <Avatar sx={{ width: 32, height: 32, fontSize: 11.5, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff' }}>{initials(p.studentName)}</Avatar>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.studentName}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, pr: 2 }}>
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[p.cohortName, p.title || kindLabel(p.kind)].filter(Boolean).join(' · ')}</Typography>
                <Chip label={kindLabel(p.kind)} size="small" sx={{ height: 18, fontSize: 9.5, fontWeight: 700, bgcolor: p.kind === 'exam' ? 'rgba(56,189,248,0.15)' : 'rgba(236,72,153,0.15)', color: p.kind === 'exam' ? '#38bdf8' : '#ec4899', flexShrink: 0 }} />
              </Stack>
              <Box><Box sx={{ display: 'inline-block', px: 1.25, py: 0.4, borderRadius: 5, bgcolor: published ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)', color: published ? '#34d399' : 'rgba(255,255,255,0.6)', fontSize: 11.5, fontWeight: 600 }}>{published ? 'Publisert' : 'Utkast'}</Box></Box>
              <Stack direction="row" alignItems="center" spacing={0.25} justifyContent="flex-end">
                <Tooltip title={tMeta.title}><span><IconButton size="small" onClick={() => tstatus === 'none' && openPromote(p.studentId, p.studentName, p.cohortName)} disabled={tstatus !== 'none'} sx={{ color: tMeta.color, '&.Mui-disabled': { color: tMeta.color } }}>{tMeta.icon}</IconButton></span></Tooltip>
                <Tooltip title={published ? 'Avpubliser' : 'Publiser'}><span><IconButton size="small" onClick={() => togglePublish(p)} disabled={busyId === p.id} sx={{ color: published ? '#34d399' : 'rgba(255,255,255,0.5)' }}>{published ? <UnpublishIcon fontSize="small" /> : <PublishIcon fontSize="small" />}</IconButton></span></Tooltip>
                <Tooltip title="Åpne"><IconButton size="small" onClick={() => openPortfolio(p)} sx={{ color: 'rgba(255,255,255,0.5)' }}><OpenIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Slett"><IconButton size="small" onClick={() => handleDelete(p.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            </Box>
          );
        })}
      </Panel>

      {/* Ny-portefølje-dialog */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Ny portefølje</DialogTitle>
        <DialogContent>
          <Stack spacing={1.75} sx={{ mt: 0.5 }}>
            <TextField select size="small" label="Student" value={newStudentId} onChange={(e) => setNewStudentId(e.target.value)} fullWidth>
              {students.map(({ student, cohort }) => <MenuItem key={student.id} value={student.id}>{student.name} · {cohort.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Type" value={newKind} onChange={(e) => setNewKind(e.target.value as PortfolioKind)} fullWidth>
              <MenuItem value="showreel">Showreel</MenuItem>
              <MenuItem value="exam">Eksamensmappe</MenuItem>
            </TextField>
            <TextField size="small" label="Tittel (valgfritt)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} fullWidth />
            <TextField size="small" label="Lenke (valgfritt)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewOpen(false)} disabled={creating} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newStudentId || creating} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}>{creating ? 'Oppretter…' : 'Opprett'}</Button>
        </DialogActions>
      </Dialog>

      {/* Promoter-til-Talents-dialog */}
      <Dialog open={!!promoteStudent} onClose={() => setPromoteStudent(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Promoter til Talents</DialogTitle>
        <DialogContent>
          <T eid="edu-pf-promote-help" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', mb: 2 }}>
            Oppretter en <b>claimable</b> talent-profil for {promoteStudent?.name} i Role Room Talents — forhåndsfylt med publisert showreel + skole-verifisert credential. Studenten overtar profilen selv (matcher e-post) og styrer samtykke; den blir <b>ikke</b> synlig for byråer før studenten gir consent.
          </T>
          <Stack spacing={1.5}>
            <TextField size="small" label="Institusjon" value={promoteInstitution} onChange={(e) => setPromoteInstitution(e.target.value)} placeholder="f.eks. Kunsthøgskolen i Oslo" fullWidth />
            <TextField size="small" label="Program" value={promoteProgram} onChange={(e) => setPromoteProgram(e.target.value)} placeholder="f.eks. Bachelor skuespillerfag" fullWidth />
            <TextField size="small" type="number" label="Avgangsår" value={promoteYear} onChange={(e) => setPromoteYear(e.target.value)} sx={{ width: 140 }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPromoteStudent(null)} disabled={promoteBusy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button variant="contained" startIcon={<TalentIcon />} onClick={confirmPromote} disabled={promoteBusy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}>{promoteBusy ? 'Promoterer…' : 'Promoter'}</Button>
        </DialogActions>
      </Dialog>

      {/* Avgangs-showcase-dialog */}
      <Dialog open={showcaseOpen} onClose={() => setShowcaseOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Avgangs-showcase</DialogTitle>
        <DialogContent>
          <T eid="edu-pf-showcase-help" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', mb: 2 }}>
            Avgangskullet som er promotert til Talents. Byråer/casting ser kun de studentene selv har gitt samtykke til (via Talents-profilen sin).
          </T>
          {showcaseBusy ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
          ) : showcase.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>Ingen promoterte talenter i dette kullet ennå. Bruk «Promoter til Talents» på en student.</Typography>
          ) : showcase.map((s) => (
            <Stack key={s.talentId} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Avatar sx={{ width: 36, height: 36, fontSize: 12, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff' }}>{initials(s.name)}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</Typography>
                  {s.claimed ? <VerifiedIcon sx={{ fontSize: 15, color: '#34d399' }} /> : <Chip label="Claimable" size="small" sx={{ height: 17, fontSize: 9.5, bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }} />}
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{[s.credential?.program, s.credential?.institution, s.credential?.year].filter(Boolean).join(' · ') || 'Skuespiller'}</Typography>
              </Box>
              {s.showreelUrl && <Button size="small" href={s.showreelUrl} target="_blank" rel="noopener" startIcon={<ShowreelIcon sx={{ fontSize: '15px !important' }} />} sx={{ color: '#c4b5fd', textTransform: 'none', fontSize: 12 }}>Showreel</Button>}
            </Stack>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowcaseOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default PortfolioTab;
