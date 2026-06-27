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
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Save,
  Work,
  Group,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import CustomerJourneyBuilder from './CustomerJourneyBuilder';
import {
  AdminButton,
  AdminTableContainer,
  StatusChip,
  useIsMobile,
} from './design-system';

type ProfessionStatus = 'active' | 'inactive' | 'beta' | 'coming_soon';

interface ProfessionConfig {
  id?: string;
  key: string;
  name: string;
  nameEnglish: string;
  description: string;
  color: string;
  icon: string;
  status: ProfessionStatus;
  tabs: string[];
  features: string[];
  integrations: string[];
  priority: number;
  metadata: {
    marketSize?: string;
    averageRevenue?: string;
    complexity?: 'low' | 'medium' | 'high';
    developmentTime?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ProfessionTypeApi {
  id: string;
  name: string;
  displayName: string;
  description: string;
  iconColor: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TABS = ['Oversikt', 'Prosjekter', 'Kunder', 'Utstyr', 'Filer', 'Innstillinger'];
const DEFAULT_FEATURES = ['dashboard', 'file-manager', 'analytics'];
const DEFAULT_INTEGRATIONS = ['google-drive', 'email'];

const EMPTY_FORM: ProfessionConfig = {
  key: '',
  name: '',
  nameEnglish: '',
  description: '',
  color: '#60a5fa',
  icon: 'work',
  status: 'active',
  tabs: [...DEFAULT_TABS],
  features: [...DEFAULT_FEATURES],
  integrations: [...DEFAULT_INTEGRATIONS],
  priority: 1,
  metadata: {
    complexity: 'medium',
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
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

function normalizeProfessions(raw: unknown): ProfessionTypeApi[] {
  const root = asRecord(raw);
  const listCandidate = Array.isArray(raw)
    ? raw
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.items)
        ? root.items
        : [];

  return listCandidate
    .map((entry): ProfessionTypeApi | null => {
      const record = asRecord(entry);
      const rawId = record.id;
      const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';
      const name = toStringValue(record.name).trim();
      const displayName = toStringValue(record.displayName).trim();

      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        displayName: displayName || name,
        description: toStringValue(record.description),
        iconColor: toStringValue(record.iconColor, '#1976d2'),
        isActive: Boolean(record.isActive),
        sortOrder: Math.max(1, toNumberValue(record.sortOrder, 1)),
        createdAt: toStringValue(record.createdAt, new Date().toISOString()),
        updatedAt: toStringValue(record.updatedAt, new Date().toISOString()),
      };
    })
    .filter((entry): entry is ProfessionTypeApi => entry !== null);
}

function toProfessionConfig(apiItem: ProfessionTypeApi): ProfessionConfig {
  return {
    id: apiItem.id,
    key: apiItem.name,
    name: apiItem.displayName,
    nameEnglish: apiItem.displayName,
    description: apiItem.description,
    color: apiItem.iconColor,
    icon: apiItem.name,
    status: apiItem.isActive ? 'active' : 'inactive',
    tabs: [...DEFAULT_TABS],
    features: [...DEFAULT_FEATURES],
    integrations: [...DEFAULT_INTEGRATIONS],
    priority: apiItem.sortOrder,
    metadata: {
      complexity: 'medium',
    },
    createdAt: apiItem.createdAt,
    updatedAt: apiItem.updatedAt,
  };
}

function statusTone(status: ProfessionStatus): 'success' | 'neutral' | 'warning' {
  switch (status) {
    case 'active':
      return 'success';
    case 'beta':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function ProfessionCMSManager() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const isMobile = useIsMobile();

  const [currentTab, setCurrentTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProfessionForJourney, setSelectedProfessionForJourney] = useState('photographer');
  const [editingProfessionId, setEditingProfessionId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfessionConfig>(EMPTY_FORM);
  const [newTabValue, setNewTabValue] = useState('');
  const [newFeatureValue, setNewFeatureValue] = useState('');
  const [newIntegrationValue, setNewIntegrationValue] = useState('');

  const professionsQuery = useQuery({
    queryKey: ['/api/admin/profession-types'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/admin/profession-types', { headers });
      return normalizeProfessions(response);
    },
    retry: false,
  });

  const professions = useMemo(() => {
    return professionsQuery.data?.map(toProfessionConfig) ?? [];
  }, [professionsQuery.data]);

  const stats = useMemo(() => {
    const total = professions.length;
    const active = professions.filter((item) => item.status === 'active').length;
    const inactive = professions.filter((item) => item.status === 'inactive').length;
    const beta = professions.filter((item) => item.status === 'beta').length;

    return { total, active, inactive, beta };
  }, [professions]);

  const saveProfessionMutation = useMutation({
    mutationFn: async (payload: ProfessionConfig) => {
      const headers = await auth.getAuthHeader();
      const requestBody = {
        name: payload.key,
        displayName: payload.name,
        description: payload.description,
        iconColor: payload.color,
        isActive: payload.status === 'active' || payload.status === 'beta',
        sortOrder: payload.priority,
      };

      if (payload.id) {
        return apiRequest(`/api/admin/profession-types/${payload.id}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: requestBody,
        });
      }

      return apiRequest('/api/admin/profession-types', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types'] });
      setOpenDialog(false);
      setEditingProfessionId(null);
      setFormData(EMPTY_FORM);
      setNewTabValue('');
      setNewFeatureValue('');
      setNewIntegrationValue('');
    },
  });

  const deleteProfessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/profession-types/${id}`, {
        method: 'DELETE',
        headers,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-types'] });
    },
  });

  const openCreateDialog = () => {
    setEditingProfessionId(null);
    setFormData(EMPTY_FORM);
    setNewTabValue('');
    setNewFeatureValue('');
    setNewIntegrationValue('');
    setOpenDialog(true);
  };

  const openEditDialog = (profession: ProfessionConfig) => {
    setEditingProfessionId(profession.id ?? null);
    setFormData({
      ...profession,
      tabs: [...profession.tabs],
      features: [...profession.features],
      integrations: [...profession.integrations],
      metadata: { ...profession.metadata },
    });
    setNewTabValue('');
    setNewFeatureValue('');
    setNewIntegrationValue('');
    setOpenDialog(true);
  };

  const appendUnique = (items: string[], value: string): string[] => {
    const normalized = value.trim();
    if (!normalized || items.includes(normalized)) {
      return items;
    }

    return [...items, normalized];
  };

  const removeByIndex = (items: string[], index: number): string[] => {
    return items.filter((_, itemIndex) => itemIndex !== index);
  };

  const canSave = formData.key.trim().length > 0 && formData.name.trim().length > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Profession CMS Manager
        </Typography>
        <AdminButton tone="primary" startIcon={<Add />} onClick={openCreateDialog}>
          Ny profesjon
        </AdminButton>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <Work color="primary" />
                <Typography variant="subtitle2">Totalt</Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700}>
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircle color="success" />
                <Typography variant="subtitle2">Aktive</Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700}>
                {stats.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <Warning color="warning" />
                <Typography variant="subtitle2">Beta</Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700}>
                {stats.beta}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <Group color="disabled" />
                <Typography variant="subtitle2">Inaktive</Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700}>
                {stats.inactive}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={currentTab} onChange={(_, value: number) => setCurrentTab(value)}>
          <Tab label="Professioner" />
          <Tab label="Customer Journey" />
        </Tabs>
      </Paper>

      {currentTab === 0 && (
        <>
          {professionsQuery.isLoading && <Alert severity="info">Laster profesjoner...</Alert>}
          {professionsQuery.isError && (
            <Alert severity="error">Kunne ikke laste profesjoner. Sjekk API og autentisering.</Alert>
          )}

          {!professionsQuery.isLoading && !professionsQuery.isError && (
            <AdminTableContainer ariaLabel="Profesjoner">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Navn</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Prioritet</TableCell>
                    <TableCell>Farge</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {professions.map((profession) => (
                    <TableRow key={profession.id ?? profession.key} hover>
                      <TableCell>{profession.key}</TableCell>
                      <TableCell>{profession.name}</TableCell>
                      <TableCell>
                        <StatusChip tone={statusTone(profession.status)} label={profession.status} />
                      </TableCell>
                      <TableCell>{profession.priority}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              bgcolor: profession.color,
                              border: '1px solid rgba(0,0,0,0.2)',
                            }}
                          />
                          <Typography variant="caption">{profession.color}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <IconButton size="small" aria-label="Rediger profesjon" onClick={() => openEditDialog(profession)}>
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label="Slett profesjon"
                            onClick={() => {
                              if (profession.id) {
                                deleteProfessionMutation.mutate(profession.id);
                              }
                            }}
                            disabled={!profession.id || deleteProfessionMutation.isPending}
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
        </>
      )}

      {currentTab === 1 && (
        <Stack spacing={2}>
          <FormControl size="small" sx={{ maxWidth: 320 }}>
            <InputLabel id="journey-profession-label">Profession</InputLabel>
            <Select
              labelId="journey-profession-label"
              label="Profession"
              value={selectedProfessionForJourney}
              onChange={(event) => setSelectedProfessionForJourney(event.target.value)}
            >
              {professions.map((profession) => (
                <MenuItem key={profession.key} value={profession.key}>
                  {profession.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <CustomerJourneyBuilder selectedProfession={selectedProfessionForJourney} />
        </Stack>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editingProfessionId ? 'Rediger profesjon' : 'Opprett profesjon'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Key"
                value={formData.key}
                onChange={(event) => setFormData((prev) => ({ ...prev, key: event.target.value.trim().toLowerCase() }))}
                helperText="Unik intern nøkkel"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Visningsnavn"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Beskrivelse"
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="color"
                label="Farge"
                value={formData.color}
                onChange={(event) => setFormData((prev) => ({ ...prev, color: event.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="status-select-label">Status</InputLabel>
                <Select
                  labelId="status-select-label"
                  label="Status"
                  value={formData.status}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, status: event.target.value as ProfessionStatus }))
                  }
                >
                  <MenuItem value="active">active</MenuItem>
                  <MenuItem value="inactive">inactive</MenuItem>
                  <MenuItem value="beta">beta</MenuItem>
                  <MenuItem value="coming_soon">coming_soon</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Prioritet"
                value={formData.priority}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, priority: Math.max(1, Number(event.target.value) || 1) }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Tabs
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                {formData.tabs.map((tab, index) => (
                  <Chip
                    key={`${tab}-${index}`}
                    label={tab}
                    onDelete={() =>
                      setFormData((prev) => ({ ...prev, tabs: removeByIndex(prev.tabs, index) }))
                    }
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Ny tab"
                  value={newTabValue}
                  onChange={(event) => setNewTabValue(event.target.value)}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, tabs: appendUnique(prev.tabs, newTabValue) }));
                    setNewTabValue('');
                  }}
                >
                  Legg til
                </Button>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Features
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                {formData.features.map((feature, index) => (
                  <Chip
                    key={`${feature}-${index}`}
                    label={feature}
                    color="primary"
                    variant="outlined"
                    onDelete={() =>
                      setFormData((prev) => ({ ...prev, features: removeByIndex(prev.features, index) }))
                    }
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Ny feature"
                  value={newFeatureValue}
                  onChange={(event) => setNewFeatureValue(event.target.value)}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, features: appendUnique(prev.features, newFeatureValue) }));
                    setNewFeatureValue('');
                  }}
                >
                  Legg til
                </Button>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Integrasjoner
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                {formData.integrations.map((integration, index) => (
                  <Chip
                    key={`${integration}-${index}`}
                    label={integration}
                    color="secondary"
                    variant="outlined"
                    onDelete={() =>
                      setFormData((prev) => ({
                        ...prev,
                        integrations: removeByIndex(prev.integrations, index),
                      }))
                    }
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Ny integrasjon"
                  value={newIntegrationValue}
                  onChange={(event) => setNewIntegrationValue(event.target.value)}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      integrations: appendUnique(prev.integrations, newIntegrationValue),
                    }));
                    setNewIntegrationValue('');
                  }}
                >
                  Legg til
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setOpenDialog(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<Save />}
            onClick={() => saveProfessionMutation.mutate({ ...formData, id: editingProfessionId ?? formData.id })}
            loading={saveProfessionMutation.isPending}
            disabled={!canSave}
          >
            Lagre
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
