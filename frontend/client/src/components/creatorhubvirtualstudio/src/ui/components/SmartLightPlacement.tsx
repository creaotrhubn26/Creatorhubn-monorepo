/**
 * Smart Light Placement Component
 * 
 * Shows pattern detection, angle indicators, and contextual tips when placing lights
 */

import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, Paper, Tooltip, IconButton, Collapse, Button, CircularProgress, Alert } from '@mui/material';
import {
  Lightbulb as LightIcon,
  TipsAndUpdates as TipIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  AutoAwesome,
} from '@mui/icons-material';
import { DetectedPattern, LightPlacementTip } from '@/core/services/patternDetectionService';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

interface SmartLightPlacementProps {
  position: [number, number, number];
  detectedPattern: DetectedPattern | null;
  tips: LightPlacementTip[];
  onClose?: () => void;
  imageUrl?: string; // Optional: For SAM 2 subject detection
  onLightPositionSuggest?: (suggestedPosition: [number, number, number]) => void;
}

export function SmartLightPlacement({
  position,
  detectedPattern,
  tips,
  onClose,
}: SmartLightPlacementProps) {
  const [expanded, setExpanded] = React.useState(true);

  if (!detectedPattern && tips.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 320,
        maxHeight: '80vh',
        overflow: 'auto',
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: 2,
        zIndex: 100}}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'}}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightIcon sx={{ color: '#F59E0B' }} />
          <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600}}>
            Smart Light Placement
          </Typography>
        </Box>
        <Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
          {onClose && (
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      <Collapse in={expanded}>
        {/* SAM 2 Subject Detection */}
        {imageUrl && (
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                AI Subject Detection
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={detectSubject.isPending ? <CircularProgress size={14} /> : <AutoAwesome />}
                onClick={() => detectSubject.mutate()}
                disabled={detectSubject.isPending}
              >
                {detectSubject.isPending ? 'Detecting...' : 'Detect Subject'}
              </Button>
            </Box>
            {subjectBounds && (
              <Alert severity="success" sx={{ mt: 1 }}>
                Subject detected at ({subjectBounds.center[0].toFixed(0)}, {subjectBounds.center[1].toFixed(0)})
              </Alert>
            )}
            {suggestedLightPosition && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Suggested light position: ({suggestedLightPosition[0].toFixed(2)}, {suggestedLightPosition[1].toFixed(2)}, {suggestedLightPosition[2].toFixed(2)})
              </Alert>
            )}
          </Box>
        )}

        {/* Pattern Detection */}
        {detectedPattern && (
          <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                🎯 Pattern Detected
              </Typography>
              <Chip
                label={`${Math.round(detectedPattern.confidence * 100)}%`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 11,
                  bgcolor:
                    detectedPattern.confidence > 0.8
                      ? '#10B981'
                      : detectedPattern.confidence > 0.5
                      ? '#F59E0B' : '#6B7280',
                  color: '#fff'}}
              />
            </Box>

            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {detectedPattern.name}
            </Typography>

            <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mb: 1 }}>
              {detectedPattern.role.replace('_',',').toUpperCase()}
            </Typography>

            {/* Angle Indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                bgcolor: '#F3F4F6',
                borderRadius: 1}}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
                  Current Angle
                </Typography>
                <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 70, color: '#1F2937' }}>
                  {detectedPattern.actualAngle}°
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#6B7280', display: 'block' }}>
                  Expected
                </Typography>
                <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 70, color: '#10B981' }}>
                  {detectedPattern.expectedAngle}°
                </Typography>
              </Box>
            </Box>

            {detectedPattern.distance > 0.1 && (
              <Typography variant="caption" sx={{ color: '#F59E0B', display: 'block', mt: 1 }}>
                📍 {detectedPattern.distance.toFixed(2)}m from ideal position
              </Typography>
            )}
          </Box>
        )}

        {/* Contextual Tips */}
        {tips.length > 0 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <TipIcon sx={{ fontSize: 18, color: '#3B82F6' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                Tips & Guidance
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {tips.map((tip, index) => (
                <TipCard key={index} tip={tip} />
              ))}
            </Box>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}

function TipCard({ tip }: { tip: LightPlacementTip }) {
  const categoryColors: Record<string, string> = {
    positioning: '#3B82F6',
    power: '#F59E0B',
    modifier: '#8B5CF6',
    angle: '#10B981',
    height: '#EC4899',
  };

  const bgColor = categoryColors[tip.category] || '#6B7280';

  return (
    <Tooltip title={tip.description} placement="left" arrow>
      <Box
        sx={{
          p: 1.5,
          bgcolor: '#F9FAFB',
          borderLeft: `3px solid ${bgColor}`,
          borderRadius: 1,
          cursor: 'help',
          transition: 'all 0.2s', '&:hover': {
            bgcolor: '#F3F4F6',
            transform: 'translateX(-2px)',
          }}}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography sx={{ fontSize: 18 }}>{tip.icon}</Typography>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              {tip.title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6B7280', fontSize: 11, lineHeight: 1.4 }}>
              {tip.description}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Tooltip>
  );
}

