/**
 * ProducerAssistantsPanel — produsentens flate for assistent-scoping (vinner:
 * rolle-presets + granular overstyring). Inviter assistenter med begrenset
 * tilgang. Tre fikser fra adversarial-kritikken er innbakt:
 *  1) Sensitive områder (Økonomi/Klient-info/Internt rom) krever bekreftelse +
 *     er tydelig merket — kan ikke slås på ved et uskyldig klikk.
 *  2) «Hva får denne personen se?» oppdateres LIVE med togglene.
 *  3) Internt team-rom er sensitivt + av som standard (lekkasje-vektor).
 *
 * Produsent-only. WCAG: av/på med ikon-FORM + tekst, ikke farge alene. 44px.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, Chip, CircularProgress, Snackbar, Switch,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Divider,
} from '@mui/material';
import {
  PersonAddAlt1Outlined as InviteIcon,
  CheckCircle as OnIcon,
  RadioButtonUnchecked as OffIcon,
  WarningAmberOutlined as SensitiveIcon,
  DeleteOutline as RevokeIcon,
  ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import {
  listAssistants, inviteAssistant, updateAssistant, revokeAssistant,
  ASSISTANT_AREAS, SENSITIVE_AREAS, AREA_LABELS, ROLE_PRESETS,
  type RoleRoomAssistant, type AssistantArea,
} from '../../services/roleRoomAssistantsApi';

const PRESET_LABEL: Record<string, string> = Object.fromEntries(ROLE_PRESETS.map((p) => [p.value, p.label]));
const isSensitive = (a: AssistantArea) => SENSITIVE_AREAS.includes(a);

export default function ProducerAssistantsPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<RoleRoomAssistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [preset, setPreset] = useState('editor');
  // Bekreftelse ved aktivering av sensitivt område.
  const [confirm, setConfirm] = useState<{ a: RoleRoomAssistant; area: AssistantArea } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listAssistants(projectId)); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke hente assistenter'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const invite = useCallback(async () => {
    if (!email.trim()) { setToast('Skriv inn e-post.'); return; }
    setBusyId('invite');
    try {
      await inviteAssistant(projectId, { email: email.trim(), name: name.trim() || undefined, rolePreset: preset });
      setToast('Assistent invitert med least-privilege-tilgang.');
      setEmail(''); setName(''); setAdding(false);
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke invitere.'); }
    finally { setBusyId(null); }
  }, [projectId, email, name, preset, load]);

  const applyAreas = useCallback(async (a: RoleRoomAssistant, areas: Partial<Record<AssistantArea, boolean>>) => {
    setBusyId(a.id);
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, areas: { ...x.areas, ...areas } } : x)));
    try { await updateAssistant(projectId, a.id, { areas }); }
    catch { setToast('Kunne ikke oppdatere tilgang.'); await load(); }
    finally { setBusyId(null); }
  }, [projectId, load]);

  const toggleArea = useCallback((a: RoleRoomAssistant, area: AssistantArea) => {
    const turningOn = !a.areas[area];
    if (turningOn && isSensitive(area)) { setConfirm({ a, area }); return; }  // friksjon (fiks #1)
    void applyAreas(a, { [area]: turningOn });
  }, [applyAreas]);

  const revoke = useCallback(async (a: RoleRoomAssistant) => {
    setBusyId(a.id);
    try { await revokeAssistant(projectId, a.id); setItems((prev) => prev.filter((x) => x.id !== a.id)); setToast('Tilgang trukket tilbake.'); }
    catch { setToast('Kunne ikke trekke tilbake.'); }
    finally { setBusyId(null); }
  }, [projectId]);

  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>Team &amp; assistenter</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(226,232,240,0.8)', mt: 0.3 }}>
          Inviter assistenter med akkurat den tilgangen de trenger. Sensitive områder er av som standard.
        </Typography>
      </Box>

      {!adding ? (
        <Button onClick={() => setAdding(true)} startIcon={<InviteIcon />} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, minHeight: 44, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}>
          Inviter assistent
        </Button>
      ) : (
        <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(124,58,237,0.06)' }}>
          <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '0.95rem', mb: 1 }}>Inviter assistent</Typography>
          <Stack spacing={1.25}>
            <TextField label="E-post" value={email} onChange={(e) => setEmail(e.target.value)} size="small" fullWidth sx={fieldSx} />
            <TextField label="Navn (valgfritt)" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth sx={fieldSx} />
            <FormControl size="small" fullWidth sx={fieldSx}>
              <InputLabel>Rolle</InputLabel>
              <Select label="Rolle" value={preset} onChange={(e) => setPreset(e.target.value)} sx={{ color: '#f1f5f9' }}>
                {ROLE_PRESETS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.74rem', mt: -0.5 }}>
              Rollen setter fornuftig tilgang automatisk — du finjusterer etterpå. Sensitive områder forblir av.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => void invite()} disabled={busyId === 'invite'} startIcon={busyId === 'invite' ? <CircularProgress size={15} color="inherit" /> : <InviteIcon />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)' }}>Send invitasjon</Button>
              <Button onClick={() => setAdding(false)} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 44, color: 'rgba(226,232,240,0.8)' }}>Avbryt</Button>
            </Stack>
          </Stack>
        </Box>
      )}

      <Box>
        <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.82rem', fontWeight: 800, mb: 1 }}>
          Aktive assistenter {loading ? '' : `· ${items.length}`}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: '#a855f7' }} /></Box>
        ) : items.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.82rem', py: 2, textAlign: 'center' }}>Ingen assistenter ennå.</Typography>
        ) : (
          <Stack spacing={1.25}>{items.map((a) => (
            <AssistantCard key={a.id} a={a} busy={busyId === a.id} onToggle={toggleArea} onRevoke={revoke} />
          ))}</Stack>
        )}
      </Box>

      {/* Sensitiv-bekreftelse (fiks #1) */}
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { background: '#0c0a18', border: '1px solid rgba(245,158,11,0.4)', color: '#e2e8f0' } } }}>
        <DialogTitle sx={{ color: '#fcd34d', fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SensitiveIcon /> Gi sensitiv tilgang?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.88rem' }}>
            Du er i ferd med å gi <strong>{confirm?.a.assistantName || confirm?.a.assistantEmail}</strong> tilgang til
            {' '}<strong>{confirm ? AREA_LABELS[confirm.area] : ''}</strong>. Dette er sensitivt
            {confirm?.area === 'internal_chat' ? ' — det interne team-rommet kan inneholde budsjett- og klientdiskusjoner i fritekst.' : '.'} Er du sikker?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none', color: 'rgba(226,232,240,0.8)' }}>Avbryt</Button>
          <Button onClick={() => { if (confirm) { void applyAreas(confirm.a, { [confirm.area]: true }); setConfirm(null); } }}
            variant="contained" sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#b45309', '&:hover': { bgcolor: '#92400e' } }}>
            Ja, gi tilgang
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
}

const fieldSx = { '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.6)' }, '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.8)' } };

function AssistantCard({ a, busy, onToggle, onRevoke }: {
  a: RoleRoomAssistant; busy: boolean; onToggle: (a: RoleRoomAssistant, area: AssistantArea) => void; onRevoke: (a: RoleRoomAssistant) => void;
}) {
  // Live sammendrag (fiks #2): utledes direkte fra gjeldende areas.
  const granted = ASSISTANT_AREAS.filter((ar) => a.areas[ar]);
  const sensitiveGranted = granted.filter(isSensitive);
  return (
    <Box sx={{ borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(2,6,23,0.4)', p: 1.25, opacity: busy ? 0.7 : 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ color: '#f1f5f9', fontSize: '0.92rem', fontWeight: 700 }}>{a.assistantName || a.assistantEmail}</Typography>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.2 }}>
            <Chip label={PRESET_LABEL[a.rolePreset] ?? a.rolePreset} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: '#c4b5fd', bgcolor: 'rgba(168,85,247,0.14)' }} />
            <Chip label={a.status === 'active' ? 'Aktiv' : 'Invitert'} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: a.status === 'active' ? '#6ee7b7' : '#fcd34d', bgcolor: a.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }} />
            {a.assistantName ? <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.72rem' }}>{a.assistantEmail}</Typography> : null}
          </Stack>
        </Box>
        <Button onClick={() => onRevoke(a)} size="small" startIcon={<RevokeIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 36, color: 'rgba(252,165,165,0.9)' }}>Fjern</Button>
      </Stack>

      {/* Live «hva får denne personen se?» (fiks #2) */}
      <Box sx={{ mt: 0.8, p: 0.9, borderRadius: 1.5, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(148,163,184,0.12)' }}>
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 0.5 }}>
          <ShieldIcon sx={{ fontSize: 14, color: '#6ee7b7' }} />
          <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.72rem', fontWeight: 700 }}>Får se:</Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '0.72rem' }}>
            {granted.length === 0 ? 'ingenting ennå' : granted.map((g) => AREA_LABELS[g]).join(', ')}
          </Typography>
        </Stack>
        {sensitiveGranted.length > 0 ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <SensitiveIcon sx={{ fontSize: 13, color: '#fbbf24' }} />
            <Typography sx={{ color: '#fcd34d', fontSize: '0.7rem', fontWeight: 700 }}>
              Sensitivt: {sensitiveGranted.map((g) => AREA_LABELS[g]).join(', ')}
            </Typography>
          </Stack>
        ) : null}
      </Box>

      <Divider sx={{ my: 0.9, borderColor: 'rgba(148,163,184,0.12)' }} />

      {/* Område-toggles */}
      <Stack spacing={0.3}>
        {ASSISTANT_AREAS.map((area) => {
          const on = Boolean(a.areas[area]);
          const sensitive = isSensitive(area);
          return (
            <Stack key={area} direction="row" alignItems="center" spacing={0.75} sx={{ py: 0.35 }}>
              {on ? <OnIcon sx={{ fontSize: 16, color: sensitive ? '#fbbf24' : '#6ee7b7' }} /> : <OffIcon sx={{ fontSize: 16, color: 'rgba(226,232,240,0.4)' }} />}
              <Typography sx={{ flex: 1, color: on ? '#f1f5f9' : 'rgba(226,232,240,0.8)', fontSize: '0.82rem', fontWeight: on ? 700 : 500 }}>
                {AREA_LABELS[area]}
              </Typography>
              {sensitive ? <Chip icon={<SensitiveIcon sx={{ fontSize: 12, color: '#fbbf24 !important' }} />} label="Sensitivt" size="small" sx={{ height: 18, fontSize: '0.66rem', fontWeight: 700, color: '#fcd34d', bgcolor: 'rgba(245,158,11,0.1)' }} /> : null}
              <Switch checked={on} disabled={busy} onChange={() => onToggle(a, area)} size="small"
                sx={{ '& .Mui-checked': { color: sensitive ? '#fbbf24' : '#6ee7b7' }, '& .Mui-checked + .MuiSwitch-track': { backgroundColor: sensitive ? '#b45309' : '#0f766e' } }} />
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
