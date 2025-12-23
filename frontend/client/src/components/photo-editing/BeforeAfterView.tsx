/**
 * BEFORE/AFTER VIEW
 * Lightroom-style before/after comparison
 * Supports side-by-side, top/bottom, and split views
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  IconButton,
  Stack,
  Slider,
  Tooltip,
} from '@mui/material';
import {
  CompareArrows,
  ViewColumn,
  ViewAgenda,
  CropFree,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export type ViewMode = 'side-by-side' | 'top-bottom' | 'split' | 'toggle';

interface BeforeAfterViewProps {
  beforeUrl: string;
  afterUrl: string;
  onViewModeChange?: (mode: ViewMode) => void;
  initialMode?: ViewMode;
}

export default function BeforeAfterView({
  beforeUrl,
  afterUrl,
  onViewModeChange,
  initialMode = 'side-by-side',
}: BeforeAfterViewProps) {
  const theming = useTheming('photographer');
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [splitPosition, setSplitPosition] = useState(50); // 0-100 for split view
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLImageElement>(null);
  const afterRef = useRef<HTMLImageElement>(null);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    onViewModeChange?.(mode);
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <Paper
      ref={containerRef}
      sx={{
        p: 2,
        position: 'relative',
        ...theming.getThemedCardSx(),
        ...(isFullscreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          borderRadius: 0,
        })}}
    >
      <Stack spacing={2}>
        {/* Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Before / After
          </Typography>
          <Stack direction="row" spacing={1}>
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Side by Side">
                <Button
                  onClick={() => handleViewModeChange('side-by-side')}
                  variant={viewMode === 'side-by-side' ? 'contained' : 'outlined'}
                >
                  <ViewColumn />
                </Button>
              </Tooltip>
              <Tooltip title="Top / Bottom">
                <Button
                  onClick={() => handleViewModeChange('top-bottom')}
                  variant={viewMode === 'top-bottom' ? 'contained' : 'outlined'}
                >
                  <ViewAgenda />
                </Button>
              </Tooltip>
              <Tooltip title="Split View">
                <Button
                  onClick={() => handleViewModeChange('split')}
                  variant={viewMode === 'split' ? 'contained' : 'outlined'}
                >
                  <CropFree />
                </Button>
              </Tooltip>
              <Tooltip title="Toggle">
                <Button
                  onClick={() => handleViewModeChange('toggle')}
                  variant={viewMode === 'toggle' ? 'contained' : 'outlined'}
                >
                  <CompareArrows />
                </Button>
              </Tooltip>
            </ButtonGroup>

            {viewMode === 'split' && (
              <Box sx={{ width: 200, mx: 2 }}>
                <Slider
                  value={splitPosition}
                  onChange={(_, v) => setSplitPosition(v as number)}
                  min={0}
                  max={100}
                  size="small"
                />
              </Box>
            )}

            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Zoom Out">
                <IconButton size="small" onClick={() => setZoom(Math.max(25, zoom - 25))}>
                  <ZoomOut />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom In">
                <IconButton size="small" onClick={() => setZoom(Math.min(400, zoom + 25))}>
                  <ZoomIn />
                </IconButton>
              </Tooltip>
              <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <IconButton size="small" onClick={handleFullscreen}>
                  {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        {/* Image Comparison */}
        <Box
          sx={{
            position: 'relative',
            overflow: 'auto',
            bgcolor: '#000',
            borderRadius: 1,
            minHeight: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'}}
        >
          {viewMode === 'side-by-side' && (
            <Box sx={{ display: 'flex', width: '100%', height: '100%' }}>
              <Box sx={{ flex: 1, position: 'relative' }}>
                <img
                  ref={beforeRef}
                  src={beforeUrl}
                  alt="Before"
                  style={{
                    width: '100%',
                    height: 'auto',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'left center'}}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '12px'}}
                >
                  BEFORE
                </Box>
              </Box>
              <Box sx={{ width: 2, bgcolor: '#333' }} />
              <Box sx={{ flex: 1, position: 'relative' }}>
                <img
                  ref={afterRef}
                  src={afterUrl}
                  alt="After"
                  style={{
                    width: '100%',
                    height: 'auto',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'right center'}}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '12px'}}
                >
                  AFTER
                </Box>
              </Box>
            </Box>
          )}

          {viewMode === 'top-bottom' && (
            <Box sx={{ width: '100%' }}>
              <Box sx={{ position: 'relative', mb: 0.5 }}>
                <img
                  ref={beforeRef}
                  src={beforeUrl}
                  alt="Before"
                  style={{
                    width: '100%',
                    height: 'auto',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center'}}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '12px'}}
                >
                  BEFORE
                </Box>
              </Box>
              <Box sx={{ height: 2, bgcolor: '#333', my: 0.5 }} />
              <Box sx={{ position: 'relative' }}>
                <img
                  ref={afterRef}
                  src={afterUrl}
                  alt="After"
                  style={{
                    width: '100%',
                    height: 'auto',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'bottom center'}}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '12px'}}
                >
                  AFTER
                </Box>
              </Box>
            </Box>
          )}

          {viewMode === 'split' && (
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                ref={beforeRef}
                src={beforeUrl}
                alt="Before"
                style={{
                  width: '100%',
                  height: 'auto',
                  transform: `scale(${zoom / 100})`}}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${splitPosition}%`,
                  height: '100%',
                  overflow: 'hidden',
                  borderRight: '2px solid #fff'}}
              >
                <img
                  ref={afterRef}
                  src={afterUrl}
                  alt="After"
                  style={{
                    width: `${(100 / splitPosition) * 100}%`,
                    height: 'auto',
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'left center'}}
                />
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: `${splitPosition}%`,
                  transform: 'translate(-50%, -50%)',
                  bgcolor: 'rgba(255,255,255,0.9)',
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'ew-resize',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'}}
              >
                <CompareArrows />
              </Box>
            </Box>
          )}

          {viewMode === 'toggle' && (
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                ref={beforeRef}
                src={beforeUrl}
                alt="Before"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: splitPosition < 50 ? 'block' : 'none',
                  transform: `scale(${zoom / 100})`}}
              />
              <img
                ref={afterRef}
                src={afterUrl}
                alt="After"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: splitPosition >= 50 ? 'block' : 'none',
                  transform: `scale(${zoom / 100})`}}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)'}}
              >
                <Button
                  variant="contained"
                  onClick={() => setSplitPosition(splitPosition < 50 ? 100 : 0)}
                  startIcon={<CompareArrows />}
                >
                  {splitPosition < 50 ? 'Show After' : 'Show Before'}
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary">
          Zoom: {zoom}% | Mode: {viewMode.replace('-', ',')}
        </Typography>
      </Stack>
    </Paper>
  );
}

