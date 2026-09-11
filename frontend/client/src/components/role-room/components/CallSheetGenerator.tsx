// @ts-nocheck
import { useState, useRef, useEffect, useMemo, type FC, type ReactNode } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Stack,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  alpha,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Videocam as VideocamIcon,
  Movie as MovieIcon,
  WbSunny as SunnyIcon,
  NightsStay as MoonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  Place as PlaceIcon,
  Theaters as TheatersIcon,
  Groups as GroupsIcon,
  LocalDining as MealIcon,
  Emergency as EmergencyIcon,
  Description as DescriptionIcon,
  Today as TodayIcon,
  AccessTime as TimeIcon,
  DirectionsCar as ParkingIcon,
  ContactPhone as ContactIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { LocationsIcon as LocationIcon } from './icons/CastingIcons';
import type { ProductionDay, CrewMember, Location, SceneBreakdown, Candidate, Role } from '../models/casting';
import { castingService } from '../services/castingService';
import { roleRoomAgentDefaultHeaders } from '../services/roleRoomAgentService';
import { roleRoomProjectTabConfigService } from '../services/roleRoomProjectTabConfigService';
import { hasRolePreset, presetForRole } from '../models/studioAccessModel';
import { SECOND_AD_STATUS_LABELS, selectSecondAdProductionDay } from './assistant-director/secondAssistantDirectorWorkspaceModel';
import { useProjectMemberAvailability } from '../hooks/useProjectMemberAvailability';

// ============================================
// INTERFACES
// ============================================

interface CallSheetData {
  id: string;
  projectName: string;
  productionCompany: string;
  date: string;
  dayNumber: number;
  totalDays: number;
  director: string;
  producer: string;
  callTime: string;
  shootingCallTime: string;
  lunchTime: string;
  estimatedWrap: string;
  locations: CallSheetLocation[];
  scenes: CallSheetScene[];
  cast: CallSheetCastMember[];
  crew: CallSheetCrewMember[];
  specialInstructions: string;
  weatherForecast?: {
    temperature: number;
    conditions: string;
    sunrise: string;
    sunset: string;
  };
  emergencyContacts: EmergencyContact[];
  notes: string;
}

interface CallSheetLocation {
  id: string;
  name: string;
  address: string;
  parkingInfo: string;
  contactPerson: string;
  contactPhone: string;
}

interface CallSheetScene {
  sceneNumber: string;
  description: string;
  intExt: string;
  dayNight: string;
  pages: string;
  cast: string[];
  location: string;
  estimatedTime: string;
}

interface CallSheetCastMember {
  id: string;
  name: string;
  role: string;
  pickupTime?: string;
  callTime: string;
  makeupTime?: string;
  wardrobeTime?: string;
  onSetTime: string;
  transport?: string;
  movementStatus?: string;
  scenes: string[];
  notes?: string;
  email?: string;
}

interface CallSheetCrewMember {
  id: string;
  name: string;
  department: string;
  position: string;
  callTime: string;
  phone?: string;
  email?: string;
}

interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
}

interface CallSheetGeneratorProps {
  projectId: string;
  productionDay?: ProductionDay;
  productionDayId?: string;
  scenes?: SceneBreakdown[];
  crew?: CrewMember[];
  locations?: Location[];
  onGenerate?: (callSheet: CallSheetData) => void;
  onDeliverySent?: () => void;
}

const EMPTY_SCENES: SceneBreakdown[] = [];
const EMPTY_CREW: CrewMember[] = [];
const EMPTY_LOCATIONS: Location[] = [];

export interface CallSheetRecipientPreviewItem {
  id: string;
  name: string;
  email: string;
  source: 'cast' | 'crew';
}

export interface CallSheetRecipientPreview {
  valid: CallSheetRecipientPreviewItem[];
  invalid: Array<{ id: string; name: string; email: string; source: 'cast' | 'crew'; reason: string }>;
  duplicateCount: number;
}

export interface CallSheetRevisionSnapshot {
  schemaVersion: 1;
  general: Record<string, unknown>;
  locations: CallSheetLocation[];
  scenes: CallSheetScene[];
  cast: CallSheetCastMember[];
  crew: CallSheetCrewMember[];
  instructions: { specialInstructions: string; notes: string; emergencyContacts: EmergencyContact[]; weatherForecast: CallSheetData['weatherForecast'] | null };
  recipientEmails: string[];
}

interface CallSheetDeliveryEvent {
  id: string;
  type: 'published' | 'delivery_completed' | 'reminded' | 'acknowledged' | 'retracted' | string;
  actorUserId?: string | null;
  recipientId?: string | null;
  details?: Record<string, unknown>;
  createdAt: string;
}

interface CallSheetDelivery {
  id: string;
  revision: number;
  subject: string;
  status: 'published' | 'superseded' | 'retracted';
  supersedesDeliveryId?: string | null;
  snapshot?: CallSheetRevisionSnapshot | null;
  retractedAt?: string | null;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  acknowledged: number;
  recipients: Array<{ id: string; email: string; deliveryStatus: string; acknowledgedAt?: string | null }>;
  events: CallSheetDeliveryEvent[];
}

const cleanRevisionValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null)) as T;

export function buildCallSheetRevisionSnapshot(
  callSheet: CallSheetData,
  recipientEmails: string[],
): CallSheetRevisionSnapshot {
  return cleanRevisionValue({
    schemaVersion: 1,
    general: {
      projectName: callSheet.projectName,
      productionCompany: callSheet.productionCompany,
      date: callSheet.date,
      dayNumber: callSheet.dayNumber,
      totalDays: callSheet.totalDays,
      director: callSheet.director,
      producer: callSheet.producer,
      callTime: callSheet.callTime,
      shootingCallTime: callSheet.shootingCallTime,
      lunchTime: callSheet.lunchTime,
      estimatedWrap: callSheet.estimatedWrap,
    },
    locations: callSheet.locations || [],
    scenes: callSheet.scenes || [],
    cast: callSheet.cast || [],
    crew: callSheet.crew || [],
    instructions: {
      specialInstructions: callSheet.specialInstructions || '',
      notes: callSheet.notes || '',
      emergencyContacts: callSheet.emergencyContacts || [],
      weatherForecast: callSheet.weatherForecast || null,
    },
    recipientEmails: [...new Set(recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))].sort(),
  });
}

export function describeCallSheetRevisionChanges(
  previous: CallSheetRevisionSnapshot | null | undefined,
  current: CallSheetRevisionSnapshot,
): { labels: string[]; contentChanged: boolean; recipientsChanged: boolean } {
  if (!previous || previous.schemaVersion !== 1) {
    return { labels: ['Første publisering'], contentChanged: true, recipientsChanged: true };
  }
  const labels: string[] = [];
  const changed = (key: keyof CallSheetRevisionSnapshot) => JSON.stringify(previous[key]) !== JSON.stringify(current[key]);
  if (changed('general')) labels.push('Dato og tider');
  if (changed('locations')) labels.push('Lokasjoner');
  if (changed('scenes')) labels.push('Scener');
  if (changed('cast')) labels.push('Cast og individuelle tider');
  if (changed('crew')) labels.push('Crew');
  if (changed('instructions')) labels.push('Instruksjoner og nødinformasjon');
  const recipientsChanged = changed('recipientEmails');
  if (recipientsChanged) labels.push('Mottakerliste');
  return { labels, contentChanged: labels.some((label) => label !== 'Mottakerliste'), recipientsChanged };
}

export function selectAffectedCallSheetRecipients(
  currentEmails: string[],
  previousDelivery: Pick<CallSheetDelivery, 'recipients'> | null | undefined,
  changes: { contentChanged: boolean },
): string[] {
  const current = [...new Set(currentEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (!previousDelivery || changes.contentChanged) return current;
  const previousEmails = new Set(previousDelivery.recipients.map((recipient) => recipient.email.trim().toLowerCase()));
  const failedEmails = new Set(previousDelivery.recipients
    .filter((recipient) => recipient.deliveryStatus === 'failed')
    .map((recipient) => recipient.email.trim().toLowerCase()));
  return current.filter((email) => !previousEmails.has(email) || failedEmails.has(email));
}

function callSheetActivityLabel(delivery: CallSheetDelivery, event: CallSheetDeliveryEvent): string {
  const details = event.details || {};
  if (event.type === 'published') return `Revisjon ${delivery.revision} publisert`;
  if (event.type === 'delivery_completed') return `Utsending fullført: ${Number(details.sent || 0)}/${Number(details.total || 0)} sendt`;
  if (event.type === 'reminded') return `${Number(details.reminded || 0)} påminnelse${Number(details.reminded || 0) === 1 ? '' : 'r'} sendt`;
  if (event.type === 'acknowledged') {
    const recipient = delivery.recipients.find((item) => item.id === event.recipientId);
    return recipient ? `${recipient.email} bekreftet mottak` : 'Mottak bekreftet';
  }
  if (event.type === 'retracted') return `Revisjon ${delivery.revision} trukket tilbake`;
  return event.type;
}

export function buildCallSheetRecipientPreview(
  crew: CallSheetCrewMember[],
  cast: CallSheetCastMember[],
): CallSheetRecipientPreview {
  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const valid: CallSheetRecipientPreviewItem[] = [];
  const invalid: CallSheetRecipientPreview['invalid'] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const { member, source } of [
    ...crew.map((member) => ({ member, source: 'crew' as const })),
    ...cast.map((member) => ({ member, source: 'cast' as const })),
  ]) {
    const email = typeof member.email === 'string' ? member.email.trim().toLowerCase() : '';
    if (!email || !emailRe.test(email)) {
      invalid.push({
        id: `${source}:${member.id}`,
        name: member.name || 'Uten navn',
        email,
        source,
        reason: email ? 'Ugyldig e-postadresse' : 'Mangler e-postadresse',
      });
      continue;
    }
    if (seen.has(email)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(email);
    valid.push({ id: `${source}:${member.id}`, name: member.name || email, email, source });
  }
  return { valid, invalid, duplicateCount };
}

// ============================================
// 7-TIER RESPONSIVE BREAKPOINT HOOK
// ============================================

type ResponsiveTier = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '4k';

interface ResponsiveConfig {
  tier: ResponsiveTier;
  spacing: number;
  fontSize: {
    title: string;
    subtitle: string;
    sectionTitle: string;
    body: string;
    caption: string;
    tiny: string;
  };
  iconSize: number;
  cardPadding: { x: number; y: number };
  gridColumns: { meta: number; crew: number; emergency: number };
  tableSize: 'small' | 'medium';
  showFullLabels: boolean;
  compactMode: boolean;
}

const useResponsiveConfig = (): ResponsiveConfig => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isMd = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isLg = useMediaQuery(theme.breakpoints.between('lg', 'xl'));
  const isXl = useMediaQuery(theme.breakpoints.between('xl', 1920));
  const isXxl = useMediaQuery('(min-width: 1920px) and (max-width: 2559px)');
  const is4k = useMediaQuery('(min-width: 2560px)');

  return useMemo(() => {
    if (isXs) return {
      tier: 'xs',
      spacing: 0.5,
      fontSize: { title: '1.25rem', subtitle: '0.8rem', sectionTitle: '0.7rem', body: '0.7rem', caption: '0.6rem', tiny: '0.55rem' },
      iconSize: 14,
      cardPadding: { x: 1, y: 0.5 },
      gridColumns: { meta: 6, crew: 12, emergency: 12 },
      tableSize: 'small',
      showFullLabels: false,
      compactMode: true,
    };
    if (isSm) return {
      tier: 'sm',
      spacing: 0.75,
      fontSize: { title: '1.5rem', subtitle: '0.85rem', sectionTitle: '0.75rem', body: '0.75rem', caption: '0.65rem', tiny: '0.6rem' },
      iconSize: 16,
      cardPadding: { x: 1.5, y: 0.75 },
      gridColumns: { meta: 6, crew: 6, emergency: 6 },
      tableSize: 'small',
      showFullLabels: false,
      compactMode: true,
    };
    if (isMd) return {
      tier: 'md',
      spacing: 1,
      fontSize: { title: '1.75rem', subtitle: '0.9rem', sectionTitle: '0.8rem', body: '0.8rem', caption: '0.7rem', tiny: '0.65rem' },
      iconSize: 18,
      cardPadding: { x: 1.5, y: 1 },
      gridColumns: { meta: 3, crew: 4, emergency: 4 },
      tableSize: 'small',
      showFullLabels: true,
      compactMode: false,
    };
    if (isLg) return {
      tier: 'lg',
      spacing: 1.5,
      fontSize: { title: '2rem', subtitle: '1rem', sectionTitle: '0.85rem', body: '0.85rem', caption: '0.75rem', tiny: '0.7rem' },
      iconSize: 20,
      cardPadding: { x: 2, y: 1 },
      gridColumns: { meta: 3, crew: 4, emergency: 4 },
      tableSize: 'medium',
      showFullLabels: true,
      compactMode: false,
    };
    if (isXl) return {
      tier: 'xl',
      spacing: 2,
      fontSize: { title: '2.25rem', subtitle: '1.1rem', sectionTitle: '0.9rem', body: '0.9rem', caption: '0.8rem', tiny: '0.75rem' },
      iconSize: 22,
      cardPadding: { x: 2, y: 1.25 },
      gridColumns: { meta: 3, crew: 3, emergency: 3 },
      tableSize: 'medium',
      showFullLabels: true,
      compactMode: false,
    };
    if (isXxl) return {
      tier: 'xxl',
      spacing: 2.5,
      fontSize: { title: '2.5rem', subtitle: '1.2rem', sectionTitle: '1rem', body: '1rem', caption: '0.9rem', tiny: '0.8rem' },
      iconSize: 24,
      cardPadding: { x: 2.5, y: 1.5 },
      gridColumns: { meta: 3, crew: 2, emergency: 3 },
      tableSize: 'medium',
      showFullLabels: true,
      compactMode: false,
    };
    // 4K
    return {
      tier: '4k',
      spacing: 3,
      fontSize: { title: '3rem', subtitle: '1.4rem', sectionTitle: '1.1rem', body: '1.1rem', caption: '1rem', tiny: '0.9rem' },
      iconSize: 28,
      cardPadding: { x: 3, y: 2 },
      gridColumns: { meta: 3, crew: 2, emergency: 3 },
      tableSize: 'medium',
      showFullLabels: true,
      compactMode: false,
    };
  }, [isXs, isSm, isMd, isLg, isXl, isXxl, is4k]);
};

// ============================================
// WCAG 2.2+ COMPLIANT COLOR SYSTEM
// ============================================

const COLORS = {
  // Primary backgrounds
  headerBg: '#0a0a0a', // Pure dark for header
  sectionHeaderBg: '#1a1a2e', // Deep navy
  cardBg: '#ffffff',
  pageBg: '#f8fafc',
  
  // WCAG AA compliant text colors (minimum 4.5:1 for normal text)
  textPrimary: '#0f0f0f', // 18.3:1 on white - darker for better readability
  textSecondary: '#374151', // 7.5:1 on white - darker gray for secondary text
  textMuted: '#6b7280', // 5.0:1 on white - for truly optional info
  textOnDark: '#f8fafc', // 16.8:1 on #0a0a0a
  textOnDarkSecondary: '#d1d5db', // 11.2:1 on #1a1a2e
  
  // Section colors - all WCAG AA compliant
  location: { bg: '#0369a1', text: '#ffffff' }, // 5.3:1 - darkened from #0ea5e9
  scenes: { bg: '#6d28d9', text: '#ffffff' }, // 6.8:1 - darkened from #7c3aed
  cast: { bg: '#047857', text: '#ffffff' }, // 5.5:1 - darkened from #059669
  crew: { bg: '#4f46e5', text: '#ffffff' }, // 5.9:1 - darkened from #6366f1
  instructions: { bg: '#b45309', text: '#ffffff' }, // 5.4:1 - darkened from #d97706
  emergency: { bg: '#b91c1c', text: '#ffffff' }, // 5.7:1 - darkened from #dc2626
  weather: { bg: '#0369a1', text: '#ffffff' }, // 5.3:1
  
  // Department colors (all WCAG compliant with white text - contrast >= 4.5:1)
  departments: {
    'Regi': '#6d28d9', // 6.8:1
    'Foto': '#0369a1', // 5.3:1
    'Lyd': '#b45309', // 5.4:1
    'Lys': '#4d7c0f', // 5.1:1
    'Grip': '#047857', // 5.5:1
    'Produksjon': '#b91c1c', // 5.7:1
    'Kostyme': '#be185d', // 5.2:1
    'Sminke': '#9d174d', // 6.4:1
    'VFX': '#6d28d9', // 6.8:1
    'Art': '#0f766e', // 5.1:1
  } as Record<string, string>,
};

// ============================================
// MAIN COMPONENT
// ============================================

/**
 * Auto-fyller call-sheet-felter fra en faktisk produksjonsdag: dagens location
 * (med ekte geokodet adresse/parkering/kontakt), dagens scener (→ scene-linjer +
 * cast fra karakterene), dagens crew, dato/call/wrap og værvarsel. Ren funksjon
 * — returnerer kun feltene som faktisk kan utledes (resten beholdes av kalleren).
 */
export function buildDayCallSheetFields(
  productionDay: ProductionDay,
  sceneList: SceneBreakdown[],
  crewList: CrewMember[],
  locList: Location[],
  roleList: Role[] = [],
  candidateList: Candidate[] = [],
): Partial<CallSheetData> {
  const fields: Partial<CallSheetData> = {};
  if (productionDay.date) fields.date = productionDay.date;
  if (productionDay.callTime) fields.callTime = productionDay.callTime;
  if (productionDay.wrapTime) fields.estimatedWrap = productionDay.wrapTime;

  const loc = locList.find((l) => l.id === productionDay.locationId);
  if (loc) {
    fields.locations = [{
      id: loc.id,
      name: loc.name || 'Lokasjon',
      address: typeof loc.address === 'string' ? loc.address : '',
      parkingInfo: typeof loc.accessNotes === 'string' ? loc.accessNotes : '',
      contactPerson: loc.contactInfo?.name ?? '',
      contactPhone: loc.contactInfo?.phone ?? '',
    }];
  }

  const idSet = new Set(Array.isArray(productionDay.scenes) ? productionDay.scenes : []);
  const dayScenes = idSet.size > 0 ? sceneList.filter((s) => idSet.has(s.id)) : [];
  if (dayScenes.length > 0) {
    const normalize = (value: unknown) => typeof value === 'string'
      ? value.trim().toLocaleUpperCase('nb-NO').replace(/\s+/g, ' ')
      : '';
    const resolveRole = (reference: unknown) => roleList.find((role) => role.id === reference)
      ?? roleList.find((role) => normalize(role.name) === normalize(reference));
    const resolveCandidate = (role: Role | undefined) => {
      if (!role) return undefined;
      const directId = typeof role.assignedCandidateId === 'string'
        ? role.assignedCandidateId
        : typeof role.assigned_candidate_id === 'string'
          ? role.assigned_candidate_id
          : undefined;
      return candidateList.find((candidate) => candidate.id === directId)
        ?? candidateList.find((candidate) => {
          const assigned = candidate.assignedRoles ?? candidate.assigned_roles ?? [];
          return (Array.isArray(assigned) && assigned.includes(role.id))
            || candidate.roleId === role.id
            || candidate.role_id === role.id;
        });
    };
    const canonicalCharacterName = (reference: unknown) => resolveRole(reference)?.name || String(reference ?? '').trim();
    fields.scenes = dayScenes.map((s) => ({
      sceneNumber: String(s.sceneNumber ?? ''),
      description: s.description || s.sceneHeading || '',
      intExt: s.intExt || '',
      dayNight: s.timeOfDay || '',
      pages: s.pageLength != null ? String(s.pageLength) : '',
      cast: Array.isArray(s.characters) ? s.characters.map(canonicalCharacterName).filter(Boolean) : [],
      location: loc?.name || s.locationName || '',
      estimatedTime: s.estimatedDuration != null ? `${s.estimatedDuration}t` : '',
    }));
    const characterMap = new Map<string, { reference: string; role?: Role }>();
    for (const reference of dayScenes.flatMap((s) => (Array.isArray(s.characters) ? s.characters : []))) {
      const ref = String(reference ?? '').trim();
      if (!ref) continue;
      const role = resolveRole(ref);
      const key = role?.id || normalize(ref);
      if (!characterMap.has(key)) characterMap.set(key, { reference: ref, role });
    }
    if (characterMap.size > 0) {
      fields.cast = [...characterMap.entries()].map(([characterKey, { reference, role }], i) => {
        const roleName = role?.name || reference;
        const candidate = resolveCandidate(role);
        const movement = productionDay.secondAd?.entries.find((entry) => (
          Boolean(candidate?.id && entry.personId === candidate.id)
          || entry.id === `cast:${candidate?.id ?? role?.id ?? normalize(reference)}`
          || normalize(entry.roleName) === normalize(roleName)
          || normalize(entry.roleName) === normalize(reference)
        ));
        return {
          id: candidate?.id || movement?.personId || `cast-${i}`,
          name: candidate?.name || movement?.name || roleName,
          role: roleName,
          pickupTime: movement?.pickupTime,
          callTime: movement?.callTime || productionDay.callTime || '',
          makeupTime: movement?.makeupTime,
          wardrobeTime: movement?.wardrobeTime,
          onSetTime: movement?.onSetTime || productionDay.callTime || '',
          transport: movement?.transport,
          movementStatus: movement?.status,
          scenes: dayScenes.filter((scene) => (
            Array.isArray(scene.characters)
            && scene.characters.some((sceneCharacter) => {
              const sceneRole = resolveRole(sceneCharacter);
              return (sceneRole?.id || normalize(sceneCharacter)) === characterKey;
            })
          )).map((scene) => String(scene.sceneNumber ?? '')),
          notes: movement?.notes,
          email: candidate?.contactInfo?.email || candidate?.contact_info?.email || candidate?.email,
        };
      });
    }
  }

  const dayCrewIds = new Set(Array.isArray(productionDay.crew) ? productionDay.crew : []);
  const dayCrew = dayCrewIds.size > 0 ? crewList.filter((c) => dayCrewIds.has(c.id)) : crewList;
  if (dayCrew.length > 0) {
    fields.crew = dayCrew.map((c) => ({
      id: c.id,
      name: c.name,
      department: c.department ? String(c.department) : 'Crew',
      position: c.role ? String(c.role) : '',
      callTime: productionDay.callTime || '',
      phone: c.contactInfo?.phone || c.contact_info?.phone || c.phone,
      email: c.contactInfo?.email || c.contact_info?.email || c.email,
    }));
  }

  const wf = productionDay.weatherForecast?.forecast?.[0];
  if (wf) {
    fields.weatherForecast = {
      temperature: typeof wf.temperature === 'number' ? wf.temperature : 0,
      conditions: wf.symbol || 'Se værvarsel',
      sunrise: '',
      sunset: '',
    };
  }
  return fields;
}

// Kompakt, e-postvennlig HTML av call-sheeten som sendes til crew. Escaper
// dynamiske felter slik at scene-tekst/adresser ikke kan brekke markup.
function buildCallSheetEmailHtml(cs: CallSheetData): string {
  const esc = (v: string): string => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const loc = cs.locations?.[0];
  const sceneRows = (cs.scenes || [])
    .map((s) => `<tr><td style="padding:4px;border:1px solid #ddd">${esc(s.sceneNumber)}</td><td style="padding:4px;border:1px solid #ddd">${esc(s.intExt)}/${esc(s.dayNight)}</td><td style="padding:4px;border:1px solid #ddd">${esc(s.description)}</td></tr>`)
    .join('');
  const statusLabels: Record<string, string> = {
    not_called: 'Ikke innkalt', call_sent: 'Call sendt', acknowledged: 'Bekreftet', arrived: 'Ankommet',
    makeup: 'Sminke', wardrobe: 'Kostyme', ready: 'Klar', on_set: 'På sett', wrapped: 'Ferdig',
  };
  const castRows = (cs.cast || [])
    .map((member) => `<tr><td style="padding:4px;border:1px solid #ddd">${esc(member.name)}</td><td style="padding:4px;border:1px solid #ddd">${esc(member.role)}</td><td style="padding:4px;border:1px solid #ddd">${esc(member.pickupTime || '–')}</td><td style="padding:4px;border:1px solid #ddd">${esc(member.callTime || '–')}</td><td style="padding:4px;border:1px solid #ddd">${esc(member.makeupTime || '–')}</td><td style="padding:4px;border:1px solid #ddd">${esc(member.wardrobeTime || '–')}</td><td style="padding:4px;border:1px solid #ddd">${esc(member.onSetTime || '–')}</td><td style="padding:4px;border:1px solid #ddd">${esc(member.transport || '–')}</td><td style="padding:4px;border:1px solid #ddd">${esc(statusLabels[member.movementStatus || ''] || '–')}</td></tr>`)
    .join('');
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">',
    `<h2 style="margin:0 0 4px">Call Sheet · ${esc(cs.projectName)}</h2>`,
    `<p><strong>Dato:</strong> ${esc(cs.date)} &nbsp;·&nbsp; <strong>Call:</strong> ${esc(cs.callTime)} &nbsp;·&nbsp; <strong>Wrap:</strong> ${esc(cs.estimatedWrap)}</p>`,
    loc ? `<p><strong>Lokasjon:</strong> ${esc(loc.name)}, ${esc(loc.address)}${loc.parkingInfo ? `<br/><em>Parkering:</em> ${esc(loc.parkingInfo)}` : ''}${loc.contactPhone ? `<br/><em>Kontakt:</em> ${esc(loc.contactPerson)} ${esc(loc.contactPhone)}` : ''}</p>` : '',
    cs.scenes?.length ? `<h3 style="margin:12px 0 4px">Scener</h3><table style="border-collapse:collapse;font-size:13px">${sceneRows}</table>` : '',
    cs.cast?.length ? `<h3 style="margin:12px 0 4px">Cast og individuelle tider</h3><table style="border-collapse:collapse;font-size:12px"><thead><tr><th>Navn</th><th>Rolle</th><th>Pickup</th><th>Call</th><th>Sminke</th><th>Kostyme</th><th>På sett</th><th>Transport</th><th>Status</th></tr></thead><tbody>${castRows}</tbody></table>` : '',
    cs.specialInstructions ? `<h3 style="margin:12px 0 4px">Viktig</h3><p>${esc(cs.specialInstructions).replace(/\n/g, '<br/>')}</p>` : '',
    '<p style="color:#888;font-size:12px;margin-top:16px">Sendt fra The Role Room · produksjonsplan</p>',
    '</div>',
  ].join('');
}

function createEmptyCallSheet(productionDay?: ProductionDay): CallSheetData {
  return {
    id: `cs-${Date.now()}`,
    projectName: '', productionCompany: '', date: productionDay?.date || '',
    dayNumber: 1, totalDays: 0, director: '', producer: '',
    callTime: productionDay?.callTime || '', shootingCallTime: '', lunchTime: '',
    estimatedWrap: productionDay?.wrapTime || '', locations: [], scenes: [], cast: [], crew: [],
    specialInstructions: '', emergencyContacts: [], notes: '',
  };
}

export const CallSheetGenerator: FC<CallSheetGeneratorProps> = ({
  projectId,
  productionDay,
  productionDayId,
  scenes = EMPTY_SCENES,
  crew = EMPTY_CREW,
  locations = EMPTY_LOCATIONS,
  onGenerate,
  onDeliverySent,
}) => {
  const theme = useTheme();
  const responsive = useResponsiveConfig();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [editMode, setEditMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Start with demo data visible
  const [isSynced, setIsSynced] = useState(false);
  const [sendingCallSheet, setSendingCallSheet] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ severity: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [activeProductionDay, setActiveProductionDay] = useState<ProductionDay | undefined>(productionDay);
  const [sendPermission, setSendPermission] = useState<'loading' | 'manage' | 'view'>('loading');
  const [recipientPreviewOpen, setRecipientPreviewOpen] = useState(false);
  const [selectedRecipientEmails, setSelectedRecipientEmails] = useState<Set<string>>(new Set());
  const [deliveryHistory, setDeliveryHistory] = useState<CallSheetDelivery[]>([]);
  const [deliveryHistoryLoading, setDeliveryHistoryLoading] = useState(false);
  const [deliveryHistoryRefresh, setDeliveryHistoryRefresh] = useState(0);
  const [retractTarget, setRetractTarget] = useState<CallSheetDelivery | null>(null);
  const [retracting, setRetracting] = useState(false);
  
  // Data from casting service
  const [castingCandidates, setCastingCandidates] = useState<Candidate[]>([]);
  const [castingRoles, setCastingRoles] = useState<Role[]>([]);
  const [castingCrew, setCastingCrew] = useState<CrewMember[]>([]);
  const [castingLocations, setCastingLocations] = useState<Location[]>([]);

  // Tilgjengelighet fra crew-medlemmenes egne kalendere (samme delte kilde som
  // Crew Management) — så vi kan varsle om noen på dagens crew har markert seg
  // opptatt akkurat denne innspillingsdagen.
  const { availabilityByUser, emailToUser } = useProjectMemberAvailability(projectId);

  // Start tomt. Ekte prosjekt- og produksjonsdagsdata fylles inn under; en
  // call sheet må aldri arve navn, steder eller tider fra et annet prosjekt.
  const [callSheet, setCallSheet] = useState<CallSheetData>(() => createEmptyCallSheet(productionDay));
  const recipientPreview = useMemo(
    () => buildCallSheetRecipientPreview(callSheet.crew || [], callSheet.cast || []),
    [callSheet.crew, callSheet.cast],
  );
  const deliveryDayId = activeProductionDay?.id || productionDayId || '';
  const latestPublishedDelivery = useMemo(
    () => deliveryHistory.find((delivery) => delivery.status === 'published') || null,
    [deliveryHistory],
  );
  const currentRevisionSnapshot = useMemo(
    () => buildCallSheetRevisionSnapshot(callSheet, recipientPreview.valid.map((recipient) => recipient.email)),
    [callSheet, recipientPreview.valid],
  );
  const revisionChanges = useMemo(
    () => describeCallSheetRevisionChanges(latestPublishedDelivery?.snapshot, currentRevisionSnapshot),
    [latestPublishedDelivery?.snapshot, currentRevisionSnapshot],
  );
  const nextRevision = Math.max(0, ...deliveryHistory.map((delivery) => delivery.revision || 0)) + 1;
  const affectedRecipientEmails = useMemo(
    () => selectAffectedCallSheetRecipients(
      recipientPreview.valid.map((recipient) => recipient.email),
      latestPublishedDelivery,
      revisionChanges,
    ),
    [recipientPreview.valid, latestPublishedDelivery, revisionChanges],
  );
  const deliveryActivity = useMemo(
    () => deliveryHistory
      .flatMap((delivery) => (delivery.events || []).map((event) => ({ delivery, event })))
      .sort((a, b) => new Date(b.event.createdAt).getTime() - new Date(a.event.createdAt).getTime())
      .slice(0, 8),
    [deliveryHistory],
  );

  useEffect(() => {
    if (!projectId || !deliveryDayId) {
      setDeliveryHistory([]);
      return;
    }
    let cancelled = false;
    setDeliveryHistoryLoading(true);
    void fetch(`/api/role-room/projects/${encodeURIComponent(projectId)}/call-sheet-deliveries?productionDayId=${encodeURIComponent(deliveryDayId)}`, {
      headers: roleRoomAgentDefaultHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Kunne ikke laste revisjonshistorikken.');
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setDeliveryHistory(Array.isArray(data?.deliveries) ? data.deliveries : []);
      })
      .catch((error) => {
        if (!cancelled) {
          setDeliveryHistory([]);
          setSendFeedback({ severity: 'warning', text: error instanceof Error ? error.message : 'Kunne ikke laste revisjonshistorikken.' });
        }
      })
      .finally(() => { if (!cancelled) setDeliveryHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, deliveryDayId, deliveryHistoryRefresh]);

  useEffect(() => {
    if (!projectId) {
      setSendPermission('view');
      return;
    }
    let cancelled = false;
    setSendPermission('loading');
    void roleRoomProjectTabConfigService.getMyTabs(projectId)
      .then((result) => {
        if (cancelled) return;
        if (result.tabAccess) {
          setSendPermission(result.tabAccess.callsheet === 'manage' ? 'manage' : 'view');
          return;
        }
        if (result.role === 'leder') {
          setSendPermission('manage');
          return;
        }
        const access = hasRolePreset(result.role) ? presetForRole(result.role) : null;
        setSendPermission(access?.callsheet === 'manage' ? 'manage' : 'view');
      })
      .catch(() => {
        if (!cancelled) setSendPermission('view');
      });
    return () => { cancelled = true; };
  }, [projectId]);

  // Kalender-konflikt pr. crew-e-post for innspillingsdagen: slår crew-raden
  // (via e-post) opp mot medlemmets egen tilgjengelighet, og flagger dager der
  // de har markert seg 'unavailable' (opptatt) eller 'hold' (tentativ).
  const crewConflictByEmail = useMemo(() => {
    const out = new Map<string, 'unavailable' | 'hold'>();
    const day = callSheet.date;
    if (!day) return out;
    for (const member of callSheet.crew) {
      const em = (member.email || '').toLowerCase().trim();
      if (!em) continue;
      const userId = emailToUser.get(em);
      if (!userId) continue;
      const overlay = availabilityByUser.get(userId);
      const cell = overlay?.cells.find((c) => c.date === day);
      if (cell?.availability === 'unavailable') out.set(em, 'unavailable');
      else if (cell?.availability === 'hold') out.set(em, 'hold');
    }
    return out;
  }, [callSheet.date, callSheet.crew, availabilityByUser, emailToUser]);

  // Kandidat-tilgjengelighet (produsent-satt på kandidat-kortet) → flagg på cast.
  // Kandidater har ingen medlemskonto; cellene ligger inline på kandidaten. Cast
  // matches mot kandidat via navn (skuespillernavn = kandidatens navn).
  const castConflictByName = useMemo(() => {
    const out = new Map<string, 'unavailable' | 'hold'>();
    const day = callSheet.date;
    if (!day) return out;
    for (const candidate of castingCandidates) {
      const nm = (candidate.name || '').toLowerCase().trim();
      if (!nm) continue;
      const cells = candidate.availabilityCells;
      if (!Array.isArray(cells)) continue;
      const cell = cells.find((c) => c.date === day);
      if (cell?.availability === 'unavailable') out.set(nm, 'unavailable');
      else if (cell?.availability === 'hold') out.set(nm, 'hold');
    }
    return out;
  }, [callSheet.date, castingCandidates]);

  // The selected production day is the live source while the dialog is open.
  // Apply 2AD edits immediately; background hydration below only enriches the
  // sheet with project, role and candidate metadata.
  useEffect(() => {
    setCallSheet(createEmptyCallSheet(productionDay));
    setActiveProductionDay(productionDay);
    setIsSynced(false);
  }, [projectId]);

  useEffect(() => {
    if (!productionDay) return;
    const dayFields = buildDayCallSheetFields(
      productionDay,
      scenes,
      crew.length ? crew : castingCrew,
      locations.length ? locations : castingLocations,
      castingRoles,
      castingCandidates,
    );
    setActiveProductionDay(productionDay);
    setCallSheet((current) => ({ ...current, ...dayFields }));
    setIsSynced(true);
  }, [productionDay, scenes, crew, locations, castingCrew, castingLocations, castingRoles, castingCandidates]);

  // Load data from casting service (background, non-blocking)
  useEffect(() => {
    const loadCastingData = async () => {
      // Ikke blokker UI mens registrerte prosjektdata lastes.
      try {
        setIsSynced(false);
        const [project, candidates, roles, crewMembers, locs, productionDays, loadedScenes] = await Promise.all([
          castingService.getProject(projectId).catch(() => null),
          castingService.getCandidates(projectId).catch(() => []),
          castingService.getRoles(projectId).catch(() => []),
          castingService.getCrew(projectId).catch(() => []),
          castingService.getLocations(projectId).catch(() => []),
          castingService.getProductionDays(projectId).catch(() => []),
          castingService.getSceneBreakdowns(projectId).catch(() => []),
        ]);

        setCastingCandidates(candidates || []);
        setCastingRoles(roles || []);
        setCastingCrew(crewMembers || []);
        setCastingLocations(locs || []);

        // Auto-fyll call-sheeten fra den faktiske produksjonsdagen. Foretrekk
        // eksplisitte props, ellers nylig lastet prosjekt-data.
        const resolvedDay = productionDay
          ?? (productionDayId ? productionDays.find((day) => day.id === productionDayId) : undefined)
          ?? selectSecondAdProductionDay(productionDays)
          ?? undefined;
        setActiveProductionDay(resolvedDay);
        const resolvedScenes = scenes && scenes.length ? scenes : (loadedScenes || []);
        const resolvedCrew = crew && crew.length ? crew : (crewMembers || []);
        const resolvedLocs = locations && locations.length ? locations : (locs || []);
        const dayFields = resolvedDay
          ? buildDayCallSheetFields(resolvedDay, resolvedScenes, resolvedCrew, resolvedLocs, roles || [], candidates || [])
          : {};
        if (dayFields.cast) {
          dayFields.cast = dayFields.cast.map((castMember) => {
            const role = (roles || []).find((item) => item.name.trim().toLocaleUpperCase('nb-NO') === castMember.role.trim().toLocaleUpperCase('nb-NO'));
            const assignedId = typeof role?.assignedCandidateId === 'string' ? role.assignedCandidateId : undefined;
            const candidate = (candidates || []).find((item) => item.id === castMember.id)
              ?? (candidates || []).find((item) => assignedId && item.id === assignedId)
              ?? (candidates || []).find((item) => item.name.trim().toLocaleUpperCase('nb-NO') === castMember.name.trim().toLocaleUpperCase('nb-NO'));
            return { ...castMember, email: candidate?.contactInfo?.email || candidate?.contact_info?.email || candidate?.email };
          });
        }
        const director = resolvedCrew.find(c =>
          c.role?.toLowerCase().includes('regissør') || c.role?.toLowerCase().includes('director'));
        const producer = resolvedCrew.find(c =>
          c.role?.toLowerCase().includes('produsent') || c.role?.toLowerCase().includes('producer'));

        if (project || resolvedDay) {
          setCallSheet({
            ...createEmptyCallSheet(resolvedDay),
            ...dayFields,
            projectName: project?.name || '',
            director: director?.name || '',
            producer: producer?.name || '',
          });
          setIsSynced(true);
        }
      } catch (error) {
        console.error('Error loading casting data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Vis tom struktur umiddelbart og last prosjektdata i bakgrunnen.
    setIsLoading(false);
    
    if (projectId) {
      // Background load - don't await
      loadCastingData();
    }
  }, [projectId, productionDay?.id, productionDayId]);

  const openRecipientPreview = () => {
    if (sendPermission !== 'manage') {
      setSendFeedback({ severity: 'warning', text: 'Du har lesetilgang til call sheet, men kan ikke sende det.' });
      return;
    }
    const recipients = recipientPreview.valid;
    if (recipients.length === 0) {
      setSendFeedback({ severity: 'warning', text: 'Ingen cast eller crew har gyldig e-postadresse.' });
      return;
    }
    if (latestPublishedDelivery && revisionChanges.labels.length === 0 && affectedRecipientEmails.length === 0) {
      setSendFeedback({ severity: 'warning', text: `Revisjon ${latestPublishedDelivery.revision} er allerede oppdatert. Det finnes ingen endringer eller mislykkede mottakere å sende på nytt.` });
      return;
    }
    setSelectedRecipientEmails(new Set(affectedRecipientEmails));
    setRecipientPreviewOpen(true);
  };

  const handleSendToCrew = async () => {
    const recipients = recipientPreview.valid
      .filter((recipient) => selectedRecipientEmails.has(recipient.email))
      .map(({ name, email }) => ({ name, email }));
    if (recipients.length === 0) {
      setSendFeedback({ severity: 'warning', text: 'Velg minst én gyldig mottaker.' });
      return;
    }
    setSendingCallSheet(true);
    setSendFeedback(null);
    try {
      const response = await fetch('/api/role-room/call-sheets/send', {
        method: 'POST',
        // Endepunktet er session-gated (requireUserSession) — uten Bearer-token
        // ga «Send til crew» 401 og e-posten ble aldri sendt.
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({
          projectId,
          productionDayId: deliveryDayId || null,
          supersedesDeliveryId: latestPublishedDelivery?.id || null,
          subject: `Call Sheet · ${callSheet.projectName} · ${callSheet.date}`,
          html: buildCallSheetEmailHtml(callSheet),
          snapshot: currentRevisionSnapshot,
          recipients,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { sent?: number; total?: number; revision?: number; error?: string };
      if (!response.ok) throw new Error(data?.error || 'Sending feilet');
      const sent = data.sent ?? 0;
      const total = data.total ?? recipients.length;
      const publishedRevision = data.revision ?? nextRevision;
      setSendFeedback({
        severity: sent === total ? 'success' : 'warning',
        text: sent === total
          ? `Revisjon ${publishedRevision} er publisert til alle ${total} mottakere.`
          : `Revisjon ${publishedRevision} er publisert. Sendt til ${sent} av ${total}; sjekk resten i historikken.`,
      });
      if (sent > 0) onDeliverySent?.();
      setDeliveryHistoryRefresh((value) => value + 1);
      setRecipientPreviewOpen(false);
    } catch (error) {
      setSendFeedback({ severity: 'error', text: error instanceof Error ? error.message : 'Kunne ikke sende call sheet.' });
    } finally {
      setSendingCallSheet(false);
    }
  };

  const handleRetractDelivery = async () => {
    if (!retractTarget) return;
    setRetracting(true);
    setSendFeedback(null);
    try {
      const response = await fetch(`/api/role-room/call-sheet-deliveries/${encodeURIComponent(retractTarget.id)}/retract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ reason: 'Trukket tilbake fra call-sheet-generatoren' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Tilbaketrekking feilet');
      setSendFeedback({ severity: 'success', text: `Revisjon ${retractTarget.revision} er trukket tilbake. Alle ubekreftede kvitteringslenker er ugyldige.` });
      setRetractTarget(null);
      setDeliveryHistoryRefresh((value) => value + 1);
      onDeliverySent?.();
    } catch (error) {
      setSendFeedback({ severity: 'error', text: error instanceof Error ? error.message : 'Kunne ikke trekke tilbake call sheeten.' });
    } finally {
      setRetracting(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Call Sheet - ${callSheet.projectName} - Dag ${callSheet.dayNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Inter', 'Segoe UI', -apple-system, sans-serif; 
              font-size: 10px; 
              line-height: 1.4; 
              padding: 15px;
              color: #1a1a1a;
              background: #fff;
            }
            .header { 
              background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
              color: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 15px;
              text-align: center;
            }
            .header h1 { 
              font-size: 32px; 
              font-weight: 800; 
              letter-spacing: 4px;
              margin-bottom: 4px;
            }
            .header .company { font-size: 12px; color: #d1d5db; }
            .meta-grid { 
              display: grid; 
              grid-template-columns: repeat(4, 1fr); 
              gap: 8px; 
              margin-bottom: 15px; 
            }
            .meta-box { 
              border: 1px solid #e5e7eb; 
              border-radius: 6px;
              padding: 10px; 
              text-align: center;
              background: #f8fafc;
            }
            .meta-box .label { 
              font-size: 8px; 
              color: #4a4a4a; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 600;
            }
            .meta-box .value { 
              font-size: 13px; 
              font-weight: 700; 
              color: #1a1a1a;
              margin-top: 2px;
            }
            .section { margin-bottom: 12px; }
            .section-header { 
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .section-location { background: #0369a1; color: #fff; }
            .section-scenes { background: #6d28d9; color: #fff; }
            .section-cast { background: #047857; color: #fff; }
            .section-crew { background: #4f46e5; color: #fff; }
            .section-instructions { background: #b45309; color: #fff; }
            .section-emergency { background: #b91c1c; color: #fff; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 9px;
              background: #fff;
            }
            th { 
              background: #f1f5f9; 
              padding: 8px 6px; 
              text-align: left; 
              font-weight: 700;
              color: #1a1a1a;
              border-bottom: 2px solid #e5e7eb;
              text-transform: uppercase;
              font-size: 8px;
              letter-spacing: 0.3px;
            }
            td { 
              padding: 8px 6px; 
              border-bottom: 1px solid #e5e7eb;
              color: #1a1a1a;
            }
            .cast-role { font-weight: 700; color: #047857; }
            .highlight { background: #fef3c7; }
            .crew-grid { 
              display: grid; 
              grid-template-columns: repeat(4, 1fr); 
              gap: 6px; 
            }
            .crew-card {
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 8px;
              background: #fff;
            }
            .crew-dept { 
              font-size: 7px; 
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.3px;
            }
            .crew-name { font-weight: 700; font-size: 10px; margin: 2px 0; color: #1a1a1a; }
            .crew-position { font-size: 8px; color: #4a4a4a; }
            .instructions-box {
              background: #fef3c7;
              border: 2px solid #b45309;
              border-radius: 6px;
              padding: 12px;
              white-space: pre-line;
              font-size: 10px;
              line-height: 1.6;
              color: #1a1a1a;
            }
            .emergency-grid { display: flex; gap: 8px; }
            .emergency-card {
              flex: 1;
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 6px;
              padding: 10px;
              text-align: center;
            }
            .emergency-role { font-size: 8px; color: #991b1b; text-transform: uppercase; font-weight: 600; }
            .emergency-name { font-weight: 700; font-size: 11px; margin: 4px 0; color: #1a1a1a; }
            .emergency-phone { font-size: 12px; font-weight: 700; color: #b91c1c; }
            .weather-bar {
              background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
              color: #fff;
              padding: 12px 16px;
              border-radius: 6px;
              display: flex;
              justify-content: center;
              gap: 30px;
              margin-bottom: 15px;
              font-size: 11px;
            }
            .footer { 
              margin-top: 20px; 
              padding-top: 12px; 
              border-top: 2px solid #1a1a1a; 
              font-size: 9px; 
              text-align: center;
              color: #4a4a4a;
            }
            @media print { 
              body { padding: 10px; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getDepartmentColor = (dept: string): string => {
    return COLORS.departments[dept] || '#4a4a4a';
  };

  // ============================================
  // SECTION HEADER COMPONENT
  // ============================================
  
  const SectionHeader: FC<{ 
    icon: ReactNode; 
    title: string; 
    color: { bg: string; text: string };
  }> = ({ icon, title, color }) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: color.bg,
        color: color.text,
        py: responsive.cardPadding.y * 0.75,
        px: responsive.cardPadding.x,
        borderRadius: 1.5,
        mb: responsive.spacing,
      }}
    >
      {icon}
      <Typography 
        sx={{ 
          fontWeight: 700, 
          fontSize: responsive.fontSize.sectionTitle,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </Typography>
    </Box>
  );

  // ============================================
  // RENDER
  // ============================================

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Loading indicator */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2, gap: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Laster data fra Casting...
          </Typography>
        </Box>
      )}
      
      {/* Sync status */}
      {isSynced && !isLoading && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: responsive.spacing, 
            fontSize: responsive.fontSize.caption,
            '& .MuiAlert-message': { fontSize: responsive.fontSize.caption }
          }}
        >
          Synkronisert: {castingCandidates.length} skuespillere, {castingCrew.length} crew, {castingLocations.length} lokasjoner
        </Alert>
      )}
      
      {/* Toolbar */}
      <Paper 
        elevation={0}
        sx={{ 
          p: responsive.cardPadding.x, 
          mb: responsive.spacing,
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={responsive.spacing} 
          alignItems={{ xs: 'stretch', sm: 'center' }} 
          justifyContent="space-between"
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <MovieIcon sx={{ color: 'primary.main', fontSize: responsive.iconSize + 4 }} />
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                fontSize: responsive.fontSize.subtitle,
              }}
            >
              Call Sheet Generator
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'center', sm: 'flex-end' }}>
            <Button
              variant="outlined"
              size={responsive.compactMode ? 'small' : 'medium'}
              startIcon={<EditIcon sx={{ fontSize: responsive.iconSize }} />}
              onClick={() => setEditMode(!editMode)}
              disabled={sendPermission !== 'manage'}
              color={editMode ? 'secondary' : 'primary'}
              sx={{ fontSize: responsive.fontSize.caption }}
            >
              {responsive.showFullLabels ? (editMode ? 'Ferdig' : 'Rediger') : ''}
            </Button>
            <Button
              variant="outlined"
              size={responsive.compactMode ? 'small' : 'medium'}
              startIcon={<PrintIcon sx={{ fontSize: responsive.iconSize }} />}
              onClick={handlePrint}
              sx={{ fontSize: responsive.fontSize.caption }}
            >
              {responsive.showFullLabels ? 'Skriv ut' : ''}
            </Button>
            <Button
              variant="contained"
              size={responsive.compactMode ? 'small' : 'medium'}
              startIcon={<DownloadIcon sx={{ fontSize: responsive.iconSize }} />}
              onClick={handlePrint}
              sx={{ fontSize: responsive.fontSize.caption }}
            >
              {responsive.showFullLabels ? 'Eksporter PDF' : 'PDF'}
            </Button>
            <Tooltip title={sendPermission === 'manage' ? 'Kontroller mottakerne før utsending' : 'Krever administrasjonstilgang til call sheet'}>
              <span>
                <Button
                  variant="contained"
                  color="success"
                  size={responsive.compactMode ? 'small' : 'medium'}
                  startIcon={sendingCallSheet
                    ? <CircularProgress size={responsive.iconSize} color="inherit" />
                    : <EmailIcon sx={{ fontSize: responsive.iconSize }} />}
                  onClick={openRecipientPreview}
                  disabled={sendingCallSheet || sendPermission !== 'manage' || !isSynced}
                  sx={{ fontSize: responsive.fontSize.caption }}
                >
                  {responsive.showFullLabels
                    ? sendingCallSheet
                      ? 'Sender…'
                      : sendPermission === 'view'
                        ? 'Kun lesetilgang'
                        : !isSynced
                          ? 'Laster mottakere…'
                        : latestPublishedDelivery
                          ? `Kontroller revisjon ${nextRevision}`
                          : 'Kontroller mottakere'
                    : ''}
                </Button>
              </span>
            </Tooltip>
          </Stack>
          {sendFeedback && (
            <Alert
              severity={sendFeedback.severity}
              onClose={() => setSendFeedback(null)}
              sx={{ mt: 1.5 }}
            >
              {sendFeedback.text}
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper
        variant="outlined"
        data-testid="call-sheet-revision-status"
        sx={{ p: 1.5, mb: responsive.spacing, borderRadius: 2 }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography sx={{ fontWeight: 800 }}>Revisjoner</Typography>
              {deliveryHistoryLoading ? (
                <CircularProgress size={16} />
              ) : latestPublishedDelivery ? (
                <Chip size="small" color={revisionChanges.labels.length ? 'warning' : 'success'} label={revisionChanges.labels.length ? 'Upubliserte endringer' : `Publisert revisjon ${latestPublishedDelivery.revision}`} />
              ) : (
                <Chip size="small" color="warning" label="Utkast · ikke publisert" />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {revisionChanges.labels.length
                ? `Neste publisering blir revisjon ${nextRevision}: ${revisionChanges.labels.join(', ')}.`
                : 'Call sheeten samsvarer med siste publiserte revisjon.'}
            </Typography>
          </Box>
          {latestPublishedDelivery && sendPermission === 'manage' && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={() => setRetractTarget(latestPublishedDelivery)}
            >
              Trekk tilbake revisjon {latestPublishedDelivery.revision}
            </Button>
          )}
        </Stack>

        {deliveryHistory.length > 0 && (
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {deliveryHistory.slice(0, 5).map((delivery) => (
              <Box key={delivery.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>Rev. {delivery.revision}</Typography>
                <Chip
                  size="small"
                  color={delivery.status === 'published' ? 'success' : delivery.status === 'retracted' ? 'error' : 'default'}
                  label={delivery.status === 'published' ? 'Aktiv' : delivery.status === 'retracted' ? 'Trukket tilbake' : 'Erstattet'}
                />
                <Typography variant="caption" color="text.secondary">
                  {new Date(delivery.createdAt).toLocaleString('nb-NO')} · {delivery.sent}/{delivery.total} sendt · {delivery.acknowledged} bekreftet
                  {delivery.failed ? ` · ${delivery.failed} feilet` : ''}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
        {deliveryActivity.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Aktivitetslogg</Typography>
            <Stack spacing={0.5} sx={{ mt: 0.75 }}>
              {deliveryActivity.map(({ delivery, event }) => (
                <Typography key={event.id} variant="caption" color="text.secondary">
                  {new Date(event.createdAt).toLocaleString('nb-NO')} · {callSheetActivityLabel(delivery, event)}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}
      </Paper>

      <Dialog
        open={recipientPreviewOpen}
        onClose={() => !sendingCallSheet && setRecipientPreviewOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ 'data-testid': 'call-sheet-recipient-preview' }}
      >
        <DialogTitle>{latestPublishedDelivery ? `Publiser revisjon ${nextRevision}` : 'Publiser første revisjon'}</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 1.5, color: 'text.secondary' }}>
            Ingen e-post sendes før du bekrefter listen. Fjern mottakere som ikke skal ha denne revisjonen.
          </Typography>
          <Alert severity={revisionChanges.contentChanged ? 'warning' : 'info'} sx={{ mb: 1.5 }}>
            {revisionChanges.labels.length ? `Endringer: ${revisionChanges.labels.join(', ')}.` : 'Ingen innholdsendringer.'}
            {latestPublishedDelivery && revisionChanges.contentChanged
              ? ' Innholdet er endret, derfor er alle nåværende mottakere valgt.'
              : latestPublishedDelivery
                ? ' Bare nye mottakere og tidligere mislykkede utsendinger velges automatisk.'
                : ''}
          </Alert>
          {selectedRecipientEmails.size === 0 && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Ingen mottakere er automatisk berørt. Velg manuelt hvis revisjonen likevel skal sendes på nytt.
            </Alert>
          )}
          <Stack spacing={0.5}>
            {recipientPreview.valid.map((recipient) => (
              <FormControlLabel
                key={recipient.email}
                control={(
                  <Checkbox
                    checked={selectedRecipientEmails.has(recipient.email)}
                    onChange={(event) => setSelectedRecipientEmails((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(recipient.email);
                      else next.delete(recipient.email);
                      return next;
                    })}
                  />
                )}
                label={(
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{recipient.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {recipient.email} · {recipient.source === 'cast' ? 'Cast' : 'Crew'}
                    </Typography>
                  </Box>
                )}
              />
            ))}
          </Stack>
          {(recipientPreview.invalid.length > 0 || recipientPreview.duplicateCount > 0) && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {recipientPreview.invalid.length > 0
                ? `${recipientPreview.invalid.length} personer er utelatt fordi e-post mangler eller er ugyldig.`
                : ''}
              {recipientPreview.invalid.length > 0 && recipientPreview.duplicateCount > 0 ? ' ' : ''}
              {recipientPreview.duplicateCount > 0
                ? `${recipientPreview.duplicateCount} duplikate adresser er slått sammen.`
                : ''}
            </Alert>
          )}
          {recipientPreview.invalid.length > 0 && (
            <Stack spacing={0.5} sx={{ mt: 1.5 }}>
              {recipientPreview.invalid.map((recipient) => (
                <Typography key={recipient.id} variant="caption" color="text.secondary">
                  {recipient.name} · {recipient.reason}
                </Typography>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={sendingCallSheet} onClick={() => setRecipientPreviewOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            color="success"
            disabled={sendingCallSheet || selectedRecipientEmails.size === 0}
            onClick={() => void handleSendToCrew()}
          >
            {sendingCallSheet ? 'Publiserer…' : `Publiser til ${selectedRecipientEmails.size} mottakere`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(retractTarget)} onClose={() => !retracting && setRetractTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Trekk tilbake revisjon {retractTarget?.revision}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="error">
            Revisjonen markeres som trukket tilbake, og alle ubekreftede mottakslenker blir ugyldige. Historikken beholdes.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button disabled={retracting} onClick={() => setRetractTarget(null)}>Avbryt</Button>
          <Button disabled={retracting} color="error" variant="contained" onClick={() => void handleRetractDelivery()}>
            {retracting ? 'Trekker tilbake…' : 'Bekreft tilbaketrekking'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Call Sheet Preview */}
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          bgcolor: '#ffffff', 
          borderRadius: 2, 
          p: { xs: 1.5, sm: 2, md: 3 },
          border: '1px solid',
          borderColor: 'divider',
        }} 
        ref={printRef}
      >
        {/* Edit Mode Banner */}
        {editMode && (
          <Alert 
            severity="info" 
            sx={{ 
              mb: 2, 
              bgcolor: alpha('#3b82f6', 0.15),
              '& .MuiAlert-message': { fontSize: responsive.fontSize.caption }
            }}
          >
            Redigeringsmodus aktiv - Klikk på felt for å redigere. Trykk "Ferdig" når du er ferdig.
          </Alert>
        )}

        {/* Header */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${COLORS.headerBg} 0%, ${COLORS.sectionHeaderBg} 100%)`,
            color: COLORS.textOnDark,
            p: { xs: 2, sm: 3, md: 4 },
            borderRadius: 2,
            mb: responsive.spacing * 2,
            textAlign: 'center',
          }}
        >
          {editMode ? (
            <>
              <TextField
                value={callSheet.projectName}
                onChange={(e) => setCallSheet(prev => ({ ...prev, projectName: e.target.value }))}
                variant="standard"
                inputProps={{
                  style: {
                    fontSize: responsive.fontSize.title,
                    fontWeight: 800,
                    letterSpacing: '4px',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    color: COLORS.textOnDark,
                  }
                }}
                sx={{
                  '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.3)' },
                  '& .MuiInput-underline:after': { borderBottomColor: '#3b82f6' },
                  '& .MuiInput-underline:hover:before': { borderBottomColor: 'rgba(255,255,255,0.5)' },
                  width: '100%',
                  maxWidth: 400,
                  mb: 0.5,
                }}
              />
              <TextField
                value={callSheet.productionCompany}
                onChange={(e) => setCallSheet(prev => ({ ...prev, productionCompany: e.target.value }))}
                variant="standard"
                inputProps={{
                  style: {
                    fontSize: responsive.fontSize.caption,
                    letterSpacing: '1px',
                    textAlign: 'center',
                    color: COLORS.textOnDarkSecondary,
                  }
                }}
                sx={{
                  '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.2)' },
                  '& .MuiInput-underline:after': { borderBottomColor: '#3b82f6' },
                  '& .MuiInput-underline:hover:before': { borderBottomColor: 'rgba(255,255,255,0.4)' },
                  width: '100%',
                  maxWidth: 300,
                }}
              />
            </>
          ) : (
            <>
              <Typography
                sx={{
                  fontSize: responsive.fontSize.title,
                  fontWeight: 800,
                  letterSpacing: '4px',
                  textTransform: 'uppercase',
                  mb: 0.5,
                }}
              >
                {callSheet.projectName}
              </Typography>
              <Typography
                sx={{
                  fontSize: responsive.fontSize.caption,
                  color: COLORS.textOnDarkSecondary,
                  letterSpacing: '1px',
                }}
              >
                {callSheet.productionCompany}
              </Typography>
            </>
          )}
        </Box>

        {/* Meta Info Grid */}
        <Grid container spacing={responsive.spacing} sx={{ mb: responsive.spacing * 2 }}>
          {[
            { label: 'DATO', key: 'date', value: new Date(callSheet.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), editValue: callSheet.date, type: 'date' },
            { label: 'DAG', key: 'dayNumber', value: `${callSheet.dayNumber} / ${callSheet.totalDays}`, editValue: callSheet.dayNumber, type: 'number' },
            { label: 'CREW CALL', key: 'callTime', value: callSheet.callTime, editValue: callSheet.callTime, type: 'time' },
            { label: 'SHOOTING CALL', key: 'shootingCallTime', value: callSheet.shootingCallTime, editValue: callSheet.shootingCallTime, type: 'time' },
            { label: 'LUNSJ', key: 'lunchTime', value: callSheet.lunchTime, editValue: callSheet.lunchTime, type: 'time' },
            { label: 'EST. WRAP', key: 'estimatedWrap', value: callSheet.estimatedWrap, editValue: callSheet.estimatedWrap, type: 'time' },
            { label: 'REGISSØR', key: 'director', value: callSheet.director, editValue: callSheet.director, type: 'text' },
            { label: 'PRODUSENT', key: 'producer', value: callSheet.producer, editValue: callSheet.producer, type: 'text' },
          ].map((item, i) => (
            <Grid key={i} size={{ xs: responsive.gridColumns.meta }}>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: responsive.cardPadding.y,
                  textAlign: 'center',
                  bgcolor: editMode ? '#ffffff' : COLORS.pageBg,
                  borderRadius: 1.5,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  borderColor: editMode ? '#3b82f6' : 'divider',
                  borderWidth: editMode ? 2 : 1,
                }}
              >
                <Typography 
                  sx={{ 
                    color: COLORS.textSecondary, 
                    fontSize: responsive.fontSize.tiny,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                    mb: 0.25,
                  }}
                >
                  {item.label}
                </Typography>
                {editMode ? (
                  <TextField
                    value={item.editValue}
                    onChange={(e) => {
                      const val = item.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
                      setCallSheet(prev => ({ ...prev, [item.key]: val }));
                    }}
                    type={item.type === 'number' ? 'number' : item.type === 'date' ? 'date' : item.type === 'time' ? 'time' : 'text'}
                    variant="standard"
                    size="small"
                    inputProps={{
                      style: {
                        fontWeight: 700,
                        color: COLORS.textPrimary,
                        fontSize: responsive.fontSize.body,
                        textAlign: 'center',
                      }
                    }}
                    sx={{
                      '& .MuiInput-underline:before': { borderBottomColor: 'rgba(0,0,0,0.2)' },
                      '& .MuiInput-underline:after': { borderBottomColor: '#3b82f6' },
                      width: '100%',
                    }}
                  />
                ) : (
                  <Typography 
                    sx={{ 
                      fontWeight: 700, 
                      color: COLORS.textPrimary,
                      fontSize: responsive.fontSize.body,
                    }}
                  >
                    {item.value}
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Weather */}
        {callSheet.weatherForecast && (
          <Paper
            sx={{
              background: `linear-gradient(135deg, ${COLORS.weather.bg} 0%, #0284c7 100%)`,
              color: COLORS.weather.text,
              p: responsive.cardPadding.y * 1.5,
              mb: responsive.spacing * 2,
              borderRadius: 1.5,
            }}
          >
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={{ xs: 1, sm: 4 }} 
              alignItems="center" 
              justifyContent="center"
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <SunnyIcon sx={{ fontSize: responsive.iconSize }} />
                <Typography sx={{ fontSize: responsive.fontSize.body, fontWeight: 700 }}>
                  {callSheet.weatherForecast.temperature}°C
                </Typography>
                <Typography sx={{ fontSize: responsive.fontSize.body }}>
                  {callSheet.weatherForecast.conditions}
                </Typography>
              </Stack>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)', display: { xs: 'none', sm: 'block' } }} />
              <Stack direction="row" spacing={3}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <SunnyIcon sx={{ fontSize: responsive.iconSize - 2 }} />
                  <Typography sx={{ fontSize: responsive.fontSize.caption }}>
                    {callSheet.weatherForecast.sunrise}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <MoonIcon sx={{ fontSize: responsive.iconSize - 2 }} />
                  <Typography sx={{ fontSize: responsive.fontSize.caption }}>
                    {callSheet.weatherForecast.sunset}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        )}

        {/* Location Section */}
        <Box sx={{ mb: responsive.spacing * 2 }}>
          <SectionHeader 
            icon={<PlaceIcon sx={{ fontSize: responsive.iconSize }} />}
            title="Lokasjon"
            color={COLORS.location}
          />
          <Grid container spacing={responsive.spacing}>
            {callSheet.locations.map((loc) => (
              <Grid key={loc.id} size={{ xs: 12 }}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: responsive.cardPadding.x,
                    borderLeft: `4px solid ${COLORS.location.bg}`,
                    borderRadius: 1.5,
                    bgcolor: '#ffffff',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        sx={{ 
                          color: '#ffffff',
                          bgcolor: COLORS.location.bg,
                          fontSize: responsive.fontSize.tiny,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          letterSpacing: '0.3px',
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.5,
                          display: 'inline-block',
                          mb: 0.5,
                        }}
                      >
                        {loc.name}
                      </Typography>
                      <Typography 
                        sx={{ 
                          fontWeight: 600, 
                          fontSize: responsive.fontSize.body,
                          color: COLORS.textPrimary,
                          my: 0.5,
                        }}
                      >
                        {loc.address}
                      </Typography>
                      <Typography 
                        sx={{ 
                          color: COLORS.textPrimary,
                          fontSize: responsive.fontSize.caption,
                          fontWeight: 500,
                        }}
                      >
                        <ParkingIcon sx={{ fontSize: responsive.iconSize - 2, verticalAlign: 'middle', mr: 0.5 }} />
                        {loc.parkingInfo}
                      </Typography>
                    </Box>
                    <Paper 
                      elevation={0}
                      sx={{ 
                        bgcolor: alpha(COLORS.location.bg, 0.08),
                        p: 1.5,
                        borderRadius: 1,
                        minWidth: { xs: '100%', md: 200 },
                      }}
                    >
                      <Typography 
                        sx={{ 
                          color: COLORS.textPrimary,
                          fontSize: responsive.fontSize.tiny,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          mb: 0.5,
                        }}
                      >
                        Kontaktperson
                      </Typography>
                      <Typography 
                        sx={{ 
                          fontWeight: 600, 
                          fontSize: responsive.fontSize.caption,
                          color: COLORS.textPrimary,
                        }}
                      >
                        {loc.contactPerson}
                      </Typography>
                      <Typography 
                        sx={{ 
                          fontWeight: 700, 
                          fontSize: responsive.fontSize.body,
                          color: COLORS.location.bg,
                          mt: 0.25,
                        }}
                      >
                        {loc.contactPhone}
                      </Typography>
                    </Paper>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Scenes Section */}
        <Box sx={{ mb: responsive.spacing * 2 }}>
          <SectionHeader 
            icon={<TheatersIcon sx={{ fontSize: responsive.iconSize }} />}
            title="Scener"
            color={COLORS.scenes}
          />
          <Grid container spacing={responsive.spacing * 0.75}>
            {callSheet.scenes.map((scene) => (
              <Grid key={scene.sceneNumber} size={{ xs: 12, md: 6, lg: 4 }}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: responsive.cardPadding.x,
                    borderLeft: `4px solid ${COLORS.scenes.bg}`,
                    borderRadius: 1.5,
                    bgcolor: '#ffffff',
                    height: '100%',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography 
                      sx={{ 
                        color: '#ffffff',
                        bgcolor: COLORS.scenes.bg,
                        fontSize: responsive.fontSize.body,
                        fontWeight: 700,
                        px: 1,
                        py: 0.25,
                        borderRadius: 0.5,
                        minWidth: 32,
                        textAlign: 'center',
                      }}
                    >
                      {scene.sceneNumber}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      <Chip 
                        label={scene.intExt} 
                        size="small" 
                        sx={{ 
                          height: 22, 
                          fontSize: responsive.fontSize.tiny,
                          bgcolor: scene.intExt === 'EXT' ? COLORS.location.bg : '#374151',
                          color: '#ffffff',
                          fontWeight: 700,
                        }} 
                      />
                      <Chip 
                        label={scene.dayNight} 
                        size="small" 
                        sx={{ 
                          height: 22, 
                          fontSize: responsive.fontSize.tiny,
                          bgcolor: scene.dayNight === 'DAY' ? '#d97706' : '#4f46e5',
                          color: '#ffffff',
                          fontWeight: 700,
                        }} 
                      />
                    </Stack>
                  </Stack>
                  <Typography 
                    sx={{ 
                      fontWeight: 600, 
                      fontSize: responsive.fontSize.caption,
                      color: COLORS.textPrimary,
                      mb: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {scene.description}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box>
                      <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                        Cast
                      </Typography>
                      <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 500 }}>
                        {scene.cast.join(', ')}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                      <Box>
                        <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                          Sider
                        </Typography>
                        <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                          {scene.pages}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                          Estimert
                        </Typography>
                        <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                          {scene.estimatedTime}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Cast Section */}
        <Box sx={{ mb: responsive.spacing * 2 }}>
          <SectionHeader 
            icon={<PersonIcon sx={{ fontSize: responsive.iconSize }} />}
            title="Cast"
            color={COLORS.cast}
          />
          <Grid container spacing={responsive.spacing * 0.75}>
            {callSheet.cast.map((member) => (
              <Grid key={member.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: responsive.cardPadding.x,
                    borderLeft: `4px solid ${COLORS.cast.bg}`,
                    borderRadius: 1.5,
                    bgcolor: '#ffffff',
                    height: '100%',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box>
                      <Typography 
                        sx={{ 
                          color: '#ffffff',
                          bgcolor: COLORS.cast.bg,
                          fontSize: responsive.fontSize.tiny,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.5,
                          display: 'inline-block',
                        }}
                      >
                        {member.role}
                      </Typography>
                      <Typography 
                        sx={{ 
                          fontWeight: 700, 
                          fontSize: responsive.fontSize.body,
                          color: COLORS.textPrimary,
                          mt: 0.5,
                        }}
                      >
                        {member.name}
                      </Typography>
                      {(() => {
                        const conflict = castConflictByName.get((member.name || '').toLowerCase().trim());
                        if (!conflict) return null;
                        const isBusy = conflict === 'unavailable';
                        return (
                          <Tooltip
                            title={isBusy
                              ? 'Produsent har markert kandidaten som opptatt denne dagen'
                              : 'Produsent har markert kandidaten som tentativ denne dagen'}
                            arrow
                          >
                            <Chip
                              size="small"
                              icon={<WarningIcon sx={{ fontSize: 12 }} />}
                              label={isBusy ? 'Opptatt denne dagen' : 'Tentativ denne dagen'}
                              sx={{
                                mt: 0.5,
                                height: 18,
                                fontSize: responsive.fontSize.tiny,
                                fontWeight: 700,
                                color: isBusy ? '#b91c1c' : '#b45309',
                                bgcolor: isBusy ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.14)',
                                border: `1px solid ${isBusy ? '#ef4444' : '#f59e0b'}`,
                                '& .MuiChip-icon': { color: isBusy ? '#b91c1c' : '#b45309' },
                              }}
                            />
                          </Tooltip>
                        );
                      })()}
                    </Box>
                    <Chip
                      label={`Sc. ${member.scenes.join(', ')}`}
                      size="small"
                      sx={{ 
                        bgcolor: alpha(COLORS.scenes.bg, 0.15),
                        color: COLORS.scenes.bg,
                        fontWeight: 600,
                        fontSize: responsive.fontSize.tiny,
                      }}
                    />
                  </Stack>
                  <Divider sx={{ my: 1 }} />
                  <Grid container spacing={1}>
                    {member.pickupTime && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                          Pickup
                        </Typography>
                        <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                          {member.pickupTime}
                        </Typography>
                      </Grid>
                    )}
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                        Call
                      </Typography>
                      <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                        {member.callTime}
                      </Typography>
                    </Grid>
                    {member.makeupTime && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                          Sminke
                        </Typography>
                        <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                          {member.makeupTime}
                        </Typography>
                      </Grid>
                    )}
                    {member.wardrobeTime && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                          Kostyme
                        </Typography>
                        <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                          {member.wardrobeTime}
                        </Typography>
                      </Grid>
                    )}
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                        On Set
                      </Typography>
                      <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                        {member.onSetTime}
                      </Typography>
                    </Grid>
                    {member.transport && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                          Transport
                        </Typography>
                        <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                          {member.transport}
                        </Typography>
                      </Grid>
                    )}
                    {member.movementStatus && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                          Dagsstatus
                        </Typography>
                        <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                          {SECOND_AD_STATUS_LABELS[member.movementStatus] || member.movementStatus}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                  {member.notes && (
                    <Paper 
                      elevation={0}
                      sx={{ 
                        bgcolor: alpha(COLORS.instructions.bg, 0.1),
                        p: 1,
                        borderRadius: 1,
                        mt: 1,
                      }}
                    >
                      <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 500 }}>
                        <WarningIcon sx={{ fontSize: responsive.iconSize - 4, verticalAlign: 'middle', mr: 0.5, color: COLORS.instructions.bg }} />
                        {member.notes}
                      </Typography>
                    </Paper>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Crew Section */}
        <Box sx={{ mb: responsive.spacing * 2 }}>
          <SectionHeader 
            icon={<GroupsIcon sx={{ fontSize: responsive.iconSize }} />}
            title="Crew"
            color={COLORS.crew}
          />
          <Grid container spacing={responsive.spacing * 0.5}>
            {callSheet.crew.map((member) => (
              <Grid key={member.id} size={{ xs: responsive.gridColumns.crew }}>
                <Paper 
                  variant="outlined" 
                  sx={{ 
                    p: responsive.cardPadding.y,
                    borderLeft: `4px solid ${getDepartmentColor(member.department)}`,
                    borderRadius: 1.5,
                    height: '100%',
                    bgcolor: '#ffffff',
                  }}
                >
                  <Typography 
                    sx={{ 
                      color: '#ffffff',
                      bgcolor: getDepartmentColor(member.department),
                      fontSize: responsive.fontSize.tiny,
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.3px',
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.5,
                      display: 'inline-block',
                    }}
                  >
                    {member.department}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontWeight: 700, 
                      fontSize: responsive.fontSize.caption,
                      color: COLORS.textPrimary,
                      my: 0.5,
                    }}
                  >
                    {member.name}
                  </Typography>
                  <Typography 
                    sx={{ 
                      color: COLORS.textPrimary,
                      fontSize: responsive.fontSize.tiny,
                      fontWeight: 500,
                    }}
                  >
                    {member.position}
                  </Typography>
                  <Typography 
                    sx={{ 
                      color: COLORS.textPrimary,
                      fontSize: responsive.fontSize.caption,
                      fontWeight: 600,
                      mt: 0.25,
                    }}
                  >
                    Call: {member.callTime}
                  </Typography>
                  {(() => {
                    const conflict = member.email
                      ? crewConflictByEmail.get(member.email.toLowerCase().trim())
                      : undefined;
                    if (!conflict) return null;
                    const isBusy = conflict === 'unavailable';
                    return (
                      <Tooltip
                        title={isBusy
                          ? 'Medlemmet har markert seg opptatt denne dagen i sin egen kalender'
                          : 'Medlemmet har markert dagen som tentativ i sin egen kalender'}
                        arrow
                      >
                        <Chip
                          size="small"
                          icon={<WarningIcon sx={{ fontSize: 12 }} />}
                          label={isBusy ? 'Opptatt denne dagen' : 'Tentativ denne dagen'}
                          sx={{
                            mt: 0.5,
                            height: 18,
                            fontSize: responsive.fontSize.tiny,
                            fontWeight: 700,
                            color: isBusy ? '#b91c1c' : '#b45309',
                            bgcolor: isBusy ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.14)',
                            border: `1px solid ${isBusy ? '#ef4444' : '#f59e0b'}`,
                            '& .MuiChip-icon': { color: isBusy ? '#b91c1c' : '#b45309' },
                          }}
                        />
                      </Tooltip>
                    );
                  })()}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Special Instructions */}
        {callSheet.specialInstructions && (
          <Box sx={{ mb: responsive.spacing * 2 }}>
            <SectionHeader 
              icon={<WarningIcon sx={{ fontSize: responsive.iconSize }} />}
              title="Spesielle Instruksjoner"
              color={COLORS.instructions}
            />
            <Paper 
              variant="outlined" 
              sx={{ 
                p: responsive.cardPadding.x,
                bgcolor: alpha(COLORS.instructions.bg, 0.08),
                borderColor: COLORS.instructions.bg,
                borderWidth: 2,
                borderRadius: 1.5,
                whiteSpace: 'pre-line',
              }}
            >
              <Typography 
                sx={{ 
                  color: COLORS.textPrimary,
                  fontSize: responsive.fontSize.caption,
                  lineHeight: 1.7,
                }}
              >
                {callSheet.specialInstructions}
              </Typography>
            </Paper>
          </Box>
        )}

        {/* Emergency Contacts */}
        <Box sx={{ mb: responsive.spacing * 2 }}>
          <SectionHeader 
            icon={<EmergencyIcon sx={{ fontSize: responsive.iconSize }} />}
            title="Nødkontakter"
            color={COLORS.emergency}
          />
          <Grid container spacing={responsive.spacing}>
            {callSheet.emergencyContacts.map((contact, i) => (
              <Grid key={i} size={{ xs: responsive.gridColumns.emergency }}>
                <Paper 
                  variant="outlined"
                  sx={{ 
                    p: responsive.cardPadding.y * 1.5,
                    textAlign: 'center',
                    bgcolor: alpha(COLORS.emergency.bg, 0.05),
                    borderColor: alpha(COLORS.emergency.bg, 0.3),
                    borderRadius: 1.5,
                  }}
                >
                  <Typography 
                    sx={{ 
                      color: COLORS.emergency.bg, 
                      fontSize: responsive.fontSize.tiny,
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}
                  >
                    {contact.role}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontWeight: 700, 
                      color: COLORS.textPrimary,
                      fontSize: responsive.fontSize.caption,
                      my: 0.5,
                    }}
                  >
                    {contact.name}
                  </Typography>
                  <Typography 
                    sx={{ 
                      fontWeight: 700,
                      color: COLORS.emergency.bg,
                      fontSize: responsive.fontSize.body,
                    }}
                  >
                    {contact.phone}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Footer */}
        <Box 
          sx={{ 
            mt: responsive.spacing * 2, 
            pt: responsive.spacing, 
            borderTop: `2px solid ${COLORS.textPrimary}`, 
            textAlign: 'center' 
          }}
        >
          <Typography 
            sx={{ 
              color: COLORS.textSecondary,
              fontSize: responsive.fontSize.tiny,
            }}
          >
            Generert {new Date().toLocaleString('nb-NO')} • {callSheet.productionCompany} • Konfidensielt dokument
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default CallSheetGenerator;
