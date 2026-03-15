/**
 * Manuscript Template Panel
 * UI for browsing and applying screenplay templates
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stack,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Architecture as ArchitectureIcon,
} from '@mui/icons-material';
import { manuscriptTemplateService } from '../services/manuscriptTemplateService';
import type { Template, TemplateLibrary, StructureTemplate } from '../data/manuscriptTemplates';
import { TemplateIcon } from './TemplateIcon';
import { getBrandingSettings } from '../config/branding';

interface ManuscriptTemplatePanelProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (template: Template) => void;
  currentContent?: string;
}

export const ManuscriptTemplatePanel: React.FC<ManuscriptTemplatePanelProps> = ({
  open,
  onClose,
  onApplyTemplate,
  currentContent = ''
}) => {
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [structureView, setStructureView] = useState<StructureTemplate | null>(null);
  const [library, setLibrary] = useState<TemplateLibrary>(() => manuscriptTemplateService.getTemplates());

  // Refresh library when dialog opens
  React.useEffect(() => {
    if (open) {
      setLibrary(manuscriptTemplateService.getTemplates());
    }
  }, [open]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      if (selectedTab === 0) {
        // All templates
        const all: Template[] = [];
        library.categories.forEach(cat => all.push(...cat.templates));
        all.push(...library.userTemplates);
        return all;
      } else if (selectedTab === library.categories.length + 1) {
        // User templates
        return library.userTemplates;
      } else if (selectedTab === library.categories.length + 2) {
        // Recent
        return library.recentlyUsed;
      } else {
        // Specific category
        return library.categories[selectedTab - 1]?.templates || [];
      }
    }
    
    return manuscriptTemplateService.searchTemplates(searchQuery);
  }, [searchQuery, selectedTab, library]);

  const handleApply = (template: Template) => {
    manuscriptTemplateService.trackTemplateUsage(template.id);
    onApplyTemplate(template);
    onClose();
  };

  const handleDeleteUserTemplate = async (templateId: string) => {
    if (confirm('Er du sikker på at du vil slette denne malen?')) {
      try {
        await manuscriptTemplateService.deleteUserTemplate(templateId);
        setLibrary(manuscriptTemplateService.getTemplates());
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const structureTemplates = manuscriptTemplateService.getStructureTemplates();
  const branding = useMemo(() => getBrandingSettings(), []);
  const selectedStructureTab = library.categories.length + 3;
  const totalTemplateCount = useMemo(() => {
    const categoryTemplates = library.categories.reduce((sum, category) => sum + category.templates.length, 0);
    return categoryTemplates + library.userTemplates.length;
  }, [library.categories, library.userTemplates.length]);
  const activeTabLabel = useMemo(() => {
    if (selectedTab === 0) return 'Alle maler';
    if (selectedTab === library.categories.length + 1) return 'Mine maler';
    if (selectedTab === library.categories.length + 2) return 'Nylig brukt';
    if (selectedTab === selectedStructureTab) return 'Strukturer';
    return library.categories[selectedTab - 1]?.name || 'Maler';
  }, [selectedTab, library.categories, selectedStructureTab]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: branding.colors.background,
            backgroundImage: `linear-gradient(180deg, ${branding.colors.background} 0%, ${branding.colors.surface} 100%)`,
            color: branding.colors.textPrimary,
            border: `1px solid ${branding.colors.border}`,
            minHeight: '82vh',
            boxShadow: '0 26px 72px rgba(0, 0, 0, 0.6)',
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: `1px solid ${branding.colors.border}`,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(0, 212, 255, 0.15)',
                border: `1px solid ${branding.colors.accent}`,
              }}
            >
              <DescriptionIcon sx={{ color: branding.colors.accent, fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ color: branding.colors.textPrimary, lineHeight: 1.25 }}>
                Role Room Manuskriptmaler
              </Typography>
              <Typography variant="caption" sx={{ color: branding.colors.textSecondary }}>
                Velg en mal og legg den inn i manuset ditt på sekunder.
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{ color: branding.colors.textSecondary, justifySelf: 'end' }}
            aria-label="Lukk manuskriptmaler"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', minHeight: 0 }}>
          <Box
            sx={{
              p: 2,
              borderBottom: `1px solid ${branding.colors.border}`,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
              gap: 1.5,
              alignItems: 'center',
            }}
          >
            <TextField
              fullWidth
              placeholder="Søk etter maler..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: branding.colors.textSecondary }} />
                  </InputAdornment>
                ),
                sx: {
                  color: branding.colors.textPrimary,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 1.5,
                  '& fieldset': { borderColor: branding.colors.border },
                  '&:hover fieldset': { borderColor: branding.colors.accent },
                  '&.Mui-focused fieldset': { borderColor: branding.colors.accent },
                },
              }}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <Chip label={activeTabLabel} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.15)', color: branding.colors.accent }} />
              <Chip label={`${filteredTemplates.length} treff`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: branding.colors.textPrimary }} />
              <Chip label={`${totalTemplateCount} totalt`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: branding.colors.textPrimary }} />
              <Chip
                label={currentContent.trim() ? 'Setter inn i manus' : 'Oppretter nytt manus'}
                size="small"
                sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }}
              />
            </Box>
          </Box>

          <Tabs
            value={selectedTab}
            onChange={(_, newValue) => setSelectedTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: `1px solid ${branding.colors.border}`,
              px: 2,
              '& .MuiTab-root': { color: branding.colors.textSecondary, minHeight: 48 },
              '& .Mui-selected': { color: branding.colors.accent },
              '& .MuiTabs-indicator': { bgcolor: branding.colors.accent },
            }}
          >
            <Tab label="Alle" />
            {library.categories.map(cat => (
              <Tab key={cat.id} label={cat.name} icon={<TemplateIcon iconName={cat.icon} />} iconPosition="start" />
            ))}
            <Tab label="Mine maler" icon={<PersonIcon />} iconPosition="start" />
            <Tab label="Nylig brukt" icon={<HistoryIcon />} iconPosition="start" />
            <Tab label="Strukturer" icon={<ArchitectureIcon />} iconPosition="start" />
          </Tabs>

          <Box
            sx={{
              p: 2,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 320px' },
              gap: 2,
            }}
          >
            <Box sx={{ minHeight: 0, overflowY: 'auto', pr: { xs: 0, xl: 1 } }}>
              {selectedTab === selectedStructureTab ? (
                structureTemplates.length === 0 ? (
                  <Typography sx={{ color: branding.colors.textSecondary, textAlign: 'center', py: 6 }}>
                    Ingen strukturmaler tilgjengelig
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                      gap: 2,
                    }}
                  >
                    {structureTemplates.map((structure) => (
                      <Card
                        key={structure.id}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${branding.colors.border}`,
                          borderRadius: 2,
                          transition: 'transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            borderColor: branding.colors.accent,
                            boxShadow: '0 14px 28px rgba(0,0,0,0.28)',
                          },
                        }}
                      >
                        <CardActionArea onClick={() => setStructureView(structure)} sx={{ height: '100%' }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <ArchitectureIcon sx={{ color: branding.colors.accent }} />
                              <Typography variant="h6" sx={{ color: branding.colors.textPrimary, fontSize: '1rem' }}>
                                {structure.name}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: branding.colors.textSecondary, mb: 2 }}>
                              {structure.description}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Chip label={`${structure.beats.length} beats`} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.14)', color: branding.colors.accent }} />
                              <Chip label={`${structure.totalPages} sider`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: branding.colors.textPrimary }} />
                            </Stack>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    ))}
                  </Box>
                )
              ) : filteredTemplates.length === 0 ? (
                <Typography sx={{ color: branding.colors.textSecondary, textAlign: 'center', py: 6 }}>
                  Ingen maler funnet
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 2,
                  }}
                >
                  {filteredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${branding.colors.border}`,
                        minHeight: 212,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 2,
                        transition: 'transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
                        '&:hover': {
                          transform: 'translateY(-3px)',
                          borderColor: branding.colors.accent,
                          boxShadow: '0 18px 30px rgba(0,0,0,0.34)',
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleApply(template)}
                        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                      >
                        <CardContent sx={{ flexGrow: 1, width: '100%', display: 'grid', gridTemplateRows: 'auto auto 1fr' }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <TemplateIcon iconName={template.icon} sx={{ color: branding.colors.accent, fontSize: '1.2rem' }} />
                              <Typography variant="h6" sx={{ color: branding.colors.textPrimary, fontSize: '1rem', lineHeight: 1.25 }}>
                                {template.name}
                              </Typography>
                            </Box>
                            {template.isUserTemplate && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUserTemplate(template.id);
                                }}
                                sx={{ color: '#f87171' }}
                                aria-label={`Slett mal ${template.name}`}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                          <Typography variant="body2" sx={{ color: branding.colors.textSecondary, mb: 1.5 }}>
                            {template.description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignContent: 'start' }}>
                            {template.tags.slice(0, 4).map((tag) => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                sx={{
                                  bgcolor: 'rgba(0,212,255,0.1)',
                                  color: branding.colors.accent,
                                  fontSize: '0.7rem',
                                  height: 21,
                                }}
                              />
                            ))}
                          </Box>
                        </CardContent>
                      </CardActionArea>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: 0.75,
                          p: 1,
                          borderTop: `1px solid ${branding.colors.border}`,
                        }}
                      >
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon fontSize="small" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(template);
                          }}
                          sx={{ color: branding.colors.textSecondary, justifyContent: 'flex-start' }}
                        >
                          Forhåndsvis
                        </Button>
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          onClick={() => handleApply(template)}
                          sx={{ color: branding.colors.accent, justifyContent: 'flex-start' }}
                        >
                          Bruk mal
                        </Button>
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>

            <Paper
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${branding.colors.border}`,
                bgcolor: 'rgba(255,255,255,0.03)',
                display: 'grid',
                gap: 1.5,
                alignContent: 'start',
                height: 'fit-content',
                position: { xl: 'sticky' },
                top: { xl: 0 },
              }}
            >
              <Typography variant="subtitle2" sx={{ color: branding.colors.textPrimary, fontWeight: 700 }}>
                Role Room Tips
              </Typography>
              <Typography variant="body2" sx={{ color: branding.colors.textSecondary }}>
                Klikk på et kort for å bruke malen direkte i manuseditoren.
              </Typography>
              <Divider sx={{ borderColor: branding.colors.border }} />
              <Stack spacing={1}>
                <Chip label={`Aktiv visning: ${activeTabLabel}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: branding.colors.textPrimary, justifyContent: 'flex-start' }} />
                <Chip label={`${filteredTemplates.length} tilgjengelige i denne visningen`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: branding.colors.textPrimary, justifyContent: 'flex-start' }} />
              </Stack>
              <Divider sx={{ borderColor: branding.colors.border }} />
              <Typography variant="caption" sx={{ color: branding.colors.textSecondary }}>
                Tips: Bruk søk for å finne maler på type, sjanger eller nøkkelord.
              </Typography>
            </Paper>
          </Box>
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${branding.colors.border}`, p: 2 }}>
          <Button onClick={onClose} sx={{ color: branding.colors.textSecondary }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: branding.colors.background,
            backgroundImage: `linear-gradient(180deg, ${branding.colors.background} 0%, ${branding.colors.surface} 100%)`,
            border: `1px solid ${branding.colors.border}`,
            color: branding.colors.textPrimary,
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: `1px solid ${branding.colors.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TemplateIcon iconName={previewTemplate?.icon} sx={{ color: branding.colors.accent }} />
            <Box component="span" sx={{ color: branding.colors.textPrimary, fontSize: '1.25rem', fontWeight: 500 }}>
              {previewTemplate?.name}
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: branding.colors.textSecondary, display: 'block', mt: 0.5 }}>
            {previewTemplate?.description}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'rgba(0,0,0,0.35)',
              border: `1px solid ${branding.colors.border}`,
              fontFamily: 'Courier New, monospace',
              fontSize: '14px',
              color: branding.colors.textPrimary,
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflowY: 'auto',
            }}
          >
            {previewTemplate?.content}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${branding.colors.border}` }}>
          <Button onClick={() => setPreviewTemplate(null)} sx={{ color: branding.colors.textSecondary }}>
            Lukk
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (previewTemplate) {
                handleApply(previewTemplate);
                setPreviewTemplate(null);
              }
            }}
            sx={{
              bgcolor: branding.colors.accent,
              color: branding.colors.background,
              '&:hover': { bgcolor: branding.colors.accent, filter: 'brightness(0.92)' },
            }}
          >
            Bruk mal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Structure View Dialog */}
      <Dialog
        open={!!structureView}
        onClose={() => setStructureView(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: branding.colors.background,
            backgroundImage: `linear-gradient(180deg, ${branding.colors.background} 0%, ${branding.colors.surface} 100%)`,
            border: `1px solid ${branding.colors.border}`,
            color: branding.colors.textPrimary,
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: `1px solid ${branding.colors.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArchitectureIcon sx={{ color: branding.colors.accent }} />
            <Box component="span" sx={{ color: branding.colors.textPrimary, fontSize: '1.25rem', fontWeight: 500 }}>
              {structureView?.name}
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: branding.colors.textSecondary, display: 'block', mt: 0.5 }}>
            {structureView?.description}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <List sx={{ maxHeight: 500, overflowY: 'auto' }}>
            {structureView?.beats.map((beat, index) => (
              <React.Fragment key={index}>
                <ListItem
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius: 1,
                    mb: 1,
                    border: `1px solid ${branding.colors.border}`,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={typeof beat.page === 'number' ? `s.${beat.page}` : `s.${beat.page.min}-${beat.page.max}`}
                          size="small"
                          sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: branding.colors.accent, fontWeight: 600 }}
                        />
                        <Typography sx={{ color: branding.colors.textPrimary, fontWeight: 500 }}>
                          {beat.name}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: branding.colors.textSecondary, mt: 0.5 }}>
                        {beat.description}
                      </Typography>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${branding.colors.border}` }}>
          <Button onClick={() => setStructureView(null)} sx={{ color: branding.colors.textSecondary }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
