/**
 * Manual Color Palette Generator
 * Fallback when AI is unavailable - generate harmonious palettes manually
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Shuffle,
  ContentCopy,
  Check,
  AutoAwesome,
  ColorLens,
} from '@mui/icons-material';

interface ColorPalette {
  primary: string;
  accent: string;
  background: string;
  text: string;
  gradient: [string, string];
}

interface ManualColorPaletteProps {
  onApply: (palette: ColorPalette) => void;
  open: boolean;
  onClose: () => void;
  tryAI?: () => Promise<ColorPalette | null>;
}

export const ManualColorPalette: React.FC<ManualColorPaletteProps> = ({
  onApply,
  open,
  onClose,
  tryAI,
}) => {
  const [palette, setPalette] = useState<ColorPalette>({
    primary: '#2196f3',
    accent: '#ff9800',
    background: '#ffffff',
    text: '#333333',
    gradient: ['#2196f3','#21cbf3'],
  });

  const [copied, setCopied] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Generate random harmonious palette
  const generateRandomPalette = () => {
    const hue = Math.floor(Math.random() * 360);
    const complementaryHue = (hue + 180) % 360;
    const analogousHue = (hue + 30) % 360;

    const primary = `hsl(${hue}, 70%, 50%)`;
    const accent = `hsl(${complementaryHue}, 70%, 50%)`;
    const gradient1 = `hsl(${hue}, 70%, 50%)`;
    const gradient2 = `hsl(${analogousHue}, 70%, 60%)`;

    setPalette({
      primary: hslToHex(hue, 70, 50),
      accent: hslToHex(complementaryHue, 70, 50),
      background: '#ffffff',
      text: '#333333',
      gradient: [hslToHex(hue, 70, 50), hslToHex(analogousHue, 70, 60)],
    });
  };

  // HSL to Hex converter
  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Copy hex to clipboard
  const copyToClipboard = (color: string, label: string) => {
    navigator.clipboard.writeText(color);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Validate hex color
  const isValidHex = (color: string): boolean => {
    return /^#[0-9A-F]{6}$/i.test(color);
  };

  // Handle color input change
  const handleColorChange = (key: keyof Omit<ColorPalette, 'gradient'>, value: string) => {
    // Allow typing # and partial hex
    if (value.startsWith('#') && value.length <= 7) {
      setPalette((prev) => ({ ...prev, [key]: value }));
    }
  };

  // Handle gradient color change
  const handleGradientChange = (index: 0 | 1, value: string) => {
    if (value.startsWith('#') && value.length <= 7) {
      const newGradient: [string, string] = [...palette.gradient] as [string, string];
      newGradient[index] = value;
      setPalette((prev) => ({ ...prev, gradient: newGradient }));
    }
  };

  // Try AI generation
  const handleTryAI = async () => {
    if (!tryAI) return;

    setAiLoading(true);
    try {
      const aiPalette = await tryAI();
      if (aiPalette) {
        setPalette(aiPalette);
      }
    } catch (error) {
      console.error('AI generation failed: ', error);
    } finally {
      setAiLoading(false);
    }
  };

  // Popular preset palettes
  const presets: Array<{ name: string; palette: ColorPalette }> = [
    {
      name: 'Ocean Blue',
      palette: {
        primary: '#0077be',
        accent: '#00a8cc',
        background: '#f0f8ff',
        text: '#1a1a1a',
        gradient: ['#0077be','#00a8cc'],
      },
    },
    {
      name: 'Sunset Orange',
      palette: {
        primary: '#ff6b35',
        accent: '#f7931e',
        background: '#fff5f0',
        text: '#2d2d2d',
        gradient: ['#ff6b35','#f7931e'],
      },
    },
    {
      name: 'Forest Green',
      palette: {
        primary: '#2d6a4f',
        accent: '#52b788',
        background: '#f1f8f4',
        text: '#1b263b',
        gradient: ['#2d6a4f','#52b788'],
      },
    },
    {
      name: 'Royal Purple',
      palette: {
        primary: '#7209b7',
        accent: '#b5179e',
        background: '#f8f0ff',
        text: '#212529',
        gradient: ['#7209b7', '#b5179e'],
      },
    },
    {
      name: 'Minimalist',
      palette: {
        primary: '#212529',
        accent: '#6c757d',
        background: '#ffffff',
        text: '#212529',
        gradient: ['#212529', '#6c757d'],
      },
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ColorLens />
            <Typography variant="h6">Color Palette Generator</Typography>
          </Box>
          {tryAI && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoAwesome />}
              onClick={handleTryAI}
              disabled={aiLoading}
            >
              {aiLoading ? 'Generating...' : 'Try AI'}
            </Button>
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Quick Actions */}
        <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Shuffle />} onClick={generateRandomPalette}>
            Random Palette
          </Button>
        </Box>

        {/* Current Palette Preview */}
        <Card sx={{ mb: 3, bgcolor: palette.background }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Preview
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 100 }}>
                <Box
                  sx={{
                    height: 80,
                    bgcolor: palette.primary,
                    borderRadius: 1,
                    border: '2px solid #fff',
                    boxShadow: 2}} />
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Primary
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 100 }}>
                <Box
                  sx={{
                    height: 80,
                    bgcolor: palette.accent,
                    borderRadius: 1,
                    border: '2px solid #fff',
                    boxShadow: 2}} />
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Accent
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 100 }}>
                <Box
                  sx={{
                    height: 80,
                    background: `linear-gradient(135deg, ${palette.gradient[0]}, ${palette.gradient[1]})`,
                    borderRadius: 1,
                    border: '2px solid #fff',
                    boxShadow: 2}}
                />
                <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                  Gradient
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Color Inputs */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Primary */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Primary Color"
                  value={palette.primary}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  error={!isValidHex(palette.primary)}
                  helperText={!isValidHex(palette.primary) && 'Invalid hex (e.g., #2196f3)'}
                  InputProps={{
                    startAdornment: (
                      <input
                        type="color"
                        value={isValidHex(palette.primary) ? palette.primary : '#2196f3'}
                        onChange={(e) =>
                          setPalette((prev) => ({ ...prev, primary: e.target.value }))
                        }
                        style={{
                          width: 32,
                          height: 32,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 4}} />
                    ),
                  }}
                />
              </Box>
              <Tooltip title={copied === 'primary' ? 'Copied!' : 'Copy'}>
                <IconButton onClick={() => copyToClipboard(palette.primary, 'primary')}>
                  {copied === 'primary' ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Accent */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Accent Color"
                  value={palette.accent}
                  onChange={(e) => handleColorChange('accent', e.target.value)}
                  error={!isValidHex(palette.accent)}
                  helperText={!isValidHex(palette.accent) && 'Invalid hex'}
                  InputProps={{
                    startAdornment: (
                      <input
                        type="color"
                        value={isValidHex(palette.accent) ? palette.accent : '#ff9800'}
                        onChange={(e) =>
                          setPalette((prev) => ({ ...prev, accent: e.target.value }))
                        }
                        style={{
                          width: 32,
                          height: 32,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 4
                        }} />
                    ),
                  }}
                />
              </Box>
              <Tooltip title={copied === 'accent' ? 'Copied!' : 'Copy'}>
                <IconButton onClick={() => copyToClipboard(palette.accent, 'accent')}>
                  {copied === 'accent' ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Background */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Background Color"
                  value={palette.background}
                  onChange={(e) => handleColorChange('background', e.target.value)}
                  error={!isValidHex(palette.background)}
                  helperText={!isValidHex(palette.background) && 'Invalid hex'}
                  InputProps={{
                    startAdornment: (
                      <input
                        type="color"
                        value={isValidHex(palette.background) ? palette.background : '#ffffff'}
                        onChange={(e) =>
                          setPalette((prev) => ({ ...prev, background: e.target.value }))
                        }
                        style={{
                          width: 32,
                          height: 32,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 4
                        }} />
                    ),
                  }}
                />
              </Box>
              <Tooltip title={copied === 'background' ? 'Copied!' : 'Copy'}>
                <IconButton onClick={() => copyToClipboard(palette.background, 'background')}>
                  {copied === 'background' ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Text */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Text Color"
                  value={palette.text}
                  onChange={(e) => handleColorChange('text', e.target.value)}
                  error={!isValidHex(palette.text)}
                  helperText={!isValidHex(palette.text) && 'Invalid hex'}
                  InputProps={{
                    startAdornment: (
                      <input
                        type="color"
                        value={isValidHex(palette.text) ? palette.text : '#333333'}
                        onChange={(e) => setPalette((prev) => ({ ...prev, text: e.target.value }))}
                        style={{
                          width: 32,
                          height: 32,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 4
                        }} />
                    )
                  }}
                />
              </Box>
              <Tooltip title={copied === 'text' ? 'Copied!' : 'Copy'}>
                <IconButton onClick={() => copyToClipboard(palette.text, 'text')}>
                  {copied === 'text' ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Gradient 1 */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Gradient Start"
                  value={palette.gradient[0]}
                  onChange={(e) => handleGradientChange(0, e.target.value)}
                  error={!isValidHex(palette.gradient[0])}
                  helperText={!isValidHex(palette.gradient[0]) && 'Invalid hex'}
                  InputProps={{
                    startAdornment: (
                      <input
                        type="color"
                        value={isValidHex(palette.gradient[0]) ? palette.gradient[0] : '#2196f3'}
                        onChange={(e) => handleGradientChange(0, e.target.value)}
                        style={{
                          width: 32,
                          height: 32,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 4
                        }} />
                    )
                  }}
                />
              </Box>
              <Tooltip title={copied === 'gradient1' ? 'Copied!' : 'Copy'}>
                <IconButton onClick={() => copyToClipboard(palette.gradient[0], 'gradient1')}>
                  {copied === 'gradient1' ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Gradient 2 */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Gradient End"
                  value={palette.gradient[1]}
                  onChange={(e) => handleGradientChange(1, e.target.value)}
                  error={!isValidHex(palette.gradient[1])}
                  helperText={!isValidHex(palette.gradient[1]) && 'Invalid hex'}
                  InputProps={{
                    startAdornment: (
                      <input
                        type="color"
                        value={isValidHex(palette.gradient[1]) ? palette.gradient[1] : '#21cbf3'}
                        onChange={(e) => handleGradientChange(1, e.target.value)}
                        style={{
                          width: 32,
                          height: 32,
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 4
                        }} />
                    )
                  }}
                />
              </Box>
              <Tooltip title={copied === 'gradient2' ? 'Copied!' : 'Copy'}>
                <IconButton onClick={() => copyToClipboard(palette.gradient[1], 'gradient2')}>
                  {copied === 'gradient2' ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>

        {/* Preset Palettes */}
        <Typography variant="subtitle2" gutterBottom>
          Quick Presets
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {presets.map((preset) => (
            <Chip
              key={preset.name}
              label={preset.name}
              onClick={() => setPalette(preset.palette)}
              sx={{
                background: `linear-gradient(135deg, ${preset.palette.primary}, ${preset.palette.accent})`,
                color: '#fff',
                fontWeight: 600
              }}
            />
          ))}
        </Box>

        {/* Validation */}
        {(!isValidHex(palette.primary) ||
          !isValidHex(palette.accent) ||
          !isValidHex(palette.background) ||
          !isValidHex(palette.text) ||
          !isValidHex(palette.gradient[0]) ||
          !isValidHex(palette.gradient[1])) && (
          <Alert severity="warning">Please fix invalid hex colors before applying</Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            onApply(palette);
            onClose();
          }}
          disabled={
            !isValidHex(palette.primary) ||
            !isValidHex(palette.accent) ||
            !isValidHex(palette.background) ||
            !isValidHex(palette.text) ||
            !isValidHex(palette.gradient[0]) ||
            !isValidHex(palette.gradient[1])
          }
        >
          Apply Palette
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualColorPalette;
