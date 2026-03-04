import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Slider,
  Stack,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  Face,
  Visibility,
  Navigation,
  Psychology,
} from '@mui/icons-material';
import type { BeatClip } from '../services/storyArcDataIntegration';

interface ClipMeta { 
  camera?: string; 
  shotName?: string; 
  scene?: string; 
  take?: string; 
  tags?: string[];
  faceDetection?: {
    hasFace: boolean;
    faceCount: number;
    confidence: number;
    analyzedAt: number;
    comprehensiveAnalysis?: {
      parsing?: {
        mask?: string;
        visualization?: string;
      };
      landmarks?: {
        points: Array<{ x: number; y: number }>;
        count: number;
        visualization?: string;
      };
      headpose?: {
        pitch: number;
        yaw: number;
        roll: number;
        visualization?: string;
      };
      attributes?: {
        values: number[];
        count: number;
      };
    };
    bestTimestamp?: number;
    scanMetadata?: {
      totalFramesAnalyzed: number;
      framesWithFaces: number;
      faceDetectionRate: number;
      timestamps: Array<{ timestamp: number; hasFace: boolean }>;
    };
  };
}

interface InspectorPanelProps {
  selectedClips: BeatClip[];
  onClipUpdate: (clipId: string, updates: Partial<BeatClip>) => void;
  onBulkUpdate?: (clipIds: string[], updates: Partial<BeatClip>) => void;
  height?: number | string;
  metaMap?: Record<string, ClipMeta>;
  onMetaUpdate?: (clipId: string, updates: Partial<ClipMeta>) => void;
}

export default function InspectorPanel({ selectedClips, onClipUpdate, onBulkUpdate, height = '100%', metaMap = {}, onMetaUpdate }: InspectorPanelProps) {
  const clip = selectedClips && selectedClips.length > 0 ? selectedClips[0] : null;

  if (!clip) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography variant="body2" color="text.secondary">Select a clip to edit its properties</Typography>
      </Box>
    );
  }

  const meta = metaMap[clip.id] || {};
  const updateMeta = (changes: Partial<ClipMeta>) => onMetaUpdate?.(clip.id, { ...changes });

  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Inspector</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Name"
            size="small"
            value={clip.name || ''}
            onChange={(e) => onClipUpdate(clip.id, { name: e.target.value })}
            fullWidth
          />
          <TextField
            label="Synopsis"
            size="small"
            value={clip.synopsis || ''}
            onChange={(e) => onClipUpdate(clip.id, { synopsis: e.target.value })}
            fullWidth
            multiline
            rows={3}
          />
          <Box>
            <Typography variant="caption" color="text.secondary">Duration: {clip.duration.toFixed(1)}s</Typography>
            <Slider
              size="small"
              value={clip.duration}
              min={0.5}
              max={120}
              step={0.1}
              onChange={(_, val) => onClipUpdate(clip.id, { duration: val as number })}
            />
          </Box>
        </Stack>
      </Paper>

      {/* Metadata */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Metadata</Typography>
        <Stack spacing={1}>
          <TextField size="small" label="Camera" value={meta.camera || ''} onChange={(e) => updateMeta({ camera: e.target.value })} />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Scene" value={meta.scene || ''} onChange={(e) => updateMeta({ scene: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Take" value={meta.take || ''} onChange={(e) => updateMeta({ take: e.target.value })} sx={{ width: 140 }} />
          </Stack>
          <TextField size="small" label="Shot name" value={meta.shotName || ''} onChange={(e) => updateMeta({ shotName: e.target.value })} />
          <TextField size="small" label="Tags (comma-separated)" value={(meta.tags || []).join('')} onChange={(e) => updateMeta({ tags: e.target.value.split(', ').map(s => s.trim()).filter(Boolean) })} />
        </Stack>
      </Paper>

      {/* Face Detection Analysis */}
      {meta.faceDetection && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Face fontSize="small" />
            Face Analysis (FaceXFormer)
          </Typography>
          
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label={meta.faceDetection.hasFace ? '✅ Face Detected' : '❌ No Face'} 
                color={meta.faceDetection.hasFace ? 'success' : 'default'}
                size="small"
              />
              <Chip 
                label={`Confidence: ${(meta.faceDetection.confidence * 100).toFixed(0)}%`}
                size="small"
              />
              {meta.faceDetection.bestTimestamp !== undefined && (
                <Chip 
                  label={`Best at: ${meta.faceDetection.bestTimestamp.toFixed(1)}s`}
                  size="small"
                />
              )}
            </Box>
            
            {meta.faceDetection.scanMetadata && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Scan: {meta.faceDetection.scanMetadata.framesWithFaces}/{meta.faceDetection.scanMetadata.totalFramesAnalyzed} frames with faces 
                  ({meta.faceDetection.scanMetadata.faceDetectionRate.toFixed(1)}%)
                </Typography>
              </Box>
            )}
            
            {meta.faceDetection.comprehensiveAnalysis && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="body2">Comprehensive Analysis Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {/* Parsing */}
                    {meta.faceDetection.comprehensiveAnalysis.parsing && (
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Visibility fontSize="small" />
                          Face Parsing (Segmentation)
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Face segmentation mask available
                        </Typography>
                        {meta.faceDetection.comprehensiveAnalysis.parsing.visualization && (
                          <Box sx={{ mt: 1 }}>
                            <img 
                              src={`data:image/png;base64,${meta.faceDetection.comprehensiveAnalysis.parsing.visualization}`}
                              alt="Face parsing"
                              style={{ maxWidth: '100%', borderRadius: '4px' }}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    <Divider />
                    
                    {/* Landmarks */}
                    {meta.faceDetection.comprehensiveAnalysis.landmarks && (
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Face fontSize="small" />
                          Facial Landmarks
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {meta.faceDetection.comprehensiveAnalysis.landmarks.count} landmark points detected
                        </Typography>
                        {meta.faceDetection.comprehensiveAnalysis.landmarks.visualization && (
                          <Box sx={{ mt: 1 }}>
                            <img 
                              src={`data:image/png;base64,${meta.faceDetection.comprehensiveAnalysis.landmarks.visualization}`}
                              alt="Facial landmarks"
                              style={{ maxWidth: '100%', borderRadius: '4px' }}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    <Divider />
                    
                    {/* Head Pose */}
                    {meta.faceDetection.comprehensiveAnalysis.headpose && (
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Navigation fontSize="small" />
                          Head Pose
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Pitch</Typography>
                            <Typography variant="body2">{meta.faceDetection.comprehensiveAnalysis.headpose.pitch.toFixed(1)}°</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Yaw</Typography>
                            <Typography variant="body2">{meta.faceDetection.comprehensiveAnalysis.headpose.yaw.toFixed(1)}°</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Roll</Typography>
                            <Typography variant="body2">{meta.faceDetection.comprehensiveAnalysis.headpose.roll.toFixed(1)}°</Typography>
                          </Box>
                        </Stack>
                        {meta.faceDetection.comprehensiveAnalysis.headpose.visualization && (
                          <Box sx={{ mt: 1 }}>
                            <img 
                              src={`data:image/png;base64,${meta.faceDetection.comprehensiveAnalysis.headpose.visualization}`}
                              alt="Head pose"
                              style={{ maxWidth: '100%', borderRadius: '4px' }}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    <Divider />
                    
                    {/* Attributes */}
                    {meta.faceDetection.comprehensiveAnalysis.attributes && (
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Psychology fontSize="small" />
                          Face Attributes
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {meta.faceDetection.comprehensiveAnalysis.attributes.count} attributes detected
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: 'monospace', fontSize: '10px' }}>
                          {meta.faceDetection.comprehensiveAnalysis.attributes.values.slice(0, 20).join('')}
                          {meta.faceDetection.comprehensiveAnalysis.attributes.values.length > 20 ? '...' :','}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        </Paper>
      )}

      {selectedClips.length > 1 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Bulk actions ({selectedClips.length} clips)</Typography>
          <Stack spacing={1}>
            <TextField
              label="Set color (hex)"
              size="small"
              placeholder="#2196f3"
              onBlur={(e) => onBulkUpdate?.(selectedClips.map(c => c.id), { color: e.target.value as any })}
            />
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
