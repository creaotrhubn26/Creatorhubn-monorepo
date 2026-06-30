// @ts-nocheck
/**
 * SesjonerTab («Sesjoner») — musikkprodusentens ekvivalent til Produksjonskart.
 * Innspillings-/miks-sesjoner fra Pro Tools Companion, koblet til prosjektets
 * Sound Room. Read-only oversikt; sesjonene settes opp i companion-appen
 * (last ned/koble i Sound Room). Gjenbruker /api/projects/:id/recording-sessions.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import { useLocation } from 'wouter';
import Album from '@mui/icons-material/Album';
import GraphicEq from '@mui/icons-material/GraphicEq';
import Flag from '@mui/icons-material/Flag';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag } from '../ui';

const TYPE: Record<string, string> = { recording: 'Opptak', mixing: 'Miksing', mastering: 'Mastering', collaboration: 'Samarbeid' };

const SesjonerTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReal) { setSessions([]); setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/recording-sessions`)
      .then((r: any) => setSessions(Array.isArray(r?.sessions) ? r.sessions : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [projectId, isReal]);

  const list = sessions || [];
  const openSoundRoom = () => navigate(`/workspace/${projectId}/sound-room`);
  const fmtNum = (n: any) => (n == null ? '—' : Number(n));

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Sesjoner</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Innspillings- og miks-sesjoner fra Pro Tools Companion, koblet til prosjektets Sound Room. Markører blir låt-seksjoner og bounces blir review-versjoner.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<GraphicEq sx={{ fontSize: 17 }} />} onClick={openSoundRoom} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 700 }}>Sound Room</Button>
      </Stack>

      <WsCard>
        {list.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
            <Album sx={{ fontSize: 36, color: ws.textFaint }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Ingen sesjoner ennå</Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 440 }}>Last ned <b>Pro Tools Companion</b> i Sound Room og koble den til. Når du jobber i Pro Tools dukker sesjonene opp her — med markører (låt-seksjoner) og bounces (versjoner) automatisk.</Typography>
            <Button variant="contained" onClick={openSoundRoom} sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne Sound Room</Button>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {list.map((s: any) => (
              <Stack key={s.id} direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
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
                  <Button size="small" variant="outlined" onClick={openSoundRoom} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>Åpne</Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </WsCard>
    </Box>
  );
};

export default SesjonerTab;
