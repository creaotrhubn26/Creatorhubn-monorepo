/**
 * AssignmentsTab.tsx — «Oppgaver»-flaten (opplæringslag 2: oppgaveløpet).
 *
 * Faglærer lager en oppgave (tittel, brief, læringsmål, frist, kobling til kull)
 * og følger per-student innleverings-status (Ikke startet → Levert → Vurdert).
 * Owner-scopet server-side.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, CardActionArea, Button, TextField,
  IconButton, Chip, CircularProgress, Alert, MenuItem, LinearProgress, Divider,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Assignment as AssignmentIcon,
  ArrowBack as BackIcon, MovieCreation as ProductionIcon, OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { educationRubricService, type RubricCriterion } from './educationRubricService';
import { educationProductionsService, openProductionInRoleRoom, type Production } from './educationProductionsService';
import {
  educationAssignmentsService, type Assignment, type AssignmentStatus,
  type Submission, type SubmissionStatus,
} from './educationAssignmentsService';

const ACCENT = '#8B5CF6';

const STATUS_META: Record<AssignmentStatus, { label: string; color: string }> = {
  draft: { label: 'Utkast', color: 'rgba(255,255,255,0.5)' },
  published: { label: 'Publisert', color: '#10b981' },
  archived: { label: 'Arkivert', color: 'rgba(255,255,255,0.35)' },
};

const SUB_META: Record<SubmissionStatus, { label: string }> = {
  not_started: { label: 'Ikke startet' },
  submitted: { label: 'Levert' },
  reviewed: { label: 'Vurdert' },
};

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

export function AssignmentsTab() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Assignment | null>(null);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [productionId, setProductionId] = useState('');
  const [brief, setBrief] = useState('');
  const [goals, setGoals] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, c, p] = await Promise.all([
        educationAssignmentsService.listAssignments(),
        educationCohortsService.listCohorts(),
        educationProductionsService.listProductions(),
      ]);
      setAssignments(a);
      setCohorts(c);
      setProductions(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente oppgaver');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cohortName = useCallback(
    (id: string | null) => (id ? cohorts.find((c) => c.id === id)?.name ?? null : null),
    [cohorts],
  );

  const handleCreate = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const assignment = await educationAssignmentsService.createAssignment({
        title: title.trim(),
        cohortId: cohortId || undefined,
        productionId: productionId || undefined,
        brief: brief.trim() || undefined,
        learningGoals: goals.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        status: 'published',
      });
      setAssignments((prev) => [assignment, ...prev]);
      setTitle(''); setCohortId(''); setProductionId(''); setBrief(''); setGoals(''); setDueAt(''); setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette oppgave');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await educationAssignmentsService.deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke slette oppgave');
    }
  };

  if (selected) {
    return (
      <SubmissionsView
        assignment={selected}
        cohortName={cohortName(selected.cohortId)}
        onBack={() => { setSelected(null); void load(); }}
        onError={setError}
        error={error}
      />
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Oppgaver</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT, opacity: 0.9 } }}>
          Ny oppgave
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {creating && (
        <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)' }}>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <TextField label="Tittel" size="small" value={title} onChange={(e) => setTitle(e.target.value)}
              autoFocus required placeholder="Kortfilm — 90 sekunder" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField label="Kull" size="small" select value={cohortId} onChange={(e) => setCohortId(e.target.value)} fullWidth
                helperText={cohorts.length === 0 ? 'Opprett et kull først i «Kull & studenter»' : ' '}>
                <MenuItem value=""><em>Ikke knyttet til kull</em></MenuItem>
                {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField label="Frist" size="small" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
                fullWidth InputLabelProps={{ shrink: true }} />
            </Stack>
            <TextField label="Leveres i produksjon" size="small" select value={productionId} onChange={(e) => setProductionId(e.target.value)}
              helperText={productions.length === 0 ? 'Opprett en studentproduksjon for å knytte oppgaven til ekte Role Room-arbeid' : 'Knytt oppgaven til et Role Room-prosjekt studentene jobber i'}>
              <MenuItem value=""><em>Ikke knyttet til produksjon</em></MenuItem>
              {productions
                .filter((p) => !cohortId || !p.cohortId || p.cohortId === cohortId)
                .map((p) => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
            </TextField>
            <TextField label="Brief (oppgavetekst)" size="small" value={brief} onChange={(e) => setBrief(e.target.value)}
              multiline minRows={2} placeholder="Hva skal studentene lage, og hvordan leveres det?" />
            <TextField label="Læringsmål" size="small" value={goals} onChange={(e) => setGoals(e.target.value)}
              multiline minRows={2} placeholder="Hva skal studenten kunne etterpå? Ett mål per linje." />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setCreating(false)} disabled={busy}>Avbryt</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!title.trim() || busy}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT } }}>
                {busy ? 'Oppretter…' : 'Publiser oppgave'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : assignments.length === 0 ? (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(139,92,246,0.3)' }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <AssignmentIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>Ingen oppgaver enda. Lag en oppgave med brief, læringsmål og frist — knyttet til et kull.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {assignments.map((a) => {
            const due = formatDue(a.dueAt);
            const name = cohortName(a.cohortId);
            const meta = STATUS_META[a.status];
            return (
              <Card key={a.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                <CardActionArea onClick={() => setSelected(a)} sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                    <Box sx={{ pr: 4 }}>
                      <Typography sx={{ fontWeight: 700 }}>{a.title}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={meta.label} sx={{ height: 20, fontSize: 10, color: meta.color, borderColor: meta.color }} variant="outlined" />
                        {name && <Chip size="small" label={name} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />}
                        {a.productionTitle && <Chip size="small" icon={<ProductionIcon sx={{ fontSize: '12px !important' }} />} label={a.productionTitle} sx={{ height: 20, fontSize: 10, '& .MuiChip-icon': { color: ACCENT } }} />}
                        {due && <Chip size="small" label={`Frist ${due}`} sx={{ height: 20, fontSize: 10 }} />}
                        {(a.submittedCount > 0 || a.reviewedCount > 0) && (
                          <Chip size="small" label={`${a.submittedCount} levert · ${a.reviewedCount} vurdert`} sx={{ height: 20, fontSize: 10 }} />
                        )}
                      </Stack>
                      {a.brief && <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.brief}</Typography>}
                    </Box>
                  </Stack>
                </CardActionArea>
                <IconButton size="small" onClick={() => handleDelete(a.id)}
                  sx={{ position: 'absolute', top: 4, right: 4, color: 'rgba(255,255,255,0.4)' }} aria-label="Slett oppgave">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function SubmissionsView({ assignment, cohortName, onBack, onError, error }: {
  assignment: Assignment; cohortName: string | null; onBack: () => void;
  onError: (m: string | null) => void; error: string | null;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubmissions(await educationAssignmentsService.listSubmissions(assignment.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke hente innleveringer');
    } finally {
      setLoading(false);
    }
  }, [assignment.id, onError]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (studentId: string, status: SubmissionStatus) => {
    // optimistisk
    setSubmissions((prev) => prev.map((s) => s.studentId === studentId ? { ...s, status } : s));
    try {
      await educationAssignmentsService.setSubmission(assignment.id, { studentId, status });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke oppdatere status');
      void load();
    }
  };

  const total = submissions.length;
  const done = submissions.filter((s) => s.status !== 'not_started').length;
  const due = formatDue(assignment.dueAt);
  const goals = (assignment.learningGoals ?? '').split('\n').map((g) => g.trim()).filter(Boolean);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={onBack} sx={{ color: '#fff' }} aria-label="Tilbake"><BackIcon /></IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{assignment.title}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {cohortName ?? 'Ikke knyttet til kull'}{due ? ` · Frist ${due}` : ''}
          </Typography>
        </Box>
        {assignment.productionProjectId && (
          <Button size="small" variant="outlined" startIcon={<OpenIcon />}
            onClick={() => openProductionInRoleRoom(assignment.productionProjectId as string)}
            sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', whiteSpace: 'nowrap', '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(139,92,246,0.08)' } }}>
            Åpne produksjon
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" onClose={() => onError(null)}>{error}</Alert>}

      {(assignment.brief || goals.length > 0) && (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent sx={{ display: 'grid', gap: 1.25 }}>
            {assignment.brief && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>Brief</Typography>
                <Typography sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap' }}>{assignment.brief}</Typography>
              </Box>
            )}
            {goals.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>Læringsmål</Typography>
                <Stack component="ul" sx={{ m: 0, pl: 2.5, gap: 0.25 }}>
                  {goals.map((g, i) => <Typography key={i} component="li" sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.82)' }}>{g}</Typography>)}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <RubricEditor assignmentId={assignment.id} onError={onError} />

      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Innleveringer</Typography>
          {total > 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{done} av {total} i gang</Typography>}
        </Stack>
        {total > 0 && (
          <LinearProgress variant="determinate" value={total ? (done / total) * 100 : 0}
            sx={{ mb: 1.5, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : total === 0 ? (
          <Typography sx={{ color: 'text.disabled', textAlign: 'center', p: 2, fontSize: 13.5 }}>
            {assignment.cohortId ? 'Ingen studenter i kullet enda. Legg til studenter i «Kull & studenter».' : 'Knytt oppgaven til et kull for å følge innleveringer per student.'}
          </Typography>
        ) : (
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {submissions.map((s, i) => (
              <Box key={s.studentId}>
                {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ px: 2, py: 1.25 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.studentName}</Typography>
                  <ToggleButtonGroup size="small" exclusive value={s.status}
                    onChange={(_e, v: SubmissionStatus | null) => { if (v) void setStatus(s.studentId, v); }}
                    sx={{
                      '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontSize: 12, py: 0.25, px: 1 },
                      '& .Mui-selected': { bgcolor: 'rgba(139,92,246,0.28) !important', color: '#fff !important' },
                    }}>
                    {(Object.keys(SUB_META) as SubmissionStatus[]).map((st) => (
                      <ToggleButton key={st} value={st}>{SUB_META[st].label}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Stack>
              </Box>
            ))}
          </Card>
        )}
      </Box>
    </Box>
  );
}

function RubricEditor({ assignmentId, onError }: { assignmentId: string; onError: (m: string | null) => void }) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void educationRubricService.getRubric(assignmentId)
      .then(setCriteria)
      .catch(() => { /* tom rubrikk er greit */ })
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const c = await educationRubricService.addCriterion(assignmentId, { title: title.trim(), learningGoal: goal.trim() || undefined });
      setCriteria((prev) => [...prev, c]);
      setTitle(''); setGoal(''); setAdding(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke legge til kriterium');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await educationRubricService.deleteCriterion(id);
      setCriteria((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke slette kriterium');
    }
  };

  if (loading) return null;

  return (
    <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <CardContent sx={{ display: 'grid', gap: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rubrikk (vurderingskriterier)</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding((v) => !v)} sx={{ color: ACCENT, textTransform: 'none' }}>Nytt kriterium</Button>
        </Stack>
        {criteria.length === 0 && !adding && (
          <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>Ingen kriterier enda. Legg til kriterier (f.eks. «Manus/story», «Casting», «Teknisk utførelse») for strukturert vurdering knyttet til læringsmålene.</Typography>
        )}
        {criteria.map((c) => (
          <Stack key={c.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.25 }}>
            <Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{c.title}</Typography>
              {c.learningGoal && <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{c.learningGoal}</Typography>}
            </Box>
            <IconButton size="small" onClick={() => remove(c.id)} sx={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Slett kriterium"><DeleteIcon fontSize="small" /></IconButton>
          </Stack>
        ))}
        {adding && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 0.5 }}>
            <TextField label="Kriterium" size="small" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus fullWidth placeholder="Manus/story" />
            <TextField label="Læringsmål (valgfritt)" size="small" value={goal} onChange={(e) => setGoal(e.target.value)} fullWidth />
            <Button variant="contained" onClick={add} disabled={!title.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT }, whiteSpace: 'nowrap' }}>Legg til</Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default AssignmentsTab;
