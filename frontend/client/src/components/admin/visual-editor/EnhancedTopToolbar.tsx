import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Button,
  Typography,
  Breadcrumbs,
  Link,
  Tooltip,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  ArrowBack,
  Undo,
  Redo,
  Settings,
  Visibility,
  Edit,
  Check,
  CloudDone,
  History as HistoryIcon,
} from '@mui/icons-material';
import type { HistoryEntry } from './VisualEditorContext';
import { useVisualEditor } from './VisualEditorContext';
import { getShortcutText, SHORTCUTS } from './useKeyboardShortcuts';
import { useMotionPreference } from '../../../hooks/useMotionPreference';
import { getVisualEditorTokens } from './visualEditorTokens';

// Research-backed animation constants
const TOOLBAR_ANIMATIONS = {
  iconButton: {
    duration: 100, // Fast feedback for immediate actions
    easing: 'cubic-bezier(0.4, 0.0, 0.6, 1)' // Sharp easing
  },
  tooltip: {
    duration: 150, // Standard tooltip appearance
    easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)' // Standard easing
  },
  menu: {
    duration: 200, // Deceleration for menu dropdown
    easing: 'cubic-bezier(0.0, 0.0, 0.2, 1)' // Deceleration easing
  },
  saveIndicator: {
    duration: 300, // Moderate transition for status changes
    easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)' // Standard easing
  }
};

export const EnhancedTopToolbar: React.FC = () => {
  const { undo, redo, canUndo, canRedo, state, saveProject, updateSettings, addNotification } = useVisualEditor();
  const { getTransition, shouldAnimate } = useMotionPreference();
  const tokens = getVisualEditorTokens();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [historyAnchor, setHistoryAnchor] = useState<null | HTMLElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const openHistory = Boolean(historyAnchor);

  // Auto-save using context's saveProject
  useEffect(() => {
    if (!state.settings.autoSave || !state.currentProject) return;
    const autoSaveInterval = setInterval(() => {
      setSaveStatus('saving');
      saveProject();
      setTimeout(() => {
        setSaveStatus('saved');
      }, 1000);
    }, state.settings.autoSaveInterval || 30000);

    return () => clearInterval(autoSaveInterval);
  }, [state.settings.autoSave, state.settings.autoSaveInterval, state.currentProject, saveProject]);

  // Settings toggle handler
  const handleSettingsClick = useCallback(() => {
    updateSettings({ theme: state.settings.theme === 'light' ? 'dark' : 'light' });
  }, [state.settings.theme, updateSettings]);

  // Preview toggle handler
  const handlePreviewClick = useCallback(() => {
    setPreviewOpen((prev) => !prev);
    addNotification({
      type: 'info',
      title: 'Preview',
      message: previewOpen ? 'Exiting preview mode' : 'Entering preview mode',
      read: false,
    });
  }, [previewOpen, addNotification]);

  // Publish handler
  const handlePublish = useCallback(() => {
    saveProject();
    addNotification({
      type: 'success',
      title: 'Published',
      message: 'Project published successfully',
      read: false,
    });
  }, [saveProject, addNotification]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5
       , bgcolor: 'white',
        borderBottom: 1,
        borderColor: 'divider',
        height: 64}}>
      {/* Left Section - Back Button & Project Info */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton 
          size="small" 
          sx={{ 
            color: 'text.secondary',
            transition: getTransition('transform', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
            '&:hover': {
              transform: shouldAnimate() ? 'scale(1.1)' : 'none'
            },
            '&:active': {
              transform: shouldAnimate() ? 'scale(0.95)' : 'none'
            }
          }}
        >
          <ArrowBack />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Edit sx={{ color: 'warning.main', fontSize: 20 }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {tokens.toolbar.editTitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tokens.toolbar.lastEditedLabel}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Center Section - Breadcrumbs */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Breadcrumbs separator="/" sx={{ fontSize: '0.875rem' }}>
          <Link underline="hover" color="inherit" href="#" sx={{ fontWeight: 500}}>
            {tokens.toolbar.breadcrumbs.project}
          </Link>
          <Typography color="text.primary" fontSize="0.875rem" fontWeight={500}>
            {tokens.toolbar.breadcrumbs.section}
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Right Section - Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Auto-save indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
          {saveStatus === 'saving' && (
            <>
              <CircularProgress size={12} />
              <Typography variant="caption" color="text.secondary">
                {tokens.toolbar.saveStatus.saving}
              </Typography>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CloudDone fontSize="small" sx={{ color: 'success.main' }} />
              <Check fontSize="small" sx={{ color: 'success.main', ml: -0.5 }} />
              <Typography variant="caption" color="text.secondary">
                {tokens.toolbar.saveStatus.saved}
              </Typography>
            </>
          )}
        </Box>

        <Tooltip 
          title={`${tokens.toolbar.tooltips.undo} ${getShortcutText(SHORTCUTS.undo)}`}
          enterDelay={shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0}
          TransitionProps={{
            timeout: shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0
          }}
        >
          <span>
            <IconButton
              size="small"
              onClick={undo}
              disabled={!canUndo}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
                '&:hover:not(:disabled)': {
                  bgcolor: 'action.hover',
                  transform: shouldAnimate() ? 'translateY(-1px)' : 'none'
                },
                '&:active:not(:disabled)': {
                  transform: shouldAnimate() ? 'scale(0.95)' : 'none'
                }
              }}>
              <Undo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip 
          title={`${tokens.toolbar.tooltips.redo} ${getShortcutText(SHORTCUTS.redo)}`}
          enterDelay={shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0}
          TransitionProps={{
            timeout: shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0
          }}
        >
          <span>
            <IconButton
              size="small"
              onClick={redo}
              disabled={!canRedo}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
                '&:hover:not(:disabled)': {
                  bgcolor: 'action.hover',
                  transform: shouldAnimate() ? 'translateY(-1px)' : 'none'
                },
                '&:active:not(:disabled)': {
                  transform: shouldAnimate() ? 'scale(0.95)' : 'none'
                }
              }}>
              <Redo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* History dropdown */}
        <Tooltip 
          title={tokens.toolbar.tooltips.history}
          enterDelay={shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0}
          TransitionProps={{
            timeout: shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0
          }}
        >
          <IconButton
            size="small"
            onClick={(e) => setHistoryAnchor(e.currentTarget)}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
              '&:hover': {
                bgcolor: 'action.hover',
                transform: shouldAnimate() ? 'translateY(-1px)' : 'none'
              },
              '&:active': {
                transform: shouldAnimate() ? 'scale(0.95)' : 'none'
              }
            }}>
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={historyAnchor}
          open={openHistory}
          onClose={() => setHistoryAnchor(null)}
          PaperProps={{ 
            sx: { 
              maxHeight: 360, 
              width: 360,
              transition: shouldAnimate() 
                ? `opacity ${TOOLBAR_ANIMATIONS.menu.duration}ms ${TOOLBAR_ANIMATIONS.menu.easing}, transform ${TOOLBAR_ANIMATIONS.menu.duration}ms ${TOOLBAR_ANIMATIONS.menu.easing}`
                : 'none'
            } 
          }}
          TransitionProps={{
            timeout: shouldAnimate() ? TOOLBAR_ANIMATIONS.menu.duration : 0
          }}
        >
          {(state.historyEntries ?? [])
            .slice(-20)
            .reverse()
            .map((entry: HistoryEntry) => (
              <MenuItem 
                key={entry.id} 
                onClick={() => setHistoryAnchor(null)}
                sx={{
                  transition: getTransition('background-color', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing)
                }}
              >
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={entry.description}
                  secondary={new Date(entry.timestamp).toLocaleTimeString()}
                />
              </MenuItem>
            ))}
          {(!state.historyEntries || state.historyEntries.length === 0) && (
            <MenuItem disabled>
              <ListItemText primary={tokens.toolbar.historyEmpty} />
            </MenuItem>
          )}
        </Menu>

        <Tooltip 
          title={tokens.toolbar.tooltips.settings}
          enterDelay={shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0}
          TransitionProps={{
            timeout: shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0
          }}
        >
          <IconButton
            size="small"
            onClick={handleSettingsClick}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
              '&:hover': {
                bgcolor: 'action.hover',
                transform: shouldAnimate() ? 'translateY(-1px)' : 'none'
              },
              '&:active': {
                transform: shouldAnimate() ? 'scale(0.95)' : 'none'
              }
            }}>
            <Settings fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip 
          title={tokens.toolbar.tooltips.preview}
          enterDelay={shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0}
          TransitionProps={{
            timeout: shouldAnimate() ? TOOLBAR_ANIMATIONS.tooltip.duration : 0
          }}
        >
          <IconButton
            size="small"
            onClick={handlePreviewClick}
            color={previewOpen ? 'primary' : 'default'}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
              '&:hover': {
                bgcolor: 'action.hover',
                transform: shouldAnimate() ? 'translateY(-1px)' : 'none'
              },
              '&:active': {
                transform: shouldAnimate() ? 'scale(0.95)' : 'none'
              }
            }}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>

        <Button
          variant="contained"
          onClick={handlePublish}
          sx={{
            bgcolor: '#FF6B35',
            color: 'white',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            borderRadius: 2,
            transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
            '&:hover': { 
              bgcolor: '#E85A2B',
              transform: shouldAnimate() ? 'translateY(-2px)' : 'none',
              boxShadow: shouldAnimate() ? '0 4px 12px rgba(255, 107, 53, 0.3)' : 'none'
            },
            '&:active': {
              transform: shouldAnimate() ? 'scale(0.98)' : 'none'
            }
          }}
        >
          {tokens.toolbar.publishLabel}
        </Button>
      </Box>
    </Box>
  );
};
