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
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { FaceDetectionProgress } from '../../../services/face-detection-worker';

interface StoryArcFaceDetectionDialogProps {
  open: boolean;
  onClose: () => void;
  faceDetectionRunning: boolean;
  faceDetectionProgress: FaceDetectionProgress | null;
  resolveClipName: (clipId: string) => string | undefined;
  onDialogAction: () => void;
}

function StoryArcFaceDetectionDialogComponent({
  open,
  onClose,
  faceDetectionRunning,
  faceDetectionProgress,
  resolveClipName,
  onDialogAction,
}: StoryArcFaceDetectionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Face Detection Progress (FaceXFormer)
        {faceDetectionRunning && (
          <Chip
            label="Running"
            color="primary"
            size="small"
            sx={{ ml: 2 }}
          />
        )}
      </DialogTitle>
      <DialogContent>
        {faceDetectionProgress && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Processing clips: {faceDetectionProgress.processed} / {faceDetectionProgress.total}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={faceDetectionProgress.total > 0 ? (faceDetectionProgress.processed / faceDetectionProgress.total) * 100 : 0}
                sx={{ mt: 1, height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, textAlign: 'right', display: 'block' }}>
                {faceDetectionProgress.total > 0 ? Math.round((faceDetectionProgress.processed / faceDetectionProgress.total) * 100) : 0}%
              </Typography>
            </Box>

            {faceDetectionProgress.current && (
              <Alert severity="info">
                Analyzing: {resolveClipName(faceDetectionProgress.current) || faceDetectionProgress.current}
              </Alert>
            )}

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Results Summary
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Chip
                  label={`${faceDetectionProgress.results.filter((result) => result.hasFace).length} with faces`}
                  color="success"
                  size="small"
                />
                <Chip
                  label={`${faceDetectionProgress.results.filter((result) => !result.hasFace).length} without faces`}
                  color="default"
                  size="small"
                />
                {faceDetectionProgress.errors.length > 0 && (
                  <Chip
                    label={`${faceDetectionProgress.errors.length} errors`}
                    color="error"
                    size="small"
                  />
                )}
              </Stack>
            </Box>

            {faceDetectionProgress.results.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Analysis Details
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {faceDetectionProgress.results
                    .filter((result) => result.hasFace && result.comprehensiveAnalysis)
                    .slice(0, 3)
                    .map((result, index) => {
                      const clipName = resolveClipName(result.clipId);
                      const analysis = result.comprehensiveAnalysis;
                      return (
                        <Paper key={`${result.clipId}_${index}`} variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" fontWeight={600}>
                            {clipName || result.clipId}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                            {analysis?.landmarks && (
                              <Chip label={`${analysis.landmarks.count} landmarks`} size="small" />
                            )}
                            {analysis?.headpose && (
                              <Chip
                                label={`Head: ${analysis.headpose.pitch.toFixed(0)}°/${analysis.headpose.yaw.toFixed(0)}°/${analysis.headpose.roll.toFixed(0)}°`}
                                size="small"
                              />
                            )}
                            {analysis?.parsing && (
                              <Chip label="Parsing" size="small" />
                            )}
                            {analysis?.attributes && (
                              <Chip label={`${analysis.attributes.count} attributes`} size="small" />
                            )}
                          </Stack>
                        </Paper>
                      );
                    })}
                </Stack>
              </Box>
            )}

            {faceDetectionProgress.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Errors:
                </Typography>
                {faceDetectionProgress.errors.slice(0, 5).map((error, index) => (
                  <Alert key={`${error.clipId}_${index}`} severity="error" sx={{ mt: 1 }}>
                    {resolveClipName(error.clipId) || error.clipId}: {error.error}
                  </Alert>
                ))}
                {faceDetectionProgress.errors.length > 5 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    ... and {faceDetectionProgress.errors.length - 5} more errors
                  </Typography>
                )}
              </Box>
            )}

            {!faceDetectionRunning && faceDetectionProgress.processed === faceDetectionProgress.total && (
              <Alert severity="success">
                Face detection complete! Clips with faces have been automatically tagged.
                {faceDetectionProgress.results.filter((result) => result.hasFace).length > 0 && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                    View comprehensive analysis in Inspector Panel for selected clips.
                  </Typography>
                )}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onDialogAction}>
          {faceDetectionRunning ? 'Cancel' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export const StoryArcFaceDetectionDialog = memo(StoryArcFaceDetectionDialogComponent);
StoryArcFaceDetectionDialog.displayName = 'StoryArcFaceDetectionDialog';
