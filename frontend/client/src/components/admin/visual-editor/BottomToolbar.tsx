import React, { useState } from 'react';
import {
  Box,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  Tooltip,
  Typography,
  Divider,
} from '@mui/material';
import {
  Computer,
  Tablet,
  Smartphone,
  Undo,
  Redo,
  PhotoCamera,
  Code,
  RemoveRedEye,
} from '@mui/icons-material';
import { getVisualEditorTokens } from './visualEditorTokens';

export const BottomToolbar: React.FC = () => {
  const tokens = getVisualEditorTokens();
  const [deviceMode, setDeviceMode] = useState('desktop');
  const [zoom, setZoom] = useState(100);
  const iconMotionSx = {
    transition: `transform ${tokens.iconAnimation.durationMs}ms ${tokens.iconAnimation.easing}`,
    '&:hover': { transform: `scale(${tokens.iconAnimation.scaleHover})` },
    '&:active': { transform: `scale(${tokens.iconAnimation.scaleActive})` },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1,
        bgcolor: '#1A1A1A',
        color: 'white',
        borderTop: 1,
        borderColor: '#333',
        height: 56,
      }}>
      {/* Left Section - Brand */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" fontWeight={700} sx={{ letterSpacing: 1 }}>
          {tokens.bottomToolbar.brandLabel}
        </Typography>
      </Box>

      {/* Center Section - Device Toggle & Tools */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Device Mode Selector */}
        <ToggleButtonGroup
          value={deviceMode}
          exclusive
          onChange={(_, value) => value && setDeviceMode(value)}
          size="small"
          sx={{
            bgcolor: '#2A2A2A',
            '& .MuiToggleButton-root': {
              color: 'white',
              border: 'none',
              '&.Mui-selected': {
                bgcolor: '#0066FF',
                color: 'white',
                '&:hover': {
                  bgcolor: '#0052CC',
                },
              },
            },
          }}
        >
          <ToggleButton value="desktop">
            <Tooltip title={tokens.bottomToolbar.deviceModes.desktop}>
              <Computer fontSize="small" sx={iconMotionSx} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="tablet">
            <Tooltip title={tokens.bottomToolbar.deviceModes.tablet}>
              <Tablet fontSize="small" sx={iconMotionSx} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="mobile">
            <Tooltip title={tokens.bottomToolbar.deviceModes.mobile}>
              <Smartphone fontSize="small" sx={iconMotionSx} />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#444' }} />

        {/* Action Buttons */}
        <IconButton size="small" sx={{ color: 'white', ...iconMotionSx }}>
          <Tooltip title={tokens.bottomToolbar.tooltips.undo}>
            <Undo fontSize="small" />
          </Tooltip>
        </IconButton>

        <IconButton size="small" sx={{ color: 'white', ...iconMotionSx }}>
          <Tooltip title={tokens.bottomToolbar.tooltips.redo}>
            <Redo fontSize="small" />
          </Tooltip>
        </IconButton>

        <IconButton size="small" sx={{ color: 'white', ...iconMotionSx }}>
          <Tooltip title={tokens.bottomToolbar.tooltips.screenshot}>
            <PhotoCamera fontSize="small" />
          </Tooltip>
        </IconButton>

        <IconButton size="small" sx={{ color: 'white', ...iconMotionSx }}>
          <Tooltip title={tokens.bottomToolbar.tooltips.viewCode}>
            <Code fontSize="small" />
          </Tooltip>
        </IconButton>
      </Box>

      {/* Right Section - Zoom & Social */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Zoom Control */}
        <Select
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          size="small"
          sx={{
            color: 'white',
            bgcolor: '#2A2A2A',
            minWidth: 100,
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiSelect-icon': {
              color: 'white',
            },
          }}
        >
          <MenuItem value={50}>50%</MenuItem>
          <MenuItem value={75}>75%</MenuItem>
          <MenuItem value={100}>100%</MenuItem>
          <MenuItem value={125}>125%</MenuItem>
          <MenuItem value={150}>150%</MenuItem>
          <MenuItem value={200}>200%</MenuItem>
        </Select>

        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#444' }} />

        {/* Social Media Links */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            {tokens.bottomToolbar.socialLabel}
          </Typography>
          <IconButton size="small" sx={{ color: 'white', ...iconMotionSx }} href="#">
            <RemoveRedEye fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
