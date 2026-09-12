/**
 * YouTubePublishPanel — publiser release som video til YouTube rett fra studioet.
 * Gjenbruker eksisterende Google/YouTube-tilkobling (/api/youtube/status). Lager
 * visualizer eller lyric-video (beat-synket karaoke via tap-to-time, ellers scroll).
 * Guider produsenten til en optimalisert YouTube-kanal hvis den ikke er klar.
 */
import React from 'react';
import {
  Box, Stack, Typography, Button, TextField, Switch, FormControlLabel, CircularProgress, Chip, Link,
} from '@mui/material';
import { CheckCircle, OpenInNew, GraphicEq, Lyrics, TouchApp } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import LyricTimingDialog from './LyricTimingDialog';
import { YouTubeIcon, YOUTUBE_RED } from './BrandIcons';

const BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.38)', ACCENT = '#FF6B35', YT = YOUTUBE_RED, GREEN = '#5fb88a';
const fieldSx = { '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED }, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } };

type Step = { n: number; title: string; detail: string; link?: string; linkLabel?: string };
const CHANNEL_STEPS: Step[] = [
  { n: 1, title: 'Opprett en YouTube-kanal', detail: 'Logg inn med Google-kontoen din og lag en kanal med artist-/bandnavnet (ikke bare en Google-konto).', link: 'https://www.youtube.com/channel_switcher', linkLabel: 'Opprett kanal' },
  { n: 2, title: 'Verifiser kanalen', detail: 'Verifiser med telefon — låser opp opplasting > 15 min, egne thumbnails og flere funksjoner.', link: 'https://www.youtube.com/verify', linkLabel: 'Verifiser' },
  { n: 3, title: 'Tilpass kanalen i YouTube Studio', detail: 'Profilbilde 800×800 + banner 2048×1152 i samme stil som coveret, «Om»-tekst, lenker (Spotify/IG/nettside), språk og kategori Musikk.', link: 'https://studio.youtube.com', linkLabel: 'Åpne Studio' },
  { n: 4, title: 'Koble til CreatorHub', detail: 'Koble Google/YouTube i Innstillinger → Integrasjoner med opplastingstilgang, så kan du publisere herfra.' },
  { n: 5, title: '«Official Artist Channel» (senere)', detail: 'Be distributøren koble sporene til en offisiell artistkanal når musikken er live på YouTube Music.' },
];

const YouTubePublishPanel: React.FC<{ releaseId: string; projectId: string; masterUrl?: string }> = ({ releaseId, projectId, masterUrl }) => {
  const [status, setStatus] = React.useState<any>(null);
  const [opts, setOpts] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [privacy, setPrivacy] = React.useState<'private' | 'unlisted' | 'public'>('private');
  const [includeLyrics, setIncludeLyrics] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [err, setErr] = React.useState('');
  const [timingOpen, setTimingOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [st, op] = await Promise.all([
        apiRequest('/api/youtube/status').catch(() => null),
        apiRequest(`/api/releases/${releaseId}/youtube/options`).catch(() => null),
      ]);
      setStatus(st); setOpts(op);
      if (op?.suggestedTitle && !title) setTitle(op.suggestedTitle);
    } finally { setLoading(false); }
  }, [releaseId, title]);
  React.useEffect(() => { void load(); }, [load]);

  const ready = !!opts?.available && status?.connected && (!status?.missingScopes || status.missingScopes.length === 0);
  const publish = async () => {
    setBusy(true); setErr(''); setResult(null);
    try {
      const r = await apiRequest(`/api/releases/${releaseId}/youtube/publish`, { method: 'POST', body: { title: title.trim(), description: description.trim(), privacy, includeLyrics: includeLyrics && opts?.hasLyrics, lyricStyle: opts?.hasTiming ? 'karaoke' : 'scroll' } });
      setResult(r);
    } catch (e: any) {
      const m = String(e?.message || '');
      setErr(m.includes('409') ? 'Ingen YouTube-tilkobling med opplastingstilgang.' : m.includes('422') ? 'Fant ikke master-lydfilen.' : 'Publisering feilet. Prøv igjen.');
    } finally { setBusy(false); }
  };

  if (loading) return <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={20} sx={{ color: YT }} /></Box>;
  if (!opts?.available) return <Typography sx={{ fontSize: '0.72rem', color: FAINT }}>YouTube-publisering er ikke konfigurert på denne installasjonen.</Typography>;

  return (
    <Box sx={{ bgcolor: 'rgba(255,0,51,0.05)', border: '1px solid rgba(255,0,51,0.25)', borderRadius: '10px', p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
        <YouTubeIcon sx={{ fontSize: 18, color: YT }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, flex: 1 }}>Publiser til YouTube</Typography>
        {status?.connected && status?.channelTitle && <Chip size="small" label={status.channelTitle} sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(95,184,138,0.16)', color: GREEN }} />}
      </Stack>

      {result ? (
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}><CheckCircle sx={{ fontSize: 18, color: GREEN }} /><Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: GREEN }}>Publisert ({result.privacy}{result.videoMode === 'karaoke' ? ' · karaoke' : result.videoMode === 'scroll' ? ' · lyric' : ''})</Typography></Stack>
          <Button component="a" href={result.url} target="_blank" startIcon={<OpenInNew />} size="small" sx={{ color: YT, textTransform: 'none', alignSelf: 'flex-start' }}>{result.url}</Button>
        </Stack>
      ) : !ready ? (
        // Ikke klar → guidet flyt: opprett + optimaliser + koble kanal.
        <Stack spacing={1}>
          <Typography sx={{ fontSize: '0.74rem', color: '#e0a955' }}>
            {status?.connected ? 'Google er koblet, men vi finner ingen YouTube-kanal med opplastingstilgang. Følg stegene for å opprette/koble en kanal.' : 'Har du ikke en YouTube-kanal ennå? Vi hjelper deg i gang — følg stegene under.'}
          </Typography>
          <Stack spacing={0.75} sx={{ mt: 0.5 }}>
            {CHANNEL_STEPS.map((st) => (
              <Stack key={st.n} direction="row" alignItems="flex-start" spacing={1}>
                <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'rgba(255,0,51,0.15)', color: YT, fontSize: '0.66rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: '1px' }}>{st.n}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.76rem', fontWeight: 700 }}>{st.title}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: MUTED, lineHeight: 1.4 }}>{st.detail}</Typography>
                  {st.link && <Link href={st.link} target="_blank" rel="noopener" sx={{ fontSize: '0.7rem', color: YT, display: 'inline-flex', alignItems: 'center', gap: 0.3, mt: 0.25 }}>{st.linkLabel} <OpenInNew sx={{ fontSize: 12 }} /></Link>}
                </Box>
              </Stack>
            ))}
          </Stack>
          <Button onClick={() => void load()} size="small" sx={{ color: MUTED, textTransform: 'none', alignSelf: 'flex-start', fontSize: '0.7rem' }}>Sjekk tilkobling på nytt</Button>
        </Stack>
      ) : (
        // Klar → publiserings-skjema.
        <Stack spacing={1.25}>
          <TextField label="Tittel" value={title} onChange={(e) => setTitle(e.target.value)} size="small" fullWidth sx={fieldSx} />
          <TextField label="Beskrivelse" value={description} onChange={(e) => setDescription(e.target.value)} size="small" fullWidth multiline minRows={2} sx={fieldSx} />
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField select SelectProps={{ native: true }} label="Synlighet" value={privacy} onChange={(e) => setPrivacy(e.target.value as any)} size="small" sx={{ width: 150, ...fieldSx }}>
              <option value="private" style={{ background: '#131316' }}>Privat</option>
              <option value="unlisted" style={{ background: '#131316' }}>Uoppført</option>
              <option value="public" style={{ background: '#131316' }}>Offentlig</option>
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: FAINT }}>
              {opts?.hasTiming ? <Lyrics sx={{ fontSize: 15, color: GREEN }} /> : <GraphicEq sx={{ fontSize: 15 }} />}
              <Typography sx={{ fontSize: '0.66rem' }}>{!opts?.hasLyrics ? 'visualizer' : opts?.hasTiming ? 'beat-synket karaoke' : 'rull (ikke tidssatt)'}</Typography>
            </Stack>
          </Stack>
          {opts?.hasLyrics && (
            <Stack spacing={0.5}>
              <FormControlLabel control={<Switch checked={includeLyrics} onChange={(e) => setIncludeLyrics(e.target.checked)} sx={{ '& .Mui-checked': { color: ACCENT } }} />}
                label={<Typography sx={{ fontSize: '0.78rem' }}>Inkluder sangtekst i videoen</Typography>} />
              {includeLyrics && (
                <Button onClick={() => setTimingOpen(true)} startIcon={<TouchApp sx={{ fontSize: '15px !important' }} />} size="small" sx={{ color: ACCENT, textTransform: 'none', alignSelf: 'flex-start', fontSize: '0.72rem' }}>
                  {opts?.hasTiming ? 'Juster timing (tap-to-time)' : 'Tidssett tekst for beat-synket karaoke'}
                </Button>
              )}
            </Stack>
          )}
          {err && <Typography sx={{ fontSize: '0.72rem', color: '#e0606a' }}>{err}</Typography>}
          <Button onClick={publish} disabled={busy || !title.trim()} startIcon={busy ? <CircularProgress size={15} sx={{ color: '#fff' }} /> : <YouTubeIcon />} variant="contained"
            sx={{ bgcolor: YT, color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: '999px', alignSelf: 'flex-start', px: 3, '&:hover': { bgcolor: '#e60030' } }}>
            {busy ? 'Lager video + laster opp…' : 'Publiser til YouTube'}
          </Button>
          <Typography sx={{ fontSize: '0.62rem', color: FAINT }}>Videoen genereres (cover + master{includeLyrics && opts?.hasLyrics ? ' + sangtekst' : ''}) og lastes opp til kanalen din. Kan ta et minutt.</Typography>
        </Stack>
      )}

      <LyricTimingDialog open={timingOpen} projectId={projectId} masterUrl={masterUrl} onClose={() => setTimingOpen(false)} onSaved={() => { setTimingOpen(false); void load(); }} />
    </Box>
  );
};

export default YouTubePublishPanel;
