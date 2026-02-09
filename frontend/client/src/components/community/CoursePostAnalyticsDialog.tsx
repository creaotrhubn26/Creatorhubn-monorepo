import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Stack,
  Avatar,
  Alert,
  LinearProgress,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Fade,
  Grow,
  Slide,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Close,
  Visibility,
  TouchApp,
  CheckCircle,
  TrendingUp,
  CompareArrows,
  Download as DownloadIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import ReactECharts from 'echarts-for-react';
import { Virtuoso } from 'react-virtuoso';

interface CoursePostAnalyticsDialogProps {
  open: boolean;
  onClose: () => void;
  post: any;
  analyticsData: any;
  loading: boolean;
}

export const CoursePostAnalyticsDialog: React.FC<CoursePostAnalyticsDialogProps> = ({
  open,
  onClose,
  post,
  analyticsData,
  loading,
}) => {
  const [viewMode, setViewMode] = useState<'single' | 'compare'>('single');
  const [selectedPosts, setSelectedPosts] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [currentExportChart, setCurrentExportChart] = useState<string>('');
  const [uploadingToDrive, setUploadingToDrive] = useState(false);
  const [driveUploadResult, setDriveUploadResult] = useState<{
    success: boolean;
    fileName: string;
    webViewLink?: string;
    folderPath?: string;
  } | null>(null);

  // Refs for chart instances
  const lineChartRef = useRef<any>(null);
  const barChartRef = useRef<any>(null);
  const funnelChartRef = useRef<any>(null);
  const comparisonBarChartRef = useRef<any>(null);
  const comparisonLineChartRef = useRef<any>(null);

  // Fetch all posts for comparison
  useEffect(() => {
    if (open && viewMode === 'compare') {
      fetchAllPosts();
    }
  }, [open, viewMode]);

  const fetchAllPosts = async () => {
    setLoadingPosts(true);
    try {
      const response = await fetch('/api/academy/courses/community-posts', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setAllPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching posts: ', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchComparisonData = async (postIds: string[]) => {
    const promises = postIds.map(async (postId) => {
      const postInfo = allPosts.find(p => p.id === postId);
      if (!postInfo) return null;

      try {
        const response = await fetch(
          `/api/academy/courses/${postInfo.course_id}/community-posts/${postId}/analytics`,
          { credentials: 'include' }
        );
        const data = await response.json();
        return { ...data, postInfo };
      } catch (error) {
        console.error('Error fetching analytics for post: ', postId, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    setCompareData(results.filter(r => r !== null));
  };

  useEffect(() => {
    if (selectedPosts.length > 0) {
      fetchComparisonData(selectedPosts);
    }
  }, [selectedPosts]);

  // Export handlers
  const handleOpenExportMenu = (event: React.MouseEvent<HTMLElement>, chartName: string) => {
    setExportMenuAnchor(event.currentTarget);
    setCurrentExportChart(chartName);
  };

  const handleCloseExportMenu = () => {
    setExportMenuAnchor(null);
    setCurrentExportChart(', ');
  };

  const handleExportChart = (format: 'png' | 'jpg' | 'svg') => {
    let chartRef: any = null;

    switch (currentExportChart) {
      case 'line':
        chartRef = lineChartRef.current;
        break;
      case 'bar':
        chartRef = barChartRef.current;
        break;
      case 'funnel':
        chartRef = funnelChartRef.current;
        break;
      case 'comparisonBar':
        chartRef = comparisonBarChartRef.current;
        break;
      case 'comparisonLine':
        chartRef = comparisonLineChartRef.current;
        break;
    }

    if (chartRef) {
      const echartsInstance = chartRef.getEchartsInstance();
      const url = echartsInstance.getDataURL({
        type: format,
        pixelRatio: 2,
        backgroundColor: '#fff',
      });

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentExportChart}-chart-${new Date().getTime()}.${format}`;
      link.click();
    }

    handleCloseExportMenu();
  };

  const handleResetZoom = (chartName: string) => {
    let chartRef: any = null;

    switch (chartName) {
      case 'line':
        chartRef = lineChartRef.current;
        break;
      case 'bar':
        chartRef = barChartRef.current;
        break;
      case 'funnel':
        chartRef = funnelChartRef.current;
        break;
      case 'comparisonBar':
        chartRef = comparisonBarChartRef.current;
        break;
      case 'comparisonLine':
        chartRef = comparisonLineChartRef.current;
        break;
    }

    if (chartRef) {
      const echartsInstance = chartRef.getEchartsInstance();
      echartsInstance.dispatchAction({
        type: 'dataZoom',
        start: 0,
        end: 100,
      });
    }
  };

  const handleExportToGoogleDrive = async () => {
    let chartRef: any = null;

    switch (currentExportChart) {
      case 'line':
        chartRef = lineChartRef.current;
        break;
      case 'bar':
        chartRef = barChartRef.current;
        break;
      case 'funnel':
        chartRef = funnelChartRef.current;
        break;
      case 'comparisonBar':
        chartRef = comparisonBarChartRef.current;
        break;
      case 'comparisonLine':
        chartRef = comparisonLineChartRef.current;
        break;
    }

    if (chartRef) {
      setUploadingToDrive(true);
      try {
        const echartsInstance = chartRef.getEchartsInstance();
        const imageData = echartsInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff',
        });

        const fileName = `${currentExportChart}-chart-${new Date().getTime()}.png`;
        const chartType = currentExportChart;
        const courseTitle = post?.course_title || ', ';

        const response = await fetch('/api/analytics/export-to-drive', {
          method: 'POST',
          headers: {
            'Content-Type' : 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            imageData,
            fileName,
            chartType,
            courseTitle,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Store the result to show "View in Google Drive" button
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const folderPath = `CreatorHub/Community/Analytics/${yyyy}/${mm}`;

          setDriveUploadResult({
            success: true,
            fileName,
            webViewLink: data.webViewLink,
            folderPath,
          });
        } else {
          throw new Error(data.error || 'Kunne ikke laste opp til Google Drive');
        }
      } catch (error: any) {
        console.error('Error uploading to Google Drive: ', error);
        setDriveUploadResult({
          success: false,
          fileName: ', ',
        });
        alert(`❌ Kunne ikke laste opp til Google Drive: ${error.message}`);
      } finally {
        setUploadingToDrive(false);
        handleCloseExportMenu();
      }
    }
  };

  const handleCloseDriveSuccessDialog = () => {
    setDriveUploadResult(null);
  };

  const handleViewInDrive = () => {
    if (driveUploadResult?.webViewLink) {
      window.open(driveUploadResult.webViewLink, '_blank');
    }
  };

  if (!post && viewMode === 'single') return null;

  // Calculate metrics
  const views = analyticsData?.views_count || 0;
  const clicks = analyticsData?.clicks_count || 0;
  const enrollments = analyticsData?.enrollments_from_post || 0;
  const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0';
  const conversionRate = clicks > 0 ? ((enrollments / clicks) * 100).toFixed(1) : '0';

  // Prepare time series data for line chart
  const timeSeriesData = analyticsData?.timeSeries || [];
  const dates = timeSeriesData.map((d: any) => new Date(d.date).toLocaleDateString('nb-NO', { month: 'short', day: 'numeric' }));
  const viewsData = timeSeriesData.map((d: any) => d.views || 0);
  const clicksData = timeSeriesData.map((d: any) => d.clicks || 0);
  const enrollmentsData = timeSeriesData.map((d: any) => d.enrollments || 0);

  // Prepare hourly distribution data for bar chart
  const hourlyData = analyticsData?.hourlyDistribution || [];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourlyViews = hours.map(h => {
    const data = hourlyData.find((d: any) => d.hour === h && d.event_type === 'view');
    return data ? data.event_count : 0;
  });
  const hourlyClicks = hours.map(h => {
    const data = hourlyData.find((d: any) => d.hour === h && d.event_type === 'click');
    return data ? data.event_count : 0;
  });

  // Line chart options with animations
  const lineChartOptions = {
    animation: true,
    animationDuration: 1500,
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 50,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#ddd',
      borderWidth: 2,
      borderRadius: 8,
      padding: [12, 16],
      textStyle: {
        color: '#333',
        fontSize: 13,
        fontWeight: 500,
      },
      formatter: (params: any) => {
        let result = `<div style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          const color = param.color.colorStops ? param.color.colorStops[0].color : param.color;
          result += `
            <div style="display: flex; align-items: center; margin: 6px 0;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%;, background: ${color}; margin-right: 8px;"></span>
              <span style="flex: 1;">${param.seriesName}:</span>
              <span style="font-weight: 700; margin-left: 12px;">${param.value}</span>
            </div>
          `;
        });

        // Calculate CTR and conversion rate
        const views = params.find((p: any) => p.seriesName === 'Visninger')?.value || 0;
        const clicks = params.find((p: any) => p.seriesName === 'Klikk')?.value || 0;
        const enrollments = params.find((p: any) => p.seriesName === 'Påmeldinger')?.value || 0;

        if (views > 0) {
          const ctr = ((clicks / views) * 100).toFixed(1);
          result += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #666;">CTR: <strong>${ctr}%</strong></div>`;
        }

        if (clicks > 0) {
          const conv = ((enrollments / clicks) * 100).toFixed(1);
          result += `<div style="font-size: 12px; color: #666;">Konvertering: <strong>${conv}%</strong></div>`;
        }

        return result;
      },
    },
    legend: {
      data: ['Visninger','Klikk','Påmeldinger'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Tilbakestill zoom'
          }
        },
        restore: {
          title: 'Tilbakestill'
        },
        saveAsImage: {
          title: 'Last ned som bilde',
          name: 'trend-analysis',
          pixelRatio: 2
        }
      },
      right: 20,
      top: 10,
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 40,
      }
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'Visninger',
        type: 'line',
        smooth: true,
        data: viewsData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' }
            ],
          },
        },
        lineStyle: { width: 3 },
        areaStyle: {
          opacity: 0.3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.5)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 6,
        animationDelay: 0,
      },
      {
        name: 'Klikk',
        type: 'line',
        smooth: true,
        data: clicksData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#f093fb' },
              { offset: 1, color: '#f5576c' }
            ],
          },
        },
        lineStyle: { width: 3 },
        areaStyle: {
          opacity: 0.3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(240, 147, 251, 0.5)' },
              { offset: 1, color: 'rgba(240, 147, 251, 0.05)' }
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 6,
        animationDelay: 200,
      },
      {
        name: 'Påmeldinger',
        type: 'line',
        smooth: true,
        data: enrollmentsData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#4facfe' },
              { offset: 1, color: '#00f2fe' }
            ],
          },
        },
        lineStyle: { width: 3 },
        areaStyle: {
          opacity: 0.3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(79, 172, 254, 0.5)' },
              { offset: 1, color: 'rgba(79, 172, 254, 0.05)' }
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 6,
        animationDelay: 400,
      },
    ],
  };

  // Bar chart options for hourly distribution with animations
  const barChartOptions = {
    animation: true,
    animationDuration: 1200,
    animationEasing: 'elasticOut',
    animationDelay: (idx: number) => idx * 30,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#ddd',
      borderWidth: 2,
      borderRadius: 8,
      padding: [12, 16],
      textStyle: {
        color: '#333',
        fontSize: 13,
        fontWeight: 500,
      },
      formatter: (params: any) => {
        const hour = params[0].axisValue;
        const nextHour = (parseInt(hour.split(':')[0]) + 1) % 24;
        let result = `<div style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">⏰ ${hour} - ${nextHour}:00</div>`;

        let totalEvents = 0;
        params.forEach((param: any) => {
          totalEvents += param.value;
          const color = param.color.colorStops ? param.color.colorStops[0].color : param.color;
          result += `
            <div style="display: flex; align-items: center; margin: 6px 0;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${color}; margin-right: 8px;"></span>
              <span style="flex: 1;">${param.seriesName}:</span>
              <span style="font-weight: 700; margin-left: 12px;">${param.value}</span>
            </div>
          `;
        });

        result += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #666;">Total, hendelser: <strong>${totalEvents}</strong></div>`;

        return result;
      },
    },
    legend: {
      data: ['Visninger','Klikk'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: 'Zoom',
            back: 'Tilbakestill zoom'
          }
        },
        restore: {
          title: 'Tilbakestill'
        },
        saveAsImage: {
          title: 'Last ned som bilde',
          name: 'hourly-distribution',
          pixelRatio: 2
        }
      },
      right: 20,
      top: 10,
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
      {
        type: 'slider',
        start: 0,
        end: 100,
        height: 20,
        bottom: 40,
      }
    ],
    xAxis: {
      type: 'category',
      data: hours.map(h => `${h}:00`),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: 'Visninger',
        type: 'bar',
        data: hourlyViews,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#667eea' },
              { offset: 1, color: '#764ba2' }
            ],
          },
          borderRadius: [8, 8, 0, 0],
        },
        animationDelay: 0,
      },
      {
        name: 'Klikk',
        type: 'bar',
        data: hourlyClicks,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#f093fb' },
              { offset: 1, color: '#f5576c' }
            ],
          },
          borderRadius: [8, 8, 0, 0],
        },
        animationDelay: 100,
      },
    ],
  };

  // Funnel chart for conversion funnel with animations
  const funnelChartOptions = {
    animation: true,
    animationDuration: 1800,
    animationEasing: 'cubicInOut',
    animationDelay: (idx: number) => idx * 300,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#ddd',
      borderWidth: 2,
      borderRadius: 8,
      padding: [12, 16],
      textStyle: {
        color: '#333',
        fontSize: 13,
        fontWeight: 500,
      },
      formatter: (params: any) => {
        const stage = params.name;
        const value = params.value;
        const percent = params.percent;

        let icon = '👁️';
        let description = 'Brukere som så innlegget';
        let nextStage = 'klikket';

        if (stage === 'Klikk') {
          icon = '👆';
          description = 'Brukere som klikket på kurset';
          nextStage = 'meldte seg på';
        } else if (stage === 'Påmeldinger') {
          icon = '✅';
          description = 'Brukere som meldte seg på kurset';
          nextStage = 'fullførte';
        }

        let result = `
          <div style="font-weight: 700; margin-bottom: 8px; font-size: 16px;">
            ${icon} ${stage}
          </div>
          <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
            ${description}
          </div>
          <div style="font-size: 20px; font-weight: 700; color: #333; margin: 8px 0;">
            ${value.toLocaleString()}
          </div>
          <div style="font-size: 12px; color: #999;">
            ${percent.toFixed(1)}% av totalt
          </div>
        `;

        // Calculate conversion to next stage
        if (stage === 'Visninger' && clicks > 0) {
          const convRate = ((clicks / views) * 100).toFixed(1);
          result += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #666;">${convRate}% ${nextStage}</div>`;
        } else if (stage === 'Klikk' && enrollments > 0) {
          const convRate = ((enrollments / clicks) * 100).toFixed(1);
          result += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #666;">${convRate}% ${nextStage}</div>`;
        }

        return result;
      },
    },
    toolbox: {
      feature: {
        saveAsImage: {
          title: 'Last ned som bilde',
          name: 'conversion-funnel',
          pixelRatio: 2
        }
      },
      right: 20,
      top: 10,
    },
    series: [
      {
        name: 'Konverteringstrakt',
        type: 'funnel',
        left: '10%',
        top: 60,
        bottom: 60,
        width: '80%',
        min: 0,
        max: views,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 4,
        label: {
          show: true,
          position: 'inside',
          formatter: '{b}: {c}',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#fff',
        },
        labelLine: {
          length: 10,
          lineStyle: {
            width: 1,
            type: 'solid',
          },
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
        },
        emphasis: {
          label: {
            fontSize: 18,
          },
        },
        data: [
          {
            value: views,
            name: 'Visninger',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: '#667eea' },
                  { offset: 1, color: '#764ba2' }
                ],
              },
            },
          },
          {
            value: clicks,
            name: 'Klikk',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: '#f093fb' },
                  { offset: 1, color: '#f5576c' }
                ],
              },
            },
          },
          {
            value: enrollments,
            name: 'Påmeldinger',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: '#4facfe' },
                  { offset: 1, color: '#00f2fe' }
                ],
              },
            },
          },
        ],
      },
    ],
  };

  // Recent events list
  const recentEvents = analyticsData?.events || [];

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'view':
        return <Visibility fontSize="small" color="primary" />;
      case 'click':
        return <TouchApp fontSize="small" color="secondary" />;
      case 'enrollment':
        return <CheckCircle fontSize="small" color="success" />;
      default:
        return null;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'view':
        return 'Visning';
      case 'click':
        return 'Klikk';
      case 'enrollment':
        return 'Påmelding';
      default:
        return eventType;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box flex={1}>
            <Typography variant="h6">Kursinnlegg Statistikk</Typography>
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => {
                if (newMode) setViewMode(newMode);
              }}
              size="small"
            >
              <ToggleButton value="single">
                <TrendingUp fontSize="small" sx={{ mr: 0.5 }} />
                Enkelt
              </ToggleButton>
              <ToggleButton value="compare">
                <CompareArrows fontSize="small" sx={{ mr: 0.5 }} />
                Sammenlign
              </ToggleButton>
            </ToggleButtonGroup>
            <IconButton onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        {viewMode === 'single' ? (
          // Single Post View
          loading ? (
            <Box py={4}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" align="center" mt={2}>
                Laster statistikk...
              </Typography>
            </Box>
          ) : analyticsData ? (
            <Stack spacing={3}>
            {/* Course Info */}
            <Box>
              <Box display="flex" gap={2} alignItems="center">
                {post.course_thumbnail && (
                  <Avatar
                    src={post.course_thumbnail}
                    variant="rounded"
                    sx={{ width: 80, height: 80 }}
                  />
                )}
                <Box flex={1}>
                  <Typography variant="h6" gutterBottom>
                    {post.course_title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Kanal: {post.channel_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Publisert: {new Date(post.published_at).toLocaleDateString('nb-NO')}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Metrics Summary - Inspired Design */}
            <Box display="flex" gap={2} flexWrap="wrap">
              {/* Views Card */}
              <Grow in={true} timeout={600} style={{ transformOrigin: '0 0 0' }}>
                <Card
                  sx={{
                    flex: 1,
                    minWidth: 200,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)'}}
                >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500}}>
                        Visninger
                      </Typography>
                      <Typography variant="h4" fontWeight={700} mt={0.5}>
                        {views.toLocaleString()}
                      </Typography>
                    </Box>
                    <Visibility sx={{ opacity: 0.8 }} />
                  </Box>
                  {/* Mini sparkline */}
                  <Box sx={{ height: 40, mt: 1 }}>
                    <ReactECharts
                      option={{
                        grid: { left: 0, right: 0, top: 0, bottom: 0 },
                        xAxis: { type: 'category', show: false, data: dates },
                        yAxis: { type: 'value', show: false },
                        tooltip: {
                          trigger: 'axis',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderColor: '#667eea',
                          borderWidth: 2,
                          borderRadius: 6,
                          padding: [8, 12],
                          textStyle: { color: '#333', fontSize: 12, fontWeight: 600},
                          formatter: (params: any) => {
                            return `<div style="font-size: 11px; color: #999; margin-bottom: 4px;">${params[0].axisValue}</div><div style="font-size: 14px; font-weight: 700;">${params[0].value} visninger</div>`;
                          },
                        },
                        series: [{
                          type: 'line',
                          data: viewsData,
                          smooth: true,
                          symbol: 'circle',
                          symbolSize: 4,
                          showSymbol: false,
                          lineStyle: { color: 'rgba(255,255,255,0.8)', width: 2 },
                          areaStyle: { color: 'rgba(255,255,255,0.2)' },
                          emphasis: {
                            focus: 'series',
                            itemStyle: {
                              color: 'white',
                              borderColor: 'white',
                              borderWidth: 2,
                              shadowBlur: 10,
                              shadowColor: 'rgba(255,255,255,0.5)',
                            },
                          },
                        }]}}
                      style={{ height: '100%' }}
                      opts={{ renderer: 'svg' }}
                    />
                  </Box>
                </CardContent>
                </Card>
              </Grow>

              {/* Clicks Card */}
              <Grow in={true} timeout={800} style={{ transformOrigin: '0 0 0' }}>
                <Card
                  sx={{
                    flex: 1,
                    minWidth: 200,
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(240, 147, 251, 0.4)'}}
                >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500}}>
                        Klikk
                      </Typography>
                      <Typography variant="h4" fontWeight={700} mt={0.5}>
                        {clicks.toLocaleString()}
                      </Typography>
                    </Box>
                    <TouchApp sx={{ opacity: 0.8 }} />
                  </Box>
                  <Box sx={{ height: 40, mt: 1 }}>
                    <ReactECharts
                      option={{
                        grid: { left: 0, right: 0, top: 0, bottom: 0 },
                        xAxis: { type: 'category', show: false, data: dates },
                        yAxis: { type: 'value', show: false },
                        tooltip: {
                          trigger: 'axis',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderColor: '#f093fb',
                          borderWidth: 2,
                          borderRadius: 6,
                          padding: [8, 12],
                          textStyle: { color: '#333', fontSize: 12, fontWeight: 600},
                          formatter: (params: any) => {
                            return `<div style="font-size: 11px; color: #999; margin-bottom: 4px;">${params[0].axisValue}</div><div style="font-size: 14px; font-weight: 700;">${params[0].value} klikk</div>`;
                          },
                        },
                        series: [{
                          type: 'line',
                          data: clicksData,
                          smooth: true,
                          symbol: 'circle',
                          symbolSize: 4,
                          showSymbol: false,
                          lineStyle: { color: 'rgba(255,255,255,0.8)', width: 2 },
                          areaStyle: { color: 'rgba(255,255,255,0.2)' },
                          emphasis: {
                            focus: 'series',
                            itemStyle: {
                              color: 'white',
                              borderColor: 'white',
                              borderWidth: 2,
                              shadowBlur: 10,
                              shadowColor: 'rgba(255,255,255,0.5)',
                            },
                          },
                        }]}}
                      style={{ height: '100%' }}
                      opts={{ renderer: 'svg' }}
                    />
                  </Box>
                </CardContent>
                </Card>
              </Grow>

              {/* Enrollments Card */}
              <Grow in={true} timeout={1000} style={{ transformOrigin: '0 0 0' }}>
                <Card
                  sx={{
                    flex: 1,
                    minWidth: 200,
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(79, 172, 254, 0.4)'}}
                >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500}}>
                        Påmeldinger
                      </Typography>
                      <Typography variant="h4" fontWeight={700} mt={0.5}>
                        {enrollments.toLocaleString()}
                      </Typography>
                    </Box>
                    <CheckCircle sx={{ opacity: 0.8 }} />
                  </Box>
                  <Box sx={{ height: 40, mt: 1 }}>
                    <ReactECharts
                      option={{
                        grid: { left: 0, right: 0, top: 0, bottom: 0 },
                        xAxis: { type: 'category', show: false, data: dates },
                        yAxis: { type: 'value', show: false },
                        tooltip: {
                          trigger: 'axis',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderColor: '#4facfe',
                          borderWidth: 2,
                          borderRadius: 6,
                          padding: [8, 12],
                          textStyle: { color: '#333', fontSize: 12, fontWeight: 600},
                          formatter: (params: any) => {
                            return `<div style="font-size: 11px; color: #999; margin-bottom: 4px;">${params[0].axisValue}</div><div style="font-size: 14px; font-weight: 700;">${params[0].value} påmeldinger</div>`;
                          },
                        },
                        series: [{
                          type: 'line',
                          data: enrollmentsData,
                          smooth: true,
                          symbol: 'circle',
                          symbolSize: 4,
                          showSymbol: false,
                          lineStyle: { color: 'rgba(255,255,255,0.8)', width: 2 },
                          areaStyle: { color: 'rgba(255,255,255,0.2)' },
                          emphasis: {
                            focus: 'series',
                            itemStyle: {
                              color: 'white',
                              borderColor: 'white',
                              borderWidth: 2,
                              shadowBlur: 10,
                              shadowColor: 'rgba(255,255,255,0.5)',
                            },
                          },
                        }]}}
                      style={{ height: '100%' }}
                      opts={{ renderer: 'svg' }}
                    />
                  </Box>
                </CardContent>
                </Card>
              </Grow>

              {/* CTR Card */}
              <Grow in={true} timeout={1200} style={{ transformOrigin: '0 0 0' }}>
                <Card
                  sx={{
                    flex: 1,
                    minWidth: 200,
                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(250, 112, 154, 0.4)'}}
                >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500}}>
                        CTR
                      </Typography>
                      <Typography variant="h4" fontWeight={700} mt={0.5}>
                        {ctr}%
                      </Typography>
                    </Box>
                    <TrendingUp sx={{ opacity: 0.8 }} />
                  </Box>
                  <Box display="flex" alignItems="center" gap={1} mt={2}>
                    <LinearProgress
                      variant="determinate"
                      value={parseFloat(ctr)}
                      sx={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255,255,255,0.3)','& .MuiLinearProgress-bar': {
                          backgroundColor: 'white',
                          borderRadius: 3,
                        }}}
                    />
                  </Box>
                </CardContent>
                </Card>
              </Grow>
            </Box>

            {/* All Visualizations - Modern Design */}
            <Stack spacing={3}>
              {/* Trend Analysis */}
              <Fade in={true} timeout={1400}>
                <Card
                  sx={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden'}}
                >
                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Aktivitet over tid
                    </Typography>
                    <Box display="flex" gap={1} alignItems="center">
                      <Chip
                        label="Trend"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          fontWeight: 600}}
                      />
                      <Tooltip title="Last ned diagram">
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenExportMenu(e, 'line')}
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white', '&:hover': {
                              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                            }}}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  {timeSeriesData.length > 0 ? (
                    <ReactECharts
                      ref={lineChartRef}
                      option={lineChartOptions}
                      style={{ height: 400 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Ikke nok data for å vise trend
                    </Alert>
                  )}
                </CardContent>
                </Card>
              </Fade>

              {/* Hourly Distribution */}
              <Fade in={true} timeout={1600}>
                <Card
                  sx={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden'}}
                >
                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Aktivitet etter time på døgnet
                    </Typography>
                    <Box display="flex" gap={1} alignItems="center">
                      <Chip
                        label="Timefordeling"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                          color: 'white',
                          fontWeight: 600}}
                      />
                      <Tooltip title="Last ned diagram">
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenExportMenu(e, 'bar')}
                          sx={{
                            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                            color: 'white','&:hover': {
                              background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)',
                            }}}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  {hourlyData.length > 0 ? (
                    <ReactECharts
                      ref={barChartRef}
                      option={barChartOptions}
                      style={{ height: 400 }}
                      opts={{ renderer: 'canvas' }}
                    />
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Ikke nok data for å vise timefordeling
                    </Alert>
                  )}
                </CardContent>
                </Card>
              </Fade>

              {/* Conversion Funnel */}
              <Fade in={true} timeout={1800}>
                <Card
                  sx={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden'}}
                >
                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Konverteringstrakt
                    </Typography>
                    <Box display="flex" gap={1} alignItems="center">
                      <Chip
                        label="Konvertering"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                          color: 'white',
                          fontWeight: 600}}
                      />
                      <Tooltip title="Last ned diagram">
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenExportMenu(e, 'funnel')}
                          sx={{
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            color: 'white','&:hover': {
                              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
                            }}}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <ReactECharts
                    ref={funnelChartRef}
                    option={funnelChartOptions}
                    style={{ height: 400 }}
                    opts={{ renderer: 'canvas' }}
                  />
                  <Box mt={2} p={2} sx={{ backgroundColor: '#f8f9fa', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom fontWeight={600}>
                      Konverteringsrate
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <LinearProgress
                        variant="determinate"
                        value={parseFloat(conversionRate)}
                        sx={{
                          flex: 1,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#e0e0e0','& .MuiLinearProgress-bar': {
                            background: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
                            borderRadius: 5,
                          }}}
                      />
                      <Typography variant="h6" fontWeight={700} color="primary">
                        {conversionRate}%
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
                </Card>
              </Fade>

              {/* Recent Events */}
              <Fade in={true} timeout={2000}>
                <Card
                  sx={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden'}}
                >
                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Siste hendelser
                    </Typography>
                    <Chip
                      label={`${recentEvents.length} hendelser`}
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        color: 'white',
                        fontWeight: 600}}
                    />
                  </Box>
                  {recentEvents.length > 0 ? (
                    <Box sx={{
                      height: 300,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'hidden'}}>
                      <Virtuoso
                        data={recentEvents}
                        itemContent={(index, event) => (
                          <Box
                            key={event.id}
                            sx={{
                              p: 2,
                              borderBottom: index < recentEvents.length - 1 ? '1px solid' : 'none',
                              borderColor: 'divider','&:hover': {
                                backgroundColor: '#f8f9fa',
                              },
                              transition: 'background-color 0.2s'}}
                          >
                            <Box display="flex" alignItems="center" gap={2}>
                              <Box
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 2,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background:
                                    event.event_type === 'enrollment'
                                      ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                                      : event.event_type === 'click'
                                      ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white'}}
                              >
                                {getEventIcon(event.event_type)}
                              </Box>
                              <Box flex={1}>
                                <Typography variant="body2" fontWeight={600}>
                                  {getEventLabel(event.event_type)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(event.created_at).toLocaleString('nb-NO')}
                                </Typography>
                              </Box>
                              <Chip
                                label={event.event_type}
                                size="small"
                                sx={{
                                  fontWeight: 600,
                                  background:
                                    event.event_type === 'enrollment'
                                      ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                                      : event.event_type === 'click'
                                      ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  color: 'white'}}
                              />
                            </Box>
                          </Box>
                        )}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Ingen hendelser registrert ennå
                    </Alert>
                  )}
                </CardContent>
                </Card>
              </Fade>
            </Stack>

              {/* Edit History */}
              {post.edit_count > 0 && (
                <Fade in={true} timeout={2200}>
                  <Alert severity="info">
                    Dette innlegget har blitt redigert {post.edit_count} gang(er).
                  </Alert>
                </Fade>
              )}
            </Stack>
          ) : (
            <Alert severity="error">Kunne ikke laste statistikk</Alert>
          )
        ) : (
          // Comparison View
          <Stack spacing={3}>
            {/* Post Selection */}
            <Card
              sx={{
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                borderRadius: 3,
                overflow: 'hidden'}}
            >
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight={700}>
                    Velg innlegg å sammenligne
                  </Typography>
                  <Chip
                    label={`${selectedPosts.length}/5 valgt`}
                    size="small"
                    sx={{
                      background: selectedPosts.length > 0
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : '#e0e0e0',
                      color: selectedPosts.length > 0 ? 'white' : '#666',
                      fontWeight: 600}}
                  />
                </Box>
                {loadingPosts ? (
                  <LinearProgress sx={{ borderRadius: 1 }} />
                ) : (
                  <Box display="flex" flexWrap="wrap" gap={1.5}>
                    {allPosts.map((p) => {
                      const isSelected = selectedPosts.includes(p.id);
                      return (
                        <Chip
                          key={p.id}
                          label={`${p.course_title} - ${p.channel_name}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedPosts(selectedPosts.filter(id => id !== p.id));
                            } else if (selectedPosts.length < 5) {
                              setSelectedPosts([...selectedPosts, p.id]);
                            }
                          }}
                          sx={{
                            fontWeight: 600,
                            background: isSelected
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                              : 'white',
                            color: isSelected ? 'white' : '#333',
                            border: isSelected ? 'none' : '2px solid #e0e0e0','&:hover': {
                              background: isSelected
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : '#f8f9fa',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            },
                            transition: 'all 0.2s'}}
                        />
                      );
                    })}
                  </Box>
                )}
                {selectedPosts.length === 0 && (
                  <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                    Velg opptil 5 innlegg for å sammenligne ytelse
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Comparison Charts */}
            {selectedPosts.length > 0 && compareData.length > 0 && (
              <>
                {/* Metrics Comparison */}
                <Card
                  sx={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden'}}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>
                        Sammenligning av nøkkeltall
                      </Typography>
                      <Chip
                        label="Oversikt"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                          color: 'white',
                          fontWeight: 600}}
                      />
                    </Box>
                    <ReactECharts
                      option={{
                        tooltip: {
                          trigger: 'axis',
                          axisPointer: {
                            type: 'shadow',
                            shadowStyle: {
                              color: 'rgba(0, 0, 0, 0.05)'
                            }
                          },
                          backgroundColor: 'rgba(255, 255, 255, 0.98)',
                          borderColor: '#ddd',
                          borderWidth: 2,
                          borderRadius: 8,
                          padding: [12, 16],
                          textStyle: {
                            color: '#333',
                            fontSize: 13,
                            fontWeight: 500,
                          },
                          formatter: (params: any) => {
                            const postTitle = params[0].axisValue;
                            let result = `<div style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">${postTitle}</div>`;

                            params.forEach((param: any) => {
                              const color = param.color.colorStops ? param.color.colorStops[0].color : param.color;
                              result += `
                                <div style="display: flex; align-items: center; margin: 6px 0;">
                                  <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: ${color}; margin-right: 8px;"></span>
                                  <span style="flex: 1;">${param.seriesName}:</span>
                                  <span style="font-weight: 700; margin-left: 12px;">${param.value.toLocaleString()}</span>
                                </div>
                              `;
                            });

                            // Calculate metrics
                            const views = params.find((p: any) => p.seriesName === 'Visninger')?.value || 0;
                            const clicks = params.find((p: any) => p.seriesName === 'Klikk')?.value || 0;
                            const enrollments = params.find((p: any) => p.seriesName === 'Påmeldinger')?.value || 0;

                            if (views > 0) {
                              const ctr = ((clicks / views) * 100).toFixed(1);
                              const conv = clicks > 0 ? ((enrollments / clicks) * 100).toFixed(1) : '0.0';
                              result += `
                                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                                  <div>CTR: <strong>${ctr}%</strong></div>
                                  <div>Konvertering: <strong>${conv}%</strong></div>
                                </div>
                              `;
                            }

                            return result;
                          },
                        },
                        legend: {
                          data: ['Visninger','Klikk','Påmeldinger'],
                          bottom: 0,
                          textStyle: { fontWeight: 600},
                        },
                        grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
                        xAxis: {
                          type: 'category',
                          data: compareData.map(d => d.postInfo.course_title.substring(0, 20) + '...'),
                          axisLabel: { fontWeight: 600},
                        },
                        yAxis: { type: 'value' },
                        series: [
                          {
                            name: 'Visninger',
                            type: 'bar',
                            data: compareData.map(d => d.views_count || 0),
                            itemStyle: {
                              color: {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                  { offset: 0, color: '#667eea' },
                                  { offset: 1, color: '#764ba2' }
                                ],
                              },
                              borderRadius: [8, 8, 0, 0],
                            },
                          },
                          {
                            name: 'Klikk',
                            type: 'bar',
                            data: compareData.map(d => d.clicks_count || 0),
                            itemStyle: {
                              color: {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                  { offset: 0, color: '#f093fb' },
                                  { offset: 1, color: '#f5576c' }
                                ],
                              },
                              borderRadius: [8, 8, 0, 0],
                            },
                          },
                          {
                            name: 'Påmeldinger',
                            type: 'bar',
                            data: compareData.map(d => d.enrollments_from_post || 0),
                            itemStyle: {
                              color: {
                                type: 'linear',
                                x: 0, y: 0, x2: 0, y2: 1,
                                colorStops: [
                                  { offset: 0, color: '#4facfe' },
                                  { offset: 1, color: '#00f2fe' }
                                ],
                              },
                              borderRadius: [8, 8, 0, 0],
                            },
                          },
                        ]}}
                      style={{ height: 400 }}
                    />
                  </CardContent>
                </Card>

                {/* CTR & Conversion Rate Comparison */}
                <Card
                  sx={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden'}}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>
                        CTR og Konverteringsrate
                      </Typography>
                      <Chip
                        label="Ytelse"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                          color: 'white',
                          fontWeight: 600}}
                      />
                    </Box>
                    <ReactECharts
                      option={{
                        tooltip: {
                          trigger: 'axis',
                          axisPointer: {
                            type: 'cross',
                            label: {
                              backgroundColor: '#6a7985'
                            }
                          },
                          backgroundColor: 'rgba(255, 255, 255, 0.98)',
                          borderColor: '#ddd',
                          borderWidth: 2,
                          borderRadius: 8,
                          padding: [12, 16],
                          textStyle: {
                            color: '#333',
                            fontSize: 13,
                            fontWeight: 500,
                          },
                          formatter: (params: any) => {
                            const postTitle = params[0].axisValue;
                            let result = `<div style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">📊 ${postTitle}</div>`;

                            params.forEach((param: any) => {
                              const color = param.color.colorStops ? param.color.colorStops[0].color : param.color;
                              const icon = param.seriesName.includes('CTR') ? '👆' : '✅';
                              result += `
                                <div style="display: flex; align-items: center; margin: 6px 0;">
                                  <span style="margin-right: 6px;">${icon}</span>
                                  <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%;, background: ${color}; margin-right: 8px;"></span>
                                  <span style="flex: 1;">${param.seriesName}:</span>
                                  <span style="font-weight: 700; margin-left: 12px;">${param.value}%</span>
                                </div>
                              `;
                            });

                            result += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 11px; color: #999;">Høyere er bedre</div>`;

                            return result;
                          },
                        },
                        legend: {
                          data: ['CTR (%)','Konverteringsrate (%)'],
                          bottom: 0,
                          textStyle: { fontWeight: 600},
                        },
                        grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
                        xAxis: {
                          type: 'category',
                          data: compareData.map(d => d.postInfo.course_title.substring(0, 20) + '...'),
                          axisLabel: { fontWeight: 600},
                        },
                        yAxis: { type: 'value', max: 100 },
                        series: [
                          {
                            name: 'CTR (%)',
                            type: 'line',
                            data: compareData.map(d => {
                              const views = d.views_count || 0;
                              const clicks = d.clicks_count || 0;
                              return views > 0 ? ((clicks / views) * 100).toFixed(1) : 0;
                            }),
                            itemStyle: {
                              color: {
                                type: 'linear',
                                x: 0, y: 0, x2: 1, y2: 0,
                                colorStops: [
                                  { offset: 0, color: '#667eea' },
                                  { offset: 1, color: '#764ba2' }
                                ],
                              },
                            },
                            lineStyle: { width: 3 },
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 8,
                          },
                          {
                            name: 'Konverteringsrate (%)',
                            type: 'line',
                            data: compareData.map(d => {
                              const clicks = d.clicks_count || 0;
                              const enrollments = d.enrollments_from_post || 0;
                              return clicks > 0 ? ((enrollments / clicks) * 100).toFixed(1) : 0;
                            }),
                            itemStyle: {
                              color: {
                                type: 'linear',
                                x: 0, y: 0, x2: 1, y2: 0,
                                colorStops: [
                                  { offset: 0, color: '#4facfe' },
                                  { offset: 1, color: '#00f2fe' }
                                ],
                              },
                            },
                            lineStyle: { width: 3 },
                            smooth: true,
                            symbol: 'circle',
                            symbolSize: 8,
                          },
                        ]}}
                      style={{ height: 350 }}
                    />
                  </CardContent>
                </Card>

                {/* Performance Table */}
                <Card
                  sx={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    borderRadius: 3,
                    overflow: 'hidden'}}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6" fontWeight={700}>
                        Detaljert sammenligning
                      </Typography>
                      <Chip
                        label="Tabell"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                          color: 'white',
                          fontWeight: 600}}
                      />
                    </Box>
                    <Box sx={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa' }}>
                            <th style={{
                              padding: '16px',
                              textAlign: 'left',
                              fontWeight: 700,
                              borderRadius: '8px 0 0 8px'}}>
                              Kurs
                            </th>
                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 700}}>Visninger</th>
                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 700}}>Klikk</th>
                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 700}}>Påmeldinger</th>
                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 700}}>CTR</th>
                            <th style={{
                              padding: '16px',
                              textAlign: 'right',
                              fontWeight: 700,
                              borderRadius: '0 8px 8px 0'}}>
                              Konvertering
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareData.map((d, idx) => {
                            const views = d.views_count || 0;
                            const clicks = d.clicks_count || 0;
                            const enrollments = d.enrollments_from_post || 0;
                            const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0';
                            const conv = clicks > 0 ? ((enrollments / clicks) * 100).toFixed(1) : '0';

                            // Find best performers
                            const maxViews = Math.max(...compareData.map(d => d.views_count || 0));
                            const maxClicks = Math.max(...compareData.map(d => d.clicks_count || 0));
                            const maxEnrollments = Math.max(...compareData.map(d => d.enrollments_from_post || 0));

                            return (
                              <tr
                                key={idx}
                                style={{
                                  backgroundColor: 'white',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                  transition: 'all 0.2s'}}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                                }}
                              >
                                <td style={{
                                  padding: '16px',
                                  borderRadius: '8px 0 0 8px'}}>
                                  <Typography variant="body2" fontWeight={700}>
                                    {d.postInfo.course_title}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {d.postInfo.channel_name}
                                  </Typography>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                  <Chip
                                    label={views.toLocaleString()}
                                    size="small"
                                    sx={{
                                      fontWeight: 700,
                                      background: views === maxViews && views > 0
                                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                        : '#f0f0f0',
                                      color: views === maxViews && views > 0 ? 'white' : '#666'}}
                                  />
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                  <Chip
                                    label={clicks.toLocaleString()}
                                    size="small"
                                    sx={{
                                      fontWeight: 700,
                                      background: clicks === maxClicks && clicks > 0
                                        ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                                        : '#f0f0f0',
                                      color: clicks === maxClicks && clicks > 0 ? 'white' : '#666'}}
                                  />
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                  <Chip
                                    label={enrollments.toLocaleString()}
                                    size="small"
                                    sx={{
                                      fontWeight: 700,
                                      background: enrollments === maxEnrollments && enrollments > 0
                                        ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                                        : '#f0f0f0',
                                      color: enrollments === maxEnrollments && enrollments > 0 ? 'white' : '#666'}}
                                  />
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                  <Typography variant="body2" fontWeight={700}>
                                    {ctr}%
                                  </Typography>
                                </td>
                                <td style={{
                                  padding: '16px',
                                  textAlign: 'right',
                                  borderRadius: '0 8px 8px 0'}}>
                                  <Typography variant="body2" fontWeight={700}>
                                    {conv}%
                                  </Typography>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleCloseExportMenu}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }
        }}
      >
        {uploadingToDrive && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Laster opp til Google Drive...
            </Typography>
          </Box>
        )}
        {!uploadingToDrive && (
          <>
            <MenuItem onClick={() => handleExportChart('png')}>
              <ListItemIcon>
                <ImageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Last ned som PNG</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExportChart('jpg')}>
              <ListItemIcon>
                <ImageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Last ned som JPG</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExportChart('svg')}>
              <ListItemIcon>
                <PdfIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Last ned som SVG</ListItemText>
            </MenuItem>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={handleExportToGoogleDrive}>
              <ListItemIcon>
                <Box
                  component="img"
                  src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                  alt="Google Drive"
                  sx={{ width: 20, height: 20 }}
                />
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2" sx={{ fontWeight: 600}}>
                  Last opp til Google Drive
                </Typography>
              </ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Google Drive Upload Success Dialog */}
      <Dialog
        open={driveUploadResult !== null}
        onClose={handleCloseDriveSuccessDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              component="img"
              src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
              alt="Google Drive"
              sx={{ width: 32, height: 32 }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600}}>
              {driveUploadResult?.success ? '✅ Lastet opp til Google Drive!' : '❌ Opplasting feilet'}
            </Typography>
          </Stack>
          <IconButton
            onClick={handleCloseDriveSuccessDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8}}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {driveUploadResult?.success ? (
            <Stack spacing={2}>
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                Diagrammet ble lastet opp til Google Drive!
              </Alert>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Filnavn:</strong>
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {driveUploadResult.fileName}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Mappe:</strong>
                </Typography>
                <Typography variant="body1">
                  {driveUploadResult.folderPath}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              Kunne ikke laste opp til Google Drive. Prøv igjen senere.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleCloseDriveSuccessDialog}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Lukk
          </Button>
          {driveUploadResult?.success && driveUploadResult?.webViewLink && (
            <Button
              onClick={handleViewInDrive}
              variant="contained"
              startIcon={<OpenInNewIcon />}
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)', '&:hover': {
                  background:'linear-gradient(135deg, #3367d6 0%, #2d8e47 100%)',
                }}}
            >
              Vis i Google Drive
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default CoursePostAnalyticsDialog;
