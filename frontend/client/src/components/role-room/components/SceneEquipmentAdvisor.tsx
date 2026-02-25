/**
 * SceneEquipmentAdvisor — Scene-aware equipment intelligence.
 *
 * Fetches scene profiles from the v2 API, compares requirements
 * against the current project inventory, highlights missing
 * categories and suggests specific gear to rent or buy.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Grid,
  Button,
  Tooltip,
  Collapse,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TipsAndUpdates as TipsIcon,
  Movie as MovieIcon,
  Refresh as RefreshIcon,
  ShoppingCart as ShoppingCartIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Equipment, equipmentApi } from '../services/castingApiService';

/* ─── Types ─── */

interface SceneType {
  type: string;
  requiredCategories: string[];
  recommendedCategories: string[];
}

interface SceneSuggestion {
  category: string;
  brand: string;
  model: string;
  reason: string;
}

interface SceneRecommendation {
  type: string;
  required: string[];
  recommended: string[];
  suggested: SceneSuggestion[];
  tips: string[];
  /* Added by analyze endpoint */
  missing?: string[];
  coverage?: number;
}

/* ─── Category labels (Norwegian) ─── */

const CATEGORY_LABELS: Record<string, string> = {
  camera: 'Kamera',
  lens: 'Objektiv',
  audio: 'Lyd',
  lighting: 'Lys',
  stabilizer: 'Stabilisator',
  monitor: 'Monitor',
  media: 'Media/Lagring',
  power: 'Strøm/Batteri',
  wireless_video: 'Trådløs Video',
  support: 'Stativ/Support',
  drone: 'Drone',
};

const SCENE_LABELS: Record<string, string> = {
  interview: 'Intervju',
  dialogue: 'Dialog-scene',
  action: 'Action-scene',
  establishing: 'Etablerende bilde',
  close_up: 'Nærbilde',
  product: 'Produkt-shoot',
  documentary: 'Dokumentar',
  wedding: 'Bryllup',
  live_event: 'Live Event',
};

const SCENE_ICONS: Record<string, string> = {
  interview: '🎤',
  dialogue: '🗣️',
  action: '🏃',
  establishing: '🌆',
  close_up: '🔍',
  product: '📦',
  documentary: '🎬',
  wedding: '💒',
  live_event: '🎪',
};

/* ─── Component ─── */

interface SceneEquipmentAdvisorProps {
  projectId: string;
}

export function SceneEquipmentAdvisor({ projectId }: SceneEquipmentAdvisorProps) {
  const [sceneTypes, setSceneTypes] = useState<SceneType[]>([]);
  const [selectedScene, setSelectedScene] = useState<string>('');
  const [recommendation, setRecommendation] = useState<SceneRecommendation | null>(null);
  const [inventory, setInventory] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingScene, setLoadingScene] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available scene types on mount
  useEffect(() => {
    fetch('/api/equipment/v2/scenes')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSceneTypes(data);
        else if (data?.types) setSceneTypes(data.types);
      })
      .catch(() => setError('Kunne ikke laste scenetyper'));
  }, []);

  // Fetch project equipment inventory
  useEffect(() => {
    if (!projectId) return;
    equipmentApi.getAll(projectId).then((data) => {
      setInventory(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [projectId]);

  // Fetch recommendations when scene changes
  const loadRecommendation = useCallback(async (sceneType: string) => {
    if (!sceneType) {
      setRecommendation(null);
      return;
    }
    setLoadingScene(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/v2/scenes/${sceneType}/recommendations`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setRecommendation(data);
    } catch {
      setError('Kunne ikke laste anbefalinger');
    } finally {
      setLoadingScene(false);
    }
  }, []);

  const handleSceneChange = (type: string) => {
    setSelectedScene(type);
    loadRecommendation(type);
  };

  // Analyze all scenes against inventory
  const analyzeAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/equipment/v2/scenes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error('Analyze failed');
      const data = await res.json();
      // Show the scene with lowest coverage
      if (data.analysis?.length) {
        const worst = [...data.analysis].sort(
          (a: SceneRecommendation, b: SceneRecommendation) =>
            (a.coverage ?? 0) - (b.coverage ?? 0)
        )[0];
        setSelectedScene(worst.type);
        setRecommendation(worst);
      }
    } catch {
      setError('Analyse feilet');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Check if a category is covered by inventory
  const isCategoryCovered = (category: string): boolean => {
    const cat = category.toLowerCase();
    return inventory.some((eq) => {
      const eqCat = (eq.category || '').toLowerCase();
      return eqCat === cat || eqCat.includes(cat) || cat.includes(eqCat);
    });
  };

  const coveredCount = recommendation
    ? recommendation.required.filter(isCategoryCovered).length
    : 0;
  const totalRequired = recommendation?.required.length ?? 0;
  const coveragePercent = totalRequired > 0 ? Math.round((coveredCount / totalRequired) * 100) : 0;

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MovieIcon sx={{ color: '#9333ea' }} />
          <Typography variant="h6" fontWeight={700}>
            Scene-utstyrsrådgiver
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={analyzeAll}
          disabled={loading}
          sx={{
            borderColor: '#9333ea',
            color: '#9333ea',
            '&:hover': { borderColor: '#7c3aed', bgcolor: 'rgba(147,51,234,0.08)' },
          }}
        >
          {loading ? <><CircularProgress size={16} sx={{ color: '#9333ea', mr: 1 }} /> Analyserer…</> : 'Analyser alt utstyr'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Scene selector */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Velg scenetype</InputLabel>
        <Select
          value={selectedScene}
          label="Velg scenetype"
          onChange={(e) => handleSceneChange(e.target.value)}
        >
          {sceneTypes.map((s) => (
            <MenuItem key={s.type} value={s.type}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{SCENE_ICONS[s.type] || '🎬'}</span>
                <span>{SCENE_LABELS[s.type] || s.type}</span>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({s.requiredCategories.length} påkrevd)
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {loadingScene && <LinearProgress sx={{ mb: 2 }} />}

      {/* Recommendation card */}
      {recommendation && !loadingScene && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Coverage overview */}
          <Card
            sx={{
              border: '1px solid',
              borderColor:
                coveragePercent === 100
                  ? 'success.main'
                  : coveragePercent >= 60
                    ? 'warning.main'
                    : 'error.main',
              bgcolor:
                coveragePercent === 100
                  ? 'rgba(76,175,80,0.05)'
                  : coveragePercent >= 60
                    ? 'rgba(255,152,0,0.05)'
                    : 'rgba(244,67,54,0.05)',
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1,
                }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {SCENE_ICONS[recommendation.type] || '🎬'}{' '}
                  {SCENE_LABELS[recommendation.type] || recommendation.type}
                </Typography>
                <Chip
                  label={`${coveragePercent}% dekket`}
                  color={
                    coveragePercent === 100
                      ? 'success'
                      : coveragePercent >= 60
                        ? 'warning'
                        : 'error'
                  }
                  size="small"
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={coveragePercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  mb: 2,
                  bgcolor: 'rgba(0,0,0,0.08)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    bgcolor:
                      coveragePercent === 100
                        ? '#4caf50'
                        : coveragePercent >= 60
                          ? '#ff9800'
                          : '#f44336',
                  },
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {coveredCount} av {totalRequired} påkrevde kategorier er dekket av ditt utstyr.
                {coveredCount < totalRequired && (
                  <> Du mangler:{' '}
                    <strong>
                      {recommendation.required
                        .filter((c) => !isCategoryCovered(c))
                        .map((c) => CATEGORY_LABELS[c] || c)
                        .join(', ')}
                    </strong>
                  </>
                )}
              </Typography>
            </CardContent>
          </Card>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          {/* Required & Recommended categories */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Påkrevd utstyr
              </Typography>
              <Stack spacing={1}>
                {recommendation.required.map((cat) => {
                  const covered = isCategoryCovered(cat);
                  return (
                    <Box
                      key={cat}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: covered
                          ? 'rgba(76,175,80,0.08)'
                          : 'rgba(244,67,54,0.08)',
                      }}
                    >
                      {covered ? (
                        <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                      ) : (
                        <WarningIcon sx={{ color: '#f44336', fontSize: 20 }} />
                      )}
                      <Typography variant="body2">
                        {CATEGORY_LABELS[cat] || cat}
                      </Typography>
                      {!covered && (
                        <Chip
                          label="Mangler"
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ ml: 'auto' }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Anbefalt tillegg
              </Typography>
              <Stack spacing={1}>
                {recommendation.recommended.map((cat) => {
                  const covered = isCategoryCovered(cat);
                  return (
                    <Box
                      key={cat}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: covered
                          ? 'rgba(76,175,80,0.06)'
                          : 'rgba(255,152,0,0.06)',
                      }}
                    >
                      {covered ? (
                        <CheckCircleIcon sx={{ color: '#8bc34a', fontSize: 20 }} />
                      ) : (
                        <InfoIcon sx={{ color: '#ff9800', fontSize: 20 }} />
                      )}
                      <Typography variant="body2">
                        {CATEGORY_LABELS[cat] || cat}
                      </Typography>
                      {!covered && (
                        <Chip
                          label="Valgfritt"
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ ml: 'auto' }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Grid>
          </Grid>

          {/* Suggested gear */}
          {recommendation.suggested.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                <ShoppingCartIcon
                  sx={{ fontSize: 18, verticalAlign: 'text-bottom', mr: 0.5 }}
                />
                Anbefalte produkter
              </Typography>
              <Grid container spacing={1.5}>
                {recommendation.suggested.map((s, idx) => {
                  const owned = inventory.some(
                    (eq) =>
                      eq.brand?.toLowerCase() === s.brand.toLowerCase() &&
                      eq.model?.toLowerCase() === s.model.toLowerCase()
                  );
                  return (
                    <Grid item xs={12} sm={6} md={4} key={idx}>
                      <Card
                        variant="outlined"
                        sx={{
                          height: '100%',
                          borderColor: owned ? '#4caf50' : 'divider',
                          bgcolor: owned ? 'rgba(76,175,80,0.04)' : undefined,
                        }}
                      >
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 0.5,
                            }}
                          >
                            <Typography variant="body2" fontWeight={700}>
                              {s.brand} {s.model}
                            </Typography>
                            {owned && (
                              <Tooltip title="Du har dette">
                                <CheckCircleIcon
                                  sx={{ color: '#4caf50', fontSize: 18 }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                          <Chip
                            label={CATEGORY_LABELS[s.category] || s.category}
                            size="small"
                            sx={{ mb: 0.5 }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block' }}
                          >
                            {s.reason}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}

          {/* Pro tips */}
          {recommendation.tips.length > 0 && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 1,
                }}
                onClick={() => setTipsOpen(!tipsOpen)}
              >
                <TipsIcon sx={{ color: '#ff9800', mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Pro-tips ({recommendation.tips.length})
                </Typography>
                <IconButton size="small" sx={{ ml: 'auto' }}>
                  {tipsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={tipsOpen}>
                <Stack spacing={1}>
                  {recommendation.tips.map((tip, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        gap: 1,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: 'rgba(255,152,0,0.06)',
                        border: '1px solid rgba(255,152,0,0.15)',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: '#ff9800', minWidth: 24 }}
                      >
                        {idx + 1}.
                      </Typography>
                      <Typography variant="body2">{tip}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          )}
        </Box>
      )}

      {/* Empty state */}
      {!selectedScene && !loading && (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            color: 'text.secondary',
          }}
        >
          <MovieIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
          <Typography variant="body1">
            Velg en scenetype for å se utstyrsanbefalinger
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Eller trykk «Analyser alt utstyr» for å se hvilke scenetyper du er best
            forberedt for.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default SceneEquipmentAdvisor;
