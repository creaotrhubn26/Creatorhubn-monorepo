/**
 * AI VIDEO ANALYSIS PANEL
 * Integrated AI-powered video analysis for StoryArcStudio
 *
 * Features: * - Scene detection & classification
 * - Object tracking
 * - Smart timeline organization
 * - Auto-chapter markers
 * - Cultural moment detection
 * - LUT/ACES suggestions
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Slider,
} from '@mui/material';
import {
  VideoLibrary,
  SmartToy,
  Timeline,
  BookmarkAdd,
  Colorize,
  Psychology,
  PlayArrow,
  Pause,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { AIVisionService, VideoSceneAnalysis } from '@/services/ai-vision-service';

interface VideoFile {
  id: string;
  name: string;
  url: string;
  duration?: number;
}

interface AIVideoAnalysisPanelProps {
  currentVideo: VideoFile | null;
  onChaptersGenerated?: (chapters: Array<{ title: string; timestamp: number }>) => void;
  onScenesDetected?: (scenes: VideoSceneAnalysis[]) => void;
  onLUTSuggestion?: (lut: string) => void;
  onACESSuggestion?: (aces: { look: string; exposure: number }) => void;
}

export default function AIVideoAnalysisPanel({
  currentVideo,
  onChaptersGenerated,
  onScenesDetected,
  onLUTSuggestion,
  onACESSuggestion,
}: AIVideoAnalysisPanelProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scenes, setScenes] = useState<VideoSceneAnalysis[]>([]);
  const [chapters, setChapters] = useState<Array<{ title: string; timestamp: number }>>([]);
  const [highlights, setHighlights] = useState<number[]>([]);
  const [culturalMoments, setCulturalMoments] = useState<
    Array<{ type: string; timestamp: number }>
  >([]);

  const [samplingRate, setSamplingRate] = useState(1); // Frames per second
  const [selectedScene, setSelectedScene] = useState<VideoSceneAnalysis | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  /**
   * Analyze entire video
   */
  const handleAnalyzeVideo = async () => {
    if (!currentVideo) return;

    setAnalyzing(true);
    setProgress(0);

    try {
      const result = await AIVisionService.batchAnalyzeVideo(currentVideo.url, {
        samplingRate,
        detectObjects: true,
        detectCulturalMoments: true,
        generateChapters: true,
      });

      setScenes(result.scenes);
      setChapters(result.chapters);
      setHighlights(result.highlights);
      setCulturalMoments(result.culturalMoments);

      // Callbacks
      onScenesDetected?.(result.scenes);
      onChaptersGenerated?.(result.chapters);

      setProgress(100);
    } catch (error) {
      console.error('Video analysis failed: ', error);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Analyze current frame
   */
  const handleAnalyzeCurrentFrame = async () => {
    if (!currentVideo || !videoRef.current) return;

    const video = videoRef.current;
    const currentTime = video.currentTime;

    // Capture current frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!)'image/jpeg', 0.9);
    });

    setAnalyzing(true);
    try {
      const scene = await AIVisionService.analyzeVideoScene(blob, currentTime, {
        detectCulturalMoments: true,
        suggestColorGrading: true,
      });

      setSelectedScene(scene);

      // Apply suggestions
      if (scene.suggestedLUT) {
        onLUTSuggestion?.(scene.suggestedLUT);
      }
      if (scene.suggestedACES) {
        onACESSuggestion?.(scene.suggestedACES);
      }

      // Add to scenes
      setScenes((prev) => [...prev, scene]);
    } catch (error) {
      console.error('Frame analysis failed: ', error);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Format timestamp
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Get scene type color
   */
  const getSceneColor = (type: string): string => {
    const colors: Record<string, string> = {
      indoor: '#3498db',
      outdoor: '#27ae60',
      studio: '#9b59b6',
      nature: '#2ecc71',
      urban: '#95a5a6',
      venue: '#e74c3c' };
    return colors[type] || '#95a5a6';
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmartToy /> AI Video Analysis
      </Typography>

      <Stack spacing={2}>
        {/* Video Preview */}
        {currentVideo && (
          <Card sx={{ bgcolor: '#000'}}>
            <video
              ref={videoRef}
              src={currentVideo.url}
              controls
              style={{ width: '100%', maxHeight: '300px' }} />
          </Card>
        )}

        {/* Analysis Controls */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body2" fontWeight={600}>
                Analysis Settings
              </Typography>

              <Box>
                <Typography variant="caption" gutterBottom>
                  Sampling Rate: {samplingRate} frame/sec
                </Typography>
                <Slider
                  value={samplingRate}
                  onChange={(_, val) => setSamplingRate(val as number)}
                  min={0.5}
                  max={5}
                  step={0.5}
                  marks
                  disabled={analyzing}
                  sx={{ color: '#9b59b6' }} />
                <Typography variant="caption" color="text.secondary">
                  Higher = More accurate but slower
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<VideoLibrary />}
                  onClick={handleAnalyzeVideo}
                  disabled={!currentVideo || analyzing}
                  sx={{ bgcolor: '#9b59b6' }}>
                  Analyze Full Video
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Psychology />}
                  onClick={handleAnalyzeCurrentFrame}
                  disabled={!currentVideo || analyzing}
                >
                  Analyze Frame
                </Button>
              </Box>

              {analyzing && (
                <Box>
                  <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Analyzing... {Math.round(progress)}%
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Current Scene Analysis */}
        {selectedScene && (
          <Card>
            <CardContent>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Current Frame Analysis
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={selectedScene.scene.type}
                    size="small"
                    sx={{ bgcolor: getSceneColor(selectedScene.scene.type), color: '#fff'}} />
                  <Chip label={selectedScene.scene.lighting} size="small" />
                  <Chip label={selectedScene.scene.activity} size="small" />
                  {selectedScene.keyMoment && (
                    <Chip label="Key Moment" size="small" color="success" icon={<CheckCircle />} />
                  )}
                </Box>

                {selectedScene.culturalSignificance && (
                  <Alert severity="info" sx={{ py: 0 }}>
                    {selectedScene.culturalSignificance}
                  </Alert>
                )}

                {selectedScene.suggestedLUT && (
                  <Typography variant="caption">
                    💡 Suggested LUT: <strong>{selectedScene.suggestedLUT}</strong>
                  </Typography>
                )}

                {selectedScene.objects.length > 0 && (
                  <Box>
                    <Typography variant="caption" display="block" gutterBottom>
                      Objects detected: {selectedScene.objects.length}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 flexWrap: 'wrap' }}>
                      {selectedScene.objects.slice(0, 5).map((obj, i) => (
                        <Chip
                          key={i}
                          label={`${obj.label} (${Math.round(obj.confidence * 100)}%)`}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Chapters */}
        {chapters.length > 0 && (
          <Card>
            <CardContent>
              <Typography
                variant="body2"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BookmarkAdd /> Auto-Generated Chapters ({chapters.length})
              </Typography>
              <List dense>
                {chapters.map((chapter, i) => (
                  <ListItem key={i} divider={i < chapters.length - 1}>
                    <ListItemIcon>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(chapter.timestamp)}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText primary={chapter.title} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Cultural Moments */}
        {culturalMoments.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                🎭 Cultural Moments ({culturalMoments.length})
              </Typography>
              <List dense>
                {culturalMoments.map((moment, i) => (
                  <ListItem key={i}>
                    <ListItemText primary={moment.type} secondary={formatTime(moment.timestamp)} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                ⭐ Key Moments ({highlights.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {highlights.map((time, i) => (
                  <Chip
                    key={i}
                    label={formatTime(time)}
                    size="small"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = time;
                      }}
                    }
                    sx={{ cursor: 'pointer' }} />
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Scene Timeline */}
        {scenes.length > 0 && (
          <Card>
            <CardContent>
              <Typography
                variant="body2"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline /> Scene Timeline ({scenes.length} scenes)
              </Typography>
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {scenes.map((scene, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 1,
                      mb: 1,
                      bgcolor: '#f5f5f5',
                      borderRadius: 1,
                      borderLeft: `4px solid ${getSceneColor(scene.scene.type)}`,
                      cursor: 'pointer','&:hover': { bgcolor:'#e0e0e0' }}}
                    onClick={() => setSelectedScene(scene)}
                  >
                    <Typography variant="caption" fontWeight={600}>
                      {formatTime(scene.timestamp)} - {scene.scene.type}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {scene.scene.lighting} • {scene.scene.activity}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        {!currentVideo && <Alert severity="info">Load a video to start AI analysis</Alert>}
      </Stack>
    </Box>
  );
}
