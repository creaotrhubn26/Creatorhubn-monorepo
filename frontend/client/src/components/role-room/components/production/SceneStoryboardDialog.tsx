import React from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  MovieCreation as StoryboardIcon,
} from '@mui/icons-material';
import type { SceneBreakdown } from '../../models/casting';
import { StoryboardIntegrationView } from '../StoryboardIntegrationView';

interface SceneStoryboardDialogProps {
  open: boolean;
  scene: SceneBreakdown | null;
  projectId?: string;
  /** Cinema-format på prosjektnivå (CastingProject.cinemaFormat). */
  projectCinemaFormat?: '16:9' | '4:3' | '2.39:1' | '2.35:1' | '1.85:1' | '2.76:1' | '1:1' | '9:16';
  activeFrameIndex?: number;
  onClose: () => void;
  onSceneUpdate: (scene: SceneBreakdown) => void;
}

export function SceneStoryboardDialog({
  open,
  scene,
  projectId,
  projectCinemaFormat,
  activeFrameIndex,
  onClose,
  onSceneUpdate,
}: SceneStoryboardDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        'data-testid': 'scene-storyboard-dialog',
        sx: {
          width: 'min(1500px, 96vw)',
          height: 'min(92vh, 980px)',
          bgcolor: '#060b16',
          border: '1px solid rgba(59,130,246,0.35)',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(2,6,23,0.9)',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <StoryboardIcon sx={{ color: '#60a5fa' }} />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
              Scene Storyboard
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              {scene?.sceneHeading || scene?.sceneName || scene?.heading || 'Ukjent scene'}
            </Typography>
          </Box>
          {scene && (
            <Chip
              size="small"
              label={`Scene ${scene.sceneNumber ?? scene.id}`}
              sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#93c5fd' }}
            />
          )}
        </Stack>
        <Button
          onClick={onClose}
          startIcon={<CloseIcon />}
          sx={{ color: 'rgba(255,255,255,0.72)' }}
        >
          Lukk
        </Button>
      </DialogTitle>
      <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
        {scene ? (
          <Box sx={{ height: '100%' }}>
            <StoryboardIntegrationView
              scene={scene}
              projectId={projectId}
              projectCinemaFormat={projectCinemaFormat}
              onUpdate={onSceneUpdate}
              storyboardOnly={true}
              activeFrameIndex={activeFrameIndex}
            />
          </Box>
        ) : (
          <Stack sx={{ height: '100%' }} alignItems="center" justifyContent="center" spacing={1}>
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>
              Ingen scene valgt
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Velg et shot eller en shotliste som er knyttet til en scene.
            </Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SceneStoryboardDialog;
