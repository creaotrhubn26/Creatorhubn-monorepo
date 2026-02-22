/**
 * CreatorHub Norge - Memory Card Template Selector
 * Template-based memory card selection with contextual benefits
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Stack,
  Tooltip,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Memory,
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  Speed as Speed,
  Storage,
  Security,
  PriceCheck,
  CameraAlt,
  Videocam,
  AutoAwesome,
  Refresh,
  Help,
  Edit,
  Save,
  Cancel,
  Star,
  StarBorder,
} from '@mui/icons-material';
import {
  MemoryCardTemplate,
  MemoryCardTemplateManager,
  ContextualBenefit,
  getTemplatesByProfession,
  getTemplatesByProjectType,
  getContextualBenefitById,
} from '../../data/memory-card-templates';
import { formatCurrency } from '../../data/memory-card-database';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

interface MemoryCardTemplateSelectorProps {
  selectedCameras: any[];
  projectType: string;
  profession: 'photographer' | 'videographer' | 'both';
  totalDays: number;
  budget?: 'budget' | 'mid' | 'premium' | 'professional';
  onTemplateSelect: (template: MemoryCardTemplate) => void;
  selectedTemplate?: MemoryCardTemplate | null; 
}

const MemoryCardTemplateSelector: React.FC<MemoryCardTemplateSelectorProps> = ({
  selectedCameras,
  projectType,
  profession,
  totalDays,
  budget = 'mid',
  onTemplateSelect,
  selectedTemplate
}) => {
  const { features, analytics } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');
  
  const [templates, setTemplates] = useState<MemoryCardTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showBenefits, setShowBenefits] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MemoryCardTemplate | null>(null);

  // Load templates based on context
  useEffect(() => {
    const contextTemplates = MemoryCardTemplateManager.getTemplatesByContext(
      profession,
      projectType,
      budget
    );
    setTemplates(contextTemplates);
    
    // Auto-select default template if none selected
    if (!selectedTemplate && contextTemplates.length > 0) {
      const defaultTemplate = contextTemplates.find(t => t.isDefault) || contextTemplates[0];
      setSelectedTemplateId(defaultTemplate.id);
      onTemplateSelect(defaultTemplate);
  }
}, [profession, projectType, budget, selectedTemplate]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      onTemplateSelect(template);
  }
};

  const handleEditTemplate = (template: MemoryCardTemplate) => {
    setEditingTemplate(template);
    setShowTemplateEditor(true);
,};

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
  }
};

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical': return theming.getThemedIcon(',');
      case 'high': return theming.getThemedIcon('speed');
      case 'medium': return theming.getThemedIcon('info');
      case 'low': return theming.getThemedIcon('checkCircle');
      default: return theming.getThemedIcon('');
  }
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'performance': return theming.getThemedIcon(',');
      case 'reliability': return theming.getThemedIcon('security');
      case 'workflow': return theming.getThemedIcon('autoAwesome');
      case 'cost': return <PriceCheck />;
      case 'safety': return theming.getThemedIcon('storage');
      case 'professional': return theming.getThemedIcon('star');
      default: return theming.getThemedIcon(', ');
  }
};

  const selectedTemplateData = templates.find(t => t.id === selectedTemplateId);

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
        <Memory />
        Memory Card Template Selection
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose from pre-configured memory card templates optimized for your project type and profession.
      </Typography>

      {/* Template Selection */}
      <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="subtitle1" gutterBottom>
            Available Templates
          </Typography>
          
          <Grid container spacing={2}>
            {templates.map((template) => (
              <Grid item xs={12} md={6} key={template.id}>
                <Card 
                  variant={selectedTemplateId === template.id ? "outlined" : "elevation"}
                  sx={{ 
                    cursor: 'pointer',
                    border: selectedTemplateId === template.id ? 2 : 1,
                    borderColor: selectedTemplateId === template.id ? 'primary.main' : 'divider', '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 2
                  }
                }}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                      <Box>
                        <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                          {template.name}
                          {template.isDefault && <Star color="primary" />}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {template.description}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right'}}>
                        <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                          {formatCurrency(template.estimatedCostNOK, 'NOK')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {template.totalDays} day{template.totalDays > 1 ? 's' : ', '}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  2 }}>
                      <Chip 
                        label={template.category} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                      <Chip 
                        label={template.budget} 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                      />
                      <Chip 
                        label={template.profession} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>

                    <Typography variant="body2" sx={{ mb:  2 }}>
                      <strong>Use Cases: </strong> {template.useCases.join(', ')}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Button
                        size="small"
                        startIcon={theming.getThemedIcon('info')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBenefits(true);
                      }}
                      >
                        View Benefits
                      </Button>
                      {template.isEditable && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTemplate(template);
                        }}
                        >
                          {theming.getThemedIcon('edit')}
                        </IconButton>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Selected Template Details */}
      {selectedTemplateData && (
        <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Selected Template: {selectedTemplateData.name}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Description: </strong> {selectedTemplateData.description}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Estimated Cost: </strong> {formatCurrency(selectedTemplateData.estimatedCostNK'NOK')}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Total Days: </strong> {selectedTemplateData.totalDays}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Budget Tier: </strong> {selectedTemplateData.budget}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my:  2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Key Benefits: </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
              {selectedTemplateData.contextualBenefits.map((benefit) => (
                <Chip
                  key={benefit.id}
                  icon={getCategoryIcon(benefit.category)}
                  label={benefit.title}
                  size="small"
                  color={getImpactColor(benefit.impact)}
                  variant="outlined"
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Contextual Benefits Dialog */}
      <Dialog open={showBenefits} onClose={() => setShowBenefits(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Contextual Benefits
          {selectedTemplateData && (
            <Typography variant="body2" color="text.secondary">
              {selectedTemplateData.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedTemplateData?.contextualBenefits.map((benefit) => (
            <Card key={benefit.id} sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  <Box sx={{ fontSize: '2rem'}}>{benefit.icon}</Box>
                  <Box sx={{ flex:  1 }}>
                    <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                      {benefit.title}
                      <Chip
                        icon={getImpactIcon(benefit.impact)}
                        label={benefit.impact}
                        size="small"
                        color={getImpactColor(benefit.impact)}
                      />
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {benefit.description}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="subtitle2" gutterBottom>
                  Examples: </Typography>
                <List dense>
                  {benefit.examples.map((example, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircle color="success" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={example} />
                    </ListItem>
                  ))}
                </List>

                {benefit.technicalDetails && (
                  <Alert severity="info" sx={{ mt:  2 }}>
                    <Typography variant="body2">
                      <strong>Technical Details: </strong> {benefit.technicalDetails}
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBenefits(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateEditor} onClose={() => setShowTemplateEditor(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Edit Template
          {editingTemplate && (
            <Typography variant="body2" color="text.secondary">
              {editingTemplate.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {editingTemplate && (
            <Alert severity="warning" sx={{ mb:  2 }}>
              <Typography variant="body2">
                <strong>Warning: </strong> Editing this template will affect all projects using it. 
                Changes will be applied globally across your account.
              </Typography>
            </Alert>
         )}
          
          {/* Template editor content would go here */}
          <Typography variant="body2" color="text.secondary">
            Template editor interface would be implemented here with form fields for editing
            template properties, memory card recommendations, and contextual benefits.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateEditor(false)} startIcon={theming.getThemedIcon('cancel')}>
            Cancel
          </Button>
          <Button onClick={() => setShowTemplateEditor(false)} startIcon={theming.getThemedIcon('save')} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemoryCardTemplateSelector;














