/**
 * SNAPSHOT PANEL
 * Lightroom-style snapshot system for before/after comparison
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  CompareArrows,
  CameraAlt,
  Star,
  StarBorder,
  MoreVert,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export interface Snapshot {
  id: string;
  name: string;
  type: 'manual' | 'auto' | 'checkpoint';
  createdAt: Date;
  previewImageUrl?: string;
  adjustments: any;
  toneCurves?: any;
  hslAdjustments?: any;
  masks?: any[];
  transform?: any;
  isFavorite?: boolean;
}

interface SnapshotPanelProps {
  snapshots: Snapshot[];
  currentSnapshotId?: string;
  onSnapshotCreate?: (name: string, type?: 'manual' | 'auto' | 'checkpoint') => Promise<Snapshot>;
  onSnapshotSelect?: (snapshot: Snapshot) => void;
  onSnapshotDelete?: (snapshotId: string) => Promise<void>;
  onSnapshotRename?: (snapshotId: string, newName: string) => Promise<void>;
  onSnapshotCompare?: (snapshot1: Snapshot, snapshot2: Snapshot) => void;
}

export default function SnapshotPanel({
  snapshots,
  currentSnapshotId,
  onSnapshotCreate,
  onSnapshotSelect,
  onSnapshotDelete,
  onSnapshotRename,
  onSnapshotCompare,
}: SnapshotPanelProps) {
  const theming = useTheming('photographer');
  const [openDialog, setOpenDialog] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotType, setSnapshotType] = useState<'manual' | 'auto' | 'checkpoint'>('manual');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');

  const handleCreateSnapshot = useCallback(async () => {
    if (!snapshotName.trim()) return;
    
    await onSnapshotCreate?.(snapshotName, snapshotType);
    setOpenDialog(false);
    setSnapshotName('');
    setSnapshotType('manual');
  }, [snapshotName, snapshotType, onSnapshotCreate]);

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, snapshot: Snapshot) => {
    setAnchorEl(event.currentTarget);
    setSelectedSnapshot(snapshot);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedSnapshot(null);
  }, []);

  const handleDeleteSnapshot = useCallback(async () => {
    if (selectedSnapshot) {
      setConfirmDeleteOpen(true);
    }
  }, [selectedSnapshot]);

  const executeDeleteSnapshot = useCallback(async () => {
    if (selectedSnapshot) {
      await onSnapshotDelete?.(selectedSnapshot.id);
      handleMenuClose();
    }
    setConfirmDeleteOpen(false);
  }, [selectedSnapshot, onSnapshotDelete, handleMenuClose]);

  const handleRenameSnapshot = useCallback(async () => {
    if (!selectedSnapshot) return;
    setNewSnapshotName(selectedSnapshot.name);
    setRenameDialogOpen(true);
    handleMenuClose();
  }, [selectedSnapshot, handleMenuClose]);

  const executeRenameSnapshot = useCallback(async () => {
    if (selectedSnapshot && newSnapshotName.trim() && newSnapshotName !== selectedSnapshot.name) {
      await onSnapshotRename?.(selectedSnapshot.id, newSnapshotName.trim());
    }
    setRenameDialogOpen(false);
    setNewSnapshotName('');
  }, [selectedSnapshot, newSnapshotName, onSnapshotRename]);

  const sortedSnapshots = [...snapshots].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt />
            Snapshots
          </Typography>
          <Button
            startIcon={<Add />}
            variant="contained"
            onClick={() => setOpenDialog(true)}
          >
            Create Snapshot
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Save different versions of your edits for easy comparison
        </Typography>

        {/* Snapshots Grid */}
        {sortedSnapshots.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No snapshots yet. Create your first snapshot to save the current state.
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {sortedSnapshots.map((snapshot) => {
              const isCurrent = snapshot.id === currentSnapshotId;
              
              return (
                <Grid item xs={12} sm={6} md={4} key={snapshot.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: isCurrent ? 2 : 1,
                      borderColor: isCurrent ? 'primary.main' : 'divider', '&:hover': { boxShadow: 4 }}}
                    onClick={() => onSnapshotSelect?.(snapshot)}
                  >
                    {snapshot.previewImageUrl && (
                      <Box
                        sx={{
                          width: '100%',
                          height: 120,
                          backgroundImage: `url(${snapshot.previewImageUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'}}
                      />
                    )}
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1">{snapshot.name}</Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            <Chip
                              label={snapshot.type}
                              size="small"
                              color={snapshot.type === 'checkpoint' ? 'primary' : 'default'}
                              sx={{ fontSize: '10px', height: 20 }}
                            />
                            {isCurrent && (
                              <Chip
                                label="Current"
                                size="small"
                                color="primary"
                                sx={{ fontSize: '10px', height: 20 }}
                              />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display:'block', mt: 0.5 }}>
                            {new Date(snapshot.createdAt).toLocaleString()}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMenuOpen(e, snapshot);
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<CompareArrows />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentSnapshotId) {
                            const currentSnapshot = snapshots.find(s => s.id === currentSnapshotId);
                            if (currentSnapshot) {
                              onSnapshotCompare?.(currentSnapshot, snapshot);
                            }
                          }
                        }}
                        disabled={!currentSnapshotId || snapshot.id === currentSnapshotId}
                      >
                        Compare
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        {/* Snapshot Menu */}
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={handleRenameSnapshot}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Rename
          </MenuItem>
          <MenuItem onClick={handleDeleteSnapshot}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        </Menu>

        {/* Create Snapshot Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create Snapshot</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Snapshot Name"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                fullWidth
                required
                placeholder="e.g., Before Color Grading"
                autoFocus
              />
              <TextField
                label="Type"
                value={snapshotType}
                onChange={(e) => setSnapshotType(e.target.value as any)}
                fullWidth
                select
                SelectProps={{ native: false }}
              >
                <MenuItem value="manual">Manual</MenuItem>
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="checkpoint">Checkpoint</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreateSnapshot}
              disabled={!snapshotName.trim()}
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirm Delete Dialog */}
        <Dialog
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
        >
          <DialogTitle>Delete Snapshot</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Delete snapshot "{selectedSnapshot?.name}"? This cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button onClick={executeDeleteSnapshot} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Rename Snapshot Dialog */}
        <Dialog
          open={renameDialogOpen}
          onClose={() => setRenameDialogOpen(false)}
        >
          <DialogTitle>Rename Snapshot</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="New Name"
              fullWidth
              value={newSnapshotName}
              onChange={(e) => setNewSnapshotName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSnapshotName.trim()) {
                  executeRenameSnapshot();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={executeRenameSnapshot} 
              variant="contained"
              disabled={!newSnapshotName.trim()}
            >
              Rename
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}

