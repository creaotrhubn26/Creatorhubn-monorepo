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
      const response = await fetch('/api/price-administration/categories', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/categories', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/packages', ],});
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
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <CategoryIcon color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Legg til ny kategori</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {!selectedTemplate ? (
          <Box>
            <Typography variant="h6" gutterBottom sx={{  mt:  2  }}>
              Velg kategori type
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Velg en forhåndsdefinert kategori med anbefalte priser, eller opprett en tilpasset kategori.
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              {categoryTemplates.map((template) => (
                <Grid size={{ xs: 12, sm: 6 }} key={template.key}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: '2px solid transparent',
                      ...theming.getThemedCardSx(), '&:hover': {
                        elevation: 3,
                        borderColor: `${template.color}.main`,
                        transform: 'translateY(-2px)',
                      }}}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ color: `${template.color}.main` }}>
                        {template.icon}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                          {template.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {template.description}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {Object.entries(template.suggestedPrices).map(([type, price]) => (
                            <Chip
                              key={type}
                              size="small"
                              label={`${type}: ${formatPrice(price as number)}`}
                              variant="outlined"
                              color={template.color}
                            />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Paper
              elevation={1}
              sx={{
                p:  2,
                cursor: 'pointer',
                transition: 'all 0.2',
                border: '2px dashed #ccc', '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50'
            },
            ...theming.getThemedCardSx()
            }}
              onClick={handleCustomCategory}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <AddIcon color="primary" />
                <Box>
                  <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                    Tilpasset kategori
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Opprett en helt ny kategori med egne innstillinger
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb:  3 }}>
              {selectedTemplate === 'custom' 
                ? 'Opprett en tilpasset kategori med dine egne spesifikasjoner.'
                : `Oppretter kategori basert på ${categoryTemplates.find(t => t.key === selectedTemplate)?.name} malen.`
            }
            </Alert>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }} sm={6}>
                <TextField
                  fullWidth
                  label="Kategorinavn"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="f.eks. Familie, Nyfødtfoto, Sport"
                  required
                />
              </Grid>
              <Grid size={{ xs: 12 }} sm={6}>
                <TextField
                  fullWidth
                  label="Kategorinøkkel"
                  value={categoryKey}
                  onChange={(e) => setCategoryKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="f.eks. familie, nyfodt, sport"
                  helperText="Brukes i systemet - kun små bokstaver og underscore"
                  required
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Beskrivelse"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Beskriv denne kategorien og hva den inkluderer..."
                />
              </Grid>
            </Grid>

            {selectedTemplate !== 'custom' && (
              <Box sx={{ mt:  3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Anbefalte startpriser for denne kategorien:
                </Typography>
                <List dense>
                  {Object.entries(
                    categoryTemplates.find(t => t.key === selectedTemplate)?.suggestedPrices || {}
                  ).map(([type, price]) => (
                    <ListItem key={type}>
                      <ListItemIcon>
                        <CategoryIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={type}
                        secondary={formatPrice(price as number)}
                      />
                    </ListItem>
                  ))}
                </List>
                <Alert severity="info" sx={{ mt: 2 }}>
                  Du kan justere disse prisene etter at kategorien er opprettet.
                </Alert>
              </Box>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap:  1 }}>
              <Button 
                variant="outlined" 
                onClick={() => setSelectedTemplate(null)}
              >
                Tilbake
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Avbryt
        </Button>
        {selectedTemplate && (
          <Button variant="contained"
            onClick={handleCreateCategory}
            disabled={!categoryName.trim() || !categoryKey.trim() || createCategoryMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {createCategoryMutation.isPending ? 'Oppretter...' : 'Opprett kategori'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateCategoryModal;