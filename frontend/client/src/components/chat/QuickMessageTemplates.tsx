/**
 * Quick Message Templates for Wedding Day
 * One-tap messaging for team coordination
 * Supports built-in + user-created custom templates
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Paper,
  Chip,
  Typography,
  Collapse,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Schedule,
  LocationOn,
  Camera,
  Group,
  Restaurant,
  Warning,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Send,
  Add,
  Edit,
  Delete,
  Save,
  Star,
  Bookmark,
} from '@mui/icons-material';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface QuickTemplate {
  id: string;
  label: string;
  message: string;
  icon: React.ReactNode;
  color: string;
  category: 'status' | 'location' | 'timing' | 'coordination' | 'custom';
  isCustom?: boolean;
}

/** Serialisable version stored in localStorage / DB */
interface StoredCustomTemplate {
  id: string;
  label: string;
  message: string;
  color: string;
  category: 'status' | 'location' | 'timing' | 'coordination' | 'custom';
}

export interface QuickMessageTemplatesProps {
  onSelectTemplate: (message: string) => void;
  profession?: string;
  currentEvent?: string;
  /** Additional built-in templates to merge in */
  extraTemplates?: QuickTemplate[];
  /** Key for localStorage scoping (e.g. per-user or per-widget) */
  storageKey?: string;
  /** Compact mode - smaller chips, no header text */
  compact?: boolean;
}

// ---------------------------------------------------------------
// Built-in wedding day templates — profession-contextual
// ---------------------------------------------------------------

/** Core templates shown to ALL professions */
const CORE_TEMPLATES: QuickTemplate[] = [
  // Status Updates
  {
    id: 'ceremony-starting',
    label: 'Seremoni starter',
    message: '🎊 Seremonien starter nå!',
    icon: <Schedule />,
    color: '#E91E63',
    category: 'status',
  },
  {
    id: 'reception-entrance',
    label: 'Mottakelse',
    message: '🎉 Paret gjør sin entre i salen nå',
    icon: <Restaurant />,
    color: '#FF9800',
    category: 'status',
  },
  // Timing
  {
    id: 'delay-15',
    label: '15 min forsinket',
    message: '⏰ Vi er 15 minutter bak tidsplanen',
    icon: <Warning />,
    color: '#FF9800',
    category: 'timing',
  },
  {
    id: 'delay-30',
    label: '30 min forsinket',
    message: '⚠️ Vi er 30 minutter bak tidsplanen',
    icon: <Warning />,
    color: '#F44336',
    category: 'timing',
  },
  {
    id: 'back-on-schedule',
    label: 'I rute igjen',
    message: '✅ Vi er tilbake i rute!',
    icon: <CheckCircle />,
    color: '#4CAF50',
    category: 'timing',
  },
  // Location
  {
    id: 'moving-venue',
    label: 'Til lokalet',
    message: '🚗 Vi drar til neste lokale nå',
    icon: <LocationOn />,
    color: '#2196F3',
    category: 'location',
  },
  {
    id: 'at-location',
    label: 'På plass',
    message: '📍 På plass og klar',
    icon: <LocationOn />,
    color: '#9C27B0',
    category: 'location',
  },
  // Coordination
  {
    id: 'break-time',
    label: 'Tar pause',
    message: '☕ Tar en 15 min pause',
    icon: <Schedule />,
    color: '#795548',
    category: 'status',
  },
];

/** Profession-specific templates — only shown when matching */
const PROFESSION_TEMPLATES: Record<string, QuickTemplate[]> = {
  photographer: [
    {
      id: 'photo-ready',
      label: 'Klar for bilder',
      message: '📸 Klar for gruppebilder — samle gjestene!',
      icon: <Camera />,
      color: '#2196F3',
      category: 'coordination',
    },
    {
      id: 'photo-golden-hour',
      label: 'Gyllen time',
      message: '🌅 Gyllen time om 30 min — perfekt lys for portretter',
      icon: <Camera />,
      color: '#FF9800',
      category: 'timing',
    },
    {
      id: 'photo-garden',
      label: 'Til hagen',
      message: '🌳 Vi flytter til hagen for portretter',
      icon: <LocationOn />,
      color: '#4CAF50',
      category: 'location',
    },
    {
      id: 'photo-need-second',
      label: 'Trenger fotograf 2',
      message: '🎥 Trenger andrefotograf i mottakelsessalen',
      icon: <Group />,
      color: '#FF5722',
      category: 'coordination',
    },
    {
      id: 'photo-shots-done',
      label: 'Bilder ferdig',
      message: '✅ Alle bilder for denne delen er tatt!',
      icon: <CheckCircle />,
      color: '#4CAF50',
      category: 'status',
    },
    {
      id: 'photo-firstlook',
      label: 'First look klar',
      message: '👀 Klare for first look — hold alle borte fra utsiktspunktet',
      icon: <Camera />,
      color: '#E91E63',
      category: 'coordination',
    },
  ],
  videographer: [
    {
      id: 'video-rolling',
      label: 'Kamera ruller',
      message: '🎬 Kamera ruller — stille på settet!',
      icon: <Camera />,
      color: '#F44336',
      category: 'status',
    },
    {
      id: 'video-drone',
      label: 'Drone i luften',
      message: '🚁 Dronen er i luften — hold avstand',
      icon: <Camera />,
      color: '#2196F3',
      category: 'status',
    },
    {
      id: 'video-audio-check',
      label: 'Lydsjekk',
      message: '🎤 Lydsjekk nødvendig før talen starter',
      icon: <Camera />,
      color: '#FF9800',
      category: 'coordination',
    },
    {
      id: 'video-broll',
      label: 'B-roll ferdig',
      message: '🎞️ B-roll detaljer er i boks',
      icon: <CheckCircle />,
      color: '#4CAF50',
      category: 'status',
    },
    {
      id: 'video-battery',
      label: 'Bytter batteri',
      message: '🔋 Bytter batteri — 2 min pause',
      icon: <Schedule />,
      color: '#795548',
      category: 'timing',
    },
  ],
  dj: [
    {
      id: 'dj-soundcheck',
      label: 'Lydsjekk klar',
      message: '🔊 Lydsjekk fullført — alt er klart',
      icon: <CheckCircle />,
      color: '#4CAF50',
      category: 'status',
    },
    {
      id: 'dj-first-dance',
      label: 'Førstdans',
      message: '💃 Klar for førstdans — signal når dere vil',
      icon: <Schedule />,
      color: '#E91E63',
      category: 'coordination',
    },
    {
      id: 'dj-speeches',
      label: 'Taler begynner',
      message: '🎤 Klar for taler — mikrofon er testet',
      icon: <Schedule />,
      color: '#2196F3',
      category: 'coordination',
    },
    {
      id: 'dj-party-start',
      label: 'Fest starter',
      message: '🎶 Dansegulvet åpner — fest i gang!',
      icon: <CheckCircle />,
      color: '#9C27B0',
      category: 'status',
    },
  ],
  florist: [
    {
      id: 'florist-delivered',
      label: 'Blomster levert',
      message: '💐 Alle blomster er levert og plassert',
      icon: <CheckCircle />,
      color: '#4CAF50',
      category: 'status',
    },
    {
      id: 'florist-bouquet',
      label: 'Bukett klar',
      message: '🌸 Brudebukett og brudgommens blomst er klare',
      icon: <CheckCircle />,
      color: '#E91E63',
      category: 'status',
    },
    {
      id: 'florist-setup',
      label: 'Dekor i gang',
      message: '🌺 Sette opp dekorasjonene — ferdig om 30 min',
      icon: <Schedule />,
      color: '#FF9800',
      category: 'timing',
    },
  ],
  planner: [
    {
      id: 'planner-timeline-update',
      label: 'Tidsplan oppdatert',
      message: '📋 Tidsplanen er oppdatert — sjekk appen',
      icon: <Schedule />,
      color: '#2196F3',
      category: 'coordination',
    },
    {
      id: 'planner-vendors-briefed',
      label: 'Leverandører briefet',
      message: '✅ Alle leverandører er briefet og klare',
      icon: <Group />,
      color: '#4CAF50',
      category: 'coordination',
    },
    {
      id: 'planner-guests-seated',
      label: 'Gjester på plass',
      message: '👥 Alle gjestene har satt seg — klare til å begynne',
      icon: <Group />,
      color: '#4CAF50',
      category: 'status',
    },
  ],
  caterer: [
    {
      id: 'caterer-ready',
      label: 'Mat klar',
      message: '🍽️ Maten er klar til servering',
      icon: <Restaurant />,
      color: '#FF9800',
      category: 'status',
    },
    {
      id: 'caterer-cake',
      label: 'Kake klar',
      message: '🎂 Bryllupskaken er på plass og klar',
      icon: <Restaurant />,
      color: '#E91E63',
      category: 'status',
    },
    {
      id: 'caterer-cleanup',
      label: 'Rydding startet',
      message: '🧹 Rydding av middagen har startet',
      icon: <Schedule />,
      color: '#795548',
      category: 'status',
    },
  ],
};

/** Map loose profession strings to template keys */
function normalizeProfession(p: string): string {
  const lower = p.toLowerCase();
  if (lower.includes('photo') || lower.includes('fotograf')) return 'photographer';
  if (lower.includes('video') || lower.includes('film')) return 'videographer';
  if (lower.includes('dj') || lower.includes('musikk') || lower.includes('music')) return 'dj';
  if (lower.includes('florist') || lower.includes('blomst')) return 'florist';
  if (lower.includes('planner') || lower.includes('koordinator') || lower.includes('planlegger')) return 'planner';
  if (lower.includes('cater') || lower.includes('kokk') || lower.includes('mat')) return 'caterer';
  return lower;
}

/** Get the right templates for a profession */
function getTemplatesForProfession(profession: string): QuickTemplate[] {
  const key = normalizeProfession(profession);
  const profSpecific = PROFESSION_TEMPLATES[key] || [];
  return [...profSpecific, ...CORE_TEMPLATES];
}

// ---------------------------------------------------------------
// Helper: icon for custom templates by category
// ---------------------------------------------------------------
function iconForCategory(category: string): React.ReactNode {
  switch (category) {
    case 'status': return <CheckCircle />;
    case 'location': return <LocationOn />;
    case 'timing': return <Schedule />;
    case 'coordination': return <Group />;
    default: return <Star />;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  status: '#4CAF50',
  timing: '#FF9800',
  location: '#2196F3',
  coordination: '#FF5722',
  custom: '#9C27B0',
};

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

export default function QuickMessageTemplates({
  onSelectTemplate,
  profession = 'photographer',
  currentEvent,
  extraTemplates = [],
  storageKey = 'quick-msg-templates-custom',
  compact = false,
}: QuickMessageTemplatesProps) {
  const theming = useTheming(profession);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customTemplates, setCustomTemplates] = useState<QuickTemplate[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StoredCustomTemplate | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Form state for create / edit
  const [formLabel, setFormLabel] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formCategory, setFormCategory] = useState<StoredCustomTemplate['category']>('custom');
  const [formColor, setFormColor] = useState('#9C27B0');

  // ---- Persistence --------------------------------------------------

  const loadCustomTemplates = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const stored: StoredCustomTemplate[] = JSON.parse(raw);
        setCustomTemplates(
          stored.map((t) => ({
            ...t,
            icon: iconForCategory(t.category),
            isCustom: true,
          })),
        );
      }
    } catch (e) {
      console.warn('Failed to load custom templates:', e);
    }
  }, [storageKey]);

  const saveCustomTemplates = useCallback(
    (templates: QuickTemplate[]) => {
      try {
        const stored: StoredCustomTemplate[] = templates.map((t) => ({
          id: t.id,
          label: t.label,
          message: t.message,
          color: t.color,
          category: t.category,
        }));
        localStorage.setItem(storageKey, JSON.stringify(stored));
      } catch (e) {
        console.warn('Failed to save custom templates:', e);
      }
    },
    [storageKey],
  );

  useEffect(() => {
    loadCustomTemplates();
  }, [loadCustomTemplates]);

  // Also persist to server when available
  useEffect(() => {
    if (customTemplates.length > 0) {
      fetch('/api/user/ui-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ quickMessageTemplates: customTemplates.map((t) => ({ id: t.id, label: t.label, message: t.message, color: t.color, category: t.category })) }),
      }).catch(() => { /* silent - server may not have this endpoint yet */ });
    }
  }, [customTemplates]);

  // ---- CRUD ---------------------------------------------------------

  const resetForm = () => {
    setFormLabel('');
    setFormMessage('');
    setFormCategory('custom');
    setFormColor('#9C27B0');
    setEditingTemplate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (template: QuickTemplate) => {
    setFormLabel(template.label);
    setFormMessage(template.message);
    setFormCategory(template.category);
    setFormColor(template.color);
    setEditingTemplate({ id: template.id, label: template.label, message: template.message, color: template.color, category: template.category });
    setCreateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!formLabel.trim() || !formMessage.trim()) {
      setSnackbar({ open: true, message: 'Label og melding er påkrevd', severity: 'error' });
      return;
    }

    let updated: QuickTemplate[];

    if (editingTemplate) {
      // Update existing
      updated = customTemplates.map((t) =>
        t.id === editingTemplate.id
          ? { ...t, label: formLabel.trim(), message: formMessage.trim(), category: formCategory, color: formColor, icon: iconForCategory(formCategory) }
          : t,
      );
    } else {
      // Create new
      const newTemplate: QuickTemplate = {
        id: `custom-${Date.now()}`,
        label: formLabel.trim(),
        message: formMessage.trim(),
        icon: iconForCategory(formCategory),
        color: formColor,
        category: formCategory,
        isCustom: true,
      };
      updated = [...customTemplates, newTemplate];
    }

    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setCreateDialogOpen(false);
    resetForm();
    setSnackbar({ open: true, message: editingTemplate ? 'Mal oppdatert!' : 'Ny mal opprettet!', severity: 'success' });
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updated = customTemplates.filter((t) => t.id !== templateId);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setSnackbar({ open: true, message: 'Mal slettet', severity: 'success' });
  };

  // ---- Filtering ----------------------------------------------------

  const categories = [
    { value: 'all', label: 'Alle' },
    { value: 'status', label: 'Status' },
    { value: 'timing', label: 'Tid' },
    { value: 'location', label: 'Sted' },
    { value: 'coordination', label: 'Team' },
    ...(customTemplates.length > 0 ? [{ value: 'custom', label: '⭐ Mine' }] : []),
  ];

  const allTemplates = [...getTemplatesForProfession(profession), ...extraTemplates, ...customTemplates];
  const filteredTemplates =
    selectedCategory === 'all' ? allTemplates : allTemplates.filter((t) => t.category === selectedCategory);

  // ---- Render -------------------------------------------------------

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          mb: 1,
          overflow: 'hidden',
          borderRadius: 2,
          borderLeft: `3px solid ${theming.colors.primary}`,
        }}
      >
        {/* Header - Click to Expand */}
        <Box
          onClick={() => setIsExpanded(!isExpanded)}
          sx={{
            p: compact ? 1 : 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            bgcolor: '#F5F5F5',
            '&:hover': { bgcolor: '#EEEEEE' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Send sx={{ fontSize: 16, color: theming.colors.primary }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#757575' }}>
              ⚡ Hurtigmeldinger{currentEvent ? ` — ${currentEvent}` : ''}
            </Typography>
            {customTemplates.length > 0 && (
              <Chip label={`+${customTemplates.length} egne`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#9C27B020', color: '#9C27B0' }} />
            )}
          </Box>
          <IconButton size="small">
            {isExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Templates - Collapsible */}
        <Collapse in={isExpanded}>
          <Box sx={{ p: 2, bgcolor: 'white' }}>
            {/* Category Filters */}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              {categories.map((cat) => (
                <Chip
                  key={cat.value}
                  label={cat.label}
                  size="small"
                  onClick={() => setSelectedCategory(cat.value)}
                  color={selectedCategory === cat.value ? 'primary' : 'default'}
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
              <Tooltip title="Opprett ny mal">
                <IconButton size="small" onClick={openCreateDialog} sx={{ ml: 'auto' }}>
                  <Add fontSize="small" sx={{ color: theming.colors.primary }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Template Chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, color: theming.colors.primary }}>
              {filteredTemplates.map((template) => (
                <Tooltip key={template.id} title={template.message} placement="top">
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                    <Chip
                      icon={template.icon as React.ReactElement}
                      label={template.label}
                      onClick={() => {
                        onSelectTemplate(template.message);
                        setIsExpanded(false);
                      }}
                      onDelete={
                        template.isCustom
                          ? () => handleDeleteTemplate(template.id)
                          : undefined
                      }
                      deleteIcon={template.isCustom ? <Delete fontSize="small" /> : undefined}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: `${template.color}15`,
                        border: `1px solid ${template.color}`,
                        color: template.color,
                        fontWeight: 500,
                        '&:hover': { bgcolor: `${template.color}30` },
                      }}
                    />
                    {template.isCustom && (
                      <IconButton size="small" onClick={() => openEditDialog(template)} sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}>
                        <Edit sx={{ fontSize: 12, color: template.color }} />
                      </IconButton>
                    )}
                  </Box>
                </Tooltip>
              ))}
              {filteredTemplates.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  Ingen maler i denne kategorien
                </Typography>
              )}
            </Box>

            {/* Footer tip */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                💡 Trykk på en mal for å sende meldingen
              </Typography>
              <Button size="small" startIcon={<Add />} onClick={openCreateDialog} sx={{ fontSize: '0.7rem', textTransform: 'none' }}>
                Ny mal
              </Button>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={createDialogOpen} onClose={() => { setCreateDialogOpen(false); resetForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: theming.colors.primary, color: 'white' }}>
          {editingTemplate ? <Edit /> : <Bookmark />}
          {editingTemplate ? 'Rediger hurtigmelding' : 'Opprett ny hurtigmelding'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            fullWidth
            label="Navn / Label"
            placeholder="f.eks. Fremme ved kirken"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            inputProps={{ maxLength: 40 }}
            helperText={`${formLabel.length}/40`}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Melding"
            placeholder="f.eks. 🏛️ Vi er fremme ved kirken og klare!"
            value={formMessage}
            onChange={(e) => setFormMessage(e.target.value)}
            inputProps={{ maxLength: 200 }}
            helperText={`${formMessage.length}/200`}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as StoredCustomTemplate['category'])}
                label="Kategori"
              >
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="timing">Tid</MenuItem>
                <MenuItem value="location">Sted</MenuItem>
                <MenuItem value="coordination">Team</MenuItem>
                <MenuItem value="custom">Egendefinert</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Farge</InputLabel>
              <Select
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                label="Farge"
              >
                {Object.entries(CATEGORY_COLORS).map(([key, col]) => (
                  <MenuItem key={key} value={col}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: col }} />
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Box>
                  </MenuItem>
                ))}
                <MenuItem value="#E91E63">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: '#E91E63' }} />
                    Rosa
                  </Box>
                </MenuItem>
                <MenuItem value="#795548">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: '#795548' }} />
                    Brun
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Preview */}
          {formLabel && formMessage && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Forhåndsvisning:
              </Typography>
              <Chip
                icon={iconForCategory(formCategory) as React.ReactElement}
                label={formLabel}
                sx={{
                  bgcolor: `${formColor}15`,
                  border: `1px solid ${formColor}`,
                  color: formColor,
                  fontWeight: 500,
                }}
              />
              <Typography variant="body2" sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                {formMessage}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setCreateDialogOpen(false); resetForm(); }}>Avbryt</Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            startIcon={<Save />}
            disabled={!formLabel.trim() || !formMessage.trim()}
            sx={{ bgcolor: theming.colors.primary, '&:hover': { filter: 'brightness(0.9)' } }}
          >
            {editingTemplate ? 'Oppdater' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

