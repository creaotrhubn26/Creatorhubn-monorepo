import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Work as WorkIcon,
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  Analytics as AnalyticsIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useAdmin } from '../../contexts/AdminContext';
import { adminAPI } from '../../lib/admin-api-client';
import { CREATOR_HUB_BRANDING } from '../../constants/CreatorHubBranding';
import { AdminLoading, AdminError, StatusChip, AdminTableContainer } from './design-system';


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

const UnifiedAdminAnalytics: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { state, refreshAnalytics, notify } = useAdmin();
  
  // Theming system
  const theming = useTheming('prototype_tester');

  // Fetch unified analytics
  const { data: analytics, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/admin/analytics/unified', ],
    queryFn: () => adminAPI.getUnifiedAnalytics(),
    staleTime: 6000,
});

  // Fetch detailed analytics for each component
  const { data: featureAnalytics } = useQuery({
    queryKey: ['/api/admin/analytics/features', ],
    queryFn: () => adminAPI.getFeatureAnalytics(),
    staleTime: 6000,
});

  const { data: userAnalytics } = useQuery({
    queryKey: ['/api/admin/analytics/users', ],
    queryFn: () => adminAPI.getUserAnalytics(),
    staleTime: 6000,
});

  const { data: professionTypeAnalytics } = useQuery({
    queryKey: ['/api/admin/analytics/profession-types', ],
    queryFn: () => adminAPI.getProfessionTypeAnalytics(),
    staleTime: 6000,
});

  const { data: productAnalytics } = useQuery({
    queryKey: ['/api/admin/analytics/products', ],
    queryFn: () => adminAPI.getProductAnalytics(),
    staleTime: 6000,
});

  const handleRefresh = async () => {
    try {
      await refetch();
      notify('Analytics refreshed successfully', 'success');
  } catch (error) {
      notify('Failed to refresh analytics', 'error');
  }
};

  const handleExport = async (
    type: 'unified' | 'features' | 'users' | 'profession-types' | 'products',
  ) => {
    try {
      const data =
        type === 'unified'
          ? {
              analytics,
              featureAnalytics,
              userAnalytics,
              professionTypeAnalytics,
              productAnalytics,
            }
          : await adminAPI.exportData(type, 'json');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-analytics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`${type} analytics exported successfully`, 'success');
  } catch (error) {
      notify(`Failed to export ${type} analytics`, 'error');
  }
};

  if (isLoading) {
    return <AdminLoading />;
}

  if (error) {
    return (
      <AdminError
        message="Failed to load analytics data. Please try again."
        onRetry={() => refetch()}
      />
    );
}

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    trend?: number;
}> = ({ title, value, icon, color, trend }) => (
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6" sx={{ color: theming.colors.primary }}>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color }}>
              {value}
            </Typography>
            {trend !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt:  1 }}>
                <TrendingUpIcon sx={{ fontSize:  16, color: trend >= 0 ? 'success.main' : 'error.main'}} />
                <Typography
                  variant="body2"
                  sx={{ color: trend >= 0 ? 'success.main' : 'error.main', ml: 0.5}}
                >
                  {trend >= 0 ? '+' : '-'}
                  {Math.abs(trend)}%
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color, opacity: 0.8}}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb:  3, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <Typography variant="h4" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <AnalyticsIcon color="primary" />
          Unified Admin Analytics
        </Typography>
        <Box sx={{ display: 'flex', gap:  1 }}>
          <Tooltip title="Refresh Analytics">
            <IconButton onClick={handleRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export All Data">
            <IconButton onClick={() => handleExport('unified')} color="primary">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overview Stats */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Features"
            value={analytics?.features?.total || 0}
            icon={<SettingsIcon sx={{ fontSize: 40}} />}
            color={CREATOR_HUB_BRANDING.colors.PHOTOGRAPHY}
            trend={featureAnalytics?.trend || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Users"
            value={analytics?.users?.active || 0}
            icon={<PeopleIcon sx={{ fontSize: 40}} />}
            color="#4caf50"
            trend={userAnalytics?.trend || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Profession Types"
            value={analytics?.professionTypes?.active || 0}
            icon={<WorkIcon sx={{ fontSize: 40}} />}
            color="#2196f3"
            trend={professionTypeAnalytics?.trend || 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Revenue"
            value={`${analytics?.revenue?.total || 0} NOK`}
            icon={<MoneyIcon sx={{ fontSize: 40}} />}
            color="#9c27b0"
            trend={analytics?.revenue?.trend || 0}
          />
        </Grid>
      </Grid>

      {/* Detailed Analytics Tabs */}
      <Card sx={theming.getThemedCardSx()}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider'}}
        >
          <Tab label="Features" icon={<SettingsIcon />} iconPosition="start" />
          <Tab label="Users" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Profession Types" icon={<WorkIcon />} iconPosition="start" />
          <Tab label="Products" icon={<InventoryIcon />} iconPosition="start" />
          <Tab label="Revenue" icon={<MoneyIcon />} iconPosition="start" />
        </Tabs>

        {/* Features Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Feature Analytics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Feature Status
                    </Typography>
                    <Box sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                        <Typography variant="body2">Enabled</Typography>
                        <Typography variant="body2">{analytics?.features?.enabled || 0}</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={((analytics?.features?.enabled || 0) / (analytics?.features?.total || 1)) * 100}
                        sx={{ height:  8, borderRadius:  4 }}
                      />
                    </Box>
                    <Box sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                        <Typography variant="body2">Disabled</Typography>
                        <Typography variant="body2">{analytics?.features?.disabled || 0}</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={((analytics?.features?.disabled || 0) / (analytics?.features?.total || 1)) * 100}
                        color="error"
                        sx={{ height:  8, borderRadius:  4 }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Features by Category
                    </Typography>
                    <AdminTableContainer ariaLabel="Features by Category">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics?.features?.byCategory || {}).map(([category, count]) => (
                            <TableRow key={category}>
                              <TableCell>{category}</TableCell>
                              <TableCell align="right">{count as number}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AdminTableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Users Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              User Analytics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      User Distribution
                    </Typography>
                    <Box sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                        <Typography variant="body2">Active Users</Typography>
                        <Typography variant="body2">{analytics?.users?.active || 0}</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={((analytics?.users?.active || 0) / (analytics?.users?.total || 1)) * 100}
                        sx={{ height:  8, borderRadius:  4 }}
                      />
                    </Box>
                    <Box sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                        <Typography variant="body2">Inactive Users</Typography>
                        <Typography variant="body2">{(analytics?.users?.total || 0) - (analytics?.users?.active || 0)}</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(((analytics?.users?.total || 0) - (analytics?.users?.active || 0)) / (analytics?.users?.total || 1)) * 100}
                        color="error"
                        sx={{ height:  8, borderRadius:  4 }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Users by Profession
                    </Typography>
                    <AdminTableContainer ariaLabel="Users by Profession">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Profession</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics?.users?.byProfession || {}).map(([profession, count]) => (
                            <TableRow key={profession}>
                              <TableCell>{profession}</TableCell>
                              <TableCell align="right">{count as number}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AdminTableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Profession Types Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Profession Type Analytics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Profession Type Status
                    </Typography>
                    <Box sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                        <Typography variant="body2">Active</Typography>
                        <Typography variant="body2">{analytics?.professionTypes?.active || 0}</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={((analytics?.professionTypes?.active || 0) / (analytics?.professionTypes?.total || 1)) * 100}
                        sx={{ height:  8, borderRadius:  4 }}
                      />
                    </Box>
                    <Box sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                        <Typography variant="body2">Inactive</Typography>
                        <Typography variant="body2">{(analytics?.professionTypes?.total || 0) - (analytics?.professionTypes?.active || 0)}</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(((analytics?.professionTypes?.total || 0) - (analytics?.professionTypes?.active || 0)) / (analytics?.professionTypes?.total || 1)) * 100}
                        color="error"
                        sx={{ height:  8, borderRadius:  4 }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Status Distribution
                    </Typography>
                    <AdminTableContainer ariaLabel="Status Distribution">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics?.professionTypes?.byStatus || {}).map(([status, count]) => (
                            <TableRow key={status}>
                              <TableCell>
                                <StatusChip
                                  label={status}
                                  tone={status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'neutral'}
                                />
                              </TableCell>
                              <TableCell align="right">{count as number}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AdminTableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Products Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Product Analytics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Products by Type
                    </Typography>
                    <AdminTableContainer ariaLabel="Products by Type">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics?.products?.byType || {}).map(([type, count]) => (
                            <TableRow key={type}>
                              <TableCell>{type}</TableCell>
                              <TableCell align="right">{count as number}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AdminTableContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Products by Brand
                    </Typography>
                    <AdminTableContainer ariaLabel="Products by Brand">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Brand</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics?.products?.byBrand || {}).map(([brand, count]) => (
                            <TableRow key={brand}>
                              <TableCell>{brand}</TableCell>
                              <TableCell align="right">{count as number}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AdminTableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Revenue Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ mb:  3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Revenue Analytics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Revenue by Profession
                    </Typography>
                    <AdminTableContainer ariaLabel="Revenue by Profession">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Profession</TableCell>
                            <TableCell align="right">Revenue</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics?.revenue?.byProfession || {}).map(([profession, revenue]) => (
                            <TableRow key={profession}>
                              <TableCell>{profession}</TableCell>
                              <TableCell align="right">{revenue as number} NOK</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AdminTableContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Revenue by Plan
                    </Typography>
                    <AdminTableContainer ariaLabel="Revenue by Plan">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Plan</TableCell>
                            <TableCell align="right">Revenue</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(analytics?.revenue?.byPlan || {}).map(([plan, revenue]) => (
                            <TableRow key={plan}>
                              <TableCell>{plan}</TableCell>
                              <TableCell align="right">{revenue as number} NOK</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AdminTableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default UnifiedAdminAnalytics;

