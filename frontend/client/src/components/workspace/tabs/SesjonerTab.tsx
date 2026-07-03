// @ts-nocheck
/**
 * SesjonerTab («Sesjoner») — musikkprodusentens ekvivalent til Produksjonskart.
 * To flater: (1) innspillings-/miks-sesjoner fra Pro Tools Companion med
 * markører (låt-seksjoner), bounces (→ review-versjoner) og live playhead —
 * /api/projects/:id/recording-sessions?include=details; (2) «Planlagte
 * studio-økter» — planlegging via de eksisterende avtale-endepunktene
 * (GET /avtaler + POST /meetings, med valgfri Google Meet-lenke).
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Checkbox, FormControlLabel, Alert } from '@mui/material';
import { useLocation } from 'wouter';
import Album from '@mui/icons-material/Album';
import GraphicEq from '@mui/icons-material/GraphicEq';
import Flag from '@mui/icons-material/Flag';
import Event from '@mui/icons-material/Event';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import Add from '@mui/icons-material/Add';
import Videocam from '@mui/icons-material/Videocam';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsStat, WsSectionTitle } from '../ui';

const TYPE: Record<string, string> = { recording: 'Opptak', mixing: 'Miksing', mastering: 'Mastering', collaboration: 'Samarbeid' };

const fmtSec = (s: any) => {
  const n = Number(s); if (!Number.isFinite(n) || n < 0) return '0:00';
  return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
};
const fmtDateTime = (iso: any) => {
  if (!iso) return '';
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
};

const SesjonerTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const loadMeetings = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/avtaler`)
      .then((r: any) => setMeetings(Array.isArray(r?.meetings) ? r.meetings : []))
      .catch(() => {});
  };
  useEffect(() => {
    if (!isReal) { setSessions([]); setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/recording-sessions?include=details`)
      .then((r: any) => setSessions(Array.isArray(r?.sessions) ? r.sessions : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
    loadMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isReal]);

  const list = sessions || [];
  const totalMarkers = list.reduce((s, x) => s + (Number(x.marker_count) || 0), 0);
  const totalBounces = list.reduce((s, x) => s + (Number(x.bounce_count) || 0), 0);
  const upcoming = meetings.filter((m) => m.scheduledAt && new Date(m.scheduledAt) >= new Date(Date.now() - 36e5)).slice(0, 10);
  const nextSession = upcoming[0] || null;
  const openSoundRoom = () => navigate(`/workspace/${projectId}/sound-room`);
  const fmtNum = (n: any) => (n == null ? '—' : Number(n));

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Sesjoner</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Innspillings- og miks-sesjoner fra Pro Tools Companion, koblet til prosjektets Sound Room. Markører blir låt-seksjoner og bounces blir review-versjoner.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<GraphicEq sx={{ fontSize: 17 }} />} onClick={openSoundRoom} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 700 }}>Sound Room</Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <WsStat icon={<Album sx={{ fontSize: 20 }} />} label="Sesjoner" value={list.length} sub="fra Pro Tools" tone={ws.accentSoft} />
        <WsStat icon={<Flag sx={{ fontSize: 20 }} />} label="Markører" value={totalMarkers} sub="låt-seksjoner" tone={ws.amberSoft} />
        <WsStat icon={<GraphicEq sx={{ fontSize: 20 }} />} label="Bounces" value={totalBounces} sub="review-versjoner" tone={ws.greenSoft} />
        <WsStat icon={<Event sx={{ fontSize: 20 }} />} label="Neste økt" value={nextSession ? fmtDateTime(nextSession.scheduledAt).split(' ').slice(0, 3).join(' ') : '—'} sub={nextSession ? (nextSession.title || 'Studio-økt') : 'ingen planlagt'} tone={ws.blueSoft} />
      </Box>

      {/* Pro Tools-sesjoner */}
      <WsCard sx={{ mb: 2 }}>
        <WsSectionTitle icon={<Album sx={{ fontSize: 18, color: ws.textDim }} />} title="Fra Pro Tools Companion" />
        {list.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
            <Album sx={{ fontSize: 36, color: ws.textFaint }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Ingen sesjoner ennå</Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 440 }}>Last ned <b>Pro Tools Companion</b> i Sound Room og koble den til. Når du jobber i Pro Tools dukker sesjonene opp her — med markører (låt-seksjoner) og bounces (versjoner) automatisk.</Typography>
            <Button variant="contained" onClick={openSoundRoom} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne Sound Room</Button>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {list.map((s: any) => {
              const open = expanded === s.id;
              const hasDetails = (s.markers && s.markers.length > 0) || (s.bounces && s.bounces.length > 0);
              return (
                <Box key={s.id} sx={{ borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${open ? ws.accentBorder : ws.borderSoft}` }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} onClick={() => setExpanded(open ? null : s.id)}
                    sx={{ p: 1.5, cursor: hasDetails ? 'pointer' : 'default' }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Album sx={{ color: ws.accent, fontSize: 22 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{s.name || 'Sesjon'}</Typography>
                        <WsTag label={TYPE[s.session_type] || s.session_type || 'Sesjon'} tone="accent" />
                        {s.playhead?.timecode && <WsTag label={`▶ ${s.playhead.timecode}`} tone="amber" />}
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>
                        {s.tempo ? `${fmtNum(s.tempo)} BPM · ` : ''}{s.key_signature ? `${s.key_signature} · ` : ''}{s.track_count ? `${s.track_count} spor · ` : ''}{s.sample_rate ? `${Math.round(s.sample_rate / 1000)}kHz/${s.bit_depth || 24}-bit` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                      <Stack alignItems="center" spacing={0.25}>
                        <Stack direction="row" spacing={0.5} alignItems="center"><Flag sx={{ fontSize: 14, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{s.marker_count || 0}</Typography></Stack>
                        <Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>markører</Typography>
                      </Stack>
                      <Stack alignItems="center" spacing={0.25}>
                        <Stack direction="row" spacing={0.5} alignItems="center"><GraphicEq sx={{ fontSize: 14, color: ws.green }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{s.bounce_count || 0}</Typography></Stack>
                        <Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>bounces</Typography>
                      </Stack>
                      <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); openSoundRoom(); }} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>Åpne</Button>
                      {hasDetails && (open ? <ExpandLess sx={{ fontSize: 20, color: ws.textDim }} /> : <ExpandMore sx={{ fontSize: 20, color: ws.textDim }} />)}
                    </Stack>
                  </Stack>

                  {/* Detaljer: markør-chips + bounce-liste */}
                  {open && hasDetails && (
                    <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, borderTop: `1px solid ${ws.borderSoft}` }}>
                      {s.markers && s.markers.length > 0 && (
                        <Box sx={{ mb: s.bounces?.length ? 1.25 : 0 }}>
                          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, mb: 0.5, mt: 0.75 }}>MARKØRER (LÅT-SEKSJONER)</Typography>
                          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                            {s.markers.map((m: any, i: number) => (
                              <Stack key={i} direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, py: 0.4, borderRadius: 1, bgcolor: ws.panelInput, border: `1px solid ${ws.borderSoft}` }}>
                                <Flag sx={{ fontSize: 12, color: m.color || ws.accent }} />
                                <Typography sx={{ fontSize: 11.5, color: ws.text, fontWeight: 600 }}>{m.name}</Typography>
                                <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{fmtSec(m.startSeconds)}</Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      )}
                      {s.bounces && s.bounces.length > 0 && (
                        <Box>
                          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, mb: 0.5, mt: 0.75 }}>SISTE BOUNCES</Typography>
                          <Stack spacing={0.5}>
                            {s.bounces.map((b: any) => (
                              <Stack key={b.id} direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.6, borderRadius: 1, bgcolor: ws.panelInput }}>
                                <GraphicEq sx={{ fontSize: 14, color: ws.green }} />
                                <Typography sx={{ fontSize: 12, color: ws.text, flex: 1, minWidth: 0 }} noWrap>{b.fileName || 'Bounce'}</Typography>
                                {b.durationSeconds ? <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{fmtSec(b.durationSeconds)}</Typography> : null}
                                {b.reviewVersionId && <WsTag label="→ versjon" tone="green" />}
                                <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{fmtDateTime(b.createdAt)}</Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </WsCard>

      {/* Planlagte studio-økter — musikkens produksjonsplan (gjenbruker avtaler/meetings) */}
      <WsCard>
        <WsSectionTitle
          icon={<Event sx={{ fontSize: 18, color: ws.textDim }} />}
          title="Planlagte studio-økter"
          action={<Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={() => setPlanOpen(true)} disabled={!isReal} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>Planlegg økt</Button>}
        />
        {upcoming.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 3.5 }} spacing={0.75}>
            <Event sx={{ fontSize: 30, color: ws.textFaint }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Ingen planlagte økter</Typography>
            <Typography sx={{ fontSize: 12, color: ws.textDim, textAlign: 'center', maxWidth: 400 }}>Planlegg neste studio-økt med tid, sted og valgfri Google Meet-lenke — den dukker også opp under Avtaler.</Typography>
          </Stack>
        ) : (
          <Stack spacing={0.75}>
            {upcoming.map((m: any) => (
              <Stack key={m.id} direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: ws.blueSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Event sx={{ color: ws.blue, fontSize: 19 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>{m.title || 'Studio-økt'}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>
                    {fmtDateTime(m.scheduledAt)}{m.durationMinutes ? ` · ${m.durationMinutes} min` : ''}{m.location ? ` · ${m.location}` : ''}
                  </Typography>
                </Box>
                {m.meetLink && (
                  <Button size="small" variant="outlined" startIcon={<Videocam sx={{ fontSize: 15 }} />} href={m.meetLink} target="_blank" rel="noreferrer"
                    sx={{ color: ws.blue, borderColor: 'rgba(96,165,250,0.4)', textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
                    Meet
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </WsCard>

      <PlanSessionDialog open={planOpen} onClose={() => setPlanOpen(false)} projectId={projectId} onCreated={() => { setPlanOpen(false); loadMeetings(); }} />
    </Box>
  );
};

const PlanSessionDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; onCreated: () => void }> = ({ open, onClose, projectId, onCreated }) => {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(120);
  const [location, setLocation] = useState('');
  const [withMeet, setWithMeet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!when) { setError('Velg dato og tid'); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/meetings`, {
        method: 'POST',
        body: {
          title: title.trim() || 'Studio-økt',
          scheduledAt: new Date(when).toISOString(),
          durationMinutes: duration,
          location: location.trim() || null,
          generateMeet: withMeet,
        },
      });
      setTitle(''); setWhen(''); setLocation(''); setWithMeet(false);
      onCreated();
    } catch (e: any) { setError(e?.message || 'Kunne ikke opprette økten'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Planlegg studio-økt</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Tittel" placeholder="F.eks. Vokal-innspilling" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" />
          <TextField label="Dato og tid" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} required />
          <TextField select label="Varighet" value={duration} onChange={(e) => setDuration(Number(e.target.value))} fullWidth size="small">
            {[60, 90, 120, 180, 240, 360, 480].map((m) => <MenuItem key={m} value={m}>{m >= 60 ? `${m / 60} t` : `${m} min`}</MenuItem>)}
          </TextField>
          <TextField label="Studio / sted" placeholder="F.eks. Studio A, Oslo" value={location} onChange={(e) => setLocation(e.target.value)} fullWidth size="small" />
          <FormControlLabel control={<Checkbox checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} size="small" />} label="Lag Google Meet-lenke (for eksterne bidragsytere)" />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Avbryt</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !when} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>{busy ? 'Oppretter…' : 'Planlegg økt'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SesjonerTab;
