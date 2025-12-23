/**
 * ShotListIntegrationPanel - Connect Shot Lists to Virtual Studio Setups
 * 
 * Features:
 * - Import shot list from Project Creation
 * - Match shots to scene presets
 * - Auto-suggest lighting setups per shot
 * - Train on shot requirements
 * - Validate Virtual Studio has correct equipment
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('ShotListPanel, ');
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Stack,
  Divider,
  Alert,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  CameraAlt,
  Videocam,
  Lightbulb,
  Check,
  Warning,
  Error as ErrorIcon,
  PlayArrow,
  Add,
  Delete,
  Edit,
  Sync,
  AutoAwesome,
  ExpandMore,
  Schedule,
  PhotoCamera,
  WbSunny,
  Flare,
  Settings,
  CheckCircle,
  Assignment,
  TrendingUp,
  School,
  Compare,
} from '@mui/icons-material';
import { useAppStore, SceneNode } from '../../state/store';
import { SCENE_PRESETS, ScenePreset } from './ScenePresets';
import { equipmentIntegrationService } from '../../core/services/equipmentIntegrationService';

// ============================================================================
// Types
// ============================================================================

export interface Shot {
  id: string;
  title: string;
  description: string;
  scene: string;
  shotType: 'Wide' | 'Medium' | 'Close-up' | 'Detail' | 'Establishing';
  duration: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  cameraSettings?: string;
  equipment?: string[];
  notes?: string;
  
  // Virtual Studio matching
  matchedPreset?: string;
  matchedSetup?: VirtualStudioSetup;
  matchScore?: number;
  missingEquipment?: string[];
  suggestedLighting?: string[];
}

export interface VirtualStudioSetup {
  id: string;
  name: string;
  presetId?: string;
  lights: Array<{
    type: string;
    position: [number, number, number];
    power: number;
    modifier?: string;
  }>;
  camera: {
    position: [number, number, number];
    focalLength: number;
    aperture: number;
  };
  equipment: string[];
}

export interface ShotListIntegrationProps {
  /** Shots from project creation */
  shots?: Shot[];
  /** Project type (e.g.'portrait','product','event') */
  projectType?: string;
  /** Callback when a shot is selected for preview */
  onShotSelect?: (shot: Shot) => void;
  /** Callback when setup is applied */
  onApplySetup?: (setup: VirtualStudioSetup) => void;
  /** Callback when shot is trained */
  onShotTrained?: (shot: Shot, setup: VirtualStudioSetup) => void;
}

// ============================================================================
// Shot-to-Preset Matching Engine
// ============================================================================

interface PresetMatch {
  preset: ScenePreset;
  score: number;
  reasons: string[];
  missingEquipment: string[];
}

function matchShotToPresets(shot: Shot, presets: ScenePreset[]): PresetMatch[] {
  const matches: PresetMatch[] = [];

  for (const preset of presets) {
    let score = 0;
    const reasons: string[] = [];
    const missingEquipment: string[] = [];

    // Match by shot type
    if (shot.shotType === 'Wide' && preset.name.toLowerCase().includes('wide,')) {
      score += 20;
      reasons.push('Wide shot match, ');
    }
    if (shot.shotType === 'Close-up' && (preset.name.toLowerCase().includes('portrait, ') || preset.name.toLowerCase().includes('headshot'))) {
      score += 25;
      reasons.push('Portrait/headshot match for close-up');
    }
    if (shot.shotType === 'Detail' && preset.name.toLowerCase().includes('product')) {
      score += 25;
      reasons.push('Product setup for detail shot');
    }

    // Match by scene type
    const sceneLower = shot.scene.toLowerCase();
    const presetLower = preset.name.toLowerCase();
    
    if (sceneLower.includes('portrait') && presetLower.includes('portrait')) {
      score += 30;
      reasons.push('Portrait scene match');
    }
    if (sceneLower.includes('product') && presetLower.includes('product')) {
      score += 30;
      reasons.push('Product scene match');
    }
    if (sceneLower.includes('interview') && presetLower.includes('interview')) {
      score += 30;
      reasons.push('Interview scene match');
    }
    if (sceneLower.includes('food') && presetLower.includes('food')) {
      score += 30;
      reasons.push('Food photography match');
    }

    // Match by priority (higher priority = needs more professional setup)
    if (shot.priority === 'Critical' && preset.equipment.length >= 3) {
      score += 15;
      reasons.push('Professional multi-light setup for critical shot');
    }

    // Check equipment availability
    const requiredEquipment = shot.equipment || [];
    for (const eq of requiredEquipment) {
      const hasEquipment = preset.equipment.some(
        (e) => e.name.toLowerCase().includes(eq.toLowerCase())
      );
      if (!hasEquipment) {
        missingEquipment.push(eq);
      }
    }

    // Penalty for missing equipment
    score -= missingEquipment.length * 10;

    if (score > 0) {
      matches.push({ preset, score, reasons, missingEquipment });
    }
  }

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

// ============================================================================
// Training Service
// ============================================================================

interface TrainingData {
  shotId: string;
  shotType: string;
  scene: string;
  priority: string;
  appliedPresetId: string;
  customizations: any;
  timestamp: string;
  userId?: string;
}

class ShotTrainingService {
  private trainingData: TrainingData[] = [];
  private readonly storageKey = 'virtualStudio_shotTraining';
  private initialized = false;

  constructor() {
    this.loadAsync();
  }

  // DB-first with localStorage fallback pattern
  private async loadAsync(): Promise<void> {
    if (this.initialized) return;
    
    // Try backend first
    try {
      const response = await fetch('/api/virtual-studio/training/shots', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.training)) {
          this.trainingData = data.training;
          // Cache in localStorage
          localStorage.setItem(this.storageKey, JSON.stringify(this.trainingData));
          this.initialized = true;
          return;
        }
      }
    } catch (e) {
      log.warn('Failed to load training data from API, using localStorage: ', e);
    }
    
    // Fallback to localStorage
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.trainingData = JSON.parse(saved);
      }
    } catch (e) {
      log.warn('Failed to load shot training data from localStorage:', e);
    }
    this.initialized = true;
  }

  private save(): void {
    // Save to localStorage first (fast)
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.trainingData));
    } catch (e) {
      log.warn('Failed to save shot training data to localStorage:', e);
    }
  }

  recordTraining(shot: Shot, presetId: string, customizations?: any): void {
    const entry: TrainingData = {
      shotId: shot.id,
      shotType: shot.shotType,
      scene: shot.scene,
      priority: shot.priority,
      appliedPresetId: presetId,
      customizations: customizations || {},
      timestamp: new Date().toISOString(),
    };
    this.trainingData.push(entry);
    this.save();

    // Send to backend for ML training (async, non-blocking)
    this.syncToBackend(entry);
  }

  private async syncToBackend(entry: TrainingData): Promise<void> {
    try {
      await fetch('/api/virtual-studio/training/shots', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(entry),
      });
    } catch (e) {
      log.warn('Failed to sync training data to backend:', e);
    }
  }

  getRecommendedPreset(shot: Shot): string | null {
    // Find similar shots and their most used presets
    const similar = this.trainingData.filter(
      (t) =>
        t.shotType === shot.shotType ||
        t.scene.toLowerCase().includes(shot.scene.toLowerCase())
    );

    if (similar.length === 0) return null;

    // Count preset usage
    const presetCounts: Record<string, number> = {};
    for (const s of similar) {
      presetCounts[s.appliedPresetId] = (presetCounts[s.appliedPresetId] || 0) + 1;
    }

    // Return most used
    const sorted = Object.entries(presetCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  }

  getTrainingStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const t of this.trainingData) {
      byType[t.shotType] = (byType[t.shotType] || 0) + 1;
    }
    return { total: this.trainingData.length, byType };
  }
}

const shotTrainingService = new ShotTrainingService();

// ============================================================================
// Main Component
// ============================================================================

export const ShotListIntegrationPanel: React.FC<ShotListIntegrationProps> = ({
  shots = [],
  projectType = 'general',
  onShotSelect,
  onApplySetup,
  onShotTrained,
}) => {
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [matchResults, setMatchResults] = useState<PresetMatch[]>([]);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [autoMatch, setAutoMatch] = useState(true);
  const [trainingMode, setTrainingMode] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importedShots, setImportedShots] = useState<Shot[]>(shots);

  // Get current scene state
  const nodes = useAppStore((state) => state.nodes);
  const addNode = useAppStore((state) => state.addNode);

  // Training stats
  const trainingStats = useMemo(() => shotTrainingService.getTrainingStats(), []);

  // Load shots from route state or props
  useEffect(() => {
    // Check if we have shots from navigation state
    const checkRouteState = () => {
      const state = window.history.state?.usr;
      if (state?.scenes) {
        const scenesAsShots: Shot[] = state.scenes.map((s: any, i: number) => ({
          id: s.id || `shot-${i}`,
          title: s.name || s.description,
          description: s.description || ', ',
          scene: s.name || 'General',
          shotType: mapShotType(s.shotType),
          duration: s.duration || 30,
          priority: 'Medium' as const,
          notes: s.notes,
        }));
        setImportedShots(scenesAsShots);
      }
    };
    checkRouteState();

    // Listen for custom event
    const handleShotListImport = (e: CustomEvent) => {
      if (e.detail?.shots) {
        setImportedShots(e.detail.shots);
      }
    };
    window.addEventListener('ch-import-shotlist', handleShotListImport as EventListener);
    return () => {
      window.removeEventListener('ch-import-shotlist', handleShotListImport as EventListener);
    };
  }, []);

  // Auto-match when shot is selected
  useEffect(() => {
    if (selectedShot && autoMatch) {
      const presets = Object.values(SCENE_PRESETS).flat();
      const matches = matchShotToPresets(selectedShot, presets);
      setMatchResults(matches);
    }
  }, [selectedShot, autoMatch]);

  // Handle shot selection
  const handleSelectShot = (shot: Shot) => {
    setSelectedShot(shot);
    onShotSelect?.(shot);
    setShowMatchDialog(true);
  };

  // Apply preset to scene
  const handleApplyPreset = (match: PresetMatch) => {
    const preset = match.preset;

    // Load preset into scene
    equipmentIntegrationService.loadPreset(preset);

    // Create setup object
    const setup: VirtualStudioSetup = {
      id: `setup-${Date.now()}`,
      name: `${preset.name} for ${selectedShot?.title}`,
      presetId: preset.id,
      lights: preset.equipment
        .filter((e) => e.category === 'light')
        .map((e, i) => ({
          type: e.name,
          position: e.position || [0, 2, 0],
          power: 100,
          modifier: undefined,
        })),
      camera: {
        position: [0, 1.6, 3],
        focalLength: 85,
        aperture: 2.8,
      },
      equipment: preset.equipment.map((e) => e.name),
    };

    onApplySetup?.(setup);

    // Record training if in training mode
    if (trainingMode && selectedShot) {
      shotTrainingService.recordTraining(selectedShot, preset.id);
      onShotTrained?.(selectedShot, setup);
    }

    setShowMatchDialog(false);
  };

  // Get priority color
  const getPriorityColor = (priority: Shot['priority']) => {
    switch (priority) {
      case 'Critical':
        return 'error';
      case 'High':
        return 'warning';
      case 'Medium':
        return 'info';
      case 'Low':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get shot type icon
  const getShotTypeIcon = (shotType: Shot['shotType']) => {
    switch (shotType) {
      case 'Wide':
        return <Videocam fontSize="small" />;
      case 'Close-up':
        return <CameraAlt fontSize="small" />;
      case 'Detail':
        return <PhotoCamera fontSize="small" />;
      default:
        return <CameraAlt fontSize="small" />;
    }
  };

  // Validate current scene has required equipment
  const validateSetup = (shot: Shot): { valid: boolean; missing: string[] } => {
    const required = shot.equipment || [];
    const missing: string[] = [];

    for (const eq of required) {
      const hasEquipment = nodes.some(
        (n) => n.name?.toLowerCase().includes(eq.toLowerCase())
      );
      if (!hasEquipment) {
        missing.push(eq);
      }
    }

    return { valid: missing.length === 0, missing };
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Assignment color="primary" />
            <Box>
              <Typography variant="h6">Shot List Integration</Typography>
              <Typography variant="caption" color="text.secondary">
                {importedShots.length} shots • {projectType} project
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Import shot list from project">
              <IconButton onClick={() => setImportDialogOpen(true)}>
                <Add />
              </IconButton>
            </Tooltip>

            <FormControlLabel
              control={
                <Switch
                  checked={trainingMode}
                  onChange={(e) => setTrainingMode(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <School fontSize="small" />
                  <Typography variant="caption">Train</Typography>
                </Stack>
              }
            />
          </Stack>
        </Stack>

        {/* Training Stats */}
        {trainingStats.total > 0 && (
          <Alert severity="info" sx={{ mt: 1 }} icon={<TrendingUp />}>
            <Typography variant="caption">
              {trainingStats.total} shots trained •{''}
              {Object.entries(trainingStats.byType)
                .map(([type, count]) => `${count} ${type}`)
                .join(', ')}
            </Typography>
          </Alert>
        )}
      </Paper>

      {/* Shot List */}
      {importedShots.length === 0 ? (
        <Alert severity="info" sx={{ m: 2 }}>
          <Typography variant="body2">
            No shots imported. Use the + button to import a shot list from your project, or create
            shots manually.
          </Typography>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => setImportDialogOpen(true)}
            sx={{ mt: 1 }}
          >
            Import Shot List
          </Button>
        </Alert>
      ) : (
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {importedShots.map((shot) => {
            const validation = validateSetup(shot);
            const recommended = shotTrainingService.getRecommendedPreset(shot);

            return (
              <ListItem
                key={shot.id}
                button
                onClick={() => handleSelectShot(shot)}
                sx={{
                  border: selectedShot?.id === shot.id ? 2 : 1,
                  borderColor: selectedShot?.id === shot.id ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  mb: 1}}
              >
                <ListItemIcon>{getShotTypeIcon(shot.shotType)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle2">{shot.title}</Typography>
                      <Chip
                        label={shot.priority}
                        size="small"
                        color={getPriorityColor(shot.priority)}
                      />
                      {recommended && (
                        <Tooltip title="AI recommendation available">
                          <AutoAwesome fontSize="small" color="secondary" />
                        </Tooltip>
                      )}
                    </Stack>
                  }
                  secondary={
                    <Stack>
                      <Typography variant="caption" color="text.secondary">
                        {shot.scene} • {shot.shotType} • {shot.duration}s
                      </Typography>
                      {!validation.valid && (
                        <Typography variant="caption" color="error">
                          Missing: {validation.missing.join(', ')}
                        </Typography>
                      )}
                    </Stack>
                  }
                />
                <ListItemSecondaryAction>
                  {validation.valid ? (
                    <CheckCircle color="success" />
                  ) : (
                    <Warning color="warning" />
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
        </List>
      )}

      {/* Match Dialog */}
      <Dialog open={showMatchDialog} onClose={() => setShowMatchDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Compare />
            <Typography variant="h6">Match Setup for: {selectedShot?.title}</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {matchResults.length === 0 ? (
            <Alert severity="warning">
              No matching presets found. Try adjusting the shot details or create a custom setup.
            </Alert>
          ) : (
            <List>
              {matchResults.slice(0, 5).map((match, index) => (
                <Card key={match.preset.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {index === 0 && <Chip label="Best Match" size="small" color="success" sx={{ mr: 1 }} />}
                          {match.preset.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Match Score: {match.score}%
                        </Typography>
                      </Box>
                      <Chip
                        label={`${match.preset.equipment.length} items`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="success.main" display="block">
                        ✓ {match.reasons.join(' • ')}
                      </Typography>
                      {match.missingEquipment.length > 0 && (
                        <Typography variant="caption" color="error" display="block">
                          ⚠ Missing: {match.missingEquipment.join(', ')}
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      {match.preset.equipment.slice(0, 4).map((eq) => (
                        <Chip key={eq.name} label={eq.name} size="small" variant="outlined" />
                      ))}
                      {match.preset.equipment.length > 4 && (
                        <Chip label={`+${match.preset.equipment.length - 4} more`} size="small" />
                      )}
                    </Stack>
                  </CardContent>
                  <CardActions>
                    <Button
                      variant="contained"
                      startIcon={<PlayArrow />}
                      onClick={() => handleApplyPreset(match)}
                    >
                      Apply This Setup
                    </Button>
                    {trainingMode && (
                      <Button
                        startIcon={<School />}
                        onClick={() => {
                          if (selectedShot) {
                            shotTrainingService.recordTraining(selectedShot, match.preset.id);
                          }
                          handleApplyPreset(match);
                        }}
                      >
                        Apply & Train
                      </Button>
                    )}
                  </CardActions>
                </Card>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMatchDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Shot List</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Shot lists are automatically imported when you open Virtual Studio from a project.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            You can also manually paste a shot list in JSON format or import from the Shot List Manager.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={6}
            placeholder='[{"title":"Opening Shot""scene":"Intro""shotType" : "Wide", ...}]'
            sx={{ mt: 2 }}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  setImportedShots(parsed);
                }
              } catch {
                // Invalid JSON
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setImportDialogOpen(false)}>
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function mapShotType(type?: string): Shot['shotType'] {
  if (!type) return 'Medium';
  const lower = type.toLowerCase();
  if (lower.includes('wide')) return 'Wide';
  if (lower.includes('close')) return 'Close-up';
  if (lower.includes('detail')) return 'Detail';
  if (lower.includes('establish')) return 'Establishing';
  return'Medium';
}

export default ShotListIntegrationPanel;

