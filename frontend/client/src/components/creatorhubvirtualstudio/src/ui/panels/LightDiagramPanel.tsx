/**
 * Light Diagram Panel
 * 
 * UI for viewing and exporting light diagrams
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
} from '@mui/material';
import { Download, Visibility } from '@mui/icons-material';
import { lightDiagramGenerator, LightInfo } from '../../core/services/lightDiagramGenerator';

interface LightDiagramPanelProps {
  lights: LightInfo[];
  onExport?: (format: 'svg' | 'png' | 'pdf') => void;
}

export const LightDiagramPanel: React.FC<LightDiagramPanelProps> = ({
  lights,
  onExport,
}) => {
  const [exportFormat, setExportFormat] = useState<'svg' | 'png' | 'pdf'>('png');
  const [preview, setPreview] = useState<string | null>(null);
  
  const handleGeneratePreview = () => {
    const svg = lightDiagramGenerator.generateSVG(lights);
    setPreview(svg);
  };
  
  const handleExport = async () => {
    try {
      let blob: Blob;
      
      if (exportFormat === 'svg') {
        const svg = lightDiagramGenerator.generateSVG(lights);
        blob = new Blob([svg], { type: 'image/svg+xml' });
      } else if (exportFormat === 'png') {
        blob = await lightDiagramGenerator.generatePNG(lights);
      } else {
        blob = await lightDiagramGenerator.generatePDF(lights);
      }
      
      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `light-diagram.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      
      if (onExport) {
        onExport(exportFormat);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };
  
  return (
    <Box sx={{ p: 2, bgcolor: '#1a1a1a', color: '#ffffff', minHeight: '100%' }}>
      <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
        Light Diagram
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel sx={{ color: '#aaaaaa' }}>Export Format</InputLabel>
          <Select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'svg' | 'png' | 'pdf')}
            sx={{
              color: '#ffffff',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
            }}
          >
            <MenuItem value="svg">SVG</MenuItem>
            <MenuItem value="png">PNG</MenuItem>
            <MenuItem value="pdf">PDF</MenuItem>
          </Select>
        </FormControl>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={handleGeneratePreview}
            sx={{
              color: '#ffffff',
              borderColor: '#444',
              '&:hover': { borderColor: '#666' },
            }}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExport}
            sx={{
              bgcolor: '#4a9eff',
              color: '#ffffff',
              '&:hover': { bgcolor: '#3a8eef' },
            }}
          >
            Export
          </Button>
        </Box>
      </Box>
      
      {preview && (
        <Paper
          sx={{
            p: 2,
            bgcolor: '#2a2a2a',
            mt: 2,
          }}
        >
          <Typography variant="subtitle2" sx={{ color: '#aaaaaa', mb: 1 }}>
            Preview
          </Typography>
          <Box
            dangerouslySetInnerHTML={{ __html: preview }}
            sx={{
              maxWidth: '100%',
              overflow: 'auto',
            }}
          />
        </Paper>
      )}
    </Box>
  );
};


