/**
 * Contract Amendment History Dialog
 * Shows timeline of all amendments to a contract/project
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  AttachMoney,
  CalendarToday,
  CheckCircle,
  AccessTime,
  Visibility,
} from '@mui/icons-material';

interface ContractAmendmentHistoryProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle?: string;
}

export default function ContractAmendmentHistory({
  open,
  onClose,
  projectId,
  projectTitle,
}: ContractAmendmentHistoryProps) {
  // Fetch all amendments for this project
  const { data: amendmentsData, isLoading } = useQuery({
    queryKey: ['/api/quotes/amendments', projectId],
    queryFn: async () => {
      return apiRequest(`/api/quotes/all?contractAmendmentFor=${projectId}`);
    },
    enabled: open && !!projectId,
  });

  const amendments = amendmentsData?.quotes || [];

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('no-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: string) => {
    return `${parseFloat(amount).toLocaleString('no-NO')} NOK`;
  };

  const getAmendmentIcon = (quoteType: string) => {
    switch (quoteType) {
      case 'extra_images':
        return <ImageIcon />;
      case 'contract_amendment':
        return <LinkIcon />;
      default:
        return <AttachMoney />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'rejected':
        return '#F44336';
      case 'expired':
        return '#9E9E9E';
      default:
        return '#2196F3';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: {} }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" component="div">
              Kontraktshistorikk
            </Typography>
            {projectTitle && (
              <Typography variant="caption" color="textSecondary">
                {projectTitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : amendments.length === 0 ? (
          <Alert severity="info">Ingen tillegg eller endringer funnet for dette prosjektet.</Alert>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Card sx={{ mb: 3, bgcolor: 'rgba(33, 150, 243, 0.05)' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      bgcolor: '#2196F3',
                      color: 'white',
                      p: 1.5,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <CalendarToday />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6">
                      {amendments.length} {amendments.length === 1 ? 'tillegg' : 'tillegg'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total verdi:{', '}
                      {formatCurrency(
                        amendments
                          .reduce(
                            (sum: number, a: unknown) => sum + parseFloat(a.totalAmount || '0'),
                            0,
                          )
                          .toString(),
                      )}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Timeline position="right">
              {amendments.map((amendment: any, index: number) => (
                <TimelineItem key={amendment.id}>
                  <TimelineOppositeContent color="textSecondary" sx={{ flex: 0.3 }}>
                    <Typography variant="caption">{formatDate(amendment.createdAt)}</Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      {amendment.quoteNumber}
                    </Typography>
                  </TimelineOppositeContent>

                  <TimelineSeparator>
                    <TimelineDot
                      sx={{
                        bgcolor: getStatusColor(amendment.status),
                        boxShadow: `0 0 0 4px rgba(${getStatusColor(amendment.status)}, 0.2)`}}
                    >
                      {getAmendmentIcon(amendment.quoteType)}
                    </TimelineDot>
                    {index < amendments.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>

                  <TimelineContent>
                    <Card
                      sx={{
                        mb: 2,
                        border: `2px solid ${getStatusColor(amendment.status)}`,
                        borderRadius: 2}}
                    >
                      <CardContent>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                            mb: 1}}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {amendment.title}
                            </Typography>
                            {amendment.quoteType === 'extra_images' && (
                              <Chip
                                icon={<ImageIcon />}
                                label="Ekstra bilder"
                                size="small"
                                sx={{
                                  mt: 0.5,
                                  bgcolor: '#4CAF50',
                                  color: 'white'}}
                              />
                            )}
                          </Box>
                          <Chip
                            label={
                              amendment.status === 'accepted'
                                ? 'Godkjent'
                                : amendment.status === 'pending'
                                  ? 'Venter'
                                  : amendment.status === 'rejected'
                                    ? 'Avvist'
                                    : amendment.status === 'expired'
                                      ? 'Utløpt'
                                      : amendment.status
                            }
                            size="small"
                            icon={
                              amendment.status === 'accepted' ? (
                                <CheckCircle />
                              ) : amendment.status === 'pending' ? (
                                <AccessTime />
                              ) : undefined
                            }
                            sx={{
                              bgcolor: getStatusColor(amendment.status),
                              color: 'white',
                              fontWeight: 'bold'}}
                          />
                        </Box>

                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          {amendment.description}
                        </Typography>

                        <Divider sx={{ my: 1 }} />

                        <Stack
                          direction="row"
                          spacing={2}
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <Box>
                            <Typography variant="caption" color="textSecondary" display="block">
                              Beløp
                            </Typography>
                            <Typography variant="h6" color="primary">
                              {formatCurrency(amendment.totalAmount)}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography variant="caption" color="textSecondary" display="block">
                              Klient
                            </Typography>
                            <Typography variant="body2">{amendment.clientName}</Typography>
                          </Box>

                          {amendment.acceptedAt && (
                            <Box>
                              <Typography variant="caption" color="textSecondary" display="block">
                                Godkjent
                              </Typography>
                              <Typography variant="body2">
                                {formatDate(amendment.acceptedAt)}
                              </Typography>
                            </Box>
                          )}
                        </Stack>

                        {amendment.fikenInvoiceNumber && (
                          <Box
                            sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <img
                                src="https://fiken.no/wp-content/themes/fiken/dist/images/fiken-logo.svg"
                                alt="Fiken"
                                style={{ height: 12 }}
                              />
                              <Typography variant="caption">
                                Faktura #{amendment.fikenInvoiceNumber}
                              </Typography>
                            </Stack>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
}
