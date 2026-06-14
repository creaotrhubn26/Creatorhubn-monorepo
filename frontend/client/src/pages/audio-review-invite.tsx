/**
 * audio-review-invite.tsx — offentlig invitasjons-/profil-side.
 * En bidragsyter mottar lenken (/audio-review/invite/:token), ser hvem som
 * inviterte + hvilket prosjekt, og fyller ut profilen sin (inkl. profilbilde).
 * Ingen innlogging kreves — tokenet er tilgangen.
 */
import React from 'react';
import { useParams } from 'wouter';
import {
  Box, Stack, Typography, Button, TextField, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import { MusicNote, CheckCircle, ContentCopy, DoneAll, GraphicEq } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import ImageDrop from '@/components/universal/showcase/ImageDrop';
import ComboField, { MultiComboField, ROLE_OPTIONS, INSTRUMENT_OPTIONS, CONTRIBUTION_OPTIONS } from '@/components/universal/showcase/ComboField';
import SpotifyArtistField from '@/components/universal/showcase/SpotifyArtistField';
import { audioShowcaseEvents } from '@/utils/creatorhub-events';

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
  const [form, setForm] = React.useState<any>({ name: '', role: '', instrument: '', email: '', phone: '', bio: '', avatarUrl: '', easeverseAccess: false, links: {} as Record<string, string>, contributions: [] as string[] });
  const [hp, setHp] = React.useState(''); // honeypot (skjult) — bot-beskyttelse
  const setLink = (k: string, v: string) => setForm((f: any) => ({ ...f, links: { ...f.links, [k]: v } }));
  const [copied, setCopied] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setV = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const isVocalist = /vokal/i.test(form.role);
  const boothUrl = invite?.external_track_id ? `https://easeverse.vercel.app/booth/${invite.external_track_id}` : '';

  React.useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiRequest(`/api/audio-review-invite/${token}`).then((d: any) => {
      setInvite(d);
      setForm((f: any) => ({ ...f, name: d.name || '', role: d.role || '', instrument: d.instrument || '', email: d.email || '', phone: d.phone || '', bio: d.bio || '', avatarUrl: d.avatar_url || '', easeverseAccess: Boolean(d.easeverse_access), links: (d.links && !Array.isArray(d.links)) ? d.links : {}, contributions: Array.isArray(d.contributions) ? d.contributions : [] }));
      if (d.invite_status === 'active' || d.profile_completed_at) setDone(true);
    }).catch(() => setInvite(null)).finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/api/audio-review-invite/${token}`, { method: 'POST', body: { ...form, company_website: hp } });
      audioShowcaseEvents.profileCompleted({ isVocalist: /vokal/i.test(form.role || ''), hasAvatar: !!form.avatarUrl });
      setDone(true);
    } catch { /* ignore */ } finally { setBusy(false); }
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
                <ComboField label="Rolle" options={ROLE_OPTIONS} value={form.role} onChange={(v) => setV('role', v)} />
                <ComboField label="Instrument" options={INSTRUMENT_OPTIONS} value={form.instrument} onChange={(v) => setV('instrument', v)} />
              </Stack>
              <MultiComboField label="Bidrag (hva gjorde du?)" options={CONTRIBUTION_OPTIONS} value={form.contributions} onChange={(v) => setV('contributions', v)} />
              {isVocalist && (
                <Box sx={{ border: `1px solid rgba(255,107,53,0.4)`, borderRadius: '12px', p: 1.5, bgcolor: 'rgba(255,107,53,0.07)' }}>
                  <FormControlLabel
                    control={<Switch checked={form.easeverseAccess} onChange={(e) => setV('easeverseAccess', e.target.checked)} sx={{ '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${ACCENT} !important` } }} />}
                    label={<Stack direction="row" spacing={0.75} alignItems="center"><GraphicEq sx={{ fontSize: 17, color: ACCENT }} /><Typography sx={{ fontSize: '0.85rem', color: TEXT }}>Gi tilgang til EaseVerse (vokalopptak)</Typography></Stack>} />
                  {form.easeverseAccess && boothUrl && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '8px', p: 0.75 }}>
                      <Typography sx={{ flex: 1, fontSize: '0.7rem', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{boothUrl}</Typography>
                      <Button size="small" startIcon={copied ? <DoneAll /> : <ContentCopy />} onClick={() => { void navigator.clipboard.writeText(boothUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} sx={{ color: ACCENT, textTransform: 'none', minWidth: 0 }}>{copied ? 'Kopiert' : 'Booth'}</Button>
                    </Stack>
                  )}
                  <Typography sx={{ fontSize: '0.68rem', color: MUTED, mt: 0.5 }}>Du kan ta opp vokalen i EaseVerse — takene kommer rett inn som versjoner.</Typography>
                </Box>
              )}
              <Stack direction="row" spacing={1.5}>
                <TextField label="E-post" value={form.email} onChange={set('email')} size="small" fullWidth sx={fieldSx} />
                <TextField label="Telefon (valgfritt)" value={form.phone} onChange={set('phone')} size="small" fullWidth sx={fieldSx} />
              </Stack>
              <TextField label="Kort om deg (valgfritt)" value={form.bio} onChange={set('bio')} size="small" multiline minRows={2} sx={fieldSx} />
              <Typography sx={{ fontSize: '0.7rem', letterSpacing: 1, color: MUTED, textTransform: 'uppercase', mt: 0.5 }}>Sosiale kontoer</Typography>
              <Stack direction="row" spacing={1.5}>
                <TextField label="Instagram" value={form.links.instagram || ''} onChange={(e) => setLink('instagram', e.target.value)} size="small" fullWidth sx={fieldSx} placeholder="@bruker" />
                <TextField label="TikTok" value={form.links.tiktok || ''} onChange={(e) => setLink('tiktok', e.target.value)} size="small" fullWidth sx={fieldSx} placeholder="@bruker" />
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <SpotifyArtistField value={form.links.spotify || ''} onChange={(v) => setLink('spotify', v)} fieldSx={fieldSx}
                  onPick={(a) => { audioShowcaseEvents.spotifyArtistLinked('invite'); if (!form.avatarUrl && a.image) setForm((f: any) => ({ ...f, avatarUrl: a.image })); }} />
                <TextField label="YouTube" value={form.links.youtube || ''} onChange={(e) => setLink('youtube', e.target.value)} size="small" fullWidth sx={fieldSx} placeholder="kanal-lenke" />
              </Stack>
              {/* Honeypot — skjult for mennesker, fanger bots */}
              <input type="text" name="company_website" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
              <Button onClick={submit} disabled={busy || !form.name.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', py: 1 }}>{busy ? 'Lagrer…' : 'Lagre profil'}</Button>
              <Typography sx={{ fontSize: '0.66rem', color: MUTED, textAlign: 'center', lineHeight: 1.45 }}>Profilen knyttes til splittark (royalty) for låten. Vi lagrer opplysningene du oppgir for å administrere samarbeidet (GDPR art. 6(1)(b)). Du kan be om innsyn eller sletting når som helst.</Typography>
            </Stack>
          </>
        )}
      </Box>
    </Box>
  );
}
