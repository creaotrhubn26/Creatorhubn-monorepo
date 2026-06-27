import React, { useState } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Tooltip,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
} from '@mui/material';
import {
  AccountBalance,
  Business,
  CheckCircle,
  Schedule,
  Phone,
  Cancel,
  Email,
  Visibility,
  Edit,
  Sync,
  PictureAsPdf,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminButton, AdminLoading, AdminTableContainer, useIsMobile } from './design-system';

interface FikenRequest {
  id: string;
  userId: string;
  vendorType: string;
  vendorName: string;
  businessInfo: {
    name: string;
    email: string;
    phone?: string;
    website?: string;
    description: string;
    categories: string[];
    organizationNumber?: string;
  };
  fikenIntegrationRequested: boolean;
  fikenIntegrationRequestedAt: string;
  fikenIntegrationStatus: 'pending' | 'contacted' | 'connected' | 'declined';
  fikenIntegrationNotes: string | null;
  createdAt: string;
}

// Export column configuration
interface ExportColumn {
  key: string;
  label: string;
  enabled: boolean;
}

const defaultExportColumns: ExportColumn[] = [
  { key: 'vendorName', label: 'Leverandørnavn', enabled: true },
  { key: 'organizationNumber', label: 'Organisasjonsnummer', enabled: true },
  { key: 'vendorType', label: 'Type', enabled: true },
  { key: 'email', label: 'E-post', enabled: true },
  { key: 'phone', label: 'Telefon', enabled: false },
  { key: 'website', label: 'Nettside', enabled: false },
  { key: 'requestedAt', label: 'Forespurt dato', enabled: true },
  { key: 'status', label: 'Status', enabled: true },
];

interface FikenStats {
  total: number;
  pending: number;
  contacted: number;
  connected: number;
  declined: number;
}

export default function FikenIntegrationRequestsPanel() {
  const queryClient = useQueryClient();
  const { auth } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');
  const isMobile = useIsMobile();

  const [selectedRequest, setSelectedRequest] = useState<FikenRequest | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [currentTab, setCurrentTab] = useState(0);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>(defaultExportColumns);

  // Fetch Fiken integration requests
  const { data: fikenData, isLoading, error } = useQuery({
    queryKey: ['/api/admin/fiken-requests'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/fiken-requests', { headers });
    },
    refetchInterval: 30000,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/fiken-requests/${id}/status`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        method: 'PUT',
        body: JSON.stringify({ status, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fiken-requests'] });
      setShowDetailsDialog(false);
      setSelectedRequest(null);
    },
  });

  const requests: FikenRequest[] = Array.isArray(fikenData?.requests) ? fikenData.requests : [];
  const stats: FikenStats = fikenData?.stats || { total: 0, pending: 0, contacted: 0, connected: 0, declined: 0 };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'contacted': return 'info';
      case 'connected': return 'success';
      case 'declined': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Schedule fontSize="small" />;
      case 'contacted': return <Phone fontSize="small" />;
      case 'connected': return <CheckCircle fontSize="small" />;
      case 'declined': return <Cancel fontSize="small" />;
      default: return <Schedule fontSize="small" />;
    }
  };

  const handleViewDetails = (request: FikenRequest) => {
    setSelectedRequest(request);
    setNewStatus(request.fikenIntegrationStatus);
    setAdminNotes(request.fikenIntegrationNotes || ', ');
    setShowDetailsDialog(true);
  };

  const handleUpdateStatus = () => {
    if (selectedRequest && newStatus) {
      updateStatusMutation.mutate({
        id: selectedRequest.id,
        status: newStatus,
        notes: adminNotes,
      });
    }
  };

  const filteredRequests = currentTab === 0
    ? requests
    : requests.filter(r => {
        const statusMap = ['all','pending','contacted','connected','declined'];
        return r.fikenIntegrationStatus === statusMap[currentTab];
      });

  // Toggle export column
  const handleToggleExportColumn = (key: string) => {
    setExportColumns(prev =>
      prev.map(col => col.key === key ? { ...col, enabled: !col.enabled } : col)
    );
  };

  // Status translation for PDF
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Venter';
      case 'contacted': return 'Kontaktet';
      case 'connected': return 'Tilkoblet';
      case 'declined': return 'Avslått';
      default: return status;
    }
  };

  // PDF Export function
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // CreatorHub orange/amber gradient color
    const creatorHubOrange = [245, 158, 11]; // #f59e0b

    // Header background with CreatorHub branding
    doc.setFillColor(creatorHubOrange[0], creatorHubOrange[1], creatorHubOrange[2]);
    doc.rect(0, 0, pageWidth, 4, 'F');

    // CreatorHub text logo in header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica','bold');
    doc.text('CREATORHUB', 14, 18);

    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.text('NORGE', 14, 26);

    // Report title on the right
    doc.setFontSize(14);
    doc.setFont('helvetica','bold');
    doc.text('Fiken Integrasjonsforespørsler', pageWidth - 14, 18, { align: 'right' });

    // Export date
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    doc.text(`Eksportert: ${new Date().toLocaleDateString('nb-NO')} kl. ${new Date().toLocaleTimeString('nb-NO')}`, pageWidth - 14, 26, { align: 'right' });

    // Fiken logo area (small box with Fiken branding)
    doc.setFillColor(82, 57, 186); // Fiken purple
    doc.roundedRect(14, 45, 50, 18, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica','bold');
    doc.text('fiken', 24, 56);
    doc.setFontSize(8);
    doc.text('integrasjon', 24, 61);

    // Stats summary box
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(70, 45, pageWidth - 84, 18, 2, 2, 'F');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    doc.setFont('helvetica','normal');
    const statsText = `Totalt: ${stats.total}  |  Venter: ${stats.pending}  |  Kontaktet: ${stats.contacted}  |  Tilkoblet: ${stats.connected}  |  Avslått: ${stats.declined}`;
    doc.text(statsText, 75, 56);

    // Get enabled columns
    const enabledColumns = exportColumns.filter(col => col.enabled);

    // Build table headers
    const headers = enabledColumns.map(col => col.label);

    // Build table data based on enabled columns
    const tableData = filteredRequests.map((request) => {
      return enabledColumns.map(col => {
        switch (col.key) {
          case 'vendorName': return request.vendorName || '-';
          case 'organizationNumber': return request.businessInfo?.organizationNumber || '-';
          case 'vendorType': return request.vendorType || '-';
          case 'email': return request.businessInfo?.email || '-';
          case 'phone': return request.businessInfo?.phone || '-';
          case 'website': return request.businessInfo?.website || '-';
          case 'requestedAt': return new Date(request.fikenIntegrationRequestedAt).toLocaleDateString('nb-NO');
          case 'status': return getStatusLabel(request.fikenIntegrationStatus);
          default: return '-';
        }
      });
    });

    // Calculate column widths dynamically
    const availableWidth = pageWidth - 28;
    const colWidth = Math.floor(availableWidth / enabledColumns.length);

    // Generate table
    autoTable(doc, {
      startY: 70,
      head: [headers],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [82, 57, 186], // Fiken purple
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 250],
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
      },
      columnStyles: enabledColumns.reduce((acc, _, index) => {
        acc[index] = { cellWidth: colWidth };
        return acc;
      }, {} as Record<number, { cellWidth: number }>),
    });

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.getHeight();

      // Footer line
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.5);
      doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Side ${i} av ${pageCount}`,
        14,
        pageHeight - 8
      );
      doc.text(
        'CreatorHub Norge - Fiken Integrasjonsforespørsler',
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
      doc.text(
        new Date().toLocaleDateString('nb-NO'),
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }

    // Save PDF
    const fileName = `fiken-integrasjon-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    setShowExportDialog(false);
  };

  if (isLoading) {
    return <AdminLoading label="Laster forespørsler …" />;
  }

  return (
    <Box>
      {/* Header with Fiken Logo */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, bgcolor: 'white', borderRadius: 2, boxShadow: 1, mr: 2 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12.462,15.174C11.743,15.174 11.055,14.892 10.548,14.391C10.041,13.89 9.757,13.211 9.759,12.504L9.759,11.471C9.752,5.672 14.515,0.962 20.405,0.944C22.528,0.941 24.603,1.568 26.359,2.743C27.573,3.575 27.884,5.212 27.058,6.421C26.233,7.629 24.576,7.962 23.335,7.169C22.471,6.591 21.45,6.283 20.405,6.285C17.504,6.295 15.16,8.616 15.164,11.471L15.164,12.509C15.166,13.216 14.882,13.894 14.375,14.395C13.868,14.896 13.18,15.178 12.462,15.179" fill="#75ABF7"/>
              <path d="M21.45,17.681L15.161,17.681L15.161,11.472C15.195,10.5 14.688,9.587 13.838,9.092C12.989,8.596 11.932,8.596 11.082,9.092C10.233,9.587 9.725,10.5 9.759,11.472L9.759,17.686L3.47,17.686C1.972,17.686 0.758,18.881 0.758,20.356C0.758,21.831 1.972,23.027 3.47,23.027L9.759,23.027L9.759,29.241C9.735,30.206 10.245,31.109 11.091,31.599C11.937,32.088 12.985,32.088 13.831,31.599C14.677,31.109 15.187,30.206 15.163,29.241L15.163,23.022L21.452,23.022C22.95,23.022 24.164,21.826 24.164,20.352C24.164,18.877 22.95,17.681 21.452,17.681" fill="#5239BA"/>
            </svg>
            <Typography variant="h6" sx={{ ml: 1, fontWeight: 500, color: '#5239BA' }}>fiken</Typography>
          </Box>
          <Box>
            <Typography variant="h5" component="h2" fontWeight="bold">Fiken Integrasjonsforespørsler</Typography>
            <Typography variant="body2" color="text.secondary">
              Oversikt over leverandører som ønsker Fiken-integrasjon
            </Typography>
          </Box>
        </Box>
        {/* Export PDF Button */}
        <Button
          variant="contained"
          startIcon={<PictureAsPdf />}
          onClick={() => setShowExportDialog(true)}
          disabled={filteredRequests.length === 0}
          sx={{
            bgcolor: '#5239BA', '&:hover': { bgcolor: '#3d2a8a' }}}
        >
          Eksporter PDF
        </Button>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ flex: '1 1 120px', minWidth: 120 }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="primary">{stats.total}</Typography>
            <Typography variant="body2" color="text.secondary">Totalt</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 120px', minWidth: 120, borderLeft: '3px solid #ed6c02' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="warning.main">{stats.pending}</Typography>
            <Typography variant="body2" color="text.secondary">Venter</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 120px', minWidth: 120, borderLeft: '3px solid #0288d1' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="info.main">{stats.contacted}</Typography>
            <Typography variant="body2" color="text.secondary">Kontaktet</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 120px', minWidth: 120, borderLeft: '3px solid #2e7d32' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="success.main">{stats.connected}</Typography>
            <Typography variant="body2" color="text.secondary">Tilkoblet</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 120px', minWidth: 120, borderLeft: '3px solid #d32f2f' }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" color="error.main">{stats.declined}</Typography>
            <Typography variant="body2" color="text.secondary">Avslått</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs */}
      <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Alle (${stats.total})`} />
        <Tab label={`Venter (${stats.pending})`} />
        <Tab label={`Kontaktet (${stats.contacted})`} />
        <Tab label={`Tilkoblet (${stats.connected})`} />
        <Tab label={`Avslått (${stats.declined})`} />
      </Tabs>

      {/* Requests Table */}
      <AdminTableContainer ariaLabel="Fiken-integrasjonsforespørsler">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Leverandør</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Kontaktinfo</TableCell>
              <TableCell>Forespurt</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    Ingen forespørsler funnet
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business color="action" />
                      <Box>
                        <Typography fontWeight="medium">{request.vendorName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.businessInfo?.description?.substring(0, 50)}...
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={request.vendorType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{request.businessInfo?.email}</Typography>
                    {request.businessInfo?.phone && (
                      <Typography variant="caption" color="text.secondary">
                        {request.businessInfo.phone}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(request.fikenIntegrationRequestedAt).toLocaleDateString('nb-NO')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(request.fikenIntegrationStatus)}
                      label={request.fikenIntegrationStatus}
                      color={getStatusColor(request.fikenIntegrationStatus) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Se detaljer">
                      <IconButton size="small" aria-label="Se detaljer" onClick={() => handleViewDetails(request)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Send e-post">
                      <IconButton size="small" aria-label="Send e-post" href={`mailto:${request.businessInfo?.email}`}>
                        <Email />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </AdminTableContainer>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onClose={() => setShowDetailsDialog(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalance color="primary" />
            Fiken-integrasjon: {selectedRequest?.vendorName}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRequest && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Bedriftsinformasjon</Typography>
                <Typography><strong>Navn:</strong> {selectedRequest.businessInfo?.name}</Typography>
                <Typography><strong>E-post:</strong> {selectedRequest.businessInfo?.email}</Typography>
                {selectedRequest.businessInfo?.phone && (
                  <Typography><strong>Telefon:</strong> {selectedRequest.businessInfo.phone}</Typography>
                )}
                {selectedRequest.businessInfo?.website && (
                  <Typography><strong>Nettside:</strong> {selectedRequest.businessInfo.website}</Typography>
                )}
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Beskrivelse</Typography>
                <Typography variant="body2">{selectedRequest.businessInfo?.description}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Forespurt dato</Typography>
                <Typography>
                  {new Date(selectedRequest.fikenIntegrationRequestedAt).toLocaleString('nb-NO')}
                </Typography>
              </Box>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select value={newStatus} label="Status" onChange={(e) => setNewStatus(e.target.value)}>
                  <MenuItem value="pending">Venter</MenuItem>
                  <MenuItem value="contacted">Kontaktet</MenuItem>
                  <MenuItem value="connected">Tilkoblet</MenuItem>
                  <MenuItem value="declined">Avslått</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Admin-notater"
                multiline
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Legg til notater om kontakt, oppfølging, etc."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setShowDetailsDialog(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleUpdateStatus}
            loading={updateStatusMutation.isPending}
            startIcon={<Sync />}
          >
            Oppdater status
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* Export PDF Dialog */}
      <Dialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PictureAsPdf sx={{ color: '#f59e0b' }} />
          <Box>
            <Typography variant="h6">Eksporter til PDF</Typography>
            <Typography variant="body2" color="text.secondary">
              Velg hvilke kolonner du vil inkludere i eksporten
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* CreatorHub branding preview */}
          <Box sx={{
            p: 2,
            mb: 3,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)',
            color: 'white'
          }}>
            <Typography variant="h6" fontWeight="bold">CREATORHUB</Typography>
            <Typography variant="caption">NORGE - Fiken Integrasjonsforespørsler</Typography>
          </Box>

          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Velg kolonner for eksport:
          </Typography>

          <FormGroup>
            {exportColumns.map((col) => (
              <FormControlLabel
                key={col.key}
                control={
                  <Checkbox
                    checked={col.enabled}
                    onChange={() => handleToggleExportColumn(col.key)}
                    sx={{
                      color: '#5239BA','&.Mui-checked': { color: '#5239BA' }
                    }}
                  />
                }
                label={col.label}
              />
            ))}
          </FormGroup>

          <Divider sx={{ my: 2 }} />

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{filteredRequests.length}</strong> forespørsler vil bli eksportert
              {currentTab > 0 && ' (filtrert)'}
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <AdminButton tone="ghost" onClick={() => setShowExportDialog(false)}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleExportPDF}
            disabled={exportColumns.filter(c => c.enabled).length === 0}
            startIcon={<PictureAsPdf />}
          >
            Last ned PDF
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

