/**
 * Contributor Dashboard
 * View-only dashboard for contributors to see their split sheets and revenue
 * Now with profession-specific theming
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  alpha
} from '@mui/material';
import {
  AccountBalance as SplitSheetIcon,
  AttachMoney as MoneyIcon,
  CheckCircle as SignedIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';
import getProfessionIcon from '@/utils/profession-icons';
import type { SplitSheet, SplitSheetPayment, STATUS_DISPLAY_NAMES, STATUS_COLORS } from './types';
import { STATUS_DISPLAY_NAMES as STATUS_NAMES, STATUS_COLORS as STATUS_COL } from './types';

interface ContributorDashboardProps {
  contributorEmail?: string;
  contributorUserId?: string;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function ContributorDashboard({
  contributorEmail,
  contributorUserId,
  profession = 'music_producer'
}: ContributorDashboardProps) {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  
  // Get profession-specific styling
  const { getUserProfessionColor, getProfessionDisplayName } = useDynamicProfessions();
  const professionColor = getUserProfessionColor(profession);
  const professionDisplayName = getProfessionDisplayName(profession);
  const professionIcon = getProfessionIcon(profession);
  
  // Profession-specific dashboard labels
  const getDashboardLabels = () => {
    switch (profession) {
      case 'music_producer':
        return {
          title: 'Mine Split Sheets',
          description: 'Oversikt over dine royalty-avtaler og inntekter',
          earningsLabel: 'Total inntjening',
          pendingLabel: 'Ventende signaturer',
        };
      case 'photographer':
        return {
          title: 'Mine Samarbeidsavtaler',
          description: 'Oversikt over dine fotoprosjekt-avtaler',
          earningsLabel: 'Total inntjening',
          pendingLabel: 'Ventende signaturer',
        };
      case 'videographer':
        return {
          title: 'Mine Crew-avtaler',
          description: 'Oversikt over dine videoproduksjon-avtaler',
          earningsLabel: 'Total inntjening',
          pendingLabel: 'Ventende signaturer',
        };
      default:
        return {
          title: 'Mine Avtaler',
          description: 'Oversikt over dine avtaler',
          earningsLabel: 'Total inntjening',
          pendingLabel: 'Ventende signaturer',
        };
    }
  };
  
  const dashboardLabels = getDashboardLabels();

  // Find split sheets where user is a contributor
  const { data: splitSheetsData } = useQuery({
    queryKey: ['contributor-split-sheets', contributorEmail || contributorUserId || user?.email],
    queryFn: async () => {
      // This would need a special endpoint to find split sheets by contributor
      // For now, fetch all and filter client-side
      const response = await apiRequest('/api/split-sheets');
      const allSheets: SplitSheet[] = response.data || [];
      
      // Filter to only sheets where this user is a contributor
      const userEmail = contributorEmail || user?.email;
      const userId = contributorUserId || user?.id;
      
      return allSheets.filter(sheet => 
        sheet.contributors?.some(c => 
          c.email === userEmail || c.user_id === userId
        )
      );
    },
    enabled: !!(contributorEmail || contributorUserId || user?.email)
  });

  const splitSheets: SplitSheet[] = splitSheetsData || [];

  // Get contributor info from each sheet
  const contributorData = useMemo(() => {
    const userEmail = contributorEmail || user?.email;
    const userId = contributorUserId || user?.id;
    
    return splitSheets.map(sheet => {
      const contributor = sheet.contributors?.find(c => 
        c.email === userEmail || c.user_id === userId
      );
      return {
        sheet,
        contributor,
        myPercentage: contributor?.percentage || 0
      };
    }).filter(item => item.contributor);
  }, [splitSheets, contributorEmail, contributorUserId, user]);

  // Fetch payments for all sheets
  const paymentsQueries = contributorData.map(({ sheet }) => ({
    queryKey: ['split-sheet-payments', sheet.id],
    queryFn: async () => {
      if (!sheet.id) return { data: [] };
      const response = await apiRequest(`/api/split-sheets/${sheet.id}/payments?contributor_id=${contributorData.find(c => c.sheet.id === sheet.id)?.contributor?.id}`).catch(() => ({ data: [] }));
      return response;
    },
    enabled: !!sheet.id
  }));

  // Calculate totals
  const totals = useMemo(() => {
    const totalPending = 0;
    const totalPaid = 0;
    let signedCount = 0;
    let unsignedCount = 0;

    contributorData.forEach(({ contributor }) => {
      if (contributor?.signed_at) {
        signedCount++;
      } else {
        unsignedCount++;
      }
    });

    return {
      totalSplitSheets: splitSheets.length,
      signedCount,
      unsignedCount,
      totalPending,
      totalPaid
    };
  }, [contributorData, splitSheets]);

  const formatCurrency = (amount: number, currency: string = 'NOK') => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 70, mb: 1 }}>
        Min Split Sheet Oversikt
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Oversikt over alle split sheets du er en del av
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <SplitSheetIcon sx={{ color: '#9f7aea' }} />
                <Typography variant="body2" color="text.secondary">
                  Mine Split Sheets
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 70, color: '#9f7aea' }}>
                {totals.totalSplitSheets}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <SignedIcon sx={{ color: '#4caf50' }} />
                <Typography variant="body2" color="text.secondary">
                  Signert
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 70, color: '#4caf50' }}>
                {totals.signedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <PendingIcon sx={{ color: '#ff9800' }} />
                <Typography variant="body2" color="text.secondary">
                  Venter på signatur
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 70, color: '#ff9800' }}>
                {totals.unsignedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <MoneyIcon sx={{ color: '#2196f3' }} />
                <Typography variant="body2" color="text.secondary">
                  Total inntekt
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 70, color: '#2196f3' }}>
                {formatCurrency(totals.totalPaid + totals.totalPending)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Alle Split Sheets" />
          <Tab label="Venter på signatur" />
          <Tab label="Signert" />
        </Tabs>
      </Paper>

      {/* Split Sheets List */}
      {contributorData.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <SplitSheetIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Du er ikke en del av noen split sheets ennå
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600}}>Split Sheet</TableCell>
                <TableCell sx={{ fontWeight: 600}}>Din prosent</TableCell>
                <TableCell sx={{ fontWeight: 600}}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600}}>Signatur</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600}}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contributorData
                .filter(({ contributor }) => {
                  if (tabValue === 1) return !contributor?.signed_at;
                  if (tabValue === 2) return !!contributor?.signed_at;
                  return true;
                })
                .map(({ sheet, contributor, myPercentage }) => (
                  <TableRow key={sheet.id} hover>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600}}>
                        {sheet.title}
                      </Typography>
                      {sheet.description && (
                        <Typography variant="caption" color="text.secondary">
                          {sheet.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600}}>
                        {myPercentage.toFixed(2)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_NAMES[sheet.status]}
                        size="small"
                        sx={{
                          bgcolor: `${STATUS_COL[sheet.status]}20`,
                          color: STATUS_COL[sheet.status]
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {contributor?.signed_at ? (
                        <Chip
                          icon={<SignedIcon />}
                          label="Signert"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={<PendingIcon />}
                          label="Ikke signert"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          // Navigate to view split sheet
                          window.location.href = `/split-sheets/${sheet.id}`;
                        }}
                      >
                        Vis
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}























