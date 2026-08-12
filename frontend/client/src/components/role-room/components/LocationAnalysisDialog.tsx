import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Chip,
  Divider,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  useMediaQuery,
  useTheme,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Close as CloseIcon,
  CameraAlt as CameraIcon,
  Flight as FlightIcon,
  WbSunny as SunIcon,
  Accessible as AccessibleIcon,
  LocalParking as ParkingIcon,
  DirectionsBus as BusIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  Navigation as NavigationIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  AccessTime as AccessTimeIcon,
  Business as BusinessIcon,
  ContentCopy as ContentCopyIcon,
  Email as EmailIcon,
  Event as EventIcon,
  Edit as EditIcon,
  Gavel as GavelIcon,
  LocalPolice as PoliceIcon,
  LocalFireDepartment as FireDepartmentIcon,
  Phone as PhoneIcon,
  Public as PublicIcon,
  TaskAlt as TaskAltIcon,
  Save as SaveIcon,
  Train as TrainIcon,
  WarningAmber as WarningIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import type { Location } from '../models/casting';
import { externalDataService } from '@/services/ExternalDataService';
import { analyzeLocation as analyzeLocationApi, type LocationAnalysis as LocationPermitAnalysis } from '../services/locationAnalysisService';
import { roleRoomAnalytics } from '../services/roleRoomAnalytics';
import { LocationAnalysisGuide } from './production/LocationAnalysisGuide';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { useT } from '../../../i18n';

interface LocationAnalysisDialogProps {
  open: boolean;
  location: Location | null;
  onClose: () => void;
  onAnalysisComplete?: (analysis: Location['propertyAnalysis']) => void;
}

type AnalysisPreset = 'all' | 'tech_scout' | 'permits' | 'weather' | 'access';
type AnalysisOperationalFilter = 'all' | 'ready' | 'action_required' | 'risk' | 'cost';
type PermitWorkflowStatus = 'not_started' | 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';

const ROLE_ROOM_DIALOG_COLORS = {
  accent: '#a855f7',
  accentSoft: 'rgba(168,85,247,0.18)',
  secondary: 'var(--role-cyan, #22d3ee)',
  secondarySoft: 'rgba(34,211,238,0.18)',
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.18)',
  panel: 'rgba(20,16,46,0.74)',
  border: 'rgba(168,85,247,0.24)',
  mutedText: 'rgba(255,255,255,0.8)',
};

const PERMIT_STATUS_COLORS: Record<PermitWorkflowStatus, { bg: string; color: string; border: string }> = {
  not_started: {
    bg: 'rgba(148,163,184,0.16)',
    color: '#cbd5e1',
    border: 'rgba(148,163,184,0.34)',
  },
  draft: {
    bg: 'rgba(250,204,21,0.16)',
    color: '#fcd34d',
    border: 'rgba(250,204,21,0.35)',
  },
  submitted: {
    bg: 'rgba(34,211,238,0.16)',
    color: '#67e8f9',
    border: 'rgba(34,211,238,0.35)',
  },
  in_review: {
    bg: 'rgba(96,165,250,0.16)',
    color: '#93c5fd',
    border: 'rgba(96,165,250,0.35)',
  },
  approved: {
    bg: 'rgba(52,211,153,0.16)',
    color: '#6ee7b7',
    border: 'rgba(52,211,153,0.35)',
  },
  rejected: {
    bg: 'rgba(248,113,113,0.16)',
    color: '#fca5a5',
    border: 'rgba(248,113,113,0.35)',
  },
};

interface PermitOperationFlags {
  drone: boolean;
  trafficControl: boolean;
  nightShoot: boolean;
  pyrotechnics: boolean;
  publicArea: boolean;
  nearRail: boolean;
}

interface PermitContact {
  id: string;
  authority: string;
  unit: string;
  reason: string;
  processingDays: number;
  leadDays: number;
  openingHours: string;
  priority: 'hoy' | 'normal';
  phone?: string;
  email?: string;
  website?: string;
  contactHint?: string;
}

interface PermitTimelineItem extends PermitContact {
  status: PermitWorkflowStatus;
  deadlineDate: Date;
  daysUntilDeadline: number;
  isCompleted: boolean;
  isInProgress: boolean;
  isOverdue: boolean;
}

interface PermitWorkflowMeta {
  shootDate?: string;
  statuses?: Partial<Record<string, PermitWorkflowStatus>>;
  notes?: Partial<Record<string, string>>;
  operations?: Partial<PermitOperationFlags>;
  lastUpdated?: string;
  [key: string]: unknown;
}

interface ManualAnalysisDraft {
  droneAllowed: boolean;
  droneMaxAltitude: string;
  droneRestrictionsText: string;
  windExposure: 'low' | 'moderate' | 'high';
  sunExposure: 'morning' | 'afternoon' | 'all-day';
  shelterOptionsText: string;
  accessibility: 'wheelchair-accessible' | 'limited' | 'not-accessible';
  walkingDistance: string;
  publicTransportText: string;
  manualNotes: string;
}

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatNorwegianDate = (date: Date): string =>
  new Intl.DateTimeFormat('nb-NO', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

const splitListInput = (value: string): string[] =>
  value
    .split(/\n|,/)
    .map((token) => token.trim())
    .filter(Boolean);

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

const createManualDraft = (
  analysis: Location['propertyAnalysis'],
  locationAccessNotes?: string
): ManualAnalysisDraft => ({
  droneAllowed: Boolean((analysis as any)?.droneRestrictions?.allowed),
  droneMaxAltitude:
    typeof (analysis as any)?.droneRestrictions?.maxAltitude === 'number'
      ? String((analysis as any).droneRestrictions.maxAltitude)
      : '',
  droneRestrictionsText: ((analysis as any)?.droneRestrictions?.restrictions ?? []).join('\n'),
  windExposure: ((analysis as any)?.weatherExposure?.windExposure as ManualAnalysisDraft['windExposure']) || 'moderate',
  sunExposure: ((analysis as any)?.weatherExposure?.sunExposure as ManualAnalysisDraft['sunExposure']) || 'all-day',
  shelterOptionsText: ((analysis as any)?.weatherExposure?.shelterOptions ?? []).join(', '),
  accessibility:
    ((analysis as any)?.accessAnalysis?.accessibility as ManualAnalysisDraft['accessibility']) || 'limited',
  walkingDistance:
    typeof (analysis as any)?.accessAnalysis?.walkingDistance === 'number'
      ? String((analysis as any).accessAnalysis.walkingDistance)
      : '',
  publicTransportText: ((analysis as any)?.accessAnalysis?.publicTransport ?? []).join(', '),
  manualNotes: String((analysis as any)?.manualNotes ?? locationAccessNotes ?? ''),
});

type TFunc = ReturnType<typeof useT>['t'];

const getLocationTypeLabel = (type: string | undefined, t: TFunc): string => {
  if (type === 'studio') return 'studio';
  if (type === 'outdoor') return t('locAnalysis.locationType.outdoor');
  if (type === 'indoor') return t('locAnalysis.locationType.indoor');
  if (type === 'virtual') return t('locAnalysis.locationType.virtual');
  return t('locAnalysis.locationType.other');
};

const extractMunicipalityName = (address?: string): string | null => {
  if (!address) return null;
  const municipalityMatch = address.match(/([a-zA-ZæøåÆØÅ\-\s]+)\s+kommune/i);
  if (municipalityMatch?.[1]) {
    return municipalityMatch[1].trim();
  }
  const segments = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return segments.length > 1 ? segments[segments.length - 1] : null;
};

const inferPermitOperations = (location: Location, analysis: Location['propertyAnalysis'] | null): PermitOperationFlags => {
  const analysisRestrictions = ((analysis as any)?.droneRestrictions?.restrictions ?? []) as string[];
  const text = [
    location.name,
    location.address,
    String(location.accessNotes ?? ''),
    analysisRestrictions.join(' '),
  ]
    .join(' ')
    .toLowerCase();

  const hasDroneContext =
    /drone|uav|luftrom|no-fly|flyforbud/.test(text) ||
    Boolean((analysis as any)?.droneRestrictions?.noFlyZones?.length) ||
    location.type === 'outdoor';
  const hasTrafficContext = /trafikk|vei|gate|motorvei|road|steng|avsperr|parkering/.test(text);
  const hasNightContext = /natt|night|kveld|mørk|mork|after dark/.test(text);
  const hasPyroContext = /pyro|fyrverkeri|eksplos|flamme|røyk|smoke/.test(text);
  const hasPublicAreaContext = location.type === 'outdoor' || /torg|park|offentlig|street|plaza/.test(text);
  const hasRailContext = /jernbane|rail|tog|stasjon|bane nor/.test(text);

  return {
    drone: hasDroneContext,
    trafficControl: hasTrafficContext,
    nightShoot: hasNightContext,
    pyrotechnics: hasPyroContext,
    publicArea: hasPublicAreaContext,
    nearRail: hasRailContext,
  };
};

const buildPermitContacts = (
  location: Location,
  operations: PermitOperationFlags,
  municipalityName: string | null,
  /** Permit-info fra analyzeLocation (Kartverket + kommune-database).
   *  Hvis tilstede brukes ekte URL/email/telefon i stedet for placeholder. */
  liveKommuneInfo: { kommune?: string; filmingPermitUrl?: string; generalContactUrl?: string; generalContactPhone?: string; filmContactName?: string; filmContactEmail?: string; filmContactPhone?: string; noiseLimits?: string } | null | undefined,
  t: TFunc,
): PermitContact[] => {
  const contacts = new Map<string, PermitContact>();

  const addContact = (contact: PermitContact) => {
    if (!contacts.has(contact.id)) {
      contacts.set(contact.id, contact);
    }
  };

  const weekdayHours = t('locAnalysis.permit.hours.weekdays');
  const policeNonEmergencyHours = t('locAnalysis.permit.hours.policeNonEmergency');
  const policeAuthority = t('locAnalysis.permit.police.authority');

  const liveName = liveKommuneInfo?.kommune ?? null;
  const effectiveMunicipalityName = liveName ?? municipalityName;
  const municipalityLabel = effectiveMunicipalityName
    ? t('locAnalysis.permit.municipalityLabel', { name: effectiveMunicipalityName })
    : t('locAnalysis.permit.municipalityFallback');

  if (operations.publicArea) {
    // Hvis vi har ekte data fra Kartverket+kommune-DB → bruk den
    const filmingUrl = liveKommuneInfo?.filmingPermitUrl
      ?? liveKommuneInfo?.generalContactUrl
      ?? 'https://www.norge.no';
    const filmContactEmail = liveKommuneInfo?.filmContactEmail;
    const phone = liveKommuneInfo?.filmContactPhone ?? liveKommuneInfo?.generalContactPhone;
    const filmName = liveKommuneInfo?.filmContactName;
    const namePart = filmName ? ` (${filmName})` : '';
    const orCallPart = phone ? ` ${t('locAnalysis.permit.hint.orCall', { phone })}` : '';
    const hint = filmContactEmail
      ? `${t('locAnalysis.permit.hint.email', { email: filmContactEmail })}${namePart}${orCallPart}.`
      : phone
        ? `${t('locAnalysis.permit.hint.call', { phone })}${filmName ? namePart : ` ${t('locAnalysis.permit.hint.serviceDesk')}`}.`
        : effectiveMunicipalityName
          ? t('locAnalysis.permit.hint.checkSite', { url: filmingUrl })
          : t('locAnalysis.permit.hint.searchOffice');
    addContact({
      id: 'kommune',
      authority: municipalityLabel,
      unit: filmName ?? t('locAnalysis.permit.kommune.unit'),
      reason: liveKommuneInfo?.noiseLimits
        ? t('locAnalysis.permit.kommune.reasonWithNoise', { limits: liveKommuneInfo.noiseLimits })
        : t('locAnalysis.permit.kommune.reason'),
      processingDays: 10,
      leadDays: 14,
      openingHours: weekdayHours,
      priority: 'hoy',
      website: filmingUrl,
      contactHint: hint,
    });
  }

  if (operations.drone) {
    addContact({
      id: 'luftfart',
      authority: 'Luftfartstilsynet',
      unit: t('locAnalysis.permit.luftfart.unit'),
      reason: t('locAnalysis.permit.luftfart.reason'),
      processingDays: 14,
      leadDays: 21,
      openingHours: weekdayHours,
      priority: 'hoy',
      website: 'https://luftfartstilsynet.no',
      contactHint: t('locAnalysis.permit.luftfart.hint'),
    });
    addContact({
      id: 'avinor',
      authority: 'Avinor',
      unit: t('locAnalysis.permit.avinor.unit'),
      reason: t('locAnalysis.permit.avinor.reason'),
      processingDays: 14,
      leadDays: 21,
      openingHours: weekdayHours,
      priority: 'hoy',
      website: 'https://www.avinor.no',
      contactHint: t('locAnalysis.permit.avinor.hint'),
    });
  }

  if (operations.trafficControl) {
    addContact({
      id: 'politi',
      authority: policeAuthority,
      unit: t('locAnalysis.permit.politi.unit'),
      reason: t('locAnalysis.permit.politi.reason'),
      processingDays: 7,
      leadDays: 10,
      openingHours: policeNonEmergencyHours,
      priority: 'hoy',
      phone: '02800',
      website: 'https://www.politiet.no',
      contactHint: t('locAnalysis.permit.politi.hint'),
    });
    addContact({
      id: 'vegvesen',
      authority: 'Statens vegvesen',
      unit: t('locAnalysis.permit.vegvesen.unit'),
      reason: t('locAnalysis.permit.vegvesen.reason'),
      processingDays: 10,
      leadDays: 14,
      openingHours: weekdayHours,
      priority: 'hoy',
      website: 'https://www.vegvesen.no',
      contactHint: t('locAnalysis.permit.vegvesen.hint'),
    });
  }

  if (operations.nightShoot) {
    addContact({
      id: 'night_kommune',
      authority: municipalityLabel,
      unit: t('locAnalysis.permit.night.unit'),
      reason: t('locAnalysis.permit.night.reason'),
      processingDays: 8,
      leadDays: 10,
      openingHours: weekdayHours,
      priority: 'normal',
      website: 'https://www.norge.no',
      contactHint: t('locAnalysis.permit.night.hint'),
    });
  }

  if (operations.pyrotechnics) {
    addContact({
      id: 'brannvesen',
      authority: t('locAnalysis.permit.brannvesen.authority'),
      unit: t('locAnalysis.permit.brannvesen.unit'),
      reason: t('locAnalysis.permit.brannvesen.reason'),
      processingDays: 10,
      leadDays: 14,
      openingHours: weekdayHours,
      priority: 'hoy',
      contactHint: t('locAnalysis.permit.brannvesen.hint'),
    });
    addContact({
      id: 'pyro_politi',
      authority: policeAuthority,
      unit: t('locAnalysis.permit.pyroPolice.unit'),
      reason: t('locAnalysis.permit.pyroPolice.reason'),
      processingDays: 7,
      leadDays: 10,
      openingHours: policeNonEmergencyHours,
      priority: 'hoy',
      phone: '02800',
      website: 'https://www.politiet.no',
      contactHint: t('locAnalysis.permit.pyroPolice.hint'),
    });
  }

  if (operations.nearRail) {
    addContact({
      id: 'banenor',
      authority: 'Bane NOR',
      unit: t('locAnalysis.permit.banenor.unit'),
      reason: t('locAnalysis.permit.banenor.reason'),
      processingDays: 21,
      leadDays: 30,
      openingHours: weekdayHours,
      priority: 'hoy',
      website: 'https://www.banenor.no',
      contactHint: t('locAnalysis.permit.banenor.hint'),
    });
  }

  const ownerContact = location.contactInfo || location.contact_info;
  addContact({
    id: 'grunneier',
    authority: t('locAnalysis.permit.owner.authority'),
    unit: t('locAnalysis.permit.owner.unit'),
    reason: t('locAnalysis.permit.owner.reason'),
    processingDays: 3,
    leadDays: 7,
    openingHours: t('locAnalysis.permit.hours.byAppointment'),
    priority: 'hoy',
    phone: ownerContact?.phone,
    email: ownerContact?.email,
    contactHint: ownerContact?.email || ownerContact?.phone
      ? t('locAnalysis.permit.owner.hintSaved')
      : t('locAnalysis.permit.owner.hintMissing'),
  });

  return Array.from(contacts.values());
};

const buildPermitEmailTemplate = (params: {
  location: Location;
  contact: PermitContact;
  shootDate: string;
  operations: PermitOperationFlags;
  municipalityName: string | null;
}, t: TFunc): { subject: string; body: string; mailto: string } => {
  const activityLabels = [
    params.operations.drone ? t('locAnalysis.email.activity.drone') : null,
    params.operations.trafficControl ? t('locAnalysis.email.activity.traffic') : null,
    params.operations.nightShoot ? t('locAnalysis.email.activity.night') : null,
    params.operations.pyrotechnics ? t('locAnalysis.email.activity.pyro') : null,
    params.operations.publicArea ? t('locAnalysis.email.activity.publicArea') : null,
    params.operations.nearRail ? t('locAnalysis.email.activity.rail') : null,
  ].filter(Boolean);

  const shootDateText = params.shootDate ? formatNorwegianDate(new Date(`${params.shootDate}T12:00:00`)) : t('locAnalysis.email.dateNotSet');
  const municipalityText = params.municipalityName || t('locAnalysis.email.municipalityUnspecified');

  const subject = t('locAnalysis.email.subject', { name: params.location.name });
  const body = [
    t('locAnalysis.email.greeting', { authority: params.contact.authority }),
    '',
    t('locAnalysis.email.intro', {
      name: params.location.name,
      address: params.location.address || t('locAnalysis.email.addressNotProvided'),
      municipality: municipalityText,
    }),
    t('locAnalysis.email.plannedDate', { date: shootDateText }),
    '',
    t('locAnalysis.email.activities', {
      activities: activityLabels.length > 0 ? activityLabels.join(', ') : t('locAnalysis.email.ordinaryShoot'),
    }),
    '',
    t('locAnalysis.email.askConfirm'),
    '',
    t('locAnalysis.email.attachedHeading'),
    t('locAnalysis.email.item.production'),
    t('locAnalysis.email.item.schedule'),
    t('locAnalysis.email.item.safety'),
    '',
    t('locAnalysis.email.thanks'),
  ].join('\n');

  const mailtoRecipient = params.contact.email || '';
  const mailto = `mailto:${mailtoRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { subject, body, mailto };
};

// Helper function to open maps navigation
const openMapsNavigation = (lat: number, lng: number) => {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}`;
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  if (isIOS) {
    window.open(appleMapsUrl, '_blank');
  } else if (isAndroid) {
    window.open(`google.navigation:q=${lat},${lng}`, '_blank');
  } else {
    window.open(googleMapsUrl, '_blank');
  }
};

// Reusable Parking/Charging Spot List Item Component
interface SpotListItemProps {
  spot: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
    distance: number;
    spaces?: number;
  };
  variant?: 'default' | 'ev';
  spaceLabel?: string;
  index: number;
}

const SpotListItem = memo(({ spot, variant = 'default', spaceLabel, index }: SpotListItemProps) => {
  const { t } = useT();
  const bgColor = variant === 'ev' ? ROLE_ROOM_DIALOG_COLORS.secondarySoft : ROLE_ROOM_DIALOG_COLORS.accentSoft;
  const borderColor = variant === 'ev' ? 'rgba(34,211,238,0.34)' : ROLE_ROOM_DIALOG_COLORS.border;
  const hoverBgColor = variant === 'ev' ? 'rgba(34,211,238,0.24)' : 'rgba(168,85,247,0.24)';
  const hoverBorderColor = variant === 'ev' ? 'rgba(34,211,238,0.55)' : 'rgba(168,85,247,0.52)';
  
  const handleClick = useCallback(() => {
    openMapsNavigation(spot.coordinates.lat, spot.coordinates.lng);
  }, [spot.coordinates.lat, spot.coordinates.lng]);

  return (
    <ListItem
      key={index}
      sx={{
        p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
        mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
        borderRadius: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
        bgcolor: bgColor,
        border: `1px solid ${borderColor}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          bgcolor: hoverBgColor,
          borderColor: hoverBorderColor,
          transform: 'translateX(4px)',
        },
      }}
      onClick={handleClick}
    >
      <ListItemIcon sx={{ minWidth: { xs: 40, sm: 44, md: 42, lg: 48, xl: 52 } }}>
        <Box sx={{ 
          width: { xs: 36, sm: 40, md: 38, lg: 44, xl: 48 }, 
          height: { xs: 36, sm: 40, md: 38, lg: 44, xl: 48 }, 
          borderRadius: '50%', 
          bgcolor: ROLE_ROOM_DIALOG_COLORS.secondarySoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <NavigationIcon sx={{ color: ROLE_ROOM_DIALOG_COLORS.secondary, fontSize: { xs: '1.2rem', sm: '1.3rem', md: '1.25rem', lg: '1.4rem', xl: '1.5rem' } }} />
        </Box>
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
            {spot.name}
          </Typography>
        }
        secondary={
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
              {spot.address}
            </Typography>
            <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                label={t('locAnalysis.spot.distanceAway', { distance: spot.distance })}
                size="small"
                sx={{
                  bgcolor: variant === 'ev' ? ROLE_ROOM_DIALOG_COLORS.secondarySoft : ROLE_ROOM_DIALOG_COLORS.accentSoft,
                  color: variant === 'ev' ? ROLE_ROOM_DIALOG_COLORS.secondary : ROLE_ROOM_DIALOG_COLORS.accent,
                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                  height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                  '& .MuiChip-label': {
                    px: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                  },
                }}
              />
              {spot.spaces && spaceLabel && (
                <Chip
                  label={spaceLabel}
                  size="small"
                sx={{
                    bgcolor: ROLE_ROOM_DIALOG_COLORS.successSoft,
                    color: ROLE_ROOM_DIALOG_COLORS.success,
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                    height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                    '& .MuiChip-label': {
                      px: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                    },
                  }}
                />
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, ml: 'auto' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                  {t('locAnalysis.spot.tapToNavigate')}
                </Typography>
                <OpenInNewIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.9rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }} />
              </Box>
            </Box>
          </Box>
        }
        secondaryTypographyProps={{ component: 'div' }}
      />
    </ListItem>
  );
});

SpotListItem.displayName = 'SpotListItem';

export function LocationAnalysisDialog({ open, location, onClose, onAnalysisComplete }: LocationAnalysisDialogProps) {
  const { t } = useT();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Location['propertyAnalysis'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedForLocation, setHasLoadedForLocation] = useState<string | null>(null);
  const [analysisPreset, setAnalysisPreset] = useState<AnalysisPreset>('all');
  const [analysisOperationalFilter, setAnalysisOperationalFilter] = useState<AnalysisOperationalFilter>('all');
  const [plannedShootDate, setPlannedShootDate] = useState<string>('');
  const [permitStatuses, setPermitStatuses] = useState<Record<string, PermitWorkflowStatus>>({});
  const [permitNotes, setPermitNotes] = useState<Record<string, string>>({});
  const [operationFlags, setOperationFlags] = useState<PermitOperationFlags>({
    drone: false,
    trafficControl: false,
    nightShoot: false,
    pyrotechnics: false,
    publicArea: false,
    nearRail: false,
  });
  const [workflowSeedKey, setWorkflowSeedKey] = useState<string | null>(null);
  const [permitFeedback, setPermitFeedback] = useState<string | null>(null);
  const [permitFeedbackIsError, setPermitFeedbackIsError] = useState(false);
  const [savingPermitWorkflow, setSavingPermitWorkflow] = useState(false);
  const [copyingContactId, setCopyingContactId] = useState<string | null>(null);
  const [manualEditOpen, setManualEditOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualAnalysisDraft | null>(null);
  const [analysisFeedback, setAnalysisFeedback] = useState<string | null>(null);
  const [analysisFeedbackIsError, setAnalysisFeedbackIsError] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const presetLabels = useMemo<Record<AnalysisPreset, string>>(() => ({
    all: t('locAnalysis.filter.all'),
    tech_scout: 'Tech Scout',
    permits: t('locAnalysis.preset.permits'),
    weather: t('locAnalysis.preset.weather'),
    access: t('locAnalysis.preset.access'),
  }), [t]);

  const filterLabels = useMemo<Record<AnalysisOperationalFilter, string>>(() => ({
    all: t('locAnalysis.filter.all'),
    ready: t('locAnalysis.filter.ready'),
    action_required: t('locAnalysis.filter.actionRequired'),
    risk: t('locAnalysis.filter.risk'),
    cost: t('locAnalysis.filter.cost'),
  }), [t]);

  const permitStatusLabels = useMemo<Record<PermitWorkflowStatus, string>>(() => ({
    not_started: t('locAnalysis.permitStatus.notStarted'),
    draft: t('locAnalysis.permitStatus.draft'),
    submitted: t('locAnalysis.permitStatus.submitted'),
    in_review: t('locAnalysis.permitStatus.inReview'),
    approved: t('locAnalysis.permitStatus.approved'),
    rejected: t('locAnalysis.permitStatus.rejected'),
  }), [t]);

  const loadAnalysisForProperty = useCallback(async (propertyId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const propertyAnalysis = await externalDataService.analyzeProperty(propertyId);
      
      const analysisData: Location['propertyAnalysis'] = {
        photographySpots: propertyAnalysis.photographySpots,
        droneRestrictions: propertyAnalysis.droneRestrictions,
        weatherExposure: propertyAnalysis.weatherExposure,
        accessAnalysis: propertyAnalysis.accessAnalysis,
        permitWorkflow: ((location as any)?.propertyAnalysis?.permitWorkflow as PermitWorkflowMeta | undefined) ?? undefined,
      };
      
      setAnalysis(analysisData);
      roleRoomAnalytics.locationAnalyzed({
        project_id: (location as { projectId?: string })?.projectId ?? 'unknown',
        location_id: location?.id,
        analysis_type: 'property',
      });
      if (onAnalysisComplete) {
        onAnalysisComplete(analysisData);
      }
    } catch (err) {
      console.error('Error loading property analysis:', err);
      setError(t('locAnalysis.error.loadAnalysis'));
    } finally {
      setLoading(false);
    }
  }, [onAnalysisComplete, location, t]);

  const loadPropertyFromAddress = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const addressData = await externalDataService.getKartverketAddress(address);
      if (addressData.propertyId) {
        await loadAnalysisForProperty(addressData.propertyId);
      } else {
        setError(t('locAnalysis.error.noPropertyId'));
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading property from address:', err);
      setError(t('locAnalysis.error.loadData'));
      setLoading(false);
    }
  }, [loadAnalysisForProperty, t]);

  // Load analysis when dialog opens - use stable location identifier to prevent repeated loads
  useEffect(() => {
    if (!open) {
      // Reset loaded state when dialog closes
      setHasLoadedForLocation(null);
      setAnalysisPreset('all');
      setAnalysisOperationalFilter('all');
      setPermitFeedback(null);
      setPermitFeedbackIsError(false);
      setAnalysisFeedback(null);
      setAnalysisFeedbackIsError(false);
      setManualEditOpen(false);
      setManualDraft(null);
      setWorkflowSeedKey(null);
      return;
    }
    
    const locationKey = location?.propertyId || location?.address || null;
    
    // Skip if already loaded for this location
    if (!locationKey || hasLoadedForLocation === locationKey) {
      return;
    }
    
    // Mark as loading for this location
    setHasLoadedForLocation(locationKey);
    
    if (location?.propertyId) {
      loadAnalysisForProperty(location.propertyId);
    } else if (location?.address) {
      loadPropertyFromAddress(location.address);
    }
  }, [open, location?.propertyId, location?.address, hasLoadedForLocation, loadAnalysisForProperty, loadPropertyFromAddress]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    const locationKey = location?.propertyId || location?.address || null;
    if (locationKey) {
      setHasLoadedForLocation(null); // Reset to allow reload
      if (location?.propertyId) {
        loadAnalysisForProperty(location.propertyId);
        setHasLoadedForLocation(locationKey);
      } else if (location?.address) {
        loadPropertyFromAddress(location.address);
        setHasLoadedForLocation(locationKey);
      }
    }
  }, [location?.propertyId, location?.address, loadAnalysisForProperty, loadPropertyFromAddress]);

  const handleClose = useCallback(() => {
    setAnalysis(null);
    setError(null);
    setManualEditOpen(false);
    setManualDraft(null);
    setAnalysisFeedback(null);
    setAnalysisFeedbackIsError(false);
    setGuideOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true');

      if (!isTextInput && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'g' || event.key === 'G')) {
        event.preventDefault();
        setGuideOpen(true);
      }
      if (event.key === 'Escape' && guideOpen) {
        event.preventDefault();
        setGuideOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, guideOpen]);

  // Memoize computed values
  const hasAnalysisData = useMemo(() => analysis !== null, [analysis]);
  const photographySpotsCount = useMemo(() => analysis?.photographySpots.length || 0, [analysis?.photographySpots.length]);
  const analysisMetrics = useMemo(() => {
    if (!analysis) {
      return {
        readinessScore: 0,
        riskScore: 0,
        weatherRiskScore: 0,
        accessScore: 0,
        permitMissing: false,
        hasCoordinates: false,
        estimatedCost: 0,
        overBudget: false,
        actionRequiredCount: 0,
      };
    }

    const photographySpots = analysis.photographySpots || [];
    const hasCoordinates = photographySpots.some(
      (spot) => typeof spot.coordinates?.lat === 'number' && typeof spot.coordinates?.lng === 'number'
    );
    const permitRequiredByRule = (analysis.droneRestrictions?.restrictions || []).some((rule) =>
      /(permit|tillatelse|godkjenning|approval)/i.test(String(rule))
    );
    const permitMissing = !analysis.droneRestrictions?.allowed || permitRequiredByRule;

    const windRisk =
      analysis.weatherExposure?.windExposure === 'high' ? 45 : analysis.weatherExposure?.windExposure === 'moderate' ? 25 : 10;
    const sunRisk = analysis.weatherExposure?.sunExposure === 'all_day' ? 15 : 8;
    const droneRisk = analysis.weatherExposure?.droneSafety === 'Risiko' ? 30 : analysis.weatherExposure?.droneSafety === 'Vanskelig' ? 18 : 8;
    const weatherRiskScore = Math.min(100, windRisk + sunRisk + droneRisk);

    const parkingScore = (analysis.accessAnalysis?.parkingSpots?.length || 0) > 0 ? 35 : 12;
    const transportScore = (analysis.accessAnalysis?.publicTransport?.length || 0) > 0 ? 25 : 10;
    const accessibilityScore = analysis.accessAnalysis?.accessibility === 'wheelchair-accessible' ? 30 : analysis.accessAnalysis?.accessibility === 'limited' ? 20 : 10;
    const accessScore = Math.min(100, parkingScore + transportScore + accessibilityScore);

    let readinessScore = 0;
    readinessScore += hasCoordinates ? 25 : 5;
    readinessScore += permitMissing ? 8 : 20;
    readinessScore += weatherRiskScore <= 40 ? 20 : weatherRiskScore <= 65 ? 12 : 5;
    readinessScore += accessScore >= 70 ? 20 : accessScore >= 45 ? 12 : 5;
    readinessScore += photographySpots.length > 0 ? 15 : 5;
    readinessScore = Math.min(100, readinessScore);

    const sceneCount = Array.isArray(location?.assignedScenes) ? location?.assignedScenes.length : 0;
    const capacity = Number(location?.capacity || 0);
    const estimatedCost = Math.round(
      1800 +
        sceneCount * 650 +
        (analysis.droneRestrictions?.restrictions?.length || 0) * 220 +
        (analysis.weatherExposure?.shelterOptions?.length || 0) * 280 +
        (analysis.accessAnalysis?.walkingDistance || 0) * 1.1 +
        capacity * 24
    );
    const overBudget = estimatedCost > 18000;

    let riskScore = 0;
    if (permitMissing) riskScore += 28;
    riskScore += weatherRiskScore >= 70 ? 30 : weatherRiskScore >= 50 ? 18 : 8;
    riskScore += accessScore <= 40 ? 22 : accessScore <= 60 ? 12 : 6;
    if (!hasCoordinates) riskScore += 15;
    if (overBudget) riskScore += 12;
    riskScore = Math.min(100, riskScore);

    const actionRequiredCount = [permitMissing, weatherRiskScore >= 60, accessScore < 60, !hasCoordinates, overBudget].filter(Boolean).length;

    return {
      readinessScore,
      riskScore,
      weatherRiskScore,
      accessScore,
      permitMissing,
      hasCoordinates,
      estimatedCost,
      overBudget,
      actionRequiredCount,
    };
  }, [analysis, location?.assignedScenes, location?.capacity]);

  const municipalityName = useMemo(() => extractMunicipalityName(location?.address), [location?.address]);

  // ── Live analyse via Kartverket + kommune-permit-database ────────────
  // Bruker AbortController for å kansellere in-flight kall ved adresse-bytte,
  // explicit loading/error-state for brukerens trygghet, og bypasses-cache-
  // retry-funksjon for når noe feiler.
  const [permitAnalysis, setPermitAnalysis] = useState<LocationPermitAnalysis | null>(null);
  const [permitAnalysisLoading, setPermitAnalysisLoading] = useState(false);
  const [permitAnalysisError, setPermitAnalysisError] = useState<string | null>(null);
  const [permitAnalysisRefreshKey, setPermitAnalysisRefreshKey] = useState(0);

  useEffect(() => {
    if (!location?.address) {
      setPermitAnalysis(null);
      setPermitAnalysisLoading(false);
      setPermitAnalysisError(null);
      return;
    }
    const controller = new AbortController();
    setPermitAnalysisLoading(true);
    setPermitAnalysisError(null);
    void (async () => {
      try {
        const result = await analyzeLocationApi(location.address!, {
          signal: controller.signal,
          bypassCache: permitAnalysisRefreshKey > 0,
        });
        if (!controller.signal.aborted) {
          setPermitAnalysis(result);
          setPermitAnalysisLoading(false);
        }
      } catch (err) {
        // AbortError = bevisst kansellering (ny adresse, dialog lukket) — ikke vis feilmelding
        if (controller.signal.aborted) return;
        console.warn('[LocationAnalysisDialog] analyzeLocation failed:', err);
        setPermitAnalysis(null);
        setPermitAnalysisLoading(false);
        setPermitAnalysisError(
          err instanceof Error && err.message
            ? err.message
            : t('locAnalysis.error.kartverketFetch'),
        );
      }
    })();
    return () => { controller.abort(); };
  }, [location?.address, permitAnalysisRefreshKey, t]);

  const retryPermitAnalysis = useCallback(() => {
    setPermitAnalysisRefreshKey((k) => k + 1);
  }, []);

  const inferredOperations = useMemo<PermitOperationFlags>(() => {
    if (!location) {
      return {
        drone: false,
        trafficControl: false,
        nightShoot: false,
        pyrotechnics: false,
        publicArea: false,
        nearRail: false,
      };
    }
    return inferPermitOperations(location, analysis);
  }, [location, analysis]);
  const permitWorkflowFromAnalysis = useMemo(
    () =>
      ((analysis as any)?.permitWorkflow as PermitWorkflowMeta | undefined) ||
      (location ? ((location as any)?.propertyAnalysis?.permitWorkflow as PermitWorkflowMeta | undefined) : undefined),
    [analysis, location]
  );

  const permitContacts = useMemo(
    () => (location ? buildPermitContacts(location, operationFlags, municipalityName, permitAnalysis?.permitInfo ?? null, t) : []),
    [location, operationFlags, municipalityName, permitAnalysis, t]
  );

  const mentionCandidates = useMemo(() => {
    const pool = new Set<string>();
    if (typeof location?.name === 'string' && location.name.trim()) pool.add(location.name.trim());
    if (typeof municipalityName === 'string' && municipalityName.trim()) pool.add(municipalityName.trim());
    permitContacts.forEach((contact) => {
      if (typeof contact.authority === 'string' && contact.authority.trim()) pool.add(contact.authority.trim());
      if (typeof contact.unit === 'string' && contact.unit.trim()) pool.add(contact.unit.trim());
      if (typeof contact.reason === 'string' && contact.reason.trim()) pool.add(contact.reason.trim());
      if (typeof contact.contactHint === 'string' && contact.contactHint.trim()) pool.add(contact.contactHint.trim());
    });
    return Array.from(pool);
  }, [location?.name, municipalityName, permitContacts]);

  const permitTimeline = useMemo<PermitTimelineItem[]>(() => {
    if (!plannedShootDate || permitContacts.length === 0) return [];
    const shootDate = new Date(`${plannedShootDate}T12:00:00`);
    if (Number.isNaN(shootDate.getTime())) return [];
    const today = startOfDay(new Date());

    return permitContacts
      .map((contact) => {
        const deadlineDate = new Date(shootDate);
        deadlineDate.setDate(deadlineDate.getDate() - contact.leadDays);
        const daysUntilDeadline = Math.round((startOfDay(deadlineDate).getTime() - today.getTime()) / 86400000);
        const status = permitStatuses[contact.id] || 'not_started';
        const isCompleted = status === 'approved';
        const isInProgress = status === 'submitted' || status === 'in_review';
        const isOverdue = daysUntilDeadline < 0 && !isCompleted && !isInProgress;

        return {
          ...contact,
          status,
          deadlineDate,
          daysUntilDeadline,
          isCompleted,
          isInProgress,
          isOverdue,
        };
      })
      .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());
  }, [plannedShootDate, permitContacts, permitStatuses]);

  const permitRiskSummary = useMemo(() => {
    const total = permitContacts.length;
    const approved = permitTimeline.filter((entry) => entry.status === 'approved').length;
    const pendingRequired = permitTimeline.filter(
      (entry) => entry.status === 'not_started' || entry.status === 'draft' || entry.status === 'rejected'
    ).length;
    const rejectedCount = permitTimeline.filter((entry) => entry.status === 'rejected').length;
    const overdueCount = permitTimeline.filter((entry) => entry.isOverdue).length;
    const timePressureCount = permitTimeline.filter(
      (entry) =>
        (entry.status === 'not_started' || entry.status === 'draft') &&
        entry.daysUntilDeadline >= 0 &&
        entry.daysUntilDeadline <= entry.processingDays
    ).length;
    const criticalPending = permitTimeline.filter(
      (entry) =>
        entry.priority === 'hoy' &&
        entry.status !== 'submitted' &&
        entry.status !== 'in_review' &&
        entry.status !== 'approved'
    ).length;
    const inProgress = permitTimeline.filter(
      (entry) => entry.status === 'submitted' || entry.status === 'in_review'
    ).length;

    const score = Math.min(
      100,
      pendingRequired * 14 + rejectedCount * 20 + overdueCount * 22 + timePressureCount * 12 + criticalPending * 10
    );
    const level: 'lav' | 'moderat' | 'hoy' = score >= 65 ? 'hoy' : score >= 35 ? 'moderat' : 'lav';
    const progress = total > 0 ? Math.round(((approved + inProgress * 0.7) / total) * 100) : 100;

    return {
      total,
      approved,
      inProgress,
      pendingRequired,
      rejectedCount,
      overdueCount,
      timePressureCount,
      criticalPending,
      score,
      level,
      progress,
    };
  }, [permitContacts.length, permitTimeline]);

  const permitActionChecklist = useMemo(() => {
    const actions: string[] = [];
    if (!plannedShootDate) {
      actions.push(t('locAnalysis.checklist.setShootDate'));
    }
    if (permitRiskSummary.pendingRequired > 0) {
      actions.push(t('locAnalysis.checklist.pendingRequired', { n: permitRiskSummary.pendingRequired }));
    }
    if (permitRiskSummary.overdueCount > 0) {
      actions.push(t('locAnalysis.checklist.overdue', { n: permitRiskSummary.overdueCount }));
    }
    if (permitRiskSummary.timePressureCount > 0) {
      actions.push(t('locAnalysis.checklist.timePressure', { n: permitRiskSummary.timePressureCount }));
    }
    if (permitRiskSummary.rejectedCount > 0) {
      actions.push(t('locAnalysis.checklist.rejected', { n: permitRiskSummary.rejectedCount }));
    }
    if (actions.length === 0) {
      actions.push(t('locAnalysis.checklist.noneCritical'));
    }
    return actions;
  }, [plannedShootDate, permitRiskSummary, t]);

  const permitFallbackSuggestions = useMemo(() => {
    const suggestions: Array<{ title: string; detail: string }> = [];
    if (permitRiskSummary.level === 'hoy' || permitRiskSummary.rejectedCount > 0) {
      suggestions.push({
        title: t('locAnalysis.fallback.reserveLocation.title'),
        detail: t('locAnalysis.fallback.reserveLocation.detail', { type: getLocationTypeLabel(location?.type, t) }),
      });
    }
    if (operationFlags.drone) {
      suggestions.push({
        title: t('locAnalysis.fallback.drone.title'),
        detail: t('locAnalysis.fallback.drone.detail'),
      });
    }
    if (operationFlags.trafficControl) {
      suggestions.push({
        title: t('locAnalysis.fallback.traffic.title'),
        detail: t('locAnalysis.fallback.traffic.detail'),
      });
    }
    if (permitRiskSummary.timePressureCount > 0) {
      suggestions.push({
        title: t('locAnalysis.fallback.schedule.title'),
        detail: t('locAnalysis.fallback.schedule.detail'),
      });
    }
    return suggestions.slice(0, 4);
  }, [permitRiskSummary, location?.type, operationFlags.drone, operationFlags.trafficControl, t]);

  const permitSectionVisible = useMemo(() => {
    const presetMatch = analysisPreset === 'all' || analysisPreset === 'permits';
    if (!presetMatch) return false;
    if (analysisOperationalFilter === 'ready') return permitRiskSummary.score < 35 && permitRiskSummary.pendingRequired === 0;
    if (analysisOperationalFilter === 'action_required') return permitRiskSummary.pendingRequired > 0 || permitRiskSummary.score >= 35;
    if (analysisOperationalFilter === 'risk') return permitRiskSummary.score >= 35;
    return true;
  }, [analysisPreset, analysisOperationalFilter, permitRiskSummary]);

  const handleToggleOperation = useCallback((key: keyof PermitOperationFlags) => {
    setOperationFlags((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handlePermitStatusChange = useCallback((contactId: string, event: SelectChangeEvent<PermitWorkflowStatus>) => {
    const nextStatus = event.target.value as PermitWorkflowStatus;
    setPermitStatuses((prev) => ({
      ...prev,
      [contactId]: nextStatus,
    }));
  }, []);

  const handlePermitNoteChange = useCallback((contactId: string, note: string) => {
    setPermitNotes((prev) => ({
      ...prev,
      [contactId]: note,
    }));
  }, []);

  const handleCopyPermitTemplate = useCallback(
    async (contact: PermitContact) => {
      if (!location) {
        return;
      }
      const template = buildPermitEmailTemplate({
        location,
        contact,
        shootDate: plannedShootDate,
        operations: operationFlags,
        municipalityName,
      }, t);
      const templateText = t('locAnalysis.email.subjectPrefix', { subject: template.subject, body: template.body });
      try {
        setCopyingContactId(contact.id);
        await navigator.clipboard.writeText(templateText);
        setPermitFeedback(t('locAnalysis.toast.templateCopied', { authority: contact.authority }));
        setPermitFeedbackIsError(false);
      } catch (clipboardError) {
        console.error('Could not copy permit template:', clipboardError);
        setPermitFeedback(t('locAnalysis.toast.copyFailed'));
        setPermitFeedbackIsError(true);
      } finally {
        setCopyingContactId(null);
      }
    },
    [location, plannedShootDate, operationFlags, municipalityName, t]
  );

  const handleSavePermitWorkflow = useCallback(async () => {
    if (!analysis) return;

    const nextWorkflow: PermitWorkflowMeta = {
      shootDate: plannedShootDate,
      statuses: permitStatuses,
      notes: permitNotes,
      operations: operationFlags,
      lastUpdated: new Date().toISOString(),
    };

    const mergedAnalysis = {
      ...(analysis as Record<string, unknown>),
      permitWorkflow: nextWorkflow,
    } as Location['propertyAnalysis'];

    setSavingPermitWorkflow(true);
    setAnalysis(mergedAnalysis);

    try {
      if (onAnalysisComplete) {
        await Promise.resolve(onAnalysisComplete(mergedAnalysis));
      }
      setPermitFeedback(t('locAnalysis.toast.permitStatusSaved'));
      setPermitFeedbackIsError(false);
    } catch (saveError) {
      console.error('Error saving permit workflow:', saveError);
      setPermitFeedback(t('locAnalysis.toast.permitStatusSaveFailed'));
      setPermitFeedbackIsError(true);
    } finally {
      setSavingPermitWorkflow(false);
    }
  }, [analysis, plannedShootDate, permitStatuses, permitNotes, operationFlags, onAnalysisComplete, t]);

  const handleToggleManualEdit = useCallback(() => {
    if (!analysis) return;
    if (manualEditOpen) {
      setManualEditOpen(false);
      setManualDraft(null);
      return;
    }

    setManualDraft(createManualDraft(analysis, location?.accessNotes));
    setManualEditOpen(true);
  }, [analysis, manualEditOpen, location?.accessNotes]);

  const handleCancelManualEdit = useCallback(() => {
    setManualEditOpen(false);
    setManualDraft(null);
  }, []);

  const handleSaveManualEdit = useCallback(async () => {
    if (!analysis || !manualDraft) return;

    const parsedMaxAltitude = Number(manualDraft.droneMaxAltitude);
    const parsedWalkingDistance = Number(manualDraft.walkingDistance);

    const mergedAnalysis = {
      ...(analysis as Record<string, unknown>),
      droneRestrictions: {
        ...((analysis as any)?.droneRestrictions || {}),
        allowed: manualDraft.droneAllowed,
        maxAltitude:
          Number.isFinite(parsedMaxAltitude) && parsedMaxAltitude > 0 ? parsedMaxAltitude : undefined,
        restrictions: splitListInput(manualDraft.droneRestrictionsText),
      },
      weatherExposure: {
        ...((analysis as any)?.weatherExposure || {}),
        windExposure: manualDraft.windExposure,
        sunExposure: manualDraft.sunExposure,
        shelterOptions: splitListInput(manualDraft.shelterOptionsText),
      },
      accessAnalysis: {
        ...((analysis as any)?.accessAnalysis || {}),
        accessibility: manualDraft.accessibility,
        walkingDistance:
          Number.isFinite(parsedWalkingDistance) && parsedWalkingDistance >= 0 ? parsedWalkingDistance : 0,
        publicTransport: splitListInput(manualDraft.publicTransportText),
      },
      manualNotes: manualDraft.manualNotes.trim(),
      lastManualEditAt: new Date().toISOString(),
    } as Location['propertyAnalysis'];

    setAnalysis(mergedAnalysis);

    try {
      if (onAnalysisComplete) {
        await Promise.resolve(onAnalysisComplete(mergedAnalysis));
      }
      setAnalysisFeedback(t('locAnalysis.toast.manualSaved'));
      setAnalysisFeedbackIsError(false);
      setManualEditOpen(false);
      setManualDraft(null);
    } catch (saveError) {
      console.error('Error saving manual analysis edits:', saveError);
      setAnalysisFeedback(t('locAnalysis.toast.manualSaveFailed'));
      setAnalysisFeedbackIsError(true);
    }
  }, [analysis, manualDraft, onAnalysisComplete, t]);

  useEffect(() => {
    if (!open || !location) return;
    const sourceKey = `${location.id}:${analysis ? 'analysis' : 'empty'}`;
    if (workflowSeedKey === sourceKey) return;

    const defaultShootDate = toDateInputValue(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
    const savedOperations = permitWorkflowFromAnalysis?.operations;
    const mergedOperations: PermitOperationFlags = {
      drone: savedOperations?.drone ?? inferredOperations.drone,
      trafficControl: savedOperations?.trafficControl ?? inferredOperations.trafficControl,
      nightShoot: savedOperations?.nightShoot ?? inferredOperations.nightShoot,
      pyrotechnics: savedOperations?.pyrotechnics ?? inferredOperations.pyrotechnics,
      publicArea: savedOperations?.publicArea ?? inferredOperations.publicArea,
      nearRail: savedOperations?.nearRail ?? inferredOperations.nearRail,
    };

    setOperationFlags(mergedOperations);
    setPlannedShootDate(permitWorkflowFromAnalysis?.shootDate || defaultShootDate);
    setPermitStatuses((permitWorkflowFromAnalysis?.statuses as Record<string, PermitWorkflowStatus>) || {});
    setPermitNotes((permitWorkflowFromAnalysis?.notes as Record<string, string>) || {});
    setWorkflowSeedKey(sourceKey);
  }, [open, location, analysis, workflowSeedKey, permitWorkflowFromAnalysis, inferredOperations]);

  const sectionVisibility = useMemo(() => {
    const byPreset = {
      photography: analysisPreset === 'all' || analysisPreset === 'tech_scout',
      drone: analysisPreset === 'all' || analysisPreset === 'tech_scout' || analysisPreset === 'permits',
      weather: analysisPreset === 'all' || analysisPreset === 'tech_scout' || analysisPreset === 'weather',
      access: analysisPreset === 'all' || analysisPreset === 'tech_scout' || analysisPreset === 'access',
    };

    const needsAction = {
      photography: !analysisMetrics.hasCoordinates,
      drone: analysisMetrics.permitMissing,
      weather: analysisMetrics.weatherRiskScore >= 60,
      access: analysisMetrics.accessScore < 60,
    };

    const byOperationalFilter = {
      photography:
        analysisOperationalFilter === 'all' ||
        analysisOperationalFilter === 'ready' ||
        analysisOperationalFilter === 'action_required' ||
        analysisOperationalFilter === 'cost',
      drone:
        analysisOperationalFilter === 'all' ||
        analysisOperationalFilter === 'ready' ||
        analysisOperationalFilter === 'action_required' ||
        analysisOperationalFilter === 'risk' ||
        analysisOperationalFilter === 'cost',
      weather:
        analysisOperationalFilter === 'all' ||
        analysisOperationalFilter === 'ready' ||
        analysisOperationalFilter === 'action_required' ||
        analysisOperationalFilter === 'risk',
      access:
        analysisOperationalFilter === 'all' ||
        analysisOperationalFilter === 'ready' ||
        analysisOperationalFilter === 'action_required' ||
        analysisOperationalFilter === 'cost',
    };

    const visibility = {
      photography: byPreset.photography && byOperationalFilter.photography,
      drone: byPreset.drone && byOperationalFilter.drone,
      weather: byPreset.weather && byOperationalFilter.weather,
      access: byPreset.access && byOperationalFilter.access,
    };

    if (analysisOperationalFilter === 'ready') {
      visibility.photography = visibility.photography && !needsAction.photography;
      visibility.drone = visibility.drone && !needsAction.drone;
      visibility.weather = visibility.weather && !needsAction.weather;
      visibility.access = visibility.access && !needsAction.access;
    }

    if (analysisOperationalFilter === 'action_required') {
      visibility.photography = visibility.photography && needsAction.photography;
      visibility.drone = visibility.drone && needsAction.drone;
      visibility.weather = visibility.weather && needsAction.weather;
      visibility.access = visibility.access && needsAction.access;
    }

    return visibility;
  }, [analysisPreset, analysisOperationalFilter, analysisMetrics]);

  if (!location) return null;

  return (
    <>
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: ROLE_ROOM_DIALOG_COLORS.panel,
          color: '#fff',
          borderRadius: { xs: 0, sm: 2 },
          border: `1px solid ${ROLE_ROOM_DIALOG_COLORS.border}`,
          maxHeight: { xs: '100%', sm: '90vh' },
          maxWidth: { xs: '100%', sm: '95vw', md: '90vw', lg: '85vw', xl: '80vw' },
          m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 4 },
        },
      }}
    >
      <DialogTitle 
        sx={{ 
          color: '#fff', 
          borderBottom: `1px solid ${ROLE_ROOM_DIALOG_COLORS.border}`,
          px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
          py: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
            <LocationIcon sx={{ color: ROLE_ROOM_DIALOG_COLORS.secondary, fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.175rem', lg: '1.375rem', xl: '1.5rem' } }}>
                {t('locAnalysis.title')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                {location.name}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setGuideOpen(true)}
              startIcon={<HelpIcon />}
              sx={{
                minHeight: 40,
                textTransform: 'none',
                color: 'rgba(255,255,255,0.9)',
                borderColor: 'rgba(255,255,255,0.24)',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.4)',
                  bgcolor: 'rgba(255,255,255,0.08)',
                },
              }}
            >
              Guide
            </Button>
            <IconButton 
              onClick={handleClose} 
              sx={{ 
                color: 'rgba(255,255,255,0.87)',
                minWidth: 44,
                minHeight: 44,
                '&:hover': { bgcolor: 'rgba(168,85,247,0.24)' },
              }}
              aria-label={t('locAnalysis.aria.closeDialog')}
            >
              <CloseIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ 
        pt: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 }, 
        px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
        pb: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 },
        bgcolor: ROLE_ROOM_DIALOG_COLORS.panel,
        color: '#fff',
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: { xs: 6, sm: 8, md: 7, lg: 9, xl: 12 } }}>
            <CircularProgress sx={{ color: ROLE_ROOM_DIALOG_COLORS.secondary, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 }, fontSize: { xs: 48, sm: 56, md: 52, lg: 64, xl: 80 } }} size={56} />
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }}>
              {t('locAnalysis.loading.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', textAlign: 'center', maxWidth: { xs: '100%', sm: 400, md: 450, lg: 500, xl: 600 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
              {t('locAnalysis.loading.subtitle')}
            </Typography>
          </Box>
        ) : error ? (
          <Alert 
            severity="error" 
            icon={<CancelIcon />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={handleRefresh}
                startIcon={<RefreshIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                sx={{
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  minHeight: 44,
                }}
              >
                {t('locAnalysis.btn.retry')}
              </Button>
            }
            sx={{ 
              bgcolor: 'rgba(239,68,68,0.15)', 
              color: '#ef4444', 
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 2,
              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
              '& .MuiAlert-icon': {
                color: '#ef4444',
                fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
              },
            }}
          >
            <Typography variant="body1" sx={{ color: '#ef4444', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }}>
              {t('locAnalysis.error.loadAnalysisTitle')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
              {error}
            </Typography>
          </Alert>
        ) : hasAnalysisData ? (
          <Stack spacing={{ xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }}>
            <Card
              sx={{
                borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 },
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                bgcolor: 'rgba(20,16,46,0.72)',
                border: '1px solid rgba(168,85,247,0.24)',
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
                    gap: { xs: 1, sm: 1.25, md: 1.5 },
                    mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  }}
                >
                  {([
                    { key: 'ready', label: t('locAnalysis.metric.readiness'), value: `${analysisMetrics.readinessScore}%`, color: '#34d399' },
                    { key: 'risk', label: t('locAnalysis.metric.risk'), value: `${analysisMetrics.riskScore}`, color: '#f87171' },
                    {
                      key: 'permit',
                      label: t('locAnalysis.metric.permit'),
                      value: analysisMetrics.permitMissing ? t('locAnalysis.metric.permitMissing') : t('locAnalysis.metric.permitDocumented'),
                      color: analysisMetrics.permitMissing ? '#fbbf24' : '#34d399',
                    },
                    {
                      key: 'cost',
                      label: t('locAnalysis.metric.estimatedCost'),
                      value: `${new Intl.NumberFormat('nb-NO').format(analysisMetrics.estimatedCost)} kr`,
                      color: analysisMetrics.overBudget ? '#f87171' : 'var(--role-cyan, #22d3ee)',
                    },
                    {
                      key: 'action',
                      label: t('locAnalysis.metric.actionItems'),
                      value: `${analysisMetrics.actionRequiredCount}`,
                      color: analysisMetrics.actionRequiredCount > 0 ? '#f87171' : '#34d399',
                    },
                  ]).map((item) => (
                    <Box
                      key={item.key}
                      sx={{
                        p: { xs: 1, sm: 1.25, md: 1.5 },
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(168,85,247,0.22)',
                      }}
                    >
                      <Typography sx={{ color: ROLE_ROOM_DIALOG_COLORS.mutedText, fontSize: { xs: '0.68rem', sm: '0.72rem', md: '0.78rem' }, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ color: item.color, fontWeight: 800, fontSize: { xs: '1rem', sm: '1.15rem', md: '1.25rem' }, mt: 0.4 }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Stack spacing={1.1}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.9 }}>
                    {(Object.keys(presetLabels) as AnalysisPreset[]).map((preset) => (
                      <Chip
                        key={preset}
                        label={presetLabels[preset]}
                        onClick={() => setAnalysisPreset(preset)}
                        sx={{
                          bgcolor: analysisPreset === preset ? ROLE_ROOM_DIALOG_COLORS.accentSoft : 'rgba(255,255,255,0.05)',
                          color: analysisPreset === preset ? ROLE_ROOM_DIALOG_COLORS.accent : 'rgba(255,255,255,0.85)',
                          border: `1px solid ${analysisPreset === preset ? ROLE_ROOM_DIALOG_COLORS.border : 'rgba(255,255,255,0.2)'}`,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.9 }}>
                    {(Object.keys(filterLabels) as AnalysisOperationalFilter[]).map((filterKey) => (
                      <Button
                        key={filterKey}
                        variant="outlined"
                        size="small"
                        onClick={() => setAnalysisOperationalFilter(filterKey)}
                        sx={{
                          minHeight: 34,
                          textTransform: 'none',
                          borderColor:
                            analysisOperationalFilter === filterKey ? ROLE_ROOM_DIALOG_COLORS.secondary : 'rgba(255,255,255,0.2)',
                          color:
                            analysisOperationalFilter === filterKey ? ROLE_ROOM_DIALOG_COLORS.secondary : 'rgba(255,255,255,0.85)',
                          bgcolor:
                            analysisOperationalFilter === filterKey ? ROLE_ROOM_DIALOG_COLORS.secondarySoft : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        {filterLabels[filterKey]}
                      </Button>
                    ))}
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card
              sx={{
                borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 },
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                bgcolor: 'rgba(20,16,46,0.72)',
                border: '1px solid rgba(168,85,247,0.24)',
              }}
            >
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25, flexWrap: 'wrap', mb: 1.25 }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      {t('locAnalysis.manualQa.title')}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', mt: 0.25 }}>
                      {t('locAnalysis.manualQa.subtitle')}
                    </Typography>
                  </Box>
                  <Button
                    variant={manualEditOpen ? 'outlined' : 'contained'}
                    onClick={handleToggleManualEdit}
                    startIcon={manualEditOpen ? <CloseIcon /> : <EditIcon />}
                    sx={{
                      textTransform: 'none',
                      bgcolor: manualEditOpen ? 'transparent' : ROLE_ROOM_DIALOG_COLORS.secondary,
                      color: manualEditOpen ? 'rgba(255,255,255,0.87)' : '#02141a',
                      borderColor: 'rgba(255,255,255,0.35)',
                      fontWeight: 700,
                      '&:hover': {
                        bgcolor: manualEditOpen ? 'rgba(255,255,255,0.08)' : '#67e8f9',
                      },
                    }}
                  >
                    {manualEditOpen ? t('locAnalysis.btn.closeEdit') : t('locAnalysis.btn.editAnalysis')}
                  </Button>
                </Box>

                {analysisFeedback ? (
                  <Alert
                    severity={analysisFeedbackIsError ? 'warning' : 'success'}
                    sx={{
                      mb: 1.2,
                      bgcolor: analysisFeedbackIsError ? 'rgba(251,191,36,0.14)' : 'rgba(52,211,153,0.12)',
                      color: '#fff',
                      border: `1px solid ${analysisFeedbackIsError ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}`,
                    }}
                  >
                    {analysisFeedback}
                  </Alert>
                ) : null}

                {manualEditOpen && manualDraft ? (
                  <Stack spacing={1.1}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1,
                      }}
                    >
                      <FormControl size="small">
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.75)' }}>{t('locAnalysis.manualQa.field.drone')}</InputLabel>
                        <Select
                          label={t('locAnalysis.manualQa.field.drone')}
                          value={manualDraft.droneAllowed ? 'allowed' : 'blocked'}
                          onChange={(event) =>
                            setManualDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    droneAllowed: event.target.value === 'allowed',
                                  }
                                : prev
                            )
                          }
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.24)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ROLE_ROOM_DIALOG_COLORS.secondary },
                          }}
                        >
                          <MenuItem value="allowed">{t('locAnalysis.manualQa.value.allowed')}</MenuItem>
                          <MenuItem value="blocked">{t('locAnalysis.manualQa.value.notAllowed')}</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        size="small"
                        label={t('locAnalysis.manualQa.field.maxAltitude')}
                        value={manualDraft.droneMaxAltitude}
                        onChange={(event) =>
                          setManualDraft((prev) => (prev ? { ...prev, droneMaxAltitude: event.target.value } : prev))
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                            '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                        }}
                      />

                      <FormControl size="small">
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.75)' }}>{t('locAnalysis.manualQa.field.wind')}</InputLabel>
                        <Select
                          label={t('locAnalysis.manualQa.field.wind')}
                          value={manualDraft.windExposure}
                          onChange={(event) =>
                            setManualDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    windExposure: event.target.value as ManualAnalysisDraft['windExposure'],
                                  }
                                : prev
                            )
                          }
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.24)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ROLE_ROOM_DIALOG_COLORS.secondary },
                          }}
                        >
                          <MenuItem value="low">{t('locAnalysis.manualQa.value.low')}</MenuItem>
                          <MenuItem value="moderate">{t('locAnalysis.manualQa.value.moderate')}</MenuItem>
                          <MenuItem value="high">{t('locAnalysis.manualQa.value.high')}</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl size="small">
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.75)' }}>{t('locAnalysis.manualQa.field.sun')}</InputLabel>
                        <Select
                          label={t('locAnalysis.manualQa.field.sun')}
                          value={manualDraft.sunExposure}
                          onChange={(event) =>
                            setManualDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    sunExposure: event.target.value as ManualAnalysisDraft['sunExposure'],
                                  }
                                : prev
                            )
                          }
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.24)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ROLE_ROOM_DIALOG_COLORS.secondary },
                          }}
                        >
                          <MenuItem value="morning">{t('locAnalysis.manualQa.value.morning')}</MenuItem>
                          <MenuItem value="afternoon">{t('locAnalysis.manualQa.value.afternoon')}</MenuItem>
                          <MenuItem value="all-day">{t('locAnalysis.manualQa.value.allDay')}</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl size="small">
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.75)' }}>{t('locAnalysis.manualQa.field.accessibility')}</InputLabel>
                        <Select
                          label={t('locAnalysis.manualQa.field.accessibility')}
                          value={manualDraft.accessibility}
                          onChange={(event) =>
                            setManualDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    accessibility: event.target.value as ManualAnalysisDraft['accessibility'],
                                  }
                                : prev
                            )
                          }
                          sx={{
                            color: '#fff',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.24)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ROLE_ROOM_DIALOG_COLORS.secondary },
                          }}
                        >
                          <MenuItem value="wheelchair-accessible">{t('locAnalysis.manualQa.value.wheelchairAccessible')}</MenuItem>
                          <MenuItem value="limited">{t('locAnalysis.manualQa.value.limited')}</MenuItem>
                          <MenuItem value="not-accessible">{t('locAnalysis.manualQa.value.notAccessible')}</MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        size="small"
                        label={t('locAnalysis.manualQa.field.walkingDistance')}
                        value={manualDraft.walkingDistance}
                        onChange={(event) =>
                          setManualDraft((prev) => (prev ? { ...prev, walkingDistance: event.target.value } : prev))
                        }
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: '#fff',
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                            '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                          },
                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                        }}
                      />
                    </Box>

                    <TextField
                      size="small"
                      label={t('locAnalysis.manualQa.field.droneRestrictions')}
                      multiline
                      minRows={2}
                      value={manualDraft.droneRestrictionsText}
                      onChange={(event) =>
                        setManualDraft((prev) => (prev ? { ...prev, droneRestrictionsText: event.target.value } : prev))
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                          '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                      }}
                    />

                    <TextField
                      size="small"
                      label={t('locAnalysis.manualQa.field.publicTransport')}
                      value={manualDraft.publicTransportText}
                      onChange={(event) =>
                        setManualDraft((prev) => (prev ? { ...prev, publicTransportText: event.target.value } : prev))
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                          '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                      }}
                    />

                    <TextField
                      size="small"
                      label={t('locAnalysis.manualQa.field.shelterOptions')}
                      value={manualDraft.shelterOptionsText}
                      onChange={(event) =>
                        setManualDraft((prev) => (prev ? { ...prev, shelterOptionsText: event.target.value } : prev))
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                          '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                      }}
                    />

                    <TextField
                      size="small"
                      label={t('locAnalysis.manualQa.field.internalNotes')}
                      multiline
                      minRows={2}
                      value={manualDraft.manualNotes}
                      onChange={(event) =>
                        setManualDraft((prev) => (prev ? { ...prev, manualNotes: event.target.value } : prev))
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                          '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                      }}
                    />
                    <GlobalMentionHelper
                      text={manualDraft.manualNotes}
                      localCandidates={mentionCandidates}
                      onApplySuggestion={(name) =>
                        setManualDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                manualNotes: applyMentionSuggestion(prev.manualNotes, name),
                              }
                            : prev
                        )
                      }
                      autoTagTitle={t('locAnalysis.mention.autoTagNotes')}
                      suggestionTitle={t('locAnalysis.mention.suggestionTitle')}
                    />

                    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        onClick={handleSaveManualEdit}
                        startIcon={<SaveIcon />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          bgcolor: ROLE_ROOM_DIALOG_COLORS.accent,
                          '&:hover': {
                            bgcolor: '#9333ea',
                          },
                        }}
                      >
                        {t('locAnalysis.btn.saveManualChanges')}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleCancelManualEdit}
                        sx={{
                          textTransform: 'none',
                          borderColor: 'rgba(255,255,255,0.3)',
                          color: 'rgba(255,255,255,0.87)',
                        }}
                      >
                        {t('locAnalysis.btn.cancel')}
                      </Button>
                    </Box>
                  </Stack>
                ) : null}
              </CardContent>
            </Card>

            {permitSectionVisible ? (
              <Card
                sx={{
                  borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 },
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  bgcolor: 'rgba(20,16,46,0.72)',
                  border: '1px solid rgba(168,85,247,0.24)',
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25, flexWrap: 'wrap', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 },
                          height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 },
                          borderRadius: '50%',
                          bgcolor: 'rgba(34,211,238,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <GavelIcon sx={{ color: '#67e8f9', fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.65rem', xl: '1.9rem' } }} />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                          {t('locAnalysis.permitSection.title')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.84)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                          {t('locAnalysis.permitSection.subtitle')}
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="contained"
                      onClick={handleSavePermitWorkflow}
                      disabled={savingPermitWorkflow}
                      sx={{
                        bgcolor: ROLE_ROOM_DIALOG_COLORS.accent,
                        color: '#fff',
                        textTransform: 'none',
                        fontWeight: 700,
                        '&:hover': {
                          bgcolor: '#9333ea',
                        },
                      }}
                    >
                      {savingPermitWorkflow ? t('locAnalysis.btn.saving') : t('locAnalysis.btn.savePermitStatus')}
                    </Button>
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.16)' }}>
                      <Typography sx={{ color: ROLE_ROOM_DIALOG_COLORS.mutedText, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        {t('locAnalysis.permitSection.stat.contacts')}
                      </Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.12rem', mt: 0.4 }}>
                        {permitRiskSummary.total}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.16)' }}>
                      <Typography sx={{ color: ROLE_ROOM_DIALOG_COLORS.mutedText, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        {t('locAnalysis.permitSection.stat.progress')}
                      </Typography>
                      <Typography sx={{ color: '#67e8f9', fontWeight: 800, fontSize: '1.12rem', mt: 0.4 }}>
                        {permitRiskSummary.progress}%
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.16)' }}>
                      <Typography sx={{ color: ROLE_ROOM_DIALOG_COLORS.mutedText, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        {t('locAnalysis.permitSection.stat.openActions')}
                      </Typography>
                      <Typography sx={{ color: '#fca5a5', fontWeight: 800, fontSize: '1.12rem', mt: 0.4 }}>
                        {permitRiskSummary.pendingRequired}
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.16)' }}>
                      <Typography sx={{ color: ROLE_ROOM_DIALOG_COLORS.mutedText, fontSize: '0.68rem', textTransform: 'uppercase' }}>
                        {t('locAnalysis.permitSection.stat.permitRisk')}
                      </Typography>
                      <Typography
                        sx={{
                          color: permitRiskSummary.level === 'hoy' ? '#f87171' : permitRiskSummary.level === 'moderat' ? '#fbbf24' : '#34d399',
                          fontWeight: 800,
                          fontSize: '1.12rem',
                          mt: 0.4,
                        }}
                      >
                        {permitRiskSummary.score}
                      </Typography>
                    </Box>
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={permitRiskSummary.progress}
                    sx={{
                      mb: 2,
                      height: 8,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.12)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: permitRiskSummary.level === 'hoy' ? '#f87171' : permitRiskSummary.level === 'moderat' ? '#fbbf24' : '#34d399',
                      },
                    }}
                  />

                  {permitFeedback ? (
                    <Alert
                      severity={permitFeedbackIsError ? 'warning' : 'success'}
                      sx={{
                        mb: 2,
                        bgcolor: permitFeedbackIsError ? 'rgba(251,191,36,0.14)' : 'rgba(52,211,153,0.12)',
                        color: '#fff',
                        border: `1px solid ${permitFeedbackIsError ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.3)'}`,
                      }}
                    >
                      {permitFeedback}
                    </Alert>
                  ) : null}

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 320px) 1fr' },
                      gap: 1.25,
                      mb: 2,
                    }}
                  >
                    <TextField
                      label={t('locAnalysis.permitSection.plannedShootDate')}
                      type="date"
                      value={plannedShootDate}
                      onChange={(event) => setPlannedShootDate(event.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: '#fff',
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                          '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                        },
                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.84)' },
                      }}
                    />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {([
                        { key: 'publicArea', label: t('locAnalysis.op.publicArea'), icon: <PublicIcon fontSize="small" /> },
                        { key: 'drone', label: t('locAnalysis.op.drone'), icon: <FlightIcon fontSize="small" /> },
                        { key: 'trafficControl', label: t('locAnalysis.op.traffic'), icon: <PoliceIcon fontSize="small" /> },
                        { key: 'nightShoot', label: t('locAnalysis.op.nightShoot'), icon: <EventIcon fontSize="small" /> },
                        { key: 'pyrotechnics', label: t('locAnalysis.op.pyro'), icon: <WarningIcon fontSize="small" /> },
                        { key: 'nearRail', label: t('locAnalysis.op.nearRail'), icon: <TrainIcon fontSize="small" /> },
                      ] as const).map((item) => (
                        <Chip
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          onClick={() => handleToggleOperation(item.key)}
                          sx={{
                            bgcolor: operationFlags[item.key] ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.05)',
                            color: operationFlags[item.key] ? '#67e8f9' : 'rgba(255,255,255,0.84)',
                            border: `1px solid ${operationFlags[item.key] ? 'rgba(34,211,238,0.42)' : 'rgba(255,255,255,0.2)'}`,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Live-analyse status-banner (Kartverket + kommune-database) */}
                  {(permitAnalysisLoading || permitAnalysisError) && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        mb: 1,
                        borderRadius: 1.5,
                        bgcolor: permitAnalysisError ? 'rgba(251,191,36,0.10)' : 'rgba(96,165,250,0.10)',
                        border: `1px solid ${permitAnalysisError ? 'rgba(251,191,36,0.32)' : 'rgba(96,165,250,0.32)'}`,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        {permitAnalysisLoading ? (
                          <CircularProgress size={14} sx={{ color: '#60a5fa' }} />
                        ) : (
                          <WarningIcon sx={{ fontSize: 16, color: '#fbbf24' }} />
                        )}
                        <Typography
                          sx={{
                            color: permitAnalysisError ? '#fcd34d' : '#93c5fd',
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {permitAnalysisLoading
                            ? t('locAnalysis.permitSection.fetchingKartverket')
                            : permitAnalysisError}
                        </Typography>
                      </Box>
                      {permitAnalysisError && (
                        <Button
                          size="small"
                          onClick={retryPermitAnalysis}
                          startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            color: '#fbbf24',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            textTransform: 'none',
                            minHeight: 28,
                            px: 1.25,
                            '&:hover': { bgcolor: 'rgba(251,191,36,0.15)' },
                          }}
                        >
                          {t('locAnalysis.btn.retry')}
                        </Button>
                      )}
                    </Box>
                  )}

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(0, 1fr)' },
                      gap: 1.25,
                    }}
                  >
                    <Stack spacing={1.1}>
                      {permitContacts.map((contact) => {
                        const status = permitStatuses[contact.id] || 'not_started';
                        const statusColors = PERMIT_STATUS_COLORS[status];
                        const template = buildPermitEmailTemplate({
                          location,
                          contact,
                          shootDate: plannedShootDate,
                          operations: operationFlags,
                          municipalityName,
                        }, t);
                        const timelineEntry = permitTimeline.find((item) => item.id === contact.id);
                        return (
                          <Card
                            key={contact.id}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.16)',
                              borderRadius: 2,
                            }}
                          >
                            <CardContent sx={{ p: 1.2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    {contact.id.includes('politi') ? (
                                      <PoliceIcon sx={{ color: '#93c5fd', fontSize: '1rem' }} />
                                    ) : contact.id.includes('brann') ? (
                                      <FireDepartmentIcon sx={{ color: '#fca5a5', fontSize: '1rem' }} />
                                    ) : contact.id.includes('bane') ? (
                                      <TrainIcon sx={{ color: '#f9a8d4', fontSize: '1rem' }} />
                                    ) : contact.id.includes('veg') ? (
                                      <PublicIcon sx={{ color: '#67e8f9', fontSize: '1rem' }} />
                                    ) : contact.id.includes('grunneier') ? (
                                      <BusinessIcon sx={{ color: '#c4b5fd', fontSize: '1rem' }} />
                                    ) : (
                                      <GavelIcon sx={{ color: '#67e8f9', fontSize: '1rem' }} />
                                    )}
                                    {contact.authority}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', mt: 0.2 }}>
                                    {contact.unit}
                                  </Typography>
                                </Box>
                                <Chip
                                  size="small"
                                  label={permitStatusLabels[status]}
                                  sx={{
                                    bgcolor: statusColors.bg,
                                    color: statusColors.color,
                                    border: `1px solid ${statusColors.border}`,
                                  }}
                                />
                              </Box>
                              <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.76rem', mt: 0.85 }}>
                                {contact.reason}
                              </Typography>

                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1 }}>
                                <Chip
                                  size="small"
                                  icon={<AccessTimeIcon />}
                                  label={t('locAnalysis.contact.processingDays', { days: contact.processingDays })}
                                  sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }}
                                />
                                <Chip
                                  size="small"
                                  icon={<EventIcon />}
                                  label={t('locAnalysis.contact.leadDays', { days: contact.leadDays })}
                                  sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#d8b4fe' }}
                                />
                                <Chip
                                  size="small"
                                  label={contact.priority === 'hoy' ? t('locAnalysis.contact.priorityCritical') : t('locAnalysis.contact.priorityNormal')}
                                  sx={{
                                    bgcolor: contact.priority === 'hoy' ? 'rgba(248,113,113,0.16)' : 'rgba(34,211,238,0.14)',
                                    color: contact.priority === 'hoy' ? '#fca5a5' : '#67e8f9',
                                  }}
                                />
                              </Box>

                              {timelineEntry ? (
                                <Typography sx={{ color: timelineEntry.isOverdue ? '#fca5a5' : 'rgba(255,255,255,0.78)', fontSize: '0.74rem', mt: 0.75 }}>
                                  {timelineEntry.daysUntilDeadline >= 0
                                    ? t('locAnalysis.contact.deadlineIn', {
                                        date: formatNorwegianDate(timelineEntry.deadlineDate),
                                        days: timelineEntry.daysUntilDeadline,
                                      })
                                    : t('locAnalysis.contact.deadlineOverdue', {
                                        date: formatNorwegianDate(timelineEntry.deadlineDate),
                                        days: Math.abs(timelineEntry.daysUntilDeadline),
                                      })}
                                </Typography>
                              ) : null}

                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(140px, 200px) 1fr' }, gap: 0.8, mt: 1 }}>
                                <FormControl size="small" sx={{ minWidth: 160 }}>
                                  <InputLabel sx={{ color: 'rgba(255,255,255,0.75)' }}>{t('locAnalysis.contact.status')}</InputLabel>
                                  <Select
                                    label={t('locAnalysis.contact.status')}
                                    value={status}
                                    onChange={(event) => handlePermitStatusChange(contact.id, event as SelectChangeEvent<PermitWorkflowStatus>)}
                                    sx={{
                                      color: '#fff',
                                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.24)' },
                                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ROLE_ROOM_DIALOG_COLORS.secondary },
                                    }}
                                  >
                                    {(Object.keys(permitStatusLabels) as PermitWorkflowStatus[]).map((statusKey) => (
                                      <MenuItem key={statusKey} value={statusKey}>
                                        {permitStatusLabels[statusKey]}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                <TextField
                                  size="small"
                                  label={t('locAnalysis.contact.note')}
                                  value={permitNotes[contact.id] || ''}
                                  onChange={(event) => handlePermitNoteChange(contact.id, event.target.value)}
                                  placeholder={t('locAnalysis.contact.notePlaceholder')}
                                  sx={{
                                    '& .MuiOutlinedInput-root': {
                                      color: '#fff',
                                      '& fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
                                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                                      '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_DIALOG_COLORS.accent },
                                    },
                                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.75)' },
                                  }}
                                />
                                <GlobalMentionHelper
                                  text={permitNotes[contact.id] || ''}
                                  localCandidates={mentionCandidates}
                                  onApplySuggestion={(name) =>
                                    handlePermitNoteChange(
                                      contact.id,
                                      applyMentionSuggestion(permitNotes[contact.id], name)
                                    )
                                  }
                                  autoTagTitle={t('locAnalysis.mention.autoTagNote')}
                                  suggestionTitle={t('locAnalysis.mention.suggestionTitle')}
                                />
                              </Box>

                              <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mt: 1 }}>
                                {contact.phone ? (
                                  <Button
                                    size="small"
                                    startIcon={<PhoneIcon />}
                                    component="a"
                                    href={`tel:${contact.phone}`}
                                    sx={{ textTransform: 'none', color: '#93c5fd' }}
                                  >
                                    {contact.phone}
                                  </Button>
                                ) : null}
                                {contact.email ? (
                                  <Button
                                    size="small"
                                    startIcon={<EmailIcon />}
                                    component="a"
                                    href={template.mailto}
                                    sx={{ textTransform: 'none', color: '#67e8f9' }}
                                  >
                                    {t('locAnalysis.btn.sendEmail')}
                                  </Button>
                                ) : null}
                                {contact.website ? (
                                  <Button
                                    size="small"
                                    startIcon={<OpenInNewIcon />}
                                    component="a"
                                    href={contact.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ textTransform: 'none', color: '#d8b4fe' }}
                                  >
                                    {t('locAnalysis.btn.openChannel')}
                                  </Button>
                                ) : null}
                                <Button
                                  size="small"
                                  startIcon={<ContentCopyIcon />}
                                  onClick={() => handleCopyPermitTemplate(contact)}
                                  disabled={copyingContactId === contact.id}
                                  sx={{ textTransform: 'none', color: '#fff' }}
                                >
                                  {copyingContactId === contact.id ? t('locAnalysis.btn.copying') : t('locAnalysis.btn.copyTemplate')}
                                </Button>
                              </Box>

                              {contact.contactHint ? (
                                <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.72rem', mt: 0.75 }}>
                                  {contact.contactHint}
                                </Typography>
                              ) : null}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>

                    <Stack spacing={1}>
                      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2 }}>
                        <CardContent sx={{ p: 1.2 }}>
                          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 0.7 }}>
                            <TaskAltIcon sx={{ color: '#67e8f9' }} />
                            {t('locAnalysis.permitSection.actionPlan')}
                          </Typography>
                          <Stack spacing={0.7} sx={{ mt: 1 }}>
                            {permitActionChecklist.map((item) => (
                              <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.6 }}>
                                <WarningIcon sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.95rem', mt: 0.15 }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                                  {item}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </CardContent>
                      </Card>

                      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2 }}>
                        <CardContent sx={{ p: 1.2 }}>
                          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 0.7 }}>
                            <AccessTimeIcon sx={{ color: '#d8b4fe' }} />
                            {t('locAnalysis.permitSection.deadlineLine')}
                          </Typography>
                          <Stack spacing={0.7} sx={{ mt: 1 }}>
                            {permitTimeline.length > 0 ? (
                              permitTimeline.map((entry) => (
                                <Box
                                  key={entry.id}
                                  sx={{
                                    p: 0.8,
                                    borderRadius: 1.5,
                                    bgcolor: entry.isOverdue ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${entry.isOverdue ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.12)'}`,
                                  }}
                                >
                                  <Typography sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {entry.authority}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.72rem' }}>
                                    {formatNorwegianDate(entry.deadlineDate)} • {permitStatusLabels[entry.status]}
                                  </Typography>
                                </Box>
                              ))
                            ) : (
                              <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.75rem' }}>
                                {t('locAnalysis.permitSection.setShootDateHint')}
                              </Typography>
                            )}
                          </Stack>
                        </CardContent>
                      </Card>

                      {permitFallbackSuggestions.length > 0 ? (
                        <Card sx={{ bgcolor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 2 }}>
                          <CardContent sx={{ p: 1.2 }}>
                            <Typography sx={{ color: '#fecaca', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 0.6 }}>
                              <WarningIcon />
                              {t('locAnalysis.permitSection.fallbackHeading')}
                            </Typography>
                            <Stack spacing={0.8} sx={{ mt: 1 }}>
                              {permitFallbackSuggestions.map((item) => (
                                <Box key={item.title}>
                                  <Typography sx={{ color: '#fff', fontSize: '0.76rem', fontWeight: 600 }}>
                                    {item.title}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.72rem' }}>
                                    {item.detail}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </CardContent>
                        </Card>
                      ) : null}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            ) : null}

            {!permitSectionVisible &&
            !sectionVisibility.photography &&
            !sectionVisibility.drone &&
            !sectionVisibility.weather &&
            !sectionVisibility.access ? (
              <Alert
                severity="info"
                sx={{
                  bgcolor: 'rgba(34,211,238,0.12)',
                  color: '#67e8f9',
                  border: '1px solid rgba(34,211,238,0.24)',
                  borderRadius: 2,
                }}
              >
                {t('locAnalysis.noSectionsMatch')}
              </Alert>
            ) : null}

            {/* Photography Spots */}
            {sectionVisibility.photography ? (
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(20,16,46,0.72)',
              border: '1px solid rgba(168,85,247,0.24)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: 'rgba(0,212,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CameraIcon sx={{ color: 'var(--role-cyan, #00d4ff)', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      {t('locAnalysis.photography.title')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      {photographySpotsCount === 1
                        ? t('locAnalysis.photography.spotsIdentified.one', { n: photographySpotsCount })
                        : t('locAnalysis.photography.spotsIdentified.other', { n: photographySpotsCount })}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(168,85,247,0.24)' }} />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  }}
                >
                  {analysis?.photographySpots.map((spot, idx) => (
                    <Box key={idx}>
                      <Card sx={{ 
                        bgcolor: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(168,85,247,0.24)',
                        borderRadius: 2,
                        height: '100%',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.08)',
                          borderColor: 'rgba(0,212,255,0.3)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        },
                      }}>
                        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 } }}>
                            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1rem', md: '0.975rem', lg: '1.05rem', xl: '1.125rem' } }}>
                              {t('locAnalysis.photography.spotNumber', { n: idx + 1 })}
                            </Typography>
                            <Chip
                              label={spot.accessibility === 'easy' ? t('locAnalysis.accessibility.easy') : spot.accessibility === 'moderate' ? t('locAnalysis.accessibility.moderate') : t('locAnalysis.accessibility.difficult')}
                              size="small"
                              sx={{
                                bgcolor: spot.accessibility === 'easy' ? 'rgba(16,185,129,0.2)' : spot.accessibility === 'moderate' ? 'rgba(255,184,0,0.2)' : 'rgba(239,68,68,0.2)',
                                color: spot.accessibility === 'easy' ? '#10b981' : spot.accessibility === 'moderate' ? '#ffb800' : '#ef4444',
                                fontWeight: 600,
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                border: `1px solid ${spot.accessibility === 'easy' ? 'rgba(16,185,129,0.4)' : spot.accessibility === 'moderate' ? 'rgba(255,184,0,0.4)' : 'rgba(239,68,68,0.4)'}`,
                              }}
                            />
                          </Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, lineHeight: 1.6, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                            {spot.description}
                          </Typography>
                          {(spot.restrictions?.length ?? 0) > 0 && (
                            <Box sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                                {t('locAnalysis.restrictions')}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                                {(spot.restrictions ?? []).map((restriction, rIdx) => (
                                  <Chip
                                    key={rIdx}
                                    label={restriction}
                                    size="small"
                                    sx={{
                                      bgcolor: 'rgba(255,184,0,0.15)',
                                      color: '#ffb800',
                                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                      height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                      border: '1px solid rgba(255,184,0,0.3)',
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                          <Box sx={{ 
                            mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                            pt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                            borderTop: '1px solid rgba(168,85,247,0.24)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                          }}>
                            <LocationIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, color: 'rgba(255,255,255,0.87)' }} />
                            {spot.coordinates && (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                                {spot.coordinates.lat.toFixed(6)}, {spot.coordinates.lng.toFixed(6)}
                              </Typography>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
            ) : null}

            {/* Drone Restrictions */}
            {sectionVisibility.drone ? (
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(20,16,46,0.72)',
              border: '1px solid rgba(168,85,247,0.24)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: analysis?.droneRestrictions.allowed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FlightIcon sx={{ color: analysis?.droneRestrictions.allowed ? '#10b981' : '#ef4444', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      {t('locAnalysis.drone.title')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      {t('locAnalysis.drone.subtitle')}
                    </Typography>
                  </Box>
                  <Chip
                    icon={analysis?.droneRestrictions.allowed ? <CheckCircleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                    label={analysis?.droneRestrictions.allowed ? t('locAnalysis.manualQa.value.allowed') : t('locAnalysis.manualQa.value.notAllowed')}
                    sx={{
                      bgcolor: analysis?.droneRestrictions.allowed ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                      color: analysis?.droneRestrictions.allowed ? '#10b981' : '#ef4444',
                      fontWeight: 600,
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      height: { xs: 28, sm: 32, md: 30, lg: 34, xl: 40 },
                      border: `1px solid ${analysis?.droneRestrictions.allowed ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      '& .MuiChip-icon': {
                        color: analysis?.droneRestrictions.allowed ? '#10b981' : '#ef4444',
                      },
                    }}
                  />
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(168,85,247,0.24)' }} />
                <Stack spacing={{ xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }}>
                  {analysis?.droneRestrictions.maxAltitude && (
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(0,212,255,0.1)',
                      border: '1px solid rgba(0,212,255,0.2)',
                    }}>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' }, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('locAnalysis.drone.maxAltitude')}
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'var(--role-cyan, #00d4ff)', fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.375rem', lg: '1.625rem', xl: '2rem' } }}>
                        {t('locAnalysis.drone.meters', { n: analysis.droneRestrictions.maxAltitude })}
                      </Typography>
                    </Box>
                  )}
                  {(analysis?.droneRestrictions.restrictions?.length ?? 0) > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#fff', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.95rem', md: '0.9125rem', lg: '0.975rem', xl: '1.125rem' } }}>
                        {t('locAnalysis.restrictions')}
                      </Typography>
                      <Stack spacing={{ xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }}>
                        {(analysis?.droneRestrictions.restrictions ?? []).map((restriction, idx) => (
                          <Box 
                            key={idx}
                            sx={{ 
                              display: 'flex', 
                              alignItems: 'flex-start', 
                              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              bgcolor: 'rgba(255,184,0,0.08)',
                              border: '1px solid rgba(255,184,0,0.2)',
                            }}
                          >
                            <CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 }, color: '#ffb800', mt: 0.25, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                              {restriction}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {(analysis?.droneRestrictions.noFlyZones?.length ?? 0) > 0 && (
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                      <Typography variant="subtitle2" sx={{ color: '#ef4444', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                        {t('locAnalysis.drone.noFlyZonesTitle')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                        {(analysis?.droneRestrictions.noFlyZones?.length ?? 0) === 1
                          ? t('locAnalysis.drone.noFlyZonesCount.one', { n: analysis?.droneRestrictions.noFlyZones?.length ?? 0 })
                          : t('locAnalysis.drone.noFlyZonesCount.other', { n: analysis?.droneRestrictions.noFlyZones?.length ?? 0 })}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
            ) : null}

            {/* Weather Exposure */}
            {sectionVisibility.weather ? (
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(20,16,46,0.72)',
              border: '1px solid rgba(168,85,247,0.24)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: 'rgba(255,184,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <SunIcon sx={{ color: '#ffb800', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      {t('locAnalysis.weather.title')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      {t('locAnalysis.weather.subtitle')}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(168,85,247,0.24)' }} />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                    mb: (analysis?.weatherExposure.shelterOptions?.length || 0) > 0 ? { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } : 0,
                  }}
                >
                  <Box>
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(168,85,247,0.24)',
                      height: '100%',
                    }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                        {t('locAnalysis.weather.windExposure')}
                      </Typography>
                      <Chip
                        label={analysis?.weatherExposure.windExposure === 'low' ? t('locAnalysis.manualQa.value.low') : analysis?.weatherExposure.windExposure === 'moderate' ? t('locAnalysis.manualQa.value.moderate') : t('locAnalysis.manualQa.value.high')}
                        sx={{
                          bgcolor: analysis?.weatherExposure.windExposure === 'low' ? 'rgba(16,185,129,0.2)' : analysis?.weatherExposure.windExposure === 'moderate' ? 'rgba(255,184,0,0.2)' : 'rgba(239,68,68,0.2)',
                          color: analysis?.weatherExposure.windExposure === 'low' ? '#10b981' : analysis?.weatherExposure.windExposure === 'moderate' ? '#ffb800' : '#ef4444',
                          fontWeight: 600,
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                          height: { xs: 28, sm: 32, md: 30, lg: 34, xl: 40 },
                          border: `1px solid ${analysis?.weatherExposure.windExposure === 'low' ? 'rgba(16,185,129,0.4)' : analysis?.weatherExposure.windExposure === 'moderate' ? 'rgba(255,184,0,0.4)' : 'rgba(239,68,68,0.4)'}`,
                          mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        }}
                      />
                      {analysis?.weatherExposure.windSpeedKmh != null && (
                        <Box sx={{ mt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                            {t('locAnalysis.weather.windSpeedLabel')} <strong>{analysis.weatherExposure.windSpeedKmh.toFixed(1)} km/h</strong>
                            {analysis.weatherExposure.windSpeed != null && (
                              <span style={{ color: 'rgba(255,255,255,0.87)' }}> ({analysis.weatherExposure.windSpeed.toFixed(1)} m/s)</span>
                            )}
                          </Typography>
                          {analysis.weatherExposure.windDirection != null && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontStyle: 'italic' }}>
                              {t('locAnalysis.weather.windDirection', { deg: Math.round(analysis.weatherExposure.windDirection) })}
                            </Typography>
                          )}
                        </Box>
                      )}
                      {analysis?.weatherExposure.droneSafety && (
                        <Box sx={{ 
                          mt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, 
                          pt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, 
                          borderTop: '1px solid rgba(168,85,247,0.24)',
                        }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' }, letterSpacing: '0.5px' }}>
                            {t('locAnalysis.weather.droneSafety')}
                          </Typography>
                          <Chip
                            label={analysis.weatherExposure.droneSafety}
                            size="small"
                            sx={{
                              bgcolor: analysis.weatherExposure.droneSafety === 'Trygt' ? 'rgba(16,185,129,0.2)' : 
                                       analysis.weatherExposure.droneSafety === 'Vanskelig' ? 'rgba(255,184,0,0.2)' : 
                                       'rgba(239,68,68,0.2)',
                              color: analysis.weatherExposure.droneSafety === 'Trygt' ? '#10b981' : 
                                      analysis.weatherExposure.droneSafety === 'Vanskelig' ? '#ffb800' : 
                                      '#ef4444',
                              fontWeight: 600,
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                              border: `1px solid ${analysis.weatherExposure.droneSafety === 'Trygt' ? 'rgba(16,185,129,0.4)' : 
                                       analysis.weatherExposure.droneSafety === 'Vanskelig' ? 'rgba(255,184,0,0.4)' : 
                                       'rgba(239,68,68,0.4)'}`,
                              mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                            }}
                          />
                          {analysis.weatherExposure.droneSafetyDescription && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontStyle: 'italic' }}>
                              {analysis.weatherExposure.droneSafetyDescription}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Box>
                    <Box sx={{ 
                      p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(168,85,247,0.24)',
                      height: '100%',
                    }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                        {t('locAnalysis.weather.sunExposure')}
                      </Typography>
                      <Chip
                        label={analysis?.weatherExposure.sunExposure === 'morning' ? t('locAnalysis.manualQa.value.morning') : analysis?.weatherExposure.sunExposure === 'afternoon' ? t('locAnalysis.manualQa.value.afternoon') : t('locAnalysis.manualQa.value.allDay')}
                        sx={{
                          bgcolor: 'rgba(0,212,255,0.2)',
                          color: 'var(--role-cyan, #00d4ff)',
                          fontWeight: 600,
                          fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                          height: { xs: 28, sm: 32, md: 30, lg: 34, xl: 40 },
                          border: '1px solid rgba(0,212,255,0.4)',
                          mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        }}
                      />
                      {(analysis?.weatherExposure.sunrise || analysis?.weatherExposure.sunset) && (
                        <Box sx={{ mt: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                          {analysis.weatherExposure.sunrise && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                              {t('locAnalysis.weather.sunrise')} <strong>{analysis.weatherExposure.sunrise}</strong>
                            </Typography>
                          )}
                          {analysis.weatherExposure.sunset && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              {t('locAnalysis.weather.sunset')} <strong>{analysis.weatherExposure.sunset}</strong>
                            </Typography>
                          )}
                          {analysis.weatherExposure.daylightHours != null && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontStyle: 'italic' }}>
                              {t('locAnalysis.weather.daylightHours', { n: analysis.weatherExposure.daylightHours.toFixed(1) })}
                            </Typography>
                          )}
                        </Box>
                      )}
                      {analysis?.weatherExposure.sunDescription && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontStyle: 'italic' }}>
                          {analysis.weatherExposure.sunDescription}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
                {(analysis?.weatherExposure.shelterOptions?.length || 0) > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: '#fff', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontWeight: 600, fontSize: { xs: '0.875rem', sm: '0.95rem', md: '0.9125rem', lg: '0.975rem', xl: '1.125rem' } }}>
                      {t('locAnalysis.weather.shelterOptions')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                      {(analysis?.weatherExposure.shelterOptions ?? []).map((option, idx) => (
                        <Chip
                          key={idx}
                          label={option}
                          size="small"
                          icon={<InfoIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                          sx={{
                            bgcolor: 'rgba(16,185,129,0.15)',
                            color: '#10b981',
                            fontWeight: 500,
                            fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                            height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                            border: '1px solid rgba(16,185,129,0.3)',
                            '& .MuiChip-icon': {
                              color: '#10b981',
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
            ) : null}

            {/* Access Analysis */}
            {sectionVisibility.access ? (
            <Card sx={{ 
              borderRadius: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 4 }, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              bgcolor: 'rgba(20,16,46,0.72)',
              border: '1px solid rgba(168,85,247,0.24)',
            }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 } }}>
                  <Box sx={{ 
                    width: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    height: { xs: 40, sm: 44, md: 42, lg: 48, xl: 56 }, 
                    borderRadius: '50%', 
                    bgcolor: 'rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <AccessibleIcon sx={{ color: '#10b981', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                      {t('locAnalysis.access.title')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.825rem', lg: '0.9rem', xl: '1rem' } }}>
                      {t('locAnalysis.access.subtitle')}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ mb: { xs: 3, sm: 3.5, md: 3.25, lg: 3.5, xl: 4 }, borderColor: 'rgba(168,85,247,0.24)' }} />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(12, minmax(0, 1fr))' },
                    gap: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  }}
                >
                  {analysis?.accessAnalysis.parkingSpots && analysis.accessAnalysis.parkingSpots.length > 0 && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Box sx={{ 
                        p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(168,85,247,0.24)',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                          <Box sx={{ 
                            width: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            height: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(16,185,129,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <ParkingIcon sx={{ color: '#10b981', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                              {t('locAnalysis.access.parkingLocations')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                              {analysis.accessAnalysis.parkingSpots.length === 1
                                ? t('locAnalysis.access.parkingNearby.one', { n: analysis.accessAnalysis.parkingSpots.length })
                                : t('locAnalysis.access.parkingNearby.other', { n: analysis.accessAnalysis.parkingSpots.length })}
                            </Typography>
                          </Box>
                        </Box>
                        <List sx={{ ml: { xs: 0, sm: 7, md: 6.5, lg: 7, xl: 8 }, p: 0 }}>
                          {analysis.accessAnalysis.parkingSpots.map((spot, idx) => (
                            <SpotListItem
                              key={idx}
                              spot={spot}
                              variant="default"
                              spaceLabel={spot.spaces ? t('locAnalysis.access.spaces', { n: spot.spaces }) : undefined}
                              index={idx}
                            />
                          ))}
                        </List>
                      </Box>
                    </Box>
                  )}
                  <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 6' } }}>
                    <Box sx={{ 
                      p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                      borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(168,85,247,0.24)',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                    }}>
                      <Box sx={{ 
                        width: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                        height: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                        borderRadius: '50%', 
                        bgcolor: analysis?.accessAnalysis.accessibility === 'wheelchair-accessible' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <AccessibleIcon sx={{ color: analysis?.accessAnalysis.accessibility === 'wheelchair-accessible' ? '#10b981' : '#ef4444', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, letterSpacing: '0.5px' }}>
                          {t('locAnalysis.manualQa.field.accessibility')}
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                          {analysis?.accessAnalysis.accessibility === 'wheelchair-accessible' ? t('locAnalysis.manualQa.value.wheelchairAccessible') :
                            analysis?.accessAnalysis.accessibility === 'limited' ? t('locAnalysis.manualQa.value.limited') : t('locAnalysis.manualQa.value.notAccessible')}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  {(analysis?.accessAnalysis.publicTransport?.length || 0) > 0 && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Box sx={{ 
                        p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(168,85,247,0.24)',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                          <Box sx={{ 
                            width: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            height: { xs: 48, sm: 52, md: 50, lg: 56, xl: 64 }, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(0,212,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <BusIcon sx={{ color: 'var(--role-cyan, #00d4ff)', fontSize: { xs: '1.5rem', sm: '1.75rem', md: '1.625rem', lg: '1.875rem', xl: '2rem' } }} />
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                              {t('locAnalysis.access.publicTransportTitle')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                              {(analysis?.accessAnalysis.publicTransport?.length ?? 0) === 1
                                ? t('locAnalysis.access.linesAvailable.one', { n: analysis?.accessAnalysis.publicTransport?.length ?? 0 })
                                : t('locAnalysis.access.linesAvailable.other', { n: analysis?.accessAnalysis.publicTransport?.length ?? 0 })}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, ml: { xs: 0, sm: 7, md: 6.5, lg: 7, xl: 8 } }}>
                          {(analysis?.accessAnalysis.publicTransport ?? []).map((transport, idx) => (
                            <Chip
                              key={idx}
                              label={transport}
                              size="small"
                              icon={<BusIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                              sx={{
                                bgcolor: 'rgba(0,212,255,0.2)',
                                color: 'var(--role-cyan, #00d4ff)',
                                fontWeight: 500,
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                border: '1px solid rgba(0,212,255,0.3)',
                                '& .MuiChip-icon': {
                                  color: 'var(--role-cyan, #00d4ff)',
                                },
                              }}
                            />
                          ))}
                        </Box>
                        {(analysis?.accessAnalysis.walkingDistance || 0) > 0 && (
                          <Box sx={{ mt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, ml: { xs: 0, sm: 7, md: 6.5, lg: 7, xl: 8 } }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                              {t('locAnalysis.access.walkingDistancePrefix')} <strong>{t('locAnalysis.access.meters', { n: analysis?.accessAnalysis.walkingDistance ?? 0 })}</strong>
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                  {(analysis?.accessAnalysis.evParking || analysis?.accessAnalysis.evCharging) && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Box sx={{ 
                        p: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(16,185,129,0.08)',
                        border: '1px solid rgba(16,185,129,0.2)',
                      }}>
                        <Typography variant="subtitle2" sx={{ color: '#10b981', fontWeight: 600, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.375rem' } }}>
                          <Box sx={{ 
                            width: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 }, 
                            height: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 }, 
                            borderRadius: '50%', 
                            bgcolor: 'rgba(16,185,129,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Box sx={{ 
                              width: { xs: 16, sm: 18, md: 17, lg: 20, xl: 24 }, 
                              height: { xs: 16, sm: 18, md: 17, lg: 20, xl: 24 }, 
                              borderRadius: '50%', 
                              bgcolor: '#10b981',
                              border: '2px solid #10b981',
                            }} />
                          </Box>
                          {t('locAnalysis.access.evParkingChargingTitle')}
                        </Typography>
                        <Stack spacing={{ xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }}>
                          {analysis?.accessAnalysis.evParking && (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, flexWrap: 'wrap' }}>
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                                  {t('locAnalysis.access.evParking')}
                                </Typography>
                                <Chip
                                  label={t('locAnalysis.spot.distanceAway', { distance: analysis?.accessAnalysis.evParking?.distance ?? 0 })}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(16,185,129,0.2)',
                                    color: '#10b981',
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                    height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                                    border: '1px solid rgba(16,185,129,0.3)',
                                  }}
                                />
                              </Box>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, mb: (analysis?.accessAnalysis.evParkingSpots?.length || 0) > 0 ? { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } : 0 }}>
                                {analysis?.accessAnalysis.evParking?.description}
                              </Typography>
                              {(analysis?.accessAnalysis.evParkingSpots?.length || 0) > 0 && (
                                <List sx={{ p: 0, mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                                  {analysis?.accessAnalysis.evParkingSpots?.map((spot, idx) => (
                                    <SpotListItem
                                      key={idx}
                                      spot={spot}
                                      variant="ev"
                                      spaceLabel={spot.spaces ? t('locAnalysis.access.evSpaces', { n: spot.spaces }) : undefined}
                                      index={idx}
                                    />
                                  ))}
                                </List>
                              )}
                            </Box>
                          )}
                          {analysis?.accessAnalysis.evCharging && (
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, flexWrap: 'wrap' }}>
                                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                                  {t('locAnalysis.access.chargingStation')}
                                </Typography>
                                <Chip
                                  label={t('locAnalysis.spot.distanceAway', { distance: analysis?.accessAnalysis.evCharging?.distance ?? 0 })}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(16,185,129,0.2)',
                                    color: '#10b981',
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                    height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
                                    border: '1px solid rgba(16,185,129,0.3)',
                                  }}
                                />
                              </Box>
                              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, mb: (analysis?.accessAnalysis.evChargingSpots?.length || 0) > 0 ? { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } : 0 }}>
                                {analysis?.accessAnalysis.evCharging?.description}
                              </Typography>
                              {(analysis?.accessAnalysis.evChargingSpots?.length || 0) > 0 && (
                                <List sx={{ p: 0, mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                                  {analysis?.accessAnalysis.evChargingSpots?.map((spot, idx) => (
                                    <SpotListItem
                                      key={idx}
                                      spot={spot}
                                      variant="ev"
                                      spaceLabel={spot.spaces ? (spot.spaces === 1 ? t('locAnalysis.access.chargingSpaces.one', { n: spot.spaces }) : t('locAnalysis.access.chargingSpaces.other', { n: spot.spaces })) : undefined}
                                      index={idx}
                                    />
                                  ))}
                                </List>
                              )}
                            </Box>
                          )}
                        </Stack>
                      </Box>
                    </Box>
                  )}
                  {(analysis?.accessAnalysis.walkingDistance || 0) > 0 && (analysis?.accessAnalysis.publicTransport?.length || 0) === 0 && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Box sx={{ 
                        p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, 
                        bgcolor: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(168,85,247,0.24)',
                      }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                          {t('locAnalysis.access.walkingDistancePrefix')} <strong>{t('locAnalysis.access.meters', { n: analysis?.accessAnalysis.walkingDistance ?? 0 })}</strong>
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
            ) : null}
          </Stack>
        ) : (
          <Box sx={{ textAlign: 'center', py: { xs: 6, sm: 8, md: 7, lg: 9, xl: 12 } }}>
            <Box sx={{ 
              width: { xs: 80, sm: 90, md: 85, lg: 100, xl: 120 }, 
              height: { xs: 80, sm: 90, md: 85, lg: 100, xl: 120 }, 
              borderRadius: '50%', 
              bgcolor: 'rgba(0,212,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 },
            }}>
              <LocationIcon sx={{ color: 'var(--role-cyan, #00d4ff)', fontSize: { xs: '2.5rem', sm: '3rem', md: '2.75rem', lg: '3.5rem', xl: '4rem' } }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.375rem', lg: '1.625rem', xl: '2rem' } }}>
              {t('locAnalysis.empty.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 }, maxWidth: { xs: '100%', sm: 400, md: 450, lg: 500, xl: 600 }, mx: 'auto', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
              {t('locAnalysis.empty.subtitle')}
            </Typography>
            <Button
              variant="contained"
              onClick={handleRefresh}
              sx={{
                bgcolor: 'var(--role-cyan, #00d4ff)',
                color: '#000',
                fontWeight: 600,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 4, sm: 4.5, md: 4.25, lg: 5, xl: 6 },
                py: { xs: 1.5, sm: 1.75, md: 1.625, lg: 2, xl: 2.5 },
                borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                minHeight: 44,
                '&:hover': { bgcolor: '#00b8e6' },
              }}
            >
              {t('locAnalysis.btn.startAnalysis')}
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ 
        borderTop: '1px solid rgba(168,85,247,0.24)', 
        p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
        px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
        gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
        bgcolor: '#1c2128',
      }}>
        <Button 
          onClick={handleClose} 
          variant="outlined"
          sx={{ 
            color: 'rgba(255,255,255,0.87)',
            borderColor: 'rgba(255,255,255,0.2)',
            fontWeight: 600,
            fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
            px: { xs: 3, sm: 3.5, md: 3.25, lg: 4, xl: 5 },
            py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
            minHeight: 44,
            '&:hover': { 
              bgcolor: 'rgba(168,85,247,0.24)',
              borderColor: 'rgba(255,255,255,0.3)',
            },
          }}
        >
          {t('locAnalysis.btn.close')}
        </Button>
      </DialogActions>
    </Dialog>
      <LocationAnalysisGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
