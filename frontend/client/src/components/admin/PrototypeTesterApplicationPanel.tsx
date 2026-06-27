import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Cancel,
  CheckCircle,
  Download,
  FilterList,
  OpenInNew,
  Search,
  Schedule,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { AdminButton, StatusChip, useIsMobile } from './design-system';

type Profession = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'other' | 'enterprise';

type Experience = 'beginner' | 'intermediate' | 'advanced' | 'expert';

type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'inactive';

interface LocationContext {
  profession: string;
  dashboardType: string;
  currentTab: string;
  currentSection: string;
  specificFeature?: string;
  pageUrl: string;
  userAgent: string;
  timestamp: string;
}

interface PrototypeTesterApplication {
  id: string;
  name: string;
  email: string;
  company?: string;
  profession: Profession;
  testingAreas: string[];
  experience: Experience;
  feedback: string;
  availableTime?: string;
  deviceInfo?: string;
  hasAgreedToTerms: boolean;
  detailedFeedback?: string;
  testingNotes?: string;
  expectations?: string;
  locationContext?: LocationContext;
  status: ApplicationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface RejectPayload {
  id: string;
  reason: string;
}

const STATUS_OPTIONS: ApplicationStatus[] = ['pending', 'approved', 'rejected', 'inactive'];

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseApplications(raw: unknown): PrototypeTesterApplication[] {
  const root = asRecord(raw);
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.items)
        ? root.items
        : [];

  return list
    .map((entry): PrototypeTesterApplication | null => {
      const item = asRecord(entry);
      const idRaw = item.id;
      const id = typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : '';
      const name = typeof item.name === 'string' ? item.name : '';
      const email = typeof item.email === 'string' ? item.email : '';
      const profession = typeof item.profession === 'string' ? item.profession : 'other';
      const experience = typeof item.experience === 'string' ? item.experience : 'beginner';
      const status = typeof item.status === 'string' ? item.status : 'pending';

      if (!id || !name || !email) {
        return null;
      }

      const testingAreas = Array.isArray(item.testingAreas)
        ? item.testingAreas.filter((value): value is string => typeof value === 'string')
        : [];

      const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();
      const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : createdAt;

      return {
        id,
        name,
        email,
        company: typeof item.company === 'string' ? item.company : undefined,
        profession:
          profession === 'photographer' ||
          profession === 'videographer' ||
          profession === 'music_producer' ||
          profession === 'vendor' ||
          profession === 'enterprise'
            ? profession
            : 'other',
        testingAreas,
        experience:
          experience === 'intermediate' || experience === 'advanced' || experience === 'expert'
            ? experience
            : 'beginner',
        feedback: typeof item.feedback === 'string' ? item.feedback : '',
        availableTime: typeof item.availableTime === 'string' ? item.availableTime : undefined,
        deviceInfo: typeof item.deviceInfo === 'string' ? item.deviceInfo : undefined,
        hasAgreedToTerms: Boolean(item.hasAgreedToTerms),
        detailedFeedback: typeof item.detailedFeedback === 'string' ? item.detailedFeedback : undefined,
        testingNotes: typeof item.testingNotes === 'string' ? item.testingNotes : undefined,
        expectations: typeof item.expectations === 'string' ? item.expectations : undefined,
        status:
          status === 'approved' || status === 'rejected' || status === 'inactive' ? status : 'pending',
        reviewedBy: typeof item.reviewedBy === 'string' ? item.reviewedBy : undefined,
        reviewedAt: typeof item.reviewedAt === 'string' ? item.reviewedAt : undefined,
        rejectionReason: typeof item.rejectionReason === 'string' ? item.rejectionReason : undefined,
        createdAt,
        updatedAt,
      } satisfies PrototypeTesterApplication;
    })
    .filter((application): application is PrototypeTesterApplication => application !== null);
}

function toCsv(applications: PrototypeTesterApplication[]): string {
  const headers = [
    'Name',
    'Email',
    'Company',
    'Profession',
    'Status',
    'Experience',
    'Testing Areas',
    'Created At',
  ];

  const rows = applications.map((application) => [
    application.name,
    application.email,
    application.company ?? '',
    application.profession,
    application.status,
    application.experience,
    application.testingAreas.join(' | '),
    application.createdAt,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export default function PrototypeTesterApplicationPanel() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { analytics, performance, lifecycle, auth } = useEnhancedMasterIntegration();

  const [selectedApplication, setSelectedApplication] = useState<PrototypeTesterApplication | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus[]>([]);
  const [professionFilter, setProfessionFilter] = useState<Profession[]>([]);

  useEffect(() => {
    const stopTiming = performance.startTiming('prototype_application_panel_init');

    lifecycle.registerComponent({
      id: 'prototype-application-panel',
      type: 'admin-panel',
      version: '2.0.0',
      capabilities: {
        data: ['applications:read', 'applications:approve', 'applications:reject'],
        events: ['application:approved', 'application:rejected'],
        actions: ['filter', 'search', 'approve', 'reject', 'export'],
        ui: ['search', 'filter-controls'],
        system: ['real-time-updates'],
      },
      dependencies: ['query-client', 'auth-system'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('prototype_application_panel_mounted', { timestamp: Date.now() });

    return () => {
      stopTiming();
      lifecycle.unregisterComponent('prototype-application-panel');
    };
  }, [analytics, lifecycle, performance]);

  const applicationsQuery = useQuery({
    queryKey: ['/api/invites/prototype-tester-applications'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/invites/prototype-tester-applications', { headers });
      return parseApplications(response);
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/invites/prototype-tester/${id}/approve`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/invites/prototype-tester-applications'] });
      analytics.trackEvent('application_approved', {
        applicationId: selectedApplication?.id,
        timestamp: Date.now(),
      });
      setActionDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: RejectPayload) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/invites/prototype-tester/${id}/reject`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: {
          reason,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/invites/prototype-tester-applications'] });
      analytics.trackEvent('application_rejected', {
        applicationId: selectedApplication?.id,
        timestamp: Date.now(),
      });
      setActionDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason('');
    },
  });

  const applications = applicationsQuery.data ?? [];

  const availableProfessions = useMemo(() => {
    const set = new Set<Profession>(applications.map((application) => application.profession));
    return Array.from(set).sort();
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return applications
      .filter((application) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          application.name.toLowerCase().includes(normalizedSearch) ||
          application.email.toLowerCase().includes(normalizedSearch) ||
          (application.company ?? '').toLowerCase().includes(normalizedSearch)
        );
      })
      .filter((application) => {
        return statusFilter.length === 0 || statusFilter.includes(application.status);
      })
      .filter((application) => {
        return professionFilter.length === 0 || professionFilter.includes(application.profession);
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [applications, professionFilter, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: applications.length,
      pending: applications.filter((application) => application.status === 'pending').length,
      approved: applications.filter((application) => application.status === 'approved').length,
      rejected: applications.filter((application) => application.status === 'rejected').length,
      inactive: applications.filter((application) => application.status === 'inactive').length,
    };
  }, [applications]);

  const openApproveDialog = useCallback((application: PrototypeTesterApplication) => {
    setSelectedApplication(application);
    setActionType('approve');
    setActionDialogOpen(true);
  }, []);

  const openRejectDialog = useCallback((application: PrototypeTesterApplication) => {
    setSelectedApplication(application);
    setActionType('reject');
    setActionDialogOpen(true);
  }, []);

  const confirmAction = () => {
    if (!selectedApplication) {
      return;
    }

    if (actionType === 'approve') {
      approveMutation.mutate(selectedApplication.id);
      return;
    }

    rejectMutation.mutate({
      id: selectedApplication.id,
      reason: rejectionReason.trim(),
    });
  };

  const exportCsv = () => {
    const csv = toCsv(filteredApplications);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prototype-tester-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2" fontWeight={700}>
          Prototype Tester Applications
        </Typography>
        <AdminButton tone="secondary" startIcon={<Download />} onClick={exportCsv}>
          Export CSV
        </AdminButton>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Total
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Pending
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {stats.pending}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Approved
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {stats.approved}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Rejected
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {stats.rejected}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                Inactive
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {stats.inactive}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              InputProps={{
                startAdornment: (
                  <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                    <Search fontSize="small" aria-hidden="true" />
                  </Box>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                label="Status"
                multiple
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ApplicationStatus[])}
                startAdornment={
                  <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                    <FilterList fontSize="small" aria-hidden="true" />
                  </Box>
                }
              >
                {STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="profession-filter-label">Profession</InputLabel>
              <Select
                labelId="profession-filter-label"
                label="Profession"
                multiple
                value={professionFilter}
                onChange={(event) => setProfessionFilter(event.target.value as Profession[])}
              >
                {availableProfessions.map((profession) => (
                  <MenuItem key={profession} value={profession}>
                    {profession}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {applicationsQuery.isLoading && <Alert severity="info">Laster søknader...</Alert>}
      {applicationsQuery.isError && <Alert severity="error">Kunne ikke laste søknader.</Alert>}

      {!applicationsQuery.isLoading && !applicationsQuery.isError && (
        <Paper>
          <List>
            {filteredApplications.map((application) => (
              <ListItem
                key={application.id}
                divider
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      aria-label="Vis søknadsdetaljer"
                      onClick={() => {
                        setSelectedApplication(application);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <OpenInNew fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Godkjenn søknad"
                      onClick={() => openApproveDialog(application)}
                      disabled={application.status === 'approved' || approveMutation.isPending}
                    >
                      <CheckCircle fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Avslå søknad"
                      onClick={() => openRejectDialog(application)}
                      disabled={application.status === 'rejected' || rejectMutation.isPending}
                    >
                      <Cancel fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2">{application.name}</Typography>
                      <Chip size="small" label={application.profession} variant="outlined" />
                      <StatusChip status={application.status} />
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <Typography variant="caption">{application.email}</Typography>
                      <Typography variant="caption">{application.company ?? 'Ingen selskap'}</Typography>
                      <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <Schedule sx={{ fontSize: 13 }} aria-hidden="true" />
                        {new Date(application.createdAt).toLocaleString()}
                      </Typography>
                    </Stack>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>Application details</DialogTitle>
        <DialogContent>
          {selectedApplication ? (
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <Typography variant="subtitle2">Name: {selectedApplication.name}</Typography>
              <Typography variant="subtitle2">Email: {selectedApplication.email}</Typography>
              <Typography variant="subtitle2">Profession: {selectedApplication.profession}</Typography>
              <Typography variant="subtitle2">Experience: {selectedApplication.experience}</Typography>
              <Typography variant="subtitle2">Testing areas: {selectedApplication.testingAreas.join(', ')}</Typography>
              <Typography variant="subtitle2">Feedback</Typography>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="body2">{selectedApplication.feedback || 'Ingen feedback skrevet'}</Typography>
              </Paper>
              {selectedApplication.detailedFeedback && (
                <>
                  <Typography variant="subtitle2">Detailed feedback</Typography>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2">{selectedApplication.detailedFeedback}</Typography>
                  </Paper>
                </>
              )}
              {selectedApplication.rejectionReason && (
                <Alert severity="warning">Avslagsgrunn: {selectedApplication.rejectionReason}</Alert>
              )}
            </Stack>
          ) : (
            <Alert severity="info">Ingen søknad valgt.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setDetailDialogOpen(false)}>Lukk</AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog open={actionDialogOpen} onClose={() => setActionDialogOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{actionType === 'approve' ? 'Approve application' : 'Reject application'}</DialogTitle>
        <DialogContent>
          {selectedApplication && (
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <Typography>
                {selectedApplication.name} ({selectedApplication.email})
              </Typography>

              {actionType === 'reject' && (
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Rejection reason"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setActionDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone={actionType === 'approve' ? 'primary' : 'danger'}
            loading={approveMutation.isPending || rejectMutation.isPending}
            onClick={confirmAction}
            disabled={
              approveMutation.isPending ||
              rejectMutation.isPending ||
              (actionType === 'reject' && rejectionReason.trim().length === 0)
            }
          >
            {actionType === 'approve' ? 'Approve' : 'Reject'}
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
