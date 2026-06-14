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
  Switch, FormControlLabel, TextField,
} from '@mui/material';
import { MusicNote, CheckCircle, SubjectOutlined, FiberManualRecord, ReceiptLongOutlined, FileDownloadOutlined, LockOutlined } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import AudioReviewPlayer from '@/components/universal/showcase/AudioReviewPlayer';
import SignaturePad, { type SignatureHandle } from '@/components/universal/showcase/SignaturePad';
import { parseSongSections, SECTION_COLORS } from '@/lib/lyric-sections';
import { audioShowcaseEvents } from '@/utils/creatorhub-events';

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
  const [agreement, setAgreement] = React.useState<any>(null);
  const [sigName, setSigName] = React.useState(''); const [consent, setConsent] = React.useState(false); const [signing, setSigning] = React.useState(false);
  const [hp, setHp] = React.useState(''); // honeypot (skjult) — bot-beskyttelse
  const sigPadRef = React.useRef<SignatureHandle>(null);
  const loadAgreement = React.useCallback(() => {
    apiRequest(`/api/audio-review-shared/${token}/agreement`).then((d: any) => { setAgreement(d); if (d?.viewer?.name) setSigName(d.viewer.name); }).catch(() => setAgreement(null));
  }, [token]);
  React.useEffect(() => { if (token) loadAgreement(); }, [token, loadAgreement]);
  const sign = async () => {
    if (!sigName.trim() || !consent) return; setSigning(true);
    try {
      const sg = sigPadRef.current?.get() || null;
      await apiRequest(`/api/audio-review-shared/${token}/sign`, { method: 'POST', body: { signature: sigName.trim(), consent: true, signatureImage: sg?.dataUrl, signatureMethod: sg?.method, company_website: hp } });
      audioShowcaseEvents.splitSigned({ method: sg?.method || 'simple', by: 'party' });
      setConsent(false); loadAgreement();
    } catch { /* */ } finally { setSigning(false); }
  };

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
    const fetchDetail = () => apiRequest(`/api/audio-review-shared/${token}/version/${currentVid}`).then((d: any) => setDetail({ comments: d.comments || [], sections: d.sections || [] })).catch(() => {});
    void fetchDetail();
    const t = setInterval(() => { void fetchDetail(); }, 5000); // sanntid: live kommentarer
    return () => clearInterval(t);
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
        {agreement?.exists && agreement?.mine && (
          <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '16px', p: 2.5, mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <ReceiptLongOutlined sx={{ color: ACCENT }} /><Typography sx={{ fontWeight: 700, flex: 1 }}>Din avtale (royalty & honorar)</Typography>
              {agreement.mine.signed_at && <Chip icon={<CheckCircle sx={{ fontSize: '14px !important' }} />} label="Signert" size="small" sx={{ bgcolor: 'rgba(95,184,138,0.16)', color: '#5fb88a', '& .MuiChip-icon': { color: '#5fb88a' } }} />}
            </Stack>
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 1.5, mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Master {agreement.mine.percentage}% · Komposisjon {agreement.mine.custom_fields?.compositionPct ?? 0}%</Typography>
              {Number(agreement.mine.custom_fields?.feeAmount) > 0 && <Typography sx={{ fontSize: '0.82rem', color: TEXT }}>Honorar: {agreement.mine.custom_fields.feeAmount} {agreement.mine.custom_fields.feeCurrency}</Typography>}
              {(agreement.mine.custom_fields?.contributions || []).length > 0 && <Typography sx={{ fontSize: '0.74rem', color: MUTED, mt: 0.5 }}>Bidrag: {agreement.mine.custom_fields.contributions.join(', ')}</Typography>}
            </Box>
            {agreement.mine.signed_at ? (
              <Box sx={{ bgcolor: 'rgba(95,184,138,0.1)', border: '1px solid rgba(95,184,138,0.35)', borderRadius: '12px', p: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CheckCircle sx={{ fontSize: 20, color: '#5fb88a' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: '#5fb88a' }}>Du har allerede signert — all is good!</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: MUTED }}>Signert {new Date(agreement.mine.signed_at).toLocaleString('no-NO')}. Avtalen er bindende, og du trenger ikke gjøre noe mer.</Typography>
                  </Box>
                  <Button component="a" href={`/api/audio-review-shared/${token}/agreement.pdf`} onClick={() => audioShowcaseEvents.agreementDownloaded('party')} startIcon={<FileDownloadOutlined sx={{ fontSize: '16px !important' }} />} size="small" sx={{ color: ACCENT, textTransform: 'none', whiteSpace: 'nowrap' }}>Last ned</Button>
                </Stack>
              </Box>
            ) : (
              <Stack spacing={1.25}>
                <FormControlLabel control={<Switch checked={consent} onChange={(e) => setConsent(e.target.checked)} sx={{ '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${ACCENT} !important` } }} />}
                  label={<Typography sx={{ fontSize: '0.8rem' }}>Jeg bekrefter at fordelingen er korrekt og godkjenner avtalen som bindende.</Typography>} />
                <TextField fullWidth size="small" label="Fullt navn (juridisk)" value={sigName} onChange={(e) => setSigName(e.target.value)}
                  sx={{ '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED }, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } }} />
                <SignaturePad ref={sigPadRef} name={sigName} fieldSx={{ '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED }, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } }} />
                {/* Honeypot — skjult for mennesker, fanger bots */}
                <input type="text" name="company_website" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', p: 1 }}>
                  <LockOutlined sx={{ fontSize: 15, color: FAINT, mt: '1px' }} />
                  <Typography sx={{ fontSize: '0.68rem', color: FAINT, lineHeight: 1.45 }}>
                    Når du signerer lagrer vi navn, tidspunkt, IP-adresse og signaturbilde som bevis på avtalen (behandlingsgrunnlag: avtaleinngåelse, GDPR art. 6(1)(b)). Du får kvittering på e-post. Du kan be om innsyn eller sletting ved å kontakte produsenten.
                  </Typography>
                </Stack>
                <Button onClick={sign} disabled={signing || !sigName.trim() || !consent} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', alignSelf: 'flex-start', px: 3 }}>{signing ? 'Signerer…' : 'Signér bindende'}</Button>
              </Stack>
            )}
          </Box>
        )}
        <Typography sx={{ fontSize: '0.72rem', color: FAINT, textAlign: 'center' }}>Du ser som bidragsyter — du kan lytte, kommentere og signere din andel. Produsenten godkjenner og leverer.</Typography>
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
