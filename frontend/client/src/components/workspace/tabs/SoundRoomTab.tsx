// @ts-nocheck
/**
 * SoundRoomTab — workspace-rommet for lyd (audio review).
 *
 * Gjenbruker HELE den eksisterende Audio Showcase-en («Universal Showcase»-
 * review: versjoner, tidsstemplede kommentarer, A/B-compare, AI-feedback,
 * deliverables, split-sheet). Audio Showcase har sitt eget prosjekt-begrep
 * (audio_review_projects); vi finn-eller-oppretter ett koblet til workspace-
 * prosjektet via /api/projects/:id/audio-room, og åpner så full-skjerm-
 * opplevelsen på /audio-review/:audioRoomId?ws=:projectId (med tilbake-lenke).
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress } from '@mui/material';
import { useLocation } from 'wouter';
import GraphicEq from '@mui/icons-material/GraphicEq';
import OpenInFull from '@mui/icons-material/OpenInFull';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag } from '../ui';

const SoundRoomTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isReal) { setLoading(false); return; }
    let stop = false;
    (async () => {
      try {
        const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room`);
        if (stop) return;
        const id = r?.audioRoomId; setRoomId(id);
        if (id) {
          try { const s: any = await apiRequest(`/api/audio-showcases/${id}`); if (!stop) setSummary(s); } catch { /* eier-gated/ny */ }
        }
      } catch (e: any) { if (!stop) setErr(e?.message || 'Kunne ikke åpne lydrommet'); }
      finally { if (!stop) setLoading(false); }
    })();
    return () => { stop = true; };
  }, [projectId, isReal]);

  const openRoom = () => { if (roomId) navigate(`/audio-review/${roomId}?ws=${encodeURIComponent(projectId)}`); };

  const proj = summary?.project || {};
  const versions = summary?.versions || [];
  const members = summary?.members || [];
  const current = versions.find((v: any) => v.status === 'under_review') || versions[versions.length - 1] || null;
  const openComments = current?.comment_count ?? null;

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 920, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Sound Room</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Lyd-review for prosjektet — versjoner, tidsstemplede tilbakemeldinger, A/B-compare og leveranse. Samme «Universal Showcase»-rom klienten/bandet får.</Typography>
        </Box>
        {roomId && <Button variant="contained" startIcon={<OpenInFull sx={{ fontSize: 17 }} />} onClick={openRoom} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne lydrommet</Button>}
      </Stack>

      {err && <WsCard sx={{ mb: 2, borderColor: ws.redSoft }}><Typography sx={{ fontSize: 13, color: ws.red }}>{err}</Typography></WsCard>}

      {/* Branded landings-kort */}
      <WsCard sx={{ mb: 2, cursor: roomId ? 'pointer' : 'default', '&:hover': roomId ? { borderColor: ws.accentBorder } : undefined }} onClick={openRoom}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Box sx={{ width: 64, height: 64, borderRadius: 2, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundImage: proj.cover_url ? `url(${proj.cover_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            {!proj.cover_url && <GraphicEq sx={{ color: ws.accent, fontSize: 30 }} />}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 16, fontWeight: 800 }} noWrap>{proj.title || 'Lydrom'}</Typography>
              {proj.status && <WsTag label={proj.status === 'under_review' ? 'Under review' : proj.status === 'approved' ? 'Godkjent' : proj.status} tone={proj.status === 'approved' ? 'green' : proj.status === 'under_review' ? 'amber' : 'neutral'} />}
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, mt: 0.25 }}>
              {proj.band_name ? `${proj.band_name} · ` : ''}{versions.length} versjon{versions.length === 1 ? '' : 'er'}{current ? ` · siste: ${current.version_label || `Mix V${current.version_number}`}` : ''}{members.length ? ` · ${members.length} medlem${members.length === 1 ? '' : 'mer'}` : ''}
            </Typography>
          </Box>
          <Button variant="text" onClick={(e) => { e.stopPropagation(); openRoom(); }} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>Åpne →</Button>
        </Stack>
      </WsCard>

      {/* Versjons-strip (preview, full visning inne i rommet) */}
      {versions.length > 0 && (
        <WsCard sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>Versjoner</Typography>
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {versions.map((v: any) => (
              <Box key={v.id} onClick={openRoom} sx={{ minWidth: 150, p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${v.status === 'under_review' ? ws.accentBorder : ws.borderSoft}`, cursor: 'pointer', flexShrink: 0 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{v.version_label || `Mix V${v.version_number}`}</Typography>
                  {v.status === 'under_review' && <WsTag label="Nå" tone="amber" />}
                  {v.status === 'approved' && <WsTag label="✓" tone="green" />}
                </Stack>
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 0.5 }} noWrap>{v.file_name || ''}</Typography>
              </Box>
            ))}
          </Stack>
        </WsCard>
      )}

      {versions.length === 0 && !err && (
        <WsCard sx={{ bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
          <Typography sx={{ fontSize: 13, color: ws.text }}>Lydrommet er klart. Åpne det og last opp første mix/master-versjon — så får band/klient tidsstemplet review med versjonering og godkjenning.</Typography>
          <Button variant="contained" onClick={openRoom} sx={{ mt: 1.5, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne lydrommet</Button>
        </WsCard>
      )}
    </Box>
  );
};

export default SoundRoomTab;
