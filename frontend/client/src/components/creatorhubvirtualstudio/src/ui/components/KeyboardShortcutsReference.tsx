/**
 * KeyboardShortcutsReference - Exportable keyboard shortcuts reference
 * 
 * Features:
 * - Visual keyboard layout
 * - Export as PNG/PDF
 * - Print-friendly styles
 * - Dark/Light themes
 */

import React, { useRef, useCallback, useState } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('KeyboardShortcuts, ');
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  Grid,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Download,
  Print,
  ContentCopy,
  Close,
  DarkMode,
  LightMode,
  Keyboard,
} from '@mui/icons-material';
import { SHORTCUT_REFERENCE } from '../../hooks/useKeyboardShortcuts';

// ============================================================================
// Types
// ============================================================================

type Theme = 'dark' | 'light';

interface ShortcutCategory {
  name: string;
  color: string;
  shortcuts: Array<{ key: string; description: string }>;
}

// ============================================================================
// Styled Components
// ============================================================================

const CATEGORIES: ShortcutCategory[] = [
  {
    name: 'View',
    color: '#2196f3',
    shortcuts: SHORTCUT_REFERENCE.filter((s) => s.category === 'View'),
  },
  {
    name: 'Transform',
    color: '#ff9800',
    shortcuts: SHORTCUT_REFERENCE.filter((s) => s.category === 'Transform'),
  },
  {
    name: 'Edit',
    color: '#4caf50',
    shortcuts: SHORTCUT_REFERENCE.filter((s) => s.category === 'Edit'),
  },
  {
    name: 'History',
    color: '#9c27b0',
    shortcuts: SHORTCUT_REFERENCE.filter((s) => s.category === 'History'),
  },
  {
    name: 'Selection',
    color: '#00bcd4',
    shortcuts: SHORTCUT_REFERENCE.filter((s) => s.category === 'Selection'),
  },
  {
    name: 'Animation',
    color: '#e91e63',
    shortcuts: SHORTCUT_REFERENCE.filter((s) => s.category === 'Animation'),
  },
  {
    name: 'Camera',
    color: '#607d8b',
    shortcuts: SHORTCUT_REFERENCE.filter((s) => s.category === 'Camera'),
  },
];

// ============================================================================
// Key Component
// ============================================================================

interface KeyProps {
  keyName: string;
  theme: Theme;
  small?: boolean;
}

function Key({ keyName, theme, small = false }: KeyProps) {
  const isModifier = ['Ctrl','Shift','Alt','Cmd','⌘','⇧','⌥'].includes(keyName);
  const isSpecial = ['Delete','Backspace','Space','Escape','Enter','Tab'].includes(keyName);
  
  const isDark = theme === 'dark';
  
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: small ? 28 : 36,
        height: small ? 28 : 34,
        px: isSpecial || isModifier ? 1.5 : 1,
        mx: 0.25,
        borderRadius: 1,
        backgroundColor: isDark 
          ? (isModifier ? '#3a3a4a' : '#252535')
          : (isModifier ? '#e0e0f0' : '#f5f5f5'),
        border: `1px solid ${isDark ? '#555' : '#ccc'}`,
        borderBottom: `3px solid ${isDark ? '#333' : '#aaa'}`,
        fontFamily: ', "SF Mono","Fira Code", monospace',
        fontSize: small ? 11 : 13,
        fontWeight: 600,
        color: isDark 
          ? (isModifier ? '#a8a8ff' : '#fff')
          : (isModifier ? '#5555cc' : '#333'),
        boxShadow: isDark 
          ? '0 2px 4px rgba(0,0,0,0.4)'
          : '0 2px 4px rgba(0,0,0,0.1)',
        textTransform: 'uppercase',
        letterSpacing: 0.5}}
    >
      {keyName}
    </Box>
  );
}

// ============================================================================
// Shortcut Row
// ============================================================================

interface ShortcutRowProps {
  shortcutKey: string;
  description: string;
  theme: Theme;
  categoryColor: string;
}

function ShortcutRow({ shortcutKey, description, theme, categoryColor }: ShortcutRowProps) {
  const keys = shortcutKey.split('+').map((k) => k.trim());
  const isDark = theme === 'dark';
  
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 0.75,
        px: 1,
        borderRadius: 1, '&:hover': {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: categoryColor}}
        />
        <Typography 
          variant="body2" 
          sx={{ 
            color: isDark ? '#ccc' : '#444',
            fontWeight: 50}}
        >
          {description}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {keys.map((key, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <Typography 
                variant="caption" 
                sx={{ mx: 0.25, color: isDark ? '#666' : '#999' }}
              >
                +
              </Typography>
            )}
            <Key keyName={key} theme={theme} small />
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}

// ============================================================================
// Reference Card
// ============================================================================

interface ReferenceCardProps {
  theme: Theme;
  forExport?: boolean;
}

export function ShortcutsReferenceCard({ theme, forExport = false }: ReferenceCardProps) {
  const isDark = theme === 'dark';
  
  return (
    <Box
      sx={{
        p: forExport ? 4 : 3,
        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
        color: isDark ? '#fff' : '#000',
        minWidth: forExport ? 800 : 'auto',
        fontFamily: ', "Inter","Segoe UI", sans-serif'}}
    >
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <Keyboard sx={{ fontSize: 32, color: isDark ? '#2196f3' : '#1976d2' }} />
          <Typography 
            variant="h5" 
            fontWeight={700}
            sx={{ 
              background: isDark 
                ? 'linear-gradient(135deg, #2196f3, #9c27b0)'
                : 'linear-gradient(135deg, #1976d2, #7b1fa2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'}}
          >
            Virtual Studio Keyboard Shortcuts
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Quick reference guide for all keyboard shortcuts
        </Typography>
      </Box>

      {/* Categories Grid */}
      <Grid container spacing={2}>
        {CATEGORIES.map((category) => (
          <Grid item xs={12} sm={6} md={forExport ? 4 : 6} key={category.name}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                backgroundColor: isDark ? '#252530' : '#f8f9fa',
                border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                borderRadius: 2,
                height: '100%'}}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: category.color}}
                />
                <Typography variant="subtitle2" fontWeight={700}>
                  {category.name}
                </Typography>
                <Chip 
                  label={category.shortcuts.length} 
                  size="small" 
                  sx={{ 
                    height: 18, 
                    fontSize: 10,
                    backgroundColor: `${category.color}22`,
                    color: category.color}} 
                />
              </Box>
              <Divider sx={{ mb: 1, borderColor: isDark ? '#444' : '#ddd' }} />
              {category.shortcuts.map((shortcut, index) => (
                <ShortcutRow
                  key={index}
                  shortcutKey={shortcut.key}
                  description={shortcut.description}
                  theme={theme}
                  categoryColor={category.color}
                />
              ))}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', mt: 3, pt: 2, borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}` }}>
        <Typography variant="caption" color="text.secondary">
          CreatorHub Virtual Studio • Press <Key keyName="?" theme={theme} small /> to show this reference
        </Typography>
      </Box>
    </Box>
  );
}

// ============================================================================
// Export Dialog
// ============================================================================

interface KeyboardShortcutsExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsExportDialog({ open, onClose }: KeyboardShortcutsExportDialogProps) {
  const [theme, setTheme] = useState<Theme>('dark');
  const exportRef = useRef<HTMLDivElement>(null);

  const handleExportPNG = useCallback(async () => {
    if (!exportRef.current) return;

    try {
      // Use html2canvas (would need to be imported)
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = `virtual-studio-shortcuts-${theme}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      log.error('Failed to export PNG: ', error);
      // Fallback: copy to clipboard info
      alert('PNG export requires html2canvas library. Please install it or use Print option.');
    }
  }, [theme]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open(', ', '_blank');
    if (!printWindow || !exportRef.current) return;

    const isDark = theme === 'dark';
    const styles = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Inter', 'Segoe UI', sans-serif; 
          background: ${isDark ? '#1a1a1a' : '#ffffff'};
          color: ${isDark ? '#ffffff' : '#000000'};
          padding: 20px;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Virtual Studio Keyboard Shortcuts</title>
          ${styles}
        </head>
        <body>
          ${exportRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  }, [theme]);

  const handleCopyText = useCallback(() => {
    const text = CATEGORIES.map((cat) => 
      `## ${cat.name}\n${cat.shortcuts.map((s) => `  ${s.key}: ${s.description}`).join('\n')}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(`# Virtual Studio Keyboard Shortcuts\n\n${text}`);
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Download />
          <Typography variant="h6">Export Keyboard Shortcuts</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={theme}
            exclusive
            onChange={(_, v) => v && setTheme(v)}
            size="small"
          >
            <ToggleButton value="dark">
              <DarkMode fontSize="small" />
            </ToggleButton>
            <ToggleButton value="light">
              <LightMode fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent 
        dividers 
        sx={{ 
          p: 0, 
          backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f0f0f0',
          maxHeight: '60vh',
          overflow:'auto'}}
      >
        <Box ref={exportRef}>
          <ShortcutsReferenceCard theme={theme} forExport />
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          startIcon={<ContentCopy />}
          onClick={handleCopyText}
          variant="outlined"
        >
          Copy as Text
        </Button>
        <Button
          startIcon={<Print />}
          onClick={handlePrint}
          variant="outlined"
        >
          Print / Save PDF
        </Button>
        <Button
          startIcon={<Download />}
          onClick={handleExportPNG}
          variant="contained"
        >
          Export PNG
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ShortcutsReferenceCard;

