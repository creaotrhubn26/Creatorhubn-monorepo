/**
 * CreatorHub Norge - Create Category Modal
 * Modal for creating custom pricing categories
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Grid,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import {
  Category as CategoryIcon,
  PhotoCamera as PhotoIcon,
  Videocam as VideoIcon,
  Business as BusinessIcon,
  Event as EventIcon,
  Campaign as CampaignIcon,
  Add as AddIcon
} from '@mui/icons-material';

interface CreateCategoryModalProps {
  open: boolean;
  onClose: () => void
}

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  open,
  onClose,
}) => {
  const [categoryName, setCategoryName] = useState('');
  const [categoryKey, setCategoryKey] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Predefined category templates
  const categoryTemplates = [
    {
      key: 'familie',
      name: 'Familie',
      description: 'Familieportrett og livsstilsfotografering',
      icon: <PhotoIcon />,
      color: 'primary' as const,
      suggestedPrices: {
        timepris: 180,
        heldagspris: 800,
        halvdagspris: 4500 }
  },
    {
      key: 'nyfodt',
      name: 'Nyfødtfoto',
      description: 'Spesialisert nyfødtfotografering',
      icon: <PhotoIcon />,
      color: 'secondary' as const,
      suggestedPrices: {
        pakkepris: 350,
        timepris: 2000 }
  },
    {
      key: 'matfoto',
      name: 'Matfoto',
      description: 'Kommersiell matfotografering for restauranter',
      icon: <CampaignIcon />,
      color: 'warning' as const,
      suggestedPrices: {
        stykkpris: 20,
        timepris: 2200 }
  },
    {
      key: 'interiø',
      name: 'Interiørfoto',
      description: 'Arkitektur og interiørfotografering',
      icon: <BusinessIcon />,
      color: 'info' as const,
      suggestedPrices: {
        timepris: 200,
        lisenspris: 1500 }
  },
    {
      key: 'sport',
      name: 'Sport',
      description: 'Sportsfotografering og arrangement',
      icon: <EventIcon />,
      color: 'success' as const,
      suggestedPrices: {
        timepris: 160,
        heldagspris: 7000 }
  },
    {
      key: 'musikkvideo',
      name: 'Musikkvideo',
      description: 'Profesjonell musikkvideo produksjon',
      icon: <VideoIcon />,
      color: 'error' as const,
      suggestedPrices: {
        pakkepris: 1500,
        heldagspris: 12000 }
  }
  ];

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      // This would create both the category metadata and initial pricing structures
      const response = await fetch('/api/pricing/categories', {
        method: 'POST',
        headers: {
          ...auth, 'Content-Type' : 'application/json',
        },
        body: JSON.stringify(categoryData),
      });
      if (!response.ok) throw new Error('Failed to create category');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/packages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/pricing', ],});
      handleClose();
  },
});

  const handleClose = () => {
    setCategoryName('');
    setCategoryKey('');
    setDescription('');
    setSelectedTemplate(null);
    onClose();
};

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template.key);
    setCategoryName(template.name);
    setCategoryKey(template.key);
    setDescription(template.description);
};

  const handleCustomCategory = () => {
    setSelectedTemplate('custom');
    setCategoryName('');
    setCategoryKey(', ');
    setDescription(', ');
};

  const handleCreateCategory = () => {
    if (!categoryName.trim() || !categoryKey.trim()) return;

    const template = categoryTemplates.find(t => t.key === selectedTemplate);

    const categoryData = {
      key: categoryKey.toLowerCase().replace(/\s+/g, '_'),
      name: categoryName.trim(),
      description: description.trim(),
      suggestedPrices: template?.suggestedPrices || {},
      isCustom: selectedTemplate === 'custom',
    };

    createCategoryMutation.mutate(categoryData);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(price);
  };

  return (
    <Dialog 
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
      }
    }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 3, py: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'primary.50',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CategoryIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography 
            variant="h5" 
            sx={{ 
              color: theming.colors.primary,
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}
          >
            Legg til ny kategori
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 4 }}>
        {!selectedTemplate ? (
          <Box>
            <Box sx={{ mb: 4, pb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CategoryIcon sx={{ fontSize: 26 }} />
                </Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 700,
                    color: theming.colors.primary,
                    fontSize: '1.3rem',
                    letterSpacing: '-0.01em'
                  }}
                >
                  Velg kategori type
                </Typography>
              </Box>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ lineHeight: 1.7, ml: 6.5 }}
              >
                Velg en forhåndsdefinert kategori med anbefalte priser, eller opprett en tilpasset kategori.
              </Typography>
            </Box>

            <Grid container spacing={3.5} sx={{ mb: 4 }}>
              {categoryTemplates.map((template) => (
                <Grid size={{ xs: 12, sm: 6 }} key={template.key}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3.5,
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: '2px solid',
                      borderColor: 'divider',
                      borderRadius: 2.5,
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                      ...theming.getThemedCardSx(),
                      '&:hover': {
                        elevation: 4,
                        borderColor: `${template.color}.main`,
                        transform: 'translateY(-4px) scale(1.02)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        background: `linear-gradient(135deg, #ffffff 0%, ${template.color}.50 100%)`,
                      }
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <Box 
                        sx={{ 
                          color: `${template.color}.main`,
                          p: 2,
                          borderRadius: 2.5,
                          bgcolor: `${template.color}.50`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          '& > svg': { fontSize: 36 }
                        }}
                      >
                        {template.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: theming.colors.primary,
                            fontWeight: 700,
                            mb: 1.25,
                            fontSize: '1.15rem'
                          }}
                        >
                          {template.name}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ mb: 2.5, lineHeight: 1.7 }}
                        >
                          {template.description}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {Object.entries(template.suggestedPrices).map(([type, price]) => (
                            <Chip
                              key={type}
                              size="small"
                              label={`${type}: ${formatPrice(price as number)}`}
                              variant="filled"
                              sx={{
                                bgcolor: `${template.color}.100`,
                                color: `${template.color}.800`,
                                fontWeight: 600,
                                borderRadius: 2,
                                px: 0.5,
                                fontSize: '0.8rem'
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Paper
              elevation={0}
              sx={{
                p: 3.5,
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #fafbfc 0%, #f0f2f5 100%)',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                },
                ...theming.getThemedCardSx()
              }}
              onClick={handleCustomCategory}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    '& > svg': { fontSize: 36 }
                  }}
                >
                  <AddIcon />
                </Box>
                <Box>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: theming.colors.primary,
                      fontWeight: 700,
                      mb: 0.75,
                      fontSize: '1.15rem'
                    }}
                  >
                    Tilpasset kategori
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Opprett en helt ny kategori med egne innstillinger
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        ) : (
          <Box>
            <Box
              sx={{
                mb: 4,
                p: 3,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
                border: '1px solid',
                borderColor: 'primary.200',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2.5
              }}
            >
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: 'primary.main',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CategoryIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1, pt: 0.25 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.75, color: 'primary.dark', fontSize: '1.1rem' }}>
                  {selectedTemplate === 'custom' ? 'Tilpasset kategori' : categoryTemplates.find(t => t.key === selectedTemplate)?.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                  {selectedTemplate === 'custom' 
                    ? 'Opprett en tilpasset kategori med dine egne spesifikasjoner.'
                    : `Denne malen inkluderer anbefalte priser og innstillinger for ${categoryTemplates.find(t => t.key === selectedTemplate)?.name.toLowerCase()}.`
                  }
                </Typography>
              </Box>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 3.5,
                borderRadius: 2,
                border: '2px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                '&:hover': {
                  borderColor: 'primary.light'
                }
              }}
            >
              <Box sx={{ mb: 3.5, pb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 700,
                    color: 'text.primary',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    fontSize: '1.2rem'
                  }}
                >
                  <LabelOutlinedIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                  Kategoriinformasjon
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, ml: 5, lineHeight: 1.6 }}>
                  Fyll ut informasjonen for den nye kategorien
                </Typography>
              </Box>
              
              <Grid container spacing={3.5}>
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LabelOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      Kategorinavn *
                    </Typography>
                    <TextField
                      fullWidth
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="f.eks. Familie, Nyfødtfoto, Sport"
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: 'grey.50',
                          fontSize: '1.1rem',
                          '&:hover': {
                            bgcolor: 'background.paper',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'background.paper',
                          }
                        }
                      }}
                    />
                  </Box>
                </Grid>
                
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <KeyOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      Kategorinøkkel *
                    </Typography>
                    <TextField
                      fullWidth
                      value={categoryKey}
                      onChange={(e) => setCategoryKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                      placeholder="f.eks. familie, nyfodt, sport"
                      helperText="Brukes i systemet - kun små bokstaver og underscore"
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: 'grey.50',
                          fontFamily: 'monospace',
                          fontSize: '1rem',
                          '&:hover': {
                            bgcolor: 'background.paper',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'background.paper',
                          }
                        }
                      }}
                    />
                  </Box>
                </Grid>
                
                <Grid size={{ xs: 12 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1.25, fontWeight: 600, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DescriptionOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      Beskrivelse
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Beskriv denne kategorien og hva den inkluderer..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: 'grey.50',
                          '&:hover': {
                            bgcolor: 'background.paper',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'background.paper',
                          }
                        }
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {selectedTemplate !== 'custom' && (
              <Box sx={{ mt: 3.5 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: 'success.50',
                        color: 'success.main',
                        display: 'flex'
                      }}
                    >
                      <CategoryIcon sx={{ fontSize: 22 }} />
                    </Box>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 700,
                        color: 'text.primary',
                        fontSize: '1.1rem'
                      }}
                    >
                      Anbefalte startpriser for denne kategorien
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {Object.entries(
                      categoryTemplates.find(t => t.key === selectedTemplate)?.suggestedPrices || {}
                    ).map(([type, price]) => (
                      <Grid size={{ xs: 12, sm: 6 }} key={type}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'success.200',
                            bgcolor: 'background.paper',
                            transition: 'all 0.2s',
                            '&:hover': {
                              boxShadow: 1,
                              borderColor: 'success.main'
                            }
                          }}
                        >
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                            {type}
                          </Typography>
                          <Typography variant="h6" sx={{ color: 'success.main', fontWeight: 700 }}>
                            {formatPrice(price as number)}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                  <Box
                    sx={{
                      mt: 3,
                      p: 2.5,
                      borderRadius: 1.5,
                      bgcolor: 'info.50',
                      border: '1px solid',
                      borderColor: 'info.200',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2
                    }}
                  >
                    <InfoOutlinedIcon sx={{ color: 'info.main', fontSize: 22, mt: 0.25, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                      <strong>Tips:</strong> Du kan justere disse prisene etter at kategorien er opprettet.
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}

            <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-start' }}>
              <Button 
                variant="text" 
                onClick={() => setSelectedTemplate(null)}
                startIcon={<ArrowBackIcon />}
                sx={{ 
                  borderRadius: 2,
                  px: 2.5,
                  py: 1,
                  color: 'text.secondary',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'primary.main'
                  }
                }}
              >
                Tilbake til valg
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3.5, py: 3, borderTop: '1px solid', borderColor: 'divider', gap: 1.5 }}>
        <Button 
          onClick={handleClose}
          sx={{ 
            borderRadius: 2,
            px: 3,
            py: 1,
            fontWeight: 500
          }}
        >
          Avbryt
        </Button>
        {selectedTemplate && (
          <Button 
            variant="contained"
            onClick={handleCreateCategory}
            disabled={!categoryName.trim() || !categoryKey.trim() || createCategoryMutation.isPending}
            sx={{
              ...theming.getThemedButtonSx(),
              borderRadius: 2,
              px: 4,
              py: 1.25,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: 2,
              fontSize: '1rem',
              '&:hover': {
                boxShadow: 4,
              }
            }}
          >
            {createCategoryMutation.isPending ? 'Oppretter...' : 'Opprett kategori'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateCategoryModal;