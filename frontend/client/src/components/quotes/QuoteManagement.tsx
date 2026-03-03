/**
 * CreatorHub Norge - Quote Management Component
 * View, filter, and convert quotes to projects
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import QuoteKanbanView from './QuoteKanbanView';
import QuoteReminderSettings from './QuoteReminderSettings';
import { quoteDriveSync, QuoteSyncJob } from '@/services/quote-drive-sync';
import { quoteArchiveConfig } from '@/services/document-archive-config';
import { mapQuoteToFikenInvoice, ensureFikenCustomer } from '@/lib/fiken/invoice-mapper';
import ContractAmendmentHistory from '../contracts/ContractAmendmentHistory';
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
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  Add as AddIcon,
  Cancel,
  Chat,
  CheckCircle,
  ContentCopy,
  Edit,
  Email,
  GetApp,
  GridView as GridViewIcon,
  History as HistoryIcon,
  Link as LinkIcon,
  MarkEmailRead,
  MarkEmailUnread,
  MoreVert,
  Receipt as ReceiptIcon,
  Send,
  Settings as SettingsIcon,
  TrendingUp,
  ViewKanban as KanbanViewIcon,
  Visibility,
  Warning,
} from '@mui/icons-material';

type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'draft';

type ViewedStatus = {
  icon: React.ReactElement;
  text: string;
  color: 'default' | 'warning' | 'success';
};

interface ProjectCreationData {
  package?: {
    includedImages?: number;
    name?: string;
  };
  chatSpaceId?: string;
  [key: string]: unknown;
}

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
  status: QuoteStatus;
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
  projectCreationData: ProjectCreationData;
  projectId?: string;
  createdAt: string;
  sentAt?: string;
  acceptedAt?: string;
  viewedAt?: string;
  isFinal?: boolean;
  quoteType?: string;
  contractAmendmentFor?: string;
  fikenInvoiceId?: string;
  fikenInvoiceNumber?: string;
  fikenCustomerId?: string;
  fikenInvoiceStatus?: string;
  fikenSyncStatus?: string;
  fikenInvoiceUrl?: string;
}

interface QuoteStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  totalValue: number;
  acceptedValue: number;
  conversionRate: number;
}

interface QuoteManagementProps {
  onCreateProject?: (quoteData: unknown) => void;
}

interface EditQuoteState {
  title: string;
  description: string;
  totalAmount: string;
  validUntil: string;
}

const STATUS_TABS: Array<{ label: string; value: string }> = [
  { label: 'Alle', value: 'all' },
  { label: 'Utkast', value: 'draft' },
  { label: 'Venter', value: 'pending' },
  { label: 'Godkjent', value: 'accepted' },
  { label: 'Avvist', value: 'rejected' },
  { label: 'Utløpt', value: 'expired' },
  { label: 'Ekstra bilder', value: 'extra_images' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeStatus(value: unknown): QuoteStatus {
  const normalized = toStringValue(value, 'draft');
  if (
    normalized === 'draft' ||
    normalized === 'pending' ||
    normalized === 'accepted' ||
    normalized === 'rejected' ||
    normalized === 'expired'
  ) {
    return normalized;
  }
  return 'draft';
}

function normalizeQuote(value: unknown): Quote | null {
  if (!isRecord(value)) return null;

  const clientInfoRaw = isRecord(value.clientInfo) ? value.clientInfo : {};
  const projectCreationData = isRecord(value.projectCreationData)
    ? (value.projectCreationData as ProjectCreationData)
    : {};

  const quote: Quote = {
    id: toStringValue(value.id),
    quoteNumber: toStringValue(value.quoteNumber),
    clientId: toStringValue(value.clientId),
    clientName: toStringValue(value.clientName),
    clientEmail: toStringValue(value.clientEmail),
    title: toStringValue(value.title),
    description: toStringValue(value.description),
    basePrice: toStringValue(value.basePrice, '0'),
    totalAmount: toStringValue(value.totalAmount, '0'),
    currency: toStringValue(value.currency, 'NOK'),
    status: normalizeStatus(value.status),
    validUntil: toStringValue(value.validUntil),
    profession: toStringValue(value.profession),
    projectType: toStringValue(value.projectType),
    clientInfo: {
      name: toStringValue(clientInfoRaw.name, toStringValue(value.clientName)),
      address: toStringValue(clientInfoRaw.address),
      phoneNumber: toStringValue(clientInfoRaw.phoneNumber),
      email: toStringValue(clientInfoRaw.email, toStringValue(value.clientEmail)),
    },
    approvers: toArray<unknown>(value.approvers),
    projectCreationData,
    projectId: toStringValue(value.projectId) || undefined,
    createdAt: toStringValue(value.createdAt, new Date().toISOString()),
    sentAt: toStringValue(value.sentAt) || undefined,
    acceptedAt: toStringValue(value.acceptedAt) || undefined,
    viewedAt: toStringValue(value.viewedAt) || undefined,
    isFinal: typeof value.isFinal === 'boolean' ? value.isFinal : undefined,
    quoteType: toStringValue(value.quoteType) || undefined,
    contractAmendmentFor: toStringValue(value.contractAmendmentFor) || undefined,
    fikenInvoiceId: toStringValue(value.fikenInvoiceId) || undefined,
    fikenInvoiceNumber: toStringValue(value.fikenInvoiceNumber) || undefined,
    fikenCustomerId: toStringValue(value.fikenCustomerId) || undefined,
    fikenInvoiceStatus: toStringValue(value.fikenInvoiceStatus) || undefined,
    fikenSyncStatus: toStringValue(value.fikenSyncStatus) || undefined,
    fikenInvoiceUrl: toStringValue(value.fikenInvoiceUrl) || undefined,
  };

  if (!quote.id || !quote.quoteNumber || !quote.title) {
    return null;
  }

  return quote;
}

function extractQuotes(payload: unknown): Quote[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeQuote).filter((quote): quote is Quote => quote !== null);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.quotes)) {
    return payload.quotes
      .map(normalizeQuote)
      .filter((quote): quote is Quote => quote !== null);
  }

  if (Array.isArray(payload.data)) {
    return payload.data
      .map(normalizeQuote)
      .filter((quote): quote is Quote => quote !== null);
  }

  return [];
}

function extractStats(payload: unknown, quotes: Quote[]): QuoteStats {
  if (isRecord(payload) && isRecord(payload.stats)) {
    const statsRecord = payload.stats;
    const total = Number(statsRecord.total);
    const pending = Number(statsRecord.pending);
    const accepted = Number(statsRecord.accepted);
    const rejected = Number(statsRecord.rejected);
    const totalValue = Number(statsRecord.totalValue);
    const acceptedValue = Number(statsRecord.acceptedValue);
    const conversionRate = Number(statsRecord.conversionRate);

    if (
      Number.isFinite(total) &&
      Number.isFinite(pending) &&
      Number.isFinite(accepted) &&
      Number.isFinite(rejected) &&
      Number.isFinite(totalValue) &&
      Number.isFinite(acceptedValue) &&
      Number.isFinite(conversionRate)
    ) {
      return {
        total,
        pending,
        accepted,
        rejected,
        totalValue,
        acceptedValue,
        conversionRate,
      };
    }
  }

  const total = quotes.length;
  const pending = quotes.filter((quote) => quote.status === 'pending').length;
  const accepted = quotes.filter((quote) => quote.status === 'accepted').length;
  const rejected = quotes.filter((quote) => quote.status === 'rejected').length;
  const totalValue = quotes.reduce((sum, quote) => sum + Number.parseFloat(quote.totalAmount || '0'), 0);
  const acceptedValue = quotes
    .filter((quote) => quote.status === 'accepted')
    .reduce((sum, quote) => sum + Number.parseFloat(quote.totalAmount || '0'), 0);
  const conversionRate = total > 0 ? (accepted / total) * 100 : 0;

  return {
    total,
    pending,
    accepted,
    rejected,
    totalValue,
    acceptedValue,
    conversionRate,
  };
}

function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function formatCurrency(amount: string): string {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return amount;
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isExpiringSoon(validUntil: string): boolean {
  const msLeft = new Date(validUntil).getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return daysLeft <= 7 && daysLeft > 0;
}

function isExpired(validUntil: string): boolean {
  return new Date(validUntil).getTime() < Date.now();
}

function getViewedStatus(quote: Quote): ViewedStatus {
  if (!quote.sentAt) {
    return { icon: <Send fontSize="small" />, text: 'Ikke sendt', color: 'default' };
  }
  if (!quote.viewedAt) {
    return { icon: <MarkEmailUnread fontSize="small" />, text: 'Ikke åpnet', color: 'warning' };
  }
  return {
    icon: <MarkEmailRead fontSize="small" />,
    text: `Åpnet ${new Date(quote.viewedAt).toLocaleDateString('nb-NO')}`,
    color: 'success',
  };
}

function getStatusColor(status: QuoteStatus): string {
  switch (status) {
    case 'pending':
      return '#ff9800';
    case 'accepted':
      return '#4caf50';
    case 'rejected':
      return '#f44336';
    case 'expired':
      return '#9e9e9e';
    case 'draft':
    default:
      return '#607d8b';
  }
}

function getStatusIcon(status: QuoteStatus): React.ReactElement {
  switch (status) {
    case 'pending':
      return <AccessTime fontSize="small" />;
    case 'accepted':
      return <CheckCircle fontSize="small" />;
    case 'rejected':
      return <Cancel fontSize="small" />;
    case 'expired':
      return <Warning fontSize="small" />;
    case 'draft':
    default:
      return <ReceiptIcon fontSize="small" />;
  }
}

function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function QuoteManagement({ onCreateProject }: QuoteManagementProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userProfession = user?.profession || 'photographer';
  const theming = useTheming(userProfession);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [selectedQuoteForAction, setSelectedQuoteForAction] = useState<Quote | null>(null);
  const [quoteMenuAnchor, setQuoteMenuAnchor] = useState<HTMLElement | null>(null);
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
  const [driveSyncEnabled] = useState(true);
  const [syncJobs, setSyncJobs] = useState<QuoteSyncJob[]>([]);

  const [fikenInvoiceDialogOpen, setFikenInvoiceDialogOpen] = useState(false);
  const [fikenInvoiceCreating, setFikenInvoiceCreating] = useState(false);
  const [fikenError, setFikenError] = useState<string | null>(null);
  const [selectedAccountCode, setSelectedAccountCode] = useState('3000');

  const [amendmentHistoryOpen, setAmendmentHistoryOpen] = useState(false);
  const [selectedProjectForHistory, setSelectedProjectForHistory] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [editState, setEditState] = useState<EditQuoteState>({
    title: '',
    description: '',
    totalAmount: '0',
    validUntil: '',
  });
  const [linkProjectId, setLinkProjectId] = useState('');

  useEffect(() => {
    const unsubscribe = quoteDriveSync.subscribe((jobs) => {
      setSyncJobs(jobs);
    });
    return unsubscribe;
  }, []);

  const syncQuoteToDrive = (quote: Quote) => {
    if (!driveSyncEnabled) return;

    const quoteDate = new Date(quote.createdAt);
    const quotePdfUrl = `/api/quotes/${quote.id}/pdf`;
    const folderPath = quoteArchiveConfig.getFolderPath(quoteDate, quote.status);

    quoteDriveSync.queueUpload(
      quote.id,
      quote.quoteNumber,
      quote.clientName,
      quotePdfUrl,
      quote.projectId,
      folderPath,
      quoteDate,
      quote.status,
      quote.isFinal,
    );
  };

  const quotesQuery = useQuery({
    queryKey: ['/api/quotes/all', statusFilter, user?.id],
    queryFn: async () => {
      if (statusFilter === 'all') {
        return apiRequest(`/api/quotes/all?userId=${user?.id ?? ''}`);
      }
      if (statusFilter === 'extra_images') {
        return apiRequest(`/api/quotes/all?userId=${user?.id ?? ''}&quoteType=extra_images&status=pending`);
      }
      return apiRequest(`/api/quotes/all?userId=${user?.id ?? ''}&status=${statusFilter}`);
    },
    enabled: Boolean(user?.id),
    refetchInterval: 10000,
  });

  const statsQuery = useQuery({
    queryKey: ['/api/quotes/stats/overview', user?.id],
    queryFn: () => apiRequest(`/api/quotes/stats/overview?userId=${user?.id ?? ''}`),
    enabled: Boolean(user?.id),
  });

  const accountCodeQuery = useQuery({
    queryKey: ['/api/fiken/invoices/account-code', user?.id],
    queryFn: () => apiRequest('/api/fiken/invoices/account-code'),
    enabled: Boolean(user?.id) && fikenInvoiceDialogOpen,
  });

  useEffect(() => {
    const payload = accountCodeQuery.data;
    if (!isRecord(payload)) return;
    const accountCode = toStringValue(payload.accountCode);
    if (accountCode) {
      setSelectedAccountCode(accountCode);
    }
  }, [accountCodeQuery.data]);

  const quotes = useMemo(() => extractQuotes(quotesQuery.data), [quotesQuery.data]);
  const stats = useMemo(() => extractStats(statsQuery.data, quotes), [quotes, statsQuery.data]);

  const invalidateQuoteQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
    queryClient.invalidateQueries({ queryKey: ['/api/quotes/stats/overview'] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
      return apiRequest(`/api/quotes/${quoteId}/status`, {
        method: 'PUT',
        body: { status },
      });
    },
    onSuccess: (_, variables) => {
      invalidateQuoteQueries();
      if (selectedQuote && selectedQuote.id === variables.quoteId && variables.status === 'accepted') {
        const finalQuote = { ...selectedQuote, status: 'accepted' as const, isFinal: true };
        setSelectedQuote(finalQuote);
        syncQuoteToDrive(finalQuote);
        setFikenInvoiceDialogOpen(true);
      }
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, updateData }: { quoteId: string; updateData: Record<string, unknown> }) => {
      return apiRequest(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        body: updateData,
      });
    },
    onSuccess: () => {
      invalidateQuoteQueries();
      setEditDialogOpen(false);
      setDetailDialogOpen(false);
    },
  });

  const duplicateQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const originalPayload = await apiRequest(`/api/quotes/${quoteId}`);
      const originalQuote = normalizeQuote(
        isRecord(originalPayload) && isRecord(originalPayload.data)
          ? originalPayload.data
          : originalPayload,
      );

      if (!originalQuote) {
        throw new Error('Kunne ikke lese originaltilbud for kopiering');
      }

      return apiRequest('/api/quotes/create', {
        method: 'POST',
        body: {
          title: `${originalQuote.title} (Kopi)`,
          description: originalQuote.description,
          basePrice: originalQuote.basePrice,
          totalPrice: originalQuote.totalAmount,
          validUntil: originalQuote.validUntil,
          notes: '',
          clientInfo: originalQuote.clientInfo,
          approvers: originalQuote.approvers,
          profession: originalQuote.profession,
          projectType: originalQuote.projectType,
          status: 'draft',
        },
      });
    },
    onSuccess: () => {
      invalidateQuoteQueries();
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (quote: Quote) => {
      return apiRequest(`/api/quotes/${quote.id}/send-email`, {
        method: 'POST',
        body: {
          clientEmail: quote.clientEmail,
          clientName: quote.clientName,
          projectId: quote.projectId || quote.id,
          photographerId: user?.id,
          quoteDetails: {
            projectType: quote.projectType,
            totalAmount: Number.parseFloat(quote.totalAmount || '0'),
            includedImages: quote.projectCreationData.package?.includedImages ?? 0,
            packageName: quote.projectCreationData.package?.name ?? 'Tilpasset',
            deliveryTime: '2-3 uker',
          },
        },
      });
    },
    onSuccess: (_, quote) => {
      invalidateQuoteQueries();
      setSendDialogOpen(false);
      syncQuoteToDrive(quote);
    },
  });

  const exportToSheetsMutation = useMutation({
    mutationFn: async () => {
      const rows = quotes.map((quote) => [
        quote.quoteNumber,
        quote.clientName,
        quote.clientEmail,
        quote.title,
        quote.totalAmount,
        quote.status,
        new Date(quote.createdAt).toLocaleDateString('nb-NO'),
        quote.sentAt ? new Date(quote.sentAt).toLocaleDateString('nb-NO') : '-',
        quote.viewedAt ? new Date(quote.viewedAt).toLocaleDateString('nb-NO') : 'Ikke åpnet',
        new Date(quote.validUntil).toLocaleDateString('nb-NO'),
      ]);

      return apiRequest('/api/google-sheets/export-quotes', {
        method: 'POST',
        headers: {
          'x-user-email': user?.email || '',
        },
        body: {
          sheetName: `Tilbud - ${new Date().toLocaleDateString('nb-NO')}`,
          headers: [
            'Tilbudsnummer',
            'Kunde',
            'E-post',
            'Tittel',
            'Beløp',
            'Status',
            'Opprettet',
            'Sendt',
            'Åpnet',
            'Gyldig til',
          ],
          data: rows,
        },
      });
    },
  });

  const linkProjectMutation = useMutation({
    mutationFn: async ({ quoteId, projectId }: { quoteId: string; projectId: string }) => {
      return apiRequest(`/api/quotes/${quoteId}/link-project`, {
        method: 'PUT',
        body: { projectId },
      });
    },
    onSuccess: () => {
      invalidateQuoteQueries();
      setConvertDialogOpen(false);
      setLinkProjectId('');
    },
  });

  const createChatMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiRequest(`/api/quotes/${quoteId}/create-chat`, {
        method: 'POST',
      });
    },
    onSuccess: (payload) => {
      invalidateQuoteQueries();
      if (isRecord(payload)) {
        const spaceUrl = toStringValue(payload.spaceUrl);
        if (spaceUrl) {
          openInNewTab(spaceUrl);
        }
      }
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiRequest(`/api/quotes/${quoteId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      invalidateQuoteQueries();
      setDetailDialogOpen(false);
    },
  });

  const handleCreateFikenInvoice = async () => {
    if (!selectedQuote) return;

    try {
      setFikenInvoiceCreating(true);
      setFikenError(null);

      const customerId = await ensureFikenCustomer(
        selectedQuote.clientName,
        selectedQuote.clientEmail,
        selectedQuote.clientInfo.phoneNumber,
      );

      const invoiceData = mapQuoteToFikenInvoice(selectedQuote, customerId);

      const response = await apiRequest('/api/fiken/invoices/create', {
        method: 'POST',
        body: {
          quoteId: selectedQuote.id,
          invoiceData,
          fikenCustomerId: customerId,
          accountCode: selectedAccountCode,
        },
      });

      const draftId =
        isRecord(response) && (typeof response.draftId === 'number' || typeof response.draftId === 'string')
          ? String(response.draftId)
          : undefined;

      await updateQuoteMutation.mutateAsync({
        quoteId: selectedQuote.id,
        updateData: {
          fikenInvoiceId: draftId,
          fikenCustomerId: String(customerId),
          fikenInvoiceStatus: 'draft',
          fikenSyncStatus: 'synced',
          fikenSyncedAt: new Date().toISOString(),
        },
      });

      setFikenInvoiceDialogOpen(false);
    } catch (error) {
      setFikenError(parseErrorMessage(error));
    } finally {
      setFikenInvoiceCreating(false);
    }
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, quote: Quote) => {
    setSelectedQuoteForAction(quote);
    setQuoteMenuAnchor(event.currentTarget);
  };

  const closeMenu = () => {
    setQuoteMenuAnchor(null);
  };

  const handleViewDetails = (quote: Quote) => {
    setSelectedQuote(quote);
    setDetailDialogOpen(true);
  };

  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setEditState({
      title: quote.title,
      description: quote.description,
      totalAmount: quote.totalAmount,
      validUntil: quote.validUntil.split('T')[0] || quote.validUntil,
    });
    setEditDialogOpen(true);
  };

  const handleConvertToProject = (quote: Quote) => {
    setSelectedQuote(quote);
    setConvertDialogOpen(true);
  };

  const handleQuoteAction = (action: string, quote: Quote) => {
    closeMenu();

    switch (action) {
      case 'menu':
      case 'view':
        handleViewDetails(quote);
        break;
      case 'edit':
        handleEditQuote(quote);
        break;
      case 'duplicate':
        duplicateQuoteMutation.mutate(quote.id);
        break;
      case 'send':
        setSelectedQuoteForAction(quote);
        setSendDialogOpen(true);
        break;
      case 'download':
        openInNewTab(`/api/quotes/${quote.id}/pdf`);
        break;
      case 'convert':
        handleConvertToProject(quote);
        break;
      case 'chat': {
        const chatSpaceId = quote.projectCreationData.chatSpaceId;
        if (chatSpaceId) {
          const roomId = chatSpaceId.split('/').pop();
          if (roomId) {
            openInNewTab(`https://chat.google.com/room/${roomId}`);
            break;
          }
        }
        createChatMutation.mutate(quote.id);
        break;
      }
      case 'delete':
        if (window.confirm(`Er du sikker på at du vil slette tilbud ${quote.quoteNumber}?`)) {
          deleteQuoteMutation.mutate(quote.id);
        }
        break;
      default:
        break;
    }
  };

  const handleSaveEdit = () => {
    if (!selectedQuote) return;
    updateQuoteMutation.mutate({
      quoteId: selectedQuote.id,
      updateData: {
        title: editState.title,
        description: editState.description,
        totalAmount: editState.totalAmount,
        validUntil: editState.validUntil,
      },
    });
  };

  const handleConfirmConvert = () => {
    if (!selectedQuote) return;

    if (linkProjectId.trim()) {
      linkProjectMutation.mutate({ quoteId: selectedQuote.id, projectId: linkProjectId.trim() });
      return;
    }

    if (onCreateProject) {
      onCreateProject(selectedQuote.projectCreationData);
      setConvertDialogOpen(false);
      return;
    }

    window.location.assign('/projects/create');
  };

  const selectedTabIndex = STATUS_TABS.findIndex((tab) => tab.value === statusFilter);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon sx={{ fontSize: 32 }} />
          Tilbudsoversikt
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <IconButton
              size="small"
              onClick={() => setViewMode('grid')}
              aria-label="Rutenettvisning"
              sx={{
                borderRadius: 0,
                color: viewMode === 'grid' ? 'white' : 'text.secondary',
                bgcolor: viewMode === 'grid' ? 'primary.main' : 'transparent',
                '&:hover': {
                  bgcolor: viewMode === 'grid' ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <GridViewIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setViewMode('kanban')}
              aria-label="Kanbanvisning"
              sx={{
                borderRadius: 0,
                color: viewMode === 'kanban' ? 'white' : 'text.secondary',
                bgcolor: viewMode === 'kanban' ? 'primary.main' : 'transparent',
                '&:hover': {
                  bgcolor: viewMode === 'kanban' ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <KanbanViewIcon />
            </IconButton>
          </Box>

          <Tooltip title="Konfigurer påminnelser">
            <IconButton onClick={() => setReminderSettingsOpen(true)}>
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
            onClick={() => window.location.assign('/quotes/create')}
            sx={theming.getThemedButtonSx()}
          >
            Opprett nytt tilbud
          </Button>
        </Box>
      </Box>

      {syncJobs.length > 0 ? (
        <Stack spacing={1.5} sx={{ mb: 2.5 }}>
          {syncJobs.map((job) => (
            <Alert
              key={job.id}
              severity={job.status === 'error' ? 'error' : job.status === 'success' ? 'success' : 'info'}
              action={
                job.status === 'error' ? (
                  <Button size="small" onClick={() => quoteDriveSync.retryJob(job.id)}>
                    Prøv igjen
                  </Button>
                ) : (
                  <Button size="small" onClick={() => quoteDriveSync.cancelJob(job.id)}>
                    Lukk
                  </Button>
                )
              }
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {job.quoteNumber} - {job.clientName}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                {job.status === 'uploading'
                  ? `Laster opp til ${job.folderName}`
                  : job.status === 'error'
                    ? job.error || 'Synk mislyktes'
                    : job.status === 'success'
                      ? 'Synkronisering fullført'
                      : 'Venter i kø'}
              </Typography>
              {job.status === 'uploading' || job.status === 'pending' ? (
                <LinearProgress variant="determinate" value={job.progress} />
              ) : null}
            </Alert>
          ))}
        </Stack>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {stats.total}
              </Typography>
              <Typography color="text.secondary">Totalt tilbud</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4" color="warning.main">
                {stats.pending}
              </Typography>
              <Typography color="text.secondary">Venter på svar</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h4" color="success.main">
                {stats.accepted}
              </Typography>
              <Typography color="text.secondary">Godkjent</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <TrendingUp color="primary" />
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {stats.conversionRate.toFixed(1)}%
                </Typography>
              </Stack>
              <Typography color="text.secondary">Konverteringsrate</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Tabs
          value={selectedTabIndex >= 0 ? selectedTabIndex : 0}
          onChange={(_, index: number) => setStatusFilter(STATUS_TABS[index]?.value || 'all')}
          variant="scrollable"
          scrollButtons="auto"
        >
          {STATUS_TABS.map((tab) => (
            <Tab key={tab.value} label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {quotesQuery.isLoading ? (
        <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : quotes.length === 0 ? (
        <Alert severity="info">
          Ingen tilbud funnet. Opprett ditt første tilbud for å komme i gang.
        </Alert>
      ) : viewMode === 'kanban' ? (
        <QuoteKanbanView
          quotes={quotes}
          onQuoteClick={(kanbanQuote) => {
            const selectedQuote = quotes.find((quote) => quote.id === kanbanQuote.id);
            if (selectedQuote) {
              handleViewDetails(selectedQuote);
            }
          }}
          onQuoteAction={(action, kanbanQuote) => {
            const selectedQuote = quotes.find((quote) => quote.id === kanbanQuote.id);
            if (selectedQuote) {
              handleQuoteAction(action, selectedQuote);
            }
          }}
        />
      ) : (
        <Grid container spacing={2}>
          {quotes.map((quote) => (
            <Grid item xs={12} md={6} key={quote.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {quote.title}
                        </Typography>
                        {isExpiringSoon(quote.validUntil) ? (
                          <Chip icon={<Warning />} label="Utløper snart" size="small" color="warning" />
                        ) : null}
                        {isExpired(quote.validUntil) && quote.status === 'pending' ? (
                          <Chip icon={<Warning />} label="Utløpt" size="small" color="error" />
                        ) : null}
                        {quote.quoteType === 'extra_images' ? (
                          <Chip icon={<LinkIcon />} label="Ekstra bilder" size="small" color="success" />
                        ) : null}
                        {quote.quoteType === 'contract_amendment' ? (
                          <Chip icon={<LinkIcon />} label="Kontraktstillegg" size="small" color="info" />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {quote.quoteNumber}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Chip
                        icon={getStatusIcon(quote.status)}
                        label={quote.status.toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: getStatusColor(quote.status),
                          color: 'white',
                          fontWeight: 700,
                        }}
                      />
                      <IconButton size="small" onClick={(event) => handleOpenMenu(event, quote)}>
                        <MoreVert />
                      </IconButton>
                    </Stack>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Kunde:
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {quote.clientName}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Beløp:
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: theming.colors.primary }}>
                        {formatCurrency(quote.totalAmount)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Gyldig til:
                      </Typography>
                      <Typography variant="body2">{formatDate(quote.validUntil)}</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        E-post status:
                      </Typography>
                      <Chip
                        icon={getViewedStatus(quote).icon}
                        label={getViewedStatus(quote).text}
                        size="small"
                        color={getViewedStatus(quote).color}
                        variant="outlined"
                      />
                    </Box>

                    {quote.fikenInvoiceId ? (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Fiken:
                        </Typography>
                        <Chip
                          size="small"
                          color="success"
                          label={quote.fikenInvoiceStatus || 'Synket'}
                          onClick={
                            quote.fikenInvoiceUrl
                              ? () => {
                                  openInNewTab(quote.fikenInvoiceUrl || '');
                                }
                              : undefined
                          }
                        />
                      </Box>
                    ) : null}

                    {quote.projectId ? (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Prosjekt:
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip label="Koblet" size="small" color="success" />
                          <Tooltip title="Se kontraktshistorikk">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedProjectForHistory({ id: quote.projectId || '', title: quote.title });
                                setAmendmentHistoryOpen(true);
                              }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    ) : null}
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button size="small" startIcon={<Visibility />} onClick={() => handleViewDetails(quote)}>
                      Se
                    </Button>
                    <Button size="small" startIcon={<Edit />} onClick={() => handleEditQuote(quote)}>
                      Rediger
                    </Button>
                    <Button size="small" startIcon={<Email />} onClick={() => handleQuoteAction('send', quote)}>
                      Send
                    </Button>
                    <Button size="small" startIcon={<GetApp />} onClick={() => handleQuoteAction('download', quote)}>
                      PDF
                    </Button>
                    <Button size="small" startIcon={<LinkIcon />} onClick={() => handleConvertToProject(quote)}>
                      Prosjekt
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Menu
        anchorEl={quoteMenuAnchor}
        open={Boolean(quoteMenuAnchor) && Boolean(selectedQuoteForAction)}
        onClose={closeMenu}
      >
        <MenuItem onClick={() => selectedQuoteForAction && handleQuoteAction('view', selectedQuoteForAction)}>
          <Visibility sx={{ mr: 1 }} fontSize="small" />
          Se detaljer
        </MenuItem>
        <MenuItem onClick={() => selectedQuoteForAction && handleQuoteAction('edit', selectedQuoteForAction)}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Rediger
        </MenuItem>
        <MenuItem onClick={() => selectedQuoteForAction && handleQuoteAction('send', selectedQuoteForAction)}>
          <Send sx={{ mr: 1 }} fontSize="small" />
          Send tilbud
        </MenuItem>
        <MenuItem onClick={() => selectedQuoteForAction && handleQuoteAction('download', selectedQuoteForAction)}>
          <GetApp sx={{ mr: 1 }} fontSize="small" />
          Last ned PDF
        </MenuItem>
        <MenuItem onClick={() => selectedQuoteForAction && handleQuoteAction('duplicate', selectedQuoteForAction)}>
          <ContentCopy sx={{ mr: 1 }} fontSize="small" />
          Dupliser
        </MenuItem>
        <MenuItem onClick={() => selectedQuoteForAction && handleQuoteAction('chat', selectedQuoteForAction)}>
          <Chat sx={{ mr: 1 }} fontSize="small" />
          Åpne chat
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => selectedQuoteForAction && handleQuoteAction('delete', selectedQuoteForAction)}>
          <Cancel sx={{ mr: 1 }} fontSize="small" />
          Slett
        </MenuItem>
      </Menu>

      <Dialog open={detailDialogOpen && Boolean(selectedQuote)} onClose={() => setDetailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tilbudsdetaljer</DialogTitle>
        <DialogContent>
          {selectedQuote ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="h6">{selectedQuote.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedQuote.description}
              </Typography>
              <Divider />
              <Typography variant="body2">
                <strong>Tilbudsnummer:</strong> {selectedQuote.quoteNumber}
              </Typography>
              <Typography variant="body2">
                <strong>Kunde:</strong> {selectedQuote.clientName} ({selectedQuote.clientEmail})
              </Typography>
              <Typography variant="body2">
                <strong>Beløp:</strong> {formatCurrency(selectedQuote.totalAmount)}
              </Typography>
              <Typography variant="body2">
                <strong>Gyldig til:</strong> {formatDate(selectedQuote.validUntil)}
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong>{' '}
                <Chip
                  icon={getStatusIcon(selectedQuote.status)}
                  label={selectedQuote.status.toUpperCase()}
                  size="small"
                  sx={{ bgcolor: getStatusColor(selectedQuote.status), color: 'white', fontWeight: 700 }}
                />
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  disabled={updateStatusMutation.isPending || selectedQuote.status === 'pending'}
                  onClick={() => updateStatusMutation.mutate({ quoteId: selectedQuote.id, status: 'pending' })}
                >
                  Sett som venter
                </Button>
                <Button
                  size="small"
                  color="success"
                  variant="contained"
                  disabled={updateStatusMutation.isPending || selectedQuote.status === 'accepted'}
                  onClick={() => updateStatusMutation.mutate({ quoteId: selectedQuote.id, status: 'accepted' })}
                >
                  Marker godkjent
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  disabled={updateStatusMutation.isPending || selectedQuote.status === 'rejected'}
                  onClick={() => updateStatusMutation.mutate({ quoteId: selectedQuote.id, status: 'rejected' })}
                >
                  Marker avvist
                </Button>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Lukk</Button>
          {selectedQuote ? (
            <>
              <Button onClick={() => handleEditQuote(selectedQuote)} startIcon={<Edit />}>
                Rediger
              </Button>
              <Button onClick={() => handleConvertToProject(selectedQuote)} startIcon={<LinkIcon />}>
                Opprett prosjekt
              </Button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen && Boolean(selectedQuote)} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rediger tilbud</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tittel"
              value={editState.title}
              onChange={(event) => setEditState((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={editState.description}
              onChange={(event) => setEditState((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              rows={4}
            />
            <TextField
              label="Totalbeløp"
              value={editState.totalAmount}
              onChange={(event) => setEditState((prev) => ({ ...prev, totalAmount: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Gyldig til"
              type="date"
              value={editState.validUntil}
              onChange={(event) => setEditState((prev) => ({ ...prev, validUntil: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={updateQuoteMutation.isPending}>
            {updateQuoteMutation.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={convertDialogOpen && Boolean(selectedQuote)} onClose={() => setConvertDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Konverter tilbud til prosjekt</DialogTitle>
        <DialogContent>
          {selectedQuote ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Velg om tilbudet skal kobles til eksisterende prosjekt eller opprette nytt prosjekt.
              </Typography>
              <TextField
                label="Eksisterende prosjekt-ID (valgfritt)"
                value={linkProjectId}
                onChange={(event) => setLinkProjectId(event.target.value)}
                fullWidth
              />
              <Alert severity="info">
                Hvis feltet er tomt opprettes et nytt prosjekt med data fra tilbudet.
              </Alert>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertDialogOpen(false)}>Avbryt</Button>
          <Button
            onClick={handleConfirmConvert}
            variant="contained"
            disabled={linkProjectMutation.isPending}
            startIcon={<LinkIcon />}
          >
            {linkProjectMutation.isPending ? 'Kobler...' : 'Fortsett'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={sendDialogOpen && Boolean(selectedQuoteForAction)} onClose={() => setSendDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send tilbud på e-post</DialogTitle>
        <DialogContent>
          {selectedQuoteForAction ? (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography>
                Send <strong>{selectedQuoteForAction.quoteNumber}</strong> til{' '}
                <strong>{selectedQuoteForAction.clientEmail}</strong>?
              </Typography>
              <Alert severity="info">Tilbudet synkroniseres automatisk til Google Drive etter sending.</Alert>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>Avbryt</Button>
          <Button
            onClick={() => selectedQuoteForAction && sendQuoteMutation.mutate(selectedQuoteForAction)}
            variant="contained"
            disabled={sendQuoteMutation.isPending}
            startIcon={<Send />}
          >
            {sendQuoteMutation.isPending ? 'Sender...' : 'Send nå'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={fikenInvoiceDialogOpen && Boolean(selectedQuote)}
        onClose={() => setFikenInvoiceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Opprett Fiken-faktura</DialogTitle>
        <DialogContent>
          {selectedQuote ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2">
                Opprett fakturautkast i Fiken for tilbud <strong>{selectedQuote.quoteNumber}</strong>.
              </Typography>
              <TextField
                label="Inntektskonto"
                value={selectedAccountCode}
                onChange={(event) => setSelectedAccountCode(event.target.value)}
                fullWidth
              />
              {accountCodeQuery.isFetching ? <LinearProgress /> : null}
              {fikenError ? <Alert severity="error">{fikenError}</Alert> : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFikenInvoiceDialogOpen(false)}>Senere</Button>
          <Button
            onClick={handleCreateFikenInvoice}
            variant="contained"
            disabled={fikenInvoiceCreating}
          >
            {fikenInvoiceCreating ? 'Oppretter...' : 'Opprett faktura'}
          </Button>
        </DialogActions>
      </Dialog>

      {selectedProjectForHistory ? (
        <ContractAmendmentHistory
          open={amendmentHistoryOpen}
          onClose={() => setAmendmentHistoryOpen(false)}
          projectId={selectedProjectForHistory.id}
          projectTitle={selectedProjectForHistory.title}
        />
      ) : null}

      <QuoteReminderSettings
        open={reminderSettingsOpen}
        onClose={() => setReminderSettingsOpen(false)}
        userId={user?.id}
      />
    </Box>
  );
}
