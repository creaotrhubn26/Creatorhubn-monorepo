import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoFixHigh,
  ExpandMore,
  GridOn,
  Palette,
  Settings,
  Straighten,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useTheming } from '../utils/theming-helper';

type StoryType =
  | 'wedding'
  | 'corporate'
  | 'documentary'
  | 'commercial'
  | 'music_video'
  | 'event';

type StoryPhase = 'setup' | 'conflict' | 'climax' | 'resolution' | 'denouement';

interface CompositionOverlayProps {
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
  onAnalysisComplete?: (analysis: CompositionAnalysis) => void;
  currentImageUrl?: string;
  storyType?: StoryType;
  currentPhase?: StoryPhase;
}

interface OverlaySettings {
  ruleOfThirds: boolean;
  goldenRatio: boolean;
  goldenSpiral: boolean;
  centerCrosshair: boolean;
  diagonalLines: boolean;
  symmetryLines: boolean;
  aspectRatio: boolean;
  safeAreas: boolean;
  opacity: number;
  color: string;
  thickness: number;
}

interface CompositionAnalysis {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  generatedAt: string;
  context: {
    storyType: StoryType;
    phase: StoryPhase;
    activeGuides: string[];
  };
}

const INITIAL_SETTINGS: OverlaySettings = {
  ruleOfThirds: true,
  goldenRatio: false,
  goldenSpiral: false,
  centerCrosshair: true,
  diagonalLines: false,
  symmetryLines: false,
  aspectRatio: true,
  safeAreas: false,
  opacity: 0.72,
  color: '#21ff7a',
  thickness: 2,
};

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : cleaned;

  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function storyTypeLabel(type: StoryType): string {
  switch (type) {
    case 'music_video':
      return 'Music Video';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

export default function CompositionOverlay({
  isVisible,
  onToggle,
  onAnalysisComplete,
  currentImageUrl,
  storyType = 'wedding',
  currentPhase = 'setup',
}: CompositionOverlayProps) {
  const theming = useTheming('videographer');
  const [settings, setSettings] = useState<OverlaySettings>(INITIAL_SETTINGS);
  const [analysis, setAnalysis] = useState<CompositionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const stroke = useMemo(
    () => hexToRgba(settings.color, settings.opacity),
    [settings.color, settings.opacity],
  );

  const activeGuides = useMemo(() => {
    const guides: string[] = [];
    if (settings.ruleOfThirds) guides.push('Rule of Thirds');
    if (settings.goldenRatio) guides.push('Golden Ratio');
    if (settings.goldenSpiral) guides.push('Golden Spiral');
    if (settings.centerCrosshair) guides.push('Center Crosshair');
    if (settings.diagonalLines) guides.push('Diagonal Lines');
    if (settings.symmetryLines) guides.push('Symmetry Lines');
    if (settings.aspectRatio) guides.push('Aspect Ratio');
    if (settings.safeAreas) guides.push('Safe Areas');
    return guides;
  }, [settings]);

  const updateSetting = <K extends keyof OverlaySettings>(key: K, value: OverlaySettings[K]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const analyzeComposition = async () => {
    setIsAnalyzing(true);

    try {
      let remoteAnalysis: CompositionAnalysis | null = null;

      if (currentImageUrl) {
        const response = await fetch('/api/composition-analysis/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: currentImageUrl,
            context: {
              storyType,
              currentPhase,
              activeGuides,
            },
          }),
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            data?: Partial<CompositionAnalysis>;
          };

          if (payload.data) {
            const score = Number(payload.data.score ?? 0);
            remoteAnalysis = {
              score: Number.isFinite(score) ? score : 0,
              strengths: payload.data.strengths ?? [],
              weaknesses: payload.data.weaknesses ?? [],
              suggestions: payload.data.suggestions ?? [],
              generatedAt: payload.data.generatedAt ?? new Date().toISOString(),
              context: {
                storyType,
                phase: currentPhase,
                activeGuides,
              },
            };
          }
        }
      }

      const fallbackScoreBase = 55 + Math.min(activeGuides.length * 4, 25);
      const phaseBonus = currentPhase === 'climax' ? 8 : currentPhase === 'resolution' ? 4 : 0;
      const fallbackScore = Math.min(100, fallbackScoreBase + phaseBonus);

      const nextAnalysis: CompositionAnalysis =
        remoteAnalysis ?? {
          score: fallbackScore,
          strengths: [
            `Guide density is ${activeGuides.length} active overlays`,
            `${storyTypeLabel(storyType)} framing tuned for ${currentPhase}`,
          ],
          weaknesses: activeGuides.length < 2 ? ['Consider enabling additional guide lines for framing confidence'] : [],
          suggestions: [
            settings.ruleOfThirds ? 'Keep primary subject near intersection points' : 'Enable rule-of-thirds for balanced placement',
            settings.safeAreas ? 'Safe-area margins are enabled for title/action fit' : 'Enable safe areas for delivery-safe framing',
            settings.centerCrosshair
              ? 'Use center crosshair for hero lock-off shots'
              : 'Enable center crosshair for symmetric shots',
          ],
          generatedAt: new Date().toISOString(),
          context: {
            storyType,
            phase: currentPhase,
            activeGuides,
          },
        };

      setAnalysis(nextAnalysis);
      onAnalysisComplete?.(nextAnalysis);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GridOn fontSize="small" />
            Composition Overlay
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {storyTypeLabel(storyType)} • {currentPhase} • {activeGuides.length} active guides
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant={isVisible ? 'contained' : 'outlined'}
            startIcon={isVisible ? <Visibility /> : <VisibilityOff />}
            onClick={() => onToggle(!isVisible)}
            sx={isVisible ? theming.getThemedButtonSx() : undefined}
          >
            {isVisible ? 'Overlay On' : 'Overlay Off'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<AutoFixHigh />}
            onClick={analyzeComposition}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </Button>
          <IconButton onClick={() => setShowSettingsDialog(true)}>
            <Settings fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: '#101824',
          border: '1px solid',
          borderColor: 'divider',
          backgroundImage: currentImageUrl
            ? `url(${currentImageUrl})`
            : 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {isVisible && (
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            {settings.ruleOfThirds && (
              <>
                <line x1="33.333" y1="0" x2="33.333" y2="100" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="66.666" y1="0" x2="66.666" y2="100" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="0" y1="33.333" x2="100" y2="33.333" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="0" y1="66.666" x2="100" y2="66.666" stroke={stroke} strokeWidth={settings.thickness} />
              </>
            )}

            {settings.goldenRatio && (
              <>
                <line x1="38.2" y1="0" x2="38.2" y2="100" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="61.8" y1="0" x2="61.8" y2="100" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="0" y1="38.2" x2="100" y2="38.2" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="0" y1="61.8" x2="100" y2="61.8" stroke={stroke} strokeWidth={settings.thickness} />
              </>
            )}

            {settings.centerCrosshair && (
              <>
                <line x1="50" y1="0" x2="50" y2="100" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={settings.thickness} />
              </>
            )}

            {settings.diagonalLines && (
              <>
                <line x1="0" y1="0" x2="100" y2="100" stroke={stroke} strokeWidth={settings.thickness} />
                <line x1="100" y1="0" x2="0" y2="100" stroke={stroke} strokeWidth={settings.thickness} />
              </>
            )}

            {settings.symmetryLines && (
              <>
                <line x1="25" y1="0" x2="25" y2="100" stroke={stroke} strokeWidth={settings.thickness} strokeDasharray="2 2" />
                <line x1="75" y1="0" x2="75" y2="100" stroke={stroke} strokeWidth={settings.thickness} strokeDasharray="2 2" />
                <line x1="0" y1="25" x2="100" y2="25" stroke={stroke} strokeWidth={settings.thickness} strokeDasharray="2 2" />
                <line x1="0" y1="75" x2="100" y2="75" stroke={stroke} strokeWidth={settings.thickness} strokeDasharray="2 2" />
              </>
            )}

            {settings.safeAreas && (
              <rect
                x="10"
                y="10"
                width="80"
                height="80"
                fill="none"
                stroke={stroke}
                strokeWidth={settings.thickness}
                strokeDasharray="3 2"
              />
            )}

            {settings.aspectRatio && (
              <rect
                x="6"
                y="18"
                width="88"
                height="64"
                fill="none"
                stroke={stroke}
                strokeWidth={Math.max(1, settings.thickness - 0.5)}
              />
            )}

            {settings.goldenSpiral && (
              <path
                d="M 0 100 Q 0 0 100 0 Q 60 60 20 80"
                fill="none"
                stroke={stroke}
                strokeWidth={settings.thickness}
              />
            )}
          </svg>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }} useFlexGap>
        {activeGuides.map((guide) => (
          <Chip key={guide} label={guide} size="small" variant="outlined" />
        ))}
      </Stack>

      {analysis && (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Straighten fontSize="small" />
              Composition Analysis (Score {analysis.score}/100)
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Generated {new Date(analysis.generatedAt).toLocaleString()}
              </Typography>

              {analysis.strengths.length > 0 && (
                <Alert severity="success">
                  <Typography variant="subtitle2">Strengths</Typography>
                  <ul>
                    {analysis.strengths.map((item) => (
                      <li key={item}>
                        <Typography variant="body2">{item}</Typography>
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              {analysis.weaknesses.length > 0 && (
                <Alert severity="warning">
                  <Typography variant="subtitle2">Weaknesses</Typography>
                  <ul>
                    {analysis.weaknesses.map((item) => (
                      <li key={item}>
                        <Typography variant="body2">{item}</Typography>
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Palette fontSize="small" />
          Overlay Settings
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="subtitle2">Guides</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.ruleOfThirds}
                  onChange={(event) => updateSetting('ruleOfThirds', event.target.checked)}
                />
              }
              label="Rule of Thirds"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.goldenRatio}
                  onChange={(event) => updateSetting('goldenRatio', event.target.checked)}
                />
              }
              label="Golden Ratio"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.goldenSpiral}
                  onChange={(event) => updateSetting('goldenSpiral', event.target.checked)}
                />
              }
              label="Golden Spiral"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.centerCrosshair}
                  onChange={(event) => updateSetting('centerCrosshair', event.target.checked)}
                />
              }
              label="Center Crosshair"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.diagonalLines}
                  onChange={(event) => updateSetting('diagonalLines', event.target.checked)}
                />
              }
              label="Diagonal Lines"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.symmetryLines}
                  onChange={(event) => updateSetting('symmetryLines', event.target.checked)}
                />
              }
              label="Symmetry Lines"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.aspectRatio}
                  onChange={(event) => updateSetting('aspectRatio', event.target.checked)}
                />
              }
              label="Aspect Ratio"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.safeAreas}
                  onChange={(event) => updateSetting('safeAreas', event.target.checked)}
                />
              }
              label="Safe Areas"
            />

            <Divider />

            <Typography variant="subtitle2">Style</Typography>
            <TextField
              label="Guide Color"
              type="color"
              value={settings.color}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                updateSetting('color', event.target.value)
              }
              InputLabelProps={{ shrink: true }}
            />

            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Opacity ({settings.opacity.toFixed(2)})
              </Typography>
              <Slider
                value={settings.opacity}
                min={0.1}
                max={1}
                step={0.01}
                onChange={(_, value) => updateSetting('opacity', value as number)}
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Thickness ({settings.thickness}px)
              </Typography>
              <Slider
                value={settings.thickness}
                min={1}
                max={6}
                step={1}
                onChange={(_, value) => updateSetting('thickness', value as number)}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)} startIcon={<ExpandMore />}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
