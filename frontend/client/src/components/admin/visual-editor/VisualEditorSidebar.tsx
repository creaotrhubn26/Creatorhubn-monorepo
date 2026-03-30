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
  InputAdornment,
  Chip,
} from '@mui/material';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { getVisualEditorTokens } from './visualEditorTokens';
import {
  Search as SearchIcon,
  AccountTree as NavigatorIcon,
  Add as AddIcon,
  Palette as PaletteIcon,
  Image as ImageIcon,
  TextFields as TextIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  GridOn as GridIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { EditorNavigatorPanel } from './EditorNavigatorPanel';

interface VisualEditorSidebarProps {
  selectedClient?: Record<string, unknown>;
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
  onOpenNoteEditor: () => void;
  onOpenSettings?: () => void;
}

const VisualEditorSidebar: React.FC<VisualEditorSidebarProps> = ({
  selectedClient,
  onComponentDrag,
  onComponentAdd,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onOpenAssetLibrary,
  onOpenScrollStories,
  onOpenGoogleServices,
  onOpenNoteEditor,
  onOpenSettings
}) => {
  // Enhanced Master Integration
  const { features } = useEnhancedMasterIntegration();
  const tokens = getVisualEditorTokens();

  // Comprehensive Feature System for Visual Editor Sidebar
  const visualEditorAccess = features.checkFeatureAccess('visual-editor');
  const sidebarAccess = features.checkFeatureAccess('visual-editor-sidebar');
  const componentLibraryAccess = features.checkFeatureAccess('component-library');
  const assetLibraryAccess = features.checkFeatureAccess('asset-library');
  const searchAccess = features.checkFeatureAccess('component-search');
  const dragDropAccess = features.checkFeatureAccess('drag-drop');
  const categoryFilterAccess = features.checkFeatureAccess('category-filter');
  const settingsAccess = features.checkFeatureAccess('settings');
  const featureAnalytics = features.getFeatureAnalytics();
  const activeWorkspaceLabel = typeof selectedClient?.name === 'string'
    ? selectedClient.name
    : 'Visual editing studio';
  const coreSidebarEnabled = visualEditorAccess.hasAccess || sidebarAccess.hasAccess;
  const componentActionsEnabled = coreSidebarEnabled && (
    componentLibraryAccess.hasAccess || visualEditorAccess.hasAccess
  );
  const assetsEnabled = sidebarAccess.hasAccess && assetLibraryAccess.hasAccess;

  const [tabValue, setTabValue] = useState(0);

  const componentCategories = [
    { id: 'All', label: tokens.sidebar.categoryAll, icon: <AddIcon />},
    { id: 'Basic', label: tokens.sidebar.categoryBasic, icon: <EditIcon />},
    { id: 'Layout', label: tokens.sidebar.categoryLayout, icon: <GridIcon />},
    { id: 'Media', label: tokens.sidebar.categoryMedia, icon: <ImageIcon />},
    { id: 'Text', label: tokens.sidebar.categoryText, icon: <TextIcon />},
    { id: 'Interactive', label: tokens.sidebar.categoryInteractive, icon: <SettingsIcon />}
  ];

  const components = [
    { id: 'text', name: tokens.sidebar.components.text.label, category: 'Text', icon: <TextIcon />, description: tokens.sidebar.components.text.description},
    { id: 'button', name: tokens.sidebar.components.button.label, category: 'Interactive', icon: <AddIcon />, description: tokens.sidebar.components.button.description},
    { id: 'image', name: tokens.sidebar.components.image.label, category: 'Media', icon: <ImageIcon />, description: tokens.sidebar.components.image.description},
    { id: 'card', name: tokens.sidebar.components.card.label, category: 'Layout', icon: <GridIcon />, description: tokens.sidebar.components.card.description},
    { id: 'container', name: tokens.sidebar.components.container.label, category: 'Layout', icon: <GridIcon />, description: tokens.sidebar.components.container.description},
    { id: 'grid', name: tokens.sidebar.components.grid.label, category: 'Layout', icon: <GridIcon />, description: tokens.sidebar.components.grid.description}
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
    <Box
      sx={{
        width: 312,
        minWidth: 312,
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'var(--ve-panel-bg-strong, rgba(255,255,255,0.94))',
          backdropFilter: 'blur(18px)',
          border: '1px solid var(--ve-panel-border, rgba(113, 87, 59, 0.14))',
          borderRadius: 4,
          boxShadow: 'var(--ve-panel-shadow, 0 24px 60px rgba(66, 42, 17, 0.12))',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2.25,
            borderBottom: '1px solid rgba(113, 87, 59, 0.1)',
            background: `
              linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72)),
              radial-gradient(circle at top right, rgba(255, 166, 95, 0.22), transparent 30%)
            `,
          }}
        >
          <Typography variant="overline" sx={{ color: 'var(--ve-accent, #ff6b35)', letterSpacing: '0.18em', fontWeight: 700 }}>
            Visual CMS Dashboard
          </Typography>
          <Typography variant="h5" gutterBottom sx={{ color: 'var(--ve-ink, #2b2016)', fontWeight: 700 }}>
            {tokens.sidebar.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--ve-muted, #6f6358)', mb: 1.5 }}>
            {activeWorkspaceLabel}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            <Chip
              label={visualEditorAccess.hasAccess ? 'Studio online' : 'Read only'}
              size="small"
              sx={{
                bgcolor: visualEditorAccess.hasAccess ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.14)',
                color: visualEditorAccess.hasAccess ? '#15803d' : '#a16207',
                fontWeight: 700,
              }}
            />
            <Chip
              label={`${featureAnalytics.enabledFeatures}/${featureAnalytics.totalFeatures} ${tokens.sidebar.featuresLabel.toLowerCase()}`}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.72)', color: 'var(--ve-muted, #6f6358)' }}
            />
            <Chip
              label={`${Math.round(featureAnalytics.featureAdoptionRate * 100)}% active`}
              size="small"
              variant="outlined"
              sx={{ bgcolor: 'rgba(255,255,255,0.45)' }}
            />
          </Box>

          <TextField
            fullWidth
            size="small"
            disabled={!searchAccess.hasAccess}
            placeholder={tokens.sidebar.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'var(--ve-muted, #6f6358)' }} />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: 'rgba(255,255,255,0.74)',
              },
            }}
          />
        </Box>

        {/* Tabs */}
        <Box sx={{ px: 1.25, py: 1 }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="fullWidth"
            sx={{
              minHeight: 44,
              p: 0.5,
              bgcolor: 'rgba(111, 83, 54, 0.06)',
              borderRadius: 999,
              '& .MuiTabs-indicator': {
                display: 'none',
              },
              '& .MuiTab-root': {
                minHeight: 40,
                textTransform: 'none',
                borderRadius: 999,
                color: 'var(--ve-muted, #6f6358)',
                fontWeight: 600,
              },
              '& .Mui-selected': {
                bgcolor: 'rgba(255,255,255,0.86)',
                color: 'var(--ve-ink, #2b2016)',
                boxShadow: '0 12px 24px rgba(66, 42, 17, 0.08)',
              },
            }}
          >
            <Tab label={tokens.sidebar.tabs.components} disabled={!componentActionsEnabled} />
            <Tab label="Navigator" icon={<NavigatorIcon fontSize="small" />} iconPosition="start" />
            <Tab label={tokens.sidebar.tabs.assets} disabled={!assetsEnabled} />
            <Tab label={tokens.sidebar.tabs.tools} />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 1.25, pb: 1.25 }}>
          {tabValue === 0 && (
            <>
              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: 'var(--ve-ink, #2b2016)', fontWeight: 700 }}>
                  {tokens.sidebar.categoriesLabel}
                </Typography>
                <List dense sx={{ display: 'grid', gap: 0.75 }}>
                  {componentCategories.map((category) => (
                    <ListItem key={category.id} disablePadding>
                      <ListItemButton
                        selected={selectedCategory === category.id}
                        disabled={!categoryFilterAccess.hasAccess}
                        onClick={() => onCategoryChange(category.id)}
                        sx={{
                          borderRadius: 3,
                          border: '1px solid rgba(113, 87, 59, 0.08)',
                          bgcolor: selectedCategory === category.id ? 'var(--ve-accent-soft, rgba(255, 107, 53, 0.12))' : 'rgba(255,255,255,0.72)',
                          '&.Mui-selected': {
                            color: 'var(--ve-accent, #ff6b35)',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                          {category.icon}
                        </ListItemIcon>
                        <ListItemText primary={category.label} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Divider sx={{ mx: 1, borderColor: 'rgba(113, 87, 59, 0.08)' }} />

              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: 'var(--ve-ink, #2b2016)', fontWeight: 700 }}>
                  {tokens.sidebar.componentsLabel} ({filteredComponents.length})
                </Typography>

                {!componentActionsEnabled && (
                  <Box
                    sx={{
                      p: 1.5,
                      mb: 1,
                      borderRadius: 3,
                      bgcolor: 'rgba(234, 179, 8, 0.1)',
                      color: '#92400e',
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      Component library is unavailable
                    </Typography>
                    <Typography variant="caption">
                      {componentLibraryAccess.reason || sidebarAccess.reason || visualEditorAccess.reason}
                    </Typography>
                  </Box>
                )}

                <List dense sx={{ display: 'grid', gap: 0.75 }}>
                  {filteredComponents.map((component) => (
                    <ListItem key={component.id} disablePadding>
                      <ListItemButton
                        draggable={dragDropAccess.hasAccess}
                        disabled={!componentActionsEnabled}
                        onDragStart={() => handleComponentDragStart(component.id)}
                        onClick={() => handleComponentClick(component.id)}
                        sx={{
                          alignItems: 'flex-start',
                          borderRadius: 3,
                          border: '1px solid rgba(113, 87, 59, 0.08)',
                          bgcolor: 'rgba(255,255,255,0.78)',
                          py: 1.25,
                          boxShadow: '0 12px 24px rgba(66, 42, 17, 0.04)',
                          '&:hover': {
                            borderColor: 'var(--ve-accent, #ff6b35)',
                            backgroundColor: 'rgba(255, 107, 53, 0.06)',
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40, color: 'var(--ve-accent, #ff6b35)' }}>
                          {component.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={component.name}
                          secondary={component.description}
                          secondaryTypographyProps={{
                            sx: {
                              color: 'var(--ve-muted, #6f6358)',
                              mt: 0.25,
                            },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          )}

          {tabValue === 1 && <EditorNavigatorPanel />}

          {tabValue === 2 && (
            <Box sx={{ p: 1, display: 'grid', gap: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'var(--ve-ink, #2b2016)', fontWeight: 700 }}>
                {tokens.sidebar.assetsPanel.title}
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ImageIcon />}
                disabled={!assetsEnabled}
                onClick={onOpenAssetLibrary}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 3,
                  py: 1.25,
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                {tokens.sidebar.assetsPanel.openLibrary}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PaletteIcon />}
                disabled={!assetsEnabled}
                onClick={onOpenScrollStories}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 3,
                  py: 1.25,
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                {tokens.sidebar.assetsPanel.scrollStories}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ScienceIcon />}
                disabled={!assetsEnabled}
                onClick={onOpenGoogleServices}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 3,
                  py: 1.25,
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                {tokens.sidebar.assetsPanel.googleServices}
              </Button>
            </Box>
          )}

          {tabValue === 3 && (
            <Box sx={{ p: 1, display: 'grid', gap: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'var(--ve-ink, #2b2016)', fontWeight: 700 }}>
                {tokens.sidebar.toolsPanel.title}
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={onOpenNoteEditor}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 3,
                  py: 1.25,
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                {tokens.sidebar.toolsPanel.noteEditor}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                disabled={!settingsAccess.hasAccess}
                onClick={() => onOpenSettings?.()}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: 3,
                  py: 1.25,
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                {tokens.sidebar.toolsPanel.settings}
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default VisualEditorSidebar;
