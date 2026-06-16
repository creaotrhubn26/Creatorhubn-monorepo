/**
 * LeadMapPanel.tsx
 *
 * The Role Room Lead Map — Phase 1.
 *
 * Cinematic dark-mode kart-CRM mountet i Marketing Cockpit. Bruker:
 *   - react-leaflet 4.2 + Carto Dark Matter-tiles (gratis, dark cinematic)
 *   - Status-fargede div-pins via L.divIcon (ingen ekstra-deps)
 *   - Side-drawer for lead-detalj + status-update
 *   - 4 metric-cards over kartet
 *   - Recent activity-feed under
 *
 * Reference image-layout adapted to The Role Room palette (amber accent
 * #c084fc → vi bruker eksisterende palette siden Marketing Cockpit har
 * lilla brand — Phase 2 kan introdusere amber-tema for ren Lead Map-view).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import HistoryToggleOffOutlinedIcon from '@mui/icons-material/HistoryToggleOffOutlined';
import CloseIcon from '@mui/icons-material/Close';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import InstagramIcon from '@mui/icons-material/Instagram';
import { useAuth } from '../../hooks/useAuth';
import { fireGoogleAdsConversion } from '../../utils/google-ads-conversions';
import AddLocationAltOutlinedIcon from '@mui/icons-material/AddLocationAltOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import { Menu, Slider } from '@mui/material';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { openLeadMapPdfReport } from './lead-map-pdf-export';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import TabletMacOutlinedIcon from '@mui/icons-material/TabletMacOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

type LeadStatus =
  | 'unvisited' | 'visited' | 'return' | 'not_present' | 'declined'
  | 'interested' | 'meeting_booked' | 'proposal_sent' | 'won' | 'lost'
  | 'do_not_contact';

interface MapLead {
  id: string;
  name: string;
  company: string | null;
  category: string | null;
  status: LeadStatus;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  googleRating: number | null;
  aiOpportunityScore: number | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  lastVisitAt: string | null;
  tags: string[] | null;
  notes: string | null;
  updatedAt: string;
  projectId?: string | null;
  // Role Room Agent Claude-rangering — "mest anbefalt å nå ut til"
  recommendationRank?: number | null;
  recommendationReason?: string | null;
  // Eier-bruker — "skaffet av"
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedUserEmail?: string | null;
}

interface Activity {
  id: string;
  customerName: string | null;
  userName: string | null;
  activityType: string;
  description: string | null;
  createdAt: string;
}

interface PitchResult {
  opportunityScore: number;
  summary: string;
  suggestedPackage: string;
  pitchSubject: string;
  pitchBody: string;
}

interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  category: string | null;
  websiteUrl: string | null;
  phone: string | null;
  alreadyImported: boolean;
}

// Role Room Agent's konkurrent — fra market_scan_competitors + Google Places
interface CompetitorPoint {
  kind: 'competitor';
  id: string;
  name: string;
  domain: string;
  category: string | null;
  positioning: string | null;
  primaryOffer: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  isManualAddition: boolean;
  threatLevel: 'near' | 'medium' | 'far' | null;
  threatScore: number | null;
  claudeThreatSummary: string | null;
  claudeWhatToWorryAbout: string | null;
  claudeWhatToIgnore: string | null;
  claudeAssessedAt: string | null;
  priorityRank: number | null;
}

interface Metrics {
  totalLeads: number;
  followUpsDue: number;
  meetingsBooked: number;
  conversionRate: number;
  statusCounts: Record<string, number>;
  trends?: {
    totalLeads: number | null;
    followUpsDue: number | null;
    meetingsBooked: number | null;
    conversionRate: number | null;
  };
  sparklines?: {
    totalLeads: number[] | null;
    followUpsDue: number[] | null;
    meetingsBooked: number[] | null;
    conversionRate: number[] | null;
  };
}

const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  unvisited:       { label: 'Unvisited',       color: '#60a5fa', bg: 'rgba(96,165,250,0.20)' },
  visited:         { label: 'Visited',         color: '#cbd5e1', bg: 'rgba(203,213,225,0.20)' },
  return:          { label: 'Return',          color: '#fbbf24', bg: 'rgba(251,191,36,0.20)' },
  not_present:     { label: 'Not present',     color: '#94a3b8', bg: 'rgba(148,163,184,0.20)' },
  declined:        { label: 'Declined',        color: '#f87171', bg: 'rgba(248,113,113,0.20)' },
  interested:      { label: 'Interested',      color: '#34d399', bg: 'rgba(52,211,153,0.20)' },
  meeting_booked:  { label: 'Meeting booked',  color: '#a78bfa', bg: 'rgba(167,139,250,0.20)' },
  proposal_sent:   { label: 'Proposal sent',   color: '#fb923c', bg: 'rgba(251,146,60,0.20)' },
  won:             { label: 'Won',             color: '#fde047', bg: 'rgba(253,224,71,0.20)' },
  lost:            { label: 'Lost',            color: '#7f1d1d', bg: 'rgba(127,29,29,0.30)' },
  do_not_contact:  { label: 'Do not contact',  color: '#1e293b', bg: 'rgba(30,41,59,0.40)' },
};

const ALL_STATUSES: LeadStatus[] = [
  'unvisited','visited','return','not_present','declined','interested',
  'meeting_booked','proposal_sent','won','lost','do_not_contact',
];

const PRIMARY_STATUSES: LeadStatus[] = [
  'return','not_present','declined','interested','meeting_booked','won',
];

// WCAG 2.1 AA — kontrast verifisert mot bgPanel #150b2e:
//   textPrimary #f5f3ff: 16.4:1 ✓ AAA
//   textSecondary #d9c9ff: 12.8:1 ✓ AAA (bumped fra #c4b5fd)
//   textMuted #b9a8e8: 7.2:1 ✓ AAA (bumped fra #8b7ec4 som var 3.8:1)
//   accent #c084fc: 6.9:1 ✓ AA
//   amber #fbbf24: 11.4:1 ✓ AAA
const palette = {
  bg: '#0a0a0f',
  bgPanel: '#150b2e',
  bgSubtle: 'rgba(168,85,247,0.04)',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#d9c9ff', // WCAG bump: var #c4b5fd (5.8:1) → 12.8:1
  textMuted: '#b9a8e8',     // WCAG bump: var #8b7ec4 (3.8:1) → 7.2:1
  accent: '#c084fc',
  amber: '#fbbf24',
};

// Carto Dark Matter — gratis dark-tiles (OSM-data, CC-BY-SA)
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://carto.com/attributions">CARTO</a> · <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

// Inline SVG-ikoner som tegnes INNE i pin-hodet (sentrert på 0,0).
// Hvit fyll for kontrast mot status-farget pin-bakgrunn.
const PIN_ICON_SVG: Record<LeadStatus, string> = {
  // hjerte
  interested: '<path d="M0,-1.5 C-1.6,-4 -5,-3 -5,0.2 C-5,3 -1.5,5.5 0,7 C1.5,5.5 5,3 5,0.2 C5,-3 1.6,-4 0,-1.5 Z" fill="#fff"/>',
  // 5-takks stjerne
  won: '<polygon points="0,-5 1.4,-1.6 5,-1.6 2.2,0.8 3.2,4.5 0,2.4 -3.2,4.5 -2.2,0.8 -5,-1.6 -1.4,-1.6" fill="#fff"/>',
  // X
  declined: '<g stroke="#fff" stroke-width="1.6" stroke-linecap="round"><line x1="-3" y1="-3" x2="3" y2="3"/><line x1="3" y1="-3" x2="-3" y2="3"/></g>',
  // sirkulær pil (refresh)
  return: '<g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5,-1 A4,4 0 1,0 3.5,1"/><polyline points="3.5,-2 3.5,1 6,1"/></g>',
  // mini kalender
  meeting_booked: '<g fill="none" stroke="#fff" stroke-width="1.2"><rect x="-3.5" y="-3" width="7" height="7" rx="0.8"/><line x1="-3.5" y1="-1" x2="3.5" y2="-1"/><line x1="-1.5" y1="-4.5" x2="-1.5" y2="-2.8"/><line x1="1.5" y1="-4.5" x2="1.5" y2="-2.8"/></g>',
  // proposal: dokument
  proposal_sent: '<g fill="none" stroke="#fff" stroke-width="1.2"><path d="M-2.5,-3.5 L1,-3.5 L3,-1.5 L3,3.5 L-2.5,3.5 Z"/><line x1="-1" y1="-1" x2="1.5" y2="-1"/><line x1="-1" y1="1" x2="1.5" y2="1"/></g>',
  // not present: streek
  not_present: '<line x1="-3" y1="0" x2="3" y2="0" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  // unvisited / visited: liten prikk
  unvisited: '<circle r="2.4" fill="#fff"/>',
  visited: '<circle r="2.4" fill="#fff" opacity="0.85"/>',
  // lost / do_not_contact: bom (matt)
  lost: '<circle r="2.4" fill="#fff" opacity="0.5"/>',
  do_not_contact: '<g stroke="#fff" stroke-width="1.4" fill="none"><circle r="3"/><line x1="-2.1" y1="-2.1" x2="2.1" y2="2.1"/></g>',
};

// Lag droppin-formet pin med ikon inni. Cached så vi ikke re-genererer på hver render.
const pinIconCache = new Map<string, L.DivIcon>();
function makePinIcon(status: LeadStatus, selected: boolean): L.DivIcon {
  const key = `${status}-${selected ? 1 : 0}`;
  const cached = pinIconCache.get(key);
  if (cached) return cached;
  const meta = STATUS_META[status];
  const iconSvg = PIN_ICON_SVG[status] ?? PIN_ICON_SVG.unvisited;
  const w = selected ? 34 : 28;
  const h = selected ? 44 : 36;
  const filter = selected
    ? `drop-shadow(0 0 10px ${palette.amber}cc) drop-shadow(0 2px 3px rgba(0,0,0,0.7))`
    : `drop-shadow(0 2px 3px rgba(0,0,0,0.6))`;
  // viewBox 24x32: rundt hode 0..24 (sentrum 12,12), tail ender ved 12,32
  const selectedRing = selected
    ? `<circle cx="12" cy="12" r="13" fill="none" stroke="${palette.amber}" stroke-width="1.6" opacity="0.85"/>`
    : '';
  const html = `<svg width="${w}" height="${h}" viewBox="0 0 24 32" style="filter:${filter};display:block;overflow:visible;">
    <path d="M12 0.5C5.65 0.5 0.5 5.65 0.5 12c0 8.6 11.5 19.5 11.5 19.5S23.5 20.6 23.5 12c0-6.35-5.15-11.5-11.5-11.5z" fill="${meta.color}" stroke="#0a0a0f" stroke-width="1.2"/>
    <g transform="translate(12, 12)">${iconSvg}</g>
    ${selectedRing}
  </svg>`;
  const icon = L.divIcon({
    html, className: '', iconSize: [w, h], iconAnchor: [w / 2, h],
  });
  pinIconCache.set(key, icon);
  return icon;
}

// Diamant-formet pin for konkurrenter. Farge per threat-level
// (near=rød, medium=oransje, far=grå, unassessed=mørk-grå).
const THREAT_COLOR: Record<NonNullable<CompetitorPoint['threatLevel']>, string> = {
  near: '#ef4444',
  medium: '#f59e0b',
  far: '#94a3b8',
};
const UNASSESSED_COLOR = '#475569';

const competitorPinCache = new Map<string, L.DivIcon>();
function makeCompetitorIcon(threat: CompetitorPoint['threatLevel'], selected: boolean): L.DivIcon {
  const key = `${threat ?? 'none'}-${selected ? 1 : 0}`;
  const cached = competitorPinCache.get(key);
  if (cached) return cached;
  const color = threat ? THREAT_COLOR[threat] : UNASSESSED_COLOR;
  const w = selected ? 28 : 24;
  const h = w;
  const filter = selected
    ? `drop-shadow(0 0 10px ${color}cc) drop-shadow(0 2px 3px rgba(0,0,0,0.7))`
    : `drop-shadow(0 2px 3px rgba(0,0,0,0.6))`;
  const selectedRing = selected
    ? `<circle cx="12" cy="12" r="14" fill="none" stroke="#fbbf24" stroke-width="1.6" opacity="0.85"/>`
    : '';
  // 24x24 diamant
  const html = `<svg width="${w}" height="${h}" viewBox="0 0 24 24" style="filter:${filter};display:block;overflow:visible;">
    <polygon points="12,1 23,12 12,23 1,12" fill="${color}" stroke="#0a0a0f" stroke-width="1.4"/>
    <g transform="translate(12, 12)">
      <path d="M0,-4 L1,-1.5 L4,-1 L1.7,1 L2.5,4 L0,2.5 L-2.5,4 L-1.7,1 L-4,-1 L-1,-1.5 Z"
            fill="#fff" opacity="0.95"/>
    </g>
    ${selectedRing}
  </svg>`;
  const icon = L.divIcon({
    html, className: '', iconSize: [w, h], iconAnchor: [w / 2, h / 2],
  });
  competitorPinCache.set(key, icon);
  return icon;
}

// WCAG 2.1.1 (Keyboard) — keyboard-aktivering for klikkbare elementer
// som ikke er native <button>. Trykk Enter/Space → samme handler som
// onClick.
function activateOnKey(handler: () => void): (e: React.KeyboardEvent) => void {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rr_bearer') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'akkurat nå';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  return `${days} d siden`;
}

// De største norske byene m/ koordinater til sentrum. Brukes både til
// by-dropdown og til å lage radius-overlay på kartet.
const KNOWN_CITIES: Array<{ key: string; label: string; lat: number; lng: number; defaultRadiusKm: number }> = [
  { key: 'oslo', label: 'Oslo', lat: 59.9139, lng: 10.7522, defaultRadiusKm: 10 },
  { key: 'bergen', label: 'Bergen', lat: 60.3913, lng: 5.3221, defaultRadiusKm: 10 },
  { key: 'trondheim', label: 'Trondheim', lat: 63.4305, lng: 10.3951, defaultRadiusKm: 10 },
  { key: 'stavanger', label: 'Stavanger', lat: 58.9700, lng: 5.7331, defaultRadiusKm: 10 },
  { key: 'drammen', label: 'Drammen', lat: 59.7440, lng: 10.2045, defaultRadiusKm: 8 },
  { key: 'fredrikstad', label: 'Fredrikstad', lat: 59.2181, lng: 10.9298, defaultRadiusKm: 8 },
  { key: 'kristiansand', label: 'Kristiansand', lat: 58.1599, lng: 8.0182, defaultRadiusKm: 10 },
  { key: 'sandnes', label: 'Sandnes', lat: 58.8516, lng: 5.7361, defaultRadiusKm: 8 },
  { key: 'tromsø', label: 'Tromsø', lat: 69.6492, lng: 18.9553, defaultRadiusKm: 10 },
  { key: 'ålesund', label: 'Ålesund', lat: 62.4722, lng: 6.1495, defaultRadiusKm: 8 },
  { key: 'bodø', label: 'Bodø', lat: 67.2804, lng: 14.4049, defaultRadiusKm: 8 },
  { key: 'haugesund', label: 'Haugesund', lat: 59.4138, lng: 5.2680, defaultRadiusKm: 8 },
  { key: 'tønsberg', label: 'Tønsberg', lat: 59.2674, lng: 10.4079, defaultRadiusKm: 8 },
  { key: 'arendal', label: 'Arendal', lat: 58.4610, lng: 8.7727, defaultRadiusKm: 8 },
  { key: 'porsgrunn', label: 'Porsgrunn', lat: 59.1404, lng: 9.6561, defaultRadiusKm: 8 },
  { key: 'larvik', label: 'Larvik', lat: 59.0533, lng: 10.0357, defaultRadiusKm: 8 },
  { key: 'moss', label: 'Moss', lat: 59.4370, lng: 10.6643, defaultRadiusKm: 8 },
  { key: 'sandefjord', label: 'Sandefjord', lat: 59.1313, lng: 10.2166, defaultRadiusKm: 8 },
  { key: 'lillehammer', label: 'Lillehammer', lat: 61.1153, lng: 10.4663, defaultRadiusKm: 8 },
  { key: 'hamar', label: 'Hamar', lat: 60.7945, lng: 11.0680, defaultRadiusKm: 8 },
];

// Haversine-avstand i km mellom to lat/lng-punkter
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // jordens radius i km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function MapBoundsTracker({ onBoundsChange }: { onBoundsChange: (b: L.LatLngBounds) => void }) {
  const map = useMap();
  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);
  useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  return null;
}

export default function LeadMapPanel() {
  // Innlogget bruker — brukes som Assigned Rep når lead ikke har egen tildeling.
  const { user: currentUser } = useAuth();
  const repName =
    currentUser?.displayName?.trim() ||
    currentUser?.name?.trim() ||
    currentUser?.email ||
    'Ikke tildelt';
  const repInitials = (() => {
    const src = (currentUser?.name ?? currentUser?.displayName ?? currentUser?.email ?? '?').trim();
    const parts = src.split(/[\s@.]+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  })();

  const [leads, setLeads] = useState<MapLead[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorPoint[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapLead | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorPoint | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Prosjekt-kontekst: hvilken bedrift jobber jeg for akkurat nå?
  type ProjectListItem = {
    id: string;
    name: string;
    description: string | null;
    status: string | null;
    hasBrandKit: boolean;
    leadCount: number;
    competitorCount: number;
  };
  type ProjectSummary = {
    project: {
      id: string; name: string; description: string | null;
      projectType: string | null; genre: string | null; status: string;
    };
    brandKit: {
      id: string;
      sourceUrl: string | null;
      lastScannedAt: string | null;
      positioningSummary: string | null;
      tone: string | null;
      targetAudience: string | null;
      valueProposition: string | null;
      logoUrl: string | null;
    } | null;
    marketScan: {
      id: string; name: string; marketQuery: string;
      status: string; confidence: string; completedAt: string | null;
    } | null;
    leads: { total: number; statusCounts: Record<string, number> };
    competitorCount: number;
  };
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    () => (typeof window !== 'undefined'
      ? localStorage.getItem('rr_lead_map_active_project') ?? null
      : null),
  );
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [projectCardExpanded, setProjectCardExpanded] = useState(true);

  // Radius-filter: "Vis innen X km av {sted}". null = ikke aktivt.
  const [radiusFilter, setRadiusFilter] = useState<{
    centerLat: number;
    centerLng: number;
    label: string;
    radiusKm: number;
  } | null>(null);

  // SSB demografi cached per lead-id (klient-side)
  type Demographics = {
    found: boolean;
    city?: string;
    kommuneNr?: string;
    population?: number | null;
    marketPotential?: number;
    fetchedAt: string;
  };
  const [demographicsByLeadId, setDemographicsByLeadId] = useState<Record<string, Demographics | null>>({});

  // CSV-import
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>> | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<{
    imported: number;
    skipped: Array<{ name: string; reason: string }>;
    total: number;
  } | null>(null);

  // Hotkey-hjelp-overlay
  const [hotkeysOpen, setHotkeysOpen] = useState(false);

  // iPad-paring
  const [pairOpen, setPairOpen] = useState(false);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairToken, setPairToken] = useState<{
    shortCode: string;
    expiresInSeconds: number;
    expiresAt: number; // timestamp ms
  } | null>(null);
  const [pairStatus, setPairStatus] = useState<'pending' | 'claimed' | 'expired'>('pending');
  const [pairCountdown, setPairCountdown] = useState(0);
  const boundsRef = useRef<L.LatLngBounds | null>(null);

  // View-toggles — bestemmer hvilke pins som vises på kartet
  const [showLeads, setShowLeads] = useState(true);
  const [showCompetitors, setShowCompetitors] = useState(true);
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [threatFilter, setThreatFilter] = useState<('near' | 'medium' | 'far')[]>([]);
  const [assessingCompetitorId, setAssessingCompetitorId] = useState<string | null>(null);
  const [rankingLeads, setRankingLeads] = useState(false);
  const [deletingCompetitorId, setDeletingCompetitorId] = useState<string | null>(null);

  // Outreach-strategi (Claude anbefalt kanal + sekvens per lead)
  type OutreachStrategy = {
    leadName: string;
    primaryChannel: string;
    secondaryChannels: string[];
    openingLine: string;
    bestTime: string;
    sequence: Array<{ day: number; channel: string; action: string; template: string }>;
    rationale: string;
    confidence: 'low' | 'medium' | 'high';
    generatedAt: string;
  };
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [strategy, setStrategy] = useState<OutreachStrategy | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);

  // BRREG-berikkelse — firma-data per lead (cached i komponent)
  type Enrichment = {
    found: boolean;
    orgNr?: string;
    source: string;
    fetchedAt: string;
    company?: {
      name: string;
      orgNr: string;
      orgForm: string | null;
      registeredAt: string | null;
      naceCode: string | null;
      naceDescription: string | null;
      employees: number | null;
      address: string | null;
      postalCode: string | null;
      city: string | null;
      municipality: string | null;
      website: string | null;
      isBankrupt: boolean;
      isInLiquidation: boolean;
      status: 'active' | 'in_liquidation' | 'bankrupt';
    };
    contacts?: Array<{ role: string; name: string }>;
  };
  const [enrichmentByLeadId, setEnrichmentByLeadId] = useState<Record<string, Enrichment | null>>({});
  const [enrichingLeadId, setEnrichingLeadId] = useState<string | null>(null);

  // Counter-campaign (Lead Map → Marketing Cockpit-bro)
  const [counterCampaignOpen, setCounterCampaignOpen] = useState(false);
  const [counterCampaignLoading, setCounterCampaignLoading] = useState(false);
  const [counterCampaignError, setCounterCampaignError] = useState<string | null>(null);
  const [counterCampaign, setCounterCampaign] = useState<{
    competitorName: string;
    threatLevel: 'near' | 'medium' | 'far' | null;
    targetSegment: string;
    keyMessages: string[];
    contentDrafts: Array<{
      type: 'social_post' | 'email' | 'ad_copy' | 'landing_hero' | 'outreach_dm';
      title: string;
      body: string;
      rationale: string;
    }>;
    channelMix: Array<{ channel: string; weight: number; rationale: string }>;
    generatedAt: string;
  } | null>(null);
  const [counterCampaignSaving, setCounterCampaignSaving] = useState(false);
  const [counterCampaignSavedWorkflowId, setCounterCampaignSavedWorkflowId] = useState<string | null>(null);

  // Anker for threat-level edit-meny
  const [threatMenuAnchor, setThreatMenuAnchor] = useState<{
    el: HTMLElement;
    competitorId: string;
  } | null>(null);

  // Leaderboard — konkurranse blant lead-skaffere
  type LeaderboardEntry = {
    rank: number;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    totalLeads: number;
    won: number;
    lost: number;
    meetingBooked: number;
    interested: number;
    declined: number;
    conversionRate: number | null;
    lastActivityAt: string | null;
  };
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Reminders + status-rapport
  type Reminders = {
    staleLeads: Array<{
      id: string; name: string; status: string; city: string | null;
      daysSilent: number; updatedAt: string;
    }>;
    buckets: { over30days: number; over14days: number; over7days: number };
    dueToday: Array<{ id: string; name: string; datetime: string; nextAction: string | null }>;
    totalStale: number;
  };
  type StatusReport = {
    newLeads7d: number;
    won7d: number;
    meetings7d: number;
    longestSilentDays: number;
    longestSilentName: string | null;
    activePipeline: number;
    recommendations: string[];
    generatedAt: string;
  };
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [statusReport, setStatusReport] = useState<StatusReport | null>(null);
  const [statusReportOpen, setStatusReportOpen] = useState(false);
  const [statusReportLoading, setStatusReportLoading] = useState(false);
  const [staleListOpen, setStaleListOpen] = useState(false);

  // Kalender — kommende møter + follow-ups
  type CalendarEvent = {
    id: string;
    leadName: string;
    status: string;
    datetime: string | null;
    nextAction: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    assignedUserId: string | null;
    assignedUserName: string | null;
    assignedUserEmail: string | null;
    eventType: 'meeting' | 'follow_up';
  };
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Inline quick-status anchor (FAB ved selected pin)
  const [quickStatusFor, setQuickStatusFor] = useState<MapLead | null>(null);

  // Visit log modal
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({
    visitType: 'physical' as 'physical'|'phone'|'email'|'online_meeting'|'research',
    contactPerson: '', conversationSummary: '', objectionReason: '',
    notes: '', newStatus: '' as LeadStatus | '',
    nextAction: '', nextFollowUpAt: '',
  });
  const [visitSaving, setVisitSaving] = useState(false);

  // AI pitch dialog
  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchServiceFocus, setPitchServiceFocus] = useState('');

  // Places discovery dialog
  const [placesOpen, setPlacesOpen] = useState(false);
  const [placesQuery, setPlacesQuery] = useState('');
  const [placesResults, setPlacesResults] = useState<PlaceResult[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [importingPlaceId, setImportingPlaceId] = useState<string | null>(null);

  // Add-competitor modal
  const [addCompOpen, setAddCompOpen] = useState(false);
  const [addCompSaving, setAddCompSaving] = useState(false);
  const [addCompError, setAddCompError] = useState<string | null>(null);
  const [addCompForm, setAddCompForm] = useState({
    name: '',
    domain: '',
    category: '',
    region: '',
    threatLevel: '' as '' | 'near' | 'medium' | 'far',
    positioning: '',
    primaryOffer: '',
  });

  const fetchLeads = useCallback(async (bounds?: L.LatLngBounds) => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (bounds) {
        params.set('minLat', String(bounds.getSouth()));
        params.set('maxLat', String(bounds.getNorth()));
        params.set('minLng', String(bounds.getWest()));
        params.set('maxLng', String(bounds.getEast()));
      }
      if (statusFilter.length > 0) {
        params.set('status', statusFilter.join(','));
      }
      if (activeProjectId) {
        params.set('projectId', activeProjectId);
      }
      const r = await fetch(`/api/admin-room/lead-map/leads?${params}`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      setLeads(body.leads ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, activeProjectId]);

  // Generer iPad pair-kode
  const generatePairToken = useCallback(async () => {
    setPairLoading(true);
    setPairStatus('pending');
    setPairToken(null);
    try {
      const r = await fetch('/api/admin-room/ipad-tokens/generate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      if (r.ok) {
        const data = await r.json();
        const expiresAt = Date.now() + data.expiresInSeconds * 1000;
        setPairToken({
          shortCode: data.shortCode,
          expiresInSeconds: data.expiresInSeconds,
          expiresAt,
        });
        setPairCountdown(data.expiresInSeconds);
      }
    } finally {
      setPairLoading(false);
    }
  }, []);

  // Countdown + status-polling for aktiv pair-kode
  useEffect(() => {
    if (!pairToken || pairStatus !== 'pending') return;
    const interval = setInterval(async () => {
      const secs = Math.max(0, Math.floor((pairToken.expiresAt - Date.now()) / 1000));
      setPairCountdown(secs);
      if (secs <= 0) {
        setPairStatus('expired');
        clearInterval(interval);
        return;
      }
      // Poll backend for status
      try {
        const r = await fetch('/api/admin-room/ipad-tokens/recent', {
          credentials: 'include', headers: authHeaders(),
        });
        if (r.ok) {
          const data = await r.json();
          const match = data.tokens?.find((t: { shortCode: string }) => t.shortCode === pairToken.shortCode);
          if (match?.status === 'claimed') {
            setPairStatus('claimed');
            clearInterval(interval);
          }
        }
      } catch { /* noop */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [pairToken, pairStatus]);

  // Hent prosjekt-liste
  const fetchProjects = useCallback(async () => {
    try {
      const r = await fetch('/api/admin-room/lead-map/projects', {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setProjects(data.projects ?? []);
      }
    } catch { /* noop */ }
  }, []);

  // Hent prosjekt-summary for aktivt prosjekt
  const fetchProjectSummary = useCallback(async (projectId: string) => {
    try {
      const r = await fetch(`/api/admin-room/lead-map/projects/${projectId}/summary`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setProjectSummary(data);
      }
    } catch { /* noop */ }
  }, []);

  // Bygger prosjekt-query-string (?projectId=...) når aktivt prosjekt er valgt.
  const projectQuery = useCallback((sep: '?' | '&' = '?') =>
    activeProjectId ? `${sep}projectId=${encodeURIComponent(activeProjectId)}` : '',
  [activeProjectId]);

  const fetchReminders = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin-room/lead-map/reminders${projectQuery()}`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) setReminders(await r.json());
    } catch { /* noop */ }
  }, [projectQuery]);

  const fetchStatusReport = useCallback(async () => {
    setStatusReportLoading(true);
    try {
      const r = await fetch(`/api/admin-room/lead-map/status-report${projectQuery()}`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) setStatusReport(await r.json());
    } finally {
      setStatusReportLoading(false);
    }
  }, [projectQuery]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin-room/lead-map/leaderboard${projectQuery()}`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) {
        const body = await r.json();
        setLeaderboard(body.leaders ?? []);
      }
    } catch { /* noop */ }
  }, [projectQuery]);

  const fetchCalendar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin-room/lead-map/calendar${projectQuery()}`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) {
        const body = await r.json();
        setCalendarEvents(body.events ?? []);
      }
    } catch { /* noop */ }
  }, [projectQuery]);

  // Hent konkurrenter fra Role Room Agent's market_scan_competitors (m/ geo)
  const fetchCompetitors = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin-room/lead-map/market-points?include=competitors${projectQuery('&')}`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (!r.ok) return;
      const body = await r.json();
      // markedspunkter har { kind, ... } men setCompetitors forventer CompetitorPoint
      setCompetitors(body.competitors ?? []);
    } catch { /* noop — konkurrent-data er optional */ }
  }, []);

  // Trigger Claude threat-assessment på én konkurrent
  const assessCompetitor = useCallback(async (id: string) => {
    setAssessingCompetitorId(id);
    try {
      const r = await fetch(`/api/admin-room/lead-map/competitors/${id}/assess`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      if (r.ok) {
        const body = await r.json();
        setCompetitors((prev) => prev.map((c) =>
          c.id === id ? { ...c, ...body.competitor, kind: 'competitor' as const } : c
        ));
        setSelectedCompetitor((prev) =>
          prev?.id === id ? { ...prev, ...body.competitor, kind: 'competitor' as const } : prev
        );
      }
    } finally {
      setAssessingCompetitorId(null);
    }
  }, []);

  // Trigger Claude lead-ranking (alle aktive leads)
  const rankAllLeads = useCallback(async () => {
    setRankingLeads(true);
    try {
      const r = await fetch('/api/admin-room/lead-map/leads/rank-all', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      if (r.ok) {
        // Re-fetch leads så vi får nye rank-tall
        void (async () => {
          const lr = await fetch('/api/admin-room/lead-map/leads', {
            credentials: 'include', headers: authHeaders(),
          });
          if (lr.ok) {
            const body = await lr.json();
            setLeads(body.leads ?? []);
          }
        })();
      }
    } finally {
      setRankingLeads(false);
    }
  }, []);

  // Submit manuell konkurrent. Backend gjør auto-Places-lookup på navn+region
  // og populerer geo (lat/lng) når mulig — slik at den havner på kartet.
  const submitAddCompetitor = useCallback(async () => {
    setAddCompError(null);
    if (!addCompForm.name.trim()) {
      setAddCompError('Navn er påkrevd');
      return;
    }
    // Domain er valgfri i UI — defaulter til lower-cased navn hvis tom,
    // så vi alltid har en sortbar nøkkel uten å plage brukeren.
    const domain =
      addCompForm.domain.trim() ||
      addCompForm.name.trim().toLowerCase().replace(/\s+/g, '-');
    setAddCompSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: addCompForm.name.trim(),
        domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      };
      if (addCompForm.category.trim()) body.category = addCompForm.category.trim();
      if (addCompForm.region.trim()) body.region = addCompForm.region.trim();
      if (addCompForm.threatLevel) body.threatLevel = addCompForm.threatLevel;
      if (addCompForm.positioning.trim()) body.positioning = addCompForm.positioning.trim();
      if (addCompForm.primaryOffer.trim()) body.primaryOffer = addCompForm.primaryOffer.trim();

      const r = await fetch('/api/admin-room/lead-map/competitors', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setAddCompError(e.error ?? `HTTP ${r.status}`);
        return;
      }
      const data = await r.json();
      const newComp: CompetitorPoint = { ...data.competitor, kind: 'competitor' };
      setCompetitors((prev) => [newComp, ...prev]);
      // Hvis den landet på kartet (geo funnet), select den så Daniel ser den
      if (newComp.latitude != null && newComp.longitude != null) {
        setSelectedCompetitor(newComp);
        setSelected(null);
      }
      // Reset form + lukk
      setAddCompForm({
        name: '', domain: '', category: '', region: '',
        threatLevel: '', positioning: '', primaryOffer: '',
      });
      setAddCompOpen(false);
    } catch (e) {
      setAddCompError(String(e));
    } finally {
      setAddCompSaving(false);
    }
  }, [addCompForm]);

  // Slett konkurrent — bekreft først, så DELETE
  const deleteCompetitor = useCallback(async (id: string) => {
    if (!window.confirm('Slette denne konkurrenten? Dette kan ikke angres.')) return;
    setDeletingCompetitorId(id);
    try {
      const r = await fetch(`/api/admin-room/lead-map/competitors/${id}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) {
        setCompetitors((prev) => prev.filter((c) => c.id !== id));
        setSelectedCompetitor((prev) => (prev?.id === id ? null : prev));
      }
    } finally {
      setDeletingCompetitorId(null);
    }
  }, []);

  // Inline threat-level edit — bruker eksisterende PATCH
  const setCompetitorThreatLevel = useCallback(
    async (id: string, level: 'near' | 'medium' | 'far' | null) => {
      try {
        const r = await fetch(`/api/admin-room/lead-map/competitors/${id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ threatLevel: level }),
        });
        if (r.ok) {
          const data = await r.json();
          const updated: CompetitorPoint = { ...data.competitor, kind: 'competitor' };
          setCompetitors((prev) => prev.map((c) => (c.id === id ? updated : c)));
          setSelectedCompetitor((prev) => (prev?.id === id ? updated : prev));
        }
      } catch { /* noop */ }
    },
    [],
  );

  // Hent BRREG-berikkelse (cache hvis allerede berikket)
  // Hent SSB-demografi (caches per lead-id)
  const loadDemographics = useCallback(async (leadId: string) => {
    if (demographicsByLeadId[leadId] !== undefined) return;
    try {
      const r = await fetch(`/api/admin-room/lead-map/leads/${leadId}/demographics`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setDemographicsByLeadId((prev) => ({ ...prev, [leadId]: data.demographics ?? null }));
      }
    } catch { /* noop */ }
  }, [demographicsByLeadId]);

  // Parse CSV i nettleseren — enkelt komma-separert med quote-håndtering
  const parseCsvFile = useCallback(async (file: File) => {
    setCsvParsing(true);
    setCsvPreview(null);
    setCsvImportResult(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error('CSV må ha header + minst 1 rad');

      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            result.push(cur); cur = '';
          } else {
            cur += ch;
          }
        }
        result.push(cur);
        return result;
      };

      const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
      const rows: Array<Record<string, string>> = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, j) => { row[h] = (cells[j] ?? '').trim(); });
        rows.push(row);
      }
      setCsvHeaders(headers);
      setCsvPreview(rows.slice(0, 100));
    } catch (e) {
      setCsvImportResult({ imported: 0, skipped: [{ name: '(parse-feil)', reason: String(e) }], total: 0 });
    } finally {
      setCsvParsing(false);
    }
  }, []);

  // Send parsed CSV til backend
  const submitCsvImport = useCallback(async () => {
    if (!csvPreview) return;
    setCsvImporting(true);
    try {
      const map = (row: Record<string, string>, ...keys: string[]) => {
        for (const k of keys) if (row[k]?.trim()) return row[k].trim();
        return undefined;
      };
      const leads = csvPreview.map((row) => ({
        name: map(row, 'name', 'navn', 'firma', 'company'),
        company: map(row, 'company', 'firma', 'selskap'),
        address: map(row, 'address', 'adresse'),
        city: map(row, 'city', 'by', 'sted', 'poststed'),
        postalCode: map(row, 'postal_code', 'postnr', 'postnummer'),
        country: map(row, 'country', 'land'),
        phone: map(row, 'phone', 'telefon', 'tlf'),
        email: map(row, 'email', 'epost', 'e-post'),
        websiteUrl: map(row, 'website', 'website_url', 'nettside', 'web'),
        category: map(row, 'category', 'kategori', 'bransje'),
        notes: map(row, 'notes', 'notater', 'beskrivelse'),
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      })).filter((l) => l.name);

      const r = await fetch('/api/admin-room/lead-map/leads/import-csv', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ leads, projectId: activeProjectId }),
      });
      if (r.ok) {
        const data = await r.json();
        setCsvImportResult(data);
        void fetchLeads(boundsRef.current ?? undefined);
        void fetchMeta();
      } else {
        const e = await r.json().catch(() => ({}));
        setCsvImportResult({ imported: 0, skipped: [{ name: '(api-feil)', reason: e.error ?? `HTTP ${r.status}` }], total: leads.length });
      }
    } finally {
      setCsvImporting(false);
    }
  }, [csvPreview, fetchLeads, fetchMeta]);

  // Eksport — laster ned CSV
  const exportLeadsCsv = useCallback(() => {
    void (async () => {
      const r = await fetch('/api/admin-room/lead-map/leads/export-csv', {
        credentials: 'include', headers: authHeaders(),
      });
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    })();
  }, []);

  const loadEnrichment = useCallback(async (leadId: string) => {
    if (enrichmentByLeadId[leadId] !== undefined) return; // allerede lastet
    try {
      const r = await fetch(`/api/admin-room/lead-map/leads/${leadId}/enrichment`, {
        credentials: 'include', headers: authHeaders(),
      });
      if (r.ok) {
        const data = await r.json();
        setEnrichmentByLeadId((prev) => ({ ...prev, [leadId]: data.enrichment ?? null }));
      }
    } catch { /* noop */ }
  }, [enrichmentByLeadId]);

  // Trigger BRREG-berikkelse manuelt
  const enrichLead = useCallback(async (leadId: string, force = false) => {
    setEnrichingLeadId(leadId);
    try {
      const r = await fetch(`/api/admin-room/lead-map/leads/${leadId}/enrich`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ force }),
      });
      if (r.ok) {
        const data = await r.json();
        setEnrichmentByLeadId((prev) => ({ ...prev, [leadId]: data.enrichment }));
      }
    } finally {
      setEnrichingLeadId(null);
    }
  }, []);

  // Generer outreach-strategi for lead
  const generateStrategy = useCallback(async (leadId: string) => {
    setStrategyLoading(true);
    setStrategyError(null);
    setStrategy(null);
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/leads/${leadId}/strategy`,
        { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() } },
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setStrategyError(e.error ?? `HTTP ${r.status}`);
        return;
      }
      const data = await r.json();
      setStrategy(data.strategy);
    } catch (e) {
      setStrategyError(String(e));
    } finally {
      setStrategyLoading(false);
    }
  }, []);

  // Generer counter-campaign mot konkurrent
  const generateCounterCampaign = useCallback(async (competitorId: string) => {
    setCounterCampaignLoading(true);
    setCounterCampaignError(null);
    setCounterCampaign(null);
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/competitors/${competitorId}/counter-campaign`,
        { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() } },
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setCounterCampaignError(e.error ?? `HTTP ${r.status}`);
        return;
      }
      const data = await r.json();
      setCounterCampaign(data.campaign);
    } catch (e) {
      setCounterCampaignError(String(e));
    } finally {
      setCounterCampaignLoading(false);
    }
  }, []);

  // Lagre counter-campaign som marketing_workflow
  const saveCounterCampaign = useCallback(async () => {
    if (!counterCampaign || !selectedCompetitor) return;
    setCounterCampaignSaving(true);
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/competitors/${selectedCompetitor.id}/counter-campaign/save`,
        {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ campaign: counterCampaign }),
        },
      );
      if (r.ok) {
        const data = await r.json();
        setCounterCampaignSavedWorkflowId(data.workflowId);
      } else {
        const e = await r.json().catch(() => ({}));
        setCounterCampaignError(e.error ?? `HTTP ${r.status}`);
      }
    } finally {
      setCounterCampaignSaving(false);
    }
  }, [counterCampaign, selectedCompetitor]);

  const fetchMeta = useCallback(async () => {
    try {
      const projParam = activeProjectId ? `?projectId=${encodeURIComponent(activeProjectId)}` : '';
      const [mRes, aRes] = await Promise.all([
        fetch(`/api/admin-room/lead-map/metrics${projParam}`, { credentials: 'include', headers: authHeaders() }),
        fetch('/api/admin-room/lead-map/activities?limit=20', { credentials: 'include', headers: authHeaders() }),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (aRes.ok) {
        const a = await aRes.json();
        setActivities(a.activities ?? []);
      }
    } catch { /* noop */ }
  }, [activeProjectId]);

  useEffect(() => {
    fetchLeads();
    fetchMeta();
    fetchCompetitors();
    fetchLeaderboard();
    fetchCalendar();
    fetchReminders();
    fetchProjects();
  }, [fetchLeads, fetchMeta, fetchCompetitors, fetchLeaderboard, fetchCalendar, fetchReminders, fetchProjects]);

  useEffect(() => {
    if (activeProjectId) {
      void fetchProjectSummary(activeProjectId);
      // Persist valg lokalt
      try { localStorage.setItem('rr_lead_map_active_project', activeProjectId); } catch { /* noop */ }
    } else {
      setProjectSummary(null);
      try { localStorage.removeItem('rr_lead_map_active_project'); } catch { /* noop */ }
    }
  }, [activeProjectId, fetchProjectSummary]);

  // Auto-last BRREG-berikkelse + SSB-demografi når lead velges
  useEffect(() => {
    if (selected?.id) {
      void loadEnrichment(selected.id);
      void loadDemographics(selected.id);
    }
  }, [selected?.id, loadEnrichment, loadDemographics]);

  // Hotkeys — power-user-snarveier (kun aktive når ikke i input/textarea)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // '/' = fokuser søk (alltid, selv i input — for kjent vim/Discord-mønster)
      if (e.key === '/' && !inField) {
        e.preventDefault();
        const searchEl = document.querySelector<HTMLInputElement>('input[placeholder*="Søk leads"]');
        searchEl?.focus();
        return;
      }
      if (inField) return;

      // '?' = vis hotkey-hjelp
      if (e.key === '?' || (e.shiftKey && e.key === '?')) {
        e.preventDefault();
        setHotkeysOpen(true);
        return;
      }

      // Esc = lukk valg + radius-filter
      if (e.key === 'Escape') {
        setSelected(null);
        setSelectedCompetitor(null);
        return;
      }

      // Slett: Delete / Backspace når noe valgt
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedCompetitor) {
          e.preventDefault();
          void deleteCompetitor(selectedCompetitor.id);
          return;
        }
      }

      // Status-bytte 1-6 (krever lead valgt)
      if (selected && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        const statusMap: Record<string, LeadStatus> = {
          '1': 'return',
          '2': 'not_present',
          '3': 'declined',
          '4': 'interested',
          '5': 'meeting_booked',
          '6': 'won',
        };
        const next = statusMap[e.key];
        if (next && selected.status !== next) {
          void updateStatusForLead(selected.id, next);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, selectedCompetitor, deleteCompetitor]);

  const handleBoundsChange = useCallback((b: L.LatLngBounds) => {
    boundsRef.current = b;
    fetchLeads(b);
  }, [fetchLeads]);

  // Tilordne enkelt-lead til prosjekt (eller fjerne tilordning hvis null)
  const assignLeadToProject = useCallback(async (leadId: string, projectId: string | null) => {
    try {
      const r = await fetch(`/api/admin-room/lead-map/leads/${leadId}/project`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) {
        await fetchLeads(boundsRef.current ?? undefined);
        await fetchProjects();
      }
    } catch { /* noop */ }
  }, [fetchLeads, fetchProjects]);

  // Bulk-tildel valgte leads
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkAssignTarget, setBulkAssignTarget] = useState<string>('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const bulkAssignProject = useCallback(async () => {
    if (selectedLeadIds.size === 0) return;
    setBulkAssigning(true);
    try {
      const r = await fetch('/api/admin-room/lead-map/leads/bulk-assign-project', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          leadIds: Array.from(selectedLeadIds),
          projectId: bulkAssignTarget || null,
        }),
      });
      if (r.ok) {
        setSelectedLeadIds(new Set());
        setBulkAssignTarget('');
        await fetchLeads(boundsRef.current ?? undefined);
        await fetchProjects();
      }
    } finally {
      setBulkAssigning(false);
    }
  }, [selectedLeadIds, bulkAssignTarget, fetchLeads, fetchProjects]);

  const updateStatusForLead = async (leadId: string, newStatus: LeadStatus) => {
    setUpdatingStatus(true);
    try {
      const r = await fetch(`/api/admin-room/lead-map/leads/${leadId}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l));
        setSelected((prev) => prev?.id === leadId ? { ...prev, status: newStatus } : prev);
        setQuickStatusFor((prev) => prev?.id === leadId ? { ...prev, status: newStatus } : prev);
        void fetchMeta();

        // Google Ads conversion-firing — kobler Lead Map til Ads ROI-funnel
        // meeting_booked → 'demo'-conversion (booket møte = pipeline-event)
        // won           → 'signup'-conversion (faktisk vunnet kunde)
        // se [[google-ads-conversion-tracking-live]]
        if (newStatus === 'meeting_booked') {
          void fireGoogleAdsConversion('demo', { transactionId: leadId });
        } else if (newStatus === 'won') {
          void fireGoogleAdsConversion('signup', { transactionId: leadId });
        }
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const updateStatus = (newStatus: LeadStatus) =>
    selected ? updateStatusForLead(selected.id, newStatus) : Promise.resolve();

  const logVisit = async () => {
    if (!selected) return;
    setVisitSaving(true);
    try {
      const body: Record<string, unknown> = { visitType: visitForm.visitType };
      if (visitForm.contactPerson) body.contactPerson = visitForm.contactPerson;
      if (visitForm.conversationSummary) body.conversationSummary = visitForm.conversationSummary;
      if (visitForm.objectionReason) body.objectionReason = visitForm.objectionReason;
      if (visitForm.notes) body.notes = visitForm.notes;
      if (visitForm.newStatus) body.newStatus = visitForm.newStatus;
      if (visitForm.nextAction) body.nextAction = visitForm.nextAction;
      if (visitForm.nextFollowUpAt) body.nextFollowUpAt = visitForm.nextFollowUpAt;

      const r = await fetch(`/api/admin-room/lead-map/leads/${selected.id}/visits`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setVisitOpen(false);
        setVisitForm({
          visitType: 'physical', contactPerson: '', conversationSummary: '',
          objectionReason: '', notes: '', newStatus: '', nextAction: '', nextFollowUpAt: '',
        });
        if (visitForm.newStatus) {
          await updateStatusForLead(selected.id, visitForm.newStatus);
        }
        void fetchLeads(boundsRef.current ?? undefined);
        void fetchMeta();
      }
    } finally {
      setVisitSaving(false);
    }
  };

  const generatePitch = async () => {
    if (!selected) return;
    setPitchLoading(true);
    setPitch(null);
    try {
      const r = await fetch(`/api/admin-room/lead-map/leads/${selected.id}/generate-pitch`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ serviceFocus: pitchServiceFocus || undefined }),
      });
      if (r.ok) {
        const body = await r.json();
        setPitch(body);
      } else {
        const body = await r.json().catch(() => ({}));
        setPitch({ opportunityScore: 0, summary: body.error || 'Feilet', suggestedPackage: '', pitchSubject: '', pitchBody: '' });
      }
    } finally {
      setPitchLoading(false);
    }
  };

  const searchPlaces = async () => {
    if (!placesQuery.trim()) return;
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      const body: Record<string, unknown> = { query: placesQuery };
      if (boundsRef.current) {
        const c = boundsRef.current.getCenter();
        body.latitude = c.lat;
        body.longitude = c.lng;
        body.radiusMeters = 10000;
      }
      const r = await fetch('/api/admin-room/lead-map/places/search', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const data = await r.json();
        setPlacesResults(data.results ?? []);
      } else {
        const data = await r.json().catch(() => ({}));
        setPlacesError(data.error ?? `HTTP ${r.status}`);
      }
    } finally {
      setPlacesLoading(false);
    }
  };

  const importPlace = async (place: PlaceResult) => {
    setImportingPlaceId(place.placeId);
    try {
      const r = await fetch('/api/admin-room/lead-map/places/import', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ place, leadCategory: place.category, projectId: activeProjectId }),
      });
      if (r.ok) {
        setPlacesResults((prev) => prev.map((p) =>
          p.placeId === place.placeId ? { ...p, alreadyImported: true } : p
        ));
        void fetchLeads(boundsRef.current ?? undefined);
        void fetchMeta();
      }
    } finally {
      setImportingPlaceId(null);
    }
  };

  // Normalisert søke-streng (lowercased + trimmed). Brukes til både
  // leads og konkurrenter — matcher på navn/by/adresse/kategori/notater.
  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredLeads = useMemo(() => {
    if (!showLeads) return [];
    let pool = leads;
    if (statusFilter.length > 0) {
      pool = pool.filter((l) => statusFilter.includes(l.status));
    }
    if (recommendedOnly) {
      pool = pool.filter((l) => (l.recommendationRank ?? 0) >= 60);
    }
    if (normalizedQuery) {
      pool = pool.filter((l) => {
        const haystack = [
          l.name,
          l.company,
          l.city,
          l.address,
          l.category,
          l.notes,
          STATUS_META[l.status]?.label,
          l.assignedUserName,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }
    if (radiusFilter) {
      pool = pool.filter((l) => {
        const km = haversineKm(radiusFilter.centerLat, radiusFilter.centerLng, l.latitude, l.longitude);
        return km <= radiusFilter.radiusKm;
      });
    }
    return pool;
  }, [leads, statusFilter, showLeads, recommendedOnly, normalizedQuery, radiusFilter]);

  const filteredCompetitors = useMemo(() => {
    if (!showCompetitors) return [];
    let pool = competitors.filter(
      (c) => c.latitude != null && c.longitude != null,
    );
    if (threatFilter.length > 0) {
      pool = pool.filter((c) => c.threatLevel && threatFilter.includes(c.threatLevel));
    }
    if (recommendedOnly) {
      // I "fokus"-modus: vis bare prioriterte eller nære konkurrenter
      pool = pool.filter((c) => c.threatLevel === 'near' || (c.priorityRank ?? 0) > 0);
    }
    if (normalizedQuery) {
      pool = pool.filter((c) => {
        const haystack = [
          c.name,
          c.domain,
          c.category,
          c.positioning,
          c.primaryOffer,
          c.address,
          c.claudeThreatSummary,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }
    if (radiusFilter) {
      pool = pool.filter((c) => {
        if (c.latitude == null || c.longitude == null) return false;
        const km = haversineKm(radiusFilter.centerLat, radiusFilter.centerLng, c.latitude, c.longitude);
        return km <= radiusFilter.radiusKm;
      });
    }
    return pool;
  }, [competitors, showCompetitors, threatFilter, recommendedOnly, normalizedQuery, radiusFilter]);

  // Match-counters for søke-info-banner (bare leads/competitors WITHOUT
  // søk er full liste — så vi kan vise "X av Y treff" når søk er aktivt)
  const totalLeadsCount = useMemo(() => {
    if (!showLeads) return 0;
    let pool = leads;
    if (statusFilter.length > 0) pool = pool.filter((l) => statusFilter.includes(l.status));
    if (recommendedOnly) pool = pool.filter((l) => (l.recommendationRank ?? 0) >= 60);
    return pool.length;
  }, [leads, statusFilter, showLeads, recommendedOnly]);

  const totalCompetitorsCount = useMemo(() => {
    if (!showCompetitors) return 0;
    return competitors.filter((c) => c.latitude != null && c.longitude != null).length;
  }, [competitors, showCompetitors]);

  // Default-senter: Oslo
  const defaultCenter: [number, number] = [59.9139, 10.7522];

  return (
    <Card sx={{ bgcolor: palette.bgPanel, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
      <CardContent>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2.4, gap: 1.4 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.4,
              bgcolor: 'rgba(251,191,36,0.12)',
              border: `1px solid rgba(251,191,36,0.32)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ExploreOutlinedIcon sx={{ color: palette.amber, fontSize: 24 }} />
            </Box>
            <Stack>
              <Typography
                component="h2"
                sx={{ fontWeight: 800, fontSize: '1.25rem', color: palette.textPrimary, lineHeight: 1.1, m: 0 }}
              >
                Lead Map
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, fontStyle: 'italic' }}>
                Discover. Connect. Create Opportunity.
              </Typography>
            </Stack>
          </Stack>

          {/* Filter-bar: All Statuses (multi) + Date range stub + Discover + Refresh */}
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
            <Select
              size="small"
              multiple
              displayEmpty
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value;
                setStatusFilter(typeof v === 'string' ? (v.split(',') as LeadStatus[]) : (v as LeadStatus[]));
              }}
              renderValue={(selected) => {
                const arr = selected as LeadStatus[];
                if (arr.length === 0) return 'All Statuses';
                if (arr.length === 1) return STATUS_META[arr[0]].label;
                return `${arr.length} statuses`;
              }}
              sx={{
                minWidth: 160,
                bgcolor: 'rgba(168,85,247,0.06)',
                color: palette.textSecondary,
                borderRadius: 1.2,
                fontSize: '0.78rem',
                fontWeight: 700,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.border },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
                '& .MuiSvgIcon-root': { color: palette.textMuted },
              }}
            >
              {ALL_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: STATUS_META[s].color }} />
                    <span>{STATUS_META[s].label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{
                color: palette.textSecondary,
                borderColor: palette.border,
                fontWeight: 700,
                fontSize: '0.76rem',
                textTransform: 'none',
              }}
            >
              {(() => {
                const end = new Date();
                const start = new Date(end);
                start.setDate(end.getDate() - 6);
                const fmt = (d: Date) =>
                  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const yearFmt = end.toLocaleDateString('en-US', { year: 'numeric' });
                return `${fmt(start)} – ${fmt(end)}, ${yearFmt}`;
              })()}
            </Button>
            <TextField
              size="small"
              placeholder="Søk leads, by, navn …"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <SearchOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mr: 0.6 }} />
                ),
                endAdornment: searchQuery && (
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    sx={{ color: palette.textMuted, p: 0.2 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                ),
              }}
              sx={{
                minWidth: 200,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(168,85,247,0.06)',
                  color: palette.textPrimary,
                  fontSize: '0.78rem',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.border },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: palette.amber },
                },
              }}
            />
            <Button
              size="small" variant="outlined"
              onClick={() => setPlacesOpen(true)}
              startIcon={<SearchOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: palette.amber, borderColor: 'rgba(251,191,36,0.4)', fontWeight: 700, fontSize: '0.78rem' }}
            >
              Discover leads
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={() => setAddCompOpen(true)}
              startIcon={<AddLocationAltOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', fontWeight: 700, fontSize: '0.78rem' }}
            >
              Legg til konkurrent
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={() => { setStatusReportOpen(true); void fetchStatusReport(); }}
              startIcon={<AssessmentOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: palette.accent, borderColor: palette.borderStrong, fontWeight: 700, fontSize: '0.78rem' }}
            >
              Status-rapport
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={() => setCsvImportOpen(true)}
              startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: palette.textSecondary, borderColor: palette.border, fontWeight: 700, fontSize: '0.78rem' }}
            >
              Import CSV
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={exportLeadsCsv}
              startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: palette.textSecondary, borderColor: palette.border, fontWeight: 700, fontSize: '0.78rem' }}
            >
              Eksport
            </Button>
            <Tooltip title="Koble iPad">
              <IconButton onClick={() => {
                setPairOpen(true);
                void generatePairToken();
              }} sx={{ color: palette.textMuted }}>
                <TabletMacOutlinedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Hurtigtaster (eller trykk ?)">
              <IconButton onClick={() => setHotkeysOpen(true)} sx={{ color: palette.textMuted }}>
                <KeyboardOutlinedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Oppdater">
              <IconButton onClick={() => {
                void fetchLeads(boundsRef.current ?? undefined);
                void fetchMeta();
                void fetchCompetitors();
                void fetchReminders();
              }} sx={{ color: palette.textSecondary }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* By-radius-filter: dropdown + slider + tøm-knapp */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.4, flexWrap: 'wrap', gap: 0.8 }} useFlexGap>
          <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Område
          </Typography>
          <Select
            size="small"
            value={radiusFilter ? KNOWN_CITIES.find(c => Math.abs(c.lat - radiusFilter.centerLat) < 0.01)?.key ?? '' : ''}
            displayEmpty
            onChange={(e) => {
              const cityKey = e.target.value as string;
              if (!cityKey) {
                setRadiusFilter(null);
                return;
              }
              const city = KNOWN_CITIES.find((c) => c.key === cityKey);
              if (city) {
                setRadiusFilter({
                  centerLat: city.lat,
                  centerLng: city.lng,
                  label: city.label,
                  radiusKm: radiusFilter?.radiusKm ?? city.defaultRadiusKm,
                });
              }
            }}
            renderValue={(v) => {
              if (!v) return <Box component="span" sx={{ color: palette.textMuted }}>Velg by …</Box>;
              return KNOWN_CITIES.find((c) => c.key === v)?.label ?? v;
            }}
            sx={{
              minWidth: 160,
              bgcolor: 'rgba(168,85,247,0.06)',
              color: palette.textSecondary,
              borderRadius: 1.2,
              fontSize: '0.78rem',
              fontWeight: 700,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.border },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
              '& .MuiSvgIcon-root': { color: palette.textMuted },
            }}
          >
            <MenuItem value="">
              <em>Alle byer</em>
            </MenuItem>
            {KNOWN_CITIES.map((c) => (
              <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
            ))}
          </Select>
          {radiusFilter && (
            <>
              <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted, minWidth: 60 }}>
                {radiusFilter.radiusKm} km radius
              </Typography>
              <Box sx={{ width: 160, px: 1 }}>
                <Slider
                  size="small"
                  value={radiusFilter.radiusKm}
                  min={1}
                  max={50}
                  step={1}
                  onChange={(_, v) => {
                    if (typeof v === 'number' && radiusFilter) {
                      setRadiusFilter({ ...radiusFilter, radiusKm: v });
                    }
                  }}
                  sx={{
                    color: palette.amber,
                    '& .MuiSlider-thumb': { boxShadow: `0 0 8px ${palette.amber}cc` },
                  }}
                />
              </Box>
              <Button
                size="small" variant="text"
                onClick={() => setRadiusFilter(null)}
                sx={{ color: palette.textMuted, fontSize: '0.72rem', textTransform: 'none' }}
              >
                Tøm
              </Button>
            </>
          )}
        </Stack>

        {/* View-toggles: Lead/Konkurrent/Anbefalt + Rank-leads-CTA */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.8 }} useFlexGap>
          {[
            {
              key: 'leads',
              label: `Leads (${leads.length})`,
              active: showLeads,
              color: palette.amber,
              onClick: () => setShowLeads((v) => !v),
            },
            {
              key: 'competitors',
              label: `Konkurrenter (${competitors.length})`,
              active: showCompetitors,
              color: '#ef4444',
              onClick: () => setShowCompetitors((v) => !v),
            },
            {
              key: 'focus',
              label: 'Kun anbefalte',
              active: recommendedOnly,
              color: palette.accent,
              onClick: () => setRecommendedOnly((v) => !v),
            },
          ].map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              size="small"
              onClick={t.onClick}
              sx={{
                bgcolor: t.active ? t.color : 'rgba(168,85,247,0.06)',
                color: t.active ? '#0a0a0f' : t.color,
                fontWeight: 700, fontSize: '0.72rem',
                border: `1px solid ${t.color}`,
                cursor: 'pointer',
                '&:hover': { bgcolor: t.color, color: '#0a0a0f' },
              }}
            />
          ))}
          {/* Threat-level-filter (kun aktiv når Konkurrenter er på) */}
          {showCompetitors && (
            <>
              {(['near', 'medium', 'far'] as const).map((level) => {
                const active = threatFilter.includes(level);
                const color = THREAT_COLOR[level];
                const label = level === 'near' ? 'Nær' : level === 'medium' ? 'Medium' : 'Fjern';
                return (
                  <Chip
                    key={level}
                    label={label}
                    size="small"
                    onClick={() =>
                      setThreatFilter((prev) =>
                        prev.includes(level)
                          ? prev.filter((p) => p !== level)
                          : [...prev, level],
                      )
                    }
                    sx={{
                      bgcolor: active ? color : 'transparent',
                      color: active ? '#0a0a0f' : color,
                      fontWeight: 700, fontSize: '0.68rem',
                      border: `1px solid ${color}`,
                      cursor: 'pointer',
                      height: 24,
                    }}
                  />
                );
              })}
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small" variant="outlined"
            onClick={rankAllLeads}
            disabled={rankingLeads}
            startIcon={
              rankingLeads
                ? <CircularProgress size={12} sx={{ color: palette.accent }} />
                : <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />
            }
            sx={{ color: palette.accent, borderColor: palette.borderStrong, fontWeight: 700, fontSize: '0.72rem', textTransform: 'none' }}
          >
            {rankingLeads ? 'Ranker …' : 'Ranger leads m/ Claude'}
          </Button>
        </Stack>

        {/* Søke-info-banner — vises kun når aktivt søk gir resultat-undermengde */}
        {normalizedQuery && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{
            mb: 2, p: 1, borderRadius: 1.2,
            bgcolor: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.25)',
          }}>
            <SearchOutlinedIcon sx={{ color: palette.amber, fontSize: 16 }} />
            <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, flex: 1 }}>
              <Box component="span" sx={{ color: palette.amber, fontWeight: 700 }}>
                «{searchQuery}»
              </Box>
              {' '}gir {filteredLeads.length} av {totalLeadsCount} leads
              {totalCompetitorsCount > 0 && (
                <> og {filteredCompetitors.length} av {totalCompetitorsCount} konkurrenter</>
              )}
            </Typography>
            <Button
              size="small" variant="text"
              onClick={() => setSearchQuery('')}
              sx={{ color: palette.amber, fontSize: '0.74rem', textTransform: 'none', minWidth: 0 }}
            >
              Tøm
            </Button>
          </Stack>
        )}

        {/* Prosjekt-kontekst: hvilken bedrift jobber jeg for? */}
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.4, flexWrap: 'wrap', gap: 1 }} useFlexGap>
          <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Prosjekt
          </Typography>
          <Select
            size="small"
            value={activeProjectId ?? ''}
            displayEmpty
            onChange={(e) => {
              const v = e.target.value as string;
              setActiveProjectId(v || null);
            }}
            renderValue={(v) => {
              if (!v) return <Box component="span" sx={{ color: palette.textMuted }}>Alle leads (uten prosjekt-filter)</Box>;
              const p = projects.find((x) => x.id === v);
              return p?.name ?? v;
            }}
            sx={{
              minWidth: 280,
              bgcolor: 'rgba(168,85,247,0.08)',
              color: palette.textPrimary,
              borderRadius: 1.2,
              fontSize: '0.84rem',
              fontWeight: 700,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.accent },
              '& .MuiSvgIcon-root': { color: palette.textMuted },
            }}
          >
            <MenuItem value=""><em>Alle leads (uten prosjekt-filter)</em></MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }}>{p.name}</Typography>
                    {p.description && (
                      <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, lineHeight: 1.1, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.description}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.4}>
                    {p.hasBrandKit && <Chip label="brand" size="small" sx={{ bgcolor: 'rgba(192,132,252,0.18)', color: palette.accent, fontSize: '0.58rem', fontWeight: 800, height: 16 }} />}
                    <Chip label={`${p.leadCount}`} size="small" sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: palette.amber, fontSize: '0.58rem', fontWeight: 800, height: 16 }} />
                  </Stack>
                </Stack>
              </MenuItem>
            ))}
          </Select>
          {projectSummary && (
            <>
              <Button
                size="small" variant="text"
                onClick={() => setProjectCardExpanded((v) => !v)}
                sx={{ color: palette.textMuted, fontSize: '0.72rem', textTransform: 'none' }}
              >
                {projectCardExpanded ? 'Skjul kontekst' : 'Vis kontekst'}
              </Button>
              <Button
                size="small" variant="outlined"
                startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 14 }} />}
                onClick={() => {
                  openLeadMapPdfReport({
                    project: projectSummary.project,
                    brandKit: projectSummary.brandKit,
                    metrics: metrics ?? null,
                    competitorCount: projectSummary.competitorCount,
                    leaderboard: leaderboard ?? [],
                    reminders: reminders ?? null,
                    generatedAt: new Date(),
                    ownerName: currentUser?.displayName ?? currentUser?.name ?? null,
                  });
                }}
                sx={{ color: palette.accent, borderColor: palette.borderStrong, fontWeight: 700, fontSize: '0.72rem', textTransform: 'none' }}
              >
                PDF-rapport
              </Button>
            </>
          )}
        </Stack>

        {/* Prosjekt-kort: bedrift + posisjonering + mål + analyser */}
        {projectSummary && projectCardExpanded && (
          <Box sx={{
            mb: 2.4, p: 2, borderRadius: 1.6,
            bgcolor: 'rgba(192,132,252,0.06)',
            border: `1px solid ${palette.borderStrong}`,
          }}>
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              {projectSummary.brandKit?.logoUrl ? (
                <Box sx={{
                  width: 56, height: 56, borderRadius: 1.2, flexShrink: 0,
                  bgcolor: '#fff',
                  border: `1px solid ${palette.borderStrong}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  p: 0.6,
                }}>
                  <Box
                    component="img"
                    src={projectSummary.brandKit.logoUrl}
                    alt={`${projectSummary.project.name} logo`}
                    sx={{
                      maxWidth: '100%', maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    onError={(e) => {
                      // Fallback: hvis bilde-load feiler, vis initialer
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.logo-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'logo-fallback';
                        fallback.textContent = projectSummary.project.name.slice(0, 2).toUpperCase();
                        fallback.style.cssText = `color:${palette.accent};font-weight:800;font-size:1.2rem;`;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </Box>
              ) : (
                <Box sx={{
                  width: 56, height: 56, borderRadius: 1.2, flexShrink: 0,
                  bgcolor: 'rgba(192,132,252,0.18)',
                  border: `1px solid ${palette.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: palette.accent, fontWeight: 800, fontSize: '1.2rem',
                }}>
                  {projectSummary.project.name.slice(0, 2).toUpperCase()}
                </Box>
              )}
              <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.6}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: palette.textPrimary }}>
                    {projectSummary.project.name}
                  </Typography>
                  {projectSummary.brandKit?.lastScannedAt && (
                    <Chip
                      label={`Brand Kit · ${new Date(projectSummary.brandKit.lastScannedAt).toLocaleDateString('nb-NO')}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(192,132,252,0.18)', color: palette.accent, fontWeight: 700, fontSize: '0.66rem', height: 18 }}
                    />
                  )}
                  {projectSummary.marketScan && (
                    <Chip
                      label={`Scan · ${projectSummary.marketScan.confidence}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: palette.amber, fontWeight: 700, fontSize: '0.66rem', height: 18 }}
                    />
                  )}
                </Stack>
                {projectSummary.brandKit?.positioningSummary && (
                  <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                    {projectSummary.brandKit.positioningSummary}
                  </Typography>
                )}
                {projectSummary.brandKit?.targetAudience && (
                  <Stack direction="row" spacing={0.6} alignItems="flex-start">
                    <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', mt: 0.2 }}>
                      Målgruppe
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      {projectSummary.brandKit.targetAudience}
                    </Typography>
                  </Stack>
                )}
                {projectSummary.brandKit?.valueProposition && (
                  <Stack direction="row" spacing={0.6} alignItems="flex-start">
                    <Typography sx={{ fontSize: '0.66rem', color: palette.amber, fontWeight: 700, textTransform: 'uppercase', mt: 0.2 }}>
                      Mål
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: palette.textPrimary, fontWeight: 600 }}>
                      Finn leads som matcher: {projectSummary.brandKit.valueProposition}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={1.4} sx={{ mt: 0.6 }}>
                  <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                    <Box component="span" sx={{ color: palette.amber, fontWeight: 800 }}>{projectSummary.leads.total}</Box> leads
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                    <Box component="span" sx={{ color: '#ef4444', fontWeight: 800 }}>{projectSummary.competitorCount}</Box> konkurrenter
                  </Typography>
                  {projectSummary.brandKit?.tone && (
                    <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                      Tone: <Box component="span" sx={{ color: palette.textSecondary }}>{projectSummary.brandKit.tone}</Box>
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Box>
        )}

        {/* Reminder-banner — viser stille leads + dagens follow-ups */}
        {reminders && (reminders.totalStale > 0 || reminders.dueToday.length > 0) && (
          <Box sx={{
            mb: 2.4, p: 1.6, borderRadius: 1.4,
            bgcolor: reminders.buckets.over30days > 0
              ? 'rgba(248,113,113,0.08)'
              : reminders.buckets.over14days > 0
              ? 'rgba(251,191,36,0.08)'
              : 'rgba(96,165,250,0.08)',
            border: `1px solid ${
              reminders.buckets.over30days > 0
                ? 'rgba(248,113,113,0.4)'
                : reminders.buckets.over14days > 0
                ? 'rgba(251,191,36,0.4)'
                : 'rgba(96,165,250,0.4)'
            }`,
          }}>
            <Stack direction="row" alignItems="center" spacing={1.4} flexWrap="wrap" useFlexGap>
              <NotificationsActiveOutlinedIcon sx={{
                color: reminders.buckets.over30days > 0
                  ? '#f87171'
                  : reminders.buckets.over14days > 0
                  ? palette.amber
                  : '#60a5fa',
                fontSize: 22,
              }} />
              <Stack sx={{ flex: 1, minWidth: 200 }}>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 800, color: palette.textPrimary }}>
                  {reminders.totalStale > 0
                    ? `${reminders.totalStale} leads venter på oppmerksomhet`
                    : `${reminders.dueToday.length} follow-ups i dag`}
                </Typography>
                <Stack direction="row" spacing={0.6} sx={{ mt: 0.4 }} flexWrap="wrap" useFlexGap>
                  {reminders.buckets.over30days > 0 && (
                    <Chip
                      label={`${reminders.buckets.over30days} over 30d`}
                      size="small"
                      icon={<WarningAmberOutlinedIcon sx={{ fontSize: 12 }} />}
                      sx={{ bgcolor: 'rgba(248,113,113,0.18)', color: '#f87171', fontWeight: 800, fontSize: '0.66rem', height: 20 }}
                    />
                  )}
                  {reminders.buckets.over14days > 0 && (
                    <Chip
                      label={`${reminders.buckets.over14days} over 14d`}
                      size="small"
                      sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: palette.amber, fontWeight: 800, fontSize: '0.66rem', height: 20 }}
                    />
                  )}
                  {reminders.buckets.over7days > 0 && (
                    <Chip
                      label={`${reminders.buckets.over7days} over 7d`}
                      size="small"
                      sx={{ bgcolor: 'rgba(96,165,250,0.18)', color: '#60a5fa', fontWeight: 800, fontSize: '0.66rem', height: 20 }}
                    />
                  )}
                  {reminders.dueToday.length > 0 && (
                    <Chip
                      label={`${reminders.dueToday.length} i dag`}
                      size="small"
                      sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 800, fontSize: '0.66rem', height: 20 }}
                    />
                  )}
                </Stack>
              </Stack>
              {reminders.totalStale > 0 && (
                <Button
                  size="small" variant="outlined"
                  onClick={() => setStaleListOpen(true)}
                  sx={{ color: palette.amber, borderColor: 'rgba(251,191,36,0.4)', fontWeight: 700, fontSize: '0.74rem', textTransform: 'none' }}
                >
                  Vis stille leads
                </Button>
              )}
            </Stack>
          </Box>
        )}

        {/* KPI-stripe */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.4,
          mb: 2.4,
        }}>
          {[
            {
              label: 'Total Leads',
              value: metrics?.totalLeads ?? 0,
              icon: <GroupsOutlinedIcon sx={{ fontSize: 18 }} />,
              color: palette.amber,
              trend: metrics?.trends?.totalLeads ?? null,
              sparkline: metrics?.sparklines?.totalLeads ?? null,
            },
            {
              label: 'Follow-ups',
              value: metrics?.followUpsDue ?? 0,
              icon: <RefreshIcon sx={{ fontSize: 18 }} />,
              color: '#fb923c',
              trend: metrics?.trends?.followUpsDue ?? null,
              sparkline: metrics?.sparklines?.followUpsDue ?? null,
            },
            {
              label: 'Meetings',
              value: metrics?.meetingsBooked ?? 0,
              icon: <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />,
              color: '#a78bfa',
              trend: metrics?.trends?.meetingsBooked ?? null,
              sparkline: metrics?.sparklines?.meetingsBooked ?? null,
            },
            {
              label: 'Conversion Rate',
              value: metrics ? `${metrics.conversionRate}%` : '0%',
              icon: <PieChartOutlineIcon sx={{ fontSize: 18 }} />,
              color: '#34d399',
              trend: metrics?.trends?.conversionRate ?? null,
              sparkline: metrics?.sparklines?.conversionRate ?? null,
            },
          ].map((m) => (
            <Box key={m.label} sx={{
              p: 2, borderRadius: 1.6,
              bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
              position: 'relative', overflow: 'hidden',
              transition: 'border-color 160ms ease, transform 160ms ease',
              '&:hover': { borderColor: palette.borderStrong, transform: 'translateY(-1px)' },
              '&::after': {
                content: '""', position: 'absolute', top: -20, right: -20,
                width: 120, height: 120, borderRadius: '50%',
                background: `radial-gradient(circle, ${m.color}22 0%, transparent 70%)`,
                pointerEvents: 'none',
              },
            }}>
              {/* Top-rad: ikon-boks venstre + trend høyre */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1, mb: 1.2 }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: 1.2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: `${m.color}1f`, color: m.color,
                }}>
                  {m.icon}
                </Box>
                {m.trend != null && (
                  <Stack
                    direction="row" alignItems="center" spacing={0.2}
                    role="img"
                    aria-label={`Endring siste 7 dager: ${m.trend >= 0 ? 'opp' : 'ned'} ${Math.abs(m.trend)} prosent`}
                  >
                    <TrendingUpIcon
                      aria-hidden="true"
                      sx={{
                        fontSize: 14,
                        color: m.trend >= 0 ? '#34d399' : '#f87171',
                        transform: m.trend >= 0 ? 'none' : 'rotate(180deg)',
                      }}
                    />
                    <Typography sx={{ fontSize: '0.74rem', color: m.trend >= 0 ? '#34d399' : '#f87171', fontWeight: 800 }}>
                      {m.trend >= 0 ? '+' : ''}{m.trend}%
                    </Typography>
                  </Stack>
                )}
              </Stack>

              {/* Stort tall + label */}
              <Typography sx={{ fontSize: '2.05rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.05, position: 'relative', zIndex: 1 }}>
                {m.value}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, fontWeight: 600, mt: 0.2, position: 'relative', zIndex: 1 }}>
                {m.label}
              </Typography>

              {/* Sparkline — kun når ekte historikk finnes */}
              {m.sparkline && m.sparkline.length >= 2 && (
                <Box sx={{ mt: 1, position: 'relative', zIndex: 1, height: 24 }}>
                  <svg width="100%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none" style={{ display: 'block' }}>
                    <defs>
                      <linearGradient id={`spark-grad-${m.label.replace(/\s/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={m.color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={m.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const pts = m.sparkline!;
                      const max = Math.max(...pts);
                      const min = Math.min(...pts);
                      const range = max - min || 1;
                      const coords = pts.map((p, i) => {
                        const x = (i / (pts.length - 1)) * 100;
                        const y = 22 - ((p - min) / range) * 18;
                        return [x, y] as const;
                      });
                      const linePoints = coords.map(([x, y]) => `${x},${y}`).join(' ');
                      const areaPoints = `0,24 ${linePoints} 100,24`;
                      return (
                        <>
                          <polygon points={areaPoints} fill={`url(#spark-grad-${m.label.replace(/\s/g, '-')})`} />
                          <polyline
                            points={linePoints}
                            fill="none"
                            stroke={m.color}
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </>
                      );
                    })()}
                  </svg>
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* Map + Detail-panel side-by-side */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4}>
          {/* Map */}
          <Box sx={{
            flex: 1, height: 540, borderRadius: 1.6, overflow: 'hidden',
            border: `1px solid ${palette.border}`, position: 'relative',
            bgcolor: palette.bg,
          }}>
            {error && (
              <Alert severity="warning" sx={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1000 }}>
                {error}
              </Alert>
            )}
            <MapContainer
              center={defaultCenter} zoom={11}
              style={{ height: '100%', width: '100%', background: palette.bg }}
            >
              <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
              <MapBoundsTracker onBoundsChange={handleBoundsChange} />
              {/* Radius-overlay — visualiserer hvilket område filteret matcher */}
              {radiusFilter && (
                <Circle
                  center={[radiusFilter.centerLat, radiusFilter.centerLng]}
                  radius={radiusFilter.radiusKm * 1000}
                  pathOptions={{
                    color: palette.amber,
                    fillColor: palette.amber,
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: '6 6',
                  }}
                />
              )}
              {filteredLeads.map((lead) => (
                <Marker
                  key={lead.id}
                  position={[lead.latitude, lead.longitude]}
                  icon={makePinIcon(lead.status, selected?.id === lead.id)}
                  eventHandlers={{
                    click: () => {
                      setSelected(lead);
                      setSelectedCompetitor(null);
                      setQuickStatusFor(lead);
                    },
                    contextmenu: (e: L.LeafletMouseEvent) => {
                      e.originalEvent.preventDefault();
                      setQuickStatusFor(lead);
                    },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong>{lead.name}</strong><br />
                      {lead.category && <span>{lead.category}<br /></span>}
                      {lead.address && <span style={{ color: '#666' }}>{lead.address}</span>}
                      <Divider sx={{ my: 1 }} />
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Endre status:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {PRIMARY_STATUSES.map((s) => {
                          const meta = STATUS_META[s];
                          return (
                            <button
                              key={s}
                              onClick={() => updateStatusForLead(lead.id, s)}
                              disabled={updatingStatus || lead.status === s}
                              style={{
                                background: lead.status === s ? meta.bg : meta.color,
                                color: lead.status === s ? meta.color : '#0a0a0f',
                                border: 'none', borderRadius: 4,
                                padding: '4px 8px', fontSize: 10, fontWeight: 700,
                                cursor: updatingStatus ? 'wait' : 'pointer',
                              }}
                            >
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Konkurrent-pins (diamant-form, fra Role Room Agent's Market Scan) */}
              {filteredCompetitors.map((comp) => (
                <Marker
                  key={`comp-${comp.id}`}
                  position={[comp.latitude as number, comp.longitude as number]}
                  icon={makeCompetitorIcon(comp.threatLevel, selectedCompetitor?.id === comp.id)}
                  eventHandlers={{
                    click: () => { setSelectedCompetitor(comp); setSelected(null); },
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }}>
                      <strong>{comp.name}</strong>
                      <span style={{
                        marginLeft: 8, padding: '2px 6px', borderRadius: 4,
                        background: comp.threatLevel
                          ? `${THREAT_COLOR[comp.threatLevel]}22`
                          : `${UNASSESSED_COLOR}22`,
                        color: comp.threatLevel
                          ? THREAT_COLOR[comp.threatLevel]
                          : UNASSESSED_COLOR,
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      }}>
                        {comp.threatLevel ?? 'unassessed'}
                      </span>
                      <br />
                      {comp.category && <span style={{ color: '#666', fontSize: 12 }}>{comp.category}</span>}
                      {comp.address && <><br /><span style={{ color: '#666', fontSize: 11 }}>{comp.address}</span></>}
                      {comp.claudeThreatSummary && (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <div style={{ fontSize: 11, color: '#333' }}>{comp.claudeThreatSummary}</div>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Status-legend overlay (top-left, matcher mockup) */}
            <Box sx={{
              position: 'absolute', top: 12, left: 12, zIndex: 1000,
              p: 1.6, borderRadius: 1.4,
              bgcolor: 'rgba(10,10,15,0.78)', backdropFilter: 'blur(10px)',
              border: `1px solid ${palette.borderStrong}`,
              maxWidth: 220,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
                Status Legend
              </Typography>
              <Stack spacing={0.5}>
                {PRIMARY_STATUSES.map((s) => {
                  const meta = STATUS_META[s];
                  const count = metrics?.statusCounts?.[s] ?? 0;
                  return (
                    <Stack key={s} direction="row" alignItems="center" spacing={0.8}>
                      <Box sx={{
                        width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color,
                        boxShadow: `0 0 8px ${meta.color}66`,
                      }} />
                      <Typography sx={{ fontSize: '0.74rem', color: palette.textSecondary, flex: 1 }}>
                        {meta.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 700 }}>
                        {count}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>

            {loading && (
              <Box sx={{
                position: 'absolute', top: 12, right: 12, zIndex: 1000,
                p: 1, borderRadius: 1, bgcolor: 'rgba(10,10,15,0.85)',
              }}>
                <CircularProgress size={20} sx={{ color: palette.amber }} />
              </Box>
            )}
          </Box>

          {/* Detail-panel: konkurrent-view har prioritet hvis valgt */}
          {selectedCompetitor ? (
            <Box sx={{
              width: { xs: '100%', md: 400 }, height: 540,
              borderRadius: 1.6, overflowY: 'auto',
              border: `1px solid ${selectedCompetitor.threatLevel ? THREAT_COLOR[selectedCompetitor.threatLevel] : UNASSESSED_COLOR}55`,
              bgcolor: 'rgba(239,68,68,0.04)', p: 2,
            }}>
              {/* Header */}
              <Stack direction="row" alignItems="flex-start" spacing={1.4} sx={{ mb: 1.6 }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: 1.4, flexShrink: 0,
                  bgcolor: '#0a0a0f',
                  border: `1.5px solid ${selectedCompetitor.threatLevel ? THREAT_COLOR[selectedCompetitor.threatLevel] : UNASSESSED_COLOR}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: 'rotate(45deg)',
                }}>
                  <Box sx={{ transform: 'rotate(-45deg)', color: '#fff', fontWeight: 800, fontSize: '0.8rem' }}>
                    {(selectedCompetitor.name?.[0] ?? '?').toUpperCase()}
                  </Box>
                </Box>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.2 }}>
                    <Chip
                      label="KONKURRENT"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(239,68,68,0.15)',
                        color: '#ef4444',
                        fontWeight: 800, fontSize: '0.6rem', height: 18,
                      }}
                    />
                    {selectedCompetitor.isManualAddition && (
                      <Chip
                        label="MANUELL"
                        size="small"
                        sx={{
                          bgcolor: 'rgba(192,132,252,0.15)',
                          color: palette.accent,
                          fontWeight: 800, fontSize: '0.6rem', height: 18,
                        }}
                      />
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.2 }}>
                    {selectedCompetitor.name}
                  </Typography>
                  {selectedCompetitor.domain && (
                    <Typography
                      component="a"
                      href={`https://${selectedCompetitor.domain.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontSize: '0.78rem', color: palette.textMuted, textDecoration: 'none' }}
                    >
                      {selectedCompetitor.domain}
                    </Typography>
                  )}
                  {selectedCompetitor.threatLevel && (
                    <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 0.6 }}>
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: THREAT_COLOR[selectedCompetitor.threatLevel],
                        boxShadow: `0 0 6px ${THREAT_COLOR[selectedCompetitor.threatLevel]}99`,
                      }} />
                      <Typography sx={{
                        fontSize: '0.74rem', fontWeight: 800,
                        color: THREAT_COLOR[selectedCompetitor.threatLevel],
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {selectedCompetitor.threatLevel === 'near' ? 'Nær trussel' :
                         selectedCompetitor.threatLevel === 'medium' ? 'Medium' : 'Fjern'}
                      </Typography>
                      {selectedCompetitor.threatScore != null && (
                        <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                          ({selectedCompetitor.threatScore}/100)
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Stack>
                <Stack direction="row" spacing={0.4}>
                  <Tooltip title="Slett konkurrent">
                    <IconButton
                      size="small"
                      onClick={() => deleteCompetitor(selectedCompetitor.id)}
                      disabled={deletingCompetitorId === selectedCompetitor.id}
                      sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                    >
                      {deletingCompetitorId === selectedCompetitor.id
                        ? <CircularProgress size={14} sx={{ color: '#ef4444' }} />
                        : <DeleteOutlineIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={() => setSelectedCompetitor(null)} sx={{ color: palette.textMuted }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              {/* Meta */}
              <Stack spacing={1.2} sx={{ mb: 2 }}>
                {selectedCompetitor.address && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <PlaceOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, flex: 1 }}>
                      {selectedCompetitor.address}
                    </Typography>
                  </Stack>
                )}
                {selectedCompetitor.category && (
                  <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted }}>
                    {selectedCompetitor.category}
                  </Typography>
                )}
                {selectedCompetitor.primaryOffer && (
                  <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <Typography sx={{ fontSize: '0.66rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Tilbud
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: palette.textSecondary, mt: 0.2 }}>
                      {selectedCompetitor.primaryOffer}
                    </Typography>
                  </Box>
                )}
                {selectedCompetitor.positioning && (
                  <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(168,85,247,0.04)', border: `1px solid ${palette.border}` }}>
                    <Typography sx={{ fontSize: '0.66rem', color: palette.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Posisjonering
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, mt: 0.2 }}>
                      {selectedCompetitor.positioning}
                    </Typography>
                  </Box>
                )}
              </Stack>

              {/* Claude vurdering */}
              {selectedCompetitor.claudeThreatSummary ? (
                <Stack spacing={1.4}>
                  <Box sx={{ p: 1.4, borderRadius: 1.2, bgcolor: 'rgba(192,132,252,0.06)', border: `1px solid ${palette.borderStrong}` }}>
                    <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.6 }}>
                      <AutoAwesomeOutlinedIcon sx={{ color: palette.accent, fontSize: 14 }} />
                      <Typography sx={{ fontSize: '0.66rem', color: palette.accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Claude vurdering
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.8rem', color: palette.textPrimary, mb: 1 }}>
                      {selectedCompetitor.claudeThreatSummary}
                    </Typography>
                    {selectedCompetitor.claudeWhatToWorryAbout && (
                      <Box sx={{ mt: 1 }}>
                        <Typography sx={{ fontSize: '0.66rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                          Bekymre seg for
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: palette.textSecondary }}>
                          {selectedCompetitor.claudeWhatToWorryAbout}
                        </Typography>
                      </Box>
                    )}
                    {selectedCompetitor.claudeWhatToIgnore && (
                      <Box sx={{ mt: 1 }}>
                        <Typography sx={{ fontSize: '0.66rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                          Ignorer
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: palette.textSecondary }}>
                          {selectedCompetitor.claudeWhatToIgnore}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Button
                    size="small" variant="outlined"
                    onClick={() => assessCompetitor(selectedCompetitor.id)}
                    disabled={assessingCompetitorId === selectedCompetitor.id}
                    startIcon={
                      assessingCompetitorId === selectedCompetitor.id
                        ? <CircularProgress size={12} sx={{ color: palette.accent }} />
                        : <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />
                    }
                    sx={{ color: palette.accent, borderColor: palette.borderStrong, fontWeight: 700, fontSize: '0.74rem', textTransform: 'none' }}
                  >
                    Re-vurder
                  </Button>
                </Stack>
              ) : (
                <Box sx={{ p: 2, borderRadius: 1.2, border: `1px dashed ${palette.border}`, textAlign: 'center' }}>
                  <AutoAwesomeOutlinedIcon sx={{ color: palette.accent, fontSize: 28, mb: 0.8 }} />
                  <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: palette.textPrimary, mb: 0.4 }}>
                    Ikke vurdert ennå
                  </Typography>
                  <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted, mb: 1.4 }}>
                    Få Role Room Agent til å vurdere om dette er en nær trussel — og hva du bør (eller ikke bør) bekymre deg for.
                  </Typography>
                  <Button
                    size="small" variant="contained"
                    onClick={() => assessCompetitor(selectedCompetitor.id)}
                    disabled={assessingCompetitorId === selectedCompetitor.id}
                    startIcon={
                      assessingCompetitorId === selectedCompetitor.id
                        ? <CircularProgress size={12} sx={{ color: '#0a0a0f' }} />
                        : <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />
                    }
                    sx={{ bgcolor: palette.accent, color: '#0a0a0f', fontWeight: 800, fontSize: '0.78rem', textTransform: 'none' }}
                  >
                    Vurder med Claude
                  </Button>
                </Box>
              )}

              {/* Marketing Cockpit-bro: Generer mot-kampanje */}
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  setCounterCampaignOpen(true);
                  setCounterCampaign(null);
                  setCounterCampaignError(null);
                  setCounterCampaignSavedWorkflowId(null);
                  generateCounterCampaign(selectedCompetitor.id);
                }}
                startIcon={<CampaignOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{
                  mt: 2,
                  bgcolor: palette.amber, color: '#0a0a0f',
                  fontWeight: 800, fontSize: '0.82rem', textTransform: 'none',
                  '&:hover': { bgcolor: palette.amber, filter: 'brightness(0.92)' },
                }}
              >
                Generer mot-kampanje
              </Button>
            </Box>
          ) : selected ? (
            <Box sx={{
              width: { xs: '100%', md: 400 }, height: 540,
              borderRadius: 1.6, overflowY: 'auto',
              border: `1px solid ${palette.borderStrong}`,
              bgcolor: palette.bgSubtle, p: 2,
            }}>
              {/* Header med square brand-logo + navn + close */}
              <Stack direction="row" alignItems="flex-start" spacing={1.4} sx={{ mb: 1.6 }}>
                {(() => {
                  // Bygg monogram fra ekte firmanavn: "Framehouse Studios" → "FRAME / HOUSE"
                  // hvis 1 ord m/ camelcase, split. Ellers split på mellomrom.
                  const raw = (selected.name ?? '').toUpperCase();
                  const words = raw.split(/\s+/).filter(Boolean);
                  let line1 = '?';
                  let line2 = '';
                  if (words.length >= 2) {
                    line1 = words[0].slice(0, 8);
                    line2 = words[1].slice(0, 8);
                  } else if (words.length === 1) {
                    const w = words[0];
                    if (w.length > 6) {
                      // split midtveis
                      const mid = Math.ceil(w.length / 2);
                      line1 = w.slice(0, mid);
                      line2 = w.slice(mid, mid + 8);
                    } else {
                      line1 = w;
                    }
                  }
                  const longest = Math.max(line1.length, line2.length);
                  const fontSize = longest > 6 ? '0.56rem' : longest > 4 ? '0.66rem' : '0.78rem';
                  const statusColor = STATUS_META[selected.status].color;
                  return (
                    <Box sx={{
                      width: 56, height: 56, borderRadius: 1.4, flexShrink: 0,
                      bgcolor: '#0a0a0f',
                      border: `1.5px solid ${statusColor}55`,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 0.2,
                      boxShadow: `inset 0 0 12px ${statusColor}1a`,
                    }}>
                      <Typography sx={{ fontSize, lineHeight: 1, fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>
                        {line1}
                      </Typography>
                      {line2 && (
                        <Typography sx={{ fontSize, lineHeight: 1, fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>
                          {line2}
                        </Typography>
                      )}
                    </Box>
                  );
                })()}
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.2 }}>
                    {selected.name}
                  </Typography>
                  {selected.category && (
                    <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      {selected.category}
                    </Typography>
                  )}
                  <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 0.6 }}>
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: STATUS_META[selected.status].color,
                      boxShadow: `0 0 6px ${STATUS_META[selected.status].color}99`,
                    }} />
                    <Typography sx={{
                      fontSize: '0.74rem', fontWeight: 700,
                      color: STATUS_META[selected.status].color,
                    }}>
                      {STATUS_META[selected.status].label}
                    </Typography>
                    {selected.googleRating != null && (
                      <Stack direction="row" alignItems="center" spacing={0.2} sx={{ ml: 1 }}>
                        <StarOutlineIcon sx={{ color: palette.amber, fontSize: 14 }} />
                        <Typography sx={{ fontSize: '0.72rem', color: palette.amber, fontWeight: 700 }}>
                          {selected.googleRating}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={0.4}>
                  <IconButton size="small" sx={{ color: palette.textMuted }}>
                    <BookmarkBorderOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setSelected(null)} sx={{ color: palette.textMuted }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>

              {/* Meta-rader */}
              <Stack spacing={1.2} sx={{ mb: 2 }}>
                {selected.address && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <PlaceOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Address
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                        {selected.address}{selected.city && `, ${selected.city}`}
                      </Typography>
                    </Stack>
                  </Stack>
                )}

                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <PersonOutlineIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Skaffet av
                    </Typography>
                    {(() => {
                      // Ekte eier hvis lead har det — fallback til innlogget bruker.
                      const ownerName =
                        selected.assignedUserName?.trim() ||
                        selected.assignedUserEmail ||
                        repName;
                      const ownerInitials = (() => {
                        if (!selected.assignedUserName && !selected.assignedUserEmail) {
                          return repInitials;
                        }
                        const src = (selected.assignedUserName ?? selected.assignedUserEmail ?? '?').trim();
                        const parts = src.split(/[\s@.]+/).filter(Boolean);
                        if (parts.length === 0) return '?';
                        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
                        return (parts[0][0] + parts[1][0]).toUpperCase();
                      })();
                      const isMe = !selected.assignedUserId || selected.assignedUserId === currentUser?.id;
                      return (
                        <Stack direction="row" alignItems="center" spacing={0.8}>
                          <Box sx={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: isMe
                              ? `linear-gradient(135deg, ${palette.accent}, ${palette.amber})`
                              : `linear-gradient(135deg, #60a5fa, #34d399)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#0a0a0f', fontWeight: 800, fontSize: '0.62rem',
                            flexShrink: 0,
                          }}>
                            {ownerInitials}
                          </Box>
                          <Stack sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ownerName}
                              {isMe && (
                                <Box component="span" sx={{ ml: 0.6, color: palette.amber, fontSize: '0.7rem', fontWeight: 700 }}>
                                  (du)
                                </Box>
                              )}
                            </Typography>
                            {selected.assignedUserEmail && selected.assignedUserName && (
                              <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {selected.assignedUserEmail}
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                      );
                    })()}
                  </Stack>
                </Stack>

                {/* Kontakt-info fra Google Places (vises kun når DB har data) */}
                {selected.phone && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <PhoneOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Phone
                      </Typography>
                      <Typography
                        component="a"
                        href={`tel:${selected.phone}`}
                        sx={{ fontSize: '0.82rem', color: palette.textSecondary, textDecoration: 'none', '&:hover': { color: palette.amber } }}
                      >
                        {selected.phone}
                      </Typography>
                    </Stack>
                  </Stack>
                )}
                {selected.email && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <EmailOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Email
                      </Typography>
                      <Typography
                        component="a"
                        href={`mailto:${selected.email}`}
                        sx={{ fontSize: '0.82rem', color: palette.textSecondary, textDecoration: 'none', '&:hover': { color: palette.amber } }}
                      >
                        {selected.email}
                      </Typography>
                    </Stack>
                  </Stack>
                )}
                {selected.websiteUrl && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <LanguageOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Website
                      </Typography>
                      <Typography
                        component="a"
                        href={selected.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ fontSize: '0.82rem', color: palette.textSecondary, textDecoration: 'none', '&:hover': { color: palette.amber }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                      >
                        {selected.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </Typography>
                    </Stack>
                  </Stack>
                )}
                {selected.instagramUrl && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <InstagramIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Instagram
                      </Typography>
                      <Typography
                        component="a"
                        href={selected.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ fontSize: '0.82rem', color: palette.textSecondary, textDecoration: 'none', '&:hover': { color: palette.amber }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                      >
                        {selected.instagramUrl.replace(/^https?:\/\/(?:www\.)?instagram\.com\//, '@').replace(/\/$/, '')}
                      </Typography>
                    </Stack>
                  </Stack>
                )}

                {selected.lastVisitAt && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <HistoryToggleOffOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Last Visit
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                        {new Date(selected.lastVisitAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({formatRelative(selected.lastVisitAt)})
                      </Typography>
                    </Stack>
                  </Stack>
                )}

                {(selected.nextAction || selected.nextFollowUpAt) && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <EventAvailableOutlinedIcon sx={{ color: palette.amber, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Next Action
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: palette.textPrimary }}>
                        {selected.nextAction ?? 'Follow-up'}
                        {selected.nextFollowUpAt && ` · ${new Date(selected.nextFollowUpAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </Typography>
                    </Stack>
                  </Stack>
                )}

                {selected.notes && (
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <StickyNote2OutlinedIcon sx={{ color: palette.textMuted, fontSize: 16, mt: 0.2 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Notes
                      </Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, whiteSpace: 'pre-wrap', mt: 0.2 }}>
                        {selected.notes}
                      </Typography>
                      {selected.tags && selected.tags.length > 0 && (
                        <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
                          {selected.tags.map((t) => (
                            <Chip
                              key={t} label={t} size="small"
                              sx={{
                                bgcolor: 'rgba(192,132,252,0.12)',
                                color: palette.accent,
                                fontWeight: 700, fontSize: '0.66rem',
                                height: 20,
                              }}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                )}
              </Stack>

              {/* Claude rec-rank — vises kun når Agent har rangert leaden */}
              {selected.recommendationRank != null && (
                <Box sx={{
                  mb: 2, p: 1.4, borderRadius: 1.2,
                  bgcolor: 'rgba(192,132,252,0.08)',
                  border: `1px solid ${palette.borderStrong}`,
                }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AutoAwesomeOutlinedIcon sx={{ color: palette.accent, fontSize: 20 }} />
                    <Stack sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Anbefalt prioritet
                      </Typography>
                      <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: palette.accent, lineHeight: 1 }}>
                        {selected.recommendationRank}/100
                      </Typography>
                    </Stack>
                  </Stack>
                  {selected.recommendationReason && (
                    <Typography sx={{ fontSize: '0.76rem', color: palette.textSecondary, mt: 0.8 }}>
                      {selected.recommendationReason}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Firma-data (BRREG-berikkelse) */}
              {(() => {
                const enrichment = enrichmentByLeadId[selected.id];
                const isLoading = enrichingLeadId === selected.id;
                // Hvis ikke lastet ennå → vis "Hent firma-data"-CTA
                if (enrichment === undefined) {
                  return (
                    <Box sx={{
                      mb: 2, p: 1.4, borderRadius: 1.2,
                      bgcolor: 'rgba(96,165,250,0.06)',
                      border: '1px dashed rgba(96,165,250,0.4)',
                    }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <DomainOutlinedIcon sx={{ color: '#60a5fa', fontSize: 18 }} />
                        <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, flex: 1 }}>
                          Henter firma-data fra BRREG …
                        </Typography>
                        <CircularProgress size={14} sx={{ color: '#60a5fa' }} />
                      </Stack>
                    </Box>
                  );
                }
                // Aldri berikket — vis CTA for å trigge
                if (enrichment === null) {
                  return (
                    <Box sx={{
                      mb: 2, p: 1.4, borderRadius: 1.2,
                      bgcolor: 'rgba(96,165,250,0.06)',
                      border: '1px dashed rgba(96,165,250,0.4)',
                    }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <DomainOutlinedIcon sx={{ color: '#60a5fa', fontSize: 18 }} />
                        <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, flex: 1 }}>
                          Ingen firma-data ennå
                        </Typography>
                        <Button
                          size="small" variant="text"
                          onClick={() => void enrichLead(selected.id)}
                          disabled={isLoading}
                          startIcon={isLoading ? <CircularProgress size={12} sx={{ color: '#60a5fa' }} /> : null}
                          sx={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.74rem', textTransform: 'none' }}
                        >
                          {isLoading ? 'Henter …' : 'Hent fra BRREG'}
                        </Button>
                      </Stack>
                    </Box>
                  );
                }
                // Ikke funnet i BRREG
                if (!enrichment.found) {
                  return (
                    <Box sx={{
                      mb: 2, p: 1.2, borderRadius: 1.2,
                      bgcolor: 'rgba(148,163,184,0.06)',
                      border: '1px solid rgba(148,163,184,0.3)',
                    }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <DomainOutlinedIcon sx={{ color: '#94a3b8', fontSize: 16 }} />
                        <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted, flex: 1, fontStyle: 'italic' }}>
                          Ikke registrert i BRREG (sjekket {new Date(enrichment.fetchedAt).toLocaleDateString('nb-NO')})
                        </Typography>
                        <Button
                          size="small" variant="text"
                          onClick={() => void enrichLead(selected.id, true)}
                          disabled={isLoading}
                          sx={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'none', minWidth: 0 }}
                        >
                          Sjekk på nytt
                        </Button>
                      </Stack>
                    </Box>
                  );
                }
                // Berikket — vis hele firma-data-kortet
                const c = enrichment.company!;
                const statusColor = c.status === 'active'
                  ? '#34d399'
                  : c.status === 'in_liquidation'
                  ? palette.amber
                  : '#f87171';
                const statusLabel = c.status === 'active'
                  ? 'Aktivt'
                  : c.status === 'in_liquidation'
                  ? 'Under avvikling'
                  : 'Konkurs';
                return (
                  <Box sx={{
                    mb: 2, p: 1.6, borderRadius: 1.4,
                    bgcolor: 'rgba(96,165,250,0.06)',
                    border: '1px solid rgba(96,165,250,0.32)',
                  }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={0.8}>
                        <DomainOutlinedIcon sx={{ color: '#60a5fa', fontSize: 18 }} />
                        <Typography sx={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Firma (BRREG)
                        </Typography>
                        <Chip
                          label={statusLabel}
                          size="small"
                          sx={{
                            bgcolor: `${statusColor}22`,
                            color: statusColor,
                            fontWeight: 800, fontSize: '0.62rem', height: 18,
                          }}
                        />
                      </Stack>
                      <Tooltip title="Oppdater fra BRREG">
                        <IconButton
                          size="small"
                          onClick={() => void enrichLead(selected.id, true)}
                          disabled={isLoading}
                          sx={{ color: palette.textMuted }}
                        >
                          {isLoading ? <CircularProgress size={12} /> : <RefreshIcon sx={{ fontSize: 14 }} />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: palette.textPrimary }}>
                      {c.name}
                    </Typography>
                    <Stack direction="row" spacing={1.2} sx={{ mt: 0.4 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                        Org-nr {c.orgNr.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}
                      </Typography>
                      {c.registeredAt && (
                        <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                          · Reg. {new Date(c.registeredAt).getFullYear()}
                        </Typography>
                      )}
                    </Stack>
                    {c.naceDescription && (
                      <Typography sx={{ fontSize: '0.74rem', color: palette.textSecondary, mt: 0.6 }}>
                        {c.naceDescription}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      {c.employees != null && (
                        <Box>
                          <Typography sx={{ fontSize: '0.6rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                            Ansatte
                          </Typography>
                          <Typography sx={{ fontSize: '0.96rem', fontWeight: 800, color: palette.textPrimary }}>
                            {c.employees}
                          </Typography>
                        </Box>
                      )}
                      {c.orgForm && (
                        <Box>
                          <Typography sx={{ fontSize: '0.6rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                            Form
                          </Typography>
                          <Typography sx={{ fontSize: '0.82rem', color: palette.textPrimary, fontWeight: 700 }}>
                            {c.orgForm}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                    {enrichment.contacts && enrichment.contacts.length > 0 && (
                      <Box sx={{ mt: 1.2, pt: 1, borderTop: '1px solid rgba(96,165,250,0.18)' }}>
                        <Typography sx={{ fontSize: '0.62rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.6 }}>
                          Nøkkelpersoner
                        </Typography>
                        <Stack spacing={0.4}>
                          {enrichment.contacts.slice(0, 4).map((p, i) => (
                            <Stack key={i} direction="row" justifyContent="space-between">
                              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                                {p.name}
                              </Typography>
                              <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                                {p.role}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                );
              })()}

              {/* SSB demografi — markedspotensial for lead-by */}
              {(() => {
                const demo = demographicsByLeadId[selected.id];
                if (demo === undefined || !demo) return null;
                if (!demo.found) return null;
                const potColor = demo.marketPotential != null
                  ? demo.marketPotential >= 70 ? '#34d399'
                  : demo.marketPotential >= 40 ? palette.amber
                  : '#94a3b8'
                  : '#94a3b8';
                return (
                  <Box sx={{
                    mb: 2, p: 1.4, borderRadius: 1.2,
                    bgcolor: 'rgba(52,211,153,0.04)',
                    border: '1px solid rgba(52,211,153,0.28)',
                  }}>
                    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.6 }}>
                      <GroupOutlinedIcon sx={{ color: '#34d399', fontSize: 16 }} />
                      <Typography sx={{ fontSize: '0.66rem', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Marked (SSB)
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography sx={{ fontSize: '0.62rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                          Befolkning {demo.city}
                        </Typography>
                        <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1 }}>
                          {demo.population != null ? demo.population.toLocaleString('nb-NO') : '—'}
                        </Typography>
                      </Box>
                      {demo.marketPotential != null && (
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: '0.62rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                            Markeds­potensial
                          </Typography>
                          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: potColor, lineHeight: 1 }}>
                            {demo.marketPotential}/100
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                );
              })()}

              {/* Anbefal outreach-strategi (Claude) */}
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  setStrategyOpen(true);
                  setStrategy(null);
                  setStrategyError(null);
                  void generateStrategy(selected.id);
                }}
                startIcon={<TipsAndUpdatesOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{
                  mb: 2,
                  bgcolor: palette.accent, color: '#0a0a0f',
                  fontWeight: 800, fontSize: '0.82rem', textTransform: 'none',
                  '&:hover': { bgcolor: palette.accent, filter: 'brightness(0.92)' },
                }}
              >
                Anbefal strategi
              </Button>

              {/* Tilordne prosjekt — viser som info-strip + Select */}
              <Box sx={{
                mb: 2, p: 1.2, borderRadius: 1.2,
                bgcolor: 'rgba(192,132,252,0.06)',
                border: `1px solid ${palette.border}`,
              }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Prosjekt
                  </Typography>
                  <Select
                    size="small"
                    value={selected.projectId ?? ''}
                    displayEmpty
                    onChange={(e) => {
                      const v = e.target.value as string;
                      void assignLeadToProject(selected.id, v || null);
                    }}
                    renderValue={(v) => {
                      if (!v) return <Box component="span" sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>Ikke tilordnet</Box>;
                      const p = projects.find((x) => x.id === v);
                      return <Box component="span" sx={{ fontSize: '0.74rem', fontWeight: 700, color: palette.accent }}>{p?.name ?? v}</Box>;
                    }}
                    sx={{
                      flex: 1,
                      bgcolor: 'rgba(168,85,247,0.06)',
                      height: 30,
                      borderRadius: 1,
                      fontSize: '0.74rem',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.border },
                    }}
                  >
                    <MenuItem value=""><em>Ikke tilordnet</em></MenuItem>
                    {projects.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        <span style={{ fontWeight: 700 }}>{p.name}</span>
                        {p.hasBrandKit && (
                          <Box component="span" sx={{ ml: 1, color: palette.accent, fontSize: '0.62rem', fontWeight: 800 }}>· brand</Box>
                        )}
                      </MenuItem>
                    ))}
                  </Select>
                </Stack>
              </Box>

              {/* UPDATE STATUS — 6 store sirkel-knapper m/ ikon over label */}
              <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                Update Status
              </Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 0.6, mb: 2,
              }}>
                {PRIMARY_STATUSES.map((s) => {
                  const meta = STATUS_META[s];
                  const active = selected.status === s;
                  const StatusIcon =
                    s === 'return' ? RefreshIcon
                    : s === 'not_present' ? RemoveCircleOutlineIcon
                    : s === 'declined' ? CancelOutlinedIcon
                    : s === 'interested' ? FavoriteBorderOutlinedIcon
                    : s === 'meeting_booked' ? CalendarMonthOutlinedIcon
                    : EmojiEventsOutlinedIcon;
                  // Forkortet label for trang plass
                  const shortLabel =
                    s === 'meeting_booked' ? 'Meeting'
                    : s === 'not_present' ? 'Not\nPresent'
                    : meta.label;
                  return (
                    <Box
                      key={s}
                      onClick={() => !active && !updatingStatus && updateStatus(s)}
                      sx={{
                        cursor: active || updatingStatus ? 'default' : 'pointer',
                        p: 1, borderRadius: 1.2,
                        bgcolor: active ? `${meta.color}1f` : 'rgba(10,10,15,0.4)',
                        border: `1px solid ${active ? meta.color : palette.border}`,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 0.6,
                        transition: 'all 140ms ease',
                        opacity: updatingStatus && !active ? 0.5 : 1,
                        '&:hover': active || updatingStatus ? {} : {
                          borderColor: meta.color,
                          bgcolor: `${meta.color}14`,
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{
                        width: 32, height: 32, borderRadius: '50%',
                        bgcolor: `${meta.color}22`,
                        border: `1.5px solid ${meta.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: meta.color,
                        boxShadow: active ? `0 0 12px ${meta.color}77` : 'none',
                      }}>
                        <StatusIcon sx={{ fontSize: 16 }} />
                      </Box>
                      <Typography sx={{
                        fontSize: '0.62rem',
                        color: active ? meta.color : palette.textSecondary,
                        fontWeight: 700, textAlign: 'center',
                        lineHeight: 1.1,
                        whiteSpace: 'pre-line',
                      }}>
                        {shortLabel}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* 4 CTA-grid */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 0.8,
              }}>
                <Button
                  size="small" variant="contained"
                  startIcon={<AssignmentOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setVisitOpen(true)}
                  sx={{
                    bgcolor: palette.amber, color: '#0a0a0f',
                    fontWeight: 700, fontSize: '0.76rem', textTransform: 'none',
                    '&:hover': { bgcolor: palette.amber, filter: 'brightness(0.92)' },
                  }}
                >
                  Log Visit
                </Button>
                <Button
                  size="small" variant="outlined"
                  startIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setVisitOpen(true)}
                  sx={{
                    color: palette.textSecondary, borderColor: palette.borderStrong,
                    fontWeight: 700, fontSize: '0.76rem', textTransform: 'none',
                  }}
                >
                  Schedule Meeting
                </Button>
                <Button
                  size="small" variant="outlined"
                  startIcon={<ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setPitchOpen(true)}
                  sx={{
                    color: palette.textSecondary, borderColor: palette.borderStrong,
                    fontWeight: 700, fontSize: '0.76rem', textTransform: 'none',
                  }}
                >
                  Send Message
                </Button>
                <Button
                  size="small" variant="outlined"
                  startIcon={<NoteAddOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setVisitOpen(true)}
                  sx={{
                    color: palette.textSecondary, borderColor: palette.borderStrong,
                    fontWeight: 700, fontSize: '0.76rem', textTransform: 'none',
                  }}
                >
                  Add Note
                </Button>
              </Box>

              {/* AI Opportunity-bar (skjult under CTA) */}
              {selected.aiOpportunityScore != null && (
                <Box sx={{ mt: 1.6, p: 1.2, borderRadius: 1.2, bgcolor: 'rgba(192,132,252,0.08)', border: `1px solid ${palette.borderStrong}` }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AutoAwesomeOutlinedIcon sx={{ color: palette.accent, fontSize: 18 }} />
                    <Stack sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: palette.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        AI Opportunity Score
                      </Typography>
                      <Typography sx={{ fontSize: '1.1rem', color: palette.accent, fontWeight: 800, lineHeight: 1 }}>
                        {selected.aiOpportunityScore}/100
                      </Typography>
                    </Stack>
                    <Button
                      size="small" variant="text"
                      onClick={() => setPitchOpen(true)}
                      sx={{ color: palette.accent, fontWeight: 700, fontSize: '0.72rem', textTransform: 'none' }}
                    >
                      Generate pitch
                    </Button>
                  </Stack>
                </Box>
              )}

              {selected.websiteUrl && (
                <Button
                  fullWidth
                  size="small" variant="text"
                  startIcon={<LanguageOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => window.open(selected.websiteUrl!, '_blank')}
                  sx={{ color: palette.textMuted, fontSize: '0.72rem', textTransform: 'none', mt: 1, justifyContent: 'flex-start' }}
                >
                  {selected.websiteUrl}
                </Button>
              )}
            </Box>
          ) : (
            <Box sx={{
              width: { xs: '100%', md: 400 }, height: 540,
              borderRadius: 1.6,
              border: `1px dashed ${palette.border}`,
              bgcolor: 'rgba(168,85,247,0.02)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              p: 3, gap: 1.4, textAlign: 'center',
            }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '50%',
                bgcolor: 'rgba(192,132,252,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PlaceOutlinedIcon sx={{ color: palette.accent, fontSize: 28 }} />
              </Box>
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, color: palette.textPrimary }}>
                Velg en lead på kartet
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, maxWidth: 240 }}>
                Klikk på en pin for å se detaljer, oppdatere status og logge besøk.
              </Typography>
              <Button
                size="small" variant="outlined"
                startIcon={<SearchOutlinedIcon sx={{ fontSize: 14 }} />}
                onClick={() => setPlacesOpen(true)}
                sx={{ color: palette.amber, borderColor: 'rgba(251,191,36,0.4)', fontWeight: 700, fontSize: '0.74rem', mt: 1 }}
              >
                Discover new leads
              </Button>
            </Box>
          )}
        </Stack>

        {/* Visit log modal */}
        <Dialog open={visitOpen} onClose={() => setVisitOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Log Visit — {selected?.name}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Select
                size="small" fullWidth value={visitForm.visitType}
                onChange={(e) => setVisitForm({ ...visitForm, visitType: e.target.value as typeof visitForm.visitType })}
              >
                <MenuItem value="physical">Fysisk besøk</MenuItem>
                <MenuItem value="phone">Telefon</MenuItem>
                <MenuItem value="email">E-post</MenuItem>
                <MenuItem value="online_meeting">Online-møte</MenuItem>
                <MenuItem value="research">Research</MenuItem>
              </Select>
              <TextField size="small" fullWidth label="Kontaktperson"
                value={visitForm.contactPerson} onChange={(e) => setVisitForm({ ...visitForm, contactPerson: e.target.value })} />
              <TextField size="small" fullWidth multiline rows={3} label="Samtale-sammendrag"
                value={visitForm.conversationSummary} onChange={(e) => setVisitForm({ ...visitForm, conversationSummary: e.target.value })} />
              <TextField size="small" fullWidth label="Innvending / årsak (valgfritt)"
                value={visitForm.objectionReason} onChange={(e) => setVisitForm({ ...visitForm, objectionReason: e.target.value })} />
              <TextField size="small" fullWidth label="Neste handling"
                value={visitForm.nextAction} onChange={(e) => setVisitForm({ ...visitForm, nextAction: e.target.value })} />
              <Stack direction="row" spacing={1}>
                <Select size="small" fullWidth displayEmpty
                  value={visitForm.newStatus}
                  onChange={(e) => setVisitForm({ ...visitForm, newStatus: e.target.value as LeadStatus })}>
                  <MenuItem value="">Behold status</MenuItem>
                  {ALL_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>
                  ))}
                </Select>
                <TextField size="small" fullWidth type="datetime-local" label="Follow-up"
                  InputLabelProps={{ shrink: true }}
                  value={visitForm.nextFollowUpAt}
                  onChange={(e) => setVisitForm({ ...visitForm, nextFollowUpAt: e.target.value })} />
              </Stack>
              <TextField size="small" fullWidth multiline rows={2} label="Interne notater"
                value={visitForm.notes} onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setVisitOpen(false)}>Avbryt</Button>
            <Button onClick={logVisit} variant="contained" disabled={visitSaving}
              startIcon={visitSaving ? <CircularProgress size={14} /> : null}
              sx={{ bgcolor: palette.amber, color: '#0a0a0f', fontWeight: 700 }}>
              Lagre besøk
            </Button>
          </DialogActions>
        </Dialog>

        {/* AI Pitch dialog */}
        <Dialog open={pitchOpen} onClose={() => setPitchOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AutoAwesomeOutlinedIcon sx={{ color: palette.accent }} />
              <span>AI Pitch — {selected?.name}</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <TextField
              size="small" fullWidth sx={{ mt: 1 }}
              label="Fokus-område (valgfritt — f.eks. 'sosial-media-pakke', 'B2B-akkvisisjon')"
              value={pitchServiceFocus}
              onChange={(e) => setPitchServiceFocus(e.target.value)}
            />
            <Button
              onClick={generatePitch} variant="contained"
              disabled={pitchLoading}
              startIcon={pitchLoading ? <CircularProgress size={14} /> : <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />}
              sx={{ mt: 2, bgcolor: palette.accent, fontWeight: 700 }}
            >
              {pitchLoading ? 'Genererer …' : 'Generer pitch med Claude'}
            </Button>
            {pitch && (
              <Box sx={{ mt: 2 }}>
                {pitch.opportunityScore > 0 && (
                  <Box sx={{ p: 1.6, mb: 2, borderRadius: 1.4, bgcolor: 'rgba(192,132,252,0.08)', border: `1px solid ${palette.borderStrong}` }}>
                    <Typography sx={{ fontSize: '0.7rem', color: palette.accent, fontWeight: 700, textTransform: 'uppercase' }}>
                      Opportunity Score
                    </Typography>
                    <Typography sx={{ fontSize: '2rem', color: palette.accent, fontWeight: 800, lineHeight: 1 }}>
                      {pitch.opportunityScore}/100
                    </Typography>
                    <Typography sx={{ fontSize: '0.84rem', color: 'text.primary', mt: 1 }}>
                      {pitch.summary}
                    </Typography>
                  </Box>
                )}
                {pitch.suggestedPackage && (
                  <Box sx={{ p: 1.6, mb: 2, borderRadius: 1.4, bgcolor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.32)' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: palette.amber, fontWeight: 700, textTransform: 'uppercase' }}>
                      Foreslått pakke
                    </Typography>
                    <Typography sx={{ fontSize: '0.86rem', mt: 0.4 }}>
                      {pitch.suggestedPackage}
                    </Typography>
                  </Box>
                )}
                {pitch.pitchBody && (
                  <Box sx={{ p: 1.6, borderRadius: 1.4, bgcolor: 'background.paper', border: '1px solid #ddd' }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {pitch.pitchSubject || 'Pitch'}
                      </Typography>
                      <IconButton size="small" onClick={() => navigator.clipboard.writeText(`Emne: ${pitch.pitchSubject}\n\n${pitch.pitchBody}`)}>
                        <ContentCopyOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Typography sx={{ fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
                      {pitch.pitchBody}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setPitchOpen(false); setPitch(null); }}>Lukk</Button>
          </DialogActions>
        </Dialog>

        {/* Add-competitor dialog — manuell add m/ auto-Places-lookup */}
        <Dialog
          open={addCompOpen}
          onClose={() => !addCompSaving && setAddCompOpen(false)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AddLocationAltOutlinedIcon sx={{ color: '#ef4444' }} />
              <span>Legg til konkurrent</span>
            </Stack>
            <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, mt: 0.4 }}>
              Role Room Agent slår opp navn + region i Google Places automatisk
              for å finne lokasjon, kontaktinfo og rating.
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {addCompError && (
                <Alert severity="error" onClose={() => setAddCompError(null)}>
                  {addCompError}
                </Alert>
              )}
              <TextField
                size="small" fullWidth autoFocus required
                label="Navn"
                placeholder="F.eks. Holy Crust"
                value={addCompForm.name}
                onChange={(e) => setAddCompForm({ ...addCompForm, name: e.target.value })}
                disabled={addCompSaving}
              />
              <TextField
                size="small" fullWidth
                label="Domene"
                placeholder="holycrust.no (valgfri)"
                value={addCompForm.domain}
                onChange={(e) => setAddCompForm({ ...addCompForm, domain: e.target.value })}
                disabled={addCompSaving}
                helperText="Hvis tom: bruker lower-cased navn som sortbar nøkkel"
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small" fullWidth
                  label="Kategori"
                  placeholder="F.eks. pizzeria, byrå"
                  value={addCompForm.category}
                  onChange={(e) => setAddCompForm({ ...addCompForm, category: e.target.value })}
                  disabled={addCompSaving}
                />
                <TextField
                  size="small" fullWidth
                  label="Region"
                  placeholder="Oslo, Norge"
                  value={addCompForm.region}
                  onChange={(e) => setAddCompForm({ ...addCompForm, region: e.target.value })}
                  disabled={addCompSaving}
                  helperText="For Google Places-oppslag"
                />
              </Stack>
              <Select
                size="small" fullWidth displayEmpty
                value={addCompForm.threatLevel}
                onChange={(e) => setAddCompForm({
                  ...addCompForm,
                  threatLevel: e.target.value as '' | 'near' | 'medium' | 'far',
                })}
                disabled={addCompSaving}
              >
                <MenuItem value="">
                  <em>Trussel-nivå (Claude vurderer hvis tom)</em>
                </MenuItem>
                <MenuItem value="near">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef4444' }} />
                    <span>Nær — direkte konkurrent</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="medium">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                    <span>Medium — indirekte</span>
                  </Stack>
                </MenuItem>
                <MenuItem value="far">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#94a3b8' }} />
                    <span>Fjern — randzone</span>
                  </Stack>
                </MenuItem>
              </Select>
              <TextField
                size="small" fullWidth multiline rows={2}
                label="Posisjonering (valgfri)"
                placeholder="Hvordan posisjonerer de seg? Hva er deres &quot;hook&quot;?"
                value={addCompForm.positioning}
                onChange={(e) => setAddCompForm({ ...addCompForm, positioning: e.target.value })}
                disabled={addCompSaving}
              />
              <TextField
                size="small" fullWidth multiline rows={2}
                label="Hovedtilbud (valgfri)"
                placeholder="Hva er deres primære tjeneste/produkt?"
                value={addCompForm.primaryOffer}
                onChange={(e) => setAddCompForm({ ...addCompForm, primaryOffer: e.target.value })}
                disabled={addCompSaving}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setAddCompOpen(false)}
              disabled={addCompSaving}
              sx={{ color: palette.textMuted }}
            >
              Avbryt
            </Button>
            <Button
              onClick={submitAddCompetitor}
              variant="contained"
              disabled={addCompSaving || !addCompForm.name.trim()}
              startIcon={addCompSaving ? <CircularProgress size={14} /> : <AddLocationAltOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{
                bgcolor: '#ef4444',
                color: '#fff',
                fontWeight: 700,
                '&:hover': { bgcolor: '#ef4444', filter: 'brightness(0.92)' },
              }}
            >
              {addCompSaving ? 'Legger til …' : 'Legg til konkurrent'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Counter-campaign-dialog — Lead Map ↔ Marketing Cockpit-bro */}
        <Dialog
          open={counterCampaignOpen}
          onClose={() => !counterCampaignLoading && setCounterCampaignOpen(false)}
          maxWidth="md" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CampaignOutlinedIcon sx={{ color: palette.amber }} />
              <span>Mot-kampanje{counterCampaign ? `: ${counterCampaign.competitorName}` : ''}</span>
            </Stack>
            <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, mt: 0.4 }}>
              Role Room Agent foreslår hvordan du kan nå konkurrentens kunder.
            </Typography>
          </DialogTitle>
          <DialogContent>
            {counterCampaignLoading && (
              <Stack alignItems="center" spacing={1.4} sx={{ p: 4 }}>
                <CircularProgress sx={{ color: palette.amber }} />
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                  Claude analyserer konkurrenten og genererer kampanje …
                </Typography>
              </Stack>
            )}
            {counterCampaignError && (
              <Alert severity="error">{counterCampaignError}</Alert>
            )}
            {counterCampaign && !counterCampaignLoading && (
              <Stack spacing={2}>
                {/* Target segment */}
                <Box sx={{ p: 1.6, borderRadius: 1.2, bgcolor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.28)' }}>
                  <Typography sx={{ fontSize: '0.68rem', color: palette.amber, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Målgruppe
                  </Typography>
                  <Typography sx={{ fontSize: '0.86rem', color: palette.textPrimary, mt: 0.4 }}>
                    {counterCampaign.targetSegment}
                  </Typography>
                </Box>

                {/* Key messages */}
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.8 }}>
                    Nøkkel-budskap
                  </Typography>
                  <Stack spacing={0.6}>
                    {counterCampaign.keyMessages.map((msg, i) => (
                      <Stack key={i} direction="row" spacing={0.8} alignItems="flex-start">
                        <Box sx={{
                          width: 18, height: 18, borderRadius: '50%',
                          bgcolor: `${palette.accent}22`,
                          color: palette.accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.7rem', flexShrink: 0, mt: 0.2,
                        }}>
                          {i + 1}
                        </Box>
                        <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary, flex: 1 }}>
                          {msg}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                {/* Channel mix */}
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.8 }}>
                    Kanal-mix
                  </Typography>
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                    {counterCampaign.channelMix.map((c) => (
                      <Tooltip key={c.channel} title={c.rationale}>
                        <Chip
                          label={`${c.channel} · ${c.weight}%`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(192,132,252,0.12)',
                            color: palette.accent,
                            fontWeight: 700, fontSize: '0.72rem',
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>

                {/* Content drafts */}
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.8 }}>
                    Innholds-utkast ({counterCampaign.contentDrafts.length})
                  </Typography>
                  <Stack spacing={1.4}>
                    {counterCampaign.contentDrafts.map((d, i) => (
                      <Box key={i} sx={{
                        p: 1.4, borderRadius: 1.2,
                        bgcolor: 'rgba(10,10,15,0.4)',
                        border: `1px solid ${palette.border}`,
                      }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
                          <Stack direction="row" alignItems="center" spacing={0.6}>
                            <Chip
                              label={d.type.replace(/_/g, ' ').toUpperCase()}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(251,191,36,0.15)',
                                color: palette.amber,
                                fontWeight: 800, fontSize: '0.6rem', height: 18,
                              }}
                            />
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: palette.textPrimary }}>
                              {d.title}
                            </Typography>
                          </Stack>
                          <IconButton
                            size="small"
                            onClick={() => {
                              navigator.clipboard.writeText(`${d.title}\n\n${d.body}`);
                            }}
                            sx={{ color: palette.textMuted }}
                          >
                            <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Stack>
                        <Typography sx={{ fontSize: '0.8rem', color: palette.textSecondary, whiteSpace: 'pre-wrap' }}>
                          {d.body}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, mt: 0.6, fontStyle: 'italic' }}>
                          → {d.rationale}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {counterCampaignSavedWorkflowId && (
                  <Alert severity="success">
                    Lagret som workflow #{counterCampaignSavedWorkflowId.slice(0, 8)}. Du finner den i Marketing Cockpit.
                  </Alert>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setCounterCampaignOpen(false)}
              disabled={counterCampaignSaving}
              sx={{ color: palette.textMuted }}
            >
              Lukk
            </Button>
            {counterCampaign && !counterCampaignSavedWorkflowId && (
              <Button
                onClick={saveCounterCampaign}
                variant="contained"
                disabled={counterCampaignSaving}
                startIcon={counterCampaignSaving ? <CircularProgress size={14} /> : <CampaignOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{ bgcolor: palette.amber, color: '#0a0a0f', fontWeight: 800 }}
              >
                {counterCampaignSaving ? 'Lagrer …' : 'Lagre til Marketing Cockpit'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Status-rapport-dialog */}
        <Dialog
          open={statusReportOpen}
          onClose={() => setStatusReportOpen(false)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AssessmentOutlinedIcon sx={{ color: palette.accent }} />
              <span>Status-rapport — siste 7 dager</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {statusReportLoading && (
              <Stack alignItems="center" spacing={1} sx={{ p: 3 }}>
                <CircularProgress sx={{ color: palette.accent }} />
              </Stack>
            )}
            {statusReport && !statusReportLoading && (
              <Stack spacing={2.4}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2 }}>
                  {[
                    { label: 'Nye leads', value: statusReport.newLeads7d, color: palette.amber },
                    { label: 'Bookede møter', value: statusReport.meetings7d, color: '#a78bfa' },
                    { label: 'Vunnet', value: statusReport.won7d, color: '#34d399' },
                  ].map((s) => (
                    <Box key={s.label} sx={{
                      p: 1.4, borderRadius: 1.2,
                      bgcolor: `${s.color}11`,
                      border: `1px solid ${s.color}44`,
                      textAlign: 'center',
                    }}>
                      <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
                        {s.value}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', mt: 0.4 }}>
                        {s.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Stack direction="row" justifyContent="space-between" sx={{ p: 1.4, borderRadius: 1.2, bgcolor: 'rgba(10,10,15,0.4)', border: `1px solid ${palette.border}` }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                      Aktiv pipeline
                    </Typography>
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: palette.textPrimary }}>
                      {statusReport.activePipeline} leads
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
                      Lengst stille
                    </Typography>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: statusReport.longestSilentDays >= 14 ? '#f87171' : palette.textPrimary }}>
                      {statusReport.longestSilentName ?? '—'}
                      <Box component="span" sx={{ ml: 0.6, color: palette.textMuted, fontSize: '0.72rem' }}>
                        ({statusReport.longestSilentDays}d)
                      </Box>
                    </Typography>
                  </Box>
                </Stack>

                {statusReport.recommendations.length > 0 && (
                  <Box sx={{ p: 1.4, borderRadius: 1.2, bgcolor: 'rgba(192,132,252,0.08)', border: `1px solid ${palette.borderStrong}` }}>
                    <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.8 }}>
                      <AutoAwesomeOutlinedIcon sx={{ color: palette.accent, fontSize: 14 }} />
                      <Typography sx={{ fontSize: '0.68rem', color: palette.accent, fontWeight: 800, textTransform: 'uppercase' }}>
                        Anbefalte handlinger
                      </Typography>
                    </Stack>
                    <Stack spacing={0.8} component="ul" sx={{ pl: 2, m: 0 }}>
                      {statusReport.recommendations.map((rec, i) => (
                        <Box key={i} component="li" sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                          {rec}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setStatusReportOpen(false)} sx={{ color: palette.textMuted }}>
              Lukk
            </Button>
          </DialogActions>
        </Dialog>

        {/* Anbefal outreach-strategi (Claude) */}
        <Dialog
          open={strategyOpen}
          onClose={() => !strategyLoading && setStrategyOpen(false)}
          maxWidth="md" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TipsAndUpdatesOutlinedIcon sx={{ color: palette.accent }} />
              <span>Outreach-strategi{strategy ? `: ${strategy.leadName}` : ''}</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {/* Refleksjons-banner — ALLTID synlig, FØR Claude-resultatet */}
            <Box sx={{
              p: 1.6, mb: 2.4, borderRadius: 1.4,
              bgcolor: 'rgba(251,191,36,0.06)',
              border: '1px solid rgba(251,191,36,0.32)',
            }}>
              <Stack direction="row" alignItems="flex-start" spacing={1.4}>
                <PsychologyOutlinedIcon sx={{ color: palette.amber, fontSize: 22, mt: 0.2 }} />
                <Stack sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.74rem', color: palette.amber, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.6 }}>
                    Tenk selv først
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: palette.textPrimary, mb: 1 }}>
                    AI er en hjelper, ikke fasit. Still deg disse spørsmålene før du følger anbefalingen:
                  </Typography>
                  <Stack spacing={0.4} component="ol" sx={{ pl: 2.4, m: 0 }}>
                    <Box component="li" sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      Hvor godt kjenner du kunden? Har du møtt dem, eller bare sett profilen?
                    </Box>
                    <Box component="li" sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      Hva er deres faktiske problem du løser — har du belegg for det?
                    </Box>
                    <Box component="li" sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      Hvorfor skulle de svare nettopp nå? Hva har endret seg?
                    </Box>
                    <Box component="li" sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      Hva er ditt klare mål med kontakten — booke møte, avklare interesse, eller noe annet?
                    </Box>
                    <Box component="li" sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      Hva er den ene tingen ved akkurat denne leaden som AI ikke vet, men du gjør?
                    </Box>
                  </Stack>
                </Stack>
              </Stack>
            </Box>

            {strategyLoading && (
              <Stack alignItems="center" spacing={1.4} sx={{ p: 4 }}>
                <CircularProgress sx={{ color: palette.accent }} />
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                  Claude analyserer leaden og bygger strategi …
                </Typography>
              </Stack>
            )}
            {strategyError && (
              <Alert severity="error">{strategyError}</Alert>
            )}
            {strategy && !strategyLoading && (
              <Stack spacing={2}>
                {/* Primær-kanal */}
                <Box sx={{ p: 1.6, borderRadius: 1.4, bgcolor: 'rgba(192,132,252,0.08)', border: `1px solid ${palette.borderStrong}` }}>
                  <Stack direction="row" alignItems="center" spacing={1.4}>
                    {(() => {
                      const Icon =
                        strategy.primaryChannel === 'cold_call' || strategy.primaryChannel === 'sms'
                          ? LocalPhoneOutlinedIcon
                          : strategy.primaryChannel === 'email'
                          ? EmailOutlinedIcon
                          : strategy.primaryChannel === 'instagram_dm'
                          ? InstagramIcon
                          : strategy.primaryChannel === 'in_person'
                          ? HandshakeOutlinedIcon
                          : ChatBubbleOutlineOutlinedIcon;
                      return <Icon sx={{ color: palette.accent, fontSize: 28 }} />;
                    })()}
                    <Stack sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.68rem', color: palette.accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Primær-kanal
                      </Typography>
                      <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: palette.textPrimary }}>
                        {strategy.primaryChannel.replace(/_/g, ' ')}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted, mt: 0.2 }}>
                        Beste tidspunkt: {strategy.bestTime}
                      </Typography>
                    </Stack>
                    <Chip
                      label={strategy.confidence}
                      size="small"
                      sx={{
                        bgcolor: strategy.confidence === 'high'
                          ? 'rgba(52,211,153,0.18)'
                          : strategy.confidence === 'medium'
                          ? 'rgba(251,191,36,0.18)'
                          : 'rgba(148,163,184,0.18)',
                        color: strategy.confidence === 'high'
                          ? '#34d399'
                          : strategy.confidence === 'medium'
                          ? palette.amber
                          : '#94a3b8',
                        fontWeight: 800, fontSize: '0.66rem',
                      }}
                    />
                  </Stack>
                  {strategy.secondaryChannels.length > 0 && (
                    <Stack direction="row" spacing={0.6} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                      {strategy.secondaryChannels.map((c) => (
                        <Chip
                          key={c} label={c.replace(/_/g, ' ')} size="small"
                          sx={{ bgcolor: 'rgba(168,85,247,0.10)', color: palette.accent, fontWeight: 700, fontSize: '0.7rem' }}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>

                {/* Opening-line */}
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
                    <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Åpningslinje
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => navigator.clipboard.writeText(strategy.openingLine)}
                      sx={{ color: palette.textMuted }}
                    >
                      <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                  <Typography sx={{
                    fontSize: '0.86rem', color: palette.textPrimary,
                    p: 1.4, borderRadius: 1.2,
                    bgcolor: 'rgba(10,10,15,0.4)',
                    border: `1px solid ${palette.border}`,
                    fontStyle: 'italic',
                  }}>
                    "{strategy.openingLine}"
                  </Typography>
                </Box>

                {/* Sekvens */}
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.8 }}>
                    Oppfølgings-sekvens ({strategy.sequence.length} trinn)
                  </Typography>
                  <Stack spacing={1}>
                    {strategy.sequence.map((s, i) => (
                      <Box key={i} sx={{
                        p: 1.4, borderRadius: 1.2,
                        bgcolor: 'rgba(10,10,15,0.4)',
                        border: `1px solid ${palette.border}`,
                      }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
                          <Stack direction="row" alignItems="center" spacing={0.8}>
                            <Box sx={{
                              minWidth: 36, height: 22, borderRadius: 1,
                              bgcolor: s.day === 0 ? `${palette.amber}22` : 'rgba(168,85,247,0.12)',
                              color: s.day === 0 ? palette.amber : palette.accent,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 800, fontSize: '0.66rem',
                              px: 0.6,
                            }}>
                              {s.day === 0 ? 'I dag' : `+${s.day}d`}
                            </Box>
                            <Chip
                              label={s.channel.replace(/_/g, ' ')}
                              size="small"
                              sx={{ bgcolor: 'rgba(192,132,252,0.12)', color: palette.accent, fontWeight: 700, fontSize: '0.66rem', height: 18 }}
                            />
                            <Typography sx={{ fontSize: '0.8rem', color: palette.textPrimary, fontWeight: 700 }}>
                              {s.action}
                            </Typography>
                          </Stack>
                          <IconButton
                            size="small"
                            onClick={() => navigator.clipboard.writeText(s.template)}
                            sx={{ color: palette.textMuted }}
                          >
                            <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Stack>
                        <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, whiteSpace: 'pre-wrap' }}>
                          {s.template}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                {/* Rationale */}
                <Box sx={{ p: 1.4, borderRadius: 1.2, bgcolor: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.28)' }}>
                  <Typography sx={{ fontSize: '0.68rem', color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.4 }}>
                    Hvorfor denne strategien?
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                    {strategy.rationale}
                  </Typography>
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setStrategyOpen(false)} sx={{ color: palette.textMuted }}>
              Lukk
            </Button>
            {strategy && selected && (
              <Button
                onClick={() => void generateStrategy(selected.id)}
                disabled={strategyLoading}
                startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                sx={{ color: palette.accent, fontWeight: 700 }}
              >
                Generer på nytt
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Stille leads-dialog */}
        <Dialog
          open={staleListOpen}
          onClose={() => setStaleListOpen(false)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <NotificationsActiveOutlinedIcon sx={{ color: palette.amber }} />
              <span>Stille leads</span>
            </Stack>
            <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, mt: 0.4 }}>
              Leads som ikke har fått oppmerksomhet på 7+ dager. Klikk for å se detaljer.
            </Typography>
          </DialogTitle>
          <DialogContent>
            {reminders && reminders.staleLeads.length > 0 ? (
              <Stack spacing={0.6}>
                {reminders.staleLeads.map((sl) => {
                  const color = sl.daysSilent >= 30 ? '#f87171' : sl.daysSilent >= 14 ? palette.amber : '#60a5fa';
                  return (
                    <Stack
                      key={sl.id} direction="row" spacing={1} alignItems="center"
                      role="button"
                      tabIndex={0}
                      aria-label={`${sl.name}, ${sl.daysSilent} dager uten aktivitet, status ${STATUS_META[sl.status as LeadStatus]?.label ?? sl.status}`}
                      onClick={() => {
                        const lead = leads.find((l) => l.id === sl.id);
                        if (lead) { setSelected(lead); setStaleListOpen(false); }
                      }}
                      onKeyDown={activateOnKey(() => {
                        const lead = leads.find((l) => l.id === sl.id);
                        if (lead) { setSelected(lead); setStaleListOpen(false); }
                      })}
                      sx={{
                        p: 1.2, borderRadius: 1.2,
                        bgcolor: 'rgba(10,10,15,0.4)',
                        border: `1px solid ${palette.border}`,
                        borderLeft: `3px solid ${color}`,
                        cursor: 'pointer',
                        transition: 'border-color 140ms ease',
                        '&:hover': { borderColor: color },
                        '&:focus-visible': {
                          outline: `2px solid ${palette.amber}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Stack sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: palette.textPrimary }}>
                          {sl.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                          {STATUS_META[sl.status as LeadStatus]?.label ?? sl.status}
                          {sl.city && <> · {sl.city}</>}
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color }}>
                        {sl.daysSilent}d
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            ) : (
              <Typography sx={{ color: palette.textMuted, fontStyle: 'italic' }}>
                Ingen stille leads — bra jobbet!
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setStaleListOpen(false)} sx={{ color: palette.textMuted }}>
              Lukk
            </Button>
          </DialogActions>
        </Dialog>

        {/* Hurtigtaster-hjelp */}
        <Dialog
          open={hotkeysOpen}
          onClose={() => setHotkeysOpen(false)}
          maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <KeyboardOutlinedIcon sx={{ color: palette.accent }} />
              <span>Hurtigtaster</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1}>
              {[
                { key: '/', desc: 'Fokuser søkefeltet' },
                { key: 'Esc', desc: 'Lukk valg + radius-filter' },
                { key: 'Delete', desc: 'Slett valgt konkurrent' },
                { key: '1', desc: 'Sett status: Return' },
                { key: '2', desc: 'Sett status: Not Present' },
                { key: '3', desc: 'Sett status: Declined' },
                { key: '4', desc: 'Sett status: Interested' },
                { key: '5', desc: 'Sett status: Meeting' },
                { key: '6', desc: 'Sett status: Won' },
                { key: '?', desc: 'Vis denne hjelp-dialogen' },
              ].map((h) => (
                <Stack key={h.key} direction="row" alignItems="center" spacing={1.4}>
                  <Box sx={{
                    minWidth: 48, textAlign: 'center',
                    p: 0.4, borderRadius: 0.8,
                    bgcolor: 'rgba(192,132,252,0.12)',
                    border: `1px solid ${palette.border}`,
                    color: palette.accent,
                    fontWeight: 800, fontSize: '0.78rem',
                    fontFamily: 'monospace',
                  }}>
                    {h.key}
                  </Box>
                  <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                    {h.desc}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted, mt: 2, fontStyle: 'italic' }}>
              Tips: status-bytte 1-6 krever at en lead er valgt. Trykk på en pin på kartet først.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHotkeysOpen(false)} sx={{ color: palette.textMuted }}>Lukk</Button>
          </DialogActions>
        </Dialog>

        {/* iPad-paring */}
        <Dialog
          open={pairOpen}
          onClose={() => setPairOpen(false)}
          maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TabletMacOutlinedIcon sx={{ color: palette.amber }} />
              <span>Koble iPad til Lead Map</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {pairLoading && (
              <Stack alignItems="center" spacing={1} sx={{ p: 3 }}>
                <CircularProgress sx={{ color: palette.amber }} />
                <Typography sx={{ color: palette.textMuted }}>Genererer kode …</Typography>
              </Stack>
            )}
            {pairToken && pairStatus === 'pending' && (
              <Stack spacing={2.4} alignItems="center" sx={{ py: 2 }}>
                <Typography sx={{ fontSize: '0.86rem', color: palette.textSecondary, textAlign: 'center' }}>
                  Åpne LeadMapApp på iPad-en din og skriv inn denne koden:
                </Typography>
                <Box sx={{
                  p: 2, borderRadius: 1.6,
                  bgcolor: 'rgba(251,191,36,0.08)',
                  border: `2px solid ${palette.amber}`,
                  letterSpacing: '0.18em',
                  fontFamily: 'monospace',
                  fontSize: '2.4rem',
                  fontWeight: 800,
                  color: palette.amber,
                  textShadow: `0 0 12px ${palette.amber}66`,
                }}>
                  {pairToken.shortCode}
                </Box>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <CircularProgress
                    variant="determinate"
                    value={Math.max(0, (pairCountdown / pairToken.expiresInSeconds) * 100)}
                    size={18}
                    sx={{ color: palette.amber }}
                  />
                  <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted }}>
                    Utløper om {Math.floor(pairCountdown / 60)}:{String(pairCountdown % 60).padStart(2, '0')}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                  iPad får et permanent token når koden bekreftes. Lagres i Keychain.
                </Typography>
              </Stack>
            )}
            {pairStatus === 'claimed' && (
              <Stack alignItems="center" spacing={1.4} sx={{ py: 4 }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '50%',
                  bgcolor: 'rgba(52,211,153,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 32 }} />
                </Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: palette.textPrimary }}>
                  iPad-en er koblet til
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary, textAlign: 'center' }}>
                  Du kan nå bruke LeadMapApp på iPad-en din.
                </Typography>
              </Stack>
            )}
            {pairStatus === 'expired' && pairToken && (
              <Alert severity="warning">
                Koden utløp. Generer en ny for å prøve igjen.
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPairOpen(false)} sx={{ color: palette.textMuted }}>
              Lukk
            </Button>
            {(pairStatus === 'expired' || pairStatus === 'claimed') && (
              <Button
                onClick={() => void generatePairToken()}
                variant="contained"
                disabled={pairLoading}
                sx={{ bgcolor: palette.amber, color: '#0a0a0f', fontWeight: 800 }}
              >
                Ny kode
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* CSV-import */}
        <Dialog
          open={csvImportOpen}
          onClose={() => !csvImporting && !csvParsing && setCsvImportOpen(false)}
          maxWidth="md" fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgPanel, border: `1px solid ${palette.borderStrong}` } }}
        >
          <DialogTitle sx={{ color: palette.textPrimary }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <UploadFileOutlinedIcon sx={{ color: palette.accent }} />
              <span>Importer leads fra CSV</span>
            </Stack>
            <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, mt: 0.4 }}>
              Drag-drop eller velg fil. Norske og engelske kolonne-navn mappes automatisk:
              name/navn/firma, address/adresse, city/by/sted, phone/telefon, email/epost,
              website/nettside, category/kategori, notes/notater, latitude, longitude.
            </Typography>
          </DialogTitle>
          <DialogContent>
            {!csvPreview && !csvImportResult && (
              <Box
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) void parseCsvFile(file);
                }}
                sx={{
                  p: 4, borderRadius: 1.4,
                  border: `2px dashed ${palette.borderStrong}`,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': { borderColor: palette.amber, bgcolor: 'rgba(251,191,36,0.04)' },
                }}
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <UploadFileOutlinedIcon sx={{ fontSize: 40, color: palette.textMuted, mb: 1 }} />
                <Typography sx={{ fontSize: '0.88rem', color: palette.textPrimary, fontWeight: 700 }}>
                  Drag CSV-fil hit eller klikk for å velge
                </Typography>
                <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted, mt: 0.6 }}>
                  Maks 1000 rader per import
                </Typography>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void parseCsvFile(file);
                  }}
                />
              </Box>
            )}
            {csvParsing && (
              <Stack alignItems="center" spacing={1} sx={{ p: 3 }}>
                <CircularProgress sx={{ color: palette.amber }} />
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>Parser CSV …</Typography>
              </Stack>
            )}
            {csvPreview && !csvImportResult && (
              <Box>
                <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary, mb: 1.2 }}>
                  Forhåndsvisning: <strong>{csvPreview.length}</strong> rader funnet
                  {csvPreview.length === 100 && ' (viser kun 100 første)'}.
                  Header: {csvHeaders.join(', ')}.
                </Typography>
                <Box sx={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${palette.border}`, borderRadius: 1.2 }}>
                  <Box component="table" sx={{
                    width: '100%', borderCollapse: 'collapse',
                    '& th, & td': { padding: '6px 8px', fontSize: '0.74rem', borderBottom: `1px solid ${palette.border}`, color: palette.textSecondary, whiteSpace: 'nowrap' },
                    '& th': { color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', fontSize: '0.6rem' },
                  }}>
                    <thead>
                      <tr>{csvHeaders.slice(0, 6).map((h) => <th key={h}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {csvHeaders.slice(0, 6).map((h) => <td key={h}>{row[h]?.slice(0, 40) || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                </Box>
              </Box>
            )}
            {csvImportResult && (
              <Stack spacing={1.4}>
                <Alert severity={csvImportResult.imported > 0 ? 'success' : 'warning'}>
                  Importert {csvImportResult.imported} av {csvImportResult.total} leads.
                  {csvImportResult.skipped.length > 0 && ` ${csvImportResult.skipped.length} hoppet over.`}
                </Alert>
                {csvImportResult.skipped.length > 0 && (
                  <Box>
                    <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', mb: 0.6 }}>
                      Hoppet over
                    </Typography>
                    <Stack spacing={0.4} sx={{ maxHeight: 160, overflowY: 'auto' }}>
                      {csvImportResult.skipped.slice(0, 20).map((s, i) => (
                        <Typography key={i} sx={{ fontSize: '0.74rem', color: palette.textSecondary }}>
                          <strong>{s.name}:</strong> {s.reason}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => {
              setCsvImportOpen(false);
              setCsvPreview(null);
              setCsvImportResult(null);
            }} sx={{ color: palette.textMuted }}>
              Lukk
            </Button>
            {csvPreview && !csvImportResult && (
              <Button
                onClick={submitCsvImport}
                variant="contained"
                disabled={csvImporting}
                startIcon={csvImporting ? <CircularProgress size={14} /> : <UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{ bgcolor: palette.amber, color: '#0a0a0f', fontWeight: 800 }}
              >
                {csvImporting ? 'Importerer …' : `Importer ${csvPreview.length} leads`}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Threat-level edit menu (klikk chip → bytt) */}
        <Menu
          anchorEl={threatMenuAnchor?.el ?? null}
          open={Boolean(threatMenuAnchor)}
          onClose={() => setThreatMenuAnchor(null)}
        >
          {(['near', 'medium', 'far'] as const).map((level) => (
            <MenuItem
              key={level}
              onClick={() => {
                if (threatMenuAnchor) {
                  void setCompetitorThreatLevel(threatMenuAnchor.competitorId, level);
                  setThreatMenuAnchor(null);
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: THREAT_COLOR[level] }} />
                <span>
                  {level === 'near' ? 'Nær trussel' : level === 'medium' ? 'Medium' : 'Fjern'}
                </span>
              </Stack>
            </MenuItem>
          ))}
          <Divider />
          <MenuItem
            onClick={() => {
              if (threatMenuAnchor) {
                void setCompetitorThreatLevel(threatMenuAnchor.competitorId, null);
                setThreatMenuAnchor(null);
              }
            }}
          >
            <span style={{ color: palette.textMuted }}>Fjern trussel-nivå</span>
          </MenuItem>
        </Menu>

        {/* Places discovery dialog */}
        <Dialog open={placesOpen} onClose={() => setPlacesOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Stack direction="row" alignItems="center" spacing={1}>
              <SearchOutlinedIcon sx={{ color: palette.amber }} />
              <span>Discover leads via Google Places</span>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <TextField
                size="small" fullWidth autoFocus
                placeholder="F.eks. 'kafé Grünerløkka' eller 'reklamebyrå Oslo'"
                value={placesQuery}
                onChange={(e) => setPlacesQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void searchPlaces(); }}
              />
              <Button
                onClick={searchPlaces} variant="contained" disabled={placesLoading}
                startIcon={placesLoading ? <CircularProgress size={14} /> : <SearchOutlinedIcon sx={{ fontSize: 14 }} />}
                sx={{ bgcolor: palette.amber, color: '#0a0a0f', fontWeight: 700 }}
              >
                Søk
              </Button>
            </Stack>
            <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', mt: 1 }}>
              Søker innenfor 10 km av nåværende kart-senter.
            </Typography>
            {placesError && (
              <Alert severity="warning" sx={{ mt: 2 }}>{placesError}</Alert>
            )}
            <Stack spacing={0.8} sx={{ mt: 2 }}>
              {placesResults.map((p) => (
                <Box key={p.placeId} sx={{
                  p: 1.4, borderRadius: 1.2,
                  border: '1px solid #ddd',
                  display: 'flex', alignItems: 'center', gap: 1.4,
                }}>
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      {p.name}
                      {p.rating && (
                        <Box component="span" sx={{ ml: 1, color: 'orange', fontSize: '0.78rem' }}>
                          ★ {p.rating}
                        </Box>
                      )}
                    </Typography>
                    <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary' }}>
                      {p.address}{p.category && ` · ${p.category}`}
                    </Typography>
                  </Stack>
                  {p.alreadyImported ? (
                    <Chip size="small" label="Importert" sx={{ bgcolor: 'success.light', color: 'success.dark' }} />
                  ) : (
                    <Button
                      size="small" variant="outlined"
                      onClick={() => importPlace(p)}
                      disabled={importingPlaceId === p.placeId}
                      sx={{ fontWeight: 700 }}
                    >
                      {importingPlaceId === p.placeId ? 'Importerer …' : 'Importer'}
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPlacesOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>

        {/* Alle konkurrenter — tabell-visning inkl. de uten geo */}
        <Box sx={{ mt: 2.4, p: 2, borderRadius: 1.6, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                component="h3"
                sx={{ fontSize: '0.72rem', fontWeight: 800, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', m: 0 }}
              >
                Alle konkurrenter
              </Typography>
              <Chip
                label={competitors.length}
                size="small"
                sx={{
                  bgcolor: 'rgba(239,68,68,0.12)',
                  color: '#ef4444',
                  fontWeight: 800, fontSize: '0.66rem', height: 20,
                }}
              />
              {competitors.filter((c) => c.latitude == null).length > 0 && (
                <Tooltip title="Konkurrenter uten geo (ikke på kart)">
                  <Chip
                    label={`${competitors.filter((c) => c.latitude == null).length} uten geo`}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(148,163,184,0.12)',
                      color: '#94a3b8',
                      fontWeight: 700, fontSize: '0.62rem', height: 20,
                    }}
                  />
                </Tooltip>
              )}
            </Stack>
            <Button
              size="small" variant="outlined"
              onClick={() => setAddCompOpen(true)}
              startIcon={<AddLocationAltOutlinedIcon sx={{ fontSize: 14 }} />}
              sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'none' }}
            >
              Legg til
            </Button>
          </Stack>
          {competitors.length === 0 ? (
            <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted, fontStyle: 'italic' }}>
              Ingen konkurrenter ennå. Trykk «Legg til» eller kjør Role Room Agent's Market Scan.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Box component="table" sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th, & td': {
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderBottom: `1px solid ${palette.border}`,
                  fontSize: '0.78rem',
                  color: palette.textSecondary,
                  whiteSpace: 'nowrap',
                },
                '& th': {
                  fontSize: '0.66rem',
                  color: palette.textMuted,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                },
                '& tr:hover td': {
                  bgcolor: 'rgba(168,85,247,0.05)',
                  cursor: 'pointer',
                },
              }}>
                <thead>
                  <tr>
                    <th>Navn</th>
                    <th>Kategori</th>
                    <th>Trussel</th>
                    <th style={{ textAlign: 'center' }}>Score</th>
                    <th>Posisjonering</th>
                    <th style={{ textAlign: 'center' }}>På kart</th>
                    <th>Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors
                    .filter((c) => {
                      // Søke-filter — også konkurrent-tabellen respekterer søk
                      if (!normalizedQuery) return true;
                      const haystack = [
                        c.name, c.domain, c.category, c.positioning,
                        c.primaryOffer, c.address, c.claudeThreatSummary,
                      ].filter(Boolean).join(' ').toLowerCase();
                      return haystack.includes(normalizedQuery);
                    })
                    .slice()
                    .sort((a, b) => {
                      // priority først, så threat-level, så score
                      const pa = a.priorityRank ?? -1;
                      const pb = b.priorityRank ?? -1;
                      if (pa !== pb) return pb - pa;
                      const order = { near: 1, medium: 2, far: 3 } as const;
                      const oa = a.threatLevel ? order[a.threatLevel] : 4;
                      const ob = b.threatLevel ? order[b.threatLevel] : 4;
                      if (oa !== ob) return oa - ob;
                      return (b.threatScore ?? 0) - (a.threatScore ?? 0);
                    })
                    .map((c) => (
                      <tr
                        key={c.id}
                        role="button"
                        tabIndex={c.latitude != null && c.longitude != null ? 0 : -1}
                        aria-label={`Konkurrent ${c.name}${c.threatLevel ? `, ${c.threatLevel === 'near' ? 'nær trussel' : c.threatLevel === 'medium' ? 'medium trussel' : 'fjern trussel'}` : ''}`}
                        onClick={() => {
                          if (c.latitude != null && c.longitude != null) {
                            setSelectedCompetitor(c);
                            setSelected(null);
                          }
                        }}
                        onKeyDown={activateOnKey(() => {
                          if (c.latitude != null && c.longitude != null) {
                            setSelectedCompetitor(c);
                            setSelected(null);
                          }
                        })}
                      >
                        <td>
                          <Stack direction="row" alignItems="center" spacing={0.6}>
                            <Box sx={{
                              width: 8, height: 8, borderRadius: '50%',
                              bgcolor: c.threatLevel ? THREAT_COLOR[c.threatLevel] : UNASSESSED_COLOR,
                            }} />
                            <span style={{ fontWeight: 700, color: palette.textPrimary }}>{c.name}</span>
                            {c.isManualAddition && (
                              <Chip label="MANUELL" size="small" sx={{
                                bgcolor: 'rgba(192,132,252,0.15)',
                                color: palette.accent,
                                fontWeight: 800, fontSize: '0.56rem', height: 16,
                              }} />
                            )}
                          </Stack>
                        </td>
                        <td>{c.category ?? '—'}</td>
                        <td>
                          <Chip
                            label={
                              c.threatLevel
                                ? (c.threatLevel === 'near' ? 'Nær' : c.threatLevel === 'medium' ? 'Medium' : 'Fjern')
                                : 'Sett'
                            }
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setThreatMenuAnchor({ el: e.currentTarget, competitorId: c.id });
                            }}
                            sx={{
                              bgcolor: c.threatLevel ? `${THREAT_COLOR[c.threatLevel]}22` : 'rgba(148,163,184,0.12)',
                              color: c.threatLevel ? THREAT_COLOR[c.threatLevel] : '#94a3b8',
                              fontWeight: 800, fontSize: '0.66rem', height: 20,
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: c.threatLevel ? `${THREAT_COLOR[c.threatLevel]}33` : 'rgba(148,163,184,0.2)',
                              },
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {c.threatScore != null ? c.threatScore : '—'}
                        </td>
                        <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.positioning ?? c.claudeThreatSummary ?? <span style={{ color: palette.textMuted }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {c.latitude != null ? (
                            <PlaceOutlinedIcon sx={{ color: '#34d399', fontSize: 16 }} />
                          ) : (
                            <span style={{ color: palette.textMuted, fontSize: '0.72rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          {!c.claudeThreatSummary ? (
                            <Button
                              size="small" variant="text"
                              onClick={(e) => { e.stopPropagation(); assessCompetitor(c.id); }}
                              disabled={assessingCompetitorId === c.id}
                              startIcon={
                                assessingCompetitorId === c.id
                                  ? <CircularProgress size={10} sx={{ color: palette.accent }} />
                                  : <AutoAwesomeOutlinedIcon sx={{ fontSize: 12 }} />
                              }
                              sx={{ color: palette.accent, fontWeight: 700, fontSize: '0.68rem', textTransform: 'none', minWidth: 0, p: 0.4 }}
                            >
                              Vurder
                            </Button>
                          ) : (
                            <Button
                              size="small" variant="text"
                              onClick={(e) => { e.stopPropagation(); assessCompetitor(c.id); }}
                              disabled={assessingCompetitorId === c.id}
                              sx={{ color: palette.textMuted, fontWeight: 700, fontSize: '0.68rem', textTransform: 'none', minWidth: 0, p: 0.4 }}
                            >
                              Re-vurder
                            </Button>
                          )}
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); deleteCompetitor(c.id); }}
                            disabled={deletingCompetitorId === c.id}
                            sx={{ color: '#ef4444', ml: 0.4, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                          >
                            {deletingCompetitorId === c.id
                              ? <CircularProgress size={12} sx={{ color: '#ef4444' }} />
                              : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Box>
            </Box>
          )}
        </Box>

        {/* Kalender — kommende møter + follow-ups */}
        <Box sx={{ mt: 2.4, p: 2, borderRadius: 1.6, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CalendarMonthOutlinedIcon sx={{ color: palette.amber, fontSize: 18 }} />
              <Typography
                component="h3"
                sx={{ fontSize: '0.72rem', fontWeight: 800, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', m: 0 }}
              >
                Kommende møter & oppfølginger
              </Typography>
              <Chip
                label={calendarEvents.length}
                size="small"
                sx={{ bgcolor: 'rgba(251,191,36,0.12)', color: palette.amber, fontWeight: 800, fontSize: '0.66rem', height: 20 }}
              />
            </Stack>
          </Stack>
          {calendarEvents.length === 0 ? (
            <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted, fontStyle: 'italic' }}>
              Ingen møter eller follow-ups planlagt de neste 60 dagene.
            </Typography>
          ) : (
            <Stack spacing={0.8}>
              {calendarEvents.slice(0, 10).map((ev) => {
                const date = ev.datetime ? new Date(ev.datetime) : null;
                const isMeeting = ev.eventType === 'meeting';
                const accent = isMeeting ? STATUS_META.meeting_booked.color : palette.amber;
                const dateLabel = date
                  ? date.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
                  : '?';
                const timeLabel = date
                  ? date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                  : '';
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = date && date.toDateString() === new Date().toDateString();
                const isPast = date && date < new Date();
                return (
                  <Stack
                    key={ev.id} direction="row" spacing={1.4} alignItems="center"
                    role="button"
                    tabIndex={0}
                    aria-label={`${isMeeting ? 'Møte' : 'Oppfølging'} med ${ev.leadName}${date ? ` ${dateLabel} ${timeLabel}` : ''}`}
                    onClick={() => {
                      const lead = leads.find((l) => l.id === ev.id);
                      if (lead) { setSelected(lead); setSelectedCompetitor(null); }
                    }}
                    onKeyDown={activateOnKey(() => {
                      const lead = leads.find((l) => l.id === ev.id);
                      if (lead) { setSelected(lead); setSelectedCompetitor(null); }
                    })}
                    sx={{
                      p: 1.2, borderRadius: 1.2,
                      bgcolor: 'rgba(10,10,15,0.4)',
                      border: `1px solid ${palette.border}`,
                      borderLeft: `3px solid ${accent}`,
                      cursor: 'pointer',
                      transition: 'border-color 140ms ease',
                      '&:hover': { borderColor: accent },
                      '&:focus-visible': {
                        outline: `2px solid ${palette.amber}`,
                        outlineOffset: 2,
                      },
                      opacity: isPast ? 0.65 : 1,
                    }}
                  >
                    <Box sx={{ minWidth: 64, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.7rem', color: isToday ? palette.amber : palette.textMuted, fontWeight: 800, textTransform: 'uppercase' }}>
                        {isToday ? 'I dag' : dateLabel}
                      </Typography>
                      <Typography sx={{ fontSize: '0.76rem', color: palette.textPrimary, fontWeight: 700 }}>
                        {timeLabel}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 1, height: 32, bgcolor: palette.border }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.6}>
                        <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: palette.textPrimary }}>
                          {ev.leadName}
                        </Typography>
                        <Chip
                          label={isMeeting ? 'MØTE' : 'OPPFØLGING'}
                          size="small"
                          sx={{
                            bgcolor: `${accent}22`,
                            color: accent,
                            fontWeight: 800, fontSize: '0.58rem', height: 16,
                          }}
                        />
                      </Stack>
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textSecondary, mt: 0.2 }}>
                        {ev.nextAction ?? (isMeeting ? 'Booket møte' : 'Planlagt follow-up')}
                        {ev.city && <Box component="span" sx={{ color: palette.textMuted }}> · {ev.city}</Box>}
                      </Typography>
                    </Stack>
                    {ev.assignedUserName && ev.assignedUserId !== currentUser?.id && (
                      <Chip
                        label={ev.assignedUserName.split(' ')[0]}
                        size="small"
                        sx={{ bgcolor: 'rgba(96,165,250,0.12)', color: '#60a5fa', fontSize: '0.66rem', fontWeight: 700, height: 20 }}
                      />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* Leaderboard — konkurranse blant lead-skaffere */}
        {leaderboard.length > 0 && (
          <Box sx={{ mt: 2.4, p: 2, borderRadius: 1.6, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <EmojiEventsIcon sx={{ color: palette.amber, fontSize: 18 }} />
                <Typography
                  component="h3"
                  sx={{ fontSize: '0.72rem', fontWeight: 800, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', m: 0 }}
                >
                  Lead-leaderboard
                </Typography>
              </Stack>
            </Stack>
            <Box component="table" sx={{
              width: '100%', borderCollapse: 'collapse',
              '& th, & td': {
                textAlign: 'left', padding: '6px 10px',
                borderBottom: `1px solid ${palette.border}`,
                fontSize: '0.78rem', color: palette.textSecondary,
              },
              '& th': {
                fontSize: '0.64rem', color: palette.textMuted,
                fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
              },
            }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                  <th>Skaffet av</th>
                  <th style={{ textAlign: 'right' }}>Leads</th>
                  <th style={{ textAlign: 'right' }}>Møter</th>
                  <th style={{ textAlign: 'right' }}>Won</th>
                  <th style={{ textAlign: 'right' }}>Conv.</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((entry) => {
                  const isMe = entry.userId === currentUser?.id;
                  const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;
                  return (
                    <tr key={entry.userId ?? `${entry.rank}`} style={{ backgroundColor: isMe ? 'rgba(192,132,252,0.06)' : undefined }}>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: medal ? palette.amber : palette.textMuted }}>
                        {medal ?? entry.rank}
                      </td>
                      <td>
                        <Stack direction="row" alignItems="center" spacing={0.8}>
                          <Box sx={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: isMe
                              ? `linear-gradient(135deg, ${palette.accent}, ${palette.amber})`
                              : `linear-gradient(135deg, #60a5fa, #34d399)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#0a0a0f', fontWeight: 800, fontSize: '0.62rem',
                          }}>
                            {(entry.userName ?? entry.userEmail ?? '?').slice(0, 2).toUpperCase()}
                          </Box>
                          <span style={{ color: palette.textPrimary, fontWeight: 700 }}>
                            {entry.userName ?? entry.userEmail ?? 'Ukjent'}
                            {isMe && <Box component="span" sx={{ ml: 0.6, color: palette.amber, fontSize: '0.7rem' }}>(du)</Box>}
                          </span>
                        </Stack>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: palette.textPrimary }}>{entry.totalLeads}</td>
                      <td style={{ textAlign: 'right' }}>{entry.meetingBooked}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>{entry.won}</td>
                      <td style={{ textAlign: 'right' }}>
                        {entry.conversionRate != null ? (
                          <Box component="span" sx={{
                            color: entry.conversionRate >= 50 ? '#34d399' : entry.conversionRate >= 20 ? palette.amber : palette.textMuted,
                            fontWeight: 700,
                          }}>
                            {entry.conversionRate}%
                          </Box>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Box>
          </Box>
        )}

        {/* Lead-liste — tabell-visning m/ checkbox + bulk-tildel */}
        <Box sx={{ mt: 2.4, p: 2, borderRadius: 1.6, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4, flexWrap: 'wrap', gap: 1 }} useFlexGap>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                component="h3"
                sx={{ fontSize: '0.72rem', fontWeight: 800, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', m: 0 }}
              >
                Alle leads
              </Typography>
              <Chip
                label={filteredLeads.length}
                size="small"
                sx={{ bgcolor: 'rgba(251,191,36,0.12)', color: palette.amber, fontWeight: 800, fontSize: '0.66rem', height: 20 }}
              />
              {filteredLeads.filter((l) => !l.projectId).length > 0 && (
                <Chip
                  label={`${filteredLeads.filter((l) => !l.projectId).length} uten prosjekt`}
                  size="small"
                  sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#94a3b8', fontWeight: 700, fontSize: '0.62rem', height: 20 }}
                />
              )}
            </Stack>
            {selectedLeadIds.size > 0 && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography sx={{ fontSize: '0.74rem', color: palette.amber, fontWeight: 700 }}>
                  {selectedLeadIds.size} valgt →
                </Typography>
                <Select
                  size="small"
                  value={bulkAssignTarget}
                  onChange={(e) => setBulkAssignTarget(e.target.value as string)}
                  displayEmpty
                  renderValue={(v) => v ? projects.find((p) => p.id === v)?.name ?? v : 'Velg prosjekt'}
                  sx={{
                    minWidth: 160,
                    height: 30,
                    bgcolor: 'rgba(192,132,252,0.08)',
                    fontSize: '0.74rem',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
                  }}
                >
                  <MenuItem value=""><em>Fjern tilordning</em></MenuItem>
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
                <Button
                  size="small" variant="contained"
                  onClick={bulkAssignProject}
                  disabled={bulkAssigning}
                  startIcon={bulkAssigning ? <CircularProgress size={12} /> : null}
                  sx={{ bgcolor: palette.accent, color: '#0a0a0f', fontWeight: 800, fontSize: '0.72rem', textTransform: 'none' }}
                >
                  {bulkAssigning ? 'Tildeler …' : 'Tildel'}
                </Button>
                <Button
                  size="small" variant="text"
                  onClick={() => setSelectedLeadIds(new Set())}
                  sx={{ color: palette.textMuted, fontSize: '0.72rem', textTransform: 'none' }}
                >
                  Avbryt
                </Button>
              </Stack>
            )}
          </Stack>
          {filteredLeads.length === 0 ? (
            <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted, fontStyle: 'italic' }}>
              Ingen leads matcher gjeldende filtre.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', maxHeight: 420 }}>
              <Box component="table" sx={{
                width: '100%', borderCollapse: 'collapse',
                '& th, & td': {
                  textAlign: 'left',
                  padding: '6px 10px',
                  borderBottom: `1px solid ${palette.border}`,
                  fontSize: '0.76rem',
                  color: palette.textSecondary,
                },
                '& th': {
                  fontSize: '0.64rem',
                  color: palette.textMuted,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  position: 'sticky',
                  top: 0,
                  bgcolor: palette.bgPanel,
                  zIndex: 1,
                },
                '& tr:hover td': {
                  bgcolor: 'rgba(168,85,247,0.05)',
                },
              }}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
                          } else {
                            setSelectedLeadIds(new Set());
                          }
                        }}
                        style={{ accentColor: palette.amber, cursor: 'pointer' }}
                      />
                    </th>
                    <th>Navn</th>
                    <th>Status</th>
                    <th>By</th>
                    <th>Prosjekt</th>
                    <th style={{ width: 80 }}>Sist</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.slice(0, 200).map((l) => {
                    const project = l.projectId ? projects.find((p) => p.id === l.projectId) : null;
                    const isSelected = selectedLeadIds.has(l.id);
                    return (
                      <tr key={l.id} style={{ backgroundColor: isSelected ? 'rgba(251,191,36,0.06)' : undefined }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedLeadIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(l.id); else next.delete(l.id);
                                return next;
                              });
                            }}
                            style={{ accentColor: palette.amber, cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <Box
                            role="button"
                            tabIndex={0}
                            aria-label={`Vis detaljer for lead ${l.name}, status ${STATUS_META[l.status]?.label ?? l.status}`}
                            onClick={() => setSelected(l)}
                            onKeyDown={activateOnKey(() => setSelected(l))}
                            sx={{
                              cursor: 'pointer',
                              display: 'inline-block',
                              borderRadius: 0.6,
                              '&:focus-visible': {
                                outline: `2px solid ${palette.amber}`,
                                outlineOffset: 2,
                              },
                            }}
                          >
                            <Stack direction="row" alignItems="center" spacing={0.6}>
                              <Box
                                aria-hidden="true"
                                sx={{
                                  width: 8, height: 8, borderRadius: '50%',
                                  bgcolor: STATUS_META[l.status]?.color ?? '#94a3b8',
                                }}
                              />
                              <span style={{ fontWeight: 700, color: palette.textPrimary }}>{l.name}</span>
                            </Stack>
                          </Box>
                        </td>
                        <td>
                          <Chip
                            label={STATUS_META[l.status]?.label ?? l.status}
                            size="small"
                            sx={{
                              bgcolor: `${STATUS_META[l.status]?.color ?? '#94a3b8'}22`,
                              color: STATUS_META[l.status]?.color ?? '#94a3b8',
                              fontWeight: 800, fontSize: '0.62rem', height: 18,
                            }}
                          />
                        </td>
                        <td>{l.city ?? '—'}</td>
                        <td>
                          {project ? (
                            <Chip
                              label={project.name}
                              size="small"
                              sx={{ bgcolor: 'rgba(192,132,252,0.18)', color: palette.accent, fontWeight: 700, fontSize: '0.62rem', height: 18 }}
                            />
                          ) : (
                            <span style={{ color: palette.textMuted, fontSize: '0.7rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ color: palette.textMuted, fontSize: '0.7rem' }}>
                          {formatRelative(l.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            </Box>
          )}
        </Box>

        {/* Recent Activity — horisontale kort */}
        <Box sx={{ mt: 2.4, p: 2, borderRadius: 1.6, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
            <Typography
              component="h3"
              sx={{ fontSize: '0.72rem', fontWeight: 800, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', m: 0 }}
            >
              Recent Activity
            </Typography>
            <Button
              size="small" variant="text"
              sx={{ color: palette.amber, fontWeight: 700, fontSize: '0.74rem', textTransform: 'none' }}
            >
              View All Activity →
            </Button>
          </Stack>
          {activities.length === 0 ? (
            <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted, fontStyle: 'italic' }}>
              Ingen aktivitet ennå.
            </Typography>
          ) : (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
              gap: 1.2,
            }}>
              {activities.slice(0, 5).map((a) => {
                // Velg ikon/farge basert på activity-type
                const typeKey = (a.activityType ?? '').toLowerCase();
                const isMeeting = typeKey.includes('meeting');
                const isWon = typeKey.includes('won');
                const isDeclined = typeKey.includes('declin') || typeKey.includes('lost');
                const isReturn = typeKey.includes('return') || typeKey.includes('visit');
                const isInterested = typeKey.includes('interested');
                const accent = isWon
                  ? STATUS_META.won.color
                  : isMeeting
                  ? STATUS_META.meeting_booked.color
                  : isDeclined
                  ? STATUS_META.declined.color
                  : isReturn
                  ? STATUS_META.return.color
                  : isInterested
                  ? STATUS_META.interested.color
                  : palette.amber;
                const Icon = isWon
                  ? StarOutlineIcon
                  : isMeeting
                  ? CalendarMonthOutlinedIcon
                  : isDeclined
                  ? CloseIcon
                  : isReturn
                  ? RefreshIcon
                  : isInterested
                  ? FavoriteBorderOutlinedIcon
                  : AutoAwesomeOutlinedIcon;
                // Pen "Marked as / by ..."-subtitle
                const subtitle = a.description ?? a.activityType.replace(/_/g, ' ');
                return (
                  <Box key={a.id} sx={{
                    p: 1.6, borderRadius: 1.2,
                    bgcolor: 'rgba(10,10,15,0.4)',
                    border: `1px solid ${palette.border}`,
                    minHeight: 132, display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-start',
                    transition: 'border-color 160ms ease',
                    '&:hover': { borderColor: `${accent}66` },
                  }}>
                    {/* Stor ikon-sirkel */}
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%',
                      bgcolor: `${accent}22`,
                      border: `1.5px solid ${accent}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: accent, mb: 0.8,
                      boxShadow: `0 0 12px ${accent}33`,
                    }}>
                      <Icon sx={{ fontSize: 18 }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.82rem', color: palette.textPrimary, fontWeight: 800, lineHeight: 1.2 }}>
                      {a.customerName ?? 'Lead'}
                    </Typography>
                    <Typography sx={{
                      fontSize: '0.72rem', color: palette.textSecondary, mt: 0.2,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {subtitle}
                    </Typography>
                    <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, mt: 'auto', pt: 0.8 }}>
                      {a.userName ? `by ${a.userName} · ` : ''}{formatRelative(a.createdAt)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
