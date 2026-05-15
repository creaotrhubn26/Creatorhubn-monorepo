import React from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
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

const ICON_BY_TYPE: Record<ResumeThreadType, React.ComponentType<{ fontSize?: 'small' | 'inherit' | 'large' | 'medium' }>> = {
  'last-edited': HistoryIcon,
  'empty-scaffold': EditNoteIcon,
  unscheduled: EventBusyIcon,
  'stale-draft': HourglassEmptyIcon,
};

export const ResumeBanner: React.FC<ResumeBannerProps> = ({ analysis, onAction, onDismiss }) => {
  if (analysis.threads.length === 0) return null;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        p: 2,
        mb: 2,
        position: 'relative',
      }}
    >
      <IconButton
        aria-label="Lukk"
        size="small"
        onClick={onDismiss}
        sx={{ position: 'absolute', top: 4, right: 4 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <Typography variant="subtitle2" sx={{ mb: 1.5, pr: 4 }}>
        Hvor du var
      </Typography>

      <Stack spacing={1}>
        {analysis.threads.map((thread, idx) => {
          const Icon = ICON_BY_TYPE[thread.type];
          return (
            <Stack
              key={`${thread.type}-${idx}`}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ minHeight: 32 }}
            >
              <Icon fontSize="small" />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {thread.message}
              </Typography>
              <Button size="small" variant="text" onClick={() => onAction(thread)}>
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
