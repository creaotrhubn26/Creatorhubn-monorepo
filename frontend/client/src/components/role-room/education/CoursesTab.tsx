/**
 * CoursesTab.tsx — «Emner» (studieplan-forankring, CMS-koblet).
 *
 * Et emne = en studiepoenggivende enhet med egen sluttvurdering. Holder emnekode,
 * studiepoeng, semester, vurderingsform og LÆRINGSUTBYTTE (NKR: Kunnskap/
 * Ferdigheter/Generell kompetanse). Oppgaver/arbeidskrav henger på et emne.
 *
 * 🔑 CMS: stabile data-edit-id (edu-em-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Collapse, TextField, MenuItem,
  CircularProgress, Alert, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Card, CardActionArea,
} from '@mui/material';
import {
  School as CourseIcon, Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
  Assignment as AssignmentIcon, WorkspacePremium as CreditIcon, GridView as PackIcon,
} from '@mui/icons-material';
import { educationCoursesService, type Course, type CourseInput, type LearningOutcomes } from './educationCoursesService';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { educationAssignmentsService } from './educationAssignmentsService';
import { STUDY_PLAN_PACKS } from './educationStudyPlanPacks';
import { ACCENT, Panel, T } from './_eduUi';

const VURDERINGSFORM_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Ikke satt' },
  { key: 'bestatt', label: 'Bestått / ikke bestått' },
  { key: 'bokstav', label: 'Bokstavkarakter (A–F)' },
  { key: 'mappe', label: 'Mappevurdering' },
];
const vurderingsformLabel = (k: string | null) => VURDERINGSFORM_OPTIONS.find((o) => o.key === k)?.label ?? null;
const linesToList = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const listToLines = (a: string[]) => a.join('\n');
const emptyOutcomes = (): LearningOutcomes => ({ knowledge: [], skills: [], generalCompetence: [] });

type FormState = { code: string; title: string; credits: string; term: string; cohortId: string; vurderingsform: string; knowledge: string; skills: string; generalCompetence: string };
const blankForm = (): FormState => ({ code: '', title: '', credits: '', term: '', cohortId: '', vurderingsform: '', knowledge: '', skills: '', generalCompetence: '' });

export function CoursesTab() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [f, setF] = useState<FormState>(blankForm());
  const [busy, setBusy] = useState(false);

  // Studieplan-mal-pakke.
  const [packOpen, setPackOpen] = useState(false);
  const [packId, setPackId] = useState(STUDY_PLAN_PACKS[0].id);
  const [packCohortId, setPackCohortId] = useState('');
  const [packBusy, setPackBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const selectedPack = STUDY_PLAN_PACKS.find((p) => p.id === packId) ?? STUDY_PLAN_PACKS[0];

  const adoptPack = async () => {
    if (packBusy) return;
    setPackBusy(true); setError(null);
    try {
      let courseN = 0; let assignN = 0;
      for (const pc of selectedPack.courses) {
        // eslint-disable-next-line no-await-in-loop -- sekvensiell for rekkefølge + FK
        const course = await educationCoursesService.createCourse({
          code: pc.code, title: pc.title, credits: pc.credits, term: pc.term,
          cohortId: packCohortId || null, vurderingsform: pc.vurderingsform, learningOutcomes: pc.learningOutcomes,
        });
        courseN++;
        for (const a of pc.assignments) {
          try {
            // eslint-disable-next-line no-await-in-loop -- sekvensiell så-ing
            await educationAssignmentsService.createAssignment({
              title: a.title, brief: a.brief, learningGoals: a.learningGoals,
              cohortId: packCohortId || null, courseId: course.id,
              isArbeidskrav: a.isArbeidskrav, vurderingsform: pc.vurderingsform, status: 'published',
            });
            assignN++;
          } catch { /* hopp over enkelt-feil */ }
        }
      }
      setPackOpen(false); await load();
      setToast(`Adopterte «${selectedPack.program}»: ${courseN} emner + ${assignN} oppgaver.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke adoptere pakke'); }
    finally { setPackBusy(false); }
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cs, chs] = await Promise.all([educationCoursesService.listCourses(), educationCohortsService.listCohorts()]);
      setCourses(cs); setCohorts(chs);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke hente emner'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cohortName = (id: string | null) => cohorts.find((c) => c.id === id)?.name ?? null;

  const openNew = () => { setF(blankForm()); setEditing('new'); };
  const openEdit = (c: Course) => {
    setF({
      code: c.code ?? '', title: c.title, credits: c.credits != null ? String(c.credits) : '',
      term: c.term ?? '', cohortId: c.cohortId ?? '', vurderingsform: c.vurderingsform ?? '',
      knowledge: listToLines(c.learningOutcomes.knowledge), skills: listToLines(c.learningOutcomes.skills),
      generalCompetence: listToLines(c.learningOutcomes.generalCompetence),
    });
    setEditing(c.id);
  };

  const save = async () => {
    if (!f.title.trim() || busy) return;
    setBusy(true); setError(null);
    const input: CourseInput = {
      code: f.code.trim() || undefined, title: f.title.trim(),
      credits: f.credits.trim() === '' ? null : Number(f.credits),
      term: f.term.trim() || undefined, cohortId: f.cohortId || null,
      vurderingsform: f.vurderingsform || null,
      learningOutcomes: { knowledge: linesToList(f.knowledge), skills: linesToList(f.skills), generalCompetence: linesToList(f.generalCompetence) },
    };
    try {
      if (editing === 'new') await educationCoursesService.createCourse(input);
      else if (editing) await educationCoursesService.updateCourse(editing, input);
      setEditing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke lagre emne'); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    try { await educationCoursesService.deleteCourse(id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke slette'); }
  };

  const totalCredits = useMemo(() => courses.reduce((a, c) => a + (c.credits ?? 0), 0), [courses]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CourseIcon /></Box>
          <Box>
            <T eid="edu-em-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Emner</T>
            <T eid="edu-em-subtitle" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, mt: 0.4 }}>Studiepoenggivende enheter med læringsutbytte (kunnskap / ferdigheter / generell kompetanse), vurderingsform og oppgaver.</T>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<PackIcon />} onClick={() => setPackOpen(true)} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            <T eid="edu-em-btn-pack" component="span" sx={{ fontWeight: 600 }}>Fra studieplan-mal</T>
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            <T eid="edu-em-btn-new" component="span" sx={{ fontWeight: 700 }}>Nytt emne</T>
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* KPI */}
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' } }}>
        <Panel sx={{ p: 2 }}>
          <T eid="edu-em-kpi-emner-label" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Emner</T>
          <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{courses.length}</Typography>
        </Panel>
        <Panel sx={{ p: 2 }}>
          <T eid="edu-em-kpi-sp-label" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Studiepoeng totalt</T>
          <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{totalCredits || '—'}</Typography>
        </Panel>
        <Panel sx={{ p: 2 }}>
          <T eid="edu-em-kpi-oppg-label" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Oppgaver knyttet</T>
          <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 1, lineHeight: 1 }}>{courses.reduce((a, c) => a + c.assignmentCount, 0)}</Typography>
        </Panel>
      </Box>

      {/* Editor */}
      <Collapse in={editing !== null}>
        <Panel sx={{ border: '1px solid rgba(139,92,246,0.35)' }}>
          <T eid="edu-em-form-title" sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>{editing === 'new' ? 'Nytt emne' : 'Rediger emne'}</T>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" label="Emnekode" value={f.code} onChange={(e) => setField('code', e.target.value)} placeholder="MED101" sx={{ width: 140 }} />
              <TextField size="small" label="Tittel" value={f.title} onChange={(e) => setField('title', e.target.value)} fullWidth />
              <TextField size="small" type="number" label="Studiepoeng" value={f.credits} onChange={(e) => setField('credits', e.target.value)} sx={{ width: 130 }} inputProps={{ min: 0, step: 0.5 }} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" label="Semester" value={f.term} onChange={(e) => setField('term', e.target.value)} placeholder="Høst 2026" fullWidth />
              <TextField size="small" select label="Kull" value={f.cohortId} onChange={(e) => setField('cohortId', e.target.value)} fullWidth>
                <MenuItem value="">Ingen</MenuItem>
                {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="Vurderingsform" value={f.vurderingsform} onChange={(e) => setField('vurderingsform', e.target.value)} sx={{ minWidth: 200 }}>
                {VURDERINGSFORM_OPTIONS.map((o) => <MenuItem key={o.key || 'none'} value={o.key}>{o.label}</MenuItem>)}
              </TextField>
            </Stack>
            <T eid="edu-em-form-lu" sx={{ fontSize: 11.5, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.5, mt: 0.5 }}>Læringsutbytte (én linje per punkt)</T>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField size="small" label="Kunnskap" value={f.knowledge} onChange={(e) => setField('knowledge', e.target.value)} multiline minRows={3} fullWidth />
              <TextField size="small" label="Ferdigheter" value={f.skills} onChange={(e) => setField('skills', e.target.value)} multiline minRows={3} fullWidth />
              <TextField size="small" label="Generell kompetanse" value={f.generalCompetence} onChange={(e) => setField('generalCompetence', e.target.value)} multiline minRows={3} fullWidth />
            </Stack>
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={() => setEditing(null)} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
              <Button variant="contained" onClick={save} disabled={!f.title.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}>{busy ? 'Lagrer…' : 'Lagre emne'}</Button>
            </Stack>
          </Stack>
        </Panel>
      </Collapse>

      {/* Emne-liste */}
      {courses.length === 0 ? (
        <Panel><T eid="edu-em-empty" sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 13.5, py: 3, display: 'block' }}>Ingen emner ennå — opprett ditt første. Oppgaver og arbeidskrav kan så knyttes til emnet.</T></Panel>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
          {courses.map((c) => {
            const lu = c.learningOutcomes;
            const luCount = lu.knowledge.length + lu.skills.length + lu.generalCompetence.length;
            return (
              <Panel key={c.id} sx={{ p: 2.25, position: 'relative' }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Box sx={{ minWidth: 0, pr: 6 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                      {c.code && <Chip label={c.code} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 800, bgcolor: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }} />}
                      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{c.title}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.75, color: 'rgba(255,255,255,0.55)' }} flexWrap="wrap" useFlexGap>
                      {c.credits != null && <Stack direction="row" alignItems="center" spacing={0.4}><CreditIcon sx={{ fontSize: 14 }} /><Typography sx={{ fontSize: 12 }}>{c.credits} sp</Typography></Stack>}
                      {c.term && <Typography sx={{ fontSize: 12 }}>{c.term}</Typography>}
                      {cohortName(c.cohortId) && <Typography sx={{ fontSize: 12 }}>{cohortName(c.cohortId)}</Typography>}
                      {vurderingsformLabel(c.vurderingsform) && <Chip label={vurderingsformLabel(c.vurderingsform)} size="small" sx={{ height: 18, fontSize: 9.5, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)' }} />}
                      <Stack direction="row" alignItems="center" spacing={0.4}><AssignmentIcon sx={{ fontSize: 14 }} /><Typography sx={{ fontSize: 12 }}>{c.assignmentCount} oppgaver</Typography></Stack>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.25} sx={{ position: 'absolute', top: 10, right: 10 }}>
                    <IconButton size="small" onClick={() => openEdit(c)} sx={{ color: 'rgba(255,255,255,0.5)' }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(c.id)} sx={{ color: 'rgba(255,255,255,0.3)' }}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </Stack>
                {luCount > 0 && (
                  <Box sx={{ mt: 1.5, display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
                    {([['Kunnskap', lu.knowledge], ['Ferdigheter', lu.skills], ['Generell kompetanse', lu.generalCompetence]] as [string, string[]][]).map(([label, items]) => (
                      <Box key={label}>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>{label}</Typography>
                        {items.length === 0 ? <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>—</Typography>
                          : items.map((it, i) => <Typography key={i} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>• {it}</Typography>)}
                      </Box>
                    ))}
                  </Box>
                )}
              </Panel>
            );
          })}
        </Box>
      )}

      {/* Studieplan-mal-pakke */}
      <Dialog open={packOpen} onClose={() => setPackOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Adopter studieplan-mal</DialogTitle>
        <DialogContent>
          <T eid="edu-em-pack-help" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', mb: 2 }}>
            Oppretter et sett emner (m/ læringsutbytte + vurderingsform) og tilhørende oppgaver/arbeidskrav. Generiske start-strukturer du redigerer etterpå.
          </T>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {STUDY_PLAN_PACKS.map((p) => {
              const active = p.id === packId;
              const arbeidskrav = p.courses.reduce((n, c) => n + c.assignments.filter((a) => a.isArbeidskrav).length, 0);
              return (
                <Card key={p.id} sx={{ bgcolor: active ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 2.5 }}>
                  <CardActionArea onClick={() => setPackId(p.id)} sx={{ p: 1.75 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{p.program}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.3 }}>{p.description}</Typography>
                    <Typography sx={{ fontSize: 11, color: '#c4b5fd', mt: 0.75, fontWeight: 600 }}>{p.courses.length} emner · {arbeidskrav} arbeidskrav · {p.exampleInstitutions}</Typography>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
          <TextField size="small" select label="Kull (valgfritt)" value={packCohortId} onChange={(e) => setPackCohortId(e.target.value)} fullWidth>
            <MenuItem value="">Ingen</MenuItem>
            {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', mt: 1.25 }}>Emner: {selectedPack.courses.map((c) => c.title).join(', ')}.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPackOpen(false)} disabled={packBusy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button variant="contained" onClick={adoptPack} disabled={packBusy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}>{packBusy ? 'Oppretter…' : 'Adopter'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default CoursesTab;
