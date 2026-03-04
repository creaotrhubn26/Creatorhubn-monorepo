/**
 * StoryboardVersionHistory - Version history and restore UI for storyboards
 */

import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('VersionHistory');
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Button,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
} from '@mui/material';
import {
  History,
  Restore,
  Delete,
  Save,
  Compare,
  Bookmark,
  BookmarkBorder,
  ExpandMore,
  ExpandLess,
  Check,
  Warning,
} from '@mui/icons-material';
import type {
  VersionSnapshot} from '../../core/storyboard/StoryboardCollaborationService';
import {
  storyboardCollaborationService
} from '../../core/storyboard/StoryboardCollaborationService';
import { Storyboard, useCurrentStoryboard, useStoryboardStore } from '../../state/storyboardStore';
import { useVirtualStudio } from '../../../VirtualStudioContext';

// =============================================================================
// Version Item Component
// =============================================================================

interface VersionItemProps {
  version: VersionSnapshot;
  isCurrent: boolean;
  onRestore: (versionId: string) => void;
  onDelete: (versionId: string) => void;
  onCompare: (versionId: string) => void;
}

const VersionItem: React.FC<VersionItemProps> = ({
  version,
  isCurrent,
  onRestore,
  onDelete,
  onCompare,
}) => {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = () => {
    switch (version.type) {
      case 'milestone':
        return <Bookmark sx={{ color: 'warning.main' }} />;
      case 'auto':
        return <History sx={{ color: 'text.secondary' }} />;
      default:
        return <Save sx={{ color: 'primary.main' }} />;
    }
  };

  const getTypeLabel = () => {
    switch (version.type) {
      case 'milestone':
        return 'Milestone';
      case 'auto':
        return 'Auto-save';
      default:
        return 'Manual';
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1,
        bgcolor: isCurrent ? 'rgba(76, 175, 80, 0.1)' : '#1e1e2e',
        borderLeft: 3,
        borderColor: isCurrent ? 'success.main' : version.type === 'milestone' ? 'warning.main' : 'divider'}}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        {/* Thumbnail */}
        {version.thumbnail && (
          <Box
            component="img"
            src={version.thumbnail}
            sx={{
              width: 80,
              height: 45,
              objectFit: 'cover',
              borderRadius: 1,
              bgcolor: '#0a0a12'}}
          />
        )}

        {/* Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {getTypeIcon()}
            <Typography variant="subtitle2" noWrap>
              {version.name}
            </Typography>
            {isCurrent && (
              <Chip
                label="Current"
                size="small"
                color="success"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
          
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {formatDate(version.createdAt)}
            </Typography>
            <Typography variant="caption" color="text.disabled">•</Typography>
            <Typography variant="caption" color="text.secondary">
              {version.frameCount} frames
            </Typography>
            <Typography variant="caption" color="text.disabled">•</Typography>
            <Chip label={getTypeLabel()} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
          </Stack>

          {version.description && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {version.description}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={0.5}>
          {!isCurrent && (
            <Tooltip title="Restore this version">
              <IconButton size="small" onClick={() => onRestore(version.id)}>
                <Restore fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Compare with current">
            <IconButton size="small" onClick={() => onCompare(version.id)}>
              <Compare fontSize="small" />
            </IconButton>
          </Tooltip>
          {version.type !== 'milestone' && (
            <Tooltip title="Delete version">
              <IconButton size="small" onClick={() => onDelete(version.id)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};

// =============================================================================
// Main Version History Panel
// =============================================================================

interface StoryboardVersionHistoryProps {
  storyboardId: string;
}

export const StoryboardVersionHistory: React.FC<StoryboardVersionHistoryProps> = ({
  storyboardId,
}) => {
  // Toast notifications
  const { addToast } = useVirtualStudio();

  const currentStoryboard = useCurrentStoryboard();
  const { updateStoryboard } = useStoryboardStore();

  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionName, setVersionName] = useState('');
  const [versionDescription, setVersionDescription] = useState('');
  const [versionType, setVersionType] = useState<'manual' | 'milestone'>('manual');

  // Load versions
  useEffect(() => {
    const loadVersions = async () => {
      setIsLoading(true);
      await storyboardCollaborationService.initialize(storyboardId);
      const loaded = storyboardCollaborationService.getVersions();
      setVersions(loaded);
      setIsLoading(false);
    };

    loadVersions();

    // Listen for updates
    const unsubscribe = storyboardCollaborationService.on((event) => {
      if (event.type.startsWith('version: ')) {
        const updated = storyboardCollaborationService.getVersions();
        setVersions(updated);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [storyboardId]);

  // Handlers
  const handleCreateVersion = async () => {
    if (!currentStoryboard) return;

    await storyboardCollaborationService.createVersion(
      currentStoryboard,
      versionDescription || undefined,
      versionType
    );

    setSaveDialogOpen(false);
    setVersionName(', ');
    setVersionDescription(', ');
    setVersionType('manual');
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersionId) return;

    const version = versions.find(v => v.id === selectedVersionId);
    const restored = await storyboardCollaborationService.restoreVersion(selectedVersionId);
    if (restored) {
      // Update the storyboard in the store
      // In production, this would properly merge/replace the storyboard
      log.debug('Restored version:', restored);
      addToast({
        message: `Restored to version "${version?.name || 'previous'}"`,
        type: 'success',
        duration: 3000,
      });
    } else {
      addToast({
        message: 'Failed to restore version',
        type: 'error',
        duration: 4000,
      });
    }

    setRestoreDialogOpen(false);
    setSelectedVersionId(null);
  };

  const handleDeleteVersion = async (versionId: string) => {
    await storyboardCollaborationService.deleteVersion(versionId);
    addToast({
      message: 'Version deleted',
      type: 'info',
      duration: 2000,
    });
  };

  const handleCompareVersion = (versionId: string) => {
    // In production, would open a comparison view
    log.debug('Compare version:', versionId);
  };

  const openRestoreDialog = (versionId: string) => {
    setSelectedVersionId(versionId);
    setRestoreDialogOpen(true);
  };

  // Find current version (most recent)
  const latestVersion = versions[0];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#12121a' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#1a1a2e',
          borderBottom: 1,
          borderColor: 'divider'}}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <History />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                Version History
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {versions.length} version{versions.length !== 1 ? 's' : ', '} saved
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => setSaveDialogOpen(true)}
            disabled={!currentStoryboard}
            size="small"
          >
            Save Version
          </Button>
        </Stack>
      </Paper>

      {/* Version List */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {isLoading ? (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            Loading versions...
          </Typography>
        ) : versions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <History sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              No versions saved yet
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Save a version to keep a snapshot of your storyboard
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Save />}
              onClick={() => setSaveDialogOpen(true)}
              sx={{ mt: 2 }}
              disabled={!currentStoryboard}
            >
              Save First Version
            </Button>
          </Box>
        ) : (
          <>
            {versions.map((version, index) => (
              <VersionItem
                key={version.id}
                version={version}
                isCurrent={index === 0}
                onRestore={openRestoreDialog}
                onDelete={handleDeleteVersion}
                onCompare={handleCompareVersion}
              />
            ))}
          </>
        )}
      </Box>

      {/* Save Version Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Version</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info" icon={<Save />}>
              This will create a snapshot of your current storyboard that you can restore later.
            </Alert>

            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              rows={2}
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder="What changes did you make?"
            />

            <Stack direction="row" spacing={1}>
              <Chip
                icon={<Save />}
                label="Regular Version"
                variant={versionType === 'manual' ? 'filled' : 'outlined'}
                onClick={() => setVersionType('manual')}
                color={versionType === 'manual' ? 'primary' : 'default'}
              />
              <Chip
                icon={<Bookmark />}
                label="Milestone"
                variant={versionType === 'milestone' ? 'filled' : 'outlined'}
                onClick={() => setVersionType('milestone')}
                color={versionType === 'milestone' ? 'warning' : 'default'}
              />
            </Stack>

            {versionType ==='milestone' && (
              <Alert severity="warning" icon={<Bookmark />}>
                Milestones are protected and cannot be deleted. Use for important checkpoints.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateVersion}>
            Save Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Version Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Restore Version</DialogTitle>
        <DialogContent>
          <Alert severity="warning" icon={<Warning />} sx={{ mt: 1 }}>
            This will replace your current storyboard with the selected version.
            Make sure to save your current work first if needed.
          </Alert>

          {selectedVersionId && (
            <Box sx={{ mt: 2 }}>
              {(() => {
                const version = versions.find(v => v.id === selectedVersionId);
                if (!version) return null;
                return (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2">{version.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(version.createdAt).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {version.frameCount} frames
                    </Typography>
                    {version.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {version.description}
                      </Typography>
                    )}
                  </Paper>
                );
              })()}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<Restore />}
            onClick={handleRestoreVersion}
          >
            Restore Version
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StoryboardVersionHistory;

