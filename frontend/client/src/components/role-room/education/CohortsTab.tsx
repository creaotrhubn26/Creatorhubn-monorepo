/**
 * CohortsTab.tsx — «Kull & studenter»-flaten i utdannings-workspacet.
 * Full CRUD mot educationCohortsService: opprett kull, legg til studenter,
 * slett. Owner-scopet server-side (institusjonen ser kun sine egne).
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, CardActionArea, Button, TextField,
  IconButton, Chip, CircularProgress, Divider, Alert, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Groups as CohortIcon,
  ArrowBack as BackIcon, PersonAdd as PersonAddIcon, VpnKey as InviteIcon,
  ContentCopy as CopyIcon, Check as CheckIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort, type Student } from './educationCohortsService';
import { educationStudentInvitesService, type StudentInvite } from './educationStudentInvitesService';
import { educationCensorService, type CensorInvite } from './educationCensorService';
import { FactCheck as CensorIcon } from '@mui/icons-material';

const claimLink = (token: string) => `${window.location.origin}/role-room/student/claim?token=${encodeURIComponent(token)}`;
const censorLink = (token: string) => `${window.location.origin}/role-room/censor/claim?token=${encodeURIComponent(token)}`;

const ACCENT = '#8B5CF6';

export function CohortsTab() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Cohort | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProgram, setNewProgram] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCohorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCohorts(await educationCohortsService.listCohorts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente kull');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCohorts(); }, [loadCohorts]);

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const cohort = await educationCohortsService.createCohort({
        name: newName.trim(),
        program: newProgram.trim() || undefined,
        term: newTerm.trim() || undefined,
      });
      setCohorts((prev) => [cohort, ...prev]);
      setNewName(''); setNewProgram(''); setNewTerm(''); setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette kull');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCohort = async (id: string) => {
    try {
      await educationCohortsService.deleteCohort(id);
      setCohorts((prev) => prev.filter((c) => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke slette kull');
    }
  };

  if (selected) {
    return <StudentsView cohort={selected} onBack={() => { setSelected(null); void loadCohorts(); }} onError={setError} error={error} />;
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Kull & studenter</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT, opacity: 0.9 } }}>
          Nytt kull
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {creating && (
        <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)' }}>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <TextField label="Navn på kull" size="small" value={newName} onChange={(e) => setNewName(e.target.value)}
              autoFocus required placeholder="Film 1. år 2026" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField label="Studieprogram (valgfritt)" size="small" value={newProgram} onChange={(e) => setNewProgram(e.target.value)} fullWidth />
              <TextField label="Termin (valgfritt)" size="small" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Høst 2026" fullWidth />
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setCreating(false)} disabled={busy}>Avbryt</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!newName.trim() || busy}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT } }}>
                {busy ? 'Oppretter…' : 'Opprett kull'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : cohorts.length === 0 ? (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(139,92,246,0.3)' }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <CohortIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>Ingen kull enda. Opprett ditt første kull for å legge til studenter.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          {cohorts.map((c) => (
            <Card key={c.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
              <CardActionArea onClick={() => setSelected(c)} sx={{ p: 2 }}>
                <Stack spacing={0.5}>
                  <Typography sx={{ fontWeight: 700 }}>{c.name}</Typography>
                  {c.program && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{c.program}</Typography>}
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    {c.term && <Chip size="small" label={c.term} sx={{ height: 20, fontSize: 10 }} />}
                    <Chip size="small" label={`${c.studentCount} student${c.studentCount === 1 ? '' : 'er'}`}
                      sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />
                    {c.archived && <Chip size="small" label="Arkivert" sx={{ height: 20, fontSize: 10 }} />}
                  </Stack>
                </Stack>
              </CardActionArea>
              <IconButton size="small" onClick={() => handleDeleteCohort(c.id)}
                sx={{ position: 'absolute', top: 4, right: 4, color: 'rgba(255,255,255,0.4)' }} aria-label="Slett kull">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

function StudentsView({ cohort, onBack, onError, error }: {
  cohort: Cohort; onBack: () => void; onError: (m: string | null) => void; error: string | null;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Record<string, StudentInvite>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, inviteList] = await Promise.all([
        educationCohortsService.listStudents(cohort.id),
        educationStudentInvitesService.listCohortInvites(cohort.id).catch(() => []),
      ]);
      setStudents(list);
      setInvites(Object.fromEntries(inviteList.map((iv) => [iv.studentId, iv])));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke hente studenter');
    } finally {
      setLoading(false);
    }
  }, [cohort.id, onError]);

  useEffect(() => { void load(); }, [load]);

  const handleInvite = async (id: string) => {
    setInvitingId(id);
    try {
      const inv = await educationStudentInvitesService.invite(id);
      setInvites((prev) => ({ ...prev, [id]: inv }));
      if (inv.token) void handleCopy(id, inv.token);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke klargjøre tilgang');
    } finally {
      setInvitingId(null);
    }
  };

  const handleCopy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(claimLink(token));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    } catch { /* utrygg kontekst / no-op */ }
  };

  const handleRevoke = async (id: string) => {
    setInvitingId(id);
    try {
      await educationStudentInvitesService.revoke(id);
      setInvites((prev) => { const next = { ...prev }; delete next[id]; return next; });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke trekke tilbake');
    } finally {
      setInvitingId(null);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const s = await educationCohortsService.addStudent(cohort.id, { name: name.trim(), email: email.trim() || undefined });
      setStudents((prev) => [...prev, s]);
      setName(''); setEmail('');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke legge til student');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await educationCohortsService.deleteStudent(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke slette student');
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={onBack} sx={{ color: '#fff' }} aria-label="Tilbake"><BackIcon /></IconButton>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{cohort.name}</Typography>
          {cohort.program && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{cohort.program}{cohort.term ? ` · ${cohort.term}` : ''}</Typography>}
        </Box>
      </Stack>

      {error && <Alert severity="error" onClose={() => onError(null)}>{error}</Alert>}

      <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField label="Navn" size="small" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField label="E-post (valgfritt)" size="small" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={handleAdd} disabled={!name.trim() || busy}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT }, whiteSpace: 'nowrap' }}>
              Legg til
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
        «Inviter» lager en innloggingslenke — kopier den (📋) og del med studenten. De logger inn og ser Min side.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : students.length === 0 ? (
        <Typography sx={{ color: 'text.disabled', textAlign: 'center', p: 2 }}>Ingen studenter i dette kullet enda.</Typography>
      ) : (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {students.map((s, i) => (
            <Box key={s.id}>
              {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 2, py: 1.25 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{s.name}</Typography>
                  {s.email && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.email}</Typography>}
                </Box>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {invites[s.id]?.status === 'accepted' ? (
                    <Chip size="small" label="Aktivert" sx={{ height: 20, fontSize: 10, color: '#10b981', borderColor: '#10b981' }} variant="outlined" />
                  ) : invites[s.id]?.status === 'pending' ? (
                    <>
                      <Chip size="small" label="Invitert" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />
                      {invites[s.id]?.token && (
                        <Tooltip title={copiedId === s.id ? 'Lenke kopiert' : 'Kopier innloggingslenke'}>
                          <span><IconButton size="small" onClick={() => handleCopy(s.id, invites[s.id]!.token as string)} sx={{ color: copiedId === s.id ? '#10b981' : ACCENT }} aria-label="Kopier lenke">
                            {copiedId === s.id ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                          </IconButton></span>
                        </Tooltip>
                      )}
                      <Tooltip title="Trekk tilbake tilgang">
                        <span><IconButton size="small" onClick={() => handleRevoke(s.id)} disabled={invitingId === s.id} sx={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Trekk tilbake"><DeleteIcon fontSize="small" /></IconButton></span>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip title="Klargjør studenttilgang">
                      <span>
                        <Button size="small" startIcon={<InviteIcon sx={{ fontSize: '16px !important' }} />} onClick={() => handleInvite(s.id)} disabled={invitingId === s.id}
                          sx={{ color: ACCENT, textTransform: 'none', fontSize: 12, minWidth: 0 }}>
                          Inviter
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip title="Fjern student">
                    <span><IconButton size="small" onClick={() => handleDelete(s.id)} sx={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Fjern student"><DeleteIcon fontSize="small" /></IconButton></span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Card>
      )}

      <CensorInvitePanel cohortId={cohort.id} onError={onError} />
    </Box>
  );
}

function CensorInvitePanel({ cohortId, onError }: { cohortId: string; onError: (m: string | null) => void }) {
  const [invites, setInvites] = useState<CensorInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void educationCensorService.listCohortInvites(cohortId)
      .then(setInvites)
      .catch(() => { /* tomt greit */ })
      .finally(() => setLoading(false));
  }, [cohortId]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const inv = await educationCensorService.createInvite({ cohortId, name: name.trim() || undefined });
      setInvites((prev) => [inv, ...prev]);
      setName('');
      void copy(inv.id, inv.token);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke invitere sensor');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(censorLink(token));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
    } catch { /* no-op */ }
  };

  const revoke = async (id: string) => {
    try {
      await educationCensorService.revokeInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kunne ikke trekke tilbake');
    }
  };

  if (loading) return null;

  return (
    <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <CardContent sx={{ display: 'grid', gap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <CensorIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ekstern sensor</Typography>
        </Stack>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
          Gi en sensor tidsbegrenset tilgang til å se kullets arbeid + din vurdering, og gi sin egen. Lenken utløper automatisk.
        </Typography>
        {invites.map((inv) => (
          <Stack key={inv.id} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{inv.name || 'Sensor'}</Typography>
              <Chip size="small" label={inv.status === 'accepted' ? 'Aktivert' : 'Invitert'} sx={{ height: 18, fontSize: 9.5, mt: 0.25, bgcolor: inv.status === 'accepted' ? 'transparent' : 'rgba(139,92,246,0.22)', color: inv.status === 'accepted' ? '#10b981' : '#e9d5ff', borderColor: inv.status === 'accepted' ? '#10b981' : undefined }} variant={inv.status === 'accepted' ? 'outlined' : 'filled'} />
            </Box>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={copiedId === inv.id ? 'Lenke kopiert' : 'Kopier sensor-lenke'}>
                <span><IconButton size="small" onClick={() => copy(inv.id, inv.token)} sx={{ color: copiedId === inv.id ? '#10b981' : ACCENT }} aria-label="Kopier sensor-lenke">
                  {copiedId === inv.id ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                </IconButton></span>
              </Tooltip>
              <Tooltip title="Trekk tilbake">
                <span><IconButton size="small" onClick={() => revoke(inv.id)} sx={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Trekk tilbake"><DeleteIcon fontSize="small" /></IconButton></span>
              </Tooltip>
            </Stack>
          </Stack>
        ))}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 0.5 }}>
          <TextField label="Sensorens navn (valgfritt)" size="small" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <Button variant="contained" startIcon={<CensorIcon />} onClick={create} disabled={busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT }, whiteSpace: 'nowrap' }}>
            {busy ? 'Lager…' : 'Inviter sensor'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default CohortsTab;
