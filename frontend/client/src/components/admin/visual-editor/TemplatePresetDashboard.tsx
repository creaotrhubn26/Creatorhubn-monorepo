// Template and Preset Dashboard
// Provides interface for managing templates and presets based on existing platform components

import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
  Avatar
} from '@mui/material';
import {
  Dashboard,
  PhotoLibrary,
  Work,
  Palette,
  Settings,
  Download,
  Upload,
  Add,
  Edit,
  Delete,
  Star,
  StarBorder,
  Visibility,
  PlayArrow,
  Refresh,
  ArticleOutlined,
  Tune
} from '@mui/icons-material';
import { useTemplateManager } from '../../../hooks/useTemplateManager';

interface TemplatePresetDashboardProps {
  onSettingsClick: () => void;
  onTemplatesClick: () => void;
  onPresetsClick: () => void;
  onCategoriesClick: () => void;
  onImportClick: () => void;
  onExportClick: () => void; 
}

const TemplatePresetDashboard: React.FC<TemplatePresetDashboardProps> = ({
  onSettingsClick,
  onTemplatesClick,
  onPresetsClick,
  onCategoriesClick,
  onImportClick,
  onExportClick
}) => {
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [selectedCategory, setSelectedCategory] = useState('all,');
  const [selectedProfession, setSelectedProfession] = useState('all,');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' | 'info' });

  const {
    templates,
    presets,
    isLoading,
    error,
    getTemplates,
    getPresets,
    applyTemplate,
    applyPreset,
    refreshData
} = useTemplateManager();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  const handleApplyTemplate = (templateId: string) => {
    try {
      const success = applyTemplate(templateId, 'current-project');
      if (success) {
        setSnackbar({ open: true, message: 'Template applied successfully', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Failed to apply template', severity: 'error',});
    }
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to apply template', severity: 'error',});
  }
};

  const handleApplyPreset = (presetId: string) => {
    try {
      const success = applyPreset(presetId, 'current-view');
      if (success) {
        setSnackbar({ open: true, message: 'Preset applied successfully', severity: 'success',});
    } else {
        setSnackbar({ open: true, message: 'Failed to apply preset', severity: 'error',});
    }
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to apply preset', severity: 'error',});
  }
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'dashboard': return <Dashboard />;
      case 'showcase': return theming.getThemedIcon(', ');
      case 'project': return <Work />;
      case 'ui': return theming.getThemedIcon('palette');
      case 'workflow': return theming.getThemedIcon('settings');
      default: return <Template />;
}
};

  const getProfessionColor = (profession: string) => {
    switch (profession) {
      case 'photographer': return 'primary';
      case 'videographer': return 'secondary';
      case 'music_producer': return 'success';
      case 'vendor': return 'warning';
      case 'admin': return 'error';
      case 'universal': return 'info';
      default: return 'default';
}
};

  const filteredTemplates = getTemplates({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    profession: selectedProfession === 'all' ? undefined : selectedProfession
});

  const filteredPresets = getPresets({
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    profession: selectedProfession === 'all' ? undefined : selectedProfession
});

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArticleOutlined color="primary" />
          Templates & Presets
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('refresh')}
            onClick={refreshData}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('download')}
            onClick={onExportClick}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('upload')}
            onClick={onImportClick}
          >
            Import
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb:  2 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 120}}>
          <InputLabel>Category</InputLabel>
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <MenuItem value="all">All Categories</MenuItem>
            <MenuItem value="dashboard">Dashboard</MenuItem>
            <MenuItem value="showcase">Showcase</MenuItem>
            <MenuItem value="project">Project</MenuItem>
            <MenuItem value="ui">UI/Theme</MenuItem>
            <MenuItem value="workflow">Workflow</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 120}}>
          <InputLabel>Profession</InputLabel>
          <Select
            value={selectedProfession}
            onChange={(e) => setSelectedProfession(e.target.value)}
          >
            <MenuItem value="all">All Professions</MenuItem>
            <MenuItem value="photographer">Photographer</MenuItem>
            <MenuItem value="videographer">Videographer</MenuItem>
            <MenuItem value="music_producer">Music Producer</MenuItem>
            <MenuItem value="vendor">Vendor</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="universal">Universal</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Templates" />
          <Tab label="Presets" />
          <Tab label="Categories" />
        </Tabs>
      </Box>

      {/* Templates Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Templates</Typography>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('add')}
                    onClick={() => setShowTemplateDialog(true)}
                    sx={theming.getThemedButtonSx()}
                  >
                    Create Template
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Template</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Profession</TableCell>
                        <TableCell>Downloads</TableCell>
                        <TableCell>Rating</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Avatar sx={{ width:  32, height: 32}}>
                                {getCategoryIcon(template.category)}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2">{template.name}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                  {template.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                  {template.tags.slice(0, 3).map((tag) => (
                                    <Chip key={tag} label={tag} size="small" />
                                  ))}
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={template.category}
                              icon={getCategoryIcon(template.category)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={template.profession}
                              color={getProfessionColor(template.profession)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{template.metadata.downloads}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                              <Typography variant="body2">{template.metadata.rating}</Typography>
                              <Star fontSize="small" color="action" />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Preview Template">
                              <IconButton size="small">
                                {theming.getThemedIcon('visibility')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Apply Template">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleApplyTemplate(template.id)}
                              >
                                {theming.getThemedIcon('play')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Template">
                              <IconButton size="small">
                                {theming.getThemedIcon('edit')}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Presets Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Presets</Typography>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('add')}
                    onClick={() => setShowPresetDialog(true)}
                    sx={theming.getThemedButtonSx()}
                  >
                    Create Preset
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Preset</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Profession</TableCell>
                        <TableCell>Usage</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPresets.map((preset) => (
                        <TableRow key={preset.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Avatar sx={{ width:  32, height: 32}}>
                                {theming.getThemedIcon('tune')}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2">{preset.name}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                  {preset.description}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={preset.category} size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={preset.profession}
                              color={getProfessionColor(preset.profession)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{preset.metadata.usage}</TableCell>
                          <TableCell>
                            <Tooltip title="Apply Preset">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleApplyPreset(preset.id)}
                              >
                                {theming.getThemedIcon('play')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Preset">
                              <IconButton size="small">
                                {theming.getThemedIcon('edit')}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Categories Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Template Categories
                </Typography>
                <List>
                  {['dashboard','showcase','project','ui','workflow'].map((category) => (
                    <ListItem key={category}>
                      <ListItemIcon>
                        {getCategoryIcon(category)}
                      </ListItemIcon>
                      <ListItemText
                        primary={category.charAt(0).toUpperCase() + category.slice(1)}
                        secondary={`${templates.filter(t => t.category === category).length} templates`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Preset Categories
                </Typography>
                <List>
                  {['export','filter','view', 'workflow', 'settings'].map((category) => (
                    <ListItem key={category}>
                      <ListItemIcon>
                        {theming.getThemedIcon('tune')}
                      </ListItemIcon>
                      <ListItemText
                        primary={category.charAt(0).toUpperCase() + category.slice(1)}
                        secondary={`${presets.filter(p => p.category === category).length} presets`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showTemplateDialog} onClose={() => setShowTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Template</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Template Name"
            sx={{ mt:  2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            sx={{ mt:  2 }}
          />
          <FormControl fullWidth sx={{ mt:  2 }}>
            <InputLabel>Category</InputLabel>
            <Select>
              <MenuItem value="dashboard">Dashboard</MenuItem>
              <MenuItem value="showcase">Showcase</MenuItem>
              <MenuItem value="project">Project</MenuItem>
              <MenuItem value="ui">UI/Theme</MenuItem>
              <MenuItem value="workflow">Workflow</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Create Preset Dialog */}
      <Dialog open={showPresetDialog} onClose={() => setShowPresetDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Preset</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Preset Name"
            sx={{ mt:  2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            sx={{ mt:  2 }}
          />
          <FormControl fullWidth sx={{ mt:  2 }}>
            <InputLabel>Category</InputLabel>
            <Select>
              <MenuItem value="export">Export</MenuItem>
              <MenuItem value="filter">Filter</MenuItem>
              <MenuItem value="view">View</MenuItem>
              <MenuItem value="workflow">Workflow</MenuItem>
              <MenuItem value="settings">Settings</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPresetDialog(false)}>Cancel</Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TemplatePresetDashboard;




