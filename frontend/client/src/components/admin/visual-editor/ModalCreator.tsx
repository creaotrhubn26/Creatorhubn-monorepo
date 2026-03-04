/**
 * ModalCreator Component
 * Advanced modal creation system for CreatorHub Visual Editor
 * Provides comprehensive modal template library and customization tools
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ModalTemplate } from './modalTemplates';
import { MODAL_TEMPLATES } from './modalTemplates';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Avatar,
  Badge,
  IconButton,
  Tabs,
  Tab,
  Alert,
  AlertTitle,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Code as CodeIcon,
  Palette as DesignIcon,
  Message as MessageIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  SaveAlt as SaveAltIcon,
  GetApp as DownloadIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Palette as PaletteIcon,
  Animation as AnimationIcon,
  Security as SecurityIcon,
  ContentCopy as ContentCopyIcon,
  BookmarkBorder as BookmarkIcon,
  Share as ShareIcon,
  Launch as LaunchIcon,
  Menu as MenuIcon,
  ViewModule as GridIcon,
} from '@mui/icons-material';


interface CustomModal {
  id: string;
  name: string;
  description?: string;
  type: 'dialog' | 'confirm' | 'form' | 'display';
  title: string;
  content: React.ReactNode | string;
  actions: Array<{
    id: string;
    label: string;
    variant: 'primary' | 'secondary' | 'tertiary' | 'danger';
    onClick: string;
    position: 'start' | 'end' | 'center';
}>;
  styles: {
    width: number | string;
    height: number | string;
    maxWidth: string;
    maxHeight: string;
    borderRadius: number;
    elevation: number;
    backdropBlur: boolean;
    animationEnter: string;
    animationExit: string;
};
  behavior: {
    closeOnBackdrop: boolean;
    closeOnEscape: boolean;
    persistent: boolean;
    scrollable: boolean;
    fullscreen: boolean;
    centerOnScreen: boolean;
};
  integrations: {
    notifications: boolean;
    analytics: boolean;
    accessibility: boolean;
    theme: boolean;
};
}

interface ModalCreatorProps {
  selectedProject?: {
    id: string;
    name?: string;
    modals?: CustomModal[];
    modalCount?: number;
  };
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void;
}


const ModalCreator: React.FC<ModalCreatorProps> = ({
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
}) => {
  // Enhanced Master Integration
  const { 
    analytics, 
    lifecycle, 
    debugging, 
    performance 
} = useEnhancedMasterIntegration();

  // Component registration and monitoring
  const componentId = useRef(`ModalCreator_${Date.now()}`);
  const performanceTracker = useRef(performance.startTiming('ModalCreator_operations'));
  
  // Component lifecycle and analytics setup
  useEffect(() => {
    // Register component with lifecycle management
    lifecycle.registerComponent({
      id: componentId.current,
      type: 'modal-creator',
      version: '1.0.0',
      capabilities: {
        data: ['modal:read','modal:write','template:read'],
        events: ['modal:created','template:selected','modal:exported'],
        actions: ['modal:create','template:apply','modal:preview','modal:export'],
        ui: ['modal:render','template:display','form:interact'],
        system: ['integration:track','performance:monitor']
      },
      dependencies: ['@mui/material','@mui/icons-material'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    // Track component initialization with detailed metrics
    analytics.trackEvent('component_initialized', {
      componentId: componentId.current,
      type: 'modal-creator',
      capabilities: ['modal-creation','template-management','export-functionality'],
      availableTemplates: MODAL_TEMPLATES.length,
      templateCategories: Array.from(new Set(MODAL_TEMPLATES.map(t => t.category)))
    });

    debugging.logIntegration('info', 'ModalCreator component initialized', {
      componentId: componentId.current,
      availableTemplates: MODAL_TEMPLATES.length
    });

    // Track template analytics at component initialization
    MODAL_TEMPLATES.forEach(template => {
      analytics.trackEvent('template_available', {
        templateId: template.id,
        templateCategory: template.category,
        templateTags: template.tags,
        componentId: componentId.current
      });
    });

    return () => {
      lifecycle.unregisterComponent(componentId.current);
      analytics.trackEvent('component_unregistered', {
        componentId: componentId.current,
        componentType: 'modal-creator'
      });
      debugging.logIntegration('info','ModalCreator component unregistered');
    };
  }, [lifecycle, analytics, debugging]);

  // Modal creation state
  const [activeTab, setActiveTab] = useState<'templates' | 'customize' | 'preview' | 'export'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ModalTemplate | null>(null);
  const [currentModal, setCurrentModal] = useState<CustomModal | null>(null);
  const [createdModals, setCreatedModals] = useState<CustomModal[]>([]);
  
  // Form states
  const [modalName, setModalName] = useState('');
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalType, setModalType] = useState<'dialog' | 'confirm' | 'form' | 'display'>('dialog');
  
  // Styles configuration
  const [modalWidth, setModalWidth] = useState<number | string>(500);
  const [modalHeight, setModalHeight] = useState<number | string>(400);
  const [animationType, setAnimationType] = useState('fade');
  const [backdropBlur, setBackdropBlur] = useState(true);
  
  // Customization visibility
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modalTheme, setModalTheme] = useState<'light' | 'dark' | 'custom'>('light');
  const [modalBorderRadius, setModalBorderRadius] = useState(4);

  // Track tab navigation for analytics
  const handleTabChange = useCallback((newTab: 'templates' | 'customize' | 'preview' | 'export') => {
    analytics.trackEvent('tab_navigation', {
      fromTab: activeTab,
      toTab: newTab,
      componentId: componentId.current,
      timestamp: Date.now()
    });

    debugging.logIntegration('info','ModalCreator tab changed', {
      fromTab: activeTab,
      toTab: newTab
    });

    setActiveTab(newTab);
  }, [activeTab, analytics, debugging]);
  
  // Modal template selection
  const handleTemplateSelect = useCallback((template: ModalTemplate) => {
    // Performance tracking
    const endTracking = performance.startTiming('template_selection');
    
    // Analytics tracking
    analytics.trackEvent('template_selected', {
      templateId: template.id,
      templateCategory: template.category,
      templateType: template.structure.type,
      componentId: componentId.current
    });

    debugging.logIntegration('info','Template selected', {
      templateId: template.id,
      templateName: template.name,
      category: template.category
    });

    setSelectedTemplate(template);

    // Initialize form with template defaults
    setModalName(template.name);
    setModalTitle(template.preview.title);
    setModalContent(template.preview.content);
    setModalType(template.category as 'dialog' | 'confirm' | 'form' | 'display');
    setModalWidth(template.structure.styles.width);
    setModalHeight(template.structure.styles.height);

    setActiveTab('customize');

    onNotificationCreate?.({
      id: `template_selected_${Date.now()}`,
      type: 'info',
      title: 'Template Selected',
      message: `${template.name} template loaded`,
      priority: 'low',
      source: 'modal_creator',
      timestamp: new Date().toISOString()
    });

    // Complete performance tracking
    endTracking();
  }, [onNotificationCreate, analytics, debugging, performance]);

  // Create new modal
  const handleCreateModal = useCallback(() => {
    // Performance tracking for modal creation
    const endCreationTracking = performance.startTiming('modal_creation');
    
    if (!modalName.trim() || !modalTitle.trim()) {
      analytics.trackEvent('modal_creation_failed', {
        reason: 'missing_required_fields',
        modalName,
        modalTitle,
        componentId: componentId.current
      });

      debugging.logIntegration('warn','Modal creation failed - missing required fields', {
        modalName,
        modalTitle
      });

      onNotificationCreate?.({
        id: `modal_creation_failed_${Date.now()}`,
        type: 'error',
        title: 'Modal Creation Failed',
        message: 'Name and title are required fields',
        priority: 'high',
        source: 'modal_creator',
        timestamp: new Date().toISOString()
      });
      endCreationTracking();
      return;
    }

    const newModal: CustomModal = {
      id: `modal_${Date.now()}`,
      name: modalName,
      type: modalType,
      title: modalTitle,
      content: modalContent,
      actions: selectedTemplate?.structure.actions.map((action, index) => ({
        id: `action_${index}`,
        label: action.charAt(0).toUpperCase() + action.slice(1),
        variant: index === 0 ? 'secondary' : 'primary',
        onClick: `${action.toLowerCase()}_handler`,
        position: index === 0 ? 'start' : 'end'
      })) || [],
      styles: {
        width: modalWidth,
        height: modalHeight,
        maxWidth: '90vw',
        maxHeight: '90vh',
        borderRadius: selectedTemplate?.structure.styles.borderRadius || 8,
        elevation: 3,
        backdropBlur,
        animationEnter: `animate__animated animate__${animationType}_in`,
        animationExit: `animate__animated animate__${animationType}_out`
      },
      behavior: {
        closeOnBackdrop: true,
        closeOnEscape: true,
        persistent: false,
        scrollable: true,
        fullscreen: false,
        centerOnScreen: true
      },
      integrations: {
        notifications: true,
        analytics: true,
        accessibility: true,
        theme: true
      }
    };

    // Analytics and debugging for successful creation
    analytics.trackEvent('modal_created', {
      modalId: newModal.id,
      modalName: modalName,
      modalType,
      modalDimensions: { width: modalWidth, height: modalHeight },
      templateUsed: selectedTemplate?.id,
      componentId: componentId.current,
      performanceStart: Date.now()
    });

    debugging.logIntegration('info','Modal created successfully', {
      modalId: newModal.id,
      modalName,
      modalType,
      template: selectedTemplate?.name
    });

    setCreatedModals(prev => [...prev, newModal]);
    setCurrentModal(newModal);
    setActiveTab('preview');

    onNotificationCreate?.({
      id: `modal_created_${Date.now()}`,
      type: 'success',
      title: 'Modal Created Successfully',
      message: `Modal "${modalName}" has been created and is ready for use`,
      priority: 'low',
      source: 'modal_creator',
      timestamp: new Date().toISOString()
    });

    // Trigger project update with new modal
    onProjectUpdate?.({
      ...selectedProject,
      modals: [...(selectedProject?.modals || []), newModal],
      lastModalCreated: new Date().toISOString(),
      modalCount: (selectedProject?.modalCount || 0) + 1
    });

    // Complete performance tracking
    endCreationTracking();
  }, [
    modalName, modalTitle, modalContent, modalType, modalWidth, modalHeight,
    selectedTemplate, backdropBlur, animationType, onNotificationCreate,
    onProjectUpdate, selectedProject, analytics, debugging, performance
  ]);

  // Export functionality
  const handleExportModal = useCallback((modal: CustomModal) => {
    // Performance tracking
    const endExportTracking = performance.startTiming('modal_export');

    const exportData = {
      ...modal,
      exportTimestamp: new Date().toISOString(),
      version: '1.0.0',
      framework: 'react',
      componentName: modal.name.replace(/\s+/g, ', ')
    };

    // Analytics tracking
    analytics.trackEvent('modal_exported', {
      modalId: modal.id,
      modalName: modal.name,
      modalType: modal.type,
      exportFormat: 'json',
      componentId: componentId.current
    });

    debugging.logIntegration('info','Modal exported successfully', {
      modalId: modal.id,
      modalName: modal.name,
      exportFormat: 'json'
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modal.name.toLowerCase().replace(/\s+/g, '_')}_modal.json`;
    a.click();
    URL.revokeObjectURL(url);

    onNotificationCreate?.({
      id: `modal_exported_${Date.now()}`,
      type: 'success',
      title: 'Modal Exported',
      message: `${modal.name} has been exported successfully`,
      priority: 'medium',
      source: 'modal_creator',
      timestamp: new Date().toISOString()
    });

    // Complete performance tracking
    endExportTracking();
  }, [onNotificationCreate, analytics, debugging, performance]);

  return (
    <Paper sx={{ p: 3, height: '100%', overflow: 'auto', ...theming.getThemedCardSx() }}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        <DesignIcon />
        Modal Creator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create custom modals with advanced styling, behaviors, and integrations using our template-based system.
      </Typography>

      {/* Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => handleTabChange(newValue)}>
          <Tab 
            value="templates" 
            label="Templates" 
            icon={<GridIcon />} 
            iconPosition="start" 
          />
          <Tab 
            value="customize" 
            label="Customize" 
            icon={<DesignIcon />} 
            iconPosition="start"
            disabled={!selectedTemplate}
          />
          <Tab 
            value="preview" 
            label="Preview" 
            icon={<VisibilityIcon />} 
            iconPosition="start"
            disabled={!currentModal}
          />
          <Tab 
            value="export" 
            label="Export / Share" 
            icon={<DownloadIcon />} 
            iconPosition="start"
            disabled={createdModals.length === 0}
          />
        </Tabs>
      </Box>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 3, color: theming.colors.primary }}>
            Select a Modal Template
          </Typography>
          <Grid container spacing={3}>
            {MODAL_TEMPLATES.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out', '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    },
                    ...theming.getThemedCardSx()
                  }}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Avatar
                        sx={{
                          bgcolor: template.category === 'dialog' ? 'primary.main' :
                            template.category === 'form' ? 'secondary.main' :
                            template.category === 'confirm' ? 'warning.main' :
                            template.category === 'display' ? 'success.main' :
                            template.category === 'complex' ? 'purple.main' : 'info.main'
                        }}
                      >
                        {template.category === 'dialog' && <MessageIcon />}
                        {template.category === 'form' && <EditIcon />}
                        {template.category === 'confirm' && <WarningIcon />}
                        {template.category === 'display' && <VisibilityIcon />}
                        {template.category === 'complex' && <LaunchIcon />}
                        {template.category === 'custom' && <SettingsIcon />}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{template.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {template.description}
                        </Typography>
                      </Box>
                    </Box>

                    <Stack direction="row" spacing={1} mb={2}>
                      {template.tags.map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>

                    <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Preview:
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        <strong>Title:</strong> {template.preview.title}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        <strong>Content:</strong> {template.preview.content}
                      </Typography>
                      <Typography variant="caption">
                        <strong>Buttons:</strong> {template.preview.buttons.join(', ')}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions sx={theming.getThemedCardSx()}>
                    <Button size="small" startIcon={<AddIcon />}>
                      Use Template
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Customize Tab */}
      {activeTab === 'customize' && selectedTemplate && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{  mb:  3  }}>
            Customize Your Modal
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              {/* Project Creation Integration */}
              {selectedTemplate?.id === 'project-creation-modal' && (
                <Card sx={{ mb:  3, border: '1px solid #1976d0', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' ,  ...theming.getThemedCardSx() }}>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
                    <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                      🚀 ProjectCreationWithMemoryCards Integration
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This modal integrates with the ProjectCreationWithMemoryCards component for advanced project creation
                    </Typography>
                  </Box>
                  <Box sx={{ p:  3 }}>
                    <Alert severity="info" sx={{ mb:  2 }}>
                      This template automatically embeds the ProjectCreationWithMemoryCards component within a Dialog wrapper.
                      The component provides full step-by-step wizard creation with memory card configuration.
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Profession Context"
                          defaultValue="photographer"
                          helperText="Will be passed to ProjectCreationWithMemoryCards"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="User ID"
                          defaultValue=""
                          helperText="User context for project creation"
                        />
                      </Grid>
                    </Grid>

                    <Box sx={{ mt:  2 }}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                        Available Callbacks:
                      </Typography>
                      <ul style={{ margin: 0, paddingLeft: '20px'}}>
                        <li>onProjectCreated - Handles successful project creation</li>
                        <li>onMeetingCreate - Creates related meetings</li>
                        <li>onProjectUpdate - Updates project data</li>
                        <li>onWorklogCreate - Creates work logs</li>
                        <li>onProjectSelect - Selects specific project</li>
                      </ul>
                    </Box>
                  </Box>
                </Card>
              )}

              {/* Basic Configuration */}
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Basic Configuration</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure the fundamental properties of your modal
                  </Typography>
                </Box>
                <Box sx={{ p:  3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Modal Name"
                        value={modalName}
                        onChange={(e) => setModalName(e.target.value)}
                        placeholder="Enter modal name"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Modal Type</InputLabel>
                        <Select
                          value={modalType}
                          onChange={(e) => setModalType(e.target.value as 'dialog' | 'confirm' | 'form' | 'display')}
                          label="Modal Type"
                        >
                          <MenuItem value="dialog">Dialog</MenuItem>
                          <MenuItem value="confirm">Confirmation</MenuItem>
                          <MenuItem value="form">Form</MenuItem>
                          <MenuItem value="display">Display</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Modal Title"
                        value={modalTitle}
                        onChange={(e) => setModalTitle(e.target.value)}
                        placeholder="Enter modal title"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Modal Content"
                        value={modalContent}
                        onChange={(e) => setModalContent(e.target.value)}
                        placeholder="Enter modal content"
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Card>

              {/* Style Configuration */}
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>Style Configuration</Typography>
                    <IconButton onClick={() => setShowAdvanced(!showAdvanced)}>
                      <ExpandMoreIcon sx={{ 
                        transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }} />
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Customize the appearance and layout of your modal
                  </Typography>
                </Box>
                <Box sx={{ p:  3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Width (px)"
                        type="number"
                        value={modalWidth}
                        onChange={(e) => {
                          const newWidth = Number(e.target.value);
                          analytics.trackEvent('modal_style_changed', {
                            property: 'width',
                            value: newWidth,
                            componentId: componentId.current
                        ,});
                          setModalWidth(newWidth);
                      }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Height (px)"
                        type="number"
                        value={modalHeight}
                        onChange={(e) => {
                          const newHeight = Number(e.target.value);
                          analytics.trackEvent('modal_style_changed', {
                            property: 'height',
                            value: newHeight,
                            componentId: componentId.current
                        ,});
                          setModalHeight(newHeight);
                      }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Animation Type</InputLabel>
                        <Select
                          value={animationType}
                          onChange={(e) => {
                            const newAnimationType = e.target.value;
                            analytics.trackEvent('modal_style_changed', {
                              property: 'animationType',
                              value: newAnimationType,
                              componentId: componentId.current
                          ,});
                            setAnimationType(newAnimationType);
                        }}
                          label="Animation Type"
                        >
                          <MenuItem value="fade">Fade</MenuItem>
                          <MenuItem value="slide">Slide</MenuItem>
                          <MenuItem value="zoom">Zoom</MenuItem>
                          <MenuItem value="bounce">Bounce</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={backdropBlur}
                            onChange={(e) => setBackdropBlur(e.target.checked)}
                          />
                      }
                        label="Backdrop Blur"
                      />
                    </Grid>
                  </Grid>

                  {showAdvanced && (
                    <Box sx={{ mt:  3, pt:  3, borderTop: 1, borderColor: 'divider'}}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Advanced Settings</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth>
                            <InputLabel>Theme</InputLabel>
                            <Select
                              value={modalTheme}
                              onChange={(e) => setModalTheme(e.target.value as 'light' | 'dark' | 'custom')}
                              label="Theme"
                            >
                              <MenuItem value="light">Light</MenuItem>
                              <MenuItem value="dark">Dark</MenuItem>
                              <MenuItem value="custom">Custom</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Typography gutterBottom>Border Radius</Typography>
                          <Slider
                            value={modalBorderRadius}
                            onChange={(_, val) => setModalBorderRadius(val as number)}
                            step={1}
                            min={0}
                            max={20}
                            marks
                            valueLabelDisplay="auto"
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <FormControlLabel
                            control={<Checkbox defaultChecked />}
                            label="Shadows"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}
                </Box>
              </Card>

              {/* Create Button */}
              <Button variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                onClick={handleCreateModal}
                sx={{ mt:  2 }}
              >
                Create Modal
              </Button>
            </Grid>

            {/* Live Preview */}
            <Grid item xs={12} md={4}>
              <Card sx={{ height: 'fit-content',  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Live Preview
                  </Typography>
                  <Box sx={{ 
                    border: '2px dashed #ccc', 
                    p: 2, borderRadius:  1,
                    minHeight: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    bgcolor: 'grey.50'
                }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {modalTitle || 'Modal Title'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center">
                      {modalContent || 'Modal content will appear here'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && currentModal && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{  mb:  3  }}>
            Preview: {currentModal.name}
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                <Typography variant="body1" gutterBottom>
                  Modal Preview
                </Typography>
                <Alert severity="info" sx={{ mb:  2 }}>
                  The modal preview will be simulated in a full environment
                </Alert>
                <Button
                  variant="outlined"
                  startIcon={<PreviewIcon />}
                  onClick={() => {
                    // This would open the modal for preview
                    setActiveTab('preview');
                }}
                >
                  Open Preview
                </Button>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Modal Properties</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Type" secondary={currentModal.type} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Width" secondary={`${currentModal.styles.width}px`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Height" secondary={`${currentModal.styles.height}px`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Title" secondary={currentModal.title} />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{  mb:  3  }}>
            Export & Share Modal
          </Typography>
          
          {createdModals.length === 0 ? (
            <Alert severity="info">
              <AlertTitle>No Modals Created</AlertTitle>
              Create and customize modals to see them listed here for export.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {createdModals.map((modal) => (
                <Grid item xs={12} sm={6} key={modal.id}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{modal.name}</Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {modal.description}
                        </Typography>
                        <Box sx={{ mt: 2, display: 'flex', gap:  1 }}>
                          <Chip 
                            label={modal.type} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                          <Chip 
                            label={`${modal.styles.width}x${modal.styles.height}`} 
                            size="small" 
                            variant="outlined" 
                          />
                        </Box>
                    </CardContent>
                    <CardActions sx={theming.getThemedCardSx()}>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleExportModal(modal)}
                      >
                        Export
                      </Button>
                      <Button 
                        size="small" 
                        startIcon={<PreviewIcon />}
                      >
                        Preview
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default ModalCreator;
