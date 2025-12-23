import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Preview as PreviewIcon,
  Edit as EditIcon,
  AddCircle as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  profession: string;
  contractType: string;
  sections: string[];
  defaultAmount?: number;
  defaultTerms?: string;
  isCustom?: boolean;
  createdAt?: string;
}

interface ContractTemplateSelectorProps {
  profession?: 'photographer' | 'videographer' | 'music_producer';
  onTemplateSelect?: (template: ContractTemplate) => void;
  onTemplateCreate?: (templateData: Partial<ContractTemplate>) => void;
}

const DEFAULT_TEMPLATES: Record<string, ContractTemplate[]> = {
  photographer: [
    {
      id: 'wedding',
      name: 'Bryllupskontrakt',
      description: 'Standard kontrakt for bryllupsfotografering',
      profession: 'photographer',
      contractType: 'wedding',
      sections: ['Tjenester','Priser','Levering','Rettigheter','Annullering'],
      defaultAmount: 25000,
    },
    {
      id: 'portrait',
      name: 'Portrettkontrakt',
      description: 'Kontrakt for portrettfotografering',
      profession: 'photographer',
      contractType: 'portrait',
      sections: ['Sesjon','Bilder','Rettigheter','Betalingsbetingelser'],
      defaultAmount: 5000,
    },
    {
      id: 'event',
      name: 'Eventkontrakt',
      description: 'Kontrakt for eventfotografering',
      profession: 'photographer',
      contractType: 'event',
      sections: ['Tjenester','Varighet','Levering','Rettigheter'],
      defaultAmount: 15000,
    },
    {
      id: 'corporate',
      name: 'Bedriftskontrakt',
      description: 'Kontrakt for bedriftsfotografering',
      profession: 'photographer',
      contractType: 'corporate',
      sections: ['Tjenester','Levering','Rettigheter','Betalingsbetingelser'],
      defaultAmount: 20000,
    },
  ],
  videographer: [
    {
      id: 'wedding-video',
      name: 'Bryllupsvideokontrakt',
      description: 'Standard kontrakt for bryllupsvideo',
      profession: 'videographer',
      contractType: 'wedding',
      sections: ['Tjenester','Priser','Levering','Rettigheter','Annullering'],
      defaultAmount: 35000,
    },
    {
      id: 'corporate-video',
      name: 'Bedriftsvideokontrakt',
      description: 'Kontrakt for bedriftsvideo',
      profession: 'videographer',
      contractType: 'corporate',
      sections: ['Tjenester','Levering','Rettigheter','Betalingsbetingelser'],
      defaultAmount: 30000,
    },
    {
      id: 'music-video',
      name: 'Musikkvideokontrakt',
      description: 'Kontrakt for musikkvideo produksjon',
      profession: 'videographer',
      contractType: 'music',
      sections: ['Produksjon','Post-produksjon','Rettigheter','Betalingsbetingelser'],
      defaultAmount: 50000,
    },
  ],
  music_producer: [
    {
      id: 'album',
      name: 'Albumkontrakt',
      description: 'Kontrakt for albumproduksjon',
      profession: 'music_producer',
      contractType: 'album',
      sections: ['Produksjon','Mastering','Rettigheter','Royalties'],
      defaultAmount: 100000,
    },
    {
      id: 'single',
      name: 'Singelkontrakt',
      description: 'Kontrakt for singelproduksjon',
      profession: 'music_producer',
      contractType: 'single',
      sections: ['Produksjon','Mastering','Rettigheter','Royalties'],
      defaultAmount: 30000,
    },
    {
      id: 'demo',
      name: 'Demokontrakt',
      description: 'Kontrakt for demo produksjon',
      profession: 'music_producer',
      contractType: 'demo',
      sections: ['Produksjon','Levering','Rettigheter'],
      defaultAmount: 15000,
    },
  ],
};

export default function ContractTemplateSelector({
  profession = 'photographer,',
  onTemplateSelect,
  onTemplateCreate,
}: ContractTemplateSelectorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const theming = useTheming(profession);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<ContractTemplate>>({
    name: '',
    description: '',
    contractType: '',
    sections: [],
  });

  // Fetch user's custom templates
  const { data: customTemplates = [] } = useQuery({
    queryKey: ['/api/contracts/templates,', user?.id],
    queryFn: () => apiRequest(`/api/contracts/templates?userId=${user?.id}`),
    enabled: !!user?.id,
    retry: false,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: Partial<ContractTemplate>) => {
      return apiRequest('/api/contracts/templates, ', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ ...templateData, userId: user?.id, profession }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/templates', user?.id] });
      setCreateDialogOpen(false);
      setNewTemplate({ name: '', description: ',', contractType: ', ', sections: [] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest(`/api/contracts/templates/${templateId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contracts/templates', user?.id] });
    },
  });

  const templates = [
    ...(DEFAULT_TEMPLATES[profession] || []),
    ...(customTemplates?.templates || []),
  ];

  const handleTemplateSelect = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  const handlePreview = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
          Velg Kontraktmal
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ bgcolor: theming.colors.primary }}
        >
          Opprett Egen Mal
        </Button>
      </Box>

      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer', '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-4px)',
                  transition: 'all 0.3s',
                }}}
            >
              <CardActionArea
                onClick={() => handleTemplateSelect(template)}
                sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <DescriptionIcon sx={{ color: theming.colors.primary, fontSize: 32 }} />
                    {template.isCustom && (
                      <Chip label="Egen" size="small" color="primary" />
                    )}
                  </Box>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {template.description}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Inneholder:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {template.sections.slice(0, 3).map((section, idx) => (
                      <Chip
                        key={idx}
                        label={section}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                    {template.sections.length > 3 && (
                      <Chip
                        label={`+${template.sections.length - 3} mer`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  {template.defaultAmount && (
                    <Typography variant="body2" sx={{ mt: 2, fontWeight: 600, color: theming.colors.primary }}>
                      Fra NOK {template.defaultAmount.toLocaleString('no-NO')}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
              <Box sx={{ display: 'flex', gap: 1, p: 1, borderTop: 1, borderColor: 'divider' }}>
                <Tooltip title="Forhåndsvisning">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(template);
                    }}
                  >
                    <PreviewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {template.isCustom && (
                  <Tooltip title="Slett mal">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Er du sikker på at du vil slette denne malen?')) {
                          deleteTemplateMutation.mutate(template.id);
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Button
                  size="small"
                  variant="contained"
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTemplateSelect(template);
                  }}
                  sx={{ bgcolor: theming.colors.primary }}
                >
                  Bruk Mal
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Template Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Forhåndsvisning: {selectedTemplate?.name}</Typography>
            <Button onClick={() => setPreviewOpen(false)}>Lukk</Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedTemplate.description}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Innehold:
              </Typography>
              <List>
                {selectedTemplate.sections.map((section, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={section} />
                  </ListItem>
                ))}
              </List>
              {selectedTemplate.defaultAmount && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Anbefalt pris: NOK {selectedTemplate.defaultAmount.toLocaleString('no-NO')}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Lukk</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedTemplate) {
                handleTemplateSelect(selectedTemplate);
                setPreviewOpen(false);
              }
            }}
            sx={{ bgcolor: theming.colors.primary }}
          >
            Bruk Denne Malen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Custom Template Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett Egen Kontraktmal</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Navn på mal"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Beskrivelse"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="Kontrakttype"
              value={newTemplate.contractType}
              onChange={(e) => setNewTemplate({ ...newTemplate, contractType: e.target.value })}
              fullWidth
            />
            <TextField
              label="Sekjoner (kommaseparert)"
              placeholder="Tjenester, Priser, Levering, Rettigheter"
              value={newTemplate.sections?.join(', ') || ', '}
              onChange={(e) =>
                setNewTemplate({
                  ...newTemplate,
                  sections: e.target.value.split('').map((s) => s.trim()).filter(Boolean),
                })
              }
              fullWidth
              helperText="Skriv inn sekjoner separert med komma"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (newTemplate.name && onTemplateCreate) {
                onTemplateCreate(newTemplate);
                createTemplateMutation.mutate(newTemplate);
              }
            }}
            disabled={!newTemplate.name || createTemplateMutation.isPending}
            sx={{ bgcolor: theming.colors.primary }}
          >
            {createTemplateMutation.isPending ? 'Oppretter...' : 'Opprett Mal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
