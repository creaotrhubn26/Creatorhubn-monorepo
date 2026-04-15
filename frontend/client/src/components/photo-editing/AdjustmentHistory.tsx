// @ts-nocheck
/**
 * ADJUSTMENT HISTORY
 * Lightroom-style undo/redo stack for photo editing
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
} from '@mui/material';
import {
  Undo,
  Redo,
  History,
  Clear,
  CheckCircle,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export interface HistoryState {
  id: string;
  actionName: string;
  actionType: string;
  timestamp: Date;
  adjustments: any;
  previewImageUrl?: string;
}

interface AdjustmentHistoryProps {
  history: HistoryState[];
  currentIndex: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onJumpToState?: (index: number) => void;
  onClearHistory?: () => void;
  maxHistorySize?: number;
}

export default function AdjustmentHistory({
  history,
  currentIndex,
  onUndo,
  onRedo,
  onJumpToState,
  onClearHistory,
  maxHistorySize = 50,
}: AdjustmentHistoryProps) {
  const theming = useTheming('photographer');
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (canUndo) {
      onUndo?.();
    }
  }, [canUndo, onUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      onRedo?.();
    }
  }, [canRedo, onRedo]);

  const formatActionName = (actionName: string): string => {
    return actionName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <History />
            History
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Undo">
              <span>
                <IconButton
                  size="small"
                  onClick={handleUndo}
                  disabled={!canUndo}
                >
                  <Undo />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Redo">
              <span>
                <IconButton
                  size="small"
                  onClick={handleRedo}
                  disabled={!canRedo}
                >
                  <Redo />
                </IconButton>
              </span>
            </Tooltip>
            {onClearHistory && (
              <Tooltip title="Clear History">
                <IconButton
                  size="small"
                  onClick={onClearHistory}
                  disabled={history.length === 0}
                >
                  <Clear />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* History List */}
        {history.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No history yet. Start editing to see your adjustment history.
          </Typography>
        ) : (
          <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
            {history.map((state, index) => {
              const isCurrent = index === currentIndex;
              const isPast = index < currentIndex;
              
              return (
                <ListItem
                  key={state.id}
                  button
                  onClick={() => onJumpToState?.(index)}
                  selected={isCurrent}
                  sx={{
                    bgcolor: isCurrent ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    cursor: 'pointer'
                  }}
                >
                  <ListItemIcon>
                    {isCurrent ? (
                      <CheckCircle color="primary" fontSize="small" />
                    ) : (
                      <History fontSize="small" color={isPast ? 'action' : 'disabled'} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={formatActionName(state.actionName)}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip
                          label={state.actionType}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '10px' }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(state.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}

        <Typography variant="caption" color="text.secondary">
          {history.length} / {maxHistorySize} history states
        </Typography>
      </Stack>
    </Paper>
  );
}

