import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Business,
  Event,
  LibraryMusic,
  Palette,
  PhotoLibrary,
  VideoLibrary,
} from '@mui/icons-material';

export interface Template {
  id: string;
  name: string;
  description: string;
  categories: string[];
  defaultSettings: {
    layout: 'grid' | 'masonry' | 'carousel';
    itemsPerRow: number;
    showStats: boolean;
    allowComments: boolean;
    primaryColor?: string;
  };
  profession: string;
  icon: React.ReactNode;
  preview?: string;
}

interface ShowcaseTemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
  profession:
    | 'photographer'
    | 'videographer'
    | 'music_producer'
    | 'vendor'
    | 'admin'
    | 'enterprise';
}

interface CustomTemplateState {
  name: string;
  description: string;
  categories: string;
  layout: 'grid' | 'masonry' | 'carousel';
  itemsPerRow: number;
  showStats: boolean;
  allowComments: boolean;
  primaryColor: string;
}

const PROFESSION_TEMPLATES: Record<string, Omit<Template, 'icon'>[]> = {
  photographer: [
    {
      id: 'photo-wedding',
      name: 'Wedding Showcase',
      description: 'Romantic visual layout for wedding storytelling.',
      categories: ['Highlights', 'Ceremony', 'Reception', 'Portraits'],
      defaultSettings: {
        layout: 'masonry',
        itemsPerRow: 3,
        showStats: true,
        allowComments: true,
        primaryColor: '#d4a574',
      },
      profession: 'photographer',
      preview: 'Masonry wall for mixed portrait and wide images.',
    },
    {
      id: 'photo-editorial',
      name: 'Editorial Grid',
      description: 'Clean magazine-style portfolio presentation.',
      categories: ['Cover', 'Fashion', 'Portrait', 'Black & White'],
      defaultSettings: {
        layout: 'grid',
        itemsPerRow: 4,
        showStats: false,
        allowComments: false,
        primaryColor: '#334155',
      },
      profession: 'photographer',
      preview: 'Tight grid with crisp metadata overlays.',
    },
  ],
  videographer: [
    {
      id: 'video-documentary',
      name: 'Documentary Reel',
      description: 'Story-first showcase for long-form and short edits.',
      categories: ['Opening', 'Narrative', 'Interview', 'B-roll'],
      defaultSettings: {
        layout: 'carousel',
        itemsPerRow: 2,
        showStats: true,
        allowComments: true,
        primaryColor: '#0f766e',
      },
      profession: 'videographer',
      preview: 'Large preview-first carousel for motion content.',
    },
    {
      id: 'video-commercial',
      name: 'Commercial Grid',
      description: 'Fast browsing for ad and promo deliverables.',
      categories: ['Ads', 'Social', 'Brand', 'Behind-the-scenes'],
      defaultSettings: {
        layout: 'grid',
        itemsPerRow: 3,
        showStats: true,
        allowComments: false,
        primaryColor: '#2563eb',
      },
      profession: 'videographer',
      preview: 'Balanced grid with hover trailer cards.',
    },
  ],
  music_producer: [
    {
      id: 'music-release',
      name: 'Release Showcase',
      description: 'Album and single-focused listening wall.',
      categories: ['Singles', 'Albums', 'Collaborations', 'Live'],
      defaultSettings: {
        layout: 'grid',
        itemsPerRow: 4,
        showStats: true,
        allowComments: true,
        primaryColor: '#7c3aed',
      },
      profession: 'music_producer',
      preview: 'Audio cards with waveform and release metadata.',
    },
  ],
  vendor: [
    {
      id: 'vendor-catalog',
      name: 'Vendor Catalog',
      description: 'Product-led showcase with category clarity.',
      categories: ['Featured', 'Bundles', 'Gear', 'Services'],
      defaultSettings: {
        layout: 'grid',
        itemsPerRow: 4,
        showStats: false,
        allowComments: false,
        primaryColor: '#ea580c',
      },
      profession: 'vendor',
      preview: 'Catalog cards optimized for conversion.',
    },
  ],
  admin: [
    {
      id: 'admin-review',
      name: 'Admin Review Board',
      description: 'Operations and quality review layout.',
      categories: ['Pending', 'Approved', 'Flagged', 'Archived'],
      defaultSettings: {
        layout: 'grid',
        itemsPerRow: 3,
        showStats: true,
        allowComments: true,
        primaryColor: '#0f172a',
      },
      profession: 'admin',
      preview: 'Moderation and analytics-first board view.',
    },
  ],
  enterprise: [
    {
      id: 'enterprise-brand',
      name: 'Enterprise Brand Hub',
      description: 'Global brand and campaign showcase mode.',
      categories: ['Campaigns', 'Assets', 'Regional', 'Performance'],
      defaultSettings: {
        layout: 'masonry',
        itemsPerRow: 3,
        showStats: true,
        allowComments: true,
        primaryColor: '#1d4ed8',
      },
      profession: 'enterprise',
      preview: 'Cross-team campaign grid with KPI context.',
    },
  ],
};

const getIconForProfession = (value: string): React.ReactNode => {
  switch (value) {
    case 'photographer':
      return <PhotoLibrary />;
    case 'videographer':
      return <VideoLibrary />;
    case 'music_producer':
      return <LibraryMusic />;
    case 'vendor':
      return <Palette />;
    case 'admin':
      return <Event />;
    default:
      return <Business />;
  }
};

const defaultCustomTemplate = (): CustomTemplateState => ({
  name: '',
  description: '',
  categories: '',
  layout: 'grid',
  itemsPerRow: 3,
  showStats: true,
  allowComments: true,
  primaryColor: '#ff6b30',
});

const ShowcaseTemplateSelector: React.FC<ShowcaseTemplateSelectorProps> = ({
  open,
  onClose,
  onSelectTemplate,
  profession,
}) => {
  const [customTemplate, setCustomTemplate] = useState<CustomTemplateState>(
    defaultCustomTemplate(),
  );
  const [showCustomForm, setShowCustomForm] = useState(false);

  const templates = useMemo<Template[]>(() => {
    const source = PROFESSION_TEMPLATES[profession] ?? [];
    return source.map((template) => ({
      ...template,
      icon: getIconForProfession(template.profession),
    }));
  }, [profession]);

  const handleTemplateSelect = (template: Template): void => {
    onSelectTemplate(template);
    onClose();
  };

  const handleCreateCustomTemplate = (): void => {
    const categories = customTemplate.categories
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const template: Template = {
      id: `custom-${Date.now()}`,
      name: customTemplate.name.trim(),
      description: customTemplate.description.trim(),
      categories,
      defaultSettings: {
        layout: customTemplate.layout,
        itemsPerRow: customTemplate.itemsPerRow,
        showStats: customTemplate.showStats,
        allowComments: customTemplate.allowComments,
        primaryColor: customTemplate.primaryColor,
      },
      profession,
      icon: getIconForProfession(profession),
      preview: 'Custom template created in Story Arc Studio.',
    };

    handleTemplateSelect(template);
    setShowCustomForm(false);
    setCustomTemplate(defaultCustomTemplate());
  };

  const isCustomValid =
    customTemplate.name.trim().length > 1 &&
    customTemplate.categories
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean).length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Choose Showcase Template</DialogTitle>
      <DialogContent>
        {!showCustomForm ? (
          <Stack spacing={2}>
            <Alert severity="info">
              Select a prebuilt template for {profession.replace('_', ' ')} workflows or create a custom one.
            </Alert>

            <Grid container spacing={2}>
              {templates.map((template) => (
                <Grid item xs={12} md={6} key={template.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 3,
                      },
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {template.icon}
                          <Typography variant="h6">{template.name}</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {template.description}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {template.categories.slice(0, 4).map((category) => (
                            <Chip key={category} label={category} size="small" />
                          ))}
                          {template.categories.length > 4 ? (
                            <Chip label={`+${template.categories.length - 4}`} size="small" />
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Layout: {template.defaultSettings.layout} • {template.defaultSettings.itemsPerRow} items/row
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}

              <Grid item xs={12} md={6}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    borderStyle: 'dashed',
                    '&:hover': {
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => setShowCustomForm(true)}
                >
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Palette />
                        <Typography variant="h6">Create Custom Template</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Build a tailored showcase layout for your exact Story Arc workflow.
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="h6">Custom Template</Typography>
            <TextField
              label="Template Name"
              value={customTemplate.name}
              onChange={(event) =>
                setCustomTemplate((prev) => ({ ...prev, name: event.target.value }))
              }
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={customTemplate.description}
              onChange={(event) =>
                setCustomTemplate((prev) => ({ ...prev, description: event.target.value }))
              }
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Categories (comma separated)"
              value={customTemplate.categories}
              onChange={(event) =>
                setCustomTemplate((prev) => ({ ...prev, categories: event.target.value }))
              }
              fullWidth
              helperText="Example: Highlights, Behind the Scenes, Final Delivery"
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="layout-select-label">Layout</InputLabel>
                  <Select
                    labelId="layout-select-label"
                    label="Layout"
                    value={customTemplate.layout}
                    onChange={(event) =>
                      setCustomTemplate((prev) => ({
                        ...prev,
                        layout: event.target.value as CustomTemplateState['layout'],
                      }))
                    }
                  >
                    <MenuItem value="grid">Grid</MenuItem>
                    <MenuItem value="masonry">Masonry</MenuItem>
                    <MenuItem value="carousel">Carousel</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Items Per Row"
                  type="number"
                  value={customTemplate.itemsPerRow}
                  inputProps={{ min: 1, max: 8 }}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isNaN(parsed)) {
                      setCustomTemplate((prev) => ({ ...prev, itemsPerRow: parsed }));
                    }
                  }}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Primary Color"
              type="color"
              value={customTemplate.primaryColor}
              onChange={(event) =>
                setCustomTemplate((prev) => ({ ...prev, primaryColor: event.target.value }))
              }
              fullWidth
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {!showCustomForm ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button onClick={() => setShowCustomForm(false)}>Back</Button>
            <Button onClick={handleCreateCustomTemplate} variant="contained" disabled={!isCustomValid}>
              Create Template
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ShowcaseTemplateSelector;
