/**
 * KeyboardShortcutsPanel - Display keyboard shortcuts reference
 * 
 * Features:
 * - Grouped by category
 * - Visual key representations
 * - Collapsible sections
 * - Floating overlay option
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  IconButton,
  Collapse,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Fab,
} from '@mui/material';
import {
  Keyboard,
  ExpandMore,
  ExpandLess,
  Close,
  HelpOutline,
} from '@mui/icons-material';
import { SHORTCUT_REFERENCE } from '../../hooks/useKeyboardShortcuts';

// ============================================================================
// Key Visual Component
// ============================================================================

interface KeyCapProps {
  keyName: string;
  small?: boolean;
}

function KeyCap({ keyName, small = false }: KeyCapProps) {
  const isModifier = ['Ctrl','Shift','Alt','Cmd'].includes(keyName);
  const isSpecial = ['Delete','Backspace','Space','Escape','Enter'].includes(keyName);

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: small ? 24 : 32,
        height: small ? 24 : 28,
        px: isSpecial || isModifier ? 1 : 0.5,
        mx: 0.25,
        borderRadius: 1,
        backgroundColor: isModifier ? '#3a3a4a' : '#252530',
        border: '1px solid #444',
        borderBottom: '3px solid #333',
        fontFamily: 'monospace',
        fontSize: small ? 10 : 12,
        fontWeight: 600,
        color: isModifier ? '#a8a8ff' : '#fff',
        textTransform: 'uppercase',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'}}
    >
      {keyName}
    </Box>
  );
}

// ============================================================================
// Shortcut Item
// ============================================================================

interface ShortcutItemProps {
  shortcutKey: string;
  description: string;
  compact?: boolean;
}

function ShortcutItem({ shortcutKey, description, compact = false }: ShortcutItemProps) {
  // Parse key combination
  const keys = shortcutKey.split('+,').map((k) => k.trim());

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: compact ? 0.5 : 1,
        px: 1, '&:hover': {
          backgroundColor: 'rgba(255,255,255,0.03)',
        }}}
    >
      <Typography variant={compact ? 'caption' : 'body2'} color="text.secondary">
        {description}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <Typography variant="caption" sx={{ mx: 0.25, color: '#666' }}>
                +
              </Typography>
            )}
            <KeyCap keyName={key} small={compact} />
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}

// ============================================================================
// Category Section
// ============================================================================

interface CategorySectionProps {
  category: string;
  shortcuts: typeof SHORTCUT_REFERENCE;
  defaultExpanded?: boolean;
  compact?: boolean;
}

function CategorySection({
  category,
  shortcuts,
  defaultExpanded = true,
  compact = false,
}: CategorySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const categoryColors: Record<string, string> = {
    View: '#2196f3',
    Transform: '#ff9800',
    Edit: '#4caf50',
    History: '#9c27b0',
    Selection: '#00bcd4',
    Animation: '#e91e63',
    Camera: '#607d8b',
  };

  return (
    <Box sx={{ mb: compact ? 1 : 2 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          py: 0.5,
          px: 1,
          borderRadius: 1, '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.05)',
          }}}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: categoryColors[category] || '#666'}}
          />
          <Typography variant={compact ? 'caption' : 'subtitle2'} fontWeight={600}>
            {category}
          </Typography>
          <Chip
            label={shortcuts.length}
            size="small"
            sx={{ height: 16, fontSize: 10 }}
          />
        </Box>
        <IconButton size="small">
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ pl: 2 }}>
          {shortcuts.map((shortcut, index) => (
            <ShortcutItem
              key={index}
              shortcutKey={shortcut.key}
              description={shortcut.description}
              compact={compact}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

// ============================================================================
// Full Panel Component
// ============================================================================

interface KeyboardShortcutsPanelProps {
  compact?: boolean;
}

export function KeyboardShortcutsPanel({ compact = false }: KeyboardShortcutsPanelProps) {
  // Group shortcuts by category
  const groupedShortcuts = SHORTCUT_REFERENCE.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof SHORTCUT_REFERENCE>);

  const categoryOrder = ['View','Transform','Edit','History','Selection','Animation','Camera'];

  return (
    <Box sx={{ p: compact ? 1 : 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Keyboard />
        <Typography variant={compact ? 'subtitle2' : 'h6'} fontWeight={700}>
          Keyboard Shortcuts
        </Typography>
      </Box>

      {categoryOrder.map((category) =>
        groupedShortcuts[category] ? (
          <CategorySection
            key={category}
            category={category}
            shortcuts={groupedShortcuts[category]}
            defaultExpanded={!compact}
            compact={compact}
          />
        ) : null
      )}
    </Box>
  );
}

// ============================================================================
// Dialog Version
// ============================================================================

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Keyboard />
          <Typography variant="h6">Keyboard Shortcuts</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <KeyboardShortcutsPanel />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Floating Button
// ============================================================================

interface KeyboardShortcutsFloatingButtonProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export function KeyboardShortcutsFloatingButton({
  position = 'bottom-right',
}: KeyboardShortcutsFloatingButtonProps) {
  const [open, setOpen] = useState(false);

  const positionStyles: Record<string, object> = {
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'top-right': { top: 16, right: 16 },
    'top-left': { top: 16, left: 16 },
  };

  return (
    <>
      <Tooltip title="Keyboard Shortcuts (?)">
        <Fab
          size="small"
          onClick={() => setOpen(true)}
          sx={{
            position: 'fixed',
            ...positionStyles[position],
            backgroundColor: '#252530',
            color: '#fff', '&:hover': {
              backgroundColor: '#353545',
            }}}
        >
          <HelpOutline />
        </Fab>
      </Tooltip>
      <KeyboardShortcutsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ============================================================================
// Quick Reference Tooltip
// ============================================================================

interface QuickShortcutHintProps {
  shortcutKey: string;
  children: React.ReactNode;
}

export function QuickShortcutHint({ shortcutKey, children }: QuickShortcutHintProps) {
  const keys = shortcutKey.split('+').map((k) => k.trim());

  return (
    <Tooltip
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {keys.map((key, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span>+</span>}
              <KeyCap keyName={key} small />
            </React.Fragment>
          ))}
        </Box>
      }
      placement="top"
    >
      <span>{children}</span>
    </Tooltip>
  );
}

export default KeyboardShortcutsPanel;

