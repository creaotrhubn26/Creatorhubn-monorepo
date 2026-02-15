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
  ClickAwayListener
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
    const [localCustomizations, setLocalCustomizations] = useState(customizations);
    const [isHovered, setIsHovered] = useState(false);
    const componentRef = useRef<HTMLDivElement>(null);

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

          {/* Component-specific customization interface would go here */}
          <Box sx={{ p: 2, border: '1px dashed #ccc', borderRadius:  1 }}>
            <Typography variant="body2" color="text.secondary">
              Component customization interface for {componentName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              This would contain the actual customization controls based on the component type
            </Typography>
          </Box>
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

