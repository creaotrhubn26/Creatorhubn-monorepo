/**
 * Quote Kanban View Component
 * Drag-and-drop board for managing quote statuses
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Avatar,
  Badge,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AccessTime as ClockIcon,
  AttachMoney as MoneyIcon,
  Cancel as RejectedIcon,
  CheckCircle as AcceptedIcon,
  DragIndicator as DragIcon,
  Edit as DraftIcon,
  Email as EmailIcon,
  HourglassEmpty as PendingIcon,
  MarkEmailRead as EmailOpenIcon,
  MarkEmailUnread as EmailUnreadIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Quote {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientEmail: string;
  title: string;
  totalAmount: string;
  status: 'draft' | 'pending' | 'accepted' | 'rejected' | 'expired';
  validUntil: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
}

interface QuoteKanbanViewProps {
  quotes: Quote[];
  onQuoteClick: (quote: Quote) => void;
  onQuoteAction: (action: string, quote: Quote) => void;
}

type QuoteStatus = Quote['status'];

interface KanbanColumn {
  id: QuoteStatus;
  title: string;
  color: string;
  icon: React.ReactNode;
}

const columns: KanbanColumn[] = [
  {
    id: 'draft',
    title: 'Utkast',
    color: '#9e9e9e',
    icon: <DraftIcon fontSize="small" />,
  },
  {
    id: 'pending',
    title: 'Venter på svar',
    color: '#ff9800',
    icon: <PendingIcon fontSize="small" />,
  },
  {
    id: 'accepted',
    title: 'Godkjent',
    color: '#4caf50',
    icon: <AcceptedIcon fontSize="small" />,
  },
  {
    id: 'rejected',
    title: 'Avvist',
    color: '#f44336',
    icon: <RejectedIcon fontSize="small" />,
  },
  {
    id: 'expired',
    title: 'Utløpt',
    color: '#757575',
    icon: <ClockIcon fontSize="small" />,
  },
];

function isExpiringSoon(validUntil: string): boolean {
  const msLeft = new Date(validUntil).getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return daysLeft <= 7 && daysLeft > 0;
}

function isExpired(validUntil: string): boolean {
  return new Date(validUntil).getTime() < Date.now();
}

function formatCurrency(amount: string): string {
  const parsed = Number.parseFloat(amount);
  if (Number.isNaN(parsed)) return amount;
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
  }).format(parsed);
}

function getEmailStatusIcon(quote: Quote): React.ReactNode {
  if (!quote.sentAt) return <EmailIcon fontSize="small" color="disabled" />;
  if (quote.viewedAt) return <EmailOpenIcon fontSize="small" color="success" />;
  return <EmailUnreadIcon fontSize="small" color="warning" />;
}

function SortableQuoteCard({
  quote,
  onQuoteClick,
  onQuoteAction,
}: {
  quote: Quote;
  onQuoteClick: (quote: Quote) => void;
  onQuoteAction: (action: string, quote: Quote) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: quote.id,
    data: {
      type: 'quote',
      status: quote.status,
    },
  });

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
      sx={{
        mb: 1.5,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)',
        },
      }}
      onClick={() => onQuoteClick(quote)}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.secondary',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIcon fontSize="small" />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
                {quote.title}
              </Typography>
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onQuoteAction('menu', quote);
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {quote.quoteNumber}
            </Typography>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
              <PersonIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">
                {quote.clientName}
              </Typography>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatCurrency(quote.totalAmount)}
              </Typography>
              {getEmailStatusIcon(quote)}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {isExpiringSoon(quote.validUntil) ? (
                <Chip
                  icon={<WarningIcon />}
                  label="Utløper snart"
                  size="small"
                  color="warning"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              ) : null}
              {isExpired(quote.validUntil) && quote.status === 'pending' ? (
                <Chip
                  icon={<WarningIcon />}
                  label="Utløpt"
                  size="small"
                  color="error"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              ) : null}
              <Chip
                label={new Date(quote.validUntil).toLocaleDateString('nb-NO', {
                  month: 'short',
                  day: 'numeric',
                })}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function KanbanStatusColumn({
  column,
  quotes,
  onQuoteClick,
  onQuoteAction,
}: {
  column: KanbanColumn;
  quotes: Quote[];
  onQuoteClick: (quote: Quote) => void;
  onQuoteAction: (action: string, quote: Quote) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'column',
      status: column.id,
    },
  });

  const columnQuotes = useMemo(
    () => quotes.filter((quote) => quote.status === column.id),
    [column.id, quotes],
  );

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        minWidth: 300,
        maxWidth: 350,
        p: 2,
        bgcolor: isOver ? 'action.hover' : 'background.default',
        transition: 'background-color 120ms ease',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 300px)',
      }}
    >
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ bgcolor: column.color, width: 28, height: 28 }}>{column.icon}</Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          {column.title}
        </Typography>
        <Badge badgeContent={columnQuotes.length} color="primary" />
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
        <SortableContext items={columnQuotes.map((quote) => quote.id)} strategy={verticalListSortingStrategy}>
          {columnQuotes.map((quote) => (
            <SortableQuoteCard
              key={quote.id}
              quote={quote}
              onQuoteClick={onQuoteClick}
              onQuoteAction={onQuoteAction}
            />
          ))}
        </SortableContext>

        {columnQuotes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography variant="body2">Ingen tilbud</Typography>
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}

export default function QuoteKanbanView({ quotes, onQuoteClick, onQuoteAction }: QuoteKanbanViewProps) {
  const queryClient = useQueryClient();
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
      return apiRequest(`/api/quotes/${quoteId}/status`, {
        method: 'PUT',
        body: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/stats/overview'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const found = quotes.find((quote) => quote.id === activeId) ?? null;
    setActiveQuote(found);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveQuote(null);

    if (!overId) return;

    const movedQuote = quotes.find((quote) => quote.id === activeId);
    if (!movedQuote) return;

    const directColumn = columns.find((column) => column.id === overId)?.id;
    const targetQuote = quotes.find((quote) => quote.id === overId);
    const targetStatus = directColumn ?? targetQuote?.status;

    if (!targetStatus || targetStatus === movedQuote.status) return;

    updateStatusMutation.mutate({
      quoteId: movedQuote.id,
      status: targetStatus,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2, minHeight: 400 }}>
        {columns.map((column) => (
          <KanbanStatusColumn
            key={column.id}
            column={column}
            quotes={quotes}
            onQuoteClick={onQuoteClick}
            onQuoteAction={onQuoteAction}
          />
        ))}
      </Box>

      <DragOverlay>
        {activeQuote ? (
          <Card sx={{ width: 300, opacity: 0.9 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {activeQuote.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {activeQuote.quoteNumber}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <MoneyIcon fontSize="small" />
                <Typography variant="caption">{formatCurrency(activeQuote.totalAmount)}</Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
