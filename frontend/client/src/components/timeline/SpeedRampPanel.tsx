/**
 * SPEED RAMP PANEL
 * UI for time remapping and speed control
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  ButtonGroup,
  Slider,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
} from '@mui/material';
import {
  PlayArrow,
  Add,
  Delete,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  SlowMotionVideo,
  FastForward,
  Pause,
} from '@mui/icons-material';
import { SpeedRampEngine, SpeedPreset, SpeedKeyframe } from '../../services/speed-ramp-engine';

interface SpeedRampPanelProps {
  clipId: string;
  clipDuration: number;
  currentKeyframes: SpeedKeyframe[];
  onKeyframesChange: (keyframes: SpeedKeyframe[]) => void;
  onPreview?: () => void;
}

export default function SpeedRampPanel({
  clipId,
  clipDuration,
  currentKeyframes,
  onKeyframesChange,
  onPreview
}: SpeedRampPanelProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [customSpeed, setCustomSpeed] = useState(1.0);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number | null>(null);
  
  const categories = SpeedRampEngine.getSpeedCategories();
  const commonSpeeds = SpeedRampEngine.getCommonSpeeds();
  
  /**
   * Apply speed preset
   */
  const handleApplyPreset = (preset: SpeedPreset) => {
    const keyframes = SpeedRampEngine.applyPreset(preset, 0, clipDuration);
    onKeyframesChange(keyframes);
  };
  
  /**
   * Add keyframe at current time
   */
  const handleAddKeyframe = () => {
    const newKeyframe: SpeedKeyframe = {
      time: clipDuration / 2,
      speed: 1.0,
      curveType: 'ease_in_out'
    };
    
    onKeyframesChange([...currentKeyframes, newKeyframe].sort((a, b) => a.time - b.time));
  };
  
  /**
   * Remove keyframe
   */
  const handleRemoveKeyframe = (index: number) => {
    const newKeyframes = currentKeyframes.filter((_, i) => i !== index);
    onKeyframesChange(newKeyframes);
    setSelectedKeyframeIndex(null);
  };
  
  /**
   * Update keyframe
   */
  const handleUpdateKeyframe = (index: number, updates: Partial<SpeedKeyframe>) => {
    const newKeyframes = [...currentKeyframes];
    newKeyframes[index] = { ...newKeyframes[index], ...updates };
    onKeyframesChange(newKeyframes);
  };
  
  /**
   * Apply constant speed
   */
  const handleApplyConstantSpeed = (speed: number) => {
    onKeyframesChange([{
      time: 0,
      speed: speed,
      curveType: 'linear'
    }]);
  };
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1E1E1E', color: '#fff' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <SpeedIcon />
          <Typography variant="h6">Speed Ramp</Typography>
          <Chip 
            label={`${currentKeyframes.length} keyframes`}
            size="small"
            sx={{ bgcolor: '#667eea', color: 'white' }}
          />
          {onPreview && (
            <Button
              size="small"
              startIcon={<PlayArrow />}
              onClick={onPreview}
              sx={{ ml: 'auto' }}
            >
              Preview
            </Button>
          )}
        </Stack>
      </Box>
      
      {/* Tabs */}
      <Tabs
        value={selectedTab}
        onChange={(_, v) => setSelectedTab(v)}
        sx={{ borderBottom: '1px solid #333' }}
      >
        <Tab label="Presets" />
        <Tab label="Custom" />
        <Tab label="Keyframes" />
      </Tabs>
      
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* PRESETS TAB */}
        {selectedTab === 0 && (
          <Box>
            {categories.map((category) => (
              <Box key={category.name} sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#9CA3AF' }}>
                  {category.name}
                </Typography>
                
                <Stack spacing={1}>
                  {category.presets.map((preset) => (
                    <Card key={preset.name} sx={{ bgcolor: '#2A2A2A' }}>
                      <CardActionArea onClick={() => handleApplyPreset(preset)}>
                        <CardContent>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {preset.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {preset.description}
                              </Typography>
                            </Box>
                            <Chip 
                              label={`${preset.duration}s`}
                              size="small"
                              sx={{ bgcolor: '#333' }}
                            />
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        )}
        
        {/* CUSTOM TAB */}
        {selectedTab === 1 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Quick Speed Adjust
            </Typography>
            
            {/* Common speeds */}
            <Stack spacing={1} sx={{ mb: 3 }}>
              {commonSpeeds.map((speed) => (
                <Button
                  key={speed.value}
                  variant="outlined"
                  fullWidth
                  onClick={() => handleApplyConstantSpeed(speed.value)}
                  sx={{
                    justifyContent: 'space-between',
                    borderColor: '#333',
                    color: '#fff',
                    '&:hover': { borderColor: '#667eea', bgcolor: 'rgba(102, 126, 234, 0.1)' }
                  }}
                >
                  <span>{speed.label}</span>
                  {speed.value === 0 && <Pause fontSize="small" />}
                  {speed.value > 0 && speed.value < 1 && <SlowMotionVideo fontSize="small" />}
                  {speed.value > 1 && <FastForward fontSize="small" />}
                </Button>
              ))}
            </Stack>
            
            <Divider sx={{ my: 2, borderColor: '#333' }} />
            
            {/* Custom speed slider */}
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Custom Speed
            </Typography>
            
            <Box sx={{ px: 2 }}>
              <Slider
                value={customSpeed}
                onChange={(_, v) => setCustomSpeed(v as number)}
                min={0}
                max={10}
                step={0.1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 1, label: '100%' },
                  { value: 5, label: '500%' },
                  { value: 10, label: '1000%' }
                ]}
                valueLabelDisplay="on"
                valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                sx={{
                  color: '#667eea',
                  '& .MuiSlider-markLabel': { color: '#9CA3AF' }
                }}
              />
              
              <Button
                variant="contained"
                fullWidth
                onClick={() => handleApplyConstantSpeed(customSpeed)}
                sx={{ 
                  mt: 2,
                  bgcolor: '#667eea',
                  '&:hover': { bgcolor: '#5568d3' }
                }}
              >
                Apply {Math.round(customSpeed * 100)}% Speed
              </Button>
            </Box>
          </Box>
        )}
        
        {/* KEYFRAMES TAB */}
        {selectedTab === 2 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">
                Keyframes ({currentKeyframes.length})
              </Typography>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={handleAddKeyframe}
                sx={{ color: '#667eea' }}
              >
                Add Keyframe
              </Button>
            </Stack>
            
            {currentKeyframes.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, color: '#9CA3AF' }}>
                <TimelineIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                <Typography variant="body2">
                  No keyframes yet
                </Typography>
                <Typography variant="caption">
                  Add keyframes to create custom speed ramps
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {currentKeyframes.map((keyframe, index) => (
                  <Card
                    key={index}
                    sx={{
                      bgcolor: selectedKeyframeIndex === index ? 'rgba(102, 126, 234, 0.2)' : '#2A2A2A',
                      border: selectedKeyframeIndex === index ? '1px solid #667eea' : 'none'
                    }}
                  >
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2">
                            Keyframe {index + 1}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveKeyframe(index)}
                            sx={{ color: '#EF4444' }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                        
                        {/* Time */}
                        <TextField
                          label="Time (seconds)"
                          type="number"
                          value={keyframe.time}
                          onChange={(e) => handleUpdateKeyframe(index, { time: parseFloat(e.target.value) })}
                          size="small"
                          fullWidth
                          inputProps={{ min: 0, max: clipDuration, step: 0.1 }}
                        />
                        
                        {/* Speed */}
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Speed: {Math.round(keyframe.speed * 100)}%
                          </Typography>
                          <Slider
                            value={keyframe.speed}
                            onChange={(_, v) => handleUpdateKeyframe(index, { speed: v as number })}
                            min={-5}
                            max={10}
                            step={0.1}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
                            sx={{ color: '#667eea' }}
                          />
                        </Box>
                        
                        {/* Curve Type */}
                        <FormControl size="small" fullWidth>
                          <InputLabel>Curve</InputLabel>
                          <Select
                            value={keyframe.curveType}
                            label="Curve"
                            onChange={(e) => handleUpdateKeyframe(index, { curveType: e.target.value as any })}
                          >
                            <MenuItem value="linear">Linear</MenuItem>
                            <MenuItem value="ease_in">Ease In</MenuItem>
                            <MenuItem value="ease_out">Ease Out</MenuItem>
                            <MenuItem value="ease_in_out">Ease In/Out</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Box>
      
      {/* Footer Info */}
      <Box sx={{ p: 2, borderTop: '1px solid #333', bgcolor: '#1A1A1A' }}>
        <Typography variant="caption" color="text.secondary">
          Original Duration: {clipDuration.toFixed(2)}s
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          New Duration: {SpeedRampEngine.getRemappedDuration(clipDuration, currentKeyframes).toFixed(2)}s
        </Typography>
      </Box>
    </Box>
  );
}


