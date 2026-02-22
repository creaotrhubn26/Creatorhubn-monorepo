/**
 * Contract Summary Widget
 * Displays contract overview for dashboard with quick actions
 * - Pending contracts awaiting signature
 * - Contracts expiring soon (within 30 days)
 * - Recently signed contracts
 * - Quick create contract button
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  LinearProgress,
  Tooltip,
  Alert,
  alpha,
} from '@mui/material';
import {
  Article,
  Add,
  CheckCircle,
  Schedule,
  Warning,
  ArrowForward,
  Alarm,
  Draw,
  Visibility,
} from '@mui/icons-material';

interface Contract {
  id: string;
  title: string;
  clientName: string;
  projectName?: string;
  status: 'draft' | 'pending' | 'signed' | 'expired';
  createdAt: string;
  signedAt?: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
}

interface ContractSummaryWidgetProps {
  userId?: string;
  projectId?: string;
  onCreateContract?: () => void;
  onViewContract?: (contractId: string) => void;
  onViewAllContracts?: () => void;
  brandColor?: string;
}

export const ContractSummaryWidget: React.FC<ContractSummaryWidgetProps> = ({
  userId,
  projectId,
  onCreateContract,
  onViewContract,
  onViewAllContracts,
  brandColor = '#ff8c00',
}) => {
  // Fetch contract summary
  const {
    data: contractSummary,
    isLoading,
    error,
  } = useQuery({
    queryKey: [ '/api/contracts/summary', { userId, projectId }],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(userId && { userId }),
        ...(projectId && { projectId }),
      });
      return apiRequest(`/api/contracts/summary?${params.toString()}`);
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
    retry: 1,
  });

  const pendingContracts = contractSummary?.pending || [];
  const expiringContracts = contractSummary?.expiring || [];
  const recentContracts = contractSummary?.recent || [];
  const totalContracts = contractSummary?.total || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return '#4caf50';
      case 'pending': return '#ff9800';
      case 'expired': return '#f44336';
      case 'draft': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'signed': return <CheckCircle sx={{ color: '#4caf50', fontSize: 20 }} />;
      case 'pending': return <Schedule sx={{ color: '#ff9800', fontSize: 20 }} />;
      case 'expired': return <Alarm sx={{ color: '#f44336', fontSize: 20 }} />;
      case 'draft': return <Article sx={{ color: '#9e9e9e', fontSize: 20 }} />;
      default: return <Article sx={{ fontSize: 20 }} />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric' });
  };

  const getDaysText = (days: number) => {
    if (days === 0) return 'I dag';
    if (days === 1) return 'I morgen';
    if (days < 0) return `${Math.abs(days)} dager siden`;
    return `${days} dager igjen`;
  };

  if (isLoading) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(brandColor, 0.2)}`,
          borderRadius: 3}}
      >
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Article sx={{ color: brandColor, fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: brandColor }}>
                Kontrakter
              </Typography>
            </Box>
            <LinearProgress />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(brandColor, 0.2)}`,
          borderRadius: 3}}
      >
        <CardContent>
          <Alert severity="warning">Kunne ikke laste kontraktdata</Alert>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no contracts
  if (totalContracts === 0) {
    return (
      <Card
        sx={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${alpha(brandColor, 0.2)}`,
          borderRadius: 3}}
      >
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Article sx={{ fontSize: 48, color: alpha(brandColor, 0.5), mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: brandColor }}>
            Ingen kontrakter ennå
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Opprett din første kontrakt for å komme i gang
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onCreateContract}
            sx={{
              bgcolor: brandColor,
              '&:hover': { bgcolor: alpha(brandColor, 0.8) }
            }}
          >
            Opprett kontrakt
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${alpha(brandColor, 0.2)}`,
        borderRadius: 3}}
    >
      <CardContent>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2}}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Article sx={{ color: brandColor, fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: brandColor }}>
                Kontrakter
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {totalContracts} totalt
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={onCreateContract}
              sx={{
                borderColor: brandColor,
                color: brandColor,
                '&:hover': {
                  borderColor: brandColor,
                  bgcolor: alpha(brandColor, 0.1),
                }
              }}
            >
              Ny kontrakt
            </Button>
            {totalContracts > 3 && (
              <Button
                size="small"
                variant="text"
                endIcon={<ArrowForward />}
                onClick={onViewAllContracts}
                sx={{ color: brandColor }}>
                Se alle
              </Button>
            )}
          </Stack>
        </Box>

        {/* Status Summary Chips */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {pendingContracts.length > 0 && (
            <Chip
              icon={<Schedule />}
              label={`${pendingContracts.length} venter på signering`}
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
          {expiringContracts.length > 0 && (
            <Chip
              icon={<Warning />}
              label={`${expiringContracts.length} utløper snart`}
              size="small"
              color="error"
              variant="outlined"
            />
          )}
          {recentContracts.length > 0 && (
            <Chip
              icon={<CheckCircle />}
              label={`${recentContracts.filter((c: Contract) => c.status === 'signed').length} nylig signert`}
              size="small"
              color="success"
              variant="outlined"
            />
          )}
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Pending Contracts - Highest Priority */}
        {pendingContracts.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: '#ff9800',
                display: 'flex',
                alignItems: 'center',
                gap: 1}}>
              <Schedule fontSize="small" />
              Venter på signering
            </Typography>
            <List dense sx={{ py: 0 }}>
              {pendingContracts.slice(0, 2).map((contract: Contract) => (
                <ListItem
                  key={contract.id}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: alpha('#ff9800', 0.05),
                    border: `1px solid ${alpha('#ff9800', 0.2)}`,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha('#ff9800', 0.1) }
                  }}
                  onClick={() => onViewContract?.(contract.id)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: alpha('#ff9800', 0.1), width: 32, height: 32 }}>
                      <Draw sx={{ fontSize: 18, color: '#ff9800' }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        {contract.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {contract.clientName} • {formatDate(contract.createdAt)}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => onViewContract?.(contract.id)}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Expiring Soon - Second Priority */}
        {expiringContracts.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: '#f44336',
                display: 'flex',
                alignItems: 'center',
                gap: 1}}>
              <Alarm fontSize="small" />
              Utløper snart
            </Typography>
            <List dense sx={{ py: 0 }}>
              {expiringContracts.slice(0, 2).map((contract: Contract) => (
                <ListItem
                  key={contract.id}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: alpha('#f44336', 0.05),
                    border: `1px solid ${alpha('#f44336', 0.2)}`,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha('#f44336', 0.1) }
                  }}
                  onClick={() => onViewContract?.(contract.id)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: alpha('#f44336', 0.1), width: 32, height: 32 }}>
                      <Alarm sx={{ fontSize: 18, color: '#f44336' }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        {contract.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {contract.clientName} • {getDaysText(contract.daysUntilExpiry || 0)}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => onViewContract?.(contract.id)}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Recently Signed - Lowest Priority */}
        {recentContracts.length > 0 && !pendingContracts.length && !expiringContracts.length && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                mb: 1,
                fontWeight: 600,
                color: '#4caf50',
                display: 'flex',
                alignItems: 'center',
                gap: 1}}>
              <CheckCircle fontSize="small" />
              Nylig signert
            </Typography>
            <List dense sx={{ py: 0 }}>
              {recentContracts.slice(0, 2).map((contract: Contract) => (
                <ListItem
                  key={contract.id}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: alpha('#4caf50', 0.05),
                    border: `1px solid ${alpha('#4caf50', 0.2)}`,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha('#4caf50', 0.1) }
                  }}
                  onClick={() => onViewContract?.(contract.id)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: alpha('#4caf50', 0.1), width: 32, height: 32 }}>
                      <CheckCircle sx={{ fontSize: 18, color: '#4caf50' }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 600}}>
                        {contract.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {contract.clientName} • Signert {formatDate(contract.signedAt!)}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => onViewContract?.(contract.id)}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Footer with View All button if many contracts */}
        {(pendingContracts.length > 2 ||
          expiringContracts.length > 2 ||
          recentContracts.length > 2) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ textAlign: 'center' }}>
              <Button
                size="small"
                variant="text"
                endIcon={<ArrowForward />}
                onClick={onViewAllContracts}
                sx={{ color: brandColor }}>
                Se alle {totalContracts} kontrakter
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractSummaryWidget;
