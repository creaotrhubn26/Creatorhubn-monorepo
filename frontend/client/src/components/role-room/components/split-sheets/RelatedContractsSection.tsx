import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Description as ContractIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

interface RelatedContractsSectionProps {
  projectId: string;
  splitSheetId: string;
  onViewContract: (contract: any) => void;
  onCreateContract: () => void;
}

export default function RelatedContractsSection({
  projectId,
  splitSheetId,
  onViewContract,
  onCreateContract,
}: RelatedContractsSectionProps) {
  const theme = useTheme();
  const brandColor = theme.palette.primary.main;

  // Fetch related contracts by project_id - Fixed queryKey
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['contracts', 'project', projectId],
    queryFn: () => apiRequest(`/api/contracts?projectId=${projectId}`),
    enabled: !!projectId,
    retry: false,
  });

  const contracts = contractsData?.contracts || [];

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'active':
      case 'signed':
        return 'success';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      case 'draft':
        return 'default';
      case 'pending_signatures':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card
      sx={{
        borderRadius: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
            flexWrap: 'wrap',
            gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 } }}>
            <ContractIcon sx={{ color: brandColor, fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem', lg: '1.625rem', xl: '1.75rem' } }} />
            <Typography
              variant="h6"
              sx={{
                color: brandColor,
                fontWeight: 700,
                fontSize: { xs: '1rem', sm: '1.063rem', md: '1.125rem', lg: '1.188rem', xl: '1.25rem' },
              }}
            >
              Relaterte Kontrakter
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="medium"
            startIcon={<AddIcon />}
            onClick={onCreateContract}
            sx={{
              borderColor: brandColor,
              color: brandColor,
              '&:hover': {
                borderColor: brandColor,
                bgcolor: 'rgba(0, 212, 255, 0.1)',
              },
              minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
              fontSize: { xs: '0.875rem', sm: '0.938rem', md: '1rem', lg: '1.063rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
              py: { xs: 1, sm: 1.25, md: 1.5, lg: 1.75, xl: 2 },
            }}
          >
            Opprett Kontrakt
          </Button>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 } }}>
            <CircularProgress size={isMobile ? 24 : 32} sx={{ color: brandColor }} />
          </Box>
        ) : contracts.length === 0 ? (
          <Alert
            severity="info"
            sx={{
              borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
              fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
            }}
          >
            Ingen kontrakter funnet for dette prosjektet. Klikk "Opprett Kontrakt" for å opprette en.
          </Alert>
        ) : (
          <List sx={{ p: 0 }}>
            {contracts.map((contract: any) => (
              <ListItem
                key={contract.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                  mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                  bgcolor: 'rgba(255,255,255,0.02)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderColor: brandColor,
                  },
                  transition: 'all 0.2s ease',
                  p: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                }}
              >
                <ListItemText
                  primary={
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5, xl: 1.75 },
                        mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 },
                        flexWrap: 'wrap',
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: '0.938rem', sm: '1rem', md: '1.063rem', lg: '1.125rem', xl: '1.188rem' },
                        }}
                      >
                        {contract.title || contract.clientName || 'Ukjent kontrakt'}
                      </Typography>
                      <Chip
                        label={contract.status || 'draft'}
                        size="small"
                        color={getStatusColor(contract.status)}
                        sx={{
                          fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                          height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 },
                        }}
                      />
                      {contract.signature_status === 'signed' && (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem', lg: '1.25rem', xl: '1.375rem' } }} />}
                          label="Signert"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.813rem', lg: '0.875rem', xl: '0.938rem' },
                            height: { xs: 24, sm: 26, md: 28, lg: 30, xl: 32 },
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: { xs: '0.813rem', sm: '0.875rem', md: '0.938rem', lg: '1rem', xl: '1.063rem' },
                          mb: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 },
                        }}
                      >
                        {contract.description || contract.projectDescription || 'Ingen beskrivelse'}
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3, xl: 3.5 },
                          mt: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 },
                          flexWrap: 'wrap',
                        }}
                      >
                        {contract.totalAmount && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                            }}
                          >
                            Beløp: NOK {contract.totalAmount.toLocaleString('no-NO')}
                          </Typography>
                        )}
                        {contract.createdAt && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontSize: { xs: '0.75rem', sm: '0.813rem', md: '0.875rem', lg: '0.938rem', xl: '1rem' },
                            }}
                          >
                            Opprettet: {new Date(contract.createdAt).toLocaleDateString('no-NO')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 } }}>
                    <Tooltip title="Se detaljer">
                      <IconButton
                        edge="end"
                        onClick={() => onViewContract(contract)}
                        sx={{
                          color: brandColor,
                          '&:hover': { bgcolor: 'rgba(0, 212, 255, 0.1)' },
                          minWidth: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                          minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                        }}
                      >
                        <ViewIcon sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' } }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Opprett ny kontrakt">
                      <IconButton
                        edge="end"
                        onClick={onCreateContract}
                        sx={{
                          color: brandColor,
                          '&:hover': { bgcolor: 'rgba(0, 212, 255, 0.1)' },
                          minWidth: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                          minHeight: { xs: 44, sm: 46, md: 48, lg: 50, xl: 52 },
                        }}
                      >
                        <AddIcon sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem', lg: '1.5rem', xl: '1.625rem' } }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}























