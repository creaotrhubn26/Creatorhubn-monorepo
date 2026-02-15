/**
 * Shot Planner Guides & Visualization Panel
 * 
 * UI controls for enabling/disabling advanced visualization guides:
 * - Camera frustums
 * - Motion paths
 * - 180-degree safety lines
 * - Line of action
 * - Measurement tools
 * - Focus/DoF visualization
 */

import React from 'react';
import {
  Box,
  Paper,
  FormControlLabel,
  Switch,
  Stack,
  Divider,
  Typography,
  Tooltip,
  Slider,
  Alert,
} from '@mui/material';
import {
  Videocam as CameraIcon,
  Straighten as MeasureIcon,
  Visibility as EyeIcon,
} from '@mui/icons-material';
import { useShotPlannerStore, useCurrentScene } from './store';

export const GuidesPanel: React.FC = () => {
  const scene = useCurrentScene();
  const { toggleVisualization, updateScene } = useShotPlannerStore();

  if (!scene) return null;

  return (
    <Paper
      sx={{
        p: 2,
        backgroundColor: 'rgba(30, 45, 61, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 2,
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EyeIcon sx={{ color: '#4FC3F7', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
            Visualization Guides
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Camera Frustums */}
        <Tooltip title="Show camera view cones (what each camera sees)">
          <FormControlLabel
            control={
              <Switch
                checked={scene.showFrustums ?? false}
                onChange={() => toggleVisualization('showFrustums')}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CameraIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                <span style={{ fontSize: '0.9rem' }}>Camera Frustums</span>
              </Box>
            }
          />
        </Tooltip>

        {/* Motion Paths */}
        <Tooltip title="Show camera movement paths for dynamic shots">
          <FormControlLabel
            control={
              <Switch
                checked={scene.showMotionPaths ?? false}
                onChange={() => toggleVisualization('showMotionPaths')}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: '12px', color: '#2196F3', fontWeight: 'bold' }}>→</span>
                <span style={{ fontSize: '0.9rem' }}>Motion Paths</span>
              </Box>
            }
          />
        </Tooltip>

        {/* 180-Degree Line */}
        <Tooltip title="Show safety line - safe side of 180° rule">
          <FormControlLabel
            control={
              <Switch
                checked={scene.show180Line ?? false}
                onChange={() => toggleVisualization('show180Line')}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ fontSize: '12px', color: '#FF5722', fontWeight: 'bold' }}>180°</span>
                <span style={{ fontSize: '0.9rem' }}>Safety Line</span>
              </Box>
            }
          />
        </Tooltip>

        {/* Measurement Tools */}
        <Tooltip title="Show measurement guides and distance labels">
          <FormControlLabel
            control={
              <Switch
                checked={scene.showMeasurements ?? false}
                onChange={() => toggleVisualization('showMeasurements')}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MeasureIcon sx={{ fontSize: 16, color: '#FFD700' }} />
                <span style={{ fontSize: '0.9rem' }}>Measurements</span>
              </Box>
            }
          />
        </Tooltip>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Camera Settings Header */}
        <Typography variant="subtitle2" sx={{ color: '#4FC3F7', fontSize: '0.85rem', mt: 1 }}>
          Camera Focus Settings
        </Typography>

        {/* Focus Distance for Selected Camera */}
        {scene.cameras.length > 0 && (
          <>
            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: '#8896A6' }}>
                Focus Distance (m)
              </Typography>
              <Slider
                value={scene.cameras[0].focusDistance ?? 5}
                onChange={(_, value) => {
                  const camera = scene.cameras[0];
                  if (camera) {
                    useShotPlannerStore.setState(state => {
                      if (!state.scene) return state;
                      return {
                        scene: {
                          ...state.scene,
                          cameras: state.scene.cameras.map(c =>
                            c.id === camera.id
                              ? { ...c, focusDistance: value as number }
                              : c
                          ),
                        },
                      };
                    });
                  }
                }}
                min={0.5}
                max={50}
                step={0.5}
                marks={[
                  { value: 0.5, label: '0.5m' },
                  { value: 25, label: '25m' },
                  { value: 50, label: '50m' },
                ]}
                sx={{ mt: 2 }}
              />
            </Box>

            <Box sx={{ px: 1 }}>
              <Typography variant="caption" sx={{ color: '#8896A6' }}>
                Depth of Field (m)
              </Typography>
              <Slider
                value={scene.cameras[0].depthOfField ?? 2}
                onChange={(_, value) => {
                  const camera = scene.cameras[0];
                  if (camera) {
                    useShotPlannerStore.setState(state => {
                      if (!state.scene) return state;
                      return {
                        scene: {
                          ...state.scene,
                          cameras: state.scene.cameras.map(c =>
                            c.id === camera.id
                              ? { ...c, depthOfField: value as number }
                              : c
                          ),
                        },
                      };
                    });
                  }
                }}
                min={0.1}
                max={10}
                step={0.1}
                sx={{ mt: 2 }}
              />
            </Box>
          </>
        )}

        <Alert severity="info" sx={{ fontSize: '0.8rem', mt: 1 }}>
          Enable guides to visualize advanced filmmaking techniques. All settings auto-save to database.
        </Alert>
      </Stack>
    </Paper>
  );
};

export default GuidesPanel;
