import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Paper
} from '@mui/material';
import {
  CameraAlt,
  Videocam,
  PhotoCamera,
  Settings,
  Save,
  Add,
  Edit,
  Delete
} from '@mui/icons-material';
import CameraTemplateSidebar from '../camera/CameraTemplateSidebar';
import { useCameraTemplateSidebar } from '../../hooks/useCameraTemplateSidebar';
import { CameraTemplate } from '../../data/camera-templates';
import { Camera } from '../../data/video-camera-database';
import { PhotoCamera as PhotoCameraType } from '../../data/photo-camera-database';

/**
 * Example showing how to integrate Camera Template Sidebar
 * into project creation or camera selection workflows
 */
export const CameraTemplateIntegrationExample: React.FC = () => {
  const [projectType] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');'wedding');
  const [culture] = useState('norsk');
  const [profession] = useState('both');
  const [savedTemplates, setSavedTemplates] = useState<CameraTemplate[]>([]);
  const [currentSetup, setCurrentSetup] = useState<{
    primaryCamera?: { video?: Camera; photo?: PhotoCameraType };
    backupCamera?: { video?: Camera; photo?: PhotoCameraType };
    additionalCameras?: Array<{ video?: Camera; photo?: PhotoCameraType; role: string }>;
}>({});

  const {
    isOpen,
    openSidebar,
    closeSidebar,
    selectedTemplate,
    onTemplateSelect,
    onTemplateSave
} = useCameraTemplateSidebar(
    (template) => {
      console.log('Template selected: ', template);
      // Apply template to current setup
      setCurrentSetup({
        primaryCamera: template.primaryCamera,
        backupCamera: template.backupCamera,
        additionalCameras: template.additionalCameras
    ,});
  },
    (template) => {
      console.log('Template saved:', template);
      setSavedTemplates(prev => [...prev, template]);
  }
  );

  const handleSaveCurrentSetup = () => {
    // This would save the current camera setup as a new template
    console.log('Saving current setup as template...');
};

  const renderCameraSetup = () => (
    <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Current Camera Setup
      </Typography>
      
      {currentSetup.primaryCamera?.video && (
        <Box sx={{ mb:  2 }}>
          <Typography variant="subtitle2" color="primary">
            Primary Video Camera
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt:  1 }}>
            <Videocam sx={{ mr:  1 }} />
            <Typography>
              {currentSetup.primaryCamera.video.brand} {currentSetup.primaryCamera.video.model}
            </Typography>
            {currentSetup.primaryCamera.video.logFormats && (
              <Chip 
                label={`LOG: ${currentSetup.primaryCamera.video.logFormats.join(', ')}`} 
                size="small" 
                sx={{ ml:  1 }}
                color="primary"
              />
            )}
          </Box>
        </Box>
      )}

      {currentSetup.primaryCamera?.photo && (
        <Box sx={{ mb:  2 }}>
          <Typography variant="subtitle2" color="secondary">
            Primary Photo Camera
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt:  1 }}>
            <PhotoCamera sx={{ mr:  1 }} />
            <Typography>
              {currentSetup.primaryCamera.photo.brand} {currentSetup.primaryCamera.photo.model}
            </Typography>
          </Box>
        </Box>
      )}

      {currentSetup.backupCamera?.video && (
        <Box sx={{ mb:  2 }}>
          <Typography variant="subtitle2" color="primary">
            Backup Video Camera
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt:  1 }}>
            <Videocam sx={{ mr:  1 }} />
            <Typography>
              {currentSetup.backupCamera.video.brand} {currentSetup.backupCamera.video.model}
            </Typography>
          </Box>
        </Box>
      )}

      {currentSetup.additionalCameras && currentSetup.additionalCameras.length > 0 && (
        <Box>
          <Typography variant="subtitle2">
            Additional Cameras ({currentSetup.additionalCameras.length})
          </Typography>
          {currentSetup.additionalCameras.map((camera, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', mt:  1 }}>
              <CameraAlt sx={{ mr:  1 }} />
              <Typography>
                {camera.video ? `${camera.video.brand} ${camera.video.model}` : 
                 camera.photo ? `${camera.photo.brand} ${camera.photo.model}` : 'Unknown Camera'}
              </Typography>
              <Chip label={camera.role} size="small" sx={{ ml:  1 }} />
            </Box>
          ))}
        </Box>
      )}

      {Object.keys(currentSetup).length === 0 && (
        <Alert severity="info">
          No camera setup selected. Choose a template or create a custom setup.
        </Alert>
      )}
    </Paper>
  );

  const renderSavedTemplates = () => (
    <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
        Saved Templates ({savedTemplates.length})
      </Typography>
      
      {savedTemplates.length === 0 ? (
        <Alert severity="info">
          No saved templates yet. Create your first template!
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {savedTemplates.map((template) => (
            <Grid item xs={12} sm={6} key={template.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                    {template.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0,mb:  1 }}>
                    <Chip label={template.category} size="small" color="primary" />
                    <Chip label={template.profession} size="small" color="secondary" />
                    {template.culture && (
                      <Chip label={template.culture} size="small" color="info" />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems:'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Used {template.usageCount} times
                    </Typography>
                    <Box>
                      <Tooltip title="Use Template">
                        <IconButton 
                          size="small"
                          onClick={() => onTemplateSelect(template)}
                        >
                          {theming.getThemedIcon('settings')}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small">
                          {theming.getThemedIcon('edit')}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small">
                          {theming.getThemedIcon('delete')}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Paper>
  );

  return (
    <Box sx={{ p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        📸 Camera Template Integration Example
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb:  3 }}>
        This example shows how to integrate the Camera Template Sidebar into your project workflow.
        Click the buttons below to see the sidebar in action.
      </Typography>

      {/* Action Buttons */}
      <Box sx={{ mb:  3 }}>
        <Button variant="contained"
          startIcon={<CameraAlt />}
          onClick={openSidebar}
          sx={{ mr:  2 }}
        >
          Choose Camera Template
        </Button>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('add')}
          onClick={openSidebar}
          sx={{ mr:  2 }}
        >
          Create New Template
        </Button>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('save')}
          onClick={handleSaveCurrentSetup}
          disabled={Object.keys(currentSetup).length === 0}
        >
          Save Current Setup
        </Button>
      </Box>

      {/* Current Setup Display */}
      {renderCameraSetup()}

      {/* Saved Templates Display */}
      {renderSavedTemplates()}

      {/* Camera Template Sidebar */}
      <CameraTemplateSidebar
        open={isOpen}
        onClose={closeSidebar}
        onTemplateSelect={onTemplateSelect}
        onTemplateSave={onTemplateSave}
        selectedTemplateId={selectedTemplate?.id}
        projectType={projectType}
        culture={culture}
        profession={profession}
        width={450}
        position="right"
      />
    </Box>
  );
};

export default CameraTemplateIntegrationExample;














