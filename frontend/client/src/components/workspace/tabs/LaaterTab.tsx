// @ts-nocheck
/**
 * LaaterTab («Låter») — musikkprodusentens ekvivalent til Shotlist.
 * Prosjektets EaseVerse-låter med statusfilter, review-statistikk (versjoner/
 * åpne kommentarer fra Sound Room) og et detaljpanel med status-stepper
 * (opptak→miks→master→ferdig), versjons-info og Sound Room-kobling.
 * Gjenbruker /api/projects/:id/easeverse-tracks (+ PATCH status + link-easeverse).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import { useLocation } from 'wouter';
import LibraryMusic from '@mui/icons-material/LibraryMusic';
import GraphicEq from '@mui/icons-material/GraphicEq';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Link from '@mui/icons-material/Link';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsStat, WsPills, WsErrorState } from '../ui';

const STATUS: Record<string, [string, string]> = {
  recording: ['Opptak', 'neutral'], mixing: ['Miksing', 'amber'],
  mastering: ['Mastering', 'blue'], completed: ['Ferdig', 'green'],
};
const STATUS_ORDER = ['recording', 'mixing', 'mastering', 'completed'];
const VERSION_STATUS: Record<string, [string, string]> = {
  under_review: ['Til review', 'amber'], approved: ['Godkjent', 'green'], superseded: ['Erstattet', 'neutral'],
};
// Split-sheet-status per låt (audio-showcase-systemet: draft → signering → komplett).
const splitTag = (ss: any): { label: string; tone: string } | null => {
  if (!ss) return null;
  if (ss.status === 'completed') return { label: 'Split sheet ✓', tone: 'green' };
  if (ss.status === 'pending_signatures') return { label: `Signering ${ss.signed}/${ss.total}`, tone: 'amber' };
  return { label: 'Split sheet utkast', tone: 'neutral' };
};

const fmtDur = (s: any) => {
  const n = Number(s); if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`;
};

const LaaterTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [tracks, setTracks] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false); // feil ved primær-lasting av låtelista
  const [filter, setFilter] = useState('alle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!isReal) { setTracks([]); setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/easeverse-tracks`)
      .then((r: any) => { setTracks(Array.isArray(r?.tracks) ? r.tracks : []); setLoadErr(false); })
      .catch(() => setLoadErr(true)) // primær-lasting feilet → vis feiltilstand
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, isReal]);

  const list = tracks || [];
  const count = (s: string) => list.filter((t: any) => t.status === s).length;
  const filtered = useMemo(() => (filter === 'alle' ? list : list.filter((t: any) => t.status === filter)), [list, filter]);
  const selected = list.find((t: any) => t.id === selectedId) || filtered[0] || null;
  const openSoundRoom = () => navigate(`/workspace/${projectId}/sound-room`);

  const setStatus = async (track: any, status: string) => {
    if (!isReal || busy || track.status === status) return;
    setBusy(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/easeverse-tracks/${encodeURIComponent(track.id)}/status`, { method: 'PATCH', body: { status } });
      setTracks((p) => (p || []).map((t) => (t.id === track.id ? { ...t, status } : t)));
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke oppdatere status (kun eieren av låten kan endre den).'); }
    finally { setBusy(false); }
  };

  const linkToSoundRoom = async (track: any) => {
    if (!isReal || busy) return;
    setBusy(true);
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room/link-easeverse`, { method: 'POST', body: { trackId: track.id } });
      if (r?.bandSynced) window.alert(`Koblet! ${r.bandSynced} bidragsyter(e) synket til bandet.`);
      load();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke koble låten.'); }
    finally { setBusy(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Låter</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Prosjektets låter og spor — status fra innspilling til master. Åpne en låt i Sound Room for review, takes og band-samarbeid.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<GraphicEq sx={{ fontSize: 17 }} />} onClick={openSoundRoom} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 700 }}>Sound Room</Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <WsStat icon={<LibraryMusic sx={{ fontSize: 20 }} />} label="Låter totalt" value={list.length} sub="i prosjektet" tone={ws.accentSoft} />
        <WsStat icon={<GraphicEq sx={{ fontSize: 20 }} />} label="Under miksing" value={count('mixing')} sub="pågår" tone={ws.amberSoft} />
        <WsStat icon={<GraphicEq sx={{ fontSize: 20 }} />} label="Mastering" value={count('mastering')} sub="nær ferdig" tone={ws.blueSoft} />
        <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label="Ferdig" value={count('completed')} sub="levert" tone={ws.greenSoft} />
      </Box>

      <WsPills
        sx={{ mb: 1.5 }}
        value={filter}
        onChange={setFilter}
        items={[{ key: 'alle', label: `Alle (${list.length})` }, ...STATUS_ORDER.map((s) => ({ key: s, label: `${STATUS[s][0]} (${count(s)})` }))]}
      />

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        {/* Låt-liste */}
        <WsCard sx={{ flex: 1, minWidth: 0 }}>
          {filtered.length === 0 ? (
            isReal && loadErr && list.length === 0 ? (
              // Primær-lasting feilet og ingen data → feiltilstand m/ retry (header beholdes)
              <WsErrorState message="Kunne ikke laste låtene. Sjekk tilkoblingen og prøv igjen." onRetry={load} />
            ) : (
            <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
              <LibraryMusic sx={{ fontSize: 36, color: ws.textFaint }} />
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{list.length === 0 ? 'Ingen låter ennå' : 'Ingen låter i dette filteret'}</Typography>
              {list.length === 0 && (
                <>
                  <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 420 }}>Spill inn i EaseVerse-appen, eller koble en låt inn i Sound Room — så dukker den opp her med status, takes og tekst-synk.</Typography>
                  <Button variant="contained" onClick={openSoundRoom} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne Sound Room</Button>
                </>
              )}
            </Stack>
            )
          ) : (
            <Stack spacing={1}>
              {filtered.map((t: any) => {
                const st = STATUS[t.status] || [t.status || '—', 'neutral'];
                const active = selected && selected.id === t.id;
                return (
                  <Stack key={t.id} direction="row" alignItems="center" spacing={1.5} onClick={() => setSelectedId(t.id)}
                    sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, cursor: 'pointer', bgcolor: active ? ws.accentSoft : ws.panelAlt, border: `1px solid ${active ? ws.accentBorder : (t.linked ? ws.accentBorder : ws.borderSoft)}` }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <LibraryMusic sx={{ color: ws.accent, fontSize: 20 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{t.title || 'Uten tittel'}</Typography>
                        <WsTag label={st[0]} tone={st[1] as any} />
                        {t.linked && <WsTag label="I Sound Room" tone="green" />}
                        {t.versionCount > 0 && <WsTag label={`${t.versionCount} versjon${t.versionCount > 1 ? 'er' : ''}`} tone="blue" />}
                        {splitTag(t.splitSheet) && <WsTag label={splitTag(t.splitSheet).label} tone={splitTag(t.splitSheet).tone as any} />}
                        {t.openCommentCount > 0 && (
                          <Stack direction="row" spacing={0.35} alignItems="center" sx={{ color: ws.amber }}>
                            <ChatBubbleOutline sx={{ fontSize: 13 }} />
                            <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{t.openCommentCount}</Typography>
                          </Stack>
                        )}
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>
                        {t.artist ? `${t.artist} · ` : ''}{t.bpm ? `${t.bpm} BPM · ` : ''}{t.key || ''}{fmtDur(t.durationSeconds) ? ` · ${fmtDur(t.durationSeconds)}` : ''}
                      </Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </WsCard>

        {/* Låt-detaljer */}
        {selected && (
          <WsCard sx={{ width: { xs: '100%', lg: 330 }, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800 }} noWrap>{selected.title || 'Uten tittel'}</Typography>
            <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 1.5 }}>
              {selected.artist || 'Ukjent artist'}{selected.bpm ? ` · ${selected.bpm} BPM` : ''}{selected.key ? ` · ${selected.key}` : ''}{fmtDur(selected.durationSeconds) ? ` · ${fmtDur(selected.durationSeconds)}` : ''}
            </Typography>

            {/* Status-stepper (opptak → miks → master → ferdig) */}
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 0.75 }}>STATUS</Typography>
            <Stack spacing={0.5} sx={{ mb: 1.75 }}>
              {STATUS_ORDER.map((s, i) => {
                const cur = STATUS_ORDER.indexOf(selected.status);
                const isCurrent = selected.status === s;
                const isPast = cur > i;
                return (
                  <Stack key={s} direction="row" spacing={1} alignItems="center" onClick={() => setStatus(selected, s)}
                    sx={{ p: 0.9, borderRadius: `${ws.radiusSm}px`, cursor: isReal && !busy ? 'pointer' : 'default',
                      bgcolor: isCurrent ? ws.accentSoft : 'transparent', border: `1px solid ${isCurrent ? ws.accentBorder : ws.borderSoft}`,
                      opacity: busy ? 0.6 : 1, '&:hover': isReal ? { borderColor: ws.accentBorder } : undefined }}>
                    {isPast || (isCurrent && s === 'completed')
                      ? <CheckCircle sx={{ fontSize: 17, color: ws.green }} />
                      : <Box sx={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${isCurrent ? ws.accent : ws.textFaint}`, flexShrink: 0, ml: '1px' }} />}
                    <Typography sx={{ fontSize: 12.5, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? ws.text : ws.textDim, flex: 1 }}>{STATUS[s][0]}</Typography>
                    {isCurrent && <WsTag label="Nå" tone="accent" />}
                  </Stack>
                );
              })}
            </Stack>

            {/* Review-info fra Sound Room */}
            {selected.versionCount > 0 && (
              <Box sx={{ mb: 1.75 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 0.75 }}>REVIEW</Typography>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Versjoner</Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{selected.versionCount}</Typography>
                  </Stack>
                  {selected.latestVersionLabel && (
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Siste versjon</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }} noWrap>{selected.latestVersionLabel}</Typography>
                        {VERSION_STATUS[selected.latestVersionStatus] && <WsTag label={VERSION_STATUS[selected.latestVersionStatus][0]} tone={VERSION_STATUS[selected.latestVersionStatus][1] as any} />}
                      </Stack>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Åpne kommentarer</Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: selected.openCommentCount > 0 ? ws.amber : ws.text }}>{selected.openCommentCount}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Split sheet</Typography>
                    {splitTag(selected.splitSheet)
                      ? <WsTag label={splitTag(selected.splitSheet).label} tone={splitTag(selected.splitSheet).tone as any} />
                      : <Typography sx={{ fontSize: 12.5, color: ws.textFaint }}>Ikke opprettet</Typography>}
                  </Stack>
                </Stack>
              </Box>
            )}

            {selected.linked ? (
              <Button fullWidth variant="contained" onClick={openSoundRoom}
                sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
                Åpne i Sound Room
              </Button>
            ) : (
              <Stack spacing={1}>
                <Button fullWidth variant="contained" startIcon={<Link sx={{ fontSize: 16 }} />} onClick={() => linkToSoundRoom(selected)} disabled={busy || !isReal}
                  sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
                  Koble til Sound Room
                </Button>
                <Button fullWidth variant="outlined" onClick={openSoundRoom} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>
                  Åpne Sound Room
                </Button>
              </Stack>
            )}
          </WsCard>
        )}
      </Stack>
    </Box>
  );
};

export default LaaterTab;
