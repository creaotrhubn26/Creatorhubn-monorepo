/**
 * audio-review-shared.tsx — member-visning av et review-rom (token = tilgang).
 * Bidragsyteren (f.eks. vokalist) åpner /audio-review/shared/:token, ser
 * versjoner + waveform + tekst, og kan kommentere — men ikke godkjenne/laste opp.
 * Ingen innlogging; invite-tokenet autentiserer.
 */
import React from 'react';
import { useParams } from 'wouter';
import {
  Box, Stack, Typography, Chip, CircularProgress, Button, IconButton, Dialog, DialogTitle, DialogContent, Avatar,
} from '@mui/material';
import { MusicNote, CheckCircle, SubjectOutlined, FiberManualRecord } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import AudioReviewPlayer from '@/components/universal/showcase/AudioReviewPlayer';
import { parseSongSections, SECTION_COLORS } from '@/lib/lyric-sections';

const BG = '#0A0A0B', PANEL = '#131316', PANEL2 = '#0F0F11', BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.38)', ACCENT = '#FF6B35';
const initial = (n?: string) => (n || '?').trim().charAt(0).toUpperCase();

export default function AudioReviewSharedPage() {
  const { token } = useParams() as { token?: string };
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [currentVid, setCurrentVid] = React.useState('');
  const [detail, setDetail] = React.useState<{ comments: any[]; sections: any[] }>({ comments: [], sections: [] });
  const [lyricsOpen, setLyricsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiRequest(`/api/audio-review-shared/${token}`).then((d: any) => {
      setData(d);
      const cur = (d.versions || []).find((v: any) => v.status !== 'superseded') || (d.versions || [])[(d.versions || []).length - 1];
      setCurrentVid(cur?.id || '');
    }).catch(() => setData(null)).finally(() => setLoading(false));
  }, [token]);

  React.useEffect(() => {
    if (!token || !currentVid) return;
    apiRequest(`/api/audio-review-shared/${token}/version/${currentVid}`).then((d: any) => setDetail({ comments: d.comments || [], sections: d.sections || [] })).catch(() => {});
  }, [token, currentVid]);

  const addComment = async (timecode: number, body: string, category: string) => {
    if (!currentVid || !body.trim()) return;
    const c = await apiRequest(`/api/audio-review-shared/${token}/comments`, { method: 'POST', body: { versionId: currentVid, timecodeSeconds: timecode, body, category } });
    setDetail((p) => ({ ...p, comments: [...p.comments, c] }));
  };

  if (loading) return <Box sx={{ bgcolor: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  if (!data) return <Box sx={{ bgcolor: BG, minHeight: '100vh', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>Denne review-lenken er ugyldig eller utløpt.</Box>;

  const { project, versions, viewer, easeverseTrack } = data;
  const currentVersion = versions.find((v: any) => v.id === currentVid);
  const sections = parseSongSections(easeverseTrack?.lyrics || '');

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100vh', color: TEXT }}>
      {/* Topbar */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 3, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
        <Box sx={{ width: 30, height: 30, borderRadius: '8px', bgcolor: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MusicNote sx={{ fontSize: 18, color: '#150d05' }} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }} noWrap>{project.title}</Typography>
            <Chip label={(project.status || 'draft').replace('_', ' ')} size="small" sx={{ height: 20, fontSize: '0.66rem', fontWeight: 700, textTransform: 'capitalize', color: ACCENT, bgcolor: 'transparent', border: `1px solid ${ACCENT}66` }} />
          </Stack>
          <Typography sx={{ color: MUTED, fontSize: '0.76rem' }}>{[project.band_name, project.genre, project.bpm ? `${project.bpm} BPM` : null, project.musical_key].filter(Boolean).join(' · ')}</Typography>
        </Box>
        <Chip avatar={<Avatar sx={{ bgcolor: `${ACCENT} !important`, color: '#150d05 !important', fontWeight: 700 }}>{initial(viewer?.name)}</Avatar>} label={`Du: ${viewer?.name}${viewer?.role ? ` · ${viewer.role}` : ''}`} sx={{ bgcolor: PANEL, color: TEXT, border: `1px solid ${BORDER}` }} />
      </Stack>

      <Box sx={{ maxWidth: 920, mx: 'auto', p: { xs: 1.5, md: 3 } }}>
        {/* Versjonsvelger */}
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, overflowX: 'auto', pb: 1 }}>
          {versions.map((v: any) => {
            const active = v.id === currentVid;
            return (
              <Box key={v.id} onClick={() => setCurrentVid(v.id)} sx={{ flexShrink: 0, px: 1.5, py: 1, borderRadius: '10px', cursor: 'pointer', border: `1.5px solid ${active ? ACCENT : BORDER}`, bgcolor: active ? 'rgba(255,107,53,0.08)' : 'transparent' }}>
                <Stack direction="row" alignItems="center" spacing={0.5}><Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{v.version_label}</Typography>{v.status === 'approved' && <CheckCircle sx={{ fontSize: 14, color: '#5fb88a' }} />}</Stack>
              </Box>
            );
          })}
        </Stack>

        {/* Spiller + kommentarer (AudioReviewPlayer) */}
        <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '16px', p: 2.5, mb: 2 }}>
          <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontWeight: 700, flex: 1 }}>{currentVersion ? currentVersion.version_label : 'Ingen versjon'}</Typography>
            {sections.length > 0 && <Button startIcon={<SubjectOutlined />} size="small" onClick={() => setLyricsOpen(true)} sx={{ color: ACCENT, textTransform: 'none' }}>Tekst</Button>}
          </Stack>
          {currentVersion ? (
            <AudioReviewPlayer
              src={currentVersion.file_url}
              comments={detail.comments.map((c) => ({ id: c.id, timecode: Number(c.timecode_seconds), comment: c.body, author: c.author, category: c.category }))}
              onAddComment={addComment}
              accentColor={ACCENT}
            />
          ) : <Typography sx={{ color: MUTED }}>Ingen versjon å spille ennå.</Typography>}
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: FAINT, textAlign: 'center' }}>Du ser som bidragsyter — du kan lytte og kommentere. Produsenten godkjenner og leverer.</Typography>
      </Box>

      {/* Tekst (read-only) */}
      <Dialog open={lyricsOpen} onClose={() => setLyricsOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}><SubjectOutlined sx={{ color: ACCENT }} /> Tekst · {project.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25}>
            {sections.map((s) => (
              <Box key={s.id} sx={{ borderLeft: `3px solid ${SECTION_COLORS[s.type]}`, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', p: 1.5 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: SECTION_COLORS[s.type], textTransform: 'uppercase', mb: 0.5 }}>{s.nbLabel}</Typography>
                {s.lines.map((ln, i) => <Typography key={i} sx={{ fontSize: '0.88rem', color: 'rgba(245,242,234,0.9)', lineHeight: 1.5 }}>{ln}</Typography>)}
              </Box>
            ))}
            {sections.length === 0 && <Typography sx={{ color: MUTED }}>Ingen tekst ennå.</Typography>}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
