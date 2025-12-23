import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import {
  LocalOffer as PriceIcon,
  Receipt as QuoteIcon,
} from '@mui/icons-material';
import { useTheming } from '../../../utils/theming-helper';
import { useClientServicePricing } from '../../../services/ClientServicePricingService';

interface PricingInfoSectionProps {
  projectId: string;
}

export default function PricingInfoSection({ projectId }: PricingInfoSectionProps) {
  const theming = useTheming('music_producer');
  const { formatCurrency } = useClientServicePricing();

  // Fetch contracts for the project to show total contract value
  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/contracts', 'project', projectId],
    queryFn: () => apiRequest(`/api/contracts?projectId=${projectId}`),
    enabled: !!projectId,
    retry: false,
  });

  const contracts = contractsData?.contracts || [];
  const totalContractValue = contracts.reduce((sum: number, c: any) => sum + (parseFloat(c.totalAmount) || 0), 0);

  return (
    <Card variant="outlined" sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PriceIcon sx={{ color: theming.colors.primary }} />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Prisinformasjon
          </Typography>
        </Box>

        {contractsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : contracts.length === 0 ? (
          <Alert severity="info">
            Ingen kontrakter knyttet til dette prosjektet.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Kontraktverdi
                </Typography>
                <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                  {formatCurrency(totalContractValue)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Antall Kontrakter
                </Typography>
                <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                  {contracts.length}
                </Typography>
              </Box>
            </Grid>
            {contracts.map((contract: any) => (
              <Grid item xs={12} key={contract.id}>
                <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">
                      {contract.clientName ||'Ukjent klient'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                      {formatCurrency(contract.totalAmount || 0)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}





