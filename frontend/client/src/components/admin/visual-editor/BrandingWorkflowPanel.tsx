/**
 * Branding Workflow Panel
 * Complete Publish/Draft/Preview workflow for branding management
 * 
 * Features:
 * - Draft creation and editing
 * - Preview mode with visual indicators
 * - Publish workflow with version control
 * - Version history and rollback
 * - Accessibility validation
 * - Export/Import configs
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Publish as PublishIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useBrandingWorkflow, useCreatorHubBranding } from '../../../hooks/useCreatorHubBranding';
import { ProjectCategoryType } from '../../../constants/CreatorHubBranding';

interface BrandingWorkflowPanelProps {
  onBrandingApplied?: (branding: Record<string, unknown>) => void;
  onNotification?: (notification: { title: string; message: string; type: string }) => void;
}

const BrandingWorkflowPanel: React.FC<BrandingWorkflowPanelProps> = ({
  onBrandingApplied,
  onNotification
}) => {
  const {
    branding,
    workflowState,
    startEditing,
    startPreview,
    publish,
    cancelEdit,
    canPublish,
    canPreview,
    hasUnsavedChanges
} = useBrandingWorkflow();

  // Local state
  const [selectedTab, setSelectedTab] = useState(0);
  const [brandingProfession, setBrandingProfession] = useState<'admin' | 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'>('photographer');
  const [confirmDeletePreset, setConfirmDeletePreset] = useState<{ id: string; name: string } | null>(null);
  const [brandingCategory, setBrandingCategory] = useState<ProjectCategoryType | undefined>(undefined);
  const [customBrandColor, setCustomBrandColor] = useState<string | undefined>(undefined);
  const [darkMode, setDarkMode] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState('');

  // Get current branding with live updates
  const liveBranding = useCreatorHubBranding({
    profession: brandingProfession,
    projectCategory: brandingCategory,
    customColor: customBrandColor,
    mode: darkMode ? 'dark' : 'light',
    persist: true,
    previewMode: workflowState === 'previewing'
});

  // Check accessibility
    const contrastCheck = liveBranding.checkContrast(liveBranding.color, '#ffffff');

  // Handle save as draft
  const handleSaveDraft = () => {
    if (!presetName) {
      onNotification?.({
        title: 'Validation Error',
        message: 'Please enter a preset name',
        type: 'error'
    });
      return;
  }

    const draft = liveBranding.saveDraft({
      name: presetName,
      description: presetDescription,
      profession: brandingProfession,
      category: brandingCategory,
      customColor: customBrandColor,
      mode: darkMode ? 'dark' : 'light'
  });

    onNotification?.({
      title: 'Draft Saved',
      message: `Branding preset "${presetName}," saved as draft`,
      type: 'success'
  });

    setPresetName('');
    setPresetDescription('');
};

  // Handle preview
  const handleEnterPreview = (presetId: string) => {
    const preset = liveBranding.enterPreviewMode(presetId);
    if (preset) {
      onNotification?.({
        title: 'Preview Mode Active',
        message: `Previewing "${preset.name}" - Changes are not live yet`,
        type: 'info'
    });
      startPreview(presetId);
  }
};

  // Handle publish
  const handlePublish = (presetId: string) => {
    setPublishDialogOpen(false);
    const published = publish(presetId, 'current-user');
    
    if (published) {
      onNotification?.({
        title: 'Branding Published',
        message: `"${published.name}" v${published.version} is now live!`,
        type: 'success'
    });
      
      onBrandingApplied?.(published);
  }
};

  // Handle export
  const handleExport = () => {
    const config = liveBranding.exportConfig();
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
    
    onNotification?.({
      title: 'Config Exported',
      message: 'Branding configuration copied to clipboard',
      type: 'success'
  });
};

  // Handle import
  const handleImport = () => {
    try {
      const config = JSON.parse(importJson);
      setBrandingProfession(config.profession || 'photographer');
      setBrandingCategory(config.projectCategory);
      setCustomBrandColor(config.customColor);
      setDarkMode(config.mode === 'dark');
      
      setImportDialogOpen(false);
      setImportJson(', ');
      
      onNotification?.({
        title: 'Config Imported',
        message: 'Branding configuration imported successfully',
        type: 'success'
    });
  } catch (error) {
      onNotification?.({
        title: 'Import Failed',
        message: 'Invalid JSON format',
        type: 'error'
    });
  }
};

  // Get status badge
  const getStatusBadge = (status: 'draft' | 'published' | 'preview') => {
    const config = {
      draft: { color: 'warning' as const, label: 'DRAFT', icon: <EditIcon sx={{ fontSize: 14 }} /> },
      published: { color: 'success' as const, label: 'PUBLISHED', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
      preview: { color: 'info' as const, label: 'PREVIEW', icon: <PreviewIcon sx={{ fontSize: 14 }} /> }
  };
    
    const { color, label, icon } = config[status];
    
    return (
      <Chip 
        size="small" 
        label={label} 
        color={color}
        icon={icon}
        sx={{ fontWeight: 600}}
      />
    );
};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Workflow State */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ color: liveBranding.color, fontFamily: liveBranding.typography.fontFamily.primary }}>
            🎨 Branding Workflow Manager
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Create, preview, and publish your brand identity
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {liveBranding.isDraft && getStatusBadge('draft')}
          {liveBranding.isPublished && getStatusBadge('published')}
          {liveBranding.isPreviewMode && getStatusBadge('preview')}
          
          {hasUnsavedChanges && (
            <Chip 
              size="small" 
              label="Unsaved Changes" 
              color="warning"
              icon={<WarningIcon sx={{ fontSize: 14 }} />}
            />
          )}
        </Box>
      </Box>

      {/* Workflow Stepper */}
      <Card sx={{ mb: 3, border: `2px solid ${liveBranding.color}20` }}>
        <CardContent>
          <Stepper activeStep={
            workflowState === 'idle' ? 0 :
            workflowState === 'editing' ? 1 :
            workflowState === 'previewing' ? 2 :
            3
        } orientation="vertical">
            <Step>
              <StepLabel>Create or Edit Branding</StepLabel>
              <StepContent>
                <Typography variant="body2" color="textSecondary">
                  Customize colors, fonts, and design tokens
                </Typography>
                <Button 
                  size="small" 
                  variant="contained" 
                  onClick={startEditing}
                  sx={{ mt: 1, bgcolor: liveBranding.color }}
                >
                  Start Editing
                </Button>
              </StepContent>
            </Step>
            
            <Step>
              <StepLabel>Save as Draft</StepLabel>
              <StepContent>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Save your changes without publishing
                </Typography>
                
                <TextField
                  fullWidth
                  size="small"
                  label="Preset Name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  sx={{ mb: 1 }}
                />
                
                <TextField
                  fullWidth
                  size="small"
                  label="Description"
                  value={presetDescription}
                  onChange={(e) => setPresetDescription(e.target.value)}
                  multiline
                  rows={2}
                  sx={{ mb: 2 }}
                />
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="contained" 
                    startIcon={<SaveIcon />}
                    onClick={handleSaveDraft}
                    disabled={!presetName}
                    sx={{ bgcolor: liveBranding.color }}
                  >
                    Save Draft
                  </Button>
                  <Button size="small" onClick={cancelEdit}>Cancel</Button>
                </Box>
              </StepContent>
            </Step>
            
            <Step>
              <StepLabel>Preview</StepLabel>
              <StepContent>
                <Typography variant="body2" color="textSecondary">
                  Test your branding before publishing
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    startIcon={<PreviewIcon />}
                    disabled={!canPreview || liveBranding.savedPresets.length === 0}
                    onClick={() => {
                      const draftPreset = liveBranding.savedPresets.find(p => p.status === 'draft');
                      if (draftPreset) {
                        handleEnterPreview(draftPreset.id);
                    }
                  }}
                  >
                    Enter Preview
                  </Button>
                  
                  {liveBranding.isPreviewMode && (
                    <Button 
                      size="small" 
                      variant="outlined" 
                      onClick={() => {
                        liveBranding.exitPreviewMode();
                        onNotification?.({
                          title: 'Preview Exited',
                          message: 'Returned to draft mode',
                          type: 'info'
                      });
                    }}
                    >
                      Exit Preview
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
            
            <Step>
              <StepLabel>Publish</StepLabel>
              <StepContent>
                <Typography variant="body2" color="textSecondary">
                  Make your branding live for all users
                </Typography>
                <Button 
                  size="small" 
                  variant="contained" 
                  color="success"
                  startIcon={<PublishIcon />}
                  disabled={!canPublish || liveBranding.savedPresets.length === 0}
                  onClick={() => setPublishDialogOpen(true)}
                  sx={{ mt: 1 }}
                >
                  Publish Branding
                </Button>
              </StepContent>
            </Step>
          </Stepper>
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mb: 2 }}>
        <Tab label="Customize" />
        <Tab label="Presets" />
        <Tab label="Preview" />
        <Tab label="History" />
      </Tabs>

      {/* Tab 1: Customization */}
      {selectedTab === 0 && (
        <Box>
          {/* Current Branding Preview */}
          <Card sx={{ mb: 3, border: `2px solid ${liveBranding.color}` }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Branding {liveBranding.isPreviewMode && '(Preview Mode)'}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="textSecondary">Name</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600}}>{liveBranding.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">Color</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 32, height: 32, bgcolor: liveBranding.color, borderRadius: 1, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{liveBranding.color}</Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">Mode</Typography>
                  <Typography variant="body2">{liveBranding.mode === 'dark' ? '🌙 Dark' : '☀️ Light'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">Version</Typography>
                  <Typography variant="body2">v{liveBranding.currentVersion}</Typography>
                </Box>
              </Box>

              {/* Accessibility Check */}
              <Alert 
                severity={contrastCheck.passes.aaa ? 'success' : contrastCheck.passes.aa ? 'info' : 'warning'}
                icon={contrastCheck.passes.aa ? <CheckCircleIcon /> : <WarningIcon />}
                sx={{ mb: 2 }}
              >
                <Typography variant="body2">
                  <strong>Accessibility:</strong> {contrastCheck.recommendation}
                </Typography>
                <Typography variant="caption">
                  Contrast Ratio: {contrastCheck.ratio}:1 
                  {contrastCheck.passes.aaa && ' (WCAG AAA)'}
                  {!contrastCheck.passes.aaa && contrastCheck.passes.aa && ' (WCAG AA)'}
                </Typography>
              </Alert>
            </CardContent>
          </Card>

          {/* Profession Selector */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                Select Profession
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {(['photographer','videographer','music_producer','vendor', 'admin'] as const).map((prof) => {
                  const profBranding = liveBranding.getProfessionBranding(prof);
                  const isSelected = brandingProfession === prof;
                  
                  return (
                    <Button
                      key={prof}
                      variant={isSelected ? 'contained' : 'outlined'}
                      onClick={() => {
                        setBrandingProfession(prof);
                        startEditing();
                    }}
                      sx={{
                        borderColor: profBranding.color,
                        color: isSelected ? '#fff' : profBranding.color,
                        bgcolor: isSelected ? profBranding.color : 'transparent', '&:hover': {
                          bgcolor: isSelected ? profBranding.color : `${profBranding.color}15`,
                          borderColor: profBranding.color
                      }
                    }}
                    >
                      {profBranding.name}
                    </Button>
                  );
              })}
              </Box>
            </CardContent>
          </Card>

          {/* Custom Color Picker */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                Custom Brand Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <input
                  type="color"
                  value={customBrandColor || liveBranding.color}
                  onChange={(e) => {
                    setCustomBrandColor(e.target.value);
                    startEditing();
                }}
                  style={{ 
                    width: 80, 
                    height: 80, 
                    border: 'none', 
                    borderRadius: 12, 
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="textSecondary">
                    Choose your custom brand color
                  </Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', color: liveBranding.color }}>
                    {customBrandColor || liveBranding.color}
                  </Typography>
                </Box>
                {customBrandColor && (
                  <Button 
                    size="small" 
                    onClick={() => setCustomBrandColor(undefined)}
                  >
                    Reset
                  </Button>
                )}
              </Box>

              {/* Dark Mode Toggle */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2">Theme Mode:</Typography>
                <Button
                  size="small"
                  variant={!darkMode ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDarkMode(false);
                    startEditing();
                }}
                  sx={{ bgcolor: !darkMode ? liveBranding.color : 'transparent' }}
                >
                  ☀️ Light
                </Button>
                <Button
                  size="small"
                  variant={darkMode ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDarkMode(true);
                    startEditing();
                }}
                  sx={{ bgcolor: darkMode ? liveBranding.color : 'transparent' }}
                >
                  🌙 Dark
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Live Component Previews */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                Live Preview - How Buttons Will Look
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Contained Buttons */}
                <Box>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    Contained Buttons
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="contained" {...liveBranding.getButtonProps('contained')}>
                      Primary Action
                    </Button>
                    <Button variant="contained" {...liveBranding.getButtonProps('contained')} disabled>
                      Disabled
                    </Button>
                    <Button variant="contained" {...liveBranding.getButtonProps('contained')} size="small">
                      Small
                    </Button>
                    <Button variant="contained" {...liveBranding.getButtonProps('contained')} size="large">
                      Large
                    </Button>
                  </Box>
                </Box>

                {/* Outlined Buttons */}
                <Box>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    Outlined Buttons
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="outlined" {...liveBranding.getButtonProps('outlined')}>
                      Secondary Action
                    </Button>
                    <Button variant="outlined" {...liveBranding.getButtonProps('outlined')} disabled>
                      Disabled
                    </Button>
                    <Button variant="outlined" {...liveBranding.getButtonProps('outlined')} size="small">
                      Small
                    </Button>
                    <Button variant="outlined" {...liveBranding.getButtonProps('outlined')} size="large">
                      Large
                    </Button>
                  </Box>
                </Box>

                {/* Text Buttons */}
                <Box>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    Text Buttons
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="text" {...liveBranding.getButtonProps('text')}>
                      Tertiary Action
                    </Button>
                    <Button variant="text" {...liveBranding.getButtonProps('text')} disabled>
                      Disabled
                    </Button>
                    <Button variant="text" {...liveBranding.getButtonProps('text')} size="small">
                      Small
                    </Button>
                    <Button variant="text" {...liveBranding.getButtonProps('text')} size="large">
                      Large
                    </Button>
                  </Box>
                </Box>

                {/* Card Preview */}
                <Box>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    Card Component
                  </Typography>
                  <Box {...liveBranding.getCardProps()} sx={{ ...liveBranding.getCardProps().sx, p: 2 }}>
                    <Typography variant="h6" {...liveBranding.getTextProps('primary')}>
                      Sample Card Title
                    </Typography>
                    <Typography variant="body2" {...liveBranding.getTextProps('secondary')}>
                      This is how your cards will look with the current branding.
                    </Typography>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button variant="contained" size="small" {...liveBranding.getButtonProps('contained')}>
                        Action
                      </Button>
                      <Button variant="outlined" size="small" {...liveBranding.getButtonProps('outlined')}>
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab 2: Saved Presets */}
      {selectedTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>Saved Presets</Typography>
          
          {liveBranding.savedPresets.length === 0 ? (
            <Alert severity="info" icon={<InfoIcon />}>
              No saved presets yet. Create one using the "Customize" tab.
            </Alert>
          ) : (
            <List>
              {liveBranding.savedPresets.map((preset) => {
                const status = liveBranding.getPresetStatus(preset.id);
                
                return (
                  <Card key={preset.id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6">{preset.name}</Typography>
                            {getStatusBadge(preset.status)}
                            <Chip 
                              size="small" 
                              label={`v${preset.version}`} 
                              variant="outlined"
                            />
                          </Box>
                          <Typography variant="body2" color="textSecondary">
                            {preset.description}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
                            Updated: {new Date(preset.updatedAt).toLocaleString()}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Load Preset">
                            <IconButton 
                              size="small"
                              onClick={() => {
                                liveBranding.loadPreset(preset.id);
                                onNotification?.({
                                  title: 'Preset Loaded',
                                  message: `Loaded "${preset.name}"`,
                                  type: 'success'
                              });
                            }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          {preset.status === 'draft' && (
                            <Tooltip title="Preview">
                              <IconButton 
                                size="small"
                                color="info"
                                onClick={() => handleEnterPreview(preset.id)}
                              >
                                <PreviewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {(preset.status === 'draft' || preset.status === 'preview') && (
                            <Tooltip title="Publish">
                              <IconButton 
                                size="small"
                                color="success"
                                onClick={() => {
                                  setPublishDialogOpen(true);
                                  liveBranding.loadPreset(preset.id);
                              }}
                              >
                                <PublishIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small"
                              color="error"
                              onClick={() => {
                                setConfirmDeletePreset({ id: preset.id, name: preset.name });
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      {/* Color Swatch */}
                      <Box sx={{ 
                        mt: 2, 
                        p: 2, 
                        bgcolor: preset.customColor || '#1976d2',
                        borderRadius: 1,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>
                          {preset.profession || 'Custom'} Brand
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {preset.customColor || '#1976d2'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                );
            })}
            </List>
          )}
        </Box>
      )}

      {/* Tab 3: Preview Mode */}
      {selectedTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>Preview Mode</Typography>
          
          {liveBranding.isPreviewMode ? (
            <Alert severity="info" icon={<PreviewIcon />} sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Preview Mode Active</strong> - You're viewing how the branding will look before publishing.
              </Typography>
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Preview mode not active. Select a draft preset to preview.
            </Alert>
          )}

          {/* Preview Instructions */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600}}>
                How Preview Mode Works
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="1. Save your branding as a draft"
                    secondary="Create a draft preset with your custom colors and settings"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="2. Enter preview mode"
                    secondary="Click the preview button to see how it looks"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="3. Test on all components"
                    secondary="Navigate through your app to see branding applied everywhere"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="4. Publish when ready"
                    secondary="Make your branding live for all users"
                  />
                </ListItem>
              </List>

              {liveBranding.isPreviewMode && (
                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => {
                      liveBranding.exitPreviewMode();
                      onNotification?.({
                        title: 'Preview Exited',
                        message: 'Returned to draft mode',
                        type: 'info'
                    });
                  }}
                  >
                    Exit Preview
                  </Button>
                  <Button 
                    variant="contained" 
                    color="success"
                    startIcon={<PublishIcon />}
                    onClick={() => setPublishDialogOpen(true)}
                  >
                    Publish This Version
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab 4: Version History */}
      {selectedTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>Version History</Typography>
          
          {liveBranding.brandingHistory.length === 0 ? (
            <Alert severity="info">
              No version history yet. Publish a preset to start tracking versions.
            </Alert>
          ) : (
            <List>
              {liveBranding.brandingHistory.map((version) => (
                <Card key={version.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          Version {version.version}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {version.notes || 'No notes'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {new Date(version.createdAt).toLocaleString()} by {version.createdBy}
                        </Typography>
                      </Box>
                      
                      <Box>
                        <Chip 
                          size="small" 
                          label={version.status.toUpperCase()} 
                          color={version.status === 'published' ? 'success' : 'default'}
                        />
                      </Box>
                    </Box>

                    {version.status === 'archived' && (
                      <Button
                        size="small"
                        startIcon={<HistoryIcon />}
                        onClick={() => {
                          const reverted = liveBranding.revertToVersion(version.id);
                          if (reverted) {
                            onNotification?.({
                              title: 'Version Restored',
                              message: `Reverted to version ${version.version}`,
                              type: 'success'
                          });
                        }
                      }}
                        sx={{ mt: 1 }}
                      >
                        Revert to This Version
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </List>
          )}
        </Box>
      )}

      {/* Quick Actions Bar */}
      <Card sx={{ mt: 3, bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>Quick Actions</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
            >
              Export Config
            </Button>
            
            <Button
              size="small"
              startIcon={<UploadIcon />}
              onClick={() => setImportDialogOpen(true)}
            >
              Import Config
            </Button>
            
            <Button
              size="small"
              startIcon={<HistoryIcon />}
              onClick={() => setVersionHistoryOpen(true)}
            >
              View History
            </Button>
            
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setBrandingProfession('photographer');
                setBrandingCategory(undefined);
                setCustomBrandColor(undefined);
                setDarkMode(false);
            }}
            >
              Reset All
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Publish Confirmation Dialog */}
      <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'success.main', color: 'white' }}>
          <PublishIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Publish Branding
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Publishing will make these branding changes live for all users. This action cannot be undone.
            </Typography>
          </Alert>

          <Typography variant="subtitle2" gutterBottom>What will be published:</Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Brand Name" 
                secondary={liveBranding.name}
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Primary Color" 
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 20, height: 20, bgcolor: liveBranding.color, borderRadius: 0.5 }} />
                    <span>{liveBranding.color}</span>
                  </Box>
              }
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Mode" 
                secondary={liveBranding.mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Version" 
                secondary={`v${liveBranding.currentVersion} → v${liveBranding.currentVersion + 1}`}
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success"
            startIcon={<PublishIcon />}
            onClick={() => {
              const draftPreset = liveBranding.savedPresets.find(p => p.status === 'draft' || p.status === 'preview');
              if (draftPreset) {
                handlePublish(draftPreset.id);
            }
          }}
          >
            Publish Now
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Config Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Branding Config</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={10}
            label="Paste JSON Config"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            sx={{ mt: 1, fontFamily: 'monospace', fontSize: 12 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            startIcon={<UploadIcon />}
            onClick={handleImport}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Preset Dialog */}
      <Dialog
        open={!!confirmDeletePreset}
        onClose={() => setConfirmDeletePreset(null)}
      >
        <DialogTitle>Delete Preset</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete preset "{confirmDeletePreset?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeletePreset(null)}>Cancel</Button>
          <Button
            onClick={() => {
              if (confirmDeletePreset) {
                liveBranding.deletePreset(confirmDeletePreset.id);
                onNotification?.({
                  title: 'Preset Deleted',
                  message: `Deleted "${confirmDeletePreset.name}"`,
                  type: 'info'
                });
                setConfirmDeletePreset(null);
              }
            }}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BrandingWorkflowPanel;





