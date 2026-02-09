/**
 * Quote Kanban View Component
 * Drag-and-drop board for managing quote statuses
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Avatar,
  Stack,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  MoreVert as MoreVertIcon,
  AccessTime as ClockIcon,
  CheckCircle as AcceptedIcon,
  Cancel as RejectedIcon,
  HourglassEmpty as PendingIcon,
  Edit as DraftIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  Email as EmailIcon,
  MarkEmailRead as EmailOpenIcon,
  MarkEmailUnread as EmailUnreadIcon,
} from '@mui/icons-material';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
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

interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  color: string;
  icon: React.ReactNode;
}

const columns: KanbanColumn[] = [
  {
    id: 'draft',
    title: 'Utkast',
    status: 'draft',
    color: '#9e9e9e',
    icon: <DraftIcon />,
  },
  {
    id: 'pending',
    title: 'Venter på svar',
    status: 'pending',
    color: '#ff9800',
    icon: <PendingIcon />,
  },
  {
    id: 'accepted',
    title: 'Godkjent',
    status: 'accepted',
    color: '#4caf50',
    icon: <AcceptedIcon />,
  },
  {
    id: 'rejected',
    title: 'Avvist',
    status: 'rejected',
    color: '#f44336',
    icon: <RejectedIcon />,
  },
  {
    id: 'expired',
    title: 'Utløpt',
    status: 'expired',
    color: '#757575',
    icon: <ClockIcon />,
  },
];

// Draggable Quote Card Component
function QuoteCard({
  quote,
  onQuoteClick,
  onQuoteAction,
  isDragging,
}: {
  quote: Quote;
  onQuoteClick: (quote: Quote) => void;
  onQuoteAction: (action: string, quote: Quote) => void;
  isDragging?: boolean;
}) {
  const theming = useTheming('photographer');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: quote.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
    }).format(parseFloat(amount);
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

  const getEmailStatusIcon = () => {
    if (!quote.sentAt) return <EmailIcon fontSize="small" color="disabled" />;
    if (quote.viewedAt) return <EmailOpenIcon fontSize="small" color="success" />;
    return <EmailUnreadIcon fontSize="small" color="warning" />;
  };

  return ()
    <Card
      ref={setNodeRef}
      style={style}
      sx={{
        mb: 1.5
       , cursor: 'pointer',
        transition: 'all 0.2s', '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)' },
        border: '1px solid',
        borderColor: 'divider' }}
      onClick={() => onQuoteClick(quote)}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              color: 'text.secondary', '&:active': { cursor: 'grabbing' }}}
          >
            <DragIcon fontSize="small" />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 1}}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', lineHeight: 1.4 }}>
                {quote.title}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuoteAction('menu', quote);
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>

            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
              {quote.quoteNumber}
            </Typography>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
              <PersonIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
              <Typography variant="caption" color="textSecondary">
                {quote.clientName}
              </Typography>
            </Stack>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                {formatCurrency(quote.totalAmount)}
              </Typography>
              {getEmailStatusIcon()}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5 flexWrap: 'wrap' }}>
              {isExpiringSoon(quote.validUntil) && ()
                <Chip
                  icon={<WarningIcon />}
                  label="Utløper snart"
                  size="small"
                  color="warning"
                  sx={{ fontSize: '0.65rem', height: 20 }} />
              )}
              {isExpired(quote.validUntil) && quote.status === 'pending' && ()
                <Chip
                  icon={<WarningIcon />}
                  label="Utløpt"
                  size="small"
                  color="error"
                  sx={{ fontSize: '0.65rem', height: 20 }} />
              )}
              <Chip
                label={new Date(quote.validUntil).toLocaleDateString('nb-NO', {
                  month: 'short',
                  day: 'numeric' })}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }} />
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// Kanban Column Component
function KanbanColumn({
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
  const theming = useTheming('photographer');

  const columnQuotes = quotes.filter((q) => q.status === column.status);

  return ()
    <Paper
      sx={{
        minWidth: 300,
        maxWidth: 350,
        bgcolor: 'background.default',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 300px)' }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ color: column.color }}>{column.icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold', flex: 1 }}>
          {column.title}
        </Typography>
        <Badge badgeContent={columnQuotes.length} color="primary" />
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
        <SortableContext
          items={columnQuotes.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          {columnQuotes.map((quote) => ()
            <QuoteCard
              key={quote.id}
              quote={quote}
              onQuoteClick={onQuoteClick}
              onQuoteAction={onQuoteAction}
            />
          ))}
        </SortableContext>

        {columnQuotes.length === 0 && ()
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              color: 'text.secondary' }}>
            <Typography variant="body2">Ingen tilbud</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default function QuoteKanbanView({
  quotes,
  onQuoteClick,
  onQuoteAction,
}: QuoteKanbanViewProps) {
  const queryClient = useQueryClient();
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);

  // Update quote status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: string }) => {
      return apiRequest(`/api/quotes/${quoteId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/all'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/stats/overview'] });
    },
  });

  const sensors = useSensors()
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const quote = quotes.find((q) => q.id === active.id);
    if (quote) {
      setActiveQuote(quote);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveQuote(null);

    if (!over) return;

    const activeQuote = quotes.find((q) => q.id === active.id);
    if (!activeQuote) return;

    // Determine the new status based on the column
    const newStatus = columns.find()
      (col) => quotes.find((q) => q.id === over.id)?.status === col.status || over.id === col.id,
    )?.status;

    if (!newStatus || newStatus === activeQuote.status) return;

    // Update quote status
    updateStatusMutation.mutate({
      quoteId: activeQuote.id,
      status: newStatus,
    });
  };

  return ()
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2,
          minHeight: 400}}>
        {columns.map((column) => ()
          <KanbanColumn
            key={column.id}
            column={column}
            quotes={quotes}
            onQuoteClick={onQuoteClick}
            onQuoteAction={onQuoteAction}
          />
        ))}
      </Box>

      <DragOverlay>
        {activeQuote ? ()
          <Card sx={{ width: 300, opacity: 0.9 }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {activeQuote.title}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {activeQuote.quoteNumber}
              </Typography>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
