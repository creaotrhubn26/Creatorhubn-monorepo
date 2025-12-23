/**
 * Comprehensive Light Specifications Database
 * 
 * Real-world specifications for studio strobes, flashes, and continuous lights.
 * Used by Virtual Studio to accurately simulate lighting behavior.
 * 
 * All specifications sourced from manufacturer datasheets.
 */

export interface LightSpec {
  id: string;
  brand: string;
  model: string;
  type: 'strobe, ' | 'speedlite' | 'continuous' | 'led_panel' | 'fresnel' | 'ring';
  
  // Power
  power: number;              // Watt-seconds (Ws) for strobes, Watts (W) for continuous
  powerRange?: [number, number]; // Min/max power (Ws or W)
  guideNumber?: number;       // For speedlites (ISO 100, meters)
  
  // Color
  colorTemp: number;          // Kelvin (typical daylight = 5600K)
  colorTempRange?: [number, number]; // Bicolor range
  cri?: number;               // Color Rendering Index (0-100)
  tlci?: number;              // Television Lighting Consistency Index
  
  // Beam/Output
  beamAngle: number;          // Degrees (with standard reflector)
  beamAngleRange?: [number, number]; // With zoom capability
  lumens?: number;            // For continuous lights
  lux?: number;               // Lux at 1 meter
  
  // Timing (for strobes)
  flashDuration?: number;     // t0.5 at full power (seconds)
  recycleTime?: number;       // Seconds at full power
  
  // Physical
  mountType: 'bowens' | 'profoto' | 'elinchrom' | 'broncolor' | 'godox' | 'hotshoe' | 'custom';
  weight?: number;            // kg
  
  // Features
  hss?: boolean;              // High-Speed Sync
  ttl?: boolean;              // Through-The-Lens metering
  wireless?: boolean;
  battery?: boolean;
  bicolor?: boolean;          // Variable color temp
  rgbw?: boolean;             // Full color control
}

// =============================================================================
// PROFOTO - Premium Studio Strobes
// =============================================================================

export const PROFOTO_SPECS: LightSpec[] = [
  // D Series (Studio)
  {
    id: 'profoto_d2_500',
    brand: 'Profoto',
    model: 'D2 500',
    type: 'strobe',
    power: 500,
    powerRange: [3.9, 500],
    colorTemp: 5600,
    cri: 92,
    beamAngle: 76,
    flashDuration: 1/1000,
    recycleTime: 0.4,
    mountType: 'profoto',
    weight: 1.9,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  {
    id: 'profoto_d2_1000',
    brand: 'Profoto',
    model: 'D2 1000',
    type: 'strobe',
    power: 1000,
    powerRange: [7.8, 1000],
    colorTemp: 5600,
    cri: 92,
    beamAngle: 76,
    flashDuration: 1/650,
    recycleTime: 0.5,
    mountType: 'profoto',
    weight: 2.1,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  // B Series (Portable)
  {
    id: 'profoto_b10',
    brand: 'Profoto',
    model: 'B10',
    type: 'strobe',
    power: 250,
    powerRange: [2.5, 250],
    colorTemp: 5600,
    colorTempRange: [3000, 6500],
    cri: 95,
    beamAngle: 76,
    flashDuration: 1/50000,
    recycleTime: 0.05,
    mountType: 'profoto',
    weight: 1.5,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
    bicolor: true,
  },
  {
    id: 'profoto_b10_plus',
    brand: 'Profoto',
    model: 'B10 Plus',
    type: 'strobe',
    power: 500,
    powerRange: [5, 500],
    colorTemp: 5600,
    colorTempRange: [3000, 6500],
    cri: 95,
    beamAngle: 76,
    flashDuration: 1/50000,
    recycleTime: 0.1,
    mountType: 'profoto',
    weight: 1.9,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
    bicolor: true,
  },
  {
    id: 'profoto_b1x',
    brand: 'Profoto',
    model: 'B1X 500',
    type: 'strobe',
    power: 500,
    powerRange: [5, 500],
    colorTemp: 5600,
    cri: 92,
    beamAngle: 76,
    flashDuration: 1/19000,
    recycleTime: 0.1,
    mountType: 'profoto',
    weight: 3.0,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  // A Series (On-Camera)
  {
    id: 'profoto_a1',
    brand: 'Profoto',
    model: 'A1',
    type: 'speedlite',
    power: 76,
    guideNumber: 43,
    colorTemp: 5600,
    cri: 92,
    beamAngle: 105,
    beamAngleRange: [32, 105],
    flashDuration: 1/20000,
    recycleTime: 1.0,
    mountType: 'hotshoe',
    weight: 0.56,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'profoto_a1x',
    brand: 'Profoto',
    model: 'A1X',
    type: 'speedlite',
    power: 76,
    guideNumber: 43,
    colorTemp: 5600,
    cri: 92,
    beamAngle: 105,
    beamAngleRange: [32, 105],
    flashDuration: 1/20000,
    recycleTime: 0.9,
    mountType: 'hotshoe',
    weight: 0.56,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'profoto_a10',
    brand: 'Profoto',
    model: 'A10',
    type: 'speedlite',
    power: 76,
    guideNumber: 43,
    colorTemp: 5600,
    colorTempRange: [3000, 6500],
    cri: 92,
    beamAngle: 105,
    beamAngleRange: [32, 105],
    flashDuration: 1/20000,
    recycleTime: 0.9,
    mountType: 'hotshoe',
    weight: 0.56,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
    bicolor: true,
  },
];

// =============================================================================
// GODOX - Affordable Professional Lights
// =============================================================================

export const GODOX_SPECS: LightSpec[] = [
  // AD Series (Portable Strobes)
  {
    id: 'godox_ad600_pro',
    brand: 'Godox',
    model: 'AD600 Pro',
    type: 'strobe',
    power: 600,
    powerRange: [9, 600],
    colorTemp: 5600,
    colorTempRange: [5600, 5600], // ±75K stability
    cri: 96,
    tlci: 96,
    beamAngle: 80,
    flashDuration: 1/10300,
    recycleTime: 0.9,
    mountType: 'bowens',
    weight: 3.0,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'godox_ad400_pro',
    brand: 'Godox',
    model: 'AD400 Pro',
    type: 'strobe',
    power: 400,
    powerRange: [6, 400],
    colorTemp: 5600,
    cri: 96,
    tlci: 96,
    beamAngle: 80,
    flashDuration: 1/10300,
    recycleTime: 0.9,
    mountType: 'bowens',
    weight: 2.8,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'godox_ad300_pro',
    brand: 'Godox',
    model: 'AD300 Pro',
    type: 'strobe',
    power: 300,
    powerRange: [4.7, 300],
    colorTemp: 5600,
    colorTempRange: [5600, 5600],
    cri: 96,
    tlci: 96,
    beamAngle: 80,
    flashDuration: 1/10300,
    recycleTime: 0.7,
    mountType: 'godox',
    weight: 1.25,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'godox_ad200_pro',
    brand: 'Godox',
    model: 'AD200 Pro',
    type: 'strobe',
    power: 200,
    powerRange: [3, 200],
    colorTemp: 5600,
    cri: 96,
    tlci: 96,
    beamAngle: 90,
    flashDuration: 1/13300,
    recycleTime: 1.8,
    mountType: 'godox',
    weight: 0.56,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'godox_ad100_pro',
    brand: 'Godox',
    model: 'AD100 Pro',
    type: 'strobe',
    power: 100,
    powerRange: [1.6, 100],
    colorTemp: 5800,
    cri: 93,
    tlci: 95,
    beamAngle: 90,
    flashDuration: 1/11300,
    recycleTime: 1.5,
    mountType: 'godox',
    weight: 0.524,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  // Speedlites
  {
    id: 'godox_v1',
    brand: 'Godox',
    model: 'V1',
    type: 'speedlite',
    power: 76,
    guideNumber: 60,
    colorTemp: 5600,
    cri: 92,
    beamAngle: 100,
    beamAngleRange: [28, 100],
    flashDuration: 1/20000,
    recycleTime: 1.5,
    mountType: 'hotshoe',
    weight: 0.53,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'godox_v860iii',
    brand: 'Godox',
    model: 'V860III',
    type: 'speedlite',
    power: 60,
    guideNumber: 60,
    colorTemp: 5600,
    cri: 92,
    beamAngle: 100,
    beamAngleRange: [20, 100],
    flashDuration: 1/20000,
    recycleTime: 1.5,
    mountType: 'hotshoe',
    weight: 0.43,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'godox_tt685ii',
    brand: 'Godox',
    model: 'TT685II',
    type: 'speedlite',
    power: 60,
    guideNumber: 60,
    colorTemp: 5600,
    cri: 92,
    beamAngle: 100,
    beamAngleRange: [20, 100],
    flashDuration: 1/20000,
    recycleTime: 2.5,
    mountType: 'hotshoe',
    weight: 0.41,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  // Studio Strobes
  {
    id: 'godox_sk400ii',
    brand: 'Godox',
    model: 'SK400II',
    type: 'strobe',
    power: 400,
    powerRange: [6.25, 400],
    colorTemp: 5600,
    cri: 92,
    beamAngle: 80,
    flashDuration: 1/800,
    recycleTime: 0.9,
    mountType: 'bowens',
    weight: 2.1,
    hss: false,
    ttl: false,
    wireless: true,
    battery: false,
  },
  {
    id: 'godox_ms300',
    brand: 'Godox',
    model: 'MS300',
    type: 'strobe',
    power: 300,
    powerRange: [9.4, 300],
    colorTemp: 5600,
    cri: 92,
    beamAngle: 80,
    flashDuration: 1/800,
    recycleTime: 0.8,
    mountType: 'bowens',
    weight: 1.3,
    hss: false,
    ttl: false,
    wireless: true,
    battery: false,
  },
  // LED Continuous
  {
    id: 'godox_sl60w',
    brand: 'Godox',
    model: 'SL-60W',
    type: 'continuous',
    power: 60,
    colorTemp: 5600,
    cri: 95,
    tlci: 97,
    beamAngle: 120,
    lux: 4100,
    lumens: 5600,
    mountType: 'bowens',
    weight: 1.6,
    wireless: false,
    battery: false,
  },
  {
    id: 'godox_sl150ii',
    brand: 'Godox',
    model: 'SL-150II',
    type: 'continuous',
    power: 150,
    colorTemp: 5600,
    cri: 96,
    tlci: 97,
    beamAngle: 120,
    lux: 58000,
    lumens: 16000,
    mountType: 'bowens',
    weight: 2.3,
    wireless: true,
    battery: false,
  },
  {
    id: 'godox_vl300',
    brand: 'Godox',
    model: 'VL300',
    type: 'continuous',
    power: 300,
    colorTemp: 5600,
    cri: 96,
    tlci: 97,
    beamAngle: 120,
    lux: 74800,
    lumens: 21200,
    mountType: 'bowens',
    weight: 3.3,
    wireless: true,
    battery: false,
  },
];

// =============================================================================
// CANON SPEEDLITES
// =============================================================================

export const CANON_SPECS: LightSpec[] = [
  {
    id: 'canon_el1',
    brand: 'Canon',
    model: 'Speedlite EL-1',
    type: 'speedlite',
    power: 82,
    guideNumber: 60,
    colorTemp: 5600,
    cri: 90,
    beamAngle: 105,
    beamAngleRange: [20, 105],
    flashDuration: 1/8900,
    recycleTime: 0.9,
    mountType: 'hotshoe',
    weight: 0.62,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'canon_600exii',
    brand: 'Canon',
    model: 'Speedlite 600EX II-RT',
    type: 'speedlite',
    power: 72,
    guideNumber: 60,
    colorTemp: 5600,
    cri: 90,
    beamAngle: 105,
    beamAngleRange: [20, 105],
    flashDuration: 1/250,
    recycleTime: 3.0,
    mountType: 'hotshoe',
    weight: 0.435,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  {
    id: 'canon_580exii',
    brand: 'Canon',
    model: 'Speedlite 580EX II',
    type: 'speedlite',
    power: 68,
    guideNumber: 58,
    colorTemp: 5500,
    cri: 88,
    beamAngle: 105,
    beamAngleRange: [24, 105],
    flashDuration: 1/250,
    recycleTime: 4.0,
    mountType: 'hotshoe',
    weight: 0.405,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  {
    id: 'canon_430exiii',
    brand: 'Canon',
    model: 'Speedlite 430EX III-RT',
    type: 'speedlite',
    power: 58,
    guideNumber: 43,
    colorTemp: 5600,
    cri: 88,
    beamAngle: 100,
    beamAngleRange: [24, 100],
    flashDuration: 1/250,
    recycleTime: 3.5,
    mountType: 'hotshoe',
    weight: 0.295,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
];

// =============================================================================
// NIKON SPEEDLIGHTS
// =============================================================================

export const NIKON_SPECS: LightSpec[] = [
  {
    id: 'nikon_sb5000',
    brand: 'Nikon',
    model: 'SB-5000',
    type: 'speedlite',
    power: 72,
    guideNumber: 55,
    colorTemp: 5600,
    cri: 90,
    beamAngle: 105,
    beamAngleRange: [24, 105],
    flashDuration: 1/980,
    recycleTime: 1.8,
    mountType: 'hotshoe',
    weight: 0.42,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  {
    id: 'nikon_sb910',
    brand: 'Nikon',
    model: 'SB-910',
    type: 'speedlite',
    power: 68,
    guideNumber: 48,
    colorTemp: 5600,
    cri: 88,
    beamAngle: 105,
    beamAngleRange: [17, 105],
    flashDuration: 1/880,
    recycleTime: 2.3,
    mountType: 'hotshoe',
    weight: 0.42,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  {
    id: 'nikon_sb800',
    brand: 'Nikon',
    model: 'SB-800',
    type: 'speedlite',
    power: 58,
    guideNumber: 53,
    colorTemp: 5600,
    cri: 85,
    beamAngle: 100,
    beamAngleRange: [24, 100],
    flashDuration: 1/900,
    recycleTime: 4.0,
    mountType: 'hotshoe',
    weight: 0.35,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  {
    id: 'nikon_sb700',
    brand: 'Nikon',
    model: 'SB-700',
    type: 'speedlite',
    power: 52,
    guideNumber: 38,
    colorTemp: 5600,
    cri: 88,
    beamAngle: 95,
    beamAngleRange: [24, 95],
    flashDuration: 1/1042,
    recycleTime: 2.5,
    mountType: 'hotshoe',
    weight: 0.36,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
];

// =============================================================================
// SONY FLASHES
// =============================================================================

export const SONY_SPECS: LightSpec[] = [
  {
    id: 'sony_hvlf60rm2',
    brand: 'Sony',
    model: 'HVL-F60RM2',
    type: 'speedlite',
    power: 78,
    guideNumber: 60,
    colorTemp: 5600,
    cri: 90,
    beamAngle: 105,
    beamAngleRange: [20, 105],
    flashDuration: 1/250,
    recycleTime: 1.7,
    mountType: 'hotshoe',
    weight: 0.439,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
  {
    id: 'sony_hvlf46rm',
    brand: 'Sony',
    model: 'HVL-F46RM',
    type: 'speedlite',
    power: 62,
    guideNumber: 46,
    colorTemp: 5600,
    cri: 90,
    beamAngle: 100,
    beamAngleRange: [24, 100],
    flashDuration: 1/250,
    recycleTime: 2.4,
    mountType: 'hotshoe',
    weight: 0.308,
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
  },
];

// =============================================================================
// APUTURE - Professional LED Lights
// =============================================================================

export const APUTURE_SPECS: LightSpec[] = [
  {
    id: 'aputure_600d_pro',
    brand: 'Aputure',
    model: 'LS 600d Pro',
    type: 'continuous',
    power: 600,
    colorTemp: 5600,
    cri: 96,
    tlci: 97,
    beamAngle: 120,
    lux: 132000,
    lumens: 36000,
    mountType: 'bowens',
    weight: 9.5,
    wireless: true,
    battery: false,
  },
  {
    id: 'aputure_600c_pro',
    brand: 'Aputure',
    model: 'LS 600c Pro',
    type: 'continuous',
    power: 600,
    colorTemp: 5500,
    colorTempRange: [2300, 10000],
    cri: 95,
    tlci: 96,
    beamAngle: 120,
    lux: 46000,
    lumens: 25200,
    mountType: 'bowens',
    weight: 13.8,
    wireless: true,
    battery: false,
    bicolor: true,
    rgbw: true,
  },
  {
    id: 'aputure_300d_ii',
    brand: 'Aputure',
    model: 'LS 300D II',
    type: 'continuous',
    power: 350,
    colorTemp: 5500,
    cri: 96,
    tlci: 97,
    beamAngle: 120,
    lux: 85000,
    lumens: 19500,
    mountType: 'bowens',
    weight: 3.3,
    wireless: true,
    battery: false,
  },
  {
    id: 'aputure_300x',
    brand: 'Aputure',
    model: 'LS 300X',
    type: 'continuous',
    power: 350,
    colorTemp: 5500,
    colorTempRange: [2700, 6500],
    cri: 95,
    tlci: 96,
    beamAngle: 120,
    lux: 48000,
    lumens: 15300,
    mountType: 'bowens',
    weight: 3.5,
    wireless: true,
    battery: false,
    bicolor: true,
  },
  {
    id: 'aputure_120d_ii',
    brand: 'Aputure',
    model: 'LS 120D II',
    type: 'continuous',
    power: 180,
    colorTemp: 5500,
    cri: 96,
    tlci: 97,
    beamAngle: 120,
    lux: 37000,
    lumens: 8500,
    mountType: 'bowens',
    weight: 1.4,
    wireless: true,
    battery: false,
  },
  {
    id: 'aputure_60d',
    brand: 'Aputure',
    model: 'LS 60D',
    type: 'continuous',
    power: 60,
    colorTemp: 5600,
    cri: 95,
    tlci: 97,
    beamAngle: 120,
    lux: 6100,
    lumens: 3100,
    mountType: 'bowens',
    weight: 0.7,
    wireless: true,
    battery: true,
  },
  {
    id: 'aputure_mc_pro',
    brand: 'Aputure',
    model: 'MC Pro',
    type: 'led_panel',
    power: 12,
    colorTemp: 5600,
    colorTempRange: [2000, 10000],
    cri: 97,
    tlci: 96,
    beamAngle: 120,
    lux: 932,
    lumens: 600,
    mountType: 'custom',
    weight: 0.21,
    wireless: true,
    battery: true,
    bicolor: true,
    rgbw: true,
  },
  {
    id: 'aputure_amaran_200d',
    brand: 'Aputure',
    model: 'Amaran 200D',
    type: 'continuous',
    power: 200,
    colorTemp: 5600,
    cri: 95,
    tlci: 95,
    beamAngle: 120,
    lux: 51800,
    lumens: 11700,
    mountType: 'bowens',
    weight: 1.9,
    wireless: true,
    battery: false,
  },
];

// =============================================================================
// NANLITE - Professional LED Lights
// =============================================================================

export const NANLITE_SPECS: LightSpec[] = [
  {
    id: 'nanlite_forza_500',
    brand: 'Nanlite',
    model: 'Forza 500',
    type: 'continuous',
    power: 500,
    colorTemp: 5600,
    cri: 98,
    tlci: 98,
    beamAngle: 120,
    lux: 140700,
    lumens: 32100,
    mountType: 'bowens',
    weight: 3.8,
    wireless: true,
    battery: false,
  },
  {
    id: 'nanlite_forza_500b_ii',
    brand: 'Nanlite',
    model: 'Forza 500B II',
    type: 'continuous',
    power: 500,
    colorTemp: 5600,
    colorTempRange: [2700, 6500],
    cri: 96,
    tlci: 98,
    beamAngle: 120,
    lux: 77400,
    lumens: 21750,
    mountType: 'bowens',
    weight: 4.2,
    wireless: true,
    battery: false,
    bicolor: true,
  },
  {
    id: 'nanlite_forza_300b',
    brand: 'Nanlite',
    model: 'Forza 300B',
    type: 'continuous',
    power: 300,
    colorTemp: 5600,
    colorTempRange: [2700, 6500],
    cri: 96,
    tlci: 98,
    beamAngle: 120,
    lux: 47400,
    lumens: 12180,
    mountType: 'bowens',
    weight: 2.4,
    wireless: true,
    battery: false,
    bicolor: true,
  },
  {
    id: 'nanlite_forza_60',
    brand: 'Nanlite',
    model: 'Forza 60',
    type: 'continuous',
    power: 60,
    colorTemp: 5600,
    cri: 96,
    tlci: 96,
    beamAngle: 120,
    lux: 10850,
    lumens: 4180,
    mountType: 'bowens',
    weight: 1.0,
    wireless: true,
    battery: false,
  },
  {
    id: 'nanlite_pavotube_ii_30c',
    brand: 'Nanlite',
    model: 'PavoTube II 30C',
    type: 'led_panel',
    power: 26,
    colorTemp: 5600,
    colorTempRange: [2700, 12000],
    cri: 95,
    tlci: 97,
    beamAngle: 110,
    lux: 1670,
    lumens: 1056,
    mountType: 'custom',
    weight: 0.74,
    wireless: true,
    battery: true,
    bicolor: true,
    rgbw: true,
  },
];

// =============================================================================
// ELINCHROM - Professional Studio Strobes
// =============================================================================

export const ELINCHROM_SPECS: LightSpec[] = [
  {
    id: 'elinchrom_elc_500',
    brand: 'Elinchrom',
    model: 'ELC Pro HD 500',
    type: 'strobe',
    power: 500,
    powerRange: [4, 500],
    colorTemp: 5500,
    cri: 92,
    beamAngle: 80,
    flashDuration: 1/4000,
    recycleTime: 0.6,
    mountType: 'elinchrom',
    weight: 2.3,
    hss: true,
    ttl: false,
    wireless: true,
    battery: false,
  },
  {
    id: 'elinchrom_elc_1000',
    brand: 'Elinchrom',
    model: 'ELC Pro HD 1000',
    type: 'strobe',
    power: 1000,
    powerRange: [8, 1000],
    colorTemp: 5500,
    cri: 92,
    beamAngle: 80,
    flashDuration: 1/2700,
    recycleTime: 0.8,
    mountType: 'elinchrom',
    weight: 2.6,
    hss: true,
    ttl: false,
    wireless: true,
    battery: false,
  },
  {
    id: 'elinchrom_five',
    brand: 'Elinchrom',
    model: 'FIVE',
    type: 'strobe',
    power: 488,
    powerRange: [4, 488],
    colorTemp: 5600,
    cri: 93,
    beamAngle: 80,
    flashDuration: 1/6300,
    recycleTime: 0.6,
    mountType: 'elinchrom',
    weight: 1.9,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
  {
    id: 'elinchrom_one',
    brand: 'Elinchrom',
    model: 'ONE',
    type: 'strobe',
    power: 131,
    powerRange: [1, 131],
    colorTemp: 5600,
    cri: 93,
    beamAngle: 80,
    flashDuration: 1/8200,
    recycleTime: 0.35,
    mountType: 'elinchrom',
    weight: 1.5,
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
  },
];

// =============================================================================
// BRONCOLOR - Premium Studio Strobes
// =============================================================================

export const BRONCOLOR_SPECS: LightSpec[] = [
  {
    id: 'broncolor_siros_400',
    brand: 'Broncolor',
    model: 'Siros 400 S',
    type: 'strobe',
    power: 400,
    powerRange: [2, 400],
    colorTemp: 5500,
    cri: 95,
    beamAngle: 75,
    flashDuration: 1/5600,
    recycleTime: 0.4,
    mountType: 'broncolor',
    weight: 2.4,
    hss: true,
    ttl: false,
    wireless: true,
    battery: false,
  },
  {
    id: 'broncolor_siros_800',
    brand: 'Broncolor',
    model: 'Siros 800 S',
    type: 'strobe',
    power: 800,
    powerRange: [4, 800],
    colorTemp: 5500,
    cri: 95,
    beamAngle: 75,
    flashDuration: 1/4000,
    recycleTime: 0.5,
    mountType: 'broncolor',
    weight: 2.6,
    hss: true,
    ttl: false,
    wireless: true,
    battery: false,
  },
  {
    id: 'broncolor_move_1200',
    brand: 'Broncolor',
    model: 'Move 1200 L',
    type: 'strobe',
    power: 1200,
    powerRange: [6, 1200],
    colorTemp: 5500,
    cri: 94,
    beamAngle: 75,
    flashDuration: 1/11000,
    recycleTime: 0.6,
    mountType: 'broncolor',
    weight: 6.0,
    hss: false,
    ttl: false,
    wireless: true,
    battery: true,
  },
];

// =============================================================================
// ALL LIGHTS - Combined Database
// =============================================================================

export const ALL_LIGHT_SPECS: LightSpec[] = [
  ...PROFOTO_SPECS,
  ...GODOX_SPECS,
  ...CANON_SPECS,
  ...NIKON_SPECS,
  ...SONY_SPECS,
  ...APUTURE_SPECS,
  ...NANLITE_SPECS,
  ...ELINCHROM_SPECS,
  ...BRONCOLOR_SPECS,
];

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Find light specification by brand and model
 */
export function findLightSpec(brand: string, model: string): LightSpec | null {
  const normalizedBrand = brand.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  
  return ALL_LIGHT_SPECS.find(spec => {
    const specBrand = spec.brand.toLowerCase();
    const specModel = spec.model.toLowerCase();
    
    // Exact match
    if (specBrand === normalizedBrand && specModel === normalizedModel) {
      return true;
    }
    
    // Partial match (model contains search term or vice versa)
    if (specBrand.includes(normalizedBrand) || normalizedBrand.includes(specBrand)) {
      if (specModel.includes(normalizedModel) || normalizedModel.includes(specModel)) {
        return true;
      }
    }
    
    // Special handling for model variations
    const modelVariations = [
      normalizedModel.replace(/\s+/g, ','),      // Remove spaces
      normalizedModel.replace(/-/g, ', '),        // Remove dashes
      normalizedModel.replace(/\s+/g, '-'),     // Spaces to dashes
      normalizedModel.replace(/mark\s*/i, 'mk'),// Mark -> mk
      normalizedModel.replace(/ii$/i, '2'),     // II -> 2
      normalizedModel.replace(/iii$/i, '3'),    // III -> 3
    ];
    
    const specModelNormalized = specModel.replace(/\s+/g, ', ').replace(/-/g, ', ');
    
    return modelVariations.some(v => 
      specModelNormalized.includes(v.replace(/\s+/g'').replace(/-/g',')) ||
      v.replace(/\s+/g'').replace(/-/g',').includes(specModelNormalized)
    );
  }) || null;
}

/**
 * Find closest matching light by brand
 */
export function findLightSpecByBrand(brand: string): LightSpec | null {
  const normalizedBrand = brand.toLowerCase().trim();
  
  return ALL_LIGHT_SPECS.find(spec => 
    spec.brand.toLowerCase().includes(normalizedBrand) ||
    normalizedBrand.includes(spec.brand.toLowerCase())
  ) || null;
}

/**
 * Get default light specs for a light type
 */
export function getDefaultLightSpec(type: string): Partial<LightSpec> {
  switch (type.toLowerCase()) {
    case 'strobe':
      return {
        type: 'strobe',
        power: 500,
        colorTemp: 5600,
        cri: 92,
        beamAngle: 80,
        flashDuration: 1/1000,
        recycleTime: 1.0,
      };
    case 'speedlite':
    case 'flash':
      return {
        type: 'speedlite',
        power: 60,
        guideNumber: 50,
        colorTemp: 5600,
        cri: 90,
        beamAngle: 100,
        flashDuration: 1/1000,
        recycleTime: 2.0,
      };
    case 'continuous':
    case 'led':
      return {
        type: 'continuous',
        power: 150,
        colorTemp: 5600,
        cri: 95,
        beamAngle: 120,
        lumens: 10000,
      };
    case 'led_panel':
    case 'panel':
      return {
        type: 'led_panel',
        power: 30,
        colorTemp: 5600,
        colorTempRange: [3200, 5600],
        cri: 95,
        beamAngle: 120,
        bicolor: true,
      };
    default:
      return {
        power: 500,
        colorTemp: 5600,
        beamAngle: 80,
      };
  }
}

/**
 * Convert light spec to Virtual Studio light node data
 */
export function lightSpecToNodeData(spec: LightSpec): {
  power: number;
  cct: number;
  beam: number;
  modifier: string;
  modifierSize: [number, number];
  userData: Record<string, any>;
} {
  // Normalize power to 0-1 range (1000Ws = 1.0)
  const normalizedPower = Math.min(1, spec.power / 1000);
  
  // Determine modifier based on light type
  let modifier = 'standard';
  let modifierSize: [number, number] = [0.2, 0.2];
  
  if (spec.type === 'speedlite') {
    modifier = 'flash';
    modifierSize = [0.08, 0.06];
  } else if (spec.type === 'led_panel') {
    modifier = 'panel';
    modifierSize = [0.3, 0.2];
  } else if (spec.type === 'continuous' || spec.type === 'fresnel') {
    modifier = 'spot';
    modifierSize = [0.15, 0.15];
  } else {
    // Strobe - default to softbox
    modifier ='softbox';
    modifierSize = [0.6, 0.6];
  }
  
  return {
    power: normalizedPower,
    cct: spec.colorTemp,
    beam: spec.beamAngle,
    modifier,
    modifierSize,
    userData: {
      brand: spec.brand,
      model: spec.model,
      realEquipment: true,
      specifications: {
        power: spec.power,
        powerRange: spec.powerRange,
        colorTemp: spec.colorTemp,
        colorTempRange: spec.colorTempRange,
        cri: spec.cri,
        tlci: spec.tlci,
        beamAngle: spec.beamAngle,
        guideNumber: spec.guideNumber,
        flashDuration: spec.flashDuration,
        recycleTime: spec.recycleTime,
        lumens: spec.lumens,
        lux: spec.lux,
        hss: spec.hss,
        ttl: spec.ttl,
        wireless: spec.wireless,
        battery: spec.battery,
        bicolor: spec.bicolor,
        rgbw: spec.rgbw,
      },
    },
  };
}

export default ALL_LIGHT_SPECS;

