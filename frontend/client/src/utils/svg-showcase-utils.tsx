/**
 * SVG Showcase Utilities
 *
 * Specialized SVG rendering utilities for UniversalShowcase component
 * Extracted patterns for media overlays, stats visualization, and indicators
 */

import DOMPurify from 'dompurify';

// Showcase utilities for media overlays and indicators
export const showcaseUtils = {
  /**
   * Creates a circular play button overlay for video thumbnails
   */
  createPlayButtonOverlay: (
    cx: number,
    cy: number,
    radius: number,
    color: string = '#fff',
  ): string => {
    const bgCircle = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(0,0,0,0.7)" />`;

    // Play triangle (pointing right)
    const triangleSize = radius * 0.5;
    const trianglePoints = [
      [cx - triangleSize * 0.3, cy - triangleSize],
      [cx + triangleSize * 0.7, cy],
      [cx - triangleSize * 0.3, cy + triangleSize],
    ];
    const trianglePath = `<path d="M ${trianglePoints.map((p) => p.join('')).join(' L ')} Z" fill="${color}" />`;

    return DOMPurify.sanitize(bgCircle + trianglePath);
  },

  /**
   * Creates a duration badge for video content
   */
  createDurationBadge: (
    x: number,
    y: number,
    duration: string,
    backgroundColor: string = 'rgba(0,0,0,0.8)',
  ): string => {
    const width = 50;
    const height = 20;
    const borderRadius = 4;

    const badge = `
      <rect x="${x}" y="${y}" width="${width}" height="${height}" 
            rx="${borderRadius}" fill="${backgroundColor}" />
      <text x="${x + width / 2}" y="${y + height / 2 + 4}" 
            text-anchor="middle" fill="#fff" 
            font-size="11" font-family="Arial, sans-serif">${duration}</text>
    `;

    return DOMPurify.sanitize(badge);
  },

  /**
   * Creates a watermark overlay
   */
  createWatermarkOverlay: (
    text: string,
    x: number,
    y: number,
    opacity: number = 0.7,
    fontSize: number = 12,
  ): string => {
    const watermark = `
      <text x="${x}" y="${y}" 
            fill="rgba(255,255,255,${opacity})" 
            font-size="${fontSize}" 
            font-family="Arial, sans-serif"
            font-weight="500">${text}</text>
    `;

    return DOMPurify.sanitize(watermark);
  },

  /**
   * Creates engagement stats visualization (views, likes, etc.)
   */
  createEngagementRing: (
    cx: number,
    cy: number,
    radius: number,
    percentage: number,
    color: string,
  ): string => {
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const ring = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" 
              fill="none" stroke="rgba(255,255,255,0.1)" 
              stroke-width="2" />
      <circle cx="${cx}" cy="${cy}" r="${radius}" 
              fill="none" stroke="${color}" 
              stroke-width="2" 
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${strokeDashoffset}" 
              stroke-linecap="round" 
              transform="rotate(-90 ${cx} ${cy})" />
    `;

    return DOMPurify.sanitize(ring);
  },

  /**
   * Creates a selection indicator checkmark
   */
  createSelectionCheckmark: (cx: number, cy: number, size: number, color: string): string => {
    const checkPath = `
      <circle cx="${cx}" cy="${cy}" r="${size}" fill="${color}" />
      <path d="M ${cx - size * 0.4},${cy} L ${cx - size * 0.15},${cy + size * 0.35} L ${cx + size * 0.45},${cy - size * 0.35}" 
            stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    `;

    return DOMPurify.sanitize(checkPath);
  },

  /**
   * Creates a media type icon overlay (photo, video, audio, document)
   */
  createMediaTypeIcon: (
    cx: number,
    cy: number,
    radius: number,
    mediaType: 'photo' | 'video' | 'audio' | 'document',
  ): string => {
    const bgCircle = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="rgba(0,0,0,0.7)" />`;

    let iconPath = '';
    switch (mediaType) {
      case 'video':
        // Play triangle
        iconPath = `<path d="M ${cx - radius * 0.3},${cy - radius * 0.4} L ${cx + radius * 0.4},${cy} L ${cx - radius * 0.3},${cy + radius * 0.4} Z" fill="#fff" />`;
        break;
      case 'audio':
        // Music note
        iconPath = `<path d="M ${cx - radius * 0.2},${cy + radius * 0.3} Q ${cx - radius * 0.2},${cy - radius * 0.3} ${cx + radius * 0.2},${cy - radius * 0.4} L ${cx + radius * 0.2},${cy + radius * 0.2} Q ${cx + radius * 0.2},${cy + radius * 0.4} ${cx},${cy + radius * 0.4} Q ${cx - radius * 0.2},${cy + radius * 0.4} ${cx - radius * 0.2},${cy + radius * 0.3} Z" fill="#fff" />`;
        break;
      case 'document':
        // Document icon
        iconPath = `<rect x="${cx - radius * 0.3}" y="${cy - radius * 0.4}" width="${radius * 0.6}" height="${radius * 0.8}" rx="2" fill="#fff" />`;
        break;
      case 'photo':
      default:
        // Camera/fullscreen icon
        iconPath = `<rect x="${cx - radius * 0.4}" y="${cy - radius * 0.4}" width="${radius * 0.8}" height="${radius * 0.8}" rx="2" stroke="#fff" stroke-width="2" fill="none" />`;
    }

    return DOMPurify.sanitize(bgCircle + iconPath);
  },
};

// Stats visualization utilities
export const statsUtils = {
  /**
   * Creates a compact stat badge with icon and number
   */
  createStatBadge: (
    x: number,
    y: number,
    iconPath: string,
    value: string | number,
    color: string,
  ): string => {
    const badge = `
      <g>
        <path d="${iconPath}" fill="${color}" transform="translate(${x}, ${y})" />
        <text x="${x + 20}" y="${y + 12}" fill="${color}" 
              font-size="12" font-family="Arial, sans-serif">${value}</text>
      </g>
    `;

    return DOMPurify.sanitize(badge);
  },

  /**
   * Creates a mini bar chart for quick stats visualization
   */
  createMiniBarChart: (
    x: number,
    y: number,
    values: number[],
    width: number,
    height: number,
    color: string,
  ): string => {
    const maxValue = Math.max(...values);
    const barWidth = width / values.length;

    let bars = ', ';
    values.forEach((value, index) => {
      const barHeight = (value / maxValue) * height;
      const barX = x + index * barWidth;
      const barY = y + height - barHeight;
      bars += `<rect x="${barX}" y="${barY}" width="${barWidth * 0.8}" height="${barHeight}" fill="${color}" rx="2" />`;
    });

    return DOMPurify.sanitize(bars);
  },

  /**
   * Creates a trend indicator (up/down arrow with percentage)
   */
  createTrendIndicator: (x: number, y: number, percentage: number, size: number = 12): string => {
    const isPositive = percentage >= 0;
    const color = isPositive ? '#4caf50' : '#f44336';
    const arrowPath = isPositive
      ? `M ${x},${y + size / 2} L ${x + size / 2},${y} L ${x + size},${y + size / 2}` // Up arrow
      : `M ${x},${y} L ${x + size / 2},${y + size / 2} L ${x + size},${y}`; // Down arrow

    const indicator = `
      <path d="${arrowPath}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <text x="${x + size + 5}" y="${y + size / 2 + 4}" fill="${color}" 
            font-size="10" font-family="Arial, sans-serif">${Math.abs(percentage)}%</text>
    `;

    return DOMPurify.sanitize(indicator);
  },

  /**
   * Creates a views/likes counter with icon
   */
  createEngagementCounter: (
    x: number,
    y: number,
    type: 'views' | 'likes' | 'downloads',
    count: number,
    color: string,
  ): string => {
    let iconPath = '';
    switch (type) {
      case 'views':
        // Eye icon
        iconPath = `<ellipse cx="${x + 7}" cy="${y + 7}" rx="7" ry="4" fill="none" stroke="${color}" stroke-width="1.5" /><circle cx="${x + 7}" cy="${y + 7}" r="2" fill="${color}" />`;
        break;
      case 'likes':
        // Heart icon
        iconPath = `<path d="M ${x + 7},${y + 12} L ${x + 2},${y + 7} Q ${x},${y + 4} ${x + 3.5},${y + 4} Q ${x + 7},${y + 4} ${x + 7},${y + 7} Q ${x + 7},${y + 4} ${x + 10.5},${y + 4} Q ${x + 14},${y + 4} ${x + 12},${y + 7} Z" fill="${color}" />`;
        break;
      case 'downloads':
        // Download icon
        iconPath = `<path d="M ${x + 7},${y + 2} L ${x + 7},${y + 10} M ${x + 4},${y + 7} L ${x + 7},${y + 10} L ${x + 10},${y + 7} M ${x + 3},${y + 12} L ${x + 11},${y + 12}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" />`;
        break;
    }

    const counter = `
      <g>
        ${iconPath}
        <text x="${x + 18}" y="${y + 10}" fill="${color}" 
              font-size="11" font-family="Arial, sans-serif">${count}</text>
      </g>
    `;

    return DOMPurify.sanitize(counter);
  },
};

// Loading and processing indicators
export const loadingUtils = {
  /**
   * Creates an animated spinner
   */
  createSpinner: (cx: number, cy: number, radius: number, color: string): string => {
    const spinner = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" 
              fill="none" stroke="${color}" 
              stroke-width="3" 
              stroke-dasharray="${Math.PI * radius}" 
              stroke-linecap="round">
        <animateTransform 
          attributeName="transform" 
          type="rotate" 
          from="0 ${cx} ${cy}" 
          to="360 ${cx} ${cy}" 
          dur="1s" 
          repeatCount="indefinite" />
      </circle>
    `;

    return DOMPurify.sanitize(spinner);
  },

  /**
   * Creates a pulsing dot indicator
   */
  createPulsingDot: (cx: number, cy: number, radius: number, color: string): string => {
    const dot = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${color}">
        <animate attributeName="opacity" 
                 values="1;0.3;1" 
                 dur="1.5s" 
                 repeatCount="indefinite" />
        <animate attributeName="r" 
                 values="${radius};${radius * 1.2};${radius}" 
                 dur="1.5s" 
                 repeatCount="indefinite" />
      </circle>
    `;

    return DOMPurify.sanitize(dot);
  },

  /**
   * Creates a processing progress bar
   */
  createProgressBar: (
    x: number,
    y: number,
    width: number,
    height: number,
    percentage: number,
    color: string,
  ): string => {
    const fillWidth = (width * percentage) / 100;

    const progressBar = `
      <rect x="${x}" y="${y}" width="${width}" height="${height}" 
            rx="${height / 2}" fill="rgba(255,255,255,0.1)" />
      <rect x="${x}" y="${y}" width="${fillWidth}" height="${height}" 
            rx="${height / 2}" fill="${color}">
        <animate attributeName="width" 
                 from="0" 
                 to="${fillWidth}" 
                 dur="0.5s" 
                 fill="freeze" />
      </rect>
      <text x="${x + width / 2}" y="${y + height / 2 + 3}" 
            text-anchor="middle" fill="#fff" 
            font-size="10" font-family="Arial, sans-serif">${percentage}%</text>
    `;

    return DOMPurify.sanitize(progressBar);
  },
};

// Client selection and proofing utilities
export const proofingUtils = {
  /**
   * Creates a selection count indicator
   */
  createSelectionCounter: (
    x: number,
    y: number,
    current: number,
    max: number,
    color: string,
  ): string => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const percentage = (current / max) * 100;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const counter = `
      <g>
        <circle cx="${x}" cy="${y}" r="${radius}" 
                fill="none" stroke="rgba(255,255,255,0.1)" 
                stroke-width="4" />
        <circle cx="${x}" cy="${y}" r="${radius}" 
                fill="none" stroke="${color}" 
                stroke-width="4" 
                stroke-dasharray="${circumference}" 
                stroke-dashoffset="${strokeDashoffset}" 
                stroke-linecap="round" 
                transform="rotate(-90 ${x} ${y})" />
        <text x="${x}" y="${y + 5}" 
              text-anchor="middle" fill="${color}" 
              font-size="16" font-family="Arial, sans-serif" font-weight="bold">${current}</text>
        <text x="${x}" y="${y + 16}" 
              text-anchor="middle" fill="rgba(255,255,255,0.7)" 
              font-size="10" font-family="Arial, sans-serif">/ ${max}</text>
      </g>
    `;

    return DOMPurify.sanitize(counter);
  },

  /**
   * Creates a deadline countdown timer visual
   */
  createDeadlineTimer: (
    x: number,
    y: number,
    hoursRemaining: number,
    totalHours: number,
    urgentColor: string,
    normalColor: string,
  ): string => {
    const isUrgent = hoursRemaining <= 24;
    const color = isUrgent ? urgentColor : normalColor;
    const percentage = (hoursRemaining / totalHours) * 100;

    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const timer = `
      <g>
        <circle cx="${x}" cy="${y}" r="${radius}" 
                fill="none" stroke="rgba(255,255,255,0.1)" 
                stroke-width="3" />
        <circle cx="${x}" cy="${y}" r="${radius}" 
                fill="none" stroke="${color}" 
                stroke-width="3" 
                stroke-dasharray="${circumference}" 
                stroke-dashoffset="${strokeDashoffset}" 
                stroke-linecap="round" 
                transform="rotate(-90 ${x} ${y})">
          ${isUrgent ? `<animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />` :''}
        </circle>
        <text x="${x}" y="${y + 5}" 
              text-anchor="middle" fill="${color}" 
              font-size="14" font-family="Arial, sans-serif" font-weight="bold">${hoursRemaining}h</text>
      </g>
    `;

    return DOMPurify.sanitize(timer);
  },
};

export default {
  showcaseUtils,
  statsUtils,
  loadingUtils,
  proofingUtils,
};
