import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Alert,
  Button,
  Tabs,
  Tab,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  ColorLens as ColorLensIcon,
  Gradient as GradientIcon,
  AutoAwesome as AutoAwesomeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Brightness6 as Brightness6Icon,
  Contrast as ContrastIcon,
  FormatColorFill as FormatColorFillIcon,
  FormatColorText as FormatColorTextIcon,
  Opacity as OpacityIcon,
} from '@mui/icons-material';

interface ColorPickerProps {
  selectedElement: any;
  brandColors: any;
  onColorChange: (color: string, property: string) => void;
  onClose: () => void;
}

export function ColorPicker({
  selectedElement,
  brandColors,
  onColorChange,
  onClose,
}: ColorPickerProps) {
  const [activeTab, setActiveTab] = useState(0);
  
  // Theming system
  const theming = useTheming('photographer');
  const [customColor, setCustomColor] = useState('#1976d2');
  const [opacity, setOpacity] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  // Utvidede merkevare-farger med varianter
  const extendedBrandColors = {
    primary: {
      50: '#e3f2fd',
      100: '#bbdefb',
      200: '#90caf0',
      300: '#64b5f0',
      400: '#42a5f0',
      500: '#2196f0',
      600: '#1e88e0',
      700: '#1976d0',
      800: '#1565c0',
      900: '#0d47a0',
  },
    secondary: {
      50: '#fce4ec',
      100: '#f8bbd0',
      200: '#f48fb0',
      300: '#f06290',
      400: '#ec4070',
      500: '#e91e60',
      600: '#d81b60',
      700: '#c21850',
      800: '#ad1450',
      900: '#880e40',
  },
    success: {
      50: '#e8f5e0',
      100: '#c8e6c0',
      200: '#a5d6a0',
      300: '#81c780',
      400: '#66bb60',
      500: '#4caf50',
      600: '#43a040',
      700: '#388e30',
      800: '#2e7d30',
      900: '#1b5e20',
  },
    warning: {
      50: '#fff8e0',
      100: '#ffecb0',
      200: '#ffe080',
      300: '#ffd540',
      400: '#ffca20',
      500: '#ffc100',
      600: '#ffb300',
      700: '#ffa000',
      800: '#ff8f00',
      900: '#ff6f00',
  },
    error: {
      50: '#ffebee',
      100: '#ffcdd0',
      200: '#ef9a90',
      300: '#e57370',
      400: '#ef5350',
      500: '#f44330',
      600: '#e53930',
      700: '#d32f20',
      800: '#c62820',
      900: '#b71c10',
  },
    grey: {
      50: '#fafafa',
      100: '#f5f5f0',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e90',
      600: '#757570',
      700: '#616160',
      800: '#424240',
      900: '#212120',
  },
};

  // Validerer farge mot merkevare-retningslinjer
  const validateBrandCompliance = (color: string) => {
    const normalizedColor = color.toLowerCase();
    const isApprovedColor = Object.values(extendedBrandColors).some((colorGroup) =>
      Object.values(colorGroup).some(
        (value) => String(value).toLowerCase() === normalizedColor
      )
    );

    return {
      isCompliant: isApprovedColor,
      message: isApprovedColor
        ? 'Fargen følger merkevare-retningslinjene'
        : 'Fargen følger ikke merkevare-retningslinjene',
      alternatives: isApprovedColor ? [] : getSimilarBrandColors(color),
    };
  };

  // Finn lignende merkevare-farger
  const getSimilarBrandColors = (targetColor: string) => {
    // Forenklet algoritme - i produksjon vil vi bruke mer avansert farge-matching
    return [
      extendedBrandColors.primary[50],
      extendedBrandColors.secondary[500],
      extendedBrandColors.success[500],
    ];
  };

  // Konverter hex til rgba med opacity
  const hexToRgba = (hex: string, opacity: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    }
    return hex;
  };

  // Håndter farge-endring
  const handleColorSelection = (color: string, property: string = 'backgroundColor') => {
    const validation = validateBrandCompliance(color);
    const finalColor = opacity < 100 ? hexToRgba(color, opacity) : color;

    if (validation.isCompliant) {
      onColorChange(finalColor, property);
    } else {
      // Vis alternativ-dialog
      console.warn('Ikke-kompatibel farge valgt: ', color);
    }
  };

  return (
    <Box sx={{ width: '100%'}}>
      {/* Tabs for ulike redigeringsmodi */}
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb:  2 }}
      >
        <Tab icon={<PaletteIcon />} label="Farger" />
        <Tab icon={<GradientIcon />} label="Gradienter" />
        <Tab icon={<OpacityIcon />} label="Effekter" />
        <Tab icon={<AutoAwesomeIcon />} label="Smart" />
      </Tabs>

      {/* Tab 1: Merkevare-farger */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            <ColorLensIcon sx={{ mr: 1, fontSize: 16}} />
            Merkevare-godkjente farger
          </Typography>

          {/* Primær farge-palette */}
          <Box sx={{ mb:  2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Primærfarger
            </Typography>
            <Grid container spacing={0.5}>
              {Object.entries(extendedBrandColors.primary).map(([shade, color]) => (
                <Grid item xs={12} key={shade}>
                  <Tooltip title={`Primary ${shade}`}>
                    <Paper
                      elevation={2}
                      sx={{
                        width:  32,
                        height:  32,
                        backgroundColor: color,
                        cursor: 'pointer',
                        border: customColor === color ? '3px solid' : '1px solid',
                        borderColor: customColor === color ? 'secondary.main' : 'divider',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          zIndex: 1,
                        },
                        transition: 'all 0.2s',
                      }}
                      onClick={() => {
                        setCustomColor(color);
                        handleColorSelection(color);
                      }}
                    />
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Sekundær farge-palette */}
          <Box sx={{ mb:  2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Sekundærfarger
            </Typography>
            <Grid container spacing={0.5}>
              {Object.entries(extendedBrandColors.secondary).map(([shade, color]) => (
                <Grid item xs={12} key={shade}>
                  <Tooltip title={`Secondary ${shade}`}>
                    <Paper
                      elevation={2}
                      sx={{
                        width:  32,
                        height:  32,
                        backgroundColor: color,
                        cursor: 'pointer',
                        border: customColor === color ? '3px solid' : '1px solid',
                        borderColor: customColor === color ? 'secondary.main' : 'divider',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          zIndex: 1,
                        },
                        transition: 'all 0.2s',
                      }}
                      onClick={() => {
                        setCustomColor(color);
                        handleColorSelection(color);
                      }}
                    />
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Status farger */}
          <Box sx={{ mb:  2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Status farger
            </Typography>
            <Stack direction="row" spacing={1}>
              {['success', 'warning','error'].map((colorType) => (
                <Tooltip key={colorType} title={`${colorType} ${500}`}>
                  <Paper
                    elevation={2}
                    sx={{
                      width:  40,
                      height:  40,
                      backgroundColor: extendedBrandColors[colorType][50],
                      cursor: 'pointer',
                      border: customColor === extendedBrandColors[colorType][500]
                          ? '3px solid'
                          : '1px solid',
                      borderColor: customColor === extendedBrandColors[colorType][500]
                        ? 'secondary.main'
                        : 'divider',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        zIndex: 1,
                      },
                      transition: 'all 0.2s',
                    }}
                    onClick={() => {
                      const color = extendedBrandColors[colorType][500];
                      setCustomColor(color);
                      handleColorSelection(color);
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Box>
        </Box>
      )}

      {/* Tab 2: Gradienter */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            <GradientIcon sx={{ mr: 1, fontSize: 16}} />
            Merkevare-gradienter
          </Typography>

          <Grid container spacing={1}>
            {[
              'linear-gradient(45deg, #1976d2, #42a5f5)', 'linear-gradient(45deg, #e91e63, #f48fb1)', 'linear-gradient(45deg, #4caf50, #81c784)', 'linear-gradient(135deg, #1976d2, #e91e63)', 'linear-gradient(90deg, #1976d2, #4caf50)', 'radial-gradient(circle, #1976d2, #42a5f5)',
            ].map((gradient, index) => (
              <Grid item xs={6} key={index}>
                <Paper
                  elevation={2}
                  sx={{
                    height:  40,
                    background: gradient,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      zIndex: 1,
                    },
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleColorSelection(gradient, 'background')}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Tab 3: Effekter */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            <OpacityIcon sx={{ mr: 1, fontSize: 16}} />
            Farge-effekter
          </Typography>

          <Stack spacing={2}>
            {/* Opacity */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                <OpacityIcon sx={{ mr: 0, fontSize: 14 }} />
                Gjennomsiktighet ({opacity}%)
              </Typography>
              <Slider
                value={opacity}
                onChange={(_, value) => setOpacity(value as number)}
                min={0}
                max={100}
                valueLabelDisplay="auto"
                size="small"
              />
            </Box>

            {/* Brightness */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                <Brightness6Icon sx={{ mr: 0, fontSize: 14 }} />
                Lysstyrke ({brightness}%)
              </Typography>
              <Slider
                value={brightness}
                onChange={(_, value) => setBrightness(value as number)}
                min={0}
                max={200}
                valueLabelDisplay="auto"
                size="small"
              />
            </Box>

            {/* Contrast */}
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                <ContrastIcon sx={{ mr: 0, fontSize: 14 }} />
                Kontrast ({contrast}%)
              </Typography>
              <Slider
                value={contrast}
                onChange={(_, value) => setContrast(value as number)}
                min={0}
                max={200}
                valueLabelDisplay="auto"
                size="small"
              />
            </Box>

            {/* Farge-egenskap velger */}
            <FormControl size="small" fullWidth>
              <InputLabel>Farge-egenskap</InputLabel>
              <Select defaultValue="backgroundColor" label="Farge-egenskap">
                <MenuItem value="backgroundColor">
                  <FormatColorFillIcon sx={{ mr: 1, fontSize: 16}} />
                  Bakgrunnsfarge
                </MenuItem>
                <MenuItem value="color">
                  <FormatColorTextIcon sx={{ mr: 1, fontSize: 16}} />
                  Tekstfarge
                </MenuItem>
                <MenuItem value="borderColor">
                  <PaletteIcon sx={{ mr: 1, fontSize: 16}} />
                  Ramme-farge
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>
      )}

      {/* Tab 4: Smart anbefalinger */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            <AutoAwesomeIcon sx={{ mr: 1, fontSize: 16}} />
            Smarte anbefalinger
          </Typography>

          <Alert severity="info" sx={{ mb:  2 }}>
            Basert på elementtype og merkevare-retningslinjer
          </Alert>

          <Stack spacing={1}>
            {selectedElement.type === 'button' &&
              [
                {
                  color: extendedBrandColors.primary[50],
                  label: 'Primær knapp',
              },
                {
                  color: extendedBrandColors.secondary[50],
                  label: 'Sekundær knapp',
              },
                {
                  color: extendedBrandColors.success[50],
                  label: 'Suksess knapp',
              },
                { color: extendedBrandColors.error[50], label: 'Feil knapp',},
              ].map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => handleColorSelection(suggestion.color)}
                  sx={{
                    justifyContent: 'flex-start',
                    borderColor: suggestion.color,
                    color: suggestion.color,
                    '&:hover': {
                      backgroundColor: `${suggestion.color}20`,
                      borderColor: suggestion.color,
                    },
                  }}
                >
                  {suggestion.label}
                </Button>
              ))}
          </Stack>
        </Box>
      )}

      {/* Validering og alternativer */}
      {customColor && (
        <Box sx={{ mt:  2 }}>
          {(() => {
            const validation = validateBrandCompliance(customColor);
            return (
              <Alert
                severity={validation.isCompliant ? 'success' : 'warning'}
                icon={validation.isCompliant ? <CheckCircleIcon /> : <WarningIcon />}
                sx={{ mb:  1 }}
              >
                {validation.message}
                {!validation.isCompliant && validation.alternatives.length > 0 && (
                  <Box sx={{ mt:  1 }}>
                    <Typography variant="caption" display="block">
                      Foreslåtte alternativer: </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5}}>
                      {validation.alternatives.map((altColor, index) => (
                        <Tooltip key={index} title="Klikk for å bruke">
                          <Paper
                            elevation={1}
                            sx={{
                              width:  24,
                              height:  24,
                              backgroundColor: altColor,
                              cursor: 'pointer',
                              '&:hover': { transform: 'scale(1.2)' },
                            }}
                            onClick={() => {
                              setCustomColor(altColor);
                              handleColorSelection(altColor);
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Alert>
            );
        })()}
        </Box>
      )}
    </Box>
  );
}
