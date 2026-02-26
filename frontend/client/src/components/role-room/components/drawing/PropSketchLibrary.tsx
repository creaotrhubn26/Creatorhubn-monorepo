import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddPhotoAlternate,
  AutoFixHigh,
  Inventory2,
  LibraryBooks,
  Save,
} from '@mui/icons-material';
import type { Prop } from '../../models/casting';
import { castingService } from '../../services/castingService';
import {
  propDesignLibraryService,
  PropAssetStage,
  PropDesignAsset,
  PropStarterTemplate,
} from '../../services/propDesignLibraryService';

const STAGE_LABELS: Record<PropAssetStage, string> = {
  sketch: 'Sketch',
  design: 'Design',
  reference: 'Reference',
  final: 'Final',
};

const STAGE_COLORS: Record<PropAssetStage, string> = {
  sketch: '#22d3ee',
  design: '#818cf8',
  reference: '#f59e0b',
  final: '#22c55e',
};

const STAGES: PropAssetStage[] = ['sketch', 'design', 'reference', 'final'];

export interface PropSketchLibraryProps {
  projectId?: string;
  frameId?: string;
  storyboardId?: string;
  sceneId?: string | null;
  canvas: HTMLCanvasElement | null;
  onApplyReferenceImage: (imageUrl: string) => void;
  onAssetSaved?: (asset: PropDesignAsset) => void;
}

export const PropSketchLibrary: React.FC<PropSketchLibraryProps> = ({
  projectId,
  frameId,
  storyboardId,
  sceneId,
  canvas,
  onApplyReferenceImage,
  onAssetSaved,
}) => {
  const [propsList, setPropsList] = useState<Prop[]>([]);
  const [assetsByProp, setAssetsByProp] = useState<Record<string, PropDesignAsset[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [selectedStage, setSelectedStage] = useState<PropAssetStage>('sketch');
  const [assetTitle, setAssetTitle] = useState('');
  const [assetNotes, setAssetNotes] = useState('');
  const [assetTags, setAssetTags] = useState('');
  const [starterQuery, setStarterQuery] = useState('');
  const [starterCategory, setStarterCategory] = useState('all');
  const [assetTab, setAssetTab] = useState<PropAssetStage | 'all'>('all');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const starterTemplates = useMemo<PropStarterTemplate[]>(
    () => propDesignLibraryService.getStarterTemplates(),
    []
  );

  const starterCategories = useMemo(() => {
    const categories = Array.from(new Set(starterTemplates.map((template) => template.category)));
    return ['all', ...categories];
  }, [starterTemplates]);

  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [loadedProps, loadedAssetsByProp] = await Promise.all([
        castingService.getProps(projectId),
        propDesignLibraryService.getAssetsByProp(projectId),
      ]);
      setPropsList(loadedProps);
      setAssetsByProp(loadedAssetsByProp);
      if (loadedProps.length > 0 && !loadedProps.some((prop) => prop.id === selectedPropId)) {
        setSelectedPropId(loadedProps[0].id);
      }
    } catch (error) {
      console.error('Failed to load prop sketch library data:', error);
      setStatus({ type: 'error', message: 'Kunne ikke laste prop-bibliotek.' });
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedPropId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedProp = useMemo(
    () => propsList.find((prop) => prop.id === selectedPropId) ?? null,
    [propsList, selectedPropId]
  );

  useEffect(() => {
    if (!selectedProp) return;
    if (assetTitle.trim().length > 0) return;
    setAssetTitle(`${selectedProp.name} ${STAGE_LABELS[selectedStage]}`);
  }, [assetTitle, selectedProp, selectedStage]);

  const selectedPropAssets = useMemo(() => {
    const allAssets = selectedPropId ? (assetsByProp[selectedPropId] ?? []) : [];
    if (assetTab === 'all') return allAssets;
    return allAssets.filter((asset) => asset.stage === assetTab);
  }, [assetTab, assetsByProp, selectedPropId]);

  const stageCounts = useMemo(() => {
    const allAssets = selectedPropId ? (assetsByProp[selectedPropId] ?? []) : [];
    return allAssets.reduce<Record<PropAssetStage, number>>((acc, asset) => {
      acc[asset.stage] += 1;
      return acc;
    }, { sketch: 0, design: 0, reference: 0, final: 0 });
  }, [assetsByProp, selectedPropId]);

  const filteredStarters = useMemo(() => {
    const normalizedQuery = starterQuery.trim().toLowerCase();
    return starterTemplates.filter((template) => {
      if (starterCategory !== 'all' && template.category !== starterCategory) return false;
      if (!normalizedQuery) return true;
      return (
        template.name.toLowerCase().includes(normalizedQuery) ||
        template.description.toLowerCase().includes(normalizedQuery) ||
        template.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [starterCategory, starterQuery, starterTemplates]);

  const parseTags = useCallback((raw: string): string[] => (
    raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  ), []);

  const handleSaveCurrentCanvas = useCallback(async () => {
    if (!projectId) {
      setStatus({ type: 'error', message: 'Prosjekt mangler. Kan ikke lagre prop-skisse.' });
      return;
    }
    if (!selectedPropId) {
      setStatus({ type: 'error', message: 'Velg en rekvisitt først.' });
      return;
    }
    if (!canvas) {
      setStatus({ type: 'error', message: 'Canvas er ikke klar ennå.' });
      return;
    }

    setSaving(true);
    try {
      const imageUrl = canvas.toDataURL('image/png');
      const nextAsset = await propDesignLibraryService.addAsset(projectId, {
        propId: selectedPropId,
        stage: selectedStage,
        title: assetTitle.trim() || `${selectedProp?.name || 'Prop'} ${STAGE_LABELS[selectedStage]}`,
        imageUrl,
        source: 'storyboard',
        sourceFrameId: frameId,
        sourceStoryboardId: storyboardId,
        sourceSceneId: sceneId ?? undefined,
        notes: assetNotes.trim() || undefined,
        tags: parseTags(assetTags),
      });

      if (selectedStage === 'final') {
        await propDesignLibraryService.applyAssetAsPropPreview(projectId, selectedPropId, nextAsset.id);
      }

      onAssetSaved?.(nextAsset);
      await reload();
      setAssetNotes('');
      setAssetTags('');
      setStatus({ type: 'success', message: `Lagret som ${STAGE_LABELS[selectedStage]} for ${selectedProp?.name || 'prop'}.` });
    } catch (error) {
      console.error('Failed to save prop design asset:', error);
      setStatus({ type: 'error', message: 'Kunne ikke lagre skissen i biblioteket.' });
    } finally {
      setSaving(false);
    }
  }, [
    assetNotes,
    assetTags,
    assetTitle,
    canvas,
    frameId,
    onAssetSaved,
    parseTags,
    projectId,
    reload,
    sceneId,
    selectedProp?.name,
    selectedPropId,
    selectedStage,
    storyboardId,
  ]);

  const handleUseStarterReference = useCallback((template: PropStarterTemplate) => {
    onApplyReferenceImage(template.previewImageUrl);
    setStatus({ type: 'info', message: `${template.name} satt som referanse i canvas.` });
  }, [onApplyReferenceImage]);

  const handleCreatePropFromStarter = useCallback(async (template: PropStarterTemplate) => {
    if (!projectId) {
      setStatus({ type: 'error', message: 'Prosjekt mangler. Kan ikke opprette rekvisitt.' });
      return;
    }

    setSaving(true);
    try {
      const createdProp = await propDesignLibraryService.createPropFromStarter(projectId, template, { sceneId });
      await propDesignLibraryService.addAsset(projectId, {
        propId: createdProp.id,
        stage: 'reference',
        title: `${template.name} starter`,
        imageUrl: template.previewImageUrl,
        source: 'starter',
        sourceSceneId: sceneId ?? undefined,
        tags: template.tags,
      });
      await reload();
      setSelectedPropId(createdProp.id);
      setAssetTitle(`${createdProp.name} Sketch`);
      setStatus({ type: 'success', message: `${createdProp.name} opprettet fra starterbibliotek.` });
    } catch (error) {
      console.error('Failed to create prop from starter:', error);
      setStatus({ type: 'error', message: 'Kunne ikke opprette rekvisitt fra starter.' });
    } finally {
      setSaving(false);
    }
  }, [projectId, reload, sceneId]);

  const handleSaveStarterToSelectedProp = useCallback(async (template: PropStarterTemplate) => {
    if (!projectId || !selectedPropId) return;
    setSaving(true);
    try {
      await propDesignLibraryService.addAsset(projectId, {
        propId: selectedPropId,
        stage: 'reference',
        title: `${template.name} reference`,
        imageUrl: template.previewImageUrl,
        source: 'starter',
        sourceFrameId: frameId,
        sourceStoryboardId: storyboardId,
        sourceSceneId: sceneId ?? undefined,
        tags: template.tags,
      });
      await reload();
      setStatus({ type: 'success', message: `Starter referanse lagt til ${selectedProp?.name || 'prop'}.` });
    } catch (error) {
      console.error('Failed to save starter as prop asset:', error);
      setStatus({ type: 'error', message: 'Kunne ikke lagre starter som prop-asset.' });
    } finally {
      setSaving(false);
    }
  }, [frameId, projectId, reload, sceneId, selectedProp?.name, selectedPropId, storyboardId]);

  if (!projectId) {
    return (
      <Alert severity="info" sx={{ m: 1 }}>
        Prop-skissebibliotek aktiveres når prosjekt-ID er tilgjengelig.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <LibraryBooks sx={{ fontSize: 18, color: '#22d3ee' }} />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Prop Sketch Library
          </Typography>
        </Stack>
        <Chip
          size="small"
          icon={<Inventory2 sx={{ fontSize: 13 }} />}
          label={`${propsList.length} props`}
          sx={{ height: 22, fontSize: 11 }}
        />
      </Stack>

      {status && (
        <Alert
          severity={status.type}
          onClose={() => setStatus(null)}
          sx={{ mb: 1, py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}
        >
          {status.message}
        </Alert>
      )}

      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Søk starter assets"
            value={starterQuery}
            onChange={(event) => setStarterQuery(event.target.value)}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Kategori</InputLabel>
            <Select
              value={starterCategory}
              onChange={(event) => setStarterCategory(event.target.value)}
              label="Kategori"
            >
              {starterCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category === 'all' ? 'Alle' : category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Grid container spacing={1}>
          {filteredStarters.map((template) => (
            <Grid key={template.id} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardMedia component="img" height="96" image={template.previewImageUrl} alt={template.name} />
                <CardContent sx={{ p: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {template.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {template.description}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                    {template.tags.slice(0, 3).map((tag) => (
                      <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: 10 }} />
                    ))}
                  </Stack>
                </CardContent>
                <CardActions sx={{ p: 1, pt: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoFixHigh sx={{ fontSize: 14 }} />}
                    onClick={() => handleUseStarterReference(template)}
                  >
                    Reference
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddPhotoAlternate sx={{ fontSize: 14 }} />}
                    onClick={() => void handleCreatePropFromStarter(template)}
                    disabled={saving}
                  >
                    Ny prop
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    sx={{ gridColumn: '1 / span 2' }}
                    onClick={() => void handleSaveStarterToSelectedProp(template)}
                    disabled={saving || !selectedPropId}
                  >
                    Lagre som reference til valgt prop
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Stack spacing={1}>
        <FormControl size="small" fullWidth>
          <InputLabel>Rekvisitt</InputLabel>
          <Select
            value={selectedPropId}
            onChange={(event) => setSelectedPropId(event.target.value)}
            label="Rekvisitt"
            disabled={loading || propsList.length === 0}
          >
            {propsList.map((prop) => (
              <MenuItem key={prop.id} value={prop.id}>
                {prop.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Stage</InputLabel>
            <Select
              value={selectedStage}
              onChange={(event) => setSelectedStage(event.target.value as PropAssetStage)}
              label="Stage"
            >
              {STAGES.map((stage) => (
                <MenuItem key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            fullWidth
            label="Asset title"
            value={assetTitle}
            onChange={(event) => setAssetTitle(event.target.value)}
          />
        </Stack>

        <TextField
          size="small"
          label="Tags (comma separated)"
          value={assetTags}
          onChange={(event) => setAssetTags(event.target.value)}
          fullWidth
        />
        <TextField
          size="small"
          label="Notes"
          value={assetNotes}
          onChange={(event) => setAssetNotes(event.target.value)}
          fullWidth
          multiline
          minRows={2}
        />

        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={() => void handleSaveCurrentCanvas()}
          disabled={saving || !canvas || !selectedPropId}
        >
          Save current sketch to prop library
        </Button>
      </Stack>

      {selectedPropId && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Assets for {selectedProp?.name || 'selected prop'}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {STAGES.map((stage) => (
                <Chip
                  key={stage}
                  size="small"
                  label={`${STAGE_LABELS[stage]} ${stageCounts[stage]}`}
                  sx={{
                    height: 19,
                    fontSize: 10,
                    bgcolor: `${STAGE_COLORS[stage]}20`,
                    color: STAGE_COLORS[stage],
                  }}
                />
              ))}
            </Stack>
          </Stack>

          <Tabs
            value={assetTab}
            onChange={(_, value: PropAssetStage | 'all') => setAssetTab(value)}
            variant="scrollable"
            scrollButtons={false}
            sx={{ minHeight: 30, '& .MuiTab-root': { minHeight: 30, fontSize: 10, px: 1 } }}
          >
            <Tab label="All" value="all" />
            {STAGES.map((stage) => (
              <Tab key={stage} label={STAGE_LABELS[stage]} value={stage} />
            ))}
          </Tabs>

          {selectedPropAssets.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              Ingen assets for valgt prop ennå.
            </Typography>
          ) : (
            <Grid container spacing={1} sx={{ mt: 0.25 }}>
              {selectedPropAssets.slice(0, 8).map((asset) => (
                <Grid key={asset.id} size={{ xs: 6 }}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <CardMedia component="img" height="74" image={asset.imageUrl} alt={asset.title} />
                    <CardContent sx={{ p: 0.75 }}>
                      <Tooltip title={asset.title}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                          {asset.title}
                        </Typography>
                      </Tooltip>
                      <Chip
                        size="small"
                        label={`${STAGE_LABELS[asset.stage]} v${asset.version}`}
                        sx={{
                          mt: 0.5,
                          height: 18,
                          fontSize: 10,
                          bgcolor: `${STAGE_COLORS[asset.stage]}20`,
                          color: STAGE_COLORS[asset.stage],
                        }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PropSketchLibrary;
