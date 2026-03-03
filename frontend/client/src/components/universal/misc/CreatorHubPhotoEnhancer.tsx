import React, { useEffect, useMemo, useState } from 'react';
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
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  AutoFixHigh as AutoFixHighIcon,
  CloudUpload as CloudUploadIcon,
  Compare as CompareIcon,
  Face as FaceIcon,
  Palette as PaletteIcon,
  Save as SaveIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/queryClient';
import CompositionGuides, { GuideType } from '../../photo-enhancer/CompositionGuides';
import type { CompositionAnalysisResult } from '../../../services/composition-analysis';
import { compositionAnalyzer } from '../../../services/composition-analysis';
import EnhancementRatingDialog from '../../ai-training/EnhancementRatingDialog';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import { useDemoMode, useDemoModeData } from '../../../contexts/DemoModeContext';

type SupportedProfession = 'photographer' | 'videographer' | 'music_producer' | 'musicproducer' | 'vendor';
type ViewMode = 'single' | 'side-by-side' | 'slider';

interface CreatorHubPhotoEnhancerProps {
  profession?: SupportedProfession;
}

interface EnhancerProject {
  id: string;
  name: string;
}

interface EnhancementSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  denoising: number;
  faceEnhancement: number;
}

const PRESETS = [
  { id: 'auto', name: 'Auto Enhancer', description: 'Automatisk optimalisering', icon: <AutoFixHighIcon /> },
  { id: 'portrait', name: 'Portrait Pro', description: 'Ansiktsforbedring', icon: <FaceIcon /> },
  { id: 'landscape', name: 'Landscape Master', description: 'Landskap og natur', icon: <PaletteIcon /> },
  { id: 'studio', name: 'Studio Perfect', description: 'Studio og kommersiell', icon: <TuneIcon /> },
];

const DEFAULT_SETTINGS: EnhancementSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  denoising: 50,
  faceEnhancement: 75,
};

function normalizeProfession(value: SupportedProfession | undefined): 'photographer' | 'videographer' | 'music_producer' | 'vendor' {
  if (value === 'photographer' || value === 'videographer' || value === 'vendor') return value;
  if (value === 'musicproducer' || value === 'music_producer') return 'music_producer';
  return 'photographer';
}

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toImageUrl(payload: unknown): string {
  const record = toRecord(payload);
  const candidates = [
    record.enhancedImageUrl,
    record.imageUrl,
    record.url,
    record.outputUrl,
    record.resultUrl,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }

  return '';
}

function normalizeProjects(payload: unknown): EnhancerProject[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item, index) => {
      const record = toRecord(item);
      const id = typeof record.id === 'string' ? record.id : `project-${index}`;
      const name =
        typeof record.name === 'string'
          ? record.name
          : typeof record.title === 'string'
            ? record.title
            : `Project ${index + 1}`;
      return { id, name };
    })
    .filter((project) => project.id.length > 0);
}

const getFoldersForProfession = (profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor') => {
  if (profession === 'photographer') {
    return [
      { id: 'raw-footage', name: 'Raw Footage' },
      { id: 'edited-files', name: 'Edited Files' },
      { id: 'client-review', name: 'Client Review' },
      { id: 'final-delivery', name: 'Final Delivery' },
    ];
  }
  if (profession === 'videographer') {
    return [
      { id: 'raw-video', name: 'Raw Video' },
      { id: 'stills', name: 'Stills' },
      { id: 'review-cuts', name: 'Review Cuts' },
      { id: 'master-export', name: 'Master Export' },
    ];
  }
  if (profession === 'music_producer') {
    return [
      { id: 'cover-art', name: 'Cover Art' },
      { id: 'promo-assets', name: 'Promo Assets' },
      { id: 'social-exports', name: 'Social Exports' },
    ];
  }
  return [
    { id: 'assets', name: 'Assets' },
    { id: 'processed', name: 'Processed' },
  ];
};

export default function CreatorHubPhotoEnhancer({ profession: professionProp }: CreatorHubPhotoEnhancerProps) {
  const profession = normalizeProfession(professionProp);
  const { getProfessionConfig } = useDynamicProfessions();
  const { isDemoMode } = useDemoMode();

  const demoProjectsRaw = useDemoModeData<Record<string, unknown>>('projects', []);
  const demoProjects = useMemo(() => normalizeProjects(demoProjectsRaw), [demoProjectsRaw]);

  const [activePreset, setActivePreset] = useState('auto');
  const [settings, setSettings] = useState<EnhancementSettings>(DEFAULT_SETTINGS);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [enhancedImageUrl, setEnhancedImageUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [compositionAnalysis, setCompositionAnalysis] = useState<CompositionAnalysisResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [compareSlider, setCompareSlider] = useState(50);
  const [showCompositionGuides, setShowCompositionGuides] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [showRatingDialog, setShowRatingDialog] = useState(false);

  const professionConfig = getProfessionConfig(profession);
  const accentColor = professionConfig?.iconColor || '#ff8c00';

  const folders = useMemo(() => getFoldersForProfession(profession), [profession]);

  const projectsQuery = useQuery<EnhancerProject[]>({
    queryKey: ['creatorhub-photo-enhancer-projects', profession],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects?profession=${profession}`);
      return normalizeProjects(response);
    },
    enabled: !isDemoMode,
    retry: 1,
    staleTime: 30_000,
  });

  const projects = isDemoMode ? demoProjects : projectsQuery.data || [];

  useEffect(() => {
    return () => {
      if (originalImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(originalImageUrl);
      }
    };
  }, [originalImageUrl]);

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('preset', activePreset);
      return apiRequest('/api/photo-enhancer/analyze', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (response) => {
      const record = toRecord(response);
      setAnalysisResult(record);
    },
  });

  const enhanceMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('preset', activePreset);
      formData.append('settings', JSON.stringify(settings));

      return apiRequest('/api/photo-enhancer/enhance', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (response) => {
      const imageUrl = toImageUrl(response);
      if (imageUrl) {
        setEnhancedImageUrl(imageUrl);
        setViewMode('side-by-side');
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/photo-enhancer/save', {
        method: 'POST',
        body: {
          projectId: selectedProjectId,
          folderId: selectedFolderId,
          originalImageUrl,
          enhancedImageUrl,
          preset: activePreset,
          settings,
        },
      });
    },
    onSuccess: () => {
      setSaveDialogOpen(false);
    },
  });

  const onImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (originalImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(originalImageUrl);
    }

    setUploadedImage(file);
    setOriginalImageUrl(URL.createObjectURL(file));
    setEnhancedImageUrl('');
    setAnalysisResult(null);
    setCompositionAnalysis(null);
    setViewMode('single');
    setCompareSlider(50);
  };

  const runAnalysis = async () => {
    if (!uploadedImage) return;
    await analyzeMutation.mutateAsync(uploadedImage);
  };

  const runEnhancement = async () => {
    if (!uploadedImage) return;
    await enhanceMutation.mutateAsync(uploadedImage);
  };

  const onImageLoaded = async (image: HTMLImageElement) => {
    if (!image.complete) return;

    const guides = new Set<GuideType>([
      GuideType.RULE_OF_THIRDS,
      GuideType.GOLDEN_RATIO,
      GuideType.SAFE_ZONES,
      GuideType.CENTER_POINT,
    ]);

    try {
      const analysis = await compositionAnalyzer.analyzeImage(image, guides);
      setCompositionAnalysis(analysis);
    } catch {
      setCompositionAnalysis(null);
    }
  };

  const handleSubmitRating = async (rating: number, feedback: string): Promise<void> => {
    await apiRequest('/api/ai-training/enhancement-rating', {
      method: 'POST',
      body: {
        enhancementType: 'photo',
        rating,
        feedback,
        preset: activePreset,
      },
    });
    setShowRatingDialog(false);
  };

  const canSave = Boolean(enhancedImageUrl && selectedProjectId && selectedFolderId);

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  CreatorHub Photo Enhancer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  AI-enhancement for {profession.replace('_', ' ')} workflows.
                </Typography>

                <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
                  Last opp bilde
                  <input hidden accept="image/*" type="file" onChange={onImageUpload} />
                </Button>

                {uploadedImage ? <Chip label={uploadedImage.name} size="small" /> : null}

                <FormControl fullWidth size="small">
                  <InputLabel id="enhancer-preset-label">Preset</InputLabel>
                  <Select
                    labelId="enhancer-preset-label"
                    label="Preset"
                    value={activePreset}
                    onChange={(event) => setActivePreset(event.target.value)}
                  >
                    {PRESETS.map((preset) => (
                      <MenuItem key={preset.id} value={preset.id}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {preset.icon}
                          <Box>
                            <Typography variant="body2">{preset.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{preset.description}</Typography>
                          </Box>
                        </Stack>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Divider />

                <Typography variant="subtitle2">Settings</Typography>
                {[
                  { key: 'brightness', label: 'Brightness' },
                  { key: 'contrast', label: 'Contrast' },
                  { key: 'saturation', label: 'Saturation' },
                  { key: 'sharpness', label: 'Sharpness' },
                  { key: 'denoising', label: 'Denoising' },
                  { key: 'faceEnhancement', label: 'Face Enhancement' },
                ].map((slider) => {
                  const key = slider.key as keyof EnhancementSettings;
                  return (
                    <Box key={slider.key}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption">{slider.label}</Typography>
                        <Typography variant="caption">{settings[key]}</Typography>
                      </Stack>
                      <Slider
                        value={settings[key]}
                        min={slider.key === 'brightness' || slider.key === 'contrast' || slider.key === 'saturation' || slider.key === 'sharpness' ? -100 : 0}
                        max={100}
                        onChange={(_, value) => {
                          const numericValue = Array.isArray(value) ? value[0] : value;
                          setSettings((previous) => ({ ...previous, [key]: numericValue }));
                        }}
                      />
                    </Box>
                  );
                })}

                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => void runAnalysis()} disabled={!uploadedImage || analyzeMutation.isPending}>
                    Analyze
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void runEnhancement()}
                    disabled={!uploadedImage || enhanceMutation.isPending}
                    startIcon={<AutoFixHighIcon />}
                  >
                    Enhance
                  </Button>
                </Stack>

                {analyzeMutation.isPending || enhanceMutation.isPending ? (
                  <Box>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary">
                      Prosesserer bilde...
                    </Typography>
                  </Box>
                ) : null}

                {analysisResult ? (
                  <Alert severity="success" icon={<AssessmentIcon />}>
                    Analyse fullført.
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant={viewMode === 'single' ? 'contained' : 'outlined'} onClick={() => setViewMode('single')}>
                    Single
                  </Button>
                  <Button
                    size="small"
                    variant={viewMode === 'side-by-side' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('side-by-side')}
                    disabled={!enhancedImageUrl}
                    startIcon={<CompareIcon />}
                  >
                    Side-by-side
                  </Button>
                  <Button
                    size="small"
                    variant={viewMode === 'slider' ? 'contained' : 'outlined'}
                    onClick={() => setViewMode('slider')}
                    disabled={!enhancedImageUrl}
                  >
                    Slider
                  </Button>
                </Stack>

                <FormControlLabelSwitch
                  label="Composition guides"
                  checked={showCompositionGuides}
                  onChange={(checked) => setShowCompositionGuides(checked)}
                />
              </Stack>

              {!originalImageUrl ? (
                <Alert severity="info">Last opp et bilde for forhåndsvisning.</Alert>
              ) : (
                <Box sx={{ position: 'relative', minHeight: 420, border: '1px solid #e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                  {viewMode === 'single' && (
                    <ImagePreview
                      src={enhancedImageUrl || originalImageUrl}
                      alt={enhancedImageUrl ? 'Enhanced' : 'Original'}
                      onLoad={onImageLoaded}
                      showCompositionGuides={showCompositionGuides}
                      compositionAnalysis={compositionAnalysis}
                    />
                  )}

                  {viewMode === 'side-by-side' && enhancedImageUrl && (
                    <Grid container sx={{ height: 420 }}>
                      <Grid item xs={6} sx={{ borderRight: '1px solid #e5e7eb' }}>
                        <ImagePreview
                          src={originalImageUrl}
                          alt="Original"
                          onLoad={onImageLoaded}
                          showCompositionGuides={showCompositionGuides}
                          compositionAnalysis={compositionAnalysis}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <ImagePreview
                          src={enhancedImageUrl}
                          alt="Enhanced"
                          onLoad={onImageLoaded}
                          showCompositionGuides={showCompositionGuides}
                          compositionAnalysis={compositionAnalysis}
                        />
                      </Grid>
                    </Grid>
                  )}

                  {viewMode === 'slider' && enhancedImageUrl && (
                    <Box sx={{ position: 'relative', height: 420 }}>
                      <img
                        src={originalImageUrl}
                        alt="Original"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      <img
                        src={enhancedImageUrl}
                        alt="Enhanced"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          clipPath: `inset(0 ${100 - compareSlider}% 0 0)`,
                        }}
                      />
                      <Box sx={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
                        <Slider value={compareSlider} onChange={(_, value) => setCompareSlider(Array.isArray(value) ? value[0] : value)} />
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {compositionAnalysis ? (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  Komposisjon score: {Math.round(compositionAnalysis.overall_score)} · Rule of Thirds: {Math.round(compositionAnalysis.rule_of_thirds_score)}
                </Alert>
              ) : null}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!enhancedImageUrl}
                >
                  Save to project
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AssessmentIcon />}
                  onClick={() => setShowRatingDialog(true)}
                  disabled={!enhancedImageUrl}
                >
                  Rate enhancement
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Enhanced Image</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {projectsQuery.isError && !isDemoMode ? (
              <Alert severity="warning">Kunne ikke hente prosjekter. Bruk demo-prosjekter eller prøv igjen.</Alert>
            ) : null}

            <FormControl fullWidth size="small">
              <InputLabel id="save-project-label">Project</InputLabel>
              <Select
                labelId="save-project-label"
                label="Project"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="save-folder-label">Folder</InputLabel>
              <Select
                labelId="save-folder-label"
                label="Folder"
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
              >
                {folders.map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            startIcon={<SaveIcon />}
            sx={{ backgroundColor: accentColor }}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <EnhancementRatingDialog
        open={showRatingDialog}
        onClose={() => setShowRatingDialog(false)}
        enhancementType="photo"
        originalUrl={originalImageUrl}
        enhancedUrl={enhancedImageUrl}
        onSubmitRating={handleSubmitRating}
        title="Vurder bildeforbedringen"
        description="Tilbakemeldingen brukes til å forbedre AI-modellene i CreatorHub." 
      />
    </Box>
  );
}

function FormControlLabelSwitch(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const { label, checked, onChange } = props;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2">{label}</Typography>
      <Switch checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </Stack>
  );
}

function ImagePreview(props: {
  src: string;
  alt: string;
  onLoad: (image: HTMLImageElement) => Promise<void>;
  showCompositionGuides: boolean;
  compositionAnalysis: CompositionAnalysisResult | null;
}) {
  const { src, alt, onLoad, showCompositionGuides, compositionAnalysis } = props;
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setImageElement(null);
  }, [src]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        ref={(node) => {
          if (!node) return;
          if (imageElement === node) return;
          setImageElement(node);
          if (node.complete) {
            void onLoad(node);
          } else {
            node.onload = () => {
              void onLoad(node);
            };
          }
        }}
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      {showCompositionGuides && imageElement ? (
        <CompositionGuides imageElement={imageElement} analysisResult={compositionAnalysis} />
      ) : null}
    </Box>
  );
}
