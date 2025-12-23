/**
 * Master Integration Panel
 * 
 * Comprehensive UI showing all lighting integrations:
 * - AI Recommendations
 * - HDRI Exposure
 * - Cost Calculator
 * - Gear Presets
 * - Multi-Camera Sync
 * - Histogram Feedback
 * - Community Sharing
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Tabs,
  Tab,
  Chip,
  Button,
  Alert,
  AlertTitle,
  Divider,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  IconButton,
  Tooltip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Slider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Landscape as HDRIIcon,
  AttachMoney as CostIcon,
  Save as SaveIcon,
  Restore as LoadIcon,
  CameraAlt as CameraIcon,
  BarChart as HistogramIcon,
  Share as ShareIcon,
  Lightbulb as LightIcon,
  ExpandMore as ExpandIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Sync as SyncIcon,
  Delete as DeleteIcon,
  PlayArrow as ApplyIcon,
  Timeline as TimelineIcon,
  Person as ActorIcon,
  Palette as LUTIcon,
} from '@mui/icons-material';
import { useMasterLightingIntegration } from '@/hooks/useMasterLightingIntegration';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatShutter(shutter: number): string {
  if (shutter >= 1) return `${shutter} "`;
  return `1/${Math.round(1 / shutter)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US,', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

// =============================================================================
// TAB PANEL
// =============================================================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ display: value === index ? 'block' : 'none', p: 2 }}
    >
      {value === index && children}
    </Box>
  );
}

// =============================================================================
// AI RECOMMENDATIONS TAB
// =============================================================================

function AIRecommendationsTab() {
  const { 
    aiRecommendations, 
    isLoadingAI, 
    getAIRecommendations,
  } = useMasterLightingIntegration();
  
  const [mood, setMood] = useState('dramatic,');
  const [subject, setSubject] = useState<'portrait' | 'product' | 'fashion' | 'automotive' | 'food'>('portrait');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  
  const handleGetRecommendations = () => {
    getAIRecommendations(mood, subject, { skillLevel });
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <AIIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        AI Lighting Recommendations
      </Typography>
      
      <Stack direction="row" spacing={2} mb={3}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Mood</InputLabel>
          <Select value={mood} onChange={(e) => setMood(e.target.value)} label="Mood">
            <MenuItem value="bright">Bright</MenuItem>
            <MenuItem value="neutral">Neutral</MenuItem>
            <MenuItem value="dramatic">Dramatic</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
            <MenuItem value="high-key">High Key</MenuItem>
            <MenuItem value="low-key">Low Key</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Subject</InputLabel>
          <Select value={subject} onChange={(e) => setSubject(e.target.value as any)} label="Subject">
            <MenuItem value="portrait">Portrait</MenuItem>
            <MenuItem value="product">Product</MenuItem>
            <MenuItem value="fashion">Fashion</MenuItem>
            <MenuItem value="automotive">Automotive</MenuItem>
            <MenuItem value="food">Food</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Skill</InputLabel>
          <Select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as any)} label="Skill">
            <MenuItem value="beginner">Beginner</MenuItem>
            <MenuItem value="intermediate">Intermediate</MenuItem>
            <MenuItem value="advanced">Advanced</MenuItem>
          </Select>
        </FormControl>
        
        <Button 
          variant="contained" 
          onClick={handleGetRecommendations}
          disabled={isLoadingAI}
          startIcon={<AIIcon />}
        >
          Get Recommendations
        </Button>
      </Stack>
      
      {isLoadingAI && <LinearProgress sx={{ mb: 2 }} />}
      
      <Stack spacing={2}>
        {aiRecommendations.map((rec, i) => (
          <Card key={i} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {rec.pattern.name}
                </Typography>
                <Chip 
                  label={`${Math.round(rec.aiScore * 100)}% match`}
                  size="small"
                  color={rec.aiScore >= 0.7 ? 'success' : rec.aiScore >= 0.5 ? 'warning' : 'default'}
                />
                <Chip label={rec.pattern.difficulty} size="small" variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {rec.reasoning}
              </Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <Chip label={`${rec.analysis.requirements.length} lights`} size="small" />
                <Chip label={rec.analysis.contrastRatio} size="small" />
                <Chip label={`f/${rec.analysis.recommendedSettings.aperture}`} size="small" />
              </Stack>
            </CardContent>
          </Card>
        ))}
        
        {aiRecommendations.length === 0 && !isLoadingAI && (
          <Alert severity="info">
            Click "Get Recommendations" to see AI-powered lighting suggestions based on your equipment.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

// =============================================================================
// HDRI EXPOSURE TAB
// =============================================================================

function HDRIExposureTab() {
  const { hdriExposure, currentHDRI, setHDRI } = useMasterLightingIntegration();
  
  const hdriOptions = [
    { value: 'studio-soft', label: 'Studio Soft' },
    { value: 'studio-bright', label: 'Studio Bright' },
    { value: 'sunny-day', label: 'Sunny Day' },
    { value: 'overcast', label: 'Overcast' },
    { value: 'golden-hour', label: 'Golden Hour' },
    { value: 'blue-hour', label: 'Blue Hour' },
    { value: 'office', label: 'Office Interior' },
    { value: 'night-city', label: 'Night City' },
  ];
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <HDRIIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        HDRI Environment Exposure
      </Typography>
      
      <FormControl fullWidth size="small" sx={{ mb: 3 }}>
        <InputLabel>Environment</InputLabel>
        <Select 
          value={currentHDRI || ', '} 
          onChange={(e) => setHDRI(e.target.value)}
          label="Environment"
        >
          <MenuItem value="">None</MenuItem>
          {hdriOptions.map(opt => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {hdriExposure && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Exposure Analysis</Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Brightness</Typography>
              <Typography variant="body1">{Math.round(hdriExposure.brightness * 100)}%</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">EV Contribution</Typography>
              <Typography variant="body1">EV {hdriExposure.evContribution}</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Color Temp</Typography>
              <Typography variant="body1">{hdriExposure.dominantColorTemp}K</Typography>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>Recommended Adjustments</Typography>
          <Stack spacing={1}>
            <Chip 
              label={`Exposure: ${hdriExposure.recommendedAdjustment.exposureCompensation > 0 ? '+' : ', '}${hdriExposure.recommendedAdjustment.exposureCompensation.toFixed(1)} stops`}
              color={Math.abs(hdriExposure.recommendedAdjustment.exposureCompensation) > 1 ? 'warning' : 'default'}
            />
            <Chip label={`White Balance: ${hdriExposure.recommendedAdjustment.whiteBalance}K`} />
          </Stack>
          
          {hdriExposure.recommendedAdjustment.mixWarning && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {hdriExposure.recommendedAdjustment.mixWarning}
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
}

// =============================================================================
// COST CALCULATOR TAB
// =============================================================================

function CostCalculatorTab() {
  const { calculatePatternCost, aiRecommendations } = useMasterLightingIntegration();
  const [selectedPattern, setSelectedPattern] = useState<string>('');
  const [rentalDays, setRentalDays] = useState(1);
  
  const costAnalysis = useMemo(() => {
    if (!selectedPattern) return null;
    return calculatePatternCost(selectedPattern, rentalDays);
  }, [selectedPattern, rentalDays, calculatePatternCost]);
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CostIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Equipment Cost Calculator
      </Typography>
      
      <Stack direction="row" spacing={2} mb={3}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Pattern</InputLabel>
          <Select value={selectedPattern} onChange={(e) => setSelectedPattern(e.target.value)} label="Pattern">
            <MenuItem value="">Select a pattern</MenuItem>
            {aiRecommendations.map(rec => (
              <MenuItem key={rec.pattern.id} value={rec.pattern.id}>
                {rec.pattern.name}
              </MenuItem>
            ))}
            <MenuItem value="rembrandt">Rembrandt</MenuItem>
            <MenuItem value="butterfly">Butterfly</MenuItem>
            <MenuItem value="three-point">Three Point</MenuItem>
          </Select>
        </FormControl>
        
        <TextField
          size="small"
          type="number"
          label="Rental Days"
          value={rentalDays}
          onChange={(e) => setRentalDays(parseInt(e.target.value) || 1)}
          sx={{ width: 100 }}
        />
      </Stack>
      
      {costAnalysis && (
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={3} mb={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Equipment Owned</Typography>
              <Typography variant="h5" color="success.main">
                {formatCurrency(costAnalysis.ownedEquipmentValue)}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Missing Equipment</Typography>
              <Typography variant="h5" color="warning.main">
                {formatCurrency(costAnalysis.missingEquipmentCost)}
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Rental Cost ({rentalDays}d)</Typography>
              <Typography variant="h5" color="primary.main">
                {formatCurrency(costAnalysis.rentalCost)}
              </Typography>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>Equipment Breakdown</Typography>
          <List dense>
            {costAnalysis.breakdown.map((item, i) => (
              <ListItem key={i}>
                <ListItemIcon>
                  {item.owned ? <CheckIcon color="success" /> : <WarningIcon color="warning" />}
                </ListItemIcon>
                <ListItemText 
                  primary={item.item}
                  secondary={item.owned ? 'Owned' : `Rental: ${formatCurrency(item.rentalPrice)}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

// =============================================================================
// GEAR PRESETS TAB
// =============================================================================

function GearPresetsTab() {
  const { 
    savedPresets, 
    saveCurrentAsPreset, 
    loadPreset, 
    deletePreset,
  } = useMasterLightingIntegration();
  
  const [presetName, setPresetName] = useState('');
  
  const handleSave = () => {
    if (presetName.trim()) {
      saveCurrentAsPreset(presetName.trim());
      setPresetName('');
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <SaveIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Gear Presets
      </Typography>
      
      <Stack direction="row" spacing={2} mb={3}>
        <TextField
          size="small"
          label="Preset Name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={!presetName.trim()}
          startIcon={<SaveIcon />}
        >
          Save Current
        </Button>
      </Stack>
      
      <List>
        {savedPresets.map(preset => (
          <Paper key={preset.id} variant="outlined" sx={{ mb: 1 }}>
            <ListItem>
              <ListItemIcon>
                <LightIcon />
              </ListItemIcon>
              <ListItemText
                primary={preset.name}
                secondary={
                  <Stack direction="row" spacing={1} mt={0.5}>
                    <Chip label={`${preset.lights.length} lights`} size="small" />
                    <Chip label={`EV ${preset.exposureData.ev.toFixed(1)}`} size="small" />
                    <Chip label={preset.exposureData.contrastRatio} size="small" />
                    {preset.patternName && (
                      <Chip label={preset.patternName} size="small" color="primary" variant="outlined" />
                    )}
                  </Stack>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title="Load Preset">
                  <IconButton onClick={() => loadPreset(preset)}>
                    <LoadIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton onClick={() => deletePreset(preset.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          </Paper>
        ))}
        
        {savedPresets.length === 0 && (
          <Alert severity="info">
            No presets saved. Set up your scene and save it as a preset for quick recall.
          </Alert>
        )}
      </List>
    </Box>
  );
}

// =============================================================================
// MULTI-CAMERA SYNC TAB
// =============================================================================

function MultiCameraSyncTab() {
  const {
    cameraExposures,
    syncMode,
    setSyncMode,
    applyCameraSync,
    syncAllCameras,
  } = useMasterLightingIntegration();
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CameraIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Multi-Camera Exposure Sync
      </Typography>
      
      <Stack direction="row" spacing={2} mb={3}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sync Mode</InputLabel>
          <Select value={syncMode} onChange={(e) => setSyncMode(e.target.value as any)} label="Sync Mode">
            <MenuItem value="match-ev">Match EV</MenuItem>
            <MenuItem value="match-aperture">Match Aperture</MenuItem>
            <MenuItem value="independent">Independent</MenuItem>
          </Select>
        </FormControl>
        
        <Button 
          variant="contained" 
          onClick={syncAllCameras}
          startIcon={<SyncIcon />}
          disabled={cameraExposures.length === 0}
        >
          Sync All Cameras
        </Button>
      </Stack>
      
      <Stack spacing={2}>
        {cameraExposures.map(cam => (
          <Paper key={cam.cameraId} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <CameraIcon />
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2">{cam.cameraName}</Typography>
                <Stack direction="row" spacing={1} mt={0.5}>
                  <Chip 
                    label={`f/${cam.currentSettings.aperture}`} 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    label={formatShutter(cam.currentSettings.shutter)} 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    label={`ISO ${cam.currentSettings.iso}`} 
                    size="small" 
                    variant="outlined"
                  />
                </Stack>
              </Box>
              <Chip 
                label={cam.syncStatus}
                color={cam.syncStatus === 'synced' ? 'success' : 'warning'}
                size="small"
              />
              {cam.evDifference !== 0 && (
                <Chip 
                  label={`${cam.evDifference > 0 ? '+' : ', '}${cam.evDifference.toFixed(1)} EV`}
                  size="small"
                  color={Math.abs(cam.evDifference) > 1 ? 'error' : 'default'}
                />
              )}
              <Button 
                size="small" 
                onClick={() => applyCameraSync(cam.cameraId)}
                disabled={cam.syncStatus === 'synced'}
              >
                Sync
              </Button>
            </Stack>
          </Paper>
        ))}
        
        {cameraExposures.length === 0 && (
          <Alert severity="info">
            Add cameras to your scene to manage multi-camera exposure sync.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

// =============================================================================
// HISTOGRAM FEEDBACK TAB
// =============================================================================

function HistogramFeedbackTab() {
  const { histogramFeedback, applyHistogramSuggestion } = useMasterLightingIntegration();
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <HistogramIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Histogram Analysis
      </Typography>
      
      {histogramFeedback ? (
        <Paper sx={{ p: 2 }}>
          <Grid container spacing={2} mb={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Shadows</Typography>
              <Typography variant="h6" color={histogramFeedback.clipping.shadows ? 'error.main' : 'text.primary'}>
                {histogramFeedback.underexposed.toFixed(1)}%
              </Typography>
              {histogramFeedback.clipping.shadows && (
                <Chip label="Clipping" color="error" size="small" />
              )}
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Midtones</Typography>
              <Typography variant="h6">{histogramFeedback.midtones.toFixed(1)}%</Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">Highlights</Typography>
              <Typography variant="h6" color={histogramFeedback.clipping.highlights ? 'error.main' : 'text.primary'}>
                {histogramFeedback.overexposed.toFixed(1)}%
              </Typography>
              {histogramFeedback.clipping.highlights && (
                <Chip label="Clipping" color="error" size="small" />
              )}
            </Grid>
          </Grid>
          
          {histogramFeedback.suggestedAdjustment.direction !== 'optimal' && (
            <>
              <Divider sx={{ my: 2 }} />
              <Alert 
                severity={histogramFeedback.suggestedAdjustment.direction === 'brighter' ? 'info' : 'warning'}
                action={
                  <Button size="small" onClick={applyHistogramSuggestion}>
                    Apply
                  </Button>
                }
              >
                Suggest: Go {histogramFeedback.suggestedAdjustment.direction} by {histogramFeedback.suggestedAdjustment.stops.toFixed(1)} stops via {histogramFeedback.suggestedAdjustment.method}
              </Alert>
            </>
          )}
          
          {histogramFeedback.suggestedAdjustment.direction === 'optimal' && (
            <Alert severity="success">Exposure looks optimal!</Alert>
          )}
        </Paper>
      ) : (
        <Alert severity="info">
          Histogram data will appear when rendering preview is active.
        </Alert>
      )}
    </Box>
  );
}

// =============================================================================
// MAIN PANEL
// =============================================================================

export function MasterIntegrationPanel() {
  const [activeTab, setActiveTab] = useState(0);
  const { isLoading } = useMasterLightingIntegration();
  
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading integration data...</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.dark' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AIIcon />
          <Typography variant="h6">Master Integration Hub</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          All lighting systems connected
        </Typography>
      </Paper>
      
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab icon={<AIIcon />} label="AI" />
        <Tab icon={<HDRIIcon />} label="HDRI" />
        <Tab icon={<CostIcon />} label="Cost" />
        <Tab icon={<SaveIcon />} label="Presets" />
        <Tab icon={<CameraIcon />} label="Multi-Cam" />
        <Tab icon={<HistogramIcon />} label="Histogram" />
      </Tabs>
      
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <TabPanel value={activeTab} index={0}>
          <AIRecommendationsTab />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <HDRIExposureTab />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          <CostCalculatorTab />
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          <GearPresetsTab />
        </TabPanel>
        <TabPanel value={activeTab} index={4}>
          <MultiCameraSyncTab />
        </TabPanel>
        <TabPanel value={activeTab} index={5}>
          <HistogramFeedbackTab />
        </TabPanel>
      </Box>
    </Box>
  );
}

export default MasterIntegrationPanel;

