/**
 * Unified Equipment Types & Constants
 * 
 * Single source of truth for all equipment-related types, categories,
 * and constants used across both frontend contexts (Role Room & standalone)
 * and the backend.
 */

// ─────────────────────────────────────────────────────────────
// Equipment Categories
// ─────────────────────────────────────────────────────────────

/**
 * Canonical equipment category keys — aligned with equipment_library DB table.
 * These are the keys stored in the database `category` column.
 */
export const EQUIPMENT_CATEGORY_KEYS = [
  'camera',
  'lens',
  'audio',
  'lighting',
  'drone',
  'stabilizer',
  'monitor',
  'media',
  'power',
  'wireless_video',
  'support',
  'computer',
  'accessory',
  'software',
  'audio_interface',
  'synthesizer',
  'controller',
] as const;

export type EquipmentCategoryKey = (typeof EQUIPMENT_CATEGORY_KEYS)[number];

/** Category metadata (label is Norwegian, matching existing UI language) */
export interface CategoryMeta {
  /** MUI icon name (resolved by consumer) */
  icon: string;
  /** Norwegian display label */
  label: string;
  /** Role Room legacy label (for compatibility) */
  roleRoomLabel: string;
  /** Theme colour (hex) */
  color: string;
}

/**
 * Master category map — every frontend consumer should derive
 * its category list from this. When adding a new category:
 * 1. Add to `EQUIPMENT_CATEGORY_KEYS`
 * 2. Add metadata here
 * 3. Add rows to `equipment_library` via migration
 */
export const EQUIPMENT_CATEGORIES: Record<EquipmentCategoryKey, CategoryMeta> = {
  camera:          { icon: 'CameraAlt',      label: 'Kameraer',        roleRoomLabel: 'Kamera',     color: '#FF6B35' },
  lens:            { icon: 'Lens',            label: 'Objektiver',      roleRoomLabel: 'Linse',      color: '#9C27B0' },
  audio:           { icon: 'Headphones',      label: 'Lyd',             roleRoomLabel: 'Lyd',        color: '#FF5722' },
  lighting:        { icon: 'FlashOn',         label: 'Lys',             roleRoomLabel: 'Lys',        color: '#FFC107' },
  drone:           { icon: 'FlightTakeoff',   label: 'Droner',          roleRoomLabel: 'Drone',      color: '#00BCD4' },
  stabilizer:      { icon: 'Videocam',        label: 'Stabilisatorer',  roleRoomLabel: 'Stabilisator', color: '#795548' },
  monitor:         { icon: 'Monitor',         label: 'Monitorer',       roleRoomLabel: 'Monitor',    color: '#3F51B5' },
  media:           { icon: 'SdCard',          label: 'Media/Lagring',   roleRoomLabel: 'Media',      color: '#8BC34A' },
  power:           { icon: 'BatteryChargingFull', label: 'Strøm/Batteri', roleRoomLabel: 'Strøm',   color: '#FF9800' },
  wireless_video:  { icon: 'Wifi',            label: 'Trådløs Video',   roleRoomLabel: 'Trådløs',    color: '#E91E63' },
  support:         { icon: 'Architecture',    label: 'Stativ/Rigg',     roleRoomLabel: 'Stativ',     color: '#607D8B' },
  computer:        { icon: 'Computer',        label: 'Datautstyr',      roleRoomLabel: 'Data',       color: '#2196F3' },
  accessory:       { icon: 'Extension',       label: 'Tilbehør',        roleRoomLabel: 'Annet',      color: '#4CAF50' },
  software:        { icon: 'Code',            label: 'Programvare',     roleRoomLabel: 'Programvare', color: '#607D8B' },
  audio_interface: { icon: 'SettingsInputHdmi', label: 'Lydkort',       roleRoomLabel: 'Lydkort',    color: '#E91E63' },
  synthesizer:     { icon: 'Piano',           label: 'Synthesizere',    roleRoomLabel: 'Synth',      color: '#673AB7' },
  controller:      { icon: 'Tune',            label: 'Kontrollere',     roleRoomLabel: 'Kontroll',   color: '#009688' },
};

/**
 * Role Room default categories — derived from the master categories map,
 * filtering to only cine-production-relevant types.
 */
export const ROLE_ROOM_CATEGORIES: EquipmentCategoryKey[] = [
  'camera', 'lens', 'audio', 'lighting', 'drone',
  'stabilizer', 'monitor', 'media', 'power',
  'wireless_video', 'support', 'accessory',
];

/**
 * Map legacy Norwegian category names → canonical keys.
 * e.g. 'Kamera' → 'camera', 'Linse' → 'lens'
 */
export const LEGACY_CATEGORY_MAP: Record<string, EquipmentCategoryKey> = {
  'Kamera': 'camera',
  'Linse': 'lens',
  'Optikk': 'lens',
  'Rig': 'support',
  'Stativ': 'support',
  'Lys': 'lighting',
  'Lyd': 'audio',
  'Strøm': 'power',
  'Transport': 'accessory',
  'Sikkerhet': 'accessory',
  'Annet': 'accessory',
  'Drone': 'drone',
  'Stabilisator': 'stabilizer',
  'Monitor': 'monitor',
  'Media': 'media',
  'Trådløs': 'wireless_video',
  'Data': 'computer',
};

// ─────────────────────────────────────────────────────────────
// Equipment Condition & Status
// ─────────────────────────────────────────────────────────────

export const EQUIPMENT_CONDITIONS = [
  'excellent', 'good', 'fair', 'poor', 'needs_repair',
] as const;
export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number];

export const EQUIPMENT_STATUSES = [
  'available', 'in_use', 'maintenance', 'retired',
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

// ─────────────────────────────────────────────────────────────
// Unified Equipment Interface
// ─────────────────────────────────────────────────────────────

/**
 * Unified Equipment — works for both user-owned equipment (standalone)
 * and project-scoped equipment (Role Room / casting).
 * 
 * Uses snake_case to match DB columns and Role Room convention.
 * Frontend components that need camelCase should map at the boundary.
 */
export interface UnifiedEquipment {
  /** Integer ID for user_equipment; UUID string for casting_equipment */
  id: number | string;

  // ── Ownership / Scope ──
  /** User who owns this gear (user_equipment context) */
  user_id?: string;
  /** Project (casting_equipment context — null = user-owned) */
  project_id?: string | null;

  // ── Identity ──
  name: string;
  brand: string;
  model: string;
  category: EquipmentCategoryKey | string;
  serial_number?: string;
  description?: string;

  // ── State ──
  status: EquipmentStatus;
  condition: EquipmentCondition;
  quantity?: number;
  is_global?: boolean;

  // ── Financial ──
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  rental_rate_day?: number;

  // ── Maintenance ──
  warranty_expiry?: string;
  last_maintenance?: string;
  next_maintenance?: string;
  maintenance_interval?: number;

  // ── Firmware ──
  firmware_current?: string;
  firmware_track_key?: string;
  firmware_auto_check_enabled?: boolean;
  firmware_latest?: string;
  firmware_update_available?: boolean;

  // ── Usage stats ──
  total_shots?: number;
  total_hours?: number;
  last_used?: string;

  // ── Media ──
  image_url?: string;
  notes?: string;

  // ── Relationships ──
  assignees?: Array<{ crew_id: string; role: string }>;
  location?: string;
  location_name?: string;
  tags?: string[];

  // ── Timestamps ──
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────
// Equipment Library (Catalog) types
// ─────────────────────────────────────────────────────────────

/** Row from the equipment_library reference catalog table */
export interface EquipmentLibraryItem {
  id: number;
  name: string;
  category: EquipmentCategoryKey | string;
  brand: string;
  model: string;
  type?: string;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────
// Scene-Aware Intelligence types
// ─────────────────────────────────────────────────────────────

export type SceneType =
  | 'interview'
  | 'dialogue'
  | 'action'
  | 'establishing'
  | 'close_up'
  | 'wide_shot'
  | 'product'
  | 'documentary'
  | 'music_video'
  | 'commercial'
  | 'vlog'
  | 'live_event'
  | 'wedding'
  | 'real_estate'
  | 'food'
  | 'automotive'
  | 'fashion'
  | 'corporate'
  | 'timelapse'
  | 'underwater'
  | 'aerial';

export interface SceneEquipmentRecommendation {
  scene_type: SceneType;
  /** Required equipment categories for this scene type */
  required_categories: EquipmentCategoryKey[];
  /** Recommended equipment categories */
  recommended_categories: EquipmentCategoryKey[];
  /** Specific equipment suggestions from library (brand + model) */
  suggested_equipment: Array<{
    category: EquipmentCategoryKey;
    brand: string;
    model: string;
    reason: string;
  }>;
  /** Tips for this scene type */
  tips: string[];
}

// ─────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────

/**
 * Normalize a raw category string to a canonical EquipmentCategoryKey.
 * Handles legacy Norwegian names, English names, and fuzzy matching.
 */
export function normalizeCategoryKey(raw: string | null | undefined): EquipmentCategoryKey {
  if (!raw) return 'accessory';
  const trimmed = raw.trim();

  // Direct hit
  if (EQUIPMENT_CATEGORY_KEYS.includes(trimmed as EquipmentCategoryKey)) {
    return trimmed as EquipmentCategoryKey;
  }

  // Legacy Norwegian map
  if (LEGACY_CATEGORY_MAP[trimmed]) {
    return LEGACY_CATEGORY_MAP[trimmed];
  }

  // Fuzzy matching
  const lower = trimmed.toLowerCase();
  if (lower.includes('kamera') || lower.includes('camera')) return 'camera';
  if (lower.includes('lins') || lower.includes('lens') || lower.includes('optik') || lower.includes('objektiv')) return 'lens';
  if (lower.includes('lyd') || lower.includes('audio') || lower.includes('sound') || lower.includes('mic')) return 'audio';
  if (lower.includes('lys') || lower.includes('light')) return 'lighting';
  if (lower.includes('drone') || lower.includes('uav') || lower.includes('fpv')) return 'drone';
  if (lower.includes('stabil') || lower.includes('gimbal')) return 'stabilizer';
  if (lower.includes('monitor') || lower.includes('skjerm')) return 'monitor';
  if (lower.includes('media') || lower.includes('lagring') || lower.includes('storage') || lower.includes('ssd') || lower.includes('card')) return 'media';
  if (lower.includes('strøm') || lower.includes('batter') || lower.includes('power')) return 'power';
  if (lower.includes('trådløs') || lower.includes('wireless') || lower.includes('video tx')) return 'wireless_video';
  if (lower.includes('stativ') || lower.includes('rigg') || lower.includes('tripod') || lower.includes('dolly') || lower.includes('slider') || lower.includes('jib')) return 'support';
  if (lower.includes('data') || lower.includes('computer') || lower.includes('pc') || lower.includes('mac')) return 'computer';
  if (lower.includes('synth')) return 'synthesizer';
  if (lower.includes('lydkort') || lower.includes('audio_interface') || lower.includes('interface')) return 'audio_interface';
  if (lower.includes('kontroll') || lower.includes('controller') || lower.includes('midi')) return 'controller';
  if (lower.includes('program') || lower.includes('software') || lower.includes('plugin')) return 'software';

  return 'accessory';
}

/**
 * Get the Norwegian display label for a category.
 */
export function getCategoryLabel(key: EquipmentCategoryKey | string): string {
  const meta = EQUIPMENT_CATEGORIES[key as EquipmentCategoryKey];
  return meta?.label ?? key;
}

/**
 * Get the Role Room display label for a category.
 */
export function getRoleRoomLabel(key: EquipmentCategoryKey | string): string {
  const meta = EQUIPMENT_CATEGORIES[key as EquipmentCategoryKey];
  return meta?.roleRoomLabel ?? key;
}

/**
 * Convert a snake_case UnifiedEquipment to camelCase for legacy components.
 */
export function toCamelCase(item: UnifiedEquipment): Record<string, unknown> {
  return {
    id: item.id,
    userId: item.user_id,
    projectId: item.project_id,
    name: item.name,
    brand: item.brand,
    model: item.model,
    category: item.category,
    equipmentType: item.category,
    serialNumber: item.serial_number,
    description: item.description,
    status: item.status,
    condition: item.condition,
    quantity: item.quantity,
    isGlobal: item.is_global,
    isActive: item.status !== 'retired',
    purchaseDate: item.purchase_date,
    purchasePrice: item.purchase_price,
    currentValue: item.current_value,
    rentalRateDay: item.rental_rate_day,
    warrantyExpiry: item.warranty_expiry,
    lastMaintenance: item.last_maintenance,
    nextMaintenance: item.next_maintenance,
    maintenanceInterval: item.maintenance_interval,
    firmwareCurrent: item.firmware_current,
    firmwareTrackKey: item.firmware_track_key,
    firmwareAutoCheckEnabled: item.firmware_auto_check_enabled,
    currentFirmwareVersion: item.firmware_current,
    latestFirmwareVersion: item.firmware_latest,
    firmwareUpdateAvailable: item.firmware_update_available ?? false,
    totalShots: item.total_shots,
    totalHours: item.total_hours,
    lastUsed: item.last_used,
    imageUrl: item.image_url,
    notes: item.notes,
    assignees: item.assignees,
    location: item.location,
    locationName: item.location_name,
    tags: item.tags,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

/**
 * Convert legacy camelCase equipment data to UnifiedEquipment.
 */
export function fromCamelCase(data: Record<string, unknown>): Partial<UnifiedEquipment> {
  return {
    id: data.id as number | string,
    user_id: (data.userId ?? data.user_id) as string | undefined,
    project_id: (data.projectId ?? data.project_id) as string | null | undefined,
    name: (data.name ?? `${data.brand || ''} ${data.model || ''}`.trim()) as string,
    brand: data.brand as string,
    model: data.model as string,
    category: normalizeCategoryKey((data.category ?? data.equipmentType) as string),
    serial_number: (data.serialNumber ?? data.serial_number) as string | undefined,
    description: data.description as string | undefined,
    status: (data.status ?? (data.isActive === false ? 'retired' : 'available')) as EquipmentStatus,
    condition: (data.condition ?? 'good') as EquipmentCondition,
    purchase_date: (data.purchaseDate ?? data.purchase_date) as string | undefined,
    purchase_price: (data.purchasePrice ?? data.purchase_price) as number | undefined,
    firmware_current: (data.firmwareCurrent ?? data.firmware_current ?? data.currentFirmwareVersion) as string | undefined,
    firmware_track_key: (data.firmwareTrackKey ?? data.firmware_track_key) as string | undefined,
    firmware_auto_check_enabled: (data.firmwareAutoCheckEnabled ?? data.firmware_auto_check_enabled) as boolean | undefined,
    firmware_latest: (data.latestFirmwareVersion ?? data.firmware_latest) as string | undefined,
    firmware_update_available: (data.firmwareUpdateAvailable ?? data.firmware_update_available) as boolean | undefined,
    total_shots: (data.totalShots ?? data.total_shots) as number | undefined,
    total_hours: (data.totalHours ?? data.total_hours) as number | undefined,
    last_used: (data.lastUsed ?? data.last_used) as string | undefined,
    image_url: (data.imageUrl ?? data.image_url) as string | undefined,
    notes: data.notes as string | undefined,
    created_at: (data.createdAt ?? data.created_at) as string | undefined,
    updated_at: (data.updatedAt ?? data.updated_at) as string | undefined,
  };
}
