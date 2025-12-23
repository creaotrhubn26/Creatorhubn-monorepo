/**
 * Body Animation Panel
 * 
 * UI for controlling head, hand, and arm animations on virtual subjects.
 * 
 * Features:
 * - Head position presets
 * - Hand gesture selection
 * - Full body pose presets
 * - Animation speed controls
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Stack,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Face,
  PanTool,
  Accessibility,
  Refresh,
  PlayArrow,
  Pause,
  Speed,
} from '@mui/icons-material';
import {
  HEAD_PRESETS,
  HAND_PRESETS,
  FULL_BODY_POSES,
  GESTURE_DEFINITIONS,
  BODY_ANIMATION_PRESETS,
  HandGesture,
} from '../../core/animations/BodyAnimations';

interface BodyAnimationPanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  headPreset: string;
  onHeadPresetChange: (preset: string) => void;
  handPreset: string;
  onHandPresetChange: (preset: string) => void;
  gesture: HandGesture;
  onGestureChange: (gesture: HandGesture) => void;
  fullBodyPose: string;
  onFullBodyPoseChange: (pose: string) => void;
  animationPreset: string;
  onAnimationPresetChange: (preset: string) => void;
}

// Gesture icons (simplified representations)
const GESTURE_ICONS: Record<HandGesture, string> = {
  relaxed: 'Natural',
  fist: 'Fist',
  open: 'Open',
  pointing: 'Point',
  peace: 'Peace',
  thumbsUp: 'Thumbs Up',
  ok: 'OK',
  grip: 'Grip',
  pinch: 'Pinch',
  wave: 'Wave',
};

export const BodyAnimationPanel: React.FC<BodyAnimationPanelProps> = ({
  enabled,
  onEnabledChange,
  headPreset,
  onHeadPresetChange,
  handPreset,
  onHandPresetChange,
  gesture,
  onGestureChange,
  fullBodyPose,
  onFullBodyPoseChange,
  animationPreset,
  onAnimationPresetChange,
}) => {
  const [activeSection, setActiveSection] = useState<'pose' | 'head' | 'hands'>('pose');

  return (
    <Paper elevation={3} sx={{ p: 2, bgcolor: '#1a1a1a', color: '#fff' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Accessibility color="primary" />
          <Typography variant="h6">Body Animation</Typography>
        </Stack>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
            />
          }
          label={enabled ? 'On' : 'Off'}
          labelPlacement="start"
        />
      </Stack>

      {!enabled ? (
        <Alert severity="info">
          Enable body animation to add realistic head movements, hand gestures, and poses to your virtual subject.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {/* Section Tabs */}
          <ToggleButtonGroup
            value={activeSection}
            exclusive
            onChange={(_, v) => v && setActiveSection(v)}
            size="small"
            fullWidth
          >
            <ToggleButton value="pose">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Accessibility fontSize="small" />
                <span>Full Pose</span>
              </Stack>
            </ToggleButton>
            <ToggleButton value="head">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Face fontSize="small" />
                <span>Head</span>
              </Stack>
            </ToggleButton>
            <ToggleButton value="hands">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PanTool fontSize="small" />
                <span>Hands</span>
              </Stack>
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider />

          {/* Full Body Poses */}
          {activeSection === 'pose' && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Quick Poses
              </Typography>
              <Grid container spacing={1}>
                {Object.keys(FULL_BODY_POSES).map((poseName) => (
                  <Grid item xs={4} key={poseName}>
                    <Card
                      sx={{
                        bgcolor: fullBodyPose === poseName ? 'primary.dark' : '#2a2a2a',
                        cursor: 'pointer', '&:hover': { bgcolor: fullBodyPose === poseName ? 'primary.dark' : '#333' }}}
                    >
                      <CardActionArea onClick={() => onFullBodyPoseChange(poseName)}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="body2" align="center" sx={{ textTransform: 'capitalize' }}>
                            {poseName.replace(/_/g, ' , ')}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Animation Style
                </Typography>
                <Grid container spacing={1}>
                  {Object.keys(BODY_ANIMATION_PRESETS).map((presetName) => (
                    <Grid item xs={3} key={presetName}>
                      <Chip
                        label={presetName}
                        onClick={() => onAnimationPresetChange(presetName)}
                        color={animationPreset === presetName ? 'primary' : 'default'}
                        variant={animationPreset === presetName ? 'filled' : 'outlined'}
                        size="small"
                        sx={{ width: '100%', textTransform: 'capitalize' }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Box>
          )}

          {/* Head Positions */}
          {activeSection === 'head' && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Head Position
              </Typography>
              <Grid container spacing={1}>
                {Object.keys(HEAD_PRESETS).map((presetName) => (
                  <Grid item xs={4} key={presetName}>
                    <Card
                      sx={{
                        bgcolor: headPreset === presetName ? 'primary.dark' : '#2a2a2a',
                        cursor: 'pointer','&:hover': { bgcolor: headPreset === presetName ? 'primary.dark' : '#333' }}}
                    >
                      <CardActionArea onClick={() => onHeadPresetChange(presetName)}>
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                          <Typography variant="caption" align="center" display="block" sx={{ textTransform: 'capitalize' }}>
                            {presetName.replace(/([A-Z])/g, ' $1').trim()}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Hand Gestures & Positions */}
          {activeSection === 'hands' && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Hand Position
              </Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {Object.keys(HAND_PRESETS).map((presetName) => (
                  <Grid item xs={4} key={presetName}>
                    <Card
                      sx={{
                        bgcolor: handPreset === presetName ? 'primary.dark' : '#2a2a2a',
                        cursor: 'pointer','&:hover': { bgcolor: handPreset === presetName ? 'primary.dark' : '#333' }}}
                    >
                      <CardActionArea onClick={() => onHandPresetChange(presetName)}>
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                          <Typography variant="caption" align="center" display="block" sx={{ textTransform: 'capitalize' }}>
                            {presetName.replace(/([A-Z])/g, ' $1').trim()}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Hand Gesture
              </Typography>
              <Grid container spacing={1}>
                {(Object.keys(GESTURE_ICONS) as HandGesture[]).map((gestureName) => (
                  <Grid item xs={4} key={gestureName}>
                    <Card
                      sx={{
                        bgcolor: gesture === gestureName ? 'primary.dark' : '#2a2a2a',
                        cursor: 'pointer','&:hover': { bgcolor: gesture === gestureName ? 'primary.dark' : '#333' }}}
                    >
                      <CardActionArea onClick={() => onGestureChange(gestureName)}>
                        <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                          <Typography variant="caption" align="center" display="block">
                            {GESTURE_ICONS[gestureName]}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Tips */}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Tips:</strong>
            </Typography>
            <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: '0.875rem' }}>
              <li>Full poses set head, hands, and gesture together</li>
              <li>Use "portrait" style for subtle, natural movement</li>
              <li>Use"dramatic" style for more expressive poses</li>
              <li>Subject will subtly breathe and sway automatically</li>
            </ul>
          </Alert>
        </Stack>
      )}
    </Paper>
  );
};

export default BodyAnimationPanel;

