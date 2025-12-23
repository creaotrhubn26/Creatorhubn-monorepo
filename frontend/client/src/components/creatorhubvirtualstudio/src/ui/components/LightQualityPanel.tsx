/**
 * Light Quality Panel
 * 
 * Displays professional light quality metrics:
 * - CRI (Color Rendering Index)
 * - TLCI (Television Lighting Consistency Index)
 * - CCT (Correlated Color Temperature)
 * - Duv (Distance from blackbody curve)
 * - Flicker percentage
 */

import React, { useMemo } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('LightQualityPanel');
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  Tooltip,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  CheckCircle as ExcellentIcon,
  ThumbUp as GoodIcon,
  Warning as FairIcon,
  Error as PoorIcon,
} from '@mui/icons-material';
import { lightQualityService } from '@/core/services/lightQualityService';
import { spectralCRIService } from '@/core/services/spectralCRIService';
import { spectralDataService } from '@/core/services/spectralDataService';

interface LightQualityPanelProps {
  cct: number;
  lightType?: 'tungsten' | 'halogen' | 'led-warm' | 'led-cool' | 'hmi';
  useSpectralCRI?: boolean; // Use full spectral CRI (Phase 9) for maximum accuracy
}

export function LightQualityPanel({ cct, lightType = 'led-warm', useSpectralCRI = true }: LightQualityPanelProps) {
  const quality = useMemo(() => {
    // Use spectral CRI for maximum accuracy (Phase 9)
    if (useSpectralCRI) {
      try {
        // Generate SPD based on light type
        let testSPD;
        if (lightType === 'tungsten' || lightType === 'halogen') {
          testSPD = spectralDataService.generatePlanckianSPD(cct);
        } else if (lightType === 'hmi') {
          testSPD = spectralDataService.D65_SPD; // HMI approximates daylight
        } else {
          // For LED, use Planckian SPD as approximation
          testSPD = spectralDataService.generatePlanckianSPD(cct);
        }

        const spectralCRI = spectralCRIService.calculateSpectralCRI(testSPD, cct);
        const spectralTLCI = spectralCRIService.calculateSpectralTLCI(testSPD, cct);

        // Use FULL spectral calculations (Phase 9 - maximum accuracy)
        return {
          cri: {
            ra: Math.round(spectralCRI.ra),
            r9: Math.round(spectralCRI.r9),
            r13: Math.round(spectralCRI.r13),
            r15: Math.round(spectralCRI.r15),
            rating: spectralCRI.rating,
          },
          tlci: {
            tlci: Math.round(spectralTLCI.tlci),
            rating: spectralTLCI.rating,
          },
          cct: cct,
          flicker: 0, // Not calculated in spectral version
          duv: 0, // Not calculated in spectral version
          overallRating: spectralCRI.rating,
        };
      } catch (error) {
        log.warn('Spectral CRI calculation failed, falling back to simplified: ', error);
        return lightQualityService.calculateLightQuality(cct, lightType);
      }
    }

    // Fallback to simplified CRI
    return lightQualityService.calculateLightQuality(cct, lightType);
  }, [cct, lightType, useSpectralCRI]);

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return <ExcellentIcon sx={{ color: '#4CAF50', fontSize: 16 }} />;
      case 'very-good':
      case 'good':
        return <GoodIcon sx={{ color: '#8BC34A', fontSize: 16 }} />;
      case 'fair':
        return <FairIcon sx={{ color: '#FF9800', fontSize: 16 }} />;
      case 'poor':
        return <PoorIcon sx={{ color: '#F44336', fontSize: 16 }} />;
      default:
        return null;
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return '#4CAF50';
      case 'very-good':
      case 'good':
        return '#8BC34A';
      case 'fair':
        return '#FF9800';
      case 'poor':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#f9f9f9', border: '1px solid #e0e0e0' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
        📊 Light Quality Metrics
      </Typography>

      {/* Overall Rating */}
      <Box sx={{ mb: 2, p: 1.5, bgcolor: 'white', borderRadius: 1, border: '1px solid #e0e0e0' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {getRatingIcon(quality.overallRating)}
          <Typography variant="body2" sx={{ fontWeight: 600}}>
            Overall: {quality.overallRating.toUpperCase()}
          </Typography>
        </Stack>
      </Box>

      {/* CRI (Color Rendering Index) */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Tooltip title="Color Rendering Index - How accurately colors are rendered (CIE 13.3-1995)">
            <Typography variant="caption" sx={{ fontWeight: 600}}>
              CRI (Ra)
            </Typography>
          </Tooltip>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {getRatingIcon(quality.cri.rating)}
            <Typography variant="caption" sx={{ fontWeight: 600}}>
              {quality.cri.ra}
            </Typography>
          </Stack>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={quality.cri.ra}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
              bgcolor: getRatingColor(quality.cri.rating),
            }}}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <Tooltip title="R9 - Red saturation (critical for skin tones)">
            <Chip label={`R9: ${quality.cri.r9}`} size="small" sx={{ height: 18, fontSize: 10 }} />
          </Tooltip>
          <Tooltip title="R13 - Caucasian skin tone">
            <Chip label={`R13: ${quality.cri.r13}`} size="small" sx={{ height: 18, fontSize: 10 }} />
          </Tooltip>
          <Tooltip title="R15 - Asian skin tone">
            <Chip label={`R15: ${quality.cri.r15}`} size="small" sx={{ height: 18, fontSize: 10 }} />
          </Tooltip>
        </Stack>
      </Box>

      {/* TLCI (Television Lighting Consistency Index) */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
          <Tooltip title="Television Lighting Consistency Index - Broadcast quality (EBU Tech 3355)">
            <Typography variant="caption" sx={{ fontWeight: 600}}>
              TLCI
            </Typography>
          </Tooltip>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {getRatingIcon(quality.tlci.rating)}
            <Typography variant="caption" sx={{ fontWeight: 600}}>
              {quality.tlci.tlci}
            </Typography>
          </Stack>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={quality.tlci.tlci}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': {
              bgcolor: getRatingColor(quality.tlci.rating),
            }}}
        />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Additional Metrics */}
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Tooltip title="Correlated Color Temperature">
            <Typography variant="caption" sx={{ color: '#666' }}>
              CCT
            </Typography>
          </Tooltip>
          <Typography variant="caption" sx={{ fontWeight: 600}}>
            {quality.cct}K
          </Typography>
        </Stack>
        
        <Stack direction="row" justifyContent="space-between">
          <Tooltip title="Distance from blackbody curve (Δuv) - Lower is better">
            <Typography variant="caption" sx={{ color: '#666' }}>
              Duv
            </Typography>
          </Tooltip>
          <Typography variant="caption" sx={{ fontWeight: 600}}>
            {quality.duv.toFixed(4)}
          </Typography>
        </Stack>
        
        <Stack direction="row" justifyContent="space-between">
          <Tooltip title="Flicker percentage - Lower is better">
            <Typography variant="caption" sx={{ color: '#666' }}>
              Flicker
            </Typography>
          </Tooltip>
          <Typography variant="caption" sx={{ fontWeight: 600, color: quality.flicker < 5 ? '#4CAF50' : '#FF9800' }}>
            {quality.flicker}%
          </Typography>
        </Stack>
      </Stack>

      {/* Professional Standards Reference */}
      <Box sx={{ mt: 2, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ color: '#1976d2', display: 'block', fontWeight: 600}}>
          📚 Professional Standards
        </Typography>
        <Typography variant="caption" sx={{ color: '#1976d2', display:'block', fontSize: 9 }}>
          CRI 95+: Film/TV • TLCI 95+: Broadcast
        </Typography>
      </Box>
    </Paper>
  );
}

