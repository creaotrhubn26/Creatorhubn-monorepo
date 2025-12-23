/**
 * Scene Illumination Analysis Panel
 * 
 * Shows real-time analysis of scene lighting including:
 * - Light contribution per light
 * - Key-to-fill ratio
 * - Combined exposure
 * - Color temperature mixing
 * - Shadow quality
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  Divider,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Lightbulb as LightIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { useAppStore } from '@/state/store';
import { shadowAnalysisService } from '@/core/services/shadowAnalysisService';

export function SceneIlluminationPanel() {
  const nodes = useAppStore((s) => s.scene.nodes);

  // Analyze scene
  const analysis = useMemo(() => {
    return shadowAnalysisService.analyzeScene(nodes, [0, 0, 0]);
  }, [nodes]);

  const lightNodes = nodes.filter((n) => n.light && n.visible);

  // Calculate total exposure
  const totalExposure = analysis.totalHighlightIntensity;
  const exposurePercentage = Math.min(totalExposure * 100, 100);

  // Determine exposure status
  const getExposureStatus = () => {
    if (totalExposure < 0.3) return { color: 'error', label: 'Underexposed', icon: <WarningIcon /> };
    if (totalExposure > 2.0) return { color: 'error', label: 'Overexposed', icon: <WarningIcon /> };
    if (totalExposure > 1.5) return { color: 'warning', label: 'Slightly High', icon: <WarningIcon /> };
    return { color: 'success', label: 'Good', icon: <CheckIcon /> };
  };

  const exposureStatus = getExposureStatus();

  // Calculate average CCT
  const avgCCT = useMemo(() => {
    if (lightNodes.length === 0) return 5600;
    const sum = lightNodes.reduce((acc, node) => acc + (node.light?.cct || 5600), 0);
    return Math.round(sum / lightNodes.length);
  }, [lightNodes]);

  // Get CCT color
  const getCCTColor = (cct: number) => {
    if (cct < 3000) return '#FFA500';
    if (cct < 4000) return '#FFD700';
    if (cct < 5000) return '#FFFACD';
    if (cct < 6000) return '#FFFFFF';
    return '#E0F0FF';
  };

  // Determine contrast ratio status
  const getContrastStatus = () => {
    const ratio = analysis.contrastRatio;
    if (ratio < 1.5) return { color: 'warning', label: 'Low Contrast' };
    if (ratio > 8) return { color: 'warning', label: 'High Contrast' };
    if (ratio >= 2 && ratio <= 4) return { color: 'success', label: 'Ideal (2:1 - 4:1)' };
    return { color: 'info', label: 'Moderate' };
  };

  const contrastStatus = getContrastStatus();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon /> Scene Illumination
      </Typography>

      {/* Light Count */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Active Lights: {lightNodes.length}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Exposure Analysis */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Total Exposure
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={exposurePercentage}
            sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
            color={exposureStatus.color as any}
          />
          <Typography variant="caption" fontWeight={600}>
            {totalExposure.toFixed(2)}
          </Typography>
        </Box>
        <Chip
          label={exposureStatus.label}
          color={exposureStatus.color as any}
          size="small"
          icon={exposureStatus.icon}
        />
      </Box>

      {/* Clipping Warning */}
      {analysis.hasClipping && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ⚠️ Highlight clipping detected! Reduce light intensity.
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Contrast Ratio */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Key-to-Fill Ratio
        </Typography>
        <Typography variant="h5" gutterBottom>
          {analysis.contrastRatio.toFixed(1)}:1
        </Typography>
        <Chip
          label={contrastStatus.label}
          color={contrastStatus.color as any}
          size="small"
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Ideal range: 2:1 to 4:1 for portraits
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Color Temperature */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" fontWeight={600} gutterBottom>
          Average Color Temperature
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: getCCTColor(avgCCT),
              border: '2px solid #ccc'}}
          />
          <Typography variant="h6">{avgCCT}K</Typography>
        </Box>
      </Box>
    </Box>
  );
}

