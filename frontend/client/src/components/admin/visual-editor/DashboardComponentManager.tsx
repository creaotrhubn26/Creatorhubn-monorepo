/**
 * Dashboard Component Manager
 * Visual Editor component for managing and customizing all UniversalDashboard components
 * Provides comprehensive editing capabilities for every connected component
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Stack,
  Badge,
  Tooltip,
  Paper
} from '@mui/material';

import {
  ExpandMore,
  Edit,
  Preview,
  Settings,
  Code,
  Palette,
  Layout,
  Behavior,
  Visibility,
  VisibilityOff,
  Save,
  Undo,
  Redo,
  Add,
  Delete,
  Search,
  FilterList,
  Sort,
  Launch,
  Build,
  Dashboard,
  PhotoCamera,
  VideoCall,
  LibraryMusic,
  Store,
  Group,
  Email,
  Folder,
  Settings as SettingsIcon,
  AutoFixHigh,
  Star,
  Article,
  Chat
} from '@mui/icons-material';

import { 
  UNIVERSAL_DASHBOARD_COMPONENTS,
  getComponentsByCategory,
  getComponentsByProfession,
  getEditableComponents,
  getComponentById,
  ComponentMetadata
} from './componentRegistry';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';

interface DashboardComponentManagerProps {
  selectedProject?: any;
  onProjectUpdate?: (project: any) => void;
  onNotificationCreate?: (notification: any) => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin';
}

interface ComponentCustomization {
  id: string;
  componentId: string;
  props: Record<string, any>;
  styles: Record<string, any>;
  layout: Record<string, any>;
  behavior: Record<string, any>;
  enabled: boolean;
  visible: boolean;
}

const DashboardComponentManager: React.FC<DashboardComponentManagerProps> = ({
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
  profession = 'admin'
}) => {
  // Enhanced Master Integration
  const { 
    analytics, 
    lifecycle, 
    debugging, 
    performance 
} = useEnhancedMasterIntegration();

  // State management
  const [activeTab, setActiveTab] = useState<'overview' | 'components' | 'customize' | 'preview' | 'export'>('overview');
  const [selectedComponent, setSelectedComponent] = useState<ComponentMetadata | null>(null);
  const [customizations, setCustomizations] = useState<ComponentCustomization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Theming system
  const theming = useTheming('prototype_tester,');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [professionFilter, setProfessionFilter] = useState<string>(profession);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Component registration
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'DashboardComponentManager,',
      type: 'component-manager',
      version: '1.0.0',
      capabilities: {
        data: ['component:read','component:write','customization:manage'],
        events: ['component:selected','customization:applied','preview:generated'],
        actions: ['edit','preview','export','reset'],
        ui: ['component:list','customization:form','preview:render'],
        system: ['integration:track','performance:monitor']
      },
      dependencies: ['@mui/material','@tanstack/react-query'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    analytics.trackEvent('dashboard_component_manager_initialized', {
      profession,
      totalComponents: UNIVERSAL_DASHBOARD_COMPONENTS.length,
      editableComponents: getEditableComponents().length
    });

    return () => {
      lifecycle.unregisterComponent('DashboardComponentManager');
    };
  }, [lifecycle, analytics, profession]);

  // Filter components based on search and filters
  const filteredComponents = useCallback(() => {
    let components = UNIVERSAL_DASHBOARD_COMPONENTS;

    // Filter by profession
    if (professionFilter !== 'all') {
      components = components.filter(comp => comp.profession.includes(professionFilter as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin'));
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      components = components.filter(comp => comp.category === categoryFilter);
    }

    // Filter by search term
    if (searchTerm) {
      components = components.filter(comp =>
        comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comp.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return components;
  }, [searchTerm, categoryFilter, professionFilter]);

  // Get component categories
  const categories = [
    { id: 'all', label: 'All Components', icon: <Dashboard /> },
    { id: 'orchestrator', label: 'Orchestrators', icon: theming.getThemedIcon(',') },
    { id: 'management', label: 'Management', icon: <SettingsIcon /> },
    { id: 'communication', label: 'Communication', icon: theming.getThemedIcon(',') },
    { id: 'showcase', label: 'Showcase', icon: theming.getThemedIcon(',') },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
    { id: 'integration', label: 'Integration', icon: theming.getThemedIcon(',') },
    { id: 'ai', label: 'AI Enhancement', icon: theming.getThemedIcon(',') },
    { id: 'file', label: 'File Management', icon: theming.getThemedIcon(',') },
    { id: 'equipment', label: 'Equipment', icon: theming.getThemedIcon(',') },
    { id: 'contract', label: 'Contracts', icon: theming.getThemedIcon(',') },
    { id: 'crm', label: 'CRM', icon: theming.getThemedIcon(',') },
    { id: 'tutorial', label: 'Tutorials', icon: theming.getThemedIcon(',') },
    { id: 'modal', label: 'Modals', icon: theming.getThemedIcon(',') }
  ];

  // Get profession icons
  const getProfessionIcon = (prof: string) => {
    switch (prof) {
      case 'photographer': return theming.getThemedIcon(',');
      case 'videographer': return theming.getThemedIcon('videocam');
      case 'music_producer': return theming.getThemedIcon('libraryMusic');
      case 'vendor': return theming.getThemedIcon('store');
      case 'admin': return <SettingsIcon />;
      default: return theming.getThemedIcon(', ');
    }
  };

  // Handle component selection
  const handleComponentSelect = useCallback((component: ComponentMetadata) => {
    setSelectedComponent(component);
    setActiveTab('customize');
    
    analytics.trackEvent('component_selected', {
      componentId: component.id,
      componentName: component.name,
      category: component.category,
      profession: profession
    });

    debugging.logIntegration('info','Component selected for customization', {
      componentId: component.id,
      componentName: component.name
    });
  }, [analytics, debugging, profession]);

  // Handle customization save
  const handleCustomizationSave = useCallback((customization: ComponentCustomization) => {
    setCustomizations(prev => {
      const existing = prev.find(c => c.id === customization.id);
      if (existing) {
        return prev.map(c => c.id === customization.id ? customization : c);
      } else {
        return [...prev, customization];
      }
    });

    analytics.trackEvent('customization_saved', {
      componentId: customization.componentId,
      customizationId: customization.id,
      profession: profession
    });

    onNotificationCreate?.({
      id: `customization_saved_${Date.now()}`,
      type: 'success',
      title: 'Customization Saved',
      message: `Customization for ${selectedComponent?.name} saved successfully`,
      priority: 'low',
      source: 'dashboard_component_manager',
      timestamp: new Date().toISOString()
    });
  }, [analytics, onNotificationCreate, profession, selectedComponent]);

  // Render component overview
  const renderOverview = () => (
    <Box>
      <Typography variant="h4" gutterBottom sx={{  mb:  4  }}>
        Dashboard Component Manager
      </Typography>
      
      <Alert severity="info" sx={{ mb:  3 }}>
        Manage and customize all components connected to UniversalDashboard.tsx. 
        This tool provides comprehensive editing capabilities for every dashboard component.
      </Alert>

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                {UNIVERSAL_DASHBOARD_COMPONENTS.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Components
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>
                {getEditableComponents().length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Editable Components
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="info.main" sx={{ color: theming.colors.primary }}>
                {getComponentsByProfession(profession).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {profession} Components
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs:  12, md:  3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>
                {customizations.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Customizations
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Category Overview */}
        <Grid size={{ xs: 12 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Component Categories
              </Typography>
              <Grid container spacing={2}>
                {categories.slice(1).map(category => {
                  const count = getComponentsByCategory(category.id as string).length;
                  return (
                    <Grid size={{ xs:  6, sm:  4, md:  3 }} key={category.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        {category.icon}
                        <Typography variant="body2">
                          {category.label} ({count})
                        </Typography>
                      </Box>
                    </Grid>
                  );
              })}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  // Render component list
  const renderComponents = () => (
    <Box>
      <Box sx={{ mb:  3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center'}}>
        <TextField
          placeholder="Search components..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 200}}
        />
        
        <FormControl size="small" sx={{ minWidth: 150}}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            label="Category"
          >
            {categories.map(category => (
              <MenuItem key={category.id} value={category.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  {category.icon}
                  {category.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 150}}>
          <InputLabel>Profession</InputLabel>
          <Select
            value={professionFilter}
            onChange={(e) => setProfessionFilter(e.target.value)}
            label="Profession"
          >
            <MenuItem value="all">All Professions</MenuItem>
            <MenuItem value="photographer">Photographer</MenuItem>
            <MenuItem value="videographer">Videographer</MenuItem>
            <MenuItem value="music_producer">Music Producer</MenuItem>
            <MenuItem value="vendor">Vendor</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={2}>
        {filteredComponents().map((component) => (
          <Grid size={{ xs:  12, sm:  6, md:  4 }} key={component.id}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out','&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4
                }
              }}
              onClick={() => handleComponentSelect(component)}
            >
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1, color: theming.colors.primary }}>
                    {component.name}
                  </Typography>
                  {component.visualEditor.editable && (
                    <Chip
                      label="Editable"
                      size="small"
                      color="success"
                    />
                  )}
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {component.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap'}}>
                  {component.profession.map(prof => (
                    <Chip
                      key={prof}
                      label={prof}
                      size="small"
                      icon={getProfessionIcon(prof)}
                      variant="outlined"
                    />
                  ))}
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Chip 
                    label={component.category} 
                    size="small" 
                    color="primary"
                    variant="outlined"
                  />
                  
                  <Box sx={{ display: 'flex', gap: 0.5}}>
                    <Tooltip title="Edit Component">
                      <IconButton size="small" onClick={() => handleComponentSelect(component)}>
                        {theming.getThemedIcon('edit')}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Preview Component">
                      <IconButton size="small">
                        <Preview />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render customization interface
  const renderCustomize = () => {
    if (!selectedComponent) {
      return (
        <Box sx={{ textAlign: 'center', py:  4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Select a component to customize
          </Typography>
        </Box>
      );
  }

    return (
      <Box>
        <Box sx={{ mb:  3, display: 'flex', alignItems: 'center', gap:  2 }}>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            Customize: {selectedComponent.name}
          </Typography>
          <Chip 
            label={selectedComponent.category} 
            color="primary" 
            variant="outlined"
          />
        </Box>

        <Grid container spacing={3}>
          <Grid size={{ xs:  12, md:  8 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Component Properties</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {selectedComponent.props.required.map(prop => (
                    <Grid size={{ xs:  12, sm:  6 }} key={prop}>
                      <TextField
                        fullWidth
                        label={`${prop} (Required)`}
                        variant="outlined"
                        size="small"
                        required
                      />
                    </Grid>
                  ))}
                  {selectedComponent.props.optional.map(prop => (
                    <Grid size={{ xs:  12, sm:  6 }} key={prop}>
                      <TextField
                        fullWidth
                        label={`${prop} (Optional)`}
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Style Customization</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {selectedComponent.customization.styles.map(style => (
                    <Grid size={{ xs:  12, sm:  6 }} key={style}>
                      <TextField
                        fullWidth
                        label={style}
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Layout Customization</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {selectedComponent.customization.layout.map(layout => (
                    <Grid size={{ xs:  12, sm:  6 }} key={layout}>
                      <TextField
                        fullWidth
                        label={layout}
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Behavior Customization</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {selectedComponent.customization.behavior.map(behavior => (
                    <Grid size={{ xs:  12, sm:  6 }} key={behavior}>
                      <TextField
                        fullWidth
                        label={behavior}
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          <Grid size={{ xs:  12, md:  4 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Component Info
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Category" 
                      secondary={selectedComponent.category}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Professions" 
                      secondary={selectedComponent.profession.join(', ')}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Tab Index" 
                      secondary={selectedComponent.tabIndex || 'N/A'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Dependencies" 
                      secondary={selectedComponent.dependencies.join(', ')}
                    />
                  </ListItem>
                </List>

                <Divider sx={{ my:  2 }} />

                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Visual Editor Capabilities
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {selectedComponent.visualEditor.editable ? theming.getThemedIcon('visibility') : theming.getThemedIcon('visibilityOff')}
                    </ListItemIcon>
                    <ListItemText primary="Editable" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      {selectedComponent.visualEditor.previewable ? theming.getThemedIcon('visibility') : theming.getThemedIcon('visibilityOff')}
                    </ListItemIcon>
                    <ListItemText primary="Previewable" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      {selectedComponent.visualEditor.templateable ? theming.getThemedIcon('visibility') : theming.getThemedIcon('visibilityOff')}
                    </ListItemIcon>
                    <ListItemText primary="Templateable" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      {selectedComponent.visualEditor.propsEditable ? theming.getThemedIcon('visibility') : theming.getThemedIcon('visibilityOff')}
                    </ListItemIcon>
                    <ListItemText primary="Props Editable" />
                  </ListItem>
                </List>

                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    fullWidth
                    sx={theming.getThemedButtonSx()}
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Preview />}
                    fullWidth
                    onClick={() => setShowPreview(true)}
                  >
                    Preview
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
};

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Dashboard Component Manager
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage and customize all components connected to UniversalDashboard.tsx
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" value="overview" icon={<Dashboard />} />
          <Tab label="Components" value="components" icon={<Build />} />
          <Tab label="Customize" value="customize" icon={<Edit />} />
          <Tab label="Preview" value="preview" icon={<Preview />} />
          <Tab label="Export" value="export" icon={<Launch />} />
        </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'components' && renderComponents()}
        {activeTab === 'customize' && renderCustomize()}
        {activeTab === 'preview' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
              Preview functionality coming soon
            </Typography>
          </Box>
        )}
        {activeTab === 'export' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
              Export functionality coming soon
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DashboardComponentManager;
