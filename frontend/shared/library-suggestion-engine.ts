/**
 * 🤖 AI-Powered Library Suggestion Engine
 * Recommends libraries based on component type being created
 */

import type { LibraryMapping } from './library-feature-mapping';
import { LIBRARY_MAPPINGS } from './library-feature-mapping';
import { PROFESSION_FEATURE_MATRIX } from './profession-feature-matrix';

export interface LibrarySuggestion {
  library: LibraryMapping;
  reason: string;
  priority: 'critical' | 'recommended' | 'optional';
  feature: string;
  alreadyEnabled: boolean;
}

export interface ComponentSuggestions {
  componentType: string;
  componentName: string;
  description: string;
  suggestedLibraries: LibrarySuggestion[];
  suggestedFeatures: Array<{
    featureId: string;
    featureName: string;
    plan: 'basic' | 'pro' | 'enterprise' | 'marketplace';
    libraries: string[];
    enabled: boolean;
  }>;
  estimatedBundleImpact: {
    totalKB: number;
    totalMB: number;
    breakdown: Array<{ library: string; sizeKB: number }>;
  };
}

/**
 * Component type to library mapping
 */
const COMPONENT_LIBRARY_SUGGESTIONS: Record<
  string,
  {
    features: string[];
    description: string;
    essentialLibraries: string[];
    recommendedLibraries: string[];
    optionalLibraries: string[];
  }
> = {
  // ============================================
  // VIDEO PLAYER
  // ============================================
  'video-player': {
    features: [
      'streaming-setup',
      'real-video-playback',
      'hls-import',
      'video-editor-workflow',
      'professional-waveforms',
    ],
    description:
      'Professional video player with HLS/DASH streaming, waveforms, and advanced controls',
    essentialLibraries: ['shaka-player', 'hls.js', 'm3u8-parser'],
    recommendedLibraries: ['mux.js', 'mediainfo.js', 'mp4box', 'react-router-dom'],
    optionalLibraries: ['wavesurfer.js', 'meyda', 'fft.js'],
  },

  // ============================================
  // AUDIO PLAYER
  // ============================================
  'audio-player': {
    features: [
      'professional-waveforms',
      'beat-detection',
      'audio-enhancement-suite',
      'music-showcase-display',
    ],
    description: 'Advanced audio player with waveforms, beat detection, and enhancement',
    essentialLibraries: ['wavesurfer.js', 'audio-decode', 'music-metadata-browser'],
    recommendedLibraries: ['meyda', 'fft.js', 'wav-decoder', 'wav-encoder'],
    optionalLibraries: ['d3.js', 'recharts', 'rnnoise-wasm'],
  },

  // ============================================
  // VIDEO EDITOR
  // ============================================
  'video-editor': {
    features: [
      'story-arc-studio',
      'real-video-playback',
      'frame-accurate-editing',
      'multitrack-timeline',
      '485-transitions',
      'color-grading',
      '627-luts',
      'gpu-filters',
      'text-overlays',
      'speed-ramps',
      'auto-captions',
      'professional-waveforms',
    ],
    description: 'Full-featured video editor with 485 transitions, 627 LUTs, AI story generation',
    essentialLibraries: [
      'zustand',
      'immer',
      '@dnd-kit/core',
      'react-resizable-panels',
      'mp4-muxer',
      'mp4box',
    ],
    recommendedLibraries: [
      'pixi.js',
      'three.js',
      'gl-transitions',
      'fabric.js',
      'gsap',
      'framer-motion',
      'lut.js',
      'colorjs.io',
      'wavesurfer.js',
      'ffmpeg.wasm',
    ],
    optionalLibraries: ['konva', 'react-konva', 'lottie-web', 'opentype.js', 'onnxruntime-web'],
  },

  // ============================================
  // IMAGE GALLERY
  // ============================================
  'image-gallery': {
    features: [
      'universal-showcase',
      'photo-enhancement',
      'watermarking',
      'metadata-editor',
      'lightroom-plugin',
    ],
    description: 'Professional image gallery with virtual scrolling, lazy loading, and EXIF data',
    essentialLibraries: ['@tanstack/react-virtual', 'thumbhash', 'idb-keyval', 'react-dropzone'],
    recommendedLibraries: ['exifr', '@use-gesture/react', 'framer-motion'],
    optionalLibraries: ['pixi.js', 'd3.js'],
  },

  // ============================================
  // DRAG & DROP BUILDER
  // ============================================
  'drag-drop-builder': {
    features: ['story-arc-studio', 'multitrack-timeline', 'showcase-management'],
    description: 'Drag & drop interface builder with timeline and multi-track support',
    essentialLibraries: ['@dnd-kit/core', 'react-dnd', 'react-beautiful-dnd', '@use-gesture/react'],
    recommendedLibraries: ['framer-motion', 'react-spring', 'zustand', 'immer'],
    optionalLibraries: ['gsap', 'd3-ease'],
  },

  // ============================================
  // COLOR GRADING TOOL
  // ============================================
  'color-grading-tool': {
    features: ['color-grading', '627-luts', 'cultural-luts', 'script-luts'],
    description: 'Professional color grading with 627 LUTs (440 cultural + 187 script)',
    essentialLibraries: ['lut.js', 'colorjs.io', 'colord'],
    recommendedLibraries: ['chroma-js', 'pixi.js', 'gl-matrix'],
    optionalLibraries: ['d3-color', 'd3-ease'],
  },

  // ============================================
  // ANIMATION TIMELINE
  // ============================================
  'animation-timeline': {
    features: ['485-transitions', 'text-overlays', 'speed-ramps', 'multitrack-timeline'],
    description: 'Animation timeline with 485 transitions and motion graphics',
    essentialLibraries: ['gsap', 'framer-motion', '@dnd-kit/core', 'd3-ease'],
    recommendedLibraries: ['react-spring', 'lottie-web', 'three.js', 'pixi.js', 'framesync'],
    optionalLibraries: ['gl-transitions', 'curtainsjs'],
  },

  // ============================================
  // ANALYTICS DASHBOARD
  // ============================================
  'analytics-dashboard': {
    features: ['showcase-analytics', 'video-analytics'],
    description: 'Analytics dashboard with charts, graphs, and data visualization',
    essentialLibraries: ['recharts', 'd3.js'],
    recommendedLibraries: ['framer-motion', '@tanstack/react-virtual'],
    optionalLibraries: ['d3-ease', 'chroma-js'],
  },

  // ============================================
  // AI PROCESSING TOOL
  // ============================================
  'ai-tool': {
    features: [
      'audio-enhancement-suite',
      'background-removal',
      'auto-captions',
      'ai-story-generation',
    ],
    description: 'AI-powered processing with ONNX, RNNoise, Demucs, Whisper',
    essentialLibraries: ['onnxruntime-web', 'comlink', 'bullmq'],
    recommendedLibraries: ['rnnoise-wasm', 'audio-decode', 'wav-decoder', 'wav-encoder'],
    optionalLibraries: ['torch', 'deepfilternet', 'demucs'],
  },

  // ============================================
  // MOBILE APP
  // ============================================
  'mobile-app': {
    features: [
      'pwa-install',
      'service-worker-offline',
      'push-notifications',
      'haptic-feedback',
      'touch-gestures',
    ],
    description: 'Progressive Web App with offline support and mobile gestures',
    essentialLibraries: ['@use-gesture/react', 'react-dropzone', 'notistack'],
    recommendedLibraries: ['framer-motion', 'idb-keyval', 'comlink'],
    optionalLibraries: ['@tanstack/react-virtual', 'thumbhash'],
  },

  // ============================================
  // 3D GRAPHICS
  // ============================================
  '3d-graphics': {
    features: ['485-transitions', 'gpu-filters'],
    description: '3D graphics and WebGL effects',
    essentialLibraries: ['three.js', 'pixi.js', 'gl-matrix'],
    recommendedLibraries: ['gl-transitions', 'pixi-filters', '@webgpu/types', 'curtainsjs'],
    optionalLibraries: ['glsl-fast-gaussian-blur', 'konva'],
  },

  // ============================================
  // TEXT EDITOR
  // ============================================
  'text-editor': {
    features: ['text-overlays', 'custom-fonts'],
    description: 'Rich text editor with custom fonts and animations',
    essentialLibraries: ['fabric.js', 'gsap'],
    recommendedLibraries: ['opentype.js', 'framer-motion', 'lottie-web'],
    optionalLibraries: ['konva', 'react-konva', 'canvg'],
  },
};

/**
 * Get library suggestions for a component type
 */
export function getSuggestionsForComponent(
  componentType: string,
  profession: string,
  enabledFeatures: Set<string>,
): ComponentSuggestions | null {
  const config = COMPONENT_LIBRARY_SUGGESTIONS[componentType];

  if (!config) {
    return null;
  }

  const professionConfig = PROFESSION_FEATURE_MATRIX[profession];
  if (!professionConfig) {
    return null;
  }

  const suggestions: LibrarySuggestion[] = [];
  const suggestedFeatures: ComponentSuggestions['suggestedFeatures'] = [];
  let totalBundleKB = 0;
  const bundleBreakdown: Array<{ library: string; sizeKB: number }> = [];

  // Process essential libraries
  config.essentialLibraries.forEach((libraryName) => {
    const library = LIBRARY_MAPPINGS.find(
      (l) => l.npmPackage === libraryName || l.libraryName === libraryName,
    );

    if (library) {
      const alreadyEnabled = library.controlledBy.some((f) => enabledFeatures.has(f));
      const controllingFeature = library.controlledBy[0];

      suggestions.push({
        library,
        reason: `Essential for ${componentType}`,
        priority: 'critical',
        feature: controllingFeature,
        alreadyEnabled,
      });

      if (!alreadyEnabled) {
        totalBundleKB += library.bundleSize;
        bundleBreakdown.push({
          library: library.libraryName,
          sizeKB: library.bundleSize,
        });
      }
    }
  });

  // Process recommended libraries
  config.recommendedLibraries.forEach((libraryName) => {
    const library = LIBRARY_MAPPINGS.find(
      (l) => l.npmPackage === libraryName || l.libraryName === libraryName,
    );

    if (library) {
      const alreadyEnabled = library.controlledBy.some((f) => enabledFeatures.has(f));
      const controllingFeature = library.controlledBy[0];

      suggestions.push({
        library,
        reason: `Recommended for enhanced functionality`,
        priority: 'recommended',
        feature: controllingFeature,
        alreadyEnabled,
      });

      if (!alreadyEnabled) {
        totalBundleKB += library.bundleSize;
        bundleBreakdown.push({
          library: library.libraryName,
          sizeKB: library.bundleSize,
        });
      }
    }
  });

  // Process optional libraries
  config.optionalLibraries.forEach((libraryName) => {
    const library = LIBRARY_MAPPINGS.find(
      (l) => l.npmPackage === libraryName || l.libraryName === libraryName,
    );

    if (library) {
      const alreadyEnabled = library.controlledBy.some((f) => enabledFeatures.has(f));
      const controllingFeature = library.controlledBy[0];

      suggestions.push({
        library,
        reason: `Optional for advanced features`,
        priority: 'optional',
        feature: controllingFeature,
        alreadyEnabled,
      });

      // Don't count optional in bundle impact by default
    }
  });

  // Build suggested features list
  config.features.forEach((featureId) => {
    const feature = professionConfig.availableFeatures[featureId];
    if (feature) {
      const featureLibraries = LIBRARY_MAPPINGS.filter((lib) =>
        lib.controlledBy.includes(featureId),
      ).map((lib) => lib.libraryName);

      suggestedFeatures.push({
        featureId,
        featureName: feature.description,
        plan: feature.plan,
        libraries: featureLibraries,
        enabled: enabledFeatures.has(featureId),
      });
    }
  });

  return {
    componentType,
    componentName: componentType
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    description: config.description,
    suggestedLibraries: suggestions,
    suggestedFeatures,
    estimatedBundleImpact: {
      totalKB: totalBundleKB,
      totalMB: Math.round((totalBundleKB / 1024) * 10) / 10,
      breakdown: bundleBreakdown.sort((a, b) => b.sizeKB - a.sizeKB),
    },
  };
}

/**
 * Get all supported component types
 */
export function getSupportedComponentTypes(): Array<{
  type: string;
  name: string;
  description: string;
  category: string;
}> {
  return [
    {
      type: 'video-player',
      name: 'Video Player',
      description: 'HLS/DASH streaming player',
      category: 'media',
    },
    {
      type: 'audio-player',
      name: 'Audio Player',
      description: 'Waveform audio player',
      category: 'media',
    },
    {
      type: 'video-editor',
      name: 'Video Editor',
      description: 'Full video editing suite',
      category: 'media',
    },
    {
      type: 'image-gallery',
      name: 'Image Gallery',
      description: 'Virtual scrolling gallery',
      category: 'media',
    },
    {
      type: 'drag-drop-builder',
      name: 'Drag & Drop Builder',
      description: 'Visual interface builder',
      category: 'tools',
    },
    {
      type: 'color-grading-tool',
      name: 'Color Grading',
      description: '627 LUT library',
      category: 'tools',
    },
    {
      type: 'animation-timeline',
      name: 'Animation Timeline',
      description: '485 transitions',
      category: 'tools',
    },
    {
      type: 'analytics-dashboard',
      name: 'Analytics Dashboard',
      description: 'Charts and graphs',
      category: 'analytics',
    },
    { type: 'ai-tool', name: 'AI Processing', description: 'AI-powered tools', category: 'ai' },
    {
      type: 'mobile-app',
      name: 'Mobile PWA',
      description: 'Progressive web app',
      category: 'mobile',
    },
    {
      type: '3d-graphics',
      name: '3D Graphics',
      description: 'WebGL 3D rendering',
      category: 'graphics',
    },
    {
      type: 'text-editor',
      name: 'Text Editor',
      description: 'Rich text editing',
      category: 'editing',
    },
  ];
}

/**
 * Auto-detect component type from props/metadata
 */
export function detectComponentType(metadata: {
  hasVideo?: boolean;
  hasAudio?: boolean;
  hasTimeline?: boolean;
  hasTransitions?: boolean;
  hasColorGrading?: boolean;
  hasDragDrop?: boolean;
  has3D?: boolean;
  hasCharts?: boolean;
  hasAI?: boolean;
  isMobile?: boolean;
  hasTextEditing?: boolean;
}): string | null {
  if (metadata.hasVideo && metadata.hasTimeline && metadata.hasTransitions) {
    return 'video-editor';
  }

  if (metadata.hasVideo) {
    return 'video-player';
  }

  if (metadata.hasAudio) {
    return 'audio-player';
  }

  if (metadata.hasColorGrading) {
    return 'color-grading-tool';
  }

  if (metadata.hasDragDrop && metadata.hasTimeline) {
    return 'drag-drop-builder';
  }

  if (metadata.hasTransitions) {
    return 'animation-timeline';
  }

  if (metadata.hasCharts) {
    return 'analytics-dashboard';
  }

  if (metadata.hasAI) {
    return 'ai-tool';
  }

  if (metadata.isMobile) {
    return 'mobile-app';
  }

  if (metadata.has3D) {
    return '3d-graphics';
  }

  if (metadata.hasTextEditing) {
    return 'text-editor';
  }

  return null;
}
