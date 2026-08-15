/**
 * 🔗 Library-to-Feature Mapping System
 * Maps all 60+ npm libraries to feature flags for granular control
 */

import { PROFESSION_FEATURE_MATRIX } from './profession-feature-matrix';

export interface LibraryMapping {
  // Library Info
  libraryName: string;
  npmPackage: string;
  version: string;
  bundleSize: number; // KB

  // Feature Control
  controlledBy: string[]; // Feature IDs that enable this library
  requiredPlan: 'basic' | 'pro' | 'enterprise';

  // Technical Details
  category: 'video' | 'audio' | 'graphics' | 'ui' | 'utility' | 'color' | 'streaming' | 'ai';
  isCore: boolean; // Core libraries (React, MUI) can't be disabled
  autoImport: boolean; // Auto-import when feature enabled?
  lazy: boolean; // Lazy load this library?

  // Dependencies
  peerDependencies?: string[]; // Other libraries this depends on

  // Metadata
  description: string;
  documentation?: string;
  performanceImpact: 'low' | 'medium' | 'high';
}

/**
 * Complete mapping of all 60+ libraries to features
 */
export const LIBRARY_MAPPINGS: LibraryMapping[] = [
  // ============================================
  // CORE LIBRARIES (Can't be disabled)
  // ============================================
  {
    libraryName: 'React',
    npmPackage: 'react',
    version: '18.2.0',
    bundleSize: 42,
    controlledBy: [],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: true,
    autoImport: true,
    lazy: false,
    description: 'Core React library',
    performanceImpact: 'high',
  },
  {
    libraryName: 'Material-UI',
    npmPackage: '@mui/material',
    version: '5.14.0',
    bundleSize: 890,
    controlledBy: [],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: true,
    autoImport: true,
    lazy: false,
    description: 'Material-UI component library',
    performanceImpact: 'high',
  },
  {
    libraryName: 'React Query',
    npmPackage: '@tanstack/react-query',
    version: '5.0.0',
    bundleSize: 42,
    controlledBy: [],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: true,
    autoImport: true,
    lazy: false,
    description: 'Server state management',
    performanceImpact: 'medium',
  },

  // ============================================
  // VIDEO STREAMING (shaka-player, hls.js, etc.)
  // ============================================
  {
    libraryName: 'Shaka Player',
    npmPackage: 'shaka-player',
    version: '4.7.0',
    bundleSize: 7200,
    controlledBy: ['hls-import', 'streaming-setup'],
    requiredPlan: 'enterprise',
    category: 'streaming',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Adaptive bitrate streaming (HLS/DASH)',
    documentation: 'https://github.com/shaka-project/shaka-player',
    performanceImpact: 'high',
  },
  {
    libraryName: 'HLS.js',
    npmPackage: 'hls.js',
    version: '1.5.0',
    bundleSize: 3100,
    controlledBy: ['hls-import', 'streaming-setup'],
    requiredPlan: 'enterprise',
    category: 'streaming',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'HLS protocol implementation',
    documentation: 'https://github.com/video-dev/hls.js',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'M3U8 Parser',
    npmPackage: 'm3u8-parser',
    version: '7.1.0',
    bundleSize: 45,
    controlledBy: ['hls-import'],
    requiredPlan: 'enterprise',
    category: 'streaming',
    isCore: false,
    autoImport: true,
    lazy: false,
    peerDependencies: ['hls.js'],
    description: 'Parse HLS playlists',
    performanceImpact: 'low',
  },
  {
    libraryName: 'MediaInfo.js',
    npmPackage: 'mediainfo.js',
    version: '0.3.0',
    bundleSize: 2800,
    controlledBy: ['video-analytics', 'streaming-setup'],
    requiredPlan: 'pro',
    category: 'video',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Extract media file metadata',
    performanceImpact: 'medium',
  },

  // ============================================
  // VIDEO EDITING (pixi, three, gl-transitions)
  // ============================================
  {
    libraryName: 'PixiJS',
    npmPackage: 'pixi.js',
    version: '7.4.0',
    bundleSize: 450,
    controlledBy: ['gpu-filters', '485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'WebGL 2D renderer for filters & effects',
    documentation: 'https://pixijs.com',
    performanceImpact: 'high',
  },
  {
    libraryName: 'PixiJS Filters',
    npmPackage: 'pixi-filters',
    version: '5.3.0',
    bundleSize: 180,
    controlledBy: ['gpu-filters'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    peerDependencies: ['pixi.js'],
    description: '40+ GPU-accelerated filters',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'Three.js',
    npmPackage: 'three',
    version: '0.160.0',
    bundleSize: 580,
    controlledBy: ['485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: '3D graphics library for advanced transitions',
    documentation: 'https://threejs.org',
    performanceImpact: 'high',
  },
  {
    libraryName: 'GL Transitions',
    npmPackage: 'gl-transitions',
    version: '1.1.0',
    bundleSize: 25,
    controlledBy: ['485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    peerDependencies: ['three'],
    description: '450+ WebGL transitions',
    documentation: 'https://gl-transitions.com',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'GL Matrix',
    npmPackage: 'gl-matrix',
    version: '3.4.3',
    bundleSize: 32,
    controlledBy: ['485-transitions', 'gpu-filters'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'High-performance matrix/vector math',
    performanceImpact: 'low',
  },

  // ============================================
  // COLOR GRADING & LUTS
  // ============================================
  {
    libraryName: 'LUT.js',
    npmPackage: 'lut.js',
    version: '0.1.0',
    bundleSize: 18,
    controlledBy: ['627-luts', 'cultural-luts', 'script-luts', 'color-grading'],
    requiredPlan: 'basic',
    category: 'color',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: '3D LUT parser & applicator',
    performanceImpact: 'low',
  },
  {
    libraryName: 'Color.js',
    npmPackage: 'colorjs.io',
    version: '0.5.0',
    bundleSize: 85,
    controlledBy: ['color-grading', '627-luts'],
    requiredPlan: 'basic',
    category: 'color',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Advanced color science library',
    documentation: 'https://colorjs.io',
    performanceImpact: 'low',
  },
  {
    libraryName: 'Colord',
    npmPackage: 'colord',
    version: '2.9.3',
    bundleSize: 12,
    controlledBy: ['color-grading', '627-luts'],
    requiredPlan: 'basic',
    category: 'color',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Fast color manipulation',
    performanceImpact: 'low',
  },
  {
    libraryName: 'Chroma.js',
    npmPackage: 'chroma-js',
    version: '2.4.2',
    bundleSize: 45,
    controlledBy: ['color-grading'],
    requiredPlan: 'basic',
    category: 'color',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Color scales and conversions',
    performanceImpact: 'low',
  },

  // ============================================
  // AUDIO (wavesurfer, meyda, audio processing)
  // ============================================
  {
    libraryName: 'Wavesurfer.js',
    npmPackage: 'wavesurfer.js',
    version: '7.7.0',
    bundleSize: 120,
    controlledBy: ['professional-waveforms'],
    requiredPlan: 'pro',
    category: 'audio',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Audio waveform visualization',
    documentation: 'https://wavesurfer-js.org',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'Meyda',
    npmPackage: 'meyda',
    version: '5.6.0',
    bundleSize: 45,
    controlledBy: ['beat-detection'],
    requiredPlan: 'pro',
    category: 'audio',
    isCore: false,
    autoImport: true,
    lazy: false,
    peerDependencies: ['wavesurfer.js'],
    description: 'Audio feature extraction (BPM, beats)',
    documentation: 'https://meyda.js.org',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'Audio Decode',
    npmPackage: 'audio-decode',
    version: '2.1.3',
    bundleSize: 28,
    controlledBy: ['audio-enhancement-suite', 'professional-waveforms'],
    requiredPlan: 'basic',
    category: 'audio',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Decode audio files to PCM',
    performanceImpact: 'low',
  },
  {
    libraryName: 'WAV Decoder',
    npmPackage: 'wav-decoder',
    version: '1.3.0',
    bundleSize: 8,
    controlledBy: ['audio-enhancement-suite'],
    requiredPlan: 'basic',
    category: 'audio',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Decode WAV files',
    performanceImpact: 'low',
  },
  {
    libraryName: 'WAV Encoder',
    npmPackage: 'wav-encoder',
    version: '1.3.0',
    bundleSize: 6,
    controlledBy: ['audio-enhancement-suite'],
    requiredPlan: 'basic',
    category: 'audio',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Encode PCM to WAV',
    performanceImpact: 'low',
  },
  {
    libraryName: 'Music Metadata',
    npmPackage: 'music-metadata-browser',
    version: '2.5.10',
    bundleSize: 95,
    controlledBy: ['music-showcase-display', 'audio-enhancement-suite'],
    requiredPlan: 'basic',
    category: 'audio',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Parse audio metadata (ID3, etc.)',
    performanceImpact: 'low',
  },
  {
    libraryName: 'FFT.js',
    npmPackage: 'fft.js',
    version: '4.0.4',
    bundleSize: 12,
    controlledBy: ['professional-waveforms', 'beat-detection'],
    requiredPlan: 'pro',
    category: 'audio',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Fast Fourier Transform for audio analysis',
    performanceImpact: 'low',
  },

  // ============================================
  // TEXT & GRAPHICS
  // ============================================
  {
    libraryName: 'Fabric.js',
    npmPackage: 'fabric',
    version: '5.3.0',
    bundleSize: 280,
    controlledBy: ['text-overlays'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Canvas text manipulation',
    documentation: 'http://fabricjs.com',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'GSAP',
    npmPackage: 'gsap',
    version: '3.12.5',
    bundleSize: 138,
    controlledBy: ['text-overlays', '485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Animation engine for text effects',
    documentation: 'https://greensock.com/gsap',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'CanVG',
    npmPackage: 'canvg',
    version: '4.0.2',
    bundleSize: 125,
    controlledBy: ['svg-logo-import', 'text-overlays'],
    requiredPlan: 'enterprise',
    category: 'graphics',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'SVG to Canvas rendering',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'OpenType.js',
    npmPackage: 'opentype.js',
    version: '1.3.4',
    bundleSize: 210,
    controlledBy: ['custom-fonts'],
    requiredPlan: 'enterprise',
    category: 'graphics',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Parse custom font files',
    documentation: 'https://opentype.js.org',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'Lottie Web',
    npmPackage: 'lottie-web',
    version: '5.12.2',
    bundleSize: 145,
    controlledBy: ['text-overlays', '485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Motion graphics animations',
    documentation: 'https://airbnb.io/lottie',
    performanceImpact: 'medium',
  },

  // ============================================
  // VIDEO EXPORT & ENCODING
  // ============================================
  {
    libraryName: 'MP4 Muxer',
    npmPackage: 'mp4-muxer',
    version: '5.1.0',
    bundleSize: 68,
    controlledBy: ['mp4-muxer-export'],
    requiredPlan: 'basic',
    category: 'video',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: '10x faster browser video export',
    documentation: 'https://github.com/Vanilagy/mp4-muxer',
    performanceImpact: 'high',
  },
  {
    libraryName: 'FFmpeg.wasm',
    npmPackage: '@ffmpeg/ffmpeg',
    version: '0.12.0',
    bundleSize: 28000,
    controlledBy: ['mobile-export-presets', 'video-editor-workflow'],
    requiredPlan: 'basic',
    category: 'video',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'FFmpeg in browser (WebAssembly)',
    documentation: 'https://ffmpegwasm.netlify.app',
    performanceImpact: 'high',
  },
  {
    libraryName: 'MP4Box.js',
    npmPackage: 'mp4box',
    version: '0.5.2',
    bundleSize: 310,
    controlledBy: ['video-editor-workflow', 'streaming-setup'],
    requiredPlan: 'basic',
    category: 'video',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'MP4 file parsing & manipulation',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'Mux.js',
    npmPackage: 'mux.js',
    version: '7.0.0',
    bundleSize: 92,
    controlledBy: ['streaming-setup', 'hls-import'],
    requiredPlan: 'enterprise',
    category: 'video',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Transmux MPEG2-TS to MP4',
    performanceImpact: 'medium',
  },

  // ============================================
  // CAPTIONS & SUBTITLES
  // ============================================
  {
    libraryName: 'SRT Parser 2',
    npmPackage: 'srt-parser-2',
    version: '1.2.3',
    bundleSize: 8,
    controlledBy: ['auto-captions'],
    requiredPlan: 'pro',
    category: 'video',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Parse SRT subtitle files',
    performanceImpact: 'low',
  },
  {
    libraryName: 'WebVTT Parser',
    npmPackage: 'webvtt-parser',
    version: '2.2.0',
    bundleSize: 14,
    controlledBy: ['auto-captions'],
    requiredPlan: 'pro',
    category: 'video',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Parse WebVTT captions',
    performanceImpact: 'low',
  },

  // ============================================
  // ANIMATION & MOTION
  // ============================================
  {
    libraryName: 'Framer Motion',
    npmPackage: 'framer-motion',
    version: '11.0.0',
    bundleSize: 210,
    controlledBy: ['text-overlays', '485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Production-ready React animations',
    documentation: 'https://www.framer.com/motion',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'Framesync',
    npmPackage: 'framesync',
    version: '6.1.2',
    bundleSize: 8,
    controlledBy: ['speed-ramps', 'optical-flow'],
    requiredPlan: 'basic',
    category: 'video',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Frame-accurate timing & interpolation',
    performanceImpact: 'low',
  },
  {
    libraryName: 'D3 Ease',
    npmPackage: 'd3-ease',
    version: '3.0.1',
    bundleSize: 12,
    controlledBy: ['485-transitions', 'speed-ramps'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Easing functions for smooth transitions',
    performanceImpact: 'low',
  },

  // ============================================
  // THUMBNAILS & CACHING
  // ============================================
  {
    libraryName: 'ThumbHash',
    npmPackage: 'thumbhash',
    version: '0.1.1',
    bundleSize: 6,
    controlledBy: ['universal-showcase'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Compact image placeholders',
    performanceImpact: 'low',
  },
  {
    libraryName: 'IDB KeyVal',
    npmPackage: 'idb-keyval',
    version: '6.2.1',
    bundleSize: 2,
    controlledBy: ['universal-showcase', 'story-arc-studio'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'IndexedDB caching',
    performanceImpact: 'low',
  },

  // ============================================
  // IMAGE PROCESSING
  // ============================================
  {
    libraryName: 'EXIFR',
    npmPackage: 'exifr',
    version: '7.1.3',
    bundleSize: 95,
    controlledBy: ['metadata-editor', 'photo-enhancement'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Fast EXIF metadata extraction',
    performanceImpact: 'low',
  },

  // ============================================
  // UX & GESTURES
  // ============================================
  {
    libraryName: 'Use Gesture',
    npmPackage: '@use-gesture/react',
    version: '10.3.0',
    bundleSize: 38,
    controlledBy: ['touch-gestures', 'mobile-shot-list'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Advanced touch/mouse gestures',
    performanceImpact: 'low',
  },
  {
    libraryName: 'React Dropzone',
    npmPackage: 'react-dropzone',
    version: '14.2.3',
    bundleSize: 18,
    controlledBy: ['media-upload', 'universal-showcase'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Drag & drop file uploads',
    performanceImpact: 'low',
  },

  // ============================================
  // VIRTUAL SCROLLING & PERFORMANCE
  // ============================================
  {
    libraryName: 'TanStack Virtual',
    npmPackage: '@tanstack/react-virtual',
    version: '3.0.0',
    bundleSize: 22,
    controlledBy: ['universal-showcase'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Virtual scrolling for large lists',
    performanceImpact: 'medium',
  },

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  {
    libraryName: 'Zustand',
    npmPackage: 'zustand',
    version: '4.5.0',
    bundleSize: 4,
    controlledBy: ['story-arc-studio'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Lightweight state management for video editor',
    performanceImpact: 'low',
  },
  {
    libraryName: 'Immer',
    npmPackage: 'immer',
    version: '10.0.3',
    bundleSize: 18,
    controlledBy: ['story-arc-studio'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: true,
    lazy: false,
    peerDependencies: ['zustand'],
    description: 'Immutable state updates',
    performanceImpact: 'low',
  },

  // ============================================
  // WEB WORKERS & PERFORMANCE
  // ============================================
  {
    libraryName: 'Comlink',
    npmPackage: 'comlink',
    version: '4.4.1',
    bundleSize: 6,
    controlledBy: ['audio-enhancement-suite', 'background-removal', 'auto-captions'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'RPC for Web Workers',
    performanceImpact: 'low',
  },

  // ============================================
  // DND & TIMELINE
  // ============================================
  {
    libraryName: 'DnD Kit',
    npmPackage: '@dnd-kit/core',
    version: '6.1.0',
    bundleSize: 42,
    controlledBy: ['story-arc-studio', 'multitrack-timeline'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Drag & drop for timeline editing',
    documentation: 'https://dndkit.com',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'React DnD',
    npmPackage: 'react-dnd',
    version: '16.0.1',
    bundleSize: 58,
    controlledBy: ['story-arc-studio'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Alternative DnD library',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'React Resizable Panels',
    npmPackage: 'react-resizable-panels',
    version: '2.0.0',
    bundleSize: 28,
    controlledBy: ['story-arc-studio'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Resizable panels for video editor',
    performanceImpact: 'low',
  },

  // ============================================
  // WEBGPU & WEBGL HELPERS
  // ============================================
  {
    libraryName: 'WebGPU Types',
    npmPackage: '@webgpu/types',
    version: '0.1.40',
    bundleSize: 0, // TypeScript only
    controlledBy: ['gpu-filters'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'WebGPU TypeScript types',
    performanceImpact: 'low',
  },
  {
    libraryName: 'GLSL Fast Gaussian Blur',
    npmPackage: 'glsl-fast-gaussian-blur',
    version: '1.1.0',
    bundleSize: 3,
    controlledBy: ['gpu-filters'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Optimized blur shaders',
    performanceImpact: 'low',
  },
  {
    libraryName: 'Curtains.js',
    npmPackage: 'curtainsjs',
    version: '8.1.6',
    bundleSize: 95,
    controlledBy: ['gpu-filters', '485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'WebGL image & video effects',
    performanceImpact: 'medium',
  },

  // ============================================
  // BACKEND LIBRARIES (Node.js)
  // ============================================
  {
    libraryName: 'FFmpeg Static',
    npmPackage: '@ffmpeg-installer/ffmpeg',
    version: '1.1.0',
    bundleSize: 52000, // Binary
    controlledBy: ['mobile-export-presets', 'video-worklog-automation'],
    requiredPlan: 'basic',
    category: 'video',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'FFmpeg binary for backend video processing',
    performanceImpact: 'high',
  },
  {
    libraryName: 'FFprobe Installer',
    npmPackage: '@ffprobe-installer/ffprobe',
    version: '1.4.1',
    bundleSize: 15000, // Binary
    controlledBy: ['video-analytics'],
    requiredPlan: 'pro',
    category: 'video',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Video metadata extraction',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'Fluent FFmpeg',
    npmPackage: 'fluent-ffmpeg',
    version: '2.1.2',
    bundleSize: 38,
    controlledBy: ['mobile-export-presets', 'video-worklog-automation'],
    requiredPlan: 'basic',
    category: 'video',
    isCore: false,
    autoImport: false,
    lazy: true,
    peerDependencies: ['@ffmpeg-installer/ffmpeg'],
    description: 'FFmpeg wrapper for Node.js',
    performanceImpact: 'low',
  },
  {
    libraryName: 'BullMQ',
    npmPackage: 'bullmq',
    version: '5.1.0',
    bundleSize: 125,
    controlledBy: ['audio-enhancement-suite', 'auto-captions', 'background-removal'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Job queue for long-running tasks',
    performanceImpact: 'medium',
  },

  // ============================================
  // SPEED & OPTICAL FLOW
  // ============================================
  {
    libraryName: 'Framesync',
    npmPackage: 'framesync',
    version: '6.1.2',
    bundleSize: 8,
    controlledBy: ['speed-ramps', 'optical-flow'],
    requiredPlan: 'basic',
    category: 'video',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Frame-accurate timing for speed effects',
    performanceImpact: 'low',
  },

  // ============================================
  // DRAG & DROP
  // ============================================
  {
    libraryName: 'React Beautiful DnD',
    npmPackage: 'react-beautiful-dnd',
    version: '13.1.1',
    bundleSize: 68,
    controlledBy: ['story-arc-studio', 'showcase-management'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Beautiful drag and drop',
    performanceImpact: 'medium',
  },

  // ============================================
  // CHARTS & VISUALIZATION
  // ============================================
  {
    libraryName: 'Recharts',
    npmPackage: 'recharts',
    version: '2.10.0',
    bundleSize: 420,
    controlledBy: ['showcase-analytics', 'video-analytics'],
    requiredPlan: 'pro',
    category: 'ui',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Analytics charts',
    performanceImpact: 'medium',
  },
  {
    libraryName: 'D3.js',
    npmPackage: 'd3',
    version: '7.8.5',
    bundleSize: 280,
    controlledBy: ['showcase-analytics', 'professional-waveforms'],
    requiredPlan: 'pro',
    category: 'ui',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Data visualization library',
    documentation: 'https://d3js.org',
    performanceImpact: 'high',
  },

  // ============================================
  // NOTIFICATIONS & TOASTS
  // ============================================
  {
    libraryName: 'Notistack',
    npmPackage: 'notistack',
    version: '3.0.1',
    bundleSize: 18,
    controlledBy: ['push-notifications', 'wedding-timeline-notifications'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Snackbar notification system',
    performanceImpact: 'low',
  },

  // ============================================
  // HTTP & API
  // ============================================
  {
    libraryName: 'Axios',
    npmPackage: 'axios',
    version: '1.6.0',
    bundleSize: 32,
    controlledBy: [],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: true,
    autoImport: true,
    lazy: false,
    description: 'HTTP client',
    performanceImpact: 'low',
  },

  // ============================================
  // ROUTING
  // ============================================
  {
    libraryName: 'React Router DOM',
    npmPackage: 'react-router-dom',
    version: '6.22.0',
    bundleSize: 72,
    controlledBy: ['story-arc-studio', 'video-editor-workflow'],
    requiredPlan: 'basic',
    category: 'ui',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'Client-side routing',
    performanceImpact: 'low',
  },

  // ============================================
  // SPRING ANIMATIONS
  // ============================================
  {
    libraryName: 'React Spring',
    npmPackage: 'react-spring',
    version: '9.7.3',
    bundleSize: 115,
    controlledBy: ['text-overlays', '485-transitions'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Spring physics animations',
    documentation: 'https://www.react-spring.dev',
    performanceImpact: 'medium',
  },

  // ============================================
  // WEBASSEMBLY & DSP
  // ============================================
  {
    libraryName: 'RNNoise WASM',
    npmPackage: 'rnnoise-wasm',
    version: '1.0.0',
    bundleSize: 420,
    controlledBy: ['audio-enhancement-suite'],
    requiredPlan: 'basic',
    category: 'audio',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'AI noise reduction (WebAssembly)',
    performanceImpact: 'high',
  },
  {
    libraryName: 'ONNX Runtime Web',
    npmPackage: 'onnxruntime-web',
    version: '1.17.0',
    bundleSize: 8900,
    controlledBy: ['audio-enhancement-suite', 'background-removal'],
    requiredPlan: 'basic',
    category: 'ai',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Run ONNX models in browser (DCCRN, Demucs)',
    performanceImpact: 'high',
  },

  // ============================================
  // CANVAS & GRAPHICS HELPERS
  // ============================================
  {
    libraryName: 'Konva',
    npmPackage: 'konva',
    version: '9.3.0',
    bundleSize: 520,
    controlledBy: ['text-overlays', 'gpu-filters'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Canvas framework for complex graphics',
    documentation: 'https://konvajs.org',
    performanceImpact: 'high',
  },
  {
    libraryName: 'React Konva',
    npmPackage: 'react-konva',
    version: '18.2.10',
    bundleSize: 42,
    controlledBy: ['text-overlays'],
    requiredPlan: 'basic',
    category: 'graphics',
    isCore: false,
    autoImport: false,
    lazy: true,
    peerDependencies: ['konva'],
    description: 'React bindings for Konva',
    performanceImpact: 'medium',
  },

  // ============================================
  // FILE SYSTEM
  // ============================================
  {
    libraryName: 'File System Access Types',
    npmPackage: '@types/wicg-file-system-access',
    version: '2023.10.5',
    bundleSize: 0, // TypeScript only
    controlledBy: ['media-upload', 'video-google-drive-import'],
    requiredPlan: 'basic',
    category: 'utility',
    isCore: false,
    autoImport: true,
    lazy: false,
    description: 'File System Access API types',
    performanceImpact: 'low',
  },

  // ============================================
  // BACKEND PYTHON WORKERS
  // ============================================
  {
    libraryName: 'PyTorch (Backend)',
    npmPackage: 'torch',
    version: '2.1.0',
    bundleSize: 850000, // Backend only, not in bundle
    controlledBy: ['audio-enhancement-suite', 'background-removal'],
    requiredPlan: 'basic',
    category: 'ai',
    isCore: false,
    autoImport: false,
    lazy: true,
    description: 'Backend AI processing (RNNoise, DCCRN, Demucs)',
    performanceImpact: 'high',
  },
  {
    libraryName: 'DeepFilterNet (Backend)',
    npmPackage: 'deepfilternet',
    version: '0.5.0',
    bundleSize: 45000, // Backend only
    controlledBy: ['audio-enhancement-suite'],
    requiredPlan: 'basic',
    category: 'ai',
    isCore: false,
    autoImport: false,
    lazy: true,
    peerDependencies: ['torch'],
    description: 'AI speech enhancement',
    performanceImpact: 'high',
  },
  {
    libraryName: 'Demucs (Backend)',
    npmPackage: 'demucs',
    version: '4.0.0',
    bundleSize: 12000, // Backend only
    controlledBy: ['audio-enhancement-suite'],
    requiredPlan: 'basic',
    category: 'ai',
    isCore: false,
    autoImport: false,
    lazy: true,
    peerDependencies: ['torch'],
    description: 'AI source separation',
    performanceImpact: 'high',
  },
];

/**
 * Get all libraries controlled by a feature
 */
export function getLibrariesForFeature(featureId: string): LibraryMapping[] {
  return LIBRARY_MAPPINGS.filter((lib) => lib.controlledBy.includes(featureId));
}

/**
 * Check if library is available based on enabled features
 */
export function isLibraryAvailable(
  libraryName: string,
  profession: string,
  enabledFeatures: Set<string>,
): boolean {
  const lib = LIBRARY_MAPPINGS.find(
    (l) => l.npmPackage === libraryName || l.libraryName === libraryName,
  );

  if (!lib) return false;
  if (lib.isCore) return true; // Core libraries always available

  return lib.controlledBy.some((feature) => enabledFeatures.has(feature));
}

/**
 * Get feature that controls a library
 */
export function getControllingFeatures(libraryName: string): string[] {
  const lib = LIBRARY_MAPPINGS.find(
    (l) => l.npmPackage === libraryName || l.libraryName === libraryName,
  );

  return lib?.controlledBy || [];
}

/**
 * Calculate total bundle size for enabled features
 */
export function calculateBundleSize(
  profession: string,
  enabledFeatures: Set<string>,
): {
  totalSizeKB: number;
  totalSizeMB: number;
  breakdown: Array<{
    library: string;
    sizeKB: number;
    feature: string;
  }>;
} {
  const breakdown: Array<{
    library: string;
    sizeKB: number;
    feature: string;
  }> = [];

  let totalSizeKB = 0;

  LIBRARY_MAPPINGS.forEach((lib) => {
    const isAvailable = isLibraryAvailable(lib.npmPackage, profession, enabledFeatures);

    if (isAvailable) {
      totalSizeKB += lib.bundleSize;
      breakdown.push({
        library: lib.libraryName,
        sizeKB: lib.bundleSize,
        feature: lib.controlledBy[0] || 'core',
      });
    }
  });

  return {
    totalSizeKB,
    totalSizeMB: Math.round((totalSizeKB / 1024) * 10) / 10,
    breakdown: breakdown.sort((a, b) => b.sizeKB - a.sizeKB),
  };
}

/**
 * Get libraries by category
 */
export function getLibrariesByCategory(category: LibraryMapping['category']): LibraryMapping[] {
  return LIBRARY_MAPPINGS.filter((lib) => lib.category === category);
}

/**
 * Get all lazy-loadable libraries
 */
export function getLazyLibraries(): LibraryMapping[] {
  return LIBRARY_MAPPINGS.filter((lib) => lib.lazy);
}

/**
 * Validate library dependencies
 */
export function validateLibraryDependencies(
  libraryName: string,
  availableLibraries: Set<string>,
): {
  isValid: boolean;
  missingDependencies: string[];
} {
  const lib = LIBRARY_MAPPINGS.find(
    (l) => l.npmPackage === libraryName || l.libraryName === libraryName,
  );

  if (!lib || !lib.peerDependencies) {
    return { isValid: true, missingDependencies: [] };
  }

  const missing = lib.peerDependencies.filter((dep) => !availableLibraries.has(dep));

  return {
    isValid: missing.length === 0,
    missingDependencies: missing,
  };
}
