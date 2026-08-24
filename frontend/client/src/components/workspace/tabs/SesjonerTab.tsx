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
import SelfImprovement from '@mui/icons-material/SelfImprovement';
import Delete from '@mui/icons-material/Delete';
import { apiRequest } from '@/lib/queryClient';
import { useTeamAccess } from '@/hooks/useTeamAccess';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsStat, WsSectionTitle, wsAlert, wsConfirm } from '../ui';
import WarmupDialog from '../../universal/showcase/WarmupDialog';

const TYPE: Record<string, string> = { recording: 'Opptak', mixing: 'Miksing', mastering: 'Mastering', collaboration: 'Samarbeid' };
const WARMUP_TARGET: Record<string, string> = { all: 'Alle', vocalist: 'Vokal', instrument: 'Instrument' };

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
  const { hasTeamAccess } = useTeamAccess(); // band/samarbeid er Enterprise-gated
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [audioRoomId, setAudioRoomId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  // Oppvarming & fokus (EaseVerse mindfulness) + Bandets form — eier-gatet;
  // 404 for ikke-eiere → seksjonene skjules stille.
  const [warmups, setWarmups] = useState<any[] | null>(null);
  const [moods, setMoods] = useState<any[]>([]);
  const [bandSize, setBandSize] = useState(0);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const loadWellbeing = (arId: string) => {
    apiRequest(`/api/audio-showcases/${encodeURIComponent(arId)}/warmups`)
      .then((r: any) => setWarmups(Array.isArray(r?.routines) ? r.routines : []))
      .catch(() => setWarmups(null));
    apiRequest(`/api/audio-showcases/${encodeURIComponent(arId)}/mood`)
      .then((r: any) => setMoods(Array.isArray(r?.moods) ? r.moods : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room/members`)
      .then((r: any) => setBandSize(Array.isArray(r?.members) ? r.members.length : 0))
      .catch(() => {});
  };

  const loadMeetings = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/avtaler`)
      .then((r: any) => setMeetings(Array.isArray(r?.meetings) ? r.meetings : []))
      .catch(() => {});
  };
  useEffect(() => {
    if (!isReal) { setSessions([]); setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/recording-sessions?include=details`)
      .then((r: any) => {
        setSessions(Array.isArray(r?.sessions) ? r.sessions : []);
        if (r?.audioRoomId) { setAudioRoomId(r.audioRoomId); loadWellbeing(r.audioRoomId); }
      })
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

      {/* Oppvarming & fokus (EaseVerse mindfulness) + Bandets form — band/samarbeid
          er en Enterprise-funksjon (hasTeamAccess). Ellers eier-gatet på endepunkt-
          nivå (404 → warmups=null). Individuelle uten team ser ikke band-seksjonen. */}
      {hasTeamAccess && audioRoomId && warmups !== null && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="stretch">
          <WsCard sx={{ flex: 1, minWidth: 0 }}>
            <WsSectionTitle
              icon={<SelfImprovement sx={{ fontSize: 18, color: ws.textDim }} />}
              title="Oppvarming & fokus"
              action={
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => setRemindOpen(true)} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 600 }}>Påminn bandet</Button>
                  <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={() => setWarmupOpen(true)} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>Ny rutine</Button>
                </Stack>
              }
            />
            {warmups.length === 0 ? (
              <Stack alignItems="center" sx={{ py: 2.5 }} spacing={0.75}>
                <SelfImprovement sx={{ fontSize: 28, color: ws.textFaint }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Ingen rutiner ennå</Typography>
                <Typography sx={{ fontSize: 11.5, color: ws.textDim, textAlign: 'center', maxWidth: 380 }}>
                  Sett opp vokal-, puste- og mindfulness-rutiner fra EaseVerse-biblioteket — bandet kjører dem guidet før opptak og markerer fullført.
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={0.75}>
                {warmups.map((w: any) => (
                  <Stack key={w.id} direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <SelfImprovement sx={{ color: ws.accent, fontSize: 18 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>{w.title}</Typography>
                        <WsTag label={WARMUP_TARGET[w.target] || w.target || 'Alle'} tone="accent" />
                      </Stack>
                      <Typography sx={{ fontSize: 11, color: ws.textFaint }}>
                        {(Array.isArray(w.steps) ? w.steps.length : 0)} steg
                        {w.completions?.length ? ` · fullført av ${w.completions.map((c: any) => c.name).join(', ')}` : ' · ingen har fullført ennå'}
                      </Typography>
                    </Box>
                    <WsTag label={`${w.completions?.length || 0}${bandSize ? `/${bandSize}` : ''} ✓`} tone={w.completions?.length ? 'green' : 'neutral'} />
                    <Button size="small" onClick={async () => { if (!await wsConfirm(`Slette rutinen «${w.title}»?`)) return; try { await apiRequest(`/api/warmups/${encodeURIComponent(w.id)}`, { method: 'DELETE' }); loadWellbeing(audioRoomId); } catch { /* stille */ } }}
                      sx={{ minWidth: 0, color: ws.textFaint, '&:hover': { color: ws.red } }}><Delete sx={{ fontSize: 16 }} /></Button>
                  </Stack>
                ))}
              </Stack>
            )}
          </WsCard>

          <WsCard sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
            <WsSectionTitle title="Bandets form" />
            {moods.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>Ingen innsjekk ennå — bandet melder form fra invitasjonslenken sin før økten.</Typography>
            ) : (
              <Stack spacing={0.75}>
                {moods.map((m: any) => (
                  <Stack key={m.member_name} direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{m.member_name}</Typography>
                    <WsTag label={m.mood} tone="blue" />
                  </Stack>
                ))}
              </Stack>
            )}
          </WsCard>
        </Stack>
      )}

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

      <PlanSessionDialog open={planOpen} onClose={() => setPlanOpen(false)} projectId={projectId} audioRoomId={audioRoomId} onCreated={() => { setPlanOpen(false); loadMeetings(); }} />
      {audioRoomId && <WarmupDialog open={warmupOpen} projectId={audioRoomId} onClose={() => { setWarmupOpen(false); loadWellbeing(audioRoomId); }} />}
      {audioRoomId && <RemindBandDialog open={remindOpen} onClose={() => setRemindOpen(false)} audioRoomId={audioRoomId} nextSession={nextSession} />}
    </Box>
  );
};

/**
 * «Påminn bandet» — manuell påminnelse fra produsenten (POST
 * /api/audio-showcases/:id/remind): egen melding, valgfritt kun til de som
 * ikke har varmet opp. E-post + SMS der telefon finnes; hvert medlem får
 * sin delte lenke (oppvarming & innsjekk). De automatiske 24t-/1t-
 * påminnelsene for økter i økt-kalenderen går i tillegg, via cron.
 */
const RemindBandDialog: React.FC<{ open: boolean; onClose: () => void; audioRoomId: string; nextSession: any | null }> = ({ open, onClose, audioRoomId, nextSession }) => {
  const defaultMsg = nextSession?.scheduledAt
    ? `Husk oppvarming og øving før «${nextSession.title || 'Studio-økt'}» ${fmtDateTime(nextSession.scheduledAt)} 🎶`
    : 'Husk oppvarming og øving før neste økt 🎶';
  const [message, setMessage] = useState(defaultMsg);
  const [target, setTarget] = useState('all');
  const [onlyNotWarmed, setOnlyNotWarmed] = useState(false);
  // Tidspunkt: 'now' = umiddelbart; 'scheduled' = leveres av cronen (hver
  // halvtime) på valgt tidspunkt — vises og kan avbrytes i listen under.
  const [whenMode, setWhenMode] = useState<'now' | 'scheduled'>('now');
  const [sendAt, setSendAt] = useState('');
  const [planned, setPlanned] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlanned = () => {
    apiRequest(`/api/audio-showcases/${encodeURIComponent(audioRoomId)}/reminders`)
      .then((r: any) => setPlanned(Array.isArray(r?.reminders) ? r.reminders : []))
      .catch(() => {});
  };
  useEffect(() => {
    if (open) { setMessage(defaultMsg); setError(null); setWhenMode('now'); setSendAt(''); loadPlanned(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    if (!message.trim()) { setError('Skriv en melding'); return; }
    if (whenMode === 'scheduled' && !sendAt) { setError('Velg tidspunkt'); return; }
    setBusy(true); setError(null);
    try {
      const r: any = await apiRequest(`/api/audio-showcases/${encodeURIComponent(audioRoomId)}/remind`, {
        method: 'POST',
        body: {
          message: message.trim(), target, onlyNotWarmed,
          ...(whenMode === 'scheduled' ? { sendAt: new Date(sendAt).toISOString() } : {}),
        },
      });
      if (r?.scheduled) {
        wsAlert(`Påminnelsen er planlagt til ${fmtDateTime(r.sendAt)} (leveres innen ~30 min etter tidspunktet).`);
        loadPlanned(); setWhenMode('now'); setSendAt('');
      } else {
        wsAlert(`Påminnelse sendt til ${r?.recipients ?? 0} medlem(mer) — ${r?.emails ?? 0} e-post${r?.sms ? `, ${r.sms} SMS` : ''}.`);
        onClose();
      }
    } catch (e: any) { setError(e?.message || 'Kunne ikke sende påminnelsen'); } finally { setBusy(false); }
  };

  const cancelPlanned = async (rid: string) => {
    try { await apiRequest(`/api/audio-reminders/${encodeURIComponent(rid)}`, { method: 'DELETE' }); loadPlanned(); }
    catch { /* stille */ }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Påminn bandet</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Melding" value={message} onChange={(e) => setMessage(e.target.value)} fullWidth size="small" multiline minRows={3} />
          <TextField select label="Målgruppe" value={target} onChange={(e) => setTarget(e.target.value)} fullWidth size="small"
            helperText="Vokalist/instrument matches på medlemmets rolle i bandet">
            <MenuItem value="all">Hele bandet</MenuItem>
            <MenuItem value="vocalist">Kun vokalist(er)</MenuItem>
            <MenuItem value="instrument">Kun instrumentalister</MenuItem>
          </TextField>
          <FormControlLabel control={<Checkbox checked={onlyNotWarmed} onChange={(e) => setOnlyNotWarmed(e.target.checked)} size="small" />} label="Kun til de som ikke har varmet opp ennå" />
          <TextField select label="Når" value={whenMode} onChange={(e) => setWhenMode(e.target.value as any)} fullWidth size="small">
            <MenuItem value="now">Send nå</MenuItem>
            <MenuItem value="scheduled">Planlegg tidspunkt</MenuItem>
          </TextField>
          {whenMode === 'scheduled' && (
            <TextField label="Sendes" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} fullWidth size="small"
              InputLabelProps={{ shrink: true }} helperText="Leveres innen ~30 min etter valgt tidspunkt" />
          )}
          <Typography variant="caption" color="text.secondary">Sendes på e-post (og SMS der telefonnummer finnes) med hvert medlems lenke til oppvarming og innsjekk. Økter i økt-kalenderen får i tillegg automatiske påminnelser 24 timer og 1 time før.</Typography>
          {planned.filter((r) => !r.sent_at).length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>Planlagte påminnelser</Typography>
              <Stack spacing={0.5}>
                {planned.filter((r) => !r.sent_at).map((r) => (
                  <Stack key={r.id} direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(r.send_at)} — {r.message}
                    </Typography>
                    <Button size="small" onClick={() => cancelPlanned(r.id)} sx={{ minWidth: 0, fontSize: 11, textTransform: 'none' }}>Avbryt</Button>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Avbryt</Button>
        <Button variant="contained" onClick={send} disabled={busy || !message.trim() || (whenMode === 'scheduled' && !sendAt)} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>{busy ? 'Sender…' : whenMode === 'scheduled' ? 'Planlegg påminnelse' : 'Send påminnelse'}</Button>
      </DialogActions>
    </Dialog>
  );
};

const PlanSessionDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; audioRoomId?: string | null; onCreated: () => void }> = ({ open, onClose, projectId, audioRoomId, onCreated }) => {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(120);
  const [location, setLocation] = useState('');
  const [withMeet, setWithMeet] = useState(false);
  // Innkalling via økt-kalenderen: bandet får e-post m/ RSVP + .ics, og de
  // automatiske 24t-/1t-påminnelsene («Husk oppvarming før økta») fra cronen.
  const [inviteBand, setInviteBand] = useState(true);
  const [inviteTarget, setInviteTarget] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!when) { setError('Velg dato og tid'); return; }
    setBusy(true); setError(null);
    try {
      const startIso = new Date(when).toISOString();
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/meetings`, {
        method: 'POST',
        body: {
          title: title.trim() || 'Studio-økt',
          scheduledAt: startIso,
          durationMinutes: duration,
          location: location.trim() || null,
          generateMeet: withMeet,
        },
      });
      // Speil økten inn i økt-kalenderen → innkalling + automatiske påminnelser.
      if (inviteBand && audioRoomId) {
        await apiRequest(`/api/audio-showcases/${encodeURIComponent(audioRoomId)}/sessions`, {
          method: 'POST',
          body: {
            title: title.trim() || 'Studio-økt',
            startAt: startIso,
            endAt: new Date(new Date(when).getTime() + duration * 60000).toISOString(),
            location: location.trim() || null,
            kind: 'opptak',
            target: inviteTarget,
          },
        }).catch(() => { /* meetings-avtalen står — innkallingen er best-effort */ });
      }
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
          {audioRoomId && (
            <>
              <FormControlLabel control={<Checkbox checked={inviteBand} onChange={(e) => setInviteBand(e.target.checked)} size="small" />}
                label="Send innkalling (RSVP + automatiske påminnelser 24 t og 1 t før)" />
              {inviteBand && (
                <TextField select label="Innkalling til" value={inviteTarget} onChange={(e) => setInviteTarget(e.target.value)} fullWidth size="small">
                  <MenuItem value="all">Hele bandet</MenuItem>
                  <MenuItem value="vocalist">Kun vokalist(er)</MenuItem>
                  <MenuItem value="instrument">Kun instrumentalister</MenuItem>
                </TextField>
              )}
            </>
          )}
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
