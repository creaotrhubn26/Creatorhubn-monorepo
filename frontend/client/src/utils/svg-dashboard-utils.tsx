/**
 * SVG Dashboard Utilities
 *
 * Specialized SVG rendering utilities for UniversalDashboard component
 * KPIs, metrics, charts, analytics visualizations, and notification indicators
 */

import DOMPurify from 'dompurify';

// KPI and Metrics Visualization
export const kpiUtils = {
  /**
   * Creates a circular KPI indicator with value and label
   */
  createKPICircle: (
    cx: number,
    cy: number,
    radius: number,
    value: number,
    max: number,
    label: string,
    color: string,
    unit: string = '',
  ): string => {
    const percentage = (value / max) * 100;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const kpi = `
      <g>
        <circle cx="${cx}" cy="${cy}" r="${radius}" 
                fill="none" stroke="rgba(255,255,255,0.1)" 
                stroke-width="8" />
        <circle cx="${cx}" cy="${cy}" r="${radius}" 
                fill="none" stroke="${color}" 
                stroke-width="8" 
                stroke-dasharray="${circumference}" 
                stroke-dashoffset="${strokeDashoffset}" 
                stroke-linecap="round" 
                transform="rotate(-90 ${cx} ${cy})" />
        <text x="${cx}" y="${cy - 8}" 
              text-anchor="middle" fill="${color}" 
              font-size="24" font-family="Arial, sans-serif" font-weight="bold">${value}${unit}</text>
        <text x="${cx}" y="${cy + 12}" 
              text-anchor="middle" fill="rgba(255,255,255,0.7)" 
              font-size="12" font-family="Arial, sans-serif">${label}</text>
      </g>
    `;

    return DOMPurify.sanitize(kpi);
  },

  /**
   * Creates a compact stat card with icon and trend
   */
  createStatCard: (
    x: number,
    y: number,
    width: number,
    height: number,
    value: string,
    label: string,
    trend: number,
    color: string,
  ): string => {
    const trendColor = trend >= 0 ? '#4caf50' : '#f44336';
    const trendArrow = trend >= 0 ? '▲' : '▼';

    const card = `
      <rect x="${x}" y="${y}" width="${width}" height="${height}" 
            rx="8" fill="rgba(255,255,255,0.05)" 
            stroke="${color}" stroke-width="2" />
      <text x="${x + width / 2}" y="${y + height / 2 - 5}" 
            text-anchor="middle" fill="${color}" 
            font-size="28" font-family="Arial, sans-serif" font-weight="bold">${value}</text>
      <text x="${x + width / 2}" y="${y + height / 2 + 15}" 
            text-anchor="middle" fill="rgba(255,255,255,0.6)" 
            font-size="12" font-family="Arial, sans-serif">${label}</text>
      <text x="${x + width / 2}" y="${y + height / 2 + 30}" 
            text-anchor="middle" fill="${trendColor}" 
            font-size="10" font-family="Arial, sans-serif">${trendArrow} ${Math.abs(trend)}%</text>
    `;

    return DOMPurify.sanitize(card);
  },

  /**
   * Creates a revenue gauge with currency formatting
   */
  createRevenueGauge: (
    cx: number,
    cy: number,
    radius: number,
    current: number,
    target: number,
    currency: string = 'kr',
  ): string => {
    const percentage = Math.min((current / target) * 100, 100);
    const circumference = Math.PI * radius; // Half circle
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const gauge = `
      <g>
        <path d="M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}" 
              fill="none" stroke="rgba(255,255,255,0.1)" 
              stroke-width="12" stroke-linecap="round" />
        <path d="M ${cx - radius},${cy} A ${radius},${radius} 0 0,1 ${cx + radius},${cy}" 
              fill="none" stroke="#4caf50" 
              stroke-width="12" 
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${strokeDashoffset}" 
              stroke-linecap="round" />
        <text x="${cx}" y="${cy - 10}" 
              text-anchor="middle" fill="#4caf50" 
              font-size="28" font-family="Arial, sans-serif" font-weight="bold">${current}${currency}</text>
        <text x="${cx}" y="${cy + 10}" 
              text-anchor="middle" fill="rgba(255,255,255,0.5)" 
              font-size="12" font-family="Arial, sans-serif">of ${target}${currency}</text>
        <text x="${cx}" y="${cy + 25}" 
              text-anchor="middle" fill="rgba(255,255,255,0.7)" 
              font-size="14" font-family="Arial, sans-serif">${percentage.toFixed(0)}%</text>
      </g>
    `;

    return DOMPurify.sanitize(gauge);
  },

  /**
   * Creates a mini line chart for trend visualization
   */
  createMiniLineChart: (
    x: number,
    y: number,
    width: number,
    height: number,
    data: number[],
    color: string,
  ): string => {
    if (data.length < 2) return '';

    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;
    const stepX = width / (data.length - 1);

    let pathData = '';
    data.forEach((value, index) => {
      const pointX = x + index * stepX;
      const pointY = y + height - ((value - minValue) / range) * height;
      pathData += index === 0 ? `M ${pointX},${pointY}` : ` L ${pointX},${pointY}`;
    });

    const chart = `
      <path d="${pathData}" 
            fill="none" stroke="${color}" 
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    `;

    return DOMPurify.sanitize(chart);
  },
};

// Chart utilities for dashboard analytics
export const chartUtils = {
  /**
   * Creates a donut chart for category breakdown
   */
  createDonutChart: (
    cx: number,
    cy: number,
    radius: number,
    data: Array<{ value: number; color: string; label: string }>,
  ): string => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return '';

    let currentAngle = -90; // Start from top
    let paths = '';

    data.forEach((item) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const endAngle = currentAngle + angle;

      const startRad = (currentAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const innerRadius = radius * 0.6;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      const x3 = cx + innerRadius * Math.cos(endRad);
      const y3 = cy + innerRadius * Math.sin(endRad);
      const x4 = cx + innerRadius * Math.cos(startRad);
      const y4 = cy + innerRadius * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;

      paths += `
        <path d="M ${x1},${y1} A ${radius},${radius} 0 ${largeArc},1 ${x2},${y2} 
                 L ${x3},${y3} A ${innerRadius},${innerRadius} 0 ${largeArc},0 ${x4},${y4} Z" 
              fill="${item.color}" />
      `;

      currentAngle = endAngle;
    });

    // Center label
    paths += `
      <text x="${cx}" y="${cy + 5}" 
            text-anchor="middle" fill="rgba(255,255,255,0.9)" 
            font-size="16" font-family="Arial, sans-serif" font-weight="bold">${total}</text>
    `;

    return DOMPurify.sanitize(paths);
  },

  /**
   * Creates a horizontal bar chart
   */
  createHorizontalBarChart: (
    x: number,
    y: number,
    width: number,
    height: number,
    data: Array<{ label: string; value: number; max: number; color: string }>,
  ): string => {
    const barHeight = (height - (data.length - 1) * 10) / data.length;
    let bars = '';

    data.forEach((item, index) => {
      const barY = y + index * (barHeight + 10);
      const barWidth = (item.value / item.max) * width;

      bars += `
        <rect x="${x}" y="${barY}" width="${width}" height="${barHeight}" 
              rx="4" fill="rgba(255,255,255,0.05)" />
        <rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" 
              rx="4" fill="${item.color}" />
        <text x="${x + 5}" y="${barY + barHeight / 2 + 4}" 
              fill="#fff" font-size="11" font-family="Arial, sans-serif">${item.label}</text>
        <text x="${x + width - 5}" y="${barY + barHeight / 2 + 4}" 
              text-anchor="end" fill="#fff" font-size="11" font-family="Arial, sans-serif">${item.value}</text>
      `;
    });

    return DOMPurify.sanitize(bars);
  },

  /**
   * Creates a sparkline for compact trend display
   */
  createSparkline: (
    x: number,
    y: number,
    width: number,
    height: number,
    data: number[],
    color: string,
    showDots: boolean = false,
  ): string => {
    if (data.length < 2) return '';

    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;
    const stepX = width / (data.length - 1);

    let pathData = '';
    let dots = '';

    data.forEach((value, index) => {
      const pointX = x + index * stepX;
      const pointY = y + height - ((value - minValue) / range) * height;
      pathData += index === 0 ? `M ${pointX},${pointY}` : ` L ${pointX},${pointY}`;

      if (showDots) {
        dots += `<circle cx="${pointX}" cy="${pointY}" r="2" fill="${color}" />`;
      }
    });

    // Add area fill
    const areaPath = `${pathData} L ${x + width},${y + height} L ${x},${y + height} Z`;

    const sparkline = `
      <path d="${areaPath}" fill="${color}" fill-opacity="0.2" />
      <path d="${pathData}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" />
      ${dots}
    `;

    return DOMPurify.sanitize(sparkline);
  },
};

// Notification and alert indicators
export const notificationUtils = {
  /**
   * Creates a notification badge with count
   */
  createNotificationBadge: (
    cx: number,
    cy: number,
    radius: number,
    count: number,
    color: string,
  ): string => {
    const displayCount = count > 99 ? '99+' : count.toString();

    const badge = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" />
      <circle cx="${cx}" cy="${cy}" r="${radius - 2}" fill="${color}" 
              stroke="#fff" stroke-width="2" />
      <text x="${cx}" y="${cy + 4}" 
            text-anchor="middle" fill="#fff" 
            font-size="${count > 99 ? '8' : '10'}" 
            font-family="Arial, sans-serif" font-weight="bold">${displayCount}</text>
    `;

    return DOMPurify.sanitize(badge);
  },

  /**
   * Creates a priority indicator (low, medium, high, urgent)
   */
  createPriorityIndicator: (
    x: number,
    y: number,
    size: number,
    priority: 'low' | 'medium' | 'high' | 'urgent',
  ): string => {
    const colors = {
      low: '#4caf50',
      medium: '#ff9800',
      high: '#ff5722',
      urgent: '#f44336',
    };

    const color = colors[priority];
    const bars =
      priority === 'urgent' ? 3 : priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;

    let indicator = '';
    for (let i = 0; i < 3; i++) {
      const opacity = i < bars ? 1 : 0.2;
      indicator += `
        <rect x="${x + i * (size / 3 + 2)}" y="${y + (2 - i) * (size / 4)}" 
              width="${size / 3}" height="${size - (2 - i) * (size / 4)}" 
              rx="1" fill="${color}" opacity="${opacity}" />
      `;
    }

    return DOMPurify.sanitize(indicator);
  },

  /**
   * Creates a deadline countdown ring
   */
  createDeadlineCountdown: (
    cx: number,
    cy: number,
    radius: number,
    hoursLeft: number,
    totalHours: number,
  ): string => {
    const percentage = (hoursLeft / totalHours) * 100;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const isUrgent = hoursLeft <= 24;
    const color = isUrgent ? '#f44336' : hoursLeft <= 72 ? '#ff9800' : '#4caf50';

    const countdown = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" 
              fill="none" stroke="rgba(255,255,255,0.1)" 
              stroke-width="4" />
      <circle cx="${cx}" cy="${cy}" r="${radius}" 
              fill="none" stroke="${color}" 
              stroke-width="4" 
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${strokeDashoffset}" 
              stroke-linecap="round" 
              transform="rotate(-90 ${cx} ${cy})">
        ${isUrgent ? `<animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />` : ''}
      </circle>
      <text x="${cx}" y="${cy + 5}" 
            text-anchor="middle" fill="${color}" 
            font-size="12" font-family="Arial, sans-serif" font-weight="bold">${Math.floor(hoursLeft)}h</text>
    `;

    return DOMPurify.sanitize(countdown);
  },

  /**
   * Creates a status indicator dot with pulse animation
   */
  createStatusDot: (
    cx: number,
    cy: number,
    radius: number,
    status: 'online' | 'busy' | 'away' | 'offline',
  ): string => {
    const colors = {
      online: '#4caf50',
      busy: '#f44336',
      away: '#ff9800',
      offline: '#9e9e9e',
    };

    const color = colors[status];
    const shouldPulse = status === 'online' || status === 'busy';

    const dot = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}">
        ${
          shouldPulse
            ? `
          <animate attributeName="r" 
                   values="${radius};${radius * 1.3};${radius}" 
                   dur="2s" 
                   repeatCount="indefinite" />
          <animate attributeName="opacity" 
                   values="1;0.7;1" 
                   dur="2s" 
                   repeatCount="indefinite" />
        `
            : ''
        }
      </circle>
    `;

    return DOMPurify.sanitize(dot);
  },
};

// Activity and timeline utilities
export const activityUtils = {
  /**
   * Creates an activity timeline marker
   */
  createTimelineMarker: (
    cx: number,
    cy: number,
    radius: number,
    type: 'start' | 'milestone' | 'end',
    color: string,
  ): string => {
    let marker = '';

    switch (type) {
      case 'start':
        marker = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="#fff" stroke-width="2" />`;
        break;
      case 'milestone':
        marker = `<rect x="${cx - radius}" y="${cy - radius}" width="${radius * 2}" height="${radius * 2}" 
                       rx="2" fill="${color}" stroke="#fff" stroke-width="2" transform="rotate(45 ${cx} ${cy})" />`;
        break;
      case 'end':
        marker = `
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}" stroke="#fff" stroke-width="2" />
          <circle cx="${cx}" cy="${cy}" r="${radius * 0.5}" fill="#fff" />
        `;
        break;
    }

    return DOMPurify.sanitize(marker);
  },

  /**
   * Creates a completion percentage arc
   */
  createCompletionArc: (
    cx: number,
    cy: number,
    radius: number,
    percentage: number,
    color: string,
  ): string => {
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const arc = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" 
              fill="none" stroke="rgba(255,255,255,0.1)" 
              stroke-width="6" />
      <circle cx="${cx}" cy="${cy}" r="${radius}" 
              fill="none" stroke="${color}" 
              stroke-width="6" 
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${strokeDashoffset}" 
              stroke-linecap="round" 
              transform="rotate(-90 ${cx} ${cy})" />
      <text x="${cx}" y="${cy + 5}" 
            text-anchor="middle" fill="${color}" 
            font-size="16" font-family="Arial, sans-serif" font-weight="bold">${percentage}%</text>
    `;

    return DOMPurify.sanitize(arc);
  },

  /**
   * Creates a project health indicator (traffic light style)
   */
  createHealthIndicator: (
    x: number,
    y: number,
    height: number,
    health: 'good' | 'warning' | 'critical',
  ): string => {
    const statuses = {
      good: { color: '#4caf50', active: 0 },
      warning: { color: '#ff9800', active: 1 },
      critical: { color: '#f44336', active: 2 },
    };

    const status = statuses[health];
    const dotRadius = height / 8;
    const dotSpacing = height / 3;

    let indicator ='';
    for (let i = 0; i < 3; i++) {
      const opacity = i === status.active ? 1 : 0.2;
      const cy = y + i * dotSpacing + dotRadius;
      indicator += `<circle cx="${x}" cy="${cy}" r="${dotRadius}" fill="${status.color}" opacity="${opacity}" />`;
    }

    return DOMPurify.sanitize(indicator);
  },
};

export default {
  kpiUtils,
  chartUtils,
  notificationUtils,
  activityUtils,
};
