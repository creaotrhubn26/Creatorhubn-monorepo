/**
 * AgentRecommendationCard — ett AI-anbefaling-kort fra The Role Room Agent.
 * Porter overlay-designet (rr-agent-in-*): glødende Agent-merke, «AGENT-
 * ANBEFALING»-eyebrow, innsikt, nøkkeltall og «Utfør»-CTA + avvis.
 *
 * Backend: role_room_agent_recommendation (mig 284).
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, IconButton, CircularProgress, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import type { RoleRoomAgentRecommendation } from '../services/roleRoomAgentService';

const ACCENT = '#a855f7';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface AgentRecommendationCardProps {
  rec: RoleRoomAgentRecommendation;
  busy?: boolean;
  onDone: () => void;
  onDismiss: () => void;
}

export function AgentRecommendationCard({ rec, busy, onDone, onDismiss }: AgentRecommendationCardProps): React.ReactElement {
  return (
    <Box
      data-testid={`agent-rec-${rec.id}`}
      sx={{
        position: 'relative', borderRadius: 3, p: 2.5, overflow: 'hidden',
        border: '1px solid rgba(168,85,247,0.22)',
        background: 'radial-gradient(420px 200px at 92% -20%, rgba(217,70,239,0.12), transparent 60%), linear-gradient(135deg, rgba(168,85,247,0.10), rgba(110,63,199,0.04))',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        {/* Glødende Agent-merke */}
        <Box sx={{ position: 'relative', flex: 'none' }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 8px 22px rgba(168,85,247,0.5)' }}>
            <AutoAwesomeIcon sx={{ fontSize: 22, color: '#fff' }} />
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', color: ACCENT, mb: 0.5 }}>AGENT-ANBEFALING</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 800, color: INK, lineHeight: 1.15 }}>{rec.title}</Typography>
          {rec.insight ? <Typography sx={{ fontSize: 14, color: 'rgba(226,232,240,0.82)', mt: 0.5, lineHeight: 1.45 }}>{rec.insight}</Typography> : null}

          {rec.stat_value ? (
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1, background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{rec.stat_value}</Typography>
              {rec.stat_label ? <Typography sx={{ fontSize: 13, color: MUTED }}>{rec.stat_label}</Typography> : null}
            </Stack>
          ) : null}

          {rec.cta_label ? (
            <Button
              onClick={onDone}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CheckRoundedIcon />}
              variant="contained" disableElevation size="small"
              data-testid={`agent-rec-done-${rec.id}`}
              sx={{ mt: 2, textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' } }}
            >
              {rec.cta_label}
            </Button>
          ) : null}
        </Box>

        <Tooltip title="Avvis">
          <IconButton size="small" onClick={onDismiss} disabled={busy} sx={{ color: 'rgba(226,232,240,0.5)', flex: 'none' }} data-testid={`agent-rec-dismiss-${rec.id}`}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
