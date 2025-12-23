/**
 * Lens Profiles
 * 
 * Library of lens distortion profiles for realistic camera simulation
 * Supports barrel, pincushion, and mustache distortion
 */

export interface LensDistortionProfile {
  id: string;
  name: string;
  manufacturer: string;
  focalLength: number;
  distortionType: 'barrel' | 'pincushion' | 'mustache';
  k1: number; // Radial distortion coefficient 1
  k2: number; // Radial distortion coefficient 2
  k3: number; // Radial distortion coefficient 3
  p1?: number; // Tangential distortion coefficient 1
  p2?: number; // Tangential distortion coefficient 2
  anamorphic?: {
    squeeze: number; // Anamorphic squeeze factor (e.g., 2.0 for 2x anamorphic)
    bokehShape: 'oval' | 'elliptical'; // Bokeh shape
  };
}

export const LENS_PROFILES: Record<string, LensDistortionProfile> = {
  // Canon Lenses
  canon_24_70_f28: {
    id: 'canon_24_70_f28',
    name: 'Canon EF 24-70mm f/2.8L',
    manufacturer: 'Canon',
    focalLength: 50,
    distortionType: 'barrel',
    k1: -0.15,
    k2: 0.05,
    k3: -0.01,
  },
  
  canon_85_f12: {
    id: 'canon_85_f12',
    name: 'Canon EF 85mm f/1.2L',
    manufacturer: 'Canon',
    focalLength: 85,
    distortionType: 'pincushion',
    k1: 0.08,
    k2: -0.02,
    k3: 0.001,
  },
  
  // Nikon Lenses
  nikon_50_f14: {
    id: 'nikon_50_f14',
    name: 'Nikon 50mm f/1.4G',
    manufacturer: 'Nikon',
    focalLength: 50,
    distortionType: 'barrel',
    k1: -0.12,
    k2: 0.04,
    k3: -0.008,
  },
  
  // Anamorphic Lenses
  anamorphic_50mm_2x: {
    id: 'anamorphic_50mm_2x',
    name: 'Anamorphic 50mm 2x',
    manufacturer: 'Generic',
    focalLength: 50,
    distortionType: 'mustache',
    k1: -0.05,
    k2: 0.02,
    k3: -0.005,
    anamorphic: {
      squeeze: 2.0,
      bokehShape: 'oval',
    },
  },
  
  // Wide Angle (barrel distortion)
  wide_14mm: {
    id: 'wide_14mm',
    name: 'Wide 14mm',
    manufacturer: 'Generic',
    focalLength: 14,
    distortionType: 'barrel',
    k1: -0.3,
    k2: 0.15,
    k3: -0.05,
  },
  
  // Telephoto (pincushion distortion)
  tele_200mm: {
    id: 'tele_200mm',
    name: 'Telephoto 200mm',
    manufacturer: 'Generic',
    focalLength: 200,
    distortionType: 'pincushion',
    k1: 0.1,
    k2: -0.03,
    k3: 0.005,
  },
};

/**
 * Get lens profile by ID
 */
export function getLensProfile(id: string): LensDistortionProfile | undefined {
  return LENS_PROFILES[id];
}

/**
 * Get lens profiles by focal length range
 */
export function getLensProfilesByFocalLength(
  minFocal: number,
  maxFocal: number
): LensDistortionProfile[] {
  return Object.values(LENS_PROFILES).filter(
    (profile) => profile.focalLength >= minFocal && profile.focalLength <= maxFocal
  );
}

/**
 * Get lens profiles by manufacturer
 */
export function getLensProfilesByManufacturer(manufacturer: string): LensDistortionProfile[] {
  return Object.values(LENS_PROFILES).filter(
    (profile) => profile.manufacturer.toLowerCase() === manufacturer.toLowerCase()
  );
}


