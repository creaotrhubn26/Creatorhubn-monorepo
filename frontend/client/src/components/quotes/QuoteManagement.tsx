/**
 * CreatorHub Norge - Quote Management Component
 * View, filter, and convert quotes to projects
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import QuoteKanbanView from './QuoteKanbanView';
import QuoteReminderSettings from './QuoteReminderSettings';
import { quoteDriveSync } from '@/services/quote-drive-sync';
import { quoteArchiveConfig } from '@/services/document-archive-config';
import { mapQuoteToFikenInvoice, ensureFikenCustomer } from '@/lib/fiken/invoice-mapper';
import { createFikenClient } from '@/lib/fiken/api';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stack,
  Alert,
  Tab,
  Tabs,
  Tooltip,
  Menu,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  CheckCircle,
  Cancel,
  AccessTime,
  AttachMoney,
  CalendarToday,
  Visibility,
  Edit,
  Delete,
  Add as AddIcon,
  TrendingUp,
  FilterList,
  ContentCopy,
  Send,
  Email,
  GetApp,
  MoreVert,
  VisibilityOff,
  MarkEmailRead,
  MarkEmailUnread,
  Warning,
  Chat,
  ViewModule as GridViewIcon,
  ViewKanban as KanbanViewIcon,
  Settings as SettingsIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import ContractAmendmentHistory from '../contracts/ContractAmendmentHistory';

interface Quote {
  id: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  description: string;
  basePrice: string;
  totalAmount: string;
  currency: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'draft';
  validUntil: string;
  profession: string;
  projectType: string;
  clientInfo: {
    name: string;
    address: string;
    phoneNumber: string;
    email: string;
  };
  approvers: unknown[];
  projectCreationData: unknown;
  projectId?: string;
  createdAt: string;
  sentAt: string;
  acceptedAt?: string;
  viewedAt?: string;
  businessInfo?: any;
  isFinal?: boolean; // Mark if this is the final version
  // Contract amendment tracking
  quoteType?: string; // 'standard','extra_images','contract_amendment'
  contractAmendmentFor?: string; // Original project ID if amendment
  // Fiken invoice tracking
  fikenInvoiceId?: string;
  fikenInvoiceNumber?: string;
  fikenCustomerId?: string;
  fikenInvoiceStatus?: string;
  fikenSyncStatus?: string;
  fikenInvoiceUrl?: string;
}

interface QuoteManagementProps {
  onCreateProject?: (quoteData: unknown) => void;
}

export default function QuoteManagement({ onCreateProject }: QuoteManagementProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Use user's profession for theming, fallback to 'photographer'
  const userProfession = user?.profession || 'photographer';
  const theming = useTheming(userProfession);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [quoteMenuAnchor, setQuoteMenuAnchor] = useState<{
    element: HTMLElement;
    quote: Quote;
  } | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedQuoteForAction, setSelectedQuoteForAction] = useState<Quote | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
  const [driveSyncEnabled] = useState(true);

  // Fiken integration state
  const [fikenInvoiceDialogOpen, setFikenInvoiceDialogOpen] = useState(false);
  const [fikenInvoiceCreating, setFikenInvoiceCreating] = useState(false);
  const [fikenError, setFikenError] = useState<string | null>(null);
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('');

  // Amendment history state
  const [amendmentHistoryOpen, setAmendmentHistoryOpen] = useState(false);
  const [selectedProjectForHistory, setSelectedProjectForHistory] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Subscribe to quote drive sync updates
  useEffect(() => {
    const unsubscribe = quoteDriveSync.subscribe((jobs) => {
      console.log(`📊 Quote sync jobs updated: ${jobs.length} active, `);
    });
    return unsubscribe;
  }, []);

  // Set default account code when data is fetched
  useEffect(() => {
    if (accountCodeData?.accountCode && !selectedAccountCode) {
      setSelectedAccountCode(accountCodeData.accountCode);
    }
  }, [accountCodeData, selectedAccountCode]);

  // Helper to sync quote to Google Drive
  const syncQuoteToDrive = (quote: Quote) => {
    if (!driveSyncEnabled) return;

    const quoteDate = new Date(quote.createdAt);
    const quotePdfUrl = `/api/quotes/${quote.id}/pdf`;

    console.log()
      `📊 Syncing quote ${quote.quoteNumber} for ${quote.clientName} to Google Drive${quote.isFinal ? ' (FINAL)' : ','}`,
    );

    quoteDriveSync.queueUpload()
      quote.id,
      quote.quoteNumber,
      quote.clientName,
      quotePdfUrl,
      quote.projectId,
      undefined, // Will use default from config
      quoteDate,
      quote.status,
      quote.isFinal,
    );
  };

  // Fetch all quotes
  const { data: quotesData, isLoading } = useQuery({
    queryKey: ['/api/quotes/all,', statusFilter, user?.id],
    queryFn: async () => {
      let url;
      if (statusFilter === 'all') {
        url = `/api/quotes/all?userId=${user?.id}`;
      } else if (statusFilter === 'extra_images') {
        url = `/api/quotes/all?userId=${user?.id}&quoteType=extra_images&status=pending`;
      } else {
        url = `/api/quotes/all?userId=${user?.id}&status=${statusFilter}`;
      }
      return apiRequest(url);
    },
    enabled: !!user?.id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch quote statistics
  const { data: statsData } = useQuery({
    queryKey: ['/api/quotes/stats/overview,', user?.id],
    queryFn: () => apiRequest(`/api/quotes/stats/overview?userId=${user?.id}`),
    enabled: !!user?.id,
  });

  // Fetch recommended account code for Fiken invoice
  const { data: accountCodeData } = useQuery({
    queryKey: ['/api/fiken/invoices/account-code', user?.id],
    queryFn: () => apiRequest('/api/fiken/invoices/account-code'),
    enabled: !!user?.id && fikenInvoiceDialogOpen,
  });

  const quotes = quotesData?.quotes || [];
  const stats = statsData?.stats || {
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    totalValue: 0,
    acceptedValue: 0,
    conversionRate: 0,
  };

  // Update quote status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: string }) => {
      // Mark as final when accepting
      const updateData: unknown = { status };
      if (status === 'accepted') {
        updateData.isFinal = true;
      }

      return apiRequest(`/api/quotes/${quoteId}/status`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/stats/overview'] });
      setDetailDialogOpen(false);

      // Auto-sync to Google Drive when status changes to accepted (will be marked as FINAL)
      if (variables.status === 'accepted' && selectedQuote) {
        // Create updated quote object with isFinal flag
        const finalQuote = { ...selectedQuote, isFinal: true };
        syncQuoteToDrive(finalQuote);

        // Prompt to create Fiken invoice
        setFikenInvoiceDialogOpen(true);
      }
    },
  });

  // Update quote mutation
  const updateQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, updateData }: { quoteId: string; updateData: any }) => {
      return apiRequest(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/stats/overview'] });
      setEditDialogOpen(false);
      setDetailDialogOpen(false);
    },
  });

  // Duplicate quote mutation
  const duplicateQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const [originalQuote] = await queryClient.fetchQuery({
        queryKey: [`/api/quotes/${quoteId}`],
        queryFn: () => apiRequest(`/api/quotes/${quoteId}`),
      });

      return apiRequest('/api/quotes/create', {
        method: 'POST',
        body: JSON.stringify({
          ...originalQuote,
          id: undefined,
          quoteNumber: undefined,
          title: `${originalQuote.title} (Kopi)`,
          status: 'draft',
          sentAt: null,
          acceptedAt: null,
          respondedAt: null,
          viewedAt: null,
          projectId: null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/stats/overview'] });
    },
  });

  // Send quote email mutation
  const sendQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, quote }: { quoteId: string; quote: Quote }) => {
      return apiRequest(`/api/quotes/${quoteId}/send-email`, {
        method: 'POST',
        body: JSON.stringify({
          clientEmail: quote.clientEmail,
          clientName: quote.clientName,
          projectId: quote.projectId || quoteId,
          photographerId: user?.id,
          quoteDetails: {
            projectType: quote.projectType,
            totalAmount: parseFloat(quote.totalAmount),
            includedImages: quote.projectCreationData?.package?.includedImages || 0,
            packageName: quote.projectCreationData?.package?.name || 'Tilpasset',
            deliveryTime: '2-3 uker' },
        }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      setSendDialogOpen(false);

      // Auto-sync to Google Drive after sending
      syncQuoteToDrive(variables.quote);
    },
  });

  // Export to Google Sheets mutation
  const exportToSheetsMutation = useMutation({
    mutationFn: async () => {
      const allQuotes = quotes;

      // Format data for Google Sheets
      const sheetData = allQuotes.map((q: Quote) => [
        q.quoteNumber,
        q.clientName,
        q.clientEmail,
        q.title,
        q.totalAmount,
        q.status,
        new Date(q.createdAt).toLocaleDateString('nb-NO'),
        q.sentAt ? new Date(q.sentAt).toLocaleDateString('nb-NO') : '-',
        q.viewedAt ? new Date(q.viewedAt).toLocaleDateString('nb-NO') : 'Ikke åpnet',
        new Date(q.validUntil).toLocaleDateString('nb-NO'),
      ]);

      return apiRequest('/api/google-sheets/export-quotes', {
        method: 'POST',
        headers: {
          'x-user-email': user?.email || ',',
        },
        body: JSON.stringify({
          sheetName: `Tilbud - ${new Date().toLocaleDateString('nb-NO')}`,
          headers: [
            'Tilbudsnummer','Kunde','E-post''Tittel','Beløp','Status', 'Opprettet', 'Sendt', 'Åpnet', 'Gyldig til',
          ],
          data: sheetData,
        }),
      });
    },
  });

  // Link quote to project mutation
  const linkProjectMutation = useMutation({
    mutationFn: async ({ quoteId, projectId }: { quoteId: string; projectId: string }) => {
      return apiRequest(`/api/quotes/${quoteId}/link-project`, {
        method: 'PUT',
        body: JSON.stringify({ projectId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      setConvertDialogOpen(false);
    },
  });

  // Create chat space for quote mutation
  const createChatMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiRequest(`/api/quotes/${quoteId}/create-chat`, {
        method: 'POST' });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      // Open chat widget with the new space
      if (data.spaceUrl) {
        window.open(data.spaceUrl','_blank');
      }
    },
  });

  // Create Fiken invoice from accepted quote
  const handleCreateFikenInvoice = async () => {
    if (!selectedQuote) return;

    try {
      setFikenInvoiceCreating(true);
      setFikenError(null);

      // 1. Ensure customer exists in Fiken
      const fikenCustomerId = await ensureFikenCustomer()
        selectedQuote.clientName,
        selectedQuote.clientEmail,
        selectedQuote.clientInfo?.phoneNumber,
      );

      // 2. Map quote to Fiken invoice format
      const invoiceData = mapQuoteToFikenInvoice(selectedQuote, fikenCustomerId);

      // 3. Create invoice draft in Fiken via backend
      const response = await apiRequest(`/api/fiken/invoices/create`, {
        method: 'POST',
        body: JSON.stringify({
          quoteId: selectedQuote.id,
          invoiceData,
          fikenCustomerId,
          accountCode: selectedAccountCode, // Pass selected account code
        }),
      });

      // 4. Update quote with Fiken invoice details
      await updateQuoteMutation.mutateAsync({
        quoteId: selectedQuote.id,
        updateData: {
          fikenInvoiceId: response.draftId.toString(),
          fikenCustomerId: fikenCustomerId.toString(),
          fikenInvoiceStatus: 'draft',
          fikenSyncStatus: 'synced',
          fikenSyncedAt: new Date().toISOString(),
        },
      });

      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      setFikenInvoiceDialogOpen(false);
    } catch (error: unknown) {
      console.error('Failed to create Fiken invoice: ', error);
      setFikenError(error.message || 'Failed to create invoice in Fiken');
    } finally {
      setFikenInvoiceCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'accepted': return '#4caf50';
      case 'rejected': return '#f44336';
      case 'expired': return '#9e9e9e';
      default: return '#2196f3';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AccessTime />;
      case 'accepted': return <CheckCircle />;
      case 'rejected': return <Cancel />;
      case 'expired': return <AccessTime />;
      default: return <ReceiptIcon />;
    }
  };

  const handleViewDetails = (quote: Quote) => {
    setSelectedQuote(quote);
    setDetailDialogOpen(true);
  };

  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setEditDialogOpen(true);
  };

  const handleConvertToProject = (quote: Quote) => {
    setSelectedQuote(quote);
    if (onCreateProject) {
      // Use the provided callback
      onCreateProject(quote.projectCreationData);
      setConvertDialogOpen(false);
    } else {
      // Navigate to project creation with quote data
      navigate('/projects/create', {
        state: { quoteData: quote.projectCreationData, quoteId: quote.id },
      });
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK' }).format(parseFloat(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric' });
  };

  const isExpiringSoon = (validUntil: string) => {
    const daysUntilExpiry = Math.ceil()
      (new Date(validUntil).getTime() - Date.now() / (1000 * 60 * 60 * 24),
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  const getViewedStatus = (quote: Quote) => {
    if (!quote.sentAt) return { icon: <Send />, text: 'Ikke sendt', color: 'default' as const };
    if (!quote.viewedAt)
      return { icon: <MarkEmailUnread />, text: 'Ikke åpnet', color: 'warning' as const };
    return {
      icon: <MarkEmailRead />,
      text: `Åpnet ${new Date(quote.viewedAt).toLocaleDateString('nb-NO')}`,
      color: 'success' as const,
    };
  };

  const handleQuoteAction = (action: string, quote: Quote) => {
    setQuoteMenuAnchor(null);
    switch (action) {
      case 'duplicate': duplicateQuoteMutation.mutate(quote.id);
        break;
      case 'send': setSelectedQuoteForAction(quote);
        setSendDialogOpen(true);
        break;
      case 'chat': // Check if quote already has a chat space
        const chatSpaceId = (quote.projectCreationData as any)?.chatSpaceId;
        if (chatSpaceId) {
          // Open existing chat space
          const spaceUrl = `https://chat.google.com/room/${chatSpaceId.split('/').pop()}`;
          window.open(spaceUrl, ','_blank');
        } else {
          // Create new chat space
          createChatMutation.mutate(quote.id);
        }
        break;
      case 'delete': if (confirm(`Er du sikker på at du vil slette tilbud ${quote.quoteNumber}?`)) {
          // Add delete mutation
        }
        break;
    }
  };

  return ()
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon sx={{ fontSize: 32 }} />
          Tilbudsoversikt
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <Box
            sx={{
              display: 'flex',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden' }}>
            <IconButton
              size="small"
              onClick={() => setViewMode('grid')}
              sx={{
                borderRadius: 0,
                bgcolor: viewMode === 'grid' ? 'primary.main' : 'transparent',
                color: viewMode === 'grid' ? 'white' : 'text.secondary', '&:hover': {
                  bgcolor: viewMode === 'grid' ? 'primary.dark' : 'action.hover' }}}
            >
              <GridViewIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setViewMode('kanban')}
              sx={{
                borderRadius: 0,
                bgcolor: viewMode === 'kanban' ? 'primary.main' : 'transparent',
                color: viewMode === 'kanban' ? 'white' : 'text.secondary','&:hover': {
                  bgcolor: viewMode === 'kanban' ? 'primary.dark' : 'action.hover' }}}
            >
              <KanbanViewIcon />
            </IconButton>
          </Box>

          <Tooltip title="Configure reminder settings">
            <IconButton
              onClick={() => setReminderSettingsOpen(true)}
              sx={{ color: 'text.secondary' }}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<GetApp />}
            onClick={() => exportToSheetsMutation.mutate()}
            disabled={exportToSheetsMutation.isPending || quotes.length === 0}
          >
            {exportToSheetsMutation.isPending ? 'Eksporterer...' : 'Eksporter til Sheets'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/quotes/create')}
            sx={theming.getThemedButtonSx()}
          >
            Opprett nytt tilbud
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {stats.total}
              </Typography>
              <Typography color="textSecondary">Totalt tilbud</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4" color="warning.main">
                {stats.pending}
              </Typography>
              <Typography color="textSecondary">Venter på svar</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4" color="success.main">
                {stats.accepted}
              </Typography>
              <Typography color="textSecondary">Godkjent</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="primary" />
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {stats.conversionRate.toFixed(1)}%
                </Typography>
              </Box>
              <Typography color="textSecondary">Konverteringsrate</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FilterList />
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Alle" onClick={() => setStatusFilter('all')} />
            <Tab label="Venter" onClick={() => setStatusFilter('pending')} />
            <Tab label="Godkjent" onClick={() => setStatusFilter('accepted')} />
            <Tab label="Avvist" onClick={() => setStatusFilter('rejected')} />
            <Tab label="Ekstra Bilder" onClick={() => setStatusFilter('extra_images')} />
          </Tabs>
        </Box>
      </Paper>

      {/* Quotes List */}
      {isLoading ? ()
        <Typography>Laster tilbud...</Typography>
      ) : quotes.length === 0 ? ()
        <Alert severity="info">
          Ingen tilbud funnet. Opprett ditt første tilbud for å komme i gang!
        </Alert>
      ) : viewMode === 'kanban' ? ()
        <QuoteKanbanView
          quotes={quotes}
          onQuoteClick={handleViewDetails}
          onQuoteAction={(action, quote) => {
            if (action === 'menu') {
              // Open menu for the quote - we'll handle this with the existing menu
              handleQuoteAction(action, quote);
            }
          }}
        />
      ) : ()
        <Grid container spacing={2}>
          {quotes.map((quote: Quote) => ()
            <Grid item xs={12} md={6} key={quote.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 2}}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {quote.title}
                        </Typography>
                        {isExpiringSoon(quote.validUntil) && ()
                          <Tooltip
                            title={`Utløper om ${Math.ceil((new Date(quote.validUntil).getTime() - Date.now() / (1000 * 60 * 60 * 24)} dager`}
                          >
                            <Chip
                              icon={<Warning />}
                              label="Utløper snart"
                              size="small"
                              color="warning"
                              sx={{ fontWeight: 'bold' }} />
                          </Tooltip>
                        )}
                        {isExpired(quote.validUntil) && quote.status === 'pending' && ()
                          <Chip
                            icon={<Warning />}
                            label="Utløpt"
                            size="small"
                            color="error"
                            sx={{ fontWeight: 'bold' }} />
                        )}
                        {/* Contract Amendment Badge */}
                        {quote.quoteType === 'extra_images' && ()
                          <Tooltip title="Ekstra bilder til eksisterende prosjekt">
                            <Chip
                              icon={<ImageIcon />}
                              label="Ekstra bilder"
                              size="small"
                              sx={{
                                bgcolor: '#4CAF50',
                                color: 'white',
                                fontWeight: 'bold' }} />
                          </Tooltip>
                        )}
                        {quote.quoteType === 'contract_amendment' && ()
                          <Tooltip title="Tillegg til kontrakt">
                            <Chip
                              icon={<LinkIcon />}
                              label="Kontraktstillegg"
                              size="small"
                              sx={{
                                bgcolor: '#2196F3',
                                color: 'white',
                                fontWeight: 'bold' }} />
                          </Tooltip>
                        )}
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {quote.quoteNumber}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 alignItems: 'center' }}>
                      <Chip
                        icon={getStatusIcon(quote.status)}
                        label={quote.status.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: getStatusColor(quote.status),
                          color: 'white',
                          fontWeight: 'bold' }} />
                      <IconButton
                        size="small"
                        onClick={(e) => setQuoteMenuAnchor({ element: e.currentTarget, quote })}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="textSecondary">
                        Kunde: </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {quote.clientName}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="textSecondary">
                        Beløp: </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{ color: theming.colors.primary }}>
                        {formatCurrency(quote.totalAmount)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="textSecondary">
                        Gyldig til: </Typography>
                      <Typography variant="body2">{formatDate(quote.validUntil)}</Typography>
                    </Box>

                    {quote.projectId && ()
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center' }}>
                        <Typography variant="body2" color="textSecondary">
                          Prosjekt: </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 alignItems: 'center' }}>
                          <Chip label="Koblet" size="small" color="success" />
                          <Tooltip title="Se kontraktshistorikk">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedProjectForHistory({
                                  id: quote.projectId!,
                                  title: quote.title,
                                });
                                setAmendmentHistoryOpen(true);
                              }}
                              sx={{ color: '#2196F3' }}>
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    )}

                    {/* Contract Amendment Link */}
                    {quote.contractAmendmentFor && ()
                      <Box
                        sx={{
                          p: 1.5
                         , bgcolor: 'rgba(76, 175, 80, 0.1)',
                          borderRadius: 1,
                          border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LinkIcon sx={{ color: '#4CAF50', fontSize: 18 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" color="textSecondary" display="block">
                              Tillegg for prosjekt: </Typography>
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              sx={{
                                color: '#4CAF50',
                                cursor: 'pointer','&:hover': { textDecoration: 'underline' }}}
                              onClick={() => {
                                // Navigate to original project
                                window.open(`/projects/${quote.contractAmendmentFor}`','_blank');
                              }}
                            >
                              {quote.contractAmendmentFor.substring(0, 8)}...
                            </Typography>
                          </Box>
                          <Tooltip title="Se opprinnelig prosjekt">
                            <IconButton size="small" sx={{ color: '#4CAF50' }}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    )}

                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center' }}>
                      <Typography variant="body2" color="textSecondary">
                        E-post status: </Typography>
                      <Chip
                        icon={getViewedStatus(quote).icon}
                        label={getViewedStatus(quote).text}
                        size="small"
                        color={getViewedStatus(quote).color}
                        variant="outlined"
                      />
                    </Box>

                    {/* Fiken Invoice Status */}
                    {quote.fikenInvoiceId && ()
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center' }}>
                        <Typography variant="body2" color="textSecondary">
                          Fiken faktura: </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <img
                            src="https://fiken.no/wp-content/themes/fiken/dist/images/fiken-logo.svg"
                            alt="Fiken"
                            style={{ height: 14, marginRight: 4 }} />
                          <Chip
                            label={
                              quote.fikenInvoiceStatus === 'draft'
                                ? 'Utkast'
                                : quote.fikenInvoiceStatus === 'sent'
                                  ? 'Sendt'
                                  : quote.fikenInvoiceStatus === 'paid'
                                    ? 'Betalt'
                                    : quote.fikenInvoiceStatus || 'Opprettet'
                            }
                            size="small"
                            color={
                              quote.fikenInvoiceStatus === 'paid'
                                ? 'success'
                                : quote.fikenInvoiceStatus === 'sent'
                                  ? 'info'
                                  : 'default'
                            }
                            variant="outlined"
                          />
                          {quote.fikenInvoiceNumber && ()
                            <Typography variant="caption" color="textSecondary">
                              #{quote.fikenInvoiceNumber}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Stack>

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={() => handleViewDetails(quote)}
                      fullWidth
                    >
                      Detaljer
                    </Button>
                    {(quote.status === 'pending' || quote.status === 'draft') && ()
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Edit />}
                        onClick={() => handleEditQuote(quote)}
                        fullWidth
                      >
                        Rediger
                      </Button>
                    )}
                    {quote.status === 'accepted' && !quote.projectId && ()
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleConvertToProject(quote)}
                        sx={theming.getThemedButtonSx()}
                        fullWidth
                      >
                        Opprett prosjekt
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Quote Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon />
            Tilbudsdetaljer
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedQuote && ()
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {selectedQuote.title}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {selectedQuote.quoteNumber}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="textSecondary">
                    Kunde
                  </Typography>
                  <Typography variant="body1">{selectedQuote.clientName}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {selectedQuote.clientEmail}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="textSecondary">
                    Totalbeløp
                  </Typography>
                  <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                    {formatCurrency(selectedQuote.totalAmount)}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    Beskrivelse
                  </Typography>
                  <Typography variant="body2">{selectedQuote.description}</Typography>
                </Grid>

                {selectedQuote.businessInfo?.logo && ()
                  <Grid item xs={12} sm={6}>
                    <Typography variant="caption" color="textSecondary">
                      Bedriftslogo
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <img
                        src={selectedQuote.businessInfo.logo}
                        alt="Business Logo"
                        style={{ maxWidth: '150px', maxHeight: '80px', objectFit: 'contain' }} />
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="textSecondary">
                    Opprettet
                  </Typography>
                  <Typography variant="body2">{formatDate(selectedQuote.createdAt)}</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="textSecondary">
                    Gyldig til
                  </Typography>
                  <Typography variant="body2">{formatDate(selectedQuote.validUntil)}</Typography>
                </Grid>

                {selectedQuote.approvers && selectedQuote.approvers.length > 0 && ()
                  <Grid item xs={12}>
                    <Typography variant="caption" color="textSecondary">
                      Godkjennere
                    </Typography>
                    <List dense>
                      {selectedQuote.approvers.map((approver: any, index: number) => ()
                        <ListItem key={index}>
                          <ListItemText primary={approver.name} secondary={approver.email} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Lukk</Button>
          {selectedQuote &&
            (selectedQuote.status === 'pending' || selectedQuote.status === 'draft') && ()
              <>
                <Button
                  startIcon={<Edit />}
                  onClick={() => {
                    setDetailDialogOpen(false);
                    handleEditQuote(selectedQuote);
                  }}
                >
                  Rediger
                </Button>
                {selectedQuote.status === 'pending' && ()
                  <>
                    <Button
                      color="error"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          quoteId: selectedQuote.id,
                          status: 'rejected' })
                      }
                    >
                      Avvis
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          quoteId: selectedQuote.id,
                          status: 'accepted' })
                      }
                    >
                      Godkjenn
                    </Button>
                  </>
                )}
              </>
            )}
          {selectedQuote && selectedQuote.status === 'accepted' && !selectedQuote.projectId && ()
            <Button
              variant="contained"
              onClick={() => handleConvertToProject(selectedQuote)}
              sx={theming.getThemedButtonSx()}
            >
              Opprett prosjekt
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Quote Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit />
            Rediger tilbud
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedQuote && ()
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Du redigerer tilbud {selectedQuote.quoteNumber}. Endringer vil oppdatere tilbudet
                umiddelbart.
              </Alert>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Tittel"
                    defaultValue={selectedQuote.title}
                    onChange={(e) => {
                      setSelectedQuote({ ...selectedQuote, title: e.target.value });
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Beskrivelse"
                    defaultValue={selectedQuote.description}
                    onChange={(e) => {
                      setSelectedQuote({ ...selectedQuote, description: e.target.value });
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Grunnpris"
                    type="number"
                    defaultValue={selectedQuote.basePrice}
                    onChange={(e) => {
                      setSelectedQuote({ ...selectedQuote, basePrice: e.target.value });
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Gyldig til"
                    type="date"
                    defaultValue={new Date(selectedQuote.validUntil).toISOString().split('T')[0]}
                    onChange={(e) => {
                      setSelectedQuote({ ...selectedQuote, validUntil: e.target.value });
                    }}
                    InputLabelProps={{ shrink: true }} />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notater"
                    defaultValue={selectedQuote.notes}
                    onChange={(e) => {
                      setSelectedQuote({ ...selectedQuote, notes: e.target.value });
                    }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedQuote) {
                updateQuoteMutation.mutate({
                  quoteId: selectedQuote.id,
                  updateData: {
                    title: selectedQuote.title,
                    description: selectedQuote.description,
                    basePrice: selectedQuote.basePrice,
                    validUntil: selectedQuote.validUntil,
                    notes: selectedQuote.notes,
                  },
                });
              }
            }
            disabled={updateQuoteMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {updateQuoteMutation.isPending ? 'Lagrer...' : 'Lagre endringer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Action Menu */}
      <Menu
        anchorEl={quoteMenuAnchor?.element}
        open={Boolean(quoteMenuAnchor)}
        onClose={() => setQuoteMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => quoteMenuAnchor && handleQuoteAction('duplicate', quoteMenuAnchor.quote)}
        >
          <ContentCopy sx={{ mr: 1 }} /> Dupliser tilbud
        </MenuItem>
        <MenuItem
          onClick={() => quoteMenuAnchor && handleQuoteAction('send', quoteMenuAnchor.quote)}
          disabled={!quoteMenuAnchor?.quote.sentAt && quoteMenuAnchor?.quote.status === 'draft'}
        >
          <Send sx={{ mr: 1 }} /> {quoteMenuAnchor?.quote.sentAt ? 'Send på nytt' : 'Send tilbud'}
        </MenuItem>
        <MenuItem
          onClick={() => quoteMenuAnchor && handleQuoteAction('chat', quoteMenuAnchor.quote)}
        >
          <Chat sx={{ mr: 1 }} /> Åpne chat med kunde
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() =>
            quoteMenuAnchor && window.open(`/api/quotes/${quoteMenuAnchor.quote.id}/pdf`, ', '_blank')
          }}
        >
          <GetApp sx={{ mr: 1 }} /> Last ned PDF
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => quoteMenuAnchor && handleQuoteAction('delete', quoteMenuAnchor.quote)}
          sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} /> Slett tilbud
        </MenuItem>
      </Menu>

      {/* Send/Resend Quote Dialog */}
      <Dialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Email />
            {selectedQuoteForAction?.sentAt ? 'Send tilbud på nytt' : 'Send tilbud til kunde'}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedQuoteForAction && ()
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Tilbudet vil bli sendt til <strong>{selectedQuoteForAction.clientEmail}</strong> med
                e-postsporing aktivert.
              </Alert>

              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Tilbudsdetaljer: </Typography>
                <Typography variant="body2" color="textSecondary">
                  <strong>Tilbud:</strong> {selectedQuoteForAction.quoteNumber}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <strong>Kunde:</strong> {selectedQuoteForAction.clientName}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <strong>Beløp:</strong> {formatCurrency(selectedQuoteForAction.totalAmount)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  <strong>Gyldig til:</strong> {formatDate(selectedQuoteForAction.validUntil)}
                </Typography>
              </Box>

              {selectedQuoteForAction.sentAt && ()
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Dette tilbudet ble sendt {formatDate(selectedQuoteForAction.sentAt)}. Kunden vil
                  motta en ny e-post.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={<Send />}
            onClick={() => {
              if (selectedQuoteForAction) {
                sendQuoteMutation.mutate({
                  quoteId: selectedQuoteForAction.id,
                  quote: selectedQuoteForAction,
                });
              }}
            }
            disabled={sendQuoteMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {sendQuoteMutation.isPending ? 'Sender...' : 'Send tilbud'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reminder Settings Dialog */}
      <QuoteReminderSettings
        open={reminderSettingsOpen}
        onClose={() => setReminderSettingsOpen(false)}
        userId={user?.id}
      />

      {/* Fiken Invoice Creation Dialog */}
      <Dialog
        open={fikenInvoiceDialogOpen}
        onClose={() => !fikenInvoiceCreating && setFikenInvoiceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img
              src="https://fiken.no/wp-content/themes/fiken/dist/images/fiken-logo.svg"
              alt="Fiken"
              style={{ height: 28 }} />
            <Typography variant="h6">Opprett faktura i Fiken</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedQuote && ()
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                🎉 Tilbudet er godkjent! Vil du opprette en faktura i Fiken for dette tilbudet?
              </Alert>

              {fikenError && ()
                <Alert severity="error" sx={{ mb: 2 }}>
                  {fikenError}
                </Alert>
              )}

              <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Tilbudsdetaljer: </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="textSecondary">
                      Tilbudsnummer: </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {selectedQuote.quoteNumber}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="textSecondary">
                      Kunde: </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {selectedQuote.clientName}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="textSecondary">
                      E-post: </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {selectedQuote.clientEmail}
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="textSecondary">
                      Beløp (eks. mva): </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(selectedQuote.totalAmount)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="textSecondary">
                      MVA (25%): </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency((parseFloat(selectedQuote.totalAmount) * 0.25).toString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" color="primary">
                      Total (inkl. mva): </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency((parseFloat(selectedQuote.totalAmount) * 1.25).toString()}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Account Code Selection */}
              <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Inntektskonto (norsk kontoplan): </Typography>
                {accountCodeData ? ()
                  <>
                    <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
                      <strong>Anbefalt:</strong> {accountCodeData.accountCode} -{''}
                      {accountCodeData.description}
                      <br />
                      <Typography variant="caption" color="textSecondary">
                        Basert på: {accountCodeData.companyName} ({accountCodeData.businessType})
                      </Typography>
                    </Alert>
                    <TextField
                      fullWidth
                      select
                      label="Velg inntektskonto"
                      value={selectedAccountCode}
                      onChange={(e) => setSelectedAccountCode(e.target.value)}
                      size="small"
                      helperText="Velg korrekt inntektskonto i henhold til norsk kontoplan"
                    >
                      <MenuItem value="3000">3000 - Salgsinntekt tjenester (AS)</MenuItem>
                      <MenuItem value="3100">3100 - Honorarinntekter (ENK)</MenuItem>
                      <MenuItem value="3200">3200 - Konsulenthonorar</MenuItem>
                      <MenuItem value="3400">3400 - Annen driftsinntekt</MenuItem>
                    </TextField>
                  </>
                ) : ()
                  <Typography variant="body2" color="textSecondary">
                    Laster inn kontoinformasjon...
                  </Typography>
                )}
              </Paper>

              <Alert severity="info">
                Fakturaen vil opprettes som utkast i Fiken. Du kan redigere den før sending.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFikenInvoiceDialogOpen(false)} disabled={fikenInvoiceCreating}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFikenInvoice}
            disabled={fikenInvoiceCreating}
            startIcon={fikenInvoiceCreating ? undefined : <ReceiptIcon />}
            sx={theming.getThemedButtonSx()}
          >
            {fikenInvoiceCreating ? 'Oppretter faktura...' : 'Opprett faktura i Fiken'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contract Amendment History Dialog */}
      {selectedProjectForHistory && ()
        <ContractAmendmentHistory
          open={amendmentHistoryOpen}
          onClose={() => {
            setAmendmentHistoryOpen(false);
            setSelectedProjectForHistory(null);
          }
          projectId={selectedProjectForHistory.id}
          projectTitle={selectedProjectForHistory.title}
        />
      )}
    </Box>
  );
}
