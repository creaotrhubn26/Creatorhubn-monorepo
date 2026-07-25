/**
 * FacultyTab.tsx — «Fakultet»-flaten. Registrer institusjonens ansatte med
 * rolle og hvem som veileder hvilket kull. Owner-scopet.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, Button, TextField,
  IconButton, Chip, CircularProgress, Alert, MenuItem, Select, OutlinedInput,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, SupervisorAccount as FacultyIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import {
  educationFacultyService, FACULTY_ROLE_LABELS, FACULTY_ROLE_ORDER,
  type Faculty, type FacultyRole,
} from './educationFacultyService';

const ACCENT = '#8B5CF6';

export function FacultyTab() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FacultyRole>('teacher');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [f, c] = await Promise.all([educationFacultyService.listFaculty(), educationCohortsService.listCohorts()]);
      setFaculty(f); setCohorts(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente fakultet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cohortName = useCallback((id: string) => cohorts.find((c) => c.id === id)?.name ?? id, [cohorts]);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const f = await educationFacultyService.createFaculty({ name: name.trim(), email: email.trim() || undefined, role });
      setFaculty((prev) => [...prev, f]);
      setName(''); setEmail(''); setRole('teacher'); setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke legge til');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (id: string, r: FacultyRole) => {
    setFaculty((prev) => prev.map((f) => f.id === id ? { ...f, role: r } : f));
    try { await educationFacultyService.updateFaculty(id, { role: r }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke lagre rolle'); }
  };

  const changeCohorts = async (id: string, cohortIds: string[]) => {
    setFaculty((prev) => prev.map((f) => f.id === id ? { ...f, cohortIds } : f));
    try { await educationFacultyService.setCohorts(id, cohortIds); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke lagre kull'); }
  };

  const remove = async (id: string) => {
    try {
      await educationFacultyService.deleteFaculty(id);
      setFaculty((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke fjerne');
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Fakultet & roller</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Lærere og veiledere, og hvem som følger hvilket kull.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT, opacity: 0.9 } }}>
          Nytt medlem
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {creating && (
        <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)' }}>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField label="Navn" size="small" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
              <TextField label="E-post (valgfritt)" size="small" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
              <TextField label="Rolle" size="small" select value={role} onChange={(e) => setRole(e.target.value as FacultyRole)} sx={{ minWidth: 150 }}>
                {FACULTY_ROLE_ORDER.map((r) => <MenuItem key={r} value={r}>{FACULTY_ROLE_LABELS[r]}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setCreating(false)} disabled={busy}>Avbryt</Button>
              <Button variant="contained" onClick={create} disabled={!name.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT } }}>{busy ? 'Legger til…' : 'Legg til'}</Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : faculty.length === 0 ? (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(139,92,246,0.3)' }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <FacultyIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>Ingen fakultetsmedlemmer enda. Legg til lærere og veiledere, og koble dem til kull.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {faculty.map((f) => (
            <Card key={f.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <CardContent sx={{ display: 'grid', gap: 1.25 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{f.name}</Typography>
                    {f.email && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{f.email}</Typography>}
                  </Box>
                  <IconButton size="small" onClick={() => remove(f.id)} sx={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Fjern"><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <TextField label="Rolle" size="small" select value={f.role} onChange={(e) => changeRole(f.id, e.target.value as FacultyRole)} sx={{ minWidth: 150 }}>
                    {FACULTY_ROLE_ORDER.map((r) => <MenuItem key={r} value={r}>{FACULTY_ROLE_LABELS[r]}</MenuItem>)}
                  </TextField>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.disabled', mb: 0.25 }}>Følger kull</Typography>
                    <Select multiple size="small" fullWidth value={f.cohortIds}
                      onChange={(e) => changeCohorts(f.id, typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                      input={<OutlinedInput />}
                      renderValue={(sel) => (sel as string[]).length === 0 ? <em style={{ color: 'rgba(255,255,255,0.4)' }}>Ingen</em> : (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {(sel as string[]).map((id) => <Chip key={id} size="small" label={cohortName(id)} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />)}
                        </Stack>
                      )}
                      disabled={cohorts.length === 0}>
                      {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                    </Select>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default FacultyTab;
