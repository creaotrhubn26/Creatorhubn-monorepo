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
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import type {
  CameraTemplate,
  CameraTemplateCategory,
  CameraTemplateSearchFilters} from '../../data/camera-templates';
import {
  cameraTemplateManager
} from '../../data/camera-templates';

interface CameraTemplateManagerProps {
  onTemplateSelect?: (template: CameraTemplate) => void;
  onTemplateSave?: (template: CameraTemplate) => void;
  selectedTemplateId?: string;
  projectType?: string;
  culture?: string;
  profession?: string;
}

interface TemplateFormState {
  id?: string;
  name: string;
  description: string;
  category: CameraTemplate['category'];
  profession: CameraTemplate['profession'];
  phase: CameraTemplate['phase'];
  culture?: string;
  isPublic: boolean;
  tags: string;
}

const CATEGORY_VALUES: CameraTemplate['category'][] = [
  'wedding',
  'event',
  'commercial',
  'portrait',
  'cinema',
  'documentary',
  'sports',
  'travel',
  'custom',
];

const PROFESSION_VALUES: CameraTemplate['profession'][] = ['photographer', 'videographer', 'both'];
const PHASE_VALUES: NonNullable<CameraTemplate['phase']>[] = [
  'pre-production',
  'production',
  'post-production',
  'all',
];

export const CameraTemplateManagerComponent: React.FC<CameraTemplateManagerProps> = ({
  onTemplateSelect,
  onTemplateSave,
  selectedTemplateId,
  projectType = 'wedding',
  culture,
  profession = 'both',
}) => {
  const theming = useTheming('photographer');
  const [tab, setTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CameraTemplate | null>(null);
  const [shareToken, setShareToken] = useState('');
  const [importJson, setImportJson] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ severity: 'success' | 'info' | 'warning' | 'error'; message: string } | null>(null);

  const [filters, setFilters] = useState<CameraTemplateSearchFilters>({
    category: projectType,
    profession,
    culture,
  });

  const [form, setForm] = useState<TemplateFormState>(() => createEmptyForm(projectType, profession, culture));

  const categories = useMemo<CameraTemplateCategory[]>(() => cameraTemplateManager.getCategories(), []);
  const templates = useMemo<CameraTemplate[]>(
    () => cameraTemplateManager.searchTemplates(filters),
    [filters, statusMessage],
  );
  const recommendedTemplates = useMemo<CameraTemplate[]>(
    () => cameraTemplateManager.getRecommendedTemplates('current-user', projectType, culture),
    [projectType, culture, statusMessage],
  );
  const activeTemplateId = selectedTemplateId || selectedTemplate?.id;
  const visibleTemplates = tab === 1 ? recommendedTemplates : templates;

  const openCreateDialog = (template?: CameraTemplate) => {
    if (template) {
      setForm({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        profession: template.profession,
        phase: template.phase ?? 'all',
        culture: template.culture,
        isPublic: template.isPublic,
        tags: template.tags.join(', '),
      });
    } else {
      setForm(createEmptyForm(projectType, profession, culture));
    }
    setCreateDialogOpen(true);
  };

  const saveTemplate = () => {
    const name = form.name.trim();
    if (name.length === 0) {
      setStatusMessage({ severity: 'error', message: 'Template må ha et navn' });
      return;
    }

    const category = toCategory(form.category);
    const professionValue = toProfession(form.profession);
    const phaseValue = toPhase(form.phase);
    const tags = parseTags(form.tags);
    const sourceTemplate = form.id ? cameraTemplateManager.getTemplate(form.id) : null;
    const payload = buildTemplatePayload(sourceTemplate, {
      name,
      description: form.description.trim(),
      category,
      profession: professionValue,
      phase: phaseValue,
      culture: form.culture?.trim() || undefined,
      isPublic: form.isPublic,
      tags,
    });

    let savedTemplate: CameraTemplate | null;
    if (form.id) {
      savedTemplate = cameraTemplateManager.updateTemplate(form.id, payload);
    } else {
      savedTemplate = cameraTemplateManager.createTemplate(payload);
    }

    if (!savedTemplate) {
      setStatusMessage({ severity: 'error', message: 'Kunne ikke lagre template' });
      return;
    }

    setStatusMessage({ severity: 'success', message: 'Template lagret' });
    setSelectedTemplate(savedTemplate);
    onTemplateSave?.(savedTemplate);
    setCreateDialogOpen(false);
  };

  const removeTemplate = (templateId: string) => {
    const success = cameraTemplateManager.deleteTemplate(templateId);
    if (success) {
      setStatusMessage({ severity: 'success', message: 'Template slettet' });
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    } else {
      setStatusMessage({ severity: 'error', message: 'Kunne ikke slette template' });
    }
  };

  const generateShareToken = () => {
    if (!selectedTemplate) {
      setStatusMessage({ severity: 'warning', message: 'Velg en template først' });
      return;
    }
    const token = cameraTemplateManager.shareTemplate(selectedTemplate.id, 'copy');
    if (!token) {
      setStatusMessage({ severity: 'error', message: 'Kunne ikke opprette delelenke' });
      return;
    }
    setShareToken(token);
    setShareDialogOpen(true);
  };

  const exportSelectedTemplate = async () => {
    if (!selectedTemplate) {
      setStatusMessage({ severity: 'warning', message: 'Velg en template først' });
      return;
    }
    const data = cameraTemplateManager.exportTemplates([selectedTemplate.id]);
    await navigator.clipboard.writeText(data);
    setStatusMessage({ severity: 'success', message: 'Template JSON kopiert til utklippstavle' });
  };

  const importTemplates = () => {
    const result = cameraTemplateManager.importTemplates(importJson);
    if (result.failed > 0) {
      setStatusMessage({
        severity: 'warning',
        message: `Importert ${result.success}, feilet ${result.failed}`,
      });
    } else {
      setStatusMessage({
        severity: 'success',
        message: `Importert ${result.success} templates`,
      });
    }
    setImportDialogOpen(false);
    setImportJson('');
  };

  return (
    <Box>
      {statusMessage && (
        <Alert
          severity={statusMessage.severity}
          sx={{ mb: 2 }}
          onClose={() => setStatusMessage(null)}
        >
          {statusMessage.message}
        </Alert>
      )}

      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="center">
            <Box>
              <Typography variant="h6">Camera Template Manager</Typography>
              <Typography variant="caption" color="text.secondary">
                Administrer presets for kamera-oppsett per prosjekt og arbeidsflyt.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<UploadIcon />} onClick={() => setImportDialogOpen(true)}>
                Import
              </Button>
              <Button startIcon={<DownloadIcon />} onClick={exportSelectedTemplate}>
                Export
              </Button>
              <Button startIcon={<ShareIcon />} onClick={generateShareToken}>
                Del
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreateDialog()}>
                Ny template
              </Button>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="template-filter-category">Kategori</InputLabel>
                <Select
                  labelId="template-filter-category"
                  label="Kategori"
                  value={String(filters.category ?? '')}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      category: event.target.value || undefined,
                    }))
                  }
                >
                  <MenuItem value="">Alle</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="template-filter-profession">Profesjon</InputLabel>
                <Select
                  labelId="template-filter-profession"
                  label="Profesjon"
                  value={String(filters.profession ?? '')}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      profession: event.target.value || undefined,
                    }))
                  }
                >
                  <MenuItem value="">Alle</MenuItem>
                  {PROFESSION_VALUES.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                size="small"
                label="Kultur"
                value={filters.culture ?? ''}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    culture: event.target.value || undefined,
                  }))
                }
                fullWidth
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
          <Tab label={`Templates (${templates.length})`} />
          <Tab label={`Recommended (${recommendedTemplates.length})`} />
        </Tabs>
        <Divider />
        <CardContent>
          {visibleTemplates.length === 0 ? (
            <Typography color="text.secondary">Ingen templates matcher filteret.</Typography>
          ) : (
            <List>
              {visibleTemplates.map((template) => (
                <ListItem
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    cameraTemplateManager.useTemplate(template.id, 'current-user');
                    onTemplateSelect?.(template);
                  }}
                  selected={activeTemplateId === template.id}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => openCreateDialog(template)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => removeTemplate(template.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 600 }}>{template.name}</Typography>
                        <Chip size="small" label={template.category} />
                        <Chip size="small" label={template.profession} />
                        {template.isPublic && <Chip size="small" color="success" label="public" />}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {template.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Usage {template.usageCount} • Rating {template.rating ?? 0}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Rediger template' : 'Ny template'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Navn"
              value={form.name}
              onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={form.description}
              onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
              multiline
              minRows={2}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="template-form-category">Kategori</InputLabel>
                  <Select
                    labelId="template-form-category"
                    label="Kategori"
                    value={form.category}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        category: toCategory(String(event.target.value)),
                      }))
                    }
                  >
                    {CATEGORY_VALUES.map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="template-form-profession">Profesjon</InputLabel>
                  <Select
                    labelId="template-form-profession"
                    label="Profesjon"
                    value={form.profession}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        profession: toProfession(String(event.target.value)),
                      }))
                    }
                  >
                    {PROFESSION_VALUES.map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="template-form-phase">Fase</InputLabel>
                  <Select
                    labelId="template-form-phase"
                    label="Fase"
                    value={form.phase ?? 'all'}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        phase: toPhase(String(event.target.value)),
                      }))
                    }
                  >
                    {PHASE_VALUES.map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Kultur"
                  value={form.culture ?? ''}
                  onChange={(event) => setForm((previous) => ({ ...previous, culture: event.target.value }))}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Tags (komma-separert)"
              value={form.tags}
              onChange={(event) => setForm((previous) => ({ ...previous, tags: event.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="template-form-public">Synlighet</InputLabel>
              <Select
                labelId="template-form-public"
                label="Synlighet"
                value={form.isPublic ? 'public' : 'private'}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    isPublic: event.target.value === 'public',
                  }))
                }
              >
                <MenuItem value="private">Private</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={saveTemplate}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>Del template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Deltoken
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField value={shareToken} size="small" fullWidth InputProps={{ readOnly: true }} />
            <Button
              startIcon={<ContentCopyIcon />}
              onClick={async () => {
                await navigator.clipboard.writeText(shareToken);
                setStatusMessage({ severity: 'success', message: 'Token kopiert' });
              }}
            >
              Kopier
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Importer templates</DialogTitle>
        <DialogContent>
          <TextField
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
            placeholder="Lim inn eksportert JSON..."
            multiline
            minRows={12}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={importTemplates} disabled={importJson.trim().length === 0}>
            Importer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

function createEmptyForm(projectType: string, profession: string, culture?: string): TemplateFormState {
  return {
    name: '',
    description: '',
    category: toCategory(projectType),
    profession: toProfession(profession),
    phase: 'all',
    culture,
    isPublic: false,
    tags: '',
  };
}

function buildTemplatePayload(
  sourceTemplate: CameraTemplate | null,
  updates: {
    name: string;
    description: string;
    category: CameraTemplate['category'];
    profession: CameraTemplate['profession'];
    phase: CameraTemplate['phase'];
    culture?: string;
    isPublic: boolean;
    tags: string[];
  },
): Omit<CameraTemplate, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'usageCount'> {
  const baseline = sourceTemplate ?? getDefaultTemplateBlueprint();
  return {
    ...baseline,
    name: updates.name,
    description: updates.description,
    category: updates.category,
    profession: updates.profession,
    phase: updates.phase ?? 'all',
    culture: updates.culture,
    isPublic: updates.isPublic,
    tags: updates.tags,
    createdBy: sourceTemplate?.createdBy ?? 'current-user',
    isDefault: sourceTemplate?.isDefault ?? false,
    shareSettings: sourceTemplate?.shareSettings ?? {
      isShared: false,
      permissions: 'copy',
    },
    reviews: sourceTemplate?.reviews ?? [],
    rating: sourceTemplate?.rating ?? 0,
    lastUsed: sourceTemplate?.lastUsed,
    backupCamera: sourceTemplate?.backupCamera,
    primaryCamera: sourceTemplate?.primaryCamera ?? {},
    additionalCameras: sourceTemplate?.additionalCameras ?? [],
    lenses: sourceTemplate?.lenses ?? [],
    accessories: sourceTemplate?.accessories ?? [],
    settings: sourceTemplate?.settings ?? getDefaultTemplateBlueprint().settings,
    workflow: sourceTemplate?.workflow ?? getDefaultTemplateBlueprint().workflow,
  };
}

function getDefaultTemplateBlueprint(): Omit<
  CameraTemplate,
  'id' | 'createdAt' | 'updatedAt' | 'version' | 'usageCount'
> {
  return {
    name: 'Ny template',
    description: '',
    category: 'custom',
    profession: 'both',
    culture: undefined,
    phase: 'all',
    primaryCamera: {},
    backupCamera: undefined,
    additionalCameras: [],
    lenses: [],
    accessories: [],
    settings: {
      video: {
        resolution: '4K',
        frameRate: '25fps',
        colorSpace: 'Rec.709',
        codec: 'H.264',
      },
      photo: {
        fileFormat: 'raw+jpeg',
        quality: 'high',
        colorSpace: 'sRGB',
        whiteBalance: 'auto',
      },
    },
    workflow: {
      backupStrategy: 'realtime',
      backupFrequency: 30,
      memoryCardLabeling: 'ABCD',
      estimatedPhotos: 500,
      estimatedVideoHours: 4,
      estimatedStorage: '256',
    },
    createdBy: 'current-user',
    isPublic: false,
    isDefault: false,
    tags: [],
    lastUsed: undefined,
    rating: 0,
    reviews: [],
    shareSettings: {
      isShared: false,
      permissions: 'copy',
    },
  };
}

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function toCategory(value: string | CameraTemplate['category']): CameraTemplate['category'] {
  return CATEGORY_VALUES.includes(value as CameraTemplate['category'])
    ? (value as CameraTemplate['category'])
    : 'custom';
}

function toProfession(value: string | CameraTemplate['profession']): CameraTemplate['profession'] {
  return PROFESSION_VALUES.includes(value as CameraTemplate['profession'])
    ? (value as CameraTemplate['profession'])
    : 'both';
}

function toPhase(
  value: string | CameraTemplate['phase'] | undefined,
): CameraTemplate['phase'] {
  if (value && PHASE_VALUES.includes(value as NonNullable<CameraTemplate['phase']>)) {
    return value as NonNullable<CameraTemplate['phase']>;
  }
  return 'all';
}

export default CameraTemplateManagerComponent;
