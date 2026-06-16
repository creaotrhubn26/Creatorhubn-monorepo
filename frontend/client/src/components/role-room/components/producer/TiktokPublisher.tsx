/**
 * TiktokPublisher — publiser til TikTok (porter pub-tiktok), med en ekte
 * iPhone-mockup som device-frame (public/iphone-frame.png). Telefonen viser
 * TikTok-previewet; publiser-kontrollene (bildetekst, emneknagger, lyd,
 * tidspunkt, synlighet) ligger ved siden. «Publiser nå» kaller onPublish.
 *
 * Live TikTok-posting krever TikTok Content Posting-godkjenning; uten den
 * klargjør Agenten posten (tydelig merket).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, TextField, MenuItem, CircularProgress, LinearProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import ReplyIcon from '@mui/icons-material/Reply';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import TagIcon from '@mui/icons-material/Tag';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PublicIcon from '@mui/icons-material/Public';
import UploadIcon from '@mui/icons-material/Upload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhoneFrame from './PhoneFrame';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const TT = 'linear-gradient(135deg, #69C9D0, #EE1D52)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface TiktokPublisherProps {
  handle?: string;
  initialCaption?: string;
  videoLabel?: string;
  onPublish?: (data: { caption: string; visibility: string; scheduledAt: string | null }) => Promise<void> | void;
}

export default function TiktokPublisher({ handle = '@theroleroom', initialCaption, videoLabel = 'Bak kulissene fra castingdagen', onPublish }: TiktokPublisherProps): React.ReactElement {
  const [caption, setCaption] = React.useState(initialCaption ?? 'Bak kulissene fra castingdagen på Grünerløkka — slik finner vi de rette ansiktene før innspilling #theroleroom #casting #bakkulissene');
  const [visibility, setVisibility] = React.useState('Offentlig');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [publishing, setPublishing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [done, setDone] = React.useState(false);

  const hashtags = (caption.match(/#[\wæøåÆØÅ]+/g) || []).slice(0, 8);

  const publish = async (): Promise<void> => {
    setPublishing(true); setProgress(0); setDone(false);
    // Simulert opplastings-progresjon (ekte TikTok-posting kobles på når
    // Content Posting-tilgang er godkjent).
    const timer = setInterval(() => setProgress((p) => Math.min(95, p + 7)), 180);
    try {
      await onPublish?.({ caption, visibility, scheduledAt: scheduledAt || null });
    } finally {
      clearInterval(timer);
      setProgress(100);
      setPublishing(false);
      setDone(true);
    }
  };

  return (
    <Box sx={{
      borderRadius: 3, p: { xs: 2, md: 2.6 }, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.2)',
      background: 'radial-gradient(120% 90% at 100% -10%, rgba(110,201,208,0.12), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 2 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD }}>
          <AutoAwesomeIcon sx={{ fontSize: 17, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.7}>
            <MusicNoteIcon sx={{ fontSize: 16, color: '#69C9D0' }} />
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Publiser til TikTok</Typography>
          </Stack>
          <Typography sx={{ fontSize: 11.5, color: MUTED }}>Klar til å gå live for {handle}</Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'flex-start' }}>
        {/* Telefon-mockup */}
        <Box sx={{ mx: { xs: 'auto', md: 0 } }}>
          <PhoneFrame screenBg="linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)">
            {/* Video-flate */}
            <Box sx={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center' }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)' }}>
                <PlayArrowIcon sx={{ fontSize: 26, color: '#fff' }} />
              </Box>
              <Typography sx={{ position: 'absolute', top: 8, right: 10, fontSize: 9, color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', px: 0.6, py: 0.2, borderRadius: 1 }}>0:24</Typography>
              {/* Høyre-rail */}
              <Stack spacing={1.2} sx={{ position: 'absolute', right: 6, bottom: 56, alignItems: 'center' }}>
                {[{ i: <FavoriteBorderIcon sx={{ fontSize: 18, color: '#fff' }} />, n: '2 480' },
                  { i: <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: '#fff' }} />, n: '186' },
                  { i: <BookmarkBorderIcon sx={{ fontSize: 18, color: '#fff' }} />, n: '94' },
                  { i: <ReplyIcon sx={{ fontSize: 18, color: '#fff' }} />, n: 'Del' }].map((x, i) => (
                  <Stack key={i} alignItems="center" spacing={0.1}>{x.i}<Typography sx={{ fontSize: 7.5, color: '#fff' }}>{x.n}</Typography></Stack>
                ))}
              </Stack>
            </Box>
            {/* Bunn: handle + caption */}
            <Box sx={{ p: 1, pb: 1.4 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{handle}</Typography>
              <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.85)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{videoLabel}</Typography>
              <Stack direction="row" alignItems="center" spacing={0.4} sx={{ mt: 0.4 }}>
                <MusicNoteIcon sx={{ fontSize: 10, color: '#fff' }} />
                <Typography sx={{ fontSize: 9, color: '#fff' }}>Originallyd</Typography>
              </Stack>
            </Box>
          </PhoneFrame>
        </Box>

        {/* Publiser-kontroller */}
        <Stack spacing={1.4} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.5 }}>
              <SubtitlesIcon sx={{ fontSize: 15, color: ACCENT }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>Bildetekst</Typography>
            </Stack>
            <TextField fullWidth multiline minRows={3} value={caption} onChange={(e) => setCaption(e.target.value)} sx={fieldSx} />
          </Box>

          {hashtags.length ? (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.5 }}>
                <TagIcon sx={{ fontSize: 15, color: ACCENT }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>{hashtags.length} emneknagger</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {hashtags.map((h) => <Box key={h} sx={{ px: 0.9, py: 0.3, borderRadius: 1, bgcolor: 'rgba(105,201,208,0.14)', color: '#a5f3fc', fontSize: 11, fontWeight: 600 }}>{h}</Box>)}
              </Stack>
            </Box>
          ) : null}

          <Stack direction="row" spacing={1.2}>
            <TextField label="Tidspunkt" type="datetime-local" InputLabelProps={{ shrink: true }} size="small" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
            <TextField label="Synlighet" select size="small" value={visibility} onChange={(e) => setVisibility(e.target.value)} sx={{ ...fieldSx, width: 140 }}>
              {['Offentlig', 'Venner', 'Privat'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.6}>
            <ScheduleIcon sx={{ fontSize: 14, color: MUTED }} />
            <Typography sx={{ fontSize: 11.5, color: MUTED }}>{scheduledAt ? new Date(scheduledAt).toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Publiseres med en gang'}</Typography>
            <Box sx={{ flex: 1 }} />
            <PublicIcon sx={{ fontSize: 14, color: MUTED }} />
            <Typography sx={{ fontSize: 11.5, color: MUTED }}>{visibility}</Typography>
          </Stack>

          {publishing || done ? (
            <Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(148,163,184,0.16)', '& .MuiLinearProgress-bar': { borderRadius: 4, background: TT } }} />
              <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 0.7 }}>
                {done ? <CheckCircleIcon sx={{ fontSize: 15, color: '#34d399' }} /> : <AutoAwesomeIcon sx={{ fontSize: 14, color: ACCENT }} />}
                <Typography sx={{ fontSize: 11.5, color: MUTED }}>{done ? 'Klargjort for TikTok' : 'Agenten laster opp video og bildetekst til TikTok …'} {!done ? `${progress}%` : ''}</Typography>
              </Stack>
            </Box>
          ) : (
            <Button onClick={() => void publish()} disabled={publishing} variant="contained" disableElevation fullWidth
              startIcon={<UploadIcon />}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, py: 1.1, background: TT, color: '#fff', '&:hover': { background: TT, filter: 'brightness(1.06)' } }}>
              Publiser nå
            </Button>
          )}
          <Typography sx={{ fontSize: 10.5, color: 'rgba(226,232,240,0.4)' }}>Live TikTok-posting aktiveres når TikTok Content Posting-tilgang er godkjent.</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

const fieldSx = {
  '& .MuiOutlinedInput-root': { color: '#f5f3ff', fontSize: 13, '& fieldset': { borderColor: 'rgba(167,139,250,0.3)' } },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.6)', fontSize: 13 },
} as const;
