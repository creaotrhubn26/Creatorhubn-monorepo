/**
 * CameraControlPanel
 * 
 * Control panel for camera movements in Director Mode.
 * Provides joystick-style controls for pan, tilt, dolly, truck, and zoom.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Slider,
  Stack,
  Tooltip,
  Divider,
  Button,
  Chip,
} from '@mui/material';
import {
  ArrowUpward,
  ArrowDownward,
  ArrowBack,
  ArrowForward,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  RotateLeft,
  RotateRight,
  Height,
  Videocam,
  RadioButtonChecked,
  KeyboardArrowUp,
  KeyboardArrowDown,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Add,
  Remove,
  Refresh,
} from '@mui/icons-material';
import { logger } from '../../core/services/logger';

const log = logger.module('CameraControlPanel');

// ============================================================================
// Types
// ============================================================================

interface CameraControlPanelProps {
  cameraId: string;
  cameraName: string;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (direction: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down', speed: number) => void;
  onRotate: (axis: 'pan' | 'tilt' | 'roll', amount: number) => void;
  onZoom: (amount: number) => void;
  onReset: () => void;
}

// ============================================================================
// Joystick Component
// ============================================================================

const Joystick: React.FC<{
  onMove: (x: number, y: number) => void;
  label: string;
  icon: React.ReactNode;
}> = ({ onMove, label, icon }) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);
  
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !joystickRef.current) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let x = (clientX - centerX) / (rect.width / 2);
    let y = (clientY - centerY) / (rect.height / 2);
    
    // Clamp to circle
    const magnitude = Math.sqrt(x * x + y * y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    
    setPosition({ x, y });
    onMove(x, -y); // Invert Y for intuitive control
  }, [isDragging, onMove]);
  
  const handleEnd = useCallback(() => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleUp = () => handleEnd();
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, handleMove, handleEnd]);
  
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Box
        ref={joystickRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.1)',
          border: '2px solid rgba(255,255,255,0.3)',
          position: 'relative',
          cursor: 'pointer',
          mx: 'auto','&:hover': {
            borderColor: 'rgba(255,255,255,0.5)',
          }}}
      >
        {/* Center indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'rgba(255,255,255,0.3)'}}
        >
          {icon}
        </Box>
        
        {/* Joystick knob */}
        <Box
          sx={{
            position: 'absolute',
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: isDragging ? '#2563eb' : 'rgba(255,255,255,0.8)',
            top: `calc(50% + ${position.y * 28}px)`,
            left: `calc(50% + ${position.x * 28}px)`,
            transform: 'translate(-50%, -50%)',
            transition: isDragging ? 'none' : 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'}}
        />
        
        {/* Direction arrows */}
        <KeyboardArrowUp
          sx={{
            position: 'absolute',
            top: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 16,
            color: 'rgba(255,255,255,0.4)'}}
        />
        <KeyboardArrowDown
          sx={{
            position: 'absolute',
            bottom: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 16,
            color: 'rgba(255,255,255,0.4)'}}
        />
        <KeyboardArrowLeft
          sx={{
            position: 'absolute',
            left: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 16,
            color: 'rgba(255,255,255,0.4)'}}
        />
        <KeyboardArrowRight
          sx={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 16,
            color: 'rgba(255,255,255,0.4)'}}
        />
      </Box>
    </Box>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const CameraControlPanel: React.FC<CameraControlPanelProps> = ({
  cameraId,
  cameraName,
  isSelected,
  onSelect,
  onMove,
  onRotate,
  onZoom,
  onReset,
}) => {
  const [zoom, setZoom] = useState(50);
  
  const handlePositionJoystick = useCallback((x: number, y: number) => {
    if (Math.abs(x) > 0.1) {
      onMove(x > 0 ? 'right' : 'left', Math.abs(x));
    }
    if (Math.abs(y) > 0.1) {
      onMove(y > 0 ? 'forward' : 'backward', Math.abs(y));
    }
  }, [onMove]);
  
  const handleRotationJoystick = useCallback((x: number, y: number) => {
    if (Math.abs(x) > 0.1) {
      onRotate('pan', x * 2);
    }
    if (Math.abs(y) > 0.1) {
      onRotate('tilt', y * 2);
    }
  }, [onRotate]);
  
  const handleZoomChange = useCallback((_: Event, value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    setZoom(v);
    onZoom((v - 50) / 50); // Normalize to -1 to 1
  }, [onZoom]);
  
  return (
    <Paper
      onClick={onSelect}
      sx={{
        p: 2,
        bgcolor: isSelected ? 'rgba(37, 99, 235, 0.2)' : 'rgba(0, 0, 0, 0.85)',
        border: isSelected ? '2px solid #2563eb' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s','&:hover': {
          borderColor: isSelected ? '#2563eb' : 'rgba(255,255,255,0.3)',
        }}}
    >
      {/* Camera Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Videocam sx={{ color: isSelected ? '#2563eb' : 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={isSelected ? 700 : 400}>
            {cameraName}
          </Typography>
        </Stack>
        {isSelected && (
          <Chip
            label="SELECTED"
            size="small"
            color="primary"
            icon={<RadioButtonChecked sx={{ fontSize: 12 }} />}
          />
        )}
      </Stack>
      
      {/* Guideline */}
      {!isSelected && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
          Click to control this camera
        </Typography>
      )}
      
      {/* Controls (only shown when selected) */}
      {isSelected && (
        <>
          <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />
          
          {/* Joysticks Row */}
          <Stack direction="row" spacing={3} justifyContent="center" sx={{ mb: 2 }}>
            <Joystick
              onMove={handlePositionJoystick}
              label="DOLLY / TRUCK"
              icon={<Add sx={{ fontSize: 20 }} />}
            />
            <Joystick
              onMove={handleRotationJoystick}
              label="PAN / TILT"
              icon={<Refresh sx={{ fontSize: 20 }} />}
            />
          </Stack>
          
          {/* Zoom Slider */}
          <Box sx={{ px: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              ZOOM
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ZoomOut fontSize="small" sx={{ color: 'text.secondary' }} />
              <Slider
                value={zoom}
                onChange={handleZoomChange}
                min={0}
                max={100}
                size="small"
                sx={{
                  color: '#2563eb', '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                  }}}
              />
              <ZoomIn fontSize="small" sx={{ color: 'text.secondary' }} />
            </Stack>
          </Box>
          
          {/* Quick Actions */}
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            <Tooltip title="Move Up">
              <IconButton
                size="small"
                onClick={() => onMove('up', 0.5)}
                sx={{ color: 'text.secondary' }}
              >
                <Height />
              </IconButton>
            </Tooltip>
            <Tooltip title="Move Down">
              <IconButton
                size="small"
                onClick={() => onMove('down', 0.5)}
                sx={{ color: 'text.secondary', transform: 'rotate(180deg)' }}
              >
                <Height />
              </IconButton>
            </Tooltip>
            <Tooltip title="Roll Left">
              <IconButton
                size="small"
                onClick={() => onRotate('roll', -5)}
                sx={{ color: 'text.secondary' }}
              >
                <RotateLeft />
              </IconButton>
            </Tooltip>
            <Tooltip title="Roll Right">
              <IconButton
                size="small"
                onClick={() => onRotate('roll', 5)}
                sx={{ color: 'text.secondary' }}
              >
                <RotateRight />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset Camera">
              <IconButton
                size="small"
                onClick={onReset}
                sx={{ color: 'text.secondary' }}
              >
                <CenterFocusStrong />
              </IconButton>
            </Tooltip>
          </Stack>
          
          {/* Keyboard Shortcuts Hint */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 2, textAlign: 'center', opacity: 0.7 }}
          >
            Arrow keys: Pan/Tilt | WASD: Dolly/Truck | Q/E: Roll | +/-: Zoom
          </Typography>
        </>
      )}
    </Paper>
  );
};

export default CameraControlPanel;

