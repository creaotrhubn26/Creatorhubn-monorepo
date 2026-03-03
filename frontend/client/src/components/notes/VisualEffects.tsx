import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome,
  BlurOn,
  FilterHdr,
  Gradient,
  LightMode,
  Settings,
  Tune,
} from '@mui/icons-material';

export type VisualEffectType =
  | 'particle'
  | 'gradient'
  | 'blur'
  | 'glow'
  | 'shadow'
  | 'transform'
  | 'filter';

export interface VisualEffect {
  id: string;
  name: string;
  description: string;
  type: VisualEffectType;
  intensity: number;
  duration: number;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface EffectPreset {
  id: string;
  name: string;
  description: string;
  effects: VisualEffect[];
  category: 'ambient' | 'interactive' | 'decorative' | 'functional';
}

interface VisualEffectsProps {
  className?: string;
  onEffectChange?: (effect: VisualEffect) => void;
  onPresetApply?: (preset: EffectPreset) => void;
  onEffectExport?: (effects: VisualEffect[]) => void;
}

const EFFECT_TYPES: VisualEffectType[] = [
  'particle',
  'gradient',
  'blur',
  'glow',
  'shadow',
  'transform',
  'filter',
];

const DEFAULT_EFFECTS: VisualEffect[] = [
  {
    id: 'fx-particle-rain',
    name: 'Particle Rain',
    description: 'Subtle particles for motion depth.',
    type: 'particle',
    intensity: 0.6,
    duration: 1200,
    enabled: true,
    config: { particleCount: 30, speed: 1.2, color: '#ffffff' },
  },
  {
    id: 'fx-gradient-background',
    name: 'Gradient Backdrop',
    description: 'Animated gradient background blend.',
    type: 'gradient',
    intensity: 0.45,
    duration: 900,
    enabled: true,
    config: { colors: ['#1b263b', '#415a77', '#778da9'] },
  },
  {
    id: 'fx-soft-glow',
    name: 'Soft Glow',
    description: 'Glow for selected clips and UI feedback.',
    type: 'glow',
    intensity: 0.35,
    duration: 350,
    enabled: true,
    config: { color: '#ff8c00', radius: 16 },
  },
  {
    id: 'fx-smart-blur',
    name: 'Smart Blur',
    description: 'Directional blur for focus transitions.',
    type: 'blur',
    intensity: 0.25,
    duration: 700,
    enabled: false,
    config: { radius: 6, target: 'background' },
  },
];

const DEFAULT_PRESETS: EffectPreset[] = [
  {
    id: 'preset-clean-cinematic',
    name: 'Clean Cinematic',
    description: 'Balanced cinematic look for narrative edits.',
    category: 'ambient',
    effects: [
      {
        id: 'fx-cine-shadow',
        name: 'Cinematic Shadow',
        description: 'Adds soft vignetting and depth.',
        type: 'shadow',
        intensity: 0.3,
        duration: 500,
        enabled: true,
        config: { spread: 12, color: 'rgba(0,0,0,0.25)' },
      },
      {
        id: 'fx-cine-gradient',
        name: 'Cinematic Tint',
        description: 'Dual-tone grade style blend.',
        type: 'gradient',
        intensity: 0.4,
        duration: 600,
        enabled: true,
        config: { highlights: '#f2c879', shadows: '#264653' },
      },
    ],
  },
  {
    id: 'preset-ui-feedback',
    name: 'UI Feedback',
    description: 'High-clarity interaction cues for editing.',
    category: 'functional',
    effects: [
      {
        id: 'fx-ui-glow',
        name: 'Selection Glow',
        description: 'Clip edge emphasis for active selection.',
        type: 'glow',
        intensity: 0.65,
        duration: 250,
        enabled: true,
        config: { color: '#ffb347', radius: 10 },
      },
    ],
  },
];

const toNumeric = (value: number | number[]): number =>
  Array.isArray(value) ? value[0] ?? 0 : value;

const isEffectType = (value: string): value is VisualEffectType =>
  EFFECT_TYPES.includes(value as VisualEffectType);

const getEffectIcon = (type: VisualEffectType): React.ReactElement => {
  switch (type) {
    case 'particle':
      return <AutoAwesome fontSize="small" />;
    case 'gradient':
      return <Gradient fontSize="small" />;
    case 'blur':
      return <BlurOn fontSize="small" />;
    case 'glow':
      return <LightMode fontSize="small" />;
    case 'shadow':
      return <FilterHdr fontSize="small" />;
    case 'transform':
      return <Tune fontSize="small" />;
    case 'filter':
      return <Settings fontSize="small" />;
    default:
      return <Tune fontSize="small" />;
  }
};

const createNewEffect = (): VisualEffect => ({
  id: `fx-custom-${Date.now()}`,
  name: 'Custom Effect',
  description: '',
  type: 'filter',
  intensity: 0.5,
  duration: 500,
  enabled: true,
  config: {},
});

const VisualEffects: React.FC<VisualEffectsProps> = ({
  className,
  onEffectChange,
  onPresetApply,
  onEffectExport,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [effects, setEffects] = useState<VisualEffect[]>(DEFAULT_EFFECTS);
  const [presets] = useState<EffectPreset[]>(DEFAULT_PRESETS);
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const selectedEffect = useMemo(
    () => effects.find((effect) => effect.id === editingEffectId) ?? null,
    [effects, editingEffectId],
  );

  useEffect(() => {
    if (selectedEffect) {
      onEffectChange?.(selectedEffect);
    }
  }, [selectedEffect, onEffectChange]);

  const updateEffect = (effectId: string, patch: Partial<VisualEffect>): void => {
    setEffects((prev) =>
      prev.map((effect) =>
        effect.id === effectId
          ? {
              ...effect,
              ...patch,
            }
          : effect,
      ),
    );
  };

  const openEditor = (effectId: string): void => {
    setEditingEffectId(effectId);
    setIsEditorOpen(true);
  };

  const addEffect = (): void => {
    const created = createNewEffect();
    setEffects((prev) => [...prev, created]);
    setEditingEffectId(created.id);
    setIsEditorOpen(true);
  };

  const deleteEffect = (effectId: string): void => {
    setEffects((prev) => prev.filter((effect) => effect.id !== effectId));
    if (editingEffectId === effectId) {
      setEditingEffectId(null);
      setIsEditorOpen(false);
    }
  };

  const applyPreset = (preset: EffectPreset): void => {
    setEffects((prev) => {
      const byId = new Map(prev.map((item) => [item.id, item]));
      preset.effects.forEach((effect) => {
        byId.set(effect.id, effect);
      });
      return Array.from(byId.values());
    });
    onPresetApply?.(preset);
  };

  const enabledCount = useMemo(
    () => effects.filter((effect) => effect.enabled).length,
    [effects],
  );

  return (
    <Box className={className}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6">Visual Effects</Typography>
            <Typography variant="body2" color="text.secondary">
              {enabledCount}/{effects.length} active effects
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={addEffect}>
              Add Effect
            </Button>
            <Button variant="contained" onClick={() => onEffectExport?.(effects)}>
              Export Effects
            </Button>
          </Stack>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={effects.length === 0 ? 0 : (enabledCount / effects.length) * 100}
          sx={{ mb: 2 }}
        />

        <Tabs value={activeTab} onChange={(_event, value: number) => setActiveTab(value)}>
          <Tab label="Effects" />
          <Tab label="Presets" />
          <Tab label="Preview" />
        </Tabs>

        {activeTab === 0 && (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {effects.map((effect) => (
              <Grid item xs={12} md={6} key={effect.id}>
                <Card variant="outlined">
                  <CardHeader
                    avatar={getEffectIcon(effect.type)}
                    title={effect.name}
                    subheader={effect.description}
                    action={
                      <Chip
                        label={effect.enabled ? 'Enabled' : 'Disabled'}
                        color={effect.enabled ? 'success' : 'default'}
                        size="small"
                      />
                    }
                  />
                  <CardContent>
                    <Stack spacing={1.5}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={effect.enabled}
                            onChange={(event) =>
                              updateEffect(effect.id, { enabled: event.target.checked })
                            }
                          />
                        }
                        label="Enabled"
                      />
                      <Typography variant="body2">Intensity {Math.round(effect.intensity * 100)}%</Typography>
                      <Slider
                        value={effect.intensity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(_event, value) =>
                          updateEffect(effect.id, { intensity: toNumeric(value) })
                        }
                      />
                      <Typography variant="body2">Duration {effect.duration}ms</Typography>
                      <Slider
                        value={effect.duration}
                        min={50}
                        max={5000}
                        step={50}
                        onChange={(_event, value) =>
                          updateEffect(effect.id, { duration: Math.round(toNumeric(value)) })
                        }
                      />
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => openEditor(effect.id)}>
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => deleteEffect(effect.id)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {activeTab === 1 && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            {presets.map((preset) => (
              <Paper key={preset.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1">{preset.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {preset.description}
                    </Typography>
                    <Stack direction="row" spacing={1} mt={1}>
                      <Chip label={preset.category} size="small" />
                      <Chip label={`${preset.effects.length} effects`} size="small" />
                    </Stack>
                  </Box>
                  <Button variant="contained" onClick={() => applyPreset(preset)}>
                    Apply
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        {activeTab === 2 && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            {enabledCount === 0 ? (
              <Alert severity="warning">Enable at least one effect to preview the stack.</Alert>
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Preview Stack</Typography>
                {effects
                  .filter((effect) => effect.enabled)
                  .map((effect) => (
                    <Box
                      key={effect.id}
                      sx={{
                        borderRadius: 1,
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        background:
                          effect.type === 'gradient'
                            ? 'linear-gradient(135deg, rgba(64,90,120,0.25), rgba(255,140,0,0.2))'
                            : 'background.paper',
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">{effect.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {effect.type}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Intensity {Math.round(effect.intensity * 100)}% • {effect.duration}ms
                      </Typography>
                    </Box>
                  ))}
              </Stack>
            )}
          </Paper>
        )}
      </Paper>

      <Dialog open={isEditorOpen} onClose={() => setIsEditorOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Effect</DialogTitle>
        <DialogContent>
          {!selectedEffect ? (
            <Alert severity="info">Select an effect to edit.</Alert>
          ) : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Name"
                value={selectedEffect.name}
                onChange={(event) =>
                  updateEffect(selectedEffect.id, { name: event.target.value })
                }
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedEffect.description}
                onChange={(event) =>
                  updateEffect(selectedEffect.id, { description: event.target.value })
                }
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel id="effect-type-label">Type</InputLabel>
                <Select
                  labelId="effect-type-label"
                  label="Type"
                  value={selectedEffect.type}
                  onChange={(event) => {
                    const value = String(event.target.value);
                    if (isEffectType(value)) {
                      updateEffect(selectedEffect.id, { type: value });
                    }
                  }}
                >
                  {EFFECT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Divider />
              <Typography variant="caption" color="text.secondary">
                You can fine-tune intensity/duration directly in the effects list.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditorOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisualEffects;
