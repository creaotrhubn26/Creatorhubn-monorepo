// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  SettingsOutlined,
  Security,
  Group,
  Store,
  BarChart,
  Warning,
  TrendingUp as TimelineIcon,
} from '@mui/icons-material';
import { useQuery } from "@tanstack/react-query";

export default function AdminDashboardWithCustomization() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  // Real authentication check
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/current-user', ],
    retry: false,
});

  const isAuthenticated = currentUser?.email === 'daniel@creatorhubn.com';

  // Fetch admin data
  const { data: platformStats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/platform-stats']
});
  const { data: userStats = {}, isLoading: userStatsLoading } = useQuery({
    queryKey: ['/api/admin/user-stats']
});
  const { data: systemHealth = {}, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/admin/system-health']
});
  
  // Calculate admin statistics - 100% real data
  const stats = {
    totalUsers: userStats?.totalUsers || 0,
    activeUsers: userStats?.activeUsers || 0,
    totalVendors: platformStats?.totalVendors || 0,
    systemUptime: systemHealth?.uptime || '0, %',
    activeFeatures: platformStats?.activeFeatures || 0,
    monthlyRevenue: platformStats?.monthlyRevenue || 0 };
  
  // Loading state
  if (statsLoading || userStatsLoading || healthLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={60} />
      </Box>
    );
}

  // Security check
  if (!isAuthenticated) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Alert severity="error" sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          {theming.getThemedIcon('security')}
          Tilgang nektet. Du må være logget inn som administrator for å se denne siden.
        </Alert>
      </Box>
    );
}

  return (
    <Box sx={{ p:  3, maxWidth: 120, mx: 'auto'}}>
      <Typography variant="h4" gutterBottom sx={{  
        color: '#2196F0', 
        fontWeight: 60
       , display: 'flex',
        alignItems: 'center',
        gap:  1,
        mb: 3  }}>
        {theming.getThemedIcon('security')}
        Admin Dashboard - CreatorHub Norge
      </Typography>

      {/* Platform Overview Stats */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)',
            color: 'white',
            textAlign: 'center'
      }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Group sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {stats.totalUsers}
              </Typography>
              <Typography variant="body2">
                Totale Brukere
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8}}>
                +{stats.activeUsers} aktive
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
            color: 'white',
            textAlign: 'center'
      }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Store sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {stats.totalVendors}
              </Typography>
              <Typography variant="body2">
                Leverandører
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
            color: 'white',
            textAlign: 'center'
      }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <TimelineIcon sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {stats.systemUptime}
              </Typography>
              <Typography variant="body2">
                System Oppetid
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard sx={{ 
            background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
            color: 'white',
            textAlign: 'center'
      }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <SettingsOutlined sx={{ fontSize:  40, mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 700 }}>
                {stats.activeFeatures}
              </Typography>
              <Typography variant="body2">
                Aktive Funksjoner
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Admin Actions */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('group')}
                Brukerstyring
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                Administrer brukere, roller og tilgangskontroll
              </Typography>
              <Button variant="contained" 
                startIcon={theming.getThemedIcon('group')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196F3, #21CBF3)',
                  mr: 1 }}
               sx={theming.getThemedButtonSx()}>
                Brukeradministrasjon
              </Button>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <BarChart />
                Rapporter og Analytics
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                Se detaljerte rapporter og plattform analytics
              </Typography>
              <Button variant="contained" 
                startIcon={<BarChart />}
                sx={{ 
                  background: 'linear-gradient(135deg, #ff9800, #ffb74d)',
                  mr: 1 }}
              >
                Se Rapporter
              </Button>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <SettingsOutlined />
                Systemkonfigurasjon
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                Administrer plattforminstillinger og konfigurasjoner
              </Typography>
              <Button variant="contained" 
                startIcon={<SettingsOutlined />}
                sx={{ 
                  background: 'linear-gradient(135deg, #4caf50, #81c784)',
                  mr: 1 }}
              >
                Systeminnstillinger
              </Button>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} md={6}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                {theming.getThemedIcon('security')}
                Sikkerhet og Overvåkning
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                Overvåk sikkerhetsstatus og systemhelse
              </Typography>
              <Button variant="contained" 
                startIcon={theming.getThemedIcon('security')}
                sx={{ 
                  background: 'linear-gradient(135deg, #9c27b0, #ba68c8)',
                  mr: 1 }}
               sx={theming.getThemedButtonSx()}>
                Sikkerhetskontroll
              </Button>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>
    </Box>
  );
}