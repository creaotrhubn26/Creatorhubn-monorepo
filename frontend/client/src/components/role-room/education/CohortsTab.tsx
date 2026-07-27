/**
 * CohortsTab.tsx — «Kull & studenter» (redesign, CMS-koblet).
 *
 * Ekte data via educationCohortsService (kull + studenter + CRUD). Design speiler
 * mockup: Canvas-oppdagelsesbanner, oppsett-stepper, KPI-kort, kull-liste og
 * student-tabell + høyre skinne. Canvas-spesifikke deler (kurs-import, live sync)
 * er statiske «kommer»-flater til Canvas-API-integrasjonen er bygd.
 *
 * 🔑 CMS: hvert statiske element har en stabil data-edit-id, så visual-editoren
 * (useElementEdits/WorkspaceDesignOverlay i App.tsx) kan redigere alt drift-sikkert.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Card, CardActionArea, Button, IconButton, Chip,
  CircularProgress, Alert, Collapse, TextField, Tooltip, InputBase, Avatar,
  Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar,
  type TypographyProps,
} from '@mui/material';
import {
  Groups as CohortIcon, Add as AddIcon, Close as CloseIcon, School as CanvasIcon,
  CheckCircle as CheckIcon, PersonAdd as InviteIcon, UploadFile as CsvIcon,
  ChevronRight as ChevronIcon, Search as SearchIcon,
  Sync as SyncIcon, CloudUpload as ImportIcon, Delete as DeleteIcon,
  KeyboardArrowDown as CaretIcon, Inventory2 as ArchiveIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort, type Student } from './educationCohortsService';
import { educationGroupsService, type EducationGroup } from './educationGroupsService';
import { educationAssignmentsService } from './educationAssignmentsService';
import educationLtiService, { type LtiContext, type LtiSections } from './educationLtiService';
import type { EducationTabId } from './EducationWorkspace';

const ACCENT = '#8B5CF6';
const CARD = 'rgba(255,255,255,0.035)';
const BORDER = '1px solid rgba(255,255,255,0.08)';

/** data-edit-id-tagget Typography (kortform for CMS-redigerbar tekst). */
function T({ eid, children, ...rest }: { eid: string; children: React.ReactNode } & Omit<TypographyProps, 'children'>) {
  return <Typography data-edit-id={eid} {...rest}>{children}</Typography>;
}

function Panel({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return <Card sx={{ bgcolor: CARD, border: BORDER, borderRadius: 3, p: 2.5, ...sx }}>{children}</Card>;
}

/**
 * Parser CSV/limt-inn tekst til student-rader. Kolonnerekkefølge: navn, e-post,
 * studentnr. Godtar komma eller semikolon; hopper over header-rad (navn/e-post).
 */
function parseCsvStudents(text: string): { name: string; email?: string; studentNumber?: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: { name: string; email?: string; studentNumber?: string }[] = [];
  lines.forEach((line, i) => {
    const cols = line.split(/[,;]/).map((c) => c.trim());
    const lower = line.toLowerCase();
    if (i === 0 && (lower.includes('navn') || lower.includes('name') || lower.includes('e-post') || lower.includes('email'))) return; // header
    const name = cols[0] ?? '';
    if (!name) return;
    out.push({ name, email: cols[1] || undefined, studentNumber: cols[2] || undefined });
  });
  return out;
}

function QuickAction({ eid, icon, label, onClick }: { eid: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} onClick={onClick} sx={{ py: 1.1, cursor: 'pointer', color: 'rgba(255,255,255,0.85)', '&:hover': { color: '#fff' } }}>
      <Box sx={{ width: 30, height: 30, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', flexShrink: 0, '& svg': { fontSize: 16 } }}>{icon}</Box>
      <T eid={eid} sx={{ fontSize: 13, flex: 1 }}>{label}</T>
      <ChevronIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
    </Stack>
  );
}

export function CohortsTab({ onNavigate }: { onNavigate?: (t: EducationTabId) => void }) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [studentQuery, setStudentQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Opprett-kull-skjema.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProgram, setNewProgram] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [busy, setBusy] = useState(false);

  // Studenter for valgt kull.
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');

  // Grupper for valgt kull.
  const [groups, setGroups] = useState<EducationGroup[]>([]);
  const [assignmentsCount, setAssignmentsCount] = useState(0);

  // CSV-import.
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Canvas/LTI: er vi i en launchet økt? + roster-forhåndsvisning + emne-kontekst.
  const [launchId] = useState<string | null>(() => educationLtiService.getLaunchId());
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [ctx, setCtx] = useState<LtiContext | null>(null);
  const [sections, setSections] = useState<LtiSections | null>(null);
  const [importing, setImporting] = useState(false);

  // Kull-navn avledet fra Canvas-emnet (emnekode + emne), fallback til generisk.
  const canvasCohortName = useMemo(() => {
    if (!ctx) return 'Importert fra Canvas';
    const code = ctx.courseCode?.trim();
    const title = ctx.courseTitle?.trim();
    const base = [code, title].filter(Boolean).join(' – ') || 'Importert fra Canvas';
    return ctx.term ? `${base} (${ctx.term})` : base;
  }, [ctx]);

  const loadCohorts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await educationCohortsService.listCohorts();
      setCohorts(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente kull');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadCohorts(); }, [loadCohorts]);
  useEffect(() => { void educationAssignmentsService.listAssignments().then((a) => setAssignmentsCount(a.length)).catch(() => setAssignmentsCount(0)); }, []);

  const selected = useMemo(() => cohorts.find((c) => c.id === selectedId) ?? null, [cohorts, selectedId]);

  const loadStudents = useCallback(async (id: string) => {
    setStudentsLoading(true);
    try { setStudents(await educationCohortsService.listStudents(id)); }
    catch { setStudents([]); }
    finally { setStudentsLoading(false); }
  }, []);
  useEffect(() => { if (selectedId) void loadStudents(selectedId); }, [selectedId, loadStudents]);

  const loadGroups = useCallback(async (id: string) => {
    try { setGroups(await educationGroupsService.listGroups(id)); }
    catch { setGroups([]); }
  }, []);
  useEffect(() => { if (selectedId) void loadGroups(selectedId); else setGroups([]); }, [selectedId, loadGroups]);

  const handleCreateGroup = async () => {
    if (!selectedId) return;
    try {
      await educationGroupsService.createGroup(selectedId, `Gruppe ${groups.length + 1}`);
      await loadGroups(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette gruppe'); }
  };

  // Roster-forhåndsvisning når vi er launchet fra Canvas (ærlig antall i banneret).
  useEffect(() => {
    if (!launchId) return;
    let cancelled = false;
    void educationLtiService.getRoster(launchId)
      .then((members) => { if (!cancelled) setRosterCount(members.filter((m) => m.roles.some((r) => /learner|student/i.test(r)) || m.roles.length === 0).length); })
      .catch(() => { if (!cancelled) setRosterCount(null); });
    return () => { cancelled = true; };
  }, [launchId]);

  // Emne-kontekst fra Canvas-launchen (emne/emnekode/semester/institusjon).
  useEffect(() => {
    if (!launchId) return;
    let cancelled = false;
    void educationLtiService.getContext(launchId)
      .then((c) => { if (!cancelled) setCtx(c); })
      .catch(() => { if (!cancelled) setCtx(null); });
    return () => { cancelled = true; };
  }, [launchId]);

  // Canvas-seksjoner (≈ FS-kull) i rosteret → tilbud om ett kull per seksjon.
  useEffect(() => {
    if (!launchId) return;
    let cancelled = false;
    void educationLtiService.getSections(launchId)
      .then((s) => { if (!cancelled) setSections(s); })
      .catch(() => { if (!cancelled) setSections(null); });
    return () => { cancelled = true; };
  }, [launchId]);

  const handleImportFromCanvas = async (opts: { cohortId?: string; cohortName?: string }) => {
    if (!launchId || importing) return;
    setImporting(true); setError(null);
    try {
      const { cohortId, added, skipped } = await educationLtiService.importStudents(launchId, opts);
      await loadCohorts(); setSelectedId(cohortId); await loadStudents(cohortId);
      setToast(`Importert fra Canvas: ${added} lagt til${skipped ? ` · ${skipped} fantes fra før` : ''}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke importere fra Canvas'); }
    finally { setImporting(false); }
  };

  // Ett kull per Canvas-seksjon. Prefikser kull-navnet med emnekoden (fra FS via
  // launch-kontekst) så «BA-3D» blir «FILM2100 · BA-3D».
  const handleImportBySection = async () => {
    if (!launchId || importing || !sections?.sections.length) return;
    setImporting(true); setError(null);
    try {
      const prefix = ctx?.courseCode?.trim() || undefined;
      const { cohorts } = await educationLtiService.importBySection(launchId, { namePrefix: prefix });
      await loadCohorts();
      if (cohorts[0]) { setSelectedId(cohorts[0].cohortId); await loadStudents(cohorts[0].cohortId); }
      const totalAdded = cohorts.reduce((n, c) => n + c.added, 0);
      setToast(`Importert ${cohorts.length} kull fra Canvas-seksjoner · ${totalAdded} studenter lagt til.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke importere per seksjon'); }
    finally { setImporting(false); }
  };

  const csvPreview = useMemo(() => parseCsvStudents(csvText), [csvText]);
  const handleImportCsv = async () => {
    if (!selectedId || csvPreview.length === 0 || csvBusy) return;
    setCsvBusy(true); setError(null);
    try {
      const { added, skipped } = await educationCohortsService.addStudentsBulk(selectedId, csvPreview);
      setCsvOpen(false); setCsvText('');
      setToast(`Importerte ${added} student${added === 1 ? '' : 'er'}${skipped ? ` · hoppet over ${skipped}` : ''}.`);
      await loadStudents(selectedId); await loadCohorts();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke importere'); }
    finally { setCsvBusy(false); }
  };

  const handleSetStudentGroup = async (studentId: string, groupId: string | null) => {
    setStudents((prev) => prev.map((s) => s.id === studentId ? { ...s, groupId, groupName: groups.find((g) => g.id === groupId)?.name ?? null } : s));
    try {
      await educationCohortsService.setStudentGroup(studentId, groupId);
      if (selectedId) await loadGroups(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke tildele gruppe'); if (selectedId) await loadStudents(selectedId); }
  };

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const c = await educationCohortsService.createCohort({ name: newName.trim(), program: newProgram.trim() || undefined, term: newTerm.trim() || undefined });
      setNewName(''); setNewProgram(''); setNewTerm(''); setCreating(false);
      await loadCohorts(); setSelectedId(c.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke opprette kull'); }
    finally { setBusy(false); }
  };

  const handleDeleteCohort = async (id: string) => {
    try { await educationCohortsService.deleteCohort(id); if (selectedId === id) setSelectedId(null); await loadCohorts(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke slette'); }
  };

  const handleAddStudent = async () => {
    if (!addName.trim() || !selectedId || busy) return;
    setBusy(true);
    try {
      await educationCohortsService.addStudent(selectedId, { name: addName.trim(), email: addEmail.trim() || undefined });
      setAddName(''); setAddEmail(''); await loadStudents(selectedId); await loadCohorts();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke legge til student'); }
    finally { setBusy(false); }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!selectedId) return;
    try { await educationCohortsService.deleteStudent(id); await loadStudents(selectedId); await loadCohorts(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke fjerne student'); }
  };

  const totalStudents = useMemo(() => cohorts.reduce((a, c) => a + (c.studentCount || 0), 0), [cohorts]);
  const ungrouped = students.filter((s) => !s.groupId).length;

  const kpis = [
    { id: 'studenter', label: 'Studenter', value: totalStudents, hint: 'På tvers av alle kull', color: '#c4b5fd', bg: 'rgba(139,92,246,0.16)', icon: <CohortIcon /> },
    { id: 'kull', label: 'Kull', value: cohorts.filter((c) => !c.archived).length, hint: 'Aktive dette semesteret', color: '#38bdf8', bg: 'rgba(56,189,248,0.16)', icon: <CanvasIcon /> },
    { id: 'grupper', label: 'Grupper', value: groups.length, hint: selected ? `I ${selected.name}` : 'Velg et kull', color: '#34d399', bg: 'rgba(16,185,129,0.16)', icon: <CohortIcon /> },
    { id: 'utengruppe', label: 'Studenter uten gruppe', value: ungrouped, hint: 'Klar for gruppering', color: '#f59e0b', bg: 'rgba(245,158,11,0.16)', icon: <InviteIcon /> },
  ];

  const statusBadge = (status: string): { label: string; color: string; bg: string } => {
    if (status === 'active') return { label: 'Aktiv', color: '#10b981', bg: 'rgba(16,185,129,0.15)' };
    if (status === 'invited' || status === 'pending') return { label: 'Invitert', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
    return { label: 'Ingen tilgang', color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.07)' };
  };
  const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const visibleCohorts = useMemo(() => cohorts.filter((c) => showArchived ? c.archived : !c.archived), [cohorts, showArchived]);
  const visibleStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q));
  }, [students, studentQuery]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 300px' }, gap: 2.75, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
        {/* Header */}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
          <Stack direction="row" spacing={1.75} alignItems="flex-start">
            <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CohortIcon /></Box>
            <Box>
              <T eid="edu-ks-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Kull &amp; studenter</T>
              <T eid="edu-ks-subtitle" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, mt: 0.4 }}>Administrer kull, studenter, roller og synkronisering mot Canvas.</T>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Tooltip title={launchId ? 'Importer klasse-rosteret fra Canvas' : 'Åpne Role Room fra Canvas-emnet for å importere rosteret'}>
              <span>
                <Button variant="outlined" startIcon={<ImportIcon />} disabled={!launchId || importing} onClick={() => handleImportFromCanvas({})} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                  <T eid="edu-ks-btn-import" component="span" sx={{ fontWeight: 600 }}>{importing ? 'Importerer…' : 'Importer fra Canvas'}</T>
                </Button>
              </span>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              <T eid="edu-ks-btn-create" component="span" sx={{ fontWeight: 700 }}>Opprett kull</T>
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        {/* Opprett-kull-skjema */}
        <Collapse in={creating}>
          <Panel sx={{ border: '1px solid rgba(139,92,246,0.35)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" label="Navn (f.eks. Film 1. år 2026)" value={newName} onChange={(e) => setNewName(e.target.value)} fullWidth />
              <TextField size="small" label="Program (valgfritt)" value={newProgram} onChange={(e) => setNewProgram(e.target.value)} fullWidth />
              <TextField size="small" label="Semester (valgfritt)" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} sx={{ minWidth: 160 }} />
            </Stack>
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
              <Button onClick={() => setCreating(false)} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}>{busy ? 'Oppretter…' : 'Opprett'}</Button>
            </Stack>
          </Panel>
        </Collapse>

        {/* Canvas-oppdagelsesbanner — vises kun i en ekte LTI-launchet økt */}
        <Collapse in={!!launchId && bannerOpen}>
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2.25, p: 2.5, borderRadius: 3.5, background: 'linear-gradient(100deg, rgba(139,92,246,0.16), rgba(99,102,241,0.08))', border: '1px solid rgba(139,92,246,0.32)', flexWrap: 'wrap' }}>
            <Box sx={{ width: 58, height: 58, borderRadius: 3.5, bgcolor: 'rgba(139,92,246,0.22)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CanvasIcon sx={{ fontSize: 28 }} /></Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <T eid="edu-ks-canvas-title" sx={{ fontWeight: 700, fontSize: 16 }}>Canvas-emne tilkoblet</T>
                <Chip data-edit-id="edu-ks-canvas-tag" label="LTI" size="small" sx={{ height: 18, bgcolor: ACCENT, color: '#fff', fontWeight: 800, fontSize: 9.5 }} />
              </Stack>
              <T eid="edu-ks-canvas-course" sx={{ fontSize: 15, color: '#e9d5ff', fontWeight: 600, mt: 0.25 }}>
                {ctx && (ctx.courseTitle || ctx.courseCode)
                  ? [ctx.courseCode, ctx.courseTitle].filter(Boolean).join(' – ')
                  : 'Klasse-roster fra LMS-en er klart'}
              </T>
              <T eid="edu-ks-canvas-meta" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>
                {[ctx?.institution, ctx?.term].filter(Boolean).join(' · ')}
                {(ctx?.institution || ctx?.term) ? ' · ' : ''}
                {rosterCount === null ? 'henter roster…' : `${rosterCount} studenter · via NRPS`}
              </T>
            </Box>
            {sections && sections.sections.length > 0 ? (
              <Tooltip title={`Oppretter ett kull per Canvas-seksjon (${sections.sections.map((s) => `${s.section}: ${s.studentCount}`).join(' · ')})${sections.unsectioned ? ` · ${sections.unsectioned} uten seksjon` : ''}`}>
                <Button variant="contained" startIcon={<CohortIcon />} disabled={importing} onClick={handleImportBySection} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}>
                  <T eid="edu-ks-canvas-import-sections" component="span" sx={{ fontWeight: 700 }}>{importing ? 'Importerer…' : `Importer ${sections.sections.length} kull (seksjoner)`}</T>
                </Button>
              </Tooltip>
            ) : (
              <Button variant="contained" startIcon={<InviteIcon />} disabled={importing} onClick={() => handleImportFromCanvas({ cohortName: canvasCohortName })} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}>
                <T eid="edu-ks-canvas-import" component="span" sx={{ fontWeight: 700 }}>{importing ? 'Importerer…' : 'Importer studenter'}</T>
              </Button>
            )}
            {sections && sections.sections.length > 0 && (
              <Button variant="text" disabled={importing} onClick={() => handleImportFromCanvas({ cohortName: canvasCohortName })} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontWeight: 600, borderRadius: 2, whiteSpace: 'nowrap' }}>
                <T eid="edu-ks-canvas-import-flat" component="span" sx={{ fontWeight: 600 }}>Alle i ett kull</T>
              </Button>
            )}
            {selected && (
              <Button variant="outlined" disabled={importing} onClick={() => handleImportFromCanvas({ cohortId: selected.id })} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2, whiteSpace: 'nowrap' }}>
                <T eid="edu-ks-canvas-other" component="span" sx={{ fontWeight: 600 }}>Legg i «{selected.name}»</T>
              </Button>
            )}
            <IconButton size="small" onClick={() => setBannerOpen(false)} sx={{ position: 'absolute', top: 8, right: 10, color: 'rgba(255,255,255,0.4)' }}><CloseIcon fontSize="small" /></IconButton>
          </Box>
        </Collapse>

        {/* Oppsett-stepper — avledet fra ekte tilstand */}
        <Panel>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={{ xs: 1.5, sm: 0 }}>
            {[
              { id: 'koble', done: !!launchId, t: 'Koble til kurs', s: launchId ? 'Canvas tilkoblet' : 'Ikke koblet — åpne fra Canvas' },
              { id: 'liste', done: totalStudents > 0, t: 'Kontroller deltakerliste', s: totalStudents > 0 ? `${totalStudents} studenter` : 'Ingen studenter ennå' },
              { id: 'grupper', done: groups.length > 0, t: 'Opprett grupper', s: groups.length > 0 ? `${groups.length} grupper` : 'Ingen grupper ennå' },
              { id: 'oppgave', done: assignmentsCount > 0, t: 'Tildel første oppgave', s: assignmentsCount > 0 ? `${assignmentsCount} oppgaver` : 'Ingen oppgaver ennå' },
            ].map((step, i, arr) => (
              <Stack key={step.id} direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0, bgcolor: step.done ? ACCENT : 'rgba(255,255,255,0.06)', color: step.done ? '#fff' : 'rgba(255,255,255,0.55)' }}>{step.done ? <CheckIcon sx={{ fontSize: 16 }} /> : i + 1}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <T eid={`edu-ks-step-${step.id}-t`} sx={{ fontSize: 13.5, fontWeight: 600 }}>{step.t}</T>
                  <T eid={`edu-ks-step-${step.id}-s`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>{step.s}</T>
                </Box>
                {i < arr.length - 1 && <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.1)', mx: 1, display: { xs: 'none', sm: 'block' } }} />}
              </Stack>
            ))}
          </Stack>
        </Panel>

        {/* KPI-kort */}
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          {kpis.map((k) => (
            <Panel key={k.id} sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <T eid={`edu-ks-kpi-${k.id}-label`} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k.label}</T>
                <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: k.bg, color: k.color, '& svg': { fontSize: 19 } }}>{k.icon}</Box>
              </Stack>
              <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{k.value}</Typography>
              <T eid={`edu-ks-kpi-${k.id}-hint`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', mt: 0.75 }}>{k.hint}</T>
            </Panel>
          ))}
        </Box>

        {/* Kull-liste + student-tabell */}
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, alignItems: 'start' }}>
          <Panel>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <T eid="edu-ks-kulllist-title" sx={{ fontWeight: 700, fontSize: 15 }}>{showArchived ? `Arkiverte (${visibleCohorts.length})` : `Kull (${visibleCohorts.length})`}</T>
            </Stack>
            {visibleCohorts.length === 0 ? (
              <T eid="edu-ks-kulllist-empty" sx={{ fontSize: 13, color: 'text.secondary', py: 1 }}>{showArchived ? 'Ingen arkiverte kull.' : 'Ingen kull ennå. Opprett ditt første over.'}</T>
            ) : visibleCohorts.map((c) => {
              const active = c.id === selectedId;
              return (
                <Box key={c.id} sx={{ position: 'relative', mb: 1 }}>
                  <Card sx={{ bgcolor: active ? 'rgba(139,92,246,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 2.5 }}>
                    <CardActionArea onClick={() => setSelectedId(c.id)} sx={{ p: 1.5, pr: 5 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.3 }}>{[c.term, `${c.studentCount} studenter`].filter(Boolean).join(' · ')}</Typography>
                    </CardActionArea>
                  </Card>
                  <IconButton size="small" onClick={() => handleDeleteCohort(c.id)} sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.3)' }}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
              );
            })}
            <Button fullWidth startIcon={<ArchiveIcon />} onClick={() => setShowArchived((v) => !v)} sx={{ mt: 0.5, borderRadius: 2, textTransform: 'none', color: showArchived ? '#c4b5fd' : 'rgba(255,255,255,0.7)', border: `1px solid ${showArchived ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.12)'}` }}>
              <T eid="edu-ks-archived" component="span">{showArchived ? 'Vis aktive kull' : 'Arkiverte kull'}</T>
            </Button>
          </Panel>

          <Panel sx={{ p: 0, overflow: 'hidden' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
              <T eid="edu-ks-studenttbl-title" sx={{ fontWeight: 700, fontSize: 14.5 }}>{selected ? `Studenter i ${selected.name} (${visibleStudents.length}${studentQuery.trim() ? ` av ${students.length}` : ''})` : 'Velg et kull'}</T>
              <Stack direction="row" spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 0.6, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <SearchIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
                  <InputBase placeholder="Søk etter student" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} sx={{ color: '#fff', fontSize: 12.5, width: 150, '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 } }} />
                  {studentQuery && <IconButton size="small" onClick={() => setStudentQuery('')} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.25 }}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>}
                </Stack>
              </Stack>
            </Stack>
            {/* add-student-rad */}
            {selected && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ px: 2, pb: 1.5 }}>
                <TextField size="small" placeholder="Navn" value={addName} onChange={(e) => setAddName(e.target.value)} sx={{ flex: 1 }} />
                <TextField size="small" placeholder="E-post (valgfritt)" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} sx={{ flex: 1 }} />
                <Button variant="outlined" startIcon={<InviteIcon />} onClick={handleAddStudent} disabled={!addName.trim() || busy} sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>Legg til</Button>
              </Stack>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderTop: BORDER, borderBottom: BORDER }}>
              {[['student', 'Student'], ['kull', 'Kull'], ['gruppe', 'Gruppe'], ['status', 'Status'], ['a', '']].map(([id, label]) => (
                <T key={id} eid={`edu-ks-th-${id}`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{label}</T>
              ))}
            </Box>
            {studentsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
            ) : students.length === 0 ? (
              <T eid="edu-ks-students-empty" sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 13, display: 'block' }}>Ingen studenter i dette kullet ennå — legg til over eller importer fra Canvas.</T>
            ) : visibleStudents.length === 0 ? (
              <T eid="edu-ks-students-nomatch" sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 13, display: 'block' }}>Ingen studenter matcher «{studentQuery}».</T>
            ) : visibleStudents.map((s) => {
              const b = statusBadge(s.status);
              return (
                <Box key={s.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 40px', alignItems: 'center', px: 2, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                    <Avatar sx={{ width: 30, height: 30, fontSize: 11, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff' }}>{initials(s.name)}</Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</Typography>
                      {s.email && <Typography sx={{ fontSize: 11, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</Typography>}
                    </Box>
                  </Stack>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{selected?.name?.split(' ')[0] ?? '—'}</Typography>
                  {groups.length === 0 ? (
                    <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>—</Typography>
                  ) : (
                    <Select value={s.groupId ?? ''} onChange={(e) => handleSetStudentGroup(s.id, e.target.value || null)} variant="standard" disableUnderline displayEmpty
                      sx={{ fontSize: 12.5, color: s.groupId ? '#34d399' : 'rgba(255,255,255,0.4)', '& .MuiSelect-select': { py: 0.25, pr: '18px !important' }, '& .MuiSvgIcon-root': { fontSize: 16, color: 'rgba(255,255,255,0.35)' } }}>
                      <MenuItem value="" sx={{ fontSize: 12.5 }}>Ingen gruppe</MenuItem>
                      {groups.map((g) => <MenuItem key={g.id} value={g.id} sx={{ fontSize: 12.5 }}>{g.name}</MenuItem>)}
                    </Select>
                  )}
                  <Box><Chip label={b.label} size="small" sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: b.bg, color: b.color }} /></Box>
                  <Tooltip title="Fjern"><IconButton size="small" onClick={() => handleDeleteStudent(s.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Box>
              );
            })}
          </Panel>
        </Box>
      </Box>

      {/* Høyre skinne */}
      <Stack spacing={2}>
        <Panel>
          <T eid="edu-ks-rail-qa-title" sx={{ fontWeight: 700, fontSize: 14.5, mb: 1 }}>Hurtighandlinger</T>
          <QuickAction eid="edu-ks-qa-invite" icon={<InviteIcon />} label="Inviter student" onClick={() => { setCreating(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          <QuickAction eid="edu-ks-qa-csv" icon={<CsvIcon />} label="Importer CSV" onClick={() => { if (selectedId) setCsvOpen(true); else setError('Velg et kull først.'); }} />
          <QuickAction eid="edu-ks-qa-group" icon={<CohortIcon />} label="Opprett gruppe" onClick={() => { void handleCreateGroup(); }} />
          <QuickAction eid="edu-ks-qa-assign" icon={<CheckIcon />} label="Tildel oppgave" onClick={() => onNavigate?.('assignments')} />
        </Panel>
        <Panel>
          <T eid="edu-ks-rail-sync-title" sx={{ fontWeight: 700, fontSize: 14.5, mb: 1.25 }}>Synkronisering</T>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color: launchId ? '#10b981' : 'rgba(255,255,255,0.5)', mb: 0.75 }}>
            <CheckIcon sx={{ fontSize: 15 }} />
            <T eid="edu-ks-sync-status" sx={{ fontSize: 12.5, color: launchId ? '#10b981' : 'rgba(255,255,255,0.5)' }}>{launchId ? 'Canvas tilkoblet (LTI)' : 'Ikke koblet — åpne fra Canvas'}</T>
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <T eid="edu-ks-sync-last" sx={{ fontSize: 12, color: 'text.secondary' }}>Roster</T>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{launchId ? (rosterCount === null ? 'henter…' : `${rosterCount} studenter`) : '—'}</Typography>
          </Stack>
          <Tooltip title={launchId ? (selected ? `Synk rosteret inn i «${selected.name}»` : 'Synk rosteret til et nytt kull') : 'Åpne Role Room fra Canvas for å synkronisere'}>
            <span style={{ display: 'block' }}>
              <Button fullWidth variant="contained" startIcon={<SyncIcon />} disabled={!launchId || importing} onClick={() => handleImportFromCanvas(selected ? { cohortId: selected.id } : { cohortName: canvasCohortName })} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                <T eid="edu-ks-sync-btn" component="span" sx={{ fontWeight: 700 }}>{importing ? 'Synkroniserer…' : 'Synkroniser nå'}</T>
              </Button>
            </span>
          </Tooltip>
        </Panel>
        <Panel sx={{ bgcolor: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.26)' }}>
          <T eid="edu-ks-tips-title" sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.75 }}>Tips</T>
          <T eid="edu-ks-tips-body" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5 }}>Importer studenter fra Canvas (åpne Role Room fra emnet) eller via CSV for å komme raskt i gang.</T>
        </Panel>
      </Stack>

      {/* CSV-import-dialog */}
      <Dialog open={csvOpen} onClose={() => setCsvOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Importer studenter fra CSV</DialogTitle>
        <DialogContent>
          <T eid="edu-ks-csv-help" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', mb: 1.5 }}>
            Lim inn eller last opp CSV. Kolonner: <b>navn, e-post, studentnr</b> (komma eller semikolon). Header-rad hoppes over.
          </T>
          <Button component="label" size="small" startIcon={<CsvIcon />} sx={{ mb: 1.5, color: '#c4b5fd', textTransform: 'none' }}>
            Last opp .csv-fil
            <input hidden type="file" accept=".csv,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setCsvText); }} />
          </Button>
          <TextField value={csvText} onChange={(e) => setCsvText(e.target.value)} multiline minRows={6} fullWidth
            placeholder={'Ola Nordmann, ola@skole.no, S12345\nKari Hansen; kari@skole.no; S12346'}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12.5 } }} />
          {csvText.trim() && <T eid="edu-ks-csv-count" sx={{ fontSize: 12.5, color: csvPreview.length ? '#34d399' : '#f59e0b', mt: 1 }}>{csvPreview.length} gyldige rader funnet.</T>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCsvOpen(false)} disabled={csvBusy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button variant="contained" onClick={handleImportCsv} disabled={csvPreview.length === 0 || csvBusy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}>{csvBusy ? 'Importerer…' : `Importer ${csvPreview.length || ''}`}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default CohortsTab;
