/**
 * ExportTemplatesPanel - UI for selecting and managing export templates
 * 
 * Features:
 * - Browse pre-built templates
 * - Create custom templates
 * - Preview export details
 * - Apply templates to scheduler
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  PlayArrow,
  Schedule,
  CloudUpload,
  Add,
  Edit,
  Delete,
  ContentCopy,
  Search,
  Folder,
  Timer,
  VideoFile,
  Favorite,
  FavoriteBorder,
  Star,
  // Template Icons
  Rocket,
  YouTube,
  Instagram,
  Smartphone,
  Inventory,
  Language,
  CardGiftcard,
  Palette,
  Movie,
  Visibility,
  BusinessCenter,
  WbSunny,
  DarkMode,
  Celebration,
  Public,
  Bolt,
  Chat,
  Archive,
  Save,
  // Category Icons
  Groups,
  Settings,
} from '@mui/icons-material';
import {
  exportTemplateService,
  ExportTemplate,
  ExportTemplateCategory,
  TEMPLATE_CATEGORIES,
  ScheduleConfig,
  TemplateIconName,
  CategoryIconName,
} from '../../core/animation/ExportTemplates';

// ============================================================================
// Icon Mapping
// ============================================================================

const TEMPLATE_ICONS: Record<TemplateIconName, React.ReactNode> = {
  Rocket: <Rocket />,
  YouTube: <YouTube />,
  Instagram: <Instagram />,
  Smartphone: <Smartphone />,
  Inventory: <Inventory />,
  Language: <Language />,
  CardGiftcard: <CardGiftcard />,
  Palette: <Palette />,
  Movie: <Movie />,
  Visibility: <Visibility />,
  BusinessCenter: <BusinessCenter />,
  WbSunny: <WbSunny />,
  DarkMode: <DarkMode />,
  Celebration: <Celebration />,
  Public: <Public />,
  Bolt: <Bolt />,
  Chat: <Chat />,
  Archive: <Archive />,
  Save: <Save />,
};

const CATEGORY_ICONS: Record<CategoryIconName, React.ReactNode> = {
  Smartphone: <Smartphone fontSize="small" />,
  Inventory: <Inventory fontSize="small" />,
  Palette: <Palette fontSize="small" />,
  Groups: <Groups fontSize="small" />,
  Archive: <Archive fontSize="small" />,
  Bolt: <Bolt fontSize="small" />,
  Schedule: <Schedule fontSize="small" />,
  Settings: <Settings fontSize="small" />,
};

function getTemplateIcon(iconName: TemplateIconName): React.ReactNode {
  return TEMPLATE_ICONS[iconName] || <VideoFile />;
}

function getCategoryIcon(iconName: CategoryIconName): React.ReactNode {
  return CATEGORY_ICONS[iconName] || <Folder fontSize="small" />;
}
import { exportScheduler } from '../../core/animation/ExportScheduler';
import { EXPORT_PRESETS } from '../../core/animation/GoogleDriveExportService';
import { preferencesApi } from '../../core/api/virtualStudioApi';
import { videoExportService } from '../../core/animation/VideoExportService';

// ============================================================================
// Types
// ============================================================================

interface ExportTemplatesPanelProps {
  duration: number;
  userId?: string;
  projectId?: string;
  projectName?: string;
  onTemplateApplied?: (template: ExportTemplate, jobIds: string[]) => void;
}

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: ExportTemplate;
  duration: number;
  isFavorite: boolean;
  onApply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
}

function TemplateCard({
  template,
  duration,
  isFavorite,
  onApply,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleFavorite,
}: TemplateCardProps) {
  const categoryConfig = TEMPLATE_CATEGORIES[template.category];
  const presets = exportTemplateService.getPresetsForTemplate(template.id);
  const estimatedTime = exportTemplateService.estimateDuration(template.id, duration);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a2a',
        borderLeft: `4px solid ${categoryConfig.color}`, '&:hover': {
          backgroundColor: '#222233',
        }}}
    >
      <CardContent sx={{ flex: 1, pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <Box sx={{ color: categoryConfig.color, display: 'flex', alignItems: 'center' }}>
            {getTemplateIcon(template.icon)}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ lineHeight: 1.2 }}>
              {template.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ color: categoryConfig.color, display: 'flex', alignItems: 'center' }}>
                {getCategoryIcon(categoryConfig.icon)}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {categoryConfig.label}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onToggleFavorite}>
            {isFavorite ? <Favorite color="error" fontSize="small" /> : <FavoriteBorder fontSize="small" />}
          </IconButton>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 12 }}>
          {template.description}
        </Typography>

        {/* Presets */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            Exports ({presets.length}):
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {presets.slice(0, 4).map((preset) => (
              <Chip
                key={preset.id}
                label={preset.icon}
                size="small"
                variant="outlined"
                sx={{ height: 22 '& .MuiChip-label': { px: 0.5 } }}
                title={preset.name}
              />
            ))}
            {presets.length > 4 && (
              <Chip
                label={`+${presets.length - 4}`}
                size="small"
                variant="outlined"
                sx={{ height: 22 }}
              />
            )}
          </Stack>
        </Box>

        {/* Info chips */}
        <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
          <Chip
            icon={<Timer sx={{ fontSize: 14 }} />}
            label={exportTemplateService.formatDuration(estimatedTime)}
            size="small"
            sx={{ height: 20, fontSize: 10 }}
          />
          {template.schedule.type !== 'immediate' && (
            <Chip
              icon={<Schedule sx={{ fontSize: 14 }} />}
              label={template.schedule.type}
              size="small"
              color="info"
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
          {template.uploadToDrive && (
            <Chip
              icon={<CloudUpload sx={{ fontSize: 14 }} />}
              label="Drive"
              size="small"
              color="success"
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
        </Stack>

        {/* Tags */}
        {template.tags.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {template.tags.slice(0, 3).map((tag) => (
              <Typography
                key={tag}
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  mr: 1,
                  fontSize: 10}}
              >
                #{tag}
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrow />}
          onClick={onApply}
          sx={{ flex: 1 }}
        >
          Apply
        </Button>
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={onDuplicate}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
        {onEdit && (
          <Tooltip title="Edit">
            <IconButton size="small" onClick={onEdit}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Delete">
            <IconButton size="small" onClick={onDelete} color="error">
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
}

// ============================================================================
// Create/Edit Template Dialog
// ============================================================================

interface TemplateDialogProps {
  open: boolean;
  template?: ExportTemplate | null;
  onClose: () => void;
  onSave: (template: Omit<ExportTemplate, 'id' | 'category'>) => void;
}

function TemplateDialog({ open, template, onClose, onSave }: TemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<TemplateIconName>('Inventory');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'delay' | 'specific_time'>('immediate');
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [specificTime, setSpecificTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [uploadToDrive, setUploadToDrive] = useState(true);
  const [createSubfolder, setCreateSubfolder] = useState(true);
  const [subfolderName, setSubfolderName] = useState('');
  const [tags, setTags] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setDescription(template.description);
        setIcon(template.icon);
        setSelectedPresets(template.presets);
        setScheduleType(template.schedule.type === 'recurring' ? 'specific_time' : template.schedule.type);
        setDelayMinutes(template.schedule.delayMinutes || 30);
        setSpecificTime(template.schedule.specificTime || '');
        setPriority(template.priority);
        setUploadToDrive(template.uploadToDrive);
        setCreateSubfolder(template.createSubfolder);
        setSubfolderName(template.subfolderName || '');
        setTags(template.tags.join(''));
      } else {
        setName('');
        setDescription('');
        setIcon('Inventory');
        setSelectedPresets([]);
        setScheduleType('immediate');
        setDelayMinutes(30);
        setSpecificTime('');
        setPriority('normal');
        setUploadToDrive(true);
        setCreateSubfolder(true);
        setSubfolderName('');
        setTags('');
      }
    }
  }, [open, template]);

  const handleSave = () => {
    const schedule: ScheduleConfig = {
      type: scheduleType,
      ...(scheduleType === 'delay' && { delayMinutes }),
      ...(scheduleType === 'specific_time' && { specificTime }),
    };

    onSave({
      name,
      description,
      icon,
      presets: selectedPresets,
      schedule,
      priority,
      uploadToDrive,
      createSubfolder,
      subfolderName: createSubfolder ? subfolderName : undefined,
      notifyOnComplete: true,
      tags: tags.split(', ').map((t) => t.trim()).filter(Boolean),
    });
    onClose();
  };

  const iconOptions: TemplateIconName[] = [
    'Inventory','Rocket','YouTube','Instagram','Movie','Palette','Smartphone','BusinessCenter','Language','Bolt','DarkMode','Celebration','Save','Visibility','Archive','CardGiftcard','Chat','Public', 'WbSunny'
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {template ? 'Edit Template' : 'Create Custom Template'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {/* Basic Info */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Basic Info
            </Typography>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" sx={{ width: 100 }}>
                  <InputLabel>Icon</InputLabel>
                  <Select
                    value={icon}
                    label="Icon"
                    onChange={(e) => setIcon(e.target.value as TemplateIconName)}
                    renderValue={(value) => (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getTemplateIcon(value)}
                      </Box>
                    )}
                  >
                    {iconOptions.map((i) => (
                      <MenuItem key={i} value={i}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getTemplateIcon(i)}
                          <Typography variant="caption">{i}</Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Template Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  size="small"
                  fullWidth
                />
              </Box>
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="small"
                multiline
                rows={2}
                fullWidth
              />
              <TextField
                label="Tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                size="small"
                fullWidth
                placeholder="social, fast, marketing"
              />
            </Stack>
          </Grid>

          {/* Schedule */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Schedule & Priority
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Schedule</InputLabel>
                <Select
                  value={scheduleType}
                  label="Schedule"
                  onChange={(e) => setScheduleType(e.target.value as any)}
                >
                  <MenuItem value="immediate">Immediate</MenuItem>
                  <MenuItem value="delay">Delay Start</MenuItem>
                  <MenuItem value="specific_time">Specific Time</MenuItem>
                </Select>
              </FormControl>
              {scheduleType === 'delay' && (
                <TextField
                  label="Delay (minutes)"
                  type="number"
                  value={delayMinutes}
                  onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 30)}
                  size="small"
                  fullWidth
                />
              )}
              {scheduleType === 'specific_time' && (
                <TextField
                  label="Time (HH:mm)"
                  value={specificTime}
                  onChange={(e) => setSpecificTime(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="18:00"
                />
              )}
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  label="Priority"
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Grid>

          {/* Presets Selection */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Export Presets
            </Typography>
            <Paper sx={{ p: 1.5, backgroundColor: '#111' }}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                {EXPORT_PRESETS.map((preset) => (
                  <Chip
                    key={preset.id}
                    label={`${preset.icon} ${preset.name}`}
                    onClick={() => {
                      if (selectedPresets.includes(preset.id)) {
                        setSelectedPresets(selectedPresets.filter((p) => p !== preset.id));
                      } else {
                        setSelectedPresets([...selectedPresets, preset.id]);
                      }
                    }}
                    color={selectedPresets.includes(preset.id) ? 'primary' : 'default'}
                    variant={selectedPresets.includes(preset.id) ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {selectedPresets.length} preset{selectedPresets.length !== 1 ? 's' : ', '} selected
              </Typography>
            </Paper>
          </Grid>

          {/* Options */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Options
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={uploadToDrive}
                    onChange={(e) => setUploadToDrive(e.target.checked)}
                  />
                }
                label="Upload to Google Drive"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={createSubfolder}
                    onChange={(e) => setCreateSubfolder(e.target.checked)}
                    disabled={!uploadToDrive}
                  />
                }
                label="Create Subfolder"
              />
            </Stack>
            {createSubfolder && uploadToDrive && (
              <TextField
                label="Subfolder Name"
                value={subfolderName}
                onChange={(e) => setSubfolderName(e.target.value)}
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                placeholder="e.g., Social Media Export"
              />
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!name || selectedPresets.length === 0}
        >
          {template ? 'Save Changes' : 'Create Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function ExportTemplatesPanel({
  duration,
  userId,
  projectId,
  projectName,
  onTemplateApplied,
}: ExportTemplatesPanelProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExportTemplateCategory | 'all'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);

  // Load templates
  useEffect(() => {
    setTemplates(exportTemplateService.getAllTemplates());
    
    // Load favorites from database with localStorage fallback
    const loadFavorites = async () => {
      try {
        const prefs = await preferencesApi.get();
        if (prefs?.favoriteTemplates) {
          setFavorites(new Set(prefs.favoriteTemplates));
          return;
        }
      } catch {
        // Database failed, try localStorage
      }
      
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem('virtualStudio_favoriteTemplates');
        if (saved) {
          setFavorites(new Set(JSON.parse(saved)));
        }
      } catch {
        // Ignore localStorage errors
      }
    };
    
    loadFavorites();
  }, []);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      result = exportTemplateService.searchTemplates(searchQuery);
      if (categoryFilter !== 'all') {
        result = result.filter((t) => t.category === categoryFilter);
      }
    }

    // Favorites filter
    if (showFavoritesOnly) {
      result = result.filter((t) => favorites.has(t.id));
    }

    return result;
  }, [templates, categoryFilter, searchQuery, showFavoritesOnly, favorites]);

  // Handlers
  const handleApplyTemplate = useCallback((template: ExportTemplate) => {
    const batchConfig = exportTemplateService.toBatchConfig(template, 
      userId ? { userId, projectId, projectName } : undefined
    );
    
    const jobIds = exportScheduler.createBatchExport(duration, batchConfig);
    
    // Handle scheduling if not immediate
    if (template.schedule.type !== 'immediate') {
      // The scheduler handles this internally based on the job configuration
    }

    onTemplateApplied?.(template, jobIds);
  }, [duration, userId, projectId, projectName, onTemplateApplied]);

  const handleToggleFavorite = useCallback((templateId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(templateId)) {
      newFavorites.delete(templateId);
    } else {
      newFavorites.add(templateId);
    }
    setFavorites(newFavorites);
    
    // Save to database and localStorage
    const favoritesArray = [...newFavorites];
    localStorage.setItem('virtualStudio_favoriteTemplates', JSON.stringify(favoritesArray));
    preferencesApi.updateFavorites('templates', favoritesArray).catch(() => {
      // Ignore database errors, localStorage is backup
    });
  }, [favorites]);

  const handleDuplicate = useCallback((template: ExportTemplate) => {
    const newTemplate = exportTemplateService.duplicateTemplate(template.id);
    if (newTemplate) {
      setTemplates(exportTemplateService.getAllTemplates());
    }
  }, []);

  const handleCreateTemplate = useCallback((templateData: Omit<ExportTemplate, 'id' | , 'category'>) => {
    exportTemplateService.createCustomTemplate(templateData);
    setTemplates(exportTemplateService.getAllTemplates());
  }, []);

  const handleEditTemplate = useCallback((templateData: Omit<ExportTemplate, 'id' | 'category'>) => {
    if (editingTemplate) {
      exportTemplateService.updateCustomTemplate(editingTemplate.id, templateData);
      setTemplates(exportTemplateService.getAllTemplates());
      setEditingTemplate(null);
    }
  }, [editingTemplate]);

  const handleDeleteTemplate = useCallback((templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      exportTemplateService.deleteCustomTemplate(templateId);
      setTemplates(exportTemplateService.getAllTemplates());
    }
  }, []);

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const cat of Object.keys(TEMPLATE_CATEGORIES)) {
      counts[cat] = templates.filter((t) => t.category === cat).length;
    }
    return counts;
  }, [templates]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Star />
          Export Templates
          <Chip label={templates.length} size="small" sx={{ ml: 1 }} />
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={() => {
            setEditingTemplate(null);
            setDialogOpen(true);
          }}
        >
          New Template
        </Button>
      </Box>

      {/* Search and Filters */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )}}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            displayEmpty
          >
            <MenuItem value="all">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Folder fontSize="small" />
                All Categories ({categoryCounts.all})
              </Box>
            </MenuItem>
            {Object.entries(TEMPLATE_CATEGORIES).map(([key, config]) => (
              <MenuItem key={key} value={key}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: config.color }}>
                  {getCategoryIcon(config.icon)}
                  <Typography sx={{ color: 'text.primary' }}>
                    {config.label} ({categoryCounts[key] || 0})
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title={showFavoritesOnly ? 'Show All' : 'Favorites Only'}>
          <IconButton
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            color={showFavoritesOnly ? 'error' : 'default'}
          >
            {showFavoritesOnly ? <Favorite /> : <FavoriteBorder />}
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Quick Stats */}
      <Alert severity="info" sx={{ mb: 2 }}>
        Animation duration: {videoExportService.formatDuration(duration)} • 
        {favorites.size} favorite{favorites.size !== 1 ? 's' : ', '}
      </Alert>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: '#1a1a2a' }}>
          <Typography color="text.secondary">
            No templates found. Try adjusting your filters or create a new template.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredTemplates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <TemplateCard
                template={template}
                duration={duration}
                isFavorite={favorites.has(template.id)}
                onApply={() => handleApplyTemplate(template)}
                onEdit={template.category === 'custom' ? () => {
                  setEditingTemplate(template);
                  setDialogOpen(true);
                } : undefined}
                onDelete={template.category ==='custom' ? () => handleDeleteTemplate(template.id) : undefined}
                onDuplicate={() => handleDuplicate(template)}
                onToggleFavorite={() => handleToggleFavorite(template.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <TemplateDialog
        open={dialogOpen}
        template={editingTemplate}
        onClose={() => {
          setDialogOpen(false);
          setEditingTemplate(null);
        }}
        onSave={editingTemplate ? handleEditTemplate : handleCreateTemplate}
      />
    </Box>
  );
}

export default ExportTemplatesPanel;

