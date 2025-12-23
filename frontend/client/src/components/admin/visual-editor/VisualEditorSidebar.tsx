/**
 * Visual Editor Sidebar Component
 * Left sidebar with component palette and tools
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  InputAdornment,
  Chip
} from '@mui/material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '@/utils/theming-helper';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Palette as PaletteIcon,
  Image as ImageIcon,
  TextFields as TextIcon,
  CropFree as SelectIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Remove as RemoveIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  Psychology as ExtendedThinkingIcon,
  FlashOn as HighPowerIcon,
  MonetizationOn as CostIcon,
  ColorLens as ColorIcon,
  GridOn as GridIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Science as ScienceIcon
} from '@mui/icons-material';

interface VisualEditorSidebarProps {
  selectedClient?: any;
  onClientSelect: (clientId: string) => void;
  onComponentDrag: (componentType: string) => void;
  onComponentAdd: (componentType: string, position: { x: number; y: number }) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onOpenAssetLibrary: () => void;
  onOpenScrollStories: () => void;
  onOpenGoogleServices: () => void;
  onOpenNoteEditor: () => void
}

const VisualEditorSidebar: React.FC<VisualEditorSidebarProps> = ({
  selectedClient,
  onClientSelect,
  onComponentDrag,
  onComponentAdd,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onOpenAssetLibrary,
  onOpenScrollStories,
  onOpenGoogleServices,
  onOpenNoteEditor
}) => {
  // Enhanced Master Integration
  const { features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Comprehensive Feature System for Visual Editor Sidebar
  const visualEditorAccess = features.checkFeatureAccess('visual-editor');
  const sidebarAccess = features.checkFeatureAccess('visual-editor-sidebar');
  const componentLibraryAccess = features.checkFeatureAccess('component-library');
  const assetLibraryAccess = features.checkFeatureAccess('asset-library');
  const searchAccess = features.checkFeatureAccess('component-search');
  const dragDropAccess = features.checkFeatureAccess('drag-drop');
  const categoryFilterAccess = features.checkFeatureAccess('category-filter');
  const settingsAccess = features.checkFeatureAccess('settings');

  const [tabValue, setTabValue] = useState(0);

  const componentCategories = [
    { id: 'All', label: 'All Components', icon: <AddIcon />,},
    { id: 'Basic', label: 'Basic', icon: <EditIcon />,},
    { id: 'Layout', label: 'Layout', icon: <GridIcon />,},
    { id: 'Media', label: 'Media', icon: <ImageIcon />,},
    { id: 'Text', label: 'Text', icon: <TextIcon />,},
    { id: 'Interactive', label: 'Interactive', icon: <SettingsIcon />,}
  ];

  const components = [
    { id: 'text', name: 'Text', category: 'Text', icon: <TextIcon />, description: 'Add text content',},
    { id: 'button', name: 'Button', category: 'Interactive', icon: <AddIcon />, description: 'Interactive button',},
    { id: 'image', name: 'Image', category: 'Media', icon: <ImageIcon />, description: 'Image placeholder',},
    { id: 'card', name: 'Card', category: 'Layout', icon: <GridIcon />, description: 'Content card',},
    { id: 'container', name: 'Container', category: 'Layout', icon: <GridIcon />, description: 'Layout container',},
    { id: 'grid', name: 'Grid', category: 'Layout', icon: <GridIcon />, description: 'Grid layout',}
  ];

  const filteredComponents = components.filter(component => {
    const matchesCategory = selectedCategory === 'All' || component.category === selectedCategory;
    const matchesSearch = component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         component.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
});

  const handleComponentDragStart = (componentType: string) => {
    onComponentDrag(componentType);
};

  const handleComponentClick = (componentType: string) => {
    // Add component to center of canvas
    onComponentAdd(componentType, { x: 40, y: 300,});
};

  return (
    <Box sx={{ width: 20, height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Components
          </Typography>
          
          {/* Feature Analytics Display */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
            </Typography>
            <Chip 
              label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18}}
            />
          </Box>
        </Box>
        <TextField
          fullWidth
          size="small"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
      }}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab label="Components" />
          <Tab label="Assets" />
          <Tab label="Tools" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto'}}>
        {tabValue === 0 && (
          <>
            {/* Categories */}
            <Box sx={{ p:  1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Categories
              </Typography>
              <List dense>
                {componentCategories.map((category) => (
                  <ListItem key={category.id} disablePadding>
                    <ListItemButton
                      selected={selectedCategory === category.id}
                      onClick={() => onCategoryChange(category.id)}
                    >
                      <ListItemIcon sx={{ minWidth: 36}}>
                        {category.icon}
                      </ListItemIcon>
                      <ListItemText primary={category.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>

            <Divider />

            {/* Components */}
            <Box sx={{ p:  1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Components ({filteredComponents.length})
              </Typography>
              <List dense>
                {filteredComponents.map((component) => (
                  <ListItem key={component.id} disablePadding>
                    <ListItemButton
                      draggable
                      onDragStart={() => handleComponentDragStart(component.id)}
                      onClick={() => handleComponentClick(component.id)}
                      sx={{
                        border: '1px solid transparent',
                        borderRadius: 1,
                        mb: 0.5, '&:hover': {
                          border: '1px solid #1976d0',
                          backgroundColor: 'action.hover'
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {component.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={component.name}
                        secondary={component.description}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </>
        )}

        {tabValue === 1 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Asset Library
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ImageIcon />}
              onClick={onOpenAssetLibrary}
              sx={{ mb: 2 }}
            >
              Open Asset Library
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PaletteIcon />}
              onClick={onOpenScrollStories}
              sx={{ mb: 2 }}
            >
              Scroll Stories
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ScienceIcon />}
              onClick={onOpenGoogleServices}
              sx={{ mb: 2 }}
            >
              Google Services
            </Button>
          </Box>
        )}

        {tabValue === 2 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Tools
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onOpenNoteEditor}
              sx={{ mb:  2 }}
            >
              Note Editor
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => {}}
              sx={{ mb:  2 }}
            >
              Settings
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default VisualEditorSidebar;