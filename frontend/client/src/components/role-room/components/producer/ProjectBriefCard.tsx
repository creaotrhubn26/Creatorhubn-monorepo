/**
 * ProjectBriefCard — polert «Prosjekt-brief»-visning i prosjektrommet
 * (porter ws-brief-designet): mål, målgruppe, leveranse, tone og frist.
 * Leser ekte brief-data fra role_room_client_intake via
 * producerWorkflowService.getClientIntake. Ingen ny backend.
 */

import * as React from 'react';
import { Box, Stack, Typography, CircularProgress } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FlagIcon from '@mui/icons-material/Flag';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import EventIcon from '@mui/icons-material/Event';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { producerWorkflowService } from '../../services/producerWorkflowService';
import type { ProducerClientIntake } from '../../models/casting';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface ProjectBriefCardProps { projectId: string; projectName?: string }

export default function ProjectBriefCard({ projectId, projectName }: ProjectBriefCardProps): React.ReactElement | null {
  const [intake, setIntake] = React.useState<ProducerClientIntake | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void producerWorkflowService.getClientIntake(projectId)
      .then((r) => { if (!cancelled) setIntake(r); })
      .catch(() => { if (!cancelled) setIntake(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const goal = intake?.projectGoal?.trim() || '';
  const fields = [
    { icon: <GroupsIcon sx={{ fontSize: 16 }} />, label: 'Målgruppe', val: intake?.targetAudience?.trim() || '' },
    { icon: <Inventory2Icon sx={{ fontSize: 16 }} />, label: 'Leveranse', val: intake?.deliverables?.trim() || '' },
    { icon: <GraphicEqIcon sx={{ fontSize: 16 }} />, label: 'Tone', val: intake?.brandNotes?.trim() || intake?.keyMessage?.trim() || '' },
    { icon: <EventIcon sx={{ fontSize: 16 }} />, label: 'Frist', val: intake?.timingConstraints?.trim() || '' },
  ];

  const hasAny = goal || fields.some((f) => f.val);
  if (loading) return <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={18} sx={{ color: ACCENT }} /></Box>;
  if (!hasAny) return null; // ingen brief utfylt ennå

  return (
    <Box sx={{
      position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.4 }, mb: 1.5, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.2)',
      background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.16), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 1.4 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD }}>
          <AssignmentIcon sx={{ fontSize: 17, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Prosjekt-brief</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: INK, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {projectName?.trim() || 'Brief'}
          </Typography>
        </Box>
      </Stack>

      {/* Mål */}
      {goal ? (
        <Box sx={{ mb: 1.6 }}>
          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.5 }}>
            <FlagIcon sx={{ fontSize: 16, color: ACCENT }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mål</Typography>
          </Stack>
          <Typography sx={{ fontSize: 14, color: 'rgba(226,232,240,0.9)', lineHeight: 1.5 }}>{goal}</Typography>
        </Box>
      ) : null}

      {/* Felt-grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
        {fields.filter((f) => f.val).map((f) => (
          <Box key={f.label} sx={{ p: 1.1, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.12)' }}>
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.4, color: ACCENT }}>
              {f.icon}
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 13, color: 'rgba(226,232,240,0.88)', lineHeight: 1.45 }}>{f.val}</Typography>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mt: 1.6, pt: 1.3, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
        <HandshakeIcon sx={{ fontSize: 15, color: ACCENT }} />
        <Typography sx={{ fontSize: 11.5, color: MUTED }}>Produsent &amp; klient · Brief forankret</Typography>
      </Stack>
    </Box>
  );
}
