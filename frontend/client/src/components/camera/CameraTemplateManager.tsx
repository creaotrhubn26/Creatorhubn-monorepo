import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Rating,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Share,
  Download,
  Upload,
  Star,
  StarBorder,
  CameraAlt,
  Videocam,
  PhotoCamera,
  ExpandMore,
  ContentCopy,
  Refresh,
  Save,
  Cancel,
} from '@mui/icons-material';
import { useCameraDiscovery } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { cameraTemplateManager, CameraTemplate, CameraTemplateCategory, CameraTemplateSearchFilters } from '../../data/camera-templates';
import { Camera } from '../../data/video-camera-database';
import { PhotoCamera as PhotoCameraType } from '../../data/photo-camera-database';

interface CameraTemplateManagerProps {
  onTemplateSelect?: (template: CameraTemplate) => void;
  onTemplateSave?: (template: CameraTemplate) => void;
  selectedTemplateId?: string;
  projectType?: string;
  culture?: string;
  profession?: string; 
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number; 
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export const CameraTemplateManagerComponent: React.FC<CameraTemplateManagerProps> = ({
  onTemplateSelect,
  onTemplateSave,
  selectedTemplateId,
  projectType = 'wedding',
  culture,
  profession = 'both'
}) => {
  const cameraDiscovery = useCameraDiscovery();
  
  // Theming system
  const theming = useTheming('photographer');
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState<CameraTemplate[]>([]);
  const [categories, setCategories] = useState<CameraTemplateCategory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CameraTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilters, setSearchFilters] = useState<CameraTemplateSearchFilters>({
    category: projectType,
    profession,
    culture
});
  const [importData, setImportData] = useState('');
  const [shareToken, setShareToken] = useState('');

  // Form state for creating/editing templates
  const [templateForm, setTemplateForm] = useState<Partial<CameraTemplate>>({
    name: '',
    description: '',
    category: projectType as any,
    profession: profession as any,
    culture,
    phase: 'all',
    primaryCamera:  , {},
    additionalCameras:  [],
    lenses:  [],
    accessories:  [],
    settings: {
      video: {
        resolution: '4',
        frameRate: '25fps',
        colorSpace: 'Rec.70',
        codec: 'H.264'
    ,},
      photo: {
        fileFormat: 'raw+jpeg',
        quality: 'maximum',
        colorSpace: 'sRG',
        whiteBalance: 'auto'
    }
  },
    workflow: {
      backupStrategy: 'realtime',
      backupFrequency:  30,
      memoryCardLabeling: 'ABC',
      estimatedPhotos: 100,
      estimatedVideoHours:  4,
      estimatedStorage: '200'
  ,},
    isPublic: false,
    tags: []
,});

  // Load initial data
  useEffect(() => {
    loadTemplates();
    loadCategories();
}, []);

  // Load recommended templates when project type changes
  useEffect(() => {
    if (projectType) {
      setSearchFilters(prev => ({ ...prev, category: projectType }));
  }
}, [projectType, culture, profession]);

  const loadTemplates = () => {
    const allTemplates = cameraTemplateManager.getAllTemplates();
    setTemplates(allTemplates);
};

  const loadCategories = () => {
    const allCategories = cameraTemplateManager.getCategories();
    setCategories(allCategories);
};

  const filteredTemplates = useMemo(() => {
    return cameraTemplateManager.searchTemplates(searchFilters);
}, [searchFilters]);

  const recommendedTemplates = useMemo(() => {
    return cameraTemplateManager.getRecommendedTemplates('current-user', projectType, culture);
}, [projectType, culture]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
,};

  const handleTemplateSelect = (template: CameraTemplate) => {
    setSelectedTemplate(template);
    onTemplateSelect?.(template);
,};

  const handleCreateTemplate = () => {
    setIsCreateDialogOpen(true);
    setTemplateForm({
      name: '',
      description: '',
      category: projectType as any,
      profession: profession as any,
      culture,
      phase: 'all',
      primaryCamera:  , {},
      additionalCameras:  [],
      lenses:  [],
      accessories:  [],
      settings: {
        video: {
          resolution: '4',
          frameRate: '25fps',
          colorSpace: 'Rec.70',
          codec: 'H.264'
      ,},
        photo: {
          fileFormat: 'raw+jpeg',
          quality: 'maximum',
          colorSpace: 'sRG',
          whiteBalance: 'auto'
      }
    },
      workflow: {
        backupStrategy: 'realtime',
        backupFrequency:  30,
        memoryCardLabeling: 'ABC',
        estimatedPhotos: 100,
        estimatedVideoHours:  4,
        estimatedStorage: '200'
    ,},
      isPublic: false,
      tags: []
  ,});
};

  const handleSaveTemplate = async () => {
    if (!templateForm.name || !templateForm.category) return;

    setIsLoading(true);
    try {
      const newTemplate = cameraTemplateManager.createTemplate({
        ...templateForm,
        createdBy: 'current-user',
        isPublic: templateForm.isPublic || false,
        tags: templateForm.tags || []
    ,} as any);

      setTemplates(prev => [...prev, newTemplate]);
      setIsCreateDialogOpen(false);
      onTemplateSave?.(newTemplate);
      
      // Reset form
      setTemplateForm({
        name: '',
        description: '',
        category: projectType as any,
        profession: profession as any,
        culture,
        phase: 'all',
        primaryCamera:  , {},
        additionalCameras:  [],
        lenses:  [],
        accessories:  [],
        settings: {
          video: {
            resolution: '4',
            frameRate: '25fps',
            colorSpace: 'Rec.70',
            codec: 'H.264'
        ,},
          photo: {
            fileFormat: 'raw+jpeg',
            quality: 'maximum',
            colorSpace: 'sRG',
            whiteBalance: 'auto'
        }
      },
        workflow: {
          backupStrategy: 'realtime',
          backupFrequency:  30,
          memoryCardLabeling: 'ABC',
          estimatedPhotos: 100,
          estimatedVideoHours:  4,
          estimatedStorage: '200'
      ,},
        isPublic: false,
        tags: []
    ,});
  } catch (error) {
      console.error('Failed to save template: ', error);
  } finally {
      setIsLoading(false);
  }
};

  const handleEditTemplate = (template: CameraTemplate) => {
    setTemplateForm(template);
    setIsEditDialogOpen(true);
,};

  const handleUpdateTemplate = async () => {
    if (!templateForm.id) return;

    setIsLoading(true);
    try {
      const updatedTemplate = cameraTemplateManager.updateTemplate(templateForm.id, templateForm);
      if (updatedTemplate) {
        setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
        setIsEditDialogOpen(false);
        onTemplateSave?.(updatedTemplate);
    }
  } catch (error) {
      console.error('Failed to update template:', error);
  } finally {
      setIsLoading(false);
  }
};

  const handleDeleteTemplate = (templateId: string) => {
    setConfirmDeleteId(templateId);
  };

  const executeDeleteTemplate = () => {
    if (!confirmDeleteId) return;
    const success = cameraTemplateManager.deleteTemplate(confirmDeleteId);
    if (success) {
      setTemplates(prev => prev.filter(t => t.id !== confirmDeleteId));
      if (selectedTemplate?.id === confirmDeleteId) {
        setSelectedTemplate(null);
      }
    }
    setConfirmDeleteId(null);
  };

  const handleShareTemplate = (template: CameraTemplate) => {
    setSelectedTemplate(template);
    setIsShareDialogOpen(true);
,};

  const handleGenerateShareLink = () => {
    if (!selectedTemplate) return;

    const token = cameraTemplateManager.shareTemplate(selectedTemplate.id'view');
    if (token) {
      setShareToken(token);
  }
};

  const handleImportTemplates = () => {
    if (!importData.trim()) return;

    setIsLoading(true);
    try {
      const result = cameraTemplateManager.importTemplates(importData);
      if (result.success > 0) {
        loadTemplates();
        setImportData('');
        setIsImportDialogOpen(false);
    }
      // Show result to user
      console.log('Import result:', result);
  } catch (error) {
      console.error('Failed to import templates:', error);
  } finally {
      setIsLoading(false);
  }
};

  const handleExportTemplates = (templateIds: string[]) => {
    const exportData = cameraTemplateManager.exportTemplates(templateIds);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camera-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

  const renderTemplateCard = (template: CameraTemplate) => (
    <Grid item xs={2} sm={6} md={4} key={template.id}>
      <Card 
        sx={{ 
          cursor: 'pointer',
          border: selectedTemplateId === template.id ? 2 : 1,
          borderColor: selectedTemplateId === template.id ? 'primary.main' : 'divider'
      }}
        onClick={() => handleTemplateSelect(template)}
      >
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  1 }}>
            <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
              {template.name}
            </Typography>
            <Box>
              {template.isDefault && (
                <Chip label="Default" size="small" color="primary" sx={{ mr:  1 }} />
              )}
              {template.isPublic && (
                <Chip label="Public" size="small" color="secondary" sx={{ mr:  1 }} />
              )}
            </Box>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            {template.description}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
            <Chip 
              label={template.category} 
              size="small" 
              sx={{ mr:  1 }}
              color="primary"
              variant="outlined"
            />
            <Chip 
              label={template.profession} 
              size="small" 
              sx={{ mr:  1 }}
              color="secondary"
              variant="outlined"
            />
            {template.culture && (
              <Chip 
                label={template.culture} 
                size="small" 
                sx={{ mr:  1 }}
                color="info"
                variant="outlined"
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
            {template.primaryCamera.video && (
              <Chip 
                icon={theming.getThemedIcon('videocam')}}
                label="Video" 
                size="small" 
                sx={{ mr:  1 }}
                color="primary"
              />
            )}
            {template.primaryCamera.photo && (
              <Chip 
                icon={theming.getThemedIcon('photoCamera')}}
                label="Photo" 
                size="small" 
                sx={{ mr:  1 }}
                color="secondary"
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Used {template.usageCount} times
              </Typography>
              {template.rating && (
                <Rating 
                  value={template.rating} 
                  size="small" 
                  readOnly 
                  sx={{ ml:  1 }}
                />
              )}
            </Box>
            
            <Box>
              <Tooltip title="Edit">
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditTemplate(template);
                }}
                >
                  {theming.getThemedIcon('edit')}
                </IconButton>
              </Tooltip>
              <Tooltip title="Share">
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareTemplate(template);
                }}
                >
                  {theming.getThemedIcon('share')}
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTemplate(template.id);
                }}
                >
                  {theming.getThemedIcon('delete')}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );

  const renderTemplateDetails = (template: CameraTemplate) => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        {template.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
        {template.description}
      </Typography>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
          <Typography>Primary Camera Setup</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {template.primaryCamera.video && (
            <Box sx={{ mb:  2 }}>
              <Typography variant="subtitle2" color="primary">
                Video Camera
              </Typography>
              <Typography variant="body2">
                {template.primaryCamera.video.brand} {template.primaryCamera.video.model}
              </Typography>
              {template.primaryCamera.video.logFormats && (
                <Typography variant="caption" color="text.secondary">
                  LOG: {template.primaryCamera.video.logFormats.join('')}
                </Typography>
              )}
            </Box>
          )}
          {template.primaryCamera.photo && (
            <Box>
              <Typography variant="subtitle2" color="secondary">
                Photo Camera
              </Typography>
              <Typography variant="body2">
                {template.primaryCamera.photo.brand} {template.primaryCamera.photo.model}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
          <Typography>Lenses ({template.lenses.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {template.lenses.map((lens, index) => (
            <Box key={index} sx={{ mb:  1 }}>
              <Typography variant="body2">
                {lens.brand} {lens.model} - {lens.focalLength} f/{lens.aperture}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {lens.purpose}
              </Typography>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
          <Typography>Accessories ({template.accessories.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {template.accessories.map((accessory, index) => (
            <Box key={index} sx={{ mb:  1 }}>
              <Typography variant="body2">
                {accessory.brand} {accessory.model} x{accessory.quantity}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {accessory.purpose}
              </Typography>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
          <Typography>Settings & Workflow</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb:  2 }}>
            <Typography variant="subtitle2">Video Settings</Typography>
            <Typography variant="body2">
              {template.settings.video.resolution} @ {template.settings.video.frameRate}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {template.settings.video.colorSpace} • {template.settings.video.codec}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2">Photo Settings</Typography>
            <Typography variant="body2">
              {template.settings.photo.fileFormat} • {template.settings.photo.quality}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {template.settings.photo.colorSpace} • {template.settings.photo.whiteBalance}
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" sx={{ color: theming.colors.primary }}>
          📸 Camera Templates
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('upload')}
            onClick={() => setIsImportDialogOpen(true)}
            sx={{ mr:  1 }}
          >
            Import
          </Button>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('download')}
            onClick={() => handleExportTemplates(templates.map(t => t.id))}
            sx={{ mr:  1 }}
          >
            Export All
          </Button>
          <Button variant="contained"
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateTemplate}
           sx={theming.getThemedButtonSx()}>
            Create Template
          </Button>
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Recommended" />
          <Tab label="All Templates" />
          <Tab label="My Templates" />
          <Tab label="Categories" />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Recommended for {projectType} {culture && `(${culture})`}
        </Typography>
        <Grid container spacing={2}>
          {recommendedTemplates.slice(0, 6).map(renderTemplateCard)}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box sx={{ mb:  3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={searchFilters.category || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map(category => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Profession</InputLabel>
                <Select
                  value={searchFilters.profession || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, profession: e.target.value }))}
                >
                  <MenuItem value="photographer">Photographer</MenuItem>
                  <MenuItem value="videographer">Videographer</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Culture</InputLabel>
                <Select
                  value={searchFilters.culture || ''}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, culture: e.target.value }))}
                >
                  <MenuItem value="">All Cultures</MenuItem>
                  <MenuItem value="norsk">Norwegian</MenuItem>
                  <MenuItem value="indisk">Indian</MenuItem>
                  <MenuItem value="pakistansk">Pakistani</MenuItem>
                  <MenuItem value="amerikansk">American</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Camera Brand</InputLabel>
                <Select
                  value={searchFilters.cameraBrand || ', '}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, cameraBrand: e.target.value }))}
                >
                  <MenuItem value="">All Brands</MenuItem>
                  <MenuItem value="Sony">Sony</MenuItem>
                  <MenuItem value="Canon">Canon</MenuItem>
                  <MenuItem value="Nikon">Nikon</MenuItem>
                  <MenuItem value="Panasonic">Panasonic</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
        <Grid container spacing={2}>
          {filteredTemplates.map(renderTemplateCard)}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          My Custom Templates
        </Typography>
        <Grid container spacing={2}>
          {templates.filter(t => t.createdBy === 'current-user').map(renderTemplateCard)}
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Template Categories
        </Typography>
        <Grid container spacing={2}>
          {categories.map(category => (
            <Grid item xs={12} sm={6} md={4} key={category.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                    <Typography variant="h6" sx={{  mr:  1  }}>
                      {category.icon}
                    </Typography>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {category.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    {category.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {templates.filter(t => t.category === category.id).length} templates
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Camera Template</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Name"
                value={templateForm.name || ', '}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={templateForm.description || ', '}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={templateForm.category || ', '}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value as any }))}
                >
                  {categories.map(category => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Profession</InputLabel>
                <Select
                  value={templateForm.profession || ', '}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, profession: e.target.value as any }))}
                >
                  <MenuItem value="photographer">Photographer</MenuItem>
                  <MenuItem value="videographer">Videographer</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={templateForm.isPublic || false}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                  />
              }
                label="Make this template public"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} 
            variant="contained"
            disabled={isLoading || !templateForm.name}
            startIcon={isLoading ? <CircularProgress size={20} sx={theming.getThemedButtonSx()}> : theming.getThemedIcon('save')}
          >
            {isLoading ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Template Dialog */}
      <Dialog open={isShareDialogOpen} onClose={() => setIsShareDialogOpen(false)}>
        <DialogTitle>Share Template</DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                {selectedTemplate.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                {selectedTemplate.description}
              </Typography>
              
              {shareToken ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Share Link: </Typography>
                  <TextField
                    fullWidth
                    value={`${window.location.origin}/templates/${shareToken}`}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <IconButton onClick={() => navigator.clipboard.writeText(`${window.location.origin}/templates/${shareToken}`)}>
                          {theming.getThemedIcon('contentCopy')}
                        </IconButton>
                      )
                  }}
                  />
                </Box>
              ) : (
                <Button variant="contained"
                  onClick={handleGenerateShareLink}
                  startIcon={theming.getThemedIcon('share')}
                 sx={theming.getThemedButtonSx()}>
                  Generate Share Link
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsShareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Import Templates Dialog */}
      <Dialog open={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Templates</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            Paste the exported template JSON data below: </Typography>
          <TextField
            fullWidth
            multiline
            rows={0}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="Paste template JSON data here..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleImportTemplates} 
            variant="contained"
            disabled={isLoading || !importData.trim()}
            startIcon={isLoading ? <CircularProgress size={20} sx={theming.getThemedButtonSx()}> : theming.getThemedIcon('upload')}
          >
            {isLoading ? 'Importing...' : 'Import Templates'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)}>
        <DialogTitle>Bekreft sletting</DialogTitle>
        <DialogContent>
          <Typography>Er du sikker på at du vil slette denne malen? Denne handlingen kan ikke angres.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Avbryt</Button>
          <Button onClick={executeDeleteTemplate} color="error" variant="contained">Slett</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CameraTemplateManagerComponent;














