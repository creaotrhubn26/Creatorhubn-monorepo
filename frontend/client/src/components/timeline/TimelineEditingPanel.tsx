// @ts-nocheck
/**
 * TIMELINE EDITING PANEL
 * Real editing operations: Trim, Ripple, Split, Save/Load
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  ButtonGroup,
  Button,
  IconButton,
  Divider,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  Stack,
} from '@mui/material';
import {
  ContentCut,
  CallSplit,
  Delete,
  Save,
  FolderOpen,
  Undo,
  Redo,
} from '@mui/icons-material';
import type { BeatClip } from '../services/storyArcDataIntegration';
import { timelineEngine } from '../services/timeline-engine';

interface TimelineEditingPanelProps {
  selectedClips: BeatClip[];
  allClips: BeatClip[];
  currentTime: number;
  onClipsUpdate: (clips: BeatClip[]) => void;
  onSave: (projectData: any) => Promise<void>;
  onLoad: (projectId: string) => Promise<void>;
}

export default function TimelineEditingPanel({
  selectedClips,
  allClips,
  currentTime,
  onClipsUpdate,
  onSave,
  onLoad
}: TimelineEditingPanelProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  /**
   * Trim selected clip to current in/out points
   */
  const handleTrim = () => {
    if (selectedClips.length !== 1) return;
    
    const clip = selectedClips[0];
    const inPoint = prompt('Enter in point (seconds):', '0');
    const outPoint = prompt('Enter out point (seconds):', clip.duration.toString());
    
    if (inPoint && outPoint) {
      const trimmed = timelineEngine.trimClip(clip, parseFloat(inPoint), parseFloat(outPoint));
      const updated = allClips.map(c => c.id === clip.id ? trimmed : c);
      onClipsUpdate(updated);
    }
  };

  /**
   * Split clip at playhead
   */
  const handleSplit = () => {
    if (selectedClips.length !== 1) return;
    
    const clip = selectedClips[0];
    
    // Check if playhead is within clip
    if (currentTime <= clip.start || currentTime >= clip.start + clip.duration) {
      alert('Playhead must be within the selected clip to split');
      return;
    }
    
    const [clip1, clip2] = timelineEngine.splitClip(clip, currentTime);
    const updated = allClips.filter(c => c.id !== clip.id);
    updated.push(clip1, clip2);
    
    onClipsUpdate(updated);
  };

  /**
   * Ripple delete - delete clip and shift everything after it
   */
  const handleRippleDelete = () => {
    if (selectedClips.length === 0) return;
    
    selectedClips.forEach(selectedClip => {
      const result = timelineEngine.rippleEdit(
        allClips,
        selectedClip.id,
        selectedClip.start
      );
      
      // Remove the clip
      const updated = allClips.filter(c => c.id !== selectedClip.id);
      
      // Apply ripple shifts
      result.newPositions.forEach((newStart, clipId) => {
        const clip = updated.find(c => c.id === clipId);
        if (clip) {
          clip.start = newStart;
        }
      });
      
      onClipsUpdate(updated);
    });
  };

  /**
   * Save project to database
   */
  const handleSave = async () => {
    if (!projectName) return;
    
    const projectData = {
      name: projectName,
      clips: allClips,
      duration: timelineEngine.calculateDuration(allClips),
      edl: timelineEngine.generateEDL(allClips, []), // TODO: Add tracks
      createdAt: new Date().toISOString()
    };
    
    await onSave(projectData);
    setShowSaveDialog(false);
    setProjectName(', ');
  };

  return (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600}}>
        Editing Tools
      </Typography>
      
      <Stack direction="column" spacing={2}>
        {/* Primary Edit Operations */}
        <Box>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
            Clip Operations
          </Typography>
          <ButtonGroup variant="outlined" size="small" fullWidth>
            <Tooltip title="Trim In/Out Points">
              <Button
                onClick={handleTrim}
                disabled={selectedClips.length !== 1}
                startIcon={<ContentCut />}
              >
                Trim
              </Button>
            </Tooltip>
            <Tooltip title="Split at Playhead (S)">
              <Button
                onClick={handleSplit}
                disabled={selectedClips.length !== 1}
                startIcon={<CallSplit />}
              >
                Split
              </Button>
            </Tooltip>
            <Tooltip title="Ripple Delete">
              <Button
                onClick={handleRippleDelete}
                disabled={selectedClips.length === 0}
                startIcon={<Delete />}
                color="error"
              >
                Ripple Del
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Box>

        <Divider />

        {/* Project Management */}
        <Box>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
            Project
          </Typography>
          <ButtonGroup variant="outlined" size="small" fullWidth>
            <Button
              onClick={() => setShowSaveDialog(true)}
              startIcon={<Save />}
            >
              Save
            </Button>
            <Button
              onClick={() => setShowLoadDialog(true)}
              startIcon={<FolderOpen />}
            >
              Load
            </Button>
          </ButtonGroup>
        </Box>

        {/* Selection Info */}
        {selectedClips.length > 0 && (
          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600}}>
              Selected: {selectedClips.length} clip(s)
            </Typography>
            {selectedClips.map(clip => (
              <Chip
                key={clip.id}
                label={clip.beatName}
                size="small"
                sx={{ mt: 0.5, mr: 0.5 }}
              />
            ))}
          </Box>
        )}
      </Stack>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)}>
        <DialogTitle>Save Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!projectName}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onClose={() => setShowLoadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Load Project</DialogTitle>
        <DialogContent>
          <List>
            {savedProjects.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary="No saved projects"
                  secondary="Save your first project to see it here"
                />
              </ListItem>
            ) : (
              savedProjects.map(project => (
                <ListItem
                  key={project.id}
                  button
                  onClick={() => {
                    onLoad(project.id);
                    setShowLoadDialog(false);
                  }}
                >
                  <ListItemText
                    primary={project.name}
                    secondary={`${project.clips?.length || 0} clips • ${new Date(project.createdAt).toLocaleDateString()}`}
                  />
                </ListItem>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLoadDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

