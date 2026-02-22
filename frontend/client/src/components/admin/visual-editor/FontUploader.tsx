/**
 * Font Uploader Component
 * Auto-registers custom fonts with zero manual work
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Check,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface UploadedFont {
  name: string;
  fileName: string;
  weight: number;
  style: 'normal' | 'italic';
  status: 'success' | 'error';
}

export const FontUploader: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<UploadedFont[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      const validExtensions = ['.woff2','.woff', '.ttf','.otf'];
      const isValid = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (!isValid) {
        console.error(`Invalid font file: ${file.name}`);
        continue;
      }

      try {
        // Extract font info from filename
        const fontInfo = parseFontFileName(file.name);

        // Upload to server/public folder
        const formData = new FormData();
        formData.append('font', file);

        const response = await fetch('/api/fonts/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();

          // Auto-register font
          await registerFont({
            name: fontInfo.name,
            fileName: result.fileName,
            weight: fontInfo.weight,
            style: fontInfo.style,
          });

          setFonts((prev) => [
            ...prev,
            {
              ...fontInfo,
              fileName: result.fileName,
              status: 'success',
            },
          ]);
        } else {
          setFonts((prev) => [
            ...prev,
            {
              ...fontInfo,
              fileName: file.name,
              status: 'error',
            },
          ]);
        }
      } catch (error) {
        console.error('Font upload failed: ', error);
        setFonts((prev) => [
          ...prev,
          {
            name: file.name,
            fileName: file.name,
            weight: 400,
            style: 'normal',
            status: 'error',
          },
        ]);
      }
    }

    setUploading(false);
  };

  const parseFontFileName = (fileName: string) => {
    // Parse common naming patterns: // Roboto-Bold.woff2 -> { name: 'Roboto', weight: 700, style: 'normal' }
    // OpenSans-BoldItalic.woff2 -> { name: 'Open Sans', weight: 700, style: 'italic' }

    const nameWithoutExt = fileName.replace(/\.(woff2?|ttf|otf)$/i, '');
    const parts = nameWithoutExt.split(/[-_]/);

    const name = parts[0].replace(/([A-Z])/g, ' $1').trim();
    const variant = parts[1]?.toLowerCase() || 'regular';

    let weight = 400;
    let style: 'normal' | 'italic' = 'normal';

    if (variant.includes('thin')) weight = 100;
    else if (variant.includes('extralight') || variant.includes('ultralight')) weight = 200;
    else if (variant.includes('light')) weight = 300;
    else if (variant.includes('medium')) weight = 500;
    else if (variant.includes('semibold') || variant.includes('demibold')) weight = 600;
    else if (variant.includes('bold')) weight = 700;
    else if (variant.includes('extrabold') || variant.includes('ultrabold')) weight = 800;
    else if (variant.includes('black') || variant.includes('heavy')) weight = 900;

    if (variant.includes('italic') || variant.includes('oblique')) {
      style = 'italic';
    }

    return { name, weight, style };
  };

  const registerFont = async (font: Omit<UploadedFont, 'status'>) => {
    // Auto-generate CSS and update custom-fonts.css
    const cssRule = `
@font-face {
  font-family: '${font.name}';
  src: url('/fonts/${font.fileName}') format('${getFormat(font.fileName)}');
  font-weight: ${font.weight};
  font-style: ${font.style};
  font-display: swap;
}`;

    try {
      const response = await fetch('/api/fonts/register', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ css: cssRule, fontName: font.name }),
      });

      if (!response.ok) {
        throw new Error('Failed to register font');
      }

      console.log(`✅ Font registered: ${font.name} (${font.weight})`);
    } catch (error) {
      console.error('Font registration failed: ', error);
      throw error;
    }
  };

  const getFormat = (fileName: string): string => {
    if (fileName.endsWith('.woff2')) return 'woff2';
    if (fileName.endsWith('.woff')) return 'woff';
    if (fileName.endsWith('.ttf')) return 'truetype';
    if (fileName.endsWith('.otf')) return 'opentype';
    return 'woff2';
  };

  const handleDelete = async (fontName: string) => {
    try {
      await fetch(`/api/fonts/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ fontName }),
      });

      setFonts((prev) => prev.filter((f) => f.name !== fontName));
    } catch (error) {
      console.error('Font deletion failed:', error);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CloudUpload />}
        onClick={() => setOpen(true)}
        sx={{ mb: 2 }}>
        Upload Custom Fonts
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Custom Fonts</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload .woff2, .woff, .ttf, or .otf files. Fonts are automatically registered!
          </Alert>

          <Box sx={{ mb: 2 }}>
            <input
              accept=".woff,.woff2,.ttf,.otf"
              style={{ display: 'none' }}
              id="font-upload-input"
              type="file"
              multiple
              onChange={handleFileUpload}
            />
            <label htmlFor="font-upload-input">
              <Button
                variant="contained"
                component="span"
                startIcon={<CloudUpload />}
                fullWidth
                disabled={uploading}
              >
                Select Font Files
              </Button>
            </label>
          </Box>

          {uploading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary">
                Uploading and registering fonts...
              </Typography>
            </Box>
          )}

          <List>
            {fonts.map((font, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {font.name}
                      {font.status === 'success' ? (
                        <Check color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display:'flex', gap: 0.5, mt: 0.5 }}>
                      <Chip label={`Weight: ${font.weight}`} size="small" />
                      <Chip label={font.style} size="small" />
                      <Chip label={font.fileName} size="small" />
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleDelete(font.name)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

          {fonts.length === 0 && !uploading && (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No fonts uploaded yet
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FontUploader;
