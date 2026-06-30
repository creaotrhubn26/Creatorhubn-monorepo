// @ts-nocheck
/**
 * LaaterTab («Låter») — musikkprodusentens ekvivalent til Shotlist.
 * Viser prosjektets EaseVerse-låter (status innspilling→miks→master), og lar
 * deg åpne dem i Sound Room. Gjenbruker /api/projects/:id/easeverse-tracks.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import { useLocation } from 'wouter';
import LibraryMusic from '@mui/icons-material/LibraryMusic';
import GraphicEq from '@mui/icons-material/GraphicEq';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsStat } from '../ui';

const STATUS: Record<string, [string, string]> = {
  recording: ['Opptak', 'neutral'], mixing: ['Miksing', 'amber'],
  mastering: ['Mastering', 'blue'], completed: ['Ferdig', 'green'],
};

const LaaterTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [tracks, setTracks] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReal) { setTracks([]); setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/easeverse-tracks`)
      .then((r: any) => setTracks(Array.isArray(r?.tracks) ? r.tracks : []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [projectId, isReal]);

  const list = tracks || [];
  const count = (s: string) => list.filter((t: any) => t.status === s).length;
  const openSoundRoom = () => navigate(`/workspace/${projectId}/sound-room`);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto' }}>
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
        <WsStat icon={<GraphicEq sx={{ fontSize: 20 }} />} label="Ferdig" value={count('completed')} sub="levert" tone={ws.greenSoft} />
      </Box>

      <WsCard>
        {list.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
            <LibraryMusic sx={{ fontSize: 36, color: ws.textFaint }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Ingen låter ennå</Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 420 }}>Spill inn i EaseVerse-appen, eller koble en låt inn i Sound Room — så dukker den opp her med status, takes og tekst-synk.</Typography>
            <Button variant="contained" onClick={openSoundRoom} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne Sound Room</Button>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {list.map((t: any) => {
              const st = STATUS[t.status] || [t.status || '—', 'neutral'];
              return (
                <Stack key={t.id} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${t.linked ? ws.accentBorder : ws.borderSoft}` }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <LibraryMusic sx={{ color: ws.accent, fontSize: 20 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{t.title || 'Uten tittel'}</Typography>
                      <WsTag label={st[0]} tone={st[1] as any} />
                      {t.linked && <WsTag label="I Sound Room" tone="green" />}
                    </Stack>
                    <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{t.artist ? `${t.artist} · ` : ''}{t.bpm ? `${t.bpm} BPM · ` : ''}{t.key || ''}{t.hasReview && !t.linked ? ' · har review' : ''}</Typography>
                  </Box>
                  <Button size="small" variant={t.linked ? 'contained' : 'outlined'} onClick={openSoundRoom}
                    sx={t.linked
                      ? { bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }
                      : { color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>
                    {t.linked ? 'Åpne' : 'Til Sound Room'}
                  </Button>
                </Stack>
              );
            })}
          </Stack>
        )}
      </WsCard>
    </Box>
  );
};

export default LaaterTab;
