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

export const BottomToolbar: React.FC = () => {
  const [deviceMode, setDeviceMode] = useState('desktop');
  const [zoom, setZoom] = useState(100);

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
        height: 56}}>
      {/* Left Section - Brand */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" fontWeight={700}, sx={{ letterSpacing: 1 }}>
          FIKRISH OP
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
            bgcolor: '#2A2A2A', '& .MuiToggleButton-root': {
              color: 'white',
              border: 'none','&.Mui-selected': {
                bgcolor: '#0066FF',
                color: 'white', '&:hover': {
                  bgcolor: '#0052CC',
                },
              },
            }}}
        >
          <ToggleButton value="desktop">
            <Tooltip title="Desktop">
              <Computer fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="tablet">
            <Tooltip title="Tablet">
              <Tablet fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="mobile">
            <Tooltip title="Mobile">
              <Smartphone fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#444'}} />

        {/* Action Buttons */}
        <IconButton size="small" sx={{ color: 'white' }}>
          <Tooltip title="Undo">
            <Undo fontSize="small" />
          </Tooltip>
        </IconButton>

        <IconButton size="small" sx={{ color: 'white' }}>
          <Tooltip title="Redo">
            <Redo fontSize="small" />
          </Tooltip>
        </IconButton>

        <IconButton size="small" sx={{ color: 'white' }}>
          <Tooltip title="Screenshot">
            <PhotoCamera fontSize="small" />
          </Tooltip>
        </IconButton>

        <IconButton size="small" sx={{ color: 'white' }}>
          <Tooltip title="View Code">
            <Code fontSize="small" />
          </Tooltip>
        </IconButton>
      </Box>

      {/* Right Section - Zoom & Social */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Zoom Control */}
        <Select
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value)}
          size="small"
          sx={{
            color: 'white',
            bgcolor: '#2A2A2A',
            minWidth: 100'& .MuiOutlinedInput-notchedOutline': { border: 'none',
            }, '& .MuiSelect-icon': {
              color: 'white',
            }}}
        >
          <MenuItem value={50}>50%</MenuItem>
          <MenuItem value={75}>75%</MenuItem>
          <MenuItem value={100}>100%</MenuItem>
          <MenuItem value={125}>125%</MenuItem>
          <MenuItem value={150}>150%</MenuItem>
          <MenuItem value={200}>200%</MenuItem>
        </Select>

        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#444'}} />

        {/* Social Media Links */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Social Media
          </Typography>
          <IconButton size="small" sx={{ color: 'white' } href="#">
            <RemoveRedEye fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};
