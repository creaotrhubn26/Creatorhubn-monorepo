/**
 * StudentWorkspace.tsx — student-modus «Min side» (professionMode = 'student').
 *
 * Studentens flate: produksjonene, oppgavene og tilbakemeldingene deres.
 * Foreløpig SUPER-ADMIN-PREVIEW: super admin velger kull → student og ser
 * nøyaktig hva studenten vil se. Ekte studentinnlogging (isolert sesjon) kobles
 * på samme flate i en senere skive; da resolves studenten fra sesjonen.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, Button, Chip,
  CircularProgress, Alert, MenuItem, TextField, Divider,
} from '@mui/material';
import {
  Backpack as StudentIcon, MovieCreation as ProductionIcon,
  OpenInNew as OpenIcon, Assignment as AssignmentIcon, Grading as GradedIcon,
} from '@mui/icons-material';
import { useSuperAdminGate } from '../components/admin/useSuperAdminGate';
import { educationCohortsService, type Cohort, type Student } from './educationCohortsService';
import { openProductionInRoleRoom } from './educationProductionsService';
import { educationStudentViewService, type StudentView, type StudentViewAssignment } from './educationStudentViewService';

const ACCENT = '#8B5CF6';

const SUB_META: Record<StudentViewAssignment['submissionStatus'], { label: string; color: string }> = {
  not_started: { label: 'Ikke levert', color: 'rgba(255,255,255,0.5)' },
  submitted: { label: 'Levert', color: '#e9d5ff' },
  reviewed: { label: 'Vurdert', color: '#10b981' },
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return null; }
}

export function StudentWorkspace() {
  const { isSuperAdmin, ready } = useSuperAdminGate();

  if (!ready) {
    return <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff', p: { xs: 2, md: 4 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <StudentIcon sx={{ color: ACCENT }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Min side</Typography>
        <Chip label="Student" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff', fontWeight: 700 }} />
      </Stack>
      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, mb: 3 }}>
        Produksjonene, oppgavene og tilbakemeldingene dine — samlet på ett sted.
      </Typography>

      {isSuperAdmin ? <SuperAdminPreview /> : <StudentPlaceholder />}
    </Box>
  );
}

function StudentPlaceholder() {
  return (
    <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)', borderRadius: 3 }}>
      <CardContent sx={{ p: 4, textAlign: 'center' }}>
        <StudentIcon sx={{ fontSize: 40, color: ACCENT, mb: 1.5 }} />
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Studenttilgang aktiveres via invitasjon</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.72)', maxWidth: 520, mx: 'auto', fontSize: 14 }}>
          Faglæreren din inviterer deg inn. Da får du din egen innlogging og ser produksjonene, oppgavene og tilbakemeldingene dine her.
        </Typography>
      </CardContent>
    </Card>
  );
}

function SuperAdminPreview() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [view, setView] = useState<StudentView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void educationCohortsService.listCohorts()
      .then(setCohorts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunne ikke hente kull'));
  }, []);

  useEffect(() => {
    setStudents([]); setStudentId(''); setView(null);
    if (!cohortId) return;
    void educationCohortsService.listStudents(cohortId)
      .then(setStudents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunne ikke hente studenter'));
  }, [cohortId]);

  const loadView = useCallback(async (id: string) => {
    setLoading(true); setError(null);
    try {
      setView(await educationStudentViewService.getStudentView(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente studentvisning');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Alert severity="info" sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'rgba(255,255,255,0.82)', '& .MuiAlert-icon': { color: ACCENT } }}>
        Administrator-forhåndsvisning: velg kull og student for å se nøyaktig hva studenten vil se.
      </Alert>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField label="Kull" size="small" select value={cohortId} onChange={(e) => setCohortId(e.target.value)} fullWidth>
          <MenuItem value=""><em>Velg kull</em></MenuItem>
          {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        <TextField label="Student" size="small" select value={studentId} disabled={!cohortId}
          onChange={(e) => { setStudentId(e.target.value); if (e.target.value) void loadView(e.target.value); }} fullWidth>
          <MenuItem value=""><em>Velg student</em></MenuItem>
          {students.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
        </TextField>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : view?.student ? (
        <StudentViewContent view={view} />
      ) : studentId ? null : (
        <Typography sx={{ color: 'text.disabled', textAlign: 'center', p: 3, fontSize: 13.5 }}>Velg en student for å forhåndsvise flaten.</Typography>
      )}
    </Box>
  );
}

function StudentViewContent({ view }: { view: StudentView }) {
  const { student, productions, assignments } = view;
  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {student && (
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
          Hei, {student.name}! {student.cohortName && <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: 13 }}>· {student.cohortName}</Typography>}
        </Typography>
      )}

      <Box>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <ProductionIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Produksjonene dine</Typography>
        </Stack>
        {productions.length === 0 ? (
          <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>Ingen produksjoner i kullet enda.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            {productions.map((p) => (
              <Card key={p.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Typography sx={{ fontWeight: 700 }}>{p.title}</Typography>
                  <Button fullWidth variant="outlined" startIcon={<OpenIcon />} onClick={() => openProductionInRoleRoom(p.projectId)}
                    sx={{ mt: 1.5, borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(139,92,246,0.08)' } }}>
                    Åpne i Role Room
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>

      <Box>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <AssignmentIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Oppgavene dine</Typography>
        </Stack>
        {assignments.length === 0 ? (
          <Typography sx={{ color: 'text.disabled', fontSize: 13 }}>Ingen oppgaver enda.</Typography>
        ) : (
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {assignments.map((a, i) => {
              const due = formatDate(a.dueAt);
              const sub = SUB_META[a.submissionStatus];
              return (
                <Box key={a.id}>
                  {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} flexWrap="wrap" useFlexGap>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.title}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={sub.label} sx={{ height: 20, fontSize: 10, color: sub.color, borderColor: sub.color }} variant="outlined" />
                          {a.productionTitle && <Chip size="small" icon={<ProductionIcon sx={{ fontSize: '12px !important' }} />} label={a.productionTitle} sx={{ height: 20, fontSize: 10, '& .MuiChip-icon': { color: ACCENT } }} />}
                          {due && <Chip size="small" label={`Frist ${due}`} sx={{ height: 20, fontSize: 10 }} />}
                        </Stack>
                        {a.brief && <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.75 }}>{a.brief}</Typography>}
                      </Box>
                      {a.productionProjectId && (
                        <Button size="small" variant="text" startIcon={<OpenIcon />} onClick={() => openProductionInRoleRoom(a.productionProjectId as string)}
                          sx={{ color: '#e9d5ff', textTransform: 'none', whiteSpace: 'nowrap' }}>
                          Åpne
                        </Button>
                      )}
                    </Stack>
                    {(a.grade || a.feedback) && (
                      <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.24)' }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: a.feedback ? 0.5 : 0 }}>
                          <GradedIcon sx={{ fontSize: 15, color: '#10b981' }} />
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                            Tilbakemelding{a.grade ? ` · Karakter: ${a.grade}` : ''}
                          </Typography>
                        </Stack>
                        {a.feedback && <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>{a.feedback}</Typography>}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Card>
        )}
      </Box>
    </Box>
  );
}

export default StudentWorkspace;
