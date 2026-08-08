/**
 * FacultyTab.tsx — «Fakultet» (redesign, CMS-koblet).
 *
 * Institusjonens ansatte med rolle + hvem som veileder hvilket kull. Design
 * speiler mockup: KPI-kort og tabell (navn / rolle / kull tildelt / status).
 * Ekte data + CRUD via educationFacultyService (inline rolle + kull-tildeling);
 * «Inviter sensor» oppretter ekte sensor-invitasjon (educationCensorService) og
 * sensor-tellingen leses fra kull-invitasjonene. «Ledige seter» = lisens, kommer.
 *
 * 🔑 CMS: stabile data-edit-id (edu-fk-*) på hvert statiske element.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, IconButton, Collapse, TextField, MenuItem,
  Select, OutlinedInput, Chip, CircularProgress, Alert, Avatar, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox, Tooltip,
} from '@mui/material';
import {
  SupervisorAccount as FacultyIcon, Add as AddIcon, Delete as DeleteIcon,
  PersonAddAlt as InviteTeacherIcon, HowToReg as InviteCensorIcon,
  Groups as CohortIcon, EventSeat as SeatIcon, Gavel as CensorIcon,
  Tune as LicenseIcon,
} from '@mui/icons-material';
import { educationCohortsService, type Cohort } from './educationCohortsService';
import { educationCensorService } from './educationCensorService';
import { educationLicenseService, type License } from './educationLicenseService';
import {
  educationFacultyService, FACULTY_ROLE_LABELS, FACULTY_ROLE_ORDER,
  type Faculty, type FacultyRole,
} from './educationFacultyService';
import { ACCENT, Panel, T } from './_eduUi';

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const ROLE_COLOR: Record<FacultyRole, string> = {
  lead: '#c4b5fd', teacher: '#38bdf8', supervisor: '#34d399', guest: '#f59e0b',
};

export function FacultyTab() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [censorCount, setCensorCount] = useState<number | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Lisens-editor.
  const [licOpen, setLicOpen] = useState(false);
  const [licUnlimited, setLicUnlimited] = useState(false);
  const [licSeats, setLicSeats] = useState('');
  const [licBusy, setLicBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FacultyRole>('teacher');
  const [busy, setBusy] = useState(false);
  const [censorCohort, setCensorCohort] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [f, c] = await Promise.all([educationFacultyService.listFaculty(), educationCohortsService.listCohorts()]);
      setFaculty(f); setCohorts(c);
      // Sensor-telling: aktive invitasjoner på tvers av kull.
      try {
        const invites = await Promise.all(c.map((co) => educationCensorService.listCohortInvites(co.id).catch(() => [])));
        setCensorCount(invites.flat().filter((i) => i.status !== 'revoked').length);
      } catch { setCensorCount(null); }
      try { setLicense(await educationLicenseService.getLicense()); } catch { setLicense(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente fakultet');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cohortName = useCallback((id: string) => cohorts.find((c) => c.id === id)?.name ?? id, [cohorts]);

  const openLicenseEditor = () => {
    setLicUnlimited(license?.unlimited ?? false);
    setLicSeats(license?.seatLimit != null ? String(license.seatLimit) : '');
    setLicOpen(true);
  };
  const saveLicense = async () => {
    setLicBusy(true); setError(null);
    try {
      const updated = await educationLicenseService.updateLicense({
        unlimited: licUnlimited,
        seatLimit: licUnlimited ? null : (licSeats.trim() === '' ? null : Number(licSeats)),
      });
      setLicense(updated); setLicOpen(false);
      setToast('TRR-lisens oppdatert.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke lagre lisens'); }
    finally { setLicBusy(false); }
  };

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const f = await educationFacultyService.createFaculty({ name: name.trim(), email: email.trim() || undefined, role });
      setFaculty((prev) => [...prev, f]);
      setName(''); setEmail(''); setRole('teacher'); setCreating(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke legge til'); }
    finally { setBusy(false); }
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
    try { await educationFacultyService.deleteFaculty(id); setFaculty((prev) => prev.filter((f) => f.id !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke fjerne'); }
  };
  const inviteCensor = async () => {
    const target = censorCohort || cohorts[0]?.id;
    if (!target) { setError('Opprett et kull før du inviterer sensor.'); return; }
    setBusy(true);
    try {
      await educationCensorService.createInvite({ cohortId: target });
      setToast(`Sensor-invitasjon opprettet for ${cohortName(target)}.`);
      setCensorCount((n) => (n ?? 0) + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Kunne ikke invitere sensor'); }
    finally { setBusy(false); }
  };

  const assignedCohortIds = useMemo(() => new Set(faculty.flatMap((f) => f.cohortIds)), [faculty]);
  const kpis = [
    { id: 'faglaerere', label: 'Faglærere', value: faculty.filter((f) => f.role !== 'guest').length, hint: 'Aktive dette semesteret', icon: <FacultyIcon />, bg: 'rgba(139,92,246,0.16)', c: '#c4b5fd' },
    { id: 'sensorer', label: 'Sensorer', value: censorCount ?? '—', hint: 'Eksterne, tilgang på eksamen', icon: <CensorIcon />, bg: 'rgba(245,158,11,0.16)', c: '#f59e0b' },
    { id: 'kull', label: 'Kull tildelt', value: `${assignedCohortIds.size}/${cohorts.length}`, hint: assignedCohortIds.size >= cohorts.length && cohorts.length > 0 ? 'Alle kull har veileder' : 'Har minst én veileder', icon: <CohortIcon />, bg: 'rgba(16,185,129,0.16)', c: '#34d399' },
    {
      id: 'seter',
      label: 'Ledige TRR-seter',
      value: !license ? '—' : license.unlimited ? 'Ubegrenset' : (license.available != null ? license.available : '—'),
      hint: !license ? 'Laster lisens…' : license.unlimited ? 'Site-/FTE-lisens' : (license.seatLimit != null ? `${license.used} av ${license.seatLimit} i bruk` : 'Lisens ikke satt — klikk tannhjulet'),
      icon: <SeatIcon />, bg: 'rgba(56,189,248,0.16)', c: '#38bdf8',
      onEdit: openLicenseEditor,
    },
  ];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box sx={{ width: 50, height: 50, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', display: 'grid', placeItems: 'center', flexShrink: 0 }}><FacultyIcon /></Box>
          <Box>
            <T eid="edu-fk-title" variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.4 }}>Fakultet</T>
            <T eid="edu-fk-subtitle" sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 13.5, mt: 0.4 }}>Stab-seter, lærer-roller og hvem som veileder hvilket kull — pluss eksterne sensorer.</T>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<InviteCensorIcon />} onClick={inviteCensor} disabled={busy} sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            <T eid="edu-fk-btn-censor" component="span" sx={{ fontWeight: 600 }}>Inviter sensor</T>
          </Button>
          <Button variant="contained" startIcon={<InviteTeacherIcon />} onClick={() => setCreating((v) => !v)} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            <T eid="edu-fk-btn-teacher" component="span" sx={{ fontWeight: 700 }}>Inviter faglærer</T>
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Skjema */}
      <Collapse in={creating}>
        <Panel sx={{ border: '1px solid rgba(139,92,246,0.35)' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField label="Navn" size="small" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
            <TextField label="E-post (valgfritt)" size="small" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Rolle" size="small" select value={role} onChange={(e) => setRole(e.target.value as FacultyRole)} sx={{ minWidth: 150 }}>
              {FACULTY_ROLE_ORDER.map((r) => <MenuItem key={r} value={r}>{FACULTY_ROLE_LABELS[r]}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Button onClick={() => setCreating(false)} disabled={busy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
            <Button variant="contained" onClick={create} disabled={!name.trim() || busy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}>{busy ? 'Legger til…' : 'Legg til'}</Button>
          </Stack>
        </Panel>
      </Collapse>

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        {kpis.map((k) => {
          const onEdit = (k as { onEdit?: () => void }).onEdit;
          return (
          <Panel key={k.id} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <T eid={`edu-fk-kpi-${k.id}-label`} sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>{k.label}</T>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {onEdit && <Tooltip title="Rediger lisens"><IconButton size="small" onClick={onEdit} sx={{ color: 'rgba(255,255,255,0.75)' }}><LicenseIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: k.bg, color: k.c, '& svg': { fontSize: 19 } }}>{k.icon}</Box>
              </Stack>
            </Stack>
            <Typography sx={{ fontSize: 25, fontWeight: 700, mt: 1, lineHeight: 1 }}>{k.value}</Typography>
            <T eid={`edu-fk-kpi-${k.id}-hint`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', mt: 0.75 }}>{k.hint}</T>
          </Panel>
          );
        })}
      </Box>

      {/* Fakultet-tabell */}
      <Panel sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 2fr 1fr 40px', px: 2, py: 1.25, bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {[['navn', 'Navn'], ['rolle', 'Rolle'], ['kull', 'Kull tildelt'], ['status', 'Status'], ['a', '']].map(([id, label]) => (
            <T key={id} eid={`edu-fk-th-${id}`} sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>{label}</T>
          ))}
        </Box>

        {faculty.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <FacultyIcon sx={{ fontSize: 40, color: ACCENT, mb: 1 }} />
            <T eid="edu-fk-empty" sx={{ color: 'rgba(255,255,255,0.72)', display: 'block' }}>Ingen fakultetsmedlemmer ennå. Inviter lærere og veiledere, og koble dem til kull.</T>
          </Box>
        ) : faculty.map((f) => (
          <Box key={f.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 2fr 1fr 40px', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
              <Avatar sx={{ width: 34, height: 34, fontSize: 12, bgcolor: 'rgba(139,92,246,0.3)', color: '#e9d5ff' }}>{initials(f.name)}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Typography>
                {f.email && <Typography sx={{ fontSize: 11.5, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email}</Typography>}
              </Box>
            </Stack>
            <Select size="small" value={f.role} onChange={(e) => changeRole(f.id, e.target.value as FacultyRole)} variant="standard" disableUnderline
              sx={{ fontSize: 12.5, color: ROLE_COLOR[f.role], fontWeight: 600, '& .MuiSelect-select': { py: 0.25 } }}>
              {FACULTY_ROLE_ORDER.map((r) => <MenuItem key={r} value={r}>{FACULTY_ROLE_LABELS[r]}</MenuItem>)}
            </Select>
            <Select multiple size="small" value={f.cohortIds} fullWidth
              onChange={(e) => changeCohorts(f.id, typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              input={<OutlinedInput sx={{ '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' } }} />}
              renderValue={(sel) => (sel as string[]).length === 0 ? <em style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Ingen</em> : (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {(sel as string[]).map((id) => <Chip key={id} size="small" label={cohortName(id)} sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff' }} />)}
                </Stack>
              )}
              disabled={cohorts.length === 0}>
              {cohorts.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
            <Box>{(() => { const assigned = f.cohortIds.length > 0; return (
              <Box sx={{ display: 'inline-block', px: 1.25, py: 0.4, borderRadius: 5, bgcolor: assigned ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)', color: assigned ? '#34d399' : 'rgba(255,255,255,0.72)', fontSize: 11.5, fontWeight: 600 }}>{assigned ? 'Aktiv' : 'Uten kull'}</Box>
            ); })()}</Box>
            <IconButton size="small" onClick={() => remove(f.id)} sx={{ color: 'rgba(255,255,255,0.3)' }} aria-label="Fjern"><DeleteIcon fontSize="small" /></IconButton>
          </Box>
        ))}
      </Panel>

      {/* Lisens-editor */}
      <Dialog open={licOpen} onClose={() => setLicOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: '#141018', color: '#fff', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>TRR-lisens</DialogTitle>
        <DialogContent>
          <T eid="edu-fk-lic-help" sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', mb: 2 }}>
            Ett TRR-sete = én aktiv Role Room-bruker (faglærer eller student). Settes etter avtalen med institusjonen. {license ? `${license.used} i bruk nå.` : ''}
          </T>
          <FormControlLabel control={<Checkbox checked={licUnlimited} onChange={(e) => setLicUnlimited(e.target.checked)} sx={{ color: 'rgba(255,255,255,0.72)', '&.Mui-checked': { color: ACCENT } }} />}
            label={<Typography sx={{ fontSize: 13.5 }}>Ubegrenset (site-/FTE-lisens)</Typography>} />
          <TextField size="small" type="number" label="Antall TRR-seter" value={licSeats} onChange={(e) => setLicSeats(e.target.value)} disabled={licUnlimited} fullWidth sx={{ mt: 1.5 }} inputProps={{ min: 0 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLicOpen(false)} disabled={licBusy} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>Avbryt</Button>
          <Button variant="contained" onClick={saveLicense} disabled={licBusy} sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}>{licBusy ? 'Lagrer…' : 'Lagre'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default FacultyTab;
