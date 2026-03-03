import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Grid3x3, GridOn, GridOff } from '@mui/icons-material';
import { getVisualEditorTokens } from './visualEditorTokens';

interface CanvasGridOverlayProps {
  width: number;
  height: number;
  gridSize?: number;
  showGrid?: boolean;
  onToggleGrid?: (show: boolean) => void;
}

export const CanvasGridOverlay: React.FC<CanvasGridOverlayProps> = ({
  width,
  height,
  gridSize = 16,
  showGrid = true,
  onToggleGrid,
}) => {
  if (!showGrid) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1}}>
      {/* Grid pattern */}
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0}}>
        <defs>
          <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="gridLarge"
            width={gridSize * 4}
            height={gridSize * 4}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize * 4} 0 L 0 0 0 ${gridSize * 4}`}
              fill="none"
              stroke="rgba(0, 0, 0, 0.2)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#gridLarge)" />

        {/* Center guides */}
        <line
          x1="50%"
          y1="0"
          x2="50%"
          y2="100%"
          stroke="rgba(0, 1, 0, 225, 5, 0.2)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="rgba(0, 1, 0, 225, 5, 0.2)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>

      {/* Rulers */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 20,
          bgcolor: 'rgba(255, 255, 255, 0.9)',
          borderBottom: '1px solid #E0E0E0',
          display: 'flex',
          alignItems: 'center'}}>
        {Array.from({ length: Math.ceil(width / 100) }).map((_, i) => (
          <Box
            key={`ruler-h-${i}`}
            sx={{
              position: 'absolute',
              left: i * 100,
              fontSize: '9px',
              color: 'text.secondary',
              px: 0.5 }}>
            {i * 100}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 20,
          height: '100%',
          bgcolor: 'rgba(255, 255, 255, 0.9)',
          borderRight: '1px solid #E0E0E0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'}}>
        {Array.from({ length: Math.ceil(height / 100) }).map((_, i) => (
          <Box
            key={`ruler-v-${i}`}
            sx={{
              position: 'absolute',
              top: i * 100,
              fontSize: '9px',
              color: 'text.secondary',
              py: 0.5
             , transform: 'rotate(-90deg)',
              transformOrigin: 'left center',
              left: 10}}>
            {i * 100}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Grid controls component
interface GridControlsProps {
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  onToggleGrid: (show: boolean) => void;
  onChangeGridSize: (size: number) => void;
  onToggleSnap: (snap: boolean) => void;
}

export const GridControls: React.FC<GridControlsProps> = ({
  showGrid,
  gridSize,
  snapToGrid,
  onToggleGrid,
  onChangeGridSize,
  onToggleSnap,
}) => {
  const tokens = getVisualEditorTokens();
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
      <Tooltip title={showGrid ? tokens.gridControls.hideGrid : tokens.gridControls.showGrid}>
        <IconButton
          size="small"
          onClick={() => onToggleGrid(!showGrid)}
          sx={{
            color: showGrid ? 'primary.main' : 'text.secondary',
            border: 1,
            borderColor: showGrid ? 'primary.main' : 'divider',
            borderRadius: 1}}>
          {showGrid ? <GridOn fontSize="small" /> : <GridOff fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Tooltip title={snapToGrid ? tokens.gridControls.snapOn : tokens.gridControls.snapOff}>
        <IconButton
          size="small"
          onClick={() => onToggleSnap(!snapToGrid)}
          disabled={!showGrid}
          sx={{
            color: snapToGrid ? 'primary.main' : 'text.secondary',
            border: 1,
            borderColor: snapToGrid ? 'primary.main' : 'divider',
            borderRadius: 1}}>
          <Grid3x3 fontSize="small" />
        </IconButton>
      </Tooltip>

      <ToggleButtonGroup
        value={gridSize.toString()}
        exclusive
        onChange={(_, value) => value && onChangeGridSize(Number(value))}
        size="small"
        disabled={!showGrid}
      >
        <ToggleButton value="8" sx={{ px: 1, fontSize: '0.75rem' }}>
          {tokens.gridControls.sizes.small}
        </ToggleButton>
        <ToggleButton value="16" sx={{ px: 1, fontSize: '0.75rem' }}>
          {tokens.gridControls.sizes.medium}
        </ToggleButton>
        <ToggleButton value="24" sx={{ px: 1, fontSize: '0.75rem' }}>
          {tokens.gridControls.sizes.large}
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};
