import * as React from 'react';
import {
  Box,
  Button,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Stack,
  Chip,
} from '@mui/material';
import { PhotoCamera, Download, Settings } from '@mui/icons-material';
import renderService from '../../core/services/render';
import { exportRenderedImage } from '../../core/services/imageExport';

const RESOLUTION_PRESETS = [
  { label: 'Preview (720p)', width: 1280, height: 720 },
  { label: 'HD (1080p)', width: 1920, height: 1080 },
  { label: '2K', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 },
  { label: 'Square (1080)', width: 1080, height: 1080 },
  { label: 'Portrait (1080x1920)', width: 1080, height: 1920 },
];

const QUALITY_PRESETS = [
  { label: 'Draft', samples: 16, shadows: false },
  { label: 'Standard', samples: 64, shadows: true },
  { label: 'High', samples: 256, shadows: true },
  { label: 'Ultra', samples: 1024, shadows: true },
];

export default function RenderExportPanel() {
  const [resolution, setResolution] = React.useState(1);
  const [quality, setQuality] = React.useState(1);
  const [rendering, setRendering] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [lastRender, setLastRender] = React.useState<string | null>(null);

  const handleRender = async () => {
    setRendering(true);
    setProgress(0);
    
    const res = RESOLUTION_PRESETS[resolution];
    const qual = QUALITY_PRESETS[quality];
    
    try {
      // Simulate progressive render
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(r => setTimeout(r, 100));
      }
      
      const result = await renderService.renderHighQuality({
        width: res.width,
        height: res.height,
        samples: qual.samples,
        format: 'png',
        jpegQuality: 0.95,
      });
      
      if (result.dataUrl) {
        setLastRender(result.dataUrl);
        window.dispatchEvent(new CustomEvent( 'vs-toast', {
          detail: { message: `Rendered ${res.label} image`, severity: 'success' }
        }));
      }
    } catch (error) {
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: { message: 'Render failed', severity: 'error' }
      }));
    } finally {
      setRendering(false);
    }
  };

  const handleDownload = () => {
    if (lastRender) {
      const link = document.createElement('a');
      link.href = lastRender;
      link.download = `render-${Date.now()}.png`;
      link.click();
    }
  };

  const handleQuickCapture = async () => {
    try {
      const imageData = await exportRenderedImage('png', 0.95);
      if (imageData) {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `capture-${Date.now()}.png`;
        link.click();
        window.dispatchEvent(new CustomEvent('vs-toast', {
          detail: { message: 'Screenshot saved', severity: 'success' }
        }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent('vs-toast', {
        detail: { message: 'Screenshot failed', severity: 'error' }
      }));
    }
  };

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <PhotoCamera fontSize="small" />
        <Typography fontWeight={700}>Final Render</Typography>
      </Stack>

      <Stack spacing={1.5}>
        <FormControl size="small" fullWidth>
          <InputLabel>Resolution</InputLabel>
          <Select
            value={resolution}
            label="Resolution"
            onChange={(e) => setResolution(Number(e.target.value))}
            disabled={rendering}
          >
            {RESOLUTION_PRESETS.map((r, i) => (
              <MenuItem key={i} value={i}>
                {r.label} ({r.width}x{r.height})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Quality</InputLabel>
          <Select
            value={quality}
            label="Quality"
            onChange={(e) => setQuality(Number(e.target.value))}
            disabled={rendering}
          >
            {QUALITY_PRESETS.map((q, i) => (
              <MenuItem key={i} value={i}>
                {q.label} ({q.samples} samples)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {rendering && (
          <Box>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary">
              Rendering... {progress}%
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1}>
          <Button 
            variant="contained" 
            onClick={handleRender}
            disabled={rendering}
            startIcon={<Settings />}
            fullWidth
          >
            {rendering ? 'Rendering...' : 'Render HQ'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleQuickCapture}
            disabled={rendering}
            startIcon={<PhotoCamera />}
          >
            Quick
          </Button>
        </Stack>

        {lastRender && (
          <Stack spacing={1}>
            <Box 
              component="img" 
              src={lastRender} 
              sx={{ 
                width: '100%', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }} 
            />
            <Button
              variant="outlined"
              onClick={handleDownload}
              startIcon={<Download />}
              size="small"
            >
              Download PNG
            </Button>
          </Stack>
        )}

        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Chip label="PNG" size="small" />
          <Chip label="Transparent BG" size="small" variant="outlined" />
          <Chip label="sRGB" size="small" variant="outlined" />
        </Stack>
      </Stack>
    </Box>
  );
}
