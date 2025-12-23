/**
 * SceneComparison - Before/After scene comparison viewer
 * 
 * Features:
 * - Slider comparison between snapshots
 * - Side-by-side view
 * - Snapshot management
 * - Export comparison images
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('SceneComparison, ');
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Tooltip,
  Divider,
  Alert,
} from '@mui/material';
import {
  CompareArrows,
  ViewColumn,
  ViewCarousel,
  CameraAlt,
  Delete,
  Download,
  Save,
  Restore,
  Add,
  Close,
  ChevronLeft,
  ChevronRight,
  PlayArrow,
} from '@mui/icons-material';
import { snapshotsApi } from '../../core/api/virtualStudioApi';

// ============================================================================
// Types
// ============================================================================

export interface SceneSnapshot {
  id: string;
  name: string;
  timestamp: number;
  imageDataUrl: string;
  sceneData: any; // Serialized scene state
  presetId?: string;
  description?: string;
}

type ComparisonMode = 'slider' | 'side-by-side' | 'overlay';

// ============================================================================
// Snapshot Manager
// ============================================================================

class SnapshotManager {
  private snapshots: SceneSnapshot[] = [];
  private maxSnapshots = 10;
  private listeners: Set<(snapshots: SceneSnapshot[]) => void> = new Set();
  private currentSceneId: string | null = null;

  setSceneId(sceneId: string): void {
    this.currentSceneId = sceneId;
  }

  getSnapshots(): SceneSnapshot[] {
    return [...this.snapshots];
  }

  async addSnapshot(snapshot: Omit<SceneSnapshot, 'id' | 'timestamp'>): Promise<SceneSnapshot> {
    const newSnapshot: SceneSnapshot = {
      ...snapshot,
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.snapshots.push(newSnapshot);

    // Trim if over limit
    if (this.snapshots.length > this.maxSnapshots) {
      const removed = this.snapshots.shift();
      // Delete from database if exists
      if (removed) {
        snapshotsApi.delete(removed.id).catch(() => {});
      }
    }

    this.notify();
    this.save();
    
    // Save to database
    if (this.currentSceneId) {
      try {
        await snapshotsApi.create({
          sceneId: this.currentSceneId,
          name: snapshot.name,
          description: snapshot.description,
          thumbnailUrl: snapshot.imageDataUrl,
          sceneState: snapshot.sceneData,
        });
      } catch (e) {
        log.warn('Failed to save snapshot to database: ', e);
      }
    }
    
    return newSnapshot;
  }

  async removeSnapshot(id: string): Promise<boolean> {
    const index = this.snapshots.findIndex((s) => s.id === id);
    if (index === -1) return false;
    this.snapshots.splice(index, 1);
    this.notify();
    this.save();
    
    // Delete from database
    try {
      await snapshotsApi.delete(id);
    } catch (e) {
      log.warn('Failed to delete snapshot from database:', e);
    }
    
    return true;
  }

  getSnapshot(id: string): SceneSnapshot | undefined {
    return this.snapshots.find((s) => s.id === id);
  }

  clear(): void {
    this.snapshots = [];
    this.notify();
    this.save();
  }

  subscribe(listener: (snapshots: SceneSnapshot[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshots());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshots = this.getSnapshots();
    this.listeners.forEach((l) => l(snapshots));
  }

  // Persistence - localStorage as backup cache
  // Note: Individual add/delete operations already sync to DB
  // This method is for bulk localStorage backup
  save(): void {
    try {
      localStorage.setItem('vs_snapshots', JSON.stringify(this.snapshots));
    } catch (e) {
      log.warn('Failed to save snapshots to localStorage:', e);
    }
  }

  // Sync all snapshots to database (for migration/recovery)
  async syncAllToDatabase(): Promise<void> {
    if (!this.currentSceneId) {
      log.warn('Cannot sync snapshots: no scene ID');
      return;
    }

    for (const snapshot of this.snapshots) {
      try {
        await snapshotsApi.create({
          sceneId: this.currentSceneId,
          name: snapshot.name,
          description: snapshot.description,
          thumbnailUrl: snapshot.imageDataUrl,
          sceneState: snapshot.sceneData,
          cameraState: snapshot.sceneData?.camera,
          nodeCount: snapshot.sceneData?.nodes?.length || 0,
          lightCount: snapshot.sceneData?.lights?.length || 0,
        });
      } catch (e) {
        log.warn(`Failed to sync snapshot ${snapshot.id} to database:`, e);
      }
    }
  }

  async load(sceneId?: string): Promise<void> {
    if (sceneId) {
      this.currentSceneId = sceneId;
    }
    
    // Try database first
    if (this.currentSceneId) {
      try {
        const dbSnapshots = await snapshotsApi.list(this.currentSceneId);
        if (dbSnapshots && dbSnapshots.length > 0) {
          this.snapshots = dbSnapshots.map((s: any) => ({
            id: s.id,
            name: s.name,
            timestamp: new Date(s.createdAt).getTime(),
            imageDataUrl: s.thumbnailUrl || '',
            sceneData: s.sceneState,
            description: s.description,
          }));
          this.notify();
          return;
        }
      } catch (e) {
        log.warn('Failed to load snapshots from database:', e);
      }
    }
    
    // Fallback to localStorage
    try {
      const data = localStorage.getItem('vs_snapshots');
      if (data) {
        this.snapshots = JSON.parse(data);
        this.notify();
      }
    } catch (e) {
      log.warn('Failed to load snapshots:', e);
    }
  }
}

export const snapshotManager = new SnapshotManager();

// ============================================================================
// Comparison Slider Component
// ============================================================================

interface ComparisonSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
}

function ComparisonSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: ComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove as any);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove as any);
    };
  }, [handleMouseUp, handleMouseMove]);

  return (
    <Box
      ref={containerRef}
      onMouseDown={handleMouseDown}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: 'ew-resize',
        userSelect: 'none'}}
    >
      {/* After Image (Full width, behind) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${afterImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'}}
      />

      {/* Before Image (Clipped) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${sliderPosition}%`,
          overflow: 'hidden'}}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: containerRef.current?.offsetWidth || '100%',
            height: '100%',
            backgroundImage: `url(${beforeImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'}}
        />
      </Box>

      {/* Slider Line */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${sliderPosition}%`,
          width: 4,
          backgroundColor: '#fff',
          transform: 'translateX(-50%)',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          zIndex: 1}}
      >
        {/* Handle */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)'}}
        >
          <CompareArrows sx={{ color: '#333' }} />
        </Box>
      </Box>

      {/* Labels */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          px: 2,
          py: 0.5,
          borderRadius: 1,
          fontSize: 12,
          fontWeight: 600}}
      >
        {beforeLabel}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          px: 2,
          py: 0.5,
          borderRadius: 1,
          fontSize: 12,
          fontWeight: 600}}
      >
        {afterLabel}
      </Box>
    </Box>
  );
}

// ============================================================================
// Side by Side Component
// ============================================================================

interface SideBySideProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
}

function SideBySide({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: SideBySideProps) {
  return (
    <Box sx={{ display: 'flex', height: '100%', gap: 1 }}>
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${beforeImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: 1}}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            fontWeight: 600}}
        >
          {beforeLabel}
        </Box>
      </Box>
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${afterImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: 1}}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            fontSize: 12,
            fontWeight: 600}}
        >
          {afterLabel}
        </Box>
      </Box>
    </Box>
  );
}

// ============================================================================
// Scene Comparison Panel
// ============================================================================

interface SceneComparisonPanelProps {
  onCaptureSnapshot?: () => string | null; // Returns data URL
  onRestoreSnapshot?: (sceneData: any) => void;
}

export function SceneComparisonPanel({
  onCaptureSnapshot,
  onRestoreSnapshot,
}: SceneComparisonPanelProps) {
  const [snapshots, setSnapshots] = useState<SceneSnapshot[]>([]);
  const [selectedBefore, setSelectedBefore] = useState<string | null>(null);
  const [selectedAfter, setSelectedAfter] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('slider');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [pendingImageData, setPendingImageData] = useState<string | null>(null);

  // Subscribe to snapshots
  useEffect(() => {
    snapshotManager.load();
    return snapshotManager.subscribe(setSnapshots);
  }, []);

  // Auto-save snapshots
  useEffect(() => {
    snapshotManager.save();
  }, [snapshots]);

  const handleCapture = useCallback(() => {
    if (!onCaptureSnapshot) return;

    const imageData = onCaptureSnapshot();
    if (imageData) {
      setPendingImageData(imageData);
      setNewSnapshotName(`Snapshot ${snapshots.length + 1}`);
      setShowNameDialog(true);
    }
  }, [onCaptureSnapshot, snapshots.length]);

  const handleSaveSnapshot = useCallback(() => {
    if (!pendingImageData) return;

    const snapshot = snapshotManager.addSnapshot({
      name: newSnapshotName || `Snapshot ${snapshots.length + 1}`,
      imageDataUrl: pendingImageData,
      sceneData: {}, // Would include actual scene data
    });

    // Auto-select new snapshot
    if (!selectedBefore) {
      setSelectedBefore(snapshot.id);
    } else if (!selectedAfter) {
      setSelectedAfter(snapshot.id);
    }

    setShowNameDialog(false);
    setPendingImageData(null);
    setNewSnapshotName('');
  }, [pendingImageData, newSnapshotName, snapshots.length, selectedBefore, selectedAfter]);

  const handleDelete = useCallback((id: string) => {
    snapshotManager.removeSnapshot(id);
    if (selectedBefore === id) setSelectedBefore(null);
    if (selectedAfter === id) setSelectedAfter(null);
  }, [selectedBefore, selectedAfter]);

  const handleRestore = useCallback((snapshot: SceneSnapshot) => {
    if (onRestoreSnapshot && snapshot.sceneData) {
      onRestoreSnapshot(snapshot.sceneData);
    }
  }, [onRestoreSnapshot]);

  const beforeSnapshot = selectedBefore ? snapshotManager.getSnapshot(selectedBefore) : null;
  const afterSnapshot = selectedAfter ? snapshotManager.getSnapshot(selectedAfter) : null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CompareArrows />
            <Typography variant="h6" fontWeight={700}>
              Scene Comparison
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<CameraAlt />}
            onClick={handleCapture}
            disabled={!onCaptureSnapshot}
          >
            Capture
          </Button>
        </Box>

        {/* Mode Toggle */}
        <ToggleButtonGroup
          value={comparisonMode}
          exclusive
          onChange={(_, v) => v && setComparisonMode(v)}
          size="small"
          fullWidth
        >
          <ToggleButton value="slider">
            <Tooltip title="Slider">
              <CompareArrows fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="side-by-side">
            <Tooltip title="Side by Side">
              <ViewColumn fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="overlay">
            <Tooltip title="Overlay">
              <ViewCarousel fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Comparison View */}
      <Box sx={{ flex: 1, p: 2, minHeight: 200 }}>
        {beforeSnapshot && afterSnapshot ? (
          comparisonMode === 'slider' ? (
            <ComparisonSlider
              beforeImage={beforeSnapshot.imageDataUrl}
              afterImage={afterSnapshot.imageDataUrl}
              beforeLabel={beforeSnapshot.name}
              afterLabel={afterSnapshot.name}
            />
          ) : comparisonMode === 'side-by-side' ? (
            <SideBySide
              beforeImage={beforeSnapshot.imageDataUrl}
              afterImage={afterSnapshot.imageDataUrl}
              beforeLabel={beforeSnapshot.name}
              afterLabel={afterSnapshot.name}
            />
          ) : (
            <Box sx={{ position: 'relative', height: '100%' }}>
              {/* Overlay mode - toggle between images */}
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${afterSnapshot.imageDataUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRadius: 1}}
              />
            </Box>
          )
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#1a1a1a',
              borderRadius: 1,
              border: '2px dashed #333'}}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CompareArrows sx={{ fontSize: 48, color: '#444', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Select two snapshots to compare
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Snapshot Selection */}
      <Box sx={{ p: 2, borderTop: '1px solid #333' }}>
        <Typography variant="subtitle2" gutterBottom>
          Snapshots ({snapshots.length})
        </Typography>
        
        {snapshots.length === 0 ? (
          <Alert severity="info" sx={{ py: 0.5 }}>
            Capture snapshots before and after loading presets
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
            {snapshots.map((snapshot) => (
              <Paper
                key={snapshot.id}
                elevation={0}
                sx={{
                  minWidth: 100,
                  p: 1,
                  backgroundColor:
                    selectedBefore === snapshot.id
                      ? '#2a3a2a'
                      : selectedAfter === snapshot.id
                      ? '#2a2a3a'
                      : '#252530',
                  border: `2px solid ${
                    selectedBefore === snapshot.id
                      ? '#4caf50'
                      : selectedAfter === snapshot.id
                      ? '#2196f3'
                      : 'transparent'
                  }`,
                  borderRadius: 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s', '&:hover': {
                    borderColor: '#666',
                  }}}
                onClick={() => {
                  if (!selectedBefore || selectedBefore === snapshot.id) {
                    setSelectedBefore(selectedBefore === snapshot.id ? null : snapshot.id);
                  } else if (!selectedAfter || selectedAfter === snapshot.id) {
                    setSelectedAfter(selectedAfter === snapshot.id ? null : snapshot.id);
                  } else {
                    setSelectedBefore(snapshot.id);
                  }
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 50,
                    backgroundImage: `url(${snapshot.imageDataUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 0.5,
                    mb: 0.5}}
                />
                <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                  {snapshot.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(snapshot.timestamp)}
                </Typography>
                {(selectedBefore === snapshot.id || selectedAfter === snapshot.id) && (
                  <Chip
                    label={selectedBefore === snapshot.id ? 'Before' : 'After'}
                    size="small"
                    color={selectedBefore === snapshot.id ? 'success' : 'primary'}
                    sx={{ height: 16, fontSize: 9, mt: 0.5 }}
                  />
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onClose={() => setShowNameDialog(false)}>
        <DialogTitle>Name Snapshot</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            value={newSnapshotName}
            onChange={(e) => setNewSnapshotName(e.target.value)}
            label="Snapshot Name"
            placeholder="e.g., Before Preset Load"
            autoFocus
            sx={{ mt: 1 }}
          />
          {pendingImageData && (
            <Box
              sx={{
                mt: 2,
                width: '100%',
                height: 150,
                backgroundImage: `url(${pendingImageData})`,
                backgroundSize: 'cover',
                backgroundPosition:'center',
                borderRadius: 1}}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNameDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveSnapshot} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SceneComparisonPanel;

