/**
 * Comprehensive Lens Specifications Database
 * 
 * Real-world specifications for camera lenses from major manufacturers.
 * Used by Virtual Studio to accurately simulate lens characteristics.
 * 
 * All specifications sourced from manufacturer datasheets.
 */

export interface LensSpec {
  id: string;
  brand: string;
  model: string;
  mount: 'rf' | 'ef' | 'fe' | 'e' | 'z' | 'f' | 'x' | 'l' | 'mft' | 'a' | 'sa' | 'universal';
  
  // Focal Length
  focalLength: number | [number, number];  // mm (single or zoom range)
  isZoom: boolean;
  
  // Aperture
  maxAperture: number | [number, number];  // f-number (single or variable)
  minAperture: number;                     // Smallest aperture (largest f-number)
  apertureBlades: number;                  // Number of diaphragm blades
  
  // Optical
  elements: number;           // Number of lens elements
  groups: number;             // Number of lens groups
  specialElements?: string[]; // UD, aspherical, fluorite, etc.
  
  // Focus
  minFocusDistance: number;   // meters
  maxMagnification: number;   // e.g., 0.25 = 1:4
  autofocus: boolean;
  stabilization: boolean;     // In-lens stabilization
  
  // Physical
  filterSize?: number;        // mm (front filter thread)
  length: number;             // mm
  diameter: number;           // mm
  weight: number;             // grams
  
  // Optical Characteristics (for simulation)
  fieldOfView?: number;       // degrees (diagonal, at infinity for primes)
  distortion?: number;        // -1 to 1 (negative = barrel, positive = pincushion)
  vignetting?: number;        // 0-1 (corner light falloff at max aperture)
  chromaticAberration?: number; // 0-1 rating
  bokehQuality?: number;      // 0-1 rating (smoothness of out-of-focus areas)
  sharpnessCenter?: number;   // 0-1 rating at max aperture
  sharpnessCorner?: number;   // 0-1 rating at max aperture
  
  // Price
  price?: number;             // USD MSRP
}

// =============================================================================
// CANON RF LENSES (Mirrorless Full-Frame)
// =============================================================================

export const CANON_RF_SPECS: LensSpec[] = [
  // RF Prime Lenses
  {
    id: 'canon_rf_50mm_f1.2',
    brand: 'Canon',
    model: 'RF 50mm f/1.2L USM',
    mount: 'rf',
    focalLength: 50,
    isZoom: false,
    maxAperture: 1.2,
    minAperture: 16,
    apertureBlades: 10,
    elements: 15,
    groups: 9,
    specialElements: ['UD','Aspherical'],
    minFocusDistance: 0.4,
    maxMagnification: 0.19,
    autofocus: true,
    stabilization: false,
    filterSize: 77,
    length: 108,
    diameter: 89.8,
    weight: 950,
    fieldOfView: 46,
    distortion: -0.02,
    vignetting: 0.3,
    bokehQuality: 0.95,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.85,
    price: 2299,
  },
  {
    id: 'canon_rf_85mm_f1.2',
    brand: 'Canon',
    model: 'RF 85mm f/1.2L USM',
    mount: 'rf',
    focalLength: 85,
    isZoom: false,
    maxAperture: 1.2,
    minAperture: 16,
    apertureBlades: 9,
    elements: 13,
    groups: 9,
    specialElements: ['UD','Aspherical','Blue Spectrum Refractive'],
    minFocusDistance: 0.85,
    maxMagnification: 0.12,
    autofocus: true,
    stabilization: false,
    filterSize: 82,
    length: 117.3,
    diameter: 103.2,
    weight: 1195,
    fieldOfView: 28.3,
    distortion: 0.01,
    vignetting: 0.25,
    bokehQuality: 0.98,
    sharpnessCenter: 0.95,
    sharpnessCorner: 0.88,
    price: 2699,
  },
  {
    id: 'canon_rf_35mm_f1.8',
    brand: 'Canon',
    model: 'RF 35mm f/1.8 Macro IS STM',
    mount: 'rf',
    focalLength: 35,
    isZoom: false,
    maxAperture: 1.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 11,
    groups: 9,
    specialElements: ['Aspherical'],
    minFocusDistance: 0.17,
    maxMagnification: 0.5,
    autofocus: true,
    stabilization: true,
    filterSize: 52,
    length: 62.8,
    diameter: 74.4,
    weight: 305,
    fieldOfView: 63,
    distortion: -0.03,
    vignetting: 0.2,
    bokehQuality: 0.85,
    sharpnessCenter: 0.88,
    sharpnessCorner: 0.82,
    price: 499,
  },
  // RF Zoom Lenses
  {
    id: 'canon_rf_24-70mm_f2.8',
    brand: 'Canon',
    model: 'RF 24-70mm f/2.8L IS USM',
    mount: 'rf',
    focalLength: [24, 70],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 21,
    groups: 15,
    specialElements: ['UD','Super UD','Aspherical'],
    minFocusDistance: 0.21,
    maxMagnification: 0.3,
    autofocus: true,
    stabilization: true,
    filterSize: 82,
    length: 125.7,
    diameter: 88.5,
    weight: 900,
    distortion: -0.04,
    vignetting: 0.25,
    bokehQuality: 0.88,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.82,
    price: 2399,
  },
  {
    id: 'canon_rf_70-200mm_f2.8',
    brand: 'Canon',
    model: 'RF 70-200mm f/2.8L IS USM',
    mount: 'rf',
    focalLength: [70, 200],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 32,
    apertureBlades: 9,
    elements: 17,
    groups: 13,
    specialElements: ['UD','Super UD','Fluorite'],
    minFocusDistance: 0.7,
    maxMagnification: 0.23,
    autofocus: true,
    stabilization: true,
    filterSize: 77,
    length: 146,
    diameter: 89.9,
    weight: 1070,
    distortion: -0.02,
    vignetting: 0.2,
    bokehQuality: 0.92,
    sharpnessCenter: 0.93,
    sharpnessCorner: 0.85,
    price: 2699,
  },
  {
    id: 'canon_rf_28-70mm_f2',
    brand: 'Canon',
    model: 'RF 28-70mm f/2L USM',
    mount: 'rf',
    focalLength: [28, 70],
    isZoom: true,
    maxAperture: 2.0,
    minAperture: 22,
    apertureBlades: 9,
    elements: 19,
    groups: 13,
    specialElements: ['Super UD','Aspherical'],
    minFocusDistance: 0.39,
    maxMagnification: 0.18,
    autofocus: true,
    stabilization: false,
    filterSize: 95,
    length: 139.8,
    diameter: 103.8,
    weight: 1430,
    distortion: -0.03,
    vignetting: 0.3,
    bokehQuality: 0.95,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.84,
    price: 2999,
  },
  {
    id: 'canon_rf_15-35mm_f2.8',
    brand: 'Canon',
    model: 'RF 15-35mm f/2.8L IS USM',
    mount: 'rf',
    focalLength: [15, 35],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 16,
    groups: 12,
    specialElements: ['UD','Aspherical'],
    minFocusDistance: 0.28,
    maxMagnification: 0.21,
    autofocus: true,
    stabilization: true,
    filterSize: 82,
    length: 126.8,
    diameter: 88.5,
    weight: 840,
    distortion: -0.06,
    vignetting: 0.3,
    bokehQuality: 0.82,
    sharpnessCenter: 0.88,
    sharpnessCorner: 0.78,
    price: 2299,
  },
  {
    id: 'canon_rf_100-500mm_f4.5-7.1',
    brand: 'Canon',
    model: 'RF 100-500mm f/4.5-7.1L IS USM',
    mount: 'rf',
    focalLength: [100, 500],
    isZoom: true,
    maxAperture: [4.5, 7.1],
    minAperture: 32,
    apertureBlades: 9,
    elements: 20,
    groups: 14,
    specialElements: ['Super UD','Air Sphere Coating'],
    minFocusDistance: 0.9,
    maxMagnification: 0.33,
    autofocus: true,
    stabilization: true,
    filterSize: 77,
    length: 207.6,
    diameter: 93.8,
    weight: 1370,
    distortion: -0.01,
    vignetting: 0.35,
    bokehQuality: 0.8,
    sharpnessCenter: 0.88,
    sharpnessCorner: 0.75,
    price: 2699,
  },
];

// =============================================================================
// SONY FE/GM LENSES (Mirrorless Full-Frame)
// =============================================================================

export const SONY_FE_SPECS: LensSpec[] = [
  // GM Prime Lenses
  {
    id: 'sony_fe_50mm_f1.2_gm',
    brand: 'Sony',
    model: 'FE 50mm f/1.2 GM',
    mount: 'fe',
    focalLength: 50,
    isZoom: false,
    maxAperture: 1.2,
    minAperture: 16,
    apertureBlades: 11,
    elements: 14,
    groups: 10,
    specialElements: ['XA','ED','Aspherical'],
    minFocusDistance: 0.4,
    maxMagnification: 0.17,
    autofocus: true,
    stabilization: false,
    filterSize: 72,
    length: 108,
    diameter: 87,
    weight: 778,
    fieldOfView: 47,
    distortion: -0.01,
    vignetting: 0.25,
    bokehQuality: 0.97,
    sharpnessCenter: 0.94,
    sharpnessCorner: 0.88,
    price: 1998,
  },
  {
    id: 'sony_fe_85mm_f1.4_gm',
    brand: 'Sony',
    model: 'FE 85mm f/1.4 GM',
    mount: 'fe',
    focalLength: 85,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 11,
    elements: 11,
    groups: 8,
    specialElements: ['XA','ED'],
    minFocusDistance: 0.85,
    maxMagnification: 0.12,
    autofocus: true,
    stabilization: false,
    filterSize: 77,
    length: 107.5,
    diameter: 89.5,
    weight: 820,
    fieldOfView: 28.3,
    distortion: 0.01,
    vignetting: 0.25,
    bokehQuality: 0.96,
    sharpnessCenter: 0.93,
    sharpnessCorner: 0.86,
    price: 1798,
  },
  {
    id: 'sony_fe_35mm_f1.4_gm',
    brand: 'Sony',
    model: 'FE 35mm f/1.4 GM',
    mount: 'fe',
    focalLength: 35,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 11,
    elements: 14,
    groups: 10,
    specialElements: ['XA','ED'],
    minFocusDistance: 0.27,
    maxMagnification: 0.23,
    autofocus: true,
    stabilization: false,
    filterSize: 67,
    length: 96,
    diameter: 76,
    weight: 524,
    fieldOfView: 63,
    distortion: -0.02,
    vignetting: 0.22,
    bokehQuality: 0.93,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.85,
    price: 1398,
  },
  {
    id: 'sony_fe_24mm_f1.4_gm',
    brand: 'Sony',
    model: 'FE 24mm f/1.4 GM',
    mount: 'fe',
    focalLength: 24,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 11,
    elements: 13,
    groups: 10,
    specialElements: ['XA','ED'],
    minFocusDistance: 0.24,
    maxMagnification: 0.17,
    autofocus: true,
    stabilization: false,
    filterSize: 67,
    length: 92.4,
    diameter: 75.4,
    weight: 445,
    fieldOfView: 84,
    distortion: -0.04,
    vignetting: 0.28,
    bokehQuality: 0.88,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.82,
    price: 1398,
  },
  {
    id: 'sony_fe_135mm_f1.8_gm',
    brand: 'Sony',
    model: 'FE 135mm f/1.8 GM',
    mount: 'fe',
    focalLength: 135,
    isZoom: false,
    maxAperture: 1.8,
    minAperture: 22,
    apertureBlades: 11,
    elements: 13,
    groups: 10,
    specialElements: ['XA','Super ED'],
    minFocusDistance: 0.7,
    maxMagnification: 0.25,
    autofocus: true,
    stabilization: false,
    filterSize: 82,
    length: 127,
    diameter: 89.5,
    weight: 950,
    fieldOfView: 18,
    distortion: 0.0,
    vignetting: 0.2,
    bokehQuality: 0.98,
    sharpnessCenter: 0.96,
    sharpnessCorner: 0.9,
    price: 1898,
  },
  // GM Zoom Lenses
  {
    id: 'sony_fe_24-70mm_f2.8_gm_ii',
    brand: 'Sony',
    model: 'FE 24-70mm f/2.8 GM II',
    mount: 'fe',
    focalLength: [24, 70],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 11,
    elements: 18,
    groups: 15,
    specialElements: ['XA','Super ED','ED','Aspherical'],
    minFocusDistance: 0.21,
    maxMagnification: 0.32,
    autofocus: true,
    stabilization: false,
    filterSize: 82,
    length: 119.9,
    diameter: 87.8,
    weight: 695,
    distortion: -0.03,
    vignetting: 0.22,
    bokehQuality: 0.9,
    sharpnessCenter: 0.93,
    sharpnessCorner: 0.86,
    price: 2298,
  },
  {
    id: 'sony_fe_70-200mm_f2.8_gm_ii',
    brand: 'Sony',
    model: 'FE 70-200mm f/2.8 GM OSS II',
    mount: 'fe',
    focalLength: [70, 200],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 11,
    elements: 17,
    groups: 14,
    specialElements: ['XA','Super ED','ED'],
    minFocusDistance: 0.4,
    maxMagnification: 0.3,
    autofocus: true,
    stabilization: true,
    filterSize: 77,
    length: 200,
    diameter: 88,
    weight: 1045,
    distortion: -0.01,
    vignetting: 0.18,
    bokehQuality: 0.94,
    sharpnessCenter: 0.95,
    sharpnessCorner: 0.88,
    price: 2798,
  },
  {
    id: 'sony_fe_12-24mm_f2.8_gm',
    brand: 'Sony',
    model: 'FE 12-24mm f/2.8 GM',
    mount: 'fe',
    focalLength: [12, 24],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 17,
    groups: 14,
    specialElements: ['XA','Super ED','ED'],
    minFocusDistance: 0.28,
    maxMagnification: 0.14,
    autofocus: true,
    stabilization: false,
    filterSize: undefined, // Rear filter
    length: 137,
    diameter: 97.6,
    weight: 847,
    distortion: -0.08,
    vignetting: 0.35,
    bokehQuality: 0.78,
    sharpnessCenter: 0.88,
    sharpnessCorner: 0.75,
    price: 2998,
  },
  {
    id: 'sony_fe_100-400mm_f4.5-5.6_gm',
    brand: 'Sony',
    model: 'FE 100-400mm f/4.5-5.6 GM OSS',
    mount: 'fe',
    focalLength: [100, 400],
    isZoom: true,
    maxAperture: [4.5, 5.6],
    minAperture: [32, 40],
    apertureBlades: 9,
    elements: 22,
    groups: 16,
    specialElements: ['Super ED','ED'],
    minFocusDistance: 0.98,
    maxMagnification: 0.35,
    autofocus: true,
    stabilization: true,
    filterSize: 77,
    length: 205,
    diameter: 93.9,
    weight: 1395,
    distortion: -0.01,
    vignetting: 0.3,
    bokehQuality: 0.82,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.78,
    price: 2498,
  },
  {
    id: 'sony_fe_90mm_f2.8_macro',
    brand: 'Sony',
    model: 'FE 90mm f/2.8 Macro G OSS',
    mount: 'fe',
    focalLength: 90,
    isZoom: false,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 15,
    groups: 11,
    specialElements: ['Super ED','ED','Aspherical'],
    minFocusDistance: 0.28,
    maxMagnification: 1.0,
    autofocus: true,
    stabilization: true,
    filterSize: 62,
    length: 130.5,
    diameter: 79,
    weight: 602,
    fieldOfView: 27,
    distortion: 0.0,
    vignetting: 0.18,
    bokehQuality: 0.88,
    sharpnessCenter: 0.95,
    sharpnessCorner: 0.88,
    price: 1098,
  },
];

// =============================================================================
// NIKON Z LENSES (Mirrorless Full-Frame)
// =============================================================================

export const NIKON_Z_SPECS: LensSpec[] = [
  {
    id: 'nikon_z_50mm_f1.2_s',
    brand: 'Nikon',
    model: 'NIKKOR Z 50mm f/1.2 S',
    mount: 'z',
    focalLength: 50,
    isZoom: false,
    maxAperture: 1.2,
    minAperture: 16,
    apertureBlades: 9,
    elements: 17,
    groups: 15,
    specialElements: ['ED','Aspherical'],
    minFocusDistance: 0.45,
    maxMagnification: 0.15,
    autofocus: true,
    stabilization: false,
    filterSize: 82,
    length: 150,
    diameter: 89.5,
    weight: 1090,
    fieldOfView: 47,
    distortion: -0.01,
    vignetting: 0.25,
    bokehQuality: 0.96,
    sharpnessCenter: 0.94,
    sharpnessCorner: 0.87,
    price: 2096,
  },
  {
    id: 'nikon_z_85mm_f1.2_s',
    brand: 'Nikon',
    model: 'NIKKOR Z 85mm f/1.2 S',
    mount: 'z',
    focalLength: 85,
    isZoom: false,
    maxAperture: 1.2,
    minAperture: 16,
    apertureBlades: 11,
    elements: 15,
    groups: 10,
    specialElements: ['SR','ED','Aspherical'],
    minFocusDistance: 0.85,
    maxMagnification: 0.11,
    autofocus: true,
    stabilization: false,
    filterSize: 82,
    length: 141.5,
    diameter: 102.5,
    weight: 1160,
    fieldOfView: 28.3,
    distortion: 0.0,
    vignetting: 0.22,
    bokehQuality: 0.98,
    sharpnessCenter: 0.96,
    sharpnessCorner: 0.89,
    price: 2796,
  },
  {
    id: 'nikon_z_35mm_f1.8_s',
    brand: 'Nikon',
    model: 'NIKKOR Z 35mm f/1.8 S',
    mount: 'z',
    focalLength: 35,
    isZoom: false,
    maxAperture: 1.8,
    minAperture: 16,
    apertureBlades: 9,
    elements: 11,
    groups: 9,
    specialElements: ['ED','Aspherical'],
    minFocusDistance: 0.25,
    maxMagnification: 0.19,
    autofocus: true,
    stabilization: false,
    filterSize: 62,
    length: 86,
    diameter: 73,
    weight: 370,
    fieldOfView: 63,
    distortion: -0.02,
    vignetting: 0.2,
    bokehQuality: 0.88,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.85,
    price: 846,
  },
  {
    id: 'nikon_z_24-70mm_f2.8_s',
    brand: 'Nikon',
    model: 'NIKKOR Z 24-70mm f/2.8 S',
    mount: 'z',
    focalLength: [24, 70],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 17,
    groups: 15,
    specialElements: ['ED','Aspherical'],
    minFocusDistance: 0.38,
    maxMagnification: 0.22,
    autofocus: true,
    stabilization: false,
    filterSize: 82,
    length: 126,
    diameter: 89,
    weight: 805,
    distortion: -0.03,
    vignetting: 0.24,
    bokehQuality: 0.88,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.84,
    price: 2296,
  },
  {
    id: 'nikon_z_70-200mm_f2.8_vr_s',
    brand: 'Nikon',
    model: 'NIKKOR Z 70-200mm f/2.8 VR S',
    mount: 'z',
    focalLength: [70, 200],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 21,
    groups: 18,
    specialElements: ['SR','Super ED','ED','Fluorite'],
    minFocusDistance: 0.5,
    maxMagnification: 0.2,
    autofocus: true,
    stabilization: true,
    filterSize: 77,
    length: 220,
    diameter: 89,
    weight: 1360,
    distortion: -0.01,
    vignetting: 0.18,
    bokehQuality: 0.94,
    sharpnessCenter: 0.95,
    sharpnessCorner: 0.88,
    price: 2596,
  },
  {
    id: 'nikon_z_14-24mm_f2.8_s',
    brand: 'Nikon',
    model: 'NIKKOR Z 14-24mm f/2.8 S',
    mount: 'z',
    focalLength: [14, 24],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 16,
    groups: 11,
    specialElements: ['ED','Aspherical','Nano Crystal'],
    minFocusDistance: 0.28,
    maxMagnification: 0.13,
    autofocus: true,
    stabilization: false,
    filterSize: 112, // Front filter holder
    length: 124.5,
    diameter: 88.5,
    weight: 650,
    distortion: -0.06,
    vignetting: 0.32,
    bokehQuality: 0.78,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.78,
    price: 2496,
  },
  {
    id: 'nikon_z_105mm_f2.8_vr_s_macro',
    brand: 'Nikon',
    model: 'NIKKOR Z MC 105mm f/2.8 VR S',
    mount: 'z',
    focalLength: 105,
    isZoom: false,
    maxAperture: 2.8,
    minAperture: 32,
    apertureBlades: 9,
    elements: 16,
    groups: 11,
    specialElements: ['ED','Aspherical'],
    minFocusDistance: 0.29,
    maxMagnification: 1.0,
    autofocus: true,
    stabilization: true,
    filterSize: 62,
    length: 140,
    diameter: 85,
    weight: 630,
    fieldOfView: 23.3,
    distortion: 0.0,
    vignetting: 0.15,
    bokehQuality: 0.9,
    sharpnessCenter: 0.96,
    sharpnessCorner: 0.9,
    price: 1046,
  },
];

// =============================================================================
// SIGMA ART LENSES
// =============================================================================

export const SIGMA_ART_SPECS: LensSpec[] = [
  {
    id: 'sigma_35mm_f1.4_art',
    brand: 'Sigma',
    model: '35mm f/1.4 DG HSM Art',
    mount: 'universal',
    focalLength: 35,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 9,
    elements: 13,
    groups: 11,
    specialElements: ['FLD','SLD','Aspherical'],
    minFocusDistance: 0.3,
    maxMagnification: 0.19,
    autofocus: true,
    stabilization: false,
    filterSize: 67,
    length: 94,
    diameter: 77,
    weight: 665,
    fieldOfView: 63.4,
    distortion: -0.02,
    vignetting: 0.25,
    bokehQuality: 0.9,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.85,
    price: 899,
  },
  {
    id: 'sigma_50mm_f1.4_art',
    brand: 'Sigma',
    model: '50mm f/1.4 DG HSM Art',
    mount: 'universal',
    focalLength: 50,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 9,
    elements: 13,
    groups: 8,
    specialElements: ['SLD','Aspherical'],
    minFocusDistance: 0.4,
    maxMagnification: 0.18,
    autofocus: true,
    stabilization: false,
    filterSize: 77,
    length: 99.9,
    diameter: 85.4,
    weight: 815,
    fieldOfView: 46.8,
    distortion: -0.01,
    vignetting: 0.22,
    bokehQuality: 0.92,
    sharpnessCenter: 0.94,
    sharpnessCorner: 0.86,
    price: 949,
  },
  {
    id: 'sigma_85mm_f1.4_art',
    brand: 'Sigma',
    model: '85mm f/1.4 DG HSM Art',
    mount: 'universal',
    focalLength: 85,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 9,
    elements: 14,
    groups: 12,
    specialElements: ['FLD','SLD'],
    minFocusDistance: 0.85,
    maxMagnification: 0.12,
    autofocus: true,
    stabilization: false,
    filterSize: 86,
    length: 126.2,
    diameter: 94.7,
    weight: 1130,
    fieldOfView: 28.6,
    distortion: 0.01,
    vignetting: 0.22,
    bokehQuality: 0.94,
    sharpnessCenter: 0.95,
    sharpnessCorner: 0.88,
    price: 1199,
  },
  {
    id: 'sigma_24-70mm_f2.8_art',
    brand: 'Sigma',
    model: '24-70mm f/2.8 DG DN Art',
    mount: 'universal',
    focalLength: [24, 70],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 11,
    elements: 19,
    groups: 15,
    specialElements: ['FLD','SLD','Aspherical'],
    minFocusDistance: 0.18,
    maxMagnification: 0.34,
    autofocus: true,
    stabilization: false,
    filterSize: 82,
    length: 124.9,
    diameter: 87.8,
    weight: 830,
    distortion: -0.03,
    vignetting: 0.22,
    bokehQuality: 0.88,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.84,
    price: 1099,
  },
  {
    id: 'sigma_105mm_f1.4_art',
    brand: 'Sigma',
    model: '105mm f/1.4 DG HSM Art',
    mount: 'universal',
    focalLength: 105,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 9,
    elements: 17,
    groups: 12,
    specialElements: ['FLD','SLD'],
    minFocusDistance: 1.0,
    maxMagnification: 0.12,
    autofocus: true,
    stabilization: false,
    filterSize: 105,
    length: 131.5,
    diameter: 115.9,
    weight: 1645,
    fieldOfView: 23.3,
    distortion: 0.0,
    vignetting: 0.2,
    bokehQuality: 0.97,
    sharpnessCenter: 0.96,
    sharpnessCorner: 0.88,
    price: 1599,
  },
  {
    id: 'sigma_14-24mm_f2.8_art',
    brand: 'Sigma',
    model: '14-24mm f/2.8 DG DN Art',
    mount: 'universal',
    focalLength: [14, 24],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 11,
    elements: 18,
    groups: 13,
    specialElements: ['FLD','SLD','Aspherical'],
    minFocusDistance: 0.28,
    maxMagnification: 0.13,
    autofocus: true,
    stabilization: false,
    filterSize: undefined, // Rear filter
    length: 131,
    diameter: 85,
    weight: 795,
    distortion: -0.07,
    vignetting: 0.35,
    bokehQuality: 0.75,
    sharpnessCenter: 0.88,
    sharpnessCorner: 0.76,
    price: 1399,
  },
];

// =============================================================================
// TAMRON LENSES
// =============================================================================

export const TAMRON_SPECS: LensSpec[] = [
  {
    id: 'tamron_28-75mm_f2.8_g2',
    brand: 'Tamron',
    model: '28-75mm f/2.8 Di III VXD G2',
    mount: 'fe',
    focalLength: [28, 75],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 17,
    groups: 15,
    specialElements: ['LD','XLD','Aspherical'],
    minFocusDistance: 0.18,
    maxMagnification: 0.37,
    autofocus: true,
    stabilization: false,
    filterSize: 67,
    length: 117.6,
    diameter: 75.8,
    weight: 540,
    distortion: -0.03,
    vignetting: 0.22,
    bokehQuality: 0.85,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.82,
    price: 899,
  },
  {
    id: 'tamron_70-180mm_f2.8',
    brand: 'Tamron',
    model: '70-180mm f/2.8 Di III VXD',
    mount: 'fe',
    focalLength: [70, 180],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 19,
    groups: 14,
    specialElements: ['LD','XLD'],
    minFocusDistance: 0.85,
    maxMagnification: 0.22,
    autofocus: true,
    stabilization: false,
    filterSize: 67,
    length: 149,
    diameter: 81,
    weight: 810,
    distortion: -0.01,
    vignetting: 0.2,
    bokehQuality: 0.88,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.83,
    price: 1199,
  },
  {
    id: 'tamron_17-28mm_f2.8',
    brand: 'Tamron',
    model: '17-28mm f/2.8 Di III RXD',
    mount: 'fe',
    focalLength: [17, 28],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 13,
    groups: 11,
    specialElements: ['LD','XLD','Aspherical'],
    minFocusDistance: 0.19,
    maxMagnification: 0.19,
    autofocus: true,
    stabilization: false,
    filterSize: 67,
    length: 99,
    diameter: 73,
    weight: 420,
    distortion: -0.05,
    vignetting: 0.28,
    bokehQuality: 0.78,
    sharpnessCenter: 0.88,
    sharpnessCorner: 0.78,
    price: 899,
  },
  {
    id: 'tamron_35mm_f1.4',
    brand: 'Tamron',
    model: 'SP 35mm f/1.4 Di USD',
    mount: 'universal',
    focalLength: 35,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 9,
    elements: 14,
    groups: 10,
    specialElements: ['LD','Aspherical'],
    minFocusDistance: 0.3,
    maxMagnification: 0.2,
    autofocus: true,
    stabilization: false,
    filterSize: 72,
    length: 104.8,
    diameter: 80.9,
    weight: 815,
    fieldOfView: 63.3,
    distortion: -0.02,
    vignetting: 0.24,
    bokehQuality: 0.9,
    sharpnessCenter: 0.93,
    sharpnessCorner: 0.85,
    price: 899,
  },
  {
    id: 'tamron_150-500mm_f5-6.7',
    brand: 'Tamron',
    model: '150-500mm f/5-6.7 Di III VC VXD',
    mount: 'fe',
    focalLength: [150, 500],
    isZoom: true,
    maxAperture: [5, 6.7],
    minAperture: [32, 45],
    apertureBlades: 7,
    elements: 25,
    groups: 16,
    specialElements: ['LD','XLD'],
    minFocusDistance: 0.6,
    maxMagnification: 0.32,
    autofocus: true,
    stabilization: true,
    filterSize: 82,
    length: 209.6,
    diameter: 84.6,
    weight: 1725,
    distortion: -0.01,
    vignetting: 0.35,
    bokehQuality: 0.75,
    sharpnessCenter: 0.85,
    sharpnessCorner: 0.72,
    price: 1399,
  },
];

// =============================================================================
// FUJIFILM XF LENSES (APS-C)
// =============================================================================

export const FUJIFILM_XF_SPECS: LensSpec[] = [
  {
    id: 'fujifilm_xf_56mm_f1.2',
    brand: 'Fujifilm',
    model: 'XF 56mm f/1.2 R',
    mount: 'x',
    focalLength: 56,
    isZoom: false,
    maxAperture: 1.2,
    minAperture: 16,
    apertureBlades: 7,
    elements: 11,
    groups: 8,
    specialElements: ['ED'],
    minFocusDistance: 0.7,
    maxMagnification: 0.09,
    autofocus: true,
    stabilization: false,
    filterSize: 62,
    length: 69.7,
    diameter: 73.2,
    weight: 405,
    fieldOfView: 28.5, // Equivalent to 85mm on FF
    distortion: 0.01,
    vignetting: 0.25,
    bokehQuality: 0.94,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.84,
    price: 999,
  },
  {
    id: 'fujifilm_xf_23mm_f1.4',
    brand: 'Fujifilm',
    model: 'XF 23mm f/1.4 R',
    mount: 'x',
    focalLength: 23,
    isZoom: false,
    maxAperture: 1.4,
    minAperture: 16,
    apertureBlades: 7,
    elements: 11,
    groups: 8,
    specialElements: ['Aspherical'],
    minFocusDistance: 0.28,
    maxMagnification: 0.1,
    autofocus: true,
    stabilization: false,
    filterSize: 62,
    length: 63,
    diameter: 72,
    weight: 300,
    fieldOfView: 63.4, // Equivalent to 35mm on FF
    distortion: -0.03,
    vignetting: 0.28,
    bokehQuality: 0.88,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.82,
    price: 899,
  },
  {
    id: 'fujifilm_xf_16-55mm_f2.8',
    brand: 'Fujifilm',
    model: 'XF 16-55mm f/2.8 R LM WR',
    mount: 'x',
    focalLength: [16, 55],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 9,
    elements: 17,
    groups: 12,
    specialElements: ['ED','Aspherical'],
    minFocusDistance: 0.3,
    maxMagnification: 0.16,
    autofocus: true,
    stabilization: false,
    filterSize: 77,
    length: 106,
    diameter: 83.3,
    weight: 655,
    distortion: -0.04,
    vignetting: 0.22,
    bokehQuality: 0.82,
    sharpnessCenter: 0.9,
    sharpnessCorner: 0.82,
    price: 1199,
  },
  {
    id: 'fujifilm_xf_50-140mm_f2.8',
    brand: 'Fujifilm',
    model: 'XF 50-140mm f/2.8 R LM OIS WR',
    mount: 'x',
    focalLength: [50, 140],
    isZoom: true,
    maxAperture: 2.8,
    minAperture: 22,
    apertureBlades: 7,
    elements: 23,
    groups: 16,
    specialElements: ['Super ED','ED'],
    minFocusDistance: 1.0,
    maxMagnification: 0.12,
    autofocus: true,
    stabilization: true,
    filterSize: 72,
    length: 175.9,
    diameter: 82.9,
    weight: 995,
    distortion: -0.01,
    vignetting: 0.18,
    bokehQuality: 0.88,
    sharpnessCenter: 0.92,
    sharpnessCorner: 0.84,
    price: 1599,
  },
];

// =============================================================================
// ALL LENSES - Combined Database
// =============================================================================

export const ALL_LENS_SPECS: LensSpec[] = [
  ...CANON_RF_SPECS,
  ...SONY_FE_SPECS,
  ...NIKON_Z_SPECS,
  ...SIGMA_ART_SPECS,
  ...TAMRON_SPECS,
  ...FUJIFILM_XF_SPECS,
];

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Find lens specification by brand and model
 */
export function findLensSpec(brand: string, model: string): LensSpec | null {
  const normalizedBrand = brand.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  
  return ALL_LENS_SPECS.find(spec => {
    const specBrand = spec.brand.toLowerCase();
    const specModel = spec.model.toLowerCase();
    
    // Exact match
    if (specBrand === normalizedBrand && specModel === normalizedModel) {
      return true;
    }
    
    // Brand match with partial model match
    if (specBrand.includes(normalizedBrand) || normalizedBrand.includes(specBrand)) {
      // Check for focal length match
      const focalMatch = extractFocalLength(normalizedModel);
      const specFocal = spec.focalLength;
      
      if (focalMatch) {
        if (Array.isArray(specFocal)) {
          // Zoom lens - check if focal range matches
          if (Array.isArray(focalMatch)) {
            if (specFocal[0] === focalMatch[0] && specFocal[1] === focalMatch[1]) {
              return true;
            }
          }
        } else {
          // Prime lens
          if (!Array.isArray(focalMatch) && specFocal === focalMatch) {
            // Also check aperture if present
            const apertureMatch = extractAperture(normalizedModel);
            if (!apertureMatch || Math.abs(spec.maxAperture as number - apertureMatch) < 0.1) {
              return true;
            }
          }
        }
      }
      
      // Partial model match
      if (specModel.includes(normalizedModel) || normalizedModel.includes(specModel)) {
        return true;
      }
    }
    
    return false;
  }) || null;
}

/**
 * Find closest matching lens by brand
 */
export function findLensSpecByBrand(brand: string): LensSpec | null {
  const normalizedBrand = brand.toLowerCase().trim();
  
  return ALL_LENS_SPECS.find(spec => 
    spec.brand.toLowerCase().includes(normalizedBrand) ||
    normalizedBrand.includes(spec.brand.toLowerCase())
  ) || null;
}

/**
 * Extract focal length from model string
 */
function extractFocalLength(model: string): number | [number, number] | null {
  // Match zoom range: "24-70mm" or "24-70"
  const zoomMatch = model.match(/(\d+)\s*-\s*(\d+)\s*mm?/i);
  if (zoomMatch) {
    return [parseInt(zoomMatch[1]), parseInt(zoomMatch[2])];
  }
  
  // Match prime: "50mm" or "50 mm" or just "50"
  const primeMatch = model.match(/(\d+)\s*mm/i);
  if (primeMatch) {
    return parseInt(primeMatch[1]);
  }
  
  return null;
}

/**
 * Extract aperture from model string
 */
function extractAperture(model: string): number | null {
  // Match aperture: "f/1.4" or "f1.4" or "F/1.4" or"f/2.8"
  const match = model.match(/f\/?(\d+\.?\d*)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * Get default lens specs
 */
export function getDefaultLensSpec(focalLength?: number): Partial<LensSpec> {
  const focal = focalLength || 50;
  
  return {
    focalLength: focal,
    isZoom: false,
    maxAperture: focal <= 35 ? 1.8 : focal <= 85 ? 1.4 : 2.8,
    minAperture: 16,
    apertureBlades: 9,
    elements: 10,
    groups: 7,
    minFocusDistance: focal <= 35 ? 0.3 : focal <= 85 ? 0.85 : 1.0,
    maxMagnification: 0.15,
    autofocus: true,
    stabilization: false,
    fieldOfView: calculateFieldOfView(focal),
    distortion: focal <= 35 ? -0.03 : 0.01,
    vignetting: 0.25,
    bokehQuality: 0.85,
    sharpnessCenter: 0.88,
    sharpnessCorner: 0.8,
  };
}

/**
 * Calculate approximate field of view for full-frame sensor
 */
function calculateFieldOfView(focalLength: number): number {
  // Diagonal FOV = 2 * atan(diagonal / (2 * focal length))
  // Full-frame diagonal ≈ 43.3mm
  const diagonal = 43.3;
  const fovRad = 2 * Math.atan(diagonal / (2 * focalLength));
  return Math.round((fovRad * 180) / Math.PI);
}

/**
 * Convert lens spec to Virtual Studio camera lens data
 */
export function lensSpecToCameraData(spec: LensSpec): {
  focalLength: number;
  aperture: number;
  minFocusDistance: number;
  fieldOfView: number;
  userData: Record<string, any>;
} {
  const focalLength = Array.isArray(spec.focalLength) 
    ? spec.focalLength[0] // Use wide end for zooms
    : spec.focalLength;
    
  const maxAperture = Array.isArray(spec.maxAperture)
    ? spec.maxAperture[0]
    : spec.maxAperture;
    
  const fieldOfView = spec.fieldOfView || calculateFieldOfView(focalLength);
  
  return {
    focalLength,
    aperture: maxAperture,
    minFocusDistance: spec.minFocusDistance,
    fieldOfView,
    userData: {
      brand: spec.brand,
      model: spec.model,
      realEquipment: true,
      specifications: {
        focalLength: spec.focalLength,
        isZoom: spec.isZoom,
        maxAperture: spec.maxAperture,
        minAperture: spec.minAperture,
        apertureBlades: spec.apertureBlades,
        elements: spec.elements,
        groups: spec.groups,
        specialElements: spec.specialElements,
        minFocusDistance: spec.minFocusDistance,
        maxMagnification: spec.maxMagnification,
        autofocus: spec.autofocus,
        stabilization: spec.stabilization,
        filterSize: spec.filterSize,
        length: spec.length,
        diameter: spec.diameter,
        weight: spec.weight,
        fieldOfView: fieldOfView,
        distortion: spec.distortion,
        vignetting: spec.vignetting,
        chromaticAberration: spec.chromaticAberration,
        bokehQuality: spec.bokehQuality,
        sharpnessCenter: spec.sharpnessCenter,
        sharpnessCorner: spec.sharpnessCorner,
        mount: spec.mount,
      },
    },
  };
}

export default ALL_LENS_SPECS;

