import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Fab,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Backdrop,
  Stack,
  Chip,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Close as CloseIcon,
  Palette as PaletteIcon,
  FormatPaint as FormatPaintIcon,
  Visibility as VisibilityIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Tune as TuneIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';
import { ColorPicker } from './ColorPicker';
import { BrandingValidator } from './BrandingValidator';
import { FeatureEditor } from './FeatureEditor';
import { useToast } from '@/hooks/use-toast';
import { useWireMock } from '@/hooks/useWireMock';
import { getVisualEditorTokens } from '../admin/visual-editor/visualEditorTokens';

interface VisualEditorProps {
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void
}

interface EditableElement {
  id: string;
  element: HTMLElement;
  originalStyles: Record<string, string>;
  type: 'button' | 'text' | 'background' | 'icon';
  property: string
}

export function VisualEditor({ enabled = false, onToggle }: VisualEditorProps) {
  const tokens = getVisualEditorTokens();
  const [isActive, setIsActive] = useState(enabled);
  const [selectedElement, setSelectedElement] = useState<EditableElement | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFeatureEditor, setShowFeatureEditor] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [changes, setChanges] = useState<Record<string, any>>({});
  const [brandingWarning, setBrandingWarning] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Theming system
  const theming = useTheming('photographer');
  const { status: wireMockStatus, testEndpoint } = useWireMock();

  // Merkevare-kompatible farger
  const brandColors = {
    primary: {
      main: '#1976d0',
      light: '#42a5f0',
      dark: '#1565c0',
      contrastText: '#ffffff',
  },
    secondary: {
      main: '#dc0040',
      light: '#ff5980',
      dark: '#9a0030',
      contrastText: '#ffffff',
  },
    success: {
      main: '#2e7d30',
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff',
  },
    warning: {
      main: '#ed6c00',
      light: '#ff9800',
      dark: '#e65100',
      contrastText: '#ffffff',
  },
    error: {
      main: '#d32f20',
      light: '#f44330',
      dark: '#c62820',
      contrastText: '#ffffff',
  },
};

  const iconMotionSx = {
    transition: `transform ${tokens.iconAnimation.durationMs}ms ${tokens.iconAnimation.easing}`,
    '&:hover': { transform: `scale(${tokens.iconAnimation.scaleHover})` },
    '&:active': { transform: `scale(${tokens.iconAnimation.scaleActive})` },
  };

  const getFabIcon = () => {
    switch (tokens.fab.icon) {
      case 'palette':
        return <PaletteIcon />;
      case 'paint':
        return <FormatPaintIcon />;
      case 'visibility':
        return <VisibilityIcon />;
      case 'tune':
        return <TuneIcon />;
      case 'edit':
      default:
        return <EditIcon />;
    }
  };

  // Toggle Visual Editor
  const toggleVisualEditor = () => {
    const newState = !isActive;
    setIsActive(newState);
    onToggle?.(newState);

    if (newState) {
      enableEditMode();
      toast({
        title: tokens.visualEditorPanel.toast.enabledTitle,
        description: tokens.visualEditorPanel.toast.enabledDescription,
        variant: 'default',
    });
  } else {
      disableEditMode();
      toast({
        title: tokens.visualEditorPanel.toast.disabledTitle,
        description: tokens.visualEditorPanel.toast.disabledDescription,
        variant: 'default',
    });
  }
};

  // Enable edit mode
  const enableEditMode = () => {
    document.body.style.cursor = 'crosshair';
    document.addEventListener('click', handleElementClick, true);
    document.addEventListener('mouseover', handleElementHover, true);
    document.addEventListener('mouseout', handleElementMouseOut, true);

    // Add visual indicators
    document.body.classList.add('visual-editor-active');

    // Inject CSS for hover effects
    const style = document.createElement('style');
    style.id = 'visual-editor-styles';
    style.textContent = `
      .visual-editor-active * {
        position: relative !important;
  }
      
      .visual-editor-hover {
        outline: 2px dashed #1976d2 !important;
        outline-offset: 2px !important;
        cursor: pointer !important;
        background-color: rgba(5, 118, 210, 0.1) !important;
    }
      
      .visual-editor-selected {
        outline: 3px solid #dc004e !important;
        outline-offset: 2px !important;
        background-color: rgba(20, 7, 8, 0.15) !important;
    }
      
      .visual-editor-tooltip {
        position: absolute;
        top: -30px;
        left: 0;
        background: #1976d2;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
        pointer-events: none;
  }
    `;
    document.head.appendChild(style);
};

  // Disable edit mode
  const disableEditMode = () => {
    document.body.style.cursor = 'default';
    document.removeEventListener('click', handleElementClick, true);
    document.removeEventListener('mouseover', handleElementHover, true);
    document.removeEventListener('mouseout', handleElementMouseOut, true);

    document.body.classList.remove('visual-editor-active');

    // Remove hover effects
    document.querySelectorAll('.visual-editor-hover').forEach((el) => {
      el.classList.remove('visual-editor-hover');
  });

    document.querySelectorAll('.visual-editor-selected').forEach((el) => {
      el.classList.remove('visual-editor-selected');
  });

    // Remove tooltips
    document.querySelectorAll('.visual-editor-tooltip').forEach((el) => {
      el.remove();
  });

    // Remove injected styles
    const style = document.getElementById('visual-editor-styles');
    if (style) {
      style.remove();
  }

    setSelectedElement(null);
    setHoveredElement(null);
    setShowColorPicker(false);
};

  // Handle element hover
  const handleElementHover = (e: Event) => {
    const target = e.target as HTMLElement;

    if (target.closest('.visual-editor-panel')) {
      return;
}

    // Remove previous hover effects
    document.querySelectorAll('.visual-editor-hover').forEach((el) => {
      el.classList.remove('visual-editor-hover');
  });

    // Add hover effect
    target.classList.add('visual-editor-hover');
    setHoveredElement(target);

    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'visual-editor-tooltip';
    tooltip.textContent = getElementType(target);
    target.appendChild(tooltip);
};

  // Handle element mouse out
  const handleElementMouseOut = (e: Event) => {
    const target = e.target as HTMLElement;
    target.classList.remove('visual-editor-hover');

    // Remove tooltip
    const tooltip = target.querySelector('.visual-editor-tooltip');
    if (tooltip) {
      tooltip.remove();
}
};

  // Handle element click
  const handleElementClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;

    if (target.closest('.visual-editor-panel')) {
      return;
}

    // Remove previous selection
    document.querySelectorAll('.visual-editor-selected').forEach((el) => {
      el.classList.remove('visual-editor-selected');
  });

    // Select element
    target.classList.add('visual-editor-selected');

    const elementType = getElementType(target);
    const editableElement: EditableElement = {
      id: generateElementId(target),
      element: target,
      originalStyles: {
        backgroundColor: getComputedStyle(target).backgroundColor,
        color: getComputedStyle(target).color,
        borderColor: getComputedStyle(target).borderColor,
    },
      type: elementType,
      property: elementType === 'button' ? 'backgroundColor' : 'color',
  };

    setSelectedElement(editableElement);
    setShowColorPicker(true);

    toast({
      title: `${getElementDisplayName(elementType)} ${tokens.visualEditorPanel.selectedLabel}`,
      description: tokens.visualEditorPanel.instructions,
      variant: 'default',
  });
};

  // Get element type
  const getElementType = (element: HTMLElement): 'button' | 'text' | 'background' | 'icon' => {
    if (element.tagName.toLowerCase() === 'button' || element.closest('button')) {
      return 'button';
}
    if (element.tagName.toLowerCase() === 'svg' || element.closest('svg')) {
      return 'icon';
  }
    if (
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span','div'].includes(
        element.tagName.toLowerCase(),
      )
    ) {
      return 'text';
  }
    return 'background';
};

  // Get element display name
  const getElementDisplayName = (type: string): string => {
    const names = {
      button: tokens.visualEditorPanel.elementTypes.button,
      text: tokens.visualEditorPanel.elementTypes.text,
      background: tokens.visualEditorPanel.elementTypes.background,
      icon: tokens.visualEditorPanel.elementTypes.icon,
  };
    return names[type] || type;
};

  // Generate element ID
  const generateElementId = (element: HTMLElement): string => {
    return `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

  // Handle color change
  const handleColorChange = (color: string, property: string) => {
    if (!selectedElement) return;

    // Validate color against branding
    const validation = BrandingValidator.validateColor(color, brandColors);

    if (!validation.isValid) {
      setBrandingWarning(validation.message);
      return;
  }

    // Apply color change
    selectedElement.element.style[property] = color;

    // Store change
    setChanges((prev) => ({
      ...prev,
      [selectedElement.id]: {
        ...prev[selectedElement.id],
        [property]: color,
    },
  }));

    setBrandingWarning(null);

    toast({
      title: tokens.visualEditorPanel.toast.colorChangedTitle,
      description: tokens.visualEditorPanel.toast.colorChangedDescription,
      variant: 'default',
  });
};

  // Save changes (with WireMock support)
  const saveChanges = async () => {
    try {
      // Test med WireMock hvis aktivert
      if (wireMockStatus?.isEnabled && wireMockStatus?.currentMode === 'mock') {
        await testEndpoint({
          id: 'visual-editor-save',
          name: 'Visual Editor Save',
          method: 'POS',
          url: '/api/visual-editor/save',
          responseStatus: 20,
          responseBody: { success: true, saved: Object.keys(changes).length },
          isActive: true,
          service: 'visual-editor',
          usageCount: 0,
          createdAt: new Date(),
      });
    }

      // Her kan vi implementere lagring til backend eller localStorage
      localStorage.setItem('visual-editor-changes', JSON.stringify(changes));

      toast({
        title: tokens.visualEditorPanel.toast.saveSuccessTitle,
        description: `${Object.keys(changes).length} ${tokens.visualEditorPanel.toast.saveSuccessDescription}`,
        variant: 'default',
    });
  } catch (error) {
      toast({
        title: tokens.visualEditorPanel.toast.saveErrorTitle,
        description: tokens.visualEditorPanel.toast.saveErrorDescription,
        variant: 'destructive',
    });
  }
};

  // Undo changes
  const undoChanges = () => {
    Object.entries(changes).forEach(([elementId, elementChanges]) => {
      const element = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement;
      if (element) {
        Object.entries(elementChanges).forEach(([property, value]) => {
          element.style[property] = '';
      });
    }
  });

    setChanges({});
    toast({
      title: tokens.visualEditorPanel.toast.undoTitle,
      description: tokens.visualEditorPanel.toast.undoDescription,
      variant: 'default',
  });
};

  return (
    <>
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label={tokens.fab.label}
        onClick={toggleVisualEditor}
        sx={{
          position: 'fixed',
          bottom: 10,
          right:  20,
          zIndex: 99,
          backgroundColor: isActive ? 'secondary.main' : 'primary.main', '&:hover': {
            backgroundColor: isActive ? 'secondary.dark' : 'primary.dark',
        },
          ...iconMotionSx,
        }}
      >
        {isActive ? <CloseIcon /> : getFabIcon()}
      </Fab>

      {/* Visual Editor Panel */}
      {isActive && (
        <Backdrop open sx={{ zIndex: 999}}>
          <Box
            className="visual-editor-panel"
            sx={{
              position: 'fixed',
              top:  20,
              right:  20,
              width: 30,
              maxHeight: 'calc(100vh - 40px, )',
              overflow: 'auto',
              zIndex: 99}}
          >
            <Paper
              elevation={8}
              sx={{
                p:  3,
                background: 'rgba(25, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius:  2}}
             sx={theming.getThemedCardSx()}>
              {/* Header */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" color="primary.main" sx={{  fontWeight: 700 }}>
                  {tokens.visualEditorPanel.title}
                </Typography>
                <IconButton size="small" onClick={toggleVisualEditor} sx={iconMotionSx}>
                  <CloseIcon />
                </IconButton>
              </Stack>

              {/* Instructions */}
              <Alert severity="info" sx={{ mb:  2 }}>
                {tokens.visualEditorPanel.instructions}
              </Alert>

              {/* Selected Element Info */}
              {selectedElement && (
                <Box sx={{ mb:  2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {tokens.visualEditorPanel.selectedLabel}:
                  </Typography>
                  <Chip
                    icon={<PaletteIcon />}
                    label={getElementDisplayName(selectedElement.type)}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                </Box>
              )}

              {/* Color Picker */}
              {showColorPicker && selectedElement && (
                <ColorPicker
                  selectedElement={selectedElement}
                  brandColors={brandColors}
                  onColorChange={handleColorChange}
                  onClose={() => setShowColorPicker(false)}
                />
              )}

              {/* Feature Editor */}
              {showFeatureEditor && (
                <FeatureEditor
                  onFeatureUpdate={(feature) => {
                    console.log('🔧 Feature oppdatert: ', feature);
                    toast({
                      title: tokens.visualEditorPanel.toast.featureUpdatedTitle,
                      description: `${feature.name} ${tokens.visualEditorPanel.toast.featureUpdatedDescription} ${feature.enabled ? tokens.propertiesPanel.options.enabled : tokens.propertiesPanel.options.disabled}`,
                      variant: 'default',
                  });
                }}
                  onClose={() => setShowFeatureEditor(false)}
                />
              )}

              {/* Actions */}
              <Stack direction="row" spacing={1} mt={2}>
                <Tooltip title={tokens.visualEditorPanel.saveTooltip}>
                  <IconButton
                    color="primary"
                    onClick={saveChanges}
                    disabled={Object.keys(changes).length === 0}
                    sx={iconMotionSx}
                  >
                    <SaveIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title={tokens.visualEditorPanel.undoTooltip}>
                  <IconButton
                    color="error"
                    onClick={undoChanges}
                    disabled={Object.keys(changes).length === 0}
                    sx={iconMotionSx}
                  >
                    <UndoIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title={tokens.visualEditorPanel.previewTooltip}>
                  <IconButton color="info" sx={iconMotionSx}>
                    <VisibilityIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title={tokens.visualEditorPanel.featureEditorTooltip}>
                  <IconButton
                    color="secondary"
                    onClick={() => setShowFeatureEditor(!showFeatureEditor)}
                    sx={iconMotionSx}
                  >
                    <TuneIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Changes Counter & Features */}
              <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
                {Object.keys(changes).length > 0 && (
                  <Chip
                    label={`${Object.keys(changes).length} ${tokens.visualEditorPanel.changesLabel}`}
                    color="secondary"
                    size="small"
                  />
                )}

                <Chip
                  label={tokens.visualEditorPanel.featuresLabel}
                  color={showFeatureEditor ? 'primary' : 'default'}
                  size="small"
                  icon={<TuneIcon />}
                  onClick={() => setShowFeatureEditor(!showFeatureEditor)}
                  clickable
                />
              </Stack>
            </Paper>
          </Box>
        </Backdrop>
      )}

      {/* Branding Warning Snackbar */}
      <Snackbar
        open={!!brandingWarning}
        autoHideDuration={6000}
        onClose={() => setBrandingWarning(null)}
        anchorOrigin={{ vertical: 'top', horizontal:'center'}}
      >
        <Alert severity="warning" onClose={() => setBrandingWarning(null)}>
          {brandingWarning}
        </Alert>
      </Snackbar>
    </>
  );
}
