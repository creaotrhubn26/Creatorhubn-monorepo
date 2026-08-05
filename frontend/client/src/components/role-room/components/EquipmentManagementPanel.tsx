import { useState, useMemo, useEffect, useId, useRef, useCallback, type ChangeEvent, type DragEvent, type SyntheticEvent, type HTMLAttributes } from "react";
import { Box, Alert, Autocomplete, Typography, Button, IconButton, Card, CardContent, CardMedia, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Stack, Grid, Tooltip, Collapse, FormControl, FormControlLabel, InputLabel, Select, MenuItem, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Paper, useTheme, useMediaQuery, Grow, InputAdornment, LinearProgress, CircularProgress, Tabs, Tab, ImageList, ImageListItem, ImageListItemBar, Divider, Rating } from "@mui/material";
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon, FilterList as FilterIcon, ViewModule as GridViewIcon, ViewList as TableViewIcon, Close as CloseIcon, Cancel as CancelIcon, Save as SaveIcon, Image as ImageIcon, Person as PersonIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon, Schedule as ScheduleIcon, Block as BlockIcon, Refresh as RefreshIcon, ContentCopy as CopyIcon, Bookmark as BookmarkIcon, ShoppingCart as ShoppingCartIcon, OpenInNew as OpenInNewIcon, PlaylistAdd as PlaylistAddIcon, Star as StarIcon, StarBorder as StarBorderIcon, CloudUpload as CloudUploadIcon, Link as LinkIcon, PhotoLibrary as PhotoLibraryIcon, Movie as MovieIcon, History as HistoryIcon, CalendarToday as CalendarTodayIcon, QrCode as QrCodeIcon, QrCodeScanner as QrCodeScannerIcon, Inventory2 as Inventory2Icon, FileDownload as DownloadIcon, FileUpload as UploadIcon, FileCopy as DuplicateIcon, SelectAll as SelectAllIcon, CheckBox as CheckboxIcon, CheckBoxOutlineBlank as CheckboxOutlineIcon, Public as PublicIcon, Lock as LockIcon, Assignment as CheckOutIcon, AssignmentReturn as CheckInIcon, Summarize as ReportIcon, WifiOff as OfflineIcon, Sync as SyncIcon, AssignmentLate as MissingItemIcon, TrendingUp as TrendingUpIcon, Update as UpdateIcon, Newspaper as NewspaperIcon, AttachMoney as AttachMoneyIcon, Build as MaintenanceIcon, Warehouse as WarehouseIcon } from "@mui/icons-material";
import { EquipmentIcon as BuildIcon, LocationsIcon as LocationIcon, PropsIcon } from "./icons/CastingIcons";
import netflixWordmark from "../../../assets/brands/netflix-wordmark.svg";
import { useQuery } from "@tanstack/react-query";
import EquipmentCatalogBrowser, { type CatalogEquipment } from "../../equipment/EquipmentCatalogBrowser";
import FirmwareManagementInterface from "../../equipment/FirmwareManagementInterface";
import { useAuth } from "../../../hooks/useAuth";
import { useT } from "../../../i18n";
import { apiRequest } from "../../../lib/queryClient";
import { equipmentApi, equipmentBookingsApi, equipmentAvailabilityApi, equipmentConflictsApi, equipmentCheckoutApi, crewApi, locationsApi, equipmentTemplatesApi, vendorLinksApi, type Equipment, type EquipmentBooking, type EquipmentAvailability, type EquipmentConflict, type EquipmentCheckout, type CastingCrew, type CastingLocation, type EquipmentTemplate, type EquipmentTemplateItem, type VendorLink } from "../services/castingApiService";
import { roleRoomAnalytics } from "../services/roleRoomAnalytics";
import { useToast } from "./ToastStack";
import { equipmentCategoriesService } from "../services/equipmentCategoriesService";
import { RoleRoomEmptyState } from "./icons/RoleRoomEmptyState";
import equipPng from "./icons/Keep/roleroom_equip.png";
import WarehouseInventoryDialog, { type WarehouseDialogItem } from "./shared/WarehouseInventoryDialog";
import warehouseInventoryService from "../services/warehouseInventoryService";
import QrCameraScanner from "./shared/QrCameraScanner";
import globalTagService from "../services/globalTagService";
import GlobalMentionHelper from "./shared/GlobalMentionHelper";
import { TOUCH_TARGET_SIZE } from "../constants/accessibility";
import { RoleStatPillRow } from "./primitives";

const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #9333ea',
    outlineOffset: 2,
  },
};

const formatEquipmentNoteTimestamp = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const OPEN_PROP_CREATE_MODAL_EVENT = 'role-room:open-prop-create-modal';

type SortField = 'name' | 'category' | 'status' | 'condition' | 'quantity' | 'created_at' | 'updated_at';

const SORT_FIELD_LABELS: Record<SortField, string> = {
  name: 'Navn',
  category: 'Kategori',
  status: 'Status',
  condition: 'Tilstand',
  quantity: 'Antall',
  created_at: 'Lagt til',
  updated_at: 'Sist endret',
};
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type WorkspaceView = 'standard' | 'pro';
type EquipmentProFocus = 'all' | 'overview' | 'risks' | 'operations' | 'catalog';
type ProActionSeverity = 'low' | 'medium' | 'high';
type EquipmentProActionId =
  | 'missing-owners'
  | 'maintenance'
  | 'warehouse'
  | 'offline-sync'
  | 'catalog-sync';

interface EquipmentProActionItem {
  id: EquipmentProActionId;
  title: string;
  detail: string;
  focus: EquipmentProFocus;
  severity: ProActionSeverity;
}

// ── Bridge: data shapes from external database APIs ───────────────────────────
interface GearNewsArticle {
  id?: string;
  title: string;
  summary?: string;
  category?: string;
  brand?: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  rating?: number;
  price?: string;
  isNew?: boolean;
  isTrending?: boolean;
}
interface GearNewsResponse {
  success?: boolean;
  data?: GearNewsArticle[];
}
interface MarketEquipmentItem {
  id: string;
  brand: string;
  model: string;
  category: string;
  currentPrice?: string;
  msrp?: string;
  availability?: string;
  photographerRating?: string;
  videographerRating?: string;
  sourceUrl?: string;
}
interface LensItem {
  id: string;
  brand: string;
  model: string;
  focalLength?: string;
  aperture?: string;
  mount?: string;
  lensType?: string;
  imageStabilization?: boolean;
  weatherSealing?: boolean;
  weight?: string;
  currentPrice?: string;
}

type CameraCatalogType = 'photo' | 'video';

interface CameraSourceMeta {
  source?: string;
  lastSeenAt?: string;
  isDeprecated?: boolean;
  version?: number;
}

interface CameraRecord {
  id: string;
  externalId?: string;
  source?: string;
  type: CameraCatalogType;
  brand: string;
  model: string;
  category: string;
  isNetflixCertified?: boolean;
  description?: string;
  priceRange?: string;
  features?: string[];
  logFormats?: string[];
  resolution?: string[];
  frameRates?: string[];
  videoResolution?: string[];
  videoFrameRates?: string[];
  videoCodecs?: string[];
  mount?: string;
  sensorSize?: string;
  releaseDate?: string;
  lastSeenAt?: string;
  specs?: Record<string, unknown>;
  sourceMeta?: CameraSourceMeta;
}

interface CameraCatalogResponse {
  data?: CameraRecord[];
  results?: CameraRecord[];
  cameras?: CameraRecord[];
}

const normalizeCameraIdentity = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const getCameraSourceKey = (camera: CameraRecord): string =>
  normalizeCameraIdentity(camera.sourceMeta?.source || camera.source || '');

const CAMERA_SOURCE_PRIORITY: Record<string, number> = {
  database: 100,
  'database-sync': 95,
  release_registry: 90,
  'release-registry': 90,
  manual: 85,
  world: 80,
  seed: 70,
  api: 60,
  discovery: 40,
};

const VERIFIED_CAMERA_SPEC_SOURCES = new Set([
  'database',
  'database-sync',
  'release_registry',
  'release-registry',
  'manual',
]);

const hasTrustedCameraSpecs = (camera: CameraRecord): boolean => {
  const sourceKey = getCameraSourceKey(camera);
  if (!VERIFIED_CAMERA_SPEC_SOURCES.has(sourceKey)) return false;
  if (camera.sourceMeta?.isDeprecated) return false;

  const hasCoreIdentity =
    normalizeCameraIdentity(camera.brand).length > 0 &&
    normalizeCameraIdentity(camera.model).length > 0;

  const hasSpecPayload =
    Boolean(camera.sensorSize) ||
    Boolean(camera.mount) ||
    Boolean(camera.releaseDate) ||
    Boolean(camera.videoResolution?.length) ||
    Boolean(camera.resolution?.length) ||
    Boolean(camera.videoFrameRates?.length) ||
    Boolean(camera.frameRates?.length) ||
    Boolean(camera.videoCodecs?.length) ||
    Boolean(camera.logFormats?.length) ||
    Object.keys(camera.specs ?? {}).length > 0;

  return hasCoreIdentity && hasSpecPayload;
};

const getCameraReliabilityScore = (camera: CameraRecord): number => {
  const sourceScore = CAMERA_SOURCE_PRIORITY[getCameraSourceKey(camera)] ?? 20;
  const completenessScore =
    (camera.externalId ? 8 : 0) +
    (camera.releaseDate ? 6 : 0) +
    (camera.description ? 5 : 0) +
    (camera.sensorSize ? 5 : 0) +
    (camera.mount ? 4 : 0) +
    (camera.videoResolution?.length ?? camera.resolution?.length ?? 0) +
    (camera.videoFrameRates?.length ?? camera.frameRates?.length ?? 0) +
    (camera.videoCodecs?.length ?? 0) +
    (camera.logFormats?.length ?? 0) +
    Math.min(Object.keys(camera.specs ?? {}).length, 20) +
    (camera.sourceMeta?.isDeprecated ? -12 : 0);

  const certificationScore = camera.isNetflixCertified ? 4 : 0;
  return sourceScore + completenessScore + certificationScore;
};

// cameraSpecWhitelist moved into the component as `cameraSpecWhitelist` (t()-mapped).

interface MemoryCardTypeRecord {
  id: string;
  name: string;
  fullName: string;
  category: string;
  readSpeed: number;
  writeSpeed: number;
  maxCapacity: string;
  commonCapacities: string[];
  videoClass?: string;
  uhsClass?: string;
  reliability?: string;
  priceRange?: string;
  description?: string;
}

interface MemoryCardResponse {
  data?: MemoryCardTypeRecord[];
  results?: MemoryCardTypeRecord[];
  cardTypeIds?: string[];
}

interface AudioStorageDeviceRecord {
  brand: string;
  model: string;
  category?: string;
}

interface AudioStorageDevicesResponse {
  data?: AudioStorageDeviceRecord[];
  results?: AudioStorageDeviceRecord[];
  devices?: AudioStorageDeviceRecord[];
}

const DEFAULT_CATEGORY_OPTIONS = [
  'Kamera',
  'Linse',
  'Rig',
  'Stativ',
  'Lys',
  'Lyd',
  'Optikk',
  'Strøm',
  'Transport',
  'Sikkerhet',
  'Annet',
] as const;

const getErrorStatusCode = (error: unknown): number | null => {
  if (error && typeof error === 'object') {
    const maybeStatus = (error as { status?: unknown }).status;
    if (typeof maybeStatus === 'number') {
      return maybeStatus;
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  const prefixedMatch = message.match(/^(\d{3})[:\s]/);
  if (prefixedMatch) {
    return Number(prefixedMatch[1]);
  }

  const wrappedMatch = message.match(/\((\d{3})\)\s*$/);
  if (wrappedMatch) {
    return Number(wrappedMatch[1]);
  }

  return null;
};

const isRecoverableEndpointError = (error: unknown): boolean => {
  const status = getErrorStatusCode(error);
  return status === 401 || status === 403 || status === 404;
};

const isNetworkTransportError = (error: unknown): boolean => {
  const status = getErrorStatusCode(error);
  if (typeof status === 'number') return false;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /(failed to fetch|networkerror|err_connection_refused|fetch failed|load failed)/i.test(message);
};

const blurFocusedElement = () => {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
};

const stringifySpecValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const dedupeLabels = (values: string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  values.forEach((rawValue) => {
    const label = rawValue.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const normalized = label.toLowerCase();
    if (!label || seen.has(normalized)) return;
    seen.add(normalized);
    unique.push(label);
  });

  return unique;
};

// statusLabels moved into the component as `statusLabels` (t()-mapped).

const STATUS_COLORS: Record<string, string> = {
  available: '#4caf50',
  in_use: '#2196f3',
  maintenance: '#ff9800',
  retired: '#9e9e9e',
};

// conditionLabels moved into the component as `conditionLabels` (t()-mapped).

const CONDITION_COLORS: Record<string, string> = {
  excellent: '#4caf50',
  good: '#8bc34a',
  fair: '#ff9800',
  poor: '#f44336',
  needs_repair: '#d32f2f',
};

const CATALOG_BRIDGE_CARD_GAP = { xs: 1.5, md: 2 };

const CATALOG_BRIDGE_CARD_SX = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(155deg, rgba(2,6,23,0.84) 0%, rgba(15,23,42,0.74) 52%, rgba(30,41,59,0.62) 100%)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 2,
  boxShadow: '0 10px 24px rgba(2,6,23,0.26)',
  transition: 'all 0.26s ease',
  '&:hover': {
    borderColor: 'rgba(125,211,252,0.38)',
    boxShadow: '0 14px 30px rgba(2,6,23,0.38)',
    transform: 'translateY(-2px)',
  },
};

const CATALOG_BRIDGE_SURFACE_SX = {
  p: 2.5,
  background: 'linear-gradient(150deg, rgba(2,6,23,0.74) 0%, rgba(15,23,42,0.64) 100%)',
  border: '1px solid rgba(148,163,184,0.22)',
  borderRadius: 2,
  boxShadow: '0 10px 24px rgba(2,6,23,0.24)',
};

const CATALOG_BRIDGE_TAB_PANEL_SX = {
  p: { xs: 2, md: 3 },
  m: { xs: 1.5, md: 2 },
  borderRadius: 2.5,
  border: '1px solid rgba(148,163,184,0.2)',
  background: 'linear-gradient(155deg, rgba(2,6,23,0.56) 0%, rgba(15,23,42,0.44) 55%, rgba(30,41,59,0.34) 100%)',
  boxShadow: '0 12px 28px rgba(2,6,23,0.26)',
};

type RoleRoomDialogAccent =
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'violet'
  | 'teal';

const ROLE_ROOM_DIALOG_ACCENTS: Record<RoleRoomDialogAccent, {
  headerGradient: string;
  iconGradient: string;
  iconBorder: string;
  iconShadow: string;
}> = {
  primary: {
    headerGradient: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(109,40,217,0.1) 100%)',
    iconGradient: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
    iconBorder: '1px solid rgba(233,213,255,0.34)',
    iconShadow: '0 8px 20px rgba(147,51,234,0.3)',
  },
  info: {
    headerGradient: 'linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(30,136,229,0.1) 100%)',
    iconGradient: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
    iconBorder: '1px solid rgba(147,197,253,0.34)',
    iconShadow: '0 8px 20px rgba(33,150,243,0.3)',
  },
  success: {
    headerGradient: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
    iconGradient: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
    iconBorder: '1px solid rgba(134,239,172,0.34)',
    iconShadow: '0 8px 20px rgba(76,175,80,0.3)',
  },
  warning: {
    headerGradient: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(245,124,0,0.1) 100%)',
    iconGradient: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
    iconBorder: '1px solid rgba(250,204,21,0.34)',
    iconShadow: '0 8px 20px rgba(147,51,234,0.3)',
  },
  danger: {
    headerGradient: 'linear-gradient(135deg, rgba(244,67,54,0.15) 0%, rgba(211,47,47,0.1) 100%)',
    iconGradient: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
    iconBorder: '1px solid rgba(252,165,165,0.34)',
    iconShadow: '0 8px 20px rgba(244,67,54,0.3)',
  },
  violet: {
    headerGradient: 'linear-gradient(135deg, rgba(156,39,176,0.15) 0%, rgba(142,36,170,0.1) 100%)',
    iconGradient: 'linear-gradient(135deg, #9c27b0 0%, #8e24aa 100%)',
    iconBorder: '1px solid rgba(221,214,254,0.32)',
    iconShadow: '0 8px 20px rgba(156,39,176,0.3)',
  },
  teal: {
    headerGradient: 'linear-gradient(135deg, rgba(0,150,136,0.15) 0%, rgba(0,137,123,0.1) 100%)',
    iconGradient: 'linear-gradient(135deg, #009688 0%, #00897b 100%)',
    iconBorder: '1px solid rgba(94,234,212,0.32)',
    iconShadow: '0 8px 20px rgba(0,150,136,0.3)',
  },
};

const getRoleRoomDialogTitleSx = (
  accent: RoleRoomDialogAccent,
  align: 'center' | 'space-between' = 'space-between'
) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: align,
  borderBottom: '1px solid rgba(148,163,184,0.22)',
  background: ROLE_ROOM_DIALOG_ACCENTS[accent].headerGradient,
  color: '#fff',
  py: 2,
  px: 3,
});

const getRoleRoomDialogIconSx = (accent: RoleRoomDialogAccent, size = 44) => ({
  width: size,
  height: size,
  borderRadius: 2,
  background: ROLE_ROOM_DIALOG_ACCENTS[accent].iconGradient,
  border: ROLE_ROOM_DIALOG_ACCENTS[accent].iconBorder,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: ROLE_ROOM_DIALOG_ACCENTS[accent].iconShadow,
  flexShrink: 0,
});

const ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX = {
  ...focusVisibleStyles,
  bgcolor: 'rgba(255,255,255,0.05)',
  color: 'rgba(226,232,240,0.86)',
  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' },
};

const TRUSTED_VENDOR_PRICE_MAX_AGE_DAYS = 14;

const isVendorPriceFresh = (link: VendorLink): boolean => {
  if (typeof link.price !== 'number' || !Number.isFinite(link.price) || link.price <= 0) return false;
  if (!link.updated_at) return false;
  const updatedAt = new Date(link.updated_at).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  const ageMs = Date.now() - updatedAt;
  return ageMs >= 0 && ageMs <= TRUSTED_VENDOR_PRICE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
};



const SHOP_VENDOR_FALLBACK_LINKS: VendorLink[] = [
  {
    id: 'fallback-foto-sony-fx6',
    category: 'Kamera',
    subcategory: 'Cinema',
    vendor_name: 'Foto.no',
    product_name: 'Sony FX6',
    product_url: 'https://www.foto.no/sony/134753/sony-fx6-full-frame-cinema-camera-4k-35mm-cinema-kamera',
    description: 'Fullformat cine-kamera for dokumentar og kommersiell produksjon.',
    is_recommended: true,
    sort_order: 1,
  },
  {
    id: 'fallback-foto-bmpcc-6k-pro',
    category: 'Kamera',
    subcategory: 'Cinema',
    vendor_name: 'Foto.no',
    product_name: 'Blackmagic Pocket Cinema Camera 6K Pro',
    product_url: 'https://www.foto.no/blackmagic-design/137181/blackmagic-pocket-cinema-camera-6k-pro-ef-6k-inkludert-davinci-resolve-program',
    description: 'Super 35 cine-kamera med innebygde ND-filtre.',
    is_recommended: true,
    sort_order: 2,
  },
  {
    id: 'fallback-foto-canon-c80',
    category: 'Kamera',
    subcategory: 'Cinema',
    vendor_name: 'Foto.no',
    product_name: 'Canon EOS C80',
    product_url: 'https://www.foto.no/canon/164510/canon-eos-c80-kamerahus-6k-bsi-fullformat-cine-kamera',
    description: 'Kompakt RF cinema-kamera for profesjonelle produksjoner.',
    is_recommended: true,
    sort_order: 3,
  },
  {
    id: 'fallback-foto-dji-rs4-pro',
    category: 'Video',
    subcategory: 'Stabilisering',
    vendor_name: 'Foto.no',
    product_name: 'DJI RS 4 Pro',
    product_url: 'https://www.foto.no/dji/161503/dji-rs-4-pro-combo',
    description: 'Gimbal for større kameraoppsett og cinelook.',
    is_recommended: true,
    sort_order: 4,
  },
  {
    id: 'fallback-foto-amaran-300c',
    category: 'Lys',
    subcategory: 'LED',
    vendor_name: 'Foto.no',
    product_name: 'amaran 300c RGBWW',
    product_url: 'https://www.foto.no/amaran/155253/amaran-300c-led-lampe-300w-2500-7500k-fullfarge-rgb-led',
    description: 'Fleksibelt RGB-lys for intervju og content-produksjon.',
    is_recommended: true,
    sort_order: 5,
  },
  {
    id: 'fallback-foto-aputure-600d-pro',
    category: 'Lys',
    subcategory: 'LED',
    vendor_name: 'Foto.no',
    product_name: 'Aputure LS 600d Pro',
    product_url: 'https://www.foto.no/aputure/134866/aputure-ls-600d-pro-dagslys-5600k-v-mount',
    description: 'Kraftig daylight-armatur til kommersiell produksjon.',
    is_recommended: true,
    sort_order: 6,
  },
  {
    id: 'fallback-foto-rode-wireless-pro',
    category: 'Lyd',
    subcategory: 'Trådløs',
    vendor_name: 'Foto.no',
    product_name: 'Rode Wireless PRO',
    product_url: 'https://www.foto.no/r%c3%b8de/157955/r%c3%b8de-wireless-pro-tr%c3%a5dl%c3%b8st-mikrofonsystem-2-x-tx-1-x-rx',
    description: 'Trådløst lydsystem med intern opptakssikring.',
    is_recommended: true,
    sort_order: 7,
  },
  {
    id: 'fallback-foto-zoom-f3',
    category: 'Lyd',
    subcategory: 'Opptaker',
    vendor_name: 'Foto.no',
    product_name: 'Zoom F3',
    product_url: 'https://www.foto.no/zoom/143196/zoom-f3-multispor-feltopptager-2-kanals-opptager',
    description: 'Kompakt 32-bit float-opptaker for location-lyd.',
    is_recommended: true,
    sort_order: 8,
  },
];

const getVendorHomepage = (_vendorName: string): string => {
  return 'https://www.foto.no/';
};

const getVendorSearchUrl = (_vendorName: string, productName: string): string => {
  const query = encodeURIComponent(productName.trim());
  return `https://www.foto.no/search?q=${query}`;
};

const sanitizeVendorLinks = (links: VendorLink[]): VendorLink[] =>
  links
    .map((link, index) => {
      const productUrl = String(link.product_url ?? '').trim();
      const affiliateUrl = String(link.affiliate_url ?? '').trim();
      const imageUrl = String(link.image_url ?? '').trim();
      const vendorName = 'Foto.no';
      const productName = String(link.product_name ?? '').trim();
      const category = String(link.category ?? '').trim() || 'Diverse';
      const hasPlaceholderProductUrl = productUrl.length === 0 || /example\.com/i.test(productUrl);
      const hasPlaceholderAffiliateUrl = affiliateUrl.length === 0 || /example\.com/i.test(affiliateUrl);
      const hasFotoProductUrl = /(^https?:\/\/)?([^\/]+\.)?foto\.no(\/|$)/i.test(productUrl);
      const hasFotoAffiliateUrl = /(^https?:\/\/)?([^\/]+\.)?foto\.no(\/|$)/i.test(affiliateUrl);
      const sanitizedProductUrl = hasPlaceholderProductUrl
        ? (productName.length > 0 ? getVendorSearchUrl(vendorName, productName) : getVendorHomepage(vendorName))
        : (hasFotoProductUrl
          ? productUrl
          : (productName.length > 0 ? getVendorSearchUrl(vendorName, productName) : getVendorHomepage(vendorName)));
      const sanitizedAffiliateUrl =
        hasPlaceholderAffiliateUrl || !hasFotoAffiliateUrl ? undefined : affiliateUrl;
      const sanitizedImageUrl =
        imageUrl.length > 0 && !/placehold\.co|example\.com/i.test(imageUrl) ? imageUrl : undefined;

      return {
        ...link,
        id: String(link.id ?? '').trim() || `vendor-link-${index}`,
        vendor_name: vendorName,
        product_name: productName,
        category,
        product_url: sanitizedProductUrl,
        affiliate_url: sanitizedAffiliateUrl,
        image_url: sanitizedImageUrl,
      };
    })
    .filter((link) => link.product_name.length > 0);

const isProfessionalShopLink = (link: VendorLink): boolean => {
  const category = String(link.category ?? '').trim().toLowerCase();
  const subcategory = String(link.subcategory ?? '').trim().toLowerCase();
  const name = String(link.product_name ?? '').trim().toLowerCase();
  const cineSignals = /(cine|cinema|fx3|fx6|fx9|c70|c80|komodo|ursa|venice|varicam|pocket cinema|bmpcc)/;

  if (category === 'lyd' || category === 'lys') return true;
  if (category === 'video') return true;
  if (category === 'kamera') return cineSignals.test(`${subcategory} ${name}`);
  return false;
};

const buildVendorCategoryCounts = (links: VendorLink[]): { category: string; count: number }[] => {
  const counts = new Map<string, number>();
  links.forEach((link) => {
    const key = String(link.category ?? '').trim();
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category, 'nb'));
};

interface EquipmentManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
  externalCreateSignal?: number;
  onExternalCreated?: (equipment: Equipment) => void;
  onExternalCreateCancelled?: () => void;
}

export function EquipmentManagementPanel({
  projectId,
  onUpdate,
  externalCreateSignal,
  onExternalCreated,
  onExternalCreateCancelled,
}: EquipmentManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;

  const { showSuccess, showError } = useToast();
  const { t } = useT();
  const statusLabels = useMemo<Record<string, string>>(() => ({
    available: t('equip.status.available'),
    in_use: t('equip.status.inUse'),
    maintenance: t('equip.status.maintenance'),
    retired: t('equip.status.retired'),
  }), [t]);
  const conditionLabels = useMemo<Record<string, string>>(() => ({
    excellent: t('equip.cond.excellent'),
    good: t('equip.cond.good'),
    fair: t('equip.cond.fair'),
    poor: t('equip.cond.poor'),
    needs_repair: t('equip.cond.needsRepair'),
  }), [t]);
  const cameraSpecWhitelist = useMemo<Record<string, string>>(() => ({
    sensorSize: t('equip.spec.sensor'),
    mount: t('equip.spec.mount'),
    releaseDate: t('equip.spec.release'),
    priceRange: t('equip.spec.priceRange'),
    videoResolution: t('equip.spec.resolution'),
    resolution: t('equip.spec.resolution'),
    videoFrameRates: t('equip.spec.frameRate'),
    frameRates: t('equip.spec.frameRate'),
    videoCodecs: t('equip.spec.codec'),
    logFormats: t('equip.spec.logFormat'),
    features: t('equip.spec.features'),
    dynamicRange: t('equip.spec.dynamicRange'),
    internalRecording: t('equip.spec.internalRecording'),
    recordingFormats: t('equip.spec.recordingFormats'),
    rawRecording: t('equip.spec.rawRecording'),
    mediaTypes: t('equip.spec.mediaTypes'),
    bitDepth: t('equip.spec.bitDepth'),
    chromaSubsampling: t('equip.spec.chromaSubsampling'),
    isoRange: t('equip.spec.iso'),
    stabilization: t('equip.spec.stabilization'),
    autofocus: t('equip.spec.autofocus'),
    maxRecordingTime: t('equip.spec.maxRecordingTime'),
  }), [t]);

  const baseId = useId();
  const dialogTitleId = `${baseId}-dialog-title`;

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  // Pagination — 324 elementer uten paginering er reell perf-issue
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<20 | 40 | 80>(20);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('standard');
  const [proViewFocus, setProViewFocus] = useState<EquipmentProFocus>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterOpen, setFilterOpen] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const externalCreateSignalRef = useRef(0);
  const externalCreatePendingRef = useRef(false);
  const [createTypeDialogOpen, setCreateTypeDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    brand: '',
    model: '',
    serialNumber: '',
    quantity: 1,
    condition: 'good' as Equipment['condition'],
    primaryLocationId: '',
    notes: '',
    notesAuthorName: '',
    notesAuthorId: '',
    notesUpdatedAt: '',
    imageUrl: '',
    status: 'available' as Equipment['status'],
    isGlobal: false, // If true, equipment is available across all projects
  });
  const [brandInputValue, setBrandInputValue] = useState('');
  const [modelInputValue, setModelInputValue] = useState('');
  const [brandShouldSuggest, setBrandShouldSuggest] = useState(false);
  const [modelShouldSuggest, setModelShouldSuggest] = useState(false);
  const [cameraSpecsExpanded, setCameraSpecsExpanded] = useState(false);

  // Image picker state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTab, setImagePickerTab] = useState(0);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState<Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    description?: string;
    photographer?: string;
    source: 'unsplash' | 'pexels' | 'shotcafe' | 'pixabay' | 'openverse' | 'wikimedia';
  }>>([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  // Ekte produktbilde-forslag (Wikimedia Commons) for auto-bilde ved add.
  const [equipmentImageSuggestions, setEquipmentImageSuggestions] = useState<Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    description: string;
  }>>([]);
  const [equipmentImageLoading, setEquipmentImageLoading] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchControllerRef = useRef<AbortController | null>(null);

  const [crewMembers, setCrewMembers] = useState<CastingCrew[]>([]);
  const [locations, setLocations] = useState<CastingLocation[]>([]);
  const mentionCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...crewMembers.map((member) => member.name),
            ...locations.map((location) => location.name),
            ...equipment.map((item) => item.name),
            formData.brand,
            formData.model,
          ]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length >= 2),
        ),
      ),
    [crewMembers, equipment, formData.brand, formData.model, locations],
  );
  const applyMentionSuggestion = useCallback((sourceText: string | undefined, name: string): string => {
    const current = typeof sourceText === 'string' ? sourceText : '';
    if (!current.trim()) return name;
    const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
    return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
  }, []);
  const seedGlobalMentions = useCallback(
    (texts: Array<string | undefined>, extraTags: string[] = []) => {
      const seed = [
        ...extraTags,
        ...texts.flatMap((text) =>
          typeof text === 'string' ? globalTagService.parseExplicitMentions(text) : [],
        ),
      ]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length >= 2);
      if (seed.length === 0) return;
      void globalTagService.add(seed).catch((error) => {
        console.warn('Kunne ikke oppdatere globalt mention-register for utstyr:', error);
      });
    },
    [],
  );
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedEquipmentForAssign, setSelectedEquipmentForAssign] = useState<Equipment | null>(null);
  const [selectedCrewId, setSelectedCrewId] = useState('');
  const [bulkAssignCrewId, setBulkAssignCrewId] = useState('');

  const [bookingsDialogOpen, setBookingsDialogOpen] = useState(false);
  const [selectedEquipmentBookings, setSelectedEquipmentBookings] = useState<Equipment | null>(null);
  const [bookings, setBookings] = useState<EquipmentBooking[]>([]);
  const [availability, setAvailability] = useState<EquipmentAvailability[]>([]);

  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EquipmentTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    category: '',
    use_case: '',
    is_global: false,
    items: [] as Partial<EquipmentTemplateItem>[],
  });
  const [shopDialogOpen, setShopDialogOpen] = useState(false);
  const [vendorLinks, setVendorLinks] = useState<VendorLink[]>([]);
  const [vendorCategories, setVendorCategories] = useState<{ category: string; count: number }[]>([]);
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('all');
  const fallbackVendorLinks = useMemo(() => {
    if (selectedVendorCategory === 'all') return SHOP_VENDOR_FALLBACK_LINKS;
    const normalizedCategory = selectedVendorCategory.trim().toLowerCase();
    return SHOP_VENDOR_FALLBACK_LINKS.filter(
      (link) => String(link.category ?? '').trim().toLowerCase() === normalizedCategory
    );
  }, [selectedVendorCategory]);
  const effectiveVendorLinks = useMemo(() => {
    const apiVendorLinks = sanitizeVendorLinks(vendorLinks).filter(isProfessionalShopLink);
    const professionalFallbackLinks = fallbackVendorLinks.filter(isProfessionalShopLink);
    const baseLinks = apiVendorLinks.length > 0 ? apiVendorLinks : professionalFallbackLinks;
    const withRecommendations = baseLinks.some((link) => link.is_recommended)
      ? baseLinks
      : baseLinks.map((link, index) => ({ ...link, is_recommended: index < 6 }));

    if (withRecommendations.length >= 6) return withRecommendations.slice(0, 12);

    const seen = new Set(
      withRecommendations.map((link) => `${link.vendor_name.toLowerCase()}::${link.product_name.toLowerCase()}`)
    );
    const extras = professionalFallbackLinks.filter(
      (link) => !seen.has(`${link.vendor_name.toLowerCase()}::${link.product_name.toLowerCase()}`)
    );
    return [...withRecommendations, ...extras].slice(0, 12);
  }, [vendorLinks, fallbackVendorLinks]);
  const effectiveVendorCategories = useMemo(() => {
    const allowedCategories = buildVendorCategoryCounts(effectiveVendorLinks);
    const allowedSet = new Set(allowedCategories.map((entry) => entry.category.toLowerCase()));
    const sourceCategories = vendorCategories.length > 0 ? vendorCategories : allowedCategories;
    return sourceCategories.filter((entry) => allowedSet.has(entry.category.toLowerCase()));
  }, [vendorCategories, effectiveVendorLinks]);
  const recommendedVendorLinks = useMemo(() => {
    const recommended = effectiveVendorLinks.filter((link) => link.is_recommended);
    return (recommended.length > 0 ? recommended : effectiveVendorLinks).slice(0, 12);
  }, [effectiveVendorLinks]);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Load custom categories on mount
  useEffect(() => {
    equipmentCategoriesService.getCustomCategories(projectId).then(setCustomCategories);
  }, [projectId]);

  const serialNumberScanFormats = useMemo(
    () => ['code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'qr_code'],
    []
  );

  // Combined categories (default + custom)
  const allCategories = [...DEFAULT_CATEGORY_OPTIONS, ...customCategories];

  useEffect(() => {
    if (dialogOpen) {
      setBrandInputValue(formData.brand || '');
      setModelInputValue(formData.model || '');
      return;
    }

    setBrandInputValue('');
    setModelInputValue('');
    setBrandShouldSuggest(false);
    setCameraSpecsExpanded(false);
    setModelShouldSuggest(false);
  }, [dialogOpen, formData.brand, formData.model]);


  // === NEW WORKFLOW FEATURES ===
  
  // Delete confirmation dialog (replacing browser confirm)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  
  // Bulk operations
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'delete' | 'status' | 'assign'>('delete');
  const [bulkNewStatus, setBulkNewStatus] = useState<Equipment['status']>('available');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Favoritter — samme persistens-mønster som PropManagementPanel.
  // favoritesApi.get/set lagrer til DB; localStorage er fallback hvis API
  // er nede. Reload på projectId-bytte slik at hvert prosjekt har sin egen
  // favoritt-liste.
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'equipment');
        if (cancelled) return;
        if (dbFavorites.length > 0) {
          setFavorites(new Set(dbFavorites));
          return;
        }
      } catch (error) {
        console.warn('Equipment favorites: DB-oppslag feilet, faller tilbake til localStorage', error);
      }
      const saved = localStorage.getItem(`equipment-favorites-${projectId}`);
      if (!cancelled && saved) {
        try {
          setFavorites(new Set(JSON.parse(saved)));
        } catch {
          /* ignore corrupt JSON */
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    const save = async () => {
      localStorage.setItem(`equipment-favorites-${projectId}`, JSON.stringify([...favorites]));
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        await favoritesApi.set(projectId, 'equipment', [...favorites]);
      } catch (error) {
        console.warn('Equipment favorites: DB-lagring feilet (localStorage er fortsatt oppdatert)', error);
      }
    };
    if (favorites.size > 0 || localStorage.getItem(`equipment-favorites-${projectId}`)) {
      save();
    }
  }, [favorites, projectId]);

  const toggleEquipmentFavorite = useCallback((equipmentId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(equipmentId)) next.delete(equipmentId);
      else next.add(equipmentId);
      return next;
    });
  }, []);

  // Catalog bridge — browse manufacturer catalog and import items into this project
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const noteActorLabel = useMemo(() => {
    const raw = user?.displayName ?? user?.name ?? user?.email;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : t('equip.unknownUser');
  }, [user, t]);
  const noteActorId = user?.id !== undefined && user?.id !== null ? String(user.id) : undefined;
  const hasProtectedRoleRoomAccess = Boolean(projectId) && isAuthenticated && !authLoading;
  const [roleRoomApiUnavailable, setRoleRoomApiUnavailable] = useState(false);
  const [vendorLinksUnavailable, setVendorLinksUnavailable] = useState(false);
  const [gearNewsUnavailable, setGearNewsUnavailable] = useState(false);
  const [marketPricesUnavailable, setMarketPricesUnavailable] = useState(false);
  const [lensDbUnavailable, setLensDbUnavailable] = useState(false);
  const [cameraCatalogUnavailable, setCameraCatalogUnavailable] = useState(false);
  const [memoryCardsUnavailable, setMemoryCardsUnavailable] = useState(false);
  const [equipmentPollPauseUntil, setEquipmentPollPauseUntil] = useState(0);
  // Read inside the 30s poll closure via a ref so the poll effect doesn't list
  // it as a dependency — otherwise pausing the poll (which sets this) tore down
  // and recreated the interval + re-bound the online/offline listeners.
  const equipmentPollPauseUntilRef = useRef(equipmentPollPauseUntil);
  equipmentPollPauseUntilRef.current = equipmentPollPauseUntil;
  const lastTransportErrorToastAtRef = useRef(0);
  const [cameraSyncing, setCameraSyncing] = useState(false);
  const [catalogBridgeOpen, setCatalogBridgeOpen] = useState(false);
  // Active sub-tab inside the catalog bridge dialog (0=catalog, 1=news, 2=market, 3=lenses, 4=cameras/cards)
  const [catalogDialogTab, setCatalogDialogTab] = useState(0);
  const [cameraCatalogType, setCameraCatalogType] = useState<'all' | CameraCatalogType>('all');
  const [cameraCatalogSearch, setCameraCatalogSearch] = useState('');
  const [cameraBrandFilter, setCameraBrandFilter] = useState('all');
  const [cameraNetflixOnly, setCameraNetflixOnly] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  // Firmware panel — manage firmware updates for this project's equipment
  const [firmwarePanelOpen, setFirmwarePanelOpen] = useState(false);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [warehouseIssueCount, setWarehouseIssueCount] = useState(0);
  const [warehouseStockByItem, setWarehouseStockByItem] = useState<
    Record<string, { quantity: number; reserved: number; available: number }>
  >({});
  const [qrLabelDialogOpen, setQrLabelDialogOpen] = useState(false);
  const [qrScanDialogOpen, setQrScanDialogOpen] = useState(false);
  const [qrTargetEquipment, setQrTargetEquipment] = useState<Equipment | null>(null);
  const [qrScanInput, setQrScanInput] = useState('');
  const [qrScanError, setQrScanError] = useState<string | null>(null);
  const [serialScanDialogOpen, setSerialScanDialogOpen] = useState(false);
  const [serialScanInput, setSerialScanInput] = useState('');
  const [serialScanError, setSerialScanError] = useState<string | null>(null);

  // ── External database data: gear news, market prices, lens database ──────────
  const { data: gearNewsRaw, isLoading: gearNewsLoading } = useQuery<GearNewsResponse>({
    queryKey: ['/api/gear-news', 'videographer'],
    enabled: catalogBridgeOpen && catalogDialogTab === 1 && !gearNewsUnavailable,
    queryFn: async () => {
      try {
        return await apiRequest('/api/gear-news?profession=videographer') as Promise<GearNewsResponse>;
      } catch (error) {
        if (isRecoverableEndpointError(error)) {
          setGearNewsUnavailable(true);
          return { data: [] };
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const gearNewsArticles: GearNewsArticle[] = gearNewsRaw?.data ?? [];

  const { data: marketRaw, isLoading: marketPricesLoading } = useQuery<MarketEquipmentItem[]>({
    queryKey: ['/api/equipment/market-prices', 'videographer'],
    enabled: catalogBridgeOpen && catalogDialogTab === 2 && !marketPricesUnavailable,
    queryFn: async () => {
      try {
        return await apiRequest('/api/equipment/market-prices?profession=videographer') as Promise<MarketEquipmentItem[]>;
      } catch (error) {
        if (isRecoverableEndpointError(error)) {
          setMarketPricesUnavailable(true);
          return [];
        }
        throw error;
      }
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const marketItems: MarketEquipmentItem[] = Array.isArray(marketRaw) ? marketRaw : [];

  const { data: lensRaw, isLoading: lensDbLoading } = useQuery<LensItem[]>({
    queryKey: ['/api/equipment/lenses', 'videographer'],
    enabled: catalogBridgeOpen && catalogDialogTab === 3 && !lensDbUnavailable,
    queryFn: async () => {
      try {
        return await apiRequest('/api/equipment/lenses?profession=videographer') as Promise<LensItem[]>;
      } catch (error) {
        if (isRecoverableEndpointError(error)) {
          setLensDbUnavailable(true);
          return [];
        }
        throw error;
      }
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const lensItems: LensItem[] = Array.isArray(lensRaw) ? lensRaw : [];

  const { data: cameraCatalogRaw, isLoading: cameraCatalogLoading, isFetching: cameraCatalogFetching, refetch: refetchCameraCatalog } = useQuery<CameraCatalogResponse | CameraRecord[]>({
    queryKey: ['/api/equipment/cameras', cameraCatalogType, cameraBrandFilter, cameraCatalogSearch, cameraNetflixOnly],
    enabled: catalogBridgeOpen && catalogDialogTab === 4 && !cameraCatalogUnavailable,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cameraCatalogType !== 'all') params.set('type', cameraCatalogType);
      if (cameraBrandFilter !== 'all') params.set('brand', cameraBrandFilter);
      if (cameraCatalogSearch.trim()) params.set('q', cameraCatalogSearch.trim());
      if (cameraNetflixOnly) params.set('netflixCertified', '1');
      try {
        return await apiRequest(`/api/equipment/cameras?${params.toString()}`) as Promise<CameraCatalogResponse>;
      } catch (error) {
        if (isRecoverableEndpointError(error)) {
          setCameraCatalogUnavailable(true);
          return { data: [] };
        }
        throw error;
      }
    },
    staleTime: 60 * 1000,
    retry: false,
  });

  const cameraCatalogItems: CameraRecord[] = useMemo(() => {
    if (Array.isArray(cameraCatalogRaw)) return cameraCatalogRaw;
    return cameraCatalogRaw?.data ?? cameraCatalogRaw?.results ?? cameraCatalogRaw?.cameras ?? [];
  }, [cameraCatalogRaw]);

  const cameraBrandOptions = useMemo(
    () =>
      Array.from(new Set(cameraCatalogItems.map((camera) => camera.brand).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'nb')
      ),
    [cameraCatalogItems]
  );

  useEffect(() => {
    if (cameraBrandFilter === 'all') return;
    if (!cameraBrandOptions.includes(cameraBrandFilter)) {
      setCameraBrandFilter('all');
    }
  }, [cameraBrandFilter, cameraBrandOptions]);

  useEffect(() => {
    if (catalogDialogTab !== 4) return;
    if (cameraCatalogItems.length === 0) {
      setSelectedCameraId('');
      return;
    }
    if (!selectedCameraId || !cameraCatalogItems.some((camera) => camera.id === selectedCameraId)) {
      setSelectedCameraId(cameraCatalogItems[0].id);
    }
  }, [catalogDialogTab, cameraCatalogItems, selectedCameraId]);

  const selectedCamera = useMemo(
    () => cameraCatalogItems.find((camera) => camera.id === selectedCameraId) ?? null,
    [cameraCatalogItems, selectedCameraId]
  );

  const { data: memoryCardsRaw, isLoading: memoryCardsLoading, refetch: refetchMemoryCards } = useQuery<MemoryCardResponse | MemoryCardTypeRecord[]>({
    queryKey: ['/api/equipment/memory-cards', selectedCameraId],
    enabled: catalogBridgeOpen && catalogDialogTab === 4 && Boolean(selectedCameraId) && !memoryCardsUnavailable,
    queryFn: async () => {
      try {
        return await apiRequest(
          `/api/equipment/memory-cards?cameraId=${encodeURIComponent(selectedCameraId)}`
        ) as Promise<MemoryCardResponse>;
      } catch (error) {
        if (isRecoverableEndpointError(error)) {
          setMemoryCardsUnavailable(true);
          return { data: [] };
        }
        throw error;
      }
    },
    staleTime: 60 * 1000,
    retry: false,
  });

  const memoryCardItems: MemoryCardTypeRecord[] = useMemo(() => {
    if (Array.isArray(memoryCardsRaw)) return memoryCardsRaw;
    return memoryCardsRaw?.data ?? memoryCardsRaw?.results ?? [];
  }, [memoryCardsRaw]);

  const { data: manufacturerCameraRaw } = useQuery<CameraCatalogResponse | CameraRecord[]>({
    queryKey: ['/api/equipment/cameras', 'manufacturer-suggestions'],
    enabled: dialogOpen,
    queryFn: async () => {
      try {
        return await apiRequest('/api/equipment/cameras?includeUndated=1') as Promise<CameraCatalogResponse>;
      } catch (error) {
        if (isRecoverableEndpointError(error)) {
          return { data: [] };
        }
        throw error;
      }
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const manufacturerCameraItems: CameraRecord[] = useMemo(() => {
    if (Array.isArray(manufacturerCameraRaw)) return manufacturerCameraRaw;
    return manufacturerCameraRaw?.data ?? manufacturerCameraRaw?.results ?? manufacturerCameraRaw?.cameras ?? [];
  }, [manufacturerCameraRaw]);

  const { data: audioStorageRaw } = useQuery<AudioStorageDevicesResponse | AudioStorageDeviceRecord[]>({
    queryKey: ['/api/equipment/audio-storage-devices', 'manufacturer-suggestions'],
    enabled: dialogOpen,
    queryFn: async () => {
      try {
        return await apiRequest('/api/equipment/audio-storage-devices?yearFrom=2020&yearTo=2026&limit=400') as Promise<AudioStorageDevicesResponse>;
      } catch (error) {
        if (isRecoverableEndpointError(error)) {
          return { data: [] };
        }
        throw error;
      }
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const audioStorageItems: AudioStorageDeviceRecord[] = useMemo(() => {
    if (Array.isArray(audioStorageRaw)) return audioStorageRaw;
    return audioStorageRaw?.data ?? audioStorageRaw?.results ?? audioStorageRaw?.devices ?? [];
  }, [audioStorageRaw]);

  const cameraCandidates = useMemo(() => {
    const merged = new Map<string, CameraRecord>();

    const getCameraKey = (camera: CameraRecord) => {
      const idKey = String(camera.id ?? '').trim().toLowerCase();
      if (idKey) return idKey;

      return [
        camera.type,
        String(camera.brand ?? '').trim().toLowerCase(),
        String(camera.model ?? '').trim().toLowerCase(),
      ].join('::');
    };

    [...cameraCatalogItems, ...manufacturerCameraItems].forEach((camera) => {
      const key = getCameraKey(camera);
      if (!key || key === '::') return;

      const existing = merged.get(key);
      if (!existing || getCameraReliabilityScore(camera) > getCameraReliabilityScore(existing)) {
        merged.set(key, camera);
      }
    });

    return Array.from(merged.values());
  }, [cameraCatalogItems, manufacturerCameraItems]);

  const categorySuggestionTokens = useMemo(() => {
    const selected = formData.category.trim().toLowerCase();
    if (!selected || selected === 'all') return [] as string[];

    const tokenMap: Record<string, string[]> = {
      kamera: ['kamera', 'camera', 'cine', 'cinema', 'mirrorless', 'dslr', 'camcorder', 'drone', 'action'],
      filmutstyr: ['kamera', 'camera', 'cine', 'cinema', 'mirrorless', 'dslr', 'camcorder', 'drone', 'action'],
      videoutstyr: ['kamera', 'camera', 'cine', 'cinema', 'camcorder', 'drone', 'action'],
      fotoutstyr: ['kamera', 'camera', 'mirrorless', 'dslr', 'lens', 'linse'],
      linse: ['linse', 'lens', 'optikk'],
      lyd: ['lyd', 'audio', 'recorder', 'microphone', 'mikrofon'],
      lydutstyr: ['lyd', 'audio', 'recorder', 'microphone', 'mikrofon'],
      lys: ['lys', 'light', 'lighting', 'flash'],
      stativ: ['stativ', 'tripod', 'support'],
      rig: ['rig', 'gimbal', 'stabilizer'],
      strøm: ['strøm', 'power', 'battery'],
      transport: ['transport', 'case', 'bag'],
      lagring: ['lagring', 'storage', 'memory', 'card', 'ssd', 'hdd', 'nas', 'cfexpress', 'sd'],
      minnekort: ['lagring', 'storage', 'memory', 'card', 'cfexpress', 'sd', 'microsd', 'cfast'],
      sikkerhet: ['sikkerhet', 'safety'],
    };

    const tokens = new Set<string>([selected]);
    Object.entries(tokenMap).forEach(([key, mapped]) => {
      if (selected.includes(key) || mapped.some((value) => selected.includes(value))) {
        mapped.forEach((value) => tokens.add(value));
      }
    });

    return Array.from(tokens);
  }, [formData.category]);

  const matchesSelectedCategory = useCallback((category?: string | null) => {
    if (categorySuggestionTokens.length === 0) return true;
    const normalized = String(category ?? '').trim().toLowerCase();
    if (!normalized) return false;
    return categorySuggestionTokens.some((token) => normalized.includes(token));
  }, [categorySuggestionTokens]);

  const manufacturerOptions = useMemo(() => {
    const cameraCategorySelected = [
      'kamera',
      'camera',
      'cine',
      'cinema',
      'filmutstyr',
      'videoutstyr',
      'fotoutstyr',
      'camcorder',
      'mirrorless',
      'dslr',
    ].some((token) => formData.category.trim().toLowerCase().includes(token));

    const brandCategories = new Map<string, Set<string>>();

    const addValue = (brand?: string | null, category?: string | null) => {
      const normalizedBrand = String(brand ?? '').trim();
      if (!normalizedBrand) return;

      const categories = brandCategories.get(normalizedBrand) ?? new Set<string>();
      const normalizedCategory = String(category ?? '').trim().toLowerCase();
      if (normalizedCategory) categories.add(normalizedCategory);
      brandCategories.set(normalizedBrand, categories);
    };

    if (cameraCategorySelected) {
      cameraCandidates.forEach((camera) => addValue(camera.brand, camera.category));
    } else {
      equipment.forEach((eq) => addValue(eq.brand, eq.category));
      cameraCandidates.forEach((camera) => addValue(camera.brand, camera.category));
      audioStorageItems.forEach((device) => addValue(device.brand, device.category));
    }

    return Array.from(brandCategories.entries())
      .filter(([, categories]) => {
        if (categorySuggestionTokens.length === 0) return true;
        if (categories.size === 0) return false;
        return Array.from(categories).some((category) => matchesSelectedCategory(category));
      })
      .map(([brand]) => brand)
      .sort((a, b) => a.localeCompare(b, 'nb'))
      .slice(0, 400);
  }, [
    equipment,
    cameraCandidates,
    audioStorageItems,
    categorySuggestionTokens,
    formData.category,
    matchesSelectedCategory,
  ]);

  const modelOptions = useMemo(() => {
    const cameraCategorySelected = [
      'kamera',
      'camera',
      'cine',
      'cinema',
      'filmutstyr',
      'videoutstyr',
      'fotoutstyr',
      'camcorder',
      'mirrorless',
      'dslr',
    ].some((token) => formData.category.trim().toLowerCase().includes(token));

    const selectedBrand = formData.brand.trim().toLowerCase();
    const modelEntries = new Map<string, string>();
    const sanitizeModelLabel = (value: string): string =>
      value
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const addModel = (brand?: string | null, model?: string | null, category?: string | null) => {
      const normalizedBrand = String(brand ?? '').trim().toLowerCase();
      const normalizedModel = sanitizeModelLabel(String(model ?? ''));
      const normalizedCategory = String(category ?? '').trim().toLowerCase();
      if (!normalizedModel) return;
      if (selectedBrand && normalizedBrand && !normalizedBrand.includes(selectedBrand)) return;
      if (!matchesSelectedCategory(normalizedCategory)) return;

      const key = `${normalizedBrand}::${normalizedModel.toLowerCase()}`;
      if (!modelEntries.has(key)) {
        modelEntries.set(key, normalizedModel);
      }
    };

    if (cameraCategorySelected) {
      cameraCandidates.forEach((camera) => addModel(camera.brand, camera.model, camera.category));
    } else {
      equipment.forEach((eq) => addModel(eq.brand, eq.model, eq.category));
      cameraCandidates.forEach((camera) => addModel(camera.brand, camera.model, camera.category));
      audioStorageItems.forEach((device) => addModel(device.brand, device.model, device.category));
    }

    const sortedModels = Array.from(modelEntries.values())
      .map((model) => sanitizeModelLabel(model))
      .sort((a, b) => a.localeCompare(b, 'nb'));
    const uniqueModels = new Map<string, string>();

    sortedModels.forEach((model) => {
      const normalized = sanitizeModelLabel(model).toLowerCase();
      if (!normalized) return;
      if (!uniqueModels.has(normalized)) {
        uniqueModels.set(normalized, sanitizeModelLabel(model));
      }
    });

    return Array.from(uniqueModels.values()).slice(0, 500);
  }, [
    formData.brand,
    equipment,
    cameraCandidates,
    audioStorageItems,
    formData.category,
    matchesSelectedCategory,
  ]);

  const uniqueManufacturerOptions = useMemo(
    () => dedupeLabels(manufacturerOptions),
    [manufacturerOptions]
  );
  const uniqueModelOptions = useMemo(
    () => dedupeLabels(modelOptions),
    [modelOptions]
  );

  const isCameraCategorySelected = useMemo(() => {
    const selected = formData.category.trim().toLowerCase();
    if (!selected || selected === 'all') return false;

    return [
      'kamera',
      'camera',
      'cine',
      'cinema',
      'filmutstyr',
      'videoutstyr',
      'fotoutstyr',
      'camcorder',
      'mirrorless',
      'dslr',
    ].some((token) => selected.includes(token));
  }, [formData.category]);

  const cameraSuggestionMatches = useMemo(() => {
    if (!isCameraCategorySelected) return [] as CameraRecord[];

    const mergedCameras = new Map<string, CameraRecord>();
    const addCamera = (camera: CameraRecord) => {
      const fallbackKey = [
        camera.type,
        String(camera.brand ?? '').trim().toLowerCase(),
        String(camera.model ?? '').trim().toLowerCase(),
      ].join('::');
      const key = String(camera.id ?? '').trim() || fallbackKey;
      if (!key || key === '::') return;
      if (!mergedCameras.has(key)) {
        mergedCameras.set(key, camera);
      }
    };

    cameraCatalogItems.forEach(addCamera);
    manufacturerCameraItems.forEach(addCamera);

    const brandNeedle = formData.brand.trim().toLowerCase();
    const modelNeedle = formData.model.trim().toLowerCase();
    if (!brandNeedle && !modelNeedle) return [] as CameraRecord[];

    return Array.from(mergedCameras.values())
      .filter((camera) => {
        const brand = String(camera.brand ?? '').trim().toLowerCase();
        const model = String(camera.model ?? '').trim().toLowerCase();
        if (!brand || !model) return false;
        if (!matchesSelectedCategory(camera.category)) return false;
        if (brandNeedle && !brand.includes(brandNeedle)) return false;
        if (modelNeedle && !model.includes(modelNeedle)) return false;
        return true;
      })
      .map((camera) => {
        const brand = String(camera.brand ?? '').trim().toLowerCase();
        const model = String(camera.model ?? '').trim().toLowerCase();
        let score = 0;
        if (brandNeedle && brand === brandNeedle) score += 12;
        if (brandNeedle && brand.startsWith(brandNeedle)) score += 6;
        if (modelNeedle && model === modelNeedle) score += 24;
        if (modelNeedle && model.startsWith(modelNeedle)) score += 12;
        if (camera.isNetflixCertified) score += 1;
        return { camera, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const brandCompare = a.camera.brand.localeCompare(b.camera.brand, 'nb');
        if (brandCompare !== 0) return brandCompare;
        return a.camera.model.localeCompare(b.camera.model, 'nb');
      })
      .slice(0, 4)
      .map((entry) => entry.camera);
  }, [
    isCameraCategorySelected,
    cameraCatalogItems,
    manufacturerCameraItems,
    formData.brand,
    formData.model,
    matchesSelectedCategory,
  ]);

  const modelOptionCameraLookup = useMemo(() => {
    const lookup = new Map<string, CameraRecord>();
    if (!isCameraCategorySelected) return lookup;

    const selectedBrand = formData.brand.trim().toLowerCase();
    const candidates = cameraCandidates;

    candidates.forEach((camera) => {
      const normalizedModel = String(camera.model ?? '').trim().toLowerCase();
      const normalizedBrand = String(camera.brand ?? '').trim().toLowerCase();
      if (!normalizedModel) return;
      if (!matchesSelectedCategory(camera.category)) return;
      if (selectedBrand && !normalizedBrand.includes(selectedBrand)) return;

      const existing = lookup.get(normalizedModel);
      if (!existing) {
        lookup.set(normalizedModel, camera);
        return;
      }

      if (!existing.isNetflixCertified && camera.isNetflixCertified) {
        lookup.set(normalizedModel, camera);
      }
    });

    return lookup;
  }, [
    isCameraCategorySelected,
    formData.brand,
    cameraCandidates,
    matchesSelectedCategory,
  ]);

  const selectedCameraForForm = useMemo(() => {
    if (!isCameraCategorySelected) return null;

    const brandNeedle = normalizeCameraIdentity(formData.brand);
    const modelNeedle = normalizeCameraIdentity(formData.model);
    if (!modelNeedle) return null;

    const exactModelMatches = cameraCandidates
      .filter((camera) => matchesSelectedCategory(camera.category))
      .filter((camera) => normalizeCameraIdentity(camera.model) === modelNeedle);

    if (exactModelMatches.length === 0) return null;

    const exactBrandMatches =
      brandNeedle.length > 0
        ? exactModelMatches.filter((camera) => normalizeCameraIdentity(camera.brand) === brandNeedle)
        : exactModelMatches;

    const candidates = exactBrandMatches.length > 0 ? exactBrandMatches : exactModelMatches;

    return [...candidates].sort(
      (a, b) => getCameraReliabilityScore(b) - getCameraReliabilityScore(a)
    )[0] ?? null;
  }, [
    isCameraCategorySelected,
    formData.brand,
    formData.model,
    cameraCandidates,
    matchesSelectedCategory,
  ]);

  const cameraSourceLabelForForm = useMemo(() => {
    if (!selectedCameraForForm) return t('equip.src.unknown');
    const sourceKey = getCameraSourceKey(selectedCameraForForm);
    const labelMap: Record<string, string> = {
      database: 'Database',
      'database-sync': 'Database sync',
      release_registry: 'Release registry',
      'release-registry': 'Release registry',
      manual: t('equip.src.manual'),
      world: 'World camera database',
      seed: t('equip.src.seed'),
      api: 'API',
      discovery: 'Discovery',
    };
    return labelMap[sourceKey] ?? (sourceKey ? sourceKey : t('equip.src.unknown'));
  }, [selectedCameraForForm, t]);

  const selectedCameraHasTrustedSpecs = useMemo(() => (
    selectedCameraForForm ? hasTrustedCameraSpecs(selectedCameraForForm) : false
  ), [selectedCameraForForm]);

  const cameraSpecDetails = useMemo(() => {
    if (!selectedCameraForForm) {
      return [] as Array<{ label: string; value: string }>;
    }
    if (!selectedCameraHasTrustedSpecs) {
      return [] as Array<{ label: string; value: string }>;
    }

    const details: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    const pushDetail = (label: string, rawValue: unknown) => {
      const value = stringifySpecValue(rawValue).trim();
      if (!value) return;
      const dedupeKey = `${label.toLowerCase()}::${value.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      details.push({ label, value });
    };

    pushDetail(t('equip.spec.category'), selectedCameraForForm.category);
    pushDetail(t('equip.spec.sensor'), selectedCameraForForm.sensorSize);
    pushDetail(t('equip.spec.mount'), selectedCameraForForm.mount);
    pushDetail(t('equip.spec.release'), selectedCameraForForm.releaseDate);
    pushDetail(t('equip.spec.priceRange'), selectedCameraForForm.priceRange);
    pushDetail(
      t('equip.spec.resolution'),
      selectedCameraForForm.videoResolution?.join(', ') ||
        selectedCameraForForm.resolution?.join(', ')
    );
    pushDetail(
      t('equip.spec.frameRate'),
      selectedCameraForForm.videoFrameRates?.join(', ') ||
        selectedCameraForForm.frameRates?.join(', ')
    );
    pushDetail(t('equip.spec.codec'), selectedCameraForForm.videoCodecs?.join(', '));
    pushDetail(t('equip.spec.logFormat'), selectedCameraForForm.logFormats?.join(', '));
    pushDetail(t('equip.spec.features'), selectedCameraForForm.features?.join(', '));

    Object.entries(selectedCameraForForm.specs ?? {})
      .filter(([key]) => Boolean(cameraSpecWhitelist[key]))
      .slice(0, 12)
      .forEach(([key, value]) => pushDetail(cameraSpecWhitelist[key], value));

    return details;
  }, [selectedCameraForForm, selectedCameraHasTrustedSpecs, t, cameraSpecWhitelist]);

  const renderNetflixBadge = useCallback((label: string = t('equip.netflixCertified'), compact = false) => (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 0 : 0.55,
        px: compact ? 0.65 : 0.9,
        py: compact ? 0.15 : 0.3,
        borderRadius: 999,
        bgcolor: '#000',
        border: '1px solid #E50914',
        boxShadow: '0 0 0 1px rgba(229,9,20,0.35) inset',
      }}
    >
      <Box
        component="img"
        src={netflixWordmark}
        alt="Netflix"
        sx={{ height: compact ? 8 : 10, width: 'auto', display: 'block' }}
      />
      {!compact && (
        <Typography sx={{ color: '#fff', fontSize: '0.66rem', fontWeight: 700, lineHeight: 1 }}>
          {label}
        </Typography>
      )}
    </Box>
  ), [t]);

  const getCameraSpecChips = useCallback((camera: CameraRecord) => {
    const specs = new Map<string, string>();

    const addSpec = (label: string, rawValue: unknown) => {
      const value = stringifySpecValue(rawValue).trim();
      if (!value) return;
      if (specs.has(label)) return;
      const compactValue = value.length > 48 ? `${value.slice(0, 45)}...` : value;
      specs.set(label, compactValue);
    };

    addSpec(t('equip.spec.sensor'), camera.sensorSize);
    addSpec(t('equip.spec.mount'), camera.mount);
    addSpec(t('equip.spec.released'), camera.releaseDate);
    addSpec(t('equip.spec.resolution'), camera.videoResolution?.[0] ?? camera.resolution?.[0]);
    addSpec(t('equip.spec.frameRate'), camera.videoFrameRates?.[0] ?? camera.frameRates?.[0]);
    addSpec(t('equip.spec.log'), camera.logFormats?.join(', '));
    addSpec(t('equip.spec.codec'), camera.videoCodecs?.join(', '));

    Object.entries(camera.specs ?? {})
      .slice(0, 4)
      .forEach(([key, rawValue]) => addSpec(key, rawValue));

    return Array.from(specs.entries())
      .slice(0, 6)
      .map(([label, value]) => `${label}: ${value}`);
  }, [t]);
  
  // History/audit log
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEquipmentHistory, setSelectedEquipmentHistory] = useState<Equipment | null>(null);
  const [equipmentHistory, setEquipmentHistory] = useState<Array<{
    id: string;
    action: string;
    user: string;
    timestamp: string;
    details?: string;
  }>>([]);
  
  // Maintenance scheduling
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [selectedEquipmentMaintenance, setSelectedEquipmentMaintenance] = useState<Equipment | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    scheduledDate: '',
    type: 'routine' as 'routine' | 'repair' | 'inspection' | 'calibration' | 'cleaning',
    notes: '',
    reminderDays: 7,
  });
  
  // Booking creation
  const [createBookingDialogOpen, setCreateBookingDialogOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    startDate: '',
    endDate: '',
    purpose: '',
    notes: '',
  });
  
  // Form validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ── Check-in / Check-out ───────────────────────────────
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutEquipment, setCheckoutEquipment] = useState<Equipment | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({ crewId: '', quantity: 1, purpose: '' });
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [checkinEquipment, setCheckinEquipment] = useState<Equipment | null>(null);
  const [checkinForm, setCheckinForm] = useState<{ condition: Equipment['condition']; notes: string }>({ condition: 'good', notes: '' });
  // Tracks all active (not yet checked-in) checkouts so we can resolve checkoutId for check-in
  const [activeCheckouts, setActiveCheckouts] = useState<EquipmentCheckout[]>([]);

  // ── Booking conflict warnings ──────────────────────────
  const [bookingConflicts, setBookingConflicts] = useState<EquipmentConflict[]>([]);
  const [conflictChecking, setConflictChecking] = useState(false);

  // ── Reports ────────────────────────────────────────────
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [reportsTab, setReportsTab] = useState(0);

  // ── Offline outbox — typed discriminated union ─────────
  type OfflineCheckoutEntry = {
    id: string; type: 'checkout'; ts: string;
    payload: { equipmentId: string; crewId: string; quantity: number; purpose: string };
  };
  type OfflineCheckinEntry = {
    id: string; type: 'checkin'; ts: string;
    payload: { equipmentId: string; condition: Equipment['condition']; notes: string };
  };
  type OfflineEntry = OfflineCheckoutEntry | OfflineCheckinEntry;

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [offlineOutboxOpen, setOfflineOutboxOpen] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineEntry[]>([]);

  const warehouseDialogItems = useMemo<WarehouseDialogItem[]>(
    () =>
      equipment.map((eq) => ({
        id: eq.id,
        itemType: 'equipment',
        name: eq.name,
        quantity: Number(eq.quantity || 0),
        primaryLocationId: eq.primary_location_id,
        locationLabel: eq.location_name,
        category: eq.category,
      })),
    [equipment]
  );

  const refreshWarehouseSummary = useCallback(() => {
    if (!projectId || warehouseDialogItems.length === 0) {
      setWarehouseStockByItem({});
      setWarehouseIssueCount(0);
      return;
    }

    warehouseInventoryService.bootstrapProject(projectId, {
      locations: locations.map((loc) => ({ id: loc.id, name: loc.name })),
      items: warehouseDialogItems,
    });

    const nextTotals: Record<string, { quantity: number; reserved: number; available: number }> = {};
    warehouseDialogItems.forEach((item) => {
      nextTotals[item.id] = warehouseInventoryService.getItemTotals(projectId, 'equipment', item.id);
    });
    setWarehouseStockByItem(nextTotals);

    const issues = warehouseInventoryService.listConsistencyIssues(projectId, warehouseDialogItems);
    setWarehouseIssueCount(issues.length);
  }, [locations, projectId, warehouseDialogItems]);

  const handleAddCustomCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      return;
    }
    if (allCategories.includes(trimmedName)) {
      showError(t('equip.toast.catExists'));
      return;
    }

    const updated = [...customCategories, trimmedName];
    setCustomCategories(updated);
    await equipmentCategoriesService.saveCustomCategories(projectId, updated);
    setNewCategoryName('');
    setNewCategoryDialogOpen(false);
    showSuccess(t('equip.toast.catAdded', { name: trimmedName }));
  };

  const handleRemoveCustomCategory = async (category: string) => {
    const updated = customCategories.filter(c => c !== category);
    setCustomCategories(updated);
    await equipmentCategoriesService.saveCustomCategories(projectId, updated);
    showSuccess(t('equip.toast.catRemoved', { name: category }));
  };

  const loadActiveCheckouts = async () => {
    if (!hasProtectedRoleRoomAccess || roleRoomApiUnavailable) {
      setActiveCheckouts([]);
      return;
    }
    try {
      const data = await equipmentCheckoutApi.getActive(projectId);
      setActiveCheckouts(Array.isArray(data) ? data : []);
    } catch (error) {
      // Non-fatal: active checkout tracking is best-effort
      if (!isRecoverableEndpointError(error) && !isNetworkTransportError(error)) {
        console.error('Error loading active checkouts:', error);
      }
      setActiveCheckouts([]);
    }
  };

  useEffect(() => {
    setRoleRoomApiUnavailable(false);
    setVendorLinksUnavailable(false);
    setCameraCatalogUnavailable(false);
    setMemoryCardsUnavailable(false);
  }, [projectId, isAuthenticated]);

  useEffect(() => {
    if (!projectId || authLoading || roleRoomApiUnavailable) {
      return;
    }

    if (!isAuthenticated) {
      setEquipment([]);
      setCrewMembers([]);
      setLocations([]);
      setTemplates([]);
      setActiveCheckouts([]);
      return;
    }

    loadEquipment();
    loadCrewAndLocations();
    loadTemplates();
    loadActiveCheckouts();
  }, [projectId, isAuthenticated, authLoading, roleRoomApiUnavailable]);

  // Multi-user realtime: poll every 30 s while online
  useEffect(() => {
    const onOnline  = () => {
      setIsOnline(true);
      setEquipmentPollPauseUntil(0);
      if (isAuthenticated && !authLoading && !roleRoomApiUnavailable) {
        loadEquipment();
      }
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    const timer = setInterval(() => {
      if (
        navigator.onLine &&
        isAuthenticated &&
        !authLoading &&
        !roleRoomApiUnavailable &&
        Date.now() >= equipmentPollPauseUntilRef.current
      ) {
        loadEquipment();
      }
    }, 30_000);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(timer);
    };
    // equipmentPollPauseUntil intentionally excluded — read via ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isAuthenticated, authLoading, roleRoomApiUnavailable]);

  // Offline outbox: restore queue from localStorage on mount / project change
  useEffect(() => {
    const raw = localStorage.getItem(`equipment_outbox_${projectId}`) ?? '[]';
    try {
      const q = JSON.parse(raw);
      setOfflineQueue(q);
      setOfflineQueueCount(q.length);
    } catch {
      setOfflineQueue([]);
      setOfflineQueueCount(0);
    }
  }, [projectId]);

  const loadEquipment = async () => {
    if (!hasProtectedRoleRoomAccess || roleRoomApiUnavailable) {
      setEquipment([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await equipmentApi.getAll(projectId);
      setEquipment(Array.isArray(data) ? data : []);
    } catch (error) {
      if (isRecoverableEndpointError(error)) {
        const status = getErrorStatusCode(error);
        if (status === 401 || status === 403 || status === 404) {
          setRoleRoomApiUnavailable(true);
        }
        setEquipment([]);
      } else if (isNetworkTransportError(error)) {
        setEquipment([]);
        setEquipmentPollPauseUntil(Date.now() + 60_000);
        const now = Date.now();
        if (now - lastTransportErrorToastAtRef.current > 45_000) {
          lastTransportErrorToastAtRef.current = now;
          showError(t('equip.toast.serverDown'));
        }
      } else {
        console.error('Error loading equipment:', error);
        showError(t('equip.toast.loadFailed'));
        setEquipment([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshWarehouseSummary();
  }, [refreshWarehouseSummary]);

  const loadCrewAndLocations = async () => {
    if (!hasProtectedRoleRoomAccess || roleRoomApiUnavailable) {
      setCrewMembers([]);
      setLocations([]);
      return;
    }

    const [crewResult, locationResult] = await Promise.allSettled([
        crewApi.getAll(projectId),
        locationsApi.getAll(projectId),
      ]);

    if (crewResult.status === 'fulfilled') {
      setCrewMembers(Array.isArray(crewResult.value) ? crewResult.value : []);
    } else if (!isRecoverableEndpointError(crewResult.reason) && !isNetworkTransportError(crewResult.reason)) {
      console.error('Error loading crew:', crewResult.reason);
    } else {
      setCrewMembers([]);
    }

    if (locationResult.status === 'fulfilled') {
      setLocations(Array.isArray(locationResult.value) ? locationResult.value : []);
    } else if (!isRecoverableEndpointError(locationResult.reason) && !isNetworkTransportError(locationResult.reason)) {
      console.error('Error loading locations:', locationResult.reason);
    } else {
      setLocations([]);
    }
  };

  const loadTemplates = async () => {
    if (!hasProtectedRoleRoomAccess || roleRoomApiUnavailable) {
      setTemplates([]);
      return;
    }
    try {
      const data = await equipmentTemplatesApi.getAll(projectId);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      if (isRecoverableEndpointError(error) || isNetworkTransportError(error)) {
        setTemplates([]);
      } else {
        console.error('Error loading templates:', error);
      }
    }
  };

  const loadVendorLinks = async () => {
    if (!shopDialogOpen || vendorLinksUnavailable) return;
    try {
      const [links, categories] = await Promise.all([
        vendorLinksApi.getAll(selectedVendorCategory === 'all' ? undefined : selectedVendorCategory),
        vendorLinksApi.getCategories(),
      ]);
      const normalizedLinks = sanitizeVendorLinks(Array.isArray(links) ? links : []);
      setVendorLinks(normalizedLinks);
      if (Array.isArray(categories) && categories.length > 0) {
        setVendorCategories(categories);
      } else {
        setVendorCategories(buildVendorCategoryCounts(normalizedLinks));
      }
    } catch (error) {
      if (isRecoverableEndpointError(error)) {
        setVendorLinksUnavailable(true);
        setVendorLinks([]);
        setVendorCategories([]);
      } else {
        console.error('Error loading vendor links:', error);
      }
    }
  };

  // Re-fetch vendor links whenever the category filter changes
  useEffect(() => {
    if (!shopDialogOpen || vendorLinksUnavailable) return;
    loadVendorLinks();
  }, [selectedVendorCategory, shopDialogOpen, vendorLinksUnavailable]);

  // Image search functions - Multi-source search via backend proxies (no keys in client)
  const searchImages = useCallback(async (query: string) => {
    if (!query.trim()) return;

    // Cancel any previous in-flight search
    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    const { signal } = controller;

    setImageSearchLoading(true);
    setImageSearchResults([]);
    
    try {
      const results: typeof imageSearchResults = [];
      const searchPromises: Promise<void>[] = [];
      
      // 1. Pexels — via backend proxy (key stays server-side)
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `/api/references/pexels/search?q=${encodeURIComponent(query)}&per_page=8`,
            { signal }
          );
          if (response.ok) {
            const data = await response.json();
            (data.results || []).forEach((img: any) => {
              results.push({
                id: img.id,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                description: img.description || query,
                photographer: img.photographer,
                source: img.source,
              });
            });
          }
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Pexels search error:', e);
        }
      })());

      // 2. Pixabay — via backend proxy (key stays server-side)
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `/api/references/pixabay/search?q=${encodeURIComponent(query)}&per_page=8`,
            { signal }
          );
          if (response.ok) {
            const data = await response.json();
            (data.results || []).forEach((img: any) => {
              results.push({
                id: img.id,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                description: img.description || query,
                photographer: img.photographer,
                source: img.source,
              });
            });
          }
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Pixabay search error:', e);
        }
      })());

      // 3. Unsplash — via backend proxy (key stays server-side)
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `/api/references/unsplash/search?q=${encodeURIComponent(query + ' film production')}&per_page=8&orientation=landscape`,
            { signal }
          );
          if (response.ok) {
            const data = await response.json();
            (data.results || []).forEach((img: any) => {
              results.push({
                id: img.id,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                description: img.description || query,
                photographer: img.attribution,
                source: img.source,
              });
            });
          }
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Unsplash search error:', e);
        }
      })());

      // 4. Openverse API - Creative Commons aggregator
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&page_size=6`
          );
          if (response.ok) {
            const data = await response.json();
            data.results?.forEach((img: any) => {
              results.push({
                id: `openverse-${img.id}`,
                url: img.url,
                thumbnailUrl: img.thumbnail || img.url,
                description: img.title,
                photographer: img.creator,
                source: 'openverse',
              });
            });
          }
        } catch (e) {
          console.error('Openverse search error:', e);
        }
      })());

      // 5. Wikimedia Commons - Reference/documentation images
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&origin=*&srlimit=6`
          );
          if (response.ok) {
            const data = await response.json();
            for (const item of data.query?.search || []) {
              // Get image info for each result
              const infoRes = await fetch(
                `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.title)}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=400&format=json&origin=*`
              );
              if (infoRes.ok) {
                const infoData = await infoRes.json();
                const pages = infoData.query?.pages;
                const page = pages?.[Object.keys(pages)[0]];
                const imageinfo = page?.imageinfo?.[0];
                if (imageinfo?.url) {
                  results.push({
                    id: `wikimedia-${page.pageid}`,
                    url: imageinfo.url,
                    thumbnailUrl: imageinfo.thumburl || imageinfo.url,
                    description: item.title.replace('File:', '').replace(/\.[^.]+$/, ''),
                    photographer: 'Wikimedia Commons',
                    source: 'wikimedia',
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('Wikimedia search error:', e);
        }
      })());

      // 6. shot.cafe for film references
      searchPromises.push((async () => {
        try {
          const response = await fetch(`/api/shotcafe/search?z=nav&q=${encodeURIComponent(query)}`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              data.slice(0, 4).forEach((film: any) => {
                results.push({
                  id: `shotcafe-${film.pslug || film.slug}`,
                  url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/t/${film.slug}`)}`,
                  thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/t/${film.slug}`)}`,
                  description: film.title,
                  photographer: film.dp,
                  source: 'shotcafe',
                });
              });
            }
          }
        } catch (e) {
          console.error('shot.cafe search error:', e);
        }
      })());

      // Wait for all searches to complete
      await Promise.allSettled(searchPromises);
      
      // Shuffle results to mix sources
      const shuffled = results.sort(() => Math.random() - 0.5);
      setImageSearchResults(shuffled);
    } catch (error) {
      console.error('Image search error:', error);
    } finally {
      setImageSearchLoading(false);
    }
  }, []);

  // ── Auto-bilde ved add ────────────────────────────────────────────────
  // Når man legger til NYTT utstyr uten bilde (kamera-katalogen har ingen
  // innebygde bilder), kjør bildesøket automatisk på «merke + modell» og
  // pre-fyll beste treff. Forslagene vises under bildefeltet så Lars kan
  // bytte med ett klikk. Løser «ingen bilde av utstyret» uten manuelt søk.
  // ── Ekte produktbilder ved add (IKKE stock) ──────────────────────────
  // Henter ekte produktbilder av det faktiske utstyret fra Wikimedia Commons
  // for «merke + modell», filtrert til treff som faktisk nevner modellen/merket.
  // Ingen Pexels/Pixabay/Unsplash/film-stills. Finnes ingen ekte treff →
  // ingen auto-bilde (vi faller IKKE tilbake til stock).
  const autoResolveImageRef = useRef(false);
  const equipmentImageControllerRef = useRef<AbortController | null>(null);

  const searchEquipmentProductImages = useCallback(async (brand: string, model: string) => {
    const query = `${brand} ${model}`.trim();
    const m = model.trim().toLowerCase();
    const b = brand.trim().toLowerCase();
    if (query.length < 3) { setEquipmentImageSuggestions([]); return; }

    equipmentImageControllerRef.current?.abort();
    const controller = new AbortController();
    equipmentImageControllerRef.current = controller;
    const { signal } = controller;

    setEquipmentImageLoading(true);
    setEquipmentImageSuggestions([]);
    try {
      const searchRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&origin=*&srlimit=10`,
        { signal },
      );
      if (!searchRes.ok) return;
      const searchData = await searchRes.json();
      const titles: string[] = (searchData.query?.search || [])
        .map((s: { title?: string }) => s.title)
        .filter(Boolean)
        .slice(0, 8);

      const resolved = await Promise.all(titles.map(async (title) => {
        try {
          const infoRes = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|thumburl|mime&iiurlwidth=400&format=json&origin=*`,
            { signal },
          );
          if (!infoRes.ok) return null;
          const infoData = await infoRes.json();
          const pages = infoData.query?.pages;
          const page = pages?.[Object.keys(pages || {})[0]];
          const ii = page?.imageinfo?.[0];
          const mime: string = ii?.mime || '';
          if (!ii?.url || !mime.startsWith('image/')) return null;
          const label = String(title).toLowerCase();
          // Ekte modell-/merke-bilde: tittelen MÅ nevne modellen eller merket.
          if (!((m && label.includes(m)) || (b && label.includes(b)))) return null;
          return { id: `wm-${page.pageid}`, url: ii.url as string, thumbnailUrl: (ii.thumburl as string) || (ii.url as string), description: String(title) };
        } catch {
          return null;
        }
      }));

      const found = resolved.filter((r): r is { id: string; url: string; thumbnailUrl: string; description: string } => r !== null);
      // Modell-match først, deretter merke-match.
      found.sort((x, y) => {
        const sc = (d: string) => (m && d.toLowerCase().includes(m) ? 2 : 0) + (b && d.toLowerCase().includes(b) ? 1 : 0);
        return sc(y.description) - sc(x.description);
      });
      setEquipmentImageSuggestions(found);

      // Auto-velg beste EKTE modell-treff (kun hvis modellen faktisk nevnes).
      if (autoResolveImageRef.current) {
        autoResolveImageRef.current = false;
        const best = found.find((f) => m && f.description.toLowerCase().includes(m)) || found[0];
        if (best?.url) {
          setFormData((prev) => (prev.imageUrl ? prev : { ...prev, imageUrl: best.url }));
        }
      }
    } catch {
      /* nettverksfeil / abort — ingen forslag, ingen stock */
    } finally {
      setEquipmentImageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!dialogOpen || editingEquipment) return; // kun ved nytt utstyr
    if (formData.imageUrl) return; // alt har bilde
    const query = [formData.brand, formData.model].filter(Boolean).join(' ').trim();
    if (query.length < 3) { setEquipmentImageSuggestions([]); return; }
    autoResolveImageRef.current = true;
    const brand = formData.brand || '';
    const model = formData.model || '';
    const timer = window.setTimeout(() => { void searchEquipmentProductImages(brand, model); }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, editingEquipment, formData.brand, formData.model, formData.imageUrl]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // TODO: Replace base64 data-URL storage with signed-URL upload to object storage
    //       (e.g. Supabase Storage / S3) to avoid bloating the database row.
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFormData({ ...formData, imageUrl: dataUrl });
      setImagePickerOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSearchImage = (imageUrl: string) => {
    setFormData({ ...formData, imageUrl });
    setImagePickerOpen(false);
    setImageSearchResults([]);
    setImageSearchQuery('');
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      const result = await equipmentTemplatesApi.apply(templateId, projectId);
      showSuccess(t('equip.toast.tplApplied', { n: result.count }));
      loadEquipment();
      setTemplatesDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error applying template:', error);
      showError(t('equip.toast.applyTplFailed'));
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await equipmentTemplatesApi.update(editingTemplate.id, templateFormData as Partial<EquipmentTemplate>);
        showSuccess(t('equip.toast.tplUpdated'));
      } else {
        await equipmentTemplatesApi.create(projectId, templateFormData as Partial<EquipmentTemplate>);
        showSuccess(t('equip.toast.tplCreated'));
      }
      loadTemplates();
      setTemplateFormOpen(false);
      setEditingTemplate(null);
      setTemplateFormData({ name: '', description: '', category: '', use_case: '', is_global: false, items: [] });
    } catch (error) {
      console.error('Error saving template:', error);
      showError(t('equip.toast.saveTplFailed'));
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await equipmentTemplatesApi.delete(templateId);
      showSuccess(t('equip.toast.tplDeleted'));
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      showError(t('equip.toast.delTplFailed'));
    }
  };

  const handleCreateTemplateFromEquipment = async () => {
    // Use selected equipment if any are selected, otherwise use all equipment
    const sourceEquipment = selectedEquipmentIds.size > 0
      ? equipment.filter(eq => selectedEquipmentIds.has(eq.id))
      : equipment;
    
    if (sourceEquipment.length === 0) {
      showError(t('equip.toast.noEquipForTpl'));
      return;
    }
    
    const items = sourceEquipment.map((eq, idx) => ({
      name: eq.name,
      description: eq.description,
      category: eq.category,
      brand: eq.brand,
      model: eq.model,
      quantity: eq.quantity,
      is_required: true,
      sort_order: idx,
    }));
    
    const templateName = selectedEquipmentIds.size > 0
      ? t('equip.tpl.nameSelected', { n: sourceEquipment.length })
      : t('equip.tpl.myTemplate');
    const templateDesc = selectedEquipmentIds.size > 0
      ? t('equip.tpl.fromSelected', { n: sourceEquipment.length })
      : t('equip.tpl.fromAllExisting');
    
    setTemplateFormData({
      name: templateName,
      description: templateDesc,
      category: 'Produksjon',
      use_case: 'Film/Foto',
      is_global: false,
      items,
    });
    setEditingTemplate(null);
    setTemplateFormOpen(true);
    
    // Clear selection after creating template
    if (selectedEquipmentIds.size > 0) {
      setSelectedEquipmentIds(new Set());
    }
  };

  const handleOpenShopDialog = () => {
    blurFocusedElement();
    setVendorLinksUnavailable(false);
    setShopDialogOpen(true);
  };

  const handleOpenShopCategory = (category: string, url: string) => {
    setSelectedVendorCategory(category);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenDialog = (eq?: Equipment) => {
    blurFocusedElement();
    if (eq) {
      setEditingEquipment(eq);
      setFormData({
        name: eq.name || '',
        description: eq.description || '',
        category: eq.category || '',
        brand: eq.brand || '',
        model: eq.model || '',
        serialNumber: eq.serial_number || '',
        quantity: eq.quantity || 1,
        condition: eq.condition || 'good',
        primaryLocationId: eq.primary_location_id || '',
        notes: eq.notes || '',
        notesAuthorName: eq.notes_author_name || eq.notesAuthorName || '',
        notesAuthorId: eq.notes_author_id || eq.notesAuthorId || '',
        notesUpdatedAt: eq.notes_updated_at || eq.notesUpdatedAt || '',
        imageUrl: eq.image_url || '',
        status: eq.status || 'available',
        isGlobal: eq.is_global || !eq.project_id, // Global if no project_id or is_global flag
      });
    } else {
      setEditingEquipment(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        brand: '',
        model: '',
        serialNumber: '',
        quantity: 1,
        condition: 'good',
        primaryLocationId: '',
        notes: '',
        notesAuthorName: '',
        notesAuthorId: '',
        notesUpdatedAt: '',
        imageUrl: '',
        status: 'available',
        isGlobal: false,
      });
      setFormErrors({}); // Clear validation errors
    }
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!externalCreateSignal || externalCreateSignal === externalCreateSignalRef.current) {
      return;
    }
    externalCreateSignalRef.current = externalCreateSignal;
    externalCreatePendingRef.current = true;
    handleOpenDialog();
  }, [externalCreateSignal]);

  const handleCloseMainDialog = useCallback(() => {
    if (externalCreatePendingRef.current) {
      externalCreatePendingRef.current = false;
      onExternalCreateCancelled?.();
    }
    setDialogOpen(false);
  }, [onExternalCreateCancelled]);

  const handleOpenCreateTypeDialog = () => {
    blurFocusedElement();
    setCreateTypeDialogOpen(true);
  };

  const handleCreateEquipmentFromChooser = () => {
    setCreateTypeDialogOpen(false);
    handleOpenDialog();
  };

  const handleCreatePropFromChooser = () => {
    setCreateTypeDialogOpen(false);
    window.dispatchEvent(new CustomEvent(OPEN_PROP_CREATE_MODAL_EVENT, { detail: { itemType: 'prop' } }));
    window.requestAnimationFrame(() => {
      document.getElementById('role-room-prop-management-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  /** Import a catalog item into the project: pre-fills the add-dialog with the
   *  catalog data so the user only needs to confirm / add a serial number. */
  const handleImportFromCatalog = (item: CatalogEquipment) => {
    setCatalogBridgeOpen(false);
    setEditingEquipment(null);
    setFormErrors({});
    setFormData({
      name: [item.brand, item.model].filter(Boolean).join(' ') || '',
      description: item.description || '',
      category: item.category || '',
      brand: item.brand || '',
      model: item.model || '',
      serialNumber: '',
      quantity: 1,
      condition: 'good',
      primaryLocationId: '',
      notes: item.specifications
        ? Object.entries(item.specifications)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n')
        : '',
      notesAuthorName: '',
      notesAuthorId: '',
      notesUpdatedAt: '',
      imageUrl: item.imageUrl || (item.images?.[0] ?? ''),
      status: 'available',
      isGlobal: false,
    });
    setDialogOpen(true);
  };

  /** Import a market-price item into the project's add-dialog */
  const handleImportFromMarket = (item: MarketEquipmentItem) => {
    setCatalogBridgeOpen(false);
    setEditingEquipment(null);
    setFormErrors({});
    setFormData({
      name: [item.brand, item.model].filter(Boolean).join(' ') || '',
      description: '',
      category: item.category || '',
      brand: item.brand || '',
      model: item.model || '',
      serialNumber: '',
      quantity: 1,
      condition: 'good',
      primaryLocationId: '',
      notes: item.currentPrice
        ? `Markedspris: ${parseFloat(item.currentPrice).toLocaleString('nb-NO')} kr`
        : '',
      notesAuthorName: '',
      notesAuthorId: '',
      notesUpdatedAt: '',
      imageUrl: '',
      status: 'available',
      isGlobal: false,
    });
    setDialogOpen(true);
  };

  /** Import a lens database item into the project's add-dialog */
  const handleImportFromLens = (lens: LensItem) => {
    setCatalogBridgeOpen(false);
    setEditingEquipment(null);
    setFormErrors({});
    setFormData({
      name: [lens.brand, lens.model].filter(Boolean).join(' ') || '',
      description: [lens.focalLength, lens.aperture, lens.mount].filter(Boolean).join(' · ') || '',
      category: 'lenses',
      brand: lens.brand || '',
      model: lens.model || '',
      serialNumber: '',
      quantity: 1,
      condition: 'good',
      primaryLocationId: '',
      notes: [
        lens.focalLength && `Brennvidde: ${lens.focalLength}`,
        lens.aperture && `Blender: ${lens.aperture}`,
        lens.mount && `Fatning: ${lens.mount}`,
        lens.lensType && `Type: ${lens.lensType}`,
        lens.weight && `Vekt: ${lens.weight}`,
        lens.imageStabilization && 'Bildestabilisering: Ja',
        lens.weatherSealing && 'Værtetting: Ja',
      ].filter(Boolean).join('\n'),
      notesAuthorName: '',
      notesAuthorId: '',
      notesUpdatedAt: '',
      imageUrl: '',
      status: 'available',
      isGlobal: false,
    });
    setDialogOpen(true);
  };

  const handleImportFromCameraRecord = (camera: CameraRecord) => {
    setCatalogBridgeOpen(false);
    setEditingEquipment(null);
    setFormErrors({});

    const specsLines = Object.entries(camera.specs ?? {})
      .map(([key, value]) => `${key}: ${stringifySpecValue(value)}`)
      .filter((line) => line.trim().length > 0);

    const detailLines = [
      camera.type && `Type: ${camera.type}`,
      camera.category && `Kategori: ${camera.category}`,
      camera.mount && `Fatning: ${camera.mount}`,
      camera.sensorSize && `Sensor: ${camera.sensorSize}`,
      camera.releaseDate && `Lansert: ${camera.releaseDate}`,
      camera.logFormats?.length ? `Log-formater: ${camera.logFormats.join(', ')}` : '',
      camera.videoCodecs?.length ? `Kodeker: ${camera.videoCodecs.join(', ')}` : '',
    ]
      .filter(Boolean)
      .map((entry) => String(entry));

    setFormData({
      name: [camera.brand, camera.model].filter(Boolean).join(' ') || '',
      description: camera.description || '',
      category: 'Kamera',
      brand: camera.brand || '',
      model: camera.model || '',
      serialNumber: '',
      quantity: 1,
      condition: 'good',
      primaryLocationId: '',
      notes: [...detailLines, ...specsLines].join('\n'),
      notesAuthorName: '',
      notesAuthorId: '',
      notesUpdatedAt: '',
      imageUrl: '',
      status: 'available',
      isGlobal: false,
    });
    setDialogOpen(true);
  };

  const handleImportFromMemoryCard = (card: MemoryCardTypeRecord) => {
    setCatalogBridgeOpen(false);
    setEditingEquipment(null);
    setFormErrors({});

    setFormData({
      name: card.fullName || card.name || '',
      description: card.description || '',
      category: 'Minnekort',
      brand: card.name || '',
      model: card.id || '',
      serialNumber: '',
      quantity: 1,
      condition: 'good',
      primaryLocationId: '',
      notes: [
        `Korttype: ${card.category}`,
        `Maks kapasitet: ${card.maxCapacity}`,
        `Leseskriving: ${card.readSpeed} MB/s / ${card.writeSpeed} MB/s`,
        card.videoClass ? `Video-klasse: ${card.videoClass}` : '',
        card.uhsClass ? `UHS-klasse: ${card.uhsClass}` : '',
        card.commonCapacities?.length ? `Vanlige kapasiteter: ${card.commonCapacities.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      notesAuthorName: '',
      notesAuthorId: '',
      notesUpdatedAt: '',
      imageUrl: '',
      status: 'available',
      isGlobal: false,
    });
    setDialogOpen(true);
  };

  const handleSyncCameraDiscovery = async () => {
    setCameraSyncing(true);
    try {
      await Promise.all([
        apiRequest('/api/equipment/discovery/sync?type=photo', { method: 'POST' }),
        apiRequest('/api/equipment/discovery/sync?type=video', { method: 'POST' }),
      ]);
      setCameraCatalogUnavailable(false);
      setMemoryCardsUnavailable(false);
      await refetchCameraCatalog();
      if (selectedCameraId) {
        await refetchMemoryCards();
      }
      showSuccess(t('equip.toast.camSynced'));
    } catch (error) {
      console.error('Error syncing camera discovery:', error);
      showError(t('equip.toast.camSyncFailed'));
    } finally {
      setCameraSyncing(false);
    }
  };

  const handleSave = async () => {
    // Use enhanced validation
    if (!validateForm()) {
      showError(t('equip.toast.fixForm'));
      return;
    }

    const normalizedNotes = typeof formData.notes === 'string' ? formData.notes.trim() : '';
    const existingNotes = typeof editingEquipment?.notes === 'string' ? editingEquipment.notes.trim() : '';
    const shouldRefreshNoteMeta = Boolean(normalizedNotes) && (!editingEquipment || normalizedNotes !== existingNotes);
    const nowIso = new Date().toISOString();
    const noteAuthorName = normalizedNotes
      ? shouldRefreshNoteMeta
        ? noteActorLabel
        : formData.notesAuthorName || noteActorLabel
      : '';
    const noteAuthorId = normalizedNotes
      ? shouldRefreshNoteMeta
        ? noteActorId ?? ''
        : formData.notesAuthorId || noteActorId || ''
      : '';
    const noteUpdatedAt = normalizedNotes
      ? shouldRefreshNoteMeta
        ? nowIso
        : formData.notesUpdatedAt || nowIso
      : '';

    const payload = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      brand: formData.brand,
      model: formData.model,
      serial_number: formData.serialNumber,
      quantity: formData.quantity,
      condition: formData.condition,
      primary_location_id: formData.primaryLocationId || undefined,
      notes: normalizedNotes ? formData.notes : '',
      notes_author_name: noteAuthorName,
      notes_author_id: noteAuthorId,
      notes_updated_at: noteUpdatedAt,
      image_url: formData.imageUrl,
      status: formData.status,
      project_id: formData.isGlobal ? undefined : projectId, // undefined = global equipment
      is_global: formData.isGlobal,
    } satisfies Partial<Equipment>;

    try {
      let createdEquipment: Equipment | null = null;
      if (editingEquipment) {
        await equipmentApi.update(editingEquipment.id, payload);
        showSuccess(t('equip.toast.equipUpdated'));
      } else {
        createdEquipment = await equipmentApi.create(payload);
        showSuccess(t('equip.toast.equipCreated'));
        roleRoomAnalytics.equipmentAdded({
          project_id: projectId,
          equipment_id: createdEquipment?.id ?? formData.name,
          category: formData.category,
        });
      }
      seedGlobalMentions([formData.notes], [formData.name, formData.brand, formData.model]);
      if (createdEquipment) {
        externalCreatePendingRef.current = false;
        onExternalCreated?.(createdEquipment);
      }
      handleCloseMainDialog();
      loadEquipment();
      onUpdate?.();
    } catch (error) {
      console.error('Error saving equipment:', error);
      showError(t('equip.toast.saveEquipFailed'));
    }
  };

  const handleOpenAssign = (eq: Equipment) => {
    setSelectedEquipmentForAssign(eq);
    setSelectedCrewId('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedEquipmentForAssign || !selectedCrewId) return;
    
    try {
      await equipmentApi.assign(selectedEquipmentForAssign.id, selectedCrewId, 'responsible');
      showSuccess(t('equip.toast.ownerAssigned'));
      setAssignDialogOpen(false);
      loadEquipment();
    } catch (error) {
      console.error('Error assigning equipment:', error);
      showError(t('equip.toast.assignFailed'));
    }
  };

  const handleUnassign = async (equipmentId: string, crewId: string) => {
    try {
      await equipmentApi.unassign(equipmentId, crewId);
      showSuccess(t('equip.toast.assignRemoved'));
      loadEquipment();
    } catch (error) {
      console.error('Error unassigning equipment:', error);
      showError(t('equip.toast.unassignFailed'));
    }
  };

  const handleOpenBookings = async (eq: Equipment) => {
    setSelectedEquipmentBookings(eq);
    setBookingsDialogOpen(true);
    try {
      const [bookingsData, availabilityData] = await Promise.all([
        equipmentBookingsApi.getAll(eq.id),
        equipmentAvailabilityApi.getAll(eq.id),
      ]);
      setBookings(bookingsData);
      setAvailability(availabilityData);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  // === NEW WORKFLOW HANDLERS ===

  // 1. Styled delete confirmation
  const handleDeleteClick = (eq: Equipment) => {
    setEquipmentToDelete(eq);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!equipmentToDelete) return;
    try {
      await equipmentApi.delete(equipmentToDelete.id);
      showSuccess(t('equip.toast.deleted', { name: equipmentToDelete.name }));
      loadEquipment();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      showError(t('equip.toast.delEquipFailed'));
    } finally {
      setDeleteDialogOpen(false);
      setEquipmentToDelete(null);
    }
  };

  // 2. Duplicate equipment
  const handleDuplicate = (eq: Equipment) => {
    setEditingEquipment(null);
    setFormData({
      name: `${eq.name} (kopi)`,
      description: eq.description || '',
      category: eq.category || '',
      brand: eq.brand || '',
      model: eq.model || '',
      serialNumber: '', // Clear serial number for duplicate
      quantity: eq.quantity || 1,
      condition: eq.condition || 'good',
      primaryLocationId: eq.primary_location_id || '',
      notes: eq.notes || '',
      notesAuthorName: eq.notes_author_name || eq.notesAuthorName || '',
      notesAuthorId: eq.notes_author_id || eq.notesAuthorId || '',
      notesUpdatedAt: eq.notes_updated_at || eq.notesUpdatedAt || '',
      imageUrl: eq.image_url || '',
      status: 'available', // Reset status for new item
      isGlobal: eq.is_global || false, // Preserve global status
    });
    setDialogOpen(true);
    showSuccess(t('equip.toast.duplicated'));
  };

  // 3. Bulk operations
  const toggleSelectEquipment = (id: string) => {
    const newSelected = new Set(selectedEquipmentIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEquipmentIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEquipmentIds.size === filteredEquipment.length) {
      setSelectedEquipmentIds(new Set());
    } else {
      setSelectedEquipmentIds(new Set(filteredEquipment.map(eq => eq.id)));
    }
  };

  const handleBulkAction = (type: 'delete' | 'status' | 'assign') => {
    if (selectedEquipmentIds.size === 0) {
      showError(t('equip.toast.selectOne'));
      return;
    }
    setBulkActionType(type);
    setBulkActionDialogOpen(true);
  };

  const handleConfirmBulkAction = async () => {
    const ids = Array.from(selectedEquipmentIds);
    try {
      if (bulkActionType === 'delete') {
        const results = await Promise.allSettled(ids.map(id => equipmentApi.delete(id)));
        const failed = results.filter(r => r.status === 'rejected').length;
        const ok = ids.length - failed;
        if (failed > 0) showError(t('equip.toast.bulkDelPartial', { ok, failed }));
        else showSuccess(t('equip.toast.bulkDeleted', { n: ok }));
      } else if (bulkActionType === 'status') {
        const results = await Promise.allSettled(ids.map(id => equipmentApi.update(id, { status: bulkNewStatus })));
        const failed = results.filter(r => r.status === 'rejected').length;
        const ok = ids.length - failed;
        if (failed > 0) showError(t('equip.toast.bulkStatusPartial', { ok, failed }));
        else showSuccess(t('equip.toast.bulkStatus', { n: ok }));
      } else if (bulkActionType === 'assign') {
        if (bulkAssignCrewId) {
          const results = await Promise.allSettled(ids.map(id => equipmentApi.assign(id, bulkAssignCrewId, 'responsible')));
          const failed = results.filter(r => r.status === 'rejected').length;
          const ok = ids.length - failed;
          if (failed > 0) showError(t('equip.toast.bulkAssignPartial', { ok, failed }));
          else showSuccess(t('equip.toast.bulkAssigned', { n: ok }));
        }
      }
      setSelectedEquipmentIds(new Set());
      setBulkAssignCrewId('');
      loadEquipment();
      onUpdate?.();
    } catch (error) {
      console.error('Bulk action error:', error);
      showError(t('equip.toast.bulkError'));
    } finally {
      setBulkActionDialogOpen(false);
    }
  };

  // 4. Export/Import CSV
  const handleExportCSV = () => {
    const headers = [t('equip.csv.name'), t('equip.csv.category'), t('equip.csv.brand'), t('equip.csv.model'), t('equip.csv.serial'), t('equip.csv.quantity'), t('equip.csv.status'), t('equip.csv.condition'), t('equip.csv.description'), t('equip.csv.notes')];
    const rows = equipment.map(eq => [
      eq.name || '',
      eq.category || '',
      eq.brand || '',
      eq.model || '',
      eq.serial_number || '',
      String(eq.quantity || 1),
      statusLabels[eq.status || 'available'] || eq.status,
      conditionLabels[eq.condition || 'good'] || eq.condition,
      eq.description || '',
      eq.notes || '',
    ]);
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `utstyrsliste-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showSuccess(t('equip.toast.listExported'));
  };

  const handleImportCSV = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;

        // RFC 4180-compliant CSV parser — handles quoted fields and embedded delimiters
        const parseCSVRow = (line: string, delimiter = ';'): string[] => {
          const result: string[] = [];
          let field = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
              if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
              else if (ch === '"') inQuotes = false;
              else field += ch;
            } else {
              if (ch === '"') { inQuotes = true; }
              else if (ch === delimiter) { result.push(field.trim()); field = ''; }
              else field += ch;
            }
          }
          result.push(field.trim());
          return result;
        };

        // Auto-detect delimiter (semicolon vs comma)
        const firstLine = text.split(/\r?\n/)[0] || '';
        const delimiter = firstLine.includes(';') ? ';' : ',';

        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
          showError(t('equip.toast.fileEmpty'));
          return;
        }
        
        const headers = parseCSVRow(lines[0], delimiter).map(h => h.toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('navn'));
        const categoryIdx = headers.findIndex(h => h.includes('kategori'));
        const brandIdx = headers.findIndex(h => h.includes('merke'));
        const modelIdx = headers.findIndex(h => h.includes('modell'));
        const serialIdx = headers.findIndex(h => h.includes('serienummer'));
        const quantityIdx = headers.findIndex(h => h.includes('antall'));
        const descIdx = headers.findIndex(h => h.includes('beskrivelse'));
        
        const rowsToImport = lines.slice(1).map(line => parseCSVRow(line, delimiter));
        const validRows = rowsToImport.filter(cols => nameIdx >= 0 && cols[nameIdx]);

        // Batch creates in parallel (max concurrency avoids overwhelming the API)
        const BATCH_SIZE = 10;
        let imported = 0;
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(batch.map(cols =>
            equipmentApi.create({
              project_id: projectId,
              name: cols[nameIdx],
              category: categoryIdx >= 0 ? cols[categoryIdx] : '',
              brand: brandIdx >= 0 ? cols[brandIdx] : '',
              model: modelIdx >= 0 ? cols[modelIdx] : '',
              serial_number: serialIdx >= 0 ? cols[serialIdx] : '',
              quantity: quantityIdx >= 0 ? parseInt(cols[quantityIdx]) || 1 : 1,
              description: descIdx >= 0 ? cols[descIdx] : '',
              status: 'available',
              condition: 'good',
            })
          ));
          imported += results.filter(r => r.status === 'fulfilled').length;
        }
        
        showSuccess(t('equip.toast.imported', { done: imported, total: validRows.length }));
        loadEquipment();
        onUpdate?.();
      } catch (error) {
        console.error('Import error:', error);
        showError(t('equip.toast.importFailed'));
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // 5. Warehouse QR system
  const getEquipmentQrValue = useCallback(
    (eq: Equipment): string =>
      warehouseInventoryService.buildQrValue({
        projectId,
        itemType: 'equipment',
        itemId: eq.id,
        itemName: eq.name,
        serialNumber: eq.serial_number || undefined,
      }),
    [projectId]
  );

  const getEquipmentQrImageUrl = useCallback(
    (eq: Equipment, size = 280): string =>
      warehouseInventoryService.buildQrImageUrl(getEquipmentQrValue(eq), size),
    [getEquipmentQrValue]
  );

  const handleOpenQrLabel = (eq: Equipment) => {
    blurFocusedElement();
    setQrTargetEquipment(eq);
    setQrLabelDialogOpen(true);
  };

  const handleCopyQrPayload = async (eq: Equipment) => {
    const value = getEquipmentQrValue(eq);
    try {
      await navigator.clipboard.writeText(value);
      showSuccess(t('equip.toast.qrCopied'));
    } catch {
      showError(t('equip.toast.qrCopyFailed'));
    }
  };

  const handlePrintQR = (eq: Equipment) => {
    const qrUrl = getEquipmentQrImageUrl(eq, 360);
    const qrPayload = getEquipmentQrValue(eq);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError(t('equip.toast.printFailed'));
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>QR-etikett: ${eq.name}</title>
          <style>
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #111421;
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .label {
              width: 420px;
              border: 2px solid #9333ea;
              border-radius: 16px;
              padding: 20px;
              background: #171a2b;
              box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
            }
            h2 {
              margin: 0 0 6px 0;
              font-size: 24px;
              color: #c084fc;
            }
            .meta {
              margin: 0 0 12px 0;
              color: #cbd5e1;
              font-size: 13px;
            }
            .qr-wrap {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 12px;
              border: 1px solid rgba(255,255,255,0.15);
              border-radius: 12px;
              background: #0f1220;
            }
            img {
              width: 300px;
              height: 300px;
            }
            .foot {
              margin-top: 12px;
              font-size: 11px;
              color: #94a3b8;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <section class="label">
            <h2>${eq.name}</h2>
            <p class="meta">Serienummer: ${eq.serial_number || 'N/A'} • Antall: ${eq.quantity}</p>
            <div class="qr-wrap">
              <img src="${qrUrl}" alt="QR Code" />
            </div>
            <p class="foot">${qrPayload}</p>
          </section>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  };

  const handleResolveScannedQr = (rawValue: string) => {
    const parsed = warehouseInventoryService.parseQrValue(rawValue);
    if (!parsed) {
      setQrScanError(t('equip.toast.qrUnknown'));
      return;
    }

    if (parsed.itemType !== 'equipment') {
      setQrScanError(t('equip.toast.qrNotEquip'));
      return;
    }

    if (parsed.projectId && parsed.projectId !== projectId) {
      setQrScanError(t('equip.toast.qrWrongProject'));
      return;
    }

    const match = equipment.find(
      (entry) =>
        entry.id === parsed.itemId ||
        (parsed.serialNumber && entry.serial_number === parsed.serialNumber)
    );

    if (!match) {
      setQrScanError(t('equip.toast.qrNoMatch'));
      return;
    }

    setQrScanError(null);
    setQrScanInput('');
    setQrScanDialogOpen(false);
    setSearchQuery(match.name);
    handleOpenDialog(match);
    showSuccess(t('equip.toast.qrFound', { name: match.name }));
  };

  const normalizeScannedSerialValue = (rawValue: string): string =>
    rawValue
      .replace(/\r/g, "\n")
      .split("\n")
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? "";

  const handleApplyScannedSerialNumber = (rawValue: string) => {
    const normalizedSerial = normalizeScannedSerialValue(rawValue);
    if (!normalizedSerial) {
      setSerialScanError(t('equip.toast.serialNone'));
      return;
    }

    setFormData((prev) => ({ ...prev, serialNumber: normalizedSerial }));
    setSerialScanInput(normalizedSerial);
    setSerialScanError(null);
    setSerialScanDialogOpen(false);
    setFormErrors((prev) => {
      if (!prev.serialNumber) return prev;
      const next = { ...prev };
      delete next.serialNumber;
      return next;
    });
    showSuccess(t('equip.toast.serialUpdated', { serial: normalizedSerial }));
  };

  // 6. History/audit log — real API data
  const handleOpenHistory = async (eq: Equipment) => {
    setSelectedEquipmentHistory(eq);
    setHistoryDialogOpen(true);
    // Seed with a static creation entry immediately
    const creationEntry = {
      id: 'create-0',
      action: t('equip.hist.created'),
      user: 'System',
      timestamp: eq.created_at || new Date().toISOString(),
      details: t('equip.hist.createdDetail'),
    };
    setEquipmentHistory([creationEntry]);
    try {
      const checkouts = await equipmentCheckoutApi.getAll(projectId || '', eq.id);
      const checkoutEntries = checkouts.flatMap(c => {
        const entries = [
          {
            id: `checkout-${c.id}`,
            action: t('equip.hist.checkedOut'),
            user: c.checked_out_by || t('equip.unknown'),
            timestamp: c.checked_out_at,
            details: t('equip.hist.checkedOutTo', { to: c.checked_out_to, suffix: c.purpose ? ' — ' + c.purpose : '' }),
          },
        ];
        if (c.checked_in_at) {
          entries.push({
            id: `checkin-${c.id}`,
            action: t('equip.hist.checkedIn'),
            user: c.checked_out_to || t('equip.unknown'),
            timestamp: c.checked_in_at,
            details: t('equip.hist.checkedInDetail', { cond: c.condition_on_return ? t('equip.hist.condReturn', { c: c.condition_on_return }) : '', note: c.notes ? ' — ' + c.notes : '' }),
          });
        }
        return entries;
      });
      // Add current assignee entries from equipment assignees array
      const assignEntries = (eq.assignees || []).map((a, i) => ({
        id: `assign-${i}`,
        action: t('equip.hist.assigned'),
        user: t('equip.role.user'),
        timestamp: eq.updated_at || new Date().toISOString(),
        details: t('equip.hist.assignedTo', { name: getCrewName(a.crew_id) }),
      }));
      // Sort all entries chronologically (oldest first)
      const allEntries = [creationEntry, ...checkoutEntries, ...assignEntries].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setEquipmentHistory(allEntries);
    } catch (err) {
      console.error('Error loading equipment history:', err);
      // Fall back to static creation entry already set above
    }
  };

  // 7. Maintenance scheduling
  const handleOpenMaintenance = (eq: Equipment) => {
    setSelectedEquipmentMaintenance(eq);
    setMaintenanceForm({
      scheduledDate: '',
      type: 'routine',
      notes: '',
      reminderDays: 7,
    });
    setMaintenanceDialogOpen(true);
  };

  const handleScheduleMaintenance = async () => {
    if (!selectedEquipmentMaintenance || !maintenanceForm.scheduledDate) {
      showError(t('equip.toast.pickDate'));
      return;
    }
    try {
      // Create an availability block for maintenance
      await equipmentAvailabilityApi.create(selectedEquipmentMaintenance.id, {
        start_date: maintenanceForm.scheduledDate,
        end_date: maintenanceForm.scheduledDate,
        status: 'service',
        reason: `${maintenanceForm.type}: ${maintenanceForm.notes}`,
      });
      // Update equipment status if needed
      if (new Date(maintenanceForm.scheduledDate) <= new Date()) {
        await equipmentApi.update(selectedEquipmentMaintenance.id, { status: 'maintenance' });
      }
      seedGlobalMentions([maintenanceForm.notes], [selectedEquipmentMaintenance.name]);
      showSuccess(t('equip.toast.maintScheduled'));
      setMaintenanceDialogOpen(false);
      loadEquipment();
    } catch (error) {
      console.error('Maintenance scheduling error:', error);
      showError(t('equip.toast.maintFailed'));
    }
  };

  // 8. Booking creation
  const handleOpenCreateBooking = () => {
    if (!selectedEquipmentBookings) return;
    setBookingForm({
      startDate: '',
      endDate: '',
      purpose: '',
      notes: '',
    });
    setCreateBookingDialogOpen(true);
  };

  const handleCreateBooking = async () => {
    if (!selectedEquipmentBookings || !bookingForm.startDate || !bookingForm.endDate) {
      showError(t('equip.toast.fillDates'));
      return;
    }
    // Warn on conflicts but still allow creation (user-override flow)
    if (bookingConflicts.length > 0) {
      const ok = window.confirm(
        t('equip.confirm.bookingConflicts', { n: bookingConflicts.length })
      );
      if (!ok) return;
    }
    try {
      await equipmentBookingsApi.create(selectedEquipmentBookings.id, {
        start_date: bookingForm.startDate,
        end_date: bookingForm.endDate,
        purpose: bookingForm.purpose,
        notes: bookingForm.notes,
        status: 'pending',
      });
      seedGlobalMentions([bookingForm.notes, bookingForm.purpose], [selectedEquipmentBookings.name]);
      showSuccess(t('equip.toast.bookingCreated'));
      setBookingConflicts([]);
      setCreateBookingDialogOpen(false);
      handleOpenBookings(selectedEquipmentBookings);
    } catch (error) {
      console.error('Booking creation error:', error);
      showError(t('equip.toast.bookingFailed'));
    }
  };

  // Check for booking conflicts whenever both dates are filled
  const checkBookingConflicts = async (startDate: string, endDate: string) => {
    if (!selectedEquipmentBookings || !startDate || !endDate) {
      setBookingConflicts([]);
      return;
    }
    setConflictChecking(true);
    try {
      const { conflicts } = await equipmentConflictsApi.check(
        selectedEquipmentBookings.id, startDate, endDate
      );
      setBookingConflicts(conflicts);
    } catch {
      setBookingConflicts([]);
    } finally {
      setConflictChecking(false);
    }
  };

  // ── Check-out / Check-in ─────────────────────────────────
  const OUTBOX_KEY = `equipment_outbox_${projectId}`;

  const persistOfflineQueue = (q: OfflineEntry[]) => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(q));
    setOfflineQueue(q);
    setOfflineQueueCount(q.length);
  };

  const handleOpenCheckout = (eq: Equipment) => {
    setCheckoutEquipment(eq);
    setCheckoutForm({ crewId: '', quantity: 1, purpose: '' });
    setCheckoutDialogOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!checkoutEquipment || !checkoutForm.crewId) return;
    const payload: OfflineCheckoutEntry['payload'] = {
      equipmentId: checkoutEquipment.id,
      crewId: checkoutForm.crewId,
      quantity: checkoutForm.quantity,
      purpose: checkoutForm.purpose,
    };
    if (!isOnline) {
      const entry: OfflineCheckoutEntry = { id: crypto.randomUUID(), type: 'checkout', payload, ts: new Date().toISOString() };
      persistOfflineQueue([...offlineQueue, entry]);
      showSuccess(t('equip.toast.offlineSaved'));
      setCheckoutDialogOpen(false);
      return;
    }
    try {
      // Create the checkout record via the proper API, which also sets equipment status
      const checkout = await equipmentCheckoutApi.checkOut(checkoutEquipment.id, {
        checked_out_to: checkoutForm.crewId,
        quantity: checkoutForm.quantity,
        purpose: checkoutForm.purpose,
      });
      // If backend doesn't update status automatically, do it explicitly
      await equipmentApi.update(checkoutEquipment.id, { status: 'in_use' });
      setActiveCheckouts(prev => [...prev, checkout]);
      showSuccess(t('equip.toast.checkedOut', { name: checkoutEquipment.name }));
      setCheckoutDialogOpen(false);
      loadEquipment();
    } catch {
      // Fallback: update status directly if checkout API is not yet deployed
      try {
        await equipmentApi.update(checkoutEquipment.id, { status: 'in_use' });
        await equipmentApi.assign(checkoutEquipment.id, checkoutForm.crewId, 'responsible');
        showSuccess(t('equip.toast.checkedOutLocal', { name: checkoutEquipment.name }));
        setCheckoutDialogOpen(false);
        loadEquipment();
      } catch {
        showError(t('equip.toast.checkoutFailed'));
      }
    }
  };

  const handleOpenCheckin = (eq: Equipment) => {
    setCheckinEquipment(eq);
    setCheckinForm({ condition: eq.condition, notes: '' });
    setCheckinDialogOpen(true);
  };

  const handleConfirmCheckin = async () => {
    if (!checkinEquipment) return;
    const payload: OfflineCheckinEntry['payload'] = {
      equipmentId: checkinEquipment.id,
      condition: checkinForm.condition,
      notes: checkinForm.notes,
    };
    if (!isOnline) {
      const entry: OfflineCheckinEntry = { id: crypto.randomUUID(), type: 'checkin', payload, ts: new Date().toISOString() };
      persistOfflineQueue([...offlineQueue, entry]);
      showSuccess(t('equip.toast.offlineSaved'));
      setCheckinDialogOpen(false);
      return;
    }
    // Find the active checkout record for this equipment
    const activeCheckout = activeCheckouts.find(c => c.equipment_id === checkinEquipment.id);
    try {
      if (activeCheckout) {
        // Use the proper check-in API with the real checkout ID
        await equipmentCheckoutApi.checkIn(activeCheckout.id, {
          condition_on_return: checkinForm.condition,
          notes: checkinForm.notes || undefined,
        });
        setActiveCheckouts(prev => prev.filter(c => c.id !== activeCheckout.id));
      }
      // Always update equipment status and condition directly as well
      await equipmentApi.update(checkinEquipment.id, {
        status: 'available',
        condition: checkinForm.condition,
        notes: checkinForm.notes || undefined,
      });
      seedGlobalMentions([checkinForm.notes], [checkinEquipment.name]);
      showSuccess(t('equip.toast.checkedIn', { name: checkinEquipment.name }));
      setCheckinDialogOpen(false);
      loadEquipment();
    } catch {
      showError(t('equip.toast.checkinFailed'));
    }
  };

  /** Replay offline outbox when user is back online */
  const handleSyncOfflineQueue = async () => {
    if (!isOnline || offlineQueue.length === 0) return;
    let ok = 0;
    const failed: OfflineEntry[] = [];
    for (const entry of offlineQueue) {
      try {
        if (entry.type === 'checkout') {
          const { equipmentId, crewId, quantity, purpose } = entry.payload;
          await equipmentCheckoutApi.checkOut(equipmentId, {
            checked_out_to: crewId,
            quantity,
            purpose,
          });
          await equipmentApi.update(equipmentId, { status: 'in_use' });
        } else {
          const { equipmentId, condition, notes } = entry.payload;
          // Try to find active checkout to record proper check-in
          const checkout = activeCheckouts.find(c => c.equipment_id === equipmentId);
          if (checkout) {
            await equipmentCheckoutApi.checkIn(checkout.id, { condition_on_return: condition, notes: notes || undefined });
          }
          await equipmentApi.update(equipmentId, { status: 'available', condition });
        }
        ok++;
      } catch {
        failed.push(entry);
      }
    }
    persistOfflineQueue(failed);
    if (ok > 0) {
      loadEquipment();
      loadActiveCheckouts();
    }
    showSuccess(t('equip.toast.synced', { n: ok }) + (failed.length > 0 ? t('equip.toast.syncedFailed', { n: failed.length }) : ''));
  };

  // ── Reports ──────────────────────────────────────────────
  const downloadCSV = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadGearList = () => {
    const header = [t('equip.csv.name'), t('equip.csv.category'), t('equip.csv.brand'), t('equip.csv.model'), t('equip.csv.status'), t('equip.csv.condition'), t('equip.csv.quantity'), t('equip.csv.serial'), t('equip.csv.responsible')];
    const rows = equipment.map(eq => [
      eq.name, eq.category ?? '', eq.brand ?? '', eq.model ?? '',
      statusLabels[eq.status] ?? eq.status,
      conditionLabels[eq.condition] ?? eq.condition,
      String(eq.quantity), eq.serial_number ?? '',
      getCrewName(eq.assignees?.[0]?.crew_id ?? ''),
    ]);
    downloadCSV([header, ...rows], `gear-list-${projectId}.csv`);
  };

  const missingItems = useMemo(
    () => equipment.filter(eq => eq.status === 'available' && !eq.assignees?.length),
    [equipment]
  );

  const maintenanceItems = useMemo(
    () => equipment.filter(eq => eq.status === 'maintenance' || eq.condition === 'needs_repair'),
    [equipment]
  );

  // 9. Form validation

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = t('equip.valid.nameReq');
    } else if (formData.name.length < 2) {
      errors.name = t('equip.valid.nameShort');
    }
    
    if (formData.serialNumber && equipment.some(eq => 
      eq.serial_number === formData.serialNumber && eq.id !== editingEquipment?.id
    )) {
      errors.serialNumber = t('equip.valid.serialDup');
    }
    
    if (formData.quantity < 1) {
      errors.quantity = t('equip.valid.qtyMin');
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 10. Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const file = files[0];
      // TODO: Replace base64 data-URL storage with signed-URL upload to object storage
      //       (e.g. Supabase Storage / S3) to avoid bloating the database row.
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setFormData({ ...formData, imageUrl: dataUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredEquipment = useMemo(() => {
    let filtered = [...equipment];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(eq =>
        eq.name?.toLowerCase().includes(query) ||
        eq.description?.toLowerCase().includes(query) ||
        eq.brand?.toLowerCase().includes(query) ||
        eq.model?.toLowerCase().includes(query) ||
        eq.serial_number?.toLowerCase().includes(query)
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(eq => eq.category === categoryFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(eq => eq.status === statusFilter);
    }

    if (locationFilter !== 'all') {
      filtered = filtered.filter(eq => eq.primary_location_id === locationFilter);
    }

    filtered.sort((a, b) => {
      // Treat quantity as a number so that 0 sorts correctly (not as falsy empty string)
      if (sortField === 'quantity') {
        const aNum = typeof a.quantity === 'number' ? a.quantity : 0;
        const bNum = typeof b.quantity === 'number' ? b.quantity : 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      // Dato-felter: parse ISO-strenger til timestamps, robust mot null/empty
      if (sortField === 'created_at' || sortField === 'updated_at') {
        const aRaw = a[sortField] as string | null | undefined;
        const bRaw = b[sortField] as string | null | undefined;
        const aTs = aRaw ? new Date(aRaw).getTime() : 0;
        const bTs = bRaw ? new Date(bRaw).getTime() : 0;
        return sortDirection === 'asc' ? aTs - bTs : bTs - aTs;
      }
      let aVal: string = (a[sortField] as string | undefined) ?? '';
      let bVal: string = (b[sortField] as string | undefined) ?? '';
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [equipment, searchQuery, categoryFilter, statusFilter, locationFilter, sortField, sortDirection]);

  // Reset til side 1 når filtere endres så brukeren ikke ender opp på
  // en tom side etter aggressiv filtrering.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, statusFilter, locationFilter, sortField, sortDirection, pageSize]);

  // Pagination-derivat: total sider og current page-slice.
  const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginationStart = (safePage - 1) * pageSize;
  const paginationEnd = Math.min(filteredEquipment.length, paginationStart + pageSize);
  const pagedEquipment = useMemo(
    () => filteredEquipment.slice(paginationStart, paginationEnd),
    [filteredEquipment, paginationStart, paginationEnd],
  );

  // Categories for filter dropdown: combines equipment categories + custom categories
  const categories = useMemo(() => {
    const equipmentCats = new Set(
      equipment
        .map((eq) => eq.category)
        .filter((cat): cat is string => Boolean(cat && cat.trim()))
    );
    const allCats = new Set([...equipmentCats, ...customCategories]);
    return Array.from(allCats).sort();
  }, [equipment, customCategories]);

  // Per-category item counts for sidebar
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const eq of equipment) {
      const cat = eq.category || 'Annet';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [equipment]);

  // Items assigned/checked-out today
  const assignedToday = useMemo(() => {
    const today = new Date().toDateString();
    return equipment.filter((eq) => {
      const hasAssignment = (eq.assignees?.length ?? 0) > 0 || eq.status === 'in_use';
      const updatedAt = eq.updated_at ?? eq.created_at;
      if (!hasAssignment || !updatedAt) return false;
      return new Date(updatedAt).toDateString() === today;
    }).length;
  }, [equipment]);

  const equipmentProInsights = useMemo(() => {
    const available = equipment.filter((eq) => eq.status === 'available').length;
    const inUse = equipment.filter((eq) => eq.status === 'in_use').length;
    const service = equipment.filter((eq) => eq.status === 'maintenance').length;
    const retired = equipment.filter((eq) => eq.status === 'retired').length;
    const totalUnits = equipment.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const filteredUnits = filteredEquipment.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const visibleRatio = equipment.length > 0 ? Math.round((filteredEquipment.length / equipment.length) * 100) : 100;

    return {
      available,
      inUse,
      service,
      retired,
      totalUnits,
      filteredUnits,
      visibleRatio,
      missingOwners: missingItems.length,
      maintenance: maintenanceItems.length,
      warehouseIssues: warehouseIssueCount,
      offlineQueue: offlineQueueCount,
      assignedToday,
      catalogCameraCount: cameraCatalogItems.length,
      cameraCategoryCount: categories.filter((cat) => {
        const normalized = String(cat ?? '').trim().toLowerCase();
        if (!normalized) return false;
        return ['kamera', 'camera', 'cine', 'cinema', 'camcorder', 'mirrorless', 'dslr'].some((token) =>
          normalized.includes(token)
        );
      }).length,
    };
  }, [
    equipment,
    filteredEquipment,
    missingItems.length,
    maintenanceItems.length,
    warehouseIssueCount,
    offlineQueueCount,
    assignedToday,
    cameraCatalogItems.length,
    categories,
  ]);

  const showProOverview = proViewFocus === 'all' || proViewFocus === 'overview';
  const showProRisks = proViewFocus === 'all' || proViewFocus === 'risks';
  const showProOperations = proViewFocus === 'all' || proViewFocus === 'operations';
  const showProCatalog = proViewFocus === 'all' || proViewFocus === 'catalog';

  const proActionItems = useMemo<EquipmentProActionItem[]>(() => {
    const items: EquipmentProActionItem[] = [];

    if (equipmentProInsights.missingOwners > 0) {
      items.push({
        id: 'missing-owners',
        title: t('equip.pro.assignOwner'),
        detail: t('equip.pro.assignOwnerDetail', { n: equipmentProInsights.missingOwners }),
        focus: 'risks',
        severity: 'high',
      });
    }

    if (equipmentProInsights.maintenance > 0) {
      items.push({
        id: 'maintenance',
        title: t('equip.pro.serviceWindow'),
        detail: t('equip.pro.serviceWindowDetail', { n: equipmentProInsights.maintenance }),
        focus: 'risks',
        severity: 'medium',
      });
    }

    if (equipmentProInsights.warehouseIssues > 0) {
      items.push({
        id: 'warehouse',
        title: t('equip.pro.warehouseIssues'),
        detail: t('equip.pro.warehouseIssuesDetail', { n: equipmentProInsights.warehouseIssues }),
        focus: 'operations',
        severity: 'medium',
      });
    }

    if (equipmentProInsights.offlineQueue > 0) {
      items.push({
        id: 'offline-sync',
        title: isOnline ? t('equip.pro.syncQueue') : t('equip.pro.reviewQueue'),
        detail: t('equip.pro.queueDetail', { n: equipmentProInsights.offlineQueue }),
        focus: 'operations',
        severity: isOnline ? 'medium' : 'high',
      });
    }

    items.push({
      id: 'catalog-sync',
      title: t('equip.pro.syncCatalog'),
      detail: t('equip.pro.syncCatalogDetail', { n: equipmentProInsights.catalogCameraCount }),
      focus: 'catalog',
      severity: 'low',
    });

    return items.slice(0, 5);
  }, [
    t,
    equipmentProInsights.missingOwners,
    equipmentProInsights.maintenance,
    equipmentProInsights.warehouseIssues,
    equipmentProInsights.offlineQueue,
    equipmentProInsights.catalogCameraCount,
    isOnline,
  ]);

  const handleProActionClick = useCallback((action: EquipmentProActionItem) => {
    setProViewFocus(action.focus);

    if (action.id === 'missing-owners') {
      setReportsTab(1);
      setReportsDialogOpen(true);
      return;
    }

    if (action.id === 'maintenance') {
      setReportsTab(2);
      setReportsDialogOpen(true);
      return;
    }

    if (action.id === 'warehouse') {
      setWarehouseDialogOpen(true);
      return;
    }

    if (action.id === 'offline-sync') {
      if (isOnline && offlineQueueCount > 0) {
        void handleSyncOfflineQueue();
      } else {
        setOfflineOutboxOpen(true);
      }
      return;
    }

    setCatalogBridgeOpen(true);
    setCatalogDialogTab(4);
  }, [isOnline, offlineQueueCount, handleSyncOfflineQueue]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // O(1) lookups — avoids O(n) linear search on every render
  const crewById = useMemo(
    () => new Map(crewMembers.map(c => [c.id, c])),
    [crewMembers]
  );
  const locationById = useMemo(
    () => new Map(locations.map(l => [l.id, l])),
    [locations]
  );

  const getCrewName = (crewId: string) => crewById.get(crewId)?.name ?? t('equip.unknown');
  const getLocationName = (locationId: string) => locationById.get(locationId)?.name ?? '';

  // Category icon colors for visual enhancement
  const getCategoryColor = (category: string | undefined): string => {
    const colorMap: Record<string, string> = {
      camera: '#e91e63',
      kamera: '#e91e63',
      lighting: '#ffeb3b',
      lys: '#ffeb3b',
      audio: '#9c27b0',
      lyd: '#9c27b0',
      grip: '#795548',
      rig: '#795548',
      safety: '#7c3aed',
      sikkerhet: '#7c3aed',
      transport: '#607d8b',
      props: '#00bcd4',
      wardrobe: '#3f51b5',
      makeup: '#f06292',
      linse: '#2196f3',
      optikk: '#00bcd4',
      stativ: '#8d6e63',
      strøm: '#ffc107',
      annet: '#9e9e9e',
      default: '#9e9e9e',
    };
    return colorMap[category?.toLowerCase() || 'default'] || colorMap.default;
  };

  return (
    <Box sx={{ p: containerPadding }}>
      {loading && <LinearProgress sx={{ mb: 2, bgcolor: 'rgba(147,51,234,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#9333ea' } }} />}
      
      {/* Header with gradient background */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', 
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
        p: 2,
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(109,40,217,0.1) 100%)',
        border: '1px solid rgba(147,51,234,0.2)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(147,51,234,0.3)',
          }}>
            <BuildIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ 
              fontWeight: 700, 
              color: '#fff',
              fontSize: isDesktop ? '1.5rem' : isTablet ? '1.25rem' : '1.1rem',
            }}>{t('equip.h.catalog')}</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {t('equip.header.count', { shown: filteredEquipment.length, total: equipment.length })}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant={workspaceView === 'standard' ? 'contained' : 'outlined'}
            onClick={() => setWorkspaceView('standard')}
            sx={{
              minHeight: TOUCH_TARGET_SIZE,
              bgcolor: workspaceView === 'standard' ? 'rgba(147,51,234,0.24)' : 'transparent',
              color: '#fff',
              borderColor: workspaceView === 'standard' ? '#c084fc' : 'rgba(255,255,255,0.2)',
              '&:hover': {
                bgcolor: workspaceView === 'standard' ? 'rgba(147,51,234,0.3)' : 'rgba(255,255,255,0.08)',
                borderColor: '#c084fc',
              },
              ...focusVisibleStyles,
            }}
          >
            Standard
          </Button>
          <Button
            variant={workspaceView === 'pro' ? 'contained' : 'outlined'}
            onClick={() => setWorkspaceView('pro')}
            sx={{
              minHeight: TOUCH_TARGET_SIZE,
              bgcolor: workspaceView === 'pro' ? 'rgba(147,51,234,0.24)' : 'transparent',
              color: '#fff',
              borderColor: workspaceView === 'pro' ? '#c084fc' : 'rgba(255,255,255,0.2)',
              '&:hover': {
                bgcolor: workspaceView === 'pro' ? 'rgba(147,51,234,0.3)' : 'rgba(255,255,255,0.08)',
                borderColor: '#c084fc',
              },
              ...focusVisibleStyles,
            }}
          >
            Pro view
          </Button>
          <Tooltip title={t('equip.tt.refresh')}>
            <IconButton
              onClick={loadEquipment}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', transform: 'rotate(180deg)', transition: 'transform 0.3s' },
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('equip.tt.filter')}>
            <IconButton
              onClick={() => setFilterOpen(!filterOpen)}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: filterOpen ? 'rgba(147,51,234,0.2)' : 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(147,51,234,0.2)' },
              }}
            >
              <FilterIcon sx={{ color: filterOpen ? '#9333ea' : 'inherit' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={viewMode === 'grid' ? t('equip.tt.tableView') : t('equip.tt.gridView')}>
            <IconButton
              onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              {viewMode === 'grid' ? <TableViewIcon /> : <GridViewIcon />}
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateTypeDialog}
            sx={{
              background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
              color: '#fff',
              fontWeight: 600,
              minHeight: TOUCH_TARGET_SIZE,
              boxShadow: '0 4px 12px rgba(147,51,234,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                boxShadow: '0 6px 16px rgba(147,51,234,0.4)',
              },
              ...focusVisibleStyles,
            }}
          >{t('equip.btn.newEquip')}</Button>
          <Tooltip title={t('equip.tt.templates')}>
            <Button
              variant="outlined"
              startIcon={<BookmarkIcon />}
              onClick={() => {
                blurFocusedElement();
                setTemplatesDialogOpen(true);
              }}
              sx={{
                borderColor: '#4caf50',
                color: '#4caf50',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#66bb6a', bgcolor: 'rgba(76,175,80,0.1)' },
                ...focusVisibleStyles,
              }}
            >{t('equip.btn.templates')}</Button>
          </Tooltip>
          <Tooltip title={t('equip.tt.catalog')}>
            <Button
              variant="outlined"
              startIcon={<SearchIcon />}
              onClick={() => {
                blurFocusedElement();
                setGearNewsUnavailable(false);
                setMarketPricesUnavailable(false);
                setLensDbUnavailable(false);
                setCameraCatalogUnavailable(false);
                setMemoryCardsUnavailable(false);
                setCatalogBridgeOpen(true);
              }}
              sx={{
                borderColor: '#9333ea',
                color: '#9333ea',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#c084fc', bgcolor: 'rgba(147,51,234,0.1)' },
                ...focusVisibleStyles,
              }}
            >{t('equip.btn.catalog')}</Button>
          </Tooltip>
          <Tooltip title={t('equip.tt.warehouse')}>
            <Button
              variant="outlined"
              startIcon={<Inventory2Icon />}
              onClick={() => {
                blurFocusedElement();
                setWarehouseDialogOpen(true);
              }}
              sx={{
                borderColor: warehouseIssueCount > 0 ? '#ef5350' : '#c084fc',
                color: warehouseIssueCount > 0 ? '#ef5350' : '#c084fc',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': {
                  borderColor: warehouseIssueCount > 0 ? '#ef5350' : '#d8b4fe',
                  bgcolor: warehouseIssueCount > 0 ? 'rgba(239,83,80,0.1)' : 'rgba(192,132,252,0.1)',
                },
                ...focusVisibleStyles,
              }}
            >
              {warehouseIssueCount > 0 ? t('equip.btn.warehouseN', { n: warehouseIssueCount }) : t('equip.btn.warehouse')}
            </Button>
          </Tooltip>
          <Tooltip title={t('equip.tt.scanQr')}>
            <Button
              variant="outlined"
              startIcon={<QrCodeScannerIcon />}
              onClick={() => {
                blurFocusedElement();
                setQrScanInput('');
                setQrScanError(null);
                setQrScanDialogOpen(true);
              }}
              sx={{
                borderColor: '#64b5f6',
                color: '#64b5f6',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#90caf9', bgcolor: 'rgba(100,181,246,0.1)' },
                ...focusVisibleStyles,
              }}
            >{t('equip.btn.scanQr')}</Button>
          </Tooltip>
          <Tooltip title={t('equip.tt.firmware')}>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={() => {
                blurFocusedElement();
                setFirmwarePanelOpen(true);
              }}
              sx={{
                borderColor: '#2196f3',
                color: '#2196f3',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#64b5f6', bgcolor: 'rgba(33,150,243,0.1)' },
                ...focusVisibleStyles,
              }}
            >{t('equip.btn.firmware')}</Button>
          </Tooltip>
          <Tooltip title={t('equip.tt.reports')}>
            <Button
              variant="outlined"
              startIcon={<ReportIcon />}
              onClick={() => {
                blurFocusedElement();
                setReportsDialogOpen(true);
              }}
              sx={{
                borderColor: '#9c27b0',
                color: '#9c27b0',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#ba68c8', bgcolor: 'rgba(156,39,176,0.1)' },
                ...focusVisibleStyles,
              }}
            >{t('equip.btn.reports')}</Button>
          </Tooltip>
          {offlineQueueCount > 0 && (
            <Tooltip title={isOnline ? t('equip.tt.offlinePending', { n: offlineQueueCount }) : t('equip.tt.offlineQueued', { n: offlineQueueCount })}>
              <Button
                variant="outlined"
                startIcon={isOnline ? <SyncIcon /> : <OfflineIcon />}
                onClick={isOnline
                  ? handleSyncOfflineQueue
                  : () => {
                      blurFocusedElement();
                      setOfflineOutboxOpen(true);
                    }}
                sx={{
                  borderColor: isOnline ? '#9333ea' : '#f44336',
                  color: isOnline ? '#9333ea' : '#f44336',
                  minHeight: TOUCH_TARGET_SIZE,
                  animation: isOnline ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.6 },
                    '100%': { opacity: 1 },
                  },
                  '&:hover': { bgcolor: isOnline ? 'rgba(147,51,234,0.1)' : 'rgba(244,67,54,0.1)' },
                  ...focusVisibleStyles,
                }}
              >
                {t('equip.btn.inQueue', { n: offlineQueueCount })}
              </Button>
            </Tooltip>
          )}
          <Tooltip title={t('equip.tt.shop')}>
            <Button
              variant="outlined"
              startIcon={<ShoppingCartIcon />}
              onClick={handleOpenShopDialog}
              sx={{
                borderColor: '#9333ea',
                color: '#c084fc',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#c084fc', bgcolor: 'rgba(147,51,234,0.14)' },
                ...focusVisibleStyles,
              }}
            >{t('equip.btn.buy')}</Button>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
          <Tooltip title={t('equip.tt.exportCsv')}>
            <IconButton
              onClick={handleExportCSV}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(76,175,80,0.15)', color: '#4caf50' },
              }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('equip.tt.importCsv')}>
            <IconButton
              component="label"
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(33,150,243,0.15)', color: '#2196f3' },
              }}
            >
              <UploadIcon />
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={handleImportCSV}
              />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Bulk Actions Bar */}
        {selectedEquipmentIds.size > 0 && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            p: 1.5, 
            mt: 1.5,
            bgcolor: 'rgba(147,51,234,0.1)', 
            borderRadius: 2,
            border: '1px solid rgba(147,51,234,0.3)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckboxIcon sx={{ color: '#9333ea' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('equip.bulk.selected', { n: selectedEquipmentIds.size })}
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={toggleSelectAll}
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            >
              {selectedEquipmentIds.size === filteredEquipment.length ? t('equip.btn.deselectAll') : t('equip.btn.selectAll')}
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => handleBulkAction('status')}
              sx={{ color: '#9333ea', '&:hover': { bgcolor: 'rgba(147,51,234,0.15)' } }}
            >{t('equip.btn.changeStatus')}</Button>
            <Button
              size="small"
              startIcon={<CalendarTodayIcon />}
              onClick={() => handleBulkAction('assign')}
              sx={{ color: '#4caf50', '&:hover': { bgcolor: 'rgba(76,175,80,0.15)' } }}
            >{t('equip.btn.assignDay')}</Button>
            <Button
              size="small"
              startIcon={<PersonIcon />}
              onClick={() => handleBulkAction('assign')}
              sx={{ color: '#2196f3', '&:hover': { bgcolor: 'rgba(33,150,243,0.15)' } }}
            >{t('equip.btn.assign')}</Button>
            <Button
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => handleBulkAction('delete')}
              sx={{ color: '#f44336', '&:hover': { bgcolor: 'rgba(244,67,54,0.15)' } }}
            >{t('equip.btn.delSelected')}</Button>
            <IconButton
              size="small"
              onClick={() => setSelectedEquipmentIds(new Set())}
              aria-label={t('equip.aria.removeSelection')}
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {workspaceView === 'pro' && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 3,
            border: '1px solid rgba(192,132,252,0.35)',
            background: 'linear-gradient(140deg, rgba(15,23,42,0.82) 0%, rgba(45,27,78,0.58) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.98rem' }}>{t('equip.h.proCenter')}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>{t('equip.pro.subtitle')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {[
                { value: 'all', label: t('equip.pro.focusAll') },
                { value: 'overview', label: t('equip.pro.focusOverview') },
                { value: 'risks', label: t('equip.pro.focusRisks') },
                { value: 'operations', label: t('equip.pro.focusOps') },
                { value: 'catalog', label: t('equip.pro.focusCatalog') },
              ].map((focusOption) => {
                const active = proViewFocus === focusOption.value;
                return (
                  <Button
                    key={focusOption.value}
                    size="small"
                    variant={active ? 'contained' : 'outlined'}
                    onClick={() => setProViewFocus(focusOption.value as EquipmentProFocus)}
                    sx={{
                      minHeight: 32,
                      textTransform: 'none',
                      bgcolor: active ? 'rgba(147,51,234,0.3)' : 'transparent',
                      borderColor: active ? '#c084fc' : 'rgba(148,163,184,0.35)',
                      color: '#fff',
                      '&:hover': {
                        bgcolor: active ? 'rgba(147,51,234,0.38)' : 'rgba(148,163,184,0.12)',
                        borderColor: '#c084fc',
                      },
                    }}
                  >
                    {focusOption.label}
                  </Button>
                );
              })}
            </Box>
          </Box>

          {showProOverview && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { label: t('equip.pro.statAvailable'), value: equipmentProInsights.available, color: '#4caf50' },
                { label: t('equip.pro.statInUse'), value: equipmentProInsights.inUse, color: '#64b5f6' },
                { label: t('equip.pro.statService'), value: equipmentProInsights.service, color: '#ffb74d' },
                { label: t('equip.pro.statVisible'), value: `${equipmentProInsights.visibleRatio}%`, color: '#c084fc' },
                { label: t('equip.pro.statCamCats'), value: equipmentProInsights.cameraCategoryCount, color: '#a78bfa' },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    minWidth: 116,
                    flex: '1 1 116px',
                    p: 1,
                    borderRadius: 1.5,
                    border: `1px solid ${item.color}55`,
                    bgcolor: `${item.color}18`,
                  }}
                >
                  <Typography sx={{ color: item.color, fontSize: '0.72rem', fontWeight: 700 }}>{item.label}</Typography>
                  <Typography sx={{ color: '#fff', fontSize: '1rem', fontWeight: 800 }}>{item.value}</Typography>
                </Box>
              ))}
            </Box>
          )}

          {showProRisks && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => handleProActionClick({ id: 'missing-owners', title: '', detail: '', focus: 'risks', severity: 'high' })}
                sx={{
                  flex: '1 1 260px',
                  minHeight: 42,
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  borderColor: equipmentProInsights.missingOwners > 0 ? 'rgba(244,67,54,0.65)' : 'rgba(148,163,184,0.35)',
                  color: '#fff',
                  bgcolor: equipmentProInsights.missingOwners > 0 ? 'rgba(244,67,54,0.12)' : 'rgba(148,163,184,0.08)',
                }}
              >
                <span>{t('equip.pro.missing')}</span>
                <strong>{equipmentProInsights.missingOwners}</strong>
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleProActionClick({ id: 'maintenance', title: '', detail: '', focus: 'risks', severity: 'medium' })}
                sx={{
                  flex: '1 1 260px',
                  minHeight: 42,
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  borderColor: equipmentProInsights.maintenance > 0 ? 'rgba(255,152,0,0.62)' : 'rgba(148,163,184,0.35)',
                  color: '#fff',
                  bgcolor: equipmentProInsights.maintenance > 0 ? 'rgba(255,152,0,0.12)' : 'rgba(148,163,184,0.08)',
                }}
              >
                <span>{t('equip.pro.serviceRep')}</span>
                <strong>{equipmentProInsights.maintenance}</strong>
              </Button>
            </Box>
          )}

          {showProOperations && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => setWarehouseDialogOpen(true)}
                sx={{
                  flex: '1 1 260px',
                  minHeight: 42,
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  borderColor: equipmentProInsights.warehouseIssues > 0 ? 'rgba(244,67,54,0.65)' : 'rgba(148,163,184,0.35)',
                  color: '#fff',
                  bgcolor: equipmentProInsights.warehouseIssues > 0 ? 'rgba(244,67,54,0.12)' : 'rgba(148,163,184,0.08)',
                }}
              >
                <span>{t('equip.pro.warehouseSpan')}</span>
                <strong>{equipmentProInsights.warehouseIssues}</strong>
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  if (isOnline && equipmentProInsights.offlineQueue > 0) {
                    void handleSyncOfflineQueue();
                  } else {
                    setOfflineOutboxOpen(true);
                  }
                }}
                sx={{
                  flex: '1 1 260px',
                  minHeight: 42,
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  borderColor: equipmentProInsights.offlineQueue > 0 ? 'rgba(147,51,234,0.65)' : 'rgba(148,163,184,0.35)',
                  color: '#fff',
                  bgcolor: equipmentProInsights.offlineQueue > 0 ? 'rgba(147,51,234,0.12)' : 'rgba(148,163,184,0.08)',
                }}
              >
                <span>{isOnline ? t('equip.pro.offlineSync') : t('equip.pro.offline')}</span>
                <strong>{equipmentProInsights.offlineQueue}</strong>
              </Button>
            </Box>
          )}

          {showProCatalog && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setCatalogBridgeOpen(true);
                  setCatalogDialogTab(4);
                }}
                sx={{
                  flex: '1 1 260px',
                  minHeight: 42,
                  justifyContent: 'space-between',
                  textTransform: 'none',
                  borderColor: 'rgba(100,181,246,0.5)',
                  color: '#fff',
                  bgcolor: 'rgba(33,150,243,0.12)',
                }}
              >
                <span>{t('equip.pro.camsInCatalog')}</span>
                <strong>{equipmentProInsights.catalogCameraCount}</strong>
              </Button>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {proActionItems.map((action) => {
              const tone =
                action.severity === 'high'
                  ? { border: 'rgba(244,67,54,0.6)', bg: 'rgba(244,67,54,0.12)' }
                  : action.severity === 'medium'
                  ? { border: 'rgba(255,152,0,0.55)', bg: 'rgba(255,152,0,0.12)' }
                  : { border: 'rgba(76,175,80,0.5)', bg: 'rgba(76,175,80,0.12)' };
              return (
                <Button
                  key={action.id}
                  variant="outlined"
                  onClick={() => handleProActionClick(action)}
                  sx={{
                    textTransform: 'none',
                    justifyContent: 'flex-start',
                    borderColor: tone.border,
                    bgcolor: tone.bg,
                    color: '#fff',
                    minHeight: 36,
                  }}
                >
                  {action.title}
                </Button>
              );
            })}
          </Box>
        </Box>
      )}

      {/* 5-stat-pill-rad — bruker shared RoleStatPillRow-primitive */}
      {equipment.length > 0 && (() => {
        const totalItems = equipment.length;
        const availableCount = equipment.filter((eq) => eq.status === 'available').length;
        const reservedCount = equipment.filter((eq) => eq.status === 'in_use').length;
        const maintenanceCount = equipment.filter((eq) => eq.status === 'maintenance').length;
        const inStockCount = Math.max(0, totalItems - reservedCount - maintenanceCount);
        return (
          <Box sx={{ mb: 2, px: 1 }}>
            <RoleStatPillRow
              pills={[
                { icon: <Inventory2Icon />, count: totalItems, label: t('equip.pill.total'), color: '#a78bfa' },
                { icon: <CheckCircleIcon />, count: availableCount, label: t('equip.pill.available'), color: '#10b981' },
                { icon: <ScheduleIcon />, count: reservedCount, label: t('equip.pill.reserved'), color: '#f59e0b' },
                { icon: <MaintenanceIcon />, count: maintenanceCount, label: t('equip.pill.maintenance'), color: '#ef4444' },
                { icon: <WarehouseIcon />, count: inStockCount, label: t('equip.pill.stock'), color: '#60a5fa' },
              ]}
            />
          </Box>
        );
      })()}

      {/* Compact Stats Bar */}
      {equipment.length > 0 && (
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          px: 1,
          flexWrap: 'wrap',
        }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '0.85rem' }}>
            {t('equip.stats.total', { n: equipment.reduce((s, e) => s + (e.quantity || 1), 0) })}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>·</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
            {t('equip.stats.showing', { n: filteredEquipment.length })}
          </Typography>
          {assignedToday > 0 && (
            <>
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>·</Typography>
              <Typography variant="body2" sx={{ color: '#4caf50', fontSize: '0.85rem', fontWeight: 600 }}>
                {t('equip.stats.assignedToday', { n: assignedToday })}
              </Typography>
            </>
          )}
          {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <>
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>·</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>
                {t('equip.stats.filteredFrom', { n: equipment.length })}
              </Typography>
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title={sidebarOpen ? t('equip.tt.hideCats') : t('equip.tt.showCats')}>
            <IconButton
              size="small"
              onClick={() => setSidebarOpen(prev => !prev)}
              sx={{
                color: sidebarOpen ? '#9333ea' : 'rgba(255,255,255,0.5)',
                bgcolor: sidebarOpen ? 'rgba(147,51,234,0.12)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(147,51,234,0.15)' },
                borderRadius: 1,
                p: 0.5,
              }}
            >
              <FilterIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Sidebar + Main content row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        {/* ── Category Sidebar ── */}
        {!isMobile && sidebarOpen && equipment.length > 0 && (
          <Box sx={{
            width: 220,
            flexShrink: 0,
            bgcolor: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 3,
            p: 1.5,
            position: 'sticky',
            top: 16,
          }}>
            <Typography variant="overline" sx={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              px: 1,
              display: 'block',
              mb: 1,
            }}>{t('equip.side.categories')}</Typography>

            {/* All equipment row */}
            <Box
              onClick={() => setCategoryFilter('all')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                py: 0.75,
                borderRadius: 1.5,
                cursor: 'pointer',
                bgcolor: categoryFilter === 'all' ? 'rgba(147,51,234,0.18)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' },
                transition: 'background 0.15s',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BuildIcon sx={{ fontSize: 15, color: categoryFilter === 'all' ? '#9333ea' : 'rgba(255,255,255,0.5)' }} />
                <Typography variant="body2" sx={{ color: categoryFilter === 'all' ? '#c084fc' : 'rgba(255,255,255,0.8)', fontWeight: categoryFilter === 'all' ? 700 : 400, fontSize: '0.82rem' }}>{t('equip.side.all')}</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>
                {equipment.length}
              </Typography>
            </Box>

            {/* Per-category rows */}
            {categories.map(cat => {
              const count = categoryCounts[cat] || 0;
              const isExpanded = expandedCategories.has(cat);
              const isActive = categoryFilter === cat;
              return (
                <Box key={cat}>
                  <Box
                    onClick={() => {
                      setCategoryFilter(isActive ? 'all' : cat);
                      setExpandedCategories(prev => {
                        const next = new Set(prev);
                        if (isExpanded) {
                          next.delete(cat);
                        } else {
                          next.add(cat);
                        }
                        return next;
                      });
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 1,
                      py: 0.75,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      bgcolor: isActive ? 'rgba(147,51,234,0.18)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' },
                      transition: 'background 0.15s',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getCategoryColor(cat), flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: isActive ? '#c084fc' : 'rgba(255,255,255,0.8)', fontWeight: isActive ? 700 : 400, fontSize: '0.82rem' }}>
                        {cat}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: isActive ? '#c084fc' : 'rgba(255,255,255,0.35)', fontSize: '0.72rem', fontWeight: isActive ? 700 : 400 }}>
                      {count}
                    </Typography>
                  </Box>

                  {/* Expanded: show first 5 items in this category */}
                  {isExpanded && (
                    <Box sx={{ pl: 2.5, pb: 0.5 }}>
                      {equipment
                        .filter(e => e.category === cat)
                        .slice(0, 5)
                        .map(e => (
                          <Box
                            key={e.id}
                            onClick={(ev) => { ev.stopPropagation(); handleOpenDialog(e); }}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              py: 0.4,
                              px: 0.5,
                              borderRadius: 1,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'rgba(147,51,234,0.08)' },
                            }}
                          >
                            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: getCategoryColor(cat), flexShrink: 0 }} />
                            <Typography
                              variant="caption"
                              sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {e.name}
                            </Typography>
                          </Box>
                        ))}
                      {equipment.filter(e => e.category === cat).length > 5 && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', pl: 0.5 }}>
                          {t('equip.side.more', { n: equipment.filter(e => e.category === cat).length - 5 })}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}

            <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.07)' }} />

            {/* Maintenance shortcut */}
            <Box
              onClick={() => setStatusFilter('maintenance')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                py: 0.75,
                borderRadius: 1.5,
                cursor: 'pointer',
                bgcolor: statusFilter === 'maintenance' ? 'rgba(255,152,0,0.15)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255,152,0,0.1)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon sx={{ fontSize: 15, color: '#ff9800' }} />
                <Typography variant="body2" sx={{ color: statusFilter === 'maintenance' ? '#ffb74d' : 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{t('equip.side.maintenance')}</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,152,0,0.7)', fontSize: '0.72rem' }}>
                {equipment.filter(e => e.status === 'maintenance').length}
              </Typography>
            </Box>

            {/* Help / Tips */}
            <Box
              onClick={() => setFilterOpen(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <BookmarkIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>{t('equip.side.help')}</Typography>
            </Box>
          </Box>
        )}

        {/* ── Main content column ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>

      <Collapse in={filterOpen}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2, 
          mb: 3,
          p: 2.5,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          borderRadius: 3,
          border: '1px solid rgba(148,163,184,0.22)',
          backdropFilter: 'blur(10px)',
        }}>
          <TextField
            placeholder={t('equip.ph.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9333ea' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0,0,0,0.2)',
                color: '#fff',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#9333ea' },
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.category')}</InputLabel>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              label={t('equip.lbl.category')}
              sx={{ 
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' }
                }
              }}
            >
              <MenuItem value="all">{t('equip.filter.allCats')}</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getCategoryColor(cat) }} />
                    {cat}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.status')}</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label={t('equip.lbl.status')}
              sx={{ 
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' }
                }
              }}
            >
              <MenuItem value="all">{t('equip.filter.allStatuses')}</MenuItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[value] }} />
                    {label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.location')}</InputLabel>
            <Select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              label={t('equip.lbl.location')}
              sx={{
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' },
                },
              }}
            >
              <MenuItem value="all">{t('equip.filter.allLocs')}</MenuItem>
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationIcon sx={{ fontSize: 14, color: 'rgba(147,51,234,0.7)' }} />
                    {loc.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.sort')}</InputLabel>
            <Select
              value={`${sortField}:${sortDirection}`}
              onChange={(e) => {
                const raw = String(e.target.value);
                const [field, dir] = raw.split(':') as [SortField, 'asc' | 'desc'];
                setSortField(field);
                setSortDirection(dir);
              }}
              label={t('equip.lbl.sort')}
              sx={{
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' },
                },
              }}
            >
              <MenuItem value="updated_at:desc">{t('equip.sort.newest')}</MenuItem>
              <MenuItem value="updated_at:asc">{t('equip.sort.oldest')}</MenuItem>
              <MenuItem value="created_at:desc">{t('equip.sort.recent')}</MenuItem>
              <MenuItem value="name:asc">{t('equip.sort.nameAsc')}</MenuItem>
              <MenuItem value="name:desc">{t('equip.sort.nameDesc')}</MenuItem>
              <MenuItem value="category:asc">{t('equip.sort.catAsc')}</MenuItem>
              <MenuItem value="status:asc">Status</MenuItem>
              <MenuItem value="quantity:desc">{t('equip.sort.qtyDesc')}</MenuItem>
              <MenuItem value="quantity:asc">{t('equip.sort.qtyAsc')}</MenuItem>
            </Select>
          </FormControl>
          {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || locationFilter !== 'all') && (
            <Button
              variant="text"
              size="small"
              startIcon={<CancelIcon />}
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              sx={{ 
                color: 'rgba(255,255,255,0.87)',
                '&:hover': { color: '#f44336' },
              }}
            >{t('equip.btn.reset')}</Button>
          )}
        </Box>
      </Collapse>

      {/* Active filter chips */}
      {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {searchQuery && (
            <Chip
              label={t('equip.chip.search', { q: searchQuery })}
              size="small"
              onDelete={() => setSearchQuery('')}
              sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc', borderColor: 'rgba(147,51,234,0.3)', border: '1px solid' }}
            />
          )}
          {categoryFilter !== 'all' && (
            <Chip
              label={t('equip.chip.category', { cat: categoryFilter })}
              size="small"
              icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getCategoryColor(categoryFilter), ml: '8px !important' }} />}
              onDelete={() => setCategoryFilter('all')}
              sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc', borderColor: 'rgba(147,51,234,0.3)', border: '1px solid' }}
            />
          )}
          {statusFilter !== 'all' && (
            <Chip
              label={statusLabels[statusFilter as keyof typeof statusLabels] ?? statusFilter}
              size="small"
              onDelete={() => setStatusFilter('all')}
              sx={{ bgcolor: `${STATUS_COLORS[statusFilter as keyof typeof STATUS_COLORS] ?? '#9333ea'}20`, color: STATUS_COLORS[statusFilter as keyof typeof STATUS_COLORS] ?? '#c084fc', border: `1px solid ${STATUS_COLORS[statusFilter as keyof typeof STATUS_COLORS] ?? '#9333ea'}40` }}
            />
          )}
          <Chip
            label={t('equip.chip.reset')}
            size="small"
            onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setStatusFilter('all'); setLocationFilter('all'); }}
            sx={{ bgcolor: 'transparent', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)', border: '1px solid', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }, cursor: 'pointer' }}
          />
        </Box>
      )}

      {viewMode === 'grid' ? (
        <Grid container spacing={2.5}>
          {filteredEquipment.length === 0 ? (
            <Grid
              item
              xs={12}
              sx={{
                width: '100%',
                flexBasis: '100%',
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  minHeight: { xs: 420, md: '56vh' },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', display: 'flex', justifyContent: 'center' }}>
                  <RoleRoomEmptyState
                    iconSrc={equipPng}
                    title={t('equip.empty.title')}
                    subtitle={searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                      ? t('equip.empty.tryFilters')
                      : t('equip.empty.addFirst')}
                    color="#9333ea"
                    buttonLabel={t('equip.empty.addBtn')}
                    onAction={handleOpenCreateTypeDialog}
                  />
                </Box>
              </Box>
            </Grid>
          ) : (
            pagedEquipment.map((eq, index) => {
              const warehouseTotals = warehouseStockByItem[eq.id];
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={eq.id}>
              <Grow in timeout={200 + index * 50}>
              <Card sx={{
                bgcolor: 'rgba(28, 33, 40, 0.8)',
                backdropFilter: 'blur(10px)',
                border: selectedEquipmentIds.has(eq.id) 
                  ? '2px solid #9333ea' 
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                position: 'relative',
                '&:hover': {
                  borderColor: selectedEquipmentIds.has(eq.id) ? '#c084fc' : 'rgba(147,51,234,0.5)',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(147,51,234,0.2)',
                },
              }}>
                {/* Selection checkbox */}
                <Box sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 10,
                }}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); toggleSelectEquipment(eq.id); }}
                    aria-label={selectedEquipmentIds.has(eq.id) ? t('equip.aria.deselect', { name: eq.name }) : t('equip.aria.select', { name: eq.name })}
                    sx={{
                      bgcolor: selectedEquipmentIds.has(eq.id) ? '#9333ea' : 'rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(4px)',
                      '&:hover': { bgcolor: selectedEquipmentIds.has(eq.id) ? '#c084fc' : 'rgba(0,0,0,0.7)' },
                    }}
                  >
                    {selectedEquipmentIds.has(eq.id)
                      ? <CheckboxIcon sx={{ fontSize: 18, color: '#fff' }} />
                      : <CheckboxOutlineIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.87)' }} />
                    }
                  </IconButton>
                </Box>
                {/* Favoritt-stjerne top-right (toggle, persisteres til DB + localStorage) */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 10,
                  }}
                >
                  <Tooltip
                    title={favorites.has(eq.id) ? t('equip.fav.remove', { name: eq.name }) : t('equip.fav.add', { name: eq.name })}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEquipmentFavorite(eq.id);
                      }}
                      aria-label={favorites.has(eq.id) ? t('equip.fav.remove', { name: eq.name }) : t('equip.fav.add', { name: eq.name })}
                      sx={{
                        bgcolor: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        color: favorites.has(eq.id) ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                        transition: 'transform 160ms ease-out, color 160ms ease-out',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: favorites.has(eq.id) ? '#fcd34d' : '#fbbf24',
                          transform: 'scale(1.08)',
                        },
                      }}
                    >
                      {favorites.has(eq.id) ? (
                        <StarIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <StarBorderIcon sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
                {/* Equipment Image with overlay */}
                <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                  {eq.image_url ? (
                    <>
                      <CardMedia
                        component="img"
                        height="160"
                        image={eq.image_url}
                        alt={eq.name}
                        sx={{ 
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                          '&:hover': { transform: 'scale(1.05)' },
                        }}
                        onError={(e: SyntheticEvent<HTMLImageElement>) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Gradient overlay */}
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '60%',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        pointerEvents: 'none',
                      }} />
                    </>
                  ) : (
                    <Box sx={{
                      height: 120,
                      background: `linear-gradient(135deg, ${getCategoryColor(eq.category)}15 0%, ${getCategoryColor(eq.category)}05 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      position: 'relative',
                    }}>
                      <BuildIcon sx={{ fontSize: 48, color: getCategoryColor(eq.category), opacity: 0.5 }} />
                    </Box>
                  )}
                  
                  {/* Status badge - positioned on image */}
                  <Chip
                    label={statusLabels[eq.status] || eq.status}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      bgcolor: STATUS_COLORS[eq.status] || '#666',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      backdropFilter: 'blur(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  />
                  
                  {/* Quantity badge */}
                  {eq.quantity > 1 && (
                    <Chip
                      label={`×${eq.quantity}`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 10,
                        left: 50,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        backdropFilter: 'blur(4px)',
                      }}
                    />
                  )}
                  
                  {/* Global equipment indicator */}
                  {eq.is_global && (
                    <Tooltip title={t('equip.tt.globalEquip')}>
                      <Chip
                        icon={<PublicIcon sx={{ fontSize: '14px !important' }} />}
                        label="Global"
                        size="small"
                        sx={{
                          position: 'absolute',
                          bottom: 10,
                          left: 10,
                          bgcolor: 'rgba(33,150,243,0.8)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          backdropFilter: 'blur(4px)',
                          boxShadow: '0 2px 8px rgba(33,150,243,0.3)',
                          '& .MuiChip-icon': { color: '#fff' },
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>
                
                <CardContent sx={{ flex: 1, p: 2 }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: isDesktop ? '1rem' : '0.95rem',
                    mb: 0.5,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {eq.name}
                  </Typography>
                  
                  {(eq.category || eq.brand) && (
                    <Typography variant="body2" sx={{
                      color: 'rgba(255,255,255,0.65)',
                      mb: 1.5,
                      fontSize: '0.8rem',
                    }}>
                      {[eq.category, eq.brand].filter(Boolean).join(' • ')}
                    </Typography>
                  )}
                  
                  <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {eq.category && (
                      <Chip 
                        label={eq.category} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(147,51,234,0.15)', 
                          color: '#c084fc', 
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          border: '1px solid rgba(147,51,234,0.2)',
                        }} 
                      />
                    )}
                    <Chip
                      label={conditionLabels[eq.condition] || eq.condition}
                      size="small"
                      sx={{
                        bgcolor: `${CONDITION_COLORS[eq.condition]}20` || 'rgba(100,100,100,0.2)',
                        color: CONDITION_COLORS[eq.condition] || '#999',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        border: `1px solid ${CONDITION_COLORS[eq.condition]}40`,
                      }}
                    />
                  </Stack>
                  {warehouseTotals && (
                    <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip
                        label={t('equip.wh.available', { n: warehouseTotals.available })}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(76,175,80,0.15)',
                          color: '#81c784',
                          border: '1px solid rgba(76,175,80,0.35)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      />
                      <Chip
                        label={t('equip.wh.reserved', { n: warehouseTotals.reserved })}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,183,77,0.15)',
                          color: '#ffb74d',
                          border: '1px solid rgba(255,183,77,0.35)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                  )}
                  
                  {eq.location_name && (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.75, 
                      mb: 1,
                      p: 0.75,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(33,150,243,0.08)',
                      border: '1px solid rgba(33,150,243,0.15)',
                    }}>
                      <LocationIcon sx={{ fontSize: 16, color: '#64b5f6' }} />
                      <Typography variant="body2" sx={{ color: '#90caf9', fontSize: '0.75rem' }}>
                        {eq.location_name}
                      </Typography>
                    </Box>
                  )}
                  
                  {eq.assignees && eq.assignees.length > 0 && (
                    <Box sx={{ mt: 'auto' }}>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {eq.assignees.slice(0, 2).map((a, idx) => (
                          <Chip
                            key={idx}
                            label={getCrewName(a.crew_id)}
                            size="small"
                            icon={<PersonIcon sx={{ fontSize: 12 }} />}
                            onDelete={() => handleUnassign(eq.id, a.crew_id)}
                            sx={{ 
                              bgcolor: 'rgba(33, 150, 243, 0.15)', 
                              color: '#64b5f6', 
                              fontSize: '0.65rem',
                              height: 24,
                              '& .MuiChip-deleteIcon': { fontSize: 14, color: '#64b5f6' },
                            }}
                          />
                        ))}
                        {eq.assignees.length > 2 && (
                          <Chip
                            label={`+${eq.assignees.length - 2}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.65rem', height: 24 }}
                          />
                        )}
                      </Stack>
                    </Box>
                  )}
                </CardContent>
                
                {/* Action buttons with glass effect */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  p: 1.5, 
                  pt: 1,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  bgcolor: 'rgba(0,0,0,0.2)',
                }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={t('equip.tt.bookings')}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenBookings(eq)}
                        aria-label={t('equip.aria.openBookings', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
                        }}
                      >
                        <ScheduleIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    {eq.status === 'in_use' ? (
                      <Tooltip title={t('equip.tt.checkin')}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenCheckin(eq)}
                          aria-label={t('equip.aria.checkinFor', { name: eq.name })}
                          sx={{
                            ...focusVisibleStyles,
                            color: '#4caf50',
                            bgcolor: 'rgba(76,175,80,0.12)',
                            '&:hover': { bgcolor: 'rgba(76,175,80,0.2)' },
                          }}
                        >
                          <CheckInIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    ) : eq.status === 'available' ? (
                      <Tooltip title={t('equip.tt.checkout')}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenCheckout(eq)}
                          aria-label={t('equip.aria.checkoutFor', { name: eq.name })}
                          sx={{
                            ...focusVisibleStyles,
                            color: '#2196f3',
                            '&:hover': { bgcolor: 'rgba(33,150,243,0.1)' },
                          }}
                        >
                          <CheckOutIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <Tooltip title={t('equip.tt.assignOwner')}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenAssign(eq)}
                        aria-label={t('equip.aria.assignFor', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#2196f3', bgcolor: 'rgba(33,150,243,0.1)' },
                        }}
                      >
                        <PersonIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('equip.tt.qrCode')}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenQrLabel(eq)}
                        aria-label={t('equip.aria.showQr', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#9c27b0', bgcolor: 'rgba(156,39,176,0.1)' },
                        }}
                      >
                        <QrCodeIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('equip.tt.history')}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenHistory(eq)}
                        aria-label={t('equip.aria.openHistory', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#673ab7', bgcolor: 'rgba(103,58,183,0.1)' },
                        }}
                      >
                        <HistoryIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title={t('equip.tt.duplicate')}>
                      <IconButton
                        size="small"
                        onClick={() => handleDuplicate(eq)}
                        aria-label={t('equip.aria.duplicateFor', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#00bcd4', bgcolor: 'rgba(0,188,212,0.1)' },
                        }}
                      >
                        <DuplicateIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('equip.tt.maintenance')}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenMaintenance(eq)}
                        aria-label={t('equip.aria.openMaint', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#009688', bgcolor: 'rgba(0,150,136,0.1)' },
                        }}
                      >
                        <BuildIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('equip.tt.edit')}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(eq)}
                        aria-label={t('equip.aria.editFor', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('equip.tt.delete')}>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(eq)}
                        aria-label={t('equip.aria.deleteFor', { name: eq.name })}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Card>
              </Grow>
                </Grid>
              );
            })
          )}
        </Grid>
      ) : (
        <TableContainer component={Paper} sx={{ 
          bgcolor: 'rgba(28, 33, 40, 0.8)', 
          backdropFilter: 'blur(10px)',
          borderRadius: 3,
          border: '1px solid rgba(148,163,184,0.22)',
          overflow: 'hidden',
        }}>
          <Table>
            <TableHead>
              <TableRow sx={{ 
                background: 'linear-gradient(135deg, rgba(147,51,234,0.1) 0%, rgba(109,40,217,0.05) 100%)',
              }}>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#9333ea' }, '& .MuiTableSortLabel-icon': { color: '#9333ea !important' } }}
                  >{t('equip.th.name')}</TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }}>
                  <TableSortLabel
                    active={sortField === 'category'}
                    direction={sortField === 'category' ? sortDirection : 'asc'}
                    onClick={() => handleSort('category')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#9333ea' }, '& .MuiTableSortLabel-icon': { color: '#9333ea !important' } }}
                  >{t('equip.th.category')}</TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }}>{t('equip.th.brandModel')}</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#9333ea' }, '& .MuiTableSortLabel-icon': { color: '#9333ea !important' } }}
                  >{t('equip.th.status')}</TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }}>{t('equip.th.condition')}</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }} align="center">{t('equip.th.quantity')}</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }} align="center">{t('equip.th.warehouse')}</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }}>{t('equip.th.location')}</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(148,163,184,0.22)' }} align="right">{t('equip.th.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedEquipment.map((eq) => {
                const warehouseTotals = warehouseStockByItem[eq.id];
                return (
                <TableRow 
                  key={eq.id} 
                  sx={{ 
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(147,51,234,0.05)' },
                    '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <TableCell sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {eq.image_url ? (
                        <Box 
                          component="img" 
                          src={eq.image_url} 
                          sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: 1.5, 
                            objectFit: 'cover',
                            border: '1px solid rgba(148,163,184,0.26)',
                          }} 
                        />
                      ) : (
                        <Box sx={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 1.5, 
                          bgcolor: `${getCategoryColor(eq.category)}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <BuildIcon sx={{ fontSize: 20, color: getCategoryColor(eq.category) }} />
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {eq.name}
                          {eq.is_global && (
                            <Tooltip title={t('equip.tt.globalEquip')}>
                              <PublicIcon sx={{ fontSize: 16, color: '#2196f3' }} />
                            </Tooltip>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Chip 
                      label={eq.category || '-'} 
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(147,51,234,0.1)', 
                        color: '#c084fc',
                        fontSize: '0.75rem',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {eq.brand || eq.model ? `${eq.brand || ''} ${eq.model || ''}`.trim() : '-'}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Chip
                      label={statusLabels[eq.status] || eq.status}
                      size="small"
                      sx={{ 
                        bgcolor: `${STATUS_COLORS[eq.status]}20`, 
                        color: STATUS_COLORS[eq.status], 
                        fontWeight: 600,
                        border: `1px solid ${STATUS_COLORS[eq.status]}40`,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Chip
                      label={conditionLabels[eq.condition] || eq.condition}
                      size="small"
                      sx={{ 
                        bgcolor: `${CONDITION_COLORS[eq.condition]}20`, 
                        color: CONDITION_COLORS[eq.condition],
                        border: `1px solid ${CONDITION_COLORS[eq.condition]}40`,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Chip 
                      label={eq.quantity} 
                      size="small" 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.1)', 
                        color: '#fff',
                        fontWeight: 700,
                        minWidth: 32,
                      }} 
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {warehouseTotals ? (
                      <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap">
                        <Chip
                          label={t('equip.wh.availShort', { n: warehouseTotals.available })}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(76,175,80,0.15)',
                            color: '#81c784',
                            border: '1px solid rgba(76,175,80,0.35)',
                            fontWeight: 700,
                            fontSize: '0.68rem',
                          }}
                        />
                        <Chip
                          label={t('equip.wh.resShort', { n: warehouseTotals.reserved })}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,183,77,0.15)',
                            color: '#ffb74d',
                            border: '1px solid rgba(255,183,77,0.35)',
                            fontWeight: 700,
                            fontSize: '0.68rem',
                          }}
                        />
                      </Stack>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {eq.location_name ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationIcon sx={{ fontSize: 14, color: '#64b5f6' }} />
                        <Typography variant="body2" sx={{ color: '#90caf9' }}>{eq.location_name}</Typography>
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title={t('equip.tt.bookings')}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenBookings(eq)} 
                          aria-label={t('equip.aria.openBookings', { name: eq.name })}
                          sx={{ 
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
                          }}
                        >
                          <ScheduleIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      {eq.status === 'in_use' ? (
                        <Tooltip title={t('equip.tt.checkin')}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCheckin(eq)}
                            aria-label={t('equip.aria.checkinFor', { name: eq.name })}
                            sx={{ ...focusVisibleStyles, color: '#4caf50', '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' } }}
                          >
                            <CheckInIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      ) : eq.status === 'available' ? (
                        <Tooltip title={t('equip.tt.checkout')}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCheckout(eq)}
                            aria-label={t('equip.aria.checkoutFor', { name: eq.name })}
                            sx={{ ...focusVisibleStyles, color: '#2196f3', '&:hover': { bgcolor: 'rgba(33,150,243,0.1)' } }}
                          >
                            <CheckOutIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      <Tooltip title={t('equip.tt.assign')}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenAssign(eq)} 
                          aria-label={t('equip.aria.assignFor', { name: eq.name })}
                          sx={{ 
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#2196f3', bgcolor: 'rgba(33,150,243,0.1)' },
                          }}
                        >
                          <PersonIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('equip.tt.qrCode')}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenQrLabel(eq)}
                          aria-label={t('equip.aria.showQr', { name: eq.name })}
                          sx={{
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#9c27b0', bgcolor: 'rgba(156,39,176,0.1)' },
                          }}
                        >
                          <QrCodeIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('equip.tt.edit')}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(eq)} 
                          aria-label={t('equip.aria.editFor', { name: eq.name })}
                          sx={{ 
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                          }}
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('equip.tt.delete')}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteClick(eq)} 
                          aria-label={t('equip.aria.deleteFor', { name: eq.name })}
                          sx={{ 
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)' },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pagination-rad — vises kun når flere enn én side eksisterer */}
      {filteredEquipment.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            mt: 2,
            px: 1,
          }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
            {t('equip.page.range', { from: filteredEquipment.length === 0 ? 0 : paginationStart + 1, to: paginationEnd, total: filteredEquipment.length })}
          </Typography>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton
                size="small"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t('equip.aria.prevPage')}
                sx={{ color: safePage <= 1 ? 'rgba(255,255,255,0.25)' : '#fff' }}
              >
                <Box component="span" sx={{ fontSize: '1.2rem', lineHeight: 1 }}>‹</Box>
              </IconButton>
              {(() => {
                const pages: Array<number | 'ellipsis'> = [];
                const showEllipsisLeft = safePage > 3;
                const showEllipsisRight = safePage < totalPages - 2;
                pages.push(1);
                if (showEllipsisLeft) pages.push('ellipsis');
                for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p += 1) {
                  pages.push(p);
                }
                if (showEllipsisRight) pages.push('ellipsis');
                if (totalPages > 1) pages.push(totalPages);
                return pages.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <Typography key={`ell-${idx}`} sx={{ color: 'rgba(255,255,255,0.4)', px: 0.5 }}>
                      …
                    </Typography>
                  ) : (
                    <Button
                      key={p}
                      size="small"
                      onClick={() => setPage(p)}
                      sx={{
                        minWidth: 32,
                        height: 32,
                        px: 1,
                        bgcolor: safePage === p ? '#9333ea' : 'transparent',
                        color: safePage === p ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontWeight: safePage === p ? 700 : 500,
                        '&:hover': { bgcolor: safePage === p ? '#a855f7' : 'rgba(147,51,234,0.18)' },
                      }}
                    >
                      {p}
                    </Button>
                  ),
                );
              })()}
              <IconButton
                size="small"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={t('equip.aria.nextPage')}
                sx={{ color: safePage >= totalPages ? 'rgba(255,255,255,0.25)' : '#fff' }}
              >
                <Box component="span" sx={{ fontSize: '1.2rem', lineHeight: 1 }}>›</Box>
              </IconButton>
            </Box>
          )}

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 20 | 40 | 80)}
              sx={{
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                '& .MuiSelect-select': { py: 0.5, fontSize: '0.85rem' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' },
                },
              }}
            >
              <MenuItem value={20}>{t('equip.page.20')}</MenuItem>
              <MenuItem value={40}>{t('equip.page.40')}</MenuItem>
              <MenuItem value={80}>{t('equip.page.80')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

        </Box>{/* end main content column */}
      </Box>{/* end sidebar + main row */}

      <Dialog
        open={createTypeDialogOpen}
        onClose={() => setCreateTypeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          },
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('primary')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={getRoleRoomDialogIconSx('primary', 38)}>
              <AddIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.h.newEntry')}</Typography>
          </Box>
          <IconButton
            onClick={() => setCreateTypeDialogOpen(false)}
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, px: 3 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>{t('equip.newEntry.choose')}</Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <Button
              variant="outlined"
              onClick={handleCreateEquipmentFromChooser}
              sx={{
                p: 2,
                minHeight: 170,
                borderRadius: 2.5,
                borderColor: 'rgba(147,51,234,0.35)',
                color: '#fff',
                textTransform: 'none',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                '&:hover': {
                  borderColor: '#9333ea',
                  bgcolor: 'rgba(147,51,234,0.12)',
                },
                ...focusVisibleStyles,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.25 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(147,51,234,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BuildIcon sx={{ color: '#c084fc', fontSize: 24 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{t('equip.newEntry.filmTitle')}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', textAlign: 'left' }}>{t('equip.newEntry.filmDesc')}</Typography>
              </Box>
            </Button>

            <Button
              variant="outlined"
              onClick={handleCreatePropFromChooser}
              sx={{
                p: 2,
                minHeight: 170,
                borderRadius: 2.5,
                borderColor: 'rgba(192,132,252,0.35)',
                color: '#fff',
                textTransform: 'none',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                '&:hover': {
                  borderColor: '#c084fc',
                  bgcolor: 'rgba(192,132,252,0.12)',
                },
                ...focusVisibleStyles,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.25 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(192,132,252,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PropsIcon sx={{ color: '#c084fc', fontSize: 24 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{t('equip.newEntry.propsTitle')}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', textAlign: 'left' }}>{t('equip.newEntry.propsDesc')}</Typography>
              </Box>
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2.5 }}>
          <Button
            onClick={() => setCreateTypeDialogOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.8)', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
          >{t('equip.btn.cancel')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseMainDialog}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle component="div" id={dialogTitleId} sx={getRoleRoomDialogTitleSx('primary')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('primary')}>
              <BuildIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {editingEquipment ? t('equip.form.editTitle') : t('equip.form.addTitle')}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {editingEquipment ? t('equip.form.editSub') : t('equip.form.addSub')}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={handleCloseMainDialog} 
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
              alignItems: 'start',
            }}
          >
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <TextField
                fullWidth
                label={t('equip.lbl.nameReq')}
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                }}
                error={!!formErrors.name}
                helperText={formErrors.name}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: formErrors.name ? '#f44336' : 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: formErrors.name ? '#f44336' : 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: formErrors.name ? '#f44336' : '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: formErrors.name ? '#f44336' : 'rgba(255,255,255,0.6)' },
                  '& .MuiFormHelperText-root': { color: '#f44336' },
                }}
              />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.category')}</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setNewCategoryDialogOpen(true);
                    } else {
                      setFormData({ ...formData, category: e.target.value });
                    }
                  }}
                  label={t('equip.lbl.category')}
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)', maxHeight: 350 } }
                  }}
                >
                  {allCategories.map(cat => (
                    <MenuItem key={cat} value={cat}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getCategoryColor(cat) }} />
                          {cat}
                        </Box>
                        {customCategories.includes(cat) && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomCategory(cat);
                            }}
                            aria-label={t('equip.aria.removeCat', { cat })}
                            sx={{
                              p: 0.5,
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { color: '#f44336' }
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                  <MenuItem value="__add_new__" sx={{ color: '#4caf50' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon sx={{ fontSize: 18 }} />
                      {t('equip.form.addNewCat')}
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <Autocomplete
                freeSolo
                autoComplete
                autoHighlight
                openOnFocus={false}
                clearOnBlur={false}
                forcePopupIcon={false}
                options={uniqueManufacturerOptions}
                inputValue={brandInputValue}
                onInputChange={(_event, newInputValue, reason) => {
                  setBrandInputValue(newInputValue);
                  setFormData((prev) => ({ ...prev, brand: newInputValue }));
                  setBrandShouldSuggest(reason === 'input' && newInputValue.trim().length > 0);
                  setCameraSpecsExpanded(false);
                }}
                onChange={(_event, newValue) => {
                  const nextValue = typeof newValue === 'string' ? newValue : String(newValue ?? '');
                  setBrandInputValue(nextValue);
                  setFormData((prev) => ({ ...prev, brand: nextValue }));
                  setBrandShouldSuggest(false);
                  setCameraSpecsExpanded(false);
                }}
                onBlur={() => setBrandShouldSuggest(false)}
                open={
                  brandShouldSuggest &&
                  brandInputValue.trim().length > 0 &&
                  uniqueManufacturerOptions.some((option) =>
                    option.toLowerCase().includes(brandInputValue.trim().toLowerCase())
                  )
                }
                filterOptions={(options, state) => {
                  const needle = state.inputValue.trim().toLowerCase();
                  if (!needle) return [];
                  return options.filter((option) => option.toLowerCase().includes(needle));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label={t('equip.lbl.brand')}
                    helperText={uniqueManufacturerOptions.length > 0 ? t('equip.form.brandHint') : t('equip.form.brandHintNone')}
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        bgcolor: 'rgba(0,0,0,0.2)', 
                        color: '#fff',
                        borderRadius: 2,
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                        '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                      '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.6)' },
                    }}
                  />
                )}
              />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <Autocomplete
                freeSolo
                autoComplete
                autoHighlight
                openOnFocus={false}
                clearOnBlur={false}
                forcePopupIcon={false}
                options={uniqueModelOptions}
                inputValue={modelInputValue}
                onInputChange={(_event, newInputValue, reason) => {
                  setModelInputValue(newInputValue);
                  setFormData((prev) => ({ ...prev, model: newInputValue }));
                  setModelShouldSuggest(reason === 'input' && newInputValue.trim().length > 0);
                  setCameraSpecsExpanded(false);
                }}
                onChange={(_event, newValue) => {
                  const nextValue = typeof newValue === 'string' ? newValue : String(newValue ?? '');
                  const matchedCamera = modelOptionCameraLookup.get(nextValue.trim().toLowerCase());
                  const canonicalModel = matchedCamera?.model ?? nextValue;

                  setModelInputValue(canonicalModel);
                  if (matchedCamera?.brand) {
                    setBrandInputValue(matchedCamera.brand);
                  }
                  setFormData((prev) => ({
                    ...prev,
                    brand: matchedCamera?.brand ?? prev.brand,
                    model: canonicalModel,
                  }));
                  setModelShouldSuggest(false);
                  setBrandShouldSuggest(false);
                  setCameraSpecsExpanded(false);
                }}
                onBlur={() => {
                  setModelShouldSuggest(false);
                  const matchedCamera = modelOptionCameraLookup.get(modelInputValue.trim().toLowerCase());
                  if (!matchedCamera) return;

                  setModelInputValue(matchedCamera.model);
                  setBrandInputValue(matchedCamera.brand);
                  setFormData((prev) => ({
                    ...prev,
                    brand: matchedCamera.brand,
                    model: matchedCamera.model,
                  }));
                }}
                open={
                  modelShouldSuggest &&
                  modelInputValue.trim().length > 0 &&
                  uniqueModelOptions.some((option) =>
                    option.toLowerCase().includes(modelInputValue.trim().toLowerCase())
                  )
                }
                filterOptions={(options, state) => {
                  const needle = state.inputValue.trim().toLowerCase();
                  if (!needle) return [];
                  return options.filter((option) => option.toLowerCase().includes(needle));
                }}
                renderOption={(props, option, state) => {
                  const camera = modelOptionCameraLookup.get(option.trim().toLowerCase());
                  const specPreview = camera ? getCameraSpecChips(camera).slice(0, 2) : [];
                  const { key: _unusedKey, ...optionProps } =
                    props as unknown as HTMLAttributes<HTMLLIElement> & { key?: string | number };
                  const resolvedOptionKey = `${option.trim().toLowerCase()}-${camera?.id ?? 'option'}-${state.index}`;

                  return (
                    <Box
                      key={resolvedOptionKey}
                      component="li"
                      {...optionProps}
                      sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ width: '100%', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                          {option}
                        </Typography>
                        {camera?.isNetflixCertified && renderNetflixBadge('Netflix', true)}
                      </Stack>
                      {specPreview.length > 0 && (
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                          {specPreview.map((specLine) => (
                            <Chip
                              key={`${resolvedOptionKey}-${specLine}`}
                              size="small"
                              label={specLine}
                              sx={{
                                height: 18,
                                bgcolor: 'rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.72)',
                                '& .MuiChip-label': { px: 0.75, fontSize: '0.66rem' },
                              }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label={t('equip.lbl.model')}
                    helperText={uniqueModelOptions.length > 0 ? t('equip.form.modelHint') : t('equip.form.modelHintNone')}
                    sx={{ 
                      '& .MuiOutlinedInput-root': { 
                        bgcolor: 'rgba(0,0,0,0.2)', 
                        color: '#fff',
                        borderRadius: 2,
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                        '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                      },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                      '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.6)' },
                    }}
                  />
                )}
              />
            </Box>
            {isCameraCategorySelected && formData.model.trim().length > 0 && !selectedCameraForForm && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Alert
                  severity="info"
                  sx={{
                    bgcolor: 'rgba(30,41,59,0.55)',
                    color: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(148,163,184,0.3)',
                    '& .MuiAlert-icon': { color: '#93c5fd' },
                  }}
                >
                  Velg eksakt modell fra listen for verifiserte spesifikasjoner.
                </Alert>
              </Box>
            )}
            {isCameraCategorySelected && selectedCameraForForm && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Paper
                  sx={{
                    p: 2,
                    background:
                      'linear-gradient(145deg, rgba(15,23,42,0.88) 0%, rgba(30,41,59,0.82) 52%, rgba(17,24,39,0.9) 100%)',
                    border: '1px solid rgba(125,211,252,0.22)',
                    borderRadius: 2,
                    boxShadow: '0 14px 34px rgba(2,6,23,0.45)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                  >
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#f8fafc', fontWeight: 800 }}>
                        {t('equip.cam.selected', { brand: selectedCameraForForm.brand, model: selectedCameraForForm.model })}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.8)' }}>
                        {t('equip.cam.catSource', { cat: selectedCameraForForm.category || t('equip.unknown'), src: cameraSourceLabelForForm })}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        label={selectedCameraForForm.type === 'video' ? 'Cine/Video' : t('equip.cam.photo')}
                        sx={{ bgcolor: 'rgba(56,189,248,0.18)', color: '#bae6fd', fontWeight: 700 }}
                      />
                      {selectedCameraForForm.isNetflixCertified &&
                        renderNetflixBadge(t('equip.netflixCertified'), false)}
                    </Stack>
                  </Stack>

                  <Alert
                    severity={selectedCameraHasTrustedSpecs ? 'success' : 'warning'}
                    sx={{
                      mt: 1.25,
                      bgcolor: selectedCameraHasTrustedSpecs ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.16)',
                      color: selectedCameraHasTrustedSpecs ? '#dcfce7' : '#ffedd5',
                      border: selectedCameraHasTrustedSpecs
                        ? '1px solid rgba(74,222,128,0.34)'
                        : '1px solid rgba(251,191,36,0.34)',
                      '& .MuiAlert-icon': {
                        color: selectedCameraHasTrustedSpecs ? '#86efac' : '#fcd34d',
                      },
                    }}
                  >
                    {selectedCameraHasTrustedSpecs
                      ? t('equip.cam.trustedSpecs', { src: cameraSourceLabelForForm })
                      : t('equip.cam.noTrustedSpecs', { src: cameraSourceLabelForForm })}
                  </Alert>

                  {selectedCameraHasTrustedSpecs && (
                    <>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                        {getCameraSpecChips(selectedCameraForForm).map((specLine) => (
                          <Chip
                            key={`${selectedCameraForForm.id}-${specLine}`}
                            size="small"
                            label={specLine}
                            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.82)' }}
                          />
                        ))}
                      </Stack>

                      <Button
                        size="small"
                        onClick={() => setCameraSpecsExpanded((prev) => !prev)}
                        sx={{
                          mt: 1,
                          color: '#bfdbfe',
                          fontWeight: 700,
                          textTransform: 'none',
                          px: 0,
                          '&:hover': { bgcolor: 'transparent', color: '#dbeafe' },
                        }}
                      >
                        {cameraSpecsExpanded ? t('equip.cam.hideSpecs') : t('equip.cam.moreSpecs')}
                      </Button>

                      <Collapse in={cameraSpecsExpanded}>
                        <Box
                          sx={{
                            mt: 1,
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                            gap: 1,
                          }}
                        >
                          {cameraSpecDetails.map((entry) => (
                            <Box
                              key={`${entry.label}-${entry.value}`}
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(15,23,42,0.55)',
                                border: '1px solid rgba(148,163,184,0.18)',
                              }}
                            >
                              <Typography variant="caption" sx={{ color: 'rgba(148,163,184,0.92)', display: 'block' }}>
                                {entry.label}
                              </Typography>
                              <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600, lineHeight: 1.35 }}>
                                {entry.value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Collapse>
                    </>
                  )}
                </Paper>
              </Box>
            )}
            {isCameraCategorySelected && cameraSuggestionMatches.length > 0 && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(129,140,248,0.28)',
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ color: '#e9d5ff', fontWeight: 700, mb: 1 }}>{t('equip.cam.matches')}</Typography>
                  <Stack spacing={1}>
                    {cameraSuggestionMatches.map((camera) => (
                      <Box
                        key={`${camera.id}-${camera.brand}-${camera.model}`}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          border: '1px solid rgba(255,255,255,0.12)',
                          bgcolor: 'rgba(15,23,42,0.45)',
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                          justifyContent="space-between"
                        >
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                            {camera.brand} {camera.model}
                          </Typography>
                          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              label={camera.type === 'video' ? 'Cine/Video' : t('equip.cam.photo')}
                              sx={{ bgcolor: 'rgba(56,189,248,0.18)', color: '#bae6fd', fontWeight: 600 }}
                            />
                            {camera.isNetflixCertified && renderNetflixBadge(t('equip.netflixCertified'), false)}
                          </Stack>
                        </Stack>

                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block', mt: 0.75 }}>
                          {t('equip.cam.category', { cat: camera.category || t('equip.unknown') })}
                        </Typography>

                        <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                          {getCameraSpecChips(camera).map((specLine) => (
                            <Chip
                              key={`${camera.id}-${specLine}`}
                              size="small"
                              label={specLine}
                              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.82)' }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Box>
            )}
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <TextField
                fullWidth
                label={t('equip.lbl.serial')}
                value={formData.serialNumber}
                onChange={(e) => {
                  setFormData({ ...formData, serialNumber: e.target.value });
                  if (formErrors.serialNumber) {
                    setFormErrors((prev) => {
                      const next = { ...prev };
                      delete next.serialNumber;
                      return next;
                    });
                  }
                }}
                error={Boolean(formErrors.serialNumber)}
                helperText={
                  formErrors.serialNumber ||
                  t('equip.form.serialHint')
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('equip.tt.scanSerial')}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSerialScanInput(formData.serialNumber || '');
                            setSerialScanError(null);
                            setSerialScanDialogOpen(true);
                          }}
                          sx={{
                            color: '#64b5f6',
                            '&:hover': {
                              bgcolor: 'rgba(100,181,246,0.16)',
                            },
                          }}
                        >
                          <QrCodeScannerIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: formErrors.serialNumber ? '#f44336' : 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: formErrors.serialNumber ? '#f44336' : 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: formErrors.serialNumber ? '#f44336' : '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: formErrors.serialNumber ? '#f44336' : 'rgba(255,255,255,0.87)' },
                  '& .MuiFormHelperText-root': { color: formErrors.serialNumber ? '#f44336' : 'rgba(255,255,255,0.6)' },
                }}
              />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <TextField
                fullWidth
                type="number"
                label={t('equip.lbl.quantity')}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.status')}</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Equipment['status'] })}
                  label={t('equip.lbl.status')}
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' } }
                  }}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[value] }} />
                        {label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 1' } }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.condition')}</InputLabel>
                <Select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as Equipment['condition'] })}
                  label={t('equip.lbl.condition')}
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' } }
                  }}
                >
                  {Object.entries(conditionLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CONDITION_COLORS[value] }} />
                        {label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.warehouseLoc')}</InputLabel>
                <Select
                  value={formData.primaryLocationId}
                  onChange={(e) => setFormData({ ...formData, primaryLocationId: e.target.value })}
                  label={t('equip.lbl.warehouseLoc')}
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' } }
                  }}
                >
                  <MenuItem value="">{t('equip.opt.none')}</MenuItem>
                  {locations.map(loc => (
                    <MenuItem key={loc.id} value={loc.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon sx={{ fontSize: 16, color: '#64b5f6' }} />
                        {loc.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label={t('equip.lbl.description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label={t('equip.lbl.notes')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                multiline
                rows={2}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
              <GlobalMentionHelper
                text={typeof formData.notes === 'string' ? formData.notes : ''}
                localCandidates={mentionCandidates}
                onApplySuggestion={(name) =>
                  setFormData((prev) => ({
                    ...prev,
                    notes: applyMentionSuggestion(prev.notes, name),
                  }))
                }
              />
              {formData.notes.trim().length > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.75,
                    display: 'block',
                    color: 'rgba(255,255,255,0.65)',
                  }}
                >
                  {t('equip.form.writtenBy')} {formData.notesAuthorName || t('equip.form.notRegistered')}
                  {formatEquipmentNoteTimestamp(formData.notesUpdatedAt)
                    ? ` • ${formatEquipmentNoteTimestamp(formData.notesUpdatedAt)}`
                    : ''}
                </Typography>
              )}
            </Box>
            
            {/* Global Equipment Toggle */}
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: formData.isGlobal ? 'rgba(33,150,243,0.1)' : 'rgba(0,0,0,0.2)',
                border: formData.isGlobal ? '1px solid rgba(33,150,243,0.3)' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>{t('equip.form.globalEquip')}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {formData.isGlobal
                      ? t('equip.form.availAll')
                      : t('equip.form.thisOnly')}
                  </Typography>
                </Box>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => setFormData({ ...formData, isGlobal: !formData.isGlobal })}
                >
                  <Typography variant="body2" sx={{ color: formData.isGlobal ? '#2196f3' : 'rgba(255,255,255,0.5)' }}>
                    {formData.isGlobal ? t('equip.yes') : t('equip.no')}
                  </Typography>
                  <Box sx={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    bgcolor: formData.isGlobal ? '#2196f3' : 'rgba(255,255,255,0.2)',
                    position: 'relative',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}>
                    <Box sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      position: 'absolute',
                      top: 2,
                      left: formData.isGlobal ? 24 : 2,
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }} />
                  </Box>
                </Box>
              </Box>
            </Box>
            
            {/* Image Picker Section with Drag & Drop */}
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Box 
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: isDragging ? 'rgba(147,51,234,0.1)' : 'rgba(0,0,0,0.2)',
                  border: isDragging ? '2px dashed #9333ea' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s',
                }}
              >
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {t('equip.form.equipImage')}
                  {isDragging && <Chip label={t('equip.chip.dropImage')} size="small" sx={{ bgcolor: '#9333ea', color: '#fff', fontSize: '0.7rem' }} />}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 180px) minmax(0, 1fr)' },
                    gap: { xs: 1.5, md: 2 },
                    alignItems: 'start',
                  }}
                >
                  {/* Image Preview */}
                  <Box sx={{
                    width: '100%',
                    maxWidth: { xs: 220, md: 'none' },
                    aspectRatio: '7 / 5',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius: 2,
                    border: isDragging ? '2px solid #9333ea' : '2px dashed rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    justifySelf: { xs: 'center', md: 'stretch' },
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'rgba(147,51,234,0.3)',
                    },
                  }}>
                    {formData.imageUrl ? (
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                      />
                    ) : (
                    <ImageIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.2)' }} />
                    )}
                  </Box>
                
                  {/* Image Actions */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: '1fr' },
                      gap: 1.5,
                    }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SearchIcon />}
                      onClick={() => {
                        setImagePickerOpen(true);
                        setImagePickerTab(0);
                        setImageSearchQuery(formData.name || formData.category || '');
                      }}
                      sx={{ 
                        borderColor: 'rgba(147,51,234,0.5)', 
                        color: '#9333ea',
                        borderRadius: 2,
                        py: 1,
                        justifyContent: 'flex-start',
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:hover': { borderColor: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
                      }}
                    >{t('equip.btn.searchImages')}</Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ 
                        borderColor: 'rgba(76,175,80,0.5)', 
                        color: '#4caf50',
                        borderRadius: 2,
                        py: 1,
                        justifyContent: 'flex-start',
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:hover': { borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                      }}
                    >{t('equip.btn.uploadFile')}</Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <TextField
                      size="small"
                      placeholder={t('equip.ph.imageUrl')}
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: formData.imageUrl && (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setFormData({ ...formData, imageUrl: '' })}
                              aria-label={t('equip.aria.removeImgUrl')}
                              sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#f44336' } }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        gridColumn: '1 / -1',
                        '& .MuiOutlinedInput-root': { 
                          bgcolor: 'rgba(0,0,0,0.2)', 
                          color: '#fff',
                          borderRadius: 2,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        },
                      }}
                    />
                  </Box>

                  {/* Ekte produktbilder (Wikimedia) ved add — klikk for å bytte.
                      Ingen stock; vises kun når faktiske modell-/merke-treff finnes. */}
                  {!editingEquipment && (equipmentImageLoading || equipmentImageSuggestions.length > 0) ? (
                    <Box sx={{ mt: 1.25 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', mb: 0.6 }}>
                        {equipmentImageLoading ? t('equip.img.finding') : t('equip.img.realProducts')}
                      </Typography>
                      <Stack direction="row" spacing={0.6} sx={{ overflowX: 'auto', pb: 0.5 }}>
                        {equipmentImageSuggestions.slice(0, 6).map((img) => (
                          <Tooltip key={img.id} title={img.description} placement="top">
                            <Box
                              component="img"
                              src={img.thumbnailUrl || img.url}
                              alt={img.description}
                              loading="lazy"
                              onClick={() => setFormData((prev) => ({ ...prev, imageUrl: img.url }))}
                              sx={{
                                width: 52,
                                height: 52,
                                borderRadius: 1,
                                objectFit: 'cover',
                                cursor: 'pointer',
                                flexShrink: 0,
                                border: formData.imageUrl === img.url ? '2px solid #9333ea' : '1px solid rgba(255,255,255,0.15)',
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={handleCloseMainDialog}
            startIcon={<CancelIcon />}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE, 
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              ...focusVisibleStyles,
            }}
          >{t('equip.btn.cancel')}</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              background: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
              color: '#fff',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 4,
              boxShadow: '0 4px 14px rgba(147,51,234,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)',
                boxShadow: '0 6px 20px rgba(147,51,234,0.4)',
              },
              ...focusVisibleStyles,
            }}
          >
            {editingEquipment ? t('equip.btn.update') : t('equip.btn.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('info')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('info')}>
              <PersonIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{t('equip.assign.title')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.assign.subtitle')}</Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setAssignDialogOpen(false)} 
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Box sx={{ 
            p: 2, 
            mb: 2.5, 
            borderRadius: 2, 
            bgcolor: 'rgba(33,150,243,0.08)',
            border: '1px solid rgba(33,150,243,0.2)',
          }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              {t('equip.assign.selected')} <strong style={{ color: '#fff' }}>{selectedEquipmentForAssign?.name}</strong>
            </Typography>
          </Box>
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.pickCrew')}</InputLabel>
            <Select
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              label={t('equip.lbl.pickCrew')}
              sx={{ 
                color: '#fff', 
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(33,150,243,0.3)' },
              }}
              MenuProps={{
                PaperProps: { sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', border: '1px solid rgba(148,163,184,0.26)' } }
              }}
            >
              {crewMembers.map(crew => (
                <MenuItem key={crew.id} value={crew.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'rgba(33,150,243,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <PersonIcon sx={{ fontSize: 16, color: '#2196f3' }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{crew.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{crew.role}</Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => setAssignDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >{t('equip.btn.cancel')}</Button>
          <Button
            onClick={handleAssign}
            variant="contained"
            disabled={!selectedCrewId}
            sx={{
              background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
              color: '#fff',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 4,
              boxShadow: '0 4px 14px rgba(33,150,243,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)',
                boxShadow: '0 6px 20px rgba(33,150,243,0.4)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.87)',
              },
            }}
          >{t('equip.btn.assign')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bookingsDialogOpen}
        onClose={() => setBookingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('success')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('success')}>
              <ScheduleIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{t('equip.book.title')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {selectedEquipmentBookings?.name}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setBookingsDialogOpen(false)} 
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          {bookings.length === 0 && availability.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'rgba(255,255,255,0.87)' }}>
              <Box sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(76,175,80,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50' }} />
              </Box>
              <Typography sx={{ fontWeight: 500 }}>{t('equip.book.none')}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{t('equip.book.available')}</Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {bookings.map(booking => (
                <Box key={booking.id} sx={{ 
                  p: 2.5, 
                  bgcolor: 'rgba(33, 150, 243, 0.08)', 
                  borderRadius: 2,
                  border: '1px solid rgba(33, 150, 243, 0.2)',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.12)' },
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {booking.purpose || 'Booking'}
                    </Typography>
                    <Chip
                      label={booking.status}
                      size="small"
                      sx={{ 
                        bgcolor: booking.status === 'confirmed' ? '#4caf50' : '#9333ea',
                        color: '#fff',
                        fontWeight: 600,
                        borderRadius: 1.5,
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                    {booking.start_date} - {booking.end_date}
                  </Typography>
                </Box>
              ))}
              {availability.map(avail => (
                <Box key={avail.id} sx={{ 
                  p: 2.5, 
                  bgcolor: avail.status === 'service' ? 'rgba(147, 51, 234, 0.08)' : 'rgba(244, 67, 54, 0.08)', 
                  borderRadius: 2,
                  border: `1px solid ${avail.status === 'service' ? 'rgba(147, 51, 234, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
                  transition: 'all 0.2s',
                  '&:hover': { 
                    bgcolor: avail.status === 'service' ? 'rgba(147, 51, 234, 0.12)' : 'rgba(244, 67, 54, 0.12)',
                  },
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {avail.status === 'service' ? (
                        <WarningIcon sx={{ color: '#9333ea' }} />
                      ) : (
                        <BlockIcon sx={{ color: '#f44336' }} />
                      )}
                      <Typography sx={{ fontWeight: 600 }}>
                        {avail.status === 'service' ? t('equip.book.service') : t('equip.book.unavailable')}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                    {avail.start_date} - {avail.end_date}
                  </Typography>
                  {avail.reason && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 0.5 }}>
                      {t('equip.book.reason', { reason: avail.reason })}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5, 
          px: 3,
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            startIcon={<AddIcon />}
            onClick={handleOpenCreateBooking}
            sx={{ 
              color: '#2196f3',
              borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(33,150,243,0.1)' },
            }}
          >{t('equip.book.new')}</Button>
          <Button
            onClick={() => setBookingsDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >{t('equip.btn.close')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={templatesDialogOpen}
        onClose={() => setTemplatesDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('success')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('success')}>
              <BookmarkIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{t('equip.tpl.title')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.tpl.subtitle')}</Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setTemplatesDialogOpen(false)} 
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          {templates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'rgba(255,255,255,0.87)' }}>
              <Box sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(76,175,80,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}>
                <BookmarkIcon sx={{ fontSize: 36, opacity: 0.5 }} />
              </Box>
              <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>{t('equip.tpl.none')}</Typography>
              <Typography variant="body2" sx={{ mb: 3 }}>
                {selectedEquipmentIds.size > 0
                  ? t('equip.tpl.selectedCount', { n: selectedEquipmentIds.size })
                  : t('equip.tpl.pickOrAll')}
              </Typography>
              {equipment.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<CopyIcon />}
                  onClick={handleCreateTemplateFromEquipment}
                  sx={{ 
                    borderColor: 'rgba(76,175,80,0.5)', 
                    color: '#4caf50',
                    borderRadius: 2,
                    '&:hover': { borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                  }}
                >
                  {selectedEquipmentIds.size > 0
                    ? t('equip.tpl.fromNSelected', { n: selectedEquipmentIds.size })
                    : t('equip.tpl.fromAll')}
                </Button>
              )}
            </Box>
          ) : (
            <Stack spacing={2}>
              {templates.map(template => (
                <Card key={template.id} sx={{ 
                  bgcolor: template.is_global ? 'rgba(33,150,243,0.08)' : 'rgba(0,0,0,0.2)', 
                  border: template.is_global 
                    ? '1px solid rgba(33,150,243,0.3)' 
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': { 
                    bgcolor: template.is_global ? 'rgba(33,150,243,0.12)' : 'rgba(0,0,0,0.3)',
                    borderColor: template.is_global ? 'rgba(33,150,243,0.5)' : 'rgba(76,175,80,0.3)',
                  },
                }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {template.is_global && (
                            <Tooltip title={t('equip.tt.globalTpl')}>
                              <PublicIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                            </Tooltip>
                          )}
                          {template.name}
                          {template.is_default && (
                            <StarIcon sx={{ color: '#9333ea', fontSize: 18 }} />
                          )}
                        </Typography>
                        {template.description && (
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 0.5 }}>
                            {template.description}
                          </Typography>
                        )}
                        {/* Show project association info */}
                        <Typography variant="caption" sx={{ 
                          color: template.is_global ? '#2196f3' : 'rgba(255,255,255,0.4)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          mt: 0.5,
                        }}>
                          {template.is_global ? (
                            <>
                              <PublicIcon sx={{ fontSize: 12 }} />
                              {t('equip.tpl.availAll')}
                            </>
                          ) : (
                            <>
                              <LockIcon sx={{ fontSize: 12 }} />
                              {t('equip.tpl.thisOnly')}
                            </>
                          )}
                        </Typography>
                      </Box>
                      <Chip 
                        label={t('equip.tpl.itemCount', { n: template.item_count || 0 })} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(76,175,80,0.15)', 
                          color: '#4caf50',
                          fontWeight: 600,
                          borderRadius: 1.5,
                        }} 
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                      {template.is_global && (
                        <Chip 
                          icon={<PublicIcon sx={{ fontSize: '14px !important' }} />} 
                          label="Global" 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(33,150,243,0.15)', 
                            color: '#2196f3',
                            borderRadius: 1,
                            '& .MuiChip-icon': { color: '#2196f3' },
                          }} 
                        />
                      )}
                      {template.category && (
                        <Chip label={template.category} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', borderRadius: 1 }} />
                      )}
                      {template.use_case && (
                        <Chip label={template.use_case} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', borderRadius: 1 }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlaylistAddIcon />}
                        onClick={() => handleApplyTemplate(template.id)}
                        sx={{ 
                          background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
                          color: '#fff', 
                          borderRadius: 1.5,
                          fontWeight: 600,
                          '&:hover': { background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)' },
                        }}
                      >{t('equip.tpl.use')}</Button>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteTemplate(template.id)}
                        aria-label={t('equip.aria.delTpl', { name: template.name ?? '' }).trim()}
                        sx={{
                          color: 'rgba(244,67,54,0.7)',
                          '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)' },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5, 
          px: 3,
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          {equipment.length > 0 && (
            <Button
              startIcon={<CopyIcon />}
              onClick={handleCreateTemplateFromEquipment}
              sx={{ 
                color: '#4caf50',
                borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' },
              }}
            >
              {selectedEquipmentIds.size > 0
                ? t('equip.tpl.fromNSelected', { n: selectedEquipmentIds.size })
                : t('equip.tpl.fromAll')}
            </Button>
          )}
          <Button
            onClick={() => setTemplatesDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >{t('equip.btn.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Template Form Dialog - for creating/editing templates */}
      <Dialog
        open={templateFormOpen}
        onClose={() => setTemplateFormOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('success')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('success')}>
            <BookmarkIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {editingTemplate ? t('equip.tpl.editTitle') : t('equip.tpl.createTitle')}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {t('equip.tpl.formItems', { n: templateFormData.items.length })}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setTemplateFormOpen(false)} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              label={t('equip.lbl.tplName')}
              value={templateFormData.name}
              onChange={e => setTemplateFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              sx={{ 
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiOutlinedInput-input': { color: '#fff' },
              }}
            />
            <TextField
              label={t('equip.lbl.description')}
              value={templateFormData.description}
              onChange={e => setTemplateFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              sx={{ 
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiOutlinedInput-input': { color: '#fff' },
              }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label={t('equip.lbl.category')}
                  value={templateFormData.category}
                  onChange={e => setTemplateFormData(prev => ({ ...prev, category: e.target.value }))}
                  fullWidth
                  sx={{ 
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiOutlinedInput-input': { color: '#fff' },
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label={t('equip.lbl.useCase')}
                  value={templateFormData.use_case}
                  onChange={e => setTemplateFormData(prev => ({ ...prev, use_case: e.target.value }))}
                  fullWidth
                  sx={{ 
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiOutlinedInput-input': { color: '#fff' },
                  }}
                />
              </Grid>
            </Grid>

            {/* Global template toggle */}
            <Box 
              onClick={() => setTemplateFormData(prev => ({ ...prev, is_global: !prev.is_global }))}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                p: 2,
                borderRadius: 2,
                bgcolor: templateFormData.is_global ? 'rgba(33,150,243,0.1)' : 'rgba(255,255,255,0.03)',
                border: templateFormData.is_global 
                  ? '1px solid rgba(33,150,243,0.4)' 
                  : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { 
                  borderColor: templateFormData.is_global 
                    ? 'rgba(33,150,243,0.6)' 
                    : 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: templateFormData.is_global ? 'rgba(33,150,243,0.2)' : 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {templateFormData.is_global ? (
                    <PublicIcon sx={{ color: '#2196f3' }} />
                  ) : (
                    <LockIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                  )}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: templateFormData.is_global ? '#2196f3' : '#fff' }}>
                    {templateFormData.is_global ? t('equip.tpl.globalMal') : t('equip.tpl.projectMal')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {templateFormData.is_global
                      ? t('equip.tpl.availAll2')
                      : t('equip.tpl.thisOnly2')}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{
                width: 50,
                height: 26,
                borderRadius: 13,
                bgcolor: templateFormData.is_global ? '#2196f3' : 'rgba(255,255,255,0.2)',
                position: 'relative',
                transition: 'all 0.2s',
              }}>
                <Box sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  position: 'absolute',
                  top: 2,
                  left: templateFormData.is_global ? 26 : 2,
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
              </Box>
            </Box>

            {/* Preview of items */}
            {templateFormData.items.length > 0 && (
              <Box sx={{ 
                bgcolor: 'rgba(0,0,0,0.2)', 
                borderRadius: 2, 
                p: 2,
                maxHeight: 200,
                overflow: 'auto',
              }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>{t('equip.tpl.included')}</Typography>
                {templateFormData.items.map((item, idx) => (
                  <Chip
                    key={idx}
                    label={item.name}
                    size="small"
                    sx={{ 
                      m: 0.5, 
                      bgcolor: 'rgba(76,175,80,0.15)', 
                      color: '#4caf50',
                      borderRadius: 1,
                    }}
                  />
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5,
          gap: 1,
        }}>
          <Button
            onClick={() => setTemplateFormOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              borderRadius: 2,
              px: 3,
            }}
          >{t('equip.btn.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSaveTemplate}
            disabled={!templateFormData.name.trim()}
            sx={{ 
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              borderRadius: 2,
              px: 3,
              fontWeight: 600,
            }}
          >
            {editingTemplate ? t('equip.tpl.updateBtn') : t('equip.tpl.createBtn')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={shopDialogOpen}
        onClose={() => setShopDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.95) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)',
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.28)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('primary')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('primary')}>
              <ShoppingCartIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{t('equip.shop.title')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.shop.subtitle')}</Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setShopDialogOpen(false)} 
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Box sx={{ 
            textAlign: 'center', 
            py: 5,
            background: 'linear-gradient(135deg, rgba(147,51,234,0.08) 0%, rgba(147,51,234,0.03) 100%)',
            borderRadius: 2,
            border: '1px solid rgba(147,51,234,0.15)',
          }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(147,51,234,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}>
              <ShoppingCartIcon sx={{ fontSize: 40, color: '#9333ea' }} />
            </Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>{t('equip.shop.build')}</Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 4, maxWidth: 500, mx: 'auto' }}>{t('equip.shop.blurb')}</Typography>
            <Stack spacing={1.5} sx={{ maxWidth: 320, mx: 'auto' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => handleOpenShopCategory('Kamera', 'https://www.foto.no/foto/kamera')}
                sx={{ 
                  background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                  color: '#fff !important',
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '& .MuiButton-startIcon, & .MuiSvgIcon-root': { color: '#fff !important' },
                  '&:hover': { background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)' } 
                }}
              >{t('equip.shop.cameras')}</Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => handleOpenShopCategory('Lys', 'https://www.foto.no/foto/foto-tilbehor/belysning')}
                sx={{ 
                  background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                  color: '#fff !important',
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '& .MuiButton-startIcon, & .MuiSvgIcon-root': { color: '#fff !important' },
                  '&:hover': { background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)' } 
                }}
              >{t('equip.shop.lighting')}</Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => handleOpenShopCategory('Video', 'https://www.foto.no/video')}
                sx={{ 
                  background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                  color: '#fff !important',
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '& .MuiButton-startIcon, & .MuiSvgIcon-root': { color: '#fff !important' },
                  '&:hover': { background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)' } 
                }}
              >{t('equip.shop.video')}</Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => handleOpenShopCategory('Lyd', 'https://www.foto.no/lyd')}
                sx={{ 
                  background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                  color: '#fff !important',
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '& .MuiButton-startIcon, & .MuiSvgIcon-root': { color: '#fff !important' },
                  '&:hover': { background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)' } 
                }}
              >{t('equip.shop.audio')}</Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => {
                  setSelectedVendorCategory('all');
                  window.open('https://www.foto.no', '_blank', 'noopener,noreferrer');
                }}
                sx={{ 
                  borderColor: 'rgba(147,51,234,0.5)', 
                  color: '#9333ea', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { borderColor: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' } 
                }}
              >{t('equip.shop.allCats')}</Button>
            </Stack>
          </Box>

          {/* Category filter chips */}
          {effectiveVendorCategories.length > 0 && (
            <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={t('equip.chip.all')}
                size="small"
                onClick={() => setSelectedVendorCategory('all')}
                sx={{
                  bgcolor: selectedVendorCategory === 'all' ? '#9333ea' : 'rgba(147,51,234,0.12)',
                  color: selectedVendorCategory === 'all' ? '#fff' : '#9333ea',
                  fontWeight: selectedVendorCategory === 'all' ? 700 : 400,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: selectedVendorCategory === 'all' ? '#7e22ce' : 'rgba(147,51,234,0.25)' },
                }}
              />
              {effectiveVendorCategories.map(vc => (
                <Chip
                  key={vc.category}
                  label={t('equip.shop.catCount', { cat: vc.category, n: vc.count })}
                  size="small"
                  onClick={() => setSelectedVendorCategory(vc.category)}
                  sx={{
                    bgcolor: selectedVendorCategory === vc.category ? '#9333ea' : 'rgba(147,51,234,0.12)',
                    color: selectedVendorCategory === vc.category ? '#fff' : '#9333ea',
                    fontWeight: selectedVendorCategory === vc.category ? 700 : 400,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: selectedVendorCategory === vc.category ? '#7e22ce' : 'rgba(147,51,234,0.25)' },
                  }}
                />
              ))}
            </Box>
          )}

          {(vendorLinksUnavailable || vendorLinks.length === 0) && (
            <Alert
              severity="info"
              sx={{
                mt: 3,
                bgcolor: 'rgba(147,51,234,0.12)',
                border: '1px solid rgba(147,51,234,0.35)',
                color: '#e9d5ff',
                '& .MuiAlert-icon': { color: '#c084fc' },
              }}
            >
              {t('equip.shop.fallbackInfo')}
            </Alert>
          )}

          {recommendedVendorLinks.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>{t('equip.shop.recommended')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, md: 2 } }}>
                {recommendedVendorLinks.map((link, index) => {
                  const showVerifiedPrice = isVendorPriceFresh(link);
                  const verifiedPrice = showVerifiedPrice ? Number(link.price) : null;
                  return (
                    <Box
                      key={`${link.id}-${index}`}
                      sx={{
                        width: {
                          xs: '100%',
                          sm: 'calc(50% - 8px)',
                          md: 'calc(33.333% - 11px)',
                        },
                        minWidth: 0,
                      }}
                    >
                      <Card 
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.05)', 
                          border: '1px solid rgba(148,163,184,0.26)',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
                        }}
                        onClick={() => window.open(link.affiliate_url || link.product_url, '_blank', 'noopener,noreferrer')}
                      >
                        <CardContent>
                          <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                            {link.product_name}
                          </Typography>
                          {link.description && (
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                              {link.description}
                            </Typography>
                          )}
                          {showVerifiedPrice && verifiedPrice !== null ? (
                            <Typography variant="h6" sx={{ color: '#4caf50', mt: 1, fontWeight: 700 }}>
                              kr {verifiedPrice.toLocaleString('nb-NO')},-
                            </Typography>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#fbbf24', mt: 1, display: 'block' }}>{t('equip.shop.checkPrice')}</Typography>
                          )}
                          {showVerifiedPrice && link.updated_at && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.25, display: 'block' }}>
                              {t('equip.shop.updated', { date: new Date(link.updated_at).toLocaleDateString('nb-NO') })}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Chip label={link.category} size="small" sx={{ bgcolor: 'rgba(147,51,234,0.2)', color: '#9333ea' }} />
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                              {link.vendor_name}
                            </Typography>
                            <OpenInNewIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5, 
          px: 3,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => setShopDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >{t('equip.btn.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog
        open={newCategoryDialogOpen}
        onClose={() => {
          setNewCategoryDialogOpen(false);
          setNewCategoryName('');
        }}
        maxWidth="xs"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('success')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('success', 40)}>
              <AddIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.h.newCat')}</Typography>
          </Box>
          <IconButton 
            onClick={() => setNewCategoryDialogOpen(false)}
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>{t('equip.newCat.hint')}</Typography>
          <TextField
            fullWidth
            label={t('equip.lbl.catName')}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategoryName.trim()) {
                handleAddCustomCategory();
              }
            }}
            autoFocus
            placeholder={t('equip.ph.newCat')}
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                bgcolor: 'rgba(0,0,0,0.2)', 
                color: '#fff',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(76,175,80,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#4caf50' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
          />
          {customCategories.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>{t('equip.newCat.yours')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {customCategories.map(cat => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    onDelete={() => handleRemoveCustomCategory(cat)}
                    sx={{ 
                      bgcolor: 'rgba(76,175,80,0.15)', 
                      color: '#4caf50',
                      '& .MuiChip-deleteIcon': { color: 'rgba(76,175,80,0.5)', '&:hover': { color: '#f44336' } },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => {
              setNewCategoryDialogOpen(false);
              setNewCategoryName('');
            }}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >{t('equip.btn.cancel')}</Button>
          <Button
            onClick={handleAddCustomCategory}
            variant="contained"
            disabled={!newCategoryName.trim() || allCategories.includes(newCategoryName.trim())}
            sx={{
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              color: '#fff',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              boxShadow: '0 4px 14px rgba(76,175,80,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.87)',
              },
            }}
          >{t('equip.btn.add')}</Button>
        </DialogActions>
      </Dialog>

      {/* Image Picker Dialog */}
      <Dialog
        open={imagePickerOpen}
        onClose={() => {
          setImagePickerOpen(false);
          setImageSearchResults([]);
          setImageSearchQuery('');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3, 
            minHeight: 500,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('violet')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('violet')}>
              <PhotoLibraryIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{t('equip.img.title')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.img.subtitle')}</Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setImagePickerOpen(false)}
            aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Tabs
            value={imagePickerTab}
            onChange={(_, v) => setImagePickerTab(v)}
            sx={{
              borderBottom: '1px solid rgba(148,163,184,0.22)',
              px: 1.5,
              py: 0.5,
              bgcolor: 'rgba(15,23,42,0.58)',
              '& .MuiTab-root': {
                minHeight: 38,
                textTransform: 'none',
                color: 'rgba(203,213,225,0.78)',
                borderRadius: 1.25,
                border: '1px solid transparent',
                mx: 0.5,
                '&:hover': { bgcolor: 'rgba(148,163,184,0.08)' },
              },
              '& .MuiTab-root.Mui-selected': {
                color: '#f5d0fe',
                borderColor: 'rgba(192,132,252,0.42)',
                bgcolor: 'rgba(147,51,234,0.22)',
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            <Tab icon={<SearchIcon />} label={t('equip.tab.searchImages')} iconPosition="start" />
            <Tab icon={<MovieIcon />} label={t('equip.tab.filmRefs')} iconPosition="start" />
            <Tab icon={<LinkIcon />} label={t('equip.tab.pasteUrl')} iconPosition="start" />
          </Tabs>
          
          <Box sx={{ p: 2 }}>
            {/* Search Input — hidden when URL tab is active */}
            {imagePickerTab < 2 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                placeholder={imagePickerTab === 0 ? t('equip.ph.searchEquip') : t('equip.ph.searchFilm')}
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchImages(imagePickerTab === 1 ? imageSearchQuery + ' cinema film' : imageSearchQuery)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                  } 
                }}
              />
              <Button
                variant="contained"
                onClick={() => searchImages(imagePickerTab === 1 ? imageSearchQuery + ' cinema film' : imageSearchQuery)}
                disabled={imageSearchLoading || !imageSearchQuery.trim()}
                sx={{ 
                  bgcolor: '#9333ea', 
                  color: '#fff',
                  minWidth: 100,
                  '&:hover': { bgcolor: '#6d28d9' },
                }}
              >
                {imageSearchLoading ? <CircularProgress size={20} /> : t('equip.img.searchBtn')}
              </Button>
            </Box>
            )}
            
            {/* Quick Search Suggestions — content differs by tab */}
            {imagePickerTab < 2 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {(imagePickerTab === 0
                ? ['Kamera', 'Lys', 'Stativ', 'Mikrofon', 'Drone', 'Generator', 'Film props', 'Studio equipment']
                : ['Cinematography', 'Film noir', 'Scene design', 'Location scouting', 'Production design', 'Set lighting', 'Behind scenes', 'Film crew']
              ).map((term) => (
                <Chip
                  key={term}
                  label={term}
                  size="small"
                  onClick={() => {
                    setImageSearchQuery(term);
                    searchImages(imagePickerTab === 1 ? term + ' cinema film' : term);
                  }}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    color: '#fff',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(147,51,234,0.2)' },
                  }}
                />
              ))}
            </Box>
            )}

            {/* URL paste tab */}
            {imagePickerTab === 2 && (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  placeholder={t('equip.ph.pasteUrl')}
                  value={tempImageUrl}
                  onChange={(e) => setTempImageUrl(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      color: '#fff',
                    },
                  }}
                />
                {tempImageUrl && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>{t('equip.img.preview')}</Typography>
                    <Box
                      component="img"
                      src={tempImageUrl}
                      alt={t('equip.img.previewAlt')}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      sx={{
                        width: '100%',
                        maxHeight: 240,
                        objectFit: 'contain',
                        borderRadius: 1,
                        border: '1px solid rgba(148,163,184,0.26)',
                        bgcolor: 'rgba(0,0,0,0.3)',
                      }}
                    />
                  </Box>
                )}
                <Button
                  variant="contained"
                  disabled={!tempImageUrl.trim()}
                  onClick={() => {
                    if (tempImageUrl.trim()) {
                      handleSelectSearchImage(tempImageUrl.trim());
                      setTempImageUrl('');
                    }
                  }}
                  sx={{ bgcolor: '#9333ea', color: '#fff', '&:hover': { bgcolor: '#6d28d9' }, alignSelf: 'flex-start' }}
                >{t('equip.btn.useImage')}</Button>
              </Stack>
            )}
            
            {/* Search Results */}
            {imageSearchLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress sx={{ color: '#9333ea' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.img.searching')}</Typography>
              </Box>
            ) : imageSearchResults.length > 0 ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {t('equip.img.foundCount', { n: imageSearchResults.length })}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {[
                      { name: 'pexels', color: '#05bc9e', label: 'Pexels' },
                      { name: 'pixabay', color: '#27a955', label: 'Pixabay' },
                      { name: 'unsplash', color: '#2196f3', label: 'Unsplash' },
                      { name: 'openverse', color: '#9c27b0', label: 'Openverse' },
                      { name: 'wikimedia', color: '#3e85ba', label: 'Wikimedia' },
                      { name: 'shotcafe', color: '#9333ea', label: 'shot.cafe' },
                    ].filter(s => imageSearchResults.some(r => r.source === s.name))
                    .map(s => (
                      <Box
                        key={s.name}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          bgcolor: `${s.color}22`,
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                        <Typography variant="caption" sx={{ color: s.color, fontSize: '9px', fontWeight: 600 }}>
                          {s.label} ({imageSearchResults.filter(r => r.source === s.name).length})
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <ImageList cols={isMobile ? 2 : isTablet ? 3 : 4} gap={8} sx={{ maxHeight: 350 }}>
                  {imageSearchResults.map((img) => (
                    <ImageListItem 
                      key={img.id}
                      sx={{ 
                        cursor: 'pointer',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '2px solid transparent',
                        transition: 'all 0.2s',
                        '&:hover': { 
                          border: '2px solid #9333ea',
                          transform: 'scale(1.02)',
                        },
                      }}
                      onClick={() => handleSelectSearchImage(img.url)}
                    >
                      <img
                        src={img.thumbnailUrl}
                        alt={img.description || 'Search result'}
                        loading="lazy"
                        style={{ height: 120, objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.png'; }}
                      />
                      <ImageListItemBar
                        subtitle={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ 
                              textTransform: 'capitalize',
                              bgcolor: 
                                img.source === 'unsplash' ? 'rgba(33,150,243,0.4)' : 
                                img.source === 'pexels' ? 'rgba(5,188,158,0.4)' :
                                img.source === 'pixabay' ? 'rgba(39,169,85,0.4)' :
                                img.source === 'openverse' ? 'rgba(156,39,176,0.4)' :
                                img.source === 'wikimedia' ? 'rgba(62,133,186,0.4)' :
                                img.source === 'shotcafe' ? 'rgba(147,51,234,0.4)' :
                                'rgba(100,100,100,0.4)',
                              px: 0.5,
                              borderRadius: 0.5,
                              fontSize: '9px',
                              fontWeight: 600,
                            }}>
                              {img.source === 'shotcafe' ? 'shot.cafe' : img.source}
                            </Typography>
                            {img.photographer && (
                              <Typography variant="caption" sx={{ opacity: 0.7, ml: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '9px' }}>
                                {img.photographer}
                              </Typography>
                            )}
                          </Box>
                        }
                        sx={{
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          '& .MuiImageListItemBar-title': { fontSize: 12 },
                        }}
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1, display: 'block', textAlign: 'center' }}>{t('equip.img.footer')}</Typography>
              </Box>
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 6, 
                color: 'rgba(255,255,255,0.87)',
              }}>
                <PhotoLibraryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography variant="body1">{t('equip.img.emptyTitle')}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>{t('equip.img.emptyBody')}</Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2 }}>
          <Button
            onClick={() => {
              setImagePickerOpen(false);
              setImageSearchResults([]);
            }}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >{t('equip.btn.cancel')}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,77,77,0.3)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxWidth: 400,
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('danger', 'center')}>
          <Box sx={getRoleRoomDialogIconSx('danger')}>
            <DeleteIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.del.title')}</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography>
            {t('equip.del.body', { name: `"${equipmentToDelete?.name}"` })}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>{t('equip.del.warn')}</Typography>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(148,163,184,0.22)', 
          p: 2.5,
          gap: 1,
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
            }}
          >{t('equip.btn.cancel')}</Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            sx={{ 
              bgcolor: '#f44336',
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: '#d32f2f' },
            }}
          >{t('equip.btn.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog
        open={bulkActionDialogOpen}
        onClose={() => setBulkActionDialogOpen(false)}
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxWidth: 450,
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx(bulkActionType === 'delete' ? 'danger' : 'warning', 'center')}>
          <Box sx={getRoleRoomDialogIconSx(bulkActionType === 'delete' ? 'danger' : 'warning')}>
            {bulkActionType === 'delete' ? <DeleteIcon /> : <EditIcon />}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {bulkActionType === 'delete' ? t('equip.bulk.delTitle') :
             bulkActionType === 'status' ? t('equip.bulk.statusTitle') : t('equip.bulk.assignTitle')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ mb: 2 }}>
            {t('equip.bulk.selectedCount', { n: selectedEquipmentIds.size })}
          </Typography>
          {bulkActionType === 'status' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.newStatus')}</InputLabel>
              <Select
                value={bulkNewStatus}
                onChange={(e) => setBulkNewStatus(e.target.value as Equipment['status'])}
                label={t('equip.lbl.newStatus')}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {bulkActionType === 'assign' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.assignTo')}</InputLabel>
              <Select
                value={bulkAssignCrewId}
                onChange={(e) => setBulkAssignCrewId(e.target.value)}
                label={t('equip.lbl.assignTo')}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {crewMembers.map((crew) => (
                  <MenuItem key={crew.id} value={crew.id}>{crew.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {bulkActionType === 'delete' && (
            <Typography variant="body2" sx={{ color: 'rgba(255,77,77,0.8)' }}>{t('equip.bulk.warn')}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setBulkActionDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.btn.cancel')}</Button>
          <Button
            onClick={handleConfirmBulkAction}
            variant="contained"
            sx={{ 
              bgcolor: bulkActionType === 'delete' ? '#f44336' : '#9333ea',
              '&:hover': { bgcolor: bulkActionType === 'delete' ? '#d32f2f' : '#6d28d9' },
            }}
          >{t('equip.btn.confirm')}</Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('violet')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={getRoleRoomDialogIconSx('violet')}>
              <HistoryIcon sx={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.hist.title')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {selectedEquipmentHistory?.name}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setHistoryDialogOpen(false)} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {equipmentHistory.map((entry) => (
              <Box key={entry.id} sx={{ 
                p: 2, 
                bgcolor: 'rgba(255,255,255,0.03)', 
                borderRadius: 2,
                borderLeft: '3px solid #9c27b0',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{entry.action}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {new Date(entry.timestamp).toLocaleString('nb-NO')}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{entry.details}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>av {entry.user}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2 }}>
          <Button onClick={() => setHistoryDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.btn.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog
        open={maintenanceDialogOpen}
        onClose={() => setMaintenanceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('teal', 'center')}>
          <Box sx={getRoleRoomDialogIconSx('teal')}>
            <BuildIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.maint.title')}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {selectedEquipmentMaintenance?.name}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            <TextField
              label={t('equip.lbl.date')}
              type="date"
              value={maintenanceForm.scheduledDate}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.maintType')}</InputLabel>
              <Select
                value={maintenanceForm.type}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value as typeof maintenanceForm.type })}
                label={t('equip.lbl.maintType')}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="routine">{t('equip.maint.routine')}</MenuItem>
                <MenuItem value="repair">{t('equip.maint.repair')}</MenuItem>
                <MenuItem value="inspection">{t('equip.maint.inspection')}</MenuItem>
                <MenuItem value="calibration">{t('equip.maint.calibration')}</MenuItem>
                <MenuItem value="cleaning">{t('equip.maint.cleaning')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('equip.lbl.notes')}
              value={maintenanceForm.notes}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <GlobalMentionHelper
              text={typeof maintenanceForm.notes === 'string' ? maintenanceForm.notes : ''}
              localCandidates={[
                ...mentionCandidates,
                selectedEquipmentMaintenance?.name ?? '',
              ]}
              onApplySuggestion={(name) =>
                setMaintenanceForm((prev) => ({
                  ...prev,
                  notes: applyMentionSuggestion(prev.notes, name),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setMaintenanceDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.btn.cancel')}</Button>
          <Button
            onClick={handleScheduleMaintenance}
            variant="contained"
            sx={{ bgcolor: '#009688', '&:hover': { bgcolor: '#00897b' } }}
          >{t('equip.btn.schedule')}</Button>
        </DialogActions>
      </Dialog>

      {/* Create Booking Dialog */}
      <Dialog
        open={createBookingDialogOpen}
        onClose={() => setCreateBookingDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('info', 'center')}>
          <Box sx={getRoleRoomDialogIconSx('info')}>
            <CalendarTodayIcon sx={{ color: '#fff' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Ny booking</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label={t('equip.lbl.startDate')}
                type="date"
                value={bookingForm.startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setBookingForm(f => ({ ...f, startDate: v }));
                  checkBookingConflicts(v, bookingForm.endDate);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
              <TextField
                label={t('equip.lbl.endDate')}
                type="date"
                value={bookingForm.endDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setBookingForm(f => ({ ...f, endDate: v }));
                  checkBookingConflicts(bookingForm.startDate, v);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Box>
            {conflictChecking && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.6)' }}>
                <CircularProgress size={14} sx={{ color: 'inherit' }} />
                <Typography variant="caption">{t('equip.book.checking')}</Typography>
              </Box>
            )}
            {!conflictChecking && bookingConflicts.length > 0 && (
              <Box sx={{
                p: 2, borderRadius: 2,
                bgcolor: 'rgba(147,51,234,0.12)',
                border: '1px solid rgba(147,51,234,0.4)',
                display: 'flex', alignItems: 'flex-start', gap: 1.5,
              }}>
                <WarningIcon sx={{ color: '#9333ea', mt: 0.25, flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" sx={{ color: '#c084fc', fontWeight: 600 }}>
                    {t('equip.book.conflictsFound', { n: bookingConflicts.length })}
                  </Typography>
                  {bookingConflicts.map(c => (
                    <Typography key={c.id} variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                      {c.type === 'booking' ? t('equip.book.conflictBooking', { purpose: c.purpose ?? '' }) : c.reason ?? c.type} ({c.start_date} – {c.end_date})
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
            <TextField
              label={t('equip.lbl.purpose')}
              value={bookingForm.purpose}
              onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <TextField
              label={t('equip.lbl.notes')}
              value={bookingForm.notes}
              onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <GlobalMentionHelper
              text={typeof bookingForm.notes === 'string' ? bookingForm.notes : ''}
              localCandidates={[
                ...mentionCandidates,
                selectedEquipmentBookings?.name ?? '',
              ]}
              onApplySuggestion={(name) =>
                setBookingForm((prev) => ({
                  ...prev,
                  notes: applyMentionSuggestion(prev.notes, name),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateBookingDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.btn.cancel')}</Button>
          <Button
            onClick={handleCreateBooking}
            variant="contained"
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}
          >{t('equip.book.create')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Check-out Dialog ─────────────────────────── */}
      <Dialog open={checkoutDialogOpen} onClose={() => setCheckoutDialogOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 3 } }}>
        <DialogTitle component="div" sx={{ ...getRoleRoomDialogTitleSx('info'), pb: 1 }}>
          <Box sx={getRoleRoomDialogIconSx('info', 40)}>
            <CheckOutIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>{t('equip.checkout.title')}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{checkoutEquipment?.name}</Typography>
          </Box>
          <IconButton onClick={() => setCheckoutDialogOpen(false)} aria-label={t('equip.aria.close')} sx={{ ...ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX, ml: 'auto' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.checkoutTo')}</InputLabel>
              <Select value={checkoutForm.crewId} onChange={(e) => setCheckoutForm(f => ({ ...f, crewId: e.target.value }))} label={t('equip.lbl.checkoutTo')}
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                {crewMembers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label={t('equip.lbl.quantity')} type="number" inputProps={{ min: 1, max: checkoutEquipment?.quantity ?? 99 }}
              value={checkoutForm.quantity}
              onChange={(e) => setCheckoutForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }}
            />
            <TextField label={t('equip.lbl.purpose')} value={checkoutForm.purpose} onChange={(e) => setCheckoutForm(f => ({ ...f, purpose: e.target.value }))} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }} />
            {!isOnline && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.3)', display: 'flex', gap: 1, alignItems: 'center' }}>
                <OfflineIcon sx={{ color: '#9333ea', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: '#c084fc' }}>{t('equip.checkout.offline')}</Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setCheckoutDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.btn.cancel')}</Button>
          <Button onClick={handleConfirmCheckout} variant="contained" disabled={!checkoutForm.crewId}
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}>
            {isOnline ? t('equip.checkout.confirm') : t('equip.checkout.queue')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Check-in Dialog ──────────────────────────── */}
      <Dialog open={checkinDialogOpen} onClose={() => setCheckinDialogOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 3 } }}>
        <DialogTitle component="div" sx={{ ...getRoleRoomDialogTitleSx('success'), pb: 1 }}>
          <Box sx={getRoleRoomDialogIconSx('success', 40)}>
            <CheckInIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>{t('equip.checkin.title')}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{checkinEquipment?.name}</Typography>
          </Box>
          <IconButton onClick={() => setCheckinDialogOpen(false)} aria-label={t('equip.aria.close')} sx={{ ...ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX, ml: 'auto' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.lbl.condReturn')}</InputLabel>
              <Select value={checkinForm.condition} onChange={(e) => setCheckinForm(f => ({ ...f, condition: e.target.value as Equipment['condition'] }))} label={t('equip.lbl.condReturn')}
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                {Object.entries(conditionLabels).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label={t('equip.lbl.remarks')} multiline rows={2} value={checkinForm.notes} onChange={(e) => setCheckinForm(f => ({ ...f, notes: e.target.value }))} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }} />
            <GlobalMentionHelper
              text={typeof checkinForm.notes === 'string' ? checkinForm.notes : ''}
              localCandidates={[
                ...mentionCandidates,
                checkinEquipment?.name ?? '',
              ]}
              onApplySuggestion={(name) =>
                setCheckinForm((prev) => ({
                  ...prev,
                  notes: applyMentionSuggestion(prev.notes, name),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setCheckinDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.btn.cancel')}</Button>
          <Button onClick={handleConfirmCheckin} variant="contained" sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#43a047' } }}>{t('equip.btn.checkin')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Reports Dialog ───────────────────────────── */}
      <Dialog
        open={reportsDialogOpen}
        onClose={() => setReportsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            color: '#f8fafc',
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid rgba(148,163,184,0.28)',
            background:
              'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.94) 56%, rgba(30,41,59,0.9) 100%)',
            boxShadow: '0 24px 64px rgba(2,6,23,0.56)',
            backdropFilter: 'blur(22px)',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: '1px solid rgba(148,163,184,0.22)',
            background:
              'linear-gradient(120deg, rgba(147,51,234,0.2) 0%, rgba(59,130,246,0.1) 52%, rgba(15,23,42,0.25) 100%)',
          }}
        >
          <Box sx={getRoleRoomDialogIconSx('primary', 42)}>
            <ReportIcon sx={{ color: '#fff' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{t('equip.reports.title')}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.74)' }}>{t('equip.reports.subtitle')}</Typography>
          </Box>
          <Stack direction="row" spacing={0.75} sx={{ ml: 'auto', mr: 1, display: { xs: 'none', md: 'flex' } }}>
            <Chip size="small" label={t('equip.reports.total', { n: equipment.length })} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#93c5fd', border: '1px solid rgba(147,197,253,0.34)' }} />
            <Chip size="small" label={t('equip.reports.missing', { n: missingItems.length })} sx={{ bgcolor: 'rgba(234,179,8,0.15)', color: '#facc15', border: '1px solid rgba(250,204,21,0.3)' }} />
            <Chip size="small" label={t('equip.reports.maint', { n: maintenanceItems.length })} sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(252,165,165,0.3)' }} />
          </Stack>
          <IconButton onClick={() => setReportsDialogOpen(false)} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}><CloseIcon /></IconButton>
        </DialogTitle>

        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            pt: 1.5,
            pb: 1,
            borderBottom: '1px solid rgba(148,163,184,0.16)',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.42) 0%, rgba(2,6,23,0.08) 100%)',
          }}
        >
          <Tabs
            value={reportsTab}
            onChange={(_, v) => setReportsTab(v)}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                minHeight: 38,
                textTransform: 'none',
                borderRadius: 1.25,
                border: '1px solid rgba(148,163,184,0.24)',
                color: 'rgba(203,213,225,0.75)',
                bgcolor: 'rgba(15,23,42,0.56)',
                mr: 1,
                px: 1.5,
                '&.Mui-selected': {
                  color: '#f5d0fe',
                  borderColor: 'rgba(192,132,252,0.48)',
                  bgcolor: 'rgba(147,51,234,0.24)',
                  boxShadow: '0 8px 22px rgba(147,51,234,0.24)',
                },
              },
            }}
          >
            <Tab icon={<Inventory2Icon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('equip.tab.equipList')} />
            <Tab icon={<MissingItemIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('equip.reports.missingTab', { n: missingItems.length })} />
            <Tab icon={<WarningIcon sx={{ fontSize: 16 }} />} iconPosition="start" label={t('equip.reports.maintTab', { n: maintenanceItems.length })} />
          </Tabs>
        </Box>

        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2.25 }}>
          {reportsTab === 0 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.76)', mb: 1.5 }}>
                {t('equip.reports.fullList', { n: equipment.length })}
              </Typography>
              <Box sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5, display: 'grid', gap: 1 }}>
                {equipment.map(eq => (
                  <Box key={eq.id} sx={{ px: 1.25, py: 1, borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.2)', background: 'linear-gradient(140deg, rgba(15,23,42,0.72) 0%, rgba(30,41,59,0.58) 100%)', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={statusLabels[eq.status]} size="small" sx={{ bgcolor: `${STATUS_COLORS[eq.status]}20`, color: STATUS_COLORS[eq.status], border: `1px solid ${STATUS_COLORS[eq.status]}55`, fontSize: '0.65rem', minWidth: 90 }} />
                    <Typography variant="body2" sx={{ color: '#fff', flex: 1, minWidth: 180, fontWeight: 600 }}>{eq.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.72)', minWidth: 120 }}>{eq.brand} {eq.model}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.72)', minWidth: 54 }}>×{eq.quantity}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.72)', minWidth: 96 }}>{getCrewName(eq.assignees?.[0]?.crew_id ?? '')}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          {reportsTab === 1 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.76)', mb: 1.5 }}>
                {t('equip.reports.missingList', { n: missingItems.length })}
              </Typography>
              {missingItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, borderRadius: 2, border: '1px solid rgba(76,175,80,0.34)', background: 'linear-gradient(145deg, rgba(22,101,52,0.22) 0%, rgba(15,23,42,0.62) 100%)' }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#4ade80', mb: 1 }} />
                  <Typography sx={{ color: '#86efac', fontWeight: 600 }}>{t('equip.reports.allAssigned')}</Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5, display: 'grid', gap: 1 }}>
                  {missingItems.map(eq => (
                    <Box key={eq.id} sx={{ px: 1.25, py: 1, borderRadius: 1.5, border: '1px solid rgba(250,204,21,0.32)', background: 'linear-gradient(145deg, rgba(113,63,18,0.32) 0%, rgba(15,23,42,0.62) 100%)', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <MissingItemIcon sx={{ color: '#facc15', fontSize: 18, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: '#fff', flex: 1, minWidth: 180, fontWeight: 600 }}>{eq.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.74)', minWidth: 110 }}>{eq.category}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.74)', minWidth: 54 }}>×{eq.quantity}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {reportsTab === 2 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.76)', mb: 1.5 }}>
                {t('equip.reports.maintList', { n: maintenanceItems.length })}
              </Typography>
              {maintenanceItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, borderRadius: 2, border: '1px solid rgba(76,175,80,0.34)', background: 'linear-gradient(145deg, rgba(22,101,52,0.22) 0%, rgba(15,23,42,0.62) 100%)' }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#4ade80', mb: 1 }} />
                  <Typography sx={{ color: '#86efac', fontWeight: 600 }}>{t('equip.reports.noMaint')}</Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5, display: 'grid', gap: 1 }}>
                  {maintenanceItems.map(eq => (
                    <Box key={eq.id} sx={{ px: 1.25, py: 1, borderRadius: 1.5, border: '1px solid rgba(248,113,113,0.34)', background: 'linear-gradient(145deg, rgba(127,29,29,0.28) 0%, rgba(15,23,42,0.64) 100%)', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WarningIcon sx={{ color: '#f87171', fontSize: 18, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{eq.name}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.72)' }}>{eq.notes ?? t('equip.reports.noRemarks')}</Typography>
                        {eq.notes?.trim() && (
                          <Typography variant="caption" sx={{ color: 'rgba(148,163,184,0.88)', display: 'block', mt: 0.25 }}>
                            {t('equip.reports.writtenBy', { name: eq.notes_author_name || eq.notesAuthorName || t('equip.form.notRegistered') })}
                            {formatEquipmentNoteTimestamp(eq.notes_updated_at || eq.notesUpdatedAt)
                              ? ` • ${formatEquipmentNoteTimestamp(eq.notes_updated_at || eq.notesUpdatedAt)}`
                              : ''}
                          </Typography>
                        )}
                      </Box>
                      <Chip label={conditionLabels[eq.condition]} size="small" sx={{ bgcolor: `${CONDITION_COLORS[eq.condition]}20`, color: CONDITION_COLORS[eq.condition], border: `1px solid ${CONDITION_COLORS[eq.condition]}55`, fontSize: '0.65rem' }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2.25, borderTop: '1px solid rgba(148,163,184,0.2)', gap: 1 }}>
          <Button onClick={() => setReportsDialogOpen(false)} variant="outlined" sx={{ borderColor: 'rgba(148,163,184,0.46)', color: 'rgba(226,232,240,0.88)', '&:hover': { borderColor: 'rgba(192,132,252,0.62)', bgcolor: 'rgba(147,51,234,0.12)' } }}>{t('equip.btn.close')}</Button>
          <Button
            onClick={handleDownloadGearList}
            variant="contained"
            startIcon={<DownloadIcon />}
            sx={{
              ml: 'auto',
              color: '#050816',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 60%, #3b82f6 100%)',
              boxShadow: '0 12px 28px rgba(147,51,234,0.38)',
              '&:hover': { background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 60%, #60a5fa 100%)' },
            }}
          >{t('equip.btn.downloadCsv')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Offline outbox viewer ────────────────────── */}
      <Dialog open={offlineOutboxOpen} onClose={() => setOfflineOutboxOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)', backdropFilter: 'blur(20px)', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 3 } }}>
        <DialogTitle component="div" sx={{ ...getRoleRoomDialogTitleSx('danger'), pb: 1 }}>
          <Box sx={getRoleRoomDialogIconSx('danger', 40)}>
            <OfflineIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>{t('equip.offline.title')}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.offline.waiting', { n: offlineQueueCount })}</Typography>
          </Box>
          <IconButton onClick={() => setOfflineOutboxOpen(false)} aria-label={t('equip.aria.close')} sx={{ ...ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX, ml: 'auto' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {offlineQueue.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
              <Typography sx={{ color: '#4caf50' }}>{t('equip.offline.none')}</Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {offlineQueue.map(e => (
                <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid rgba(148,163,184,0.16)' }}>
                  {e.type === 'checkout' ? <CheckOutIcon sx={{ color: '#2196f3', fontSize: 20 }} /> : <CheckInIcon sx={{ color: '#4caf50', fontSize: 20 }} />}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                      {e.type === 'checkout' ? t('equip.offline.checkout') : t('equip.offline.checkin')} — {e.payload.equipmentId.slice(0, 8)}…
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(e.ts).toLocaleString('nb-NO')}
                    </Typography>
                  </Box>
                  <Chip label={t('equip.chip.waiting')} size="small" sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc' }} />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2.5, gap: 1 }}>
          <Button onClick={() => { persistOfflineQueue([]); setOfflineOutboxOpen(false); }} sx={{ color: '#f44336' }}>{t('equip.btn.clearQueue')}</Button>
          <Button onClick={() => setOfflineOutboxOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('equip.btn.close')}</Button>
          <Button onClick={handleSyncOfflineQueue} variant="contained" startIcon={<SyncIcon />} disabled={!isOnline}
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}>{t('equip.btn.syncNow')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Catalog Bridge Dialog ─────────────────────────────────────────────
          5 tabs: Manufacturer catalog · Gear news · Market prices · Lens DB · Camera/Memory.
          The onAddToProject / onImportFrom* callbacks pre-fill the add-dialog.  */}
      <Dialog
        open={catalogBridgeOpen}
        onClose={() => { setCatalogBridgeOpen(false); setCatalogDialogTab(0); }}
        fullScreen
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, rgba(2,6,23,0.98) 0%, rgba(15,23,42,0.94) 50%, rgba(30,41,59,0.88) 100%)',
            color: '#fff',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            ...getRoleRoomDialogTitleSx('primary'),
            borderBottom: '1px solid rgba(148,163,184,0.24)',
            pb: 0.5,
            background: 'linear-gradient(90deg, rgba(124,58,237,0.16) 0%, rgba(56,189,248,0.1) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={getRoleRoomDialogIconSx('primary', 36)}>
              <SearchIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.bridge.title')}</Typography>
            <Chip
              label={t('equip.chip.importInto')}
              size="small"
              sx={{
                bgcolor: 'rgba(192,132,252,0.2)',
                color: '#e9d5ff',
                border: '1px solid rgba(192,132,252,0.45)',
              }}
            />
          </Box>
          <IconButton onClick={() => { setCatalogBridgeOpen(false); setCatalogDialogTab(0); }} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {/* Sub-tab navigation */}
        <Box
          sx={{
            borderBottom: '1px solid rgba(148,163,184,0.24)',
            bgcolor: 'rgba(15,23,42,0.52)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Tabs
            value={catalogDialogTab}
            onChange={(_, v: number) => setCatalogDialogTab(v)}
            sx={{
              px: 2,
              py: 0.5,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                color: 'rgba(203,213,225,0.75)',
                minHeight: 40,
                textTransform: 'none',
                fontSize: '0.8rem',
                borderRadius: 1.25,
                border: '1px solid rgba(148,163,184,0.22)',
                bgcolor: 'rgba(15,23,42,0.56)',
                mr: 0.75,
                px: 1.4,
                '&:hover': { bgcolor: 'rgba(148,163,184,0.1)' },
              },
              '& .MuiTab-root.Mui-selected': {
                color: '#f5d0fe',
                borderColor: 'rgba(192,132,252,0.48)',
                bgcolor: 'rgba(147,51,234,0.24)',
                boxShadow: '0 8px 20px rgba(147,51,234,0.22)',
              },
            }}
          >
            <Tab icon={<SearchIcon sx={{ fontSize: 16 }} />} label={t('equip.tab.productCatalog')} iconPosition="start" />
            <Tab icon={<NewspaperIcon sx={{ fontSize: 16 }} />} label={t('equip.tab.gearNews')} iconPosition="start" />
            <Tab icon={<TrendingUpIcon sx={{ fontSize: 16 }} />} label={t('equip.tab.marketPrices')} iconPosition="start" />
            <Tab icon={<PhotoLibraryIcon sx={{ fontSize: 16 }} />} label={t('equip.tab.lenses')} iconPosition="start" />
            <Tab icon={<Inventory2Icon sx={{ fontSize: 16 }} />} label={t('equip.tab.camCards')} iconPosition="start" />
          </Tabs>
        </Box>

        <DialogContent sx={{ p: 0, overflow: 'auto', bgcolor: 'transparent' }}>

          {/* Tab 0 — Manufacturer product catalog */}
          {catalogDialogTab === 0 && (
            <Box sx={{ p: { xs: 1.5, md: 2 } }}>
              <EquipmentCatalogBrowser
                profession="videographer"
                userId={user?.id ? String(user.id) : ''}
                onAddToProject={handleImportFromCatalog}
                roleRoomBranding
              />
            </Box>
          )}

          {/* Tab 1 — Gear news feed */}
          {catalogDialogTab === 1 && (
            <Box sx={CATALOG_BRIDGE_TAB_PANEL_SX}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <NewspaperIcon sx={{ color: '#9333ea' }} />{t('equip.news.title')}</Typography>
              {gearNewsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, py: 6 }}>
                  <CircularProgress sx={{ color: '#9333ea' }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.news.loading')}</Typography>
                </Box>
              ) : gearNewsArticles.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <NewspaperIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.news.none')}</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: CATALOG_BRIDGE_CARD_GAP }}>
                  {gearNewsArticles.map((article, idx) => (
                    <Box
                      key={`${article.id || article.url || article.title || 'gear-news'}-${idx}`}
                      sx={{
                        width: {
                          xs: '100%',
                          sm: 'calc(50% - 8px)',
                          md: 'calc(33.333% - 11px)',
                        },
                        minWidth: 0,
                      }}
                    >
                      <Card sx={CATALOG_BRIDGE_CARD_SX}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
                            {article.category && <Chip label={article.category} size="small" sx={{ bgcolor: 'rgba(147,51,234,0.2)', color: '#c084fc', fontSize: '0.7rem' }} />}
                            {article.isNew && <Chip label={t('equip.badge.new')} size="small" color="error" sx={{ fontSize: '0.7rem' }} />}
                            {article.isTrending && <Chip label="Trend" size="small" color="warning" sx={{ fontSize: '0.7rem' }} />}
                          </Box>
                          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 1, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {article.title}
                          </Typography>
                          {article.summary && (
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {article.summary}
                            </Typography>
                          )}
                          {(article.source || article.publishedAt) && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mt: 1 }}>
                              {article.source ? `${article.source}` : ''}
                              {article.source && article.publishedAt ? ' · ' : ''}
                              {article.publishedAt
                                ? new Date(article.publishedAt).toLocaleDateString('nb-NO', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : ''}
                            </Typography>
                          )}
                          {article.rating !== undefined && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <Rating value={article.rating / 2} precision={0.5} size="small" readOnly sx={{ '& .MuiRating-iconFilled': { color: '#9333ea' } }} />
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{article.rating}</Typography>
                            </Box>
                          )}
                        </CardContent>
                        <Box sx={{ p: 1.5, pt: 0, display: 'flex', justifyContent: 'flex-end' }}>
                          {article.url && (
                            <IconButton size="small" href={article.url} target="_blank" rel="noopener noreferrer" aria-label={t('equip.aria.openArticle', { title: article.title ?? article.url })} sx={{ color: '#9333ea' }}>
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </Card>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Tab 2 — Market prices */}
          {catalogDialogTab === 2 && (
            <Box sx={CATALOG_BRIDGE_TAB_PANEL_SX}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon sx={{ color: '#4caf50' }} />{t('equip.market.title')}</Typography>
              {marketPricesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, py: 6 }}>
                  <CircularProgress sx={{ color: '#4caf50' }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.market.loading')}</Typography>
                </Box>
              ) : marketItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <AttachMoneyIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.market.none')}</Typography>
                </Box>
              ) : (
                <>
                  {/* Summary row */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: CATALOG_BRIDGE_CARD_GAP, mb: 3 }}>
                    <Box sx={{ width: { xs: '100%', sm: 'calc(33.333% - 11px)' }, minWidth: 0 }}>
                      <Paper sx={{ ...CATALOG_BRIDGE_SURFACE_SX, borderColor: 'rgba(76,175,80,0.35)' }}>
                        <TrendingUpIcon sx={{ color: '#4caf50', mb: 1 }} />
                        <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700 }}>
                          {marketItems.filter(i => i.availability === 'available').length}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.market.availProducts')}</Typography>
                      </Paper>
                    </Box>
                    <Box sx={{ width: { xs: '100%', sm: 'calc(33.333% - 11px)' }, minWidth: 0 }}>
                      <Paper sx={{ ...CATALOG_BRIDGE_SURFACE_SX, borderColor: 'rgba(147,51,234,0.35)' }}>
                        <AttachMoneyIcon sx={{ color: '#9333ea', mb: 1 }} />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                          {t('equip.market.priceFrom', { v: marketItems.length > 0 ? Math.min(...marketItems.map(i => parseFloat(i.currentPrice || '0'))).toLocaleString('nb-NO') : '—' })}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                          {t('equip.market.priceTo', { v: marketItems.length > 0 ? Math.max(...marketItems.map(i => parseFloat(i.currentPrice || '0'))).toLocaleString('nb-NO') : '—' })}
                        </Typography>
                      </Paper>
                    </Box>
                    <Box sx={{ width: { xs: '100%', sm: 'calc(33.333% - 11px)' }, minWidth: 0 }}>
                      <Paper sx={{ ...CATALOG_BRIDGE_SURFACE_SX, borderColor: 'rgba(33,150,243,0.35)' }}>
                        <StarIcon sx={{ color: '#2196f3', mb: 1 }} />
                        <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700 }}>
                          {(marketItems.reduce((acc, item) => acc + parseFloat(item.videographerRating || '0'), 0) / (marketItems.length || 1)).toFixed(1)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.market.avgRating')}</Typography>
                      </Paper>
                    </Box>
                  </Box>

                  {/* Items grid */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: CATALOG_BRIDGE_CARD_GAP }}>
                    {marketItems.map(item => (
                      <Box
                        key={item.id}
                        sx={{
                          width: {
                            xs: '100%',
                            sm: 'calc(50% - 8px)',
                            md: 'calc(33.333% - 11px)',
                          },
                          minWidth: 0,
                        }}
                      >
                        <Card sx={CATALOG_BRIDGE_CARD_SX}>
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>
                              {item.brand} {item.model}
                            </Typography>
                            <Chip label={item.category} size="small" sx={{ bgcolor: 'rgba(76,175,80,0.15)', color: '#4caf50', mb: 1.5, fontSize: '0.72rem' }} />
                            <Stack spacing={0.75}>
                              {item.currentPrice && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.market.priceLbl')}</Typography>
                                  <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 700, fontSize: '1rem' }}>
                                    {parseFloat(item.currentPrice).toLocaleString('nb-NO')} kr
                                  </Typography>
                                </Box>
                              )}
                              {item.msrp && item.currentPrice && parseFloat(item.msrp) > parseFloat(item.currentPrice) && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>
                                    {t('equip.market.uvp', { v: parseFloat(item.msrp).toLocaleString('nb-NO') })}
                                  </Typography>
                                  <Chip label={`-${Math.round((1 - parseFloat(item.currentPrice) / parseFloat(item.msrp)) * 100)}%`} size="small" color="success" sx={{ fontSize: '0.7rem' }} />
                                </Box>
                              )}
                              {item.videographerRating && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.market.ratingLbl')}</Typography>
                                  <Rating value={parseFloat(item.videographerRating)} size="small" readOnly precision={0.1} sx={{ '& .MuiRating-iconFilled': { color: '#2196f3' } }} />
                                </Box>
                              )}
                              {item.availability && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.market.statusLbl')}</Typography>
                                  <Chip label={item.availability} size="small" color={item.availability === 'available' ? 'success' : item.availability === 'limited' ? 'warning' : 'default'} sx={{ fontSize: '0.7rem' }} />
                                </Box>
                              )}
                            </Stack>
                          </CardContent>
                          <Box sx={{ p: 1.5, pt: 0, display: 'flex', gap: 1 }}>
                            {item.sourceUrl && (
                              <IconButton size="small" href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={t('equip.aria.openSource', { brand: item.brand, model: item.model })} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            )}
                            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => handleImportFromMarket(item)}
                              sx={{ ml: 'auto', borderColor: '#9333ea', color: '#9333ea', fontSize: '0.75rem', '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' } }}>{t('equip.btn.import')}</Button>
                          </Box>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* Tab 3 — Lens database */}
          {catalogDialogTab === 3 && (
            <Box sx={CATALOG_BRIDGE_TAB_PANEL_SX}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhotoLibraryIcon sx={{ color: '#9333ea' }} />{t('equip.lens.title')}</Typography>
              {lensDbLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, py: 6 }}>
                  <CircularProgress sx={{ color: '#9333ea' }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.lens.loading')}</Typography>
                </Box>
              ) : lensItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <PhotoLibraryIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.lens.none')}</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: CATALOG_BRIDGE_CARD_GAP }}>
                  {lensItems.map(lens => (
                    <Box
                      key={lens.id}
                      sx={{
                        width: {
                          xs: '100%',
                          sm: 'calc(50% - 8px)',
                          md: 'calc(33.333% - 11px)',
                        },
                        minWidth: 0,
                      }}
                    >
                      <Card sx={CATALOG_BRIDGE_CARD_SX}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 0.5 }}>
                            {lens.brand} {lens.model}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
                            {lens.focalLength && lens.aperture && (
                              <Chip label={`${lens.focalLength} ${lens.aperture}`} size="small" sx={{ bgcolor: 'rgba(147,51,234,0.2)', color: '#c084fc', fontWeight: 600, fontSize: '0.72rem' }} />
                            )}
                            {lens.mount && <Chip label={lens.mount} size="small" variant="outlined" sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)', fontSize: '0.72rem' }} />}
                            {lens.lensType && <Chip label={lens.lensType} size="small" variant="outlined" sx={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)', fontSize: '0.72rem' }} />}
                          </Box>
                          <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
                          <Stack spacing={0.75}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.lens.stabilization')}</Typography>
                              <CheckCircleIcon sx={{ fontSize: 16, color: lens.imageStabilization ? '#4caf50' : 'rgba(255,255,255,0.2)' }} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.lens.weather')}</Typography>
                              <CheckCircleIcon sx={{ fontSize: 16, color: lens.weatherSealing ? '#4caf50' : 'rgba(255,255,255,0.2)' }} />
                            </Box>
                            {lens.weight && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.lens.weight')}</Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>{lens.weight}</Typography>
                              </Box>
                            )}
                            {lens.currentPrice && (
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{t('equip.lens.price')}</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#9333ea' }}>
                                  {parseFloat(lens.currentPrice).toLocaleString('nb-NO')} kr
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </CardContent>
                        <Box sx={{ p: 1.5, pt: 0 }}>
                          <Button size="small" fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => handleImportFromLens(lens)}
                            sx={{ borderColor: '#9333ea', color: '#9333ea', fontSize: '0.75rem', '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' } }}>{t('equip.btn.addToProject')}</Button>
                        </Box>
                      </Card>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Tab 4 — Backend camera + memory card catalog */}
          {catalogDialogTab === 4 && (
            <Box sx={CATALOG_BRIDGE_TAB_PANEL_SX}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Inventory2Icon sx={{ color: '#c084fc' }} />{t('equip.cards.title')}</Typography>
                <Button
                  variant="outlined"
                  onClick={handleSyncCameraDiscovery}
                  startIcon={cameraSyncing ? <CircularProgress size={14} sx={{ color: '#c084fc' }} /> : <SyncIcon />}
                  disabled={cameraSyncing}
                  sx={{
                    borderColor: '#c084fc',
                    color: '#c084fc',
                    '&:hover': { borderColor: '#d8b4fe', bgcolor: 'rgba(216,180,254,0.08)' },
                  }}
                >{t('equip.btn.discoverySync')}</Button>
              </Box>

              {cameraCatalogUnavailable && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t('equip.cards.endpointDown')}
                </Alert>
              )}

              <Grid container spacing={0} sx={{ gap: CATALOG_BRIDGE_CARD_GAP, mb: 2.5 }}>
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    label={t('equip.lbl.searchCam')}
                    value={cameraCatalogSearch}
                    onChange={(event) => setCameraCatalogSearch(event.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.6)' },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.lbl.camType')}</InputLabel>
                    <Select
                      value={cameraCatalogType}
                      label={t('equip.lbl.camType')}
                      onChange={(event) => setCameraCatalogType(event.target.value as 'all' | CameraCatalogType)}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      }}
                    >
                      <MenuItem value="all">{t('equip.filter.allTypes')}</MenuItem>
                      <MenuItem value="photo">{t('equip.cam.photo')}</MenuItem>
                      <MenuItem value="video">Video</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.lbl.brand')}</InputLabel>
                    <Select
                      value={cameraBrandFilter}
                      label={t('equip.lbl.brand')}
                      onChange={(event) => setCameraBrandFilter(String(event.target.value))}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      }}
                    >
                      <MenuItem value="all">{t('equip.filter.allBrands')}</MenuItem>
                      {cameraBrandOptions.map((brand) => (
                        <MenuItem key={brand} value={brand}>
                          {brand}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={1}>
                  <Box
                    sx={{
                      height: '100%',
                      minHeight: 40,
                      px: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: { xs: 'flex-start', md: 'center' },
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 1,
                    }}
                  >
                    <FormControlLabel
                      sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.72rem', color: 'rgba(255,255,255,0.78)' } }}
                      control={
                        <Switch
                          size="small"
                          checked={cameraNetflixOnly}
                          onChange={(event) => setCameraNetflixOnly(event.target.checked)}
                          sx={{
                            mr: 0.5,
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#e50914' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              bgcolor: '#e50914',
                            },
                          }}
                        />
                      }
                      label="Netflix"
                    />
                  </Box>
                </Grid>
              </Grid>

              {cameraCatalogLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, py: 8 }}>
                  <CircularProgress sx={{ color: '#c084fc' }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.cards.loading')}</Typography>
                </Box>
              ) : cameraCatalogItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Inventory2Icon sx={{ fontSize: 52, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.cards.none')}</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: CATALOG_BRIDGE_CARD_GAP }}>
                  <Box sx={{ width: { xs: '100%', lg: 'calc(58.333% - 8px)' }, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: CATALOG_BRIDGE_CARD_GAP }}>
                      {cameraCatalogItems.map((camera) => (
                        <Box
                          key={camera.id}
                          sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' }, minWidth: 0 }}
                        >
                          <Card
                            onClick={() => setSelectedCameraId(camera.id)}
                            sx={{
                              height: '100%',
                              cursor: 'pointer',
                              position: 'relative',
                              overflow: 'hidden',
                              border: selectedCameraId === camera.id ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.08)',
                              background: selectedCameraId === camera.id
                                ? 'linear-gradient(150deg, rgba(192,132,252,0.2) 0%, rgba(30,41,59,0.85) 100%)'
                                : 'linear-gradient(150deg, rgba(15,23,42,0.78) 0%, rgba(30,41,59,0.55) 100%)',
                              boxShadow: selectedCameraId === camera.id
                                ? '0 10px 26px rgba(147,51,234,0.34)'
                                : '0 8px 20px rgba(2,6,23,0.28)',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 2,
                                background: selectedCameraId === camera.id
                                  ? 'linear-gradient(90deg, #c084fc, #38bdf8)'
                                  : 'linear-gradient(90deg, rgba(148,163,184,0.65), rgba(125,211,252,0.55))',
                              },
                              '&:hover': {
                                background: 'linear-gradient(150deg, rgba(51,65,85,0.92) 0%, rgba(30,41,59,0.78) 100%)',
                                borderColor: 'rgba(125,211,252,0.38)',
                              },
                            }}
                          >
                            <CardContent>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                                  {camera.brand} {camera.model}
                                </Typography>
                                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                  <Chip
                                    size="small"
                                    label={camera.type === 'photo' ? t('equip.cam.photo') : t('equip.cam.video')}
                                    sx={{
                                      bgcolor: camera.type === 'photo' ? 'rgba(33,150,243,0.2)' : 'rgba(156,39,176,0.25)',
                                      color: camera.type === 'photo' ? '#90caf9' : '#d1a3ff',
                                    }}
                                  />
                                  {camera.isNetflixCertified && renderNetflixBadge('Netflix', true)}
                                </Stack>
                              </Box>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mb: 1.5 }}>
                                {camera.description || t('equip.cam.noDesc')}
                              </Typography>
                              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mb: 1 }}>
                                {camera.category && (
                                  <Chip size="small" label={camera.category} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }} />
                                )}
                                {camera.mount && (
                                  <Chip size="small" label={camera.mount} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.72)' }} />
                                )}
                              </Stack>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleImportFromCameraRecord(camera);
                                }}
                                sx={{
                                  borderColor: '#c084fc',
                                  color: '#c084fc',
                                  '&:hover': { bgcolor: 'rgba(192,132,252,0.1)', borderColor: '#d8b4fe' },
                                }}
                              >{t('equip.btn.importCamera')}</Button>
                            </CardContent>
                          </Card>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Box sx={{ width: { xs: '100%', lg: 'calc(41.667% - 8px)' }, minWidth: 0 }}>
                    <Paper
                      sx={{
                        p: 2,
                        background:
                          'linear-gradient(160deg, rgba(2,6,23,0.84) 0%, rgba(15,23,42,0.72) 44%, rgba(30,41,59,0.62) 100%)',
                        border: '1px solid rgba(125,211,252,0.18)',
                        borderRadius: 2,
                        boxShadow: '0 14px 30px rgba(2,6,23,0.35)',
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, mb: 1.5 }}>{t('equip.cards.compat')}</Typography>
                      {selectedCamera ? (
                        <>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', mb: 0.5 }}>
                            {t('equip.cards.selectedCam', { brand: selectedCamera.brand, model: selectedCamera.model })}
                          </Typography>
                          {selectedCamera.isNetflixCertified && (
                            <Box sx={{ mb: 1 }}>
                              {renderNetflixBadge(t('equip.netflixCertifiedCine'), false)}
                            </Box>
                          )}
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            Kilde: {selectedCamera.sourceMeta?.source ?? 'seed'}
                            {selectedCamera.sourceMeta?.version ? ` · v${selectedCamera.sourceMeta.version}` : ''}
                            {selectedCamera.sourceMeta?.lastSeenAt
                              ? ` · sist sett ${new Date(selectedCamera.sourceMeta.lastSeenAt).toLocaleString('nb-NO')}`
                              : ''}
                          </Typography>
                          <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />

                          {memoryCardsUnavailable ? (
                            <Alert severity="warning">{t('equip.cards.memUnavailable')}</Alert>
                          ) : memoryCardsLoading ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                              <CircularProgress size={18} sx={{ color: '#c084fc' }} />
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.cards.loadingCards')}</Typography>
                            </Box>
                          ) : memoryCardItems.length === 0 ? (
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.cards.noneForCam')}</Typography>
                          ) : (
                            <Stack spacing={1}>
                              {memoryCardItems.map((card) => (
                                <Paper
                                  key={card.id}
                                  sx={{
                                    p: 1.25,
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                  }}
                                >
                                  <Box>
                                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                                      {card.fullName}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                      {card.readSpeed} / {card.writeSpeed} MB/s · {card.maxCapacity}
                                    </Typography>
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => handleImportFromMemoryCard(card)}
                                    sx={{
                                      borderColor: '#c084fc',
                                      color: '#c084fc',
                                      minWidth: 98,
                                      '&:hover': { bgcolor: 'rgba(192,132,252,0.1)', borderColor: '#d8b4fe' },
                                    }}
                                  >{t('equip.btn.import')}</Button>
                                </Paper>
                              ))}
                            </Stack>
                          )}
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>{t('equip.cards.pickCam')}</Typography>
                      )}
                    </Paper>

                    {(cameraCatalogFetching || cameraSyncing) && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', mt: 1, display: 'block' }}>{t('equip.cards.updating')}</Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}

        </DialogContent>
      </Dialog>

      <Dialog
        open={qrLabelDialogOpen}
        onClose={() => setQrLabelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          },
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('primary')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={getRoleRoomDialogIconSx('primary', 38)}>
              <QrCodeIcon sx={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.qr.title')}</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {qrTargetEquipment?.name || t('equip.qr.equipFallback')}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setQrLabelDialogOpen(false)} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          {qrTargetEquipment && (
            <Stack spacing={1.5}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(148,163,184,0.26)',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <Box
                  component="img"
                  src={getEquipmentQrImageUrl(qrTargetEquipment)}
                  alt={t('equip.aria.qrFor', { name: qrTargetEquipment.name })}
                  sx={{
                    width: { xs: 220, sm: 260 },
                    height: { xs: 220, sm: 260 },
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    p: 1,
                  }}
                />
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label={`ID: ${qrTargetEquipment.id}`}
                  sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc', maxWidth: '100%' }}
                />
                <Chip
                  label={t('equip.qr.serialChip', { serial: qrTargetEquipment.serial_number || 'N/A' })}
                  sx={{ bgcolor: 'rgba(33,150,243,0.15)', color: '#64b5f6' }}
                />
                <Chip
                  label={t('equip.qr.qtyChip', { n: qrTargetEquipment.quantity })}
                  sx={{ bgcolor: 'rgba(76,175,80,0.15)', color: '#81c784' }}
                />
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2, gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            onClick={() => qrTargetEquipment && handleCopyQrPayload(qrTargetEquipment)}
            sx={{ borderColor: '#64b5f6', color: '#64b5f6' }}
          >{t('equip.btn.copyQr')}</Button>
          <Button
            variant="outlined"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => {
              setQrLabelDialogOpen(false);
              setQrScanInput('');
              setQrScanError(null);
              setQrScanDialogOpen(true);
            }}
            sx={{ borderColor: '#81c784', color: '#81c784' }}
          >{t('equip.btn.scan')}</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => qrTargetEquipment && handlePrintQR(qrTargetEquipment)}
            sx={{
              bgcolor: '#9333ea',
              color: '#fff',
              fontWeight: 700,
              '&:hover': { bgcolor: '#a855f7' },
            }}
          >{t('equip.btn.printLabel')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={qrScanDialogOpen}
        onClose={() => setQrScanDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, rgba(2,6,23,0.95) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          },
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('primary')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={getRoleRoomDialogIconSx('primary', 38)}>
              <QrCodeScannerIcon sx={{ color: '#fff' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.qr.scanTitle')}</Typography>
          </Box>
          <IconButton onClick={() => setQrScanDialogOpen(false)} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1.25, fontSize: '0.9rem' }}>{t('equip.qr.scanHint')}</Typography>
          <QrCameraScanner
            active={qrScanDialogOpen}
            scanTargetLabel={t('equip.scan.warehouseQr')}
            onDetected={(value) => {
              setQrScanInput(value);
              setQrScanError(null);
              handleResolveScannedQr(value);
            }}
          />
          <TextField
            fullWidth
            multiline
            minRows={4}
            autoFocus
            value={qrScanInput}
            onChange={(event) => {
              setQrScanInput(event.target.value);
              if (qrScanError) setQrScanError(null);
            }}
            placeholder="role-room://warehouse/v1/..."
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(192,132,252,0.45)' },
                '&.Mui-focused fieldset': { borderColor: '#c084fc' },
              },
            }}
          />
          {qrScanError && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {qrScanError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2, gap: 1 }}>
          <Button onClick={() => setQrScanDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.8)' }}>{t('equip.btn.cancel')}</Button>
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                setQrScanInput(text);
                setQrScanError(null);
              } catch {
                setQrScanError(t('equip.toast.clipboardFailed'));
              }
            }}
            sx={{ borderColor: '#c084fc', color: '#c084fc' }}
          >{t('equip.btn.paste')}</Button>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => handleResolveScannedQr(qrScanInput)}
            sx={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              color: '#fff',
              fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #c084fc, #9333ea)' },
            }}
          >{t('equip.btn.interpretQr')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={serialScanDialogOpen}
        onClose={() => setSerialScanDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            background: 'linear-gradient(160deg, rgba(2,6,23,0.95) 0%, rgba(15,23,42,0.9) 52%, rgba(30,41,59,0.82) 100%)',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(148,163,184,0.26)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          },
        }}
      >
        <DialogTitle component="div" sx={getRoleRoomDialogTitleSx('primary')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={getRoleRoomDialogIconSx('primary', 38)}>
              <QrCodeScannerIcon sx={{ color: '#fff' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('equip.serial.title')}</Typography>
          </Box>
          <IconButton onClick={() => setSerialScanDialogOpen(false)} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 1.25, fontSize: '0.9rem' }}>{t('equip.serial.hint')}</Typography>
          <QrCameraScanner
            active={serialScanDialogOpen}
            formats={serialNumberScanFormats}
            scanTargetLabel={t('equip.scan.barcode')}
            onDetected={(value) => {
              setSerialScanInput(value);
              setSerialScanError(null);
              handleApplyScannedSerialNumber(value);
            }}
          />
          <TextField
            fullWidth
            autoFocus
            value={serialScanInput}
            onChange={(event) => {
              setSerialScanInput(event.target.value);
              if (serialScanError) setSerialScanError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleApplyScannedSerialNumber(serialScanInput);
              }
            }}
            placeholder={t('equip.ph.serialExample')}
            sx={{
              mt: 1.5,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(192,132,252,0.45)' },
                '&.Mui-focused fieldset': { borderColor: '#c084fc' },
              },
            }}
          />
          {serialScanError && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {serialScanError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(148,163,184,0.22)', p: 2, gap: 1 }}>
          <Button onClick={() => setSerialScanDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.8)' }}>{t('equip.btn.cancel')}</Button>
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                setSerialScanInput(text);
                setSerialScanError(null);
              } catch {
                setSerialScanError(t('equip.toast.clipboardFailed'));
              }
            }}
            sx={{ borderColor: '#c084fc', color: '#c084fc' }}
          >{t('equip.btn.paste')}</Button>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => handleApplyScannedSerialNumber(serialScanInput)}
            sx={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              color: '#fff',
              fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #c084fc, #9333ea)' },
            }}
          >{t('equip.btn.useCode')}</Button>
        </DialogActions>
      </Dialog>

      {/* ── Firmware Management Dialog ────────────────────────────────────────
          Shows firmware update status for all equipment registered in the
          project, reusing the standalone FirmwareManagementInterface panel.    */}
      <Dialog
        open={firmwarePanelOpen}
        onClose={() => setFirmwarePanelOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            background:
              'linear-gradient(160deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.9) 48%, rgba(30,41,59,0.82) 100%)',
            color: '#fff',
            border: '1px solid rgba(148,163,184,0.3)',
            borderRadius: 2,
            boxShadow: '0 18px 38px rgba(2,6,23,0.5)',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            ...getRoleRoomDialogTitleSx('primary'),
            borderBottom: '1px solid rgba(148,163,184,0.24)',
            background: 'linear-gradient(90deg, rgba(124,58,237,0.16) 0%, rgba(56,189,248,0.12) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={getRoleRoomDialogIconSx('primary', 36)}>
              <SyncIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>{t('equip.firmware.title')}</Typography>
          </Box>
          <IconButton onClick={() => setFirmwarePanelOpen(false)} aria-label={t('equip.aria.close')} sx={ROLE_ROOM_DIALOG_CLOSE_BUTTON_SX}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto' }}>
          <FirmwareManagementInterface
            profession="videographer"
            userId={user?.id ? String(user.id) : ''}
          />
        </DialogContent>
      </Dialog>

      <WarehouseInventoryDialog
        open={warehouseDialogOpen}
        onClose={() => {
          setWarehouseDialogOpen(false);
          refreshWarehouseSummary();
        }}
        projectId={projectId}
        title={t('equip.warehouse.title')}
        items={warehouseDialogItems}
        locationSeeds={locations.map((location) => ({ id: location.id, name: location.name }))}
        onRequestEditItem={(item) => {
          const target = equipment.find((entry) => entry.id === item.id);
          if (!target) return;
          setWarehouseDialogOpen(false);
          handleOpenDialog(target);
        }}
      />

    </Box>
  );
}

export default EquipmentManagementPanel;
