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
  onSetTime: string;
  scenes: string[];
  notes?: string;
}

interface CallSheetCrewMember {
  id: string;
  name: string;
  department: string;
  position: string;
  callTime: string;
  phone?: string;
}

interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
}

interface CallSheetGeneratorProps {
  projectId: string;
  productionDay?: ProductionDay;
  scenes?: SceneBreakdown[];
  crew?: CrewMember[];
  locations?: Location[];
  onGenerate?: (callSheet: CallSheetData) => void;
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
    fields.scenes = dayScenes.map((s) => ({
      sceneNumber: String(s.sceneNumber ?? ''),
      description: s.description || s.sceneHeading || '',
      intExt: s.intExt || '',
      dayNight: s.timeOfDay || '',
      pages: s.pageLength != null ? String(s.pageLength) : '',
      cast: Array.isArray(s.characters) ? s.characters : [],
      location: loc?.name || s.locationName || '',
      estimatedTime: s.estimatedDuration != null ? `${s.estimatedDuration}t` : '',
    }));
    const chars = Array.from(new Set(dayScenes.flatMap((s) => (Array.isArray(s.characters) ? s.characters : []))));
    if (chars.length > 0) {
      fields.cast = chars.map((ch, i) => ({
        id: `cast-${i}`,
        name: ch,
        role: ch,
        callTime: productionDay.callTime || '',
        onSetTime: productionDay.callTime || '',
        scenes: dayScenes.filter((s) => (Array.isArray(s.characters) ? s.characters : []).includes(ch)).map((s) => String(s.sceneNumber ?? '')),
      }));
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
      phone: c.contactInfo?.phone,
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

export const CallSheetGenerator: FC<CallSheetGeneratorProps> = ({
  projectId,
  productionDay,
  scenes = [],
  crew = [],
  locations = [],
  onGenerate,
}) => {
  const theme = useTheme();
  const responsive = useResponsiveConfig();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [editMode, setEditMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Start with demo data visible
  const [isSynced, setIsSynced] = useState(false);
  
  // Data from casting service
  const [castingCandidates, setCastingCandidates] = useState<Candidate[]>([]);
  const [castingRoles, setCastingRoles] = useState<Role[]>([]);
  const [castingCrew, setCastingCrew] = useState<CrewMember[]>([]);
  const [castingLocations, setCastingLocations] = useState<Location[]>([]);

  // Demo data for TROLL production
  const [callSheet, setCallSheet] = useState<CallSheetData>({
    id: `cs-${Date.now()}`,
    projectName: 'TROLL',
    productionCompany: 'Motion Blur Films',
    date: productionDay?.date || '2026-02-15',
    dayNumber: 1,
    totalDays: 42,
    director: 'Roar Uthaug',
    producer: 'Espen Horn',
    callTime: productionDay?.callTime || '06:00',
    shootingCallTime: '08:00',
    lunchTime: '12:30',
    estimatedWrap: productionDay?.wrapTime || '19:00',
    locations: [
      {
        id: '1',
        name: 'Trollstigen',
        address: 'Trollstigen, 6300 Åndalsnes, Møre og Romsdal',
        parkingInfo: 'P-plass ved besøkssenter. Shuttle til set kl 05:30.',
        contactPerson: 'Lars Filming',
        contactPhone: '+47 900 12 345',
      },
    ],
    scenes: [
      {
        sceneNumber: '1',
        description: 'TROLLET våkner under fjellet - jordskjelv',
        intExt: 'EXT',
        dayNight: 'DAY',
        pages: '2 3/8',
        cast: ['NORA', 'TOBIAS', 'ARBEIDER 1'],
        location: 'Trollstigen',
        estimatedTime: '3t',
      },
      {
        sceneNumber: '5',
        description: 'Helikopter spotter trollet i fjellsiden',
        intExt: 'EXT',
        dayNight: 'DAY',
        pages: '1 5/8',
        cast: ['PILOT', 'GENERAL LUND'],
        location: 'Trollstigen',
        estimatedTime: '2t',
      },
      {
        sceneNumber: '12',
        description: 'Nora konfronterer trollet',
        intExt: 'EXT',
        dayNight: 'DUSK',
        pages: '4 1/8',
        cast: ['NORA', 'TOBIAS'],
        location: 'Trollstigen',
        estimatedTime: '4t',
      },
    ],
    cast: [
      {
        id: '1',
        name: 'Ine Marie Wilmann',
        role: 'NORA',
        pickupTime: '05:00',
        callTime: '05:30',
        makeupTime: '06:00',
        onSetTime: '08:00',
        scenes: ['1', '12'],
        notes: 'Kontaktlinser (spesialeffekt)',
      },
      {
        id: '2',
        name: 'Kim Falck',
        role: 'TOBIAS',
        pickupTime: '05:30',
        callTime: '06:00',
        onSetTime: '08:00',
        scenes: ['1', '12'],
      },
      {
        id: '3',
        name: 'Mads Ousdal',
        role: 'GENERAL LUND',
        callTime: '09:00',
        onSetTime: '10:30',
        scenes: ['5'],
        notes: 'Militæruniform',
      },
    ],
    crew: [
      { id: '1', name: 'Roar Uthaug', department: 'Regi', position: 'Regissør', callTime: '06:00', phone: '+47 900 00 001' },
      { id: '2', name: 'Jallo Faber', department: 'Foto', position: 'DOP', callTime: '05:30', phone: '+47 900 00 002' },
      { id: '3', name: 'Erik Poppe', department: 'Produksjon', position: '1st AD', callTime: '05:00', phone: '+47 900 00 003' },
      { id: '4', name: 'Anna Hansen', department: 'Lyd', position: 'Sound Mixer', callTime: '06:00', phone: '+47 900 00 004' },
      { id: '5', name: 'Lars Berg', department: 'Grip', position: 'Key Grip', callTime: '05:30', phone: '+47 900 00 005' },
      { id: '6', name: 'Maria Olsen', department: 'Lys', position: 'Gaffer', callTime: '05:30', phone: '+47 900 00 006' },
      { id: '7', name: 'Kari Sminke', department: 'Sminke', position: 'HMU Chief', callTime: '05:00', phone: '+47 900 00 007' },
      { id: '8', name: 'Jon VFX', department: 'VFX', position: 'VFX Supervisor', callTime: '07:00', phone: '+47 900 00 008' },
    ],
    specialInstructions: '• Alle må ha gyldig ID for adgang til sperret fjellområde\n• VÆRFORBEHOLD: Ved vindstyrke over 15 m/s flyttes til backup i studio\n• Droner i bruk - respekter sikkerhetssoner (rød markering)\n• Pyroteknikk scene 1 - evakueringsplan ved basecamp\n• Helikopter landing kun på markert helipad',
    weatherForecast: {
      temperature: 8,
      conditions: 'Delvis skyet, lett bris',
      sunrise: '06:42',
      sunset: '18:58',
    },
    emergencyContacts: [
      { name: 'Produksjonsleder', role: 'Set Contact', phone: '+47 900 00 100' },
      { name: 'Legevakt Åndalsnes', role: 'Medisinsk', phone: '116 117' },
      { name: 'Nødnummer', role: 'Nødsituasjon', phone: '113' },
    ],
    notes: '',
  });

  // Load data from casting service (background, non-blocking)
  useEffect(() => {
    const loadCastingData = async () => {
      // Don't block UI - demo data is already shown
      try {
        const [project, candidates, roles, crewMembers, locs] = await Promise.all([
          castingService.getProject(projectId).catch(() => null),
          castingService.getCandidates(projectId).catch(() => []),
          castingService.getRoles(projectId).catch(() => []),
          castingService.getCrew(projectId).catch(() => []),
          castingService.getLocations(projectId).catch(() => []),
        ]);

        setCastingCandidates(candidates || []);
        setCastingRoles(roles || []);
        setCastingCrew(crewMembers || []);
        setCastingLocations(locs || []);

        // Auto-fyll call-sheeten fra den faktiske produksjonsdagen. Foretrekk
        // eksplisitte props, ellers nylig lastet prosjekt-data.
        const resolvedScenes = scenes && scenes.length ? scenes : [];
        const resolvedCrew = crew && crew.length ? crew : (crewMembers || []);
        const resolvedLocs = locations && locations.length ? locations : (locs || []);
        const dayFields = productionDay
          ? buildDayCallSheetFields(productionDay, resolvedScenes, resolvedCrew, resolvedLocs)
          : {};
        const director = resolvedCrew.find(c =>
          c.role?.toLowerCase().includes('regissør') || c.role?.toLowerCase().includes('director'));
        const producer = resolvedCrew.find(c =>
          c.role?.toLowerCase().includes('produsent') || c.role?.toLowerCase().includes('producer'));

        if (project || productionDay) {
          setCallSheet(prev => ({
            ...prev,
            ...dayFields,
            projectName: project?.name || prev.projectName,
            director: director?.name || prev.director,
            producer: producer?.name || prev.producer,
          }));
          setIsSynced(true);
        }
      } catch (error) {
        console.error('Error loading casting data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Show content immediately, load in background
    setIsLoading(false);
    
    if (projectId) {
      // Background load - don't await
      loadCastingData();
    }
  }, [projectId, productionDay, scenes, crew, locations]);

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
          </Stack>
        </Stack>
      </Paper>

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
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography sx={{ fontSize: responsive.fontSize.tiny, color: COLORS.textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                        On Set
                      </Typography>
                      <Typography sx={{ fontSize: responsive.fontSize.caption, color: COLORS.textPrimary, fontWeight: 700 }}>
                        {member.onSetTime}
                      </Typography>
                    </Grid>
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
