/**
 * Video Annotation Editor
 * Interactive tool for adding annotations, hotspots, and callouts to videos
 */

import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useAcademy } from '@/contexts/AcademyContext';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Visibility,
  VisibilityOff,
  DragIndicator,
  ContentCopy,
  Bookmark,
  Info,
  Warning,
  Lightbulb,
  QuestionAnswer,
  Link,
  Image,
  VideoLibrary,
  Close,
} from '@mui/icons-material';
import {
  BookmarkIcon,
  NoteIcon,
  QuizIcon,
  XRayIcon,
  HotspotIcon,
  CalloutIcon,
  AnnotationIcon,
  InteractiveElementIcon,
  VideoMarkerIcon,
  ContentCreationIcon,
} from '../shared/CreatorHubIcons';

export interface VideoAnnotation {
  id: string;
  type: 'hotspot' | 'callout' | 'note' | 'quiz' | 'link' | 'image' | 'video';
  title: string;
  content: string;
  startTime: number;
  endTime?: number;
  position: {
    x: number; // percentage from left
    y: number; // percentage from top
  };
  size: {
    width: number;
    height: number;
  };
  style: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    opacity: number;
  };
  isVisible: boolean;
  isClickable: boolean;
  action?: {
    type: 'navigate' | 'showContent' | 'openLink' | 'playVideo' | 'showQuiz';
    target?: string;
    data?: any;
  };
  createdAt: string;
  updatedAt: string;
}

interface VideoAnnotationEditorProps {
	  videoUrl: string;
	  duration: number;
	  annotations: VideoAnnotation[];
	  onAnnotationsChange: (annotations: VideoAnnotation[]) => void;
	  onSave?: (annotations: VideoAnnotation[]) => void;
	  onCancel?: () => void;
}

function VideoAnnotationEditor({
  videoUrl,
  duration,
  annotations,
  onAnnotationsChange,
  onSave,
  onCancel,
}: VideoAnnotationEditorProps) {
  const theme = useTheme();

  // Theming system
  const theming = useTheming('music_producer');

  // Enhanced Master Integration
  const { analytics, performance, debugging, lifecycle, health, features } =
    useEnhancedMasterIntegration();

  // Academy Context
  const { updateProgress, addBookmark, addNote, updateSettings, state } = useAcademy();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<VideoAnnotation | null>(null);
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<VideoAnnotation | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Component registration and analytics
  useEffect(() => {
    const endTiming = performance.startTiming('video_annotation_editor_render');

    analytics.trackEvent('video_annotation_editor_mounted,', {
      videoUrl,
      duration,
      annotationCount: annotations.length,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'VideoAnnotationEditor mounted', {
      videoUrl,
      duration,
      annotationCount: annotations.length,
    });

    return () => {
      endTiming();
      analytics.trackEvent('video_annotation_editor_unmounted', {
        videoUrl,
        duration,
        annotationCount: annotations.length,
        timestamp: Date.now(),
      });
    };
  }, [videoUrl, duration, annotations.length, analytics, performance, debugging]);

  // Annotation types
  const annotationTypes = [
    { value: 'hotspot', label: 'Hotspot', icon: <HotspotIcon />, color: '#ff8c00' },
    { value: 'callout', label: 'Callout', icon: <CalloutIcon />, color: '#2196f3' },
    { value: 'note', label: 'Note', icon: <NoteIcon />, color: '#4caf50' },
    { value: 'quiz', label: 'Quiz', icon: <QuizIcon />, color: '#9c27b0' },
    { value: 'link', label: 'Link', icon: <Link />, color: '#ff5722' },
    { value: 'image', label: 'Image', icon: <Image />, color: '#607d8b' },
    { value: 'video', label: 'Video', icon: <VideoLibrary />, color: '#795548' },
  ];

  // Video event handlers
  const handlePlay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const handlePause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((event: Event, newValue: number | number[]) => {
    if (videoRef.current) {
      const newTime = newValue as number;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Canvas mouse events for drawing annotations
  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (previewMode) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      setIsDrawing(true);
      setDrawStart({ x, y });
    },
    [previewMode],
  );

  const handleCanvasMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !drawStart) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      const width = Math.abs(x - drawStart.x);
      const height = Math.abs(y - drawStart.y);
      const left = Math.min(x, drawStart.x);
      const top = Math.min(y, drawStart.y);

      // Create new annotation
      const newAnnotation: VideoAnnotation = {
        id: `annotation-${Date.now()}`,
        type: 'hotspot',
        title: 'New Annotation',
        content: ', ',
        startTime: currentTime,
        position: { x: left, y: top },
        size: { width, height: height || 20 },
        style: {
          backgroundColor: '#ff8c00',
          textColor: '#ffffff',
          borderColor: '#e67e00',
          borderWidth: 2,
          borderRadius: 4,
          opacity: 0.9,
        },
        isVisible: true,
        isClickable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setEditingAnnotation(newAnnotation);
      setShowAnnotationDialog(true);
      setIsDrawing(false);
      setDrawStart(null);
    },
    [isDrawing, drawStart, currentTime],
  );

  // Annotation management
  const handleAddAnnotation = useCallback(
    (type: string) => {
      const newAnnotation: VideoAnnotation = {
        id: `annotation-${Date.now()}`,
        type: type as any,
        title: 'New Annotation',
        content: ', ',
        startTime: currentTime,
        position: { x: 10, y: 10 },
        size: { width: 200, height: 50 },
        style: {
          backgroundColor: annotationTypes.find((t) => t.value === type)?.color || '#ff8c00',
          textColor: '#ffffff',
          borderColor: '#e67e00',
          borderWidth: 2,
          borderRadius: 4,
          opacity: 0.9,
        },
        isVisible: true,
        isClickable: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setEditingAnnotation(newAnnotation);
      setShowAnnotationDialog(true);

      // Analytics tracking
      analytics.trackEvent('annotation_added', {
        type,
        annotationTime: currentTime,
        videoUrl,
        duration,
        timestamp: Date.now(),
      });
    },
    [currentTime, annotationTypes, analytics, videoUrl, duration],
  );

  const handleSaveAnnotation = useCallback(
    (annotation: VideoAnnotation) => {
      const updatedAnnotations = editingAnnotation
        ? annotations.map((a) => (a.id === editingAnnotation.id ? annotation : a))
        : [...annotations, annotation];

      onAnnotationsChange(updatedAnnotations);
      setShowAnnotationDialog(false);
      setEditingAnnotation(null);

      // Analytics tracking
      analytics.trackEvent('annotation_saved', {
        annotationId: annotation.id,
        type: annotation.type,
        annotationTime: annotation.startTime,
        videoUrl,
        duration,
        timestamp: Date.now(),
      });
    },
    [annotations, editingAnnotation, onAnnotationsChange, analytics, videoUrl, duration],
  );

  const handleDeleteAnnotation = useCallback(
    (annotationId: string) => {
      const updatedAnnotations = annotations.filter((a) => a.id !== annotationId);
      onAnnotationsChange(updatedAnnotations);

      // Analytics tracking
      analytics.trackEvent('annotation_deleted', {
        annotationId,
        videoUrl,
        duration,
        timestamp: Date.now(),
      });
    },
    [annotations, onAnnotationsChange, analytics, videoUrl, duration],
  );

  const handleAnnotationClick = useCallback(
    (annotation: VideoAnnotation) => {
      if (previewMode) {
        // Handle annotation action in preview mode
        if (annotation.action) {
          // Execute annotation action
          console.log('Annotation action: ', annotation.action);
        }
      } else {
        // Edit annotation in edit mode
        setEditingAnnotation(annotation);
        setShowAnnotationDialog(true);
      }
    },
    [previewMode],
  );

  // Render annotations on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw annotations
    annotations.forEach((annotation) => {
      if (!annotation.isVisible) return;

      const x = (annotation.position.x / 100) * canvas.width;
      const y = (annotation.position.y / 100) * canvas.height;
      const width = (annotation.size.width / 100) * canvas.width;
      const height = (annotation.size.height / 100) * canvas.height;

      // Draw annotation background
      ctx.fillStyle = annotation.style.backgroundColor;
      ctx.globalAlpha = annotation.style.opacity;
      ctx.fillRect(x, y, width, height);

      // Draw border
      ctx.strokeStyle = annotation.style.borderColor;
      ctx.lineWidth = annotation.style.borderWidth;
      ctx.strokeRect(x, y, width, height);

      // Draw text
      ctx.fillStyle = annotation.style.textColor;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(annotation.title, x + width / 2, y + height / 2);

      // Draw type icon
      const iconSize = 16;
      ctx.fillStyle = annotation.style.textColor;
      ctx.fillRect(x + 5, y + 5, iconSize, iconSize);
    });
  }, [annotations]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Video Annotation Editor
          </Typography>
          <Stack direction="row" spacing={1}>
            <FormControlLabel
              control={
                <Switch checked={previewMode} onChange={(e) => setPreviewMode(e.target.checked)} />
              }
              label="Preview Mode"
            />
            <Button variant="outlined" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => onSave?.(annotations)}
              sx={theming.getThemedButtonSx()}
            >
              Save Annotations
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Video Player */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'}}
          />

          {/* Overlay Canvas */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: previewMode ? 'pointer' : 'crosshair',
              zIndex: 1}}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
          />

          {/* Video Controls */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
              p: 2,
              zIndex: 2}}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <IconButton onClick={isPlaying ? handlePause : handlePlay} sx={{ color: 'white' }}>
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>

              <Typography variant="body2" sx={{ color: 'white', minWidth: 100 }}>
                {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')} /{', '}
                {Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}
              </Typography>

              <Box sx={{ flex: 1 }}>
                <Slider
                  value={currentTime}
                  min={0}
                  max={duration}
                  onChange={handleSeek}
                  sx={{
                    color: '#ff8c00','& .MuiSlider-thumb': {
                      width: 16,
                      height: 16,
                      bgcolor: '#ff8c00',
                    }}}
                />
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Annotation Tools */}
        <Box sx={{ width: 300, borderLeft: 1, borderColor: 'divider', p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Annotation Tools
            </Typography>

            {/* Add Annotation Buttons */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Add Annotation
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {annotationTypes.map((type) => (
                  <Button
                    key={type.value}
                    variant="outlined"
                    size="small"
                    startIcon={type.icon}
                    onClick={() => handleAddAnnotation(type.value)}
                    sx={{
                      borderColor: type.color,
                      color: type.color, '&:hover': {
                        borderColor: type.color,
                        backgroundColor: alpha(type.color, 0.1),
                      }}}
                  >
                    {type.label}
                  </Button>
                ))}
              </Stack>
            </Box>

            <Divider />

            {/* Annotations List */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Annotations ({annotations.length})
              </Typography>
              <List dense>
                {annotations.map((annotation) => (
                  <ListItem
                    key={annotation.id}
                    component="div"
                    onClick={() => handleAnnotationClick(annotation)}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      bgcolor:
                        selectedAnnotation?.id === annotation.id
                          ? alpha(theme.palette.primary.main, 0.1)
                          : 'transparent'}}
                  >
                    <ListItemText
                      primary={annotation.title}
                      secondary={`${Math.floor(annotation.startTime / 60)}:${(annotation.startTime % 60).toFixed(0).padStart(2, '0')} - ${annotation.type}`}
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAnnotation(annotation);
                            setShowAnnotationDialog(true);
                          }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAnnotation(annotation.id);
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Annotation Dialog */}
      <Dialog
        open={showAnnotationDialog}
        onClose={() => setShowAnnotationDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{editingAnnotation ? 'Edit Annotation' : 'Add Annotation'}</DialogTitle>
        <DialogContent>
          {editingAnnotation && (
            <AnnotationForm
              annotation={editingAnnotation}
              onSave={handleSaveAnnotation}
              onCancel={() => setShowAnnotationDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// Annotation Form Component
interface AnnotationFormProps {
  annotation: VideoAnnotation;
  onSave: (annotation: VideoAnnotation) => void;
  onCancel: () => void;
}

function AnnotationForm({ annotation, onSave, onCancel }: AnnotationFormProps) {
  const [formData, setFormData] = useState<VideoAnnotation>(annotation);

  const handleSave = () => {
    onSave({
      ...formData,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <Stack spacing={3} sx={{ mt: 1 }}>
      <TextField
        label="Title"
        value={formData.title}
        onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
        fullWidth
      />

      <TextField
        label="Content"
        value={formData.content}
        onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
        multiline
        rows={3}
        fullWidth
      />

      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        <Select
          value={formData.type}
          onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as any }))}
          label="Type"
        >
          <MenuItem value="hotspot">Hotspot</MenuItem>
          <MenuItem value="callout">Callout</MenuItem>
          <MenuItem value="note">Note</MenuItem>
          <MenuItem value="quiz">Quiz</MenuItem>
          <MenuItem value="link">Link</MenuItem>
          <MenuItem value="image">Image</MenuItem>
          <MenuItem value="video">Video</MenuItem>
        </Select>
      </FormControl>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Start Time (seconds)"
          type="number"
          value={formData.startTime}
          onChange={(e) => setFormData((prev) => ({ ...prev, startTime: Number(e.target.value) }))}
          fullWidth
        />
        <TextField
          label="End Time (seconds)"
          type="number"
          value={formData.endTime || ', '}
          onChange={(e) => setFormData((prev) => ({ ...prev, endTime: Number(e.target.value) }))}
          fullWidth
        />
      </Stack>

      <FormControlLabel
        control={
          <Switch
            checked={formData.isVisible}
            onChange={(e) => setFormData((prev) => ({ ...prev, isVisible: e.target.checked }))}
          />
        }
        label="Visible"
      />

      <FormControlLabel
        control={
          <Switch
            checked={formData.isClickable}
            onChange={(e) => setFormData((prev) => ({ ...prev, isClickable: e.target.checked }))}
          />
        }
        label="Clickable"
      />

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Stack>
  );
}

export default withUniversalIntegration(VideoAnnotationEditor, {
  componentId: 'video-annotation-editor',
  componentName: 'Video Annotation Editor',
  componentType: 'editor',
  componentCategory: 'academy',
	  featureIds: ['annotation-editor', 'video-player-academy'],
});
