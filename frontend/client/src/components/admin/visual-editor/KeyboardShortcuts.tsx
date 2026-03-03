/**
 * Keyboard Shortcuts Panel - Command palette and shortcut reference
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  InputAdornment,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Search,
  Close,
  Keyboard,
  Code,
  Visibility,
  Save,
  Download,
  ContentCopy,
  Refresh,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Delete,
  Add,
  Edit,
  Settings,
  PlayArrow,
} from '@mui/icons-material';

interface ShortcutCommand {
  id: string;
  name: string;
  description: string;
  shortcut: string;
  category: 'General' | 'Editor' | 'Preview' | 'Navigation' | 'Tools';
  action?: () => void;
  icon?: React.ReactNode;
}

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
  onExecuteCommand?: (commandId: string) => void;
}

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  open,
  onClose,
  onExecuteCommand,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [mode, setMode] = useState<'shortcuts' | 'palette'>('shortcuts');

  const shortcuts: ShortcutCommand[] = useMemo(
    () => [
      // General
      {
        id: 'save',
        name: 'Save Project',
        description: 'Save current project state',
        shortcut: 'Cmd+S',
        category: 'General',
        icon: <Save fontSize="small" />,
      },
      {
        id: 'open-command-palette',
        name: 'Command Palette',
        description: 'Open command palette',
        shortcut: 'Cmd+K',
        category: 'General',
        icon: <Keyboard fontSize="small" />,
      },
      {
        id: 'save-version',
        name: 'Save Version',
        description: 'Save code version to history',
        shortcut: 'Cmd+Shift+S',
        category: 'General',
        icon: <Save fontSize="small" />,
      },
      {
        id: 'export',
        name: 'Export Project',
        description: 'Open export dialog',
        shortcut: 'Cmd+E',
        category: 'General',
        icon: <Download fontSize="small" />,
      },
      {
        id: 'settings',
        name: 'Settings',
        description: 'Open settings panel',
        shortcut: 'Cmd+',
        category: 'General',
        icon: <Settings fontSize="small" />,
      },

      // Editor
      {
        id: 'format-code',
        name: 'Format Code',
        description: 'Format code with Prettier',
        shortcut: 'Cmd+Shift+F',
        category: 'Editor',
        icon: <Code fontSize="small" />,
      },
      {
        id: 'find',
        name: 'Find',
        description: 'Find in code',
        shortcut: 'Cmd+F',
        category: 'Editor',
        icon: <Search fontSize="small" />,
      },
      {
        id: 'find-replace',
        name: 'Find and Replace',
        description: 'Find and replace in code',
        shortcut: 'Cmd+H',
        category: 'Editor',
        icon: <Search fontSize="small" />,
      },
      {
        id: 'undo',
        name: 'Undo',
        description: 'Undo last change',
        shortcut: 'Cmd+Z',
        category: 'Editor',
        icon: <Undo fontSize="small" />,
      },
      {
        id: 'redo',
        name: 'Redo',
        description: 'Redo last change',
        shortcut: 'Cmd+Shift+Z',
        category: 'Editor',
        icon: <Redo fontSize="small" />,
      },
      {
        id: 'toggle-comment',
        name: 'Toggle Comment',
        description: 'Comment/uncomment selected lines',
        shortcut: 'Cmd+/',
        category: 'Editor',
        icon: <Code fontSize="small" />,
      },
      {
        id: 'duplicate-line',
        name: 'Duplicate Line',
        description: 'Duplicate current line or selection',
        shortcut: 'Cmd+Shift+D',
        category: 'Editor',
        icon: <ContentCopy fontSize="small" />,
      },
      {
        id: 'move-line-up',
        name: 'Move Line Up',
        description: 'Move line up',
        shortcut: 'Alt+↑',
        category: 'Editor',
        icon: <Edit fontSize="small" />,
      },
      {
        id: 'move-line-down',
        name: 'Move Line Down',
        description: 'Move line down',
        shortcut: 'Alt+↓',
        category: 'Editor',
        icon: <Edit fontSize="small" />,
      },
      {
        id: 'multi-cursor',
        name: 'Add Cursor',
        description: 'Add cursor above/below',
        shortcut: 'Cmd+Alt+↑/↓',
        category: 'Editor',
        icon: <Edit fontSize="small" />,
      },
      {
        id: 'select-all-occurrences',
        name: 'Select All Occurrences',
        description: 'Select all occurrences of current word',
        shortcut: 'Cmd+Shift+L',
        category: 'Editor',
        icon: <Edit fontSize="small" />,
      },

      // Preview
      {
        id: 'refresh-preview',
        name: 'Refresh Preview',
        description: 'Refresh live preview',
        shortcut: 'Cmd+R',
        category: 'Preview',
        icon: <Refresh fontSize="small" />,
      },
      {
        id: 'toggle-console',
        name: 'Toggle Console',
        description: 'Show/hide console panel',
        shortcut: 'Cmd+J',
        category: 'Preview',
        icon: <Code fontSize="small" />,
      },
      {
        id: 'zoom-in',
        name: 'Zoom In',
        description: 'Increase preview zoom',
        shortcut: 'Cmd++',
        category: 'Preview',
        icon: <ZoomIn fontSize="small" />,
      },
      {
        id: 'zoom-out',
        name: 'Zoom Out',
        description: 'Decrease preview zoom',
        shortcut: 'Cmd+-',
        category: 'Preview',
        icon: <ZoomOut fontSize="small" />,
      },
      {
        id: 'zoom-reset',
        name: 'Reset Zoom',
        description: 'Reset zoom to 100%',
        shortcut: 'Cmd+0',
        category: 'Preview',
        icon: <ZoomIn fontSize="small" />,
      },
      {
        id: 'toggle-device',
        name: 'Toggle Device',
        description: 'Switch between device types',
        shortcut: 'Cmd+Shift+M',
        category: 'Preview',
        icon: <Visibility fontSize="small" />,
      },
      {
        id: 'rotate-device',
        name: 'Rotate Device',
        description: 'Toggle portrait/landscape',
        shortcut: 'Cmd+Shift+R',
        category: 'Preview',
        icon: <Refresh fontSize="small" />,
      },
      {
        id: 'screenshot',
        name: 'Take Screenshot',
        description: 'Capture preview screenshot',
        shortcut: 'Cmd+Shift+P',
        category: 'Preview',
        icon: <Visibility fontSize="small" />,
      },

      // Navigation
      {
        id: 'next-tab',
        name: 'Next Tab',
        description: 'Switch to next tab',
        shortcut: 'Cmd+Shift+]',
        category: 'Navigation',
        icon: <Code fontSize="small" />,
      },
      {
        id: 'prev-tab',
        name: 'Previous Tab',
        description: 'Switch to previous tab',
        shortcut: 'Cmd+Shift+[',
        category: 'Navigation',
        icon: <Code fontSize="small" />,
      },
      {
        id: 'close-tab',
        name: 'Close Tab',
        description: 'Close current tab',
        shortcut: 'Cmd+W',
        category: 'Navigation',
        icon: <Close fontSize="small" />,
      },
      {
        id: 'go-to-line',
        name: 'Go to Line',
        description: 'Jump to specific line number',
        shortcut: 'Cmd+G',
        category: 'Navigation',
        icon: <Code fontSize="small" />,
      },

      // Tools
      {
        id: 'accessibility-check',
        name: 'Accessibility Check',
        description: 'Run accessibility scan',
        shortcut: 'Cmd+Shift+A',
        category: 'Tools',
        icon: <PlayArrow fontSize="small" />,
      },
      {
        id: 'performance-check',
        name: 'Performance Check',
        description: 'Show performance metrics',
        shortcut: 'Cmd+Shift+I',
        category: 'Tools',
        icon: <PlayArrow fontSize="small" />,
      },
      {
        id: 'toggle-grid',
        name: 'Toggle Grid',
        description: 'Show/hide preview grid',
        shortcut: 'Cmd+G',
        category: 'Tools',
        icon: <Settings fontSize="small" />,
      },
    ],
    [],
  );

  const filteredShortcuts = useMemo(() => {
    let filtered = shortcuts;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.shortcut.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [shortcuts, selectedCategory, searchQuery]);

  const categories = ['All', ...Array.from(new Set(shortcuts.map((s) => s.category)))];

  const handleCommandSelect = (commandId: string) => {
    if (onExecuteCommand) {
      onExecuteCommand(commandId);
    }
    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setMode('palette');
      }
      // ESC to close
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const formatShortcut = (shortcut: string) => {
    return shortcut
      .replace('Cmd', '⌘')
      .replace('Shift', '⇧')
      .replace('Alt', '⌥')
      .replace('Ctrl', '⌃');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: {}}}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Keyboard color="primary" />
            <Typography variant="h6">
              {mode === 'shortcuts' ? 'Keyboard Shortcuts' : 'Command Palette'}
            </Typography>
          </Box>
          <Box>
            <Chip
              label={mode === 'shortcuts' ? 'View Shortcuts' : 'Quick Commands'}
              size="small"
              onClick={() => setMode(mode === 'shortcuts' ? 'palette' : 'shortcuts')}
              clickable
            />
            <IconButton onClick={onClose} size="small" sx={{ ml: 1 }}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Search */}
        <TextField
          fullWidth
          placeholder={mode === 'shortcuts' ? 'Search shortcuts...' : 'Type a command...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            )}}
          sx={{ mb: 2 }} />

        {/* Category Tabs */}
        {mode === 'shortcuts' && (
          <Tabs
            value={selectedCategory}
            onChange={(_, newValue) => setSelectedCategory(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            {categories.map((category) => (
              <Tab key={category} label={category} value={category} />
            ))}
          </Tabs>
        )}

        {/* Shortcuts/Commands List */}
        <List sx={{ pt: 0 }}>
          {filteredShortcuts.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f5f5f5' }}>
              <Typography color="text.secondary">
                No {mode === 'shortcuts' ? 'shortcuts' : 'commands'} found
              </Typography>
            </Paper>
          ) : (
            filteredShortcuts.map((shortcut, index) => (
              <React.Fragment key={shortcut.id}>
                <ListItemButton
                  onClick={mode === 'palette' ? () => handleCommandSelect(shortcut.id) : undefined}
                  sx={{
                    py: 1.5,
                    '&:hover': mode === 'palette'
                        ? { bgcolor: 'action.hover' }
                        : {},
                  }}
                >
                  {shortcut.icon && (
                    <ListItemIcon sx={{ minWidth: 40 }}>{shortcut.icon}</ListItemIcon>
                  )}
                  <ListItemText
                    primary={shortcut.name}
                    secondary={shortcut.description}
                    primaryTypographyProps={{
                      fontWeight: 600,
                      fontSize: '0.95rem',
                    }}
                    secondaryTypographyProps={{
                      fontSize: '0.85rem'}} />
                  <Chip
                    label={formatShortcut(shortcut.shortcut)}
                    size="small"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      bgcolor: '#f5f5f5',
                      border: '1px solid #e0e0e0'}} />
                </ListItemButton>
                {index < filteredShortcuts.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </DialogContent>

      {/* Footer Hint */}
      <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Tip:</strong> Press{' '}
          <Chip label="⌘K" size="small" sx={{ height: 18, fontSize: '0.7rem', mx: 0.5 }} /> to open
          command palette from anywhere
        </Typography>
      </Box>
    </Dialog>
  );
};
