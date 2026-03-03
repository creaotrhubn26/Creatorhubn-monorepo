import { memo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Typography,
} from '@mui/material';

export interface StoryArcSceneDetectionScene {
  scene_number: number;
  start_time: number;
  end_time: number;
  duration: number;
}

export interface StoryArcSceneDetectionProgress {
  status: string;
  progress: number;
  message?: string;
  scenes?: StoryArcSceneDetectionScene[];
  error?: string;
}

interface StoryArcSceneDetectionDialogProps {
  open: boolean;
  onClose: () => void;
  sceneDetectionJobId: string | null;
  sceneDetectionProgress: StoryArcSceneDetectionProgress | null;
  onJumpToSceneStart: (startTime: number) => void;
}

function StoryArcSceneDetectionDialogComponent({
  open,
  onClose,
  sceneDetectionJobId,
  sceneDetectionProgress,
  onJumpToSceneStart,
}: StoryArcSceneDetectionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Scene Detection</DialogTitle>
      <DialogContent>
        {sceneDetectionJobId && (
          <Chip size="small" label={`Job: ${sceneDetectionJobId}`} sx={{ mb: 1 }} />
        )}
        {sceneDetectionProgress?.status === 'processing' && (
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Detecting scenes...</Typography>
            <LinearProgress />
          </Box>
        )}
        {sceneDetectionProgress?.status === 'completed' && sceneDetectionProgress.scenes && (
          <Box>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Detected {sceneDetectionProgress.scenes.length} scenes
            </Typography>
            <List>
              {sceneDetectionProgress.scenes.slice(0, 10).map((scene) => (
                <ListItem key={scene.scene_number}>
                  <ListItemText
                    primary={`Scene ${scene.scene_number}`}
                    secondary={`${scene.start_time.toFixed(2)}s - ${scene.end_time.toFixed(2)}s (${scene.duration.toFixed(2)}s)`}
                  />
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      onClick={() => onJumpToSceneStart(scene.start_time)}
                    >
                      Jump
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        {sceneDetectionProgress?.status === 'failed' && (
          <Alert severity="error">
            Scene detection failed: {sceneDetectionProgress.error || 'Unknown error'}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export const StoryArcSceneDetectionDialog = memo(StoryArcSceneDetectionDialogComponent);
StoryArcSceneDetectionDialog.displayName = 'StoryArcSceneDetectionDialog';
