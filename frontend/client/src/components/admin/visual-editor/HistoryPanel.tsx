/**
 * HistoryPanel Component
 * Shows history timeline with action descriptions and jump-to-point functionality
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Paper,
  Tooltip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  History,
  Undo,
  Redo,
  RestoreFromTrash,
  CheckCircle,
  RadioButtonUnchecked,
  Clear,
  AccessTime,
} from '@mui/icons-material';
import { useVisualEditor } from './VisualEditorContext';
import { formatDistanceToNow } from 'date-fns';

export const HistoryPanel: React.FC = () => {
  const {
    state,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useVisualEditor();

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [historyViewStart, setHistoryViewStart] = useState(0);

  type TimelineEntry = {
    id: string;
    action: string;
    description: string;
    timestamp: string;
    userName?: string;
  };

  const timelineEntries: TimelineEntry[] = state.history.map((_, index) => {
    const historyEntry = state.historyEntries[index];
    return {
      id: historyEntry?.id ?? `snapshot-${index}`,
      action: historyEntry?.action ?? 'snapshot',
      description: historyEntry?.description ?? `History state ${index + 1}`,
      timestamp: historyEntry?.timestamp ?? new Date().toISOString(),
      userName: undefined,
    };
  });

  const handleJumpTo = (index: number) => {
    if (index < 0 || index >= state.history.length || index === state.historyIndex) {
      return;
    }

    const stepCount = Math.abs(index - state.historyIndex);
    for (let step = 0; step < stepCount; step += 1) {
      if (index < state.historyIndex) {
        undo();
      } else {
        redo();
      }
    }
  };

  const handleClearHistory = () => {
    setConfirmClearOpen(true);
  };

  const executeClearHistory = () => {
    setHistoryViewStart(state.historyIndex);
    setConfirmClearOpen(false);
  };

  const undoDescription =
    state.historyIndex > historyViewStart
      ? timelineEntries[state.historyIndex - 1]?.description ?? null
      : null;
  const redoDescription = timelineEntries[state.historyIndex + 1]?.description ?? null;
  const visibleEntries = timelineEntries.slice(historyViewStart);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <History /> History
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Track and restore previous states of your project
        </Typography>
      </Box>

      {/* Undo/Redo Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Quick Actions</Typography>
            <Chip label={`${visibleEntries.length} entries`} color="primary" size="small" />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Tooltip title={undoDescription || 'Nothing to undo'}>
              <span>
                <Button variant="contained" startIcon={<Undo />} onClick={undo} disabled={!canUndo}>
                  Undo
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={redoDescription || 'Nothing to redo'}>
              <span>
                <Button variant="contained" startIcon={<Redo />} onClick={redo} disabled={!canRedo}>
                  Redo
                </Button>
              </span>
            </Tooltip>

            <Button
              variant="outlined"
              color="error"
              startIcon={<Clear />}
              onClick={handleClearHistory}
              disabled={visibleEntries.length === 0}
            >
              Clear History
            </Button>
          </Box>

          {(canUndo || canRedo) && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ display: 'block', mb: 0.5 }}>
                Next Action: </Typography>
              <Typography variant="body2">
                {canUndo && undoDescription && `← Undo: ${undoDescription}`}
                {canRedo && redoDescription && ` / Redo: ${redoDescription} →`}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* History Timeline */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            History Timeline
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Click on any point to restore that state
          </Typography>

          {visibleEntries.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
              <History sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="textSecondary">
                No history yet. Start making changes to your project.
              </Typography>
            </Paper>
          ) : (
            <List sx={{ maxHeight: 600, overflow: 'auto' }}>
              {visibleEntries.map((entry, visibleIndex) => {
                const actualIndex = historyViewStart + visibleIndex;
                const isCurrent = actualIndex === state.historyIndex;
                const isPast = actualIndex < state.historyIndex;
                const isFuture = actualIndex > state.historyIndex;

                return (
                  <React.Fragment key={entry.id}>
                    <ListItem
                      disablePadding
                      sx={{
                        borderLeft: 4,
                        borderColor: isCurrent
                          ? 'primary.main'
                          : isPast
                            ? 'success.main'
                            : 'grey.300',
                        mb: 1,
                        borderRadius: 1,
                        bgcolor: isCurrent
                          ? 'primary.light'
                          : isPast
                            ? 'background.paper'
                            : 'action.disabledBackground',
                        opacity: isFuture ? 0.5 : 1}}>
                      <ListItemButton onClick={() => handleJumpTo(actualIndex)} disabled={isCurrent}>
                        <ListItemIcon>
                          {isCurrent ? (
                            <CheckCircle color="primary" />
                          ) : (
                            <RadioButtonUnchecked color={isPast ? 'success' : 'disabled'} />
                          )}
                        </ListItemIcon>

                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">{entry.description}</Typography>
                              {isCurrent && <Chip label="Current" size="small" color="primary" />}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <AccessTime sx={{ fontSize: 14 }} />
                              <Typography variant="caption">
                                {formatDistanceToNow(new Date(entry.timestamp), {
                                  addSuffix: true,
                                })}
                              </Typography>
                              <Chip
                                label={entry.action}
                                size="small"
                                variant="outlined"
                                sx={{ textTransform: 'uppercase', fontSize: 10 }} />
                              {entry.userName && (
                                <Typography variant="caption" color="textSecondary">
                                  by {entry.userName}
                                </Typography>
                              )}
                            </Box>
                          }
                        />

                        {!isCurrent && (
                          <Tooltip title="Restore this state">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJumpTo(actualIndex);
                              }}
                            >
                              <RestoreFromTrash fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </ListItemButton>
                    </ListItem>
                    {visibleIndex < visibleEntries.length - 1 && (
                      <Divider
                        sx={{
                          ml: 4,
                          borderColor: actualIndex < state.historyIndex ? 'success.main' : 'grey.300'}} />
                    )}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Statistics
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150 }}>
              <Typography variant="caption" color="textSecondary">
                Total Entries
              </Typography>
              <Typography variant="h4">{visibleEntries.length}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150 }}>
              <Typography variant="caption" color="textSecondary">
                Current Position
              </Typography>
              <Typography variant="h4">
                {state.historyIndex >= 0 ? state.historyIndex + 1 : 0}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150 }}>
              <Typography variant="caption" color="textSecondary">
                Can Undo
              </Typography>
              <Typography variant="h4">{state.historyIndex}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, minWidth: 150 }}>
              <Typography variant="caption" color="textSecondary">
                Can Redo
              </Typography>
              <Typography variant="h4">
                {Math.max(0, state.history.length - state.historyIndex - 1)}
              </Typography>
            </Paper>
          </Box>
        </CardContent>
      </Card>

      {/* Confirm Clear History Dialog */}
      <Dialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
      >
        <DialogTitle>Clear History</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Clear all history? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearOpen(false)}>Cancel</Button>
          <Button onClick={executeClearHistory} color="error" variant="contained">
            Clear History
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
