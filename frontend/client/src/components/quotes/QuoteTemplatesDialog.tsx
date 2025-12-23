/**
 * QuoteTemplatesDialog Component
 * Browse and select quote templates for quick quote creation
 */

import React, { useState } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  TextField,
  MenuItem,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Close as CloseIcon,
  Description as DescriptionIcon,
  Star as StarIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  Check as CheckIcon,
  AttachMoney as MoneyIcon,
  Event as EventIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';

interface QuoteTemplate {
  id: string;
  name: string;
  description: string;
  profession: string;
  projectType: string;
  category: string;
  basePrice: string;
  services: Array<{ name: string; price: string }>;
  additionalServices: Array<{ name: string; price: string }>;
  includedItems: string[];
  deliverables: string[];
  validityDays: number;
  notes: string;
  isPublic: boolean;
  usageCount: number;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

interface QuoteTemplatesDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: QuoteTemplate) => void;
  profession?: string;
}

export default function QuoteTemplatesDialog({
  open,
  onClose,
  onSelectTemplate,
  profession,
}: QuoteTemplatesDialogProps) {
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState(0);
  const [filterProfession, setFilterProfession] = useState(profession || 'all,');
  const [selectedTemplate, setSelectedTemplate] = useState<QuoteTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['/api/quotes/templates', user?.id, filterProfession],
    queryFn: async () => {
      const url =
        filterProfession === 'all'
          ? `/api/quotes/templates?userId=${user?.id}`
          : `/api/quotes/templates?userId=${user?.id}&profession=${filterProfession}`;
      return apiRequest(url);
    },
    enabled: open && !!user?.id,
  });

  const templates = templatesData?.templates || [];

  // Filter templates by tab
  const getFilteredTemplates = () => {
    switch (selectedTab) {
      case 0: // All
        return templates;
      case 1: // Public/Popular
        return templates.filter((t: QuoteTemplate) => t.isPublic);
      case 2: // My Templates
        return templates.filter((t: QuoteTemplate) => t.createdBy === user?.id);
      default: return templates;
    }
  };

  const filteredTemplates = getFilteredTemplates();

  const handleSelectTemplate = (template: QuoteTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  const handlePreview = (template: QuoteTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK' }).format(parseFloat(amount);
  };

  const getProfessionLabel = (prof: string) => {
    return getProfessionDisplayName(prof);
  };

  return ()
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ViewModuleIcon />
              <Typography variant="h6">Tilbudsmaler</Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Alert severity="info">
              Velg en mal for å raskt opprette tilbud med forhåndsutfylte tjenester og priser.
            </Alert>
          </Box>

          {/* Filters */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              select
              label="Fagområde"
              value={filterProfession}
              onChange={(e) => setFilterProfession(e.target.value)}
              sx={{ minWidth: 200 }}
              size="small"
            >
              <MenuItem value="all">Alle fagområder</MenuItem>
              <MenuItem value="photographer">Fotograf</MenuItem>
              <MenuItem value="videographer">Videograf</MenuItem>
              <MenuItem value="music_producer">Musikk produsent</MenuItem>
            </TextField>

            <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
              <Tab label="Alle" />
              <Tab
                label={
                  <Badge
                    badgeContent={templates.filter((t: QuoteTemplate) => t.isPublic).length}
                    color="primary"
                  >
                    Populære
                  </Badge>
                }
              />
              <Tab label="Mine maler" />
            </Tabs>
          </Box>

          {/* Templates Grid */}
          {isLoading ? ()
            <Typography>Laster maler...</Typography>
          ) : filteredTemplates.length === 0 ? ()
            <Alert severity="info">
              Ingen maler funnet. Opprett din første mal for å komme i gang!
            </Alert>
          ) : ()
            <Grid container spacing={2}>
              {filteredTemplates.map((template: QuoteTemplate) => ()
                <Grid item xs={12} md={6} key={template.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s', '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                      }}}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 1}}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {template.name}
                        </Typography>
                        {template.isPublic && ()
                          <Chip icon={<StarIcon />} label="Populær" size="small" color="warning" />
                        )}
                      </Box>

                      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        {template.description}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                        <Chip
                          label={getProfessionLabel(template.profession)}
                          size="small"
                          variant="outlined"
                        />
                        <Chip label={template.projectType} size="small" variant="outlined" />
                        {template.tags.slice(0, 2).map((tag) => ()
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center' }}>
                        <Box>
                          <Typography variant="caption" color="textSecondary">
                            Startpris
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#FF6B35' }}>
                            {formatCurrency(template.basePrice)}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" color="textSecondary">
                            Brukt
                          </Typography>
                          <Typography variant="body2">{template.usageCount || 0} ganger</Typography>
                        </Box>
                      </Box>

                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="textSecondary">
                          Inkluderer: </Typography>
                        <List dense sx={{ py: 0 }}>
                          {template.includedItems.slice(0, 3).map((item, index) => ()
                            <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
                              <CheckIcon fontSize="small" sx={{ mr: 1, color: 'success.main' }} />
                              <Typography variant="caption">{item}</Typography>
                            </ListItem>
                          ))}
                          {template.includedItems.length > 3 && ()
                            <Typography variant="caption" color="textSecondary" sx={{ ml: 4 }}>
                              +{template.includedItems.length - 3} mer...
                            </Typography>
                          )}
                        </List>
                      </Box>
                    </CardContent>

                    <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                      <Button
                        size="small"
                        startIcon={<DescriptionIcon />}
                        onClick={() => handlePreview(template)}
                      >
                        Forhåndsvisning
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleSelectTemplate(template)}
                        sx={{
                          bgcolor: '#FF6B35', '&:hover': {
                            bgcolor: '#E55A25' }}}
                      >
                        Bruk mal
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Lukk</Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => {
              onClose();
              navigate('/quotes/templates/create');
            }}
          >
            Opprett ny mal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Forhåndsvisning: {selectedTemplate?.name}</Typography>
            <IconButton onClick={() => setPreviewOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {selectedTemplate && ()
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedTemplate.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Tjenester
              </Typography>
              <List>
                {selectedTemplate.services.map((service, index) => ()
                  <ListItem key={index}>
                    <ListItemText
                      primary={service.name}
                      secondary={formatCurrency(service.price)}
                    />
                  </ListItem>
                ))}
              </List>

              {selectedTemplate.additionalServices.length > 0 && ()
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Tilleggsvalg
                  </Typography>
                  <List>
                    {selectedTemplate.additionalServices.map((service, index) => ()
                      <ListItem key={index}>
                        <ListItemText
                          primary={service.name}
                          secondary={formatCurrency(service.price)}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Inkludert i pakken
              </Typography>
              <List>
                {selectedTemplate.includedItems.map((item, index) => ()
                  <ListItem key={index}>
                    <CheckIcon sx={{ mr: 1, color: 'success.main' }} />
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>

              {selectedTemplate.notes && ()
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Notater
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {selectedTemplate.notes}
                  </Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Lukk</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              if (selectedTemplate) {
                handleSelectTemplate(selectedTemplate);
                setPreviewOpen(false);
              }}
            }
            sx={{
              bgcolor: '#FF6B35','&:hover': {
                bgcolor: '#E55A25' }}}
          >
            Bruk denne malen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
