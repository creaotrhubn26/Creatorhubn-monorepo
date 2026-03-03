import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  CheckCircle,
  Delete,
  Description,
  Edit,
  Preview,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: 'wedding' | 'corporate' | 'event' | 'portrait' | 'commercial' | 'documentary';
  content: string;
  variables: string[];
  isPublic: boolean;
  isDefault: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

interface VideographerContractTemplatesProps {
  projectId?: string;
  onTemplateSelect?: (template: ContractTemplate) => void;
  onTemplateGenerated?: (template: ContractTemplate, generatedContent: string) => void;
}

const LOCAL_KEY = 'videographer_contract_templates';

const DEFAULT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'default-wedding',
    name: 'Wedding Film Agreement',
    description: 'Standard agreement for wedding video production.',
    category: 'wedding',
    content:
      'Client: {{clientName}}\nEvent date: {{eventDate}}\nLocation: {{location}}\nPackage: {{packageName}}\nTotal fee: {{price}}',
    variables: ['clientName', 'eventDate', 'location', 'packageName', 'price'],
    isPublic: false,
    isDefault: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default-commercial',
    name: 'Commercial Production Contract',
    description: 'Contract template for branded commercial productions.',
    category: 'commercial',
    content:
      'Brand: {{brandName}}\nProject scope: {{scope}}\nDelivery date: {{deliveryDate}}\nFee: {{price}}\nRights: {{rights}}',
    variables: ['brandName', 'scope', 'deliveryDate', 'price', 'rights'],
    isPublic: false,
    isDefault: true,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function loadLocalTemplates(): ContractTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      return DEFAULT_TEMPLATES;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ContractTemplate[]) : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function saveLocalTemplates(templates: ContractTemplate[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(templates));
  } catch {
    // Ignore local storage failures.
  }
}

function parseTemplatesFromPayload(payload: unknown): ContractTemplate[] {
  if (Array.isArray(payload)) {
    return payload as ContractTemplate[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: ContractTemplate[] }).data;
  }

  return [];
}

function categoryColor(category: ContractTemplate['category']): 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'default' {
  switch (category) {
    case 'wedding':
      return 'primary';
    case 'corporate':
      return 'secondary';
    case 'event':
      return 'success';
    case 'portrait':
      return 'warning';
    case 'commercial':
      return 'info';
    case 'documentary':
    default:
      return 'default';
  }
}

function extractVariables(content: string): string[] {
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const variables = new Set<string>();

  for (const match of content.matchAll(regex)) {
    variables.add(match[1]);
  }

  return [...variables];
}

function defaultVariableValues(variables: string[]): Record<string, string> {
  return variables.reduce<Record<string, string>>((accumulator, variable) => {
    accumulator[variable] = '';
    return accumulator;
  }, {});
}

function fillTemplateContent(template: ContractTemplate, values: Record<string, string>): string {
  return template.content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, variable: string) => {
    return values[variable] ?? `{{${variable}}}`;
  });
}

export default function VideographerContractTemplates({
  projectId,
  onTemplateSelect,
  onTemplateGenerated,
}: VideographerContractTemplatesProps) {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ContractTemplate>>({
    name: '',
    description: '',
    category: 'wedding',
    content: '',
    isPublic: false,
    isDefault: false,
  });
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const templatesQueryKey = useMemo(
    () => ['/api/contract-templates', projectId ?? 'default'],
    [projectId],
  );

  const { data: templates = [], isLoading, isError } = useQuery({
    queryKey: templatesQueryKey,
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/contract-templates/${projectId ?? 'default'}`);
        const parsed = parseTemplatesFromPayload(response);
        if (parsed.length > 0) {
          saveLocalTemplates(parsed);
          return parsed;
        }
      } catch {
        // Local fallback handled below.
      }

      return loadLocalTemplates();
    },
  });

  const createTemplate = useMutation({
    mutationFn: async (template: ContractTemplate) => {
      try {
        await apiRequest('/api/contract-templates/create', {
          method: 'POST',
          body: { ...template, projectId },
        });
      } catch {
        // Local fallback still updates state.
      }

      const next = [template, ...templates];
      saveLocalTemplates(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(templatesQueryKey, next);
      setFormOpen(false);
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        category: 'wedding',
        content: '',
        isPublic: false,
        isDefault: false,
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async (template: ContractTemplate) => {
      try {
        await apiRequest(`/api/contract-templates/${template.id}`, {
          method: 'PUT',
          body: template,
        });
      } catch {
        // Local fallback still updates state.
      }

      const next = templates.map((candidate) => (candidate.id === template.id ? template : candidate));
      saveLocalTemplates(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(templatesQueryKey, next);
      setFormOpen(false);
      setEditingTemplate(null);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      try {
        await apiRequest(`/api/contract-templates/${templateId}`, { method: 'DELETE' });
      } catch {
        // Local fallback still updates state.
      }

      const next = templates.filter((template) => template.id !== templateId);
      saveLocalTemplates(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(templatesQueryKey, next);
    },
  });

  const handleSaveTemplate = () => {
    if (!formData.name || !formData.content || !formData.category) {
      return;
    }

    const templatePayload: ContractTemplate = {
      id: editingTemplate?.id ?? `template-${Date.now()}`,
      name: formData.name,
      description: formData.description ?? '',
      category: formData.category,
      content: formData.content,
      variables: extractVariables(formData.content),
      isPublic: formData.isPublic ?? false,
      isDefault: formData.isDefault ?? false,
      usageCount: editingTemplate?.usageCount ?? 0,
      lastUsed: editingTemplate?.lastUsed,
      createdAt: editingTemplate?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (editingTemplate) {
      updateTemplate.mutate(templatePayload);
    } else {
      createTemplate.mutate(templatePayload);
    }
  };

  const handleOpenPreview = (template: ContractTemplate) => {
    setPreviewTemplate(template);
    setVariableValues(defaultVariableValues(template.variables));
    setPreviewOpen(true);
    onTemplateSelect?.(template);
  };

  const generatedContent = previewTemplate
    ? fillTemplateContent(previewTemplate, variableValues)
    : '';

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Description color="primary" />
          Contract Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingTemplate(null);
            setFormData({
              name: '',
              description: '',
              category: 'wedding',
              content: '',
              isPublic: false,
              isDefault: false,
            });
            setFormOpen(true);
          }}
        >
          New Template
        </Button>
      </Box>

      {isError && <Alert severity="warning" sx={{ mb: 2 }}>API unavailable, using local templates.</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : templates.length === 0 ? (
        <Alert severity="info">No templates yet.</Alert>
      ) : (
        <Grid container spacing={2}>
          {templates.map((template) => (
            <Grid item xs={12} md={6} key={template.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography variant="h6">{template.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {template.description}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label={template.category} color={categoryColor(template.category)} size="small" />
                        {template.isDefault && <Chip label="Default" icon={<CheckCircle fontSize="small" />} size="small" />}
                        {template.isPublic && <Chip label="Public" size="small" variant="outlined" />}
                        <Chip label={`${template.variables.length} vars`} size="small" variant="outlined" />
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Preview / Generate">
                        <IconButton size="small" onClick={() => handleOpenPreview(template)}>
                          <Preview fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingTemplate(template);
                            setFormData(template);
                            setFormOpen(true);
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteTemplate.mutate(template.id)}
                          disabled={deleteTemplate.isPending || template.isDefault}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingTemplate ? 'Edit template' : 'Create template'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Template name"
              value={formData.name ?? ''}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description ?? ''}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Category"
              value={formData.category ?? 'wedding'}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  category: event.target.value as ContractTemplate['category'],
                }))
              }
              fullWidth
            >
              <MenuItem value="wedding">Wedding</MenuItem>
              <MenuItem value="corporate">Corporate</MenuItem>
              <MenuItem value="event">Event</MenuItem>
              <MenuItem value="portrait">Portrait</MenuItem>
              <MenuItem value="commercial">Commercial</MenuItem>
              <MenuItem value="documentary">Documentary</MenuItem>
            </TextField>
            <TextField
              label="Template content"
              multiline
              minRows={8}
              helperText="Use variables like {{clientName}} and {{eventDate}}."
              value={formData.content ?? ''}
              onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
              fullWidth
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {extractVariables(formData.content ?? '').map((variable) => (
                <Chip key={variable} size="small" label={variable} variant="outlined" />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveTemplate}
            variant="contained"
            disabled={createTemplate.isPending || updateTemplate.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generate Contract</DialogTitle>
        <DialogContent>
          {previewTemplate && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {previewTemplate.variables.map((variable) => (
                <TextField
                  key={variable}
                  label={variable}
                  value={variableValues[variable] ?? ''}
                  onChange={(event) =>
                    setVariableValues((prev) => ({ ...prev, [variable]: event.target.value }))
                  }
                  fullWidth
                />
              ))}

              <Alert severity="info">Preview updates live as you fill in variables.</Alert>

              <TextField multiline minRows={10} value={generatedContent} fullWidth />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!previewTemplate) {
                return;
              }

              onTemplateGenerated?.(previewTemplate, generatedContent);
              setPreviewOpen(false);
            }}
          >
            Use Contract
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
