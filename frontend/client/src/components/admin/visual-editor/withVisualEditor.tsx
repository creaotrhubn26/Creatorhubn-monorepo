/**
 * Higher-Order Component for Visual Editor Integration
 * Wraps dashboard components with Visual Editor editing capabilities
 * Enables in-context editing of all UniversalDashboard components
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Typography,
  Chip,
  Fade,
  Popper,
  ClickAwayListener,
  Stack,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  TextField
} from '@mui/material';

import {
  Edit,
  Settings,
  Preview,
  Code,
  Save,
  Close,
  Palette,
  Layout,
  Behavior,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';

interface VisualEditorProps {
  isEditing?: boolean;
  onEdit?: () => void;
  onSave?: (customizations: Record<string, unknown>) => void;
  onCancel?: () => void;
  customizations?: Record<string, unknown>;
  componentId?: string;
  componentName?: string;
  profession?: string;
}

interface WithVisualEditorOptions {
  componentId: string;
  componentName: string;
  category: string;
  editable: boolean;
  previewable: boolean;
  templateable: boolean;
  propsEditable: boolean;
}

export function withVisualEditor<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithVisualEditorOptions
) {
  const WithVisualEditorComponent = (props: P & VisualEditorProps) => {
    const {
      isEditing = false,
      onEdit,
      onSave,
      onCancel,
      customizations = {},
      componentId = options.componentId,
      componentName = options.componentName,
      profession = 'admin',
      ...restProps
  } = props;

    // Enhanced Master Integration
    const { analytics, debugging, performance } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');

    // State management
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showFloatingControls, setShowFloatingControls] = useState(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [localCustomizations, setLocalCustomizations] = useState(customizations || {});
    const [isHovered, setIsHovered] = useState(false);
    const componentRef = useRef<HTMLDivElement>(null);
    const isLandingComponent = componentId === 'landing-desktop' || componentId === 'landing-mobile';

    const updateCustomization = useCallback((path: string[], value: any) => {
      setLocalCustomizations((prev: Record<string, any> = {}) => {
        const next = { ...prev };
        let cursor: Record<string, any> = next;
        path.slice(0, -1).forEach((key) => {
          if (!cursor[key] || typeof cursor[key] !== 'object') {
            cursor[key] = {};
          }
          cursor = cursor[key];
        });
        cursor[path[path.length - 1]] = value;
        return next;
      });
    }, []);

    // Track component usage
    useEffect(() => {
      analytics.trackEvent('component_rendered', {
        componentId,
        componentName,
        category: options.category,
        profession,
        isEditing,
        hasCustomizations: Object.keys(customizations).length > 0 });
  }, [analytics, componentId, componentName, options.category, profession, isEditing, customizations]);

    // Handle edit mode toggle
    const handleEdit = useCallback(() => {
      setShowEditDialog(true);
      onEdit?.();
      
      analytics.trackEvent('component_edit_initiated', {
        componentId,
        componentName,
        profession
    });
  }, [analytics, componentId, componentName, profession, onEdit]);

    // Handle save
    const handleSave = useCallback(() => {
      onSave?.(localCustomizations);
      setShowFloatingControls(false);
      setShowEditDialog(false);
      
      analytics.trackEvent('component_customization_saved', {
        componentId,
        componentName,
        profession,
        customizations: localCustomizations
  });
  }, [onSave, localCustomizations, analytics, componentId, componentName, profession]);

    // Handle cancel
    const handleCancel = useCallback(() => {
      setLocalCustomizations(customizations);
      setShowFloatingControls(false);
      setShowEditDialog(false);
      onCancel?.();
      
      analytics.trackEvent('component_edit_cancelled', {
        componentId,
        componentName,
        profession
    });
  }, [customizations, onCancel, analytics, componentId, componentName, profession]);

    // Handle mouse events for floating controls
    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      if (isEditing) {
        setShowFloatingControls(true);
    }
  }, [isEditing]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      if (!isHovered) {
        setShowFloatingControls(false);
    }
  }, [isHovered]);

    // Handle click away for floating controls
    const handleClickAway = useCallback(() => {
      setShowFloatingControls(false);
  }, []);

    // Render floating edit controls
    const renderFloatingControls = () => {
      if (!isEditing || !showFloatingControls) return null;

      return (
        <ClickAwayListener onClickAway={handleClickAway}>
          <Popper
            open={showFloatingControls}
            anchorEl={componentRef.current}
            placement="top"
            transition
            sx={{ zIndex: 130}}
          >
            {({ TransitionProps }) => (
              <Fade {...TransitionProps} timeout={200}>
                <Paper
                  elevation={8}
                  sx={{
                    p:  1,
                    display: 'flex',
                    gap: 0.5,
                    alignItems: 'center',
                    borderRadius:  2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'primary.main'
              }}
                >
                  <Chip
                    label={componentName}
                    size="small"
                    color="primary"
                    sx={{ mr:  1 }}
                  />
                  
                  <Tooltip title="Edit Component">
                    <IconButton size="small" onClick={handleEdit}>
                      {theming.getThemedIcon('edit')}
                    </IconButton>
                  </Tooltip>
                  
                  {options.previewable && (
                    <Tooltip title="Preview">
                      <IconButton size="small">
                        <Preview />
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  <Tooltip title="Settings">
                    <IconButton size="small">
                      {theming.getThemedIcon('settings')}
                    </IconButton>
                  </Tooltip>
                </Paper>
              </Fade>
            )}
          </Popper>
        </ClickAwayListener>
      );
  };

    // Render edit dialog
    const renderEditDialog = () => (
      <Dialog
        open={showEditDialog}
        onClose={handleCancel}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh',}
      }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            {theming.getThemedIcon('edit')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Edit {componentName}
            </Typography>
            <Chip 
              label={options.category} 
              size="small" 
              color="primary" 
              variant="outlined"
            />
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mb:  3 }}>
            <Typography variant="body2" color="text.secondary">
              Customize the appearance and behavior of this component
            </Typography>
          </Box>

          {isLandingComponent ? (
            <Stack spacing={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>
                  Samarbeidspartner
                </Typography>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localCustomizations?.partnerSection?.enabled ?? true}
                        onChange={(event) =>
                          updateCustomization(['partnerSection', 'enabled'], event.target.checked)
                        }
                      />
                    }
                    label="Vis seksjon"
                  />
                  <TextField
                    label="Tittel"
                    value={localCustomizations?.partnerSection?.title || ''}
                    onChange={(event) =>
                      updateCustomization(['partnerSection', 'title'], event.target.value)
                    }
                    fullWidth
                  />
                  <TextField
                    label="Beskrivelse"
                    value={localCustomizations?.partnerSection?.description || ''}
                    onChange={(event) =>
                      updateCustomization(['partnerSection', 'description'], event.target.value)
                    }
                    fullWidth
                    multiline
                    minRows={3}
                  />
                  <TextField
                    label="Logo URL"
                    value={localCustomizations?.partnerSection?.logoUrl || ''}
                    onChange={(event) =>
                      updateCustomization(['partnerSection', 'logoUrl'], event.target.value)
                    }
                    fullWidth
                  />
                  <TextField
                    label="CTA-tekst"
                    value={localCustomizations?.partnerSection?.ctaLabel || ''}
                    onChange={(event) =>
                      updateCustomization(['partnerSection', 'ctaLabel'], event.target.value)
                    }
                    fullWidth
                  />
                  <Divider />
                  <TextField
                    label="Dialogtittel"
                    value={localCustomizations?.partnerSection?.dialogTitle || ''}
                    onChange={(event) =>
                      updateCustomization(['partnerSection', 'dialogTitle'], event.target.value)
                    }
                    fullWidth
                  />
                  <TextField
                    label="Dialoginnhold"
                    value={localCustomizations?.partnerSection?.dialogBody || ''}
                    onChange={(event) =>
                      updateCustomization(['partnerSection', 'dialogBody'], event.target.value)
                    }
                    fullWidth
                    multiline
                    minRows={4}
                    helperText="Bruk linjeskift for flere avsnitt"
                  />
                  <TextField
                    label="Dialogpunkter"
                    value={localCustomizations?.partnerSection?.dialogBullets || ''}
                    onChange={(event) =>
                      updateCustomization(['partnerSection', 'dialogBullets'], event.target.value)
                    }
                    fullWidth
                    multiline
                    minRows={3}
                    helperText="Ett punkt per linje"
                  />
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>
                  Video
                </Typography>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localCustomizations?.videoSection?.enabled ?? true}
                        onChange={(event) =>
                          updateCustomization(['videoSection', 'enabled'], event.target.checked)
                        }
                      />
                    }
                    label="Vis seksjon"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localCustomizations?.videoSection?.showEmbeddedVideo ?? true}
                        onChange={(event) =>
                          updateCustomization(['videoSection', 'showEmbeddedVideo'], event.target.checked)
                        }
                      />
                    }
                    label="Aktiv video"
                  />
                  <TextField
                    label="Videotittel"
                    value={localCustomizations?.videoSection?.title || ''}
                    onChange={(event) =>
                      updateCustomization(['videoSection', 'title'], event.target.value)
                    }
                    fullWidth
                  />
                  <TextField
                    label="Videotekst"
                    value={localCustomizations?.videoSection?.description || ''}
                    onChange={(event) =>
                      updateCustomization(['videoSection', 'description'], event.target.value)
                    }
                    fullWidth
                    multiline
                    minRows={3}
                  />
                  <TextField
                    label="Video URL"
                    value={localCustomizations?.videoSection?.videoUrl || ''}
                    onChange={(event) =>
                      updateCustomization(['videoSection', 'videoUrl'], event.target.value)
                    }
                    fullWidth
                  />
                  <TextField
                    label="Poster URL"
                    value={localCustomizations?.videoSection?.posterUrl || ''}
                    onChange={(event) =>
                      updateCustomization(['videoSection', 'posterUrl'], event.target.value)
                    }
                    fullWidth
                  />
                  <Stack direction="row" spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={localCustomizations?.videoSection?.autoPlay ?? true}
                          onChange={(event) =>
                            updateCustomization(['videoSection', 'autoPlay'], event.target.checked)
                          }
                        />
                      }
                      label="Autoplay"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={localCustomizations?.videoSection?.loop ?? true}
                          onChange={(event) =>
                            updateCustomization(['videoSection', 'loop'], event.target.checked)
                          }
                        />
                      }
                      label="Loop"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={localCustomizations?.videoSection?.showControls ?? true}
                          onChange={(event) =>
                            updateCustomization(['videoSection', 'showControls'], event.target.checked)
                          }
                        />
                      }
                      label="Kontroller"
                    />
                  </Stack>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localCustomizations?.videoSection?.showLoadingLogo ?? true}
                        onChange={(event) =>
                          updateCustomization(['videoSection', 'showLoadingLogo'], event.target.checked)
                        }
                      />
                    }
                    label="Vis CreatorHub-logo ved lasting"
                  />
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>
                  Cinematic effekt
                </Typography>
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localCustomizations?.cinematic?.enabled ?? true}
                        onChange={(event) =>
                          updateCustomization(['cinematic', 'enabled'], event.target.checked)
                        }
                      />
                    }
                    label="Aktiver cinematic look"
                  />
                  <Typography variant="caption">Kontrast</Typography>
                  <Slider
                    value={localCustomizations?.cinematic?.contrast ?? 1.08}
                    min={0.9}
                    max={1.4}
                    step={0.02}
                    onChange={(_, value) =>
                      updateCustomization(['cinematic', 'contrast'], value)
                    }
                  />
                  <Typography variant="caption">Metning</Typography>
                  <Slider
                    value={localCustomizations?.cinematic?.saturate ?? 1.1}
                    min={0.8}
                    max={1.4}
                    step={0.02}
                    onChange={(_, value) =>
                      updateCustomization(['cinematic', 'saturate'], value)
                    }
                  />
                  <Typography variant="caption">Vignette topp</Typography>
                  <Slider
                    value={localCustomizations?.cinematic?.overlayTopOpacity ?? 0.55}
                    min={0}
                    max={0.9}
                    step={0.05}
                    onChange={(_, value) =>
                      updateCustomization(['cinematic', 'overlayTopOpacity'], value)
                    }
                  />
                  <Typography variant="caption">Vignette bunn</Typography>
                  <Slider
                    value={localCustomizations?.cinematic?.overlayBottomOpacity ?? 0.65}
                    min={0}
                    max={0.9}
                    step={0.05}
                    onChange={(_, value) =>
                      updateCustomization(['cinematic', 'overlayBottomOpacity'], value)
                    }
                  />
                  <Typography variant="caption">Glow varm</Typography>
                  <Slider
                    value={localCustomizations?.cinematic?.glowWarmOpacity ?? 0.25}
                    min={0}
                    max={0.6}
                    step={0.05}
                    onChange={(_, value) =>
                      updateCustomization(['cinematic', 'glowWarmOpacity'], value)
                    }
                  />
                  <Typography variant="caption">Glow kald</Typography>
                  <Slider
                    value={localCustomizations?.cinematic?.glowCoolOpacity ?? 0.15}
                    min={0}
                    max={0.6}
                    step={0.05}
                    onChange={(_, value) =>
                      updateCustomization(['cinematic', 'glowCoolOpacity'], value)
                    }
                  />
                </Stack>
              </Paper>
            </Stack>
          ) : (
            <Box sx={{ p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Component customization interface for {componentName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                This would contain the actual customization controls based on the component type
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCancel} startIcon={theming.getThemedIcon('close')}>
            Cancel
          </Button>
          <Button onClick={handleSave} 
            variant="contained" 
            startIcon={theming.getThemedIcon('save')}
           sx={theming.getThemedButtonSx()}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    );

    // Apply customizations to component props
    const enhancedProps = {
      ...restProps,
      ...localCustomizations,
      // Add visual editor specific props
      'data-visual-editor-component': componentId,
      'data-visual-editor-editable': options.editable,
      'data-visual-editor-customizations': JSON.stringify(localCustomizations)
  };

    return (
      <Box
        ref={componentRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          position: 'relative',
          '&:hover': {
            '& .visual-editor-overlay': {
              opacity: isEditing ? 0.1 : 0 }
        }
      }}
      >
        {/* Visual Editor Overlay */}
        {isEditing && (
          <Box
            className="visual-editor-overlay"
            sx={{
              position: 'absolute',
              top:  0,
              left:  0,
              right:  0,
              bottom:  0,
              bgcolor: 'primary.main',
              opacity:  0,
              transition: 'opacity 0.2s ease-in-out',
              zIndex: 1,
              pointerEvents: 'none',
              borderRadius: 1 }}
          />
        )}

        {/* Wrapped Component */}
        <Box sx={{ position: 'relative', zIndex: 2}}>
          <WrappedComponent {...(enhancedProps as P)} />
        </Box>

        {/* Floating Controls */}
        {renderFloatingControls()}

        {/* Edit Dialog */}
        {renderEditDialog()}
      </Box>
    );
};

  WithVisualEditorComponent.displayName = `withVisualEditor(${options.componentName})`;
  
  return WithVisualEditorComponent;
}

// Utility function to create Visual Editor enabled components
export function createVisualEditorComponent<P extends object>(
  Component: React.ComponentType<P>,
  options: WithVisualEditorOptions
) {
  return withVisualEditor(Component, options);
}

// Pre-configured Visual Editor components for common dashboard components
export const VisualEditorComponents = {
  // This would be populated with pre-configured components
  // Example: // ProjectCreationWithMemoryCards: createVisualEditorComponent(ProjectCreationWithMemoryCards, {
  //   componentId: 'project-creation-memory-cards',
  //   componentName: 'Project Creation with Memory Cards',
  //   category: 'modal',
  //   editable: true,
  //   previewable: true,
  //   templateable: true,
  //   propsEditable: true
  // })
};

export default withVisualEditor;

