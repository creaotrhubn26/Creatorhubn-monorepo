import React, { useState, useCallback } from 'react';
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
  SelectChangeEvent,
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
import { useVisualEditor, EditorElement } from './VisualEditorContext';
import { getVisualEditorTokens } from './visualEditorTokens';

export const EnhancedPropertiesPanel: React.FC = () => {
  const { state, updateElement, selectElements } = useVisualEditor();
  const tokens = getVisualEditorTokens();
  const [sizeMode, setSizeMode] = useState<'auto' | 'custom'>('auto');
  const [lockAspectRatio, setLockAspectRatio] = useState(false);

  // Get selected elements using the context-tracked selection
  const selectedIds = state.selectedElements.length > 0
    ? state.selectedElements
    : state.selectedElement
      ? [state.selectedElement]
      : [];

  const selectedElements = state.elements.filter((el) => selectedIds.includes(el.id));
  const hasSelection = selectedElements.length > 0;
  const selectedElement = selectedElements[0]; // For single selection

  // Determine element type
  const isTextElement = selectedElement?.type === 'text';
  const isShapeElement = selectedElement?.type === 'button' || selectedElement?.type === 'card';
  const multipleSelected = selectedElements.length > 1;

  // --- Update helpers ---
  const handlePositionChange = useCallback(
    (field: 'x' | 'y', value: string) => {
      if (!selectedElement) return;
      const num = parseFloat(value);
      if (!isNaN(num)) {
        updateElement(selectedElement.id, { [field]: num });
      }
    },
    [selectedElement, updateElement],
  );

  const handleSizeChange = useCallback(
    (field: 'width' | 'height', value: string) => {
      if (!selectedElement) return;
      const num = parseFloat(value);
      if (!isNaN(num) && num > 0) {
        if (lockAspectRatio) {
          const ratio = selectedElement.width / selectedElement.height;
          if (field === 'width') {
            updateElement(selectedElement.id, { width: num, height: num / ratio });
          } else {
            updateElement(selectedElement.id, { width: num * ratio, height: num });
          }
        } else {
          updateElement(selectedElement.id, { [field]: num });
        }
      }
    },
    [selectedElement, updateElement, lockAspectRatio],
  );

  const handleStyleChange = useCallback(
    (styleProp: string, value: string | number) => {
      if (!selectedElement) return;
      updateElement(selectedElement.id, {
        styles: { ...selectedElement.styles, [styleProp]: value },
      });
    },
    [selectedElement, updateElement],
  );

  const handleTextAlignChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: string | null) => {
      if (!selectedElement || !value) return;
      updateElement(selectedElement.id, {
        styles: { ...selectedElement.styles, textAlign: value } as EditorElement['styles'],
      });
    },
    [selectedElement, updateElement],
  );

  const handleFontFamilyChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      if (!selectedElement) return;
      handleStyleChange('fontFamily', event.target.value);
    },
    [selectedElement, handleStyleChange],
  );

  const handleFontWeightChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      if (!selectedElement) return;
      handleStyleChange('fontWeight', event.target.value);
    },
    [selectedElement, handleStyleChange],
  );

  // --- Bulk alignment helpers ---
  const alignElements = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (selectedElements.length < 2) return;
      const xs = selectedElements.map((el) => el.x);
      const ys = selectedElements.map((el) => el.y);
      const rights = selectedElements.map((el) => el.x + el.width);
      const bottoms = selectedElements.map((el) => el.y + el.height);

      selectedElements.forEach((el) => {
        switch (alignment) {
          case 'left':
            updateElement(el.id, { x: Math.min(...xs) });
            break;
          case 'center': {
            const midX = (Math.min(...xs) + Math.max(...rights)) / 2;
            updateElement(el.id, { x: midX - el.width / 2 });
            break;
          }
          case 'right':
            updateElement(el.id, { x: Math.max(...rights) - el.width });
            break;
          case 'top':
            updateElement(el.id, { y: Math.min(...ys) });
            break;
          case 'middle': {
            const midY = (Math.min(...ys) + Math.max(...bottoms)) / 2;
            updateElement(el.id, { y: midY - el.height / 2 });
            break;
          }
          case 'bottom':
            updateElement(el.id, { y: Math.max(...bottoms) - el.height });
            break;
        }
      });
    },
    [selectedElements, updateElement],
  );

  const distributeElements = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (selectedElements.length < 3) return;
      const sorted = [...selectedElements].sort((a, b) =>
        direction === 'horizontal' ? a.x - b.x : a.y - b.y,
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      if (direction === 'horizontal') {
        const totalSpan = last.x + last.width - first.x;
        const totalWidth = sorted.reduce((sum, el) => sum + el.width, 0);
        const gap = (totalSpan - totalWidth) / (sorted.length - 1);
        let currentX = first.x;
        sorted.forEach((el) => {
          updateElement(el.id, { x: currentX });
          currentX += el.width + gap;
        });
      } else {
        const totalSpan = last.y + last.height - first.y;
        const totalHeight = sorted.reduce((sum, el) => sum + el.height, 0);
        const gap = (totalSpan - totalHeight) / (sorted.length - 1);
        let currentY = first.y;
        sorted.forEach((el) => {
          updateElement(el.id, { y: currentY });
          currentY += el.height + gap;
        });
      }
    },
    [selectedElements, updateElement],
  );

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
          {tokens.propertiesPanel.emptyState.title}
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
          {tokens.propertiesPanel.emptyState.body}
        </Typography>
        <Box sx={{ width: '100%', p: 2, bgcolor: '#F5F5F5', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            💡 {tokens.propertiesPanel.emptyState.tipsTitle}:
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            • {tokens.propertiesPanel.emptyState.tipSelect}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            • {tokens.propertiesPanel.emptyState.tipMulti}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            • {tokens.propertiesPanel.emptyState.tipEsc}
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
            {tokens.propertiesPanel.multiSelect.title}
          </Typography>
          <Chip label={`${selectedElements.length} ${tokens.propertiesPanel.multiSelect.objectsSuffix}`} size="small" sx={{ mt: 1 }} />
        </Box>

        {/* Bulk actions */}
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            {tokens.propertiesPanel.multiSelect.bulkActions}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button variant="outlined" size="small" fullWidth onClick={() => alignElements('left')}>
              {tokens.propertiesPanel.multiSelect.alignLeft}
            </Button>
            <Button variant="outlined" size="small" fullWidth onClick={() => alignElements('center')}>
              {tokens.propertiesPanel.multiSelect.alignCenter}
            </Button>
            <Button variant="outlined" size="small" fullWidth onClick={() => alignElements('right')}>
              {tokens.propertiesPanel.multiSelect.alignRight}
            </Button>
            <Button variant="outlined" size="small" fullWidth onClick={() => distributeElements('horizontal')}>
              {tokens.propertiesPanel.multiSelect.distributeHorizontally}
            </Button>
            <Button variant="outlined" size="small" fullWidth onClick={() => distributeElements('vertical')}>
              {tokens.propertiesPanel.multiSelect.distributeVertically}
            </Button>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              color="primary"
              onClick={() => {
                // Group selection: use selectElements to mark them all
                selectElements(selectedIds);
              }}
            >
              {tokens.propertiesPanel.multiSelect.groupSelection}
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // Read current style values
  const currentFontFamily = selectedElement.styles?.fontFamily || 'roboto';
  const currentFontWeight = selectedElement.styles?.fontWeight || 'normal';
  const currentFontSize = selectedElement.styles?.fontSize
    ? parseInt(String(selectedElement.styles.fontSize), 10)
    : 16;
  const currentTextAlign = (selectedElement.styles as Record<string, unknown>)?.textAlign as string || 'left';
  const elementName = (selectedElement.props?.name as string) || selectedElement.type || tokens.visualEditorPanel.elementLabel;

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
            {elementName}
          </Typography>
          <Chip 
            label={selectedElement.type} 
            size="small" 
            color={isShapeElement ? 'secondary' : 'primary'} 
            variant="outlined" 
          />
        </Box>
          <Typography variant="caption" color="text.secondary">
            {tokens.propertiesPanel.labels.id}: {selectedElement.id.slice(0, 8)}...
          </Typography>
      </Box>

      {/* Scrollable Properties */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Position & Size */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              {tokens.propertiesPanel.singleSelect.positionSize}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label={tokens.propertiesPanel.labels.x}
                size="small"
                value={Math.round(selectedElement.x)}
                type="number"
                onChange={(e) => handlePositionChange('x', e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
              <TextField
                label={tokens.propertiesPanel.labels.y}
                size="small"
                value={Math.round(selectedElement.y)}
                type="number"
                onChange={(e) => handlePositionChange('y', e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label={tokens.propertiesPanel.labels.width}
                size="small"
                value={Math.round(selectedElement.width)}
                type="number"
                disabled={sizeMode === 'auto'}
                onChange={(e) => handleSizeChange('width', e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
              <TextField
                label={tokens.propertiesPanel.labels.height}
                size="small"
                value={Math.round(selectedElement.height)}
                type="number"
                disabled={sizeMode === 'auto'}
                onChange={(e) => handleSizeChange('height', e.target.value)}
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
              <ToggleButton value="auto">{tokens.propertiesPanel.options.auto}</ToggleButton>
              <ToggleButton value="custom">{tokens.propertiesPanel.options.custom}</ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <IconButton
                size="small"
                onClick={() => setLockAspectRatio((prev) => !prev)}
                color={lockAspectRatio ? 'primary' : 'default'}
              >
                <LinkIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" color="text.secondary">
                {tokens.propertiesPanel.labels.lockAspectRatio}
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
                {tokens.propertiesPanel.singleSelect.typography}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              <ToggleButtonGroup
                value={currentTextAlign}
                exclusive
                onChange={handleTextAlignChange}
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

              <Select
                fullWidth
                size="small"
                value={currentFontFamily}
                onChange={handleFontFamilyChange}
                sx={{ mb: 2 }}
              >
                <MenuItem value="roboto">{tokens.propertiesPanel.options.fontRoboto}</MenuItem>
                <MenuItem value="arial">{tokens.propertiesPanel.options.fontArial}</MenuItem>
                <MenuItem value="helvetica">{tokens.propertiesPanel.options.fontHelvetica}</MenuItem>
              </Select>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label={tokens.propertiesPanel.labels.size}
                  size="small"
                  value={currentFontSize}
                  type="number"
                  onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)}
                  sx={{ width: 80 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">px</InputAdornment>}} />
                <Select
                  size="small"
                  value={currentFontWeight === 'bold' || currentFontWeight === '700' ? 'bold' : 'regular'}
                  onChange={handleFontWeightChange}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="regular">{tokens.propertiesPanel.options.regular}</MenuItem>
                  <MenuItem value="bold">{tokens.propertiesPanel.options.bold}</MenuItem>
                </Select>
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Fill & Stroke */}
        <Accordion defaultExpanded disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              {tokens.propertiesPanel.singleSelect.fillStroke}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                {tokens.propertiesPanel.labels.fillColor}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  size="small"
                  value={selectedElement.styles?.backgroundColor || '#FFFFFF'}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  sx={{ flex: 1 }} />
                <Box
                  component="input"
                  type="color"
                  value={selectedElement.styles?.backgroundColor || '#FFFFFF'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleStyleChange('backgroundColor', e.target.value)
                  }
                  sx={{
                    width: 32,
                    height: 32,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    p: 0,
                  }}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                {tokens.propertiesPanel.labels.strokeColor}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  size="small"
                  value={selectedElement.styles?.color || '#000000'}
                  onChange={(e) => handleStyleChange('color', e.target.value)}
                  sx={{ flex: 1 }} />
                <Box
                  component="input"
                  type="color"
                  value={selectedElement.styles?.color || '#000000'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleStyleChange('color', e.target.value)
                  }
                  sx={{
                    width: 32,
                    height: 32,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    p: 0,
                  }}
                />
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Effects */}
        <Accordion disableGutters elevation={0}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              {tokens.propertiesPanel.singleSelect.effects}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="body2">{tokens.propertiesPanel.labels.opacity}</Typography>
              <TextField
                size="small"
                value={Math.round((selectedElement.styles?.opacity || 1) * 100)}
                type="number"
                onChange={(e) => {
                  const pct = parseFloat(e.target.value);
                  if (!isNaN(pct)) {
                    handleStyleChange('opacity', Math.max(0, Math.min(100, pct)) / 100);
                  }
                }}
                sx={{ width: 80 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>}} />
            </Box>

            <TextField
              label={tokens.propertiesPanel.labels.shadow}
              size="small"
              value={selectedElement.styles?.boxShadow || 'none'}
              onChange={(e) => handleStyleChange('boxShadow', e.target.value)}
              fullWidth
            />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};
