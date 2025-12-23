/**
 * HistoryPanel - Visual undo/redo history stack
 * 
 * Features:
 * - Visual timeline of actions
 * - Click to jump to any state
 * - Action details and timestamps
 * - Undo/Redo buttons
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('HistoryPanel');
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Paper,
  Button,
  ButtonGroup,
  Badge,
  Alert,
} from '@mui/material';
import {
  Undo,
  Redo,
  History,
  Add,
  Delete,
  OpenWith,
  RotateRight,
  ZoomOutMap,
  Settings,
  Group,
  Link,
  LinkOff,
  Layers,
  Clear,
  PlaylistAdd,
  Circle,
} from '@mui/icons-material';
import { undoRedoService, Action, UndoRedoState } from '../../core/services/undoRedoService';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchIconButton, TouchSwipeListItem } from '../components/TabletAwarePanels';
import { useAccessibility, useAnnounce, VisuallyHidden } from '../../providers/AccessibilityProvider';
import { AccessibleButton, AccessibleList } from '../components/AccessibleComponents';

// ============================================================================
// Action Icon Mapping
// ============================================================================

const ACTION_ICONS: Record<string, React.ReactNode> = {
  ADD_EQUIPMENT: <Add fontSize="small" />,
  DELETE_EQUIPMENT: <Delete fontSize="small" />,
  MOVE: <OpenWith fontSize="small" />,
  ROTATE: <RotateRight fontSize="small" />,
  SCALE: <ZoomOutMap fontSize="small" />,
  UPDATE_PROPERTY: <Settings fontSize="small" />,
  GROUP: <Group fontSize="small" />,
  UNGROUP: <Layers fontSize="small" />,
  LINK: <Link fontSize="small" />,
  UNLINK: <LinkOff fontSize="small" />,
  BATCH: <PlaylistAdd fontSize="small" />,
  LOAD_PRESET: <Layers fontSize="small" />,
  CLEAR_SCENE: <Clear fontSize="small" />,
};

const ACTION_COLORS: Record<string, string> = {
  ADD_EQUIPMENT: '#4caf50',
  DELETE_EQUIPMENT: '#f44336',
  MOVE: '#2196f3',
  ROTATE: '#ff9800',
  SCALE: '#9c27b0',
  UPDATE_PROPERTY: '#607d8b',
  GROUP: '#00bcd4',
  UNGROUP: '#00bcd4',
  LINK: '#e91e63',
  UNLINK: '#e91e63',
  BATCH: '#795548',
  LOAD_PRESET: '#3f51b5',
  CLEAR_SCENE: '#f44336',
};

// ============================================================================
// Action Item Component
// ============================================================================

interface ActionItemProps {
  action: Action;
  index: number;
  isCurrentState: boolean;
  isFuture: boolean;
  onClick: () => void;
  isTouch?: boolean;
}

function ActionItem({ action, index, isCurrentState, isFuture, onClick, isTouch = false }: ActionItemProps) {
  const timeAgo = getTimeAgo(action.timestamp);
  const icon = ACTION_ICONS[action.type] || <Circle fontSize="small" />;
  const color = ACTION_COLORS[action.type] || '#666';

  const content = (
    <ListItem disablePadding>
      <ListItemButton
        onClick={onClick}
        selected={isCurrentState}
        sx={{
          opacity: isFuture ? 0.5 : 1,
          borderLeft: `3px solid ${isCurrentState ? color : 'transparent'}`,
          minHeight: isTouch ? 56 : 48, '&.Mui-selected': {
            backgroundColor: `${color}22`,
          }, '&:hover': {
            backgroundColor: `${color}11`,
          }, '&:active': isTouch ? {
            backgroundColor: `${color}22`,
          } : undefined}}
      >
        <ListItemIcon sx={{ minWidth: isTouch ? 44 : 36, color }}>
          {icon}
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant={isTouch ? 'body1' : 'body2'} noWrap sx={{ flex: 1 }}>
                {action.description}
              </Typography>
              {isCurrentState && (
                <Chip 
                  label="Current" 
                  size="small" 
                  sx={{ height: isTouch ? 22 : 18, fontSize: isTouch ? 11 : 10 }} 
                />
              )}
            </Box>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {timeAgo}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );

  // On touch devices, wrap with swipe capability
  if (isTouch) {
    return (
      <TouchSwipeListItem
        onSwipeLeft={() => {
          // Could implement action removal in the future
          log.debug('Swiped left on action:', action.id);
        }}
        leftAction={<Delete sx={{ color: '#fff' }} />}
      >
        {content}
      </TouchSwipeListItem>
    );
  }

  return content;
}

// ============================================================================
// Time Formatting
// ============================================================================

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================================================================
// History Panel Component
// ============================================================================

interface HistoryPanelProps {
  compact?: boolean;
  maxVisible?: number;
}

export function HistoryPanel({ compact = false, maxVisible = 20 }: HistoryPanelProps) {
  // Tablet support
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Accessibility
  const { announce } = useAnnounce();
  const { prefersKeyboard } = useAccessibility();

  const [state, setState] = useState<UndoRedoState>({
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    lastAction: null,
  });

  // Subscribe to undo/redo state changes
  useEffect(() => {
    const unsubscribe = undoRedoService.subscribe(setState);
    return unsubscribe;
  }, []);

  const handleUndo = useCallback(() => {
    const action = undoRedoService.undo();
    if (action) {
      announce(`Undid: ${action.description}`);
    } else {
      announce('Nothing to undo');
    }
  }, [announce]);

  const handleRedo = useCallback(() => {
    const action = undoRedoService.redo();
    if (action) {
      announce(`Redid: ${action.description}`);
    } else {
      announce('Nothing to redo');
    }
  }, [announce]);

  const handleClearHistory = useCallback(() => {
    undoRedoService.clear();
    announce('History cleared');
  }, [announce]);

  const handleJumpToAction = useCallback((index: number) => {
    // Calculate how many undos/redos needed
    const currentIndex = state.undoStack.length - 1;
    const diff = currentIndex - index;

    if (diff > 0) {
      // Need to undo
      for (let i = 0; i < diff; i++) {
        undoRedoService.undo();
      }
    } else if (diff < 0) {
      // Need to redo
      for (let i = 0; i < Math.abs(diff); i++) {
        undoRedoService.redo();
      }
    }
  }, [state.undoStack.length]);

  // Combine undo and redo stacks for display
  const allActions = [...state.undoStack, ...state.redoStack.slice().reverse()];
  const currentIndex = state.undoStack.length - 1;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <History />
            <Typography variant={compact ? 'subtitle2' : 'h6'} fontWeight={700}>
              History
            </Typography>
            <Badge badgeContent={allActions.length} color="primary" max={99}>
              <Box />
            </Badge>
          </Box>
        </Box>

        {/* Undo/Redo Buttons */}
        <ButtonGroup fullWidth size={isTouch ? 'large' : 'small'} sx={{ mb: 1 }}>
          <Button
            startIcon={<Undo />}
            onClick={handleUndo}
            disabled={!state.canUndo}
            sx={isTouch ? { py: 1.5 } : undefined}
          >
            Undo
          </Button>
          <Button
            endIcon={<Redo />}
            onClick={handleRedo}
            disabled={!state.canRedo}
            sx={isTouch ? { py: 1.5 } : undefined}
          >
            Redo
          </Button>
        </ButtonGroup>

        {/* Current action indicator */}
        {state.lastAction && (
          <Paper
            elevation={0}
            sx={{
              p: 1,
              backgroundColor: `${ACTION_COLORS[state.lastAction.type]}22`,
              border: `1px solid ${ACTION_COLORS[state.lastAction.type]}44`,
              borderRadius: 1}}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {ACTION_ICONS[state.lastAction.type]}
              <Typography variant="caption" fontWeight={600}>
                {state.lastAction.description}
              </Typography>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Action List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {allActions.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <History sx={{ fontSize: 48, color: '#444', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No history yet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Actions will appear here as you work
            </Typography>
          </Box>
        ) : (
          <List dense={!isTouch} disablePadding>
            {allActions.slice(-maxVisible).map((action, index) => {
              const actualIndex = allActions.length - maxVisible + index;
              const isCurrentState = actualIndex === currentIndex;
              const isFuture = actualIndex > currentIndex;

              return (
                <ActionItem
                  key={action.id}
                  action={action}
                  index={actualIndex}
                  isCurrentState={isCurrentState}
                  isFuture={isFuture}
                  onClick={() => handleJumpToAction(actualIndex)}
                  isTouch={isTouch}
                />
              );
            })}
          </List>
        )}
      </Box>

      {/* Footer */}
      {allActions.length > 0 && (
        <Box sx={{ p: 1, borderTop: '1px solid #333' }}>
          <Button
            size={isTouch ? 'medium' : 'small'}
            color="error"
            startIcon={<Clear />}
            onClick={handleClearHistory}
            fullWidth
            sx={isTouch ? { py: 1.5 } : undefined}
          >
            Clear History
          </Button>
        </Box>
      )}

      {/* Keyboard shortcut hint - only show on desktop */}
      {!isTouch && (
        <Alert severity="info" sx={{ m: 1, py: 0.5 }} icon={false}>
          <Typography variant="caption">
            <strong>Ctrl+Z</strong> Undo &nbsp;|&nbsp; <strong>Ctrl+Shift+Z</strong> Redo
          </Typography>
        </Alert>
      )}
      
      {/* Touch hint */}
      {isTouch && (
        <Alert severity="info" sx={{ m: 1, py: 0.5 }} icon={false}>
          <Typography variant="caption">
            Tap an action to jump to that state. Swipe left to see options.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}

export default HistoryPanel;

