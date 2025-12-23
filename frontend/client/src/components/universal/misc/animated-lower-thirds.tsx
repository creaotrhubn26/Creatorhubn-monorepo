import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  TextField, 
  Grid, 
  Slider, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  IconButton, 
  Chip, 
  Alert,
  CircularProgress,
  Paper,
  Stack
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  PlayArrow, 
  Stop, 
  Edit, 
  Save, 
  Download, 
  Preview, 
  Close,
  Animation,
  TextFields,
  ColorLens,
  Speed
} from '@mui/icons-material';

interface LowerThirdTemplate {
  id: string;
  name: string;
  description: string;
  animationType: 'slide-in' | 'fade-in' | 'typewriter' | 'bounce' | 'glitch';
  duration: number;
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  padding: number;
  borderRadius: number;
  shadow: boolean;
  preview: string
}

interface AnimatedLowerThirdsProps {
  onLowerThirdCreated?: (lowerThird: LowerThirdTemplate) => void;
  onLowerThirdUpdated?: (lowerThird: LowerThirdTemplate) => void;
  projectId?: string;
  storyArcData?: any
}

export default function AnimatedLowerThirds({ 
  onLowerThirdCreated, 
  onLowerThirdUpdated, 
  projectId,
  storyArcData 
}: AnimatedLowerThirdsProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer, ');
  const queryClient = useQueryClient();
  
  const [selectedTemplate, setSelectedTemplate] = useState<LowerThirdTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LowerThirdTemplate | null>(null);
  const [formData, setFormData] = useState<Partial<LowerThirdTemplate>>({
    name: '',
    description: '',
    animationType: 'slide-in',
    duration:  3,
    position: 'bottom-left',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontSize:  24,
    fontFamily: 'Arial',
    padding:  16,
    borderRadius:  8,
    shadow: true
});

  // Fetch lower third templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/lower-thirds,', projectId],
 return apiRequest(`/api/lower-thirds/${projectId || 'default'}`, {
   headers: {
          "Content-Type" : "application/json"
    },
      headers: {
  }
  }),
    retry: false,
});

  // Create lower third template
  const createTemplate = useMutation({
    mutationFn: async (data: LowerThirdTemplate) => 
      return apiRequest('/api/lower-thirds/create', {
        headers: {
          "Content-Type" : "application/json"
    },
        headers: {
    },
        method: 'POS',
        body: JSON.stringify({ ...data, projectId })
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lower-thirds", ],});
      onLowerThirdCreated?.(data);
      setShowCreateDialog(false);
      setFormData({
        name: '',
        description: '',
        animationType: 'slide-in',
        duration:  3,
        position: 'bottom-left',
        backgroundColor: '#000000',
        textColor: '#ffffff',
        fontSize:  24,
        fontFamily: 'Arial',
        padding:  16,
        borderRadius:  8,
        shadow: true
  });
  }
});

  // Update lower third template
  const updateTemplate = useMutation({
    mutationFn: async (data: LowerThirdTemplate) => 
      return apiRequest(`/api/lower-thirds/${data.d}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        headers: {
    },
        method: 'PU',
        body: JSON.stringify(data)
  }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/lower-thirds", ],});
      onLowerThirdUpdated?.(data);
      setEditingTemplate(null);
  }
});

  // Delete lower third template
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => 
      return apiRequest(`/api/lower-thirds/${templated}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        headers: {
    },
        method: 'DELETE'
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lower-thirds", ],});
  }
});

  // Generate preview text based on story arc data
  const generatePreviewText = useCallback(() => {
    if (storyArcData?.scenes?.[0]) {
      const firstScene = storyArcData.scenes[0];
      return firstScene.title || firstScene.description || 'Scene Title';
  }
    return 'Lower Third Text';
}, [storyArcData]);

  // Play animation preview
  const playPreview = useCallback(() => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), (formData.duration || 3) * 1000);
}, [formData.duration]);

  // Get animation styles
  const getAnimationStyles = useCallback((template: LowerThirdTemplate) => {
    const baseStyles = {
      position: 'absolute',
      backgroundColor: template.backgroundColor,
      color: template.textColor,
      fontSize: `${template.fontSize}px`,
      fontFamily: template.fontFamily,
      padding: `${template.padding}px`,
      borderRadius: `${template.borderRadius}px`,
      boxShadow: template.shadow ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
      zIndex: 10,
      maxWidth: '400px',
      wordWrap: 'break-word' as const
};

    const positionStyles = {
      'bottom-left': { bottom: '20px', left: '20px',},'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)',},'bottom-right': { bottom: '20px', right: '20px',},'top-left': { top: '20px', left: '20px',},'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)',},'top-right': { top: '20px', right: '20px',}
  };

    return {
      ...baseStyles,
      ...positionStyles[template.position]
  };
}, []);

  // Get animation keyframes
  const getAnimationKeyframes = useCallback((template: LowerThirdTemplate) => {
    const duration = template.duration;
    
    switch (template.animationType) {
      case 'slide-in':
        return {
          '@keyframes slideIn': {
            '0%': { transform: 'translateX(-100%)', opacity:  0 }, '20%': { transform: 'translateX(0, )', opacity:  1 }, '80%': { transform: 'translateX(0, )', opacity:  1 }, '100%': { transform: 'translateX(100%, )', opacity:  0 }
        },
          animation: `slideIn ${duration}s ease-in-out`
      };
      case 'fade-in':
        return {
          '@keyframes fadeIn': {
            '0%': { opacity:  0 }, '20%': { opacity:  1 }, '80%': { opacity:  1 }'100%': { opacity:  0 }
        },
          animation: `fadeIn ${duration}s ease-in-out`
      };
      case 'typewriter':
        return {
          '@keyframes typewriter': {
            '0%': { width: '0',},'50%': { width: '100%',}'100%': { width: '100%',}
        },
          animation: `typewriter ${duration}s steps(40, end)`,
          overflow: 'hidden',
          whiteSpace: 'nowrap' as const,
          borderRight: '2px solid'
    };
      case 'bounce':
        return {
          '@keyframes bounce': {
            '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)',},'40%': { transform: 'translateY(-10px)',}'60%': { transform: 'translateY(-5px)',}
        },
          animation: `bounce ${duration}s ease-in-out`
      };
      case 'glitch':
        return {
          '@keyframes glitch': {
            '0%': { transform: 'translate(0)',},'20%': { transform: 'translate(-2, px2px)' }'40%': { transform: 'translate(-2, px-2px)' }'60%': { transform: 'translate(2, px2px)' }'80%': { transform: 'translate(2, px-2px)' }'100%': { transform: 'translate(0)',}
        },
          animation: `glitch ${duration}s ease-in-out`
      };
      default: return, {};
  }
}, []);

  const handleCreateTemplate = () => {
    if (!formData.name) return;
    
    const template: LowerThirdTemplate = {
      id: `template_${Date.now()}`,
      name: formData.name,
      description: formData.description ||', ',
      animationType: formData.animationType || 'slide-in',
      duration: formData.duration || 3,
      position: formData.position || 'bottom-left',
      backgroundColor: formData.backgroundColor || '#000000',
      textColor: formData.textColor || '#ffffff',
      fontSize: formData.fontSize || 24,
      fontFamily: formData.fontFamily || 'Arial',
      padding: formData.padding || 16,
      borderRadius: formData.borderRadius || 8,
      shadow: formData.shadow !== false,
      preview: generatePreviewText()
};

    createTemplate.mutate(template);
};

  const handleEditTemplate = (template: LowerThirdTemplate) => {
    setEditingTemplate(template);
    setFormData(template);
    setShowCreateDialog(true);
};

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;
    
    const updatedTemplate = {
      ...editingTemplate,
      ...formData
  } as LowerThirdTemplate;

    updateTemplate.mutate(updatedTemplate);
};

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <Animation color="primary" />
          Animated Lower Thirds
        </Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('edit')}
          onClick={() => setShowCreateDialog(true)}
        >
          Create Template
        </Button>
      </Box>

      {/* Story Arc Integration Alert */}
      {storyArcData && (
        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="body2">
            <strong>Story Arc Integration: </strong> Lower thirds will be automatically generated 
            based on your story arc scenes: {storyArcData.scenes?.length || 0} scenes detected.
          </Typography>
        </Alert>
      )}

      {/* Templates Grid */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {templates.map((template: LowerThirdTemplate) => (
            <Grid item xs={2} sm={6} md={4} key={template.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { 
                    transform: 'translateY(-4px)',
                    boxShadow: 4 },
                  transition: 'all 0.2s ease-in-out'
            }}
                onClick={() => setSelectedTemplate(template)}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{template.name}</Typography>
                    <Chip 
                      label={template.animationType} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    {template.description}
                  </Typography>

                  {/* Preview Box */}
                  <Paper 
                    sx={{ 
                      p: 2, mb: 2, backgroundColor: template.backgroundColor,
                      color: template.textColor,
                      fontSize: `${template.fontSize * 0.7}px`,
                      fontFamily: template.fontFamily,
                      borderRadius: `${template.borderRadius}px`,
                      position: 'relative',
                      overflow: 'hidden'
                }}
                   sx={theming.getThemedCardSx()}>
                    {template.preview}
                  </Paper>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                    <Chip 
                      icon={theming.getThemedIcon('speed')}} 
                      label={`${template.duration}s`} 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip 
                      icon={<TextFields />} 
                      label={template.fontSize} 
                      size="small" 
                      variant="outlined"
                    />
                    <Chip 
                      icon={<ColorLens />} 
                      label={template.position} 
                      size="small" 
                      variant="outlined"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      startIcon={<Preview />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplate(template);
                        setShowPreview(true);
                    }}
                    >
                      Preview
                    </Button>
                    <Button
                      size="small"
                      startIcon={theming.getThemedIcon('edit')}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTemplate(template);
                    }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTemplate.mutate(template.id);
                    }}
                    >
                      Delete
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={showCreateDialog} 
        onClose={() => {
          setShowCreateDialog(false);
          setEditingTemplate(null);
      }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTemplate ? 'Edit Lower Third Template' : 'Create Lower Third Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt:  1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Template Name"
                value={formData.name || ', '}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Animation Type</InputLabel>
                <Select
                  value={formData.animationType || 'slide-in'}
                  onChange={(e) => setFormData({ ...formData, animationType: e.target.value as any })}
                >
                  <MenuItem value="slide-in">Slide In</MenuItem>
                  <MenuItem value="fade-in">Fade In</MenuItem>
                  <MenuItem value="typewriter">Typewriter</MenuItem>
                  <MenuItem value="bounce">Bounce</MenuItem>
                  <MenuItem value="glitch">Glitch</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={formData.description || ', '}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Duration (seconds)</Typography>
              <Slider
                value={formData.duration || 3}
                onChange={(_, value) => setFormData({ ...formData, duration: value as number })}
                min={1}
                max={10}
                step={0.5}
                marks={[
                  { value: 1, label: '1s',},
                  { value:  5, label: '5s',},
                  { value:  10, label: '10s',}
                ]}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Position</InputLabel>
                <Select
                  value={formData.position || 'bottom-left'}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value as any })}
                >
                  <MenuItem value="bottom-left">Bottom Left</MenuItem>
                  <MenuItem value="bottom-center">Bottom Center</MenuItem>
                  <MenuItem value="bottom-right">Bottom Right</MenuItem>
                  <MenuItem value="top-left">Top Left</MenuItem>
                  <MenuItem value="top-center">Top Center</MenuItem>
                  <MenuItem value="top-right">Top Right</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Background Color"
                type="color"
                value={formData.backgroundColor || '#000000'}
                onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Text Color"
                type="color"
                value={formData.textColor || '#ffffff'}
                onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Font Size: {formData.fontSize || 24}px</Typography>
              <Slider
                value={formData.fontSize || 24}
                onChange={(_, value) => setFormData({ ...formData, fontSize: value as number })}
                min={12}
                max={48}
                step={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Font Family</InputLabel>
                <Select
                  value={formData.fontFamily || 'Arial'}
                  onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
                >
                  <MenuItem value="Arial">Arial</MenuItem>
                  <MenuItem value="Helvetica">Helvetica</MenuItem>
                  <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                  <MenuItem value="Georgia">Georgia</MenuItem>
                  <MenuItem value="Verdana">Verdana</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
            disabled={!formData.name}
           sx={theming.getThemedButtonSx()}>
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        open={showPreview} 
        onClose={() => setShowPreview(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Preview: {selectedTemplate?.name}
            </Typography>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Button
                startIcon={isPlaying ? theming.getThemedIcon('stop') : theming.getThemedIcon('play')}
                onClick={playPreview}
                variant="outlined"
                size="small"
              >
                {isPlaying ? 'Stop' : 'Play'}
              </Button>
              <IconButton onClick={() => setShowPreview(false)}>
                {theming.getThemedIcon('close')}
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '400px', position: 'relative', overflow: 'hidden'}}>
          {selectedTemplate && (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                backgroundColor: '#f0f0f0',
                ...getAnimationKeyframes(selectedTemplate)
            }}
            >
              <Box
                sx={{
                  ...getAnimationStyles(selectedTemplate),
                  ...(isPlaying ? getAnimationKeyframes(selectedTemplate) : {})
              }}
              >
                {selectedTemplate.preview}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
