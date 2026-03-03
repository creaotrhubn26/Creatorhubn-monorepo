import React, { useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Chip, Grid, Stack, Typography } from '@mui/material';
import { CameraAlt, Save, Settings } from '@mui/icons-material';
import CameraTemplateSidebar from '../camera/CameraTemplateSidebar';
import { useCameraTemplateSidebar } from '../../hooks/useCameraTemplateSidebar';
import type { CameraTemplate } from '../../data/camera-templates';
import { useTheming } from '../../utils/theming-helper';

export const CameraTemplateIntegrationExample: React.FC = () => {
  const theming = useTheming('photographer');

  const [projectType] = useState('wedding');
  const [culture] = useState('norsk');
  const [profession] = useState('both');
  const [savedTemplates, setSavedTemplates] = useState<CameraTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<CameraTemplate | null>(null);

  const {
    isOpen,
    openSidebar,
    closeSidebar,
    selectedTemplate,
    onTemplateSelect,
    onTemplateSave,
  } = useCameraTemplateSidebar(
    (template) => {
      setCurrentTemplate(template);
    },
    (template) => {
      setSavedTemplates((prev) => {
        if (prev.some((t) => t.id === template.id)) return prev;
        return [...prev, template];
      });
    }
  );

  const totalCameraCount = useMemo(() => {
    if (!currentTemplate) return 0;
    return (
      1 +
      (currentTemplate.backupCamera ? 1 : 0) +
      (currentTemplate.additionalCameras?.length ?? 0)
    );
  }, [currentTemplate]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
          Camera Template Integration Example
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Settings />} onClick={openSidebar}>
            Open Template Sidebar
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => selectedTemplate && onTemplateSave(selectedTemplate)}
            disabled={!selectedTemplate}
          >
            Save Selected Template
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Project Setup
              </Typography>
              {currentTemplate ? (
                <Stack spacing={1.5}>
                  <Typography variant="body2">
                    <strong>Template:</strong> {currentTemplate.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Description:</strong> {currentTemplate.description}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Category:</strong> {currentTemplate.category}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total Cameras:</strong> {totalCameraCount}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(currentTemplate.tags ?? []).map((tag) => (
                      <Chip key={tag} label={tag} size="small" />
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Typography color="text.secondary">
                  No template selected yet. Click "Open Template Sidebar" to pick one.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Saved Templates ({savedTemplates.length})
              </Typography>
              {savedTemplates.length === 0 ? (
                <Typography color="text.secondary">No saved templates in this session.</Typography>
              ) : (
                <Stack spacing={1}>
                  {savedTemplates.map((template) => (
                    <Button
                      key={template.id}
                      variant="text"
                      startIcon={<CameraAlt />}
                      onClick={() => {
                        setCurrentTemplate(template);
                        onTemplateSelect(template);
                      }}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {template.name}
                    </Button>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <CameraTemplateSidebar
        open={isOpen}
        onClose={closeSidebar}
        onTemplateSelect={onTemplateSelect}
        onTemplateSave={onTemplateSave}
        selectedTemplateId={selectedTemplate?.id}
        projectType={projectType}
        culture={culture}
        profession={profession}
      />
    </Box>
  );
};

export default CameraTemplateIntegrationExample;
