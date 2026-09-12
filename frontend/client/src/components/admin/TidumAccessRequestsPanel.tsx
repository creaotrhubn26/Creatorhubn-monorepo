import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { TableVirtuoso } from 'react-virtuoso';
import type { TableHeadProps } from '@mui/material/TableHead';
import {
  Apartment,
  CheckCircle,
  HourglassTop,
  Mail,
  Phone,
} from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  AdminButton,
  AdminError,
  AdminLoading,
  StatusChip,
  useIsMobile,
} from './design-system';

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
  orgNumber?: string | null;
  organizationNumber?: string | null;
  brregVerified?: boolean | null;
};

type TidumBrregCompany = {
  organizationNumber: string;
  name: string;
  organizationForm: string;
  organizationFormCode: string | null;
  industry: string;
  industryCode: string | null;
  employees: number | null;
  website: string | null;
  registeredVat: boolean;
  bankrupt: boolean;
  underLiquidation: boolean;
  businessAddress: {
    addressLine: string;
    postalCode: string;
    city: string;
    municipality: string;
  };
  mailingAddress: {
    addressLine: string;
    postalCode: string;
    city: string;
    municipality: string;
  };
  source: 'brreg';
};

const roleOptions = [
  { value: 'tiltaksleder', label: 'Tiltaksleder' },
  { value: 'teamleder', label: 'Teamleder' },
  { value: 'case_manager', label: 'Case manager' },
  { value: 'admin', label: 'Admin' },
];

const TIDUM_PANEL_QUERY_STALE_MS = 60 * 1000;
const TIDUM_PANEL_QUERY_GC_MS = 10 * 60 * 1000;

function formatDate(value: string | null) {
  if (!value) return 'Ikke registrert';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ikke registrert';
  return date.toLocaleString('nb-NO');
}

function normalizeOrgNumber(value?: string | number | null) {
  return typeof value === 'string'
    ? value.replace(/\D/g, '')
    : typeof value === 'number'
      ? String(value).replace(/\D/g, '')
      : '';
}

function formatOrgNumber(value?: string | number | null) {
  const normalized = normalizeOrgNumber(value);
  if (normalized.length !== 9) return normalized || 'Ikke oppgitt';
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
}

function getVendorOrgNumber(vendor: TidumVendor) {
  return normalizeOrgNumber(vendor.orgNumber || vendor.organizationNumber || null);
}

function findVendorForBrregCompany(vendors: TidumVendor[], company: TidumBrregCompany | null) {
  if (!company) return null;
  const companyOrgNumber = normalizeOrgNumber(company.organizationNumber);
  if (!companyOrgNumber) return null;
  return vendors.find((vendor) => getVendorOrgNumber(vendor) === companyOrgNumber) || null;
}

function getStatusChip(status: string) {
  if (status === 'approved') {
    return <StatusChip tone="success" label="Godkjent" />;
  }

  if (status === 'rejected') {
    return <StatusChip tone="error" label="Avvist" />;
  }

  return <StatusChip tone="warning" label="Venter" />;
}

export default function TidumAccessRequestsPanel() {
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TidumAccessRequest | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedRole, setSelectedRole] = useState('tiltaksleder');
  const [brregInputValue, setBrregInputValue] = useState('');
  const [debouncedBrregQuery, setDebouncedBrregQuery] = useState('');
  const [selectedBrregCompany, setSelectedBrregCompany] = useState<TidumBrregCompany | null>(null);
  const [brregVendorMessage, setBrregVendorMessage] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedBrregQuery(brregInputValue.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [brregInputValue]);

  const { data: requests = [], error, isLoading } = useQuery<TidumAccessRequest[]>({
    queryKey: ['/api/admin/tidum-access-requests', { status: statusFilter }],
    staleTime: TIDUM_PANEL_QUERY_STALE_MS,
    gcTime: TIDUM_PANEL_QUERY_GC_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: vendors = [] } = useQuery<TidumVendor[]>({
    queryKey: ['/api/admin/tidum/vendors'],
    staleTime: TIDUM_PANEL_QUERY_STALE_MS,
    gcTime: TIDUM_PANEL_QUERY_GC_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const normalizedBrregQuery = debouncedBrregQuery.trim();
  const brregQueryDigits = normalizeOrgNumber(normalizedBrregQuery);
  const brregNumericOnlyQuery = normalizedBrregQuery.replace(/[\s.-]/g, '');
  const brregSearchEnabled = Boolean(selectedRequest) && (
    brregQueryDigits.length === 9 ||
    (normalizedBrregQuery.length >= 3 && !/^\d+$/.test(brregNumericOnlyQuery))
  );

  const {
    data: brregSearchPayload,
    error: brregSearchError,
    isFetching: brregSearching,
  } = useQuery<{ items: TidumBrregCompany[] }>({
    queryKey: ['tidum-brreg-search', normalizedBrregQuery],
    queryFn: () =>
      apiRequest(
        `/api/admin/tidum/brreg-search?q=${encodeURIComponent(normalizedBrregQuery)}&limit=10`,
      ),
    enabled: brregSearchEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const brregOptions = Array.isArray(brregSearchPayload?.items) ? brregSearchPayload.items : [];
  const existingVendorForSelectedBrreg = useMemo(
    () => findVendorForBrregCompany(vendors, selectedBrregCompany),
    [selectedBrregCompany, vendors],
  );
  const selectedVendorExists = vendors.some((vendor) => String(vendor.id) === selectedVendorId);

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

  const resetApprovalDialog = () => {
    setSelectedRequest(null);
    setSelectedVendorId('');
    setSelectedRole('tiltaksleder');
    setBrregInputValue('');
    setDebouncedBrregQuery('');
    setSelectedBrregCompany(null);
    setBrregVendorMessage('');
  };

  const createVendorMutation = useMutation({
    mutationFn: async (company: TidumBrregCompany) =>
      apiRequest('/api/admin/tidum/vendors', {
        method: 'POST',
        body: { company },
      }) as Promise<TidumVendor>,
    onSuccess: (vendor) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/tidum/vendors'] });
      setSelectedVendorId(String(vendor.id));
      setBrregVendorMessage(`Opprettet ${vendor.name} i Tidum og valgte virksomheten.`);
    },
  });

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
      resetApprovalDialog();
    },
  });

  const openApproveDialog = (request: TidumAccessRequest) => {
    setSelectedRequest(request);
    setSelectedVendorId(request.vendorId ? String(request.vendorId) : '');
    setSelectedRole(request.approvalRole || 'tiltaksleder');
    setBrregInputValue(request.orgNumber || request.company || '');
    setDebouncedBrregQuery(request.orgNumber || request.company || '');
    setSelectedBrregCompany(null);
    setBrregVendorMessage('');
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box>
        <Box
          component="img"
          src="/tidum-logo.png"
          alt="Tidum"
          sx={{
            height: 40,
            width: 'auto',
            mb: 1,
            display: 'block',
            // Logoen er laget for lys bakgrunn; gi den en lys «plate» så den
            // leser tydelig mot det mørke admin-skallet.
            bgcolor: 'rgba(255,255,255,0.92)',
            borderRadius: '10px',
            px: 1,
            py: 0.5,
          }}
        />
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700, color: '#ffffff' }}>
          Tidum tilgangsforespørsler
        </Typography>
        <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,0.6)', maxWidth: 760 }}>
          Alle tilgangsforespørsler fra Tidum speiles hit. Godkjenning i denne flaten sender
          status tilbake til Tidum og holder begge adminsystemene synket.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {[
          { label: 'Totalt', value: stats.total, icon: <Mail aria-hidden="true" />, tone: '#7c3aed', background: 'rgba(124,58,237,0.18)' },
          { label: 'Venter', value: stats.pending, icon: <HourglassTop aria-hidden="true" />, tone: '#b45309', background: 'rgba(180,83,9,0.20)' },
          { label: 'Godkjent', value: stats.approved, icon: <CheckCircle aria-hidden="true" />, tone: '#166534', background: 'rgba(22,101,52,0.22)' },
          { label: 'Virksomheter', value: vendors.length, icon: <Apartment aria-hidden="true" />, tone: '#1d4ed8', background: 'rgba(29,78,216,0.20)' },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <Card sx={{ borderRadius: '20px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'none' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>{item.label}</Typography>
                    <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#ffffff' }}>
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

      <Card sx={{ borderRadius: '24px', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'none' }}>
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
            <AdminError message="Kunne ikke laste Tidum-forespørsler. Sjekk at sync-secret og Tidum API-base er satt i CreatorHub-backend." />
          ) : null}

          {isLoading ? (
            <AdminLoading label="Laster Tidum-forespørsler…" />
          ) : (
            <Paper style={{ height: 560, width: '100%' }} elevation={0}>
              {/* Virtualisert (react-virtuoso) – tåler ubegrenset antall
                  forespørsler uten å tynge DOM-en. Handlinger uendret. */}
              <TableVirtuoso
                data={filteredRequests}
                components={{
                  Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
                    <TableContainer {...props} ref={ref} />
                  )),
                  Table: (props) => (
                    <Table {...props} size="small" sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }} />
                  ),
                  TableHead: React.forwardRef<HTMLTableSectionElement, TableHeadProps>((props, ref) => (
                    <TableHead {...props} ref={ref} />
                  )),
                  TableRow: ({ item: _item, ...props }) => <TableRow {...props} hover />,
                  TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
                    <TableBody {...props} ref={ref} />
                  )),
                }}
                fixedHeaderContent={() => (
                  <TableRow>
                    <TableCell sx={{ width: 220 }}>Virksomhet</TableCell>
                    <TableCell sx={{ width: 200 }}>Kontakt</TableCell>
                    <TableCell sx={{ width: 160 }}>Type</TableCell>
                    <TableCell sx={{ width: 130 }}>Status</TableCell>
                    <TableCell sx={{ width: 150 }}>Opprettet</TableCell>
                    <TableCell align="right" sx={{ width: 200 }}>Handling</TableCell>
                  </TableRow>
                )}
                itemContent={(_index, request) => (
                  <>
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
                          <Mail fontSize="small" aria-hidden="true" />
                          <Typography variant="body2">{request.email}</Typography>
                        </Stack>
                        {request.phone ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Phone fontSize="small" aria-hidden="true" />
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
                        <AdminButton
                          size="small"
                          tone="danger"
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
                        </AdminButton>
                        <AdminButton
                          size="small"
                          tone="primary"
                          disabled={decisionMutation.isPending}
                          onClick={() => openApproveDialog(request)}
                        >
                          Godkjenn
                        </AdminButton>
                      </Stack>
                    </TableCell>
                  </>
                )}
              />
            </Paper>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedRequest)}
        onClose={resetApprovalDialog}
        fullScreen={isMobile}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Godkjenn Tidum-forespørsel</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2.5, pt: '12px !important' }}>
          <Alert severity="info">
            Godkjenning her sender status tilbake til Tidum og oppdaterer tilgangsforespørselen der.
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <TextField
                label="Virksomhet fra forespørsel"
                value={selectedRequest?.company || ''}
                disabled
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                label="Org.nr fra forespørsel"
                value={formatOrgNumber(selectedRequest?.orgNumber)}
                disabled
                fullWidth
              />
            </Grid>
          </Grid>

          <Box sx={{ p: 2, borderRadius: '18px', border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#ffffff' }}>
                  Finn virksomhet i Brønnøysundregistrene
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Søk på navn eller 9-sifret organisasjonsnummer. Valgt bedrift kan kobles til
                  eksisterende Tidum-leverandør eller opprettes som ny leverandør.
                </Typography>
              </Box>

              <Autocomplete
                value={selectedBrregCompany}
                inputValue={brregInputValue}
                options={brregOptions}
                loading={brregSearching}
                filterOptions={(options) => options}
                isOptionEqualToValue={(option, value) =>
                  option.organizationNumber === value.organizationNumber
                }
                getOptionLabel={(option) =>
                  `${option.name} (${formatOrgNumber(option.organizationNumber)})`
                }
                noOptionsText={
                  brregSearchEnabled
                    ? 'Ingen BRREG-treff'
                    : 'Skriv minst 3 tegn, eller hele organisasjonsnummeret'
                }
                onInputChange={(_, value) => setBrregInputValue(value)}
                onChange={(_, company) => {
                  setSelectedBrregCompany(company);
                  const existingVendor = findVendorForBrregCompany(vendors, company);
                  if (existingVendor) {
                    setSelectedVendorId(String(existingVendor.id));
                    setBrregVendorMessage(
                      `Fant eksisterende Tidum-leverandør: ${existingVendor.name}.`,
                    );
                  } else {
                    setBrregVendorMessage('');
                  }
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.organizationNumber}>
                    <Stack spacing={0.25}>
                      <Typography sx={{ fontWeight: 700 }}>{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Org.nr {formatOrgNumber(option.organizationNumber)}
                        {option.businessAddress.city ? ` · ${option.businessAddress.city}` : ''}
                        {option.organizationForm ? ` · ${option.organizationForm}` : ''}
                      </Typography>
                    </Stack>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Søk i BRREG"
                    placeholder="Firmanavn eller org.nr."
                    helperText="Data hentes live fra Enhetsregisteret."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {brregSearching ? <CircularProgress color="inherit" size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />

              {brregSearchError ? (
                <Alert severity="error">
                  Kunne ikke søke i BRREG. Prøv igjen, eller sjekk organisasjonsnummeret.
                </Alert>
              ) : null}

              {selectedBrregCompany ? (
                <Box sx={{ p: 2, borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>{selectedBrregCompany.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Org.nr {formatOrgNumber(selectedBrregCompany.organizationNumber)}
                          {selectedBrregCompany.organizationForm
                            ? ` · ${selectedBrregCompany.organizationForm}`
                            : ''}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          color={selectedBrregCompany.registeredVat ? 'success' : 'default'}
                          label={selectedBrregCompany.registeredVat ? 'MVA-registrert' : 'Ikke MVA'}
                        />
                        <Chip size="small" label="BRREG-verifisert" />
                      </Stack>
                    </Stack>

                    <Typography variant="body2" color="text.secondary">
                      {selectedBrregCompany.businessAddress.addressLine || 'Adresse ikke oppgitt'}
                      {selectedBrregCompany.businessAddress.postalCode
                        ? `, ${selectedBrregCompany.businessAddress.postalCode}`
                        : ''}
                      {selectedBrregCompany.businessAddress.city
                        ? ` ${selectedBrregCompany.businessAddress.city}`
                        : ''}
                    </Typography>

                    {selectedBrregCompany.bankrupt || selectedBrregCompany.underLiquidation ? (
                      <Alert severity="warning">
                        BRREG markerer virksomheten som konkurs eller under avvikling. Kontroller før
                        godkjenning.
                      </Alert>
                    ) : null}

                    {brregVendorMessage ? (
                      <Alert severity="success">{brregVendorMessage}</Alert>
                    ) : null}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      {existingVendorForSelectedBrreg ? (
                        <AdminButton
                          tone="primary"
                          onClick={() => {
                            setSelectedVendorId(String(existingVendorForSelectedBrreg.id));
                            setBrregVendorMessage(
                              `Valgte eksisterende Tidum-leverandør: ${existingVendorForSelectedBrreg.name}.`,
                            );
                          }}
                        >
                          Bruk eksisterende Tidum-leverandør
                        </AdminButton>
                      ) : (
                        <AdminButton
                          tone="primary"
                          loading={createVendorMutation.isPending}
                          onClick={() => createVendorMutation.mutate(selectedBrregCompany)}
                        >
                          Opprett leverandør fra BRREG
                        </AdminButton>
                      )}
                      {createVendorMutation.error ? (
                        <Alert severity="error" sx={{ flex: 1 }}>
                          Kunne ikke opprette leverandør i Tidum.
                        </Alert>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </Box>

          <FormControl fullWidth>
            <InputLabel id="tidum-vendor-select-label">Koble til virksomhet</InputLabel>
            <Select
              labelId="tidum-vendor-select-label"
              label="Koble til virksomhet"
              value={selectedVendorId}
              onChange={(event) => setSelectedVendorId(String(event.target.value))}
            >
              {selectedVendorId && !selectedVendorExists ? (
                <MenuItem value={selectedVendorId}>Valgt leverandør #{selectedVendorId}</MenuItem>
              ) : null}
              {vendors.map((vendor) => (
                <MenuItem key={vendor.id} value={String(vendor.id)}>
                  <Stack spacing={0.25}>
                    <Typography>{vendor.name}</Typography>
                    {getVendorOrgNumber(vendor) ? (
                      <Typography variant="caption" color="text.secondary">
                        Org.nr {formatOrgNumber(getVendorOrgNumber(vendor))}
                        {vendor.brregVerified ? ' · BRREG' : ''}
                      </Typography>
                    ) : null}
                  </Stack>
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
            <Box sx={{ p: 2, borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <Typography sx={{ fontWeight: 700, mb: 0.75 }}>Melding fra søker</Typography>
              <Typography color="text.secondary">{selectedRequest.message}</Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <AdminButton tone="ghost" onClick={resetApprovalDialog}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            disabled={
              !selectedVendorId ||
              decisionMutation.isPending ||
              createVendorMutation.isPending ||
              !selectedRequest
            }
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
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
  );
}
