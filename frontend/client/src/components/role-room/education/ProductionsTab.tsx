/**
 * ProductionsTab.tsx — «Studentproduksjoner»-flaten.
 *
 * Hver studentproduksjon ER et ekte Role Room-prosjekt (casting_projects).
 * Faglærer oppretter en produksjon (som lager et ekte prosjekt + kobler til
 * kull), åpner den i Role Room (ny fane, production-modus) for å gjøre det
 * faktiske arbeidet, eller fjerner koblingen.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, Card, CardContent, Button, TextField,
  IconButton, Chip, CircularProgress, Alert, MenuItem, Dialog, DialogTitle,
  DialogContent, Divider, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, MovieCreation as ProductionIcon,
  OpenInNew as OpenIcon, GroupAdd as AssignIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { educationProductionsService, openProductionInRoleRoom, type Production } from './educationProductionsService';
import {
  educationProductionMembersService, MEMBER_ROLE_LABELS,
  type ProductionMember, type MemberRole,
} from './educationProductionMembersService';

const ACCENT = '#8B5CF6';
const ROLE_ORDER: MemberRole[] = ['viewer', 'contributor', 'lead'];

export function ProductionsTab() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [busy, setBusy] = useState(false);
  const [membersFor, setMembersFor] = useState<Production | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([
        educationProductionsService.listProductions(),
        educationCohortsService.listCohorts(),
      ]);
      setProductions(p);
      setCohorts(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente produksjoner');
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
      const production = await educationProductionsService.createProduction({
        title: title.trim(),
        cohortId: cohortId || undefined,
      });
      setProductions((prev) => [production, ...prev]);
      setTitle(''); setCohortId(''); setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette produksjon');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await educationProductionsService.deleteProduction(id);
      setProductions((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke fjerne produksjon');
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Studentproduksjoner</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Hver produksjon er et fullt Role Room-prosjekt — story-arc, casting, call-sheet og leveranser.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating((v) => !v)}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT, opacity: 0.9 }, whiteSpace: 'nowrap' }}>
          Ny produksjon
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {creating && (
        <Card sx={{ bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.24)' }}>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <TextField label="Tittel på produksjonen" size="small" value={title} onChange={(e) => setTitle(e.target.value)}
              autoFocus required placeholder="Kortfilm — vårsemesteret" />
            <TextField label="Kull" size="small" select value={cohortId} onChange={(e) => setCohortId(e.target.value)}
              helperText={cohorts.length === 0 ? 'Opprett et kull først i «Kull & studenter»' : ' '}>
              <MenuItem value=""><em>Ikke knyttet til kull</em></MenuItem>
              {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
              Dette oppretter et ekte Role Room-prosjekt du kan åpne og jobbe i.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setCreating(false)} disabled={busy}>Avbryt</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!title.trim() || busy}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT } }}>
                {busy ? 'Oppretter…' : 'Opprett produksjon'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : productions.length === 0 ? (
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(139,92,246,0.3)' }}>
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <ProductionIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>Ingen studentproduksjoner enda. Opprett en — den blir et ekte Role Room-prosjekt studentene jobber i.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          {productions.map((p) => {
            const name = cohortName(p.cohortId);
            return (
              <Card key={p.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ pr: 3 }}>
                      <Typography sx={{ fontWeight: 700 }}>{p.title}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                        {name && <Chip size="small" label={name} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />}
                        {p.projectStatus && <Chip size="small" label={p.projectStatus === 'active' ? 'Aktiv' : p.projectStatus} sx={{ height: 20, fontSize: 10 }} />}
                        {p.assignmentCount > 0 && <Chip size="small" label={`${p.assignmentCount} oppgave${p.assignmentCount === 1 ? '' : 'r'}`} sx={{ height: 20, fontSize: 10 }} />}
                      </Stack>
                    </Box>
                    <IconButton size="small" onClick={() => handleDelete(p.id)}
                      sx={{ position: 'absolute', top: 6, right: 6, color: 'rgba(255,255,255,0.4)' }} aria-label="Fjern kobling">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button fullWidth size="small" variant="text" startIcon={<AssignIcon />} onClick={() => setMembersFor(p)}
                      sx={{ color: '#e9d5ff', textTransform: 'none' }}>
                      Tildel studenter
                    </Button>
                    <Button fullWidth size="small" variant="outlined" startIcon={<OpenIcon />} onClick={() => openProductionInRoleRoom(p.projectId)}
                      sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(139,92,246,0.08)' } }}>
                      Åpne i Role Room
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {productions.length > 0 && (
        <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>
          «Fjern» tar bort koblingen til kullet — selve Role Room-prosjektet og arbeidet består.
        </Typography>
      )}

      {membersFor && <ProductionMembersDialog production={membersFor} onClose={() => setMembersFor(null)} />}
    </Box>
  );
}

function ProductionMembersDialog({ production, onClose }: { production: Production; onClose: () => void }) {
  const [members, setMembers] = useState<ProductionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void educationProductionMembersService.listMembers(production.id)
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunne ikke hente studenter'))
      .finally(() => setLoading(false));
  }, [production.id]);

  const setRole = async (studentId: string, role: MemberRole | null) => {
    setSavingId(studentId);
    setError(null);
    try {
      if (role) await educationProductionMembersService.setMember(production.id, { studentId, role });
      else await educationProductionMembersService.removeMember(production.id, studentId);
      setMembers((prev) => prev.map((m) => m.studentId === studentId
        ? { ...m, assigned: !!role, role: role ?? m.role }
        : m));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#141018', border: '1px solid rgba(139,92,246,0.3)', color: '#fff' } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Tildel studenter
        <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 400 }}>{production.title}</Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1 }}>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 0.5 }}>
          Skolen bestemmer hvem som er med og med hvilken rolle. Studenten ser kun produksjonene de er tildelt.
        </Typography>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : members.length === 0 ? (
          <Typography sx={{ color: 'text.disabled', textAlign: 'center', p: 2, fontSize: 13.5 }}>
            Ingen studenter i kullet. Legg til studenter i «Kull & studenter» først.
          </Typography>
        ) : (
          members.map((m, i) => (
            <Box key={m.studentId}>
              {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1} sx={{ py: 1.25 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{m.studentName}</Typography>
                <ToggleButtonGroup size="small" exclusive value={m.assigned ? m.role : 'none'} disabled={savingId === m.studentId}
                  onChange={(_e, v: MemberRole | 'none' | null) => { if (v !== null) void setRole(m.studentId, v === 'none' ? null : v); }}
                  sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontSize: 11.5, py: 0.25, px: 1 }, '& .Mui-selected': { bgcolor: 'rgba(139,92,246,0.28) !important', color: '#fff !important' } }}>
                  <ToggleButton value="none">Ikke med</ToggleButton>
                  {ROLE_ORDER.map((r) => <ToggleButton key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</ToggleButton>)}
                </ToggleButtonGroup>
              </Stack>
            </Box>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProductionsTab;
