/**
 * HistoryPanel Component
 * Shows history timeline with action descriptions and jump-to-point functionality
 */

import React from 'react';
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
    jumpToHistory,
    clearHistory,
    getUndoDescription,
    getRedoDescription,
  } = useVisualEditor();

  const handleJumpTo = (index: number) => {
    jumpToHistory(index);
  };

  const handleClearHistory = () => {
    if (confirm('Clear all history? This cannot be undone.')) {
      clearHistory();
    }
  };

  const undoDescription = getUndoDescription();
  const redoDescription = getRedoDescription();

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
            <Chip label={`${state.history.length} entries`} color="primary" size="small" />
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
              disabled={state.history.length === 0}
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

          {state.history.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
              <History sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="textSecondary">
                No history yet. Start making changes to your project.
              </Typography>
            </Paper>
          ) : (
            <List sx={{ maxHeight: 600, overflow: 'auto' }}>
              {state.history.map((entry, index) => {
                const isCurrent = index === state.historyIndex;
                const isPast = index < state.historyIndex;
                const isFuture = index > state.historyIndex;

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
                      <ListItemButton onClick={() => handleJumpTo(index)} disabled={isCurrent}>
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
                                handleJumpTo(index);
                              }}
                            >
                              <RestoreFromTrash fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </ListItemButton>
                    </ListItem>
                    {index < state.history.length - 1 && (
                      <Divider
                        sx={{
                          ml: 4,
                          borderColor: index < state.historyIndex ? 'success.main' : 'grey.300'}} />
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
              <Typography variant="h4">{state.history.length}</Typography>
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
    </Box>
  );
};
