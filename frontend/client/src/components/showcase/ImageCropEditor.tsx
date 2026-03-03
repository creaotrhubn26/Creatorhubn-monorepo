import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Slider,
  Switch,
  Typography,
} from '@mui/material';
import {
  Crop as CropIcon,
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';

export interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  zoom: number;
}

export interface FocalPoint {
  x: number;
  y: number;
}

interface ImageCropEditorProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  currentCropSettings?: CropSettings;
  currentFocalPoint?: FocalPoint;
  onSave: (cropSettings: CropSettings, focalPoint: FocalPoint) => void;
}

const DEFAULT_CROP: CropSettings = {
  x: 10,
  y: 10,
  width: 80,
  height: 80,
  rotate: 0,
  zoom: 1,
};

const DEFAULT_FOCAL_POINT: FocalPoint = {
  x: 50,
  y: 50,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const ImageCropEditor: React.FC<ImageCropEditorProps> = ({
  open,
  onClose,
  imageUrl,
  currentCropSettings,
  currentFocalPoint,
  onSave,
}) => {
  const [cropSettings, setCropSettings] = useState<CropSettings>(currentCropSettings ?? DEFAULT_CROP);
  const [focalPoint, setFocalPoint] = useState<FocalPoint>(currentFocalPoint ?? DEFAULT_FOCAL_POINT);
  const [focalPointMode, setFocalPointMode] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setCropSettings(currentCropSettings ?? DEFAULT_CROP);
      setFocalPoint(currentFocalPoint ?? DEFAULT_FOCAL_POINT);
      setFocalPointMode(false);
    }
  }, [currentCropSettings, currentFocalPoint, open]);

  const previewTransform = useMemo(
    () => `translate(${-cropSettings.x / 2}%, ${-cropSettings.y / 2}%) scale(${cropSettings.zoom}) rotate(${cropSettings.rotate}deg)`,
    [cropSettings.rotate, cropSettings.x, cropSettings.y, cropSettings.zoom],
  );

  const resetAll = () => {
    setCropSettings(DEFAULT_CROP);
    setFocalPoint(DEFAULT_FOCAL_POINT);
    setFocalPointMode(false);
  };

  const rotate = (delta: number) => {
    setCropSettings((previous) => ({
      ...previous,
      rotate: (previous.rotate + delta + 360) % 360,
    }));
  };

  const handleImageClick: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!focalPointMode || !imageContainerRef.current) {
      return;
    }

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setFocalPoint({
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100),
    });
  };

  const handleSave = () => {
    onSave(cropSettings, focalPoint);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CropIcon />
          <Typography variant="h6">Image Crop Editor</Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 520 }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          <Grid item xs={12} md={8}>
            <Paper
              ref={imageContainerRef}
              variant="outlined"
              sx={{
                position: 'relative',
                minHeight: 460,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#060b16',
                cursor: focalPointMode ? 'crosshair' : 'default',
              }}
              onClick={handleImageClick}
            >
              <img
                src={imageUrl}
                alt="Crop preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: previewTransform,
                  transformOrigin: `${focalPoint.x}% ${focalPoint.y}%`,
                  transition: 'transform 120ms ease-out',
                }}
              />

              <Box
                sx={{
                  position: 'absolute',
                  left: `${cropSettings.x}%`,
                  top: `${cropSettings.y}%`,
                  width: `${cropSettings.width}%`,
                  height: `${cropSettings.height}%`,
                  transform: 'translate(0, 0)',
                  border: '2px dashed #f59e0b',
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  pointerEvents: 'none',
                }}
              />

              <Box
                sx={{
                  position: 'absolute',
                  left: `${focalPoint.x}%`,
                  top: `${focalPoint.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                }}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Rotate & Zoom
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <IconButton onClick={() => rotate(-90)}>
                    <RotateLeftIcon />
                  </IconButton>
                  <IconButton onClick={() => rotate(90)}>
                    <RotateRightIcon />
                  </IconButton>
                  <IconButton onClick={() => setCropSettings((prev) => ({ ...prev, zoom: clamp(prev.zoom - 0.1, 0.5, 3) }))}>
                    <ZoomOutIcon />
                  </IconButton>
                  <IconButton onClick={() => setCropSettings((prev) => ({ ...prev, zoom: clamp(prev.zoom + 0.1, 0.5, 3) }))}>
                    <ZoomInIcon />
                  </IconButton>
                </Box>

                <Typography variant="caption">Zoom: {cropSettings.zoom.toFixed(2)}x</Typography>
                <Slider
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={cropSettings.zoom}
                  onChange={(_, value) => setCropSettings((prev) => ({ ...prev, zoom: value as number }))}
                />
                <Typography variant="caption">Rotate: {cropSettings.rotate}°</Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">Crop Area</Typography>
                <Typography variant="caption">X</Typography>
                <Slider
                  min={0}
                  max={100 - cropSettings.width}
                  value={cropSettings.x}
                  onChange={(_, value) => setCropSettings((prev) => ({ ...prev, x: value as number }))}
                />

                <Typography variant="caption">Y</Typography>
                <Slider
                  min={0}
                  max={100 - cropSettings.height}
                  value={cropSettings.y}
                  onChange={(_, value) => setCropSettings((prev) => ({ ...prev, y: value as number }))}
                />

                <Typography variant="caption">Width</Typography>
                <Slider
                  min={10}
                  max={100 - cropSettings.x}
                  value={cropSettings.width}
                  onChange={(_, value) =>
                    setCropSettings((prev) => ({
                      ...prev,
                      width: value as number,
                    }))
                  }
                />

                <Typography variant="caption">Height</Typography>
                <Slider
                  min={10}
                  max={100 - cropSettings.y}
                  value={cropSettings.height}
                  onChange={(_, value) =>
                    setCropSettings((prev) => ({
                      ...prev,
                      height: value as number,
                    }))
                  }
                />
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <FormControlLabel
                  control={<Switch checked={focalPointMode} onChange={(event) => setFocalPointMode(event.target.checked)} />}
                  label="Set focal point by clicking image"
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  Focal point: {focalPoint.x.toFixed(1)}%, {focalPoint.y.toFixed(1)}%
                </Typography>
              </Paper>

              <Button variant="outlined" onClick={resetAll}>
                Reset
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageCropEditor;
