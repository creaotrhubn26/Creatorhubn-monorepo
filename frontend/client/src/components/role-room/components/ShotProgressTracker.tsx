// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Stack,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Replay as RetakeIcon,
  PlayCircle as PlayIcon,
  PauseCircle as PauseIcon,
  Schedule as ScheduleIcon,
  Videocam as VideocamIcon,
  Movie as MovieIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Flag as FlagIcon,
  Star as StarIcon,
  Comment as CommentIcon,
  Timer as TimerIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { TrendingIcon as TrendingUpIcon } from './icons/CastingIcons';
import type { SceneBreakdown } from '../models/casting';
import GlobalMentionHelper from './shared/GlobalMentionHelper';

// Internal shot type for tracking
interface TrackedShot {
  id: string;
  shotNumber: string;
  shotType: string;
  cameraAngle: string;
  description?: string;
}

interface ShotProgress {
  shotId: string;
  sceneId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'retake_needed' | 'approved';
  takes: Take[];
  currentTake: number;
  notes: string;
  rating?: number;
  startTime?: string;
  endTime?: string;
  director_notes?: string;
  technical_notes?: string;
}

interface Take {
  id: string;
  takeNumber: number;
  status: 'good' | 'ng' | 'print' | 'hold';
  timecode: string;
  duration: string;
  notes: string;
  rating?: number;
  timestamp: string;
}

interface ShotProgressTrackerProps {
  scenes: SceneBreakdown[];
  onProgressUpdate?: (progress: ShotProgress[]) => void;
}

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

// Generate demo shots for each scene
const generateDemoShots = (scene: SceneBreakdown): TrackedShot[] => {
  const shotTypes = ['Wide', 'Medium', 'Close-up', 'OTS', 'Insert'];
  const angles = ['Front', 'Profile', 'High', 'Low', '3/4'];
  const count = Math.floor(Math.random() * 4) + 2; // 2-5 shots per scene
  
  return Array.from({ length: count }, (_, i) => ({
    id: `${scene.id}-shot-${i + 1}`,
    shotNumber: `${scene.sceneNumber}${String.fromCharCode(65 + i)}`,
    shotType: shotTypes[i % shotTypes.length],
    cameraAngle: angles[i % angles.length],
    description: `Shot ${i + 1} of scene ${scene.sceneNumber}`,
  }));
};

export const ShotProgressTracker: React.FC<ShotProgressTrackerProps> = ({
  scenes,
  onProgressUpdate,
}) => {
  const [progress, setProgress] = useState<Map<string, ShotProgress>>(new Map());
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [selectedShot, setSelectedShot] = useState<string | null>(null);
  const [showTakeDialog, setShowTakeDialog] = useState(false);
  const [newTakeNotes, setNewTakeNotes] = useState('');
  const [newTakeStatus, setNewTakeStatus] = useState<'good' | 'ng' | 'print' | 'hold'>('good');
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Memoize shots map for each scene
  const sceneShotsMap = useMemo(() => {
    const map = new Map<string, TrackedShot[]>();
    scenes.forEach(scene => {
      map.set(scene.id, generateDemoShots(scene));
    });
    return map;
  }, [scenes]);

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeTimer) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: ShotProgress['status']) => {
    const colors = {
      not_started: '#6b7280',
      in_progress: '#f59e0b',
      completed: '#10b981',
      retake_needed: '#ef4444',
      approved: '#8b5cf6',
    };
    return colors[status];
  };

  const getStatusLabel = (status: ShotProgress['status']) => {
    const labels = {
      not_started: 'Ikke startet',
      in_progress: 'Pågår',
      completed: 'Fullført',
      retake_needed: 'Må tas om',
      approved: 'Godkjent',
    };
    return labels[status];
  };

  const getTakeStatusColor = (status: Take['status']) => {
    const colors = {
      good: '#10b981',
      ng: '#ef4444',
      print: '#8b5cf6',
      hold: '#f59e0b',
    };
    return colors[status];
  };

  const getShotProgress = (sceneId: string, shotId: string): ShotProgress => {
    const key = `${sceneId}-${shotId}`;
    return progress.get(key) || {
      shotId,
      sceneId,
      status: 'not_started',
      takes: [],
      currentTake: 0,
      notes: '',
    };
  };

  const updateShotProgress = (sceneId: string, shotId: string, updates: Partial<ShotProgress>) => {
    const key = `${sceneId}-${shotId}`;
    const current = getShotProgress(sceneId, shotId);
    const updated = { ...current, ...updates };
    setProgress(prev => new Map(prev).set(key, updated));
    
    if (onProgressUpdate) {
      const allProgress = Array.from(progress.values());
      onProgressUpdate(allProgress);
    }
  };

  const startShot = (sceneId: string, shotId: string) => {
    updateShotProgress(sceneId, shotId, {
      status: 'in_progress',
      startTime: new Date().toISOString(),
    });
    setActiveTimer(`${sceneId}-${shotId}`);
    setElapsedTime(0);
  };

  const addTake = (sceneId: string, shotId: string) => {
    const current = getShotProgress(sceneId, shotId);
    const newTake: Take = {
      id: `take-${Date.now()}`,
      takeNumber: current.takes.length + 1,
      status: newTakeStatus,
      timecode: `${formatTime(elapsedTime)}:00`,
      duration: formatTime(elapsedTime),
      notes: newTakeNotes,
      rating: newTakeStatus === 'print' ? 5 : newTakeStatus === 'good' ? 4 : 2,
      timestamp: new Date().toISOString(),
    };

    updateShotProgress(sceneId, shotId, {
      takes: [...current.takes, newTake],
      currentTake: current.takes.length + 1,
    });

    setNewTakeNotes('');
    setNewTakeStatus('good');
    setShowTakeDialog(false);
  };

  const markShotComplete = (sceneId: string, shotId: string) => {
    setActiveTimer(null);
    updateShotProgress(sceneId, shotId, {
      status: 'completed',
      endTime: new Date().toISOString(),
    });
  };

  const markShotApproved = (sceneId: string, shotId: string) => {
    updateShotProgress(sceneId, shotId, { status: 'approved' });
  };

  const markRetakeNeeded = (sceneId: string, shotId: string) => {
    updateShotProgress(sceneId, shotId, { status: 'retake_needed' });
  };

  const toggleSceneExpand = (sceneId: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  // Calculate overall progress
  const calculateOverallProgress = () => {
    let totalShots = 0;
    let completedShots = 0;
    let approvedShots = 0;

    scenes.forEach(scene => {
      const shots = sceneShotsMap.get(scene.id) || [];
      totalShots += shots.length;
      
      shots.forEach((shot: TrackedShot) => {
        const shotProgress = getShotProgress(scene.id, shot.id);
        if (shotProgress.status === 'completed' || shotProgress.status === 'approved') {
          completedShots++;
        }
        if (shotProgress.status === 'approved') {
          approvedShots++;
        }
      });
    });

    return {
      total: totalShots,
      completed: completedShots,
      approved: approvedShots,
      percentage: totalShots > 0 ? (completedShots / totalShots) * 100 : 0,
      approvedPercentage: totalShots > 0 ? (approvedShots / totalShots) * 100 : 0,
    };
  };

  const overallProgress = calculateOverallProgress();

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Overall Progress */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="primary" />
            Shot Progress Tracker
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip 
              icon={<VideocamIcon />} 
              label={`${overallProgress.completed}/${overallProgress.total} shots`}
              color="primary"
            />
            <Chip 
              icon={<CheckCircleIcon />} 
              label={`${overallProgress.approved} godkjent`}
              color="success"
            />
          </Stack>
        </Stack>

        {/* Progress Bars */}
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption">Fullført</Typography>
            <Typography variant="caption">{overallProgress.percentage.toFixed(0)}%</Typography>
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={overallProgress.percentage} 
            sx={{ height: 8, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)' }}
          />
        </Box>
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption">Godkjent</Typography>
            <Typography variant="caption">{overallProgress.approvedPercentage.toFixed(0)}%</Typography>
          </Stack>
          <LinearProgress 
            variant="determinate" 
            value={overallProgress.approvedPercentage} 
            color="success"
            sx={{ height: 8, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)' }}
          />
        </Box>
      </Paper>

      {/* Active Timer */}
      {activeTimer && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b' }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
            <TimerIcon sx={{ color: '#f59e0b', fontSize: 32 }} />
            <Typography variant="h3" sx={{ fontFamily: 'monospace', color: '#f59e0b' }}>
              {formatTime(elapsedTime)}
            </Typography>
            <Button
              variant="contained"
              color="warning"
              onClick={() => {
                setSelectedShot(activeTimer);
                setShowTakeDialog(true);
              }}
            >
              Logg Take
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Scenes List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {scenes.map(scene => {
          const shots = sceneShotsMap.get(scene.id) || [];
          const isExpanded = expandedScenes.has(scene.id);
          
          // Calculate scene progress
          let sceneCompleted = 0;
          let sceneApproved = 0;
          shots.forEach((shot: TrackedShot) => {
            const sp = getShotProgress(scene.id, shot.id);
            if (sp.status === 'completed' || sp.status === 'approved') sceneCompleted++;
            if (sp.status === 'approved') sceneApproved++;
          });
          const sceneProgress = shots.length > 0 ? (sceneCompleted / shots.length) * 100 : 0;

          return (
            <Card key={scene.id} sx={{ mb: 1 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {/* Scene Header */}
                <Stack 
                  direction="row" 
                  spacing={2} 
                  alignItems="center" 
                  sx={{ cursor: 'pointer' }}
                  onClick={() => toggleSceneExpand(scene.id)}
                >
                  <IconButton size="small" aria-label={isExpanded ? 'Skjul scene' : 'Utvid scene'}>
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Scene {scene.sceneNumber}: {scene.locationName}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={scene.intExt} size="small" />
                      <Chip label={scene.timeOfDay} size="small" />
                      <Typography variant="caption" color="text.secondary">
                        {shots.length} shots
                      </Typography>
                    </Stack>
                  </Box>
                  <Box sx={{ width: 150 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={sceneProgress}
                      sx={{ height: 6, borderRadius: 1 }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
                      {sceneCompleted}/{shots.length} ({sceneProgress.toFixed(0)}%)
                    </Typography>
                  </Box>
                </Stack>

                {/* Shots List */}
                <Collapse in={isExpanded}>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={1}>
                    {shots.map((shot: TrackedShot) => {
                      const shotProgress = getShotProgress(scene.id, shot.id);
                      const isActive = activeTimer === `${scene.id}-${shot.id}`;

                      return (
                        <Grid key={shot.id} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Paper 
                            variant="outlined" 
                            sx={{ 
                              p: 1.5,
                              border: isActive ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                              bgcolor: isActive ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 1 }}>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {shot.shotNumber || shot.id}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {shot.shotType} • {shot.cameraAngle}
                                </Typography>
                              </Box>
                              <Chip 
                                label={getStatusLabel(shotProgress.status)}
                                size="small"
                                sx={{ 
                                  bgcolor: getStatusColor(shotProgress.status),
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.65rem',
                                }}
                              />
                            </Stack>

                            {/* Takes info */}
                            {shotProgress.takes.length > 0 && (
                              <Box sx={{ mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Takes: {shotProgress.takes.length}
                                </Typography>
                                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                                  {shotProgress.takes.slice(-5).map(take => (
                                    <Tooltip key={take.id} title={`Take ${take.takeNumber}: ${take.status}`}>
                                      <Box 
                                        sx={{ 
                                          width: 16, 
                                          height: 16, 
                                          borderRadius: '50%',
                                          bgcolor: getTakeStatusColor(take.status),
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '9px',
                                          color: '#fff',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {take.takeNumber}
                                      </Box>
                                    </Tooltip>
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {/* Action Buttons */}
                            <Stack direction="row" spacing={0.5}>
                              {shotProgress.status === 'not_started' && (
                                <Button 
                                  size="small" 
                                  variant="contained"
                                  startIcon={<PlayIcon />}
                                  onClick={() => startShot(scene.id, shot.id)}
                                  sx={{ flex: 1, fontSize: '0.7rem' }}
                                >
                                  Start
                                </Button>
                              )}
                              {shotProgress.status === 'in_progress' && (
                                <>
                                  <Button 
                                    size="small" 
                                    variant="outlined"
                                    onClick={() => {
                                      setSelectedShot(`${scene.id}-${shot.id}`);
                                      setShowTakeDialog(true);
                                    }}
                                    sx={{ flex: 1, fontSize: '0.7rem' }}
                                  >
                                    Take
                                  </Button>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => markShotComplete(scene.id, shot.id)}
                                    aria-label="Marker som fullført"
                                  >
                                    <CheckCircleIcon />
                                  </IconButton>
                                </>
                              )}
                              {shotProgress.status === 'completed' && (
                                <>
                                  <Button 
                                    size="small" 
                                    variant="contained"
                                    color="success"
                                    onClick={() => markShotApproved(scene.id, shot.id)}
                                    sx={{ flex: 1, fontSize: '0.7rem' }}
                                  >
                                    Godkjenn
                                  </Button>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => markRetakeNeeded(scene.id, shot.id)}
                                    aria-label="Marker for ny take"
                                  >
                                    <RetakeIcon />
                                  </IconButton>
                                </>
                              )}
                              {shotProgress.status === 'retake_needed' && (
                                <Button 
                                  size="small" 
                                  variant="contained"
                                  color="warning"
                                  startIcon={<RetakeIcon />}
                                  onClick={() => startShot(scene.id, shot.id)}
                                  sx={{ flex: 1, fontSize: '0.7rem' }}
                                >
                                  Ta om
                                </Button>
                              )}
                              {shotProgress.status === 'approved' && (
                                <Chip 
                                  icon={<StarIcon />} 
                                  label="Godkjent" 
                                  color="success" 
                                  size="small"
                                  sx={{ width: '100%' }}
                                />
                              )}
                            </Stack>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Collapse>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* Take Dialog */}
      <Dialog open={showTakeDialog} onClose={() => setShowTakeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Logg Take</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h2" sx={{ fontFamily: 'monospace' }}>
                {formatTime(elapsedTime)}
              </Typography>
            </Box>
            
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newTakeStatus}
                onChange={(e) => setNewTakeStatus(e.target.value as 'good' | 'ng' | 'print' | 'hold')}
                label="Status"
              >
                <MenuItem value="print">🎬 PRINT (Perfekt)</MenuItem>
                <MenuItem value="good">✅ GOOD (Brukbar)</MenuItem>
                <MenuItem value="hold">⏸️ HOLD (Vurder)</MenuItem>
                <MenuItem value="ng">❌ NG (No Good)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Notater"
              multiline
              rows={3}
              value={newTakeNotes}
              onChange={(e) => setNewTakeNotes(e.target.value)}
              placeholder="Tekniske notater, skuespiller-performance, etc."
            />
            <GlobalMentionHelper
              text={newTakeNotes}
              localCandidates={[
                ...new Set(
                  scenes
                    .map((scene) => `Scene ${scene.sceneNumber}`)
                    .filter((value) => value.trim().length >= 2),
                ),
              ]}
              onApplySuggestion={(name) => setNewTakeNotes((prev) => applyMentionSuggestion(prev, name))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTakeDialog(false)}>Avbryt</Button>
          <Button 
            onClick={() => {
              if (selectedShot) {
                const [sceneId, shotId] = selectedShot.split('-');
                addTake(sceneId, shotId);
              }
            }} 
            variant="contained"
          >
            Logg Take
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShotProgressTracker;
