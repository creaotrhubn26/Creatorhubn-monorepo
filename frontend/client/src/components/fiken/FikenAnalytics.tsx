import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { alpha } from '@mui/material/styles';
import { apiRequest } from '@/lib/queryClient';

interface FikenAnalyticsProps {
  profession?: string;
}

interface TopEntry {
  name: string;
  total: number;
  count: number;
}

interface TimelineResponse {
  monthlyData: Record<string, Record<string, number>>;
}

interface SummaryStats {
  grandTotal: number;
  topThreePercentage: number;
}

const CHART_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#6366f1',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#a855f7',
];

export const FikenAnalytics: React.FC<FikenAnalyticsProps> = ({ profession }) => {
  const theme = useTheme();
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);

  const { data: customersRaw, isLoading: customersLoading } = useQuery({
    queryKey: ['fiken-top-customers', year],
    queryFn: () => apiRequest(`/api/fiken/analytics/top-customers?year=${year}&limit=10`),
  });

  const { data: productsRaw, isLoading: productsLoading } = useQuery({
    queryKey: ['fiken-top-products', year],
    queryFn: () => apiRequest(`/api/fiken/analytics/top-products?year=${year}&limit=10`),
  });

  const { data: timelineRaw, isLoading: timelineLoading } = useQuery({
    queryKey: ['fiken-product-timeline', year],
    queryFn: () => apiRequest(`/api/fiken/analytics/product-timeline?year=${year}`),
  });

  const customers = useMemo(() => normalizeEntries(customersRaw), [customersRaw]);
  const products = useMemo(() => normalizeEntries(productsRaw), [productsRaw]);
  const timeline = useMemo(() => normalizeTimeline(timelineRaw), [timelineRaw]);
  const customerSummary = useMemo(() => normalizeSummary(customersRaw, customers), [customersRaw, customers]);
  const productSummary = useMemo(() => normalizeSummary(productsRaw, products), [productsRaw, products]);

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
  const timelineRows = useMemo(() => {
    const productNames = Array.from(
      new Set(
        Object.values(timeline.monthlyData).flatMap((monthData) => Object.keys(monthData)),
      ),
    );
    return monthLabels.map((monthLabel, monthIndex) => {
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthData = timeline.monthlyData[monthKey] ?? {};
      const row: Record<string, number | string> = { month: monthLabel };
      productNames.forEach((productName) => {
        row[productName] = Math.round(monthData[productName] ?? 0);
      });
      return row;
    });
  }, [monthLabels, timeline.monthlyData, year]);

  const topProductKeys = useMemo(() => products.slice(0, 5).map((entry) => entry.name), [products]);
  const customerPieData = useMemo(
    () => customers.slice(0, 5).map((entry) => ({ name: entry.name, value: entry.total })),
    [customers],
  );
  const productPieData = useMemo(
    () => products.slice(0, 5).map((entry) => ({ name: entry.name, value: entry.total })),
    [products],
  );

  const loading = customersLoading || productsLoading || timelineLoading;
  if (loading) {
    return (
      <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Alert severity="info" icon={<AssessmentIcon />} sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Salgsanalyse basert på Fiken-fakturaer
        </Typography>
        <Typography variant="caption">
          Opprett pakker i prisadministrasjon, fakturer via Fiken, og følg ytelse per kunde og produkt.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <StackedHeading profession={profession} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="fiken-analytics-year">År</InputLabel>
          <Select
            labelId="fiken-analytics-year"
            value={year}
            label="År"
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {[yearNow - 2, yearNow - 1, yearNow].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Produktomsetning per måned
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Totalt {productSummary.grandTotal.toLocaleString('no-NO')} kr i {year}
          </Typography>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={timelineRows}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.4)} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toLocaleString('no-NO')} kr`} />
              <Legend />
              {topProductKeys.map((productName, index) => (
                <Area
                  key={productName}
                  type="monotone"
                  dataKey={productName}
                  stackId="1"
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  fillOpacity={0.55}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <MetricCard
            icon={<PersonIcon color="primary" />}
            title="Topp kunder"
            pieData={customerPieData}
            summary={customerSummary}
            entries={customers}
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <MetricCard
            icon={<CategoryIcon color="primary" />}
            title="Topp produkter"
            pieData={productPieData}
            summary={productSummary}
            entries={products}
          />
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Innsikt
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Topp 3 kunder står for {customerSummary.topThreePercentage.toFixed(1)}% av omsetning.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Topp 3 produkter står for {productSummary.topThreePercentage.toFixed(1)}% av omsetning.
              </Typography>
              <List dense>
                {products.slice(0, 5).map((entry, index) => (
                  <ListItem key={`${entry.name}-${index}`}>
                    <ListItemText
                      primary={entry.name}
                      secondary={`${entry.total.toLocaleString('no-NO')} kr • ${entry.count} salg`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

function StackedHeading({ profession }: { profession?: string }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TrendingUpIcon />
        Fiken salgsanalyse
      </Typography>
      {profession && <Chip size="small" label={`Profesjon: ${profession}`} sx={{ mt: 0.5 }} />}
    </Box>
  );
}

function MetricCard({
  icon,
  title,
  pieData,
  summary,
  entries,
}: {
  icon: React.ReactNode;
  title: string;
  pieData: Array<{ name: string; value: number }>;
  summary: SummaryStats;
  entries: TopEntry[];
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {icon}
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Topp 3: {summary.topThreePercentage.toFixed(1)}%
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <ResponsiveContainer width="70%" height={150}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={56}>
                {pieData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toLocaleString('no-NO')} kr`} />
            </PieChart>
          </ResponsiveContainer>
        </Box>
        <List dense>
          {entries.slice(0, 10).map((entry, index) => (
            <ListItem key={`${entry.name}-${index}`}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ maxWidth: 160 }} noWrap>
                      {entry.name}
                    </Typography>
                    <Typography variant="caption">{entry.total.toLocaleString('no-NO')} kr</Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

function normalizeEntries(raw: unknown): TopEntry[] {
  const items = toArray(raw);
  return items
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const name = typeof record.name === 'string' ? record.name : '';
      if (name.length === 0) {
        return null;
      }
      return {
        name,
        total: toNumber(record.total),
        count: toNumber(record.count),
      } satisfies TopEntry;
    })
    .filter((entry): entry is TopEntry => entry !== null);
}

function normalizeTimeline(raw: unknown): TimelineResponse {
  const record = asRecord(raw);
  if (!record) {
    return { monthlyData: {} };
  }
  const monthlyDataRecord = asRecord(record.monthlyData);
  if (!monthlyDataRecord) {
    return { monthlyData: {} };
  }
  const normalized: Record<string, Record<string, number>> = {};
  Object.entries(monthlyDataRecord).forEach(([monthKey, value]) => {
    const monthRecord = asRecord(value);
    if (!monthRecord) {
      return;
    }
    const monthValues: Record<string, number> = {};
    Object.entries(monthRecord).forEach(([entryKey, entryValue]) => {
      monthValues[entryKey] = toNumber(entryValue);
    });
    normalized[monthKey] = monthValues;
  });
  return { monthlyData: normalized };
}

function normalizeSummary(raw: unknown, entries: TopEntry[]): SummaryStats {
  const record = asRecord(raw);
  const summaryRecord = record ? asRecord(record.summary) : null;
  const grandTotal = summaryRecord ? toNumber(summaryRecord.grandTotal) : entries.reduce((sum, entry) => sum + entry.total, 0);
  const topThree = entries.slice(0, 3).reduce((sum, entry) => sum + entry.total, 0);
  const topThreePercentage = grandTotal > 0 ? (topThree / grandTotal) * 100 : 0;
  return { grandTotal, topThreePercentage };
}

function toArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  const record = asRecord(raw);
  if (!record) {
    return [];
  }
  if (Array.isArray(record.topCustomers)) {
    return record.topCustomers;
  }
  if (Array.isArray(record.topProducts)) {
    return record.topProducts;
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export default FikenAnalytics;
