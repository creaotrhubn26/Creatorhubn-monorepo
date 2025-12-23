/**
 * Onboarding Experience Editor
 *
 * Tries admin endpoints first:
 * - GET /api/community/admin/onboarding
 * - PUT /api/community/admin/onboarding/:id
 *
 * Falls back to read-only viewer using:
 * - GET /api/community/onboarding/:profession
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Paper,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  DragIndicator,
  PlayCircle,
  Image,
  TextFields,
  CheckCircle,
  Visibility,
  Save,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content_type: 'text' | 'video' | 'image' | 'checklist';
  content: any;
  position: number;
  is_required: boolean;
  profession_type: string | null;
}

interface OnboardingConfig {
  id: string;
  profession_type: string;
  welcome_title: string;
  welcome_message: string;
  welcome_video_url: string | null;
  steps: OnboardingStep[];
  completion_message: string;
  completion_cta_text: string;
  completion_cta_url: string;
  is_active: boolean;
}

export default function OnboardingEditor() {
  const [configs, setConfigs] = useState<OnboardingConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<OnboardingConfig | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<OnboardingStep | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [adminSupported, setAdminSupported] = useState<boolean | null>(null);

  const [stepFormData, setStepFormData] = useState({
    title:  ',',
    description: '',
    content_type: 'text' as 'text' | 'video' | 'image' | 'checklist',
    content: {},
    is_required: true,
    profession_type: null as string | null,
  });

  useEffect(() => {
    fetchOnboardingConfigs();
  }, []);

  const fetchOnboardingConfigs = async () => {
    try {
      const response = await apiRequest('/api/community/admin/onboarding,', {
        method: 'GET',
      }) as { success: boolean; configs: OnboardingConfig[] };

      if (response.success && response.configs?.length) {
        setConfigs(response.configs);
        setSelectedConfig(response.configs[0]);
        setReadOnly(false);
        setAdminSupported(true);
        return;
      }
    } catch (error) {
      console.warn('Admin onboarding endpoint unavailable, falling back to read-only viewer.');
    }

    // Fallback: use user-facing endpoint for each profession
    const professions = ['photographer','videographer','music_producer'];
    const results: OnboardingConfig[] = [];
    for (const profession of professions) {
      try {
        const resp = await apiRequest(`/api/community/onboarding/${profession}`, {
          method: 'GET',
        }) as { success: boolean; config: any };
        if (resp.success && resp.config) {
          results.push({ ...resp.config, steps: resp.config.steps || [], profession_type: profession });
        }
      } catch (e) {
        // ignore
      }
    }
    setConfigs(results);
    setSelectedConfig(results[0] || null);
    setReadOnly(true);
    setAdminSupported(false);
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig || readOnly) return;

    try {
      const response = await apiRequest(`/api/community/admin/onboarding/${selectedConfig.id}`, {
        method: 'PUT',
        body: JSON.stringify(selectedConfig),
      }) as { success: boolean; message: string };

      if (response.success) {
        alert(response.message);
        fetchOnboardingConfigs();
      }
    } catch (error) {
      console.error('Error saving config: ', error);
      alert('Failed to save onboarding configuration');
    }
  };

  const handleAddStep = () => {
    setEditingStep(null);
    setStepFormData({
      title: '',
      description: ', ',
      content_type: 'text',
      content: {},
      is_required: true,
      profession_type: null,
    });
    setStepDialogOpen(true);
  };

  const handleEditStep = (step: OnboardingStep) => {
    setEditingStep(step);
    setStepFormData({
      title: step.title,
      description: step.description,
      content_type: step.content_type,
      content: step.content,
      is_required: step.is_required,
      profession_type: step.profession_type,
    });
    setStepDialogOpen(true);
  };

  const handleSaveStep = () => {
    if (!selectedConfig) return;

    const newStep: OnboardingStep = {
      id: editingStep?.id || `step_${Date.now()}`,
      ...stepFormData,
      position: editingStep?.position || selectedConfig.steps.length,
    };

    const updatedSteps = editingStep
      ? selectedConfig.steps.map((s) => (s.id === editingStep.id ? newStep : s))
      : [...selectedConfig.steps, newStep];

    setSelectedConfig({
      ...selectedConfig,
      steps: updatedSteps,
    });

    setStepDialogOpen(false);
  };

  const handleDeleteStep = (stepId: string) => {
    if (!selectedConfig || readOnly) return;
    if (!confirm('Delete this step?')) return;

    setSelectedConfig({
      ...selectedConfig,
      steps: selectedConfig.steps.filter((s) => s.id !== stepId),
    });
  };

  const professionTypes = [
    { value: 'photographer', label: 'Photographer', icon: '📷' },
    { value: 'videographer', label: 'Videographer', icon: '🎥' },
    { value: 'music_producer', label: 'Music Producer', icon: '🎵' },
  ];

  if (!selectedConfig) {
    return (
      <Alert severity="info">
        No onboarding configurations found.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayCircle /> Onboarding Experience Editor
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {adminSupported === false && (
            <Chip color="info" label="Admin endpoint missing (read-only fallback)" />
          )}
          {adminSupported === true && <Chip color="success" label="Admin endpoint available" />}
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={() => setPreviewOpen(true)}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={handleSaveConfig}
            disabled={readOnly}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Select Profession
          </Typography>
          <Grid container spacing={2}>
            {professionTypes.map((type) => (
              <Grid item key={type.value}>
                <Chip
                  label={`${type.icon} ${type.label}`}
                  onClick={() => {
                    const config = configs.find((c) => c.profession_type === type.value);
                    if (config) setSelectedConfig(config);
                  }}
                  color={selectedConfig.profession_type === type.value ? 'primary' : 'default'}
                  sx={{
                    fontSize: '1rem',
                    py: 2.5,
                    px: 2,
                    cursor: 'pointer'}}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Welcome Screen
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Welcome title"
                value={selectedConfig.welcome_title}
                onChange={(e) =>
                  setSelectedConfig({ ...selectedConfig, welcome_title: e.target.value })
                }
                fullWidth
                disabled={readOnly}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Welcome video URL (optional)"
                value={selectedConfig.welcome_video_url || ', '}
                onChange={(e) =>
                  setSelectedConfig({ ...selectedConfig, welcome_video_url: e.target.value })
                }
                fullWidth
                disabled={readOnly}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Welcome message"
                value={selectedConfig.welcome_message}
                onChange={(e) =>
                  setSelectedConfig({ ...selectedConfig, welcome_message: e.target.value })
                }
                fullWidth
                multiline
                rows={3}
                disabled={readOnly}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Completion
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Completion message"
                value={selectedConfig.completion_message}
                onChange={(e) =>
                  setSelectedConfig({ ...selectedConfig, completion_message: e.target.value })
                }
                fullWidth
                multiline
                rows={2}
                disabled={readOnly}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="CTA text"
                value={selectedConfig.completion_cta_text}
                onChange={(e) =>
                  setSelectedConfig({ ...selectedConfig, completion_cta_text: e.target.value })
                }
                fullWidth
                disabled={readOnly}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="CTA URL"
                value={selectedConfig.completion_cta_url}
                onChange={(e) =>
                  setSelectedConfig({ ...selectedConfig, completion_cta_url: e.target.value })
                }
                fullWidth
                disabled={readOnly}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedConfig.is_active}
                    onChange={(e) =>
                      setSelectedConfig({ ...selectedConfig, is_active: e.target.checked })
                    }
                    disabled={readOnly}
                  />
                }
                label="Active onboarding"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Steps</Typography>
            <Button startIcon={<Add />} onClick={handleAddStep} variant="contained" disabled={readOnly}>
              Add step
            </Button>
          </Box>

          <List>
            {selectedConfig.steps
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((step, index) => (
                <ListItem key={step.id} divider alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DragIndicator fontSize="small" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          {index + 1}. {step.title}
                        </Typography>
                        {step.is_required && <Chip size="small" label="Required" color="primary" />}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {step.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Type: {step.content_type} • Profession:{', '}
                          {step.profession_type || 'All'}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleEditStep(step)} disabled={readOnly}>
                      <Edit />
                    </IconButton>
                    <IconButton edge="end" color="error" onClick={() => handleDeleteStep(step.id)} disabled={readOnly}>
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            {selectedConfig.steps.length === 0 && (
              <ListItem>
                <ListItemText primary="No steps yet. Add your first step to start the flow." />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>

      <Dialog open={stepDialogOpen} onClose={() => setStepDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingStep ? 'Edit step' : 'Add step'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              value={stepFormData.title}
              onChange={(e) => setStepFormData({ ...stepFormData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={stepFormData.description}
              onChange={(e) =>
                setStepFormData({ ...stepFormData, description: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              select
              label="Content type"
              value={stepFormData.content_type}
              onChange={(e) =>
                setStepFormData({
                  ...stepFormData,
                  content_type: e.target.value as OnboardingStep['content_type'],
                  content: {},
                })
              }
              fullWidth
            >
              <MenuItem value="text">
                <TextFields fontSize="small" sx={{ mr: 1 }} />
                Text
              </MenuItem>
              <MenuItem value="video">
                <PlayCircle fontSize="small" sx={{ mr: 1 }} />
                Video
              </MenuItem>
              <MenuItem value="image">
                <Image fontSize="small" sx={{ mr: 1 }} />
                Image
              </MenuItem>
              <MenuItem value="checklist">
                <CheckCircle fontSize="small" sx={{ mr: 1 }} />
                Checklist
              </MenuItem>
            </TextField>

            {stepFormData.content_type === 'text' && (
              <TextField
                label="Text content"
                value={(stepFormData.content as any).text || ', '}
                onChange={(e) =>
                  setStepFormData({
                    ...stepFormData,
                    content: { ...(stepFormData.content || {}), text: e.target.value },
                  })
                }
                fullWidth
                multiline
                rows={3}
              />
            )}
            {stepFormData.content_type === 'video' && (
              <TextField
                label="Video URL"
                value={(stepFormData.content as any).url || ', '}
                onChange={(e) =>
                  setStepFormData({
                    ...stepFormData,
                    content: { ...(stepFormData.content || {}), url: e.target.value },
                  })
                }
                fullWidth
              />
            )}
            {stepFormData.content_type === 'image' && (
              <TextField
                label="Image URL"
                value={(stepFormData.content as any).url || ', '}
                onChange={(e) =>
                  setStepFormData({
                    ...stepFormData,
                    content: { ...(stepFormData.content || {}), url: e.target.value },
                  })
                }
                fullWidth
              />
            )}
            {stepFormData.content_type === 'checklist' && (
              <TextField
                label="Checklist items (one per line)"
                value={(stepFormData.content as any).items?.join('\n') || ', '}
                onChange={(e) =>
                  setStepFormData({
                    ...stepFormData,
                    content: { items: e.target.value.split('\n').filter(Boolean) },
                  })
                }
                fullWidth
                multiline
                rows={3}
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={stepFormData.is_required}
                  onChange={(e) =>
                    setStepFormData({ ...stepFormData, is_required: e.target.checked })
                  }
                />
              }
              label="Required step"
            />

            <TextField
              select
              label="Profession (optional)"
              value={stepFormData.profession_type || ''}
              onChange={(e) =>
                setStepFormData({
                  ...stepFormData,
                  profession_type: e.target.value || null,
                })
              }
              fullWidth
              helperText="Leave blank for all professions"
            >
              <MenuItem value="">All</MenuItem>
              {professionTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStepDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveStep} disabled={readOnly}>
            {editingStep ? 'Update step' : 'Add step'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Onboarding preview - {selectedConfig.profession_type}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="h6">{selectedConfig.welcome_title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {selectedConfig.welcome_message}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Steps ({selectedConfig.steps.length})
          </Typography>
          <List dense>
            {selectedConfig.steps
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((step) => (
                <ListItem key={step.id}>
                  <ListItemText
                    primary={step.title}
                    secondary={`${step.content_type} • ${step.is_required ? 'Required' : 'Optional'}`}
                  />
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
