import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Stack,
  Card,
  CardContent,
  Grid,
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Badge,
  Rating,
} from '@mui/material';
import {
  Assignment as ScriptIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Schedule as TimeIcon,
  Videocam as CameraIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Flag as FlagIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Note as NoteIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
  Replay as RetakeIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { SceneBreakdown, CastingShot } from '../models/casting';

interface TakeLog {
  id: string;
  sceneId: string;
  sceneNumber: string;
  shotId?: string;
  shotNumber?: string;
  takeNumber: number;
  slateNumber: string;
  timecodeIn: string;
  timecodeOut: string;
  duration: string;
  status: 'print' | 'good' | 'hold' | 'ng' | 'false_start';
  rating: number;
  circled: boolean;
  continuityNotes: string;
  performanceNotes: string;
  technicalNotes: string;
  soundNotes: string;
  directorComment?: string;
  timestamp: string;
}

interface SceneTiming {
  sceneId: string;
  sceneNumber: string;
  plannedTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  totalTakes: number;
  printTakes: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
}

interface ScriptSupervisorNotesProps {
  scenes: SceneBreakdown[];
  onLogUpdate?: (log: TakeLog) => void;
}

export const ScriptSupervisorNotes: React.FC<ScriptSupervisorNotesProps> = ({
  scenes,
  onLogUpdate,
}) => {
  const [takeLogs, setTakeLogs] = useState<TakeLog[]>([
    // Demo data
    {
      id: '1',
      sceneId: 'scene-1',
      sceneNumber: '1',
      shotId: 'shot-1a',
      shotNumber: '1A',
      takeNumber: 1,
      slateNumber: '1A-1',
      timecodeIn: '10:15:32:12',
      timecodeOut: '10:16:45:08',
      duration: '01:12:20',
      status: 'ng',
      rating: 2,
      circled: false,
      continuityNotes: '',
      performanceNotes: 'Skuespiller glemte replikk',
      technicalNotes: '',
      soundNotes: 'OK',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      sceneId: 'scene-1',
      sceneNumber: '1',
      shotId: 'shot-1a',
      shotNumber: '1A',
      takeNumber: 2,
      slateNumber: '1A-2',
      timecodeIn: '10:18:02:00',
      timecodeOut: '10:19:18:15',
      duration: '01:16:15',
      status: 'good',
      rating: 4,
      circled: false,
      continuityNotes: 'Hånden på bordet',
      performanceNotes: 'God energi',
      technicalNotes: 'Litt soft fokus på slutten',
      soundNotes: 'Bakgrunnsstøy 00:45',
      timestamp: new Date().toISOString(),
    },
    {
      id: '3',
      sceneId: 'scene-1',
      sceneNumber: '1',
      shotId: 'shot-1a',
      shotNumber: '1A',
      takeNumber: 3,
      slateNumber: '1A-3',
      timecodeIn: '10:22:10:00',
      timecodeOut: '10:23:25:18',
      duration: '01:15:18',
      status: 'print',
      rating: 5,
      circled: true,
      continuityNotes: 'Hånden på bordet - konsistent med T2',
      performanceNotes: 'Perfekt! Regissør fornøyd',
      technicalNotes: 'Skarp fokus hele veien',
      soundNotes: 'Clean',
      directorComment: 'Moving on!',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [sceneTimings, setSceneTimings] = useState<Map<string, SceneTiming>>(new Map());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedScene, setSelectedScene] = useState<string>('all');
  const [activeRecording, setActiveRecording] = useState<{ sceneId: string; shotId?: string } | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [newLog, setNewLog] = useState<Partial<TakeLog>>({
    sceneNumber: '',
    shotNumber: '',
    takeNumber: 1,
    slateNumber: '',
    status: 'good',
    rating: 3,
    circled: false,
    continuityNotes: '',
    performanceNotes: '',
    technicalNotes: '',
    soundNotes: '',
  });

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeRecording) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - recordingStartTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [activeRecording, recordingStartTime]);

  const formatTimecode = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.floor((ms % 1000) / 41.67); // 24fps
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.floor((ms % 1000) / 41.67);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const getStatusConfig = (status: TakeLog['status']) => {
    const configs = {
      print: { label: 'PRINT', color: '#8b5cf6', icon: <StarIcon /> },
      good: { label: 'GOOD', color: '#10b981', icon: <CheckIcon /> },
      hold: { label: 'HOLD', color: '#f59e0b', icon: <FlagIcon /> },
      ng: { label: 'NG', color: '#ef4444', icon: <ErrorIcon /> },
      false_start: { label: 'FALSE START', color: '#6b7280', icon: <StopIcon /> },
    };
    return configs[status];
  };

  const startRecording = (sceneId: string, shotId?: string) => {
    setActiveRecording({ sceneId, shotId });
    setRecordingStartTime(Date.now());
    setElapsedTime(0);
  };

  const stopRecording = () => {
    if (!activeRecording) return;

    const scene = scenes.find(s => s.id === activeRecording.sceneId);
    const existingLogs = takeLogs.filter(
      l => l.sceneId === activeRecording.sceneId && l.shotId === activeRecording.shotId
    );
    const takeNumber = existingLogs.length + 1;

    setNewLog({
      sceneId: activeRecording.sceneId,
      sceneNumber: scene?.sceneNumber || '',
      shotId: activeRecording.shotId,
      takeNumber,
      slateNumber: `${scene?.sceneNumber || '?'}${activeRecording.shotId ? `-${takeNumber}` : `-${takeNumber}`}`,
      timecodeIn: formatTimecode(recordingStartTime),
      timecodeOut: formatTimecode(Date.now()),
      duration: formatDuration(elapsedTime),
      status: 'good',
      rating: 3,
    });

    setActiveRecording(null);
    setShowAddDialog(true);
  };

  const handleSaveLog = () => {
    const log: TakeLog = {
      id: `log-${Date.now()}`,
      sceneId: newLog.sceneId || '',
      sceneNumber: newLog.sceneNumber || '',
      shotId: newLog.shotId,
      shotNumber: newLog.shotNumber,
      takeNumber: newLog.takeNumber || 1,
      slateNumber: newLog.slateNumber || '',
      timecodeIn: newLog.timecodeIn || '',
      timecodeOut: newLog.timecodeOut || '',
      duration: newLog.duration || '',
      status: newLog.status as TakeLog['status'],
      rating: newLog.rating || 3,
      circled: newLog.circled || false,
      continuityNotes: newLog.continuityNotes || '',
      performanceNotes: newLog.performanceNotes || '',
      technicalNotes: newLog.technicalNotes || '',
      soundNotes: newLog.soundNotes || '',
      directorComment: newLog.directorComment,
      timestamp: new Date().toISOString(),
    };

    setTakeLogs(prev => [log, ...prev]);
    if (onLogUpdate) onLogUpdate(log);

    setShowAddDialog(false);
    setNewLog({
      takeNumber: 1,
      status: 'good',
      rating: 3,
      circled: false,
    });
  };

  const deleteLog = (logId: string) => {
    setTakeLogs(prev => prev.filter(l => l.id !== logId));
  };

  const toggleCircled = (logId: string) => {
    setTakeLogs(prev => prev.map(l => 
      l.id === logId ? { ...l, circled: !l.circled } : l
    ));
  };

  const filteredLogs = selectedScene === 'all' 
    ? takeLogs 
    : takeLogs.filter(l => l.sceneId === selectedScene);

  // Group logs by scene and shot
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const key = `${log.sceneNumber}-${log.shotNumber || 'master'}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, TakeLog[]>);

  // Stats
  const totalTakes = takeLogs.length;
  const printTakes = takeLogs.filter(l => l.status === 'print' || l.circled).length;
  const ngTakes = takeLogs.filter(l => l.status === 'ng' || l.status === 'false_start').length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScriptIcon color="primary" />
            Script Supervisor Notes
          </Typography>
          <Stack direction="row" spacing={1}>
            {!activeRecording ? (
              <Button
                variant="contained"
                color="error"
                startIcon={<PlayIcon />}
                onClick={() => {
                  const firstScene = scenes[0];
                  if (firstScene) startRecording(firstScene.id);
                }}
              >
                Start Recording
              </Button>
            ) : (
              <Button
                variant="contained"
                color="warning"
                startIcon={<StopIcon />}
                onClick={stopRecording}
              >
                Stop ({formatDuration(elapsedTime)})
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
            >
              Manuell Logg
            </Button>
          </Stack>
        </Stack>

        {/* Scene Filter */}
        <FormControl size="small" sx={{ mt: 2, minWidth: 200 }}>
          <InputLabel>Scene</InputLabel>
          <Select
            value={selectedScene}
            onChange={(e) => setSelectedScene(e.target.value)}
            label="Scene"
          >
            <MenuItem value="all">Alle scener</MenuItem>
            {scenes.map(scene => (
              <MenuItem key={scene.id} value={scene.id}>
                Scene {scene.sceneNumber}: {scene.locationName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Active Recording Indicator */}
      {activeRecording && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(239, 68, 68, 0.1)', border: '2px solid #ef4444' }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
            <Box sx={{ 
              width: 16, 
              height: 16, 
              borderRadius: '50%', 
              bgcolor: '#ef4444',
              animation: 'pulse 1s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }} />
            <Typography variant="h4" sx={{ fontFamily: 'monospace', color: '#ef4444' }}>
              REC {formatTimecode(elapsedTime)}
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 4 }}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h3">{totalTakes}</Typography>
            <Typography variant="caption" color="text.secondary">Totale Takes</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(139, 92, 246, 0.1)' }}>
            <Typography variant="h3" sx={{ color: '#8b5cf6' }}>{printTakes}</Typography>
            <Typography variant="caption" color="text.secondary">Print Takes</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(239, 68, 68, 0.1)' }}>
            <Typography variant="h3" sx={{ color: '#ef4444' }}>{ngTakes}</Typography>
            <Typography variant="caption" color="text.secondary">NG Takes</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Take Logs Table */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {Object.entries(groupedLogs).map(([key, logs]) => (
          <Card key={key} sx={{ mb: 2 }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Scene {key}
                <Chip label={`${logs.length} takes`} size="small" sx={{ ml: 1 }} />
                <Chip 
                  label={`${logs.filter(l => l.circled || l.status === 'print').length} print`} 
                  size="small" 
                  color="secondary"
                  sx={{ ml: 0.5 }} 
                />
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={60}>Take</TableCell>
                      <TableCell width={100}>Slate</TableCell>
                      <TableCell width={80}>Status</TableCell>
                      <TableCell width={80}>Rating</TableCell>
                      <TableCell>Timecode</TableCell>
                      <TableCell width={80}>Lengde</TableCell>
                      <TableCell>Notater</TableCell>
                      <TableCell width={80}>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.sort((a, b) => a.takeNumber - b.takeNumber).map(log => {
                      const statusConfig = getStatusConfig(log.status);
                      
                      return (
                        <TableRow 
                          key={log.id}
                          sx={{ 
                            bgcolor: log.circled ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          <TableCell>
                            <Badge 
                              badgeContent={log.circled ? '⭕' : null}
                              sx={{ '& .MuiBadge-badge': { bgcolor: 'transparent' } }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                T{log.takeNumber}
                              </Typography>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {log.slateNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              icon={statusConfig.icon}
                              label={statusConfig.label}
                              size="small"
                              sx={{ 
                                bgcolor: statusConfig.color,
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '0.65rem',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Rating value={log.rating} size="small" readOnly />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {log.timecodeIn} → {log.timecodeOut}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {log.duration}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              {log.performanceNotes && (
                                <Typography variant="caption" sx={{ display: 'block' }}>
                                  🎭 {log.performanceNotes}
                                </Typography>
                              )}
                              {log.technicalNotes && (
                                <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                                  📷 {log.technicalNotes}
                                </Typography>
                              )}
                              {log.continuityNotes && (
                                <Typography variant="caption" sx={{ display: 'block', color: 'info.main' }}>
                                  📋 {log.continuityNotes}
                                </Typography>
                              )}
                              {log.directorComment && (
                                <Typography variant="caption" sx={{ display: 'block', color: 'secondary.main', fontWeight: 600 }}>
                                  🎬 {log.directorComment}
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title={log.circled ? 'Fjern sirkel' : 'Sirkel take'}>
                                <IconButton 
                                  size="small" 
                                  onClick={() => toggleCircled(log.id)}
                                  color={log.circled ? 'secondary' : 'default'}
                                >
                                  <StarIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => deleteLog(log.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ))}

        {filteredLogs.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <ScriptIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Ingen take-logger ennå
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Start recording for å logge takes automatisk
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Add Log Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Logg Take</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Scene #"
                fullWidth
                value={newLog.sceneNumber || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, sceneNumber: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Shot #"
                fullWidth
                value={newLog.shotNumber || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, shotNumber: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField
                label="Take #"
                type="number"
                fullWidth
                value={newLog.takeNumber || 1}
                onChange={(e) => setNewLog(prev => ({ ...prev, takeNumber: parseInt(e.target.value) }))}
              />
            </Grid>

            <Grid size={{ xs: 6 }}>
              <TextField
                label="Slate #"
                fullWidth
                value={newLog.slateNumber || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, slateNumber: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newLog.status || 'good'}
                  onChange={(e) => setNewLog(prev => ({ ...prev, status: e.target.value as TakeLog['status'] }))}
                  label="Status"
                >
                  <MenuItem value="print">🌟 PRINT</MenuItem>
                  <MenuItem value="good">✅ GOOD</MenuItem>
                  <MenuItem value="hold">⏸️ HOLD</MenuItem>
                  <MenuItem value="ng">❌ NG</MenuItem>
                  <MenuItem value="false_start">⏹️ FALSE START</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 6 }}>
              <TextField
                label="Timecode In"
                fullWidth
                value={newLog.timecodeIn || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, timecodeIn: e.target.value }))}
                placeholder="00:00:00:00"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Timecode Out"
                fullWidth
                value={newLog.timecodeOut || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, timecodeOut: e.target.value }))}
                placeholder="00:00:00:00"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle2">Rating</Typography>
              <Rating
                value={newLog.rating || 3}
                onChange={(_, value) => setNewLog(prev => ({ ...prev, rating: value || 3 }))}
                size="large"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Performance Notes"
                fullWidth
                multiline
                rows={2}
                value={newLog.performanceNotes || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, performanceNotes: e.target.value }))}
                placeholder="Skuespillerprestasjoner, energi, timing..."
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Technical Notes"
                fullWidth
                multiline
                rows={2}
                value={newLog.technicalNotes || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, technicalNotes: e.target.value }))}
                placeholder="Fokus, eksponering, kamerabevegelse..."
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Continuity Notes"
                fullWidth
                multiline
                rows={2}
                value={newLog.continuityNotes || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, continuityNotes: e.target.value }))}
                placeholder="Posisjoner, rekvisitter, kostyme..."
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                label="Director Comment"
                fullWidth
                value={newLog.directorComment || ''}
                onChange={(e) => setNewLog(prev => ({ ...prev, directorComment: e.target.value }))}
                placeholder="Regissørens kommentar"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Avbryt</Button>
          <Button onClick={handleSaveLog} variant="contained">
            Lagre Take
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScriptSupervisorNotes;
