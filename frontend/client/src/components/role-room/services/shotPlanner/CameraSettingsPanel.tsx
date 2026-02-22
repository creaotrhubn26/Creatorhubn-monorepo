/**
 * Camera Settings Panel
 * 
 * Right sidebar panel for configuring selected camera settings.
 * Matches the design from the Shot Planner mockup.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Videocam as CameraIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import { useShotPlannerStore, useSelectedCamera } from './store';
import {
  Camera2D,
  ShotType,
  LensType,
  CameraHeight,
  CameraAngleType,
  CameraMovement,
  SHOT_TYPE_INFO,
  CAMERA_COLORS,
  LENS_FOV_MAP,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const SHOT_TYPES: ShotType[] = [
  'EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'BCU', 'ECU', 'OTS', 'POV', 'Insert', 'Two-Shot', 'Group'
];

const LENS_OPTIONS: LensType[] = [
  '14mm', '18mm', '21mm', '24mm', '28mm', '35mm', '50mm', '65mm', '85mm', '100mm', '135mm', '200mm'
];

const HEIGHT_OPTIONS: CameraHeight[] = [
  'Ground Level', 'Low Angle', 'Eye Level', 'High Angle', 'Birds Eye', 'Dutch Angle', 'Worms Eye'
];

const ANGLE_OPTIONS: CameraAngleType[] = [
  'Straight On', 'Profile', '3/4 Front', '3/4 Back', 'Back', 'Over Shoulder'
];

const MOVEMENT_OPTIONS: CameraMovement[] = [
  'Static', 'Pan Left', 'Pan Right', 'Tilt Up', 'Tilt Down',
  'Dolly In', 'Dolly Out', 'Truck Left', 'Truck Right',
  'Pedestal Up', 'Pedestal Down', 'Zoom In', 'Zoom Out',
  'Arc Left', 'Arc Right', 'Follow', 'Crane Up', 'Crane Down',
  'Steadicam', 'Handheld'
];

// =============================================================================
// Component
// =============================================================================

interface CameraSettingsPanelProps {
  onSave?: () => void;
  onDelete?: () => void;
}

export const CameraSettingsPanel: React.FC<CameraSettingsPanelProps> = ({
  onSave,
  onDelete,
}) => {
  const selectedCamera = useSelectedCamera();
  const { updateCamera, deleteCamera, addShot } = useShotPlannerStore();
  const scene = useShotPlannerStore(state => state.scene);
  
  if (!selectedCamera) {
    return (
      <Paper
        sx={{
          p: 2,
          height: '100%',
          backgroundColor: '#1E2D3D',
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8896A6',
        }}
      >
        <CameraIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
        <Typography variant="body2" align="center">
          Select a camera to edit its settings
        </Typography>
      </Paper>
    );
  }
  
  const handleChange = (field: keyof Camera2D) => (
    event: SelectChangeEvent | React.ChangeEvent<HTMLInputElement>
  ) => {
    updateCamera(selectedCamera.id, { [field]: event.target.value });
  };
  
  const handleSliderChange = (field: string) => (
    _event: Event,
    value: number | number[]
  ) => {
    if (field === 'frustumOpacity') {
      updateCamera(selectedCamera.id, { frustumOpacity: value as number });
    } else if (field === 'rotation') {
      updateCamera(selectedCamera.id, { rotation: value as number });
    } else if (field.startsWith('frustum.')) {
      const frustumField = field.split('.')[1] as 'nearDistance' | 'farDistance';
      updateCamera(selectedCamera.id, {
        frustum: {
          ...selectedCamera.frustum,
          [frustumField]: value as number,
        },
      });
    }
  };
  
  const handleColorChange = (color: string) => {
    updateCamera(selectedCamera.id, { color });
  };
  
  const handleToggleVisibility = () => {
    updateCamera(selectedCamera.id, { visible: !selectedCamera.visible });
  };
  
  const handleToggleLock = () => {
    updateCamera(selectedCamera.id, { locked: !selectedCamera.locked });
  };
  
  const handleToggleFrustum = () => {
    updateCamera(selectedCamera.id, { showFrustum: !selectedCamera.showFrustum });
  };
  
  const handleDelete = () => {
    deleteCamera(selectedCamera.id);
    onDelete?.();
  };
  
  const handleCreateShot = () => {
    addShot(selectedCamera.id);
  };
  
  // Check 180° rule
  const activeShot = scene?.shots.find(s => s.id === scene.activeShotId);
  const is180Safe = activeShot?.lineOfAction?.safe ?? true;
  
  return (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        backgroundColor: '#1E2D3D',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
          {selectedCamera.name} Settings
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={selectedCamera.visible ? 'Hide' : 'Show'}>
            <IconButton size="small" onClick={handleToggleVisibility}>
              {selectedCamera.visible ? (
                <VisibilityIcon sx={{ color: '#4FC3F7' }} />
              ) : (
                <VisibilityOffIcon sx={{ color: '#8896A6' }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={selectedCamera.locked ? 'Unlock' : 'Lock'}>
            <IconButton size="small" onClick={handleToggleLock}>
              {selectedCamera.locked ? (
                <LockIcon sx={{ color: '#FFB74D' }} />
              ) : (
                <UnlockIcon sx={{ color: '#8896A6' }} />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
      
      <Divider sx={{ borderColor: '#3A4A5A', mb: 2 }} />
      
      {/* Camera Color */}
      <Typography variant="caption" sx={{ color: '#8896A6', mb: 1 }}>
        Camera Color
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
        {CAMERA_COLORS.map(({ name, hex }) => (
          <Tooltip key={hex} title={name}>
            <Box
              onClick={() => handleColorChange(hex)}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: hex,
                cursor: 'pointer',
                border: selectedCamera.color === hex ? '3px solid #FFFFFF' : '2px solid transparent',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s',
              }}
            />
          </Tooltip>
        ))}
      </Stack>
      
      {/* Shot Type */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel sx={{ color: '#8896A6' }}>Shot</InputLabel>
        <Select<string>
          value={selectedCamera.shotType}
          label="Shot"
          onChange={handleChange('shotType')}
          MenuProps={{ sx: { zIndex: 1400 } }}
          sx={{
            color: '#FFFFFF',
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#3A4A5A' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4FC3F7' },
          }}
        >
          {SHOT_TYPES.map(type => (
            <MenuItem key={type} value={type}>
              {SHOT_TYPE_INFO[type].abbr} - {type}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Lens */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel sx={{ color: '#8896A6' }}>Lens</InputLabel>
        <Select<string>
          value={selectedCamera.lens}
          label="Lens"
          onChange={handleChange('lens')}
          MenuProps={{ sx: { zIndex: 1400 } }}
          sx={{
            color: '#FFFFFF',
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#3A4A5A' },
          }}
        >
          {LENS_OPTIONS.map(lens => (
            <MenuItem key={lens} value={lens}>
              {lens} ({LENS_FOV_MAP[lens]}° FOV)
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Height */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel sx={{ color: '#8896A6' }}>Height</InputLabel>
        <Select<string>
          value={selectedCamera.height}
          label="Height"
          onChange={handleChange('height')}
          MenuProps={{ sx: { zIndex: 1400 } }}
          sx={{
            color: '#FFFFFF',
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#3A4A5A' },
          }}
        >
          {HEIGHT_OPTIONS.map(height => (
            <MenuItem key={height} value={height}>{height}</MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Angle */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel sx={{ color: '#8896A6' }}>Angle</InputLabel>
        <Select<string>
          value={selectedCamera.angle}
          label="Angle"
          onChange={handleChange('angle')}
          MenuProps={{ sx: { zIndex: 1400 } }}
          sx={{
            color: '#FFFFFF',
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#3A4A5A' },
          }}
        >
          {ANGLE_OPTIONS.map(angle => (
            <MenuItem key={angle} value={angle}>{angle}</MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Movement */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel sx={{ color: '#8896A6' }}>Movement</InputLabel>
        <Select<string>
          value={selectedCamera.movement}
          label="Movement"
          onChange={handleChange('movement')}
          MenuProps={{ sx: { zIndex: 1400 } }}
          sx={{
            color: '#FFFFFF',
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#3A4A5A' },
          }}
        >
          {MOVEMENT_OPTIONS.map(movement => (
            <MenuItem key={movement} value={movement}>{movement}</MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <Divider sx={{ borderColor: '#3A4A5A', my: 2 }} />
      
      {/* Frustum Settings */}
      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', mb: 1 }}>
        View Cone
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" sx={{ color: '#8896A6' }}>
          Show Frustum
        </Typography>
        <Chip
          label={selectedCamera.showFrustum ? 'On' : 'Off'}
          size="small"
          onClick={handleToggleFrustum}
          sx={{
            backgroundColor: selectedCamera.showFrustum ? '#4FC3F7' : '#3A4A5A',
            color: '#FFFFFF',
          }}
        />
      </Box>
      
      {selectedCamera.showFrustum && (
        <>
          <Typography variant="caption" sx={{ color: '#8896A6' }}>
            Distance: {selectedCamera.frustum.nearDistance}m - {selectedCamera.frustum.farDistance}m
          </Typography>
          <Slider
            value={[selectedCamera.frustum.nearDistance, selectedCamera.frustum.farDistance]}
            onChange={(_e, value) => {
              const [near, far] = value as number[];
              updateCamera(selectedCamera.id, {
                frustum: { ...selectedCamera.frustum, nearDistance: near, farDistance: far },
              });
            }}
            min={0.5}
            max={30}
            step={0.5}
            valueLabelDisplay="auto"
            sx={{ color: selectedCamera.color, mb: 2 }}
          />
          
          <Typography variant="caption" sx={{ color: '#8896A6' }}>
            Opacity: {Math.round(selectedCamera.frustumOpacity * 100)}%
          </Typography>
          <Slider
            value={selectedCamera.frustumOpacity}
            onChange={handleSliderChange('frustumOpacity')}
            min={0.1}
            max={0.8}
            step={0.05}
            sx={{ color: selectedCamera.color, mb: 2 }}
          />
        </>
      )}
      
      {/* Rotation */}
      <Typography variant="caption" sx={{ color: '#8896A6' }}>
        Rotation: {selectedCamera.rotation}°
      </Typography>
      <Slider
        value={selectedCamera.rotation}
        onChange={handleSliderChange('rotation')}
        min={0}
        max={360}
        step={5}
        sx={{ color: selectedCamera.color, mb: 2 }}
      />
      
      <Divider sx={{ borderColor: '#3A4A5A', my: 2 }} />
      
      {/* Preview Placeholder */}
      <Typography variant="subtitle2" sx={{ color: '#FFFFFF', mb: 1 }}>
        Preview
      </Typography>
      <Box
        sx={{
          width: '100%',
          height: 120,
          backgroundColor: '#0A1929',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
          border: '1px solid #3A4A5A',
        }}
      >
        <Typography variant="caption" sx={{ color: '#8896A6' }}>
          Shot Preview
        </Typography>
      </Box>
      
      {/* Framing Info */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: '#8896A6', display: 'block' }}>
          Framing: {selectedCamera.shotType === 'Two-Shot' ? 'Both Characters' : 'Subject'}
        </Typography>
      </Box>
      
      {/* 180° Rule Indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          backgroundColor: is180Safe ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
          borderRadius: 1,
          mb: 2,
        }}
      >
        {is180Safe ? (
          <CheckIcon sx={{ color: '#4CAF50' }} />
        ) : (
          <WarningIcon sx={{ color: '#F44336' }} />
        )}
        <Typography variant="body2" sx={{ color: is180Safe ? '#4CAF50' : '#F44336' }}>
          180° Line: {is180Safe ? 'Safe Side' : 'Crossing Line!'}
        </Typography>
      </Box>
      
      {/* Action Buttons */}
      <Box sx={{ mt: 'auto', display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<SaveIcon />}
          onClick={handleCreateShot}
          sx={{
            backgroundColor: '#4FC3F7',
            '&:hover': { backgroundColor: '#29B6F6' },
          }}
        >
          Save
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
          sx={{ minWidth: 'auto', px: 2 }}
        >
          Delete
        </Button>
      </Box>
    </Paper>
  );
};

export default CameraSettingsPanel;
