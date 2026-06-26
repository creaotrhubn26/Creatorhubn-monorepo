/**
 * Enterprise Inquiries Panel
 * Admin panel to view and manage enterprise upgrade requests
 */
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  Business,
  People,
  Email,
  CheckCircle,
  Cancel,
  Visibility,
  Google,
  Warning,
  AttachMoney,
  OpenInNew,
  Schedule,
  Done,
  Close,
  Refresh,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { AdminButton, StatusChip, AdminTableContainer, AdminLoading, AdminEmpty } from './design-system';

interface EnterpriseInquiry {
  id: string;
  user_id?: string;
  org_number?: string;
  company_name: string;
  contact_email: string;
  team_size: number;
  team_description?: string;
  use_case: string;
  additional_message?: string;
  industry?: string;
  current_plan?: string;
  has_google_workspace: boolean;
  workspace_domain?: string;
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'converted';
  reviewed_by?: string;
  reviewed_at?: string;
  admin_notes?: string;
  created_at: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
}

interface InquiryStats {
  total: number;
  pending: number;
  reviewing: number;
  approved: number;
  rejected: number;
  converted: number;
}

const STATUS_CONFIG = {
  pending: { label: 'Venter', color: 'warning' as const, icon: <Schedule /> },
  reviewing: { label: 'Under vurdering', color: 'info' as const, icon: <Visibility /> },
  approved: { label: 'Godkjent', color: 'success' as const, icon: <CheckCircle /> },
  rejected: { label: 'Avslått', color: 'error' as const, icon: <Cancel /> },
  converted: { label: 'Konvertert', color: 'success' as const, icon: <Done /> },
};

interface EnterpriseInquiriesPanelProps {
  onNavigateToPricing?: () => void;
}

export default function EnterpriseInquiriesPanel({ onNavigateToPricing }: EnterpriseInquiriesPanelProps) {
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<EnterpriseInquiry | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  // Fetch inquiries
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/enterprise/inquiries', statusFilter],
    queryFn: () => apiRequest(`/api/enterprise/inquiries${statusFilter !== 'all' ? `?status=${statusFilter}` : ', '}`),
  });

  // Fetch enterprise pricing config
  const { data: pricingData } = useQuery({
    queryKey: ['enterprise-pricing-config'],
    queryFn: () => apiRequest('/api/enterprise/pricing/config'),
    staleTime: 5 * 60 * 1000,
  });

  const pricingConfig = pricingData?.data || {
    basePrice: 1499,
    includedUsers: 3,
    pricePerUser: 299,
  };

  const inquiries: EnterpriseInquiry[] = Array.isArray(data?.inquiries) ? data.inquiries : [];
  const stats: InquiryStats = data?.stats || { total: 0, pending: 0, reviewing: 0, approved: 0, rejected: 0, converted: 0 };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { id: string; status?: string; adminNotes?: string }) =>
      apiRequest(`/api/enterprise/inquiries/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: data.status, adminNotes: data.adminNotes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/inquiries'] });
      setShowDetailDialog(false);
    },
  });

  const handleViewDetails = (inquiry: EnterpriseInquiry) => {
    setSelectedInquiry(inquiry);
    setAdminNotes(inquiry.admin_notes || ', ');
    setNewStatus(inquiry.status);
    setShowDetailDialog(true);
  };

  const handleUpdateStatus = () => {
    if (!selectedInquiry) return;
    updateMutation.mutate({
      id: selectedInquiry.id,
      status: newStatus,
      adminNotes,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(stats).map(([key, value]) => {
          if (key === 'total') return null;
          const config = STATUS_CONFIG[key as keyof typeof STATUS_CONFIG];
          return (
            <Grid item xs={6} sm={4} md={2} key={key}>
              <Card sx={{ textAlign: 'center', cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
                onClick={() => setStatusFilter(key)}>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="h4" sx={{ color: `${config?.color}.main` }}>{value}</Typography>
                  <Typography variant="caption" color="text.secondary">{config?.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        <Grid item xs={6} sm={4} md={2}>
          <Card sx={{ textAlign: 'center', cursor: 'pointer', bgcolor: 'primary.main', color: 'white' }}
            onClick={() => setStatusFilter('all')}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="h4">{stats.total}</Typography>
              <Typography variant="caption">Totalt</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Alert severity="info" sx={{ flex: 1, mr: 2 }}>
          Enterprise-priser: Basispris {pricingConfig.basePrice} kr/mnd (inkl. {pricingConfig.includedUsers} brukere) + {pricingConfig.pricePerUser} kr/mnd per ekstra bruker.
          {onNavigateToPricing && (
            <Button size="small" onClick={onNavigateToPricing} endIcon={<OpenInNew fontSize="small" />} sx={{ ml: 1 }}>
              Administrer priser
            </Button>
          )}
        </Alert>
        <Button startIcon={<Refresh />} onClick={() => refetch()} size="small" variant="outlined">
          Oppdater
        </Button>
      </Box>

      {/* Table */}
      <AdminTableContainer ariaLabel="Enterprise-forespørsler">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bedrift</TableCell>
              <TableCell>Kontakt</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Workspace</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Dato</TableCell>
              <TableCell>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center"><AdminLoading /></TableCell>
              </TableRow>
            ) : inquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <AdminEmpty title="Ingen forespørsler funnet" />
                </TableCell>
              </TableRow>
            ) : inquiries.map((inquiry) => (
              <TableRow key={inquiry.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Business fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2" fontWeight={500}>{inquiry.company_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{inquiry.org_number || 'Org ikke oppgitt'}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{inquiry.contact_email}</Typography>
                  <Typography variant="caption" color="text.secondary">{inquiry.industry || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Chip icon={<People />} label={`${inquiry.team_size} brukere`} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  {inquiry.has_google_workspace ? (
                    <Chip icon={<Google />} label={inquiry.workspace_domain || 'Ja'} size="small" color="success" />
                  ) : (
                    <Chip icon={<Warning />} label="Nei" size="small" color="warning" />
                  )}
                </TableCell>
                <TableCell>
                  <StatusChip
                    icon={STATUS_CONFIG[inquiry.status]?.icon}
                    status={inquiry.status}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{formatDate(inquiry.created_at)}</Typography>
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleViewDetails(inquiry)}>
                    <Visibility />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminTableContainer>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onClose={() => setShowDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Business color="primary" />
          {selectedInquiry?.company_name}
        </DialogTitle>
        <DialogContent dividers>
          {selectedInquiry && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Kontaktinfo</Typography>
                <Typography><strong>E-post:</strong> {selectedInquiry.contact_email}</Typography>
                <Typography><strong>Org.nr:</strong> {selectedInquiry.org_number || 'Ikke oppgitt'}</Typography>
                <Typography><strong>Bransje:</strong> {selectedInquiry.industry || 'Ikke oppgitt'}</Typography>
                <Typography><strong>Nåværende plan:</strong> {selectedInquiry.current_plan}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Team</Typography>
                <Typography><strong>Antall brukere:</strong> {selectedInquiry.team_size}</Typography>
                <Typography><strong>Google Workspace:</strong> {selectedInquiry.has_google_workspace ? `Ja (${selectedInquiry.workspace_domain})` :'Nei'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Bruksområde</Typography>
                <Typography>{selectedInquiry.use_case}</Typography>
              </Grid>
              {selectedInquiry.team_description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Om teamet</Typography>
                  <Typography>{selectedInquiry.team_description}</Typography>
                </Grid>
              )}
              {selectedInquiry.additional_message && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Tilleggsmelding</Typography>
                  <Typography>{selectedInquiry.additional_message}</Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Status</InputLabel>
                  <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} label="Status">
                    <MenuItem value="pending">Venter</MenuItem>
                    <MenuItem value="reviewing">Under vurdering</MenuItem>
                    <MenuItem value="approved">Godkjent</MenuItem>
                    <MenuItem value="rejected">Avslått</MenuItem>
                    <MenuItem value="converted">Konvertert til Enterprise</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Admin notater"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setShowDetailDialog(false)}>Lukk</AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleUpdateStatus}
            loading={updateMutation.isPending}
            startIcon={<CheckCircle />}
          >
            Oppdater
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

