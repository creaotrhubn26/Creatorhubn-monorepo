import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Email,
  Preview,
  Save,
  Send,
  Settings,
  ShoppingCart,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import type { ProfessionFeatureConfig } from '../../../../shared/profession-feature-matrix';
import { PROFESSION_FEATURE_MATRIX } from '../../../../shared/profession-feature-matrix';
import {
  AdminButton,
  AdminCard,
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminTableContainer,
  StatusChip,
} from './design-system';

type ReceiptTemplateType = 'subscription' | 'marketplace-addon' | 'invoice' | 'refund';

type ReceiptSendTrigger = 'payment-success' | 'subscription-created' | 'addon-purchased' | 'manual';

interface ReceiptTemplate {
  id?: string;
  name: string;
  type: ReceiptTemplateType;
  category: string;
  subject: string;
  htmlTemplate: string;
  variables: string[];
  isActive: boolean;
  autoSend: boolean;
  sendTrigger: ReceiptSendTrigger;
  profession?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BusinessSettings {
  companyName: string;
  orgNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  primaryColor: string;
  termsUrl: string;
  privacyUrl: string;
}

interface MarketplaceFeature {
  profession: string;
  featureId: string;
  name: string;
  category: string;
  price: number;
  description: string;
}

const EMPTY_TEMPLATE: ReceiptTemplate = {
  name: '',
  type: 'subscription',
  category: 'subscription',
  subject: 'Kvittering for {{planName}}',
  htmlTemplate:
    '<h1>Takk for bestillingen, {{customerName}}</h1><p>Transaksjon: {{transactionId}}</p><p>Total: {{totalAmount}} NOK</p>',
  variables: ['customerName', 'transactionId', 'planName', 'totalAmount'],
  isActive: true,
  autoSend: true,
  sendTrigger: 'payment-success',
  profession: 'photographer',
};

const EMPTY_BUSINESS_SETTINGS: BusinessSettings = {
  companyName: 'CreatorHub AS',
  orgNumber: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  primaryColor: '#1976d2',
  termsUrl: '',
  privacyUrl: '',
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeTemplateType(value: unknown): ReceiptTemplateType {
  const candidate = asString(value);
  if (
    candidate === 'subscription' ||
    candidate === 'marketplace-addon' ||
    candidate === 'invoice' ||
    candidate === 'refund'
  ) {
    return candidate;
  }

  return 'subscription';
}

function normalizeSendTrigger(value: unknown): ReceiptSendTrigger {
  const candidate = asString(value);
  if (
    candidate === 'payment-success' ||
    candidate === 'subscription-created' ||
    candidate === 'addon-purchased' ||
    candidate === 'manual'
  ) {
    return candidate;
  }

  return 'payment-success';
}

function normalizeTemplates(raw: unknown): ReceiptTemplate[] {
  const root = asRecord(raw);
  const candidates = Array.isArray(raw)
    ? raw
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.items)
        ? root.items
        : [];

  return candidates
    .map((entry): ReceiptTemplate | null => {
      const record = asRecord(entry);
      const idRaw = record.id;
      const id = typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : undefined;
      const name = asString(record.name).trim();

      if (!name) {
        return null;
      }

      const variables = Array.isArray(record.variables)
        ? record.variables.filter((value): value is string => typeof value === 'string')
        : [];

      return {
        id,
        name,
        type: normalizeTemplateType(record.type),
        category: asString(record.category, 'general'),
        subject: asString(record.subject, 'Kvittering'),
        htmlTemplate: asString(record.htmlTemplate, EMPTY_TEMPLATE.htmlTemplate),
        variables,
        isActive: asBoolean(record.isActive, true),
        autoSend: asBoolean(record.autoSend, false),
        sendTrigger: normalizeSendTrigger(record.sendTrigger),
        profession: asString(record.profession, 'photographer'),
        createdAt: asString(record.createdAt),
        updatedAt: asString(record.updatedAt),
      } satisfies ReceiptTemplate;
    })
    .filter((template): template is ReceiptTemplate => template !== null);
}

function normalizeBusinessSettings(raw: unknown): BusinessSettings {
  const data = asRecord(raw);
  return {
    companyName: asString(data.companyName, EMPTY_BUSINESS_SETTINGS.companyName),
    orgNumber: asString(data.orgNumber),
    address: asString(data.address),
    phone: asString(data.phone),
    email: asString(data.email),
    website: asString(data.website),
    logoUrl: asString(data.logoUrl),
    primaryColor: asString(data.primaryColor, EMPTY_BUSINESS_SETTINGS.primaryColor),
    termsUrl: asString(data.termsUrl),
    privacyUrl: asString(data.privacyUrl),
  };
}

function startCase(text: string): string {
  return text
    .split('-')
    .filter((token) => token.length > 0)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function templateTypeLabel(type: ReceiptTemplateType): string {
  switch (type) {
    case 'subscription':
      return 'Subscription';
    case 'marketplace-addon':
      return 'Marketplace Add-on';
    case 'invoice':
      return 'Invoice';
    case 'refund':
      return 'Refund';
    default:
      return type;
  }
}

function buildPreviewHtml(template: ReceiptTemplate, business: BusinessSettings): string {
  const sampleData: Record<string, string> = {
    customerName: 'Ola Nordmann',
    transactionId: 'TX-2026-00123',
    planName: 'Story Arc Pro',
    totalAmount: '997',
    profession: template.profession ?? 'photographer',
    companyName: business.companyName,
    supportEmail: business.email || 'support@creatorhub.no',
  };

  const renderedBody = template.htmlTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return sampleData[key] ?? '';
  });

  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 760px; margin: 0 auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
      <div style="padding: 16px 20px; background: ${business.primaryColor}; color: #fff;">
        <h2 style="margin: 0; font-size: 20px;">${business.companyName}</h2>
        <p style="margin: 8px 0 0 0; opacity: .92;">${template.subject}</p>
      </div>
      <div style="padding: 20px; line-height: 1.6; color: #1f2937;">${renderedBody}</div>
      <div style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #475569;">
        <div>${business.address || 'Adresse ikke satt'}</div>
        <div>${business.email || 'E-post ikke satt'}</div>
      </div>
    </div>
  `;
}

export default function ReceiptTemplateManager() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();

  const [tabValue, setTabValue] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate | null>(null);
  const [templateDraft, setTemplateDraft] = useState<ReceiptTemplate>(EMPTY_TEMPLATE);
  const [businessDraft, setBusinessDraft] = useState<BusinessSettings>(EMPTY_BUSINESS_SETTINGS);

  const templatesQuery = useQuery({
    queryKey: ['/api/admin/receipt-templates'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/receipt-templates', { headers });
      return normalizeTemplates(response);
    },
  });

  const businessSettingsQuery = useQuery({
    queryKey: ['/api/admin/business-settings'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/business-settings', { headers });
      return normalizeBusinessSettings(response);
    },
  });

  const businessSettings = businessSettingsQuery.data ?? EMPTY_BUSINESS_SETTINGS;

  const marketplaceFeatures = useMemo<MarketplaceFeature[]>(() => {
    const rows: MarketplaceFeature[] = [];

    for (const [profession, config] of Object.entries(PROFESSION_FEATURE_MATRIX)) {
      const typedConfig = config as ProfessionFeatureConfig;
      const availableFeaturesEntries = Object.entries(typedConfig.availableFeatures) as Array<
        [string, ProfessionFeatureConfig['availableFeatures'][string]]
      >;

      for (const [featureId, feature] of availableFeaturesEntries) {
        if (feature.plan !== 'marketplace') {
          continue;
        }

        if (!feature.marketplacePrice || feature.marketplacePrice <= 0) {
          continue;
        }

        rows.push({
          profession,
          featureId,
          name: startCase(featureId),
          category: feature.marketplaceCategory ?? 'advanced-features',
          price: feature.marketplacePrice,
          description: feature.description,
        });
      }
    }

    return rows.sort((left, right) => right.price - left.price);
  }, []);

  const saveTemplateMutation = useMutation({
    mutationFn: async (payload: ReceiptTemplate) => {
      const headers = await auth.getAuthHeader();
      if (payload.id) {
        return apiRequest(`/api/admin/receipt-templates/${payload.id}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: { ...payload },
        });
      }

      return apiRequest('/api/admin/receipt-templates', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: { ...payload },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/receipt-templates'] });
      setEditorOpen(false);
      setSelectedTemplate(null);
      setTemplateDraft(EMPTY_TEMPLATE);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/receipt-templates/${templateId}`, {
        method: 'DELETE',
        headers,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/receipt-templates'] });
    },
  });

  const updateBusinessSettingsMutation = useMutation({
    mutationFn: async (payload: BusinessSettings) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/business-settings', {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: { ...payload },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/business-settings'] });
      setBusinessOpen(false);
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async (payload: { templateId: string; testEmail: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/receipt-templates/test-send', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: payload,
      });
    },
    onSuccess: () => {
      setTestDialogOpen(false);
      setTestEmail('');
    },
  });

  const templates = templatesQuery.data ?? [];
  const renderedPreview = selectedTemplate ? buildPreviewHtml(selectedTemplate, businessSettings) : '';

  const openCreateDialog = (type: ReceiptTemplateType) => {
    setSelectedTemplate(null);
    setTemplateDraft({
      ...EMPTY_TEMPLATE,
      type,
      category: type,
      name: `${templateTypeLabel(type)} Template`,
    });
    setEditorOpen(true);
  };

  const openEditDialog = (template: ReceiptTemplate) => {
    setSelectedTemplate(template);
    setTemplateDraft({ ...template, variables: [...template.variables] });
    setEditorOpen(true);
  };

  const openPreview = (template: ReceiptTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const openBusinessDialog = () => {
    setBusinessDraft(businessSettings);
    setBusinessOpen(true);
  };

  const canSaveTemplate = templateDraft.name.trim().length > 0 && templateDraft.subject.trim().length > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Receipt Template Manager
        </Typography>
        <Stack direction="row" spacing={1}>
          <AdminButton tone="secondary" startIcon={<Settings />} onClick={openBusinessDialog}>
            Business Settings
          </AdminButton>
          <AdminButton tone="primary" startIcon={<Add />} onClick={() => openCreateDialog('subscription')}>
            Ny template
          </AdminButton>
        </Stack>
      </Stack>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, value: number) => setTabValue(value)}>
          <Tab label="Templates" />
          <Tab label="Marketplace Features" />
        </Tabs>
      </Paper>

      {tabValue === 0 && (
        <>
          {templatesQuery.isLoading && <AdminLoading label="Laster templates..." />}
          {templatesQuery.isError && (
            <AdminError title="Kunne ikke hente templates." onRetry={() => templatesQuery.refetch()} />
          )}

          {!templatesQuery.isLoading && !templatesQuery.isError && (
            <AdminTableContainer ariaLabel="Kvitterings-templates">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Navn</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Auto Send</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id ?? template.name} hover>
                      <TableCell>{template.name}</TableCell>
                      <TableCell>
                        <Chip size="small" icon={<Email fontSize="small" />} label={templateTypeLabel(template.type)} />
                      </TableCell>
                      <TableCell>{template.autoSend ? 'Ja' : 'Nei'}</TableCell>
                      <TableCell>
                        <StatusChip
                          tone={template.isActive ? 'success' : 'neutral'}
                          label={template.isActive ? 'Aktiv' : 'Inaktiv'}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <IconButton aria-label="Rediger template" size="small" onClick={() => openEditDialog(template)}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton aria-label="Forhåndsvis template" size="small" onClick={() => openPreview(template)}>
                            <Preview fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label="Send testmail"
                            size="small"
                            onClick={() => {
                              if (template.id) {
                                setSelectedTemplate(template);
                                setTestDialogOpen(true);
                              }
                            }}
                            disabled={!template.id}
                          >
                            <Send fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label="Slett template"
                            size="small"
                            onClick={() => {
                              if (template.id) {
                                deleteTemplateMutation.mutate(template.id);
                              }
                            }}
                            disabled={!template.id || deleteTemplateMutation.isPending}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableContainer>
          )}

          {templates.length === 0 && !templatesQuery.isLoading && !templatesQuery.isError && (
            <Box sx={{ mt: 2 }}>
              <AdminEmpty
                title="Ingen templates funnet"
                description="Opprett første template for å aktivere kvitteringsflyt."
              />
            </Box>
          )}
        </>
      )}

      {tabValue === 1 && (
        <Grid container spacing={2}>
          {marketplaceFeatures.map((feature) => (
            <Grid item xs={12} md={6} lg={4} key={`${feature.profession}-${feature.featureId}`}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {feature.name}
                    </Typography>
                    <ShoppingCart color="action" fontSize="small" />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip size="small" label={feature.profession} />
                    <Chip size="small" color="primary" label={`${feature.price} NOK`} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {feature.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Kategori: {feature.category}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedTemplate ? 'Rediger template' : 'Ny template'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Navn"
                value={templateDraft.name}
                onChange={(event) => setTemplateDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="template-type-label">Type</InputLabel>
                <Select
                  labelId="template-type-label"
                  value={templateDraft.type}
                  label="Type"
                  onChange={(event) =>
                    setTemplateDraft((prev) => ({ ...prev, type: normalizeTemplateType(event.target.value) }))
                  }
                >
                  <MenuItem value="subscription">Subscription</MenuItem>
                  <MenuItem value="marketplace-addon">Marketplace Add-on</MenuItem>
                  <MenuItem value="invoice">Invoice</MenuItem>
                  <MenuItem value="refund">Refund</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={templateDraft.subject}
                onChange={(event) => setTemplateDraft((prev) => ({ ...prev, subject: event.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={8}
                label="HTML Template"
                value={templateDraft.htmlTemplate}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, htmlTemplate: event.target.value }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Variabler (komma-separert)"
                value={templateDraft.variables.join(', ')}
                onChange={(event) => {
                  const variables = event.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0);
                  setTemplateDraft((prev) => ({ ...prev, variables }));
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="send-trigger-label">Send Trigger</InputLabel>
                <Select
                  labelId="send-trigger-label"
                  label="Send Trigger"
                  value={templateDraft.sendTrigger}
                  onChange={(event) =>
                    setTemplateDraft((prev) => ({ ...prev, sendTrigger: normalizeSendTrigger(event.target.value) }))
                  }
                >
                  <MenuItem value="payment-success">payment-success</MenuItem>
                  <MenuItem value="subscription-created">subscription-created</MenuItem>
                  <MenuItem value="addon-purchased">addon-purchased</MenuItem>
                  <MenuItem value="manual">manual</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Profession"
                value={templateDraft.profession ?? ''}
                onChange={(event) =>
                  setTemplateDraft((prev) => ({ ...prev, profession: event.target.value || undefined }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" spacing={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={templateDraft.isActive}
                      onChange={(event) =>
                        setTemplateDraft((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                  }
                  label="Aktiv"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={templateDraft.autoSend}
                      onChange={(event) =>
                        setTemplateDraft((prev) => ({ ...prev, autoSend: event.target.checked }))
                      }
                    />
                  }
                  label="Auto Send"
                />
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setEditorOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<Save />}
            loading={saveTemplateMutation.isPending}
            disabled={!canSaveTemplate || saveTemplateMutation.isPending}
            onClick={() =>
              saveTemplateMutation.mutate({
                ...templateDraft,
                id: selectedTemplate?.id,
              })
            }
          >
            Lagre
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Preview</DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box
              sx={{
                p: 2,
                backgroundColor: '#fff',
                borderRadius: 1,
                border: '1px solid #e5e7eb',
              }}
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setPreviewOpen(false)}>Lukk</AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send testmail</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Test e-post"
            type="email"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setTestDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<Send />}
            loading={sendTestEmailMutation.isPending}
            disabled={!selectedTemplate?.id || !testEmail || sendTestEmailMutation.isPending}
            onClick={() => {
              if (!selectedTemplate?.id) {
                return;
              }

              sendTestEmailMutation.mutate({
                templateId: selectedTemplate.id,
                testEmail,
              });
            }}
          >
            Send
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog open={businessOpen} onClose={() => setBusinessOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Business Settings</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company name"
                value={businessDraft.companyName}
                onChange={(event) =>
                  setBusinessDraft((prev) => ({ ...prev, companyName: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Org number"
                value={businessDraft.orgNumber}
                onChange={(event) =>
                  setBusinessDraft((prev) => ({ ...prev, orgNumber: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={businessDraft.address}
                onChange={(event) => setBusinessDraft((prev) => ({ ...prev, address: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={businessDraft.phone}
                onChange={(event) => setBusinessDraft((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                value={businessDraft.email}
                onChange={(event) => setBusinessDraft((prev) => ({ ...prev, email: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Website"
                value={businessDraft.website}
                onChange={(event) => setBusinessDraft((prev) => ({ ...prev, website: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="color"
                label="Primary color"
                value={businessDraft.primaryColor}
                InputLabelProps={{ shrink: true }}
                onChange={(event) =>
                  setBusinessDraft((prev) => ({ ...prev, primaryColor: event.target.value }))
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setBusinessOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<Save />}
            loading={updateBusinessSettingsMutation.isPending}
            disabled={updateBusinessSettingsMutation.isPending}
            onClick={() => updateBusinessSettingsMutation.mutate(businessDraft)}
          >
            Lagre
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
