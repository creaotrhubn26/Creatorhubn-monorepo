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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Apartment,
  CheckCircle,
  HourglassTop,
  Mail,
  Phone,
  TaskAlt,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

type TidumAccessRequest = {
  requestId: number;
  fullName: string;
  email: string;
  orgNumber: string | null;
  company: string | null;
  phone: string | null;
  message: string | null;
  brregVerified: boolean;
  institutionType: string | null;
  status: string;
  vendorId: number | null;
  approvalRole: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type TidumVendor = {
  id: number;
  name: string;
};

const roleOptions = [
  { value: 'tiltaksleder', label: 'Tiltaksleder' },
  { value: 'teamleder', label: 'Teamleder' },
  { value: 'case_manager', label: 'Case manager' },
  { value: 'admin', label: 'Admin' },
];

function formatDate(value: string | null) {
  if (!value) return 'Ikke registrert';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ikke registrert';
  return date.toLocaleString('nb-NO');
}

function getStatusChip(status: string) {
  if (status === 'approved') {
    return <Chip color="success" size="small" icon={<TaskAlt />} label="Godkjent" />;
  }

  if (status === 'rejected') {
    return <Chip color="error" size="small" label="Avvist" />;
  }

  return <Chip color="warning" size="small" icon={<HourglassTop />} label="Venter" />;
}

export default function TidumAccessRequestsPanel() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TidumAccessRequest | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedRole, setSelectedRole] = useState('tiltaksleder');

  const { data: requests = [], error, isLoading } = useQuery<TidumAccessRequest[]>({
    queryKey: ['/api/admin/tidum-access-requests', { status: statusFilter }],
  });

  const { data: vendors = [] } = useQuery<TidumVendor[]>({
    queryKey: ['/api/admin/tidum/vendors'],
  });

  const filteredRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return requests;
    }

    return requests.filter((request) =>
      [
        request.fullName,
        request.email,
        request.company,
        request.orgNumber,
        request.phone,
        request.institutionType,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [requests, searchQuery]);

  const stats = useMemo(() => {
    const base = {
      total: requests.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const request of requests) {
      if (request.status === 'approved') base.approved += 1;
      else if (request.status === 'rejected') base.rejected += 1;
      else base.pending += 1;
    }

    return base;
  }, [requests]);

  const decisionMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
      vendorId,
      role,
    }: {
      requestId: number;
      status: 'approved' | 'rejected';
      vendorId?: number | null;
      role?: string | null;
    }) =>
      apiRequest(`/api/admin/tidum-access-requests/${requestId}`, {
        method: 'PATCH',
        body: { status, vendorId: vendorId ?? null, role: role ?? null },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/tidum-access-requests'] });
      setSelectedRequest(null);
      setSelectedVendorId('');
      setSelectedRole('tiltaksleder');
    },
  });

  const openApproveDialog = (request: TidumAccessRequest) => {
    setSelectedRequest(request);
    setSelectedVendorId(request.vendorId ? String(request.vendorId) : '');
    setSelectedRole(request.approvalRole || 'tiltaksleder');
  };

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#181512' }}>
          Tidum tilgangsforespørsler
        </Typography>
        <Typography sx={{ mt: 0.75, color: '#6f675d', maxWidth: 760 }}>
          Alle tilgangsforespørsler fra Tidum speiles hit. Godkjenning i denne flaten sender
          status tilbake til Tidum og holder begge adminsystemene synket.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {[
          { label: 'Totalt', value: stats.total, icon: <Mail />, tone: '#7c3aed', background: '#f5f3ff' },
          { label: 'Venter', value: stats.pending, icon: <HourglassTop />, tone: '#b45309', background: '#fff7ed' },
          { label: 'Godkjent', value: stats.approved, icon: <CheckCircle />, tone: '#166534', background: '#ecfdf5' },
          { label: 'Virksomheter', value: vendors.length, icon: <Apartment />, tone: '#1d4ed8', background: '#eff6ff' },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <Card sx={{ borderRadius: '20px', border: '1px solid #eadfce', boxShadow: 'none' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', color: '#6f675d' }}>{item.label}</Typography>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#181512' }}>
                      {item.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '14px',
                      display: 'grid',
                      placeItems: 'center',
                      color: item.tone,
                      backgroundColor: item.background,
                    }}
                  >
                    {item.icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ borderRadius: '24px', border: '1px solid #eadfce', boxShadow: 'none' }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Søk i forespørsler"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <FormControl sx={{ minWidth: { xs: '100%', md: 220 } }}>
              <InputLabel id="tidum-status-filter-label">Status</InputLabel>
              <Select
                labelId="tidum-status-filter-label"
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="pending">Venter</MenuItem>
                <MenuItem value="approved">Godkjent</MenuItem>
                <MenuItem value="rejected">Avvist</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {error ? (
            <Alert severity="error">
              Kunne ikke laste Tidum-forespørsler. Sjekk at sync-secret og Tidum API-base er satt i
              CreatorHub-backend.
            </Alert>
          ) : null}

          {isLoading ? (
            <Typography color="text.secondary">Laster Tidum-forespørsler…</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Virksomhet</TableCell>
                  <TableCell>Kontakt</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Opprettet</TableCell>
                  <TableCell align="right">Handling</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.requestId} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600 }}>
                        {request.company || 'Ikke oppgitt'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {request.fullName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Org.nr: {request.orgNumber || 'Ikke oppgitt'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Mail fontSize="small" />
                          <Typography variant="body2">{request.email}</Typography>
                        </Stack>
                        {request.phone ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Phone fontSize="small" />
                            <Typography variant="body2">{request.phone}</Typography>
                          </Stack>
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {request.institutionType || 'Ikke oppgitt'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        BRREG: {request.brregVerified ? 'Verifisert' : 'Ikke verifisert'}
                      </Typography>
                    </TableCell>
                    <TableCell>{getStatusChip(request.status)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(request.createdAt)}</Typography>
                      {request.reviewedAt ? (
                        <Typography variant="caption" color="text.secondary">
                          Sist behandlet {formatDate(request.reviewedAt)}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          disabled={
                            decisionMutation.isPending || request.status === 'rejected'
                          }
                          onClick={() =>
                            decisionMutation.mutate({
                              requestId: request.requestId,
                              status: 'rejected',
                            })
                          }
                        >
                          Avvis
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={decisionMutation.isPending}
                          onClick={() => openApproveDialog(request)}
                        >
                          Godkjenn
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Godkjenn Tidum-forespørsel</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2.5, pt: '12px !important' }}>
          <Alert severity="info">
            Godkjenning her sender status tilbake til Tidum og oppdaterer tilgangsforespørselen der.
          </Alert>

          <TextField
            label="Virksomhet"
            value={selectedRequest?.company || ''}
            disabled
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="tidum-vendor-select-label">Koble til virksomhet</InputLabel>
            <Select
              labelId="tidum-vendor-select-label"
              label="Koble til virksomhet"
              value={selectedVendorId}
              onChange={(event) => setSelectedVendorId(String(event.target.value))}
            >
              {vendors.map((vendor) => (
                <MenuItem key={vendor.id} value={String(vendor.id)}>
                  {vendor.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="tidum-role-select-label">Startrolle</InputLabel>
            <Select
              labelId="tidum-role-select-label"
              label="Startrolle"
              value={selectedRole}
              onChange={(event) => setSelectedRole(String(event.target.value))}
            >
              {roleOptions.map((role) => (
                <MenuItem key={role.value} value={role.value}>
                  {role.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedRequest?.message ? (
            <Box sx={{ p: 2, borderRadius: '16px', backgroundColor: '#faf8f4' }}>
              <Typography sx={{ fontWeight: 700, mb: 0.75 }}>Melding fra søker</Typography>
              <Typography color="text.secondary">{selectedRequest.message}</Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setSelectedRequest(null)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={!selectedVendorId || decisionMutation.isPending || !selectedRequest}
            onClick={() => {
              if (!selectedRequest) return;
              decisionMutation.mutate({
                requestId: selectedRequest.requestId,
                status: 'approved',
                vendorId: Number(selectedVendorId),
                role: selectedRole,
              });
            }}
          >
            Godkjenn og synk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
