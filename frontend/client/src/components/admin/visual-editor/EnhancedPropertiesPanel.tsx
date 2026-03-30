import React, { useMemo, useState, useCallback } from 'react';
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
  Stack,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  ExpandMore,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatAlignJustify,
  Link as LinkIcon,
  Visibility,
  VisibilityOff,
  TouchApp,
} from '@mui/icons-material';
import { useVisualEditor, type EditorElement } from './VisualEditorContext';
import { getVisualEditorTokens } from './visualEditorTokens';
import {
  extractDesignTokenNameFromReference,
  getDesignTokenReference,
  getElementComponentBinding,
  getEditorLayoutMode,
  getElementClassNames,
  resolveElementForBreakpoint,
  sanitizeDesignTokenName,
} from './visualEditorModel';

const panelShellSx = {
  width: 320,
  minWidth: 320,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  bgcolor: 'var(--ve-panel-bg-strong, rgba(255,255,255,0.94))',
  backdropFilter: 'blur(18px)',
  border: '1px solid var(--ve-panel-border, rgba(113, 87, 59, 0.14))',
  borderRadius: 4,
  boxShadow: 'var(--ve-panel-shadow, 0 24px 60px rgba(66, 42, 17, 0.12))',
};

const panelHeaderSx = {
  px: 2.25,
  py: 2,
  borderBottom: '1px solid rgba(113, 87, 59, 0.1)',
  background: `
    linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,255,255,0.74)),
    radial-gradient(circle at top right, rgba(255, 183, 94, 0.16), transparent 26%)
  `,
};

const sectionAccordionSx = {
  mx: 1.5,
  mb: 1.25,
  border: '1px solid rgba(113, 87, 59, 0.08)',
  borderRadius: '20px !important',
  overflow: 'hidden',
  bgcolor: 'rgba(255,255,255,0.8)',
  boxShadow: '0 16px 30px rgba(66, 42, 17, 0.06)',
  '&:before': {
    display: 'none',
  },
  '& .MuiAccordionSummary-root': {
    minHeight: 56,
    px: 2.25,
  },
  '& .MuiAccordionSummary-content': {
    my: 1,
  },
  '& .MuiAccordionDetails-root': {
    px: 2.25,
    pb: 2.25,
  },
};

export const EnhancedPropertiesPanel: React.FC = () => {
  const {
    state,
    updateElement,
    groupElements,
    ungroupElement,
    duplicateElement,
    deleteElement,
    renameElement,
    setElementClassName,
    upsertStyleClass,
    deleteStyleClass,
    upsertDesignToken,
    deleteDesignToken,
    toggleElementVisibility,
    toggleElementLock,
  } = useVisualEditor();
  const tokens = getVisualEditorTokens();
  const [sizeMode, setSizeMode] = useState<'auto' | 'custom'>('auto');
  const [lockAspectRatio, setLockAspectRatio] = useState(false);

  const selectedIds = state.selectedElements.length > 0
    ? state.selectedElements
    : state.selectedElement
      ? [state.selectedElement]
      : [];

  const selectedElements = useMemo(
    () =>
      state.elements
        .filter((el) => selectedIds.includes(el.id))
        .map((element) => resolveElementForBreakpoint(
          element,
          state.currentBreakpoint,
          state.styleClasses,
          state.designTokens,
        )),
    [selectedIds, state.currentBreakpoint, state.elements, state.styleClasses, state.designTokens],
  );
  const selectedElementSource = state.elements.find((element) => element.id === selectedIds[0]);
  const parentElementSource = selectedElementSource?.parent
    ? state.elements.find((element) => element.id === selectedElementSource.parent)
    : undefined;
  const hasSelection = selectedElements.length > 0;
  const selectedElement = selectedElements[0];
  const isTextElement = selectedElement?.type === 'text';
  const isShapeElement = selectedElement?.type === 'button' || selectedElement?.type === 'card';
  const isLayoutContainer = Boolean(
    selectedElementSource
    && (selectedElementSource.type === 'container'
      || selectedElementSource.type === 'grid'
      || getEditorLayoutMode(selectedElementSource) !== 'absolute'),
  );
  const parentLayoutMode = parentElementSource ? getEditorLayoutMode(parentElementSource) : 'absolute';
  const isAutoLayoutChild = parentLayoutMode !== 'absolute';
  const multipleSelected = selectedElements.length > 1;
  const selectedClassNames = useMemo(
    () => getElementClassNames(selectedElementSource?.className),
    [selectedElementSource?.className],
  );
  const primaryStyleClassName = selectedClassNames[0];
  const primaryStyleClass = primaryStyleClassName ? state.styleClasses[primaryStyleClassName] : undefined;
  const availableStyleClassNames = useMemo(
    () => Object.keys(state.styleClasses).sort((left, right) => left.localeCompare(right)),
    [state.styleClasses],
  );
  const availableDesignTokens = useMemo(
    () => Object.values(state.designTokens).sort((left, right) => left.name.localeCompare(right.name)),
    [state.designTokens],
  );
  const componentBinding = useMemo(
    () => getElementComponentBinding(selectedElementSource),
    [selectedElementSource],
  );

  const sanitizeClassName = useCallback((value: string) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'shared-style';
  }, []);

  const detachStyleClass = useCallback((className: string) => {
    if (!selectedElementSource) {
      return;
    }

    const nextClassNames = selectedClassNames.filter((entry) => entry !== className).join(' ');
    setElementClassName(selectedElementSource.id, nextClassNames);
  }, [selectedClassNames, selectedElementSource, setElementClassName]);

  const syncStylesToSharedClass = useCallback(() => {
    if (!selectedElementSource) {
      return;
    }

    const nextClassName = primaryStyleClassName
      ?? sanitizeClassName(selectedElementSource.name || selectedElementSource.type);

    if (!selectedClassNames.includes(nextClassName)) {
      const nextClassNames = [...selectedClassNames, nextClassName].join(' ');
      setElementClassName(selectedElementSource.id, nextClassNames);
    }

    upsertStyleClass({
      name: nextClassName,
      styles: { ...selectedElementSource.styles },
      responsive: {
        tablet: selectedElementSource.responsive?.tablet?.styles
          ? { ...selectedElementSource.responsive.tablet.styles }
          : undefined,
        mobile: selectedElementSource.responsive?.mobile?.styles
          ? { ...selectedElementSource.responsive.mobile.styles }
          : undefined,
      },
    });
  }, [
    primaryStyleClassName,
    sanitizeClassName,
    selectedClassNames,
    selectedElementSource,
    setElementClassName,
    upsertStyleClass,
  ]);

  const handleApplyExistingClass = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!selectedElementSource) {
      return;
    }

    const nextClass = event.target.value.trim();
    if (!nextClass || selectedClassNames.includes(nextClass)) {
      return;
    }

    setElementClassName(selectedElementSource.id, [...selectedClassNames, nextClass].join(' '));
  }, [selectedClassNames, selectedElementSource, setElementClassName]);

  const getEditableStyleValue = useCallback((styleProp: keyof EditorElement['styles']) => {
    if (!selectedElementSource) {
      return undefined;
    }

    if (state.currentBreakpoint === 'desktop') {
      return selectedElementSource.styles[styleProp];
    }

    return selectedElementSource.responsive?.[state.currentBreakpoint]?.styles?.[styleProp]
      ?? selectedElementSource.styles[styleProp];
  }, [selectedElementSource, state.currentBreakpoint]);

  const getBoundTokenName = useCallback((styleProp: keyof EditorElement['styles']) => {
    const styleValue = getEditableStyleValue(styleProp);
    return typeof styleValue === 'string'
      ? extractDesignTokenNameFromReference(styleValue)
      : null;
  }, [getEditableStyleValue]);

  const handlePositionChange = useCallback(
    (field: 'x' | 'y', value: string) => {
      if (!selectedElement) return;
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        updateElement(selectedElement.id, { [field]: num } as Partial<EditorElement>);
      }
    },
    [selectedElement, updateElement],
  );

  const handleSizeChange = useCallback(
    (field: 'width' | 'height', value: string) => {
      if (!selectedElementSource || !selectedElement) return;
      const num = parseFloat(value);
      if (!Number.isNaN(num) && num > 0) {
        if (lockAspectRatio) {
          const ratio = selectedElement.width / Math.max(selectedElement.height, 1);
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
    [selectedElement, selectedElementSource, updateElement, lockAspectRatio],
  );

  const handleStyleChange = useCallback(
    (styleProp: string, value: string | number) => {
      if (!selectedElementSource || !selectedElement) return;
      updateElement(selectedElement.id, {
        styles: { ...selectedElementSource.styles, [styleProp]: value },
      });
    },
    [selectedElement, selectedElementSource, updateElement],
  );

  const bindDesignToken = useCallback((styleProp: keyof EditorElement['styles'], tokenName: string) => {
    handleStyleChange(styleProp, getDesignTokenReference(tokenName));
  }, [handleStyleChange]);

  const unbindDesignToken = useCallback((styleProp: keyof EditorElement['styles']) => {
    if (!selectedElement) {
      return;
    }

    const resolvedValue = selectedElement.styles?.[styleProp];
    if (resolvedValue === undefined || resolvedValue === null) {
      return;
    }

    handleStyleChange(styleProp, typeof resolvedValue === 'number' ? resolvedValue : String(resolvedValue));
  }, [handleStyleChange, selectedElement]);

  const createDesignTokenFromStyle = useCallback((
    styleProp: keyof EditorElement['styles'],
    tokenType: 'color' | 'spacing' | 'radius' | 'shadow' | 'typography' | 'size' | 'border' | 'custom',
    label: string,
  ) => {
    if (!selectedElement || !selectedElementSource) {
      return;
    }

    const resolvedValue = selectedElement.styles?.[styleProp];
    if (resolvedValue === undefined || resolvedValue === null || resolvedValue === '') {
      return;
    }

    const existingTokenName = getBoundTokenName(styleProp);
    const nextTokenName = existingTokenName
      ?? sanitizeDesignTokenName(`${primaryStyleClassName ?? selectedElementSource.name ?? selectedElement.type}-${String(styleProp)}`);

    if (!nextTokenName) {
      return;
    }

    upsertDesignToken({
      name: nextTokenName,
      value: String(resolvedValue),
      type: tokenType,
      description: `${label} token generated from ${selectedElement.name ?? selectedElement.type}`,
    });
    handleStyleChange(styleProp, getDesignTokenReference(nextTokenName));
  }, [
    getBoundTokenName,
    handleStyleChange,
    primaryStyleClassName,
    selectedElement,
    selectedElementSource,
    upsertDesignToken,
  ]);

  const handleLayoutModeChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: string | null) => {
      if (!selectedElementSource || !selectedElement || !value) return;

      if (value === 'absolute') {
        updateElement(selectedElement.id, {
          styles: {
            ...selectedElementSource.styles,
            display: 'block',
            flexDirection: undefined,
            justifyContent: undefined,
            alignItems: undefined,
            gridTemplateColumns: undefined,
            gap: selectedElementSource.styles.gap ?? '0px',
            padding: selectedElementSource.styles.padding ?? '0px',
          },
        });
        return;
      }

      if (value === 'stack' || value === 'row') {
        updateElement(selectedElement.id, {
          styles: {
            ...selectedElementSource.styles,
            display: 'flex',
            flexDirection: value === 'row' ? 'row' : 'column',
            justifyContent: selectedElementSource.styles.justifyContent ?? 'flex-start',
            alignItems: selectedElementSource.styles.alignItems ?? 'flex-start',
            gap: selectedElementSource.styles.gap ?? '24px',
            padding: selectedElementSource.styles.padding ?? '24px',
            gridTemplateColumns: undefined,
          },
        });
        return;
      }

      updateElement(selectedElement.id, {
        styles: {
          ...selectedElementSource.styles,
          display: 'grid',
          gridTemplateColumns: selectedElementSource.styles.gridTemplateColumns || 'repeat(2, minmax(0, 1fr))',
          justifyContent: selectedElementSource.styles.justifyContent ?? 'flex-start',
          alignItems: selectedElementSource.styles.alignItems ?? 'stretch',
          gap: selectedElementSource.styles.gap ?? '24px',
          padding: selectedElementSource.styles.padding ?? '24px',
          flexDirection: undefined,
        },
      });
    },
    [selectedElement, selectedElementSource, updateElement],
  );

  const handleTextAlignChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: string | null) => {
      if (!selectedElementSource || !selectedElement || !value) return;
      updateElement(selectedElement.id, {
        styles: { ...selectedElementSource.styles, textAlign: value } as EditorElement['styles'],
      });
    },
    [selectedElement, selectedElementSource, updateElement],
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

  if (!hasSelection) {
    return (
      <Box
        sx={{
          ...panelShellSx,
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 88,
            height: 88,
            borderRadius: '28px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(255, 107, 53, 0.08)',
            color: 'var(--ve-accent, #ff6b35)',
            mb: 2,
          }}
        >
          <TouchApp sx={{ fontSize: 48 }} />
        </Box>
        <Typography variant="h6" sx={{ color: 'var(--ve-ink, #2b2016)' }} gutterBottom>
          {tokens.propertiesPanel.emptyState.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--ve-muted, #6f6358)', mb: 3 }}>
          {tokens.propertiesPanel.emptyState.body}
        </Typography>
        <Box
          sx={{
            width: '100%',
            p: 2,
            bgcolor: 'rgba(255,255,255,0.78)',
            borderRadius: 3,
            border: '1px solid rgba(113, 87, 59, 0.08)',
            boxShadow: '0 16px 24px rgba(66, 42, 17, 0.04)',
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'var(--ve-muted, #6f6358)' }}>
            Tips:
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'var(--ve-muted, #6f6358)' }}>
            • {tokens.propertiesPanel.emptyState.tipSelect}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'var(--ve-muted, #6f6358)' }}>
            • {tokens.propertiesPanel.emptyState.tipMulti}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'var(--ve-muted, #6f6358)' }}>
            • {tokens.propertiesPanel.emptyState.tipEsc}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (multipleSelected) {
    return (
      <Box sx={panelShellSx}>
        <Box sx={panelHeaderSx}>
          <Typography variant="overline" sx={{ color: 'var(--ve-accent, #ff6b35)', letterSpacing: '0.16em', fontWeight: 700 }}>
            Multi-edit
          </Typography>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
            {tokens.propertiesPanel.multiSelect.title}
          </Typography>
          <Chip
            label={`${selectedElements.length} ${tokens.propertiesPanel.multiSelect.objectsSuffix}`}
            size="small"
            sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.82)', color: 'var(--ve-muted, #6f6358)' }}
          />
        </Box>

        <Box sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight={700} gutterBottom sx={{ color: 'var(--ve-ink, #2b2016)' }}>
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
              onClick={() => groupElements(selectedIds)}
            >
              {tokens.propertiesPanel.multiSelect.groupSelection}
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  const currentFontFamily = selectedElement.styles?.fontFamily || 'roboto';
  const currentFontWeight = selectedElement.styles?.fontWeight || 'normal';
  const currentFontSize = selectedElement.styles?.fontSize
    ? parseInt(String(selectedElement.styles.fontSize), 10)
    : 16;
  const currentTextAlign = (selectedElement.styles as Record<string, unknown>)?.textAlign as string || 'left';
  const currentLayoutMode = !selectedElementSource
    ? 'absolute'
    : selectedElementSource.type === 'grid' || selectedElementSource.styles.display === 'grid'
      ? 'grid'
      : selectedElementSource.styles.display === 'flex'
        ? selectedElementSource.styles.flexDirection === 'row'
          ? 'row'
          : 'stack'
        : 'absolute';
  const currentGap = selectedElement.styles?.gap
    ? parseInt(String(selectedElement.styles.gap), 10)
    : 0;
  const currentPadding = selectedElement.styles?.padding
    ? parseInt(String(selectedElement.styles.padding), 10)
    : 0;
  const currentGridColumns = selectedElement.styles?.gridTemplateColumns
    ? (() => {
        const repeatMatch = String(selectedElement.styles.gridTemplateColumns).match(/^repeat\(\s*(\d+)/i);
        if (repeatMatch) {
          return Number.parseInt(repeatMatch[1] ?? '2', 10);
        }

        return Math.max(1, String(selectedElement.styles.gridTemplateColumns).trim().split(/\s+/).length);
      })()
    : 2;
  const currentAlignItems = selectedElement.styles?.alignItems || (currentLayoutMode === 'grid' ? 'stretch' : 'flex-start');
  const currentJustifyContent = selectedElement.styles?.justifyContent || 'flex-start';
  const fontFamilyOptions = [
    { value: 'roboto', label: tokens.propertiesPanel.options.fontRoboto },
    { value: 'arial', label: tokens.propertiesPanel.options.fontArial },
    { value: 'helvetica', label: tokens.propertiesPanel.options.fontHelvetica },
  ];
  const availableFontFamilyOptions = fontFamilyOptions.some((option) => option.value === currentFontFamily)
    ? fontFamilyOptions
    : [{ value: currentFontFamily, label: currentFontFamily }, ...fontFamilyOptions];
  const elementName =
    selectedElement.name ||
    (selectedElement.props?.name as string) ||
    selectedElement.type ||
    tokens.visualEditorPanel.elementLabel;
  const tokenBindings = [
    { property: 'backgroundColor' as const, label: 'Background', type: 'color' as const, visible: true },
    { property: 'color' as const, label: 'Text color', type: 'color' as const, visible: isTextElement || isShapeElement || selectedElement.type === 'button' },
    { property: 'fontSize' as const, label: 'Font size', type: 'size' as const, visible: isTextElement },
    { property: 'padding' as const, label: 'Padding', type: 'spacing' as const, visible: isLayoutContainer || selectedElement.type === 'button' || selectedElement.type === 'card' },
    { property: 'gap' as const, label: 'Gap', type: 'spacing' as const, visible: isLayoutContainer && currentLayoutMode !== 'absolute' },
    { property: 'borderRadius' as const, label: 'Radius', type: 'radius' as const, visible: true },
    { property: 'boxShadow' as const, label: 'Shadow', type: 'shadow' as const, visible: true },
  ].filter((binding) => binding.visible);

  const renderTokenBindingField = (config: typeof tokenBindings[number]) => {
    const boundTokenName = getBoundTokenName(config.property);
    const matchingTokens = availableDesignTokens.filter((token) => token.type === config.type || token.type === 'custom');

    return (
      <Box
        key={config.property}
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: '1px solid rgba(113, 87, 59, 0.1)',
          bgcolor: 'rgba(255,255,255,0.68)',
        }}
      >
        <Stack spacing={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" fontWeight={700}>
              {config.label}
            </Typography>
            {boundTokenName && (
              <Chip
                size="small"
                color="primary"
                label={`--ve-token-${boundTokenName}`}
                onDelete={() => unbindDesignToken(config.property)}
              />
            )}
          </Box>
          <TextField
            select
            size="small"
            label={`Apply ${config.label} token`}
            value=""
            onChange={(event) => {
              const tokenName = event.target.value.trim();
              if (tokenName) {
                bindDesignToken(config.property, tokenName);
              }
            }}
            helperText={matchingTokens.length > 0
              ? 'Bind a reusable token to this property'
              : 'No matching tokens created yet'}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="" disabled>
              Select token
            </MenuItem>
            {matchingTokens.map((token) => (
              <MenuItem key={token.name} value={token.name}>
                {token.name} ({token.value})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              onClick={() => createDesignTokenFromStyle(config.property, config.type, config.label)}
            >
              {boundTokenName ? 'Update token' : 'Create token'}
            </Button>
            {boundTokenName && (
              <Button
                variant="text"
                size="small"
                color="error"
                onClick={() => deleteDesignToken(boundTokenName)}
              >
                Delete token
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={panelShellSx}>
      <Box sx={panelHeaderSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'var(--ve-accent, #ff6b35)', letterSpacing: '0.16em', fontWeight: 700 }}>
              Inspector
            </Typography>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
              {elementName}
            </Typography>
          </Box>
          <Chip
            label={selectedElement.type}
            size="small"
            color={isShapeElement ? 'secondary' : 'primary'}
            variant="outlined"
            sx={{ bgcolor: 'rgba(255,255,255,0.72)' }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)' }}>
          {tokens.propertiesPanel.labels.id}: {selectedElement.id.slice(0, 8)}...
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', display: 'block', mt: 0.5 }}>
          Editing {state.currentBreakpoint} breakpoint
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', py: 1.25 }}>
        <Accordion defaultExpanded disableGutters elevation={0} sx={sectionAccordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
              Identity
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Stack spacing={1.25}>
              <TextField
                label="Name"
                size="small"
                value={selectedElement.name ?? ''}
                onChange={(event) => renameElement(selectedElement.id, event.target.value)}
              />
              <TextField
                label="Class"
                size="small"
                value={selectedElement.className ?? ''}
                onChange={(event) => setElementClassName(selectedElement.id, event.target.value)}
                helperText="Shared style classes are exported and resolved on the canvas."
              />
              <TextField
                select
                label="Apply existing class"
                size="small"
                value=""
                onChange={handleApplyExistingClass}
                helperText={availableStyleClassNames.length > 0
                  ? 'Attach a shared class to this element'
                  : 'No shared classes created yet'}
                SelectProps={{ displayEmpty: true }}
              >
                <MenuItem value="" disabled>
                  Select shared class
                </MenuItem>
                {availableStyleClassNames
                  .filter((className) => !selectedClassNames.includes(className))
                  .map((className) => (
                    <MenuItem key={className} value={className}>
                      {className}
                    </MenuItem>
                  ))}
              </TextField>
              {componentBinding && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid rgba(113, 87, 59, 0.12)',
                    bgcolor: 'rgba(255,255,255,0.72)',
                  }}
                >
                  <Stack spacing={0.75}>
                    <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', display: 'block' }}>
                      Component Instance
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {componentBinding.componentName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      <Chip size="small" label={`Variant ${componentBinding.variantName}`} color="secondary" variant="outlined" />
                      <Chip size="small" label={`Slot ${componentBinding.slotName}`} variant="outlined" />
                      {componentBinding.isRoot && (
                        <Chip size="small" label="Root layer" color="primary" variant="outlined" />
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)' }}>
                      Family {componentBinding.familyId} • Instance {componentBinding.instanceId.slice(0, 8)}
                    </Typography>
                  </Stack>
                </Box>
              )}
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid rgba(113, 87, 59, 0.12)',
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                <Stack spacing={1.25}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', display: 'block' }}>
                        Shared Styles
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {primaryStyleClassName ? `.${primaryStyleClassName}` : 'No class source yet'}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={syncStylesToSharedClass}
                    >
                      {primaryStyleClassName ? 'Sync styles' : 'Create class'}
                    </Button>
                  </Box>
                  {selectedClassNames.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {selectedClassNames.map((className) => (
                        <Chip
                          key={className}
                          label={`.${className}`}
                          size="small"
                          color={className === primaryStyleClassName ? 'primary' : 'default'}
                          onDelete={() => detachStyleClass(className)}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)' }}>
                      Sync the current styles to create a reusable class for export, templates and components.
                    </Typography>
                  )}
                  {primaryStyleClass && (
                    <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)' }}>
                      Shared class contributes {Object.keys(primaryStyleClass.styles).length} base styles
                      {primaryStyleClass.responsive?.tablet || primaryStyleClass.responsive?.mobile
                        ? ' and responsive overrides'
                        : ''}.
                    </Typography>
                  )}
                  {primaryStyleClassName && (
                    <Button
                      variant="text"
                      size="small"
                      color="error"
                      onClick={() => deleteStyleClass(primaryStyleClassName)}
                    >
                      Delete shared class
                    </Button>
                  )}
                </Stack>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={selectedElement.visible === false ? 'outlined' : 'contained'}
                  size="small"
                  onClick={() => toggleElementVisibility(selectedElement.id)}
                >
                  {selectedElement.visible === false ? 'Show element' : 'Hide element'}
                </Button>
                <Button
                  variant={selectedElement.locked ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => toggleElementLock(selectedElement.id)}
                >
                  {selectedElement.locked ? 'Unlock' : 'Lock'}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => duplicateElement(selectedElement.id)}
                >
                  Duplicate
                </Button>
                {selectedElement.children && selectedElement.children.length > 0 && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => ungroupElement(selectedElement.id)}
                  >
                    Ungroup
                  </Button>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => deleteElement(selectedElement.id)}
                >
                  Delete
                </Button>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded disableGutters elevation={0} sx={sectionAccordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
              Design Tokens
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Stack spacing={1.25}>
              {tokenBindings.map((binding) => renderTokenBindingField(binding))}
              {availableDesignTokens.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {availableDesignTokens.slice(0, 8).map((token) => (
                    <Chip
                      key={token.name}
                      label={`${token.name}: ${token.value}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)' }}>
                  Create tokens from live styles here. They are persisted with the project and exported as CSS variables.
                </Typography>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded disableGutters elevation={0} sx={sectionAccordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
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
                disabled={isAutoLayoutChild}
                onChange={(e) => handlePositionChange('x', e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
              />
              <TextField
                label={tokens.propertiesPanel.labels.y}
                size="small"
                value={Math.round(selectedElement.y)}
                type="number"
                disabled={isAutoLayoutChild}
                onChange={(e) => handlePositionChange('y', e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
              />
            </Box>

            {isAutoLayoutChild && (
              <Typography variant="caption" sx={{ color: 'var(--ve-muted, #6f6358)', display: 'block', mb: 2 }}>
                Position is managed by the parent {parentLayoutMode} layout. Adjust width, height, gap or alignment instead.
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label={tokens.propertiesPanel.labels.width}
                size="small"
                value={Math.round(selectedElement.width)}
                type="number"
                disabled={sizeMode === 'auto'}
                onChange={(e) => handleSizeChange('width', e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
              />
              <TextField
                label={tokens.propertiesPanel.labels.height}
                size="small"
                value={Math.round(selectedElement.height)}
                type="number"
                disabled={sizeMode === 'auto'}
                onChange={(e) => handleSizeChange('height', e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
              />
            </Box>

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
              <IconButton
                size="small"
                sx={{ ml: 'auto' }}
                onClick={() => toggleElementVisibility(selectedElement.id)}
                aria-label={selectedElement.visible === false ? 'Show element' : 'Hide element'}
              >
                {selectedElement.visible === false ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </Box>
          </AccordionDetails>
        </Accordion>

        {isLayoutContainer && (
          <Accordion defaultExpanded disableGutters elevation={0} sx={sectionAccordionSx}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
                Layout
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              <ToggleButtonGroup
                value={currentLayoutMode}
                exclusive
                onChange={handleLayoutModeChange}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
              >
                <ToggleButton value="absolute" aria-label="Absolute layout">
                  Absolute
                </ToggleButton>
                <ToggleButton value="stack" aria-label="Stack layout">
                  Stack
                </ToggleButton>
                <ToggleButton value="row" aria-label="Row layout">
                  Row
                </ToggleButton>
                <ToggleButton value="grid" aria-label="Grid layout">
                  Grid
                </ToggleButton>
              </ToggleButtonGroup>

              {currentLayoutMode !== 'absolute' && (
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      label="Gap"
                      size="small"
                      type="number"
                      value={currentGap}
                      onChange={(event) => handleStyleChange('gap', `${event.target.value}px`)}
                      sx={{ flex: 1 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                    />
                    <TextField
                      label="Padding"
                      size="small"
                      type="number"
                      value={currentPadding}
                      onChange={(event) => handleStyleChange('padding', `${event.target.value}px`)}
                      sx={{ flex: 1 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                    />
                  </Box>

                  {currentLayoutMode === 'grid' && (
                    <TextField
                      label="Columns"
                      size="small"
                      type="number"
                      value={currentGridColumns}
                      onChange={(event) => {
                        const nextColumns = Math.max(1, Number.parseInt(event.target.value || '1', 10) || 1);
                        handleStyleChange('gridTemplateColumns', `repeat(${nextColumns}, minmax(0, 1fr))`);
                      }}
                      InputProps={{ endAdornment: <InputAdornment position="end">cols</InputAdornment> }}
                    />
                  )}

                  <Select
                    size="small"
                    value={currentAlignItems}
                    onChange={(event) => handleStyleChange('alignItems', event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="flex-start">Align: Start</MenuItem>
                    <MenuItem value="center">Align: Center</MenuItem>
                    <MenuItem value="flex-end">Align: End</MenuItem>
                    <MenuItem value="stretch">Align: Stretch</MenuItem>
                  </Select>

                  <Select
                    size="small"
                    value={currentJustifyContent}
                    onChange={(event) => handleStyleChange('justifyContent', event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="flex-start">Distribute: Start</MenuItem>
                    <MenuItem value="center">Distribute: Center</MenuItem>
                    <MenuItem value="flex-end">Distribute: End</MenuItem>
                    <MenuItem value="space-between">Distribute: Space Between</MenuItem>
                  </Select>
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {isTextElement && (
          <Accordion defaultExpanded disableGutters elevation={0} sx={sectionAccordionSx}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
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
                sx={{ mb: 2 }}
              >
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
                {availableFontFamilyOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label={tokens.propertiesPanel.labels.size}
                  size="small"
                  value={currentFontSize}
                  type="number"
                  onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)}
                  sx={{ width: 80 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">px</InputAdornment> }}
                />
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

        <Accordion defaultExpanded disableGutters elevation={0} sx={sectionAccordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
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
                  sx={{ flex: 1 }}
                />
                <Box
                  component="input"
                  type="color"
                  value={selectedElement.styles?.backgroundColor || '#FFFFFF'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    handleStyleChange('backgroundColor', e.target.value);
                  }}
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
                  sx={{ flex: 1 }}
                />
                <Box
                  component="input"
                  type="color"
                  value={selectedElement.styles?.color || '#000000'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    handleStyleChange('color', e.target.value);
                  }}
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

        <Accordion disableGutters elevation={0} sx={sectionAccordionSx}>
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ color: 'var(--ve-ink, #2b2016)' }}>
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
                  if (!Number.isNaN(pct)) {
                    handleStyleChange('opacity', Math.max(0, Math.min(100, pct)) / 100);
                  }
                }}
                sx={{ width: 80 }}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />
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
