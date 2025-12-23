/**
 * AnimationStudioPanel - Complete animation workspace
 * 
 * Features:
 * - Multi-tab interface (Timeline, Keyframes, Curves, Templates, Recording)
 * - Motion path controls
 * - Layer management
 * - Real-time preview
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Button,
  Divider,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Alert,
  Slider,
  Grid,
  Card,
  CardContent,
  CardActions,
  Badge,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipPrevious,
  SkipNext,
  FiberManualRecord,
  Timeline,
  ShowChart,
  Layers,
  Movie,
  Settings,
  Add,
  Delete,
  ContentCopy,
  Save,
  Upload,
  Download,
  Search,
  Visibility,
  VisibilityOff,
  ExpandMore,
  CameraAlt,
  Light,
  Videocam,
  Animation,
  Route,
  Speed,
  FilterList,
  Info,
  VideoFile,
  Queue,
} from '@mui/icons-material';
import { KeyframeEditor } from './KeyframeEditor';
import { KeyframeTimeline } from './KeyframeTimeline';
import { AnimationLayersPanel } from './AnimationLayersPanel';
import { CurveEditorCanvas, BezierCurve, CURVE_PRESETS } from '../components/CurveEditorCanvas';
import {
  animationRecorder,
  RecordingConfig,
  RecordingState,
  DEFAULT_RECORDING_CONFIG,
} from '../../core/animation/AnimationRecorder';
import {
  animationTemplateService,
  AnimationTemplate,
  TemplateCategory,
  ANIMATION_TEMPLATES,
} from '../../core/animation/AnimationTemplates';
import {
  sceneAnimationService,
  AnimationTrack,
  AnimationClip,
} from '../../core/animation/SceneGraphAnimationEngine';
import { VideoExportPanel } from './VideoExportPanel';
import { ExportSchedulerPanel } from './ExportSchedulerPanel';
import { videoExportService, ExportResult } from '../../core/animation/VideoExportService';

// ============================================================================
// Types
// ============================================================================

interface AnimationStudioPanelProps {
  tracks: AnimationTrack[];
  clips: AnimationClip[];
  currentTime: number;
  isPlaying: boolean;
  selectedNodeId?: string | null;
  nodes?: Array<{ id: string; type: string; name?: string }>;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onAddTrack: (track: AnimationTrack) => void;
  onDeleteTrack: (trackId: string) => void;
  onUpdateKeyframe: (trackId: string, index: number, keyframe: any) => void;
  onAddKeyframe: (trackId: string, keyframe: any) => void;
  onDeleteKeyframes: (trackId: string, indices: number[]) => void;
  onApplyTemplate: (clips: AnimationClip[]) => void;
  onRecordingStop?: (clip: AnimationClip) => void;
  showMotionPaths?: boolean;
  onToggleMotionPaths?: () => void;
  onExportStart?: () => void;
  onExportComplete?: (result: ExportResult) => void;
  onFrameRender?: (time: number, frameIndex: number) => void;
  // Google Drive integration
  userId?: string;
  projectId?: string;
  projectName?: string;
  onDriveUploadComplete?: (result: { fileId: string; webViewLink: string }) => void;
}

// ============================================================================
// Recording Controls Component
// ============================================================================

interface RecordingControlsProps {
  selectedNodeId?: string | null;
  nodes?: Array<{ id: string; type: string; name?: string }>;
  onRecordingStop?: (clip: AnimationClip) => void;
}

function RecordingControls({
  selectedNodeId,
  nodes = [],
  onRecordingStop,
}: RecordingControlsProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    currentTime: 0,
    activeSessions: [],
    samplesRecorded: 0,
  });
  const [config, setConfig] = useState<RecordingConfig>(DEFAULT_RECORDING_CONFIG);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recordNodeId, setRecordNodeId] = useState<string>(selectedNodeId || '');

  // Subscribe to recorder state
  useEffect(() => {
    const unsubscribe = animationRecorder.subscribe(setRecordingState);
    return unsubscribe;
  }, []);

  // Update selected node
  useEffect(() => {
    if (selectedNodeId) {
      setRecordNodeId(selectedNodeId);
    }
  }, [selectedNodeId]);

  const handleStartRecording = useCallback(() => {
    if (!recordNodeId) return;
    const session = animationRecorder.startRecording(recordNodeId, config);
    setSessionId(session.id);
  }, [recordNodeId, config]);

  const handleStopRecording = useCallback(() => {
    if (!sessionId) return;
    const session = animationRecorder.stopRecording(sessionId);
    if (session) {
      const clip = animationRecorder.sessionToClip(session);
      onRecordingStop?.(clip);
    }
    setSessionId(null);
  }, [sessionId, onRecordingStop]);

  const handlePauseResume = useCallback(() => {
    if (!sessionId) return;
    if (recordingState.isPaused) {
      animationRecorder.resumeRecording(sessionId);
    } else {
      animationRecorder.pauseRecording(sessionId);
    }
  }, [sessionId, recordingState.isPaused]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FiberManualRecord sx={{ color: recordingState.isRecording ? '#f44336' : '#666' }} />
        Animation Recording
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Record object movements in real-time to create animation clips.
      </Alert>

      {/* Node selector */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Record Node</InputLabel>
        <Select
          value={recordNodeId}
          label="Record Node"
          onChange={(e) => setRecordNodeId(e.target.value)}
          disabled={recordingState.isRecording}
        >
          {nodes.map((node) => (
            <MenuItem key={node.id} value={node.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {node.type === 'camera' ? <CameraAlt fontSize="small" /> : <Light fontSize="small" />}
                {node.name || node.id}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Recording options */}
      <Accordion defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">Recording Options</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.recordPosition}
                  onChange={(e) => setConfig({ ...config, recordPosition: e.target.checked })}
                  disabled={recordingState.isRecording}
                />
              }
              label="Position"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.recordRotation}
                  onChange={(e) => setConfig({ ...config, recordRotation: e.target.checked })}
                  disabled={recordingState.isRecording}
                />
              }
              label="Rotation"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.recordScale}
                  onChange={(e) => setConfig({ ...config, recordScale: e.target.checked })}
                  disabled={recordingState.isRecording}
                />
              }
              label="Scale"
            />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Sample Rate: {config.sampleRate} fps
              </Typography>
              <Slider
                value={config.sampleRate}
                onChange={(_, v) => setConfig({ ...config, sampleRate: v as number })}
                min={10}
                max={60}
                step={5}
                disabled={recordingState.isRecording}
              />
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={config.simplifyKeyframes}
                  onChange={(e) => setConfig({ ...config, simplifyKeyframes: e.target.checked })}
                  disabled={recordingState.isRecording}
                />
              }
              label="Simplify Keyframes"
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Recording controls */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
        {!recordingState.isRecording ? (
          <Button
            variant="contained"
            color="error"
            startIcon={<FiberManualRecord />}
            onClick={handleStartRecording}
            disabled={!recordNodeId}
          >
            Start Recording
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={recordingState.isPaused ? <PlayArrow /> : <Pause />}
              onClick={handlePauseResume}
            >
              {recordingState.isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<Stop />}
              onClick={handleStopRecording}
            >
              Stop
            </Button>
          </>
        )}
      </Box>

      {/* Recording status */}
      {recordingState.isRecording && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <FiberManualRecord
              sx={{
                color: '#f44336',
                animation: recordingState.isPaused ? 'none' : 'pulse 1s infinite', '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 },
                }}}
            />
            <Typography variant="h6" fontFamily="monospace">
              {recordingState.currentTime.toFixed(1)}s
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {recordingState.samplesRecorded} samples recorded
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Templates Gallery Component
// ============================================================================

interface TemplatesGalleryProps {
  nodes?: Array<{ id: string; type: string; name?: string }>;
  onApplyTemplate: (clips: AnimationClip[]) => void;
}

function TemplatesGallery({ nodes = [], onApplyTemplate }: TemplatesGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<AnimationTemplate | null>(null);
  const [nodeMapping, setNodeMapping] = useState<Record<string, string>>({});
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let templates = animationTemplateService.getAllTemplates();

    if (categoryFilter !== 'all') {
      templates = templates.filter((t) => t.category === categoryFilter);
    }

    if (searchQuery) {
      templates = animationTemplateService.searchTemplates(searchQuery);
    }

    return templates;
  }, [searchQuery, categoryFilter]);

  // Get category icon
  const getCategoryIcon = (category: TemplateCategory) => {
    switch (category) {
      case 'cinematic':
        return <Movie />;
      case 'commercial':
        return <Videocam />;
      case 'interview':
        return <CameraAlt />;
      case 'product':
        return <Light />;
      case 'portrait':
        return <CameraAlt />;
      case 'action':
        return <Speed />;
      case 'dramatic':
        return <Movie />;
      case 'ambient':
        return <Light />;
      default:
        return <Animation />;
    }
  };

  // Handle template selection
  const handleSelectTemplate = useCallback((template: AnimationTemplate) => {
    setSelectedTemplate(template);
    // Initialize node mapping
    const mapping: Record<string, string> = {};
    template.requiredNodes.forEach((rn) => {
      // Try to auto-match
      const matchingNode = nodes.find(
        (n) => n.type === rn.type || n.name?.toLowerCase().includes(rn.role.toLowerCase())
      );
      if (matchingNode) {
        mapping[rn.role] = matchingNode.id;
      }
    });
    setNodeMapping(mapping);
    setApplyDialogOpen(true);
  }, [nodes]);

  // Apply template
  const handleApplyTemplate = useCallback(() => {
    if (!selectedTemplate) return;

    const clips = animationTemplateService.applyTemplate(selectedTemplate.id, nodeMapping);
    if (clips) {
      onApplyTemplate(clips);
    }
    setApplyDialogOpen(false);
  }, [selectedTemplate, nodeMapping, onApplyTemplate]);

  const categories: TemplateCategory[] = [
    'cinematic','commercial','interview','product','portrait','action','dramatic','ambient'
  ];

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Movie />
        Animation Templates
      </Typography>

      {/* Search and filter */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            displayEmpty
          >
            <MenuItem value="all">All Categories</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat} sx={{ textTransform: 'capitalize' }}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Templates grid */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Grid container spacing={1}>
          {filteredTemplates.map((template) => (
            <Grid item xs={12} sm={6} key={template.id}>
              <Card
                sx={{
                  cursor: 'pointer','&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' }}}
                onClick={() => handleSelectTemplate(template)}
              >
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        backgroundColor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'}}
                    >
                      {getCategoryIcon(template.category)}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {template.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {template.totalDuration}s • {template.steps.length} steps
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: 11 }}>
                    {template.description}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {template.tags.slice(0, 3).map((tag) => (
                      <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: 9 }} />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Apply template dialog */}
      <Dialog open={applyDialogOpen} onClose={() => setApplyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Apply Template: {selectedTemplate?.name}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Map your scene objects to the template roles
          </Alert>

          {selectedTemplate?.requiredNodes.map((rn) => (
            <Box key={rn.role} sx={{ mb: 2 }}>
              <Typography variant="subtitle2">
                {rn.role}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({rn.type})
                </Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                {rn.description}
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={nodeMapping[rn.role] || ', '}
                  onChange={(e) => setNodeMapping({ ...nodeMapping, [rn.role]: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Not mapped</em>
                  </MenuItem>
                  {nodes
                    .filter((n) => n.type === rn.type)
                    .map((node) => (
                      <MenuItem key={node.id} value={node.id}>
                        {node.name || node.id}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Box>
          ))}

          <Box sx={{ mt: 2, p: 1, backgroundColor: '#1a1a2a', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Duration: {selectedTemplate?.totalDuration}s • Steps: {selectedTemplate?.steps.length}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApplyTemplate}
            disabled={
              !selectedTemplate ||
              selectedTemplate.requiredNodes.some((rn) => !nodeMapping[rn.role])
            }
          >
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ============================================================================
// Motion Path Settings Component
// ============================================================================

interface MotionPathSettingsProps {
  visible: boolean;
  onToggle: () => void;
  config: {
    showPath: boolean;
    showKeyframes: boolean;
    showArrows: boolean;
    showSpeed: boolean;
  };
  onConfigChange: (config: any) => void;
}

function MotionPathSettings({ visible, onToggle, config, onConfigChange }: MotionPathSettingsProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Route />
        Motion Paths
      </Typography>

      <FormControlLabel
        control={<Switch checked={visible} onChange={onToggle} />}
        label="Show Motion Paths"
      />

      {visible && (
        <Box sx={{ mt: 2, pl: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={config.showPath}
                onChange={(e) => onConfigChange({ ...config, showPath: e.target.checked })}
              />
            }
            label="Show Path Line"
          />
          <FormControlLabel
            control={
              <Switch
                checked={config.showKeyframes}
                onChange={(e) => onConfigChange({ ...config, showKeyframes: e.target.checked })}
              />
            }
            label="Show Keyframe Markers"
          />
          <FormControlLabel
            control={
              <Switch
                checked={config.showArrows}
                onChange={(e) => onConfigChange({ ...config, showArrows: e.target.checked })}
              />
            }
            label="Show Direction Arrows"
          />
          <FormControlLabel
            control={
              <Switch
                checked={config.showSpeed}
                onChange={(e) => onConfigChange({ ...config, showSpeed: e.target.checked })}
              />
            }
            label="Show Speed Gradient"
          />
        </Box>
      )}
    </Box>
  );
}

// ============================================================================
// Main Animation Studio Panel
// ============================================================================

export function AnimationStudioPanel({
  tracks,
  clips,
  currentTime,
  isPlaying,
  selectedNodeId,
  nodes = [],
  onPlay,
  onPause,
  onStop,
  onSeek,
  onAddTrack,
  onDeleteTrack,
  onUpdateKeyframe,
  onAddKeyframe,
  onDeleteKeyframes,
  onApplyTemplate,
  onRecordingStop,
  showMotionPaths = false,
  onToggleMotionPaths,
  onExportStart,
  onExportComplete,
  onFrameRender,
  userId,
  projectId,
  projectName,
  onDriveUploadComplete,
}: AnimationStudioPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [motionPathConfig, setMotionPathConfig] = useState({
    showPath: true,
    showKeyframes: true,
    showArrows: true,
    showSpeed: true,
  });

  // Calculate animation duration from tracks
  const animationDuration = useMemo(() => {
    let maxTime = 0;
    for (const track of tracks) {
      for (const kf of track.keyframes) {
        if (kf.time > maxTime) maxTime = kf.time;
      }
    }
    // Add a small buffer, minimum 5 seconds for export
    return Math.max(5, maxTime + 0.5);
  }, [tracks]);

  // Get selected track
  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId) || null,
    [tracks, selectedTrackId]
  );

  // Tab labels
  const tabLabels = [
    { icon: <Timeline />, label: 'Timeline' },
    { icon: <ShowChart />, label: 'Keyframes' },
    { icon: <Layers />, label: 'Layers' },
    { icon: <ShowChart />, label: 'Curves' },
    { icon: <Movie />, label: 'Templates' },
    { icon: <FiberManualRecord />, label: 'Record' },
    { icon: <Route />, label: 'Paths' },
    { icon: <VideoFile />, label: 'Export' },
    { icon: <Queue />, label: 'Queue' },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header with playback controls */}
      <Box sx={{ p: 1, borderBottom: '1px solid #333', backgroundColor: '#1a1a2a' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={onStop}>
            <SkipPrevious />
          </IconButton>
          <IconButton
            size="small"
            onClick={isPlaying ? onPause : onPlay}
            color={isPlaying ? 'primary' : 'default'}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton size="small" onClick={onStop}>
            <Stop />
          </IconButton>

          <Box sx={{ flex: 1, px: 2 }}>
            <Typography variant="caption" fontFamily="monospace" color="text.secondary">
              {currentTime.toFixed(2)}s
            </Typography>
          </Box>

          <Chip
            label={`${tracks.length} tracks`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`${clips.length} clips`}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        {tabLabels.map((tab, index) => (
          <Tab
            key={index}
            icon={tab.icon}
            iconPosition="start"
            label={tab.label}
            sx={{ minHeight: 40, py: 0, fontSize: 12 }}
          />
        ))}
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {/* Timeline */}
        {activeTab === 0 && (
          <KeyframeTimeline
            tracks={tracks}
            currentTime={currentTime}
            selectedTrackId={selectedTrackId}
            onSelectTrack={setSelectedTrackId}
            onSeek={onSeek}
            onKeyframeUpdate={(trackId, index, keyframe) =>
              onUpdateKeyframe(trackId, index, keyframe)
            }
            onAddKeyframe={(trackId, keyframe) => onAddKeyframe(trackId, keyframe)}
            duration={Math.max(10, ...tracks.flatMap((t) => t.keyframes.map((k) => k.time))) + 2}
          />
        )}

        {/* Keyframe Editor */}
        {activeTab === 1 && (
          <Box sx={{ height: '100%', display: 'flex' }}>
            {/* Track list */}
            <Box sx={{ width: 200, borderRight: '1px solid #333', overflow: 'auto' }}>
              <List dense>
                {tracks.map((track) => (
                  <ListItemButton
                    key={track.id}
                    selected={selectedTrackId === track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    <ListItemText
                      primary={track.type}
                      secondary={`${track.keyframes.length} keyframes`}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
            {/* Keyframe editor */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <KeyframeEditor
                track={selectedTrack}
                currentTime={currentTime}
                onSeek={onSeek}
                onUpdateKeyframe={(index, kf) =>
                  selectedTrackId && onUpdateKeyframe(selectedTrackId, index, kf)
                }
                onAddKeyframe={(kf) => selectedTrackId && onAddKeyframe(selectedTrackId, kf)}
                onDeleteKeyframes={(indices) =>
                  selectedTrackId && onDeleteKeyframes(selectedTrackId, indices)
                }
              />
            </Box>
          </Box>
        )}

        {/* Layers */}
        {activeTab === 2 && (
          <AnimationLayersPanel
            clips={clips.map((c) => ({ id: c.id, name: c.name }))}
          />
        )}

        {/* Curves */}
        {activeTab === 3 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Curve Editor
            </Typography>
            <CurveEditorCanvas
              curve={CURVE_PRESETS.easeInOut}
              onChange={() => {}}
              width={350}
              height={350}
              showPreview
              previewValue={currentTime % 1}
            />
          </Box>
        )}

        {/* Templates */}
        {activeTab === 4 && (
          <TemplatesGallery nodes={nodes} onApplyTemplate={onApplyTemplate} />
        )}

        {/* Recording */}
        {activeTab === 5 && (
          <RecordingControls
            selectedNodeId={selectedNodeId}
            nodes={nodes}
            onRecordingStop={onRecordingStop}
          />
        )}

        {/* Motion Paths */}
        {activeTab === 6 && (
          <MotionPathSettings
            visible={showMotionPaths}
            onToggle={onToggleMotionPaths || (() => {})}
            config={motionPathConfig}
            onConfigChange={setMotionPathConfig}
          />
        )}

        {/* Video Export */}
        {activeTab === 7 && (
          <VideoExportPanel
            duration={animationDuration}
            userId={userId}
            projectId={projectId}
            projectName={projectName}
            onFrameRender={onFrameRender}
            onExportStart={onExportStart}
            onExportComplete={onExportComplete}
            onDriveUploadComplete={onDriveUploadComplete}
          />
        )}

        {/* Export Scheduler */}
        {activeTab === 8 && (
          <ExportSchedulerPanel
            duration={animationDuration}
            userId={userId}
            projectId={projectId}
            projectName={projectName}
            onFrameRender={onFrameRender}
          />
        )}
      </Box>
    </Box>
  );
}

export default AnimationStudioPanel;

