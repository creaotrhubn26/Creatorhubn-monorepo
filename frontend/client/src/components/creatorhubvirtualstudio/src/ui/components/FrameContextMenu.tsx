/**
 * FrameContextMenu - Right-click context menu for storyboard frames
 * 
 * Features:
 * - Quick actions (edit, duplicate, delete, move)
 * - Annotation tools (draw, arrows, markers)
 * - Project integration (import camera, lighting, equipment)
 * - Technical metadata
 * - Collaboration options
 * - Export options
 */

import React, { useState, useCallback } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('FrameContextMenu, ');

import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Slider,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  Autocomplete,
} from '@mui/material';
import {
  Edit,
  ContentCopy,
  Delete,
  ArrowUpward,
  ArrowDownward,
  Brush,
  TrendingFlat,
  Person,
  Videocam,
  Lightbulb,
  CropFree,
  CleaningServices,
  PhotoCamera,
  Settings,
  Link,
  Inventory,
  Image,
  DirectionsWalk,
  VolumeUp,
  Timer,
  LocalOffer,
  Comment,
  CheckCircle,
  Sync,
  Visibility,
  Download,
  ContentPaste,
  Share,
  MoreHoriz,
  CameraAlt,
  Aperture,
  Iso,
  ShutterSpeed,
  Straighten,
  PushPin,
  Flag,
  Star,
} from '@mui/icons-material';
import { StoryboardFrame, useStoryboardStore } from '../../state/storyboardStore';
import { useAppStore } from '../../state/store';

// =============================================================================
// Types
// =============================================================================

interface FrameContextMenuProps {
  anchorPosition: { top: number; left: number } | null;
  frame: StoryboardFrame | null;
  onClose: () => void;
  onAnnotate: (frame: StoryboardFrame) => void;
  onQuickAnnotation: (frame: StoryboardFrame, type: QuickAnnotationType) => void;
}

export type QuickAnnotationType = 
  | 'arrow_left'
  | 'arrow_right'
  | 'arrow_up'
  | 'arrow_down'
  | 'actor_marker'
  | 'camera_path'
  | 'light_marker'
  | 'focus_area';

interface CameraSettings {
  focalLength: number;
  aperture: string;
  iso: number;
  shutterSpeed: string;
  sensorSize: string;
}

interface MetadataEditorProps {
  open: boolean;
  frame: StoryboardFrame | null;
  onClose: () => void;
  onSave: (data: Partial<StoryboardFrame>) => void;
}

// =============================================================================
// Metadata Editor Dialog
// =============================================================================

const MetadataEditorDialog: React.FC<MetadataEditorProps> = ({
  open,
  frame,
  onClose,
  onSave,
}) => {
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
    focalLength: 50,
    aperture: 'f/2.8',
    iso: 400,
    shutterSpeed: '1/125',
    sensorSize: 'Full Frame',
  });
  const [duration, setDuration] = useState(frame?.duration || 5);
  const [dialogue, setDialogue] = useState(frame?.dialogue || ',');
  const [technicalNotes, setTechnicalNotes] = useState(frame?.technicalNotes || ', ');
  const [tags, setTags] = useState<string[]>([]);

  const handleSave = () => {
    onSave({
      duration,
      dialogue,
      technicalNotes,
      // Store camera settings in scene snapshot
      sceneSnapshot: {
        ...frame?.sceneSnapshot,
        cameraSettings,
        tags,
      },
    });
    onClose();
  };

  if (!frame) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Settings />
          <Box>
            <Typography variant="h6">Frame Metadata</Typography>
            <Typography variant="caption" color="text.secondary">
              {frame.title} - Frame {frame.index + 1}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Camera Settings */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhotoCamera fontSize="small" /> Camera Settings
            </Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Focal Length"
                    type="number"
                    value={cameraSettings.focalLength}
                    onChange={(e) => setCameraSettings({ ...cameraSettings, focalLength: parseInt(e.target.value) })}
                    InputProps={{ endAdornment: <Typography variant="caption">mm</Typography> }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Aperture</InputLabel>
                    <Select
                      value={cameraSettings.aperture}
                      label="Aperture"
                      onChange={(e) => setCameraSettings({ ...cameraSettings, aperture: e.target.value })}
                    >
                      {['f/1.4','f/1.8','f/2','f/2.8','f/4','f/5.6','f/8','f/11','f/16','f/22'].map((f) => (
                        <MenuItem key={f} value={f}>{f}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>ISO</InputLabel>
                    <Select
                      value={cameraSettings.iso}
                      label="ISO"
                      onChange={(e) => setCameraSettings({ ...cameraSettings, iso: e.target.value as number })}
                    >
                      {[100, 200, 400, 800, 1600, 3200, 6400, 12800].map((iso) => (
                        <MenuItem key={iso} value={iso}>{iso}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Shutter</InputLabel>
                    <Select
                      value={cameraSettings.shutterSpeed}
                      label="Shutter"
                      onChange={(e) => setCameraSettings({ ...cameraSettings, shutterSpeed: e.target.value })}
                    >
                      {['1/30','1/60','1/125','1/250','1/500','1/1000','1/2000','1/4000'].map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Duration */}
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Timer fontSize="small" /> Duration
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Slider
                value={duration}
                onChange={(_, v) => setDuration(v as number)}
                min={1}
                max={60}
                valueLabelDisplay="auto"
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                InputProps={{ endAdornment: <Typography variant="caption">sec</Typography> }}
                sx={{ width: 100 }}
              />
            </Stack>
          </Grid>

          {/* Tags */}
          <Grid item xs={12} sm={6}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalOffer fontSize="small" /> Tags
            </Typography>
            <Autocomplete
              multiple
              freeSolo
              options={['establishing','closeup','action','dialogue','transition','vfx','insert']}
              value={tags}
              onChange={(_, newValue) => setTags(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip size="small" label={option} {...getTagProps({ index })} key={option} />
                ))
              }
              renderInput={(params) => <TextField {...params} size="small" placeholder="Add tags..." />}
            />
          </Grid>

          {/* Dialogue */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VolumeUp fontSize="small" /> Dialogue / Audio Notes
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={dialogue}
              onChange={(e) => setDialogue(e.target.value)}
              placeholder="Enter dialogue, sound effects, or audio notes..."
            />
          </Grid>

          {/* Technical Notes */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Settings fontSize="small" /> Technical Notes
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={technicalNotes}
              onChange={(e) => setTechnicalNotes(e.target.value)}
              placeholder="Camera movement, lighting setup, special requirements..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save Metadata</Button>
      </DialogActions>
    </Dialog>
  );
};

// =============================================================================
// Import From Scene Dialog
// =============================================================================

interface ImportFromSceneDialogProps {
  open: boolean;
  type: 'camera' | 'lighting' | 'equipment' | null;
  onClose: () => void;
  onImport: (data: any) => void;
}

const ImportFromSceneDialog: React.FC<ImportFromSceneDialogProps> = ({
  open,
  type,
  onClose,
  onImport,
}) => {
  const { nodes } = useAppStore();
  
  // Filter nodes by type
  const getCameraNodes = () => nodes.filter(n => n.type === 'camera');
  const getLightNodes = () => nodes.filter(n => n.type === 'light');
  const getEquipmentNodes = () => nodes.filter(n => !['camera','light'].includes(n.type || ','));

  const getTitle = () => {
    switch (type) {
      case 'camera': return 'Import Camera from Scene';
      case 'lighting': return 'Import Lighting Setup';
      case 'equipment': return 'Import Equipment';
      default: return 'Import';
    }
  };

  const getItems = () => {
    switch (type) {
      case 'camera': return getCameraNodes();
      case 'lighting': return getLightNodes();
      case 'equipment': return getEquipmentNodes();
      default: return [];
    }
  };

  const getIcon = (nodeType?: string) => {
    switch (nodeType) {
      case 'camera': return <Videocam />;
      case 'light': return <Lightbulb />;
      default: return <Inventory />;
    }
  };

  const items = getItems();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        {items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No {type} found in current scene
            </Typography>
          </Box>
        ) : (
          <List>
            {items.map((node) => (
              <ListItem
                key={node.id}
                button
                onClick={() => {
                  onImport(node);
                  onClose();
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {getIcon(node.type)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={node.name}
                  secondary={`Position: ${node.position?.map(p => p.toFixed(1)).join(', ')}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

// =============================================================================
// Main Context Menu Component
// =============================================================================

export const FrameContextMenu: React.FC<FrameContextMenuProps> = ({
  anchorPosition,
  frame,
  onClose,
  onAnnotate,
  onQuickAnnotation,
}) => {
  const { updateFrame, deleteFrame, duplicateFrame, reorderFrames } = useStoryboardStore();
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [importDialogType, setImportDialogType] = useState<'camera' | 'lighting' | 'equipment' | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState(', ');

  // Quick Actions
  const handleDuplicate = () => {
    if (frame) {
      duplicateFrame(frame.id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (frame) {
      deleteFrame(frame.id);
    }
    onClose();
  };

  const handleMoveUp = () => {
    if (frame && frame.index > 0) {
      reorderFrames(frame.storyboardId, frame.id, frame.index - 1);
    }
    onClose();
  };

  const handleMoveDown = () => {
    if (frame) {
      reorderFrames(frame.storyboardId, frame.id, frame.index + 1);
    }
    onClose();
  };

  // Annotation actions
  const handleOpenAnnotator = () => {
    if (frame) {
      onAnnotate(frame);
    }
    onClose();
  };

  const handleQuickAnnotation = (type: QuickAnnotationType) => {
    if (frame) {
      onQuickAnnotation(frame, type);
    }
    onClose();
  };

  // Import actions
  const handleImportFromScene = (type: 'camera' | 'lighting' | 'equipment') => {
    setImportDialogType(type);
    onClose();
  };

  const handleImportData = (data: any) => {
    if (frame) {
      updateFrame(frame.id, {
        sceneSnapshot: {
          ...frame.sceneSnapshot,
          importedData: {
            ...frame.sceneSnapshot?.importedData,
            [importDialogType || 'data']: data,
          },
        },
      });
    }
    setImportDialogType(null);
  };

  // Metadata actions
  const handleOpenMetadata = () => {
    setMetadataDialogOpen(true);
    onClose();
  };

  const handleSaveMetadata = (data: Partial<StoryboardFrame>) => {
    if (frame) {
      updateFrame(frame.id, data);
    }
  };

  // Collaboration actions
  const handleMarkApproved = () => {
    if (frame) {
      updateFrame(frame.id, { status: 'approved' });
    }
    onClose();
  };

  const handleRequestRevision = () => {
    if (frame) {
      updateFrame(frame.id, { status: 'revision_needed' });
    }
    onClose();
  };

  // Export actions
  const handleExportPNG = async () => {
    if (frame?.imageUrl) {
      const link = document.createElement('a');
      link.href = frame.imageUrl;
      link.download = `${frame.title || 'frame'}_${frame.index + 1}.png`;
      link.click();
    }
    onClose();
  };

  const handleCopyToClipboard = async () => {
    if (frame?.imageUrl) {
      try {
        const response = await fetch(frame.imageUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
      } catch (error) {
        log.error('Failed to copy to clipboard: ', error);
      }
    }
    onClose();
  };

  if (!frame) return null;

  return (
    <>
      <Menu
        open={Boolean(anchorPosition)}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition || undefined}
        PaperProps={{
          sx: {
            minWidth: 280,
            bgcolor: '#1a1a2e', '& .MuiMenuItem-root': {
              py: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            },
          }}}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Frame {frame.index + 1}: {frame.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {frame.shotType} • {frame.cameraAngle}
          </Typography>
        </Box>

        {/* Quick Actions */}
        <MenuItem onClick={() => { onClose(); /* Open edit dialog */ }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Frame Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          <ListItemText>Duplicate Frame</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMoveUp} disabled={frame.index === 0}>
          <ListItemIcon><ArrowUpward fontSize="small" /></ListItemIcon>
          <ListItemText>Move Up</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMoveDown}>
          <ListItemIcon><ArrowDownward fontSize="small" /></ListItemIcon>
          <ListItemText>Move Down</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Annotations */}
        <Typography variant="overline" sx={{ px: 2, color: 'text.secondary', fontSize: '0.65rem' }}>
          Annotations
        </Typography>
        <MenuItem onClick={handleOpenAnnotator}>
          <ListItemIcon><Brush fontSize="small" /></ListItemIcon>
          <ListItemText>Open Annotation Editor</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleQuickAnnotation('arrow_right')}>
          <ListItemIcon><TrendingFlat fontSize="small" /></ListItemIcon>
          <ListItemText>Add Motion Arrow</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleQuickAnnotation('actor_marker')}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          <ListItemText>Add Actor Marker</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleQuickAnnotation('camera_path')}>
          <ListItemIcon><Videocam fontSize="small" /></ListItemIcon>
          <ListItemText>Add Camera Path</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleQuickAnnotation('light_marker')}>
          <ListItemIcon><Lightbulb fontSize="small" /></ListItemIcon>
          <ListItemText>Add Light Position</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleQuickAnnotation('focus_area')}>
          <ListItemIcon><CropFree fontSize="small" /></ListItemIcon>
          <ListItemText>Add Focus Area</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Project Integration */}
        <Typography variant="overline" sx={{ px: 2, color: 'text.secondary', fontSize: '0.65rem' }}>
          Import from Project
        </Typography>
        <MenuItem onClick={() => handleImportFromScene('camera')}>
          <ListItemIcon><PhotoCamera fontSize="small" /></ListItemIcon>
          <ListItemText>Import Camera from Scene</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleImportFromScene('lighting')}>
          <ListItemIcon><Lightbulb fontSize="small" /></ListItemIcon>
          <ListItemText>Import Lighting Setup</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleImportFromScene('equipment')}>
          <ListItemIcon><Inventory fontSize="small" /></ListItemIcon>
          <ListItemText>Import Equipment</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Technical Metadata */}
        <Typography variant="overline" sx={{ px: 2, color: 'text.secondary', fontSize: '0.65rem' }}>
          Technical
        </Typography>
        <MenuItem onClick={handleOpenMetadata}>
          <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Metadata</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Collaboration */}
        <Typography variant="overline" sx={{ px: 2, color: 'text.secondary', fontSize: '0.65rem' }}>
          Collaboration
        </Typography>
        <MenuItem onClick={() => setCommentDialogOpen(true)}>
          <ListItemIcon><Comment fontSize="small" /></ListItemIcon>
          <ListItemText>Add Comment</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMarkApproved}>
          <ListItemIcon><CheckCircle fontSize="small" color="success" /></ListItemIcon>
          <ListItemText>Mark as Approved</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleRequestRevision}>
          <ListItemIcon><Sync fontSize="small" color="warning" /></ListItemIcon>
          <ListItemText>Request Revision</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Export */}
        <Typography variant="overline" sx={{ px: 2, color: 'text.secondary', fontSize: '0.65rem' }}>
          Export
        </Typography>
        <MenuItem onClick={handleExportPNG}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText>Export as PNG</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyToClipboard}>
          <ListItemIcon><ContentPaste fontSize="small" /></ListItemIcon>
          <ListItemText>Copy to Clipboard</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {/* Delete */}
        <MenuItem onClick={handleDelete} sx={{ color:'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete Frame</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <MetadataEditorDialog
        open={metadataDialogOpen}
        frame={frame}
        onClose={() => setMetadataDialogOpen(false)}
        onSave={handleSaveMetadata}
      />

      <ImportFromSceneDialog
        open={Boolean(importDialogType)}
        type={importDialogType}
        onClose={() => setImportDialogType(null)}
        onImport={handleImportData}
      />

      {/* Quick Comment Dialog */}
      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Enter your comment..."
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Would integrate with collaboration service
              log.debug('Add comment:', newComment);
              setNewComment('');
              setCommentDialogOpen(false);
            }}
          >
            Add Comment
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FrameContextMenu;

