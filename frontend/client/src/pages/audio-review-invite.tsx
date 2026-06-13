/**
 * audio-review-invite.tsx — offentlig invitasjons-/profil-side.
 * En bidragsyter mottar lenken (/audio-review/invite/:token), ser hvem som
 * inviterte + hvilket prosjekt, og fyller ut profilen sin (inkl. profilbilde).
 * Ingen innlogging kreves — tokenet er tilgangen.
 */
import React from 'react';
import { useParams } from 'wouter';
import {
  Box, Stack, Typography, Button, TextField, Avatar, CircularProgress, Chip,
} from '@mui/material';
import { MusicNote, CheckCircle } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import ImageDrop from '@/components/universal/showcase/ImageDrop';

const BG = '#0A0A0B', PANEL = '#131316', BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', ACCENT = '#FF6B35';
const initial = (n?: string) => (n || '?').trim().charAt(0).toUpperCase();
const fieldSx = {
  '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
};

export default function AudioReviewInvitePage() {
  const { token } = useParams() as { token?: string };
  const [loading, setLoading] = React.useState(true);
  const [invite, setInvite] = React.useState<any>(null);
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', role: '', instrument: '', email: '', phone: '', bio: '', avatarUrl: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  React.useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiRequest(`/api/audio-review-invite/${token}`).then((d: any) => {
      setInvite(d);
      setForm((f) => ({ ...f, name: d.name || '', role: d.role || '', instrument: d.instrument || '', email: d.email || '', phone: d.phone || '', bio: d.bio || '', avatarUrl: d.avatar_url || '' }));
      if (d.invite_status === 'active' || d.profile_completed_at) setDone(true);
    }).catch(() => setInvite(null)).finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try { await apiRequest(`/api/audio-review-invite/${token}`, { method: 'POST', body: form }); setDone(true); }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  if (loading) return <Box sx={{ bgcolor: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  if (!invite) return <Box sx={{ bgcolor: BG, minHeight: '100vh', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>Denne invitasjonslenken er ugyldig eller utløpt.</Box>;

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100vh', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, md: 3 } }}>
      <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '18px', p: { xs: 2.5, md: 4 }, maxWidth: 520, width: '100%' }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: '9px', bgcolor: 'rgba(255,107,53,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MusicNote sx={{ color: ACCENT, fontSize: 20 }} /></Box>
          <Typography sx={{ fontSize: '0.78rem', letterSpacing: 1, color: MUTED, textTransform: 'uppercase' }}>Mix/master-review</Typography>
        </Stack>

        {done ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 3, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 48, color: '#5fb88a' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.3rem' }}>Profilen din er lagret</Typography>
            <Typography sx={{ color: MUTED }}>Takk, {form.name.split(' ')[0]}! Du er nå med som bidragsyter på «{invite.project_title}». Produsenten ser profilen din i review-rommet.</Typography>
          </Stack>
        ) : (
          <>
            <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.15 }}>{invite.inviter_name || 'Produsenten'} inviterer deg</Typography>
            <Typography sx={{ color: MUTED, mb: 2.5 }}>til å samarbeide på <strong style={{ color: TEXT }}>«{invite.project_title}»</strong>{invite.band_name ? ` (${invite.band_name})` : ''}. Fyll ut profilen din så alle vet hvem som bidrar.</Typography>

            <Stack alignItems="center" sx={{ mb: 2 }}>
              <ImageDrop variant="circle" size={88} value={form.avatarUrl} onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))} label="Profilbilde — slipp eller velg bilde" />
            </Stack>

            <Stack spacing={1.5}>
              <TextField label="Navn" value={form.name} onChange={set('name')} size="small" required sx={fieldSx} />
              <Stack direction="row" spacing={1.5}>
                <TextField label="Rolle (f.eks. Vokalist)" value={form.role} onChange={set('role')} size="small" fullWidth sx={fieldSx} />
                <TextField label="Instrument" value={form.instrument} onChange={set('instrument')} size="small" fullWidth sx={fieldSx} />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField label="E-post" value={form.email} onChange={set('email')} size="small" fullWidth sx={fieldSx} />
                <TextField label="Telefon (valgfritt)" value={form.phone} onChange={set('phone')} size="small" fullWidth sx={fieldSx} />
              </Stack>
              <TextField label="Kort om deg (valgfritt)" value={form.bio} onChange={set('bio')} size="small" multiline minRows={2} sx={fieldSx} />
              <Button onClick={submit} disabled={busy || !form.name.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', py: 1 }}>{busy ? 'Lagrer…' : 'Lagre profil'}</Button>
              <Typography sx={{ fontSize: '0.7rem', color: MUTED, textAlign: 'center' }}>Profilen knyttes også til splittark (royalty) for låten.</Typography>
            </Stack>
          </>
        )}
      </Box>
    </Box>
  );
}
