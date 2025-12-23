/**
 * Pose Library Panel
 * UI for browsing and applying professional photography poses
 */

import React, { useState } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('PoseLibraryPanel, ');
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Person,
  Checkroom,
  Business,
  FitnessCenter,
  TheaterComedy,
  Blender,
} from '@mui/icons-material';
import {
  ALL_POSES,
  getPosesByCategory,
  PosePreset,
  BONE_NAMES,
} from '../../core/animation/PoseLibrary';
import { IKSystem } from '../../core/animation/IKSystem';

interface PoseLibraryPanelProps {
  ikSystem: IKSystem | null;
  onApplyPose?: (pose: PosePreset) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  portrait: <Person />,
  fashion: <Checkroom />,
  commercial: <Business />,
  editorial: <TheaterComedy />,
  fitness: <FitnessCenter />,
  dance: <TheaterComedy />,
};

const DIFFICULTY_COLORS: Record<string'success' | 'warning' | 'error'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'error',
};

export const PoseLibraryPanel: React.FC<PoseLibraryPanelProps> = ({
  ikSystem,
  onApplyPose,
}) => {
  const [activeCategory, setActiveCategory] = useState<PosePreset['category']>('portrait');
  const [blendAmount, setBlendAmount] = useState(100);
  const [selectedPoseA, setSelectedPoseA] = useState<PosePreset | null>(null);
  const [selectedPoseB, setSelectedPoseB] = useState<PosePreset | null>(null);

  const poses = getPosesByCategory(activeCategory);

  const handleApplyPose = (pose: PosePreset) => {
    if (!ikSystem) {
      log.warn('IK System not available, ');
      return;
    }

    ikSystem.applyPose(pose.pose);
    onApplyPose?.(pose);
  };

  const handleBlendPoses = () => {
    if (!ikSystem || !selectedPoseA || !selectedPoseB) {
      log.warn('IK System or poses not available');
      return;
    }

    const alpha = blendAmount / 100;
    const blendedPose = ikSystem.blendPoses(selectedPoseA.pose, selectedPoseB.pose, alpha);
    ikSystem.applyPose(blendedPose);
  };

  const handleResetTPose = () => {
    if (!ikSystem) {
      log.warn('IK System not available');
      return;
    }

    ikSystem.resetToTPose();
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Blender />
        Pose Library
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Professional photography poses for portrait, fashion, and commercial work
      </Typography>

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onChange={(_, value) => setActiveCategory(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="portrait"
          label="Portrait"
          icon={CATEGORY_ICONS.portrait}
          iconPosition="start"
        />
        <Tab
          value="fashion"
          label="Fashion"
          icon={CATEGORY_ICONS.fashion}
          iconPosition="start"
        />
        <Tab
          value="commercial"
          label="Commercial"
          icon={CATEGORY_ICONS.commercial}
          iconPosition="start"
        />
        <Tab
          value="editorial"
          label="Editorial"
          icon={CATEGORY_ICONS.editorial}
          iconPosition="start"
        />
        <Tab
          value="fitness"
          label="Fitness"
          icon={CATEGORY_ICONS.fitness}
          iconPosition="start"
        />
        <Tab value="dance" label="Dance" icon={CATEGORY_ICONS.dance} iconPosition="start" />
      </Tabs>

      {/* Pose Grid */}
      <Box sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
        <Grid container spacing={2}>
          {poses.map((pose) => (
            <Grid item xs={12} sm={6} md={4} key={pose.id}>
              <Card
                sx={{
                  backgroundColor: '#2a2a2a', '&:hover': { backgroundColor: '#333' },
                  cursor: 'pointer'}}
              >
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    {pose.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pose.description}
                  </Typography>
                  <Chip
                    label={pose.difficulty}
                    size="small"
                    color={DIFFICULTY_COLORS[pose.difficulty]}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </CardContent>
                <CardActions>
                  <Tooltip title="Apply this pose to the character" placement="top">
                    <Button size="small" onClick={() => handleApplyPose(pose)}>
                      Apply
                    </Button>
                  </Tooltip>
                  <Tooltip title="Set as Pose A for blending" placement="top">
                    <Button size="small" onClick={() => setSelectedPoseA(pose)}>
                      Set A
                    </Button>
                  </Tooltip>
                  <Tooltip title="Set as Pose B for blending" placement="top">
                    <Button size="small" onClick={() => setSelectedPoseB(pose)}>
                      Set B
                    </Button>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#444' }} />

      {/* Pose Blending */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Pose Blending
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Pose A</InputLabel>
              <Select
                value={selectedPoseA?.id || ', '}
                label="Pose A"
                onChange={(e) => {
                  const pose = ALL_POSES.find((p) => p.id === e.target.value);
                  setSelectedPoseA(pose || null);
                }}
              >
                {ALL_POSES.map((pose) => (
                  <MenuItem key={pose.id} value={pose.id}>
                    {pose.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Pose B</InputLabel>
              <Select
                value={selectedPoseB?.id || ', '}
                label="Pose B"
                onChange={(e) => {
                  const pose = ALL_POSES.find((p) => p.id === e.target.value);
                  setSelectedPoseB(pose || null);
                }}
              >
                {ALL_POSES.map((pose) => (
                  <MenuItem key={pose.id} value={pose.id}>
                    {pose.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ px: 2 }}>
          <Typography variant="body2" gutterBottom>
            Blend Amount: {blendAmount}%
          </Typography>
          <Tooltip title="Mix between two poses (0%=Pose A, 100%=Pose B)" placement="top">
            <Slider
              value={blendAmount}
              onChange={(_, value) => setBlendAmount(value as number)}
              min={0}
              max={100}
              step={1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}%`}
              marks={[
                { value: 0, label: 'A' },
                { value: 50, label: '50%' },
                { value: 100, label: 'B' },
              ]}
              disabled={!selectedPoseA || !selectedPoseB}
            />
          </Tooltip>
        </Box>

        <Tooltip title="Apply the blended pose to the character" placement="top">
          <span>
            <Button
              variant="contained"
              fullWidth
              onClick={handleBlendPoses}
              disabled={!selectedPoseA || !selectedPoseB || !ikSystem}
              sx={{ mt: 1 }}
            >
              Apply Blended Pose
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#444' }} />

      {/* Quick Actions */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleResetTPose}
              disabled={!ikSystem}
            >
              Reset T-Pose
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                if (ikSystem) {
                  const currentPose = ikSystem.capturePose('custom');
                  log.debug('Captured pose: ', currentPose);
                }
              }}
              disabled={!ikSystem}
            >
              Capture Pose
            </Button>
          </Grid>
        </Grid>
      </Box>

      {!ikSystem && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            backgroundColor: '#2a2a2a',
            borderRadius: 1,
            border:'1px dashed #666'}}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            Load a character model to use pose presets
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default PoseLibraryPanel;

