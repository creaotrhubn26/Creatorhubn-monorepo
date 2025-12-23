/**
 * Facial Features Panel
 * 
 * UI for customizing virtual actor facial features:
 * - Facial expressions
 * - Facial hair
 * - Makeup
 * - Skin details
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Chip,
  Divider,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Face,
  Mood,
  MoodBad,
  SentimentSatisfied,
  SentimentDissatisfied,
  SentimentNeutral,
  ContentCut,
  Palette,
  Brush,
  Elderly,
  Check,
} from '@mui/icons-material';
import {
  EXPRESSION_PRESETS,
  FACIAL_HAIR_PRESETS,
  MAKEUP_PRESETS,
  FacialHairStyle,
  FacialHairOptions,
  MakeupOptions,
  SkinDetailOptions,
  createFacialHairModel,
  createMakeupOverlay,
} from '../../core/models/FacialFeaturesModel';

interface FacialFeaturesPanelProps {
  onExpressionChange?: (expression: string, blendShapes: Record<string, number>) => void;
  onFacialHairChange?: (options: FacialHairOptions) => void;
  onMakeupChange?: (items: MakeupOptions[]) => void;
  onSkinDetailsChange?: (options: SkinDetailOptions) => void;
}

const EXPRESSION_ICONS: Record<string, React.ReactElement> = {
  neutral: <SentimentNeutral />,
  happy: <Mood />,
  sad: <MoodBad />,
  surprised: <SentimentSatisfied />,
  angry: <SentimentDissatisfied />,
  confident: <Mood />,
  serious: <SentimentNeutral />,
  relaxed: <SentimentSatisfied />,
};

const HAIR_COLORS = [
  { id: 'black', name: 'Black', color: '#1a1a1a' },
  { id: 'dark_brown', name: 'Dark Brown', color: '#3d2314' },
  { id: 'brown', name: 'Brown', color: '#6b4423' },
  { id: 'light_brown', name: 'Light Brown', color: '#a67b5b' },
  { id: 'auburn', name: 'Auburn', color: '#a52a2a' },
  { id: 'red', name: 'Red', color: '#8b0000' },
  { id: 'blonde', name: 'Blonde', color: '#d4a373' },
  { id: 'gray', name: 'Gray', color: '#808080' },
  { id: 'white', name: 'White', color: '#e8e8e8' },
];

export const FacialFeaturesPanel: React.FC<FacialFeaturesPanelProps> = ({
  onExpressionChange,
  onFacialHairChange,
  onMakeupChange,
  onSkinDetailsChange,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  
  // Expression state
  const [selectedExpression, setSelectedExpression] = useState('neutral');
  const [expressionIntensity, setExpressionIntensity] = useState(1);
  
  // Facial hair state
  const [facialHairStyle, setFacialHairStyle] = useState<FacialHairStyle>('none');
  const [facialHairColor, setFacialHairColor] = useState('#3d2314');
  const [facialHairDensity, setFacialHairDensity] = useState(0.8);
  const [facialHairGray, setFacialHairGray] = useState(0);
  const [facialHairLength, setFacialHairLength] = useState(0.5);
  
  // Makeup state
  const [selectedMakeupPreset, setSelectedMakeupPreset] = useState<string | null>(null);
  const [makeupEnabled, setMakeupEnabled] = useState(false);
  
  // Skin details state
  const [wrinkles, setWrinkles] = useState(0);
  const [pores, setPores] = useState(0.3);
  const [freckles, setFreckles] = useState(0);
  const [skinAge, setSkinAge] = useState(30);

  const handleExpressionSelect = useCallback((expressionId: string) => {
    setSelectedExpression(expressionId);
    const blendShapes = EXPRESSION_PRESETS[expressionId] || {};
    const scaled = Object.fromEntries(
      Object.entries(blendShapes).map(([k, v]) => [k, (v as number) * expressionIntensity])
    );
    onExpressionChange?.(expressionId, scaled);
    
    window.dispatchEvent(new CustomEvent('vs-actor-expression', {
      detail: { expression: expressionId, blendShapes: scaled }
    }));
  }, [expressionIntensity, onExpressionChange]);

  const handleFacialHairChange = useCallback(() => {
    const options: FacialHairOptions = {
      style: facialHairStyle,
      color: facialHairColor,
      density: facialHairDensity,
      grayAmount: facialHairGray,
      length: facialHairLength,
    };
    onFacialHairChange?.(options);
    
    // Create model and dispatch event
    const model = createFacialHairModel(options);
    window.dispatchEvent(new CustomEvent('vs-actor-facial-hair', {
      detail: { options, model }
    }));
  }, [facialHairStyle, facialHairColor, facialHairDensity, facialHairGray, facialHairLength, onFacialHairChange]);

  const handleMakeupPresetSelect = useCallback((presetId: string) => {
    setSelectedMakeupPreset(presetId);
    const preset = MAKEUP_PRESETS.find(p => p.id === presetId);
    if (preset) {
      onMakeupChange?.(preset.items);
      window.dispatchEvent(new CustomEvent('vs-actor-makeup', {
        detail: { preset: presetId, items: preset.items }
      }));
    }
  }, [onMakeupChange]);

  const handleSkinDetailsChange = useCallback(() => {
    const options: SkinDetailOptions = {
      wrinkles,
      pores,
      freckles,
      moles: 0,
      blemishes: 0,
      age: skinAge,
    };
    onSkinDetailsChange?.(options);
    
    window.dispatchEvent(new CustomEvent('vs-actor-skin-details', {
      detail: options
    }));
  }, [wrinkles, pores, freckles, skinAge, onSkinDetailsChange]);

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Face />
        <Typography variant="h6" fontWeight={700}>Facial Features</Typography>
      </Stack>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Mood />} label="Expression" />
        <Tab icon={<ContentCut />} label="Facial Hair" />
        <Tab icon={<Brush />} label="Makeup" />
        <Tab icon={<Elderly />} label="Skin Details" />
      </Tabs>

      {/* EXPRESSIONS TAB */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Choose an expression preset or blend between multiple expressions.
          </Typography>
          
          <Grid container spacing={1} mb={2}>
            {Object.keys(EXPRESSION_PRESETS).map((expr) => (
              <Grid item xs={4} key={expr}>
                <Card 
                  variant={selectedExpression === expr ? 'elevation' : 'outlined'}
                  sx={{ 
                    borderColor: selectedExpression === expr ? 'primary.main' : 'divider',
                    borderWidth: selectedExpression === expr ? 2 : 1}}
                >
                  <CardActionArea onClick={() => handleExpressionSelect(expr)}>
                    <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                      {EXPRESSION_ICONS[expr] || <Face />}
                      <Typography variant="caption" display="block" sx={{ textTransform: 'capitalize' }}>
                        {expr}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Expression Intensity: {Math.round(expressionIntensity * 100)}%
            </Typography>
            <Slider
              value={expressionIntensity}
              onChange={(_, v) => {
                setExpressionIntensity(v as number);
                handleExpressionSelect(selectedExpression);
              }}
              min={0}
              max={1}
              step={0.1}
              marks={[
                { value: 0, label: 'Subtle' },
                { value: 0.5, label: 'Normal' },
                { value: 1, label: 'Full' },
              ]}
            />
          </Box>
        </Box>
      )}

      {/* FACIAL HAIR TAB */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Add facial hair to male actors.
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Facial Hair Style</InputLabel>
            <Select
              value={facialHairStyle}
              label="Facial Hair Style"
              onChange={(e) => {
                setFacialHairStyle(e.target.value as FacialHairStyle);
                setTimeout(handleFacialHairChange, 0);
              }}
            >
              {FACIAL_HAIR_PRESETS.map((preset) => (
                <MenuItem key={preset.id} value={preset.style}>
                  {preset.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {facialHairStyle !== 'none' && (
            <>
              <Typography variant="body2" gutterBottom>Hair Color</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mb={2}>
                {HAIR_COLORS.map((c) => (
                  <Tooltip key={c.id} title={c.name}>
                    <Box
                      onClick={() => {
                        setFacialHairColor(c.color);
                        setTimeout(handleFacialHairChange, 0);
                      }}
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: c.color,
                        borderRadius: 1,
                        cursor: 'pointer',
                        border: facialHairColor === c.color ? '2px solid' : '1px solid',
                        borderColor: facialHairColor === c.color ? 'primary.main' : 'divider'}}
                    />
                  </Tooltip>
                ))}
              </Stack>

              <Box mb={2}>
                <Typography variant="body2" gutterBottom>
                  Density: {Math.round(facialHairDensity * 100)}%
                </Typography>
                <Slider
                  value={facialHairDensity}
                  onChange={(_, v) => setFacialHairDensity(v as number)}
                  onChangeCommitted={handleFacialHairChange}
                  min={0.2}
                  max={1}
                  step={0.1}
                />
              </Box>

              <Box mb={2}>
                <Typography variant="body2" gutterBottom>
                  Gray Amount: {Math.round(facialHairGray * 100)}%
                </Typography>
                <Slider
                  value={facialHairGray}
                  onChange={(_, v) => setFacialHairGray(v as number)}
                  onChangeCommitted={handleFacialHairChange}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Box>

              <Box mb={2}>
                <Typography variant="body2" gutterBottom>
                  Length: {facialHairLength < 0.3 ? 'Short' : facialHairLength < 0.7 ? 'Medium' : 'Long'}
                </Typography>
                <Slider
                  value={facialHairLength}
                  onChange={(_, v) => setFacialHairLength(v as number)}
                  onChangeCommitted={handleFacialHairChange}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Box>
            </>
          )}
        </Box>
      )}

      {/* MAKEUP TAB */}
      {activeTab === 2 && (
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={makeupEnabled}
                onChange={(e) => setMakeupEnabled(e.target.checked)}
              />
            }
            label="Enable Makeup"
            sx={{ mb: 2 }}
          />

          {makeupEnabled && (
            <>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Select a makeup preset or customize individual elements.
              </Typography>

              <Grid container spacing={1}>
                {MAKEUP_PRESETS.map((preset) => (
                  <Grid item xs={6} key={preset.id}>
                    <Card
                      variant={selectedMakeupPreset === preset.id ? 'elevation' : 'outlined'}
                      sx={{
                        borderColor: selectedMakeupPreset === preset.id ? 'primary.main' : 'divider'}}
                    >
                      <CardActionArea onClick={() => handleMakeupPresetSelect(preset.id)}>
                        <CardContent sx={{ py: 1.5 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" fontWeight={600}>
                              {preset.name}
                            </Typography>
                            {selectedMakeupPreset === preset.id && (
                              <Check fontSize="small" color="primary" />
                            )}
                          </Stack>
                          <Stack direction="row" spacing={0.5} mt={1}>
                            {preset.items.slice(0, 3).map((item, i) => (
                              <Box
                                key={i}
                                sx={{
                                  width: 16,
                                  height: 16,
                                  bgcolor: item.color,
                                  borderRadius: '50%',
                                  border: '1px solid',
                                  borderColor: 'divider'}}
                              />
                            ))}
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSelectedMakeupPreset(null);
                  onMakeupChange?.([]);
                }}
                sx={{ mt: 2 }}
                fullWidth
              >
                Clear Makeup
              </Button>
            </>
          )}
        </Box>
      )}

      {/* SKIN DETAILS TAB */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Adjust skin details for more realistic actors.
          </Typography>

          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Age: {skinAge} years
            </Typography>
            <Slider
              value={skinAge}
              onChange={(_, v) => setSkinAge(v as number)}
              onChangeCommitted={handleSkinDetailsChange}
              min={5}
              max={90}
              step={1}
              marks={[
                { value: 20, label: '20' },
                { value: 40, label: '40' },
                { value: 60, label: '60' },
                { value: 80, label: '80' },
              ]}
            />
          </Box>

          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Wrinkles: {wrinkles === 0 ? 'None' : wrinkles < 0.5 ? 'Light' : 'Visible'}
            </Typography>
            <Slider
              value={wrinkles}
              onChange={(_, v) => setWrinkles(v as number)}
              onChangeCommitted={handleSkinDetailsChange}
              min={0}
              max={1}
              step={0.1}
            />
          </Box>

          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Pore Visibility: {pores === 0 ? 'Smooth' : pores < 0.5 ? 'Subtle' : 'Visible'}
            </Typography>
            <Slider
              value={pores}
              onChange={(_, v) => setPores(v as number)}
              onChangeCommitted={handleSkinDetailsChange}
              min={0}
              max={1}
              step={0.1}
            />
          </Box>

          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Freckles: {freckles === 0 ? 'None' : freckles < 0.5 ? 'Light' : 'Many'}
            </Typography>
            <Slider
              value={freckles}
              onChange={(_, v) => setFreckles(v as number)}
              onChangeCommitted={handleSkinDetailsChange}
              min={0}
              max={1}
              step={0.1}
            />
          </Box>

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setWrinkles(0);
              setPores(0.3);
              setFreckles(0);
              setSkinAge(30);
              handleSkinDetailsChange();
            }}
            fullWidth
          >
            Reset to Default
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default FacialFeaturesPanel;

