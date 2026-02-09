import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  IconButton,
  Tooltip,
  Chip,
  Badge,
  Divider,
  List,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Fab,
  Drawer,
  AppBar,
  Toolbar,
  Grid,
  ListItemButton,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Share,
  Download,
  Upload,
  StarBorder,
  CameraAlt,
  Videocam,
  PhotoCamera,
  ExpandMore,
  ContentCopy,
  Refresh,
  Save,
  Cancel,
  Close,
  FilterList,
  Search,
  GetApp,
} from '@mui/icons-material';
import { 
  CameraTemplateIcon,
  CameraGearIcon,
  LensIcon,
  TripodIcon,
  GimbalIcon,
  LightingIcon,
  MemoryCardIcon,
  VideoSettingsIcon,
  PhotoSettingsIcon,
  WorkflowIcon,
  CameraSetupIcon,
} from '../shared/CreatorHubIcons';
import { useTheming } from '../../utils/theming-helper';
import { cameraTemplateManager, CameraTemplate, CameraTemplateCategory, CameraTemplateSearchFilters } from '../../data/camera-templates';

interface CameraTemplateSidebarProps {
  open: boolean;
  onClose: () => void;
  onTemplateSelect?: (template: CameraTemplate) => void;
  onTemplateSave?: (template: CameraTemplate) => void;
  selectedTemplateId?: string;
  projectType?: string;
  culture?: string;
  profession?: string;
  width?: number;
  position?: 'left' | 'right'; 
}

export const CameraTemplateSidebar: React.FC<CameraTemplateSidebarProps> = ({
  open,
  onClose,
  onTemplateSelect,
  onTemplateSave,
  selectedTemplateId,
  projectType = 'wedding',
  culture,
  profession = 'both',
  width = 400,
  position = 'right'
}) => {
  
  // Theming system
  const theming = useTheming('photographer');
  const [templates, setTemplates] = useState<CameraTemplate[]>([]);
  const [categories, setCategories] = useState<CameraTemplateCategory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CameraTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [_isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<CameraTemplateSearchFilters>({
    category: projectType,
    profession,
    culture
});
  const [importData, setImportData] = useState('');
  const [shareToken, setShareToken] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{type: 'success' | 'error' | 'info' | 'warning', text: string} | null>(null);

  // Form state for creating/editing templates
  const [templateForm, setTemplateForm] = useState<Partial<CameraTemplate>>({
    name: '',
    description: '',
    category: projectType as any,
    profession: profession as any,
    culture,
    phase: 'all',
    primaryCamera: {},
    additionalCameras: [],
    lenses: [],
    accessories: [],
    settings: {
      video: {
        resolution: '4',
        frameRate: '25fps',
        colorSpace: 'Rec.70',
        codec: 'H.264'
      },
      photo: {
        fileFormat: 'raw+jpeg',
        quality: 'maximum',
        colorSpace: 'sRGB',
        whiteBalance: 'auto'
    }
  },
    workflow: {
      backupStrategy: 'realtime',
      backupFrequency:  30,
      memoryCardLabeling: 'ABCD',
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
    let filtered = cameraTemplateManager.searchTemplates(searchFilters);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
  }
    
    return filtered;
}, [searchFilters, searchQuery]);

  const recommendedTemplates = useMemo(() => {
    return cameraTemplateManager.getRecommendedTemplates('current-user', projectType, culture);
}, [projectType, culture]);

  const handleTemplateSelect = (template: CameraTemplate) => {
    setSelectedTemplate(template);
    onTemplateSelect?.(template);
  };

  const handleCreateTemplate = () => {
    setIsCreateDialogOpen(true);
    setTemplateForm({
      name: '',
      description: '',
      category: projectType as any,
      profession: profession as any,
      culture,
      phase: 'all',
      primaryCamera: {},
      additionalCameras: [],
      lenses: [],
      accessories: [],
      settings: {
        video: {
          resolution: '4',
          frameRate: '25fps',
          colorSpace: 'Rec.70',
          codec: 'H.264'
        },
        photo: {
          fileFormat: 'raw+jpeg',
          quality: 'maximum',
          colorSpace: 'sRGB',
          whiteBalance: 'auto'
        }
      },
      workflow: {
        backupStrategy: 'realtime',
        backupFrequency: 30,
        memoryCardLabeling: 'ABCD',
        estimatedPhotos: 100,
        estimatedVideoHours: 4,
        estimatedStorage: '200'
      },
      isPublic: false,
      tags: []
    });
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
      } as any);

      setTemplates(prev => [...prev, newTemplate]);
      setIsCreateDialogOpen(false);
      onTemplateSave?.(newTemplate);
      setAlertMessage({ type: 'success', text: `Template "${newTemplate.name}" created successfully!` });
      setTimeout(() => setAlertMessage(null), 5000);
      
      // Reset form
      setTemplateForm({
        name: '',
        description: '',
        category: projectType as any,
        profession: profession as any,
        culture,
        phase: 'all',
        primaryCamera: {},
        additionalCameras: [],
        lenses: [],
        accessories: [],
        settings: {
          video: {
            resolution: '4',
            frameRate: '25fps',
            colorSpace: 'Rec.70',
            codec: 'H.264'
          },
          photo: {
            fileFormat: 'raw+jpeg',
            quality: 'maximum',
            colorSpace: 'sRGB',
            whiteBalance: 'auto'
          }
        },
        workflow: {
          backupStrategy: 'realtime',
          backupFrequency: 30,
          memoryCardLabeling: 'ABCD',
          estimatedPhotos: 100,
          estimatedVideoHours: 4,
          estimatedStorage: '200'
        },
        isPublic: false,
        tags: []
      });
    } catch (error) {
      console.error('Failed to save template: ', error);
      setAlertMessage({ type: 'error', text: 'Failed to save template. Please try again.' });
      setTimeout(() => setAlertMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTemplate = (template: CameraTemplate) => {
    setTemplateForm(template);
    setIsEditDialogOpen(true);
  };

  const _handleUpdateTemplate = async () => {
    if (!templateForm.id) return;

    setIsLoading(true);
    try {
      const updatedTemplate = cameraTemplateManager.updateTemplate(templateForm.id, templateForm);
      if (updatedTemplate) {
        setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
        setIsEditDialogOpen(false);
        onTemplateSave?.(updatedTemplate);
        setAlertMessage({ type: 'success', text: `Template "${updatedTemplate.name}" updated successfully!` });
        setTimeout(() => setAlertMessage(null), 5000);
    }
  } catch (error) {
      console.error('Failed to update template:', error);
      setAlertMessage({ type: 'error', text: 'Failed to update template. Please try again.' });
      setTimeout(() => setAlertMessage(null), 5000);
  } finally {
      setIsLoading(false);
  }
};

  const handleDeleteTemplate = (templateId: string) => {
    setConfirmDeleteId(templateId);
  };

  const executeDeleteTemplate = () => {
    if (!confirmDeleteId) return;
    const templateName = templates.find(t => t.id === confirmDeleteId)?.name;
    const success = cameraTemplateManager.deleteTemplate(confirmDeleteId);
    if (success) {
      setTemplates(prev => prev.filter(t => t.id !== confirmDeleteId));
      if (selectedTemplate?.id === confirmDeleteId) {
        setSelectedTemplate(null);
      }
      setAlertMessage({ type: 'success', text: `Template "${templateName}" deleted successfully.` });
      setTimeout(() => setAlertMessage(null), 5000);
    } else {
      setAlertMessage({ type: 'error', text: 'Failed to delete template.' });
      setTimeout(() => setAlertMessage(null), 5000);
    }
    setConfirmDeleteId(null);
  };

  const handleShareTemplate = (template: CameraTemplate) => {
    setSelectedTemplate(template);
    setIsShareDialogOpen(true);
  };

  const handleGenerateShareLink = () => {
    if (!selectedTemplate) return;

    const token = cameraTemplateManager.shareTemplate(selectedTemplate.id, 'view');
    if (token) {
      setShareToken(token);
      setAlertMessage({ type: 'success', text: 'Share link generated successfully!' });
      setTimeout(() => setAlertMessage(null), 5000);
    } else {
      setAlertMessage({ type: 'error', text: 'Failed to generate share link.' });
      setTimeout(() => setAlertMessage(null), 5000);
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
        setAlertMessage({ type: 'success', text: `Successfully imported ${result.success} template(s)!` });
        setTimeout(() => setAlertMessage(null), 5000);
    } else {
        setAlertMessage({ type: 'warning', text: 'No templates were imported.' });
        setTimeout(() => setAlertMessage(null), 5000);
    }
      console.log('Import result:', result);
  } catch (error) {
      console.error('Failed to import templates:', error);
      setAlertMessage({ type: 'error', text: 'Failed to import templates. Please check the format.' });
      setTimeout(() => setAlertMessage(null), 5000);
  } finally {
      setIsLoading(false);
  }
};

  const handleDuplicateTemplate = (template: CameraTemplate) => {
    const { id, version, createdAt, updatedAt, usageCount, lastUsed, reviews, ...templateData } = template;
    const duplicated = cameraTemplateManager.createTemplate({
      ...templateData,
      name: `${template.name} (Copy)`,
      createdBy: 'current-user',
    });
    setTemplates(prev => [...prev, duplicated]);
    setAlertMessage({ type: 'success', text: `Template "${duplicated.name}" duplicated successfully!` });
    setTimeout(() => setAlertMessage(null), 5000);
  };

  const handleRefreshTemplates = () => {
    setIsLoading(true);
    loadTemplates();
    loadCategories();
    setTimeout(() => {
      setIsLoading(false);
      setAlertMessage({ type: 'info', text: 'Templates refreshed successfully!' });
      setTimeout(() => setAlertMessage(null), 5000);
    }, 500);
  };

  const handleDownloadTemplate = (template: CameraTemplate) => {
    const exportData = cameraTemplateManager.exportTemplates([template.id]);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '-').toLowerCase()}-template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAlertMessage({ type: 'success', text: `Template "${template.name}" downloaded!` });
    setTimeout(() => setAlertMessage(null), 3000);
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
    setAlertMessage({ type: 'success', text: `Exported ${templateIds.length} template(s)!` });
    setTimeout(() => setAlertMessage(null), 3000);
};

  const renderTemplateListItem = (template: CameraTemplate) => (
    <Card 
      key={template.id}
      elevation={selectedTemplateId === template.id ? 4 : 1}
      sx={{
        mb: 1,
        border: selectedTemplateId === template.id ? 2 : 1,
        borderColor: selectedTemplateId === template.id ? 'primary.main' : 'divider',
        transition: 'all 0.2s'
      }}
    >
      <ListItemButton
        selected={selectedTemplateId === template.id}
        onClick={() => handleTemplateSelect(template)}
      >
      <ListItemText
        primary={
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 0.5}}>              
              <Badge 
                badgeContent={template.usageCount > 99 ? '99+' : template.usageCount} 
                color="primary"
                invisible={!template.usageCount || template.usageCount === 0}
                sx={{ mr: 0.5 }}
              >
                <CameraSetupIcon 
                  sx={{ 
                    fontSize: 18,
                    color: template.profession === 'photographer' ? 'secondary.main' : 
                           template.profession === 'videographer' ? 'primary.main' : 
                           'text.primary'
                }} 
                />
              </Badge>
              <Typography variant="subtitle2" noWrap sx={{ flexGrow:  1 }}>
                {template.name}
              </Typography>
              <Box sx={{ ml:  1 }}>
                {template.isDefault && (
                  <Chip label="Default" size="small" color="primary" sx={{ mr: 0.5}} />
                )}
                {template.isPublic && (
                  <Chip label="Public" size="small" color="secondary" sx={{ mr: 0.5}} />
                )}
              </Box>
            </Box>
      }
        secondary={
          <Box>
            <Typography variant="caption" color="text.secondary" noWrap>
              {template.description}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5}}>
              <Chip 
                label={template.category} 
                size="small" 
                sx={{ mr: 0, fontSize: '0.7rem' }}
                color="primary"
                variant="outlined"
              />
              <Chip 
                label={template.profession} 
                size="small" 
                sx={{ mr: 0, fontSize: '0.7rem' }}
                color="secondary"
                variant="outlined"
              />
              {template.primaryCamera.video && (
                <Chip 
                  icon={<Videocam sx={{ fontSize: 12}} />}
                  label="Video" 
                  size="small" 
                  sx={{ mr: 0, fontSize: '0.7rem' }}
                  color="primary"
                />
              )}
              {template.primaryCamera.photo && (
                <Chip 
                  icon={<PhotoCamera sx={{ fontSize: 12}} />}
                  label="Photo" 
                  size="small" 
                  sx={{ mr: 0, fontSize: '0.7rem' }}
                  color="secondary"
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 1}}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <StarBorder sx={{ fontSize: 14 }} />
                {template.rating ? template.rating.toFixed(1) : 'Not rated'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                • {template.usageCount || 0} uses
              </Typography>
            </Box>
          </Box>
      }
      />
      <ListItemSecondaryAction>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5, flexWrap: 'wrap'}}>          
          <Tooltip title="Download">
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadTemplate(template);
            }}
            >
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Duplicate">
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicateTemplate(template);
            }}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleEditTemplate(template);
            }}
            >
              <Edit fontSize="small" />
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
              <Share fontSize="small" />
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
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </ListItemSecondaryAction>
      </ListItemButton>
    </Card>
  );

  const _renderTemplateDetails = (template: CameraTemplate) => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        {template.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
        {template.description}
      </Typography>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <CameraSetupIcon 
            sx={{ 
              mr: 1, fontSize:  16,
              color: template.profession === 'photographer' ? 'secondary.main' : 
                     template.profession === 'videographer' ? 'primary.main' : 
                     'text.primary'
          }} 
          />
          <Typography variant="subtitle2">Primary Camera Setup</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {template.primaryCamera.video && (
            <Box sx={{ mb:  2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                <VideoSettingsIcon sx={{ mr: 1, fontSize: 16, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="primary">
                  Video Camera
                </Typography>
              </Box>
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
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                <PhotoSettingsIcon sx={{ mr: 1, fontSize: 16, color: 'secondary.main' }} />
                <Typography variant="subtitle2" color="secondary">
                  Photo Camera
                </Typography>
              </Box>
              <Typography variant="body2">
                {template.primaryCamera.photo.brand} {template.primaryCamera.photo.model}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <LensIcon 
            sx={{ 
              mr: 1, fontSize:  16,
              color: template.profession === 'photographer' ? 'secondary.main' : 
                     template.profession === 'videographer' ? 'primary.main' : 
                     'text.primary'
          }} 
          />
          <Typography variant="subtitle2">Lenses ({template.lenses.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {template.lenses.map((lens, index) => (
            <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <LensIcon 
                sx={{ 
                  mr: 1, fontSize:  14,
                  color: template.profession === 'photographer' ? 'secondary.main' : 
                         template.profession === 'videographer' ? 'primary.main' : 
                         'text.primary'
              }} 
              />
              <Box>
                <Typography variant="body2">
                  {lens.brand} {lens.model} - {lens.focalLength} f/{lens.aperture}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {lens.purpose}
                </Typography>
              </Box>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <CameraGearIcon 
            sx={{ 
              mr: 1, fontSize:  16,
              color: template.profession === 'photographer' ? 'secondary.main' : 
                     template.profession === 'videographer' ? 'primary.main' : 
                     'text.primary'
          }} 
          />
          <Typography variant="subtitle2">Accessories ({template.accessories.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {template.accessories.map((accessory, index) => (
            <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              {accessory.type === 'tripod' && <TripodIcon sx={{ 
                mr: 1, fontSize:  14,
                color: template.profession === 'photographer' ? 'secondary.main' : 
                       template.profession === 'videographer' ? 'primary.main' : 
                       'text.primary'
            }} />}
              {accessory.type === 'gimbal' && <GimbalIcon sx={{ 
                mr: 1, fontSize:  14,
                color: template.profession === 'photographer' ? 'secondary.main' : 
                       template.profession === 'videographer' ? 'primary.main' : 
                       'text.primary'
            }} />}
              {accessory.type === 'lighting' && <LightingIcon sx={{ 
                mr: 1, fontSize:  14,
                color: template.profession === 'photographer' ? 'secondary.main' : 
                       template.profession === 'videographer' ? 'primary.main' : 
                       'text.primary'
            }} />}
              {accessory.type === 'storage' && <MemoryCardIcon sx={{ 
                mr: 1, fontSize:  14,
                color: template.profession === 'photographer' ? 'secondary.main' : 
                       template.profession === 'videographer' ? 'primary.main' : 
                       'text.primary'
            }} />}
              {!['tripod','gimbal','lighting','storage'].includes(accessory.type) && <CameraGearIcon sx={{ 
                mr: 1, fontSize:  14,
                color: template.profession === 'photographer' ? 'secondary.main' : 
                       template.profession === 'videographer' ? 'primary.main' : 
                       'text.primary'
            }} />}
              <Box>
                <Typography variant="body2">
                  {accessory.brand} {accessory.model} x{accessory.quantity}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {accessory.purpose}
                </Typography>
              </Box>
            </Box>
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <WorkflowIcon 
            sx={{ 
              mr: 1, fontSize:  16,
              color: template.profession === 'photographer' ? 'secondary.main' : 
                     template.profession === 'videographer' ? 'primary.main' : 
                     'text.primary'
          }} 
          />
          <Typography variant="subtitle2">Settings & Workflow</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb:  2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
              <VideoSettingsIcon sx={{ mr: 1, fontSize: 16, color: 'primary.main' }} />
              <Typography variant="subtitle2">Video Settings</Typography>
            </Box>
            <Typography variant="body2">
              {template.settings.video.resolution} @ {template.settings.video.frameRate}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {template.settings.video.colorSpace} • {template.settings.video.codec}
            </Typography>
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
              <PhotoSettingsIcon sx={{ mr: 1, fontSize: 16, color: 'secondary.main' }} />
              <Typography variant="subtitle2">Photo Settings</Typography>
            </Box>
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
    <>
      <Drawer
        anchor={position}
        open={open}
        onClose={onClose}
        sx={{
          width: width,
          flexShrink: 0, '& .MuiDrawer-paper': { width: width,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
        }
      }}
      >
        {/* Header */}
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar>
            <CameraTemplateIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{  flexGrow:  1  }}>
              Camera Templates
            </Typography>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefreshTemplates} disabled={isLoading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Filters">
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                <FilterList />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton onClick={onClose}>
                <Close />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Search and Filters */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
          }}
          />
          
          {showFilters && (
            <Box sx={{ mt:  2 }}>
              <Grid container spacing={1}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
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
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Profession</InputLabel>
                    <Select
                      value={searchFilters.profession || ', '}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, profession: e.target.value }))}
                    >
                      <MenuItem value="photographer">Photographer</MenuItem>
                      <MenuItem value="videographer">Videographer</MenuItem>
                      <MenuItem value="both">Both</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Culture</InputLabel>
                    <Select
                      value={searchFilters.culture || ', '}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, culture: e.target.value }))}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="norsk">Norwegian</MenuItem>
                      <MenuItem value="indisk">Indian</MenuItem>
                      <MenuItem value="pakistansk">Pakistani</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>

        {/* Alerts */}
        {alertMessage && (
          <Box sx={{ p: 2, pb: 0 }}>
            <Alert 
              severity={alertMessage.type} 
              onClose={() => setAlertMessage(null)}
              sx={{ mb: 1 }}
            >
              {alertMessage.text}
            </Alert>
          </Box>
        )}

        {/* Content */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>          
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {/* Recommended Templates */}
          {recommendedTemplates.length > 0 && (
            <Box sx={{ p:  2 }}>
              <Typography variant="subtitle1" gutterBottom>
                ⭐ Recommended
              </Typography>
              <List dense>
                {recommendedTemplates.slice(0, 3).map(renderTemplateListItem)}
              </List>
            </Box>
          )}

          <Divider />

          {/* All Templates */}
          <Box sx={{ p:  2 }}>
            <Typography variant="subtitle1" gutterBottom>
              All Templates ({filteredTemplates.length})
            </Typography>
            <List dense>
              {filteredTemplates.map(renderTemplateListItem)}
            </List>
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Upload />}
              onClick={() => setIsImportDialogOpen(true)}
              fullWidth
            >
              Import
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<GetApp />}
              onClick={() => handleExportTemplates(templates.map(t => t.id))}
              fullWidth
            >
              Export
            </Button>
          </Box>
          <Button variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={handleCreateTemplate}
            fullWidth
          >
            Create Template
          </Button>
        </Box>
      </Drawer>

      {/* Floating Action Button for quick template creation */}
      {!isCreateDialogOpen && (
        <Fab
          color="primary"
          aria-label="create template"
          onClick={handleCreateTemplate}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: position === 'right' ? width + 16 : 16,
            left: position === 'left' ? width + 16 : 'auto'
          }}
        >
          <Add />
        </Fab>
      )}

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt />
            Create Camera Template
          </Box>
        </DialogTitle>
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
          <Button onClick={() => setIsCreateDialogOpen(false)} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button onClick={handleSaveTemplate} 
            variant="contained"
            disabled={isLoading || !templateForm.name}
            startIcon={isLoading ? <CircularProgress size={20} /> : <Save />}
          >
            {isLoading ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Template Dialog */}
      <Dialog open={isShareDialogOpen} onClose={() => setIsShareDialogOpen(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Share />
            Share Template
          </Box>
        </DialogTitle>
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
                        <IconButton onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/templates/${shareToken}`);
                          setAlertMessage({ type: 'success', text: 'Link copied to clipboard!' });
                          setTimeout(() => setAlertMessage(null), 3000);
                        }}>
                          <ContentCopy />
                        </IconButton>
                      )
                  }}
                  />
                </Box>
              ) : (
                <Button variant="contained"
                  onClick={handleGenerateShareLink}
                  startIcon={<Share />}>
                  Generate Share Link
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsShareDialogOpen(false)} startIcon={<Close />}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Templates Dialog */}
      <Dialog open={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Upload />
            Import Templates
          </Box>
        </DialogTitle>
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
          <Button onClick={() => setIsImportDialogOpen(false)} startIcon={<Cancel />}>
            Cancel
          </Button>
          <Button onClick={handleImportTemplates} 
            variant="contained"
            disabled={isLoading || !importData.trim()}
            startIcon={isLoading ? <CircularProgress size={20} /> : <Upload />}
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
          <Button onClick={() => setConfirmDeleteId(null)} startIcon={<Cancel />}>
            Avbryt
          </Button>
          <Button onClick={executeDeleteTemplate} color="error" variant="contained" startIcon={<Delete />}>
            Slett
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CameraTemplateSidebar;
