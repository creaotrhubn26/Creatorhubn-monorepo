import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddCircle as AddIcon,
  Analytics as AnalyticsIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Publish as PublishIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  ThumbUp as ThumbUpIcon,
  TrendingUp as TrendingUpIcon,
  VideoLibrary as VideoLibraryIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheming } from '../../utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { AdminCard, AdminButton, StatusChip, useIsMobile } from './design-system';

interface CMSField {
  id?: string;
  name: string;
  type: string;
  label: string;
  beskrivelse?: string;
  påkrevd?: boolean;
  defaultValue?: unknown;
  innstillinger?: Record<string, unknown>;
}

interface ContentType {
  id?: string;
  navn: string;
  beskrivelse?: string;
  profesjon?: string;
  felter?: string[];
}

interface CMSStats {
  totalFields: number;
  totalContentTypes: number;
  requiredFields: number;
  customFields: number;
}

interface ShowcaseItem {
  id: string;
  title: string;
  views: number;
  likes: number;
  shares: number;
  status: string;
}

interface YouTubeAnalytics {
  channelName: string;
  subscribers: number;
  views: number;
  watchTimeHours: number;
  ctrPercent: number;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

const EMPTY_FIELD: CMSField = {
  name: '',
  type: 'text',
  label: '',
  beskrivelse: '',
  påkrevd: false,
};

const EMPTY_CONTENT_TYPE: ContentType = {
  navn: '',
  beskrivelse: '',
  profesjon: '',
  felter: [],
};

export default function VisualCMSAdmin() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');
  const { getProfessionDisplayName } = useDynamicProfessions();

  const [tab, setTab] = useState(0);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [contentTypeDialogOpen, setContentTypeDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CMSField>(EMPTY_FIELD);
  const [editingContentType, setEditingContentType] = useState<ContentType>(EMPTY_CONTENT_TYPE);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const [deleteContentTypeId, setDeleteContentTypeId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const fetchWithAuth = async (url: string): Promise<unknown> => {
    const headers = await auth.getAuthHeader();
    return apiRequest(url, { headers });
  };

  const {
    data: fieldsRaw,
    isLoading: fieldsLoading,
    refetch: refetchFields,
  } = useQuery({
    queryKey: ['/api/cms/admin/fields'],
    queryFn: () => fetchWithAuth('/api/cms/admin/fields'),
    retry: false,
  });

  const {
    data: contentTypesRaw,
    isLoading: contentTypesLoading,
    refetch: refetchContentTypes,
  } = useQuery({
    queryKey: ['/api/cms/admin/content-types'],
    queryFn: () => fetchWithAuth('/api/cms/admin/content-types'),
    retry: false,
  });

  const { data: statsRaw, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/cms/admin/stats'],
    queryFn: () => fetchWithAuth('/api/cms/admin/stats'),
    retry: false,
  });

  const { data: showcasesRaw, isLoading: showcasesLoading } = useQuery({
    queryKey: ['/api/showcase/items/admin'],
    queryFn: () => fetchWithAuth('/api/showcase/items/admin'),
    retry: false,
  });

  const { data: youtubeRaw, isLoading: youtubeLoading } = useQuery({
    queryKey: ['/api/youtube/analytics'],
    queryFn: () => fetchWithAuth('/api/youtube/analytics'),
    retry: false,
  });

  const fields = useMemo(() => normalizeFields(fieldsRaw), [fieldsRaw]);
  const contentTypes = useMemo(() => normalizeContentTypes(contentTypesRaw), [contentTypesRaw]);
  const stats = useMemo(() => normalizeStats(statsRaw, fields, contentTypes), [statsRaw, fields, contentTypes]);
  const showcases = useMemo(() => normalizeShowcases(showcasesRaw), [showcasesRaw]);
  const youtubeAnalytics = useMemo(() => normalizeYoutubeAnalytics(youtubeRaw), [youtubeRaw]);

  const fieldMutation = useMutation({
    mutationFn: async (payload: CMSField) => {
      const headers = await auth.getAuthHeader();
      const method = payload.id ? 'PUT' : 'POST';
      const endpoint = payload.id
        ? `/api/cms/admin/fields/${payload.id}`
        : '/api/cms/admin/fields';
      return apiRequest(endpoint, {
        method,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/stats'] });
      setFieldDialogOpen(false);
      setEditingField(EMPTY_FIELD);
      setSnackbar({
        open: true,
        message: 'Felt lagret',
        severity: 'success',
      });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Kunne ikke lagre felt'),
        severity: 'error',
      });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/cms/admin/fields/${fieldId}`, {
        method: 'DELETE',
        headers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/stats'] });
      setDeleteFieldId(null);
      setSnackbar({
        open: true,
        message: 'Felt slettet',
        severity: 'success',
      });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Kunne ikke slette felt'),
        severity: 'error',
      });
    },
  });

  const contentTypeMutation = useMutation({
    mutationFn: async (payload: ContentType) => {
      const headers = await auth.getAuthHeader();
      const method = payload.id ? 'PUT' : 'POST';
      const endpoint = payload.id
        ? `/api/cms/admin/content-types/${payload.id}`
        : '/api/cms/admin/content-types';
      return apiRequest(endpoint, {
        method,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/content-types'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/stats'] });
      setContentTypeDialogOpen(false);
      setEditingContentType(EMPTY_CONTENT_TYPE);
      setSnackbar({
        open: true,
        message: 'Innholdstype lagret',
        severity: 'success',
      });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Kunne ikke lagre innholdstype'),
        severity: 'error',
      });
    },
  });

  const deleteContentTypeMutation = useMutation({
    mutationFn: async (contentTypeId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/cms/admin/content-types/${contentTypeId}`, {
        method: 'DELETE',
        headers,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/content-types'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cms/admin/stats'] });
      setDeleteContentTypeId(null);
      setSnackbar({
        open: true,
        message: 'Innholdstype slettet',
        severity: 'success',
      });
    },
    onError: (error: unknown) => {
      setSnackbar({
        open: true,
        message: getErrorMessage(error, 'Kunne ikke slette innholdstype'),
        severity: 'error',
      });
    },
  });

  const isLoading =
    fieldsLoading ||
    contentTypesLoading ||
    statsLoading ||
    showcasesLoading ||
    youtubeLoading;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ color: theming.colors.primary, fontWeight: 700 }}>
            Visual CMS Admin
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administrer felter, innholdstyper og publisering for profesjonsstyrte sider.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <AdminButton
            tone="secondary"
            startIcon={<SearchIcon />}
            onClick={() => {
              refetchFields();
              refetchContentTypes();
            }}
          >
            Oppdater data
          </AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingField(EMPTY_FIELD);
              setFieldDialogOpen(true);
            }}
          >
            Nytt felt
          </AdminButton>
        </Stack>
      </Stack>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="overline">Felter</Typography>
              <Typography variant="h5">{stats.totalFields}</Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.requiredFields} påkrevde
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="overline">Innholdstyper</Typography>
              <Typography variant="h5">{stats.totalContentTypes}</Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.customFields} med custom oppsett
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <VisibilityIcon fontSize="small" />
                <Typography variant="overline">Showcase visninger</Typography>
              </Stack>
              <Typography variant="h5">{showcases.reduce((sum, item) => sum + item.views, 0)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <AnalyticsIcon fontSize="small" />
                <Typography variant="overline">YouTube Subs</Typography>
              </Stack>
              <Typography variant="h5">{youtubeAnalytics.subscribers}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <PaperTabs tab={tab} onTabChange={setTab} />

      {tab === 0 && (
        <FieldsPanel
          fields={fields}
          onCreate={() => {
            setEditingField(EMPTY_FIELD);
            setFieldDialogOpen(true);
          }}
          onEdit={(field) => {
            setEditingField(field);
            setFieldDialogOpen(true);
          }}
          onDelete={(id) => setDeleteFieldId(id)}
        />
      )}

      {tab === 1 && (
        <ContentTypesPanel
          contentTypes={contentTypes}
          fields={fields}
          getProfessionDisplayName={(value) => getProfessionDisplayName(value ?? undefined)}
          onCreate={() => {
            setEditingContentType(EMPTY_CONTENT_TYPE);
            setContentTypeDialogOpen(true);
          }}
          onEdit={(contentType) => {
            setEditingContentType(contentType);
            setContentTypeDialogOpen(true);
          }}
          onDelete={(id) => setDeleteContentTypeId(id)}
        />
      )}

      {tab === 2 && (
        <SEOAndPublishingPanel
          showcases={showcases}
          youtube={youtubeAnalytics}
        />
      )}

      {tab === 3 && (
        <IntegrationsPanel />
      )}

      <FieldDialog
        open={fieldDialogOpen}
        value={editingField}
        pending={fieldMutation.isPending}
        onClose={() => {
          setFieldDialogOpen(false);
          setEditingField(EMPTY_FIELD);
        }}
        onChange={setEditingField}
        onSave={() => fieldMutation.mutate(editingField)}
      />

      <ContentTypeDialog
        open={contentTypeDialogOpen}
        value={editingContentType}
        fields={fields}
        pending={contentTypeMutation.isPending}
        onClose={() => {
          setContentTypeDialogOpen(false);
          setEditingContentType(EMPTY_CONTENT_TYPE);
        }}
        onChange={setEditingContentType}
        onSave={() => contentTypeMutation.mutate(editingContentType)}
      />

      <ConfirmDialog
        open={deleteFieldId !== null}
        title="Slett felt"
        description="Dette kan påvirke skjemaer som bruker feltet."
        pending={deleteFieldMutation.isPending}
        onCancel={() => setDeleteFieldId(null)}
        onConfirm={() => {
          if (deleteFieldId) {
            deleteFieldMutation.mutate(deleteFieldId);
          }
        }}
      />

      <ConfirmDialog
        open={deleteContentTypeId !== null}
        title="Slett innholdstype"
        description="Denne handlingen fjerner innholdstypekonfigurasjonen."
        pending={deleteContentTypeMutation.isPending}
        onCancel={() => setDeleteContentTypeId(null)}
        onConfirm={() => {
          if (deleteContentTypeId) {
            deleteContentTypeMutation.mutate(deleteContentTypeId);
          }
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function PaperTabs({
  tab,
  onTabChange,
}: {
  tab: number;
  onTabChange: (value: number) => void;
}) {
  return (
    <Card sx={{ mb: 3 }}>
      <Tabs value={tab} onChange={(_, value: number) => onTabChange(value)} variant="scrollable">
        <Tab icon={<SettingsIcon />} iconPosition="start" label="Felter" />
        <Tab icon={<PublishIcon />} iconPosition="start" label="Innholdstyper" />
        <Tab icon={<TrendingUpIcon />} iconPosition="start" label="SEO & Publisering" />
        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Integrasjoner" />
      </Tabs>
    </Card>
  );
}

function FieldsPanel({
  fields,
  onCreate,
  onEdit,
  onDelete,
}: {
  fields: CMSField[];
  onCreate: () => void;
  onEdit: (field: CMSField) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <AdminCard
      title="CMS-felter"
      action={
        <AdminButton tone="primary" startIcon={<AddIcon />} onClick={onCreate}>
          Legg til felt
        </AdminButton>
      }
    >
      <Divider sx={{ mb: 2 }} />
      <List disablePadding>
        {fields.map((field) => (
          <ListItem
            key={field.id ?? field.name}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton onClick={() => onEdit(field)} size="small" aria-label="Rediger felt">
                  <EditIcon fontSize="small" />
                </IconButton>
                {field.id && (
                  <IconButton onClick={() => onDelete(field.id ?? '')} size="small" color="error" aria-label="Slett felt">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            }
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography>{field.label}</Typography>
                  <Chip size="small" label={field.type} />
                  {field.påkrevd && <StatusChip tone="warning" label="Påkrevd" />}
                </Stack>
              }
              secondary={field.beskrivelse || field.name}
            />
          </ListItem>
        ))}
        {fields.length === 0 && (
          <ListItem>
            <ListItemText primary="Ingen felter funnet" />
          </ListItem>
        )}
      </List>
    </AdminCard>
  );
}

function ContentTypesPanel({
  contentTypes,
  fields,
  getProfessionDisplayName,
  onCreate,
  onEdit,
  onDelete,
}: {
  contentTypes: ContentType[];
  fields: CMSField[];
  getProfessionDisplayName: (value?: string | null) => string;
  onCreate: () => void;
  onEdit: (contentType: ContentType) => void;
  onDelete: (id: string) => void;
}) {
  const fieldNameById = useMemo(() => {
    const map = new Map<string, string>();
    fields.forEach((field) => {
      if (field.id) {
        map.set(field.id, field.label);
      }
    });
    return map;
  }, [fields]);

  return (
    <AdminCard
      title="Innholdstyper"
      action={
        <AdminButton tone="primary" startIcon={<AddIcon />} onClick={onCreate}>
          Ny innholdstype
        </AdminButton>
      }
    >
      <Divider sx={{ mb: 2 }} />
      <List disablePadding>
        {contentTypes.map((contentType) => (
            <ListItem
              key={contentType.id ?? contentType.navn}
              secondaryAction={
                <Stack direction="row" spacing={1}>
                  <IconButton onClick={() => onEdit(contentType)} size="small" aria-label="Rediger innholdstype">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {contentType.id && (
                    <IconButton onClick={() => onDelete(contentType.id ?? '')} size="small" color="error" aria-label="Slett innholdstype">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              }
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography>{contentType.navn}</Typography>
                    {contentType.profesjon && (
                      <Chip size="small" label={getProfessionDisplayName(contentType.profesjon)} />
                    )}
                  </Stack>
                }
                secondary={
                  <>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {contentType.beskrivelse || 'Ingen beskrivelse'}
                    </Typography>
                    {contentType.felter && contentType.felter.length > 0 && (
                      <Typography component="div" variant="caption" color="text.secondary">
                        Felter: {contentType.felter.map((fieldId) => fieldNameById.get(fieldId) || fieldId).join(', ')}
                      </Typography>
                    )}
                  </>
                }
              />
            </ListItem>
          ))}
          {contentTypes.length === 0 && (
            <ListItem>
              <ListItemText primary="Ingen innholdstyper funnet" />
            </ListItem>
          )}
        </List>
    </AdminCard>
  );
}

function SEOAndPublishingPanel({
  showcases,
  youtube,
}: {
  showcases: ShowcaseItem[];
  youtube: YouTubeAnalytics;
}) {
  const topShowcases = [...showcases]
    .sort((a, b) => (b.views + b.likes * 4 + b.shares * 8) - (a.views + a.likes * 4 + a.shares * 8))
    .slice(0, 5);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={8}>
        <AdminCard title="Viral showcase-score">
            <List disablePadding>
              {topShowcases.map((showcase) => (
                <ListItem key={showcase.id}>
                  <ListItemText
                    primary={showcase.title}
                    secondary={
                      <Stack direction="row" spacing={2}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <VisibilityIcon fontSize="small" />
                          <Typography variant="caption">{showcase.views}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <ThumbUpIcon fontSize="small" />
                          <Typography variant="caption">{showcase.likes}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <PublishIcon fontSize="small" />
                          <Typography variant="caption">{showcase.shares}</Typography>
                        </Stack>
                      </Stack>
                    }
                  />
                  <StatusChip status={showcase.status} />
                </ListItem>
              ))}
              {topShowcases.length === 0 && (
                <ListItem>
                  <ListItemText primary="Ingen showcase-data tilgjengelig." />
                </ListItem>
              )}
            </List>
        </AdminCard>
      </Grid>
      <Grid item xs={12} md={4}>
        <AdminCard
          title={
            <Stack direction="row" spacing={1} alignItems="center">
              <VideoLibraryIcon />
              <span>YouTube snapshot</span>
            </Stack>
          }
        >
            <Metric label="Kanal" value={youtube.channelName} />
            <Metric label="Abonnenter" value={String(youtube.subscribers)} />
            <Metric label="Visninger" value={String(youtube.views)} />
            <Metric label="Watch time (timer)" value={String(youtube.watchTimeHours)} />
            <Metric label="CTR" value={`${youtube.ctrPercent}%`} />
        </AdminCard>
      </Grid>
    </Grid>
  );
}

function IntegrationsPanel() {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <AdminCard title="Integrasjonsstatus">
            <Alert severity="success" sx={{ mb: 1 }}>
              CMS API tilgjengelig
            </Alert>
            <Alert severity="info" sx={{ mb: 1 }}>
              YouTube Analytics kan oppdateres via API
            </Alert>
            <Alert severity="warning">
              Kontroller OAuth-scopes før publiseringsjobb
            </Alert>
        </AdminCard>
      </Grid>
      <Grid item xs={12} md={6}>
        <AdminCard title="Hurtighandlinger">
            <Stack spacing={1}>
              <AdminButton tone="primary" startIcon={<PublishIcon />} onClick={() => window.open('/showcase-admin', '_blank')}>
                Åpne showcase admin
              </AdminButton>
              <AdminButton tone="secondary" startIcon={<SettingsIcon />} onClick={() => window.open('/admin', '_blank')}>
                Åpne systemadmin
              </AdminButton>
            </Stack>
        </AdminCard>
      </Grid>
    </Grid>
  );
}

function FieldDialog({
  open,
  value,
  pending,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  value: CMSField;
  pending: boolean;
  onClose: () => void;
  onChange: (next: CMSField) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={useIsMobile()}>
      <DialogTitle>{value.id ? 'Rediger felt' : 'Nytt felt'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Navn"
            value={value.name}
            onChange={(event) => onChange({ ...value, name: event.target.value })}
            fullWidth
          />
          <TextField
            label="Label"
            value={value.label}
            onChange={(event) => onChange({ ...value, label: event.target.value })}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="field-type-label">Felttype</InputLabel>
            <Select
              labelId="field-type-label"
              label="Felttype"
              value={value.type}
              onChange={(event) => onChange({ ...value, type: String(event.target.value) })}
            >
              {['text', 'textarea', 'number', 'email', 'date', 'checkbox', 'select', 'image', 'video', 'url'].map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Beskrivelse"
            value={value.beskrivelse ?? ''}
            onChange={(event) => onChange({ ...value, beskrivelse: event.target.value })}
            fullWidth
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(value.påkrevd)}
                onChange={(event) => onChange({ ...value, påkrevd: event.target.checked })}
              />
            }
            label="Påkrevd felt"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <AdminButton tone="ghost" onClick={onClose}>Avbryt</AdminButton>
        <AdminButton
          tone="primary"
          loading={pending}
          onClick={onSave}
          disabled={pending || value.name.trim().length === 0 || value.label.trim().length === 0}
        >
          Lagre
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
}

function ContentTypeDialog({
  open,
  value,
  fields,
  pending,
  onClose,
  onChange,
  onSave,
}: {
  open: boolean;
  value: ContentType;
  fields: CMSField[];
  pending: boolean;
  onClose: () => void;
  onChange: (next: ContentType) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={useIsMobile()}>
      <DialogTitle>{value.id ? 'Rediger innholdstype' : 'Ny innholdstype'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Navn"
            value={value.navn}
            onChange={(event) => onChange({ ...value, navn: event.target.value })}
            fullWidth
          />
          <TextField
            label="Beskrivelse"
            value={value.beskrivelse ?? ''}
            onChange={(event) => onChange({ ...value, beskrivelse: event.target.value })}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            label="Profesjon"
            value={value.profesjon ?? ''}
            onChange={(event) => onChange({ ...value, profesjon: event.target.value })}
            fullWidth
            placeholder="photographer, videographer, music_producer..."
          />
          <FormControl fullWidth>
            <InputLabel id="content-type-fields-label">Felter</InputLabel>
            <Select
              labelId="content-type-fields-label"
              label="Felter"
              multiple
              value={value.felter ?? []}
              onChange={(event) => {
                const next = event.target.value;
                const ids = Array.isArray(next) ? next.map(String) : [];
                onChange({ ...value, felter: ids });
              }}
              renderValue={(selected) => {
                const ids = Array.isArray(selected) ? selected.map(String) : [];
                return ids
                  .map((id) => fields.find((field) => field.id === id)?.label || id)
                  .join(', ');
              }}
            >
              {fields.map((field) => (
                <MenuItem key={field.id ?? field.name} value={field.id ?? field.name}>
                  {field.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <AdminButton tone="ghost" onClick={onClose}>Avbryt</AdminButton>
        <AdminButton
          tone="primary"
          loading={pending}
          onClick={onSave}
          disabled={pending || value.navn.trim().length === 0}
        >
          Lagre
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{description}</Typography>
      </DialogContent>
      <DialogActions>
        <AdminButton tone="ghost" onClick={onCancel}>Avbryt</AdminButton>
        <AdminButton tone="danger" loading={pending} onClick={onConfirm} disabled={pending}>
          Slett
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.items)) {
    return record.items;
  }
  if (Array.isArray(record.fields)) {
    return record.fields;
  }
  if (Array.isArray(record.contentTypes)) {
    return record.contentTypes;
  }
  return [];
}

function normalizeFields(input: unknown): CMSField[] {
  const normalized: CMSField[] = [];

  ensureArray(input).forEach((item) => {
    const record = asRecord(item);
    if (!record) {
      return;
    }
    const name = typeof record.name === 'string' ? record.name : '';
    const label = typeof record.label === 'string' ? record.label : '';
    if (name.length === 0 || label.length === 0) {
      return;
    }
    normalized.push({
      id: typeof record.id === 'string' ? record.id : undefined,
      name,
      type: typeof record.type === 'string' ? record.type : 'text',
      label,
      beskrivelse: typeof record.beskrivelse === 'string' ? record.beskrivelse : undefined,
      påkrevd: Boolean(record.påkrevd),
      defaultValue: record.defaultValue,
      innstillinger: asRecord(record.innstillinger) || undefined,
    });
  });

  return normalized;
}

function normalizeContentTypes(input: unknown): ContentType[] {
  const normalized: ContentType[] = [];

  ensureArray(input).forEach((item) => {
    const record = asRecord(item);
    if (!record) {
      return;
    }
    const navn = typeof record.navn === 'string' ? record.navn : '';
    if (navn.length === 0) {
      return;
    }
    const rawFields = Array.isArray(record.felter) ? record.felter : [];
    const fields = rawFields.filter((value): value is string => typeof value === 'string');
    normalized.push({
      id: typeof record.id === 'string' ? record.id : undefined,
      navn,
      beskrivelse: typeof record.beskrivelse === 'string' ? record.beskrivelse : undefined,
      profesjon: typeof record.profesjon === 'string' ? record.profesjon : undefined,
      felter: fields,
    });
  });

  return normalized;
}

function normalizeStats(
  input: unknown,
  fields: CMSField[],
  contentTypes: ContentType[],
): CMSStats {
  const record = asRecord(input) || {};
  const totalFields = numberOrFallback(record.totalFields, fields.length);
  const totalContentTypes = numberOrFallback(record.totalContentTypes, contentTypes.length);
  const requiredFields = numberOrFallback(
    record.requiredFields,
    fields.filter((field) => field.påkrevd).length,
  );
  const customFields = numberOrFallback(record.customFields, Math.max(0, totalFields - requiredFields));
  return {
    totalFields,
    totalContentTypes,
    requiredFields,
    customFields,
  };
}

function normalizeShowcases(input: unknown): ShowcaseItem[] {
  return ensureArray(input)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const id = typeof record.id === 'string' ? record.id : '';
      const title = typeof record.title === 'string' ? record.title : '';
      if (id.length === 0 || title.length === 0) {
        return null;
      }
      return {
        id,
        title,
        views: numberOrFallback(record.views, 0),
        likes: numberOrFallback(record.likes, 0),
        shares: numberOrFallback(record.shares, 0),
        status: typeof record.status === 'string' ? record.status : 'draft',
      } satisfies ShowcaseItem;
    })
    .filter((value): value is ShowcaseItem => value !== null);
}

function normalizeYoutubeAnalytics(input: unknown): YouTubeAnalytics {
  const record = asRecord(input) || {};
  return {
    channelName: typeof record.channelName === 'string' ? record.channelName : 'Ikke koblet',
    subscribers: numberOrFallback(record.subscribers, 0),
    views: numberOrFallback(record.views, 0),
    watchTimeHours: numberOrFallback(record.watchTimeHours, 0),
    ctrPercent: numberOrFallback(record.ctrPercent, 0),
  };
}

function numberOrFallback(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}
