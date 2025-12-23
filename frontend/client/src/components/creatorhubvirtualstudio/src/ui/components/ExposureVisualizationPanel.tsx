import React from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Paper,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Whatshot as HeatIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface ExposureVisualizationPanelProps {
  falseColorEnabled: boolean;
  heatmapEnabled: boolean;
  falseColorOpacity: number;
  heatmapOpacity: number;
  onToggleFalseColor: (enabled: boolean) => void;
  onToggleHeatmap: (enabled: boolean) => void;
  onFalseColorOpacityChange: (opacity: number) => void;
  onHeatmapOpacityChange: (opacity: number) => void;
}

export function ExposureVisualizationPanel({
  falseColorEnabled,
  heatmapEnabled,
  falseColorOpacity,
  heatmapOpacity,
  onToggleFalseColor,
  onToggleHeatmap,
  onFalseColorOpacityChange,
  onHeatmapOpacityChange,
}: ExposureVisualizationPanelProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" gutterBottom sx={{ fontWeight: 600}}>
        Exposure Visualization:
      </Typography>

      {/* False Color Exposure */}
      <Paper elevation={1} sx={{ p: 1.5, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaletteIcon fontSize="small" color="primary" />
            <Typography variant="body2" sx={{ fontWeight: 600}}>
              False Color
            </Typography>
          </Box>
          <Switch
            checked={falseColorEnabled}
            onChange={(e) => onToggleFalseColor(e.target.checked)}
            size="small"
          />
        </Box>

        {falseColorEnabled && (
          <>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Opacity: {(falseColorOpacity * 100).toFixed(0)}%
            </Typography>
            <Slider
              value={falseColorOpacity}
              onChange={(_, value) => onFalseColorOpacityChange(value as number)}
              min={0}
              max={1}
              step={0.1}
              size="small"
              sx={{ mb: 1 }}
            />

            <Divider sx={{ my: 1 }} />

            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              Color Legend:
            </Typography>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#00004D', border: '1px solid #ccc' }} />
                <Typography variant="caption">Dark Blue: &lt; -3 EV (severely underexposed)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#0000FF', border: '1px solid #ccc' }} />
                <Typography variant="caption">Blue: -3 to -2 EV (underexposed)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#00FFFF', border: '1px solid #ccc' }} />
                <Typography variant="caption">Cyan: -2 to -1 EV (slightly under)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#00FF00', border: '1px solid #ccc' }} />
                <Typography variant="caption">Green: -1 to +1 EV (correct exposure) ✓</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#FFFF00', border: '1px solid #ccc' }} />
                <Typography variant="caption">Yellow: +1 to +2 EV (slightly over)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#FF8000', border: '1px solid #ccc' }} />
                <Typography variant="caption">Orange: +2 to +3 EV (overexposed)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#FF0000', border: '1px solid #ccc' }} />
                <Typography variant="caption">Red: +3 to +4 EV (severely over)</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 16, height: 16, bgcolor: '#FF00FF', border: '1px solid #ccc' }} />
                <Typography variant="caption">Magenta: &gt; +4 EV (clipping)</Typography>
              </Box>
            </Stack>
          </>
        )}
      </Paper>

      {/* Luminance Heatmap */}
      <Paper elevation={1} sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HeatIcon fontSize="small" color="error" />
            <Typography variant="body2" sx={{ fontWeight: 600}}>
              Luminance Heatmap
            </Typography>
          </Box>
          <Switch
            checked={heatmapEnabled}
            onChange={(e) => onToggleHeatmap(e.target.checked)}
            size="small"
          />
        </Box>

        {heatmapEnabled && (
          <>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Opacity: {(heatmapOpacity * 100).toFixed(0)}%
            </Typography>
            <Slider
              value={heatmapOpacity}
              onChange={(_, value) => onHeatmapOpacityChange(value as number)}
              min={0}
              max={1}
              step={0.1}
              size="small"
              sx={{ mb: 1 }}
            />

            <Divider sx={{ my: 1 }} />

            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              Thermal Scale:
            </Typography>
            <Box sx={{ 
              height: 20, 
              background: 'linear-gradient(to right, #000, #800080, #0000FF, #00FFFF, #00FF00, #FFFF00, #FF8000, #FF0000, #FFF)',
              border: '1px solid #ccc',
              borderRadius: 1,
              mb: 0.5}} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption">Low</Typography>
              <Typography variant="caption">Medium</Typography>
              <Typography variant="caption">High</Typography>
            </Box>
          </>
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        <InfoIcon fontSize="inherit" /> Use these tools to analyze exposure distribution
      </Typography>
    </Box>
  );
}

