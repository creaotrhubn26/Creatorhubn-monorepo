/**
 * Shortcut Help Component
 * 
 * Displays keyboard shortcuts in a help dialog
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Grid,
  Chip,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { keyboardShortcutsService, Shortcut } from '../../core/services/keyboardShortcuts';
import { colors, spacing } from '../../styles/designTokens';

export interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ open, onClose }) => {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

  useEffect(() => {
    setShortcuts(keyboardShortcutsService.getAllShortcuts());
  }, []);

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = getCategory(shortcut.action);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  function getCategory(action: string): string {
    if (['play-pause'].includes(action)) return 'Playback';
    if (['save', 'undo', 'redo'].includes(action)) return 'Edit';
    if (['delete', 'deselect', 'select-all'].includes(action)) return 'Selection';
    if (['copy', 'paste', 'duplicate'].includes(action)) return 'Clipboard';
    if (['toggle-grid', 'toggle-helpers'].includes(action)) return 'View';
    if (['focus-search', 'toggle-fullscreen'].includes(action)) return 'Navigation';
    return 'Other';
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: colors.background.panel,
          border: `1px solid ${colors.border.default}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          color: colors.text.primary,
        }}
      >
        <KeyboardIcon />
        <Typography variant="h6">Keyboard Shortcuts</Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: colors.text.secondary,
                  mb: spacing.sm,
                  textTransform: 'uppercase',
                  fontSize: 12,
                  letterSpacing: '0.1em',
                }}
              >
                {category}
              </Typography>
              <Grid container spacing={2}>
                {categoryShortcuts.map((shortcut) => (
                  <Grid item xs={12} sm={6} key={shortcut.action}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: spacing.xs,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: colors.text.primary,
                        }}
                      >
                        {shortcut.description}
                      </Typography>
                      <Chip
                        label={keyboardShortcutsService.formatShortcut(shortcut)}
                        size="small"
                        sx={{
                          backgroundColor: colors.background.card,
                          color: colors.text.primary,
                          border: `1px solid ${colors.border.default}`,
                          fontFamily: 'monospace',
                          fontSize: 11,
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Divider sx={{ mt: 2, borderColor: colors.border.divider }} />
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="secondary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};


