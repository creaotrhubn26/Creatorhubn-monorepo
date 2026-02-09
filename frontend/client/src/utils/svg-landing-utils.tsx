/**
 * SVG Landing Page Utilities
 *
 * Specialized SVG rendering functions for landing-mobile.tsx and landing-desktop.tsx
 * All utilities produce DOMPurify-sanitized SVG strings for safe rendering
 *
 * Categories:
 * - Hero Section: Animated badges, feature highlights
 * - Stats Display: Platform statistics, user counts
 * - Feature Cards: Professional icons, check marks
 * - CTA Elements: Animated buttons, badges
 * - Social Proof: Rating stars, testimonial badges
 */

import DOMPurify from 'isomorphic-dompurify';

// ============================================================================
// HERO SECTION UTILITIES
// ============================================================================

/**
 * Create animated "New" badge for features
 */
export const createNewBadge = (
  x: number,
  y: number,
  text: string = 'NY',
  color: string = '#ff6b35',
): string => {
  const svg = `
    <svg width="60" height="24" x="${x}" y="${y}">
      <defs>
        <linearGradient id="newBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color}cc;stop-opacity:1" />
        </linearGradient>
        <filter id="newBadgeShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      <rect x="0" y="0" width="60" height="24" rx="12" fill="url(#newBadgeGrad)" filter="url(#newBadgeShadow)">
        <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite"/>
      </rect>
      <text x="30" y="16" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">${text}</text>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

/**
 * Create feature highlight icon with pulsing animation
 */
export const createFeatureHighlight = (
  x: number,
  y: number,
  size: number = 48,
  icon: 'check' | 'star' | 'rocket' = 'check',
  color: string = '#4caf50',
): string => {
  const icons = {
    check: `<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="${color}"/>`,
    star: `<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="${color}"/>`,
    rocket: `<path d="M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55l1.33 1.33zm11.26 2.91c0-1.81-.73-3.47-1.92-4.66s-2.85-1.92-4.66-1.92l-1.42 1.42c.54.54.88 1.28.88 2.09s-.34 1.55-.88 2.09l-6.3 6.3c-.19.19-.29.43-.29.71 0 .55.45 1 1 1 .28 0 .52-.11.71-.29l6.3-6.3c.54-.54 1.28-.88 2.09-.88s1.55.34 2.09.88l1.42-1.42zM20 14.5V19h-5.5l-1.5-1.5h-2L9 19H3.5v-5.5L5 12h2l1.5-1.5v-2L7 7h4.5L13 8.5h2l1.5-1.5V2H22v5.5l-2 2z" fill="${color}"/>`,
  };

  const svg = `
    <svg width="${size}" height="${size}" x="${x}" y="${y}" viewBox="0 0 24 24">
      <defs>
        <filter id="featureGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="12" cy="12" r="11" fill="${color}15" filter="url(#featureGlow)">
        <animate attributeName="r" values="11;13;11" dur="2s" repeatCount="indefinite"/>
      </circle>
      <g transform="translate(0, 0)">
        ${icons[icon]}
      </g>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

// ============================================================================
// STATS DISPLAY UTILITIES
// ============================================================================

/**
 * Create animated counter with number
 */
export const createStatCounter = (
  x: number,
  y: number,
  value: string,
  label: string,
  color: string = '#ff8c00',
  size: 'small' | 'medium' | 'large' = 'medium',
): string => {
  const sizes = {
    small: { width: 100, valueSize: 24, labelSize: 12 },
    medium: { width: 150, valueSize: 32, labelSize: 14 },
    large: { width: 200, valueSize: 48, labelSize: 16 },
  };
  const { width, valueSize, labelSize } = sizes[size];

  const svg = `
    <svg width="${width}" height="${valueSize + labelSize + 20}" x="${x}" y="${y}">
      <text x="${width / 2}" y="${valueSize}" font-family="Arial, sans-serif" font-size="${valueSize}" font-weight="bold" fill="${color}" text-anchor="middle">
        ${value}
        <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite"/>
      </text>
      <text x="${width / 2}" y="${valueSize + labelSize + 10}" font-family="Arial, sans-serif" font-size="${labelSize}" fill="#6b7280" text-anchor="middle">
        ${label}
      </text>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

/**
 * Create progress indicator for platform stats
 */
export const createStatProgress = (
  x: number,
  y: number,
  percentage: number,
  width: number = 200,
  height: number = 8,
  color: string = '#4caf50',
): string => {
  const filled = (percentage / 100) * width;

  const svg = `
    <svg width="${width}" height="${height}" x="${x}" y="${y}">
      <defs>
        <linearGradient id="statProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.5" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="${height / 2}" fill="#e0e0e0"/>
      <rect x="0" y="0" width="${filled}" height="${height}" rx="${height / 2}" fill="url(#statProgressGrad)">
        <animate attributeName="width" from="0" to="${filled}" dur="1.5s" fill="freeze"/>
      </rect>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

// ============================================================================
// FEATURE CARDS UTILITIES
// ============================================================================

/**
 * Create professional role icon badge
 */
export const createRoleBadge = (
  x: number,
  y: number,
  size: number = 64,
  iconType: 'photographer' | 'videographer' | 'music' | 'vendor',
  color: string,
): string => {
  const icons = {
    photographer: `<circle cx="32" cy="24" r="6" fill="${color}"/><rect x="20" y="30" width="24" height="16" rx="2" fill="${color}"/><circle cx="32" cy="38" r="4" fill="white"/>`,
    videographer: `<rect x="16" y="20" width="32" height="24" rx="2" fill="${color}"/><polygon points="48,26 56,22 56,42 48,38" fill="${color}"/><circle cx="32" cy="32" r="4" fill="white"/>`,
    music: `<path d="M40,16 L40,40 C40,44 36,48 32,48 C28,48 24,44 24,40 C24,36 28,32 32,32 L40,32 L40,16 L56,12 L56,28 L40,32" fill="${color}"/><circle cx="32" cy="40" r="4" fill="white"/>`,
    vendor: `<rect x="20" y="24" width="28" height="24" rx="2" fill="${color}"/><path d="M20,24 L32,16 L44,24" fill="${color}" opacity="0.8"/><rect x="28" y="32" width="8" height="16" fill="white"/>`,
  };

  const svg = `
    <svg width="${size}" height="${size}" x="${x}" y="${y}" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="roleBadgeGrad-${iconType}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color}dd;stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color}88;stop-opacity:1" />
        </linearGradient>
        <filter id="roleBadgeShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.15"/>
        </filter>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#roleBadgeGrad-${iconType})" filter="url(#roleBadgeShadow)" opacity="0.2"/>
      <g transform="translate(0, 0)">
        ${icons[iconType]}
      </g>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

/**
 * Create checkmark list item
 */
export const createCheckmarkItem = (
  x: number,
  y: number,
  size: number = 20,
  color: string = '#4caf50',
): string => {
  const svg = `
    <svg width="${size}" height="${size}" x="${x}" y="${y}" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="${color}20"/>
      <circle cx="12" cy="12" r="8" fill="${color}">
        <animate attributeName="r" values="8;9;8" dur="2s" repeatCount="indefinite"/>
      </circle>
      <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

// ============================================================================
// CTA ELEMENTS UTILITIES
// ============================================================================

/**
 * Create animated arrow for CTAs
 */
export const createCTAArrow = (
  x: number,
  y: number,
  size: number = 24,
  color: string = 'white',
  direction: 'right' | 'down' = 'right',
): string => {
  const paths = {
    right: 'M8 5l7 7-7 7',
    down: 'M5 8l7 7 7-7',
  };

  const svg = `
    <svg width="${size}" height="${size}" x="${x}" y="${y}" viewBox="0 0 24 24">
      <path d="${paths[direction]}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="${direction === 'right' ? '0,0; 3,0; 0,0' : '0,0; 0,3; 0,0'}"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

/**
 * Create pulsing dot indicator
 */
export const createPulsingDot = (
  x: number,
  y: number,
  radius: number = 6,
  color: string = '#ff6b35',
): string => {
  const svg = `
    <svg width="${radius * 4}" height="${radius * 4}" x="${x}" y="${y}">
      <circle cx="${radius * 2}" cy="${radius * 2}" r="${radius * 2}" fill="${color}30">
        <animate attributeName="r" values="${radius * 2};${radius * 3};${radius * 2}" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="${radius * 2}" cy="${radius * 2}" r="${radius}" fill="${color}">
        <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

// ============================================================================
// SOCIAL PROOF UTILITIES
// ============================================================================

/**
 * Create rating stars display
 */
export const createRatingStars = (
  x: number,
  y: number,
  rating: number,
  maxStars: number = 5,
  size: number = 20,
  color: string = '#ffc107',
): string => {
  const fullStars = Math.floor(rating);
  const partialStar = rating - fullStars;
  const emptyStars = maxStars - Math.ceil(rating);

  let starsHTML = '';
  let xOffset = 0;

  // Full stars
  for (let i = 0; i < fullStars; i++) {
    starsHTML += `
      <path d="M${xOffset + size / 2} ${2} L${xOffset + size * 0.6} ${size * 0.35} L${xOffset + size * 0.95} ${size * 0.35} L${xOffset + size * 0.68} ${size * 0.57} L${xOffset + size * 0.79} ${size * 0.9} L${xOffset + size / 2} ${size * 0.7} L${xOffset + size * 0.21} ${size * 0.9} L${xOffset + size * 0.32} ${size * 0.57} L${xOffset + size * 0.05} ${size * 0.35} L${xOffset + size * 0.4} ${size * 0.35} Z" fill="${color}"/>
    `;
    xOffset += size + 4;
  }

  // Partial star
  if (partialStar > 0) {
    starsHTML += `
      <defs>
        <linearGradient id="partialStarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="${partialStar * 100}%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="${partialStar * 100}%" style="stop-color:#e0e0e0;stop-opacity:1" />
        </linearGradient>
      </defs>
      <path d="M${xOffset + size / 2} ${2} L${xOffset + size * 0.6} ${size * 0.35} L${xOffset + size * 0.95} ${size * 0.35} L${xOffset + size * 0.68} ${size * 0.57} L${xOffset + size * 0.79} ${size * 0.9} L${xOffset + size / 2} ${size * 0.7} L${xOffset + size * 0.21} ${size * 0.9} L${xOffset + size * 0.32} ${size * 0.57} L${xOffset + size * 0.05} ${size * 0.35} L${xOffset + size * 0.4} ${size * 0.35} Z" fill="url(#partialStarGrad)"/>
    `;
    xOffset += size + 4;
  }

  // Empty stars
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += `
      <path d="M${xOffset + size / 2} ${2} L${xOffset + size * 0.6} ${size * 0.35} L${xOffset + size * 0.95} ${size * 0.35} L${xOffset + size * 0.68} ${size * 0.57} L${xOffset + size * 0.79} ${size * 0.9} L${xOffset + size / 2} ${size * 0.7} L${xOffset + size * 0.21} ${size * 0.9} L${xOffset + size * 0.32} ${size * 0.57} L${xOffset + size * 0.05} ${size * 0.35} L${xOffset + size * 0.4} ${size * 0.35} Z" fill="#e0e0e0"/>
    `;
    xOffset += size + 4;
  }

  const svg = `
    <svg width="${maxStars * (size + 4)}" height="${size + 4}" x="${x}" y="${y}">
      ${starsHTML}
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

/**
 * Create testimonial badge
 */
export const createTestimonialBadge = (
  x: number,
  y: number,
  text: string = 'Verified',
  size: number = 80,
): string => {
  const svg = `
    <svg width="${size}" height="${size}" x="${x}" y="${y}" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="testimonialBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4caf50;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2e7d32;stop-opacity:1" />
        </linearGradient>
        <filter id="testimonialShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.2"/>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#testimonialBadgeGrad)" filter="url(#testimonialShadow)">
        <animate attributeName="r" values="45;47;45" dur="3s" repeatCount="indefinite"/>
      </circle>
      <path d="M30 50 L42 62 L70 34" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="50" y="88" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#2e7d32" text-anchor="middle">${text}</text>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

// ============================================================================
// GLASSMORPHISM CARD DECORATIONS
// ============================================================================

/**
 * Create corner accent decoration for cards
 */
export const createCornerAccent = (
  x: number,
  y: number,
  size: number = 60,
  color: string = '#ff8c00',
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right',
): string => {
  const positions = {
    'top-left': { transform: 'rotate(0)' },
    'top-right': { transform: 'rotate(90)' },
    'bottom-right': { transform: 'rotate(180)' },
    'bottom-left': { transform: 'rotate(270)' }
  };

  const svg = `
    <svg width="${size}" height="${size}" x="${x}" y="${y}">
      <g transform="translate(${size / 2}, ${size / 2}) ${positions[position].transform} translate(-${size / 2}, -${size / 2})">
        <path d="M0,0 L${size},0 Q${size * 0.7},${size * 0.3} 0,${size} Z" fill="${color}" opacity="0.1"/>
        <circle cx="${size * 0.8}" cy="${size * 0.2}" r="3" fill="${color}" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

/**
 * Create floating gradient orb for background decoration
 */
export const createFloatingOrb = (
  x: number,
  y: number,
  size: number = 200,
  color: string ='#ff8c00',
  animationDuration: number = 10,
): string => {
  const svg = `
    <svg width="${size}" height="${size}" x="${x}" y="${y}">
      <defs>
        <radialGradient id="orbGrad-${color}" cx="30%" cy="30%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
        </radialGradient>
        <filter id="orbBlur">
          <feGaussianBlur stdDeviation="20"/>
        </filter>
      </defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#orbGrad-${color})" filter="url(#orbBlur)">
        <animate attributeName="cy" values="${size / 2};${size / 2 - 30};${size / 2}" dur="${animationDuration}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0.5;0.3" dur="${animationDuration}s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;
  return DOMPurify.sanitize(svg);
};

// Export all utilities as a single object for easy import
export const landingUtils = {
  createNewBadge,
  createFeatureHighlight,
  createStatCounter,
  createStatProgress,
  createRoleBadge,
  createCheckmarkItem,
  createCTAArrow,
  createPulsingDot,
  createRatingStars,
  createTestimonialBadge,
  createCornerAccent,
  createFloatingOrb,
};

export default landingUtils;
