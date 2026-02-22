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
  Grid,
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
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
  Star as StarIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Movie as MovieIcon,
  Tv as TvIcon,
  VideoLibrary as VideoLibraryIcon,
  Campaign as CampaignIcon,
  MovieCreation as MovieCreationIcon,
  ChatBubble as ChatBubbleIcon,
  FlashOn as FlashOnIcon,
  Timer as TimerIcon,
  History as HistoryIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  School as SchoolIcon,
  RocketLaunch as RocketIcon,
  Architecture as ArchitectureIcon,
} from '@mui/icons-material';
import { manuscriptTemplateService } from '../services/manuscriptTemplateService';
import { Template, TemplateLibrary, StructureTemplate } from '../models/manuscriptTemplates';
import { TemplateIcon } from './TemplateIcon';

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

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))',
            minHeight: '80vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DescriptionIcon sx={{ color: '#00d4ff' }} />
            <Typography variant="h6" sx={{ color: '#fff' }}>
              Manuskriptmaler
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Search */}
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <TextField
              fullWidth
              placeholder="Søk etter maler..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                  </InputAdornment>
                ),
                sx: {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff' }
                }
              }}
            />
          </Box>

          {/* Tabs */}
          <Tabs
            value={selectedTab}
            onChange={(_, newValue) => setSelectedTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              px: 2,
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.87)', minHeight: 48 },
              '& .Mui-selected': { color: '#00d4ff' },
              '& .MuiTabs-indicator': { bgcolor: '#00d4ff' }
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

          {/* Content */}
          <Box sx={{ p: 2, minHeight: 400, maxHeight: 500, overflowY: 'auto' }}>
            {selectedTab === library.categories.length + 3 ? (
              // Structure templates
              <Grid container spacing={2}>
                {structureTemplates.map(structure => (
                  <Grid key={structure.id} size={{ xs: 12 }}>
                    <Card
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.08)',
                          borderColor: '#00d4ff'
                        }
                      }}
                    >
                      <CardActionArea onClick={() => setStructureView(structure)}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <ArchitectureIcon sx={{ color: '#00d4ff' }} />
                            <Typography variant="h6" sx={{ color: '#fff' }}>
                              {structure.name}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                            {structure.description}
                          </Typography>
                          <Chip
                            label={`${structure.beats.length} story beats`}
                            size="small"
                            sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff' }}
                          />
                          <Chip
                            label={`${structure.totalPages} sider`}
                            size="small"
                            sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                          />
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              // Template grid
              <Grid container spacing={2}>
                {filteredTemplates.length === 0 ? (
                  <Grid size={{ xs: 12 }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center', py: 4 }}>
                      Ingen maler funnet
                    </Typography>
                  </Grid>
                ) : (
                  filteredTemplates.map(template => (
                    <Grid key={template.id} size={{ xs: 12, sm: 6 }}>
                      <Card
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.08)',
                            borderColor: '#00d4ff'
                          }
                        }}
                      >
                        <CardActionArea
                          onClick={() => handleApply(template)}
                          sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                        >
                          <CardContent sx={{ flexGrow: 1, width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TemplateIcon iconName={template.icon} sx={{ color: '#00d4ff', fontSize: '1.2rem' }} />
                                <Typography variant="h6" sx={{ color: '#fff', fontSize: '1rem' }}>
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
                                  sx={{ color: '#f44336', ml: 1 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1.5 }}>
                              {template.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {template.tags.slice(0, 3).map(tag => (
                                <Chip
                                  key={tag}
                                  label={tag}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(0,212,255,0.1)',
                                    color: '#00d4ff',
                                    fontSize: '0.7rem',
                                    height: 20
                                  }}
                                />
                              ))}
                            </Box>
                          </CardContent>
                        </CardActionArea>
                        <Box sx={{ 
                          display: 'flex', 
                          gap: 0.5, 
                          p: 1, 
                          borderTop: '1px solid rgba(255,255,255,0.1)' 
                        }}>
                          <Tooltip title="Forhåndsvis">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTemplate(template);
                              }}
                              sx={{ color: 'rgba(255,255,255,0.87)' }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Bruk mal">
                            <IconButton
                              size="small"
                              onClick={() => handleApply(template)}
                              sx={{ color: '#00d4ff' }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Card>
                    </Grid>
                  ))
                )}
              </Grid>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.87)' }}>
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
            bgcolor: '#1a1a1a',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TemplateIcon iconName={previewTemplate?.icon} sx={{ color: '#00d4ff' }} />
            <Box component="span" sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 500 }}>
              {previewTemplate?.name}
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mt: 0.5 }}>
            {previewTemplate?.description}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Paper
            sx={{
              p: 2,
              bgcolor: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'Courier New, monospace',
              fontSize: '14px',
              color: '#fff',
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflowY: 'auto'
            }}
          >
            {previewTemplate?.content}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button onClick={() => setPreviewTemplate(null)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
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
              bgcolor: '#00d4ff',
              color: '#000',
              '&:hover': { bgcolor: '#00b8e6' }
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
            bgcolor: '#1a1a1a',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArchitectureIcon sx={{ color: '#00d4ff' }} />
            <Box component="span" sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 500 }}>
              {structureView?.name}
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mt: 0.5 }}>
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
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={typeof beat.page === 'number' ? `s.${beat.page}` : `s.${beat.page.min}-${beat.page.max}`}
                          size="small"
                          sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', fontWeight: 600 }}
                        />
                        <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                          {beat.name}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 0.5 }}>
                        {beat.description}
                      </Typography>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button onClick={() => setStructureView(null)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
