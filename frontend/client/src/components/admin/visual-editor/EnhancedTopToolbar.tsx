import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Chip,
  Stack,
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
  Save as SaveIcon,
} from '@mui/icons-material';
import { useVisualEditor, type HistoryEntry } from './VisualEditorContext';
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

interface EnhancedTopToolbarProps {
  previewOpen?: boolean;
  onTogglePreview?: () => void;
}

export const EnhancedTopToolbar: React.FC<EnhancedTopToolbarProps> = ({
  previewOpen = false,
  onTogglePreview,
}) => {
  const {
    undo,
    redo,
    canUndo,
    canRedo,
    state,
    saveProject,
    publishProject,
    updateSettings,
    addNotification,
  } = useVisualEditor();
  const { getTransition, shouldAnimate } = useMotionPreference();
  const tokens = getVisualEditorTokens();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [historyAnchor, setHistoryAnchor] = useState<null | HTMLElement>(null);
  const hasLoadedProjectRef = useRef(false);
  const previousProjectIdRef = useRef<string | null>(null);
  const openHistory = Boolean(historyAnchor);

  useEffect(() => {
    if (!state.currentProject) {
      hasLoadedProjectRef.current = false;
      previousProjectIdRef.current = null;
      setSaveStatus('saved');
      return;
    }

    if (previousProjectIdRef.current !== state.currentProject.id) {
      previousProjectIdRef.current = state.currentProject.id;
      hasLoadedProjectRef.current = false;
      setSaveStatus('saved');
    }
  }, [state.currentProject?.id]);

  useEffect(() => {
    if (!state.currentProject) {
      return;
    }

    if (!hasLoadedProjectRef.current) {
      hasLoadedProjectRef.current = true;
      return;
    }

    setSaveStatus('unsaved');
  }, [state.currentProject?.id, state.elements]);

  useEffect(() => {
    if (!state.currentProject?.metadata?.lastModified) {
      return;
    }

    setSaveStatus('saved');
  }, [state.currentProject?.metadata?.lastModified]);

  // Settings toggle handler
  const handleSettingsClick = useCallback(() => {
    updateSettings({ theme: state.settings.theme === 'light' ? 'dark' : 'light' });
  }, [state.settings.theme, updateSettings]);

  // Preview toggle handler
  const handlePreviewClick = useCallback(() => {
    onTogglePreview?.();
    addNotification({
      type: 'info',
      title: 'Preview',
      message: previewOpen ? 'Exiting preview mode' : 'Entering preview mode',
      read: false,
    });
  }, [addNotification, onTogglePreview, previewOpen]);

  const handleSaveClick = useCallback(() => {
    setSaveStatus('saving');
    saveProject();
    addNotification({
      type: 'success',
      title: 'Saved',
      message: 'Project saved successfully',
      read: false,
    });
  }, [addNotification, saveProject]);

  // Publish handler
  const handlePublish = useCallback(() => {
    setSaveStatus('saving');
    publishProject();
    addNotification({
      type: 'success',
      title: 'Published',
      message: 'Project published successfully',
      read: false,
    });
  }, [publishProject, addNotification]);

  const projectName = state.currentProject?.name || tokens.toolbar.breadcrumbs.project;
  const selectedCount = state.selectedElements.length > 0
    ? state.selectedElements.length
    : state.selectedElement
      ? 1
      : 0;

  const toolbarButtonSx = {
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 2.5,
    bgcolor: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(14px)',
    transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
    '&:hover:not(:disabled)': {
      bgcolor: 'rgba(255,255,255,0.12)',
      transform: shouldAnimate() ? 'translateY(-1px)' : 'none',
    },
    '&:active:not(:disabled)': {
      transform: shouldAnimate() ? 'scale(0.95)' : 'none',
    },
    '&.Mui-disabled': {
      borderColor: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.28)',
    },
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', lg: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.08)',
        background: `
          radial-gradient(circle at top right, rgba(255, 159, 76, 0.24), transparent 28%),
          linear-gradient(135deg, rgba(31, 24, 18, 0.96) 0%, rgba(56, 37, 22, 0.94) 58%, rgba(95, 58, 28, 0.92) 100%)
        `,
        boxShadow: '0 24px 60px rgba(40, 25, 10, 0.28)',
        color: 'common.white',
        position: 'relative',
        overflow: 'hidden',
        flexWrap: 'wrap',
      }}
    >
      {/* Left Section - Back Button & Project Info */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <IconButton
          size="small"
          sx={{
            ...toolbarButtonSx,
            width: 42,
            height: 42,
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.12)',
              transform: shouldAnimate() ? 'scale(1.04)' : 'none',
            },
          }}
        >
          <ArrowBack />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Edit sx={{ color: '#ffb36d', fontSize: 20 }} />
          </Box>

          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.62)', letterSpacing: '0.18em' }}>
              Visual CMS Dashboard
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
              {projectName}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
              <Chip
                label={state.settings.autoSave ? 'Auto-save on' : 'Manual save'}
                size="small"
                sx={{
                  height: 24,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              <Chip
                label={`${state.elements.length} blocks`}
                size="small"
                sx={{
                  height: 24,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.74)',
                }}
              />
              <Chip
                label={selectedCount > 0 ? `${selectedCount} selected` : 'No selection'}
                size="small"
                sx={{
                  height: 24,
                  bgcolor: selectedCount > 0 ? 'rgba(255, 107, 53, 0.16)' : 'rgba(255,255,255,0.08)',
                  color: selectedCount > 0 ? '#ffd5c7' : 'rgba(255,255,255,0.74)',
                }}
              />
              <Chip
                label={`Status: ${state.currentProject?.status ?? 'draft'}`}
                size="small"
                sx={{
                  height: 24,
                  bgcolor:
                    state.currentProject?.status === 'published'
                      ? 'rgba(134, 239, 172, 0.14)'
                      : 'rgba(255,255,255,0.08)',
                  color:
                    state.currentProject?.status === 'published'
                      ? '#d8ffe2'
                      : 'rgba(255,255,255,0.74)',
                  textTransform: 'capitalize',
                }}
              />
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Center Section - Breadcrumbs */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.75,
          minWidth: 240,
          flex: 1,
        }}
      >
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.52)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {tokens.toolbar.editTitle}
        </Typography>
        <Breadcrumbs separator="/" sx={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.78)' }}>
          <Link underline="hover" color="inherit" href="#" sx={{ fontWeight: 600 }}>
            {tokens.toolbar.breadcrumbs.project}
          </Link>
          <Typography sx={{ color: 'rgba(255,255,255,0.92)' }} fontSize="0.875rem" fontWeight={600}>
            {tokens.toolbar.breadcrumbs.section}
          </Typography>
        </Breadcrumbs>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)' }}>
          {tokens.toolbar.lastEditedLabel}
        </Typography>
      </Box>

      {/* Right Section - Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
        {/* Auto-save indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.8,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            mr: 0.5,
          }}
        >
          {saveStatus === 'saving' && (
            <>
              <CircularProgress size={12} sx={{ color: '#ffd1bc' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.78)' }}>
                {tokens.toolbar.saveStatus.saving}
              </Typography>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CloudDone fontSize="small" sx={{ color: '#86efac' }} />
              <Check fontSize="small" sx={{ color: '#86efac', ml: -0.5 }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.78)' }}>
                {tokens.toolbar.saveStatus.saved}
              </Typography>
            </>
          )}
          {saveStatus === 'unsaved' && (
            <Typography variant="caption" sx={{ color: '#ffd1bc' }}>
              {tokens.toolbar.saveStatus.unsaved}
            </Typography>
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
              aria-label="Undo change"
              disabled={!canUndo}
              sx={toolbarButtonSx}>
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
              aria-label="Redo change"
              disabled={!canRedo}
              sx={toolbarButtonSx}>
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
            sx={toolbarButtonSx}>
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
              bgcolor: 'rgba(29, 22, 17, 0.96)',
              color: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 60px rgba(16, 10, 5, 0.42)',
              backdropFilter: 'blur(16px)',
              transition: shouldAnimate()
                ? `opacity ${TOOLBAR_ANIMATIONS.menu.duration}ms ${TOOLBAR_ANIMATIONS.menu.easing}, transform ${TOOLBAR_ANIMATIONS.menu.duration}ms ${TOOLBAR_ANIMATIONS.menu.easing}`
                : 'none',
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
                  color: 'rgba(255,255,255,0.88)',
                  transition: getTransition('background-color', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'rgba(255,255,255,0.68)' }}>
                  <HistoryIcon fontSize="small" sx={{ color: 'inherit' }} />
                </ListItemIcon>
                <ListItemText
                  primary={entry.description}
                  secondary={new Date(entry.timestamp).toLocaleTimeString()}
                  secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.54)' } }}
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
            aria-label="Toggle visual editor settings theme"
            sx={toolbarButtonSx}>
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
            aria-label={previewOpen ? 'Exit preview mode' : 'Enter preview mode'}
            color={previewOpen ? 'primary' : 'default'}
            sx={{
              ...toolbarButtonSx,
              ...(previewOpen && {
                bgcolor: 'rgba(255, 107, 53, 0.18)',
                color: '#ffe0d3',
              }),
            }}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>

        <Button
          variant="outlined"
          onClick={handleSaveClick}
          startIcon={<SaveIcon />}
          sx={{
            color: 'rgba(255,255,255,0.92)',
            borderColor: 'rgba(255,255,255,0.18)',
            textTransform: 'none',
            fontWeight: 700,
            px: 2.5,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.06)',
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.28)',
              bgcolor: 'rgba(255,255,255,0.1)',
            },
          }}
        >
          Save
        </Button>

        <Button
          variant="contained"
          onClick={handlePublish}
          sx={{
            background: 'linear-gradient(135deg, #ff7b43, #ff5d2d)',
            color: 'white',
            textTransform: 'none',
            fontWeight: 700,
            px: 3.25,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.14)',
            transition: getTransition('all', TOOLBAR_ANIMATIONS.iconButton.duration, TOOLBAR_ANIMATIONS.iconButton.easing),
            '&:hover': {
              background: 'linear-gradient(135deg, #ff8a57, #f45a29)',
              transform: shouldAnimate() ? 'translateY(-2px)' : 'none',
              boxShadow: shouldAnimate() ? '0 14px 26px rgba(255, 107, 53, 0.32)' : 'none'
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
