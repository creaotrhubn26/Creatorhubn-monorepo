import { useTheming } from '../../utils/theming-helper';
import * as React from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '../../lib/queryClient';
import GoogleAnalyticsDashboard from './GoogleAnalyticsDashboardEnhanced';
import SEOBotAnalyticsDashboard from './SEOBotAnalyticsDashboard';
import BillingAnalytics from './BillingAnalytics';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  IconButton,
  Alert,
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  TrendingDown,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  Group,
  AttachMoney,
  Star,
  Person,
  Dashboard,
  Email,
  Analytics,
  School,
  MonetizationOn,
  AccountBalance,
  EmojiEvents,
  CheckCircle,
} from '@mui/icons-material';

interface AdminStatsProps {
  userEmail?: string;
  isAdmin?: boolean;
}

interface PlatformStats {
  totalUsers: { current: number; previous: number };
  activeProjects: { current: number; previous: number };
  totalRevenue: { current: number; previous: number };
  newSignups: { current: number; previous: number };
  professionBreakdown: {
    photographer: number;
    videographer: number;
    musicproducer: number;
    vendor: number;
};
  systemHealth: {
    uptime: number;
    responseTime: number;
    errorRate: number;
};
}

const formatValue = (value: number, format: string): string => {
  switch (format) {
    case 'currency':
      return `${value.toLocaleString('nb-NO')} kr`;
    case 'percentage':
      return `${value}%`;
    case 'time':
      return `${value}ms`;
    default: return value.toLocaleString('nb-NO');
}
};

const calculateTrend = (current: number, previous: number): { percentage: number; isPositive: boolean } => {
  if (previous === 0) return { percentage: 0, isPositive: true };
  const percentage = ((current - previous) / previous) * 100;
  return { percentage: Math.abs(percentage), isPositive: percentage >= 0 };
};

export default function AdminStats({ userEmail, isAdmin = false }: AdminStatsProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Theming system
  const theming = useTheming('prototype_tester');

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();
  const canAccessAdminStats = Boolean(isAdmin);

  const handleCardClick = (metric: string) => {
    setSelectedMetric(metric);
    setDetailDialogOpen(true);
};

  const handleCloseDialog = () => {
    setDetailDialogOpen(false);
    setSelectedMetric(null);
};

  // Fetch platform-wide stats - SANNTID OPPDATERING
  const { data: platformStats, isLoading } = useQuery({
    queryKey: ['/api/admin/platform-stats'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/platform-stats', { headers });
    },
    enabled: canAccessAdminStats,
    refetchInterval: 5000, // ✅ SANNTID: Oppdater hver 5. sekund
    staleTime: 0 // ✅ Alltid hent ferske data
});

  // Fetch enhanced dashboard with enterprise data - SANNTID
  const { data: dashboardData } = useQuery({
    queryKey: ['/api/admin/dashboard'],
    refetchInterval: 10000,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/dashboard', { headers });
    },
    enabled: canAccessAdminStats,
    staleTime: 0
  });

  // Fetch profession-specific stats for admin overview - SANNTID
  const { data: professionStats } = useQuery({
    queryKey: ['/api/admin/profession-stats'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/profession-stats', { headers });
    },
    enabled: canAccessAdminStats,
    refetchInterval: 8000, // ✅ SANNTID: Oppdater hver 8. sekund
    staleTime: 0
  });

  // Fetch Academy revenue stats - SANNTID
  const { data: academyRevenue } = useQuery({
    queryKey: ['/api/academy/admin/revenue/overview'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/academy/admin/revenue/overview', { headers });
    },
    enabled: canAccessAdminStats,
    refetchInterval: 10000, // ✅ SANNTID: Oppdater hver 10. sekund
    staleTime: 0
  });

  // Fetch Academy analytics - SANNTID
  const { data: academyStats } = useQuery({
    queryKey: ['/api/admin/academy/analytics/overview'],
    queryFn: async () => {
      const response = await fetch('/api/admin/academy/analytics/overview');
      if (!response.ok) throw new Error('Failed to fetch academy stats');
      return response.json();
    },
    enabled: canAccessAdminStats,
    refetchInterval: 10000, // ✅ SANNTID: Oppdater hver 10. sekund
    staleTime: 0
  });

  // ✅ Fetch real-time email conversion stats
  const { data: emailConversionStats } = useQuery({
    queryKey: ['/api/admin/email-conversion-stats'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/email-conversion-stats', { headers });
    },
    enabled: canAccessAdminStats,
    refetchInterval: 5000, // ✅ REAL-TIME: Update every 5 seconds
    staleTime: 0
  });

  // Fetch Role Room live stats for the admin dashboard
  const { data: roleRoomStats } = useQuery({
    queryKey: ['/api/role-room/admin/stats'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/role-room/admin/stats', { headers }) as Promise<{
        kreative: number;
        produksjoner: number;
        rollerBesatt: number;
        kandidater: number;
        marketplaceInstalls: number;
        activeApiKeys: number;
        recentProjects: { id: string; name: string; status: string; created_at: string }[];
        professionBreakdown: { role: string; n: number }[];
      }>;
    },
    enabled: canAccessAdminStats,
    refetchInterval: 15000,
    staleTime: 0,
  });

  if (!canAccessAdminStats) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info" sx={{ borderRadius: '18px' }}>
          Adminstatistikk blir tilgjengelig når admin-sesjonen er ferdig synkronisert.
        </Alert>
        {userEmail ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Pålogget som: {userEmail}
          </Typography>
        ) : null}
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2, color: theming.colors.primary }}>
          <Assessment sx={{ color: '#ff8c00' }} />
          Plattform Statistikk (Admin)
        </Typography>
        <Grid container spacing={3}>
          {[135, 6].map((index) => (
            <Grid xs={12} md={6} lg={4} key={index}>
              <MuiCard>
                <CardContent sx={theming.getThemedCardSx()}>
                  <LinearProgress />
                </CardContent>
              </MuiCard>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
}

  const stats = platformStats as PlatformStats;
  const totalUsersTrend = stats ? calculateTrend(stats.totalUsers?.current || 0, stats.totalUsers?.previous || 0) : { percentage: 0, isPositive: true };
  const activeProjectsTrend = stats ? calculateTrend(stats.activeProjects?.current || 0, stats.activeProjects?.previous || 0) : { percentage: 0, isPositive: true };
  const revenueTrend = stats ? calculateTrend(stats.totalRevenue?.current || 0, stats.totalRevenue?.previous || 0) : { percentage: 0, isPositive: true };
  const activeInsightSources = [
    stats,
    dashboardData?.dashboard?.quickStats,
    roleRoomStats,
    emailConversionStats,
    academyRevenue,
    academyStats,
    professionStats,
  ].filter(Boolean).length;
  const hasAnyInsightData = activeInsightSources > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          mb: 4,
          px: { xs: 2, md: 2.5 },
          py: { xs: 2.25, md: 2.75 },
          borderRadius: '24px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          background:
            'linear-gradient(135deg, rgba(255, 248, 237, 0.96), rgba(255, 255, 255, 0.98))',
          boxShadow: '0 18px 42px rgba(27, 21, 12, 0.05)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Assessment sx={{ color: '#ff8c00', fontSize: 30 }} />
          <Box>
            <Typography
              sx={{
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#8b5e34',
                fontWeight: 700,
              }}
            >
              Admin Intelligence
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
              Plattformstatistikk
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ color: '#6b6257', maxWidth: 880 }}>
          Live-tall for CreatorHub, The Role Room og Academy samles her når datakildene er
          tilgjengelige. Bruk denne flaten for å sjekke drift, inntekter og aktivitet før du går
          videre til detaljpanelene.
        </Typography>
        <Box sx={{ mt: 1.75, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label="Full admin-tilgang"
            size="small"
            sx={{ bgcolor: '#fff4e5', color: '#8c4d00', fontWeight: 700 }}
          />
          <Chip
            label={`${activeInsightSources} datakilder aktive`}
            size="small"
            sx={{ bgcolor: '#ecfdf5', color: '#0f766e', fontWeight: 700 }}
          />
          {userEmail ? (
            <Chip
              label={userEmail}
              size="small"
              sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
            />
          ) : null}
        </Box>
      </Box>

      {!hasAnyInsightData ? (
        <Alert severity="info" sx={{ mb: 4, borderRadius: '18px' }}>
          Ingen admindata er tilgjengelig akkurat nå. Dette betyr vanligvis at en eller flere
          datakilder ikke har svart ennå, ikke at Daniel mangler admin-tilgang.
        </Alert>
      ) : null}

      {/* Enterprise KPIs */}
      {dashboardData?.dashboard?.quickStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid xs={12} md={6} lg={3}>
            <MuiCard sx={{ height: '100%', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }, border: '2px solid #ff8c00' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#ff8c0020', color: '#ff8c00', width: 48, height: 48 }}>
                    {theming.getThemedIcon('group')}
                  </Avatar>
                  <Chip size="small" label="Enterprise" color="warning" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                  {dashboardData.dashboard.quickStats.totalCustomers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total CRM Kunder
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <MuiCard sx={{ height: '100%', transition: 'all 0.3s ease','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }, border: '2px solid #4caf50' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#4caf5020', color: '#4caf50', width: 48, height: 48 }}>
                    {theming.getThemedIcon('money')}
                  </Avatar>
                  <Chip size="small" label="Enterprise" color="success" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                  {dashboardData.dashboard.quickStats.totalRevenue} kr
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enterprise Omsetning
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <MuiCard sx={{ height: '100%', transition: 'all 0.3s ease','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }, border: '2px solid #2196f3' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#2196f320', color: '#2196f3', width: 48, height: 48 }}>
                    {theming.getThemedIcon('trendingUp')}
                  </Avatar>
                  <Chip size="small" label="Enterprise" color="primary" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                  {dashboardData.dashboard.quickStats.activeDeals}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Aktive Deals
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <MuiCard sx={{ height: '100%', transition: 'all 0.3s ease','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }, border: '2px solid #9c27b0' }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#9c27b020', color: '#9c27b0', width: 48, height: 48 }}>
                    {theming.getThemedIcon('star')}
                  </Avatar>
                  <Chip size="small" label="Enterprise" color="secondary" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                  {dashboardData.dashboard.quickStats.activeSubscriptions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Aktive Abonnement
                </Typography>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>
      )}

      {/* Subscriber Statistics Panel */}
      <Box sx={{ mb: 4 }}>
        <div>
          {/* SubscriberStatsPanel temporarily disabled - component returns void */}
          <div>Subscriber Statistics Panel</div>
        </div>
      </Box>

      {/* Email Conversion Tracking (Real-time) */}
      {emailConversionStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid xs={12}>
            <MuiCard sx={{ border: '2px solid #ea4335' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Email sx={{ color: '#ea4335', fontSize: 32 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                      Email Conversion Tracking (Real-Time)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last 30 days • Updates every 5 seconds
                    </Typography>
                  </Box>
                  <Chip 
                    label="LIVE" 
                    size="small" 
                    color="error"
                    sx={{ animation: 'pulse 2s infinite', fontWeight: 'bold' }}
                  />
                </Box>
                
                <Grid container spacing={2}>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#2196f310', borderRadius: 1 }}>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                        {emailConversionStats.totalSent || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Emails Sent
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#4caf5010', borderRadius: 1 }}>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                        {emailConversionStats.avgOpenRate || '0'}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Open Rate
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#ff980010', borderRadius: 1 }}>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                        {emailConversionStats.avgClickRate || '0'}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Click Rate
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#9c27b010', borderRadius: 1 }}>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#9c27b0' }}>
                        {emailConversionStats.avgConversionRate || '0'}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Conversion Rate
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>
      )}

      {/* ─────────────── THE ROLE ROOM STATS ─────────────── */}
      <Box sx={{ mb: 4 }}>
        <MuiCard sx={{ border: '1.5px solid rgba(130,110,255,0.35)', background: 'linear-gradient(135deg, rgba(130,110,255,0.04) 0%, transparent 60%)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar
                src="/role-room-assets/landing_logo.webp"
                sx={{ width: 40, height: 40, bgcolor: 'rgba(130,110,255,0.15)', border: '1px solid rgba(130,110,255,0.3)' }}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'rgba(190,175,255,0.95)' }}>
                  The Role Room
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Live DB-tall • oppdateres hvert 15. sek
                </Typography>
              </Box>
              <Chip label="LIVE" size="small" color="secondary" sx={{ fontWeight: 700 }} />
            </Box>

            {/* KPI row */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                { label: 'Kreative brukere',    value: roleRoomStats?.kreative,            color: '#8a6eff', icon: <Group /> },
                { label: 'Produksjoner',         value: roleRoomStats?.produksjoner,        color: '#e064e0', icon: <Assessment /> },
                { label: 'Roller besatt',        value: roleRoomStats?.rollerBesatt,        color: '#50d68a', icon: <TrendingUp /> },
                { label: 'Kandidater',           value: roleRoomStats?.kandidater,          color: '#60b4ff', icon: <Person /> },
                { label: 'Marketplace-install.',  value: roleRoomStats?.marketplaceInstalls, color: '#ffb048', icon: <Store /> },
                { label: 'Aktive API-nøkler',   value: roleRoomStats?.activeApiKeys,       color: '#ff6b6b', icon: <CheckCircle /> },
              ].map(({ label, value, color, icon }) => (
                <Grid xs={12} sm={6} md={4} xl={2} key={label}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: `${color}12`,
                      border: `1px solid ${color}33`,
                      textAlign: 'center',
                    }}
                  >
                    <Box sx={{ color, mb: 0.5, display: 'flex', justifyContent: 'center' }}>{icon}</Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, color, lineHeight: 1.1 }}>
                      {value !== undefined ? value.toLocaleString('nb-NO') : <LinearProgress sx={{ mt: 1 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {label}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Recent projects */}
            {roleRoomStats?.recentProjects && roleRoomStats.recentProjects.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'text.secondary', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                  Siste produksjoner
                </Typography>
                <TableContainer component={Paper} sx={{ bgcolor: 'rgba(130,110,255,0.04)', border: '1px solid rgba(130,110,255,0.12)' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>Navn</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>Status</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>Opprettet</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {roleRoomStats.recentProjects.map((p) => (
                        <TableRow key={p.id} sx={{ '&:hover': { bgcolor: 'rgba(130,110,255,0.06)' } }}>
                          <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={p.status}
                              size="small"
                              sx={{
                                bgcolor: p.status === 'active' ? 'rgba(80,214,138,0.15)' : 'rgba(130,110,255,0.15)',
                                color:   p.status === 'active' ? '#50d68a' : 'rgba(190,175,255,0.85)',
                                fontWeight: 600,
                                fontSize: '0.68rem',
                                height: 20,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                            {new Date(p.created_at).toLocaleDateString('nb-NO')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </CardContent>
        </MuiCard>
      </Box>

      {/* Google Analytics 4 Dashboard - FULL CONTROL */}
      <Box sx={{ mb: 4 }}>
        <GoogleAnalyticsDashboard />
      </Box>

      {/* SEO Bot Detection & Analytics Dashboard */}
      <Box sx={{ mb: 4 }}>
        <SEOBotAnalyticsDashboard />
      </Box>

      {/* Billing & Subscription Analytics */}
      <Box sx={{ mb: 4 }}>
        <MuiCard>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2, color: theming.colors.primary, mb: 3 }}>
              <MonetizationOn sx={{ color: '#4caf50' }} />
              Abonnement & Refundering Analytics
            </Typography>
            <BillingAnalytics compact={false} />
          </CardContent>
        </MuiCard>
      </Box>

      {/* Academy Analytics Dashboard */}
      {academyStats && (
        <Box sx={{ mb: 4 }}>
          <MuiCard>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2, color: theming.colors.primary, mb: 3 }}>
                <School sx={{ color: '#ff8c00' }} />
                CreatorHub Academy - Statistikk
              </Typography>

              <Grid container spacing={3}>
                {/* Total Courses */}
                <Grid xs={12} sm={6} md={3}>
                  <MuiCard sx={{
                    height: '100%',
                    bgcolor: '#fff3e0',
                    border: '2px solid #ff8c00',
                    transition: 'all 0.3s ease','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Avatar sx={{ bgcolor: '#ff8c00', width: 48, height: 48 }}>
                          <School />
                        </Avatar>
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#ff8c00', mb: 1 }}>
                        {academyStats.totalCourses || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600}}>
                        Totale Kurs
                      </Typography>
                    </CardContent>
                  </MuiCard>
                </Grid>

                {/* Published Courses */}
                <Grid xs={12} sm={6} md={3}>
                  <MuiCard sx={{
                    height: '100%',
                    bgcolor: '#e8f5e9',
                    border: '2px solid #4caf50',
                    transition: 'all 0.3s ease','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Avatar sx={{ bgcolor: '#4caf50', width: 48, height: 48 }}>
                          <CheckCircle />
                        </Avatar>
                        <Chip
                          label={`${academyStats.totalCourses > 0 ? Math.round((academyStats.publishedCourses / academyStats.totalCourses) * 100) : 0}%`}
                          size="small"
                          color="success"
                        />
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#4caf50', mb: 1 }}>
                        {academyStats.publishedCourses || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600}}>
                        Publiserte Kurs
                      </Typography>
                    </CardContent>
                  </MuiCard>
                </Grid>

                {/* Total Enrollments */}
                <Grid xs={12} sm={6} md={3}>
                  <MuiCard sx={{
                    height: '100%',
                    bgcolor: '#e3f2fd',
                    border: '2px solid #2196f3',
                    transition: 'all 0.3s ease','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Avatar sx={{ bgcolor: '#2196f3', width: 48, height: 48 }}>
                          <Group />
                        </Avatar>
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#2196f3', mb: 1 }}>
                        {academyStats.totalEnrollments || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600}}>
                        Totale Påmeldinger
                      </Typography>
                    </CardContent>
                  </MuiCard>
                </Grid>

                {/* Total Instructors */}
                <Grid xs={12} sm={6} md={3}>
                  <MuiCard sx={{
                    height: '100%',
                    bgcolor: '#f3e5f5',
                    border: '2px solid #9c27b0',
                    transition: 'all 0.3s ease','&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Avatar sx={{ bgcolor: '#9c27b0', width: 48, height: 48 }}>
                          <EmojiEvents />
                        </Avatar>
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#9c27b0', mb: 1 }}>
                        {academyStats.totalInstructors || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600}}>
                        Aktive Instruktører
                      </Typography>
                    </CardContent>
                  </MuiCard>
                </Grid>
              </Grid>

              {/* Academy Quick Actions */}
              <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<School />}
                  sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
                  onClick={() => window.location.href = '/admin#academy'}
                >
                  Administrer Kurs
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Analytics />}
                  sx={{ borderColor: '#ff8c00', color: '#ff8c00','&:hover': { borderColor: '#e67e00', bgcolor: '#fff3e0' } }}
                >
                  Detaljert Analyse
                </Button>
              </Box>
            </CardContent>
          </MuiCard>
        </Box>
      )}

      {/* Platform Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} md={6} lg={3}>
          <MuiCard 
            sx={{ 
              height: '100%', 
              transition: 'all 0.3s ease', 
              cursor: 'pointer','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
          }}
            onClick={() => handleCardClick('users')}
          >
            <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#2196f320', color: '#2196f3', width: 48, height: 48 }}>
                  {theming.getThemedIcon('person')}
                </Avatar>
                {totalUsersTrend && (
                  <Chip
                    icon={totalUsersTrend.isPositive ? <TrendingUp /> : <TrendingDown />}
                    label={`${totalUsersTrend.isPositive ? '+' : '-'}${totalUsersTrend.percentage.toFixed(1)}%`}
                    size="small"
                    color={totalUsersTrend.isPositive ? "success" : "error"}
                    variant="outlined"
                  />
                )}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                {stats?.totalUsers?.current || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Brukere
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid xs={12} md={6} lg={3}>
          <MuiCard 
            sx={{ 
              height: '100%', 
              transition: 'all 0.3s ease', 
              cursor: 'pointer','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
          }}
            onClick={() => handleCardClick('projects')}
          >
            <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#ff8c0020', color: '#ff8c00', width: 48, height: 48 }}>
                  <Dashboard />
                </Avatar>
                {activeProjectsTrend && (
                  <Chip
                    icon={activeProjectsTrend.isPositive ? <TrendingUp /> : <TrendingDown />}
                    label={`${activeProjectsTrend.isPositive ? '+' : '-'}${activeProjectsTrend.percentage.toFixed(1)}%`}
                    size="small"
                    color={activeProjectsTrend.isPositive ? "success" : "error"}
                    variant="outlined"
                  />
                )}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                {stats?.activeProjects?.current || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Prosjekter
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid xs={12} md={6} lg={3}>
          <MuiCard 
            sx={{ 
              height: '100%', 
              transition: 'all 0.3s ease', 
              cursor: 'pointer','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
          }}
            onClick={() => handleCardClick('revenue')}
          >
            <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Avatar sx={{ bgcolor: '#4caf5020', color: '#4caf50', width: 48, height: 48 }}>
                  {theming.getThemedIcon('money')}
                </Avatar>
                {revenueTrend && (
                  <Chip
                    icon={revenueTrend.isPositive ? <TrendingUp /> : <TrendingDown />}
                    label={`${revenueTrend.isPositive ? '+' : '-'}${revenueTrend.percentage.toFixed(1)}%`}
                    size="small"
                    color={revenueTrend.isPositive ? "success" : "error"}
                    variant="outlined"
                  />
                )}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                {formatValue(stats?.totalRevenue?.current || 0, 'currency')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Plattform Inntekt
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid xs={12} md={6} lg={3}>
          <MuiCard 
            sx={{ 
              height: '100%', 
              transition: 'all 0.3s ease', 
              cursor: 'pointer','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
          }}
            onClick={() => handleCardClick('subscriptions')}
          >
            <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Avatar sx={{ bgcolor: '#9c27b020', color: '#9c27b0', width: 48, height: 48 }}>
                  {theming.getThemedIcon('group')}
                </Avatar>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                {dashboardData?.dashboard?.quickStats?.activeSubscriptions || stats?.newSignups?.current || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aktive Abonnement
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Academy Revenue Section */}
      {academyRevenue && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2, color: theming.colors.primary, mb: 3 }}>
            <School sx={{ color: '#ff8c00', fontSize: 32 }} />
            Academy Inntektsstatistikk
          </Typography>
          
          <Grid container spacing={3}>
            {/* Total Students */}
            <Grid xs={12} md={6} lg={2.4}>
              <MuiCard 
                sx={{ 
                  height: '100%', 
                  transition: 'all 0.3s ease', 
                  cursor: 'pointer',
                  border: '2px solid #9c27b0','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
              }}
                onClick={() => handleCardClick('academy_students')}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#9c27b020', color: '#9c27b0', width: 48, height: 48 }}>
                      <Group />
                    </Avatar>
                    <Chip size="small" label="Studenter" sx={{ bgcolor: '#9c27b0', color: 'white' }} />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                    {academyRevenue.totalStudents || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unike Studenter
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    {academyRevenue.totalEnrollments || 0} påmeldinger
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>

            {/* Total Instructors */}
            <Grid xs={12} md={6} lg={2.4}>
              <MuiCard 
                sx={{ 
                  height: '100%', 
                  transition: 'all 0.3s ease', 
                  cursor: 'pointer',
                  border: '2px solid #e91e63','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
              }}
                onClick={() => handleCardClick('academy_instructors')}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#e91e6320', color: '#e91e63', width: 48, height: 48 }}>
                      <Person />
                    </Avatar>
                    <Chip size="small" label="Instruktører" sx={{ bgcolor: '#e91e63', color: 'white' }} />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                    {academyRevenue.totalInstructors || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive Instruktører
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    {academyRevenue.activeCourses || 0} aktive kurs
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>

            {/* Total Academy Revenue */}
            <Grid xs={12} md={6} lg={2.4}>
              <MuiCard 
                sx={{ 
                  height: '100%', 
                  transition: 'all 0.3s ease', 
                  cursor: 'pointer',
                  border: '2px solid #ff8c00','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
              }}
                onClick={() => handleCardClick('academy_revenue')}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#ff8c0020', color: '#ff8c00', width: 48, height: 48 }}>
                      <School />
                    </Avatar>
                    <Chip size="small" label="Academy" sx={{ bgcolor: '#ff8c00', color: 'white' }} />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                    {formatValue(academyRevenue.totalRevenue || 0, 'currency')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Academy Omsetning
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    Platform: {formatValue(academyRevenue.totalPlatformRevenue || 0, 'currency')}
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>

            {/* Platform Fee from Academy */}
            <Grid xs={12} md={6} lg={2.4}>
              <MuiCard 
                sx={{ 
                  height: '100%', 
                  transition: 'all 0.3s ease', 
                  cursor: 'pointer',
                  border: '2px solid #4caf50','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
              }}
                onClick={() => handleCardClick('academy_platform_fee')}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#4caf5020', color: '#4caf50', width: 48, height: 48 }}>
                      <MonetizationOn />
                    </Avatar>
                    <Chip size="small" label="Plattform" color="success" />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                    {formatValue(academyRevenue.totalPlatformRevenue || 0, 'currency')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Plattformavgift (15-20%)
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    {academyRevenue.totalPlatformRevenue && academyRevenue.totalRevenue 
                      ? `${((academyRevenue.totalPlatformRevenue / academyRevenue.totalRevenue) * 100).toFixed(1)}% av omsetning`
                      : '0%'}
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>

            {/* Instructor Revenue - REMOVED, shown in detail dialog instead */}
            {/* Pending Payouts */}
            <Grid xs={12} md={6} lg={2.4}>
              <MuiCard 
                sx={{ 
                  height: '100%', 
                  transition: 'all 0.3s ease', 
                  cursor: 'pointer',
                  border: '2px solid #ff9800','&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }
              }}
                onClick={() => handleCardClick('academy_payouts')}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#ff980020', color: '#ff9800', width: 48, height: 48 }}>
                      <AccountBalance />
                    </Avatar>
                    <Chip 
                      size="small" 
                      label={academyRevenue.pendingPayouts || 0} 
                      color="warning"
                    />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary, mb: 1 }}>
                    {formatValue(academyRevenue.pendingPayoutAmount || 0, 'currency')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ventende Utbetalinger
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'warning.main' }}>
                    {academyRevenue.pendingPayouts || 0} forespørsler
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Profession Breakdown */}
      <MuiCard sx={{ mb: 4 }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            {theming.getThemedIcon('assessment')}
            Profesjonsfordeling
          </Typography>
          <Grid container spacing={3}>
            <Grid xs={12} md={3}>
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  p: 2, 
                  bgcolor: '#ff8c0010', 
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease','&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: 3,
                    bgcolor: '#ff8c0020'
              }
              }}
                onClick={() => handleCardClick('photographer')}
              >
                <PhotoCamera sx={{ fontSize: 48, color: '#ff8c00', mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  {stats?.professionBreakdown?.photographer || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fotografer
                </Typography>
              </Box>
            </Grid>
            <Grid xs={12} md={3}>
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  p: 2, 
                  bgcolor: '#e74c3c10', 
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease','&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: 3,
                    bgcolor: '#e74c3c20'
              }
              }}
                onClick={() => handleCardClick('videographer')}
              >
                <Videocam sx={{ fontSize: 48, color: '#e74c3c', mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  {stats?.professionBreakdown?.videographer || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Videografer
                </Typography>
              </Box>
            </Grid>
            <Grid xs={12} md={3}>
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  p: 2, 
                  bgcolor: '#9b59b610', 
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease','&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: 3,
                    bgcolor: '#9b59b620'
              }
              }}
                onClick={() => handleCardClick('musicproducer')}
              >
                <LibraryMusic sx={{ fontSize: 48, color: '#9b59b6', mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  {stats?.professionBreakdown?.musicproducer || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Musikkprodusenter
                </Typography>
              </Box>
            </Grid>
            <Grid xs={12} md={3}>
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  p: 2, 
                  bgcolor: '#27ae6010', 
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease','&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: 3,
                    bgcolor: '#27ae6020'
              }
              }}
                onClick={() => handleCardClick('vendor')}
              >
                <Store sx={{ fontSize: 48, color: '#27ae60', mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  {stats?.professionBreakdown?.vendor || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Leverandører
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </MuiCard>

      {/* System Health */}
      <MuiCard>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            {theming.getThemedIcon('assessment')}
            Systemhelse
          </Typography>
          <Grid container spacing={3}>
            <Grid xs={12} md={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Oppetid
              </Typography>
              <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {formatValue(stats?.systemHealth?.uptime || 99.9, 'percentage')}
              </Typography>
            </Grid>
            <Grid xs={12} md={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Gjennomsnittlig Responstid
              </Typography>
              <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 600}}>
                {formatValue(stats?.systemHealth?.responseTime || 120, 'time')}
              </Typography>
            </Grid>
            <Grid xs={12} md={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Feilrate
              </Typography>
              <Typography variant="h6" sx={{ color: (stats?.systemHealth?.errorRate || 0) > 1 ? '#f44336' : '#4caf50', fontWeight: 600}}>
                {formatValue(stats?.systemHealth?.errorRate || 0.1, 'percentage')}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </MuiCard>

      {/* Detail Dialog */}
      <Dialog 
        open={detailDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedMetric === 'users' && (
                <>
                  <Group sx={{ color: '#2196f3' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Brukerstatistikk</Typography>
                </>
              )}
              {selectedMetric === 'projects' && (
                <>
                  <Dashboard sx={{ color: '#ff8c00' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Prosjektstatistikk</Typography>
                </>
              )}
              {selectedMetric === 'revenue' && (
                <>
                  <AttachMoney sx={{ color: '#4caf50' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Inntektsstatistikk</Typography>
                </>
              )}
              {selectedMetric === 'subscriptions' && (
                <>
                  <Star sx={{ color: '#9c27b0' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Abonnementsstatistikk</Typography>
                </>
              )}
              {selectedMetric === 'photographer' && (
                <>
                  <PhotoCamera sx={{ color: '#ff8c00' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Fotografer Statistikk</Typography>
                </>
              )}
              {selectedMetric === 'videographer' && (
                <>
                  <Videocam sx={{ color: '#e74c3c' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Videografer Statistikk</Typography>
                </>
              )}
              {selectedMetric === 'musicproducer' && (
                <>
                  <LibraryMusic sx={{ color: '#9b59b6' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Musikkprodusenter Statistikk</Typography>
                </>
              )}
              {selectedMetric === 'vendor' && (
                <>
                  <Store sx={{ color: '#27ae60' }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Detaljert Leverandører Statistikk</Typography>
                </>
              )}
            </Box>
            <IconButton onClick={handleCloseDialog}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedMetric === 'users' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Brukerinformasjon per profesjon
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Profesjon</TableCell>
                      <TableCell align="right">Antall Brukere</TableCell>
                      <TableCell align="right">Aktivitet</TableCell>
                      <TableCell align="right">Gj.snitt Rating</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PhotoCamera sx={{ color: '#ff8c00', fontSize: 20 }} />
                          Fotografer
                        </Box>
                      </TableCell>
                      <TableCell align="right">{stats?.professionBreakdown?.photographer || 0}</TableCell>
                      <TableCell align="right">{professionStats?.photographer?.activeProjects || 0} prosjekter</TableCell>
                      <TableCell align="right">{professionStats?.photographer?.avgRating || 0}/5</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Videocam sx={{ color: '#e74c3c', fontSize: 20 }} />
                          Videografer
                        </Box>
                      </TableCell>
                      <TableCell align="right">{stats?.professionBreakdown?.videographer || 0}</TableCell>
                      <TableCell align="right">{professionStats?.videographer?.activeProjects || 0} prosjekter</TableCell>
                      <TableCell align="right">{professionStats?.videographer?.avgRating || 0}/5</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LibraryMusic sx={{ color: '#9b59b6', fontSize: 20 }} />
                          Musikkprodusenter
                        </Box>
                      </TableCell>
                      <TableCell align="right">{stats?.professionBreakdown?.musicproducer || 0}</TableCell>
                      <TableCell align="right">{professionStats?.musicproducer?.activeProjects || 0} prosjekter</TableCell>
                      <TableCell align="right">{professionStats?.musicproducer?.avgRating || 0}/5</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Store sx={{ color: '#27ae60', fontSize: 20 }} />
                          Leverandører
                        </Box>
                      </TableCell>
                      <TableCell align="right">{stats?.professionBreakdown?.vendor || 0}</TableCell>
                      <TableCell align="right">{professionStats?.vendor?.activeProjects || 0} prosjekter</TableCell>
                      <TableCell align="right">{professionStats?.vendor?.avgRating || 0}/5</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {selectedMetric === 'projects' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Prosjektanalyse per profesjon
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Assessment sx={{ color: '#ff8c00' }} />
                      Prosjektfordeling
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#ff8c0020' }}>
                            <PhotoCamera sx={{ color: '#ff8c00' }} />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                          primary="Fotoprosjekter" 
                          secondary={`${professionStats?.photographer?.activeProjects || 0} aktive`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#e74c3c20' }}>
                            <Videocam sx={{ color: '#e74c3c' }} />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                          primary="Videoprosjekter" 
                          secondary={`${professionStats?.videographer?.activeProjects || 0} aktive`}
                        />
                      </ListItem>
                    </List>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingUp sx={{ color: '#4caf50' }} />
                      Status Oversikt
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total aktive prosjekter: {stats?.activeProjects?.current || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Forrige periode: {stats?.activeProjects?.previous || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Endring: {activeProjectsTrend?.isPositive ? '+' : '-'}{activeProjectsTrend?.percentage.toFixed(1)}%
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {selectedMetric === 'revenue' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Inntektsanalyse
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700}}>
                      {formatValue(stats?.totalRevenue?.current || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total plattform inntekt
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                      <Assessment sx={{ color: '#4caf50' }} />
                      Inntektsfordeling
                    </Typography>
                    <Typography variant="body2">
                      Fotografer: {formatValue(professionStats?.photographer?.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Videografer: {formatValue(professionStats?.videographer?.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Musikkprodusenter: {formatValue(professionStats?.musicproducer?.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Leverandører: {formatValue(professionStats?.vendor?.totalRevenue || 0, 'currency')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {selectedMetric === 'subscriptions' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Abonnementsdetaljer
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700}}>
                      {dashboardData?.dashboard?.quickStats?.activeSubscriptions || stats?.newSignups?.current || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Aktive abonnement
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                      <Star sx={{ color: '#9c27b0' }} />
                      Abonnementstyper
                    </Typography>
                    <Typography variant="body2">
                      Premium: {Math.floor((dashboardData?.dashboard?.quickStats?.activeSubscriptions || 0) * 0.3)}
                    </Typography>
                    <Typography variant="body2">
                      Standard: {Math.floor((dashboardData?.dashboard?.quickStats?.activeSubscriptions || 0) * 0.5)}
                    </Typography>
                    <Typography variant="body2">
                      Basic: {Math.floor((dashboardData?.dashboard?.quickStats?.activeSubscriptions || 0) * 0.2)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {selectedMetric === 'photographer' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                <PhotoCamera sx={{ color: '#ff8c00' }} />
                Fotografer - Detaljert Oversikt
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700}}>
                      {stats?.professionBreakdown?.photographer || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Registrerte Fotografer
                    </Typography>
                    <Typography variant="body2">
                      Aktive prosjekter: {professionStats?.photographer?.activeProjects || 0}
                    </Typography>
                    <Typography variant="body2">
                      Total omsetning: {formatValue(professionStats?.photographer?.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Gj.snitt rating: {professionStats?.photographer?.avgRating || 0}/5 
                      <Star sx={{ color: '#ffc107', ml: 0.5, fontSize: 16 }} />
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                      <Assessment sx={{ color: '#ff8c00' }} />
                      Spesialiseringer
                    </Typography>
                    <Typography variant="body2">• Bryllupsfotografering</Typography>
                    <Typography variant="body2">• Portrettfotografering</Typography>
                    <Typography variant="body2">• Naturfotografering</Typography>
                    <Typography variant="body2">• Produktfotografering</Typography>
                    <Typography variant="body2">• Eventfotografering</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {selectedMetric === 'videographer' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                <Videocam sx={{ color: '#e74c3c' }} />
                Videografer - Detaljert Oversikt
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700}}>
                      {stats?.professionBreakdown?.videographer || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Registrerte Videografer
                    </Typography>
                    <Typography variant="body2">
                      Aktive prosjekter: {professionStats?.videographer?.activeProjects || 0}
                    </Typography>
                    <Typography variant="body2">
                      Total omsetning: {formatValue(professionStats?.videographer?.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Gj.snitt rating: {professionStats?.videographer?.avgRating || 0}/5 
                      <Star sx={{ color: '#ffc107', ml: 0.5, fontSize: 16 }} />
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                      <Videocam sx={{ color: '#e74c3c' }} />
                      Spesialiseringer
                    </Typography>
                    <Typography variant="body2">• Bryllupsvideo</Typography>
                    <Typography variant="body2">• Bedriftsvideo</Typography>
                    <Typography variant="body2">• Dokumentarer</Typography>
                    <Typography variant="body2">• Musikkvideo</Typography>
                    <Typography variant="body2">• Drone-video</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {selectedMetric === 'musicproducer' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                <LibraryMusic sx={{ color: '#9b59b6' }} />
                Musikkprodusenter - Detaljert Oversikt
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700}}>
                      {stats?.professionBreakdown?.musicproducer || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Registrerte Musikkprodusenter
                    </Typography>
                    <Typography variant="body2">
                      Aktive prosjekter: {professionStats?.musicproducer?.activeProjects || 0}
                    </Typography>
                    <Typography variant="body2">
                      Total omsetning: {formatValue(professionStats?.musicproducer?.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Gj.snitt rating: {professionStats?.musicproducer?.avgRating || 0}/5 
                      <Star sx={{ color: '#ffc107', ml: 0.5, fontSize: 16 }} />
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                      <LibraryMusic sx={{ color: '#9b59b6' }} />
                      Spesialiseringer
                    </Typography>
                    <Typography variant="body2">• Studioinnspilling</Typography>
                    <Typography variant="body2">• Mixing & Mastering</Typography>
                    <Typography variant="body2">• Komposisjon</Typography>
                    <Typography variant="body2">• Podcast-produksjon</Typography>
                    <Typography variant="body2">• Jingle & Reklamemusikk</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {selectedMetric === 'vendor' && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                <Store sx={{ color: '#27ae60' }} />
                Leverandører - Detaljert Oversikt
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700}}>
                      {stats?.professionBreakdown?.vendor || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Registrerte Leverandører
                    </Typography>
                    <Typography variant="body2">
                      Aktive produkter: {professionStats?.vendor?.activeProjects || 0}
                    </Typography>
                    <Typography variant="body2">
                      Total omsetning: {formatValue(professionStats?.vendor?.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Gj.snitt rating: {professionStats?.vendor?.avgRating || 0}/5 
                      <Star sx={{ color: '#ffc107', ml: 0.5, fontSize: 16 }} />
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 , color: theming.colors.primary }}>
                      <Store sx={{ color: '#27ae60' }} />
                      Produktkategorier
                    </Typography>
                    <Typography variant="body2">• Kamerautstyr</Typography>
                    <Typography variant="body2">• Belysningsutstyr</Typography>
                    <Typography variant="body2">• Lydutstyr</Typography>
                    <Typography variant="body2">• Tilbehør & Ekstras</Typography>
                    <Typography variant="body2">• Software & Lisenser</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Academy Students Detail */}
          {selectedMetric === 'academy_students' && academyRevenue && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <Group sx={{ color: '#9c27b0' }} />
                Academy Studenter - Oversikt
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3, bgcolor: '#9c27b010' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      UNIKE STUDENTER
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#9c27b0', fontWeight: 700}}>
                      {academyRevenue.totalStudents || 0}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">
                      Unike personer som har kjøpt minst ett kurs
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={6}>
                  <Paper sx={{ p: 3, bgcolor: '#ff8c0010' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      TOTALE PÅMELDINGER
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#ff8c00', fontWeight: 700}}>
                      {academyRevenue.totalEnrollments || 0}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">
                      Gjennomsnitt: {academyRevenue.totalStudents > 0 
                        ? (academyRevenue.totalEnrollments / academyRevenue.totalStudents).toFixed(1) 
                        : 0} kurs per student
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  Dette viser unike studenter som har fullført en kurspåmelding. 
                  Hver student kan være påmeldt flere kurs.
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Academy Instructors Detail */}
          {selectedMetric === 'academy_instructors' && academyRevenue && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <Person sx={{ color: '#e91e63' }} />
                Academy Instruktører - Oversikt
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={4}>
                  <Paper sx={{ p: 3, bgcolor: '#e91e6310' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      AKTIVE INSTRUKTØRER
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#e91e63', fontWeight: 700}}>
                      {academyRevenue.totalInstructors || 0}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">
                      Instruktører som har tjent inntekt
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={4}>
                  <Paper sx={{ p: 3, bgcolor: '#2196f310' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      AKTIVE KURS
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700}}>
                      {academyRevenue.activeCourses || 0}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">
                      Gjennomsnitt: {academyRevenue.totalInstructors > 0 
                        ? (academyRevenue.activeCourses / academyRevenue.totalInstructors).toFixed(1) 
                        : 0} kurs per instruktør
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={4}>
                  <Paper sx={{ p: 3, bgcolor: '#4caf5010' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      INSTRUKTØRINNTEKT
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700}}>
                      {formatValue(academyRevenue.totalInstructorRevenue || 0, 'currency')}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">
                      Gjennomsnitt: {formatValue(
                        academyRevenue.totalInstructors > 0 
                          ? academyRevenue.totalInstructorRevenue / academyRevenue.totalInstructors 
                          : 0,
                        'currency'
                      )} per instruktør
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
              <Alert severity="success" sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Instruktører tjener 80-85% av kursinntektene
                </Typography>
                <Typography variant="caption" display="block">
                  Pro Plan: 80% til instruktør | Enterprise Plan: 85% til instruktør
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Dette er betydelig høyere enn konkurrenter som Udemy (50%) og Skillshare (30-50%)
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Academy Revenue Detail */}
          {selectedMetric === 'academy_revenue' && academyRevenue && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <School sx={{ color: '#ff8c00' }} />
                Academy Omsetning - Detaljert
              </Typography>
              <Grid container spacing={3}>
                <Grid xs={12} md={4}>
                  <Paper sx={{ p: 3, bgcolor: '#ff8c0010' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      TOTAL OMSETNING
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#ff8c00', fontWeight: 700}}>
                      {formatValue(academyRevenue.totalRevenue || 0, 'currency')}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      Platform (15-20%): {formatValue(academyRevenue.totalPlatformRevenue || 0, 'currency')}
                    </Typography>
                    <Typography variant="body2">
                      Instruktører (80-85%): {formatValue(academyRevenue.totalInstructorRevenue || 0, 'currency')}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={4}>
                  <Paper sx={{ p: 3, bgcolor: '#4caf5010' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      PÅMELDINGER
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700}}>
                      {academyRevenue.totalEnrollments || 0}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">
                      Totalt antall kurspåmeldinger
                    </Typography>
                  </Paper>
                </Grid>
                <Grid xs={12} md={4}>
                  <Paper sx={{ p: 3, bgcolor: '#ff980010' }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                      VENTENDE UTBETALINGER
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 700}}>
                      {academyRevenue.pendingPayouts || 0}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2">
                      Totalt beløp: {formatValue(academyRevenue.pendingPayoutAmount || 0, 'currency')}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Academy Platform Fee Detail */}
          {selectedMetric === 'academy_platform_fee' && academyRevenue && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <MonetizationOn sx={{ color: '#4caf50' }} />
                Plattformavgift - Detaljert Fordeling
              </Typography>
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  CreatorHub Norge's andel av Academy-inntekter
                </Typography>
                <Typography variant="caption" display="block">
                  Pro Plan Instructors: 20% platform fee (80% to instructor)
                </Typography>
                <Typography variant="caption" display="block">
                  Enterprise Plan Instructors: 15% platform fee (85% to instructor)
                </Typography>
              </Alert>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h5" sx={{ color: '#4caf50', fontWeight: 700, mb: 2 }}>
                  {formatValue(academyRevenue.totalPlatformRevenue || 0, 'currency')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Total plattformavgift fra Academy-kurssalg
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">
                  Dette inkluderer hosting, betalingsbehandling, support og markedsføring.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Instructor Revenue Detail */}
          {selectedMetric === 'academy_instructor_revenue' && academyRevenue && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <EmojiEvents sx={{ color: '#2196f3' }} />
                Instruktørinntekt - Totalt Utbetalt
              </Typography>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" sx={{ color: '#2196f3', fontWeight: 700, mb: 2 }}>
                  {formatValue(academyRevenue.totalInstructorRevenue || 0, 'currency')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total inntekt til instruktører (80-85% av kurssalg)
                </Typography>
              </Paper>
              <Alert severity="info">
                <Typography variant="body2">
                  Instruktører beholder 80-85% av kursinntektene. Dette motiverer kvalitetsinnhold
                  og gjør CreatorHub Academy konkurransedyktig sammenlignet med Udemy (50%) og andre plattformer.
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Pending Payouts Detail */}
          {selectedMetric === 'academy_payouts' && academyRevenue && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <AccountBalance sx={{ color: '#ff9800' }} />
                Ventende Utbetalinger - Krever Godkjenning
              </Typography>
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  {academyRevenue.pendingPayouts || 0} utbetalingsforespørsler venter på godkjenning
                </Typography>
                <Typography variant="caption" display="block">
                  Total beløp: {formatValue(academyRevenue.pendingPayoutAmount || 0, 'currency')}
                </Typography>
              </Alert>
              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<AccountBalance />}
                onClick={() => {
                  // Navigate to payout approval page
                  window.location.href = '/admin/academy/payouts';
                }}
                sx={{ ...theming.getThemedButtonSx() }}
              >
                Gå til Utbetalingsgodkjenning
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'center' }}>
                Utbetalinger behandles normalt innen 5-7 virkedager etter godkjenning
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog} variant="contained" sx={theming.getThemedButtonSx()}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
