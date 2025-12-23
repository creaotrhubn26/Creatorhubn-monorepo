/**
 * CreatorHub Virtual Studio Brand Kit
 * Complete brand identity system with SVG assets
 */

// Brand Colors
export const brandColors = {
  // Primary Palette
  primary: {
    main: '#6366F1', // Indigo - Professional, Tech
    light: '#818CF8', // Light Indigo
    dark: '#4F46E5', // Dark Indigo
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  },

  // Secondary Palette
  secondary: {
    main: '#8B5CF6', // Purple - Creative, Artistic
    light: '#A78BFA', // Light Purple
    dark: '#7C3AED', // Dark Purple
  },

  // Accent Colors
  accent: {
    cyan: '#06B6D4', // Cyan - Virtual, Digital
    pink: '#EC4899', // Pink - Creative Energy
    orange: '#F59E0B', // Orange - Action, Export
    green: '#10B981', // Green - Success, Render Complete
  },

  // Neutral Palette
  neutral: {
    black: '#0A0A0A', // Pure Black
    dark: '#1A1A1A', // Dark Gray (UI Background)
    gray: '#3F3F46', // Gray
    lightGray: '#71717A', // Light Gray
    white: '#FAFAFA', // Off White
    pure: '#FFFFFF', // Pure White
  },

  // Functional Colors
  functional: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // Transparency Levels
  alpha: {
    light: 'rgba(99, 102, 241, 0.1)', // 10% primary
    medium: 'rgba(99, 102, 241, 0.2)', // 20% primary
    heavy: 'rgba(99, 102, 241, 0.4)', // 40% primary
  },
};

// Typography
export const brandTypography = {
  fontFamily: {
    display: "'Inter', -apple-system, system-ui, sans-serif",
    body: "'Inter', -apple-system, system-ui, sans-serif",
    mono: "'JetBrains Mono','Fira Code', monospace",
  },

  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl' : '1.5rem', // 24px
    '3xl' : '1.875rem', // 30px
    '4xl' : '2.25rem', // 36px
    '5xl' : '3rem', // 48px
  },

  fontWeight: 
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
};

// Logo SVG (Main)
export const logoMain = `
<svg width="200" height="60" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 3D Cube representing Virtual Studio -->
  <g id="cube">
    <!-- Front face -->
    <path d="M15 25 L25 20 L35 25 L25 30 Z" fill="url(#gradient1)" stroke="#6366F1" stroke-width="1.5"/>
    <!-- Top face -->
    <path d="M25 20 L35 25 L35 35 L25 30 Z" fill="url(#gradient2)" opacity="0.8"/>
    <!-- Side face -->
    <path d="M15 25 L25 30 L25 40 L15 35 Z" fill="url(#gradient3)" opacity="0.6"/>
  </g>
  
  <!-- Camera Icon -->
  <g id="camera" transform="translate(20, 27)">
    <rect x="0" y="2" width="10" height="7" rx="1" fill="#06B6D4" opacity="0.8"/>
    <circle cx="5" cy="5.5" r="2" fill="#FAFAFA"/>
    <circle cx="5" cy="5.5" r="1" fill="#8B5CF6"/>
  </g>
  
  <!-- Text: CreatorHub -->
  <text x="45" y="28" font-family="Inter, sans-serif" font-size="18" font-weight="700" fill="url(#textGradient)">
    CreatorHub
  </text>
  
  <!-- Text: Virtual Studio -->
  <text x="45" y="44" font-family="Inter, sans-serif" font-size="12" font-weight="500" fill="#71717A">
    VIRTUAL STUDIO
  </text>
  
  <!-- Gradients -->
  <defs>
    <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A78BFA;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="gradient3" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366F1;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#6366F1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
    </linearGradient>
  </defs>
</svg>
`;

// Logo Icon Only (for favicons, small spaces)
export const logoIcon = `
<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="60" height="60" rx="12" fill="url(#bgGradient)"/>
  
  <!-- 3D Cube -->
  <g transform="translate(15, 15)">
    <path d="M15 10 L25 5 L35 10 L25 15 Z" fill="#FAFAFA" opacity="0.9"/>
    <path d="M25 5 L35 10 L35 20 L25 15 Z" fill="#FAFAFA" opacity="0.7"/>
    <path d="M15 10 L25 15 L25 25 L15 20 Z" fill="#FAFAFA" opacity="0.5"/>
    
    <!-- Camera lens in center -->
    <circle cx="25" cy="15" r="4" fill="#06B6D4" opacity="0.8"/>
    <circle cx="25" cy="15" r="2" fill="#FAFAFA"/>
  </g>
  
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
    </linearGradient>
  </defs>
</svg>
`;

// Feature Icons
export const featureIcons = {
  camera: `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="8" width="16" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
  <circle cx="12" cy="14" r="3" stroke="currentColor" stroke-width="2"/>
  <path d="M8 4 L16 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
  `,

  timeline: `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
  <line x1="6" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="8" cy="14" r="2" fill="currentColor"/>
  <circle cx="16" cy="14" r="2" fill="currentColor"/>
</svg>
  `,

  render3d: `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" stroke="currentColor" stroke-width="2"/>
  <path d="M12 2 L12 22" stroke="currentColor" stroke-width="2"/>
  <path d="M2 8 L12 14 L22 8" stroke="currentColor" stroke-width="2"/>
</svg>
  `,

  lut: `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
  <path d="M3 9 L21 9" stroke="currentColor" stroke-width="2"/>
  <path d="M3 15 L21 15" stroke="currentColor" stroke-width="2"/>
  <circle cx="8" cy="6" r="1.5" fill="#EF4444"/>
  <circle cx="12" cy="12" r="1.5" fill="#10B981"/>
  <circle cx="16" cy="18" r="1.5" fill="#3B82F6"/>
</svg>
  `,

  export: `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2 L12 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M8 6 L12 2 L16 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4 14 L4 20 C4 21.1046 4.89543 22 6 22 L18 22 C19.1046 22 20 21.1046 20 20 L20 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
  `,

  cloud: `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 10 C18 10 18 8 16 6 C14 4 12 4 10 6 C8 8 8 10 8 10 C6 10 4 12 4 14 C4 16 6 18 8 18 L18 18 C20 18 22 16 22 14 C22 12 20 10 18 10 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
</svg>
  `,

  animation: `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="6" cy="12" r="2" fill="currentColor"/>
  <circle cx="12" cy="8" r="2" fill="currentColor"/>
  <circle cx="18" cy="12" r="2" fill="currentColor"/>
  <path d="M6 12 Q9 8 12 8 T18 12" stroke="currentColor" stroke-width="2" fill="none"/>
</svg>
  `,
};

// Decorative Elements
export const decorativeElements = {
  gridPattern: `
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#3F3F46" stroke-width="0.5" opacity="0.3"/>
    </pattern>
  </defs>
  <rect width="100" height="100" fill="url(#grid)" />
</svg>
  `,

  gradientOrb: `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="orb">
      <stop offset="0%" style="stop-color:#6366F1;stop-opacity:0.8" />
      <stop offset="50%" style="stop-color:#8B5CF6;stop-opacity:0.4" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:0" />
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="80" fill="url(#orb)" />
</svg>
  `,

  scanLines: `
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="scan" width="100" height="2" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="100" y2="0" stroke="#6366F1" stroke-width="1" opacity="0.1"/>
    </pattern>
  </defs>
  <rect width="100" height="100" fill="url(#scan)" />
</svg>
  `,
};

// Watermark for exports
export const watermark = `
<svg width="120" height="30" viewBox="0 0 120 30" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="30" rx="4" fill="#0A0A0A" opacity="0.7"/>
  
  <!-- Mini cube icon -->
  <g transform="translate(8, 10)">
    <path d="M5 2 L8 0.5 L11 2 L8 3.5 Z" fill="#6366F1"/>
    <path d="M8 0.5 L11 2 L11 5 L8 3.5 Z" fill="#8B5CF6" opacity="0.7"/>
    <path d="M5 2 L8 3.5 L8 6.5 L5 5 Z" fill="#4F46E5" opacity="0.5"/>
  </g>
  
  <text x="24" y="18" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#FAFAFA">
    Virtual Studio
  </text>
</svg>
`;

// Loading Spinner
export const loadingSpinner = `
<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
  <circle cx="30" cy="30" r="25" fill="none" stroke="url(#spinGradient)" stroke-width="4" stroke-linecap="round" stroke-dasharray="120 40">
    <animateTransform
      attributeName="transform"
      type="rotate"
      from="0 30 30"
      to="360 30 30"
      dur="1s"
      repeatCount="indefinite"/>
  </circle>
  
  <defs>
    <linearGradient id="spinGradient">
      <stop offset="0%" style="stop-color:#6366F1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:0.3" />
    </linearGradient>
  </defs>
</svg>
`;

// Export all brand assets
export const brandKit = {
  colors: brandColors,
  typography: brandTypography,
  logos: {
    main: logoMain,
    icon: logoIcon,
  },
  icons: featureIcons,
  decorative: decorativeElements,
  watermark,
  loadingSpinner,
};

export default brandKit;
