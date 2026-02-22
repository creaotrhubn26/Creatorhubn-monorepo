/**
 * SWOT Visualizations
 * Interactive charts and heatmaps for SWOT analysis
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid2 as Grid,
  Stack,
  Chip,
} from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { useTheming } from '@/utils/theming-helper';
import { SWOTItem, SWOTTrend } from '@/services/BusinessIntelligenceService';

interface SWOTVisualizationsProps {
  items: SWOTItem[];
  trends: SWOTTrend[];
  scores: {
    brand: number;
    product: number;
    distribution: number;
    promotion: number;
    overall: number;
  };
}

export const SWOTVisualizations: React.FC<SWOTVisualizationsProps> = ({
  items,
  trends,
  scores,
}) => {
  const theming = useTheming();

  type HeatmapDatum = [number, number, number];
  type HeatmapTooltipParams = { data: HeatmapDatum };
  type BubbleDatum = { value: [number, number, number]; name: string; itemStyle: { color: string } };
  type BubbleTooltipParams = { data: BubbleDatum };

  // Prepare heatmap data - Impact vs Probability
  const getHeatmapData = () => {
    const impactLevels = ['low','medium','high','critical'];
    const types = ['strength','weakness','opportunity','threat'];

    const data: HeatmapDatum[] = [];

    types.forEach((type, typeIndex) => {
      impactLevels.forEach((impact, impactIndex) => {
        const count = items.filter(
          (item) => item.type === type && item.impact === impact
        ).length;

        if (count > 0) {
          data.push([typeIndex, impactIndex, count]);
        }
      });
    });

    return data;
  };

  // Heatmap Chart
  const heatmapOption = {
    tooltip: {
      position: 'top',
      formatter: (params: HeatmapTooltipParams) => {
        const types = ['Strength','Weakness','Opportunity','Threat'];
        const impacts = ['Low','Medium','High','Critical'];
        return `${types[params.data[0]]}<br/>${impacts[params.data[1]]} Impact: ${params.data[2]} items`;
      },
    },
    grid: {
      left: '15%',
      right: '10%',
      top: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'category',
      data: ['Strength','Weakness','Opportunity','Threat'],
      splitArea: {
        show: true,
      },
    },
    yAxis: {
      type: 'category',
      data: ['Low','Medium','High','Critical'],
      splitArea: {
        show: true,
      },
    },
    visualMap: {
      min: 0,
      max: 10,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#e3f2fd','#2196f3','#0d47a1'],
      },
    },
    series: [
      {
        name: 'SWOT Items',
        type: 'heatmap',
        data: getHeatmapData(),
        label: {
          show: true,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  // Radar Chart - Business Dimensions
  const radarOption = {
    title: {
      text: 'Business Performance Radar',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'item',
    },
    radar: {
      indicator: [
        { name: 'Brand', max: 100 },
        { name: 'Product', max: 100 },
        { name: 'Distribution', max: 100 },
        { name: 'Promotion', max: 100 },
      ],
      shape: 'polygon',
      splitNumber: 5,
      axisName: {
        color: '#666',
        fontSize: 12,
      },
      splitLine: {
        lineStyle: {
          color: ['#e0e0e0','#e0e0e0','#e0e0e0','#e0e0e0','#e0e0e0'],
        },
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(33, 150, 243, 0.05)','rgba(33, 150, 243, 0.1)'],
        },
      },
    },
    series: [
      {
        name: 'Business Scores',
        type: 'radar',
        data: [
          {
            value: [scores.brand, scores.product, scores.distribution, scores.promotion],
            name: 'Current Performance',
            areaStyle: {
              color: 'rgba(33, 150, 243, 0.3)',
            },
            lineStyle: {
              color: theming.colors.primary,
              width: 2,
            },
          },
        ],
      },
    ],
  };

  // Trend Line Chart - SWOT Over Time
  const trendOption = {
    title: {
      text: 'SWOT Trends Over Time',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    legend: {
      data: ['Opportunities Converted','Weaknesses Resolved','Strength Score','Threat Score'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trends.map((t) => t.date),
    },
    yAxis: [
      {
        type: 'value',
        name: 'Count',
        position: 'left',
      },
      {
        type: 'value',
        name: 'Score',
        position: 'right',
      },
    ],
    series: [
      {
        name: 'Opportunities Converted',
        type: 'line',
        data: trends.map((t) => t.opportunitiesConverted),
        smooth: true,
        lineStyle: {
          color: '#4caf50',
          width: 3,
        },
        itemStyle: {
          color: '#4caf50',
        },
        areaStyle: {
          color: 'rgba(76, 175, 80, 0.2)',
        },
      },
      {
        name: 'Weaknesses Resolved',
        type: 'line',
        data: trends.map((t) => t.weaknessesResolved),
        smooth: true,
        lineStyle: {
          color: '#2196f3',
          width: 3,
        },
        itemStyle: {
          color: '#2196f3',
        },
        areaStyle: {
          color: 'rgba(33, 150, 243, 0.2)',
        },
      },
      {
        name: 'Strength Score',
        type: 'line',
        yAxisIndex: 1,
        data: trends.map((t) => t.strengthScore),
        smooth: true,
        lineStyle: {
          color: '#ff9800',
          width: 2,
          type: 'dashed',
        },
        itemStyle: {
          color: '#ff9800',
        },
      },
      {
        name: 'Threat Score',
        type: 'line',
        yAxisIndex: 1,
        data: trends.map((t) => t.threatScore),
        smooth: true,
        lineStyle: {
          color: '#f44336',
          width: 2,
          type: 'dashed',
        },
        itemStyle: {
          color: '#f44336',
        },
      },
    ],
  };

  // Bubble Chart - Impact vs Probability
  const bubbleData: BubbleDatum[] = items.map((item) => {
    const impactValue = { low: 25, medium: 50, high: 75, critical: 100 }[item.impact];
    const typeColor = {
      strength: '#4caf50',
      weakness: '#f44336',
      opportunity: '#2196f3',
      threat: '#ff9800',
    }[item.type];

    return {
      value: [impactValue, item.probability, 1],
      name: item.title,
      itemStyle: { color: typeColor },
    };
  });

  const bubbleOption = {
    title: {
      text: 'Impact vs Probability Matrix',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: BubbleTooltipParams) => {
        return `${params.data.name}<br/>Impact: ${params.data.value[0]}<br/>Probability: ${params.data.value[1]}%`;
      },
    },
    grid: {
      left: '10%',
      right: '10%',
      top: '15%',
      bottom: '10%',
    },
    xAxis: {
      name: 'Impact',
      nameLocation: 'middle',
      nameGap: 30,
      min: 0,
      max: 100,
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    yAxis: {
      name: 'Probability (%)',
      nameLocation: 'middle',
      nameGap: 40,
      min: 0,
      max: 100,
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (data: number[]) => Math.sqrt(data[2] ?? 1) * 20,
        data: bubbleData,
        emphasis: {
          focus: 'self',
          label: {
            show: true,
            formatter: (params: BubbleTooltipParams) => params.data.name,
            position: 'top',
          },
        },
      },
    ],
  };

  return (
    <Box role="region" aria-label="SWOT-analyse visualiseringer">
      <Typography variant="h6" component="h2" fontWeight="bold" color={theming.colors.primary} mb={3}>
        SWOT-analyse og visualiseringer
      </Typography>

      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            role="article"
            aria-label={`Styrker identifisert: ${items.filter((i) => i.type === 'strength').length}`}
            tabIndex={0}
            sx={{
              ...theming.getThemedCardSx(), '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            <CardContent>
              <Typography variant="h4" fontWeight="bold" color="#4caf50" aria-hidden="true">
                {items.filter((i) => i.type === 'strength').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Styrker identifisert
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            role="article"
            aria-label={`Svakheter å adressere: ${items.filter((i) => i.type === 'weakness').length}`}
            tabIndex={0}
            sx={{
              ...theming.getThemedCardSx(), '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            <CardContent>
              <Typography variant="h4" fontWeight="bold" color="#f44336" aria-hidden="true">
                {items.filter((i) => i.type === 'weakness').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Svakheter å adressere
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            role="article"
            aria-label={`Muligheter tilgjengelig: ${items.filter((i) => i.type === 'opportunity').length}`}
            tabIndex={0}
            sx={{
              ...theming.getThemedCardSx(), '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            <CardContent>
              <Typography variant="h4" fontWeight="bold" color="#2196f3" aria-hidden="true">
                {items.filter((i) => i.type === 'opportunity').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Muligheter tilgjengelig
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            role="article"
            aria-label={`Trusler å overvåke: ${items.filter((i) => i.type === 'threat').length}`}
            tabIndex={0}
            sx={{
              ...theming.getThemedCardSx(), '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              }}}
          >
            <CardContent>
              <Typography variant="h4" fontWeight="bold" color="#ff9800" aria-hidden="true">
                {items.filter((i) => i.type === 'threat').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Trusler å overvåke
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Radar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={theming.getThemedCardSx()} role="img" aria-label="Radardiagram for forretningsytelse">
            <CardContent>
              <ReactECharts option={radarOption} style={{ height: '400px' }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Bubble Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={theming.getThemedCardSx()} role="img" aria-label="Boblediagram for SWOT-elementer">
            <CardContent>
              <ReactECharts option={bubbleOption} style={{ height: '400px' }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Heatmap */}
        <Grid size={12}>
          <Card sx={theming.getThemedCardSx()} role="img" aria-label="Varmekart for SWOT-påvirkning">
            <CardContent>
              <ReactECharts option={heatmapOption} style={{ height: '400px' }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Trend Chart */}
        <Grid size={12}>
          <Card sx={theming.getThemedCardSx()} role="img" aria-label="Trenddiagram for SWOT over tid">
            <CardContent>
              <ReactECharts option={trendOption} style={{ height: '400px' }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SWOTVisualizations;
