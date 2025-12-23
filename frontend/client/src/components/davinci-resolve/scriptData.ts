/**
 * Comprehensive Script Categories and Camera Profiles for DaVinci Resolve
 * Based on industry research and professional workflows
 */

export interface ScriptCategory {
  name: string;
  icon: string;
  description: string;
  scripts: string[];
  phases?: string[];
  cultures?: string[];
  cameras?: string[];
  tags?: string[];
  experienceLevel?: ('beginner' | 'intermediate' | 'advanced')[];
  complexity?: 'simple' | 'moderate' | 'complex';
}

export interface CameraProfile {
  name: string;
  manufacturer: string;
  logProfile: string;
  icon: string;
  description: string;
  scripts: string[];
  colorSpace?: string;
  bitDepth?: string;
  popularWith?: string[];
}

export interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'color' | 'file' | 'range';
  description: string;
  default?: any;
  options?: string[] | { value: string; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  helpText?: string;
  validation?: (value: any) => boolean | string;
}

export interface ScriptPreset {
  name: string;
  description: string;
  parameters: Record<string, any>;
  icon?: string;
}

// ============================================================================
// SCRIPT CATEGORIES (Expanded based on research)
// ============================================================================

export const SCRIPT_CATEGORIES: Record<string, ScriptCategory> = {
  wedding: {
    name: 'Wedding',
    icon: '💒',
    description: 'Wedding video production and color grading',
    scripts: [
      'wedding-sony-s_log2-professional-powergrade-creation.py', 'wedding-sony-s_log2-creative-powergrade-creation.py','wedding-canon-c_log2-professional-powergrade-creation.py','wedding-panasonic-v_log-professional-powergrade-creation.py','wedding-powergrade-creation.py','wedding-color-grading.py','wedding-multicam-sync.py','wedding-audio-sync.py','53-wedding-automation-suite.py',
    ],
    cultures: ['norsk-wedding','indisk-wedding','pakistansk-wedding','amerikansk-wedding'],
    cameras: ['sony-s_log2','canon-c_log2','panasonic-v_log'],
    tags: ['ceremony','reception','multicam','audio-sync'],
  },
  
  event: {
    name: 'Event',
    icon: '🎉',
    description: 'Corporate events, conferences, and live coverage',
    scripts: [
      'event-powergrade-creation.py','event-color-grading.py','event-multicam-edit.py','event-lower-thirds-generator.py','54-event-automation-suite.py',
    ],
    phases: ['production','post-production'],
    tags: ['conference','corporate','live','multicam'],
  },
  
  commercial: {
    name: 'Commercial',
    icon: '📺',
    description: 'TV commercials, ads, and promotional content',
    scripts: [
      'commercial-powergrade-creation.py','commercial-color-grading.py','commercial-quick-cut-generator.py','commercial-text-animation.py',
    ],
    phases: ['pre-production','production','post-production'],
    tags: ['advertising','promotional','brand','product'],
  },
  
  documentary: {
    name: 'Documentary',
    icon: '🎬',
    description: 'Documentary filmmaking and storytelling',
    scripts: [
      'documentary-powergrade-creation.py','documentary-color-grading.py','documentary-interview-setup.py','documentary-b-roll-organizer.py',
    ],
    phases: ['production','post-production'],
    tags: ['interview','b-roll','storytelling','narrative'],
  }, 'music-video': {
    name: 'Music Video',
    icon: '🎵',
    description: 'Music video production and creative effects',
    scripts: [
      'music-video-powergrade-creation.py','music-video-color-grading.py','music-video-beat-sync.py','music-video-creative-effects.py',
    ],
    phases: ['pre-production','production','post-production'],
    tags: ['music','creative','effects','beat-sync'],
  },
  
  film: {
    name: 'Film & Cinema',
    icon: '🎥',
    description: 'Feature films, short films, and cinematic projects',
    scripts: [
      'film-powergrade-creation.py','film-color-grading.py','film-scene-organizer.py','film-dailies-processor.py','film-lut-generator.py',
    ],
    phases: ['pre-production','production','post-production'],
    tags: ['cinema','feature','narrative','dailies'],
  },
  
  youtube: {
    name: 'YouTube & Social',
    icon: '📱',
    description: 'YouTube videos, vlogs, and social media content',
    scripts: [
      'youtube-powergrade-creation.py','youtube-color-grading.py','youtube-thumbnail-generator.py','youtube-intro-outro-automation.py','social-media-aspect-ratio-converter.py',
    ],
    phases: ['production','post-production'],
    tags: ['vlog','social-media','youtube','content-creation'],
  },
  
  corporate: {
    name: 'Corporate Video',
    icon: '💼',
    description: 'Corporate videos, training, and internal communications',
    scripts: [
      'corporate-powergrade-creation.py','corporate-color-grading.py','corporate-template-generator.py','corporate-branding-automation.py',
    ],
    phases: ['pre-production','production','post-production'],
    tags: ['training','internal','branding','professional'],
  }, 'real-estate': {
    name: 'Real Estate',
    icon: '🏠',
    description: 'Property tours, real estate marketing videos',
    scripts: [
      'real-estate-powergrade-creation.py','real-estate-color-grading.py','real-estate-tour-automation.py','real-estate-text-overlay.py',
    ],
    phases: ['production','post-production'],
    tags: ['property','tour','marketing','architectural'],
  },

  drone: {
    name: 'Drone & Aerial',
    icon: '🚁',
    description: 'Drone footage, aerial cinematography',
    scripts: [
      'drone-powergrade-creation.py','drone-color-grading.py','drone-stabilization.py','drone-speed-ramp.py',
    ],
    phases: ['production','post-production'],
    tags: ['aerial','drone','dji','stabilization'],
  },

  sports: {
    name: 'Sports & Action',
    icon: '⚽',
    description: 'Sports coverage, action sequences, slow motion',
    scripts: [
      'sports-powergrade-creation.py','sports-color-grading.py','sports-slow-motion.py','sports-highlight-reel.py',
    ],
    phases: ['production','post-production'],
    tags: ['sports','action','slow-motion','highlights'],
  },
};

// ============================================================================
// CAMERA PROFILES (Comprehensive list based on research)
// ============================================================================

export const CAMERA_PROFILES: Record<string, CameraProfile> = {
  // Sony Cameras
  'sony-s_log2': {
    name: 'Sony S-Log2',
    manufacturer: 'Sony',
    logProfile: 'S-Log2',
    icon: '📷',
    description: 'Sony cameras with S-Log2 profile (A7S, FX3, FX6, FX9)',
    scripts: ['wedding-sony-s_log2-professional-powergrade-creation.py'],
    colorSpace: 'S-Gamut',
    bitDepth: '10-bit',
    popularWith: ['wedding','event','documentary'],
  }, 'sony-s_log3': {
    name: 'Sony S-Log3',
    manufacturer: 'Sony',
    logProfile: 'S-Log3',
    icon: '📷',
    description: 'Sony cameras with S-Log3 profile (A7S III, FX3, FX6, FX9, Venice)',
    scripts: ['sony-s_log3-powergrade-creation.py'],
    colorSpace: 'S-Gamut3.Cine',
    bitDepth: '10-bit / 16-bit RAW',
    popularWith: ['film','commercial','music-video'],
  },

  // Canon Cameras
  'canon-c_log2': {
    name: 'Canon C-Log2',
    manufacturer: 'Canon',
    logProfile: 'C-Log2',
    icon: '📷',
    description: 'Canon Cinema EOS cameras (C70, C200, C300, C500)',
    scripts: ['wedding-canon-c_log2-professional-powergrade-creation.py'],
    colorSpace: 'Cinema Gamut',
    bitDepth: '10-bit / 12-bit',
    popularWith: ['wedding','corporate','documentary'],
  },
  'canon-c_log3': {
    name: 'Canon C-Log3',
    manufacturer: 'Canon',
    logProfile: 'C-Log3',
    icon: '📷',
    description: 'Canon Cinema EOS cameras with C-Log3 (C300 Mark III, C500 Mark II)',
    scripts: ['canon-c_log3-powergrade-creation.py'],
    colorSpace: 'Cinema Gamut',
    bitDepth: '12-bit / 16-bit RAW',
    popularWith: ['film','commercial','high-end'],
  },

  // Panasonic Cameras
  'panasonic-v_log': {
    name: 'Panasonic V-Log',
    manufacturer: 'Panasonic',
    logProfile: 'V-Log',
    icon: '📷',
    description: 'Panasonic cameras (GH5, GH6, S1H, S5, Varicam)',
    scripts: ['wedding-panasonic-v_log-professional-powergrade-creation.py'],
    colorSpace: 'V-Gamut',
    bitDepth: '10-bit',
    popularWith: ['wedding','event','youtube'],
  },

  // RED Cameras
  'red-log3g10': {
    name: 'RED Log3G10',
    manufacturer: 'RED Digital Cinema',
    logProfile: 'Log3G10',
    icon: '🎥',
    description: 'RED cameras (Komodo, V-Raptor, Monstro)',
    scripts: ['red-log3g10-powergrade-creation.py'],
    colorSpace: 'REDWideGamutRGB',
    bitDepth: '16-bit RAW',
    popularWith: ['film','commercial','music-video'],
  },

  // ARRI Cameras
  'arri-logc': {
    name: 'ARRI LogC',
    manufacturer: 'ARRI',
    logProfile: 'LogC',
    icon: '🎥',
    description: 'ARRI cameras (Alexa, Alexa Mini, Alexa LF, Amira)',
    scripts: ['arri-logc-powergrade-creation.py'],
    colorSpace: 'ARRI Wide Gamut',
    bitDepth: '16-bit ARRIRAW',
    popularWith: ['film','commercial','high-end'],
  },

  // Blackmagic Cameras
  'blackmagic-film': {
    name: 'Blackmagic Film',
    manufacturer: 'Blackmagic Design',
    logProfile: 'Blackmagic Film',
    icon: '🎬',
    description: 'Blackmagic cameras (Pocket 4K/6K, URSA Mini Pro)',
    scripts: ['blackmagic-film-powergrade-creation.py'],
    colorSpace: 'Blackmagic Wide Gamut',
    bitDepth: '12-bit RAW',
    popularWith: ['film','documentary','indie'],
  },

  // Fujifilm Cameras
  'fujifilm-f_log': {
    name: 'Fujifilm F-Log',
    manufacturer: 'Fujifilm',
    logProfile: 'F-Log',
    icon: '📷',
    description: 'Fujifilm cameras (X-T4, X-H2S, GFX)',
    scripts: ['fujifilm-f_log-powergrade-creation.py'],
    colorSpace: 'F-Gamut',
    bitDepth: '10-bit',
    popularWith: ['documentary','youtube','corporate'],
  },

  // Nikon Cameras
  'nikon-n_log': {
    name: 'Nikon N-Log',
    manufacturer: 'Nikon',
    logProfile: 'N-Log',
    icon: '📷',
    description: 'Nikon cameras (Z9, Z8, Z6 III)',
    scripts: ['nikon-n_log-powergrade-creation.py'],
    colorSpace: 'N-Gamut',
    bitDepth: '10-bit / 12-bit RAW',
    popularWith: ['documentary','wedding','corporate'],
  },

  // DJI Drones
  'dji-d_log': {
    name: 'DJI D-Log',
    manufacturer: 'DJI',
    logProfile: 'D-Log',
    icon: '🚁',
    description: 'DJI drones (Mavic 3, Inspire 3, Air 3)',
    scripts: ['dji-d_log-powergrade-creation.py'],
    colorSpace: 'D-Gamut',
    bitDepth: '10-bit',
    popularWith: ['drone','real-estate','documentary'],
  },
};

// ============================================================================
// SCRIPT PARAMETERS (Dynamic form configuration)
// ============================================================================

export const SCRIPT_PARAMETERS: Record<string, ScriptParameter[]> = {
  'wedding-sony-s_log2-professional-powergrade-creation.py': [
    {
      name: 'projectName',
      type: 'string',
      description: 'Name of the wedding project',
      required: true,
      placeholder: 'e.g., Smith-Johnson Wedding 2024',
      helpText: 'This will be used to name the timeline and powergrade',
    },
    {
      name: 'colorTemperature',
      type: 'select',
      description: 'Color temperature preference',
      default: 'neutral',
      options: [
        { value: 'warm', label: 'Warm (Romantic)' },
        { value: 'neutral', label: 'Neutral (Natural)' },
        { value: 'cool', label: 'Cool (Modern)' },
      ],
      required: true,
      helpText: 'Choose the overall color mood for the wedding',
    },
    {
      name: 'skinToneProtection',
      type: 'range',
      description: 'Skin tone protection level',
      default: 75,
      min: 0,
      max: 100,
      step: 5,
      helpText: 'Higher values preserve natural skin tones better',
    },
    {
      name: 'contrastLevel',
      type: 'select',
      description: 'Contrast level',
      default: 'medium',
      options: ['low','medium','high','cinematic'],
      helpText: 'Adjust the overall contrast of the grade',
    },
    {
      name: 'applyVignette',
      type: 'boolean',
      description: 'Apply subtle vignette',
      default: true,
      helpText: 'Adds a subtle darkening around the edges',
    },
    {
      name: 'outputFormat',
      type: 'select',
      description: 'Output format',
      default: 'rec709',
      options: [
        { value: 'rec709', label: 'Rec.709 (Standard)' },
        { value: 'p3', label: 'DCI-P3 (Cinema)' },
        { value: 'rec2020', label: 'Rec.2020 (HDR)' },
      ],
      required: true,
    },
  ],
  'film-powergrade-creation.py': [
    {
      name: 'filmLook',
      type: 'select',
      description: 'Film look style',
      default: 'modern',
      options: [
        { value: 'modern', label: 'Modern Digital' },
        { value: 'vintage', label: 'Vintage Film' },
        { value: 'noir', label: 'Film Noir' },
        { value: 'bleach-bypass', label: 'Bleach Bypass' },
        { value: 'cross-process', label: 'Cross Process' },
      ],
      required: true,
    },
    {
      name: 'grainAmount',
      type: 'range',
      description: 'Film grain amount',
      default: 30,
      min: 0,
      max: 100,
      step: 5,
      helpText: 'Add film grain for organic texture',
    },
    {
      name: 'lutFile',
      type: 'file',
      description: 'Custom LUT file (optional)',
      helpText: 'Upload a .cube LUT file for custom look',
    },
  ],
  'youtube-color-grading.py': [
    {
      name: 'style',
      type: 'select',
      description: 'YouTube style',
      default: 'vibrant',
      options: [
        { value: 'vibrant', label: 'Vibrant (High Saturation)' },
        { value: 'natural', label: 'Natural (Balanced)' },
        { value: 'cinematic', label: 'Cinematic (Film Look)' },
        { value: 'flat', label: 'Flat (Minimal Grading)' },
      ],
      required: true,
    },
    {
      name: 'aspectRatio',
      type: 'select',
      description: 'Aspect ratio',
      default: '16:9',
      options: ['16:9', '9:16', '1:1', '4:5'],
      required: true,
      helpText: 'Choose based on platform (YouTube, Instagram, TikTok)',
    },
    {
      name: 'addWatermark',
      type: 'boolean',
      description: 'Add channel watermark',
      default: false,
    },
  ],
};

// ============================================================================
// SCRIPT PRESETS (Quick start configurations)
// ============================================================================

export const SCRIPT_PRESETS: Record<string, ScriptPreset[]> = {
  'wedding-sony-s_log2-professional-powergrade-creation.py': [
    {
      name: 'Romantic Warm',
      description: 'Warm, romantic look perfect for ceremonies',
      icon: '💕',
      parameters: {
        colorTemperature: 'warm',
        skinToneProtection: 80,
        contrastLevel: 'medium',
        applyVignette: true,
        outputFormat: 'rec709',
      },
    },
    {
      name: 'Modern Clean',
      description: 'Clean, modern look for contemporary weddings',
      icon: '✨',
      parameters: {
        colorTemperature: 'neutral',
        skinToneProtection: 75,
        contrastLevel: 'high',
        applyVignette: false,
        outputFormat: 'rec709',
      },
    },
    {
      name: 'Cinematic Drama',
      description: 'Dramatic, cinematic look with high contrast',
      icon: '🎬',
      parameters: {
        colorTemperature: 'cool',
        skinToneProtection: 70,
        contrastLevel: 'cinematic',
        applyVignette: true,
        outputFormat: 'p3',
      },
    },
  ],
  'film-powergrade-creation.py': [
    {
      name: 'Classic Film',
      description: 'Traditional film look with subtle grain',
      icon: '🎞️',
      parameters: {
        filmLook: 'vintage',
        grainAmount: 40,
      },
    },
    {
      name: 'Modern Cinema',
      description: 'Clean digital cinema look',
      icon: '🎥',
      parameters: {
        filmLook: 'modern',
        grainAmount: 15,
      },
    },
  ],
};

// Helper function to get parameters for a script
export function getScriptParameters(scriptName: string): ScriptParameter[] {
  return SCRIPT_PARAMETERS[scriptName] || [];
}

// Helper function to get presets for a script
export function getScriptPresets(scriptName: string): ScriptPreset[] {
  return SCRIPT_PRESETS[scriptName] || [];
}
