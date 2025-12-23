import * as React from 'react';
import { AppBar, Toolbar, IconButton, Stack, Tooltip, Box, Typography, TextField, Button } from '@mui/material';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { useActions, useNodes } from '@/state/selectors';
import { colors, spacing } from '@/styles/designTokens';
import { EnhancedTextField } from '@/ui/components/EnhancedTextField';

export default function Topbar() {
  const { addNode, updateNode } = useActions();
  const nodes = useNodes();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // Find the first camera node - use ref to track ID and prevent unnecessary re-finds
  const cameraNodeRef = React.useRef<string | undefined>();
  const cameraNode = React.useMemo(() => {
    const cam = nodes.find((n) => n.type === 'camera');
    if (cam?.id !== cameraNodeRef.current) {
      cameraNodeRef.current = cam?.id;
    }
    return cam;
  }, [nodes]);

  // Camera settings from the camera node - memoize to prevent unnecessary recalculations
  const cameraSettings = React.useMemo(() => {
    if (!cameraNode?.camera) {
      return { focalLength: 50, aperture: 2.8, iso: 100, shutter: 1 / 125 };
    }
    return {
      focalLength: cameraNode.camera.focalLength ?? 50,
      aperture: cameraNode.camera.aperture ?? 2.8,
      iso: cameraNode.camera.iso ?? 100,
      shutter: cameraNode.camera.shutter ?? 1 / 125,
    };
  }, [
    cameraNode?.id,
    cameraNode?.camera?.focalLength,
    cameraNode?.camera?.aperture,
    cameraNode?.camera?.iso,
    cameraNode?.camera?.shutter,
  ]);

  const { focalLength, aperture, iso, shutter } = cameraSettings;

  // Handle camera setting changes - memoized to prevent infinite loops
  const handleCameraChange = React.useCallback((field: string, value: number) => {
    if (!cameraNode?.id) return;
    updateNode(cameraNode.id, {
      camera: {
        ...cameraNode.camera,
        [field]: value,
      },
    });
  }, [cameraNode?.id, cameraNode?.camera, updateNode]);
  return (
    <AppBar elevation={0} position="static" sx={{ bgcolor: colors.background.panel, color: colors.text.primary }}>
      <Toolbar sx={{ minHeight: 80, px: spacing.md, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Top row: Logo, Project Title, Controls */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', mb: 1 }}>
          {/* Logo/Title */}
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, color: colors.text.primary, minWidth: 200 }}>
            CreatorHub Virtual Studio
          </Typography>
          
          {/* Project Title (Center) */}
          <Typography 
            variant="body1" 
            sx={{ 
              flex: 1, 
              textAlign: 'center', 
              fontWeight: 600, 
              fontSize: 14, 
              color: colors.text.secondary,
              fontStyle: 'italic'
            }}
          >
            LEMY BRIDAL PORTRAIT - SOFTBOX + RIM
          </Typography>
          
          {/* Window Controls */}
          <Stack direction="row" spacing={0.5}>
            <IconButton 
              size="small" 
              sx={{ 
                color: colors.text.primary, 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  transform: 'scale(1.1)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              <Typography sx={{ fontSize: 12 }}>−</Typography>
            </IconButton>
            <IconButton 
              size="small" 
              sx={{ 
                color: colors.text.primary, 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  transform: 'scale(1.1)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              <Typography sx={{ fontSize: 12 }}>□</Typography>
            </IconButton>
            <IconButton 
              size="small" 
              sx={{ 
                color: colors.text.primary, 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.error,
                  transform: 'scale(1.1)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              <Typography sx={{ fontSize: 12 }}>×</Typography>
            </IconButton>
          </Stack>
        </Stack>
        
        {/* Bottom row: Playback, Camera Controls, Export */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
          {/* Playback Controls */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton 
              size="small" 
              sx={{ 
                color: colors.text.primary, 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  transform: 'scale(1.1)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              <SkipPreviousIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              sx={{ 
                color: colors.text.primary, 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  transform: 'scale(1.15)',
                  boxShadow: '0 2px 8px rgba(255,255,255,0.2)'
                },
                '&:active': {
                  transform: 'scale(0.9)',
                  bgcolor: colors.background.card
                }
              }}
            >
              <PlayArrowIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              sx={{ 
                color: colors.text.primary, 
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: colors.background.elevated,
                  transform: 'scale(1.1)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              <SkipNextIcon fontSize="small" />
            </IconButton>
          </Stack>
          
          {/* Camera Settings */}
          <Stack direction="row" spacing={1} alignItems="center">
            <EnhancedTextField
              size="small"
              value={focalLength}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 50;
                if (val !== focalLength) {
                  handleCameraChange('focalLength', val);
                }
              }}
              sx={{
                width: 50,
                '& .MuiInputBase-root': { 
                  height: 28, 
                  fontSize: 12
                },
                '& input': { py: 0.5, px: 1 }
              }}
              inputProps={{ min: 14, max: 200, step: 1 }}
            />
            <EnhancedTextField
              size="small"
              value={aperture}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 2.8;
                if (val !== aperture) {
                  handleCameraChange('aperture', val);
                }
              }}
              sx={{
                width: 50,
                '& .MuiInputBase-root': { 
                  height: 28, 
                  fontSize: 12
                },
                '& input': { py: 0.5, px: 1 }
              }}
              inputProps={{ min: 1.4, max: 22, step: 0.1 }}
            />
            <EnhancedTextField
              size="small"
              value={`1/${Math.round(1/shutter)}`}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 125;
                if (val !== 1/shutter) {
                  handleCameraChange('shutter', 1/val);
                }
              }}
              sx={{
                width: 60,
                '& .MuiInputBase-root': { 
                  height: 28, 
                  fontSize: 12
                },
                '& input': { py: 0.5, px: 1 }
              }}
            />
            <EnhancedTextField
              size="small"
              value={iso}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 100;
                if (val !== iso) {
                  handleCameraChange('iso', val);
                }
              }}
              sx={{
                width: 50,
                '& .MuiInputBase-root': { 
                  height: 28, 
                  fontSize: 12
                },
                '& input': { py: 0.5, px: 1 }
              }}
              inputProps={{ min: 100, max: 25600, step: 100 }}
            />
            <EnhancedTextField
              size="small"
              defaultValue="Cam A S"
              sx={{
                width: 80,
                '& .MuiInputBase-root': { 
                  height: 28, 
                  fontSize: 12
                },
                '& input': { py: 0.5, px: 1 }
              }}
            />
          </Stack>
          
          {/* Export Button */}
          <Button
            variant="outlined"
            size="small"
            sx={{
              ml: 'auto',
              textTransform: 'none',
              borderColor: colors.border.default,
              color: colors.text.primary,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#5a5a5a',
                bgcolor: '#2a2a2a',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              },
              '&:active': {
                transform: 'translateY(0)'
              }
            }}
          >
            Export PDF
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
