/**
 * QuickAccessToolbar - Floating toolbar for common operations
 * 
 * Features:
 * - Transform tools (move, rotate, scale)
 * - View controls
 * - Quick actions
 * - Selection info
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Fade,
  Badge,
} from '@mui/material';
import {
  OpenWith,
  Rotate90DegreesCcw,
  ZoomOutMap,
  Visibility,
  VisibilityOff,
  Delete,
  ContentCopy,
  ContentPaste,
  Undo,
  Redo,
  CenterFocusStrong,
  GridOn,
  GridOff,
  Camera,
  Lightbulb,
  Animation,
  Lock,
  LockOpen,
  Group,
  Link,
  LinkOff,
  Fullscreen,
  FullscreenExit,
  MoreVert,
  Apps,
  ViewInAr,
  ThreeDRotation,
  Straighten,
  CropFree,
  FlipCameraAndroid,
  PhotoCamera,
  PlayArrow,
  Pause,
} from '@mui/icons-material';
import { useSelection } from '../../core/services/selectionService';
import { undoRedoService } from '../../core/services/undoRedoService';
import { equipmentGroupingService } from '../../core/services/equipmentGroupingService';

// ============================================================================
// Types
// ============================================================================

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type ViewMode = 'perspective' | 'top' | 'front' | 'side';

interface QuickAccessToolbarProps {
  // Transform
  transformMode?: TransformMode;
  onTransformModeChange?: (mode: TransformMode) => void;
  
  // View
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  
  // Actions
  onDelete?: () => void;
  onDuplicate?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onFocus?: () => void;
  onTogglePlay?: () => void;
  isPlaying?: boolean;
  
  // Layout
  position?: 'top' | 'bottom' | 'left' | 'right';
  compact?: boolean;
}

// ============================================================================
// Tool Button Component
// ============================================================================

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  badge?: number;
}

function ToolButton({ icon, label, shortcut, onClick, active, disabled, badge }: ToolButtonProps) {
  const content = (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      sx={{
        backgroundColor: active ? 'primary.main' : 'transparent',
        color: active ? 'white' : 'inherit', '&:hover': {
          backgroundColor: active ? 'primary.dark' : 'action.hover',
        }}}
    >
      {badge !== undefined ? (
        <Badge badgeContent={badge} color="primary" max={99}>
          {icon}
        </Badge>
      ) : (
        icon
      )}
    </IconButton>
  );

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2">{label}</Typography>
          {shortcut && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {shortcut}
            </Typography>
          )}
        </Box>
      }
      placement="bottom"
    >
      {content}
    </Tooltip>
  );
}

// ============================================================================
// Selection Info Component
// ============================================================================

function SelectionInfo() {
  const selection = useSelection('toolbar,');

  if (selection.selectedIds.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
        No selection
      </Typography>
    );
  }

  return (
    <Chip
      size="small"
      label={`${selection.selectedIds.length} selected`}
      onDelete={() => selection.clear()}
      sx={{ mx: 1 }}
    />
  );
}

// ============================================================================
// Main Toolbar Component
// ============================================================================

export function QuickAccessToolbar({
  transformMode = 'translate,',
  onTransformModeChange,
  viewMode = 'perspective',
  onViewModeChange,
  showGrid = true,
  onToggleGrid,
  onDelete,
  onDuplicate,
  onGroup,
  onUngroup,
  onFocus,
  onTogglePlay,
  isPlaying = false,
  position = 'top',
  compact = false,
}: QuickAccessToolbarProps) {
  const selection = useSelection('toolbar');
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(null);

  const handleUndo = useCallback(() => {
    undoRedoService.undo();
  }, []);

  const handleRedo = useCallback(() => {
    undoRedoService.redo();
  }, []);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete();
    }
  }, [onDelete]);

  const handleDuplicate = useCallback(() => {
    if (onDuplicate) {
      onDuplicate();
    } else if (selection.selectedIds.length > 0) {
      equipmentGroupingService.duplicateNodes(selection.selectedIds);
    }
  }, [onDuplicate, selection.selectedIds]);

  const handleGroup = useCallback(() => {
    if (onGroup) {
      onGroup();
    } else if (selection.selectedIds.length > 1) {
      equipmentGroupingService.createGroup('New Group', selection.selectedIds);
    }
  }, [onGroup, selection.selectedIds]);

  const isHorizontal = position === 'top' || position === 'bottom';

  return (
    <Fade in>
      <Paper
        elevation={4}
        sx={{
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          alignItems: 'center',
          gap: 0.5,
          p: 0.5,
          backgroundColor: 'rgba(30, 30, 40, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.1)'}}
      >
        {/* Transform Tools */}
        <ToggleButtonGroup
          value={transformMode}
          exclusive
          onChange={(_, v) => v && onTransformModeChange?.(v)}
          size="small"
          orientation={isHorizontal ? 'horizontal' : 'vertical'}
        >
          <ToggleButton value="translate">
            <Tooltip title="Move (W)">
              <OpenWith fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="rotate">
            <Tooltip title="Rotate (E)">
              <Rotate90DegreesCcw fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="scale">
            <Tooltip title="Scale (R)">
              <ZoomOutMap fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider orientation={isHorizontal ? 'vertical' : 'horizontal'} flexItem />

        {/* History */}
        <Box sx={{ display: 'flex', flexDirection: isHorizontal ? 'row' : 'column' }}>
          <ToolButton
            icon={<Undo />}
            label="Undo"
            shortcut="Ctrl+Z"
            onClick={handleUndo}
          />
          <ToolButton
            icon={<Redo />}
            label="Redo"
            shortcut="Ctrl+Shift+Z"
            onClick={handleRedo}
          />
        </Box>

        <Divider orientation={isHorizontal ? 'vertical' : 'horizontal'} flexItem />

        {/* Edit Tools */}
        <Box sx={{ display: 'flex', flexDirection: isHorizontal ? 'row' : 'column' }}>
          <ToolButton
            icon={<ContentCopy />}
            label="Duplicate"
            shortcut="Ctrl+D"
            onClick={handleDuplicate}
            disabled={selection.selectedIds.length === 0}
          />
          <ToolButton
            icon={<Delete />}
            label="Delete"
            shortcut="Delete"
            onClick={handleDelete}
            disabled={selection.selectedIds.length === 0}
          />
          <ToolButton
            icon={<Group />}
            label="Group"
            shortcut="Ctrl+G"
            onClick={handleGroup}
            disabled={selection.selectedIds.length < 2}
          />
        </Box>

        <Divider orientation={isHorizontal ? 'vertical' : 'horizontal'} flexItem />

        {/* View Tools */}
        <Box sx={{ display: 'flex', flexDirection: isHorizontal ? 'row' : 'column' }}>
          <ToolButton
            icon={showGrid ? <GridOn /> : <GridOff />}
            label="Toggle Grid"
            shortcut="G"
            onClick={onToggleGrid}
            active={showGrid}
          />
          <ToolButton
            icon={<CenterFocusStrong />}
            label="Focus Selection"
            shortcut="F"
            onClick={onFocus}
            disabled={selection.selectedIds.length === 0}
          />
          <ToolButton
            icon={<ThreeDRotation />}
            label="View Mode"
            onClick={(e: any) => setViewMenuAnchor(e?.currentTarget)}
          />
        </Box>

        <Divider orientation={isHorizontal ? 'vertical' : 'horizontal'} flexItem />

        {/* Playback */}
        <ToolButton
          icon={isPlaying ? <Pause /> : <PlayArrow />}
          label={isPlaying ? 'Pause' : 'Play'}
          shortcut="Space"
          onClick={onTogglePlay}
          active={isPlaying}
        />

        {/* Selection Info */}
        {!compact && <SelectionInfo />}

        {/* More Menu */}
        <ToolButton
          icon={<MoreVert />}
          label="More Options"
          onClick={(e: any) => setMoreMenuAnchor(e?.currentTarget)}
        />

        {/* View Menu */}
        <Menu
          anchorEl={viewMenuAnchor}
          open={Boolean(viewMenuAnchor)}
          onClose={() => setViewMenuAnchor(null)}
        >
          {(['perspective','top', 'front', 'side'] as ViewMode[]).map((mode) => (
            <MenuItem
              key={mode}
              onClick={() => {
                onViewModeChange?.(mode);
                setViewMenuAnchor(null);
              }}
              selected={viewMode === mode}
            >
              <ListItemIcon>
                {mode === 'perspective' ? <ViewInAr fontSize="small" /> :
                 mode === 'top' ? <Apps fontSize="small" /> :
                 mode === 'front' ? <CropFree fontSize="small" /> :
                 <FlipCameraAndroid fontSize="small" />}
              </ListItemIcon>
              <ListItemText>{mode.charAt(0).toUpperCase() + mode.slice(1)}</ListItemText>
            </MenuItem>
          ))}
        </Menu>

        {/* More Menu */}
        <Menu
          anchorEl={moreMenuAnchor}
          open={Boolean(moreMenuAnchor)}
          onClose={() => setMoreMenuAnchor(null)}
        >
          <MenuItem onClick={() => { setMoreMenuAnchor(null); }}>
            <ListItemIcon><Straighten fontSize="small" /></ListItemIcon>
            <ListItemText>Snap to Grid</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreMenuAnchor(null); }}>
            <ListItemIcon><Link fontSize="small" /></ListItemIcon>
            <ListItemText>Link Objects</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreMenuAnchor(null); }}>
            <ListItemIcon><Lock fontSize="small" /></ListItemIcon>
            <ListItemText>Lock Selection</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setMoreMenuAnchor(null); }}>
            <ListItemIcon><PhotoCamera fontSize="small" /></ListItemIcon>
            <ListItemText>Capture Snapshot</ListItemText>
          </MenuItem>
        </Menu>
      </Paper>
    </Fade>
  );
}

// ============================================================================
// Mini Toolbar (for constrained spaces)
// ============================================================================

export function MiniToolbar({
  transformMode = 'translate',
  onTransformModeChange,
  onDelete,
  onDuplicate,
}: Pick<QuickAccessToolbarProps'transformMode' | 'onTransformModeChange' | 'onDelete' | 'onDuplicate'>) {
  const selection = useSelection('mini-toolbar');

  return (
    <Paper
      elevation={3}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        p: 0.25,
        backgroundColor: 'rgba(30, 30, 40, 0.9)',
        borderRadius: 1}}
    >
      <IconButton
        size="small"
        onClick={() => onTransformModeChange?.('translate')}
        color={transformMode === 'translate' ? 'primary' : 'default'}
      >
        <OpenWith fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => onTransformModeChange?.('rotate')}
        color={transformMode === 'rotate' ? 'primary' : 'default'}
      >
        <Rotate90DegreesCcw fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => onTransformModeChange?.('scale')}
        color={transformMode === 'scale' ? 'primary' : 'default'}
      >
        <ZoomOutMap fontSize="small" />
      </IconButton>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <IconButton
        size="small"
        onClick={onDuplicate}
        disabled={selection.selectedIds.length === 0}
      >
        <ContentCopy fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={onDelete}
        disabled={selection.selectedIds.length === 0}
        color="error"
      >
        <Delete fontSize="small" />
      </IconButton>
    </Paper>
  );
}

export default QuickAccessToolbar;

