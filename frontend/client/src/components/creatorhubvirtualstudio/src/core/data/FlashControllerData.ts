/**
 * FlashControllerData - Database of Wireless Flash Controllers/Triggers
 * 
 * Contains specifications for popular wireless flash systems:
 * - Profoto Connect Pro, Connect
 * - Godox X Pro II, X2T, XPro
 * - Pocket Wizard Plus X, FlexTT5
 * - Elinchrom Skyport
 * - Broncolor RFS 2.2
 * - Phottix Odin II
 * - Yongnuo YN622
 */

// ============================================================================
// Types
// ============================================================================

export type FlashControllerBrand = 
  | 'profoto'
  | 'godox'
  | 'pocketwizard' 
  | 'elinchrom' 
  | 'broncolor' 
  | 'phottix' 
  | 'yongnuo'
  | 'nissin'
  | 'flashpoint'
  | 'cactus';

export type ControllerMount = 
  | 'canon' 
  | 'nikon' 
  | 'sony' 
  | 'fujifilm' 
  | 'olympus' 
  | 'panasonic' 
  | 'pentax'
  | 'universal';

export type CommunicationProtocol = 
  | 'bluetooth' 
  | 'radio_2.4ghz' 
  | 'radio_433mhz' 
  | 'infrared' 
  | 'optical';

export interface FlashGroup {
  id: string;
  name: string;
  enabled: boolean;
  power: number; // 0-1 normalized, or in stops
  powerMode: 'manual' | 'ttl' | 'hss';
  powerStops?: number; // e.g., -3.0 to +3.0 in TTL
  channel?: number;
  zoom?: number; // Flash head zoom in mm
  modelingLight?: boolean;
}

export interface FlashController {
  id: string;
  brand: FlashControllerBrand;
  model: string;
  displayName: string;
  
  // Compatibility
  compatibleMounts: ControllerMount[];
  compatibleLights: string[]; // Light model IDs or brand patterns
  protocol: CommunicationProtocol[];
  
  // Groups & Channels
  maxGroups: number;
  groupNames: string[]; // ['A','B','C','D','E'] or ['1','2','3','4']
  maxChannels: number;
  channelRange: [number, number]; // e.g., [1, 32]
  
  // Features
  supportsTTL: boolean;
  supportsHSS: boolean;
  supportsManual: boolean;
  supportsRearCurtain: boolean;
  supportsModelingLight: boolean;
  supportsRemotePowerControl: boolean;
  supportsRemoteZoom: boolean;
  supportsTestFire: boolean;
  supportsBluetooth: boolean;
  supportsApp: boolean;
  
  // Power Control
  powerRange: [number, number]; // e.g., [1, 10] in stops or [0.01, 1] normalized
  powerStepSize: number; // e.g., 0.1 (1/10 stop) or 0.3 (1/3 stop)
  ttlCompensationRange?: [number, number]; // e.g., [-3, +3] stops
  
  // Display
  hasScreen: boolean;
  screenType?: 'lcd' | 'oled' | 'led_segment';
  screenSize?: string; // e.g.'2.4"'
  
  // Physical
  weight?: number; // grams
  dimensions?: [number, number, number]; // mm
  batteryType?: string;
  
  // UI Style
  uiStyle: 'profoto' | 'godox' | 'pocketwizard' | 'generic';
  primaryColor: string; // For UI theming
  accentColor: string;
  
  // Pricing
  price?: number;
  thumbnailUrl?: string;
}

// ============================================================================
// Wikimedia Commons Thumbnail URLs for Flash Controllers
// ============================================================================

export const CONTROLLER_THUMBNAILS = {
  // Profoto
  'profoto_connect_pro':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/120px-Canon_Speedlite_580EX_II.jpg','profoto_connect' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/120px-Canon_Speedlite_580EX_II.jpg',
  
  // Godox - Using flash/trigger images
  'godox_xpro_ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Godox_V860II-C.jpg/120px-Godox_V860II-C.jpg','godox_x2t':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Godox_V860II-C.jpg/120px-Godox_V860II-C.jpg','godox_xpro' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Godox_V860II-C.jpg/120px-Godox_V860II-C.jpg',
  
  // PocketWizard
  'pocketwizard_plus_iv':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/120px-Canon_Speedlite_580EX_II.jpg','pocketwizard_flextt5' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/120px-Canon_Speedlite_580EX_II.jpg',
  
  // Elinchrom
  'elinchrom_skyport_plus_hs' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/120px-Studio_strobe_light.jpg',
  
  // Broncolor
  'broncolor_rfs_2.2' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Studio_strobe_light.jpg/120px-Studio_strobe_light.jpg',
  
  // Others
  'phottix_odin_ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/120px-Canon_Speedlite_580EX_II.jpg','yongnuo_yn622c_tx':'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/120px-Canon_Speedlite_580EX_II.jpg','flashpoint_r2_pro_ii':'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Godox_V860II-C.jpg/120px-Godox_V860II-C.jpg','nissin_air10s' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Canon_Speedlite_580EX_II.jpg/120px-Canon_Speedlite_580EX_II.jpg',
  
  // Generic fallback
  'default' : 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Camera_icon.svg/120px-Camera_icon.svg.png',
};

export function getControllerThumbnail(controllerId: string): string {
  return CONTROLLER_THUMBNAILS[controllerId as keyof typeof CONTROLLER_THUMBNAILS] 
    || CONTROLLER_THUMBNAILS['default'];
}

// ============================================================================
// Profoto Controllers
// ============================================================================

export const PROFOTO_CONTROLLERS: FlashController[] = [
  {
    id: 'profoto_connect_pro',
    brand: 'profoto',
    model: 'Connect Pro',
    displayName: 'Profoto Connect Pro',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus','panasonic'],
    compatibleLights: ['profoto_d2','profoto_b10','profoto_b1x','profoto_a1','profoto_a1x','profoto_a10','profoto_pro'],
    protocol: ['bluetooth','radio_2.4ghz'],
    maxGroups: 6,
    groupNames: ['A1','A2','A3','B1','B2','B3'],
    maxChannels: 20,
    channelRange: [1, 20],
    supportsTTL: true,
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: true,
    supportsApp: true,
    powerRange: [2, 10], // 2.0 to 10.0 (9 f-stops range)
    powerStepSize: 0.1, // 1/10 stop increments
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'oled',
    screenSize: '1.44"',
    weight: 118, // grams (actual spec)
    dimensions: [64, 76, 42], // mm (W x H x D)
    batteryType: 'Li-ion rechargeable (built-in)',
    uiStyle: 'profoto',
    primaryColor: '#1a1a1a',
    accentColor: '#00a0e3', // Profoto blue
    price: 399,
    thumbnailUrl: CONTROLLER_THUMBNAILS['profoto_connect_pro'],
  },
  {
    id: 'profoto_connect',
    brand: 'profoto',
    model: 'Connect',
    displayName: 'Profoto Connect',
    compatibleMounts: ['canon','nikon','sony'],
    compatibleLights: ['profoto_d2','profoto_b10','profoto_b1x','profoto_a1','profoto_a1x'],
    protocol: ['bluetooth','radio_2.4ghz'],
    maxGroups: 3,
    groupNames: ['A','B','C'],
    maxChannels: 8,
    channelRange: [1, 8],
    supportsTTL: true,
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: false,
    supportsModelingLight: true,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: true,
    supportsApp: true,
    powerRange: [2, 10],
    powerStepSize: 0.3, // 1/3 stop increments
    ttlCompensationRange: [-3, 3],
    hasScreen: false,
    weight: 60, // grams
    dimensions: [62, 65, 33],
    batteryType: 'CR2450 lithium',
    uiStyle: 'profoto',
    primaryColor: '#1a1a1a',
    accentColor: '#00a0e3',
    price: 299,
    thumbnailUrl: CONTROLLER_THUMBNAILS['profoto_connect'],
  },
];

// ============================================================================
// Godox Controllers
// ============================================================================

export const GODOX_CONTROLLERS: FlashController[] = [
  {
    id: 'godox_xpro_ii',
    brand: 'godox',
    model: 'XPro II',
    displayName: 'Godox XPro II',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus','panasonic'],
    compatibleLights: ['godox_ad600','godox_ad400','godox_ad300','godox_ad200','godox_v1','godox_v860','godox_tt685','godox_sk','godox_qs','godox_ms'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 5,
    groupNames: ['A','B','C','D','E'],
    maxChannels: 32,
    channelRange: [1, 32],
    supportsTTL: true,
    supportsHSS: true, // Up to 1/8000s
    supportsManual: true,
    supportsRearCurtain: true, // 2nd curtain sync
    supportsModelingLight: true,
    supportsRemotePowerControl: true, // 1/256 to 1/1 (8 stops)
    supportsRemoteZoom: true, // 20-200mm
    supportsTestFire: true,
    supportsBluetooth: true, // Godox app control
    supportsApp: true,
    powerRange: [1, 8], // 8 stops (1/256 to 1/1)
    powerStepSize: 0.1, // 1/10 stop increments
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '2.4"', // Large tilting LCD
    weight: 155, // grams (actual)
    dimensions: [69, 100, 52], // mm
    batteryType: 'AA x2 (Li-ion rechargeable optional)',
    uiStyle: 'godox',
    primaryColor: '#2a2a2a',
    accentColor: '#ff6600', // Godox orange
    price: 89,
    thumbnailUrl: CONTROLLER_THUMBNAILS['godox_xpro_ii'],
  },
  {
    id: 'godox_x2t',
    brand: 'godox',
    model: 'X2T',
    displayName: 'Godox X2T',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus','panasonic'],
    compatibleLights: ['godox_ad600','godox_ad400','godox_ad300','godox_ad200','godox_v1','godox_v860','godox_tt685'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 5,
    groupNames: ['A','B','C','D','E'],
    maxChannels: 32,
    channelRange: [1, 32],
    supportsTTL: true,
    supportsHSS: true, // 1/8000s
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: true,
    supportsTestFire: true,
    supportsBluetooth: true,
    supportsApp: false,
    powerRange: [1, 8],
    powerStepSize: 0.3, // 1/3 stop
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '1.69"',
    weight: 102, // grams
    dimensions: [62, 74, 43],
    batteryType: 'AA x2',
    uiStyle: 'godox',
    primaryColor: '#2a2a2a',
    accentColor: '#ff6600',
    price: 69,
    thumbnailUrl: CONTROLLER_THUMBNAILS['godox_x2t'],
  },
  {
    id: 'godox_xpro',
    brand: 'godox',
    model: 'XPro',
    displayName: 'Godox XPro',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus','panasonic'],
    compatibleLights: ['godox_ad600','godox_ad400','godox_ad300','godox_ad200','godox_v1','godox_v860','godox_tt685'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 5,
    groupNames: ['A','B','C','D','E'],
    maxChannels: 32,
    channelRange: [1, 32],
    supportsTTL: true,
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: true,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [1, 8],
    powerStepSize: 0.3,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '2.0"',
    weight: 135,
    dimensions: [67, 83, 46],
    batteryType: 'AA x2',
    uiStyle: 'godox',
    primaryColor: '#2a2a2a',
    accentColor: '#ff6600',
    price: 69,
    thumbnailUrl: CONTROLLER_THUMBNAILS['godox_xpro'],
  },
  {
    id: 'godox_x3',
    brand: 'godox',
    model: 'X3 (Xnano)',
    displayName: 'Godox X3 Xnano',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus'],
    compatibleLights: ['godox_ad600','godox_ad400','godox_ad300','godox_ad200','godox_v1','godox_v860','godox_tt685'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 5,
    groupNames: ['A','B','C','D','E'],
    maxChannels: 32,
    channelRange: [1, 32],
    supportsTTL: true,
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: true,
    supportsTestFire: true,
    supportsBluetooth: true,
    supportsApp: true,
    powerRange: [1, 8],
    powerStepSize: 0.1,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'oled', // Touch OLED
    screenSize: '2.4"',
    weight: 99, // grams - very compact
    dimensions: [57, 75, 37],
    batteryType: 'Li-ion rechargeable (built-in, USB-C)',
    uiStyle: 'godox',
    primaryColor: '#2a2a2a',
    accentColor: '#ff6600',
    price: 99,
    thumbnailUrl: CONTROLLER_THUMBNAILS['godox_xpro_ii'],
  },
];

// ============================================================================
// Pocket Wizard Controllers
// ============================================================================

export const POCKETWIZARD_CONTROLLERS: FlashController[] = [
  {
    id: 'pocketwizard_plus_iv',
    brand: 'pocketwizard',
    model: 'Plus IV',
    displayName: 'PocketWizard Plus IV',
    compatibleMounts: ['universal'],
    compatibleLights: ['*'], // Universal compatibility - any flash with sync port
    protocol: ['radio_433mhz'], // 344MHz actually, long range
    maxGroups: 4,
    groupNames: ['1','2','3','4'],
    maxChannels: 32,
    channelRange: [1, 32],
    supportsTTL: false, // Manual only
    supportsHSS: false,
    supportsManual: true,
    supportsRearCurtain: false,
    supportsModelingLight: false,
    supportsRemotePowerControl: false, // Trigger only
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [0, 1],
    powerStepSize: 1, // On/off only
    hasScreen: false,
    weight: 85, // grams
    dimensions: [56, 74, 25],
    batteryType: 'AA x2',
    uiStyle: 'pocketwizard',
    primaryColor: '#333333',
    accentColor: '#cc0000', // PocketWizard red
    price: 139,
    thumbnailUrl: CONTROLLER_THUMBNAILS['pocketwizard_plus_iv'],
  },
  {
    id: 'pocketwizard_flextt5',
    brand: 'pocketwizard',
    model: 'FlexTT5',
    displayName: 'PocketWizard FlexTT5',
    compatibleMounts: ['canon','nikon'],
    compatibleLights: ['canon_speedlite','nikon_speedlight','pocketwizard_*'],
    protocol: ['radio_433mhz'],
    maxGroups: 3,
    groupNames: ['A','B','C'],
    maxChannels: 20,
    channelRange: [1, 20],
    supportsTTL: true, // ControlTL system
    supportsHSS: true, // HyperSync up to 1/8000s
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: false,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [1, 6], // 6 stops
    powerStepSize: 0.3,
    ttlCompensationRange: [-3, 3],
    hasScreen: false,
    weight: 110,
    dimensions: [64, 84, 43],
    batteryType: 'AA x2',
    uiStyle: 'pocketwizard',
    primaryColor: '#333333',
    accentColor: '#cc0000',
    price: 219,
    thumbnailUrl: CONTROLLER_THUMBNAILS['pocketwizard_flextt5'],
  },
  {
    id: 'pocketwizard_plusx',
    brand: 'pocketwizard',
    model: 'Plus X',
    displayName: 'PocketWizard Plus X',
    compatibleMounts: ['universal'],
    compatibleLights: ['*'],
    protocol: ['radio_433mhz'],
    maxGroups: 10,
    groupNames: ['1','2','3','4','5','6','7','8','9','10'],
    maxChannels: 10,
    channelRange: [1, 10],
    supportsTTL: false,
    supportsHSS: false,
    supportsManual: true,
    supportsRearCurtain: false,
    supportsModelingLight: false,
    supportsRemotePowerControl: false,
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [0, 1],
    powerStepSize: 1,
    hasScreen: false,
    weight: 57, // Very lightweight
    dimensions: [53, 68, 22],
    batteryType: 'AAA x2',
    uiStyle: 'pocketwizard',
    primaryColor: '#333333',
    accentColor: '#cc0000',
    price: 99,
    thumbnailUrl: CONTROLLER_THUMBNAILS['pocketwizard_plus_iv'],
  },
];

// ============================================================================
// Elinchrom Controllers
// ============================================================================

export const ELINCHROM_CONTROLLERS: FlashController[] = [
  {
    id: 'elinchrom_skyport_plus_hs',
    brand: 'elinchrom',
    model: 'Skyport Plus HS',
    displayName: 'Elinchrom Skyport Plus HS',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus'],
    compatibleLights: ['elinchrom_elc','elinchrom_elb','elinchrom_dlite','elinchrom_one','elinchrom_five'],
    protocol: ['radio_2.4ghz'], // Elinchrom Skyport protocol
    maxGroups: 4,
    groupNames: ['A','B','C','D'],
    maxChannels: 20,
    channelRange: [1, 20],
    supportsTTL: true, // ODS (Over Drive Sync)
    supportsHSS: true, // Hi-Sync up to 1/8000s
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true, // 7 f-stop range
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [3, 10], // 7 f-stops (2.0 to 9.0)
    powerStepSize: 0.1, // 1/10 stop
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '1.5"',
    weight: 95, // grams
    dimensions: [58, 72, 36],
    batteryType: 'AAA x2',
    uiStyle: 'generic',
    primaryColor: '#1a1a2e',
    accentColor: '#e63946', // Elinchrom red
    price: 249,
    thumbnailUrl: CONTROLLER_THUMBNAILS['elinchrom_skyport_plus_hs'],
  },
  {
    id: 'elinchrom_transmitter_pro',
    brand: 'elinchrom',
    model: 'Transmitter Pro',
    displayName: 'Elinchrom Transmitter Pro',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus','panasonic'],
    compatibleLights: ['elinchrom_elc','elinchrom_elb','elinchrom_five','elinchrom_one'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 4,
    groupNames: ['A','B','C','D'],
    maxChannels: 20,
    channelRange: [1, 20],
    supportsTTL: true,
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: true,
    supportsApp: true, // Elinchrom app
    powerRange: [3, 10],
    powerStepSize: 0.1,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'oled',
    screenSize: '1.8"',
    weight: 112,
    dimensions: [62, 78, 42],
    batteryType: 'Li-ion rechargeable (USB-C)',
    uiStyle: 'generic',
    primaryColor: '#1a1a2e',
    accentColor: '#e63946',
    price: 349,
    thumbnailUrl: CONTROLLER_THUMBNAILS['elinchrom_skyport_plus_hs'],
  },
];

// ============================================================================
// Broncolor Controllers
// ============================================================================

export const BRONCOLOR_CONTROLLERS: FlashController[] = [
  {
    id: 'broncolor_rfs_2.2',
    brand: 'broncolor',
    model: 'RFS 2.2',
    displayName: 'Broncolor RFS 2.2',
    compatibleMounts: ['canon','nikon','sony','fujifilm','universal'],
    compatibleLights: ['broncolor_siros','broncolor_move','broncolor_scoro','broncolor_senso'],
    protocol: ['radio_2.4ghz'], // Broncolor proprietary
    maxGroups: 6,
    groupNames: ['1','2','3','4','5','6'],
    maxChannels: 99,
    channelRange: [1, 99],
    supportsTTL: true,
    supportsHSS: true, // HS (High Speed) mode
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true, // Proportional & full
    supportsRemotePowerControl: true, // 9 f-stop range
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: true, // bronControl app
    powerRange: [1, 10], // 9 f-stops
    powerStepSize: 0.1, // 1/10 stop precision
    ttlCompensationRange: [-5, 5],
    hasScreen: true,
    screenType: 'oled',
    screenSize: '2.0"',
    weight: 130,
    dimensions: [65, 82, 45],
    batteryType: 'AA x2 or Li-ion',
    uiStyle: 'generic',
    primaryColor: '#0a0a0a',
    accentColor: '#ffd700', // Broncolor gold/yellow
    price: 449,
    thumbnailUrl: CONTROLLER_THUMBNAILS['broncolor_rfs_2.2'],
  },
];

// ============================================================================
// Other Controllers
// ============================================================================

export const OTHER_CONTROLLERS: FlashController[] = [
  {
    id: 'phottix_odin_ii',
    brand: 'phottix',
    model: 'Odin II',
    displayName: 'Phottix Odin II',
    compatibleMounts: ['canon','nikon','sony'],
    compatibleLights: ['phottix_indra','canon_speedlite','nikon_speedlight','phottix_mitros'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 5,
    groupNames: ['A','B','C','D','E'],
    maxChannels: 32,
    channelRange: [1, 32],
    supportsTTL: true,
    supportsHSS: true, // 1/8000s
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true, // 8 stops
    supportsRemoteZoom: true, // 24-105mm
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [1, 8],
    powerStepSize: 0.3,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '2.0"',
    weight: 140,
    dimensions: [66, 86, 48],
    batteryType: 'AA x2',
    uiStyle: 'generic',
    primaryColor: '#2d2d2d',
    accentColor: '#00bfff', // Phottix blue
    price: 149,
    thumbnailUrl: CONTROLLER_THUMBNAILS['phottix_odin_ii'],
  },
  {
    id: 'yongnuo_yn622c_tx',
    brand: 'yongnuo',
    model: 'YN622C-TX',
    displayName: 'Yongnuo YN622C-TX',
    compatibleMounts: ['canon'],
    compatibleLights: ['canon_speedlite','yongnuo_yn560','yongnuo_yn568','yongnuo_yn685'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 3,
    groupNames: ['A','B','C'],
    maxChannels: 7,
    channelRange: [1, 7],
    supportsTTL: true,
    supportsHSS: true, // 1/8000s
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: false,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: true,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [1, 8], // 1/128 to 1/1
    powerStepSize: 0.3,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '1.5"',
    weight: 95,
    dimensions: [58, 68, 38],
    batteryType: 'AA x2',
    uiStyle: 'generic',
    primaryColor: '#1a1a1a',
    accentColor: '#ff4444', // Yongnuo red
    price: 49,
    thumbnailUrl: CONTROLLER_THUMBNAILS['yongnuo_yn622c_tx'],
  },
  {
    id: 'yongnuo_yn622n_tx',
    brand: 'yongnuo',
    model: 'YN622N-TX',
    displayName: 'Yongnuo YN622N-TX',
    compatibleMounts: ['nikon'],
    compatibleLights: ['nikon_speedlight','yongnuo_yn560','yongnuo_yn568','yongnuo_yn685'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 3,
    groupNames: ['A','B','C'],
    maxChannels: 7,
    channelRange: [1, 7],
    supportsTTL: true,
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: false,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: true,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [1, 8],
    powerStepSize: 0.3,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '1.5"',
    weight: 95,
    dimensions: [58, 68, 38],
    batteryType: 'AA x2',
    uiStyle: 'generic',
    primaryColor: '#1a1a1a',
    accentColor: '#ff4444',
    price: 49,
    thumbnailUrl: CONTROLLER_THUMBNAILS['yongnuo_yn622c_tx'],
  },
  {
    id: 'flashpoint_r2_pro_ii',
    brand: 'flashpoint',
    model: 'R2 Pro II',
    displayName: 'Flashpoint R2 Pro II',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus','panasonic'],
    compatibleLights: ['flashpoint_xplor','godox_ad600','godox_ad400','godox_ad300','godox_ad200','godox_v1','godox_v860'],
    protocol: ['radio_2.4ghz'],
    maxGroups: 5,
    groupNames: ['A','B','C','D','E'],
    maxChannels: 32,
    channelRange: [1, 32],
    supportsTTL: true,
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: true,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: true,
    supportsTestFire: true,
    supportsBluetooth: true,
    supportsApp: true,
    powerRange: [1, 8],
    powerStepSize: 0.1,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '2.4"',
    weight: 155,
    dimensions: [69, 100, 52],
    batteryType: 'AA x2',
    uiStyle: 'godox', // Same as Godox XPro II (Adorama rebrand)
    primaryColor: '#2a2a2a',
    accentColor: '#ff6600',
    price: 89,
    thumbnailUrl: CONTROLLER_THUMBNAILS['flashpoint_r2_pro_ii'],
  },
  {
    id: 'nissin_air10s',
    brand: 'nissin',
    model: 'Air10s',
    displayName: 'Nissin Air10s',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus'],
    compatibleLights: ['nissin_i60a','nissin_i600','nissin_mg10','nissin_di700a'],
    protocol: ['radio_2.4ghz'], // NAS (Nissin Air System)
    maxGroups: 8,
    groupNames: ['A','B','C','D','E','F','G','H'],
    maxChannels: 8,
    channelRange: [1, 8],
    supportsTTL: true,
    supportsHSS: true, // FP/HSS
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: false,
    supportsRemotePowerControl: true, // 1/256 to 1/1
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [1, 8],
    powerStepSize: 0.3,
    ttlCompensationRange: [-2, 2],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '1.2"',
    weight: 64, // Very compact
    dimensions: [51, 63, 32],
    batteryType: 'AAA x2',
    uiStyle: 'generic',
    primaryColor: '#1e1e1e',
    accentColor: '#00cc00', // Nissin green
    price: 119,
    thumbnailUrl: CONTROLLER_THUMBNAILS['nissin_air10s'],
  },
  {
    id: 'cactus_v6_ii',
    brand: 'cactus',
    model: 'V6 II',
    displayName: 'Cactus V6 II',
    compatibleMounts: ['canon','nikon','sony','fujifilm','olympus','panasonic','pentax'],
    compatibleLights: ['*'], // Cross-brand TTL
    protocol: ['radio_2.4ghz'],
    maxGroups: 4,
    groupNames: ['A','B','C','D'],
    maxChannels: 16,
    channelRange: [1, 16],
    supportsTTL: true, // Cross-brand TTL!
    supportsHSS: true,
    supportsManual: true,
    supportsRearCurtain: true,
    supportsModelingLight: false,
    supportsRemotePowerControl: true,
    supportsRemoteZoom: false,
    supportsTestFire: true,
    supportsBluetooth: false,
    supportsApp: false,
    powerRange: [1, 8],
    powerStepSize: 0.5,
    ttlCompensationRange: [-3, 3],
    hasScreen: true,
    screenType: 'lcd',
    screenSize: '1.3"',
    weight: 88,
    dimensions: [59, 74, 33],
    batteryType: 'AA x2',
    uiStyle: 'generic',
    primaryColor: '#2a2a2a',
    accentColor: '#9933ff', // Cactus purple
    price: 89,
    thumbnailUrl: CONTROLLER_THUMBNAILS['default'],
  },
];

// ============================================================================
// All Controllers
// ============================================================================

export const ALL_FLASH_CONTROLLERS: FlashController[] = [
  ...PROFOTO_CONTROLLERS,
  ...GODOX_CONTROLLERS,
  ...POCKETWIZARD_CONTROLLERS,
  ...ELINCHROM_CONTROLLERS,
  ...BRONCOLOR_CONTROLLERS,
  ...OTHER_CONTROLLERS,
];

// ============================================================================
// Helper Functions
// ============================================================================

export function findFlashController(brand: string, model: string): FlashController | undefined {
  const searchBrand = brand.toLowerCase();
  const searchModel = model.toLowerCase();
  
  return ALL_FLASH_CONTROLLERS.find(
    (c) => c.brand.toLowerCase() === searchBrand && c.model.toLowerCase().includes(searchModel)
  );
}

export function findControllersByBrand(brand: FlashControllerBrand): FlashController[] {
  return ALL_FLASH_CONTROLLERS.filter((c) => c.brand === brand);
}

export function findControllersForLight(lightBrand: string): FlashController[] {
  const brand = lightBrand.toLowerCase();
  
  return ALL_FLASH_CONTROLLERS.filter((c) => {
    // Check if controller is from same brand
    if (c.brand === brand) return true;
    
    // Check compatible lights
    return c.compatibleLights.some(
      (l) => l === '*' || l.toLowerCase().includes(brand)
    );
  });
}

export function getControllerById(id: string): FlashController | undefined {
  return ALL_FLASH_CONTROLLERS.find((c) => c.id === id);
}

// ============================================================================
// Controller Recommendation System
// ============================================================================

export interface LightInScene {
  brand: string;
  model: string;
  type?: string; // 'strobe' | 'speedlite' | 'continuous' | etc.
}

export interface ControllerRecommendation {
  controller: FlashController;
  matchScore: number; // 0-100
  matchReason: string;
  isTopPick: boolean;
  brandMatch: boolean;
  features: string[];
}

/**
 * Get the best controller recommendations based on lights in the scene
 */
export function getControllerRecommendations(lights: LightInScene[]): ControllerRecommendation[] {
  if (lights.length === 0) return [];
  
  // Count lights by brand
  const brandCounts: Record<string, number> = {};
  const lightBrands: string[] = [];
  
  lights.forEach((light) => {
    const brand = light.brand?.toLowerCase() || 'unknown';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    if (!lightBrands.includes(brand)) lightBrands.push(brand);
  });
  
  // Find dominant brand
  const dominantBrand = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  
  // Score each controller
  const recommendations: ControllerRecommendation[] = ALL_FLASH_CONTROLLERS.map((ctrl) => {
    let score = 0;
    const reasons: string[] = [];
    const features: string[] = [];
    
    // Brand match (highest priority)
    const isBrandMatch = ctrl.brand === dominantBrand || 
      ctrl.compatibleLights.some(l => l.toLowerCase().includes(dominantBrand));
    
    if (isBrandMatch) {
      score += 50;
      reasons.push(`Native ${dominantBrand} compatibility`);
    }
    
    // Same brand controller
    if (ctrl.brand === dominantBrand) {
      score += 20;
      reasons.push('Same brand ecosystem, ');
    }
    
    // Universal compatibility
    if (ctrl.compatibleLights.includes('*,')) {
      score += 10;
      reasons.push('Universal compatibility, ');
    }
    
    // Feature bonuses
    if (ctrl.supportsTTL) {
      score += 5;
      features.push('TTL, ');
    }
    if (ctrl.supportsHSS) {
      score += 5;
      features.push('HSS, ');
    }
    if (ctrl.supportsRemotePowerControl) {
      score += 8;
      features.push('Remote power');
    }
    if (ctrl.supportsBluetooth) {
      score += 3;
      features.push('Bluetooth');
    }
    if (ctrl.supportsApp) {
      score += 3;
      features.push('App control');
    }
    if (ctrl.hasScreen) {
      score += 2;
      features.push(ctrl.screenType === 'oled' ? 'OLED screen' : 'LCD screen');
    }
    
    // Group count bonus (more groups = more flexibility)
    if (ctrl.maxGroups >= 5) {
      score += 3;
    }
    
    // Penalty for manual-only controllers when TTL lights exist
    if (!ctrl.supportsTTL && lights.some(l => 
      l.brand?.toLowerCase().includes('canon') || 
      l.brand?.toLowerCase().includes('nikon') ||
      l.brand?.toLowerCase().includes('sony')
    )) {
      score -= 10;
    }
    
    return {
      controller: ctrl,
      matchScore: Math.min(100, Math.max(0, score)),
      matchReason: reasons[0] || 'Compatible controller',
      isTopPick: false,
      brandMatch: isBrandMatch,
      features,
    };
  });
  
  // Sort by score
  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  
  // Mark top pick
  if (recommendations.length > 0) {
    recommendations[0].isTopPick = true;
  }
  
  return recommendations;
}

/**
 * Get the single best controller recommendation
 */
export function getBestControllerForLights(lights: LightInScene[]): ControllerRecommendation | null {
  const recommendations = getControllerRecommendations(lights);
  return recommendations[0] || null;
}

/**
 * Get recommendation message based on lights
 */
export function getRecommendationMessage(lights: LightInScene[]): string {
  if (lights.length === 0) return ', ';
  
  const recommendation = getBestControllerForLights(lights);
  if (!recommendation) return '';
  
  // Get primary light info
  const primaryLight = lights[0];
  const lightName = `${primaryLight.brand} ${primaryLight.model}`.trim();
  
  if (recommendation.brandMatch) {
    return `You have ${lightName} in your scene. The ${recommendation.controller.displayName} would be the best match for this setup!`;
  } else {
    return `Based on your ${lightName}, the ${recommendation.controller.displayName} offers good compatibility.`;
  }
}

/**
 * Brand to controller mapping for quick lookup
 */
export const BRAND_CONTROLLER_MAP: Record<string, string[]> = {
  profoto: ['profoto_connect_pro', 'profoto_connect'],
  godox: ['godox_xpro_ii', 'godox_x3', 'godox_x2t', 'godox_xpro'],
  flashpoint: ['flashpoint_r2_pro_ii', 'godox_xpro_ii'], // Flashpoint = Godox rebrand
  elinchrom: ['elinchrom_transmitter_pro', 'elinchrom_skyport_plus_hs'],
  broncolor: ['broncolor_rfs_2.2'],
  canon: ['godox_xpro_ii', 'yongnuo_yn622c_tx', 'pocketwizard_flextt5'],
  nikon: ['godox_xpro_ii', 'yongnuo_yn622n_tx', 'pocketwizard_flextt5'],
  sony: ['godox_xpro_ii', 'phottix_odin_ii'],
  fujifilm: ['godox_xpro_ii', 'nissin_air10s'],
  nissin: ['nissin_air10s'],
  phottix: ['phottix_odin_ii'],
  yongnuo: ['yongnuo_yn622c_tx', 'yongnuo_yn622n_tx'],
};

// ============================================================================
// Power Conversion Utilities
// ============================================================================

/**
 * Convert normalized power (0-1) to f-stop notation
 */
export function powerToStops(power: number, maxStops: number = 10): number {
  // 1/1 = 10 stops, 1/2 = 9, 1/4 = 8, etc.
  if (power <= 0) return 1;
  return maxStops + Math.log2(power);
}

/**
 * Convert f-stop notation to normalized power (0-1)
 */
export function stopsToPower(stops: number, maxStops: number = 10): number {
  return Math.pow(2, stops - maxStops);
}

/**
 * Format power as fraction (1/1, 1/2, 1/4, 1/8, etc.)
 */
export function formatPowerFraction(power: number): string {
  if (power >= 1) return '1/1';
  if (power >= 0.5) return '1/2';
  if (power >= 0.25) return '1/4';
  if (power >= 0.125) return '1/8';
  if (power >= 0.0625) return '1/16';
  if (power >= 0.03125) return '1/32';
  if (power >= 0.015625) return '1/64';
  if (power >= 0.0078125) return '1/128';
  return '1/256';
}

/**
 * Format power as stops notation (e.g., "7.0""5.3")
 */
export function formatPowerStops(stops: number): string {
  return stops.toFixed(1);
}

/**
 * Parse fraction string to power value
 */
export function parsePowerFraction(fraction: string): number {
  const match = fraction.match(/1\/(\d+)/);
  if (!match) return 1;
  return 1 / parseInt(match[1], 10);
}

// ============================================================================
// Default Group Configuration
// ============================================================================

export function createDefaultGroups(controller: FlashController): FlashGroup[] {
  return controller.groupNames.map((name, index) => ({
    id: `group_${name}`,
    name,
    enabled: index === 0, // Only first group enabled by default
    power: 0.5, // 50% power
    powerMode: 'manual',
    powerStops: controller.powerRange[1] - 2, // 2 stops below max
    channel: controller.channelRange[0],
    zoom: 35,
    modelingLight: false,
  }));
}
