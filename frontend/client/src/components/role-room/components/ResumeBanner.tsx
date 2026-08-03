import React from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import type { ResumeAnalysis, ResumeThread, ResumeThreadType } from '../services/resumeAnalysisService';

interface ResumeBannerProps {
  analysis: ResumeAnalysis;
  onAction: (thread: ResumeThread) => void;
  onDismiss: () => void;
}

const ICON_BY_TYPE: Record<ResumeThreadType, React.ComponentType<SvgIconProps>> = {
  'last-edited': HistoryIcon,
  'empty-scaffold': EditNoteIcon,
  unscheduled: EventBusyIcon,
  'stale-draft': HourglassEmptyIcon,
};

/**
 * «Fortsett der du slapp» som en flytende HUD (heads-up display) i stedet for et
 * bredt banner: kompakt glassmorf-kort nederst-sentrert, utenfor layout-flyten
 * (spiser ingen vertikal plass), med blur og et mykt lilla glød. Forsvinner
 * automatisk når man begynner å skrive (styres av forelder).
 */
export const ResumeBanner: React.FC<ResumeBannerProps> = ({ analysis, onAction, onDismiss }) => {
  if (analysis.threads.length === 0) return null;

  return (
    <Box
      role="status"
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1250,
        width: { xs: 'calc(100vw - 32px)', sm: 'auto' },
        minWidth: { sm: 340 },
        maxWidth: 460,
        px: 2,
        py: 1.25,
        borderRadius: 2.5,
        bgcolor: 'rgba(18,18,30,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(139,92,246,0.40)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        animation: 'resumeHudIn .3s cubic-bezier(.2,.8,.2,1)',
        '@keyframes resumeHudIn': {
          from: { opacity: 0, transform: 'translate(-50%, 12px)' },
          to: { opacity: 1, transform: 'translate(-50%, 0)' },
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <HistoryIcon sx={{ fontSize: 18, color: '#a78bfa' }} />
        <Typography
          variant="caption"
          sx={{ flexGrow: 1, color: '#c4b5fd', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}
        >
          Fortsett der du slapp
        </Typography>
        <IconButton
          aria-label="Lukk"
          size="small"
          onClick={onDismiss}
          sx={{ color: 'rgba(255,255,255,0.55)', p: 0.25, mr: -0.5, '&:hover': { color: '#fff' } }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      <Stack spacing={0.25}>
        {analysis.threads.map((thread, idx) => {
          const Icon = ICON_BY_TYPE[thread.type];
          return (
            <Stack
              key={`${thread.type}-${idx}`}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ minHeight: 30 }}
            >
              <Icon sx={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
              <Typography
                variant="body2"
                noWrap
                title={thread.message}
                sx={{ flexGrow: 1, minWidth: 0, color: 'rgba(255,255,255,0.88)' }}
              >
                {thread.message}
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => onAction(thread)}
                sx={{ minWidth: 0, flexShrink: 0, px: 1, color: '#a78bfa', fontWeight: 600 }}
              >
                {thread.actionLabel}
              </Button>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};

export default ResumeBanner;
