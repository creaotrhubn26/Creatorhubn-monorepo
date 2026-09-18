export interface StoryboardStyleProfile {
  id: string;
  label: string;
  medium: string;
  constraints: string[];
  avoid: string[];
  lockedProperties: string[];
}

export const STORYBOARD_STYLE_PROFILES: Record<string, StoryboardStyleProfile> = {
  'story-pencil': {
    id: 'story-pencil',
    label: 'TRR Story Pencil',
    medium: 'monochrome production storyboard drawing',
    constraints: [
      'confident graphite construction lines',
      'selective cross-hatching from the Story Hatch language',
      'minimal tonal rendering with clear value grouping',
      'clear silhouettes and readable actor blocking',
      'production drawing clarity; unfinished marks may remain purposeful',
    ],
    avoid: ['polished concept-art finish', 'photoreal rendering', 'decorative illustration detail'],
    lockedProperties: ['style', 'line-language', 'tonal-range'],
  },
  cinematic: {
    id: 'cinematic', label: 'Cinematic', medium: 'cinematic production concept frame',
    constraints: ['filmic composition', 'motivated practical lighting', 'realistic depth and production design'],
    avoid: ['poster layout', 'overprocessed fantasy grading'],
    lockedProperties: ['style', 'lighting-language'],
  },
  noir: {
    id: 'noir', label: 'Noir', medium: 'black-and-white film noir storyboard',
    constraints: ['hard motivated shadows', 'high-contrast value design', 'expressive silhouettes'],
    avoid: ['pastel color', 'flat ambient lighting'],
    lockedProperties: ['style', 'tonal-range', 'lighting-language'],
  },
  watercolor: {
    id: 'watercolor', label: 'Watercolor', medium: 'expressive watercolor production storyboard',
    constraints: ['visible paper texture', 'loose confident washes', 'selective focal detail'],
    avoid: ['airbrushed digital finish', 'uniform detail everywhere'],
    lockedProperties: ['style', 'material-language'],
  },
  'graphic-novel': {
    id: 'graphic-novel', label: 'Graphic Novel', medium: 'graphic-novel production storyboard',
    constraints: ['bold ink contours', 'controlled halftone shading', 'dynamic but readable composition'],
    avoid: ['captions', 'speech bubbles', 'page layout'],
    lockedProperties: ['style', 'line-language'],
  },
  photoreal: {
    id: 'photoreal', label: 'Photoreal', medium: 'photoreal cinematic film still',
    constraints: ['natural skin and materials', 'physically plausible lighting', 'restrained film color grade'],
    avoid: ['plastic skin', 'illustration artifacts', 'exaggerated HDR'],
    lockedProperties: ['style', 'material-language'],
  },
  documentary: {
    id: 'documentary', label: 'Documentary', medium: 'natural documentary frame',
    constraints: ['available-light realism', 'observational composition', 'credible unstaged texture'],
    avoid: ['glossy commercial posing'], lockedProperties: ['style'],
  },
  commercial: {
    id: 'commercial', label: 'Commercial', medium: 'polished commercial storyboard frame',
    constraints: ['clean visual hierarchy', 'controlled bright production lighting', 'high production value'],
    avoid: ['cluttered blocking'], lockedProperties: ['style', 'lighting-language'],
  },
  drama: {
    id: 'drama', label: 'Drama / TV', medium: 'intimate television drama storyboard',
    constraints: ['warm restrained tones', 'performance-first composition', 'soft motivated key light'],
    avoid: ['commercial posing', 'spectacle without story motivation'], lockedProperties: ['style'],
  },
};

export function resolveStoryboardStyleProfile(id: string | null | undefined): StoryboardStyleProfile {
  return STORYBOARD_STYLE_PROFILES[String(id || '').trim().toLowerCase()]
    ?? STORYBOARD_STYLE_PROFILES['story-pencil'];
}
