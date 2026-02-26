import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  ImageSearch,
  Refresh,
  Wallpaper,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  storyboardAIGenerationService,
  type StoryboardTemplate,
  type GenerateFrameResponse,
} from '../../services/storyboardAIGenerationService';
import type {
  ConceptArtIntentData,
  ConceptArtVariantData,
  FrameConceptArtData,
} from '../../state/storyboardStore';

export interface ConceptArtPanelProps {
  conceptArt: FrameConceptArtData;
  onConceptArtChange: (conceptArt: FrameConceptArtData) => void;
  onApplyReferenceImage: (imageUrl: string) => void;
}

type IntentField = keyof Omit<ConceptArtIntentData, 'prompt' | 'generatedAt'>;

const VariantCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  overflow: 'hidden',
  border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.12)',
  backgroundColor: selected ? 'rgba(124,58,237,0.12)' : 'rgba(20,20,30,0.9)',
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-2px)',
    borderColor: 'rgba(124,58,237,0.55)',
  },
}));

const FALLBACK_VARIATION_NOTES = [
  'wide establishing composition with layered foreground, midground, background',
  'medium composition focused on emotional center and cinematic lighting',
  'dynamic angle with directional light and strong depth cues',
  'atmospheric version with richer mood contrast and environmental storytelling',
  'minimalist composition emphasizing silhouettes and shape language',
  'high-energy dramatic framing with motion suggestion and texture',
] as const;

const DEFAULT_TEMPLATES: StoryboardTemplate[] = [
  { id: 'cinematic', name: 'Filmisk', description: 'Dramatisk kinolook' },
  { id: 'drama', name: 'Drama/TV-serie', description: 'Varme toner, intimt' },
  { id: 'documentary', name: 'Dokumentar', description: 'Naturlig stil' },
];

function normalizeBase64Image(imageBase64?: string): string | null {
  if (!imageBase64) return null;
  if (imageBase64.startsWith('data:')) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
}

function resolveGeneratedImage(response: GenerateFrameResponse): string | null {
  if (response.imageUrl) return response.imageUrl;
  return normalizeBase64Image(response.imageBase64);
}

function buildPrompt(intent: ConceptArtIntentData): string {
  const details = [
    intent.sceneIntent ? `Scene intent: ${intent.sceneIntent}` : null,
    intent.environment ? `Environment: ${intent.environment}` : null,
    intent.mood ? `Mood: ${intent.mood}` : null,
    intent.timeOfDay ? `Time of day: ${intent.timeOfDay}` : null,
    intent.style ? `Visual style: ${intent.style}` : null,
    intent.camera ? `Camera language: ${intent.camera}` : null,
    intent.notes ? `Extra notes: ${intent.notes}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  details.push(
    'Create cinematic concept art for previsualization.',
    'No text overlays or logos.',
    'High detail, strong composition, production-ready mood.'
  );

  return details.join(' ');
}

function fallbackMoodColors(mood: string, timeOfDay: string): [string, string] {
  const moodKey = mood.toLowerCase();
  const timeKey = timeOfDay.toLowerCase();

  if (timeKey.includes('night')) return ['#0d1b3d', '#2e1a47'];
  if (timeKey.includes('sunset') || timeKey.includes('dusk')) return ['#49243e', '#c95e3a'];
  if (timeKey.includes('dawn') || timeKey.includes('morning')) return ['#1c385f', '#f1a56f'];
  if (timeKey.includes('day')) return ['#1a4e72', '#85b6d4'];

  if (moodKey.includes('dark') || moodKey.includes('tense')) return ['#111827', '#3f1d2e'];
  if (moodKey.includes('warm') || moodKey.includes('romantic')) return ['#45243b', '#d97f56'];
  if (moodKey.includes('cold') || moodKey.includes('clinical')) return ['#0f2a3b', '#4e7f96'];
  if (moodKey.includes('dream') || moodKey.includes('ethereal')) return ['#2a1e52', '#7f6fd6'];

  return ['#1c3045', '#675980'];
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(/\s+/);
  let line = '';
  let lineCount = 0;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = word;
      lineCount += 1;
    } else {
      line = testLine;
    }
  });

  if (line) {
    ctx.fillText(line, x, y + lineCount * lineHeight);
    lineCount += 1;
  }

  return lineCount;
}

function createFallbackConceptImage(intent: ConceptArtIntentData, variationNote: string, variantIndex: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const [colorA, colorB] = fallbackMoodColors(intent.mood, intent.timeOfDay);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(1, colorB);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 5; i += 1) {
    const width = 220 + i * 140;
    const height = 120 + i * 65;
    const x = 40 + i * 220;
    const y = 120 + ((i % 2) * 120);
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#0f172a';
    ctx.fillRect(x, y, width, height);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(8, 10, 18, 0.66)';
  ctx.fillRect(40, canvas.height - 220, canvas.width - 80, 170);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 36px Inter, sans-serif';
  const title = intent.environment || intent.sceneIntent || 'Scene Concept';
  ctx.fillText(`Concept Variant ${variantIndex + 1}`, 68, canvas.height - 182);

  ctx.font = '500 24px Inter, sans-serif';
  wrapText(ctx, title, 68, canvas.height - 140, canvas.width - 160, 34);

  ctx.font = '400 19px Inter, sans-serif';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
  wrapText(ctx, variationNote, 68, canvas.height - 86, canvas.width - 160, 30);

  return canvas.toDataURL('image/png');
}

function createVariantId(index: number): string {
  return `concept-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ConceptArtPanel: React.FC<ConceptArtPanelProps> = ({
  conceptArt,
  onConceptArtChange,
  onApplyReferenceImage,
}) => {
  const [templates, setTemplates] = useState<StoryboardTemplate[]>(DEFAULT_TEMPLATES);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [variantCount, setVariantCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setTemplatesLoading(true);
    storyboardAIGenerationService.getTemplates()
      .then((templateMap) => {
        if (!mounted) return;
        const list = Object.values(templateMap);
        if (list.length > 0) {
          setTemplates(list);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        setGenerationError(error instanceof Error ? error.message : 'Failed to load templates');
      })
      .finally(() => {
        if (!mounted) return;
        setTemplatesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedVariant = useMemo(
    () => conceptArt.variants.find((variant) => variant.id === conceptArt.selectedVariantId) ?? null,
    [conceptArt.variants, conceptArt.selectedVariantId]
  );

  const handleIntentChange = useCallback((field: IntentField, value: string) => {
    onConceptArtChange({
      ...conceptArt,
      intent: {
        ...conceptArt.intent,
        [field]: value,
      },
    });
  }, [conceptArt, onConceptArtChange]);

  const handleTemplateChange = useCallback((template: string) => {
    onConceptArtChange({
      ...conceptArt,
      intent: {
        ...conceptArt.intent,
        template,
      },
    });
  }, [conceptArt, onConceptArtChange]);

  const handleSelectVariant = useCallback((variantId: string) => {
    onConceptArtChange({
      ...conceptArt,
      selectedVariantId: variantId,
    });
  }, [conceptArt, onConceptArtChange]);

  const handleApplyVariant = useCallback((variant: ConceptArtVariantData) => {
    onConceptArtChange({
      ...conceptArt,
      selectedVariantId: variant.id,
    });
    onApplyReferenceImage(variant.imageUrl);
  }, [conceptArt, onApplyReferenceImage, onConceptArtChange]);

  const handleApplySelectedVariant = useCallback(() => {
    if (!selectedVariant) return;
    onApplyReferenceImage(selectedVariant.imageUrl);
  }, [onApplyReferenceImage, selectedVariant]);

  const handleGenerate = useCallback(async () => {
    if (!conceptArt.intent.sceneIntent.trim()) {
      setGenerationError('Scene intent is required before generating concept art.');
      return;
    }

    setGenerationError(null);
    setIsGenerating(true);

    const now = new Date().toISOString();
    const prompt = buildPrompt(conceptArt.intent);
    const notes = FALLBACK_VARIATION_NOTES.slice(0, Math.max(1, Math.min(variantCount, FALLBACK_VARIATION_NOTES.length)));

    try {
      const responses = await storyboardAIGenerationService.generateFramesBatch(
        notes.map((variationNote) => ({
          prompt,
          template: conceptArt.intent.template || 'cinematic',
          additionalNotes: variationNote,
          size: '1536x1024',
        }))
      );

      const variants: ConceptArtVariantData[] = responses.map((response: GenerateFrameResponse, index) => {
        const variationPrompt = `${prompt} Variation note: ${notes[index]}.`;
        const resolvedImage = resolveGeneratedImage(response);
        const fallbackImage = createFallbackConceptImage(conceptArt.intent, notes[index], index);
        const isAiVariant = Boolean(response.success && resolvedImage);

        return {
          id: createVariantId(index),
          imageUrl: isAiVariant && resolvedImage ? resolvedImage : fallbackImage,
          prompt: variationPrompt,
          source: isAiVariant ? 'ai' : 'fallback',
          model: response.model,
          createdAt: now,
          error: response.error,
        };
      });

      const aiVariantCount = variants.filter((variant) => variant.source === 'ai').length;
      if (aiVariantCount === 0) {
        setGenerationError('AI generation is unavailable right now. Created local concept placeholders so the workflow continues.');
      }

      const selectedVariantId = variants[0]?.id ?? null;
      onConceptArtChange({
        intent: {
          ...conceptArt.intent,
          prompt,
          generatedAt: now,
        },
        variants,
        selectedVariantId,
        lastGeneratedAt: now,
      });
    } catch (error) {
      const fallbackVariants: ConceptArtVariantData[] = notes.map((variationNote, index) => ({
        id: createVariantId(index),
        imageUrl: createFallbackConceptImage(conceptArt.intent, variationNote, index),
        prompt: `${prompt} Variation note: ${variationNote}.`,
        source: 'fallback',
        createdAt: now,
      }));

      onConceptArtChange({
        intent: {
          ...conceptArt.intent,
          prompt,
          generatedAt: now,
        },
        variants: fallbackVariants,
        selectedVariantId: fallbackVariants[0]?.id ?? null,
        lastGeneratedAt: now,
      });

      setGenerationError(
        error instanceof Error
          ? `AI generation failed (${error.message}). Local concept placeholders were generated instead.`
          : 'AI generation failed. Local concept placeholders were generated instead.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [conceptArt, onConceptArtChange, variantCount]);

  return (
    <Box sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesome sx={{ fontSize: 18, color: '#f59e0b' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Concept Art
          </Typography>
        </Stack>
        {conceptArt.lastGeneratedAt && (
          <Chip
            size="small"
            label={`Updated ${new Date(conceptArt.lastGeneratedAt).toLocaleTimeString()}`}
            sx={{ height: 20, fontSize: 10 }}
          />
        )}
      </Stack>

      <Stack spacing={1}>
        <TextField
          size="small"
          label="Scene Intent"
          value={conceptArt.intent.sceneIntent}
          onChange={(event) => handleIntentChange('sceneIntent', event.target.value)}
          multiline
          minRows={2}
          placeholder="What should this scene communicate emotionally and visually?"
        />

        <Grid container spacing={1}>
          <Grid size={6}>
            <TextField
              size="small"
              label="Environment"
              value={conceptArt.intent.environment}
              onChange={(event) => handleIntentChange('environment', event.target.value)}
              placeholder="Forest bunker, neon alley..."
              fullWidth
            />
          </Grid>
          <Grid size={6}>
            <TextField
              size="small"
              label="Mood"
              value={conceptArt.intent.mood}
              onChange={(event) => handleIntentChange('mood', event.target.value)}
              placeholder="Tense, hopeful, eerie..."
              fullWidth
            />
          </Grid>
          <Grid size={6}>
            <TextField
              size="small"
              label="Time of Day"
              value={conceptArt.intent.timeOfDay}
              onChange={(event) => handleIntentChange('timeOfDay', event.target.value)}
              placeholder="Blue hour, midnight..."
              fullWidth
            />
          </Grid>
          <Grid size={6}>
            <TextField
              size="small"
              label="Camera Intent"
              value={conceptArt.intent.camera}
              onChange={(event) => handleIntentChange('camera', event.target.value)}
              placeholder="Wide 24mm low angle..."
              fullWidth
            />
          </Grid>
          <Grid size={6}>
            <TextField
              size="small"
              label="Visual Style"
              value={conceptArt.intent.style}
              onChange={(event) => handleIntentChange('style', event.target.value)}
              placeholder="Painterly, photoreal..."
              fullWidth
            />
          </Grid>
          <Grid size={6}>
            <FormControl size="small" fullWidth disabled={templatesLoading}>
              <InputLabel>Template</InputLabel>
              <Select
                value={conceptArt.intent.template || 'cinematic'}
                label="Template"
                onChange={(event) => handleTemplateChange(String(event.target.value))}
              >
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <TextField
          size="small"
          label="Additional Notes"
          value={conceptArt.intent.notes}
          onChange={(event) => handleIntentChange('notes', event.target.value)}
          multiline
          minRows={2}
          placeholder="Production design cues, weather, wardrobe influence..."
        />

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={0.5}>
            {[3, 4, 6].map((count) => (
              <Chip
                key={count}
                label={`${count} variants`}
                color={variantCount === count ? 'primary' : 'default'}
                size="small"
                onClick={() => setVariantCount(count)}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<Refresh />}
              variant="outlined"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              Regenerate
            </Button>
            <Button
              size="small"
              startIcon={isGenerating ? <CircularProgress size={14} color="inherit" /> : <ImageSearch />}
              variant="contained"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              Generate Concepts
            </Button>
          </Stack>
        </Stack>
      </Stack>

      {generationError && (
        <Alert severity="warning" sx={{ mt: 1.25 }}>
          {generationError}
        </Alert>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Variants ({conceptArt.variants.length})
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Wallpaper />}
          onClick={handleApplySelectedVariant}
          disabled={!selectedVariant}
        >
          Apply Selected as Reference
        </Button>
      </Stack>

      {conceptArt.variants.length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            textAlign: 'center',
            borderStyle: 'dashed',
            borderColor: 'rgba(255,255,255,0.25)',
            bgcolor: 'rgba(255,255,255,0.02)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Generate concept variants to preview environments before scene lock.
          </Typography>
        </Paper>
      )}

      <Grid container spacing={1}>
        {conceptArt.variants.map((variant) => (
          <Grid key={variant.id} size={6}>
            <VariantCard
              selected={variant.id === conceptArt.selectedVariantId}
              onClick={() => handleSelectVariant(variant.id)}
            >
              <Box
                component="img"
                src={variant.imageUrl}
                alt="Concept variant"
                sx={{ width: '100%', height: 106, objectFit: 'cover', display: 'block' }}
              />
              <Box sx={{ p: 0.9 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Chip
                    size="small"
                    label={variant.source === 'ai' ? 'AI' : 'Fallback'}
                    color={variant.source === 'ai' ? 'success' : 'default'}
                    sx={{ height: 18, fontSize: 10 }}
                  />
                  {variant.id === conceptArt.selectedVariantId && (
                    <Tooltip title="Selected">
                      <IconButton size="small" sx={{ p: 0.25 }}>
                        <CheckCircle sx={{ fontSize: 14, color: '#22c55e' }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {variant.prompt}
                </Typography>
                <Button
                  fullWidth
                  size="small"
                  sx={{ mt: 0.8 }}
                  variant={variant.id === conceptArt.selectedVariantId ? 'contained' : 'outlined'}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleApplyVariant(variant);
                  }}
                >
                  Use as Reference
                </Button>
              </Box>
            </VariantCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ConceptArtPanel;
