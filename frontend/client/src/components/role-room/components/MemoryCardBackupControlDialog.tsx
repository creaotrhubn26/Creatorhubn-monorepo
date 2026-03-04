import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  CloudQueue as CloudQueueIcon,
  CloudDone as CloudDoneIcon,
  DataArray as DataArrayIcon,
  Delete as DeleteIcon,
  DiscFull as DiscFullIcon,
  Dns as DnsIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  GraphicEq as GraphicEqIcon,
  Inventory2 as Inventory2Icon,
  Memory as MemoryIcon,
  PhotoCamera as PhotoCameraIcon,
  QrCode as QrCodeIcon,
  Save as SaveIcon,
  SdCard as SdCardIcon,
  Smartphone as SmartphoneIcon,
  Storage as StorageIcon,
  Sync as SyncIcon,
  FlightTakeoff as FlightTakeoffIcon,
  Videocam as VideocamIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/queryClient';
import { useBrandingSettings } from '../hooks/useBrandingSettings';
import netflixWordmark from '../../../assets/brands/netflix-wordmark.svg';
import {
  memoryCardControlApi,
  type MemoryCardControlEntry,
  type MemoryCardControlReport,
  type MemoryCardControlState,
  type MemoryCardBackupTargets,
  type MemoryCardLifecycleStage,
} from '../services/castingApiService';

type BackupStage = keyof MemoryCardBackupTargets;
type ShotListOption = { id: string; scene?: string; title?: string };

interface CameraRecord {
  id: string;
  brand: string;
  model: string;
  category?: string;
  type?: 'photo' | 'video';
  isNetflixCertified?: boolean;
}

interface MemoryCardTypeRecord {
  id: string;
  name: string;
  fullName: string;
  category: string;
  commonCapacities: string[];
  readSpeed: number;
  writeSpeed: number;
  maxCapacity: string;
}

interface MemoryCardBackupControlDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  shotLists: ShotListOption[];
  crewOptions?: Array<{ id: string; name: string; role?: string }>;
}

interface NewCardDraft {
  cardLabel: string;
  cameraId: string;
  crewId: string;
  shotListId: string;
  cardTypeId: string;
  capacity: string;
  productionTag: string;
  note: string;
  imageDataUrl: string;
}

type CameraGroupKey = 'cine' | 'drone' | 'audio' | 'photo' | 'mobileTablet' | 'other';

const collapsedCameraGroups: Record<CameraGroupKey, boolean> = {
  cine: false,
  drone: false,
  audio: false,
  photo: false,
  mobileTablet: false,
  other: false,
};

const backupStageLabels: Record<BackupStage, string> = {
  backup1: 'Sikkerhetskopi 1 (SSD)',
  backup2: 'Sikkerhetskopi 2 (RAID/NAS)',
  offsite: 'Offsite-kopi',
};

const lifecycleStageLabels: Record<MemoryCardLifecycleStage, string> = {
  in_use: 'I bruk',
  sealed: 'Forseglet',
  backup_started: 'Sikkerhetskopi startet',
  backup_completed: 'Sikkerhetskopi fullført',
  verified: 'Verifisert',
  archived: 'Arkivert',
};

const getStorageKey = (projectId: string) => `role-room-memory-card-control:${projectId}`;

const createDefaultState = (): MemoryCardControlState => ({
  shootDayLabel: '',
  entries: [],
  updatedAt: new Date().toISOString(),
});

const createEmptyDraft = (): NewCardDraft => ({
  cardLabel: '',
  cameraId: '',
  crewId: '',
  shotListId: '',
  cardTypeId: '',
  capacity: '',
  productionTag: '',
  note: '',
  imageDataUrl: '',
});

const normalizeEntry = (rawEntry: unknown): MemoryCardControlEntry | null => {
  if (!rawEntry || typeof rawEntry !== 'object') return null;
  const entry = rawEntry as Record<string, unknown>;
  const id = typeof entry.id === 'string' ? entry.id : `mc-${Date.now()}`;
  const cardLabel = typeof entry.cardLabel === 'string' ? entry.cardLabel : '';
  const cameraId = typeof entry.cameraId === 'string' ? entry.cameraId : '';
  const cameraLabel = typeof entry.cameraLabel === 'string' ? entry.cameraLabel : '';
  if (!cardLabel || !cameraId || !cameraLabel) return null;

  const lifecycleStage =
    typeof entry.lifecycleStage === 'string' &&
    entry.lifecycleStage in lifecycleStageLabels
      ? (entry.lifecycleStage as MemoryCardLifecycleStage)
      : 'in_use';

  const normalized: MemoryCardControlEntry = {
    id,
    cardLabel,
    cameraId,
    cameraLabel,
    assignedCrewId: typeof entry.assignedCrewId === 'string' ? entry.assignedCrewId : undefined,
    assignedCrewName: typeof entry.assignedCrewName === 'string' ? entry.assignedCrewName : undefined,
    assignedCrewRole: typeof entry.assignedCrewRole === 'string' ? entry.assignedCrewRole : undefined,
    cardTypeId: typeof entry.cardTypeId === 'string' ? entry.cardTypeId : undefined,
    cardTypeName: typeof entry.cardTypeName === 'string' ? entry.cardTypeName : undefined,
    capacity: typeof entry.capacity === 'string' ? entry.capacity : undefined,
    shotListId: typeof entry.shotListId === 'string' ? entry.shotListId : undefined,
    sceneLabel: typeof entry.sceneLabel === 'string' ? entry.sceneLabel : undefined,
    productionTag: typeof entry.productionTag === 'string' ? entry.productionTag : undefined,
    note: typeof entry.note === 'string' ? entry.note : undefined,
    imageDataUrl: typeof entry.imageDataUrl === 'string' ? entry.imageDataUrl : undefined,
    backups:
      entry.backups && typeof entry.backups === 'object'
        ? {
            backup1: Boolean((entry.backups as Record<string, unknown>).backup1),
            backup2: Boolean((entry.backups as Record<string, unknown>).backup2),
            offsite: Boolean((entry.backups as Record<string, unknown>).offsite),
          }
        : { backup1: false, backup2: false, offsite: false },
    checksumVerified: Boolean(entry.checksumVerified),
    status:
      entry.status === 'verified' || entry.status === 'backing_up' || entry.status === 'not_backed_up'
        ? entry.status
        : 'not_backed_up',
    lifecycleStage,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
    history: Array.isArray(entry.history)
      ? entry.history
          .filter((event) => event && typeof event === 'object')
          .map((event) => ({
            ts:
              typeof (event as Record<string, unknown>).ts === 'string'
                ? ((event as Record<string, unknown>).ts as string)
                : new Date().toISOString(),
            event:
              typeof (event as Record<string, unknown>).event === 'string'
                ? ((event as Record<string, unknown>).event as string)
                : 'Oppdatert',
          }))
      : [],
  };

  return deriveEntryStatus(normalized);
};

const normalizeControlState = (raw: unknown): MemoryCardControlState => {
  if (!raw || typeof raw !== 'object') return createDefaultState();
  const value = raw as Partial<MemoryCardControlState>;
  return {
    shootDayLabel: typeof value.shootDayLabel === 'string' ? value.shootDayLabel : '',
    entries: Array.isArray(value.entries)
      ? value.entries
          .map((entry) => normalizeEntry(entry))
          .filter((entry): entry is MemoryCardControlEntry => Boolean(entry))
      : [],
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
};

const readLocalState = (projectId: string): MemoryCardControlState => {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (!raw) return createDefaultState();
    return normalizeControlState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
};

const writeLocalState = (projectId: string, state: MemoryCardControlState) => {
  localStorage.setItem(getStorageKey(projectId), JSON.stringify(state));
};

const resolveCameraRecords = (payload: unknown): CameraRecord[] => {
  const source =
    Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object'
      ? ((payload as { data?: unknown; results?: unknown; cameras?: unknown }).data ??
        (payload as { results?: unknown }).results ??
        (payload as { cameras?: unknown }).cameras)
      : [];

  if (!Array.isArray(source)) return [];
  return source
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => {
      const category = String(entry.category ?? '').trim();
      const normalizedCategory = category.toLowerCase();
      const payloadType =
        entry.type === 'photo' || entry.type === 'video'
          ? (entry.type as 'photo' | 'video')
          : undefined;
      const inferredType =
        payloadType ??
        (normalizedCategory.includes('cinema') || normalizedCategory.includes('video')
          ? 'video'
          : normalizedCategory
          ? 'photo'
          : undefined);

      return {
        id: String(entry.id ?? ''),
        brand: String(entry.brand ?? ''),
        model: String(entry.model ?? ''),
        category,
        type: inferredType,
        isNetflixCertified: entry.isNetflixCertified === true,
      };
    })
    .filter((camera) => camera.id && camera.brand && camera.model);
};

const resolveCardTypes = (payload: unknown): MemoryCardTypeRecord[] => {
  const source =
    Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object'
      ? ((payload as { data?: unknown; results?: unknown }).data ??
        (payload as { results?: unknown }).results)
      : [];

  if (!Array.isArray(source)) return [];
  return source
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      id: String(entry.id ?? ''),
      name: String(entry.name ?? ''),
      fullName: String(entry.fullName ?? entry.name ?? ''),
      category: String(entry.category ?? ''),
      commonCapacities: Array.isArray(entry.commonCapacities)
        ? entry.commonCapacities.map((capacity) => String(capacity))
        : [],
      readSpeed: Number(entry.readSpeed ?? 0),
      writeSpeed: Number(entry.writeSpeed ?? 0),
      maxCapacity: String(entry.maxCapacity ?? ''),
    }))
    .filter((card) => card.id && card.fullName);
};

const ADDITIONAL_STORAGE_TYPES: MemoryCardTypeRecord[] = [
  {
    id: 'storage-ssd',
    name: 'SSD',
    fullName: 'SSD (ekstern/produksjon)',
    category: 'storage-media',
    commonCapacities: ['500GB', '1TB', '2TB', '4TB'],
    readSpeed: 0,
    writeSpeed: 0,
    maxCapacity: '8TB',
  },
  {
    id: 'storage-hdd',
    name: 'HDD',
    fullName: 'HDD (ekstern disk)',
    category: 'storage-media',
    commonCapacities: ['1TB', '2TB', '4TB', '8TB'],
    readSpeed: 0,
    writeSpeed: 0,
    maxCapacity: '24TB',
  },
  {
    id: 'storage-nas',
    name: 'NAS',
    fullName: 'NAS-lagring',
    category: 'storage-media',
    commonCapacities: ['4TB', '8TB', '16TB', '32TB'],
    readSpeed: 0,
    writeSpeed: 0,
    maxCapacity: '64TB+',
  },
  {
    id: 'storage-raid',
    name: 'RAID',
    fullName: 'RAID-lagring',
    category: 'storage-media',
    commonCapacities: ['4TB', '8TB', '16TB', '32TB'],
    readSpeed: 0,
    writeSpeed: 0,
    maxCapacity: '64TB+',
  },
  {
    id: 'storage-usb',
    name: 'USB',
    fullName: 'USB-lagring',
    category: 'storage-media',
    commonCapacities: ['64GB', '128GB', '256GB', '512GB', '1TB'],
    readSpeed: 0,
    writeSpeed: 0,
    maxCapacity: '2TB',
  },
];

const mergeCardTypesWithStorage = (cards: MemoryCardTypeRecord[]): MemoryCardTypeRecord[] => {
  const merged = new Map<string, MemoryCardTypeRecord>();
  for (const card of cards) merged.set(card.id, card);
  for (const storage of ADDITIONAL_STORAGE_TYPES) {
    if (!merged.has(storage.id)) merged.set(storage.id, storage);
  }
  return Array.from(merged.values());
};

const deriveEntryStatus = (entry: MemoryCardControlEntry): MemoryCardControlEntry => {
  const fullyBackedUp =
    entry.backups.backup1 &&
    entry.backups.backup2 &&
    entry.backups.offsite &&
    entry.checksumVerified;

  const anyBackupActivity =
    entry.backups.backup1 ||
    entry.backups.backup2 ||
    entry.backups.offsite ||
    entry.checksumVerified;

  let lifecycleStage = entry.lifecycleStage || 'in_use';
  if (lifecycleStage !== 'archived') {
    if (fullyBackedUp) {
      lifecycleStage = 'verified';
    } else if (entry.backups.backup1 && entry.backups.backup2 && entry.backups.offsite) {
      lifecycleStage = 'backup_completed';
    } else if (anyBackupActivity) {
      lifecycleStage = 'backup_started';
    } else if (lifecycleStage === 'backup_started' || lifecycleStage === 'backup_completed' || lifecycleStage === 'verified') {
      lifecycleStage = 'in_use';
    }
  }

  return {
    ...entry,
    status: fullyBackedUp ? 'verified' : anyBackupActivity ? 'backing_up' : 'not_backed_up',
    lifecycleStage,
  };
};

export function MemoryCardBackupControlDialog({
  open,
  onClose,
  projectId,
  shotLists,
  crewOptions = [],
}: MemoryCardBackupControlDialogProps) {
  const branding = useBrandingSettings();
  const roleRoomName = branding.appName || 'The Role Room';
  const color = branding.colors;
  const paperBg = color.surface || '#0d1117';
  const textPrimary = color.textPrimary || '#ffffff';
  const textSecondary = color.textSecondary || 'rgba(255,255,255,0.8)';
  const accent = color.accent || '#00d4ff';
  const primary = color.primary || '#8b5cf6';
  const success = color.success || '#10b981';
  const warning = color.warning || '#f59e0b';
  const danger = color.error || '#ef4444';
  const borderColor = color.border || 'rgba(139,92,246,0.3)';
  const cardRadius = branding.layout.cardRadius || 12;

  const [controlState, setControlState] = useState<MemoryCardControlState>(createDefaultState());
  const [draft, setDraft] = useState<NewCardDraft>(createEmptyDraft());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cardTypeError, setCardTypeError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [cardTypes, setCardTypes] = useState<MemoryCardTypeRecord[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [netflixOnly, setNetflixOnly] = useState(false);
  const [remoteReport, setRemoteReport] = useState<MemoryCardControlReport | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrLabelPreview, setQrLabelPreview] = useState<{
    entryId: string;
    dataUrl: string;
    fileName: string;
  } | null>(null);
  const [cameraGroupExpanded, setCameraGroupExpanded] =
    useState<Record<CameraGroupKey, boolean>>(collapsedCameraGroups);
  const didBootstrapRef = useRef(false);

  const shotListOptions = useMemo(
    () =>
      shotLists.map((shotList) => ({
        id: shotList.id,
        label: shotList.scene || shotList.title || `Scene ${shotList.id}`,
      })),
    [shotLists]
  );

  const crewById = useMemo(
    () =>
      new Map(
        crewOptions.map((crew) => [
          crew.id,
          { name: crew.name, role: crew.role || '' },
        ])
      ),
    [crewOptions]
  );

  const visibleCameras = useMemo(
    () => (netflixOnly ? cameras.filter((camera) => camera.isNetflixCertified === true) : cameras),
    [cameras, netflixOnly]
  );

  const categorizedCameras = useMemo(() => {
    const sortCameras = (list: CameraRecord[]) =>
      [...list].sort((a, b) => {
        const brandComparison = a.brand.localeCompare(b.brand, 'nb-NO');
        if (brandComparison !== 0) return brandComparison;
        return a.model.localeCompare(b.model, 'nb-NO');
      });

    const cine: CameraRecord[] = [];
    const mobileTablet: CameraRecord[] = [];
    const drone: CameraRecord[] = [];
    const audio: CameraRecord[] = [];
    const photo: CameraRecord[] = [];
    const other: CameraRecord[] = [];

    visibleCameras.forEach((camera) => {
      const normalizedCategory = (camera.category || '').toLowerCase();
      const normalizedBrand = camera.brand.toLowerCase();
      const normalizedModel = camera.model.toLowerCase();
      const combinedName = `${normalizedBrand} ${normalizedModel}`.toLowerCase();

      const isDroneCategory = normalizedCategory.includes('drone');
      const isDroneName =
        normalizedBrand.includes('dji') ||
        normalizedModel.includes('mavic') ||
        normalizedModel.includes('inspire') ||
        normalizedModel.includes('phantom') ||
        normalizedModel.includes('anafi') ||
        normalizedModel.includes('autel') ||
        normalizedModel.includes('drone');

      if (isDroneCategory || isDroneName) {
        drone.push(camera);
        return;
      }

      const isAudioCategory =
        normalizedCategory.includes('audio') ||
        normalizedCategory.includes('sound') ||
        normalizedCategory.includes('lyd');
      const isAudioName =
        combinedName.includes('zoom h') ||
        combinedName.includes('recorder') ||
        combinedName.includes('field recorder') ||
        combinedName.includes('mikrofon') ||
        combinedName.includes('microphone') ||
        combinedName.includes('mic') ||
        combinedName.includes('boom') ||
        combinedName.includes('tascam') ||
        combinedName.includes('sound devices') ||
        combinedName.includes('mixpre') ||
        combinedName.includes('rode') ||
        combinedName.includes('sennheiser') ||
        combinedName.includes('audio');

      if (isAudioCategory || isAudioName) {
        audio.push(camera);
        return;
      }

      const isMobileOrTabletCategory =
        normalizedCategory.includes('phone') ||
        normalizedCategory.includes('mobile') ||
        normalizedCategory.includes('tablet');
      const isMobileOrTabletName =
        normalizedBrand.includes('apple') ||
        normalizedModel.includes('iphone') ||
        normalizedModel.includes('ipad') ||
        normalizedModel.includes('galaxy') ||
        normalizedModel.includes('pixel') ||
        normalizedModel.includes('android') ||
        normalizedModel.includes('tablet');

      if (isMobileOrTabletCategory || isMobileOrTabletName) {
        mobileTablet.push(camera);
        return;
      }

      if (
        camera.type === 'video' ||
        normalizedCategory.includes('cinema') ||
        normalizedCategory.includes('video')
      ) {
        cine.push(camera);
        return;
      }

      if (
        camera.type === 'photo' ||
        normalizedCategory.includes('mirrorless') ||
        normalizedCategory.includes('dslr') ||
        normalizedCategory.includes('medium')
      ) {
        photo.push(camera);
        return;
      }

      other.push(camera);
    });

    return {
      cine: sortCameras(cine),
      drone: sortCameras(drone),
      audio: sortCameras(audio),
      mobileTablet: sortCameras(mobileTablet),
      photo: sortCameras(photo),
      other: sortCameras(other),
    };
  }, [visibleCameras]);

  const toggleCameraGroup = useCallback((group: CameraGroupKey) => {
    setCameraGroupExpanded((prev) => {
      const shouldOpen = !prev[group];
      const nextState = { ...collapsedCameraGroups };
      if (shouldOpen) {
        nextState[group] = true;
      }
      return nextState;
    });
  }, []);

  const handleCameraGroupMouseDown = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleCameraGroupClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>, group: CameraGroupKey) => {
      event.preventDefault();
      event.stopPropagation();
      toggleCameraGroup(group);
    },
    [toggleCameraGroup]
  );

  const handleCameraGroupKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, group: CameraGroupKey) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      toggleCameraGroup(group);
    },
    [toggleCameraGroup]
  );

  const cameraGroupSections = useMemo(
    () => [
      {
        key: 'cine' as const,
        label: 'Cine-kamera',
        icon: <VideocamIcon sx={{ fontSize: 16, color: alpha(accent, 0.95) }} />,
        items: categorizedCameras.cine,
      },
      {
        key: 'drone' as const,
        label: 'Drone',
        icon: <FlightTakeoffIcon sx={{ fontSize: 16, color: alpha(accent, 0.95) }} />,
        items: categorizedCameras.drone,
      },
      {
        key: 'audio' as const,
        label: 'Lyd',
        icon: <GraphicEqIcon sx={{ fontSize: 16, color: alpha(accent, 0.95) }} />,
        items: categorizedCameras.audio,
        alwaysVisible: true,
        emptyLabel: 'Ingen lydenheter tilgjengelig',
      },
      {
        key: 'photo' as const,
        label: 'Foto-kamera',
        icon: <PhotoCameraIcon sx={{ fontSize: 16, color: alpha(accent, 0.95) }} />,
        items: categorizedCameras.photo,
      },
      {
        key: 'mobileTablet' as const,
        label: 'Mobil / nettbrett',
        icon: <SmartphoneIcon sx={{ fontSize: 16, color: alpha(accent, 0.95) }} />,
        items: categorizedCameras.mobileTablet,
      },
      {
        key: 'other' as const,
        label: 'Øvrige',
        icon: <DnsIcon sx={{ fontSize: 16, color: alpha(accent, 0.95) }} />,
        items: categorizedCameras.other,
      },
    ],
    [categorizedCameras, accent]
  );

  const selectedCardType = useMemo(
    () => cardTypes.find((card) => card.id === draft.cardTypeId) ?? null,
    [cardTypes, draft.cardTypeId]
  );

  const selectedEntry = useMemo(
    () => controlState.entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [controlState.entries, selectedEntryId]
  );

  const timeline = useMemo(
    () =>
      controlState.entries
        .flatMap((entry) =>
          (entry.history || []).map((event) => ({
            entryId: entry.id,
            cardLabel: entry.cardLabel,
            ts: event.ts,
            event: event.event,
          }))
        )
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .slice(0, 24),
    [controlState.entries]
  );

  const summary = useMemo(() => {
    const total = controlState.entries.length;
    const verified = controlState.entries.filter((entry) => entry.status === 'verified').length;
    const inProgress = controlState.entries.filter((entry) => entry.status === 'backing_up').length;
    const pending = controlState.entries.filter((entry) => entry.status === 'not_backed_up').length;
    const allBackedUp = total > 0 && verified === total;
    const all321Compliant =
      total > 0 &&
      controlState.entries.every(
        (entry) => entry.backups.backup1 && entry.backups.backup2 && entry.backups.offsite
      );
    return { total, verified, inProgress, pending, allBackedUp, all321Compliant };
  }, [controlState.entries]);

  const redEntries = useMemo(
    () => controlState.entries.filter((entry) => entry.status !== 'verified'),
    [controlState.entries]
  );

  const greenEntries = useMemo(
    () => controlState.entries.filter((entry) => entry.status === 'verified'),
    [controlState.entries]
  );

  const compliance321 = useMemo(() => {
    const total = controlState.entries.length;
    if (total === 0) {
      return {
        total,
        copies: { current: 0, goal: 0 },
        media: { current: 0, goal: 0 },
        offsite: { current: 0, goal: 0 },
      };
    }

    const copiesCurrent = controlState.entries.filter(
      (entry) => entry.backups.backup1 && entry.backups.backup2
    ).length;
    const mediaCurrent = controlState.entries.filter(
      (entry) => entry.backups.backup1 && entry.backups.backup2
    ).length;
    const offsiteCurrent = controlState.entries.filter((entry) => entry.backups.offsite).length;

    return {
      total,
      copies: { current: copiesCurrent, goal: total },
      media: { current: mediaCurrent, goal: total },
      offsite: { current: offsiteCurrent, goal: total },
    };
  }, [controlState.entries]);

  const operationalByCrew = useMemo(() => {
    const grouped = new Map<
      string,
      { total: number; verified: number; pending: number; backingUp: number }
    >();
    controlState.entries.forEach((entry) => {
      const key = entry.assignedCrewName || 'Ikke tildelt';
      const existing = grouped.get(key) ?? { total: 0, verified: 0, pending: 0, backingUp: 0 };
      existing.total += 1;
      if (entry.status === 'verified') existing.verified += 1;
      if (entry.status === 'backing_up') existing.backingUp += 1;
      if (entry.status === 'not_backed_up') existing.pending += 1;
      grouped.set(key, existing);
    });
    return Array.from(grouped.entries())
      .map(([crew, stats]) => ({ crew, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [controlState.entries]);

  const productionCoverage = useMemo(() => {
    const linked = controlState.entries.filter((entry) => Boolean(entry.shotListId)).length;
    const unlinked = Math.max(controlState.entries.length - linked, 0);
    return { linked, unlinked };
  }, [controlState.entries]);

  const riskAlerts = useMemo(() => {
    const alerts: Array<{ severity: 'warning' | 'error'; message: string }> = [];
    if (!controlState.entries.length) return alerts;

    const now = Date.now();
    const notBackedForHours = controlState.entries.filter((entry) => {
      if (entry.status !== 'not_backed_up') return false;
      const createdAtMs = new Date(entry.createdAt).getTime();
      if (!Number.isFinite(createdAtMs)) return false;
      return now - createdAtMs > 1000 * 60 * 60 * 6;
    });
    if (notBackedForHours.length > 0) {
      alerts.push({
        severity: 'error',
        message: `${notBackedForHours.length} lagringsenheter har ikke backup etter 6+ timer.`,
      });
    }

    const withoutCrew = controlState.entries.filter((entry) => !entry.assignedCrewName);
    if (withoutCrew.length > 0) {
      alerts.push({
        severity: 'warning',
        message: `${withoutCrew.length} lagringsenheter mangler crew-ansvarlig.`,
      });
    }

    const withoutProductionLink = controlState.entries.filter((entry) => !entry.shotListId);
    if (withoutProductionLink.length > 0) {
      alerts.push({
        severity: 'warning',
        message: `${withoutProductionLink.length} lagringsenheter er ikke koblet til shotlist/scene.`,
      });
    }

    const labels = controlState.entries.map((entry) => entry.cardLabel.toUpperCase());
    const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
    const duplicateCount = new Set(duplicates).size;
    if (duplicateCount > 0) {
      alerts.push({
        severity: 'error',
        message: `${duplicateCount} dupliserte lagringsenhet-ID-er oppdaget.`,
      });
    }

    return alerts;
  }, [controlState.entries]);

  const persistState = useCallback(
    async (nextState: MemoryCardControlState, forceApi: boolean) => {
      try {
        if (forceApi || !fallbackMode) {
          await memoryCardControlApi.save(projectId, nextState);
          const report = await memoryCardControlApi.getReport(projectId);
          setRemoteReport(report);
          setFallbackMode(false);
          setPersistError(null);
          return;
        }
      } catch (error) {
        console.warn('memory-card-control API save failed, switching to local fallback', error);
      }

      writeLocalState(projectId, nextState);
      setFallbackMode(true);
      setPersistError('Lagrer lokalt fordi API ikke svarer i dette miljøet.');
    },
    [fallbackMode, projectId]
  );

  const loadCameras = useCallback(async () => {
    const [cameraResult, audioResult] = await Promise.allSettled([
      apiRequest('/api/equipment/cameras'),
      apiRequest('/api/equipment/audio-storage-devices'),
    ]);

    const cameraList =
      cameraResult.status === 'fulfilled'
        ? resolveCameraRecords(cameraResult.value)
        : [];
    const audioList =
      audioResult.status === 'fulfilled'
        ? resolveCameraRecords(audioResult.value).map((device) => ({
            ...device,
            category: device.category ? `lyd-${device.category}` : 'lyd',
          }))
        : [];

    const merged = new Map<string, CameraRecord>();
    for (const item of [...cameraList, ...audioList]) {
      if (!item.id || !item.brand || !item.model) continue;
      if (!merged.has(item.id)) {
        merged.set(item.id, item);
      }
    }

    const list = Array.from(merged.values());
    setCameras(list);
    setDraft((prev) => {
      if (prev.cameraId || list.length === 0) return prev;
      return { ...prev, cameraId: list[0].id };
    });

    if (cameraResult.status === 'rejected' && audioResult.status === 'rejected') {
      console.error('Error loading equipment endpoints for memory-card-control:', {
        cameras: cameraResult.reason,
        audioDevices: audioResult.reason,
      });
      setCameraError('Kunne ikke hente opptaksenheter fra API.');
      return;
    }

    if (cameraResult.status === 'rejected') {
      console.warn('Camera endpoint failed, using only audio storage devices:', cameraResult.reason);
    }
    if (audioResult.status === 'rejected') {
      console.warn('Audio storage endpoint failed, using only camera devices:', audioResult.reason);
    }
    setCameraError(null);
  }, []);

  const loadCardTypes = useCallback(async (cameraId: string) => {
    if (!cameraId) {
      setCardTypes([]);
      return;
    }
    try {
      const payload = await apiRequest(`/api/equipment/memory-cards?cameraId=${encodeURIComponent(cameraId)}`);
      const list = resolveCardTypes(payload);
      setCardTypes(list);
      setCardTypeError(null);
      setDraft((prev) => {
        if (!list.length) return { ...prev, cardTypeId: '', capacity: '' };
        if (list.some((card) => card.id === prev.cardTypeId)) return prev;
        const first = list[0];
        return {
          ...prev,
          cardTypeId: first.id,
          capacity: first.commonCapacities[0] ?? first.maxCapacity ?? '',
        };
      });
    } catch (error) {
      console.error('Error loading memory-card endpoint:', error);
      setCardTypes([]);
      setCardTypeError('Kunne ikke hente minnekort-endepunktet.');
    }
  }, []);

  useEffect(() => {
    if (!open) {
      didBootstrapRef.current = false;
      setDirty(false);
      setQrGenerating(false);
      setQrLabelPreview(null);
      return;
    }
    setCameraGroupExpanded(collapsedCameraGroups);

    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      try {
        const [remoteState, report] = await Promise.all([
          memoryCardControlApi.get(projectId),
          memoryCardControlApi.getReport(projectId),
        ]);
        if (cancelled) return;
        setControlState(normalizeControlState(remoteState));
        setRemoteReport(report);
        setFallbackMode(false);
        setPersistError(null);
      } catch (error) {
        if (cancelled) return;
        console.warn('memory-card-control API unavailable, using local fallback', error);
        const localState = readLocalState(projectId);
        setControlState(localState);
        setRemoteReport(null);
        setFallbackMode(true);
        setPersistError('API utilgjengelig. Logg lagres lokalt i nettleseren.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          didBootstrapRef.current = true;
        }
      }

      await loadCameras();
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, loadCameras]);

  useEffect(() => {
    if (!open || !draft.cameraId) return;
    void loadCardTypes(draft.cameraId);
  }, [open, draft.cameraId, loadCardTypes]);

  useEffect(() => {
    if (!open) return;
    if (visibleCameras.length === 0) {
      setDraft((prev) => (prev.cameraId ? { ...prev, cameraId: '' } : prev));
      return;
    }
    setDraft((prev) => {
      if (visibleCameras.some((camera) => camera.id === prev.cameraId)) return prev;
      return { ...prev, cameraId: visibleCameras[0].id };
    });
  }, [open, visibleCameras]);

  useEffect(() => {
    if (!controlState.entries.length) {
      setSelectedEntryId('');
      return;
    }
    if (!selectedEntryId || !controlState.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(controlState.entries[0].id);
    }
  }, [controlState.entries, selectedEntryId]);

  useEffect(() => {
    if (!open || !dirty || loading || !didBootstrapRef.current) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        await persistState(controlState, false);
      } finally {
        setSaving(false);
        setDirty(false);
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [open, dirty, loading, controlState, persistState]);

  const commitState = useCallback((updater: (prev: MemoryCardControlState) => MemoryCardControlState) => {
    setControlState((prev) => ({
      ...updater(prev),
      updatedAt: new Date().toISOString(),
    }));
    setDirty(true);
  }, []);

  const updateEntry = useCallback(
    (
      entryId: string,
      updater: (entry: MemoryCardControlEntry) => MemoryCardControlEntry,
      eventMessage: string
    ) => {
      const now = new Date().toISOString();
      commitState((prev) => ({
        ...prev,
        entries: prev.entries.map((entry) => {
          if (entry.id !== entryId) return entry;
          const next = updater(entry);
          const withHistory: MemoryCardControlEntry = {
            ...next,
            updatedAt: now,
            history: [{ ts: now, event: eventMessage }, ...(next.history || [])].slice(0, 80),
          };
          return deriveEntryStatus(withHistory);
        }),
      }));
    },
    [commitState]
  );

  const handleAddEntry = () => {
    if (!draft.cardLabel.trim() || !draft.cameraId) return;
    const camera = cameras.find((item) => item.id === draft.cameraId);
    if (!camera) return;

    const cardType = cardTypes.find((item) => item.id === draft.cardTypeId);
    const scene = shotListOptions.find((item) => item.id === draft.shotListId);
    const assignedCrew = crewById.get(draft.crewId);
    const now = new Date().toISOString();

    const nextEntry: MemoryCardControlEntry = {
      id: `mc-${Date.now()}`,
      cardLabel: draft.cardLabel.trim().toUpperCase(),
      cameraId: camera.id,
      cameraLabel: `${camera.brand} ${camera.model}`,
      assignedCrewId: draft.crewId || undefined,
      assignedCrewName: assignedCrew?.name,
      assignedCrewRole: assignedCrew?.role || undefined,
      cardTypeId: cardType?.id,
      cardTypeName: cardType?.fullName,
      capacity: draft.capacity || cardType?.commonCapacities?.[0] || cardType?.maxCapacity || '',
      shotListId: draft.shotListId || undefined,
      sceneLabel: scene?.label,
      productionTag: draft.productionTag.trim() || undefined,
      note: draft.note.trim() || undefined,
      imageDataUrl: draft.imageDataUrl || undefined,
      backups: { backup1: false, backup2: false, offsite: false },
      checksumVerified: false,
      status: 'not_backed_up',
      lifecycleStage: 'in_use',
      createdAt: now,
      updatedAt: now,
      history: [{ ts: now, event: 'Lagringsenhet opprettet i loggen' }],
    };

    commitState((prev) => ({
      ...prev,
      entries: [deriveEntryStatus(nextEntry), ...prev.entries],
    }));
    setSelectedEntryId(nextEntry.id);
    setDraft((prev) => ({
      ...createEmptyDraft(),
      cameraId: prev.cameraId,
      crewId: prev.crewId,
      cardTypeId: prev.cardTypeId,
      capacity: prev.capacity,
      productionTag: prev.productionTag,
    }));
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({ ...prev, imageDataUrl: typeof reader.result === 'string' ? reader.result : '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNow = async () => {
    setSaving(true);
    try {
      await persistState(controlState, true);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateQrLabel = useCallback(
    async (entry: MemoryCardControlEntry) => {
      setQrGenerating(true);
      try {
        const response = await memoryCardControlApi.generateQrLabel(projectId, {
          entryId: entry.id,
          cardLabel: entry.cardLabel,
          cameraLabel: entry.cameraLabel,
          capacity: entry.capacity,
          storageType: entry.cardTypeName,
          shootDayLabel: controlState.shootDayLabel,
        });
        setQrLabelPreview({
          entryId: entry.id,
          dataUrl: response.qrDataUrl,
          fileName: response.suggestedFileName,
        });
        setPersistError(null);
      } catch (error) {
        console.error('Kunne ikke generere QR-etikett:', error);
        setPersistError('Kunne ikke generere QR-etikett akkurat nå.');
      } finally {
        setQrGenerating(false);
      }
    },
    [controlState.shootDayLabel, projectId]
  );

  const backupProgress = selectedEntry
    ? Math.round(
        ((Number(selectedEntry.backups.backup1) +
          Number(selectedEntry.backups.backup2) +
          Number(selectedEntry.backups.offsite) +
          Number(selectedEntry.checksumVerified)) /
          4) *
          100
      )
    : 0;

  const getChecklist = (entry: MemoryCardControlEntry) => [
    { key: 'original', label: 'Original (minnekort)', done: true },
    { key: 'backup1', label: 'Sikkerhetskopi 1 (SSD)', done: entry.backups.backup1 },
    { key: 'backup2', label: 'Sikkerhetskopi 2 (RAID/NAS)', done: entry.backups.backup2 },
    { key: 'offsite', label: 'Offsite-kopi', done: entry.backups.offsite },
  ];

  const getMissingNow = (entry: MemoryCardControlEntry): string => {
    const missing = getChecklist(entry)
      .filter((item) => !item.done)
      .map((item) => item.label);
    return missing.length > 0 ? missing.join(' + ') : 'Ingen';
  };

  const getScoreTone = (current: number, goal: number): string => {
    if (!goal) return textSecondary;
    if (current >= goal) return success;
    if (current > 0) return warning;
    return danger;
  };

  const renderChecklistIcon = (
    itemKey: 'original' | BackupStage,
    done: boolean
  ) => {
    const iconColor = done ? '#81c784' : alpha(textSecondary, 0.65);
    const iconSx = { fontSize: 16, color: iconColor };

    switch (itemKey) {
      case 'original':
        return <SdCardIcon sx={iconSx} />;
      case 'backup1':
        return <StorageIcon sx={iconSx} />;
      case 'backup2':
        return <DnsIcon sx={iconSx} />;
      case 'offsite':
        return <CloudQueueIcon sx={iconSx} />;
      default:
        return <SdCardIcon sx={iconSx} />;
    }
  };

  const renderStageIcon = (stage: BackupStage, active: boolean) => {
    const iconColor = active ? '#81c784' : alpha(textSecondary, 0.72);
    const iconSx = { mr: 0.75, fontSize: 18, color: iconColor };

    if (stage === 'backup1') return <StorageIcon sx={iconSx} />;
    if (stage === 'backup2') return <DnsIcon sx={iconSx} />;
    return <CloudQueueIcon sx={iconSx} />;
  };

  const renderCardIcon = (entry: MemoryCardControlEntry) => {
    const value = `${entry.cardTypeName || ''} ${entry.cardTypeId || ''}`.toLowerCase();
    const iconSx = { fontSize: 22, color: alpha(textSecondary, 0.95) };

    if (value.includes('cfexpress') || value.includes('cfast')) {
      return <MemoryIcon sx={iconSx} />;
    }
    if (value.includes('ssd')) {
      return <StorageIcon sx={iconSx} />;
    }
    return <SdCardIcon sx={iconSx} />;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        sx: {
          bgcolor: paperBg,
          color: textPrimary,
          border: `1px solid ${borderColor}`,
          boxShadow: branding.layout.shadowStrong || '0 24px 80px rgba(0,0,0,0.45)',
          borderRadius: `${cardRadius}px`,
          backgroundImage: `linear-gradient(145deg, ${alpha(color.gradientStart || primary, 0.12)} 0%, ${alpha(
            color.gradientEnd || accent,
            0.05
          )} 38%, ${alpha(paperBg, 0.92)} 100%)`,
          fontFamily: branding.typography.bodyFont,
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${alpha(borderColor, 0.75)}` }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box
              component="img"
              src={branding.logoUrl}
              alt={roleRoomName}
              sx={{
                display: { xs: 'none', sm: 'block' },
                height: 28,
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <SdCardIcon sx={{ color: accent }} />
            <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: branding.typography.headingFont }}>
              {`${roleRoomName} · Backup kontroll system`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              size="small"
              icon={saving ? <SyncIcon /> : <CloudDoneIcon />}
              label={saving ? 'Lagrer...' : fallbackMode ? 'Lokal fallback' : 'Synkronisert'}
              sx={{
                bgcolor: fallbackMode ? alpha(warning, 0.18) : alpha(success, 0.18),
                color: fallbackMode ? '#ffecb3' : alpha(success, 0.92),
              }}
            />
            <Tooltip title="Lagre nå">
              <IconButton onClick={handleSaveNow} sx={{ color: textPrimary }} disabled={loading || saving}>
                <SaveIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {persistError && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {persistError}
          </Alert>
        )}
        {riskAlerts.map((alert, index) => (
          <Alert key={`risk-${index}`} severity={alert.severity} sx={{ mb: 1.5 }}>
            {`Risiko varsling: ${alert.message}`}
          </Alert>
        ))}

        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography sx={{ color: alpha(textSecondary, 0.8) }}>Laster minnekortkontroll ...</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 1.5, mb: 2 }}>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip
                  icon={<SdCardIcon />}
                  label={`Lagringsenheter i bruk: ${summary.total}`}
                  sx={{ bgcolor: alpha(textPrimary, 0.08), color: textPrimary }}
                />
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`Verifisert: ${summary.verified}`}
                  sx={{ bgcolor: alpha(success, 0.16), color: '#81c784' }}
                />
                <Chip
                  icon={<SyncIcon />}
                  label={`Sikkerhetskopieres: ${summary.inProgress}`}
                  sx={{ bgcolor: alpha(warning, 0.16), color: '#ffd54f' }}
                />
                <Chip
                  icon={<WarningAmberIcon />}
                  label={`Ikke sikkerhetskopiert: ${summary.pending}`}
                  sx={{ bgcolor: alpha(danger, 0.2), color: '#ef9a9a' }}
                />
                <Chip
                  icon={<PhotoCameraIcon />}
                  label={`Produksjonskoblet: ${productionCoverage.linked}/${summary.total || 0}`}
                  sx={{ bgcolor: alpha(accent, 0.18), color: alpha(textPrimary, 0.95) }}
                />
                <Chip
                  icon={<Inventory2Icon />}
                  label={`Crew i oversikt: ${Math.max(operationalByCrew.length, crewOptions.length)}`}
                  sx={{ bgcolor: alpha(primary, 0.2), color: alpha(textPrimary, 0.95) }}
                />
                {remoteReport && (
                  <Chip
                    icon={<DataArrayIcon />}
                    label={`Backend compliance: ${remoteReport.summary.compliancePercent}%`}
                    sx={{
                      bgcolor: alpha(remoteReport.summary.compliancePercent >= 90 ? success : warning, 0.2),
                      color: remoteReport.summary.compliancePercent >= 90 ? '#81c784' : '#ffd54f',
                    }}
                  />
                )}
                <Chip
                  icon={summary.all321Compliant ? <CheckCircleIcon /> : <WarningAmberIcon />}
                  label={summary.all321Compliant ? '3-2-1 oppfylt' : '3-2-1 mangler'}
                  sx={{
                    bgcolor: summary.all321Compliant ? alpha(success, 0.16) : alpha(danger, 0.2),
                    color: summary.all321Compliant ? '#81c784' : '#ef9a9a',
                  }}
                />
              </Stack>
              <TextField
                size="small"
                label="Opptaksdag"
                value={controlState.shootDayLabel}
                onChange={(event) =>
                  commitState((prev) => ({ ...prev, shootDayLabel: event.target.value }))
                }
                placeholder="Eks: Dag 03"
                sx={{
                  '& .MuiInputBase-root': { bgcolor: alpha(textPrimary, 0.04), color: textPrimary },
                  '& .MuiInputLabel-root': { color: alpha(textSecondary, 0.75) },
                }}
              />
            </Box>

            <Paper
              sx={{
                p: 1.5,
                mb: 2,
                bgcolor: alpha(textPrimary, 0.03),
                border: `1px solid ${alpha(borderColor, 0.72)}`,
                borderRadius: `${cardRadius}px`,
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 1, color: alpha(textSecondary, 0.95) }}>
                Operativ oversikt · Hele teamet (video + foto)
              </Typography>
              {operationalByCrew.length === 0 ? (
                <Typography sx={{ fontSize: '0.85rem', color: alpha(textSecondary, 0.8) }}>
                  Ingen lagringsenhet registrert enda.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
                  {operationalByCrew.map((row) => (
                    <Box
                      key={row.crew}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        border: `1px solid ${alpha(borderColor, 0.65)}`,
                        bgcolor: alpha(textPrimary, 0.02),
                      }}
                    >
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: alpha(textSecondary, 0.95) }}>
                        {row.crew}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: alpha(textSecondary, 0.82) }}>
                        {`Lagringsenheter: ${row.total} · Verifisert: ${row.verified} · Under backup: ${row.backingUp} · Risiko: ${row.pending}`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            <Paper
              sx={{
                p: 1.5,
                mb: 2,
                bgcolor: alpha(textPrimary, 0.03),
                border: `1px solid ${alpha(borderColor, 0.72)}`,
                borderRadius: `${cardRadius}px`,
              }}
            >
              <Typography sx={{ fontWeight: 800, color: alpha(textSecondary, 0.96), mb: 1 }}>
                3-2-1 kontrollpanel
              </Typography>
              <Stack spacing={1}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <DataArrayIcon sx={{ fontSize: 16, color: alpha(textSecondary, 0.9) }} />
                      <Typography sx={{ fontSize: '0.82rem', color: alpha(textSecondary, 0.9) }}>
                        3 kopier (original + backup 1 + backup 2)
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: getScoreTone(compliance321.copies.current, compliance321.copies.goal) }}>
                      {`${compliance321.copies.current}/${compliance321.copies.goal}`}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={compliance321.copies.goal ? (compliance321.copies.current / compliance321.copies.goal) * 100 : 0}
                    sx={{ height: 8, borderRadius: 8, '& .MuiLinearProgress-bar': { bgcolor: getScoreTone(compliance321.copies.current, compliance321.copies.goal) } }}
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <DiscFullIcon sx={{ fontSize: 16, color: alpha(textSecondary, 0.9) }} />
                      <Typography sx={{ fontSize: '0.82rem', color: alpha(textSecondary, 0.9) }}>
                        2 medier (SSD + RAID/NAS)
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: getScoreTone(compliance321.media.current, compliance321.media.goal) }}>
                      {`${compliance321.media.current}/${compliance321.media.goal}`}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={compliance321.media.goal ? (compliance321.media.current / compliance321.media.goal) * 100 : 0}
                    sx={{ height: 8, borderRadius: 8, '& .MuiLinearProgress-bar': { bgcolor: getScoreTone(compliance321.media.current, compliance321.media.goal) } }}
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <CloudQueueIcon sx={{ fontSize: 16, color: alpha(textSecondary, 0.9) }} />
                      <Typography sx={{ fontSize: '0.82rem', color: alpha(textSecondary, 0.9) }}>
                        1 offsite kopi
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: getScoreTone(compliance321.offsite.current, compliance321.offsite.goal) }}>
                      {`${compliance321.offsite.current}/${compliance321.offsite.goal}`}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={compliance321.offsite.goal ? (compliance321.offsite.current / compliance321.offsite.goal) * 100 : 0}
                    sx={{ height: 8, borderRadius: 8, '& .MuiLinearProgress-bar': { bgcolor: getScoreTone(compliance321.offsite.current, compliance321.offsite.goal) } }}
                  />
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                <Chip
                  icon={<WarningAmberIcon />}
                  label={`Rød side = Ikke backet opp (${redEntries.length})`}
                  size="small"
                  sx={{ bgcolor: alpha(danger, 0.22), color: '#ef9a9a' }}
                />
                <Chip
                  icon={<CheckCircleIcon />}
                  label={`Grønn side = Klar (${greenEntries.length})`}
                  size="small"
                  sx={{ bgcolor: alpha(success, 0.18), color: '#81c784' }}
                />
              </Stack>
            </Paper>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mb: 2.5 }}>
              {[
                { key: 'red', title: 'Rød side · Ikke backet opp', entries: redEntries, tone: danger, isRed: true },
                { key: 'green', title: 'Grønn side · Klar', entries: greenEntries, tone: success, isRed: false },
              ].map((column) => (
                <Paper
                  key={column.key}
                  sx={{
                    p: 1.25,
                    borderRadius: `${cardRadius}px`,
                    border: `1px solid ${alpha(column.tone, 0.55)}`,
                    bgcolor: alpha(textPrimary, 0.03),
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      {column.isRed ? (
                        <WarningAmberIcon sx={{ fontSize: 18, color: '#ef9a9a' }} />
                      ) : (
                        <CheckCircleIcon sx={{ fontSize: 18, color: '#81c784' }} />
                      )}
                      <Typography sx={{ fontWeight: 800, color: alpha(textSecondary, 0.98) }}>
                        {column.title}
                      </Typography>
                    </Stack>
                    <Chip
                      size="small"
                      label={`${column.entries.length} lagringsenheter`}
                      sx={{ bgcolor: alpha(column.tone, 0.18), color: alpha(textPrimary, 0.95) }}
                    />
                  </Box>
                  {column.entries.length === 0 ? (
                    <Typography sx={{ fontSize: '0.85rem', color: alpha(textSecondary, 0.78), py: 1 }}>
                      Ingen lagringsenheter i denne kolonnen.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {column.entries.map((entry) => {
                        const checklist = getChecklist(entry);
                        const backupsDone =
                          Number(entry.backups.backup1) +
                          Number(entry.backups.backup2) +
                          Number(entry.backups.offsite);

                        return (
                          <Card
                            key={entry.id}
                            onClick={() => setSelectedEntryId(entry.id)}
                            sx={{
                              cursor: 'pointer',
                              border: `1px solid ${alpha(column.tone, 0.7)}`,
                              bgcolor: selectedEntryId === entry.id ? alpha(textPrimary, 0.09) : alpha(textPrimary, 0.04),
                              borderRadius: `${cardRadius}px`,
                              backgroundImage: column.isRed
                                ? `repeating-linear-gradient(135deg, ${alpha(danger, 0.12)} 0 10px, transparent 10px 20px)`
                                : undefined,
                            }}
                          >
                            <CardContent sx={{ pb: '12px !important' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                  {renderCardIcon(entry)}
                                  <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.6 }}>
                                    {entry.cardLabel}
                                  </Typography>
                                </Stack>
                                <Chip
                                  size="small"
                                  label={
                                    entry.status === 'verified'
                                      ? '✓ KLAR'
                                      : entry.status === 'backing_up'
                                      ? '↻ SIKKERHETSKOPIERER'
                                      : '⚠ IKKE SIKKERHETSKOPIERT'
                                  }
                                  sx={{
                                    bgcolor:
                                      entry.status === 'verified'
                                        ? alpha(success, 0.2)
                                        : entry.status === 'backing_up'
                                        ? alpha(warning, 0.22)
                                        : alpha(danger, 0.2),
                                    color:
                                      entry.status === 'verified'
                                        ? '#81c784'
                                        : entry.status === 'backing_up'
                                        ? '#ffd54f'
                                        : '#ef9a9a',
                                  }}
                                />
                              </Box>

                              <Stack direction="row" spacing={0.75} sx={{ mb: 0.7, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  label={`Livssyklus: ${lifecycleStageLabels[entry.lifecycleStage] || 'I bruk'}`}
                                  sx={{ bgcolor: alpha(primary, 0.22), color: alpha(textPrimary, 0.95) }}
                                />
                                <Chip
                                  size="small"
                                  label={`Crew: ${entry.assignedCrewName || 'Ikke tildelt'}`}
                                  sx={{ bgcolor: alpha(accent, 0.18), color: alpha(textPrimary, 0.95) }}
                                />
                              </Stack>

                              <Typography sx={{ color: alpha(textSecondary, 0.95), fontWeight: 600 }}>
                                {entry.cameraLabel}
                              </Typography>
                              <Typography sx={{ color: alpha(textSecondary, 0.8), fontSize: '0.85rem' }}>
                                {entry.capacity || 'Uspesifisert kapasitet'} · {entry.sceneLabel || 'Ikke koblet til scene'}
                              </Typography>
                              <Typography sx={{ color: alpha(textSecondary, 0.74), fontSize: '0.78rem', mt: 0.4 }}>
                                {`Mangler nå: ${getMissingNow(entry)}`}
                              </Typography>

                              <Stack spacing={0.4} sx={{ mt: 1 }}>
                                {checklist.map((item) => (
                                  <Box key={`${entry.id}-${item.key}`} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center' }}>
                                      {renderChecklistIcon(item.key as 'original' | BackupStage, item.done)}
                                      <Typography sx={{ fontSize: '0.78rem', color: alpha(textSecondary, 0.9) }}>
                                        {item.label}
                                      </Typography>
                                    </Stack>
                                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: item.done ? '#81c784' : '#ef9a9a' }}>
                                      {item.done ? '✓' : '○'}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>

                              <Stack direction="row" spacing={0.75} sx={{ mt: 1.2, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  label={`Sikkerhetskopi: ${backupsDone}/3`}
                                  sx={{ bgcolor: alpha(textPrimary, 0.08), color: textPrimary }}
                                />
                                <Chip
                                  size="small"
                                  label={entry.checksumVerified ? 'Sjekksum OK' : 'Sjekksum mangler'}
                                  sx={{
                                    bgcolor: entry.checksumVerified ? alpha(success, 0.16) : alpha(textPrimary, 0.08),
                                    color: entry.checksumVerified ? '#81c784' : alpha(textSecondary, 0.95),
                                  }}
                                />
                              </Stack>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.15fr 1fr' }, gap: 2 }}>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: alpha(textPrimary, 0.03),
                  border: `1px solid ${alpha(borderColor, 0.72)}`,
                  borderRadius: `${cardRadius}px`,
                }}
              >
                <Stack direction="row" spacing={0.9} sx={{ alignItems: 'center', mb: 1.5 }}>
                  <SdCardIcon sx={{ color: accent }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Ny lagringsenhet
                  </Typography>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.2 }}>
                  <TextField
                    label="Lagringsenhet-ID"
                    placeholder="A001"
                    value={draft.cardLabel}
                    onChange={(event) => setDraft((prev) => ({ ...prev, cardLabel: event.target.value }))}
                    size="small"
                    sx={{ '& .MuiInputBase-root': { color: textPrimary, bgcolor: alpha(textPrimary, 0.04) } }}
                  />

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 1.2,
                      border: `1px solid ${alpha(borderColor, 0.8)}`,
                      borderRadius: 1,
                      bgcolor: alpha(textPrimary, 0.03),
                    }}
                  >
                    <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
                      <img src={netflixWordmark} alt="Netflix" style={{ height: 10, width: 'auto', display: 'block' }} />
                      <Typography sx={{ fontSize: '0.8rem', color: alpha(textSecondary, 0.9) }}>
                        Kun sertifiserte
                      </Typography>
                    </Stack>
                    <FormControlLabel
                      sx={{ m: 0 }}
                      control={
                        <Switch
                          size="small"
                          checked={netflixOnly}
                          onChange={(event) => setNetflixOnly(event.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#e50914' },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#e50914' },
                          }}
                        />
                      }
                      label=""
                    />
                  </Box>

                  <FormControl size="small">
                    <InputLabel sx={{ color: alpha(textSecondary, 0.75) }}>Opptakskilde</InputLabel>
                    <Select
                      value={draft.cameraId}
                      label="Opptakskilde"
                      onChange={(event) => setDraft((prev) => ({ ...prev, cameraId: String(event.target.value) }))}
                      sx={{ color: textPrimary, bgcolor: alpha(textPrimary, 0.04) }}
                    >
                      {cameraGroupSections.map((group) => {
                        const isExpanded = cameraGroupExpanded[group.key];
                        const showHeader = group.alwaysVisible || group.items.length > 0;
                        if (!showHeader) return null;

                        return (
                          <Fragment key={`camera-group-${group.key}`}>
                            <ListSubheader
                              component="div"
                              disableSticky
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              sx={{
                                bgcolor: alpha(textPrimary, 0.04),
                                color: alpha(textSecondary, 0.95),
                                cursor: 'pointer',
                                userSelect: 'none',
                                pointerEvents: 'auto',
                              }}
                              onMouseDown={handleCameraGroupMouseDown}
                              onClick={(event) => handleCameraGroupClick(event, group.key)}
                              onKeyDown={(event) => handleCameraGroupKeyDown(event, group.key)}
                            >
                              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                  {group.icon}
                                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>
                                    {`${group.label} (${group.items.length})`}
                                  </Typography>
                                </Stack>
                                {isExpanded ? (
                                  <ExpandLessIcon fontSize="small" />
                                ) : (
                                  <ExpandMoreIcon fontSize="small" />
                                )}
                              </Stack>
                            </ListSubheader>
                            {isExpanded &&
                              group.items.map((camera) => (
                                <MenuItem key={camera.id} value={camera.id}>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}
                                  >
                                    <Typography sx={{ fontSize: '0.86rem' }}>
                                      {camera.brand} {camera.model}
                                    </Typography>
                                    {camera.isNetflixCertified && (
                                      <Chip
                                        size="small"
                                        icon={
                                          <img
                                            src={netflixWordmark}
                                            alt="Netflix"
                                            style={{ height: 9, width: 'auto', display: 'block' }}
                                          />
                                        }
                                        label="Sertifisert"
                                        sx={{
                                          height: 20,
                                          bgcolor: '#e50914',
                                          color: '#fff',
                                          fontWeight: 700,
                                          '& .MuiChip-label': { px: 0.75, fontSize: '0.68rem' },
                                        }}
                                      />
                                    )}
                                  </Stack>
                                </MenuItem>
                              ))}
                            {isExpanded && group.items.length === 0 && group.emptyLabel && (
                              <MenuItem disabled value={`__empty-${group.key}`}>
                                {group.emptyLabel}
                              </MenuItem>
                            )}
                          </Fragment>
                        );
                      })}

                      {visibleCameras.length === 0 && (
                        <MenuItem disabled value="">
                          {netflixOnly
                            ? 'Ingen Netflix-sertifiserte opptakskilder'
                            : 'Ingen opptakskilder tilgjengelig'}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>

                  <FormControl size="small">
                    <InputLabel sx={{ color: alpha(textSecondary, 0.75) }}>Crew-ansvarlig</InputLabel>
                    <Select
                      value={draft.crewId}
                      label="Crew-ansvarlig"
                      onChange={(event) => setDraft((prev) => ({ ...prev, crewId: String(event.target.value) }))}
                      sx={{ color: textPrimary, bgcolor: alpha(textPrimary, 0.04) }}
                    >
                      <MenuItem value="">Ikke tildelt</MenuItem>
                      {crewOptions.map((crew) => (
                        <MenuItem key={crew.id} value={crew.id}>
                          {crew.role ? `${crew.name} (${crew.role})` : crew.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small">
                    <InputLabel sx={{ color: alpha(textSecondary, 0.75) }}>Scene/shotliste</InputLabel>
                    <Select
                      value={draft.shotListId}
                      label="Scene/shotliste"
                      onChange={(event) => setDraft((prev) => ({ ...prev, shotListId: String(event.target.value) }))}
                      sx={{ color: textPrimary, bgcolor: alpha(textPrimary, 0.04) }}
                    >
                      <MenuItem value="">Ingen kobling</MenuItem>
                      {shotListOptions.map((option) => (
                        <MenuItem key={option.id} value={option.id}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small">
                    <InputLabel sx={{ color: alpha(textSecondary, 0.75) }}>Hvilken type lagring?</InputLabel>
                    <Select
                      value={draft.cardTypeId}
                      label="Hvilken type lagring?"
                      onChange={(event) =>
                        setDraft((prev) => {
                          const cardTypeId = String(event.target.value);
                          const card = cardTypes.find((item) => item.id === cardTypeId);
                          return {
                            ...prev,
                            cardTypeId,
                            capacity: card?.commonCapacities?.[0] ?? card?.maxCapacity ?? '',
                          };
                        })
                      }
                      sx={{ color: textPrimary, bgcolor: alpha(textPrimary, 0.04) }}
                    >
                      {cardTypes.map((card) => (
                        <MenuItem key={card.id} value={card.id}>
                          {card.fullName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl size="small">
                    <InputLabel sx={{ color: alpha(textSecondary, 0.75) }}>Kapasitet</InputLabel>
                    <Select
                      value={draft.capacity}
                      label="Kapasitet"
                      onChange={(event) => setDraft((prev) => ({ ...prev, capacity: String(event.target.value) }))}
                      sx={{ color: textPrimary, bgcolor: alpha(textPrimary, 0.04) }}
                    >
                      {selectedCardType?.commonCapacities?.map((capacity) => (
                        <MenuItem key={capacity} value={capacity}>
                          {capacity}
                        </MenuItem>
                      ))}
                      {!selectedCardType?.commonCapacities?.length && draft.capacity && (
                        <MenuItem value={draft.capacity}>{draft.capacity}</MenuItem>
                      )}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Notat"
                    value={draft.note}
                    onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                    multiline
                    minRows={2}
                    size="small"
                    sx={{
                      gridColumn: { xs: '1 / -1' },
                      '& .MuiInputBase-root': { color: textPrimary, bgcolor: alpha(textPrimary, 0.04) },
                    }}
                  />

                  <TextField
                    label="Produksjonstag"
                    placeholder="f.eks. Dag 03 / Enhet A / Scene 12"
                    value={draft.productionTag}
                    onChange={(event) => setDraft((prev) => ({ ...prev, productionTag: event.target.value }))}
                    size="small"
                    sx={{
                      gridColumn: { xs: '1 / -1' },
                      '& .MuiInputBase-root': { color: textPrimary, bgcolor: alpha(textPrimary, 0.04) },
                    }}
                  />
                </Box>

                <Stack direction="row" spacing={1.2} sx={{ mt: 1.5, mb: 1 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<PhotoCameraIcon />}
                    sx={{ borderColor: accent, color: accent }}
                  >
                    Ta bilde / last opp
                    <input type="file" hidden accept="image/*" capture="environment" onChange={handlePhotoUpload} />
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddEntry}
                    disabled={!draft.cardLabel.trim() || !draft.cameraId}
                    sx={{ bgcolor: primary, '&:hover': { bgcolor: color.secondary || primary } }}
                  >
                    Legg til lagringsenhet
                  </Button>
                </Stack>

                {draft.imageDataUrl && (
                  <Box
                    component="img"
                    src={draft.imageDataUrl}
                    alt="Forhåndsvisning av lagringsenhet"
                    sx={{
                      display: 'block',
                      width: '100%',
                      maxHeight: 180,
                      objectFit: 'cover',
                      borderRadius: 1.5,
                      border: `1px solid ${alpha(borderColor, 0.72)}`,
                    }}
                  />
                )}

                {(cameraError || cardTypeError) && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    {[cameraError, cardTypeError].filter(Boolean).join(' ')}
                  </Alert>
                )}
              </Paper>

              <Stack spacing={2}>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: alpha(textPrimary, 0.03),
                    border: `1px solid ${alpha(borderColor, 0.72)}`,
                    borderRadius: `${cardRadius}px`,
                  }}
                >
                  <Stack direction="row" spacing={0.9} sx={{ alignItems: 'center', mb: 1 }}>
                    <DiscFullIcon sx={{ color: accent }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Backup-status
                    </Typography>
                  </Stack>
                  {!selectedEntry ? (
                    <Typography sx={{ color: alpha(textSecondary, 0.8) }}>
                      Velg en lagringsenhet for å oppdatere backup-status.
                    </Typography>
                  ) : (
                    <>
                      <Typography sx={{ fontWeight: 700, color: textPrimary }}>
                        {selectedEntry.cardLabel} · {selectedEntry.cameraLabel}
                      </Typography>
                      <Typography sx={{ color: alpha(textSecondary, 0.8), mb: 1 }}>
                        {selectedEntry.capacity || 'Kapasitet ikke satt'} · {selectedEntry.sceneLabel || 'Ingen scene valgt'}
                      </Typography>
                      <Typography sx={{ color: alpha(textSecondary, 0.75), mb: 1 }}>
                        {`Crew: ${selectedEntry.assignedCrewName || 'Ikke tildelt'} · Produksjon: ${
                          selectedEntry.productionTag || selectedEntry.sceneLabel || 'Ikke koblet'
                        }`}
                      </Typography>
                      <FormControl size="small" sx={{ mb: 1.25, minWidth: 220 }}>
                        <InputLabel sx={{ color: alpha(textSecondary, 0.75) }}>Livssyklus</InputLabel>
                        <Select
                          value={selectedEntry.lifecycleStage}
                          label="Livssyklus"
                          onChange={(event) => {
                            const lifecycleStage = String(event.target.value) as MemoryCardLifecycleStage;
                            updateEntry(
                              selectedEntry.id,
                              (entry) => ({ ...entry, lifecycleStage }),
                              `Livssyklus endret til ${lifecycleStageLabels[lifecycleStage]}`
                            );
                          }}
                          sx={{ color: textPrimary, bgcolor: alpha(textPrimary, 0.04) }}
                        >
                          {(Object.keys(lifecycleStageLabels) as MemoryCardLifecycleStage[]).map((stage) => (
                            <MenuItem key={stage} value={stage}>
                              {lifecycleStageLabels[stage]}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Stack spacing={0.5} sx={{ mb: 1.25 }}>
                        {(Object.keys(backupStageLabels) as BackupStage[]).map((stage) => (
                          <Button
                            key={stage}
                            onClick={() =>
                              updateEntry(
                                selectedEntry.id,
                                (entry) => ({
                                  ...entry,
                                  backups: { ...entry.backups, [stage]: !entry.backups[stage] },
                                }),
                                `${backupStageLabels[stage]} ${selectedEntry.backups[stage] ? 'fjernet' : 'bekreftet'}`
                              )
                            }
                            variant={selectedEntry.backups[stage] ? 'contained' : 'outlined'}
                            size="small"
                          sx={{
                              justifyContent: 'flex-start',
                              bgcolor: selectedEntry.backups[stage] ? alpha(success, 0.2) : undefined,
                              borderColor: alpha(borderColor, 0.72),
                              color: textPrimary,
                            }}
                          >
                            {renderStageIcon(stage, selectedEntry.backups[stage])}
                            {selectedEntry.backups[stage] ? '✓ ' : ''}
                            {backupStageLabels[stage]}
                          </Button>
                        ))}
                        <Button
                          onClick={() =>
                            updateEntry(
                              selectedEntry.id,
                              (entry) => ({ ...entry, checksumVerified: !entry.checksumVerified }),
                              selectedEntry.checksumVerified
                                ? 'Sjekksumverifisering fjernet'
                                : 'Sjekksumverifisering bekreftet'
                            )
                          }
                          variant={selectedEntry.checksumVerified ? 'contained' : 'outlined'}
                          size="small"
                          sx={{
                            justifyContent: 'flex-start',
                            bgcolor: selectedEntry.checksumVerified ? alpha(success, 0.2) : undefined,
                            borderColor: alpha(borderColor, 0.72),
                            color: textPrimary,
                          }}
                        >
                          {selectedEntry.checksumVerified ? '✓ ' : ''}Sjekksumverifisering
                        </Button>
                      </Stack>

                      <LinearProgress
                        variant="determinate"
                        value={backupProgress}
                        sx={{ height: 10, borderRadius: 10, mb: 1 }}
                      />
                      <Typography sx={{ fontSize: '0.82rem', color: alpha(textSecondary, 0.82) }}>
                        Fremdrift: {backupProgress}%
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                        <Button
                          startIcon={<CheckCircleIcon />}
                          variant="contained"
                          size="small"
                          onClick={() =>
                            updateEntry(
                              selectedEntry.id,
                              (entry) => ({
                                ...entry,
                                backups: { backup1: true, backup2: true, offsite: true },
                                checksumVerified: true,
                              }),
                              'Markert som fullstendig verifisert'
                            )
                          }
                          sx={{ bgcolor: success, '&:hover': { bgcolor: '#43a047' } }}
                        >
                          Markér verifisert
                        </Button>
                        <Button
                          startIcon={<QrCodeIcon />}
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            void handleGenerateQrLabel(selectedEntry);
                          }}
                          disabled={qrGenerating}
                          sx={{ borderColor: alpha(borderColor, 0.85), color: textPrimary }}
                        >
                          {qrGenerating ? 'Lager etikett…' : 'QR-etikett'}
                        </Button>
                        <Button
                          startIcon={<DeleteIcon />}
                          variant="outlined"
                          size="small"
                          color="error"
                          onClick={() =>
                            commitState((prev) => ({
                              ...prev,
                              entries: prev.entries.filter((entry) => entry.id !== selectedEntry.id),
                            }))
                          }
                        >
                          Fjern lagringsenhet
                        </Button>
                      </Stack>
                      {qrLabelPreview && qrLabelPreview.entryId === selectedEntry.id && (
                        <Box
                          sx={{
                            mt: 1.25,
                            p: 1,
                            border: `1px solid ${alpha(borderColor, 0.72)}`,
                            borderRadius: 1.25,
                            bgcolor: alpha(textPrimary, 0.03),
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                          }}
                        >
                          <Box
                            component="img"
                            src={qrLabelPreview.dataUrl}
                            alt={`QR-etikett ${selectedEntry.cardLabel}`}
                            sx={{
                              width: 72,
                              height: 72,
                              borderRadius: 1,
                              bgcolor: '#fff',
                              p: 0.5,
                              border: `1px solid ${alpha(borderColor, 0.45)}`,
                            }}
                          />
                          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.8rem', color: alpha(textSecondary, 0.88) }}>
                              QR-etikett klar for {selectedEntry.cardLabel}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                const anchor = document.createElement('a');
                                anchor.href = qrLabelPreview.dataUrl;
                                anchor.download = qrLabelPreview.fileName;
                                document.body.appendChild(anchor);
                                anchor.click();
                                document.body.removeChild(anchor);
                              }}
                              sx={{ alignSelf: 'flex-start', borderColor: alpha(borderColor, 0.78), color: textPrimary }}
                            >
                              Last ned etikett
                            </Button>
                          </Stack>
                        </Box>
                      )}
                    </>
                  )}
                </Paper>

                <Paper
                  sx={{
                    p: 2,
                    bgcolor: alpha(textPrimary, 0.03),
                    border: `1px solid ${alpha(borderColor, 0.72)}`,
                    borderRadius: `${cardRadius}px`,
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    Loggbok
                  </Typography>
                  {timeline.length === 0 ? (
                    <Typography sx={{ color: alpha(textSecondary, 0.8) }}>Ingen logg enda.</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {timeline.map((item) => (
                        <Box key={`${item.entryId}-${item.ts}-${item.event}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography sx={{ fontSize: '0.82rem', color: alpha(textSecondary, 0.95) }}>
                            {item.cardLabel}: {item.event}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: alpha(textSecondary, 0.65), whiteSpace: 'nowrap' }}>
                            {new Date(item.ts).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Stack>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${alpha(borderColor, 0.72)}`, px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: alpha(textSecondary, 0.95) }}>
          Lukk
        </Button>
        <Button
          onClick={handleSaveNow}
          startIcon={<SaveIcon />}
          disabled={saving || loading}
          variant="contained"
          sx={{ bgcolor: primary, '&:hover': { bgcolor: color.secondary || primary } }}
        >
          Lagre logg nå
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MemoryCardBackupControlDialog;
