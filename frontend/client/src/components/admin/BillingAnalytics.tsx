import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import ReactECharts from 'echarts-for-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Button,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Stack,
  Snackbar,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  MoneyOff,
  Cancel,
  FileDownload,
  FilterList,
  Refresh,
} from '@mui/icons-material';

interface BillingAnalyticsProps {
  compact?: boolean;
}

export default function BillingAnalytics({ compact = false }: BillingAnalyticsProps) {
  const { analytics } = useEnhancedMasterIntegration();

  // Filter states
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Chart refs for PDF export
  const revenueChartRef = useRef<any>(null);
  const cancellationChartRef = useRef<any>(null);
  const planChartRef = useRef<any>(null);

  // Fetch cancellation analytics
  const { data: cancellationData, isLoading: loadingCancellations, refetch: refetchCancellations } = useQuery({
    queryKey: ['/api/admin/analytics/cancellations', { dateRange }],
    queryFn: () => apiRequest(`/api/admin/analytics/cancellations?dateRange=${dateRange}`),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch refund analytics
  const { data: refundData, isLoading: loadingRefunds, refetch: refetchRefunds } = useQuery({
    queryKey: ['/api/admin/analytics/refunds', { dateRange, statusFilter }],
    queryFn: () => apiRequest(`/api/admin/analytics/refunds?dateRange=${dateRange}&status=${statusFilter}`),
    refetchInterval: 30000,
  });

  // Fetch revenue trends
  const { data: revenueData, isLoading: loadingRevenue, refetch: refetchRevenue } = useQuery({
    queryKey: ['/api/admin/analytics/revenue-trends', { dateRange }],
    queryFn: () => apiRequest(`/api/admin/analytics/revenue-trends?dateRange=${dateRange}`),
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch churn rate
  const { data: churnData, isLoading: loadingChurn, refetch: refetchChurn } = useQuery({
    queryKey: ['/api/admin/analytics/churn-rate', { dateRange }],
    queryFn: () => apiRequest(`/api/admin/analytics/churn-rate?dateRange=${dateRange}`),
    refetchInterval: 60000,
  });

  // Refresh all analytics
  const refreshAll = () => {
    analytics.trackEvent('billing_analytics_refresh', { dateRange });
    refetchCancellations();
    refetchRefunds();
    refetchRevenue();
    refetchChurn();
  };

  // Export to CSV function
  const exportToCSV = () => {
    analytics.trackEvent('billing_analytics_export', { format: 'csv', dateRange });

    const csvData = [
      ['Billing Analytics Export', `Date Range: ${dateRange}`, `Generated: ${new Date().toLocaleString('nb-NO')}`],
      [],
      ['=== REVENUE METRICS ==='],
      ['Monthly Recurring Revenue (MRR)', `${revenueData?.data?.mrr || 0} NOK`],
      ['Active Subscriptions', revenueData?.data?.activeSubscriptions || 0],
      ['Customer Lifetime Value (CLV)', `${churnData?.data?.customerLifetimeValue || 0} NOK`],
      [],
      ['=== CHURN METRICS ==='],
      ['Churn Rate', `${churnData?.data?.churnRate || 0}%`],
      ['Retention Rate', `${churnData?.data?.retentionRate || 0}%`],
      ['Cancellations (Period)', churnData?.data?.cancellations || 0],
      [],
      ['=== CANCELLATION STATISTICS ==='],
      ['Total Cancellations', cancellationData?.data?.totalCancellations || 0],
      [],
      ['Cancellation Reasons'],
      ['Reason','Count'],
      ...(cancellationData?.data?.cancellationReasons || []).map((r: any) => [r.reason || 'No reason', r.count]),
      [],
      ['=== REFUND STATISTICS ==='],
      ['Total Requests', refundData?.data?.totalRequests || 0],
      ['Approved', refundData?.data?.approved || 0],
      ['Pending', refundData?.data?.pending || 0],
      ['Rejected', refundData?.data?.rejected || 0],
      ['Total Refunded', `${refundData?.data?.totalRefunded || 0} NOK`],
      ['Average Refund', `${refundData?.data?.avgRefundAmount || 0} NOK`],
      [],
      ['=== REVENUE TRENDS ==='],
      ['Date','Revenue (NOK)','Subscriptions'],
      ...(revenueData?.data?.trends || []).slice(0, 30).map((t: any) => [
        new Date(t.date).toLocaleDateString('nb-NO'),
        t.revenue,
        t.subscriptionCount
      ]),
    ];

    const csvContent = csvData.map(row => row.join(', ')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `billing-analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Export to PDF function with charts and Google Drive upload
  const exportToPDF = async () => {
    analytics.trackEvent('billing_analytics_export', { format: 'pdf', dateRange });

    try {
      // Show loading state
      const loadingMessage = 'Genererer PDF rapport...';
      console.log(loadingMessage);

      const doc = new jsPDF('p','mm','a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(102, 126, 234);
      doc.text('Billing Analytics Report', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 10;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date Range: ${dateRange} | Generated: ${new Date().toLocaleString('nb-NO')}`, pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 15;

      // Revenue Metrics Section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Revenue Metrics', 14, yPosition);
      yPosition += 8;

      autoTable(doc, {
        startY: yPosition,
        head: [['Metric','Value']],
        body: [
          ['Monthly Recurring Revenue (MRR)', `${(revenueData?.data?.mrr || 0).toLocaleString('nb-NO')} NOK`],
          ['Active Subscriptions', `${revenueData?.data?.activeSubscriptions || 0}`],
          ['Customer Lifetime Value (CLV)', `${(churnData?.data?.customerLifetimeValue || 0).toLocaleString('nb-NO')} NOK`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Churn Metrics Section
      doc.setFontSize(14);
      doc.text('Churn Metrics', 14, yPosition);
      yPosition += 8;

      autoTable(doc, {
        startY: yPosition,
        head: [['Metric','Value']],
        body: [
          ['Churn Rate', `${churnData?.data?.churnRate || 0}%`],
          ['Retention Rate', `${churnData?.data?.retentionRate || 0}%`],
          ['Cancellations (Period)', `${churnData?.data?.cancellations || 0}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [245, 87, 108] },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Refund Statistics Section
      doc.setFontSize(14);
      doc.text('Refund Statistics', 14, yPosition);
      yPosition += 8;

      autoTable(doc, {
        startY: yPosition,
        head: [['Metric','Value']],
        body: [
          ['Total Requests', `${refundData?.data?.totalRequests || 0}`],
          ['Approved', `${refundData?.data?.approved || 0}`],
          ['Pending', `${refundData?.data?.pending || 0}`],
          ['Rejected', `${refundData?.data?.rejected || 0}`],
          ['Total Refunded', `${(refundData?.data?.totalRefunded || 0).toLocaleString('nb-NO')} NOK`],
          ['Average Refund', `${(refundData?.data?.avgRefundAmount || 0).toLocaleString('nb-NO')} NOK`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [255, 152, 0] },
        margin: { left: 14, right: 14 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Cancellation Statistics Section
      doc.setFontSize(14);
      doc.text('Cancellation Statistics', 14, yPosition);
      yPosition += 8;

      const cancellationReasons = cancellationData?.data?.cancellationReasons || [];
      if (cancellationReasons.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          head: [['Reason','Count']],
          body: cancellationReasons.map((r: any) => [r.reason || 'No reason', r.count]),
          theme: 'grid',
          headStyles: { fillColor: [255, 107, 107] },
          margin: { left: 14, right: 14 },
        });
        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Add charts as images
      if (revenueChartRef.current) {
        const chartInstance = revenueChartRef.current.getEchartsInstance();
        const chartImage = chartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff'
        });

        // Check if we need a new page for chart
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text('Revenue Trends Chart', 14, yPosition);
        yPosition += 5;

        const chartWidth = pageWidth - 28;
        const chartHeight = 80;
        doc.addImage(chartImage, 'PNG', 14, yPosition, chartWidth, chartHeight);
        yPosition += chartHeight + 10;
      }

      // Add cancellation pie chart
      if (cancellationChartRef.current && cancellationReasons.length > 0) {
        const chartInstance = cancellationChartRef.current.getEchartsInstance();
        const chartImage = chartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff'
        });

        // Check if we need a new page for chart
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text('Cancellation Reasons Chart', 14, yPosition);
        yPosition += 5;

        const chartWidth = pageWidth - 28;
        const chartHeight = 80;
        doc.addImage(chartImage, 'PNG', 14, yPosition, chartWidth, chartHeight);
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `CreatorHub Norge - Billing Analytics | Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Generate filename
      const filename = `billing-analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.pdf`;

      // Convert PDF to base64 for upload
      const pdfBase64 = doc.output('datauristring');

      console.log('📤 Laster opp PDF til Google Drive...');

      // Upload to Google Drive
      try {
        const uploadResponse = await apiRequest('/api/admin/analytics/upload-pdf', {
          method: 'POST',
          body: JSON.stringify({
            pdfBase64,
            filename,
            dateRange
          }),
          headers: {
            'Content-Type' : 'application/json'
          }
        });

        if (uploadResponse.success) {
          console.log('✅ PDF uploaded to Google Drive: ', uploadResponse);

          // Also save locally
          doc.save(filename);

          // Show success message with link
          setSnackbar({
            open: true,
            message: `✅ PDF rapport generert og lagret! ☁️ Lastet opp til Google Drive: BI Reports`,
            severity: 'success'
          });
        } else {
          throw new Error('Upload failed');
        }
      } catch (uploadError) {
        console.error('❌ Error uploading to Google Drive:', uploadError);

        // Fallback: just save locally
        doc.save(filename);
        setSnackbar({
          open: true,
          message: `⚠️ PDF generert og lagret lokalt. Google Drive opplasting feilet.`,
          severity: 'warning'
        });
      }

      console.log('✅ PDF export completed:', filename);
    } catch (error) {
      console.error('❌ Error exporting PDF:', error);
      setSnackbar({ open: true, message: 'Kunne ikke generere PDF. Vennligst prøv igjen.', severity: 'error' });
    }
  };

  // Manual refresh (use refreshAll which includes all endpoints)
  const handleRefresh = refreshAll;

  // Keep hook order stable across loading and loaded renders.
  const revenueTrendsData = useMemo(() => {
    if (!revenueData?.data?.trends) return [];
    return revenueData.data.trends.slice().reverse(); // Reverse to show oldest first
  }, [revenueData]);

  if (loadingCancellations || loadingRefunds || loadingRevenue || loadingChurn) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Revenue trends line chart with REAL DATA
  const timeSeriesOption = {
    title: {
      text: 'Inntektstrender Over Tid',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600}
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        const date = params[0].axisValue;
        let tooltip = `<strong>${date}</strong><br/>`;
        params.forEach((param: any) => {
          tooltip += `${param.marker} ${param.seriesName}: ${param.value.toLocaleString('nb-NO')} ${param.seriesName === 'Inntekt' ? 'kr' : ', '}<br/>`;
        });
        return tooltip;
      }
    },
    legend: {
      data: ['Inntekt', 'Abonnementer'],
      top: 30
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: revenueTrendsData.map((d: any) => new Date(d.date).toLocaleDateString('nb-NO', { month: 'short', day: 'numeric' }))
    },
    yAxis: [
      {
        type: 'value',
        name: 'Inntekt (kr)',
        position: 'left',
        axisLabel: {
          formatter: (value: number) => `${(value / 1000).toFixed(0)}k`
        }
      },
      {
        type: 'value',
        name: 'Abonnementer',
        position: 'right'
      }
    ],
    series: [
      {
        name: 'Inntekt',
        type: 'line',
        smooth: true,
        data: revenueTrendsData.map((d: any) => d.revenue),
        itemStyle: { color: '#667eea' },
        areaStyle: {
          opacity: 0.3,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.5)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.1)' }
            ]
          }
        },
        yAxisIndex: 0
      },
      {
        name: 'Abonnementer',
        type: 'line',
        smooth: true,
        data: revenueTrendsData.map((d: any) => d.subscriptionCount),
        itemStyle: { color: '#4facfe' },
        areaStyle: {
          opacity: 0.2,
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79, 172, 254, 0.4)' },
              { offset: 1, color: 'rgba(79, 172, 254, 0.05)' }
            ]
          }
        },
        yAxisIndex: 1
      }
    ]
  };

  // Prepare cancellation reasons pie chart
  const cancellationReasons = cancellationData?.data?.reasonBreakdown || [];
  const cancellationPieOption = {
    title: {
      text: 'Kanselleringsårsaker',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600}
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: 'Årsaker',
        type: 'pie',
        radius: '60%',
        data: cancellationReasons.map((item: any) => ({
          value: item.count,
          name: item.reason || 'Ingen grunn oppgitt'
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  // Prepare plan breakdown bar chart
  const planBreakdown = cancellationData?.data?.planBreakdown || [];
  const planBarOption = {
    title: {
      text: 'Kanselleringer per Plan',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600}
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    xAxis: {
      type: 'category',
      data: planBreakdown.map((item: any) => item.plan)
    },
    yAxis: {
      type: 'value',
      name: 'Antall'
    },
    series: [
      {
        name: 'Kanselleringer',
        type: 'bar',
        data: planBreakdown.map((item: any) => item.count),
        itemStyle: {
          color: '#ff6b6b'
        }
      }
    ]
  };

  // Prepare refund statistics gauge chart
  const refundStats = refundData?.data || {};
  const refundRate = refundStats.totalRequests > 0 
    ? ((refundStats.approved / refundStats.totalRequests) * 100).toFixed(1)
    : 0;

  const refundGaugeOption = {
    title: {
      text: 'Refunderingsrate',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600}
    },
    tooltip: {
      formatter: '{a} <br/>{b} : {c}%'
    },
    series: [
      {
        name: 'Rate',
        type: 'gauge',
        progress: {
          show: true
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%'
        },
        data: [
          {
            value: parseFloat(refundRate as string),
            name: 'Godkjent'
          }
        ]
      }
    ]
  };

  return (
    <Box>
      {/* Toolbar with filters and export */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filtre
          </Button>
          <Tooltip title="Oppdater data">
            <IconButton onClick={handleRefresh} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<FileDownload />}
            onClick={exportToCSV}
            size="small"
          >
            Eksporter CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={exportToPDF}
            size="small"
          >
            Eksporter PDF
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Card sx={{ mb: 3, bgcolor: '#f5f5f5' }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Tidsperiode"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  size="small"
                >
                  <MenuItem value="7d">Siste 7 dager</MenuItem>
                  <MenuItem value="30d">Siste 30 dager</MenuItem>
                  <MenuItem value="90d">Siste 90 dager</MenuItem>
                  <MenuItem value="all">Alle</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  fullWidth
                  label="Refunderingsstatus"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  size="small"
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="pending">Ventende</MenuItem>
                  <MenuItem value="approved">Godkjent</MenuItem>
                  <MenuItem value="rejected">Avvist</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {/* Summary Cards */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Cancel color="error" />
                <Typography variant="subtitle2" color="text.secondary">
                  Totale Kanselleringer
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#ff6b6b' }}>
                {cancellationData?.data?.totalCancellations || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MoneyOff color="warning" />
                <Typography variant="subtitle2" color="text.secondary">
                  Refunderingsforespørsler
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#ff9800' }}>
                {refundStats.totalRequests || 0}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip label={`${refundStats.pending || 0} ventende`} size="small" color="warning" />
                <Chip label={`${refundStats.approved || 0} godkjent`} size="small" color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDown color="error" />
                <Typography variant="subtitle2" color="text.secondary">
                  Totalt Refundert
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#f44336' }}>
                {(refundStats.totalRefunded || 0).toLocaleString('nb-NO')} kr
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp color="info" />
                <Typography variant="subtitle2" color="text.secondary">
                  Gjennomsnittlig Refundering
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196f3' }}>
                {(refundStats.avgRefundAmount || 0).toLocaleString('nb-NO')} kr
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* New Revenue & Churn Metrics */}
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp sx={{ color: 'white' }} />
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Månedlig Tilbakevendende Inntekt (MRR)
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {(revenueData?.data?.mrr || 0).toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {revenueData?.data?.activeSubscriptions || 0} aktive abonnementer
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingDown sx={{ color: 'white' }} />
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Churn Rate
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {churnData?.data?.churnRate || 0}%
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Retention: {churnData?.data?.retentionRate || 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TrendingUp sx={{ color: 'white' }} />
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Customer Lifetime Value (CLV)
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                {(churnData?.data?.customerLifetimeValue || 0).toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Gjennomsnittlig verdi per kunde
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Time Series Chart */}
        {!compact && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <ReactECharts
                  ref={revenueChartRef}
                  option={timeSeriesOption}
                  style={{ height: '350px' }}
                />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Charts */}
        {!compact && (
          <>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  {cancellationReasons.length > 0 ? (
                    <ReactECharts
                      ref={cancellationChartRef}
                      option={cancellationPieOption}
                      style={{ height: '400px' }}
                    />
                  ) : (
                    <Alert severity="info">
                      Ingen kanselleringsdata tilgjengelig ennå.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  {planBreakdown.length > 0 ? (
                    <ReactECharts
                      ref={planChartRef}
                      option={planBarOption}
                      style={{ height: '400px' }}
                    />
                  ) : (
                    <Alert severity="info">
                      Ingen plandata tilgjengelig ennå.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <ReactECharts option={refundGaugeOption} style={{ height: '400px' }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600}}>
                    Refunderingsstatistikk
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Totale forespørsler
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600}}>
                        {refundStats.totalRequests || 0}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Godkjent
                      </Typography>
                      <Chip
                        label={refundStats.approved || 0}
                        size="small"
                        color="success"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Ventende
                      </Typography>
                      <Chip
                        label={refundStats.pending || 0}
                        size="small"
                        color="warning"
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Avvist
                      </Typography>
                      <Chip
                        label={refundStats.rejected || 0}
                        size="small"
                        color="error"
                      />
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600}}>
                        Totalt refundert beløp
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color:'#f44336' }}>
                        {(refundStats.totalRefunded || 0).toLocaleString('nb-NO')} kr
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
