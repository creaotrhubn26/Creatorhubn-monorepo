/**
 * EquipmentIntelligence.tsx
 *
 * Full-featured UI for 7 intelligence engines:
 *   1. Feilprediksjon (Predictive Failure)
 *   2. Kompatibilitet (Gear Compatibility)
 *   3. Vekt & Last (Weight & Load)
 *   4. Scenekontinuitet (Scene Continuity)
 *   5. Utstyrsminne (Equipment Memory)
 *   6. Stilprofil (Style Memory)
 *   7. Forklaringslag (Explanation Layer — integrated as tooltips)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ThermostatAuto as ThermostatIcon,
  BatteryAlert as BatteryIcon,
  CameraAlt as CameraIcon,
  FitnessCenter as WeightIcon,
  Timeline as TimelineIcon,
  Psychology as PsychologyIcon,
  AutoFixHigh as StyleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import {
  intelligenceApi,
  PredictiveRisk,
  CompatibilityResult,
  LoadSimulation,
  SceneContinuityEntry,
  ContinuityBreak,
  EquipmentPreference,
  StyleProfile,
  Explanation,
  GearSpec,
} from '../services/equipmentIntelligenceApi';

// ═══════════════════════════════════════════════════════════════
// Props & shared helpers
// ═══════════════════════════════════════════════════════════════

interface Props {
  projectId: string;
  userId?: string;
}

const CARD_SX = {
  bgcolor: 'rgba(28,33,40,0.7)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(147,51,234,0.15)',
  borderRadius: 2,
  mb: 2,
};

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
};

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#94a3b8';
  return (
    <Chip
      size="small"
      label={`${pct}% konfidens`}
      sx={{ bgcolor: `${color}22`, color, fontWeight: 600, fontSize: '0.7rem' }}
    />
  );
}

function ExplanationPanel({ explanation }: { explanation: Explanation }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mt: 1 }}>
      <Button
        size="small"
        startIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setOpen(!open)}
        sx={{ color: '#c084fc', textTransform: 'none', fontSize: '0.75rem' }}
      >
        {open ? 'Skjul forklaring' : 'Hvorfor dette?'}
      </Button>
      <Collapse in={open}>
        <Paper sx={{ p: 1.5, mt: 0.5, bgcolor: 'rgba(147,51,234,0.06)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600, mb: 0.5 }}>
            {explanation.summary}
          </Typography>
          {explanation.factors.map((f, i) => (
            <Typography key={i} variant="caption" sx={{ color: '#94a3b8', display: 'block', ml: 1 }}>
              • {f}
            </Typography>
          ))}
          <Box sx={{ mt: 0.5 }}>
            <ConfidenceBadge value={explanation.confidence} />
          </Box>
        </Paper>
      </Collapse>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 1: Predictive Failure Detection
// ═══════════════════════════════════════════════════════════════

function PredictiveFailureTab({ userId }: { userId: string }) {
  const [predictions, setPredictions] = useState<PredictiveRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempC, setTempC] = useState(25);
  const [hours, setHours] = useState(4);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await intelligenceApi.getPredictions(userId, { tempC, hours });
      setPredictions(res.predictions);
    } catch (err) {
      console.error('Prediction fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, tempC, hours]);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);

  const riskIcon = (type: string) => {
    switch (type) {
      case 'overheating': return <ThermostatIcon sx={{ fontSize: 18, color: '#f97316' }} />;
      case 'battery_failure': return <BatteryIcon sx={{ fontSize: 18, color: '#ef4444' }} />;
      case 'shutter_wear': return <CameraIcon sx={{ fontSize: 18, color: '#f59e0b' }} />;
      default: return <WarningIcon sx={{ fontSize: 18, color: '#94a3b8' }} />;
    }
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
        Analyserer firmware, temperatur, batterisykluser og reparasjonshistorikk for å forutsi problemer <em>før</em> de skjer.
      </Typography>

      {/* Shoot Conditions Sliders */}
      <Paper sx={{ p: 2, bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#c084fc', mb: 1.5, fontWeight: 700 }}>
          Planlagte shoot-forhold
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Omgivelsestemperatur: {tempC}°C</Typography>
            <Slider
              value={tempC}
              onChange={(_, v) => setTempC(v as number)}
              min={-5} max={50} step={1}
              sx={{ color: tempC > 35 ? '#f97316' : '#c084fc' }}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}°C`}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>Planlagt varighet: {hours} timer</Typography>
            <Slider
              value={hours}
              onChange={(_, v) => setHours(v as number)}
              min={0.5} max={16} step={0.5}
              sx={{ color: hours > 8 ? '#f59e0b' : '#c084fc' }}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}t`}
            />
          </Grid>
        </Grid>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchPredictions}
          disabled={loading}
          sx={{ mt: 1, color: '#c084fc', borderColor: 'rgba(147,51,234,0.3)' }}
        >
          Oppdater analyse
        </Button>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2, '& .MuiLinearProgress-bar': { bgcolor: '#c084fc' } }} />}

      {predictions.length === 0 && !loading && (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', '& .MuiAlert-icon': { color: '#60a5fa' } }}>
          Ingen utstyr funnet. Legg til utstyr i ditt inventar for å se prediksjoner.
        </Alert>
      )}

      {predictions.map((p) => (
        <Card key={p.equipmentId} sx={{ ...CARD_SX, borderLeft: `3px solid ${RISK_COLORS[p.riskLevel]}` }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CameraIcon sx={{ fontSize: 20, color: '#c084fc' }} />
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  {p.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  {p.brand} {p.model}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${RISK_LABELS[p.riskLevel]} (${p.riskPercent}%)`}
                sx={{ bgcolor: `${RISK_COLORS[p.riskLevel]}22`, color: RISK_COLORS[p.riskLevel], fontWeight: 700 }}
              />
            </Box>

            {p.risks.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                {p.risks.map((risk, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1, cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === `${p.equipmentId}-${i}` ? null : `${p.equipmentId}-${i}`)}
                  >
                    {riskIcon(risk.type)}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {risk.description}
                      </Typography>
                      <Collapse in={expandedId === `${p.equipmentId}-${i}`}>
                        <Typography variant="caption" sx={{ color: '#22c55e', mt: 0.5, display: 'block' }}>
                          💡 {risk.recommendation}
                        </Typography>
                      </Collapse>
                    </Box>
                    <Chip size="small" label={`${risk.probability}%`}
                      sx={{ bgcolor: risk.probability > 50 ? '#ef444422' : '#f59e0b22', color: risk.probability > 50 ? '#ef4444' : '#f59e0b', fontSize: '0.7rem' }} />
                  </Box>
                ))}
              </Box>
            )}

            {p.risks.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <CheckIcon sx={{ color: '#22c55e', fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: '#22c55e' }}>Ingen vesentlige risikoer identifisert</Typography>
              </Box>
            )}

            <ExplanationPanel explanation={p.explanation} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 2: Gear Compatibility Engine
// ═══════════════════════════════════════════════════════════════

function CompatibilityTab() {
  const [specs, setSpecs] = useState<GearSpec[]>([]);
  const [cameras, setCameras] = useState<GearSpec[]>([]);
  const [lenses, setLenses] = useState<GearSpec[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedLens, setSelectedLens] = useState('');
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [specsLoading, setSpecsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await intelligenceApi.getSpecs();
        setSpecs(res.specs);
        setCameras(res.specs.filter((s) => s.category === 'camera'));
        setLenses(res.specs.filter((s) => s.category === 'lens'));
      } catch (err) {
        console.error('Specs fetch error:', err);
      } finally {
        setSpecsLoading(false);
      }
    })();
  }, []);

  // Suppress lint — specs used for future expansion
  const _specsCount = specs.length;
  void _specsCount;

  const handleCheck = async () => {
    if (!selectedCamera || !selectedLens) return;
    const cam = cameras.find((c) => `${c.brand}|${c.model}` === selectedCamera);
    const lens = lenses.find((l) => `${l.brand}|${l.model}` === selectedLens);
    if (!cam || !lens) return;

    setLoading(true);
    try {
      const res = await intelligenceApi.checkLens(
        { brand: cam.brand, model: cam.model },
        { brand: lens.brand, model: lens.model }
      );
      setResult(res);
    } catch (err) {
      console.error('Lens check error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
        Sjekk om objektiv passer på kamera, verifiser batteritilstrekkelighet og I/O-kompatibilitet automatisk.
      </Typography>

      {specsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} sx={{ color: '#c084fc' }} />
        </Box>
      ) : (
        <Paper sx={{ p: 2, bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: '#c084fc', mb: 1.5, fontWeight: 700 }}>
            Objektivkompatibilitet
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94a3b8' }}>Kamera</InputLabel>
                <Select
                  value={selectedCamera}
                  onChange={(e) => { setSelectedCamera(e.target.value); setResult(null); }}
                  label="Kamera"
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }}
                >
                  {cameras.map((c) => (
                    <MenuItem key={c.id} value={`${c.brand}|${c.model}`}>{c.brand} {c.model}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={5}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94a3b8' }}>Objektiv</InputLabel>
                <Select
                  value={selectedLens}
                  onChange={(e) => { setSelectedLens(e.target.value); setResult(null); }}
                  label="Objektiv"
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }}
                >
                  {lenses.map((l) => (
                    <MenuItem key={l.id} value={`${l.brand}|${l.model}`}>{l.brand} {l.model}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleCheck}
                disabled={loading || !selectedCamera || !selectedLens}
                sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
              >
                {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Sjekk'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {result && (
        <Alert
          severity={result.compatible ? (result.issues.length > 0 ? 'warning' : 'success') : 'error'}
          sx={{
            bgcolor: result.compatible
              ? result.issues.length > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)'
              : 'rgba(239,68,68,0.1)',
            mb: 2,
          }}
          icon={result.compatible ? <CheckIcon /> : <ErrorIcon />}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>
            {result.compatible ? (result.issues.length > 0 ? 'Kompatibel med forbehold' : 'Full kompatibilitet') : 'Ikke kompatibel'}
          </AlertTitle>
          {result.issues.map((issue, i) => (
            <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>
              {issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'} {issue.message}
            </Typography>
          ))}
          <ExplanationPanel explanation={result.explanation} />
        </Alert>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 3: Weight & Load Simulation
// ═══════════════════════════════════════════════════════════════

function WeightSimTab() {
  const [specs, setSpecs] = useState<GearSpec[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<LoadSimulation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await intelligenceApi.getSpecs();
        setSpecs(res.specs);
      } catch (err) {
        console.error('Specs fetch error:', err);
      }
    })();
  }, []);

  const toggleItem = (key: string) => {
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
    setResult(null);
  };

  const handleSimulate = async () => {
    const equipment = selected.map((key) => {
      const [brand, model] = key.split('|');
      return { brand, model };
    });
    setLoading(true);
    try {
      const res = await intelligenceApi.simulateWeight(equipment);
      setResult(res);
    } catch (err) {
      console.error('Weight sim error:', err);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, GearSpec[]>();
    for (const s of specs) {
      const list = map.get(s.category) || [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [specs]);

  const safetyColors: Record<string, string> = {
    safe: '#22c55e', near_limit: '#f59e0b', over_limit: '#ef4444', unknown: '#94a3b8',
  };
  const safetyLabels: Record<string, string> = {
    safe: 'Trygt', near_limit: 'Nær grensen', over_limit: 'Overbelastet', unknown: 'Ukjent',
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
        Beregn totalvekt for riggen din og sjekk om gimbal/drone tåler lasten.
      </Typography>

      <Paper sx={{ p: 2, bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2, mb: 2, maxHeight: 300, overflow: 'auto' }}>
        <Typography variant="subtitle2" sx={{ color: '#c084fc', mb: 1, fontWeight: 700 }}>
          Velg utstyr
        </Typography>
        {[...grouped.entries()].map(([cat, items]) => (
          <Box key={cat} sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.65rem' }}>
              {cat}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {items.map((item) => {
                const key = `${item.brand}|${item.model}`;
                const isSelected = selected.includes(key);
                return (
                  <Chip
                    key={item.id}
                    label={`${item.brand} ${item.model}${item.weight_g ? ` (${(item.weight_g / 1000).toFixed(1)}kg)` : ''}`}
                    size="small"
                    onClick={() => toggleItem(key)}
                    sx={{
                      bgcolor: isSelected ? 'rgba(147,51,234,0.2)' : 'transparent',
                      border: `1px solid ${isSelected ? '#c084fc' : 'rgba(100,116,139,0.3)'}`,
                      color: isSelected ? '#c084fc' : '#94a3b8',
                      fontWeight: isSelected ? 700 : 400,
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        ))}
      </Paper>

      <Button
        variant="contained"
        startIcon={<WeightIcon />}
        onClick={handleSimulate}
        disabled={loading || selected.length === 0}
        sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' }, mb: 2 }}
      >
        {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : `Simuler vekt (${selected.length} enheter)`}
      </Button>

      {result && (
        <Card sx={{ ...CARD_SX, borderLeft: `3px solid ${safetyColors[result.safetyMargin]}` }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                {(result.totalWeightG / 1000).toFixed(1)} kg
              </Typography>
              <Chip
                label={safetyLabels[result.safetyMargin]}
                sx={{ bgcolor: `${safetyColors[result.safetyMargin]}22`, color: safetyColors[result.safetyMargin], fontWeight: 700 }}
              />
            </Box>

            {result.maxPayloadG && (
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>Payload-utnyttelse</Typography>
                  <Typography variant="caption" sx={{ color: '#e2e8f0' }}>{result.utilizationPercent}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(result.utilizationPercent || 0, 100)}
                  sx={{
                    height: 8, borderRadius: 4,
                    bgcolor: 'rgba(100,116,139,0.2)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: safetyColors[result.safetyMargin],
                      borderRadius: 4,
                    },
                  }}
                />
              </Box>
            )}

            {result.items.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                <Typography variant="caption" sx={{ color: item.isPayloadCarrier ? '#c084fc' : '#94a3b8' }}>
                  {item.brand} {item.model} {item.isPayloadCarrier ? '(bærer)' : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {item.weightG > 0 ? `${(item.weightG / 1000).toFixed(2)} kg` : '—'}
                </Typography>
              </Box>
            ))}

            {result.warnings.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ mt: 1, bgcolor: 'rgba(245,158,11,0.1)', fontSize: '0.8rem' }}>
                {w}
              </Alert>
            ))}

            <ExplanationPanel explanation={result.explanation} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 4: Scene Continuity Tracker
// ═══════════════════════════════════════════════════════════════

function ContinuityTab({ projectId, userId }: { projectId: string; userId: string }) {
  const [scenes, setScenes] = useState<SceneContinuityEntry[]>([]);
  const [breaks, setBreaks] = useState<ContinuityBreak[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // New scene form
  const [sceneLabel, setSceneLabel] = useState('');
  const [sceneType, setSceneType] = useState('dialog');
  const [cameraBrand, setCameraBrand] = useState('');
  const [cameraModel, setCameraModel] = useState('');
  const [lensBrand, setLensBrand] = useState('');
  const [lensModel, setLensModel] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sceneRes, breakRes] = await Promise.all([
        intelligenceApi.getSceneGear(projectId),
        intelligenceApi.getContinuityBreaks(projectId),
      ]);
      setScenes(sceneRes.scenes);
      setBreaks(breakRes.breaks);
    } catch (err) {
      console.error('Continuity fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!sceneLabel) return;
    try {
      const gearSetup: Record<string, { brand: string; model: string }> = {};
      if (cameraBrand && cameraModel) gearSetup.camera = { brand: cameraBrand, model: cameraModel };
      if (lensBrand && lensModel) gearSetup.lens = { brand: lensBrand, model: lensModel };

      await intelligenceApi.logSceneGear({
        projectId, userId, sceneLabel, sceneType, gearSetup,
      });
      setSceneLabel('');
      setCameraBrand('');
      setCameraModel('');
      setLensBrand('');
      setLensModel('');
      setShowForm(false);
      fetchData();
    } catch (err) {
      console.error('Log scene gear error:', err);
    }
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
        Hold oversikt over nøyaktig hvilket utstyr som ble brukt i hver scene. Oppdager automatisk kontinuitetsbrudd ved reshoots.
      </Typography>

      {breaks.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(245,158,11,0.1)' }}>
          <AlertTitle sx={{ fontWeight: 700 }}>⚠️ Kontinuitetsbrudd oppdaget</AlertTitle>
          {breaks.map((b, i) => (
            <Box key={i} sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{b.issue}</Typography>
              {b.entries.map((e, j) => (
                <Typography key={j} variant="caption" sx={{ display: 'block', ml: 2, color: '#94a3b8' }}>
                  {e.date}: {e.camera} + {e.lens}
                </Typography>
              ))}
            </Box>
          ))}
        </Alert>
      )}

      <Button
        size="small"
        variant="outlined"
        onClick={() => setShowForm(!showForm)}
        sx={{ mb: 2, color: '#c084fc', borderColor: 'rgba(147,51,234,0.3)' }}
      >
        {showForm ? 'Avbryt' : '+ Logg scene-utstyr'}
      </Button>

      <Collapse in={showForm}>
        <Paper sx={{ p: 2, bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2, mb: 2 }}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Scene-navn" value={sceneLabel}
                onChange={(e) => setSceneLabel(e.target.value)}
                sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#94a3b8' }}>Scene-type</InputLabel>
                <Select value={sceneType} onChange={(e) => setSceneType(e.target.value)} label="Scene-type"
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }}>
                  {['dialog', 'action', 'establishing', 'close_up', 'wide_shot', 'handheld', 'drone', 'interview', 'b_roll', 'night'].map((t) => (
                    <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Kamera merke" value={cameraBrand} onChange={(e) => setCameraBrand(e.target.value)}
                sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Kamera modell" value={cameraModel} onChange={(e) => setCameraModel(e.target.value)}
                sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Objektiv merke" value={lensBrand} onChange={(e) => setLensBrand(e.target.value)}
                sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Objektiv modell" value={lensModel} onChange={(e) => setLensModel(e.target.value)}
                sx={{ '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#94a3b8' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }} />
            </Grid>
          </Grid>
          <Button
            variant="contained" size="small"
            onClick={handleSubmit}
            disabled={!sceneLabel}
            sx={{ mt: 1.5, bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
          >
            Lagre scene-utstyr
          </Button>
        </Paper>
      </Collapse>

      {loading && <LinearProgress sx={{ mb: 2, '& .MuiLinearProgress-bar': { bgcolor: '#c084fc' } }} />}

      {scenes.length === 0 && !loading && (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)' }}>
          Ingen scene-utstyrlogg ennå. Logg ditt første scene-oppsett ovenfor.
        </Alert>
      )}

      {scenes.map((scene) => (
        <Card key={scene.id} sx={CARD_SX}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon sx={{ fontSize: 18, color: '#c084fc' }} />
                <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700 }}>
                  {scene.sceneLabel}
                </Typography>
                <Chip size="small" label={scene.sceneType.replace(/_/g, ' ')} sx={{ bgcolor: 'rgba(147,51,234,0.1)', color: '#c084fc', fontSize: '0.65rem' }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b' }}>{scene.shootDate}</Typography>
            </Box>
            {Object.entries(scene.gearSetup).map(([role, gear]) => (
              <Typography key={role} variant="caption" sx={{ display: 'block', color: '#94a3b8', ml: 3, mt: 0.3 }}>
                {role}: {gear.brand} {gear.model}
              </Typography>
            ))}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 5: Equipment Memory Engine
// ═══════════════════════════════════════════════════════════════

function MemoryTab({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<EquipmentPreference[]>([]);
  const [loading, setLoading] = useState(false);
  const [sceneType, setSceneType] = useState('dialog');
  const [recs, setRecs] = useState<Array<{ category: string; brand: string; model: string; usageCount: number; reason: string }>>([]);
  const [recExplanation, setRecExplanation] = useState<Explanation | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await intelligenceApi.getPreferences(userId);
      setPrefs(res.preferences);
    } catch (err) {
      console.error('Prefs fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const fetchRecs = async () => {
    setRecLoading(true);
    try {
      const res = await intelligenceApi.getRecommendations(userId, sceneType);
      setRecs(res.recommendations);
      setRecExplanation(res.explanation);
    } catch (err) {
      console.error('Recs fetch error:', err);
    } finally {
      setRecLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
        Systemet lærer dine utstyrsvalg over tid. Jo mer du logger, desto bedre blir anbefalingene.
      </Typography>

      {/* Recommendations section */}
      <Paper sx={{ p: 2, bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: '#c084fc', mb: 1, fontWeight: 700 }}>
          Scene-basert anbefaling
        </Typography>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={8}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#94a3b8' }}>Scene-type</InputLabel>
              <Select value={sceneType} onChange={(e) => setSceneType(e.target.value)} label="Scene-type"
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147,51,234,0.3)' } }}>
                {['dialog', 'action', 'establishing', 'close_up', 'wide_shot', 'handheld', 'drone', 'interview', 'b_roll', 'night', 'underwater', 'macro', 'timelapse', 'slow_motion'].map((t) => (
                  <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={4}>
            <Button
              fullWidth variant="contained"
              onClick={fetchRecs}
              disabled={recLoading}
              sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
            >
              {recLoading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Hent'}
            </Button>
          </Grid>
        </Grid>

        {recs.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            {recs.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                    {r.brand} {r.model}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>{r.reason}</Typography>
                </Box>
                <Chip size="small" label={`${r.usageCount}x`} sx={{ bgcolor: 'rgba(147,51,234,0.1)', color: '#c084fc', fontWeight: 700 }} />
              </Box>
            ))}
            {recExplanation && <ExplanationPanel explanation={recExplanation} />}
          </Box>
        )}

        {recs.length === 0 && recExplanation && (
          <Alert severity="info" sx={{ mt: 1.5, bgcolor: 'rgba(59,130,246,0.1)' }}>
            {recExplanation.summary}
          </Alert>
        )}
      </Paper>

      <Divider sx={{ borderColor: 'rgba(147,51,234,0.1)', my: 2 }} />

      {/* Preferences overview */}
      <Typography variant="subtitle2" sx={{ color: '#c084fc', mb: 1, fontWeight: 700 }}>
        Dine utstyrsvalg-mønstre
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2, '& .MuiLinearProgress-bar': { bgcolor: '#c084fc' } }} />}

      {prefs.length === 0 && !loading && (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)' }}>
          Ingen bruksmønstre registrert ennå. Logg utstyrsbruk via API-et for å bygge din profil.
        </Alert>
      )}

      {prefs.map((pref) => (
        <Card key={pref.category} sx={{ ...CARD_SX, mb: 1 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" sx={{ color: '#e2e8f0', fontWeight: 700, textTransform: 'capitalize', mb: 0.5 }}>
              {pref.category}
            </Typography>
            {pref.topChoices.map((choice, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                <Box sx={{ width: `${choice.percentage}%`, minWidth: 4, height: 6, bgcolor: i === 0 ? '#c084fc' : '#475569', borderRadius: 3 }} />
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  {choice.brand} {choice.model} ({choice.percentage}%)
                </Typography>
              </Box>
            ))}
            {pref.sceneTypes.length > 0 && (
              <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                {pref.sceneTypes.map((st) => (
                  <Chip key={st} size="small" label={st.replace(/_/g, ' ')} sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(100,116,139,0.2)', color: '#64748b' }} />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab 6: Style Memory Engine
// ═══════════════════════════════════════════════════════════════

function StyleTab({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await intelligenceApi.getStyleProfile(userId);
      setProfile(res.profile);
    } catch (err) {
      console.error('Style profile error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleCompute = async () => {
    setComputing(true);
    try {
      const res = await intelligenceApi.computeStyleProfile(userId);
      setProfile(res.profile);
    } catch (err) {
      console.error('Compute style error:', err);
    } finally {
      setComputing(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
        Oppdager din kreative signatur — lysstil, objektiv-preferanser, kameravalg — basert på dine produksjoner.
      </Typography>

      <Button
        variant="outlined"
        startIcon={computing ? <CircularProgress size={16} sx={{ color: '#c084fc' }} /> : <ScienceIcon />}
        onClick={handleCompute}
        disabled={computing}
        sx={{ mb: 2, color: '#c084fc', borderColor: 'rgba(147,51,234,0.3)' }}
      >
        {computing ? 'Beregner...' : 'Beregn stilprofil'}
      </Button>

      {loading && <LinearProgress sx={{ mb: 2, '& .MuiLinearProgress-bar': { bgcolor: '#c084fc' } }} />}

      {!profile && !loading && (
        <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)' }}>
          Ingen stilprofil beregnet ennå. Klikk «Beregn stilprofil» for å starte analysen.
        </Alert>
      )}

      {profile && (
        <>
          {/* Stats Overview */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2 }}>
                <Typography variant="h5" sx={{ color: '#c084fc', fontWeight: 700 }}>{profile.totalProjects}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>Prosjekter</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2 }}>
                <Typography variant="h5" sx={{ color: '#c084fc', fontWeight: 700 }}>{profile.totalScenesLogged}</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>Scene-logginger</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 1.5, bgcolor: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.1)', borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>Stilsignaler</Typography>
                {Object.entries(profile.styleSignals).map(([key, value]) => (
                  <Chip key={key} size="small" label={`${key.replace(/_/g, ' ')}: ${value}`}
                    sx={{ mr: 0.5, mb: 0.5, bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc', fontSize: '0.7rem' }} />
                ))}
                {Object.keys(profile.styleSignals).length === 0 && (
                  <Typography variant="caption" sx={{ color: '#475569' }}>Ikke nok data ennå</Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Discovered Patterns */}
          {profile.discoveredPatterns.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ color: '#c084fc', mb: 1, fontWeight: 700 }}>
                Oppdagede mønstre
              </Typography>
              {profile.discoveredPatterns.map((pattern, i) => (
                <Card key={i} sx={{ ...CARD_SX, mb: 1 }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <StyleIcon sx={{ fontSize: 18, color: '#c084fc', mt: 0.3 }} />
                        <Box>
                          <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                            {pattern.pattern}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {pattern.explanation}
                          </Typography>
                        </Box>
                      </Box>
                      <ConfidenceBadge value={pattern.confidence} />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* Scene Preferences */}
          {Object.keys(profile.scenePreferences).length > 0 && (
            <>
              <Divider sx={{ borderColor: 'rgba(147,51,234,0.1)', my: 2 }} />
              <Typography variant="subtitle2" sx={{ color: '#c084fc', mb: 1, fontWeight: 700 }}>
                Scene-preferanser
              </Typography>
              {Object.entries(profile.scenePreferences).map(([sceneType, prefs]) => (
                <Box key={sceneType} sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', fontWeight: 700, fontSize: '0.65rem' }}>
                    {sceneType.replace(/_/g, ' ')}
                  </Typography>
                  {Object.entries(prefs).map(([cat, gear]) => (
                    <Typography key={cat} variant="caption" sx={{ display: 'block', ml: 2, color: '#94a3b8' }}>
                      {cat}: {gear}
                    </Typography>
                  ))}
                </Box>
              ))}
            </>
          )}
        </>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Tabbed Component
// ═══════════════════════════════════════════════════════════════

export function EquipmentIntelligence({ projectId, userId }: Props) {
  const [tab, setTab] = useState(0);
  const resolvedUserId = userId || 'current-user';

  const tabConfig = useMemo(() => [
    { label: 'Feilprediksjon', icon: <WarningIcon sx={{ fontSize: 18 }} /> },
    { label: 'Kompatibilitet', icon: <ScienceIcon sx={{ fontSize: 18 }} /> },
    { label: 'Vekt & Last', icon: <WeightIcon sx={{ fontSize: 18 }} /> },
    { label: 'Kontinuitet', icon: <TimelineIcon sx={{ fontSize: 18 }} /> },
    { label: 'Utstyrsminne', icon: <PsychologyIcon sx={{ fontSize: 18 }} /> },
    { label: 'Stilprofil', icon: <StyleIcon sx={{ fontSize: 18 }} /> },
  ], []);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 40,
          mb: 2,
          '& .MuiTab-root': {
            color: '#64748b',
            fontWeight: 600,
            fontSize: '0.75rem',
            minHeight: 40,
            textTransform: 'none',
            '&.Mui-selected': { color: '#c084fc' },
          },
          '& .MuiTabs-indicator': { bgcolor: '#c084fc' },
        }}
      >
        {tabConfig.map((t, i) => (
          <Tab key={i} icon={t.icon} label={t.label} iconPosition="start" />
        ))}
      </Tabs>

      {tab === 0 && <PredictiveFailureTab userId={resolvedUserId} />}
      {tab === 1 && <CompatibilityTab />}
      {tab === 2 && <WeightSimTab />}
      {tab === 3 && <ContinuityTab projectId={projectId} userId={resolvedUserId} />}
      {tab === 4 && <MemoryTab userId={resolvedUserId} />}
      {tab === 5 && <StyleTab userId={resolvedUserId} />}
    </Box>
  );
}
