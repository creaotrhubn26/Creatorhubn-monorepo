import { memo, type ChangeEvent, type MouseEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { Sync } from '@mui/icons-material';
import type { BeatClip } from '../../../services/storyArcDataIntegration';
import type { AudioSyncResult } from '../../../services/audio-sync-engine';

interface SyncClipMeta {
  camera?: string;
  syncGroup?: string;
}

export interface StoryArcSyncResultRow {
  clipId: string;
  clip: BeatClip;
  result: AudioSyncResult;
  confidence: number;
  confidenceColor: 'success' | 'warning' | 'error';
  confidencePreviewColor: string;
  manualOffset: number;
}

export interface StoryArcSyncConfidenceSummary {
  avgConfidence: number;
  qualityColor: 'success' | 'warning' | 'error';
  qualityLabel: string;
}

interface StoryArcSyncDialogProps {
  open: boolean;
  onClose: () => void;
  syncJobId: string | null;
  syncTryReallyHard: boolean;
  syncPreferTimecode: boolean;
  syncEnableDriftCorrection: boolean;
  syncAllowClipReorder: boolean;
  syncUseServerFirst: boolean;
  onSyncTryReallyHardChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSyncPreferTimecodeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSyncEnableDriftCorrectionChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSyncAllowClipReorderChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSyncUseServerFirstChange: (event: ChangeEvent<HTMLInputElement>) => void;
  syncMaxOffsetSeconds: number;
  onSyncMaxOffsetWindowChange: (event: Event, value: number | number[]) => void;
  clips: BeatClip[];
  clipMeta: Record<string, SyncClipMeta>;
  selectedSyncClips: Set<string>;
  onToggleSyncClipSelectionClick: (event: MouseEvent<HTMLDivElement>) => void;
  syncInProgress: boolean;
  syncResults: Record<string, AudioSyncResult> | null;
  syncPreviewMode: boolean;
  syncResultRows: StoryArcSyncResultRow[];
  syncConfidenceSummary: StoryArcSyncConfidenceSummary | null;
  onManualOffsetSliderChange: (event: Event, value: number | number[]) => void;
  onResetManualOffsetClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onClearManualOffsetClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onResetSyncPreview: () => void;
  onApplySync: () => void;
  onRunSync: () => void;
}

function StoryArcSyncDialogComponent({
  open,
  onClose,
  syncJobId,
  syncTryReallyHard,
  syncPreferTimecode,
  syncEnableDriftCorrection,
  syncAllowClipReorder,
  syncUseServerFirst,
  onSyncTryReallyHardChange,
  onSyncPreferTimecodeChange,
  onSyncEnableDriftCorrectionChange,
  onSyncAllowClipReorderChange,
  onSyncUseServerFirstChange,
  syncMaxOffsetSeconds,
  onSyncMaxOffsetWindowChange,
  clips,
  clipMeta,
  selectedSyncClips,
  onToggleSyncClipSelectionClick,
  syncInProgress,
  syncResults,
  syncPreviewMode,
  syncResultRows,
  syncConfidenceSummary,
  onManualOffsetSliderChange,
  onResetManualOffsetClick,
  onClearManualOffsetClick,
  onResetSyncPreview,
  onApplySync,
  onRunSync,
}: StoryArcSyncDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Sync />
          <Typography variant="h6">Sync Multi-Angle Clips</Typography>
          {syncJobId && <Chip size="small" label={`Job ${syncJobId}`} color="info" variant="outlined" />}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <Alert severity="info">
            PluralEyes-style sync: waveform alignment first, optional timecode fallback, confidence scoring, drift estimation, and manual fine trim.
          </Alert>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Sync Strategy
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={syncTryReallyHard}
                      onChange={onSyncTryReallyHardChange}
                    />
                  }
                  label="Try Really Hard"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={syncPreferTimecode}
                      onChange={onSyncPreferTimecodeChange}
                    />
                  }
                  label="Prefer Timecode"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={syncEnableDriftCorrection}
                      onChange={onSyncEnableDriftCorrectionChange}
                    />
                  }
                  label="Drift Correction"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={syncAllowClipReorder}
                      onChange={onSyncAllowClipReorderChange}
                    />
                  }
                  label="Allow Clip Reorder"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={syncUseServerFirst}
                      onChange={onSyncUseServerFirstChange}
                    />
                  }
                  label="Use Server First"
                />
              </Stack>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Max offset window: +/- {syncMaxOffsetSeconds}s
                </Typography>
                <Slider
                  value={syncMaxOffsetSeconds}
                  onChange={onSyncMaxOffsetWindowChange}
                  min={5}
                  max={120}
                  step={1}
                  marks={[
                    { value: 5, label: '5s' },
                    { value: 30, label: '30s' },
                    { value: 60, label: '60s' },
                    { value: 120, label: '120s' },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Box>
            </Stack>
          </Paper>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Select Clips to Sync ({selectedSyncClips.size} selected)
          </Typography>

          <List sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {clips.map((clip) => {
              const meta = clipMeta[clip.id] || {};
              const camera = meta.camera || clip.metadata?.camera;
              const syncGroup = meta.syncGroup || clip.metadata?.syncGroup;
              const isSelected = selectedSyncClips.has(clip.id);

              return (
                <ListItem key={clip.id} disablePadding>
                  <ListItemButton
                    data-clip-id={clip.id}
                    onClick={onToggleSyncClipSelectionClick}
                    sx={{
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Checkbox checked={isSelected} />
                    <ListItemText
                      primary={clip.name}
                      secondaryTypographyProps={{ component: 'div' }}
                      secondary={
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          {camera && (
                            <Chip size="small" label={camera} color="primary" sx={{ height: 20, fontSize: 10 }} />
                          )}
                          {syncGroup && (
                            <Chip size="small" label={syncGroup} color="secondary" sx={{ height: 20, fontSize: 10 }} />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {clip.duration.toFixed(1)}s • Track: {clip.trackId}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          {syncInProgress && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={24} />
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Synchronizing clips... This may take a few moments.
                </Typography>
                {syncJobId && (
                  <Typography variant="caption" color="text.secondary">
                    Tracking job: {syncJobId}
                  </Typography>
                )}
              </Stack>
            </Box>
          )}

          {syncResults && syncPreviewMode && !syncInProgress && (
            <Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                Sync Results & Manual Adjustment
              </Typography>

              {syncConfidenceSummary && (
                <Alert
                  severity={syncConfidenceSummary.qualityColor}
                  sx={{ mb: 2 }}
                  icon={<Sync />}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Overall Sync Quality: {syncConfidenceSummary.qualityLabel} ({(syncConfidenceSummary.avgConfidence * 100).toFixed(1)}%)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={syncConfidenceSummary.avgConfidence * 100}
                    color={syncConfidenceSummary.qualityColor}
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                  />
                </Alert>
              )}

              <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {syncResultRows.map((row) => {
                  const hasManualAdjustment = Math.abs(row.manualOffset - row.result.offset_seconds) > 0.01;

                  return (
                    <ListItem key={row.clipId} sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.clip.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${(row.confidence * 100).toFixed(0)}%`}
                          color={row.confidenceColor}
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Confidence
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.confidence < 0.6 && '⚠️ Low confidence - manual adjustment recommended'}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={row.confidence * 100}
                          color={row.confidenceColor}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>

                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Offset: {row.manualOffset >= 0 ? '+' : '-'}{Math.abs(row.manualOffset).toFixed(3)}s ({row.result.offset_frames || Math.round(row.manualOffset * 30)} frames)
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            {typeof row.result.drift_ppm === 'number' && (
                              <Chip
                                size="small"
                                color={Math.abs(row.result.drift_ppm) > 80 ? 'warning' : 'default'}
                                label={`Drift ${row.result.drift_ppm.toFixed(1)} ppm`}
                                sx={{ height: 18, fontSize: 9 }}
                              />
                            )}
                            <Chip
                              size="small"
                              label={row.result.method || 'audio_waveform'}
                              variant="outlined"
                              sx={{ height: 18, fontSize: 9 }}
                            />
                            {hasManualAdjustment && (
                              <Chip
                                size="small"
                                label="Manual"
                                color="info"
                                sx={{ height: 18, fontSize: 9 }}
                              />
                            )}
                          </Stack>
                        </Box>
                        <Slider
                          data-clip-id={row.clipId}
                          value={row.manualOffset}
                          onChange={onManualOffsetSliderChange}
                          min={-5}
                          max={5}
                          step={0.001}
                          marks={[
                            { value: -5, label: '-5s' },
                            { value: 0, label: '0s' },
                            { value: 5, label: '+5s' },
                          ]}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(3)}s`}
                          sx={{ mt: 1 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            data-clip-id={row.clipId}
                            data-detected-offset={row.result.offset_seconds}
                            onClick={onResetManualOffsetClick}
                          >
                            Reset
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            data-clip-id={row.clipId}
                            onClick={onClearManualOffsetClick}
                          >
                            Clear
                          </Button>
                        </Box>
                      </Box>
                    </ListItem>
                  );
                })}
              </List>

              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Temporal Alignment Preview
                </Typography>
                <Box sx={{ position: 'relative', height: 120, bgcolor: 'grey.100', borderRadius: 1, overflow: 'hidden' }}>
                  {syncResultRows.map((row, idx) => {
                    const baseY = 20 + (idx * 25);
                    const offsetPx = (row.manualOffset / 5) * 200;

                    return (
                      <Box
                        key={row.clipId}
                        sx={{
                          position: 'absolute',
                          left: 200 + offsetPx,
                          top: baseY,
                          width: 100,
                          height: 20,
                          bgcolor: row.confidencePreviewColor,
                          borderRadius: 1,
                          opacity: 0.8,
                          border: '1px solid',
                          borderColor: 'grey.400',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        {row.clip.name.substring(0, 10)}
                      </Box>
                    );
                  })}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 200,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      bgcolor: 'primary.main',
                      opacity: 0.5,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      left: 200,
                      top: 0,
                      transform: 'translateX(-50%)',
                      bgcolor: 'primary.main',
                      color: 'white',
                      px: 0.5,
                      borderRadius: 0.5,
                      fontSize: 9,
                    }}
                  >
                    Reference
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Visual representation of clip alignment. Green = high confidence, Orange = medium, Red = low.
                </Typography>
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {syncPreviewMode ? 'Cancel' : 'Close'}
        </Button>
        {syncPreviewMode && syncResults ? (
          <>
            <Button
              variant="outlined"
              onClick={onResetSyncPreview}
            >
              Back to Edit
            </Button>
            <Button
              data-testid="sync-apply-button"
              variant="contained"
              onClick={onApplySync}
            >
              Apply Sync
            </Button>
          </>
        ) : (
          <Button
            data-testid="sync-run-button"
            variant="contained"
            onClick={onRunSync}
            disabled={selectedSyncClips.size < 2 || syncInProgress}
            startIcon={syncInProgress ? <CircularProgress size={16} /> : <Sync />}
          >
            {syncInProgress ? 'Syncing...' : 'Sync Clips'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export const StoryArcSyncDialog = memo(StoryArcSyncDialogComponent);
StoryArcSyncDialog.displayName = 'StoryArcSyncDialog';
