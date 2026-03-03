/**
 * QuoteTemplatesDialog Component
 * Browse and select quote templates for quick quote creation
 */

import React, { useMemo, useState } from 'react';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
  Star as StarIcon,
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

const TABS = [
  { label: 'Alle', key: 'all' },
  { label: 'Populære', key: 'public' },
  { label: 'Mine maler', key: 'mine' },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => toStringValue(entry)).filter(Boolean) : [];
}

function toServiceArray(value: unknown): Array<{ name: string; price: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      return {
        name: toStringValue(entry.name),
        price: toStringValue(entry.price, '0'),
      };
    })
    .filter((entry): entry is { name: string; price: string } => entry !== null && Boolean(entry.name));
}

function normalizeTemplate(value: unknown): QuoteTemplate | null {
  if (!isRecord(value)) return null;

  const template: QuoteTemplate = {
    id: toStringValue(value.id),
    name: toStringValue(value.name),
    description: toStringValue(value.description),
    profession: toStringValue(value.profession),
    projectType: toStringValue(value.projectType),
    category: toStringValue(value.category),
    basePrice: toStringValue(value.basePrice, '0'),
    services: toServiceArray(value.services),
    additionalServices: toServiceArray(value.additionalServices),
    includedItems: toStringArray(value.includedItems),
    deliverables: toStringArray(value.deliverables),
    validityDays: Number(value.validityDays) || 0,
    notes: toStringValue(value.notes),
    isPublic: Boolean(value.isPublic),
    usageCount: Number(value.usageCount) || 0,
    tags: toStringArray(value.tags),
    createdBy: toStringValue(value.createdBy),
    createdAt: toStringValue(value.createdAt),
  };

  if (!template.id || !template.name) {
    return null;
  }

  return template;
}

function extractTemplates(payload: unknown): QuoteTemplate[] {
  if (Array.isArray(payload)) {
    return payload
      .map(normalizeTemplate)
      .filter((template): template is QuoteTemplate => template !== null);
  }

  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.templates)) {
    return payload.templates
      .map(normalizeTemplate)
      .filter((template): template is QuoteTemplate => template !== null);
  }

  if (Array.isArray(payload.data)) {
    return payload.data
      .map(normalizeTemplate)
      .filter((template): template is QuoteTemplate => template !== null);
  }

  return [];
}

function formatCurrency(amount: string): string {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return amount;
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
  }).format(value);
}

export default function QuoteTemplatesDialog({
  open,
  onClose,
  onSelectTemplate,
  profession,
}: QuoteTemplatesDialogProps) {
  const { getProfessionDisplayName } = useDynamicProfessions();
  const { user } = useAuth();

  const [selectedTab, setSelectedTab] = useState(0);
  const [filterProfession, setFilterProfession] = useState(profession || 'all');
  const [selectedTemplate, setSelectedTemplate] = useState<QuoteTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['/api/quotes/templates', user?.id, filterProfession],
    queryFn: async () => {
      const url =
        filterProfession === 'all'
          ? `/api/quotes/templates?userId=${user?.id ?? ''}`
          : `/api/quotes/templates?userId=${user?.id ?? ''}&profession=${filterProfession}`;
      return apiRequest(url);
    },
    enabled: open && Boolean(user?.id),
  });

  const templates = useMemo(() => extractTemplates(templatesQuery.data), [templatesQuery.data]);

  const filteredTemplates = useMemo(() => {
    if (selectedTab === 1) {
      return templates.filter((template) => template.isPublic);
    }
    if (selectedTab === 2) {
      return templates.filter((template) => template.createdBy === user?.id);
    }
    return templates;
  }, [selectedTab, templates, user?.id]);

  const publicTemplateCount = useMemo(
    () => templates.filter((template) => template.isPublic).length,
    [templates],
  );

  const handleSelectTemplate = (template: QuoteTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  const handlePreview = (template: QuoteTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  return (
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

          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              select
              label="Fagområde"
              value={filterProfession}
              onChange={(event) => setFilterProfession(event.target.value)}
              sx={{ minWidth: 220 }}
              size="small"
            >
              <MenuItem value="all">Alle fagområder</MenuItem>
              <MenuItem value="photographer">Fotograf</MenuItem>
              <MenuItem value="videographer">Videograf</MenuItem>
              <MenuItem value="music_producer">Musikkprodusent</MenuItem>
            </TextField>

            <Tabs value={selectedTab} onChange={(_, nextValue) => setSelectedTab(nextValue)}>
              <Tab label={TABS[0].label} />
              <Tab
                label={
                  <Badge badgeContent={publicTemplateCount} color="primary">
                    {TABS[1].label}
                  </Badge>
                }
              />
              <Tab label={TABS[2].label} />
            </Tabs>
          </Box>

          {templatesQuery.isLoading ? (
            <Typography>Laster maler...</Typography>
          ) : filteredTemplates.length === 0 ? (
            <Alert severity="info">Ingen maler funnet. Opprett din første mal for å komme i gang.</Alert>
          ) : (
            <Grid container spacing={2}>
              {filteredTemplates.map((template) => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                      },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          mb: 1,
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {template.name}
                        </Typography>
                        {template.isPublic ? (
                          <Chip icon={<StarIcon />} label="Populær" size="small" color="warning" />
                        ) : null}
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {template.description}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                        <Chip
                          label={getProfessionDisplayName(template.profession)}
                          size="small"
                          variant="outlined"
                        />
                        <Chip label={template.projectType} size="small" variant="outlined" />
                        {template.tags.slice(0, 2).map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Startpris
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#FF6B35' }}>
                            {formatCurrency(template.basePrice)}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" color="text.secondary">
                            Brukt
                          </Typography>
                          <Typography variant="body2">{template.usageCount} ganger</Typography>
                        </Box>
                      </Box>

                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Inkluderer:
                        </Typography>
                        <List dense sx={{ py: 0 }}>
                          {template.includedItems.slice(0, 3).map((item, index) => (
                            <ListItem key={`${template.id}-included-${index}`} sx={{ py: 0.5, px: 0 }}>
                              <CheckIcon fontSize="small" sx={{ mr: 1, color: 'success.main' }} />
                              <Typography variant="caption">{item}</Typography>
                            </ListItem>
                          ))}
                          {template.includedItems.length > 3 ? (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                              +{template.includedItems.length - 3} mer...
                            </Typography>
                          ) : null}
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
                          bgcolor: '#FF6B35',
                          '&:hover': {
                            bgcolor: '#E55A25',
                          },
                        }}
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
              window.location.assign('/quotes/templates/create');
            }}
          >
            Opprett ny mal
          </Button>
        </DialogActions>
      </Dialog>

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
          {selectedTemplate ? (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedTemplate.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Tjenester
              </Typography>
              <List>
                {selectedTemplate.services.map((service, index) => (
                  <ListItem key={`${selectedTemplate.id}-service-${index}`}>
                    <ListItemText primary={service.name} secondary={formatCurrency(service.price)} />
                  </ListItem>
                ))}
              </List>

              {selectedTemplate.additionalServices.length > 0 ? (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Tilleggsvalg
                  </Typography>
                  <List>
                    {selectedTemplate.additionalServices.map((service, index) => (
                      <ListItem key={`${selectedTemplate.id}-extra-${index}`}>
                        <ListItemText primary={service.name} secondary={formatCurrency(service.price)} />
                      </ListItem>
                    ))}
                  </List>
                </>
              ) : null}

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Inkludert i pakken
              </Typography>
              <List>
                {selectedTemplate.includedItems.map((item, index) => (
                  <ListItem key={`${selectedTemplate.id}-included-preview-${index}`}>
                    <CheckIcon sx={{ mr: 1, color: 'success.main' }} />
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>

              {selectedTemplate.notes ? (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Notater
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedTemplate.notes}
                  </Typography>
                </>
              ) : null}
            </Box>
          ) : null}
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
              }
            }}
            sx={{
              bgcolor: '#FF6B35',
              '&:hover': {
                bgcolor: '#E55A25',
              },
            }}
          >
            Bruk denne malen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
