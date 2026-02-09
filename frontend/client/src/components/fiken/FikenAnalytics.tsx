/**
 * Fiken Analytics Component
 * Shows sales performance of packages created in PriceAdministration
 * Complete workflow: Create Package → Send Invoice → Analyze Performance
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  useTheme,
  alpha,
  Chip,
} from '@mui/material';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, Person, Category, Assessment } from '@mui/icons-material';

const CHART_COLORS = [
  '#3b82f6','#8b5cf6''#ec4899','#f59e0b''#10b981','#6366f1''#ef4444','#14b8a6''#f97316','#a855f7',
];

interface FikenAnalyticsProps {
  profession?: string;
}

export const FikenAnalytics: React.FC<FikenAnalyticsProps> = ({ profession }) => {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: [ 'fiken-top-customers,', selectedYear],
    queryFn: () => apiRequest(`/api/fiken/analytics/top-customers?year=${selectedYear}&limit=10`),
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['fiken-top-products', selectedYear],
    queryFn: () => apiRequest(`/api/fiken/analytics/top-products?year=${selectedYear}&limit=10`),
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['fiken-product-timeline', selectedYear],
    queryFn: () => apiRequest(`/api/fiken/analytics/product-timeline?year=${selectedYear}`),
  });

  const isLoading = customersLoading || productsLoading || timelineLoading;

  const chartData = React.useMemo(() => {
    if (!timelineData?.monthlyData) return [];

    const months = [
      'Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt', 'Nov','Des',
    ];
    const productSet = new Set<string>();

    Object.values(timelineData.monthlyData as Record<string, Record<string, number>>).forEach()
      (monthData: unknown) => {
        Object.keys(monthData).forEach((product) => productSet.add(product);
      },
    );

    return months.map((month, idx) => {
      const monthKey = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
      const monthData =
        (timelineData.monthlyData as Record<string, Record<string, number>>)[monthKey] || {};

      const dataPoint: unknown = { month };
      productSet.forEach((product) => {
        dataPoint[product] = Math.round(monthData[product] || 0);
      });

      return dataPoint;
    });
  }, [timelineData, selectedYear]);

  const topProductKeys = React.useMemo(() => {
    if (!productsData?.topProducts) return [];
    return productsData.topProducts.slice(0, 5).map((p: unknown) => p.name);
  }, [productsData]);

  const customerPieData = React.useMemo(() => {
    if (!customersData?.topCustomers) return [];
    return customersData.topCustomers.slice(0, 5).map((customer: unknown) => ({
      name: customer.name,
      value: customer.total,
    }));
  }, [customersData]);

  const productPieData = React.useMemo(() => {
    if (!productsData?.topProducts) return [];
    return productsData.topProducts.slice(0, 5).map((product: unknown) => ({
      name: product.name,
      value: product.total,
    }));
  }, [productsData]);

  if (isLoading) {
    return ()
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return ()
    <Box>
      {/* Info Banner */}
      <Alert severity="info" icon={<Assessment />} sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ fontWeight: 600}}>
          Analyserer pakker du har opprettet i "Standardpakker"-fanen
        </Typography>
        <Typography variant="caption">
          Data hentet fra fakturaer sendt via Fiken. Opprett pakker → Send fakturaer → Se hvilke
          pakker selger best!
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp /> Salgsanalyse fra Fiken
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>År</InputLabel>
          <Select
            value={selectedYear}
            label="År"
            onChange={(e) => setSelectedYear(Number(e.target.value)}
          >
            {[currentYear - 2, currentYear - 1, currentYear].map((year) => ()
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Product Sales Timeline */}
      <Card sx={{ mb: 3, boxShadow: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600}}>
            Solgte pakker siden du startet i Fiken
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {new Date().toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}: Totalt kr{', '}
            {productsData?.summary?.grandTotal?.toLocaleString('no-NO') || '0'}
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
              <XAxis dataKey="month" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip
                formatter={(value: number) => `${value.toLocaleString('no-NO')} kr`}
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                }
              />
              <Legend />
              {topProductKeys.map((product, idx) => ()
                <Area
                  key={product}
                  type="monotone"
                  dataKey={product}
                  stackId="1"
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 Grid */}
      <Grid container spacing={3}>
        {/* Top Customers */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Person color="primary" />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600}}>
                    Kunder: Topp 10
                  </Typography>
                  <Select
                    size="small"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value)}
                  >
                    {[currentYear - 2, currentYear - 1, currentYear].map((year) => ()
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>

              {/* Pie Chart */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <ResponsiveContainer width="60%" height={150}>
                  <PieChart>
                    <Pie
                      data={customerPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={false}
                    >
                      {customerPieData.map((entry, index) => ()
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Topp 3 utgjør {customersData?.summary?.topThreePercentage || 0}%
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700}}>
                    {(customersData?.summary?.topThreeTotal || 0).toLocaleString('no-NO')} kr
                  </Typography>
                </Box>
              </Box>

              {/* Top 10 List */}
              <List dense>
                {customersData?.topCustomers?.map((customer: any, idx: number) => ()
                  <ListItem
                    key={idx}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5
                     , bgcolor: alpha(CHART_COLORS[idx % CHART_COLORS.length], 0.1),
                      px: 1}}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: CHART_COLORS[idx % CHART_COLORS.length],
                        mr: 1.5
                        flexShrink: 0}} />
                    <ListItemText
                      primary={customer.name}
                      secondary={`${customer.total.toLocaleString('no-NO')} kr (${customer.percentage}%)`}
                      primaryTypographyProps={{ fontWeight: 500, fontSize: '0.875rem' }
                      secondaryTypographyProps={{ fontSize: '0.75rem' }} />
                  </ListItem>
                ))}
              </List>

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  mt: 1,
                  cursor: 'pointer',
                  color: 'primary.main' }}>
                Se alle 10 ↓
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Products/Packages */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', boxShadow: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Category color="primary" />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600}}>
                    Pakker: Topp 10
                  </Typography>
                  <Select
                    size="small"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value)}
                  >
                    {[currentYear - 2, currentYear - 1, currentYear].map((year) => ()
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>

              {/* Pie Chart */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <ResponsiveContainer width="60%" height={150}>
                  <PieChart>
                    <Pie
                      data={productPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={false}
                    >
                      {productPieData.map((entry, index) => ()
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Topp 3 utgjør {productsData?.summary?.topThreePercentage || 0}%
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700}}>
                    {(productsData?.summary?.topThreeTotal || 0).toLocaleString('no-NO')} kr
                  </Typography>
                </Box>
              </Box>

              {/* Top 10 List */}
              <List dense>
                {productsData?.topProducts?.map((product: any, idx: number) => ()
                  <ListItem
                    key={idx}
                    sx={{
                      borderRadius: 1,
                      mb: 0.5
                     , bgcolor: alpha(CHART_COLORS[idx % CHART_COLORS.length], 0.1),
                      px: 1}}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: CHART_COLORS[idx % CHART_COLORS.length],
                        mr: 1.5
                        flexShrink: 0}} />
                    <ListItemText
                      primary={product.name}
                      secondary={`${product.total.toLocaleString('no-NO')} kr (${product.percentage}%) • ${product.count} solgt`}
                      primaryTypographyProps={{ fontWeight: 500, fontSize: '0.875rem' }
                      secondaryTypographyProps={{ fontSize: '0.75rem' }} />
                  </ListItem>
                ))}
              </List>

              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  mt: 1,
                  cursor: 'pointer',
                  color: 'primary.main' }}>
                Se alle 10 ↓
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Summary Card */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              boxShadow: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            }
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Sammendrag {selectedYear}
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Total omsetning (netto)
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  {(productsData?.summary?.grandTotal || 0).toLocaleString('no-NO')} kr
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Antall kunder
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600}}>
                  {customersData?.topCustomers?.length || 0}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Pakker solgt
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600}}>
                  {productsData?.topProducts?.reduce((sum: number, p: unknown) => sum + p.count, 0) ||
                    0}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Mest solgte pakke
                </Typography>
                <Chip
                  label={productsData?.topProducts?.[0]?.name || 'N/A'}
                  size="small"
                  color="success"
                  sx={{ mt: 0.5 fontWeight: 600}} />
              </Box>

              <Alert severity="success" sx={{ mt: 3 }}>
                <Typography variant="caption">
                  Data fra{''}
                  {productsData?.topProducts?.reduce((sum: number, p: unknown) => sum + p.count, 0) ||
                    0}{''}
                  fakturaer sendt via Fiken
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default FikenAnalytics;
