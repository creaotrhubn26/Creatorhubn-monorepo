import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  ExpandMore,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatAlignJustify,
  Link as LinkIcon,
  Visibility,
  TouchApp,
} from '@mui/icons-material';
import { useVisualEditor } from './VisualEditorContext';

export const EnhancedPropertiesPanel: React.FC = () => {
  const { state } = useVisualEditor();
  const [sizeMode, setSizeMode] = useState<'auto' | 'custom'>('auto');
  const [textAlign, setTextAlign] = useState('left');

  // Get selected elements
  const selectedElements = state.elements.filter((el) => el.props?.selected);
  const hasSelection = selectedElements.length > 0;
  const selectedElement = selectedElements[0]; // For single selection

  // Determine element type
  const isTextElement = selectedElement?.type === 'text';
  const isShapeElement = selectedElement?.type === 'button' || selectedElement?.type === 'card';
  const multipleSelected = selectedElements.length > 1;

  // Empty state - nothing selected
  if (!hasSelection) {
    return (
      <Box
        sx={{
          width: 300,
          bgcolor: 'white',
          borderLeft: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 4,
          textAlign: 'center'}}>
        <TouchApp sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Selection
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
          Select an element on the canvas to edit its properties
        </Typography>
        <Box sx={{ width: '100%', p: 2, bgcolor: '#F5F5F5', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            💡 Quick Tips: </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            • Click an element to select
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            • Hold Shift to multi-select
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            • Press Esc to deselect
          </Typography>
        </Box>
      </Box>
    );
  }

  // Multiple selection state
  if (multipleSelected) {
    return (
      <Box
        sx={{
          width: 300,
          bgcolor: 'white',
          borderLeft: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'}}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Multiple Selection
          </Typography>
          <Chip label={`${selectedElements.length} objects`} size="small" sx={{ mt: 1 }} />
        </Box>

        {/* Bulk actions */}
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Bulk Actions
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button variant="outlined" size="small" fullWidth>
              Align Left
            </Button>
            <Button variant="outlined" size="small" fullWidth>
              Align Center
            </Button>
            <Button variant="outlined" size="small" fullWidth>
              Align Right
            </Button>
            <Button variant="outlined" size="small" fullWidth>
              Distribute Horizontally
            </Button>
            <Button variant="outlined" size="small" fullWidth>
              Distribute Vertically
            </Button>
            <Button variant="outlined" size="small" fullWidth color="primary">
              Group Selection
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // Single selection - show contextual properties
  return (
    <Box
      sx={{
        width: 300,
        bgcolor: 'white',
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'}}>
      {/* Header with element info */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {(selectedElement as any).name || selectedElement.type || 'Element'}
          </Typography>
          <Chip 
            label={selectedElement.type} 
            size="small" 
            color={isShapeElement ? 'secondary' : 'primary'} 
            variant="outlined" 
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          ID: {selectedElement.id.slice(0, 8)}...
        </Typography>
      </Box>

      {/* Scrollable Properties */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Position & Size */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Position & Size
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label="X"
                size="small"
                value={Math.round(selectedElement.x)}
                type="number"
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
              <TextField
                label="Y"
                size="small"
                value={Math.round(selectedElement.y)}
                type="number"
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label="Width"
                size="small"
                value={Math.round(selectedElement.width)}
                type="number"
                disabled={sizeMode === 'auto'}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
              <TextField
                label="Height"
                size="small"
                value={Math.round(selectedElement.height)}
                type="number"
                disabled={sizeMode === 'auto'}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
            </Box>

            {/* Size Mode Toggle */}
            <ToggleButtonGroup
              value={sizeMode}
              exclusive
              onChange={(_, value) => value && setSizeMode(value)}
              size="small"
              fullWidth
              sx={{ mb: 1 }}
            >
              <ToggleButton value="auto">Auto</ToggleButton>
              <ToggleButton value="custom">Custom</ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <IconButton size="small">
                <LinkIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" color="text.secondary">
                Lock aspect ratio
              </Typography>
              <IconButton size="small" sx={{ ml: 'auto' }}>
                <Visibility fontSize="small" />
              </IconButton>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Typography - Only for text elements */}
        {isTextElement && (
          <Accordion defaultExpanded disableGutters elevation={0}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                Typography
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              <ToggleButtonGroup
                value={textAlign}
                exclusive
                onChange={(_, value) => value && setTextAlign(value)}
                size="small"
                fullWidth
                sx={{ mb: 2 }}>
                <ToggleButton value="left">
                  <FormatAlignLeft fontSize="small" />
                </ToggleButton>
                <ToggleButton value="center">
                  <FormatAlignCenter fontSize="small" />
                </ToggleButton>
                <ToggleButton value="right">
                  <FormatAlignRight fontSize="small" />
                </ToggleButton>
                <ToggleButton value="justify">
                  <FormatAlignJustify fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>

              <Select fullWidth size="small" value="roboto" sx={{ mb: 2 }}>
                <MenuItem value="roboto">Roboto</MenuItem>
                <MenuItem value="arial">Arial</MenuItem>
                <MenuItem value="helvetica">Helvetica</MenuItem>
              </Select>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Size"
                  size="small"
                  value="20"
                  sx={{ width: 80 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
                <Select size="small" value="regular" sx={{ flex: 1 }}>
                  <MenuItem value="regular">Regular</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                </Select>
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Fill & Stroke */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Fill & Stroke
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Fill Color
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  size="small"
                  value={selectedElement.styles?.backgroundColor || '#FFFFFF'}
                  sx={{ flex: 1 }} />
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: selectedElement.styles?.backgroundColor || '#FFFFFF',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer'}} />
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Stroke Color
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  size="small"
                  value={selectedElement.styles?.color || '#000000'}
                  sx={{ flex: 1 }} />
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: selectedElement.styles?.color || '#000000',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer'}} />
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Effects */}
        <Accordion disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Effects
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="body2">Opacity</Typography>
              <TextField
                size="small"
                value={Math.round((selectedElement.styles?.opacity || 1) * 100)}
                type="number"
                sx={{ width: 80 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>}} />
            </Box>

            <TextField
              label="Shadow"
              size="small"
              value={selectedElement.styles?.boxShadow ||'none'}
              fullWidth
            />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};
