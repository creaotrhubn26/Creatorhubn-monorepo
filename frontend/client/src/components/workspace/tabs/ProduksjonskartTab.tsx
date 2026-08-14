/**
 * ProduksjonskartTab — design #3 (Production Map), dark CreatorHub.
 * Dagens fokus / Crew / Vær / Team Sync + tre ekte visninger (Timeline / Board / Kart)
 * Kart-visningen viser et ekte Leaflet-kart med lokasjons-pins + crew-avatarer.
 * + Live koordinering (høyre) + Kritiske øyeblikk / Referanser.
 */
import React, { useState } from 'react';
import { Box, Stack, Typography, Avatar, AvatarGroup, IconButton, Button, TextField, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, Checkbox, FormControlLabel, FormGroup } from '@mui/material';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Groups from '@mui/icons-material/Groups';
import Cloud from '@mui/icons-material/Cloud';
import Sync from '@mui/icons-material/Sync';
import CenterFocusStrong from '@mui/icons-material/CenterFocusStrong';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Tune from '@mui/icons-material/Tune';
import CheckCircle from '@mui/icons-material/CheckCircle';
import NotificationsActive from '@mui/icons-material/NotificationsActive';
import Send from '@mui/icons-material/Send';
import StickyNote2 from '@mui/icons-material/StickyNote2';
import Event from '@mui/icons-material/Event';
import Schedule from '@mui/icons-material/Schedule';
import Close from '@mui/icons-material/Close';
import Add from '@mui/icons-material/Add';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import WbSunny from '@mui/icons-material/WbSunny';
import CloudQueue from '@mui/icons-material/CloudQueue';
import Grain from '@mui/icons-material/Grain';
import Thunderstorm from '@mui/icons-material/Thunderstorm';
import AcUnit from '@mui/icons-material/AcUnit';
import BlurOn from '@mui/icons-material/BlurOn';
import Umbrella from '@mui/icons-material/Umbrella';
import OpenInNew from '@mui/icons-material/OpenInNew';
import Cached from '@mui/icons-material/Cached';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import Navigation from '@mui/icons-material/Navigation';
import Place from '@mui/icons-material/Place';
import MapOutlined from '@mui/icons-material/MapOutlined';
import Print from '@mui/icons-material/Print';
import MyLocation from '@mui/icons-material/MyLocation';
import Air from '@mui/icons-material/Air';
import WaterDrop from '@mui/icons-material/WaterDrop';
import Opacity from '@mui/icons-material/Opacity';
import Speed from '@mui/icons-material/Speed';
import LocalShipping from '@mui/icons-material/LocalShipping';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsSectionTitle, WsRing, WsPills, WsTag, WsTable, WsImageGrid, WsPageTitle } from '../ui';
import type { WsImageItem } from '../ui';
import { useProjectImages } from '../useProjectImages';
import { externalDataService } from '@/services/ExternalDataService';
import { useAuth } from '@/hooks/useAuth';

type PlanStatus = 'Ferdig' | 'Pågår' | 'Planlagt' | 'Kritisk';
type ViewKey = 'timeline' | 'board' | 'kart' | 'plan';
type FilterKey = 'alle' | PlanStatus;

interface CoordinationActivity {
  id: string;
  type: string;
  message: string;
  actorName?: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
}

interface PlanRow {
  id: string;
  tid: string;
  moment: string;
  sub: string;
  foto: string[];
  video: string[];
  lyd: string[];
  ansvarlig: string;
  status: [PlanStatus, string];
  notat: string;
  active?: boolean;
  startMin: number;
  endMin: number;
  sted: string;
  day?: number;
}

interface WeddingEvent {
  id?: string;
  title?: string;
  time?: string;
  eventTime?: string;
  durationMinutes?: number;
  location?: string;
  description?: string;
  status?: string;
}

interface SyncMember {
  name: string;
  email?: string;
  crewRole: string;
  online: boolean;
  lastSeen?: string | null;
}

interface SyncState {
  pct?: number;
  online?: number;
  teamSize?: number;
  owner?: { name?: string; email?: string } | null;
  members?: SyncMember[];
  readiness?: { label: string; done: boolean; value: string }[];
}

interface WeatherData {
  location?: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  windSpeed?: number;
  windDirection?: number;
  cloudCover?: number;
  uvIndex?: number;
  precipitation?: number;
  symbolCode?: string;
  source?: string;
}

interface ForecastDay {
  date?: string;
  offset?: number;
  temperature?: number;
  precipitation?: number;
  symbol?: string;
}

interface CrewMember {
  id: string;
  name: string;
  crewRole: string;
  avatarUrl?: string;
}

interface LocationInfo {
  id?: string;
  weddingId?: string;
  label: string;
  address?: string;
  postalCode?: string;
  city?: string;
  lat?: number;
  lng?: number;
  arrivalTime?: string;
  notes?: string;
  crew?: CrewMember[];
  checkedIn?: boolean;
  checkedInAt?: string | null;
}

interface Checkin {
  memberName: string;
  memberRole: string;
  checkedInAt: string;
}

interface CrewPosition {
  memberName: string;
  memberRole: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  updatedAt: string;
}

interface PlanConflict {
  a: PlanRow;
  b: PlanRow;
  names: string[];
}

const CREW_ROLE_LABEL: Record<string, string> = {
  fotograf: 'Fotograf', videograf: 'Videograf', editor: 'Editor', lyd: 'Lydtekniker',
  assistent: 'Assistent', begge: 'Begge', produsent: 'Produsent',
};

const SAMPLE_LOCATIONS: LocationInfo[] = [
  { label: 'Hjemme', address: 'Smedstuveien 12', postalCode: '0283', city: 'Oslo', lat: 59.9229, lng: 10.641, crew: [{ id: 's1', name: 'Mia Solberg', crewRole: 'fotograf' }] },
  { label: 'Privat location', address: 'Bygdøy Allé 88', postalCode: '0265', city: 'Oslo', lat: 59.9189, lng: 10.6946, crew: [{ id: 's2', name: 'Jonas Vik', crewRole: 'videograf' }] },
  { label: 'Kirken', address: 'Holmenkollveien 58', postalCode: '0787', city: 'Oslo', lat: 59.9631, lng: 10.6668, crew: [{ id: 's3', name: 'Mia Solberg', crewRole: 'fotograf' }, { id: 's4', name: 'Trym Dahl', crewRole: 'assistent' }] },
  { label: 'Location 2', address: 'Frognerseterveien 25', postalCode: '0788', city: 'Oslo', lat: 59.9828, lng: 10.6691, crew: [{ id: 's5', name: 'Jonas Vik', crewRole: 'videograf' }, { id: 's6', name: 'Emilie Strand', crewRole: 'lyd' }] },
  { label: 'Festsalen', address: 'Kongens gate 5', postalCode: '0153', city: 'Oslo', lat: 59.9124, lng: 10.7354, crew: [{ id: 's7', name: 'Nora Berg', crewRole: 'editor' }] },
];

const crewLine = (loc: string, locations: LocationInfo[] | null): string | null => {
  if (!loc || loc === '–') return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const all = locations || [];
  const hit =
    all.find((l) => norm(l.label) === norm(loc)) ||
    all.find((l) => norm(loc).includes(norm(l.label)) || norm(l.label).includes(norm(loc)));
  const crew = hit?.crew || [];
  if (!crew.length) return null;
  return crew.map((c) => `${c.name} (${CREW_ROLE_LABEL[c.crewRole] || c.crewRole})`).join(' · ');
};

const locationLine = (loc: string, locations: LocationInfo[] | null): string | null => {
  if (!loc || loc === '–') return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const all = locations || [];
  const hit =
    all.find((l) => norm(l.label) === norm(loc)) ||
    all.find((l) => norm(loc).includes(norm(l.label)) || norm(l.label).includes(norm(loc)));
  if (!hit) return null;
  const bits = [hit.address, hit.postalCode, hit.city].filter(Boolean);
  return bits.length ? bits.join(', ') : null;
};

const normKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Dag-offset (0 = i dag) for en hendelse med eventTime; uten dato → 0 */
const dayOffsetOf = (iso?: string) => {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86400000);
};

/** Rette-linje-avstand i km (haversine) × veifaktor, som estimat for kjøretid */
const haversineKm = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const ROAD_FACTOR = 1.35; // rett-linje → vei
const DRIVE_SPEED_KMH = 34; // blandet by/land
const driveMin = (a: [number, number], b: [number, number]) => Math.max(2, Math.round(((haversineKm(a, b) * ROAD_FACTOR) / DRIVE_SPEED_KMH) * 60));

/* ---- Location Map (Kart-visningen) ---- */

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const avatarsOf = (crew: CrewMember[], size = 22): string =>
  crew
    .slice(0, 3)
    .map((c) => {
      const src = c.avatarUrl || avatarSrc(c.name, Math.round(size * 1.6));
      return `<img src="${escHtml(src)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #191926;" onerror="this.style.display='none'" />`;
    })
    .join('');

/** Ui-avatars-fallback for crew uten profilbilde */
const avatarSrc = (name: string, size = 44) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=c084fc&color=0d0d16&font-size=0.4&bold=true&size=${size}`;

/** Ui-avatars med initialer i crew-rolle-fargen (bakgrunnsfarge = rolle) */
const roleAvatarSrc = (name: string, role: string, size = 56) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=${(CREW_ROLE_COLOR[role] || '#a78bfa').replace('#', '')}&color=0d0d16&font-size=0.4&bold=true&size=${size}`;

/** Initialer-skive med rollefarge (fallback når bildet ikke lastes) */
const roleInitials = (name: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/* ---- Animated drive icon (CreatorHub) ---- */
/** Custom SVG-bil med spinnerende hjul, fartsstreker og bevegende veistripe */
const WsDriveIcon = ({ color = '#8b8ba3', size = 19 }: { color?: string; size?: number }) => (
  <svg width={size} height={Math.round(size * 0.62)} viewBox="0 0 24 15" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
    <defs>
      <linearGradient id="wsDriveGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#fbbf24" />
      </linearGradient>
    </defs>
    <g className="ws-drive-bob">
      <g className="ws-drive-streaks">
        <line x1="0.4" y1="3.5" x2="2.8" y2="3.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="0.2" y1="5.6" x2="2.6" y2="5.6" stroke={color} strokeWidth="1.2" strokeLinecap="round" style={{ animationDelay: '0.14s' }} />
        <line x1="0.5" y1="7.7" x2="2.9" y2="7.7" stroke={color} strokeWidth="1.2" strokeLinecap="round" style={{ animationDelay: '0.28s' }} />
      </g>
      <path d="M2.6 9.1 C1.7 9.1 1.1 8.3 1.4 7.5 L1.9 6 C2.3 4.6 3.6 3.7 5.1 3.5 L7.6 3 L8.9 1.7 C9.5 1.1 10.3 0.9 11 0.9 L13.8 0.9 C14.7 0.9 15.5 1.3 16.1 2 L17.3 3.4 L20 3.9 C21.9 4.3 23.1 5.7 23.1 7.3 L23.1 8.1 C23.1 9.1 22.3 9.7 21.4 9.7 Z" fill="url(#wsDriveGrad)" stroke="#fdba74" strokeWidth="0.8" strokeLinejoin="round" />
      <rect x="9.6" y="2" width="5.4" height="2.8" rx="0.8" fill="#0d0d16" opacity="0.9" />
      <rect x="5.7" y="2.4" width="3.2" height="2.3" rx="0.7" fill="#0d0d16" opacity="0.9" />
      <g className="ws-drive-wheel">
        <circle cx="6" cy="11" r="2.3" fill="#0d0d16" />
        <path d="M6 9.4v3.2M4.4 11h3.2" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
      </g>
      <g className="ws-drive-wheel">
        <circle cx="18" cy="11" r="2.3" fill="#0d0d16" />
        <path d="M18 9.4v3.2M16.4 11h3.2" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" />
      </g>
      <line x1="2" y1="14.4" x2="22" y2="14.4" stroke={color} strokeWidth="1" strokeDasharray="3 3" strokeLinecap="round" className="ws-drive-road" opacity="0.7" />
      <g className="ws-drive-smoke">
        <circle cx="2.2" cy="8.6" r="0.9" fill="#cbd5e1" />
        <circle cx="2.2" cy="8.6" r="0.9" fill="#cbd5e1" style={{ animationDelay: '0.3s' }} />
        <circle cx="2.2" cy="8.6" r="0.9" fill="#cbd5e1" style={{ animationDelay: '0.6s' }} />
      </g>
    </g>
  </svg>
);

const CREW_ROLE_COLOR: Record<string, string> = {
  fotograf: '#c084fc', videograf: '#34d399', editor: '#fbbf24', lyd: '#60a5fa',
  assistent: '#f472b6', begge: '#22d3ee', produsent: '#f97316',
};

/** DivIcon-pin: lokasjons-chip med etikett + crew-avatarer, peker ned på punktet */
const buildLocPinIcon = (label: string, crew: CrewMember[], opts?: { critical?: boolean; current?: boolean; next?: boolean }): L.DivIcon => {
  const { critical, current, next } = opts || {};
  const ring = critical ? '#f87171' : current ? '#34d399' : next ? '#fbbf24' : '#3d3d55';
  const glow = current ? '0 0 22px rgba(52,211,153,.55)' : next ? '0 0 18px rgba(251,191,36,.45)' : '0 4px 16px rgba(0,0,0,.6)';
  const dotCol = critical ? '#f87171' : current ? '#34d399' : next ? '#fbbf24' : '';
  const dot = dotCol ? `<span style="width:8px;height:8px;border-radius:50%;background:${dotCol};flex-shrink:0;"></span>` : '';
  const avatars = avatarsOf(crew, 19);
  const more = crew.length > 3 ? `<span style="font-size:10px;color:#a1a1b5;font-weight:600;">+${crew.length - 3}</span>` : '';
  return L.divIcon({
    className: 'prod-loc-pin',
    html: `<div style="position:relative;transform:translateY(-100%);width:max-content;max-width:168px;">
      <div style="display:flex;align-items:center;gap:5px;background:#15151f;border:1.5px solid ${ring};border-radius:14px;padding:4px 9px 4px 6px;box-shadow:${glow};color:#fff;font-weight:700;font-size:11.5px;white-space:nowrap;overflow:hidden;">
        <span style="color:#c084fc;font-size:13px;line-height:1;flex-shrink:0;">&#128205;</span>
        ${dot}
        <span style="overflow:hidden;text-overflow:ellipsis;">${escHtml(label)}</span>
        ${avatars}${more}
      </div>
      <div style="margin:2px auto 0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${ring};"></div>
    </div>`,
    iconSize: [168, 40],
    iconAnchor: [84, 40],
    popupAnchor: [0, -40],
  });
};

/** Live-posisjons-pin for crew (rolle-farget ring + grønn prikk hvis fersk). «me» = egen profil, markeres ekstra */
const buildCrewPinIcon = (name: string, role: string, fresh: boolean, avatarUrl?: string, me?: boolean): L.DivIcon => {
  const color = me ? '#22d3ee' : CREW_ROLE_COLOR[role] || '#a78bfa';
  const src = avatarUrl || avatarSrc(name, 40);
  const inner = `<img src="${escHtml(src)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;display:block" onerror="this.style.display='none'" />`;
  const ring = me
    ? `border:3px solid ${color};box-shadow:0 0 0 2px rgba(0,0,0,.55), 0 0 22px ${color}cc;`
    : `border:3px solid ${color};box-shadow:0 0 0 2px rgba(0,0,0,.55), 0 0 18px ${color}66;`;
  const pulse = me ? `<div class="prod-pin-pulse" style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${color}88;"></div>` : '';
  const meBadge = me ? `<div style="position:absolute;top:-8px;right:-8px;background:${color};color:#0a0a0f;font-size:9px;font-weight:800;padding:1px 5px;border-radius:8px;border:1.5px solid #0a0a0f;z-index:2;">Du</div>` : '';
  const html = `<div style="position:relative;width:44px;height:44px;">
      ${pulse}
      <div style="position:absolute;inset:0;border-radius:50%;${ring}background:#0a0a0f;display:flex;align-items:center;justify-content:center;overflow:hidden;">${inner}</div>
      ${meBadge}
      ${fresh ? `<div style="position:absolute;bottom:0;right:0;width:11px;height:11px;border-radius:50%;background:#34d399;border:2px solid #0a0a0f;"></div>` : ''}
    </div>`;
  return L.divIcon({ html, className: 'crew-pin', iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -22] });
};

/** Fitter kartet til alle pins (kun når keys endres) */
const FitLocations = ({ fitKey, markers }: { fitKey: string; markers: Array<[number, number]> }) => {
  const map = useMap();
  React.useEffect(() => {
    if (markers.length === 1) { map.setView(markers[0], 13); return; }
    if (markers.length > 1) map.fitBounds(markers, { padding: [48, 48], maxZoom: 15 });
  }, [map, fitKey, markers]);
  return null;
};

const SYMBOL_LABEL: Record<string, string> = {
  clearsky: 'Klarvær', fair: 'Pent vær', partlycloudy: 'Delvis skyet', cloudy: 'Skyet',
  fog: 'Tåke', lightrain: 'Lett regn', rain: 'Regn', heavyrain: 'Kraftig regn',
  lightrainshowers: 'Lette regnbyger', rainshowers: 'Regnbyger', heavyrainshowers: 'Kraftige regnbyger',
  sleet: 'Sludd', lightsnow: 'Lett snø', snow: 'Snø', lightsleet: 'Lett sludd',
  thunder: 'Torden', rainandthunder: 'Regn og torden', snowandthunder: 'Snø og torden',
};

const SYMBOL_ICON: Record<string, string> = {
  clearsky: 'WbSunny', fair: 'WbSunny', partlycloudy: 'CloudQueue', cloudy: 'Cloud',
  fog: 'BlurOn', lightrain: 'Grain', rain: 'Umbrella', heavyrain: 'Umbrella',
  lightrainshowers: 'Grain', rainshowers: 'Grain', heavyrainshowers: 'Umbrella',
  sleet: 'AcUnit', lightsnow: 'AcUnit', snow: 'AcUnit', lightsleet: 'AcUnit',
  thunder: 'Thunderstorm', rainandthunder: 'Thunderstorm', snowandthunder: 'Thunderstorm',
};

const symbolLabel = (code?: string) => {
  if (!code) return 'Skiftende vær';
  return SYMBOL_LABEL[code.split('_')[0]] || 'Skiftende vær';
};

const symbolIcon = (code?: string) => {
  if (!code) return 'Cloud';
  return SYMBOL_ICON[code.split('_')[0]] || 'Cloud';
};

const SYMBOL_ICON_COMPONENT: Record<string, React.ElementType> = {
  WbSunny, CloudQueue, Cloud, BlurOn, Grain, Umbrella, AcUnit, Thunderstorm,
};
const weatherIcon = (code?: string, sx: any = { fontSize: 18 }) => {
  const Icon = SYMBOL_ICON_COMPONENT[symbolIcon(code)] || Cloud;
  return <Icon sx={sx} />;
};

const COMPASS = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
const compass = (deg?: number) => (deg == null ? '' : COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]);

const SAMPLE_FORECAST: ForecastDay[] = [
  { offset: 0, temperature: 17, precipitation: 0.2, symbol: 'partlycloudy' },
  { offset: 1, temperature: 19, precipitation: 0, symbol: 'clearsky' },
  { offset: 2, temperature: 14, precipitation: 2.4, symbol: 'rain' },
];

const tidMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 480;
  return h * 60 + m;
};

const ROWS: PlanRow[] = [
  { id: 's0', tid: '08:00 – 10:00', moment: 'Forberedelser', sub: 'Brud & brudgom', foto: ['Detaljer', 'Getting Ready'], video: ['A-cam', 'B-roll'], lyd: ['Lav mic', 'Room tone'], ansvarlig: 'Daniel (Foto)', status: ['Ferdig', 'green'], notat: 'Brud hjemme · Backm på hotell', startMin: tidMin('08:00'), endMin: tidMin('10:00'), sted: 'Hjemme' },
  { id: 's1', tid: '10:30 – 11:00', moment: 'First look', sub: 'Parportretter', foto: ['Portretter', 'Detaljer'], video: ['A-cam', 'Slow motion'], lyd: ['Lav mic'], ansvarlig: 'Emma (Video)', status: ['Ferdig', 'green'], notat: 'Intimt øyeblikk · Privat location', startMin: tidMin('10:30'), endMin: tidMin('11:00'), sted: 'Privat location' },
  { id: 's2', tid: '12:15 – 13:00', moment: 'Vielse', sub: 'Seremoni', foto: ['Seremoni', 'Reaksjoner'], video: ['A-cam', 'B-cam'], lyd: ['Lav mic', 'Backup rec'], ansvarlig: 'Daniel (Foto)', status: ['Kritisk', 'red'], notat: 'Kirken · Lyd sjekk 11:30', active: true, startMin: tidMin('12:15'), endMin: tidMin('13:00'), sted: 'Kirken' },
  { id: 's3', tid: '13:00 – 13:45', moment: 'Familiebilder', sub: 'Gruppebilder', foto: ['Gruppebilder', 'Portretter'], video: ['B-roll', 'Oversikter'], lyd: ['Lav mic'], ansvarlig: 'Lukas (Editor)', status: ['Pågår', 'amber'], notat: 'Storfamilie · Effektiv flyt', startMin: tidMin('13:00'), endMin: tidMin('13:45'), sted: 'Kirken' },
  { id: 's4', tid: '16:30 – 17:30', moment: 'Golden hour', sub: 'Parportretter', foto: ['Portretter', 'Kreative shots'], video: ['Cinematics', 'B-roll'], lyd: ['Lav mic', 'Vindbeskyttelse'], ansvarlig: 'Emma (Video)', status: ['Planlagt', 'blue'], notat: 'Golden hour flyttet til 18:15', startMin: tidMin('16:30'), endMin: tidMin('17:30'), sted: 'Location 2' },
  { id: 's5', tid: '19:30 – 20:45', moment: 'Taler', sub: 'Toast & taler', foto: ['Taler', 'Reaksjoner'], video: ['A-cam', 'B-cam'], lyd: ['Lav mic', 'Backup rec'], ansvarlig: 'Daniel (Foto)', status: ['Planlagt', 'blue'], notat: '3 taler bekreftet', startMin: tidMin('19:30'), endMin: tidMin('20:45'), sted: 'Festsalen' },
];

const SAMPLE_POSITIONS: CrewPosition[] = [
  { memberName: 'Mia Solberg', memberRole: 'fotograf', lat: 59.9531, lng: 10.6736, updatedAt: new Date().toISOString() },
  { memberName: 'Jonas Vik', memberRole: 'videograf', lat: 59.9623, lng: 10.6705, updatedAt: new Date(Date.now() - 42 * 60000).toISOString() },
  { memberName: 'Emilie Strand', memberRole: 'lyd', lat: 59.9675, lng: 10.6788, updatedAt: new Date(Date.now() - 9 * 60000).toISOString() },
];

const UPDATES = [
  { who: 'Marcus (Lyd)', t: '10:12', msg: 'Groom mic sjekket og klar. Backup recorder testet.' },
  { who: 'Daniel (Foto)', t: '10:14', msg: 'Objektiver klare. Har med 85mm & 35mm.' },
  { who: 'Emma (Video)', t: '10:15', msg: 'Batterier byttet på begge kameraer.' },
  { who: 'Lukas (Editor)', t: '10:16', msg: 'SSD-er formatert og klare for backup.' },
];
const ALERTS = [
  { tone: 'red', title: 'Drone permit godkjent', t: '10:05', sub: 'Gyldig til 22:00 i dag.' },
  { tone: 'amber', title: 'Golden hour flyttet', t: '10:10', sub: 'Ny tid 18:15 pga. skyer.' },
  { tone: 'blue', title: 'Transport til location 2', t: '09:50', sub: 'Avreise 15:30 fra kirken.' },
];

const fmtClock = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
};

const fmtWhen = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} ${time}`;
};

const ACT_ICON: Record<string, React.ReactNode> = {
  note: <StickyNote2 sx={{ fontSize: 14, color: '#fbbf24' }} />,
  status: <CheckCircle sx={{ fontSize: 14, color: '#34d399' }} />,
  event: <Event sx={{ fontSize: 14, color: '#60a5fa' }} />,
  checkin: <Place sx={{ fontSize: 14, color: '#38bdf8' }} />,
  position: <MyLocation sx={{ fontSize: 14, color: '#a78bfa' }} />,
};

// Sample-referanser for demo (colorgradient-fliser som minner om moodboard-bilder)
const SAMPLE_REF_URL = (a: string, b: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>`)}`;
const SAMPLE_REFS: WsImageItem[] = [
  { id: 'ref-1', url: SAMPLE_REF_URL('#6366f1', '#22d3ee'), label: 'Parportrett', category: 'Kirken' },
  { id: 'ref-2', url: SAMPLE_REF_URL('#f59e0b', '#ef4444'), label: 'Golden hour', category: 'Location 2' },
  { id: 'ref-3', url: SAMPLE_REF_URL('#10b981', '#0ea5e9'), label: 'Naturlig lys', category: 'Privat location' },
  { id: 'ref-4', url: SAMPLE_REF_URL('#a855f7', '#ec4899'), label: 'Close-up', category: 'Festsalen' },
  { id: 'ref-5', url: SAMPLE_REF_URL('#0ea5e9', '#6366f1'), label: 'B-roll', category: 'Location 2' },
  { id: 'ref-6', url: SAMPLE_REF_URL('#f43f5e', '#f59e0b'), label: 'Drone', category: 'Kirken' },
  { id: 'ref-7', url: SAMPLE_REF_URL('#22c55e', '#84cc16'), label: 'Detaljer', category: 'Hjemme' },
];

const STATUS_ONLY: Record<string, PlanStatus> = {
  ferdig: 'Ferdig', done: 'Ferdig', completed: 'Ferdig',
  pågår: 'Pågår', in_progress: 'Pågår', current: 'Pågår',
  kritisk: 'Kritisk',
  planlagt: 'Planlagt', planned: 'Planlagt',
};
const STATUS_TONE: Record<string, string> = { ferdig: 'green', done: 'green', completed: 'green', pågår: 'amber', in_progress: 'amber', current: 'amber', kritisk: 'red', planlagt: 'blue', planned: 'blue' };
const STATUS_API: Record<PlanStatus, string> = { Ferdig: 'completed', Pågår: 'in_progress', Planlagt: 'planned', Kritisk: 'kritisk' };
const STATUS_TONE_BY_LABEL: Record<PlanStatus, string> = { Ferdig: 'green', Pågår: 'amber', Planlagt: 'blue', Kritisk: 'red' };
const statusOf = (s?: string): [PlanStatus, string] => {
  const k = (s || 'planned').toLowerCase();
  return [STATUS_ONLY[k] || 'Planlagt', STATUS_TONE[k] || 'blue'];
};
const addMin = (hhmm: string, m: number) => {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return '';
  const [h, mm] = hhmm.split(':').map(Number);
  const t = (h * 60 + mm + (m || 0)) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const toneHex = (tone: string) => (ws as Record<string, string>)[tone] || ws.accent;

const BOARD_COLS: { key: PlanStatus; tone: string }[] = [
  { key: 'Kritisk', tone: 'red' },
  { key: 'Pågår', tone: 'amber' },
  { key: 'Planlagt', tone: 'blue' },
  { key: 'Ferdig', tone: 'green' },
];
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'Pågår', label: 'Pågår' },
  { key: 'Planlagt', label: 'Planlagt' },
  { key: 'Ferdig', label: 'Ferdig' },
  { key: 'Kritisk', label: 'Kritisk' },
];

const AnsvarligCell: React.FC<{ name: string }> = ({ name }) => {
  const initial = name.trim().slice(0, 1);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {initial ? (
        <Avatar sx={{ width: 22, height: 22, fontSize: 10 }}>{initial}</Avatar>
      ) : (
        <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: ws.panelAlt, color: ws.textFaint }}>–</Avatar>
      )}
      <Typography sx={{ fontSize: 12 }}>{name || '–'}</Typography>
    </Stack>
  );
};

const ProduksjonskartTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [view, setView] = useState<ViewKey>(() => (typeof window !== 'undefined' ? ((localStorage.getItem('pm.view') as ViewKey) || 'timeline') : 'timeline'));
  const [filter, setFilter] = useState<FilterKey>(() => (typeof window !== 'undefined' ? ((localStorage.getItem('pm.filter') as FilterKey) || 'alle') : 'alle'));
  const [dayOffset, setDayOffset] = useState(0);
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  const [printOpen, setPrintOpen] = useState(false);
  const [printOpts, setPrintOpts] = useState({ timeline: true, events: true, weather: true, locations: true, notes: true });
  const [lightbox, setLightbox] = useState<WsImageItem | null>(null);
  React.useEffect(() => { try { localStorage.setItem('pm.view', view); } catch { /* */ } }, [view]);
  React.useEffect(() => { try { localStorage.setItem('pm.filter', filter); } catch { /* */ } }, [filter]);
  const refs = useProjectImages(projectId, 'references');
  const isReal = projectId && projectId !== 'sample';
  const { user } = useAuth();
  const [events, setEvents] = useState<WeddingEvent[] | null>(null);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [, navigate] = useLocation();
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [filterMenu, setFilterMenu] = useState<null | HTMLElement>(null);
  const [sampleRows, setSampleRows] = useState<PlanRow[]>(ROWS);
  const [statusMenu, setStatusMenu] = useState<null | { anchor: HTMLElement; row: PlanRow }>(null);
  const [editor, setEditor] = useState<null | { mode: 'add' } | { mode: 'edit'; row: PlanRow }>(null);
  const [form, setForm] = useState({ title: '', time: '', duration: '45', location: '', description: '', status: 'Planlagt' as PlanStatus });
  const [savingEvent, setSavingEvent] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationInfo[] | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  // Varsler: dismiss/snooze state (persisted per prosjekt)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined' && isReal) {
      try {
        const key = `pm.alerts.dismissed.${projectId}`;
        const stored = localStorage.getItem(key);
        return new Set(stored ? JSON.parse(stored) : []);
      } catch { return new Set(); }
    }
    return new Set();
  });
  const [snoozedAlerts, setSnoozedAlerts] = useState<Map<string, number>>(() => {
    if (typeof window !== 'undefined' && isReal) {
      try {
        const key = `pm.alerts.snoozed.${projectId}`;
        const stored = localStorage.getItem(key);
        const obj = stored ? JSON.parse(stored) : {};
        const now = Date.now();
        const valid = new Map<string, number>();
        Object.entries(obj).forEach(([id, until]) => { if (typeof until === 'number' && until > now) valid.set(id, until); });
        return valid;
      } catch { return new Map(); }
    }
    return new Map();
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Live koordinering — aktivitets-feed: handlinger fra hele teamet (notater,
  // statusendringer, hendelser, check-ins, posisjonsdeling) postes og polles
  // her hvert 15. sekund i ekte prosjekter.
  const [activity, setActivity] = useState<CoordinationActivity[]>([]);
  const loadActivity = React.useCallback(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/coordination-activity?limit=30`)
      .then((r: any) => setActivity(Array.isArray(r?.activities) ? r.activities : []))
      .catch(() => {});
  }, [isReal, projectId]);
  const pushActivity = React.useCallback((type: string, message: string, meta?: Record<string, unknown>) => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/coordination-activity`, {
      method: 'POST',
      body: { type, message, meta },
    }).catch(() => {});
  }, [isReal, projectId]);

  React.useEffect(() => {
    if (!isReal) return;
    loadActivity();
    const t = window.setInterval(loadActivity, 15000);
    return () => window.clearInterval(t);
  }, [isReal, loadActivity]);

  // Team Sync → team-chat-kanal: oppretter «Team-synk» med hele crewet som
  // deltakere (POST /api/chat/channels) og åpner chat-taben. Eksisterer den
  // allerede, gjenbrukes den — ingen duplikater.
  const createTeamChat = async () => {
    if (!isReal || chatBusy) return;
    setChatBusy(true);
    try {
      const emails = Array.from(new Set((sync?.members || []).map((m) => (m.email || '').trim()).filter(Boolean)));
      const existing = await apiRequest(`/api/chat/channels?projectId=${encodeURIComponent(projectId)}`).catch(() => ({ channels: [] }));
      const found = (existing?.channels || []).find((c: any) => c.kind === 'team' && c.name.toLowerCase() === 'team-synk');
      if (!found) {
        await apiRequest('/api/chat/channels', {
          method: 'POST',
          body: { projectId, name: 'Team-synk', description: 'Team Sync — produksjonskart', participantIds: emails },
        });
      }
      setSyncOpen(false);
      navigate(`/workspace/${projectId}/chat`);
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke opprette chatten');
    } finally {
      setChatBusy(false);
    }
  };

  const loadNotes = () => {
    if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/notes?context=produksjonskart`).then((r: any) => setNotes(r?.notes || [])).catch(() => {});
  };
  const addNote = async () => {
    const body = noteText.trim();
    if (!body || savingNote) return;
    setSavingNote(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/notes`, { method: 'POST', body: { body, context: 'produksjonskart' } });
      setNoteText('');
      loadNotes();
      pushActivity('note', `la til et notat: «${body.slice(0, 100)}${body.length > 100 ? '…' : ''}»`);
      loadActivity();
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke lagre notat');
    } finally {
      setSavingNote(false);
    }
  };
  const deleteNote = async (id: string) => {
    if (!isReal) return;
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/notes/${id}`, { method: 'DELETE' });
      setNotes(prev => prev.filter((n) => n.id !== id));
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke slette notat');
    }
  };

  const reloadEvents = React.useCallback(() => {
    if (!isReal) return;
    apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}`).then((r: any) => {
      const e = Array.isArray(r?.events) ? r.events as WeddingEvent[] : [];
      setEvents(e.length ? e : []);
      if (r?.weddingId) setWeddingId(r.weddingId);
    }).catch(() => {});
  }, [isReal, projectId]);

  React.useEffect(() => {
    if (!isReal) return;
    reloadEvents();
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team-sync`).then((r: any) => setSync((r as SyncState) || null)).catch(() => {});
  }, [isReal, reloadEvents]);

  // Hurtignotat: last inn + poll hvert 30. sekund så andres notater dukker opp
  React.useEffect(() => {
    if (!isReal) return;
    loadNotes();
    const t = window.setInterval(loadNotes, 30000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReal, projectId]);

  const openAdd = () => {
    setForm({ title: '', time: '', duration: '45', location: '', description: '', status: 'Planlagt' });
    setEditor({ mode: 'add' });
  };

  const loadWeather = React.useCallback(async () => {
    if (!isReal) return;
    setWeatherLoading(true);
    try {
      const [cur, fc] = await Promise.all([
        apiRequest('/api/price-administration/weather/current/oslo'),
        apiRequest('/api/price-administration/weather/forecast/oslo?days=7'),
      ]);
      if (cur?.success) setWeather(cur);
      if (fc?.success && Array.isArray(fc.forecast)) setForecast(fc.forecast);
    } catch {
      // Behold eventuell forrige data; modalen viser tom-tilstand.
    } finally {
      setWeatherLoading(false);
    }
  }, [isReal]);

  const loadLocations = React.useCallback(async () => {
    if (!isReal || !weddingId) return;
    try {
      const r = await apiRequest(`/api/wedding/${encodeURIComponent(weddingId)}/locations-with-alternatives`);
      const flat: LocationInfo[] = [];
      for (const p of Array.isArray(r?.locations) ? r.locations : []) {
        flat.push({ id: p.id, weddingId, label: p.label, address: p.address, postalCode: p.postalCode, city: p.city, lat: p.lat ?? undefined, lng: p.lng ?? undefined, arrivalTime: p.arrivalTime, notes: p.notes, crew: Array.isArray(p.crew) ? p.crew : [], checkedIn: !!p.checkedIn, checkedInAt: p.checkedInAt ?? null });
        for (const a of Array.isArray(p.alternatives) ? p.alternatives : []) {
          flat.push({ id: a.id, weddingId, label: a.label, address: a.address, postalCode: a.postalCode, city: a.city, lat: a.lat ?? undefined, lng: a.lng ?? undefined, arrivalTime: a.arrivalTime, notes: a.notes, crew: Array.isArray(a.crew) ? a.crew : [], checkedIn: !!a.checkedIn, checkedInAt: a.checkedInAt ?? null });
        }
      }
      setLocations(flat);
    } catch {
      setLocations(null);
    }
  }, [isReal, weddingId]);

  const openWeather = () => {
    setWeatherOpen(true);
    loadWeather();
    loadLocations();
  };

  const loadSync = React.useCallback(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team-sync`).then((r: any) => setSync((r as SyncState) || null)).catch(() => {});
  }, [isReal, projectId]);

  React.useEffect(() => {
    if (!isReal) return;
    const t = window.setInterval(loadSync, 30000);
    return () => window.clearInterval(t);
  }, [isReal, loadSync]);

  const openSync = () => {
    setSyncOpen(true);
    loadSync();
  };

  const [crewOpen, setCrewOpen] = useState(false);
  const openCrew = () => {
    setCrewOpen(true);
    if (isReal) loadLocations();
  };
  const openEdit = (row: PlanRow) => {
    const [start] = row.tid.split(' – ');
    const dur = Math.max(0, Math.round((row.endMin - row.startMin) / 60) * 60) || 60;
    const durMin = row.endMin - row.startMin;
    setForm({ title: row.moment, time: start || '', duration: String(durMin > 0 ? durMin : 60), location: row.sted === '–' ? '' : row.sted, description: row.notat, status: row.status[0] });
    setEditor({ mode: 'edit', row });
  };

  // Hopp til et kritisk øyeblikk i Plan-visningen (gantt) og marker det kort
  const jumpToMoment = (title: string) => {
    setDayOffset(0);
    setView('plan');
    setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>('[data-ws-kart-block]')].find((n) => n.getAttribute('data-ws-kart-block') === title);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.animate([{ outline: `2px solid ${ws.accent}`, outlineOffset: 2 }, { outline: '2px solid transparent' }], { duration: 1400, iterations: 1 });
      }
    }, 90);
  };

  const changeStatus = async (row: PlanRow, next: PlanStatus) => {
    setStatusMenu(null);
    const tone = STATUS_TONE_BY_LABEL[next];
    if (!isReal) {
      setSampleRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: [next, tone] } : r)));
      return;
    }
    try {
      await apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}/events/${encodeURIComponent(row.id)}`, { method: 'PUT', body: { status: STATUS_API[next] } });
      reloadEvents();
      pushActivity('status', `merket «${row.moment}» som ${next}`, { to: next });
      loadActivity();
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke endre status');
    }
  };

  const saveEvent = async () => {
    const title = form.title.trim();
    const time = form.time.trim();
    const dur = Math.max(0, parseInt(form.duration || '0', 10) || 0);
    if (!title || !/^\d{2}:\d{2}$/.test(time) || savingEvent) return;
    setSavingEvent(true);
    const tone = STATUS_TONE_BY_LABEL[form.status];
    try {
      if (!isReal) {
        const start = tidMin(time);
        const end = dur ? start + dur : start + 1;
        const tid = dur ? `${time} – ${addMin(time, dur)}` : time;
        if (editor?.mode === 'edit' && editor.row) {
          setSampleRows((prev) => prev.map((r) => (r.id === editor.row!.id ? {
            ...r, moment: title, tid, notat: form.description.trim(), sted: form.location.trim() || r.sted,
            sub: form.location.trim() || r.sub, status: [form.status, tone], startMin: start, endMin: end,
          } : r)));
        } else {
          setSampleRows((prev) => [...prev, {
            id: `s${Date.now()}`, tid, moment: title, sub: form.location.trim() || '–', foto: [], video: [], lyd: [],
            ansvarlig: '', status: [form.status, tone], notat: form.description.trim(),
            startMin: start, endMin: end, sted: form.location.trim() || '–',
          }]);
        }
        setEditor(null);
      } else {
        const body: Record<string, unknown> = { title, time, duration: dur, location: form.location.trim(), description: form.description.trim(), status: STATUS_API[form.status] };
        if (editor?.mode === 'edit' && editor.row) {
          await apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}/events/${encodeURIComponent(editor.row.id)}`, { method: 'PUT', body });
          pushActivity('event', `oppdaterte hendelsen «${title}»`);
        } else {
          await apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}/events`, { method: 'POST', body });
          pushActivity('event', `la til hendelsen «${title}»`);
        }
        setEditor(null);
        reloadEvents();
        loadActivity();
      }
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke lagre hendelse');
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteEvent = async () => {
    if (!editor || editor.mode !== 'edit' || savingEvent) return;
    const row = editor.row;
    setSavingEvent(true);
    try {
      if (!isReal) {
        setSampleRows((prev) => prev.filter((r) => r.id !== row.id));
      } else {
        await apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}/events/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
        reloadEvents();
        pushActivity('event', `slettet hendelsen «${row.moment}»`);
        loadActivity();
      }
      setEditor(null);
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke slette hendelse');
    } finally {
      setSavingEvent(false);
    }
  };

  const StatusPill: React.FC<{ row: PlanRow; onOpen?: (e: React.MouseEvent) => void }> = ({ row, onOpen }) => (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`Endre status for ${row.moment}`}
      onClick={(e) => { e.stopPropagation(); setStatusMenu({ anchor: e.currentTarget, row }); onOpen?.(e); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setStatusMenu({ anchor: e.currentTarget, row }); } }}
      sx={{ display: 'inline-flex', cursor: 'pointer', borderRadius: 1, '&:hover': { outline: `1px solid ${ws.accentBorder}`, outlineOffset: 1 }, '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 1 } }}
    >
      <WsTag label={row.status[0]} tone={row.status[1] as 'green' | 'amber' | 'red' | 'blue' | 'accent' | 'neutral'} />
    </Box>
  );

  const syncPct = isReal ? (sync?.pct ?? null) : 82;
const SAMPLE_NOW = Date.now();

const SAMPLE_SYNC: SyncState = {
  pct: 82,
  online: 5,
  teamSize: 8,
  owner: { name: 'Qazi FotoReel', email: 'qazifotoreel@gmail.com' },
  readiness: [
    { label: 'Oppgaver fullført', done: false, value: '12/15' },
    { label: 'Sjekkliste klar', done: true, value: '8/8' },
  ],
  members: [
    { name: 'Mia Solberg', crewRole: 'fotograf', online: true, lastSeen: new Date(SAMPLE_NOW - 30 * 1000).toISOString() },
    { name: 'Jonas Vik', crewRole: 'videograf', online: true, lastSeen: new Date(SAMPLE_NOW - 2 * 60 * 1000).toISOString() },
    { name: 'Emilie Strand', crewRole: 'lyd', online: true, lastSeen: new Date(SAMPLE_NOW - 5 * 60 * 1000).toISOString() },
    { name: 'Nora Berg', crewRole: 'editor', online: false, lastSeen: new Date(SAMPLE_NOW - 22 * 3600 * 1000).toISOString() },
    { name: 'Trym Dahl', crewRole: 'assistent', online: true, lastSeen: new Date(SAMPLE_NOW - 45 * 60 * 1000).toISOString() },
    { name: 'Sander Moe', crewRole: 'fotograf', online: false, lastSeen: null },
    { name: 'Ola Nordli', crewRole: 'assistent', online: false, lastSeen: null },
  ],
};

const lastSeenLabel = (iso?: string | null): string => {
  if (!iso) return 'aldri sett';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'aldri sett';
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'nå';
  if (min < 60) return `for ${min} min siden`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `for ${hrs} t siden`;
  const d = new Date(t);
  const days = Math.floor(hrs / 24);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (days === 1) return `i går kl. ${hm}`;
  if (days < 7) return `${days} dager siden`;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const crewOnline = sync ? sync.online ?? 0 : 6;
const crewTotal = sync ? sync.teamSize ?? 8 : 8;
const syncMembers = isReal ? (sync?.members || []) : (SAMPLE_SYNC.members || []);
const syncReadiness = isReal ? (sync?.readiness || []) : (SAMPLE_SYNC.readiness || []);
const syncOwner = isReal ? (sync?.owner || null) : SAMPLE_SYNC.owner;

  // Sted-feltet i hendelseseditoren: matcher lokasjonsdata (samme norm som
  // crewLine/locationLine) → adresse + crew vises synkronisert live.
  const formLocMatch = React.useMemo(() => {
    const loc = form.location.trim();
    if (!loc) return null;
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const all = isReal ? (locations || []) : SAMPLE_LOCATIONS;
    return (
      all.find((l) => norm(l.label) === norm(loc)) ||
      all.find((l) => norm(loc).includes(norm(l.label)) || norm(l.label).includes(norm(loc))) ||
      null
    );
  }, [form.location, locations, isReal]);

  // Kartverket-adresse (via /api/external-data/kartverket/address-search, som
  // allerede finnes i backend): live-forslag mens man skriver sted + en
  // offisiell adresseboks når verdien matcher et treff. Debounce 300 ms og
  // aborter forrige request så gamle svar aldri overkjører nye.
  const [kvSuggestions, setKvSuggestions] = useState<any[]>([]);
  const kvTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const kvAbort = React.useRef<AbortController | null>(null);
  const [kvLoading, setKvLoading] = useState(false);
  const fetchKv = React.useCallback((loc: string) => {
    if (kvTimer.current) clearTimeout(kvTimer.current);
    kvAbort.current?.abort();
    const trimmed = loc.trim();
    if (trimmed.length < 2) { setKvSuggestions([]); return; }
    kvTimer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      kvAbort.current = ctrl;
      setKvLoading(true);
      const res = await externalDataService.searchKartverketAddressSuggestions(trimmed, { limit: 6, signal: ctrl.signal });
      if (!ctrl.signal.aborted) setKvSuggestions(res);
      setKvLoading(false);
    }, 300);
  }, []);
  React.useEffect(() => {
    fetchKv(form.location);
    return () => { if (kvTimer.current) clearTimeout(kvTimer.current); kvAbort.current?.abort(); };
  }, [form.location, fetchKv]);

  const kvMatch = React.useMemo(() => {
    const loc = form.location.trim();
    if (!loc) return null;
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    return kvSuggestions.find((s) => norm(s.address) === norm(loc)) || null;
  }, [form.location, kvSuggestions]);

  const stedOptions = React.useMemo(() => {
    const labels = (isReal ? (locations || []) : SAMPLE_LOCATIONS).map((l) => l.label);
    return Array.from(new Set([...labels, ...kvSuggestions.map((s) => s.address)]));
  }, [locations, isReal, kvSuggestions]);

  // Navigasjon: åpner riktig kart-app på telefonen. Android → Google Maps
  // (geo:-scheme), iOS → prøver Google Maps-appen via comgooglemaps:// og
  // fallbacker til Apple Maps (maps.apple.com) hvis appen ikke er installert.
  // På desktop → google.com/maps. Koordinater tas fra Kartverket-treffet
  // (evt. slås opp på stedets adresse via getKartverketAddress).
  const [navBusy, setNavBusy] = useState(false);
  const openNavigation = async () => {
    let coords = kvMatch?.coordinates || null;
    let addr = kvMatch?.address || formLocMatch?.address || '';
    const label = form.location.trim();
    if (!coords || !coords.lat || !coords.lng) {
      if (!formLocMatch) return;
      setNavBusy(true);
      try {
        const searchAddr = addr
          ? [addr, formLocMatch.postalCode, formLocMatch.city].filter(Boolean).join(', ')
          : formLocMatch.label;
        const kv = await externalDataService.getKartverketAddress(searchAddr);
        coords = kv?.coordinates || null;
        if (kv?.address) addr = kv.address;
      } catch { coords = null; } finally { setNavBusy(false); }
    }
    if (!coords || !coords.lat || !coords.lng) return;
    openRouteTo(addr || label || `${Number(coords.lat).toFixed(6)},${Number(coords.lng).toFixed(6)}`);
  };

  // Felles rute-åpner (adresse → kart-app på telefonen / Google Maps på
  // desktop). Brukes av både hendelseseditoren og crew-på-location-modalen.
  const openRouteTo = React.useCallback((dest: string) => {
    const enc = encodeURIComponent(dest);
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) {
      window.location.href = `google.navigation:q=${enc}`;
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      const google = `comgooglemaps://?daddr=${enc}&directionsmode=driving`;
      const apple = `https://maps.apple.com/?daddr=${enc}&dirflg=d`;
      const started = Date.now();
      const detect = () => {
        if (Date.now() - started < 2500 && !document.hidden) window.location.href = apple;
      };
      try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = google;
        document.body.appendChild(iframe);
        window.setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* */ } detect(); }, 2500);
      } catch { window.location.href = apple; }
    } else {
      window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving`;
    }
  }, []);

  // Crew-på-location-modalen: rute til en lokasjons adresse (geokodes via
  // Kartverket hvis adressen ikke har koordinater).
  const [navBusyId, setNavBusyId] = useState<string | null>(null);
  const navigateToLocation = React.useCallback(async (loc: LocationInfo) => {
    setNavBusyId(loc.label);
    try {
      // Lagrede koordinater finnes? Åpne kartet direkte — ingen geokoding.
      if (loc.lat != null && loc.lng != null) {
        openRouteTo(`${Number(loc.lat).toFixed(6)},${Number(loc.lng).toFixed(6)}`);
        return;
      }
      const addr = loc.address
        ? [loc.address, loc.postalCode, loc.city].filter(Boolean).join(', ')
        : loc.label;
      const kv = await externalDataService.getKartverketAddress(addr);
      openRouteTo(kv?.address || addr);
    } catch { /* stille — ingen navigasjon */ } finally { setNavBusyId(null); }
  }, [openRouteTo]);

  // Kart-visningen: server-side geokoding + live data (check-ins, posisjoner).
  // Ekte prosjekter geokodes én gang per sesjon via
  // POST /api/wedding/:id/locations/geocode (lagres i DB), så lasts lokasjonene
  // på nytt med koordinater. Sample-data har ferdige koordinater i state.
  const [locCoords, setLocCoords] = React.useState<Record<string, { lat: number; lng: number }>>({});
  const geocodeRan = React.useRef(false);
  const [checkins, setCheckins] = React.useState<Checkin[]>([]);
  const [crewPositions, setCrewPositions] = React.useState<CrewPosition[]>([]);
  const [myCrewName, setMyCrewName] = React.useState<string>(() => (typeof window !== 'undefined' ? (localStorage.getItem('pm.myCrew') || '') : ''));
  const [shareLoc, setShareLoc] = React.useState(false);
  const geoWatch = React.useRef<number | null>(null);
  const planScrollRef = React.useRef<HTMLDivElement | null>(null);

  // Auto-scroll Plan-gantt til «Nå» når Plan åpnes på selve dagen
  React.useEffect(() => {
    if (view !== 'plan') return;
    const t = window.setTimeout(() => {
      const el = document.getElementById('ws-plan-now');
      if (el) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [view]);

  // Minutt-ticker: holder «Nå»-linje og progress i Plan levende
  React.useEffect(() => {
    if (view !== 'plan') return;
    const t = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, [view]);

  React.useEffect(() => { localStorage.setItem('pm.myCrew', myCrewName); }, [myCrewName]);

  // Geokoder + henter check-ins/posisjoner når Kart-visningen åpnes
  React.useEffect(() => {
    if (view !== 'kart') return;
    if (isReal && weddingId) {
      if (!geocodeRan.current) {
        geocodeRan.current = true;
        apiRequest(`/api/wedding/${encodeURIComponent(weddingId)}/locations/geocode`, { method: 'POST' })
          .catch(() => {})
          .finally(() => loadLocations());
      } else {
        loadLocations();
      }
      loadCheckins();
    }
  }, [view, isReal, weddingId]);

  const loadCheckins = React.useCallback(() => {
    if (!isReal || !weddingId) return;
    apiRequest(`/api/wedding/${encodeURIComponent(weddingId)}/checkins`)
      .then((r: any) => setCheckins(Array.isArray(r?.checkins) ? r.checkins : []))
      .catch(() => {});
  }, [isReal, weddingId]);

  // Synkroniserer crew-posisjoner hvert 15. sekund mens Kart er åpen
  const loadCrewPositions = React.useCallback(() => {
    if (!isReal || !weddingId) return Promise.resolve();
    return apiRequest(`/api/wedding/${encodeURIComponent(weddingId)}/positions`)
      .then((r: any) => { setCrewPositions(Array.isArray(r?.positions) ? r.positions : []); })
      .catch(() => {});
  }, [isReal, weddingId]);
  React.useEffect(() => {
    if (view !== 'kart') return;
    loadCrewPositions();
    const t = window.setInterval(loadCrewPositions, 15000);
    return () => window.clearInterval(t);
  }, [view, isReal, weddingId]);

  // «Del min posisjon» — browser-geolokasjon rapporteres som min crew-profil
  const toggleShare = () => {
    if (shareLoc) {
      if (geoWatch.current != null) navigator.geolocation.clearWatch(geoWatch.current);
      geoWatch.current = null;
      setShareLoc(false);
      if (weddingId && myCrewName.trim()) {
        apiRequest(`/api/wedding/${encodeURIComponent(weddingId)}/positions`, {
          method: 'DELETE',
          body: { memberName: myCrewName.trim() },
        }).then(() => loadCrewPositions()).catch(() => {});
      }
      pushActivity('position', 'sluttet å dele posisjon live');
      return;
    }
    if (!myCrewName.trim()) {
      window.alert('Velg din crew-profil først (nedtrekksmenyen over kartet).');
      return;
    }
    if (!navigator.geolocation) { window.alert('Geolokasjon støttes ikke i denne nettleseren.'); return; }
    setShareLoc(true);
    const memberRole = (crewAll.find((c) => c.name.trim().toLowerCase() === myCrewName.trim().toLowerCase()) || {}).crewRole || 'assistent';
    const send = (pos: GeolocationPosition) => {
      if (!weddingId || !myCrewName.trim()) return;
      apiRequest(`/api/wedding/${encodeURIComponent(weddingId)}/positions`, {
        method: 'POST',
        body: { memberName: myCrewName.trim(), memberRole, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy },
      }).catch(() => {});
    };
    geoWatch.current = navigator.geolocation.watchPosition(send, () => setShareLoc(false), { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 });
    pushActivity('position', 'deler sin posisjon live');
  };
  React.useEffect(() => () => { if (geoWatch.current != null) navigator.geolocation.clearWatch(geoWatch.current); }, []);

  // Check-in / angre check-in for et crew-medlem på en lokasjon
  const toggleCheckin = async (loc: LocationInfo, member: CrewMember, checked: boolean) => {
    if (!isReal || !loc.weddingId || !loc.id) return;
    try {
      if (checked) {
        await apiRequest(`/api/wedding/${encodeURIComponent(loc.weddingId)}/checkins`, { method: 'DELETE', body: { memberName: member.name } });
      } else {
        await apiRequest(`/api/wedding/${encodeURIComponent(loc.weddingId)}/checkins`, { method: 'POST', body: { locationId: loc.id, memberName: member.name, memberRole: member.crewRole } });
      }
      loadCheckins();
      loadLocations();
      pushActivity('checkin', checked
        ? `angret innsjekking for ${member.name} på «${loc.label}»`
        : `sjekket inn ${member.name} på «${loc.label}»`);
      loadActivity();
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke oppdatere innsjekking');
    }
  };

  // Alle crew-medlemmer på tvers av lokasjoner (for profil-velgeren)
  const crewAll = React.useMemo(() => {
    const list = isReal ? (locations || []) : SAMPLE_LOCATIONS;
    const seen = new Set<string>();
    const out: CrewMember[] = [];
    for (const l of list) for (const c of l.crew || []) {
      const key = c.name.trim().toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); out.push(c); }
    }
    return out;
  }, [locations, isReal]);

  const rows: PlanRow[] = isReal
    ? (events || []).map((e) => {
        const [status, tone] = statusOf(e.status);
        const start = /^\d{2}:\d{2}$/.test(e.time || '') ? tidMin(e.time as string) : NaN;
        const dur = e.durationMinutes && e.durationMinutes > 0 ? e.durationMinutes : 60;
        return {
          id: e.id || '',
          tid: e.time ? `${e.time}${e.durationMinutes ? ' – ' + addMin(e.time, e.durationMinutes) : ''}` : '',
          moment: e.title || 'Hendelse',
          sub: e.location || '',
          foto: [], video: [], lyd: [],
          ansvarlig: '',
          status: [status, tone],
          notat: e.description || '',
          active: e.status === 'in_progress' || e.status === 'current',
          startMin: Number.isNaN(start) ? 480 : start,
          endMin: Number.isNaN(start) ? 540 : start + dur,
          sted: e.location || '–',
          day: dayOffsetOf(e.eventTime),
        };
      })
    : sampleRows;

  // Alerts avledet fra rows: konflikt-detektering og frist-nærhet
  const rowAlerts = React.useMemo(() => {
    const out: any[] = [];
    if (!isReal) return out;
    const evs = rows.filter(r => !Number.isNaN(r.startMin) && r.sted && r.sted !== '–');
    for (let i = 0; i < evs.length; i++) {
      for (let j = i + 1; j < evs.length; j++) {
        const a = evs[i], b = evs[j];
        const overlap = Math.max(0, Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin));
        if (overlap > 15 && a.sted !== b.sted) {
          const sharedCrew = (a.ansvarlig ? [a.ansvarlig] : []).filter(c => (b.ansvarlig ? [b.ansvarlig] : []).includes(c));
          if (sharedCrew.length > 0 || (a.status[0] === 'Kritisk' || b.status[0] === 'Kritisk')) {
            out.push({
              id: `conflict-${a.id}-${b.id}`,
              createdAt: new Date().toISOString(),
              actorName: 'System',
              tone: 'red',
              title: `Konflikt: «${a.moment}» & «${b.moment}» overlapper ${overlap} min på ulike steder`,
              type: 'conflict' as const,
              meta: { eventIds: [a.id, b.id], locationA: a.sted, locationB: b.sted, overlapMin: overlap },
              severity: 90,
              navigate: () => { /* åpne timeline */ }
            });
          }
        }
      }
    }
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    for (const r of rows) {
      if (Number.isNaN(r.startMin) || r.startMin <= nowMin || r.startMin - nowMin > 60 || r.status[0] === 'Ferdig') continue;
      out.push({
        id: `deadline-${r.id}`,
        createdAt: new Date().toISOString(),
        actorName: 'Tid',
        tone: r.status[0] === 'Kritisk' ? 'red' : 'amber',
        title: `«${r.moment}» starter om ${r.startMin - nowMin} min (${r.tid})`,
        type: 'deadline' as const,
        meta: { eventId: r.id, minutesUntil: r.startMin - nowMin },
        severity: r.status[0] === 'Kritisk' ? 80 : 70,
        navigate: () => { /* scroll til hendelse */ }
      });
    }
    return out;
  }, [rows, isReal]);

  // Varsler-kortet: høy-signal-aktivitet fra feeden (kritisk status → rød,
  // nye hendelser → amber, check-ins → blå) + konflikt/frist fra rowAlerts.
  const feedAlerts = React.useMemo(() => {
    if (!isReal) return [];
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const fourHours = 4 * oneHour;

    // Hjelpe-funksjon: alvorlighetsgrad (høyere = viktigere)
    const severity = (a: CoordinationActivity) => {
      const meta = a.meta as any || {};
      if (a.type === 'status' && meta.to === 'Kritisk') return 100;   // Kritisk status
      if (a.type === 'conflict') return 90;                            // Konflikt
      if (a.type === 'weather' && (meta.severity === 'high' || meta.severity === 'extreme')) return 85; // Alvorlig vær
      if (a.type === 'deadline' && meta.minutesUntil !== undefined && meta.minutesUntil <= 60) return 80; // Nær frist
      if (a.type === 'weather' && meta.severity === 'moderate') return 60; // Modera vær
      if (a.type === 'event' && meta.action === 'create') return 50;   // Ny hendelse
      if (a.type === 'position' && meta.action === 'start') return 40; // Posisjon startet
      if (a.type === 'checkin') return 30;                             // Check-in
      if (a.type === 'note') return 10;                                // Notat
      return 5;
    };

    // Bygg utvidet liste med alle signal-kilder
    const allAlerts = [
      ...activity
        .filter(a => !dismissedAlerts.has(a.id) && !snoozedAlerts.has(a.id))
        .filter(a => {
          // Filtrer ut eldre enn 4 timer (unntatt kritiske)
          const age = now - new Date(a.createdAt).getTime();
          return severity(a) >= 80 || age <= fourHours;
        })
        .map(a => ({
          id: a.id,
          createdAt: a.createdAt,
          actorName: a.actorName,
          tone: a.type === 'status' ? 'red' : a.type === 'event' ? 'amber' : a.type === 'checkin' ? 'blue' : a.type === 'conflict' ? 'red' : a.type === 'weather' ? 'amber' : a.type === 'deadline' ? 'red' : a.type === 'position' ? 'cyan' : 'gray',
          title: a.message,
          type: a.type,
          meta: a.meta as any || {},
          severity: severity(a),
          navigate: () => {
            // Navigasjon per type
            const meta = a.meta as any || {};
            if (meta.locationId && typeof window !== 'undefined') {
              // For navigasjon til lokasjon i timeline
              window.location.hash = `/workspace/${projectId}/produksjonskart?location=${encodeURIComponent(meta.locationId)}`;
            } else if (meta.eventId && typeof window !== 'undefined') {
              window.location.hash = `/workspace/${projectId}/produksjonskart?event=${encodeURIComponent(meta.eventId)}`;
            }
          }
        })),
      // Vær-varsler fra forecast (hvis tilgjengelig)
      ...(forecast?.slice(0, 2).map((d, i) => {
        const sev = (d.precipitation ?? 0) > 5 || (d.windSpeed ?? 0) > 10 ? 'high' : (d.precipitation ?? 0) > 2 ? 'moderate' : 'low';
        if (sev === 'low') return null;
        const msg = `${d.precipitation ?? 0}mm nedbør, ${d.windSpeed ?? 0}m/s vind ${d.date ? new Date(d.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric' }) : ''}`;
        return {
          id: `weather-${i}`,
          createdAt: new Date().toISOString(),
          actorName: 'Vær',
          tone: sev === 'high' ? 'red' : 'amber',
          title: `Vær: ${msg}`,
          type: 'weather' as const,
          meta: { severity: sev, precipitation: d.precipitation, windSpeed: d.windSpeed },
          severity: sev === 'high' ? 85 : 60,
          navigate: () => { /* vær-modalen åpnes allerede via header */ }
        };
      }).filter(Boolean) || []),
      // Konflikt-detektering og frist-nærhet fra rows (via rowAlerts-memo)
      ...rowAlerts
    ].flat();

    // Prioriter: alvorlighetsgrad (høyest først), så nyeste
    return allAlerts
      .sort((a, b) => b.severity - a.severity || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [activity, isReal, forecast, rowAlerts, dismissedAlerts, snoozedAlerts]);

  // Browser-notifikasjoner for kritiske (røde) varsler (kun når vinduet ikke har fokus)
  React.useEffect(() => {
    if (!isReal || notificationPermission !== 'granted') return;
    const criticalAlerts = feedAlerts.filter(a => a.tone === 'red');
    criticalAlerts.forEach(a => {
      if (!document.hasFocus()) {
        new Notification(a.title, {
          body: `${a.actorName || 'Team'} · ${fmtClock(a.createdAt)}`,
          icon: '/favicon.ico',
          tag: a.id,
        });
      }
    });
  }, [feedAlerts, isReal, notificationPermission]);

  const loading = isReal && events === null;

  // Konflikt-detektor: to hendelser som overlapper i tid, på ulike steder,
  // med minst ett felles crew-medlem.
  const conflicts = React.useMemo<PlanConflict[]>(() => {
    const list = isReal ? (locations || []) : SAMPLE_LOCATIONS;
    const crewBySted = new Map<string, CrewMember[]>();
    for (const l of list) crewBySted.set(normKey(l.label), l.crew || []);
    const evs = rows.filter((r) => !Number.isNaN(r.startMin) && r.sted && r.sted !== '–');
    const out: PlanConflict[] = [];
    for (let i = 0; i < evs.length; i++) {
      for (let j = i + 1; j < evs.length; j++) {
        const a = evs[i], b = evs[j];
        if (a.sted === b.sted || a.startMin >= b.endMin || b.startMin >= a.endMin) continue;
        const ca = crewBySted.get(normKey(a.sted)) || [];
        const cb = crewBySted.get(normKey(b.sted)) || [];
        const names = ca.filter((c) => cb.some((cc) => cc.name.trim().toLowerCase() === c.name.trim().toLowerCase())).map((c) => c.name);
        if (names.length) out.push({ a, b, names });
      }
    }
    return out.sort((x, y) => x.a.startMin - y.a.startMin);
  }, [rows, locations, isReal]);

  // Adresse-redigering rett i crew-på-location-modalen
  // (PUT /api/wedding/:weddingId/locations/:locId).
  const [locEdit, setLocEdit] = useState<LocationInfo | null>(null);
  const [locForm, setLocForm] = useState({ label: '', address: '', postalCode: '', city: '', notes: '' });
  const [locSaving, setLocSaving] = useState(false);
  const openLocEdit = (loc: LocationInfo) => {
    setLocForm({
      label: loc.label || '',
      address: loc.address || '',
      postalCode: loc.postalCode || '',
      city: loc.city || '',
      notes: loc.notes || '',
    });
    setLocEdit(loc);
  };
  const saveLocEdit = async () => {
    if (!locEdit || locSaving) return;
    setLocSaving(true);
    try {
      await apiRequest(`/api/wedding/${encodeURIComponent(locEdit.weddingId || weddingId)}/locations/${encodeURIComponent(locEdit.id || '')}`, {
        method: 'PUT',
        body: {
          label: locForm.label.trim(),
          address: locForm.address.trim() || null,
          postalCode: locForm.postalCode.trim() || null,
          city: locForm.city.trim() || null,
          notes: locForm.notes.trim() || null,
        },
      });
      setLocEdit(null);
      if (isReal) loadLocations();
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke lagre adressen');
    } finally {
      setLocSaving(false);
    }
  };

  const filtered = rows.filter((r) => filter === 'alle' || r.status[0] === filter);

  const day = new Date(isReal ? Date.now() : new Date(2025, 4, 24).getTime() + dayOffset * 86400000);
  if (isReal) day.setDate(day.getDate() + dayOffset);
  const dayLabel = (() => {
    const s = day.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const fokus = events ? (events.find((e) => e.status === 'in_progress' || e.status === 'current') || events[0]) : null;

  // Timeline-tabell
  const tableBody = loading ? (
    <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>Laster hendelser…</Typography>
  ) : filtered.length === 0 ? (
    <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>
      {filter === 'alle' ? (isReal ? 'Ingen hendelser registrert ennå.' : 'Ingen hendelser.') : `Ingen hendelser med status «${filter}».`}
    </Typography>
  ) : (
    <WsTable
      columns={['Tid', 'Moment', 'Foto', 'Video', 'Lyd', 'Ansvarlig', 'Status', 'Notater']}
      onRowClick={(i) => openEdit(filtered[i])}
      rows={filtered.map((r) => [
        <Box key="t" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {r.active && <Box sx={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${ws.accent}` }} />}
          <Typography sx={{ fontSize: 12.5, fontWeight: r.active ? 800 : 600, color: r.active ? ws.accent : ws.text }}>{r.tid}</Typography>
        </Box>,
        <Box key="m"><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{r.moment}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{r.sub}</Typography></Box>,
        <Stack key="f" spacing={0.25}>{r.foto.length ? r.foto.map((x) => <WsTag key={x} label={x} tone="accent" />) : <Typography sx={{ fontSize: 12, color: ws.textFaint }}>–</Typography>}</Stack>,
        <Stack key="v" spacing={0.25}>{r.video.length ? r.video.map((x) => <WsTag key={x} label={x} tone="blue" />) : <Typography sx={{ fontSize: 12, color: ws.textFaint }}>–</Typography>}</Stack>,
        <Stack key="l" spacing={0.25}>{r.lyd.length ? r.lyd.map((x) => <WsTag key={x} label={x} tone="amber" />) : <Typography sx={{ fontSize: 12, color: ws.textFaint }}>–</Typography>}</Stack>,
        <AnsvarligCell key="a" name={r.ansvarlig} />,
        <Box key="s" sx={{ display: 'inline-flex' }}><StatusPill row={r} /></Box>,
        <Typography key="n" sx={{ fontSize: 11.5, color: ws.textDim }}>{r.notat}</Typography>,
      ])}
    />
  );

  // Board-visning
  const [dragRow, setDragRow] = useState<PlanRow | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const boardBody = loading ? (
    <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>Laster hendelser…</Typography>
  ) : filtered.length === 0 ? (
    <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>{`Ingen hendelser med status «${filter}».`}</Typography>
  ) : (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.25 }}>
      {BOARD_COLS.map((col) => {
        const colRows = filtered.filter((r) => r.status[0] === col.key);
        return (
          <Box key={col.key} data-ws-board={col.key.toLowerCase()} onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }} onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))} onDrop={() => { if (dragRow && dragRow.status[0] !== col.key) changeStatus(dragRow, col.key); setDragRow(null); setDragOverCol(null); }}
            sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: `1px solid ${dragOverCol === col.key && dragRow ? ws.accentBorder : ws.borderSoft}`, outline: dragOverCol === col.key && dragRow ? `1px solid ${ws.accent}` : 'none', borderRadius: 1.5, p: 1.25, minHeight: 96, transition: 'border-color .12s' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: toneHex(col.tone) }} />
              <Typography sx={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{col.key}</Typography>
              <Typography sx={{ fontSize: 11, color: ws.textFaint, ml: 'auto' }}>{colRows.length}</Typography>
            </Stack>
            <Stack spacing={1}>
              {colRows.length === 0 && <Typography sx={{ fontSize: 11.5, color: ws.textFaint, py: 1, textAlign: 'center' }}>Ingen hendelser</Typography>}
              {colRows.map((r) => (
                <Box key={r.id || r.moment} data-ws-board-card data-ws-status={r.status[0].toLowerCase()} draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id || r.moment); setDragRow(r); }} onDragEnd={() => { setDragRow(null); setDragOverCol(null); }}
                  onClick={() => openEdit(r)}
                  sx={{ opacity: dragRow?.id === r.id ? 0.45 : 1, cursor: 'grab', '&:active': { cursor: 'grabbing' }, bgcolor: ws.panelSolid, border: `1px solid ${r.status[0] === 'Kritisk' ? ws.red : ws.borderSoft}`, borderLeft: `3px solid ${toneHex(r.status[1])}`, borderRadius: 1, p: 1.25, '&:hover': { outline: `1px solid ${ws.accentBorder}`, outlineOffset: 1 } }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                    <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{r.moment}</Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
                      <StatusPill row={r} />
                      <IconButton size="small" aria-label={`Rediger hendelse: ${r.moment}`} onClick={() => openEdit(r)} sx={{ p: 0.25, color: ws.textDim, '&:hover': { color: ws.accent } }}>
                        <EditOutlined sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 0.75 }}>{r.sub || '–'}</Typography>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textDim, mb: 0.5 }}>{r.tid}</Typography>
                  {r.foto.length > 0 && <Typography sx={{ fontSize: 11, color: ws.textDim }} noWrap>Foto: {r.foto.join(', ')}</Typography>}
                  {r.video.length > 0 && <Typography sx={{ fontSize: 11, color: ws.textDim }} noWrap>Video: {r.video.join(', ')}</Typography>}
                  {r.lyd.length > 0 && <Typography sx={{ fontSize: 11, color: ws.textDim, mb: 0.5 }} noWrap>Lyd: {r.lyd.join(', ')}</Typography>}
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
                    <AnsvarligCell name={r.ansvarlig} />
                    {r.notat && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, maxWidth: '45%', textAlign: 'right' }} noWrap title={r.notat}>{r.notat}</Typography>}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );

  // Plan-visning: tids-laner per sted (Gantt) for hele dagen.
  const planBody = (() => {
    if (loading) return <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>Laster hendelser…</Typography>;
    const dayRows = filtered.filter((r) => (r.day ?? 0) === dayOffset);
    if (dayRows.length === 0) return <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>{`Ingen hendelser med status «${filter}» denne dagen.`}</Typography>;
    const valid = dayRows.filter((r) => !Number.isNaN(r.startMin) && r.endMin > r.startMin);
    if (valid.length === 0) return <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>Ingen hendelser med gyldige tidspunkt.</Typography>;
    const min = Math.min(...valid.map((r) => r.startMin));
    const max = Math.max(...valid.map((r) => r.endMin));
    const dayStart = Math.max(0, Math.floor(min / 60) * 60 - 30);
    const dayEnd = Math.min(1440, Math.ceil(max / 60) * 60 + 30);
    const span = Math.max(240, dayEnd - dayStart) / 60; // timer
    const xPct = (mins: number) => ((mins - dayStart) / 60 / span) * 100;
    const lanes = [...new Set(valid.map((r) => r.sted))];
    const ticks: { t: number; label: boolean }[] = [];
    for (let h = Math.ceil(dayStart / 60); h <= Math.floor(dayEnd / 60); h += 1) {
      if (h < dayStart / 60) continue;
      ticks.push({ t: h * 60, label: h % 2 === 0 });
    }
    void nowTick; // keep «Nå»-linje/progress levende: nowTick-ticker utløser re-render
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const showNow = isReal && dayOffset === 0 && nowMin >= dayStart && nowMin <= dayEnd;
    const keyOf = (r: PlanRow) => r.id || `${r.sted}::${r.startMin}::${r.moment}`;
    let barEnterIdx = 0; // global stagger-løper for barer

    // Crew + koordinater per sted
    const locList = isReal ? (locations || []) : SAMPLE_LOCATIONS;
    const crewBySted = new Map<string, CrewMember[]>();
    const coordBySted = new Map<string, { lat: number; lng: number }>();
    for (const l of locList) {
      crewBySted.set(normKey(l.label), l.crew || []);
      if (typeof l.lat === 'number' && typeof l.lng === 'number') coordBySted.set(normKey(l.label), { lat: l.lat, lng: l.lng });
    }
    const crewOf = (r: PlanRow) => crewBySted.get(normKey(r.sted)) || [];
    const coordOf = (label: string) => coordBySted.get(normKey(label));

    // Konflikter (dobbeltbooket crew) på denne dagen
    const dayConflicts = conflicts.filter((c) => (c.a.day ?? 0) === dayOffset && (c.b.day ?? 0) === dayOffset && c.a.sted !== '–' && c.b.sted !== '–');
    const conflictIds = new Set<string>();
    dayConflicts.forEach((c) => { conflictIds.add(keyOf(c.a)); conflictIds.add(keyOf(c.b)); });

    // Kjøretid mellom steder: «flytte»-blokker + tette-gap-varsler
    const ordered = [...valid].sort((a, b) => a.startMin - b.startMin);
    const travels: { lane: string; leftPct: number; widthPct: number; label: string; from: string; to: string; drive: number; gap: number; tight: boolean }[] = [];
    const travelWarns: string[] = [];
    const afterTravel = new Set<string>();
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i], b = ordered[i + 1];
      if (a.sted === b.sted || b.startMin < a.endMin) continue;
      const ca = coordOf(a.sted), cb = coordOf(b.sted);
      if (!ca || !cb) continue;
      const drive = driveMin([ca.lat, ca.lng], [cb.lat, cb.lng]);
      const gap = b.startMin - a.endMin;
      const s = Math.max(a.endMin, b.startMin - drive);
      const e = b.startMin;
      if (e <= s) continue;
      travels.push({ lane: b.sted, leftPct: xPct(s), widthPct: xPct(e) - xPct(s), label: `${drive} min`, from: a.sted, to: b.sted, drive, gap, tight: gap < drive });
      if (gap < drive) travelWarns.push(`«${a.moment}» → «${b.moment}»: kjøretid ~${drive} min, men bare ${gap} min gap.`);
      afterTravel.add(keyOf(b));
    }

    // Overlapp-stabling per lane
    const barLayout = new Map<string, { col: number; cols: number }>();
    for (const l of lanes) {
      const evs = valid.filter((r) => r.sted === l).sort((a, b) => a.startMin - b.startMin);
      const used: { end: number; col: number }[] = [];
      let cols = 1;
      for (const r of evs) {
        let col = used.findIndex((u) => u.end <= r.startMin);
        if (col === -1) { col = used.length; used.push({ end: r.endMin, col }); }
        else used[col].end = Math.max(used[col].end, r.endMin);
        cols = Math.max(cols, col + 1);
        barLayout.set(keyOf(r), { col, cols });
      }
      for (const r of evs) { const lay = barLayout.get(keyOf(r)); if (lay) barLayout.set(keyOf(r), { col: lay.col, cols }); }
    }

    // Live-progress (0..1) — kun ekte prosjekter på selve dagen
    const progressOf = (r: PlanRow): number | null => {
      if (!isReal || dayOffset !== 0) return null;
      if (nowMin <= r.startMin) return 0;
      if (nowMin >= r.endMin) return 1;
      return (nowMin - r.startMin) / (r.endMin - r.startMin);
    };

    const conflictMsgs = dayConflicts.map((c) => `${c.names.join(', ')} er dobbeltbooket: «${c.a.moment}» (${c.a.tid}) ↔ «${c.b.moment}» (${c.b.tid})`);
    const warns = [...conflictMsgs, ...travelWarns];

    return (
      <Box>
        <style>{`
          @keyframes wsDriveRoad { to { transform: translateX(-6px); } }
          @keyframes wsDriveWheel { to { transform: rotate(360deg); } }
          @keyframes wsDriveStreak { from { transform: translateX(2px); opacity: .9; } to { transform: translateX(-9px); opacity: 0; } }
          @keyframes wsDriveBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
          @keyframes wsDriveSmoke { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 15% { opacity: .85; } 100% { transform: translate(-7px, -1.5px) scale(2); opacity: 0; } }
          .ws-drive-road { transform-box: fill-box; animation: wsDriveRoad .55s linear infinite; }
          .ws-drive-wheel { transform-box: fill-box; transform-origin: center; animation: wsDriveWheel .7s linear infinite; }
          .ws-drive-streaks line { transform-box: fill-box; animation: wsDriveStreak .9s linear infinite; }
          .ws-drive-bob { transform-box: fill-box; animation: wsDriveBob .9s ease-in-out infinite; }
          .ws-drive-smoke circle { transform-box: fill-box; transform-origin: center; animation: wsDriveSmoke .9s linear infinite; }

          /* ▸ Plan — levende «Nå» + bar-animasjoner */
          @keyframes wsNowDot { 0%,100% { transform: scale(.75); opacity: .6; box-shadow: 0 0 0 0 rgba(245,158,11,.5); } 50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 0 5px rgba(245,158,11,0); } }
          @keyframes wsBarPulse { 0%,100% { box-shadow: 0 0 0 1px rgba(99,102,241,.7), 0 0 9px rgba(99,102,241,.3); } 50% { box-shadow: 0 0 0 1px rgba(99,102,241,.3), 0 0 20px rgba(99,102,241,.6); } }
          @keyframes wsBarSweep { from { left: -35%; } to { left: 135%; } }
          @keyframes wsWarnPulse { 0%,100% { border-color: rgba(248,113,113,.35); box-shadow: 0 0 0 0 rgba(248,113,113,0); } 50% { border-color: rgba(248,113,113,.8); box-shadow: 0 0 11px 0 rgba(248,113,113,.3); } }
          @keyframes wsWarnPulseSoft { 0%,100% { border-color: rgba(251,191,36,.3); box-shadow: 0 0 0 0 rgba(251,191,36,0); } 50% { border-color: rgba(251,191,36,.7); box-shadow: 0 0 11px 0 rgba(251,191,36,.32); } }
          @keyframes wsBadgePulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
          @keyframes wsBarIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
          .ws-now-dot { animation: wsNowDot 1.9s ease-in-out infinite; }
          .ws-bar-active { animation: wsBarPulse 2.2s ease-in-out infinite; }
          .ws-bar-active::after { content: ''; position: absolute; top: 0; bottom: 0; width: 32%; left: -35%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.24), transparent); animation: wsBarSweep 3.6s ease-in-out infinite; pointer-events: none; z-index: 0; }
          .ws-warn-conflict { animation: wsWarnPulse 2.1s ease-in-out infinite; }
          .ws-warn-tight { animation: wsWarnPulseSoft 2.5s ease-in-out infinite; }
          .ws-badge { animation: wsBadgePulse 1.7s ease-in-out infinite; }
          .ws-bar-enter { animation: wsBarIn .38s cubic-bezier(.2,.6,.3,1) backwards; }
          @media (prefers-reduced-motion: reduce) {
            .ws-now-dot, .ws-bar-active, .ws-bar-active::after, .ws-warn-conflict, .ws-warn-tight, .ws-badge { animation: none; }
            .ws-bar-enter { animation-duration: .01s; }
          }
        `}</style>
        {warns.length > 0 && (
          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
            {warns.map((w, i) => (
              <Box key={i} className={i < conflictMsgs.length ? 'ws-warn-conflict' : 'ws-warn-tight'} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, bgcolor: i < conflictMsgs.length ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${i < conflictMsgs.length ? 'rgba(248,113,113,0.35)' : 'rgba(251,191,36,0.3)'}`, borderRadius: 1, px: 1, py: 0.5, animationDelay: `${Math.min(i, 4) * 100}ms` }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: i < conflictMsgs.length ? '#f87171' : ws.amber, whiteSpace: 'nowrap' }}>{i < conflictMsgs.length ? '⚠ Konflikt' : '⚠ Kort mellomrom'}</Typography>
                <Typography sx={{ fontSize: 12, color: ws.textDim }}>{w}</Typography>
              </Box>
            ))}
          </Stack>
        )}
        <Box ref={planScrollRef} sx={{ overflowX: 'auto', '&::-webkit-scrollbar': { height: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: ws.border, borderRadius: 4 } }}>
          <Box sx={{ display: 'flex', minWidth: 760 }}>
            <Box sx={{ width: 118, flexShrink: 0, pt: 1.5 }}>
              {lanes.map((l) => (
                <Box key={l} data-ws-lane={l} sx={{ height: 84, display: 'flex', alignItems: 'center', px: 1, fontSize: 11.5, fontWeight: 700, color: ws.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: `1px solid ${ws.borderSoft}` }}>{l}</Box>
              ))}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ height: 32, position: 'relative' }}>
                {ticks.map((tk) => (
                  <Box key={tk.t} sx={{ position: 'absolute', left: `${xPct(tk.t)}%`, top: 0, bottom: 0, transform: 'translateX(-50%)', zIndex: 3 }}>
                    {tk.label && <Box sx={{ width: 1, bgcolor: ws.border, height: 5, mx: 'auto' }} />}
                    {tk.label && <Typography sx={{ position: 'absolute', top: 7, left: 0, transform: 'translateX(-50%)', fontSize: 10, color: ws.textFaint, whiteSpace: 'nowrap' }}>{`${String(Math.floor(tk.t / 60)).padStart(2, '0')}:00`}</Typography>}
                  </Box>
                ))}
              </Box>
              <Box sx={{ position: 'relative' }}>
                {lanes.map((l) => (
                  <Box key={l} data-ws-lane-track={l} sx={{ position: 'relative', height: 84, borderBottom: `1px solid ${ws.borderSoft}`, overflow: 'hidden' }}>
                    {ticks.filter((tk) => tk.label).map((tk) => (
                      <Box key={tk.t} sx={{ position: 'absolute', left: `${xPct(tk.t)}%`, top: 0, bottom: 0, width: 1, bgcolor: 'rgba(255,255,255,0.04)' }} />
                    ))}
                    {travels.filter((t) => t.lane === l).map((t, i) => (
                      <Box key={`tr${i}`} title={`${t.from} → ${t.to} · ~${t.drive} min${t.tight ? ' (for kort gap!)' : ''}`} sx={{
                        position: 'absolute', top: '50%', height: 28, mt: '-14px', left: `${t.leftPct}%`, width: `${t.widthPct}%`, minWidth: 46,
                        borderRadius: 1, bgcolor: t.tight ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.12)',
                        border: `1px dashed ${t.tight ? 'rgba(251,191,36,0.6)' : 'rgba(148,163,184,0.45)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, zIndex: 1, pointerEvents: 'none',
                      }}>
                        <Box sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0d0d16', border: `1px solid ${t.tight ? 'rgba(251,191,36,0.55)' : 'rgba(148,163,184,0.4)'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.55)' }}>
                          <WsDriveIcon color={t.tight ? ws.amber : ws.textFaint} size={17} />
                        </Box>
                        <Typography noWrap sx={{ fontSize: 10, fontWeight: 800, color: t.tight ? ws.amber : ws.textDim }}>{t.label}</Typography>
                      </Box>
                    ))}
                    {valid.filter((r) => r.sted === l).map((r) => {
                      const key = keyOf(r);
                      const lay = barLayout.get(key) || { col: 0, cols: 1 };
                      const crew = crewOf(r);
                      const prog = progressOf(r);
                      const inConflict = conflictIds.has(key);
                      const done = prog === 1;
                      const active = prog != null && prog > 0 && prog < 1;
                      const hPct = 100 / lay.cols;
                      const title = `${r.moment} · ${r.tid}${r.notat ? ` — ${r.notat}` : ''}${crew.length ? `\nMannskap: ${crew.map((c) => c.name).join(', ')}` : ''}`;
                      const enterDelay = `${(barEnterIdx++ % 12) * 40}ms`;
                      return (
                        <Box key={key} data-ws-kart-block={r.moment} title={title} onClick={() => openEdit(r)} className={`ws-bar-enter${active ? ' ws-bar-active' : ''}`} sx={{ cursor: 'pointer',
                          position: 'absolute', top: `${lay.col * hPct + 12 / lay.cols}%`, height: `calc(${hPct}% - ${24 / lay.cols}px)`,
                          left: `${xPct(r.startMin)}%`, width: `${Math.max(2.5, xPct(r.endMin) - xPct(r.startMin))}%`, minWidth: 74,
                          borderRadius: 1, bgcolor: `${toneHex(r.status[1])}22`, borderLeft: `3px solid ${toneHex(r.status[1])}`, px: 0.75,
                          opacity: done ? 0.55 : 1,
                          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, overflow: 'hidden',
                          animationDelay: enterDelay,
                          boxShadow: active ? `0 0 0 1px ${ws.accent}, 0 0 12px rgba(99,102,241,0.35)` : (inConflict ? '0 0 0 1.5px #f87171' : 'none'),
                          transition: 'transform .18s ease, box-shadow .18s ease',
                          '&:hover': { transform: 'translateY(-1px)', outline: `1px solid ${ws.accentBorder}`, boxShadow: inConflict ? '0 0 0 1.5px rgba(248,113,113,.9), 0 6px 14px rgba(0,0,0,.4)' : `0 0 0 1px ${ws.accent}, 0 6px 14px rgba(0,0,0,.4)` } }}>
                          {prog != null && prog > 0 && (
                            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, prog * 100)}%`, bgcolor: active ? 'rgba(99,102,241,0.22)' : 'rgba(148,163,184,0.2)', pointerEvents: 'none', zIndex: 0, transition: 'width 30s linear' }} />
                          )}
                          {inConflict && <Typography className="ws-badge" sx={{ position: 'absolute', top: 1, right: 4, fontSize: 10, color: '#f87171', zIndex: 2 }}>⚠</Typography>}
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ position: 'relative', zIndex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 800 }}>{r.moment}</Typography>
                            {afterTravel.has(key) && <Place sx={{ fontSize: 11, color: ws.textFaint, flexShrink: 0 }} />}
                            {done && <CheckCircle sx={{ fontSize: 11, color: ws.green, flexShrink: 0 }} />}
                          </Stack>
                          <Typography noWrap sx={{ fontSize: 10, color: ws.textFaint, position: 'relative', zIndex: 1 }}>{r.tid}</Typography>
                          {lay.cols === 1 && crew.length > 0 && (
                            <Stack direction="row" alignItems="center" spacing={0} sx={{ mt: 'auto', pt: 0.5, position: 'relative', zIndex: 1 }}>
                              {crew.slice(0, 3).map((c, ci) => (
                                <img key={c.id} src={roleAvatarSrc(c.name, c.crewRole, 26)} alt="" title={`${c.name} (${CREW_ROLE_LABEL[c.crewRole] || c.crewRole})`}
                                  style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #191926', objectFit: 'cover', flexShrink: 0, marginLeft: ci === 0 ? 0 : -6 }}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              ))}
                              {crew.length > 3 && <Typography sx={{ fontSize: 9, color: ws.textFaint, ml: 0.5 }}>+{crew.length - 3}</Typography>}
                            </Stack>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
                {showNow && (
                  <Box id="ws-plan-now" sx={{ position: 'absolute', top: -32, bottom: 0, left: `${xPct(nowMin)}%`, width: 1.5, bgcolor: ws.amber, zIndex: 2, pointerEvents: 'none', transition: 'left 30s linear' }}>
                    <Box className="ws-now-dot" sx={{ position: 'absolute', top: -1, left: -2.5, width: 7, height: 7, borderRadius: '50%', bgcolor: ws.amber, transformOrigin: 'center' }} />
                    <Typography sx={{ position: 'absolute', top: 7, left: 4, fontSize: 10, fontWeight: 700, color: ws.amber }}>Nå</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  })();

  // Kart-visning: ekte Leaflet-kart med lokasjons-pins, crew-avatarer,
  // rute-linje, live-posisjoner, check-ins og konflikter.
  const kartBody = (() => {
    if (loading) return <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>Laster hendelser…</Typography>;
    const norm = normKey;
    const list = isReal ? (locations || []) : SAMPLE_LOCATIONS;
    // Hendelser for den valgte dagen (dayOffset) — kartet følger dag-velgeren i headeren
    const dayRows = rows.filter((r) => (r.day ?? 0) === dayOffset);
    const evsForSted = (label: string) => dayRows.filter((r) => r.sted && r.sted !== '–' && norm(r.sted) === norm(label));
    // Referanse-bilder knyttet til et sted (via category-tag eller filnavn som matcher stedsnavnet)
    const refsFor = (label: string) => {
      const src = isReal ? refs.images : SAMPLE_REFS;
      const k = norm(label);
      return src.filter((im) =>
        (im.category && norm(im.category) === k) ||
        (im.label && (norm(im.label).includes(k) || k.includes(norm(im.label))))
      );
    };

    // Nåværende/neste lokasjon ut fra hendelsenes status og klokkeslett.
    // current = hendelse som pågår nå (siste startet), next = neste med tidligst start.
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let currentLabel: string | null = null;
    let nextLabel: string | null = null;
    let criticalLabels = new Set<string>();
    const nowActive = dayRows.filter((r) => !Number.isNaN(r.startMin) && r.sted && r.sted !== '–' && ((r.status[0] === 'Pågår') || (r.startMin <= nowMin && nowMin < r.endMin)));
    if (nowActive.length) {
      const latest = nowActive.reduce((a, b) => (a.startMin >= b.startMin ? a : b));
      currentLabel = norm(latest.sted);
    }
    const future = dayRows.filter((r) => !Number.isNaN(r.startMin) && r.sted && r.sted !== '–' && r.startMin > nowMin).sort((a, b) => a.startMin - b.startMin);
    if (future.length) nextLabel = norm(future[0].sted);
    for (const r of dayRows) {
      if (!r.sted || r.sted === '–' || Number.isNaN(r.startMin)) continue;
      if (r.status[0] === 'Kritisk' || r.status[1] === 'red') criticalLabels.add(norm(r.sted));
    }

    // Rute-linje: lokasjoner sortert etter tidligste hendelse (den valgte dagen)
    const ordered = [...list].sort((a, b) => {
      const ta = Math.min(...evsForSted(a.label).map((r) => r.startMin), Infinity);
      const tb = Math.min(...evsForSted(b.label).map((r) => r.startMin), Infinity);
      return (Number.isFinite(ta) ? ta : 100000) - (Number.isFinite(tb) ? tb : 100000);
    });
    const routePts = ordered.filter((l) => l.lat != null && l.lng != null).map((l) => [l.lat as number, l.lng as number] as [number, number]);

    // Kjøreestimater per etappe + total for ruta
    const legs: { from: string; to: string; km: number; min: number }[] = [];
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i], b = ordered[i + 1];
      if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) continue;
      const km = haversineKm([a.lat, a.lng], [b.lat, b.lng]) * ROAD_FACTOR;
      legs.push({ from: a.label, to: b.label, km, min: Math.max(2, Math.round((km / DRIVE_SPEED_KMH) * 60)) });
    }
    const totalKm = legs.reduce((s, l) => s + l.km, 0);
    const totalMin = legs.reduce((s, l) => s + l.min, 0);

    // Varsel hvis tiden mellom to hendelser på forskjellige steder er for knapp
    const coordBySted = new Map<string, { lat: number; lng: number }>();
    for (const l of list) if (l.lat != null && l.lng != null) coordBySted.set(norm(l.label), { lat: l.lat, lng: l.lng });
    const travelMinBetween = (a: string, b: string): number | null => {
      const ca = coordBySted.get(norm(a)), cb = coordBySted.get(norm(b));
      if (!ca || !cb) return null;
      return driveMin([ca.lat, ca.lng], [cb.lat, cb.lng]);
    };
    const travelWarnings: { from: string; fromTid: string; to: string; toTid: string; gap: number; need: number }[] = [];
    const sortedDay = dayRows.filter((r) => !Number.isNaN(r.startMin) && !Number.isNaN(r.endMin)).sort((a, b) => a.startMin - b.startMin);
    for (let i = 0; i < sortedDay.length - 1; i++) {
      const a = sortedDay[i], b = sortedDay[i + 1];
      if (a.sted === '–' || b.sted === '–' || a.sted === b.sted) continue;
      const need = travelMinBetween(a.sted, b.sted);
      if (need == null) continue;
      const gap = b.startMin - a.endMin;
      if (gap < need) travelWarnings.push({ from: a.sted, fromTid: a.tid, to: b.sted, toTid: b.tid, gap: Math.max(0, gap), need });
    }

    const geoCoded = list.filter((l) => l.lat != null && l.lng != null);
    const withoutCoords = list.filter((l) => l.lat == null || l.lng == null);
    const total = list.length;
    const crewCount = crewAll.length;
    const checkedInCount = checkins.length;
    const freshPositions = crewPositions.filter((pp) => Date.now() - new Date(pp.updatedAt).getTime() < 5 * 60000);
    const fitKey = geoCoded.map((x) => `${x.lat!.toFixed(5)},${x.lng!.toFixed(5)}`).join('|');
    const fitMarkers = geoCoded.map((x) => [x.lat as number, x.lng as number] as [number, number]);
    const me = myCrewName.trim().toLowerCase();
    const myPos = me ? crewPositions.find((pp) => pp.memberName.trim().toLowerCase() === me) : null;
    const nextLoc = nextLabel ? list.find((l) => norm(l.label) === nextLabel) : null;
    const distToNext = myPos && nextLoc && nextLoc.lat != null && nextLoc.lng != null
      ? haversineKm([myPos.lat, myPos.lng], [nextLoc.lat, nextLoc.lng]) * ROAD_FACTOR
      : null;

    return (
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: ws.textDim }}>
            {total} lokasjoner · {crewCount} i crew · {checkedInCount} sjekket inn
            {freshPositions.length > 0 && ` · ${freshPositions.length} live`}
            {withoutCoords.length > 0 && !isReal && ' · demodata'}
            {myPos && nextLoc && distToNext != null && (
              <Box component="span" sx={{ color: ws.accent, fontWeight: 700 }}> · ≈ {distToNext.toFixed(1)} km til {nextLoc.label}</Box>
            )}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select size="small" value={myCrewName} onChange={(e) => setMyCrewName(e.target.value)}
              label="Min crew-profil" sx={{ minWidth: 170 }}
              InputLabelProps={{ sx: { fontSize: 12, color: ws.textFaint } }}
              SelectProps={{ sx: { fontSize: 12.5, color: ws.text, bgcolor: ws.panelInput } }}
            >
              <MenuItem value=""><em>Ingen</em></MenuItem>
              {crewAll.map((c) => <MenuItem key={c.id || c.name} value={c.name}>{c.name} · {CREW_ROLE_LABEL[c.crewRole] || c.crewRole}</MenuItem>)}
            </TextField>
            <Button size="small" startIcon={<MyLocation sx={{ fontSize: 15 }} />} onClick={toggleShare} disabled={!isReal}
              sx={{ textTransform: 'none', fontWeight: 700, color: shareLoc ? ws.green : ws.textDim, border: `1px solid ${shareLoc ? ws.green : ws.borderSoft}`, borderRadius: 1.5, px: 1.25 }}>
              {shareLoc ? 'Deler posisjon' : 'Del posisjon'}
            </Button>
          </Stack>
        </Stack>

        {conflicts.length > 0 && (
          <Box sx={{ border: `1px solid ${ws.red}55`, bgcolor: `${ws.red}14`, borderRadius: 1.25, px: 1.5, py: 1 }}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: ws.red }}>⚠ Crew-konflikter i planen</Typography>
              {conflicts.map((c, i) => (
                <Typography key={i} sx={{ fontSize: 12, color: ws.textDim }}>
                  {c.names.join(', ')} er booket på <b>{c.a.sted}</b> ({c.a.tid}) og <b>{c.b.sted}</b> ({c.b.tid}) samtidig.
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {travelWarnings.length > 0 && (
          <Box sx={{ border: `1px solid ${ws.amber}55`, bgcolor: `${ws.amber}14`, borderRadius: 1.25, px: 1.5, py: 1 }}>
            <Stack spacing={0.5}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: ws.amber }}>⚠ Tett kjøring mellom hendelser</Typography>
              {travelWarnings.map((tw, i) => (
                <Typography key={i} sx={{ fontSize: 12, color: ws.textDim }}>
                  {tw.from} ({tw.fromTid}) → {tw.to} ({tw.toTid}): kun {tw.gap} min pause, men trenger ca {tw.need} min kjøring.
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {legs.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', border: `1px solid ${ws.borderSoft}`, borderRadius: 1.25, px: 1.5, py: 1, bgcolor: ws.panelAlt }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: ws.textDim }}>Rute</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
              {legs.map((lg, i) => (
                <Typography key={i} sx={{ fontSize: 11.5, color: ws.textDim, whiteSpace: 'nowrap' }} title={`${lg.km.toFixed(1)} km`}>
                  {lg.from} → {lg.to} <b style={{ color: ws.accent }}>≈{lg.min} min</b>
                </Typography>
              ))}
            </Stack>
            <Typography sx={{ fontSize: 11.5, color: ws.textFaint, whiteSpace: 'nowrap' }}>≈ {totalKm.toFixed(1)} km · ≈ {totalMin} min totalt</Typography>
          </Stack>
        )}

        <Box sx={{ height: 470, borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${ws.borderSoft}`, position: 'relative', bgcolor: '#101018' }}>
          <MapContainer center={[59.9139, 10.7522]} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
            <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
            {routePts.length > 1 && (
              <Polyline positions={routePts} pathOptions={{ color: '#c084fc', weight: 2.5, dashArray: '7 8', opacity: 0.75 }} />
            )}
            {geoCoded.map((l) => {
                const k = norm(l.label);
                const state = { critical: criticalLabels.has(k), current: !!currentLabel && currentLabel === k, next: !!nextLabel && nextLabel === k };
                return (
                  <Marker key={l.id || l.label} position={[l.lat as number, l.lng as number]} icon={buildLocPinIcon(l.label, l.crew || [], state)}>
                    <Popup className="prod-map-popup">
                      <Stack spacing={0.75} sx={{ minWidth: 210 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography sx={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2, flex: 1 }}>{l.label}</Typography>
                          {state.current && <WsTag label="Nå" tone="green" />}
                          {state.next && <WsTag label="Neste" tone="amber" />}
                          {state.critical && <WsTag label="Kritisk" tone="red" />}
                        </Stack>
                        <Typography sx={{ fontSize: 11.5, color: '#9b9bb0', lineHeight: 1.3 }}>
                          {[l.address, l.postalCode, l.city].filter(Boolean).join(', ') || 'Ingen adresse satt'}
                        </Typography>
                        {evsForSted(l.label).length > 0 && (
                          <Stack spacing={0.3}>
                            {evsForSted(l.label).slice(0, 3).map((e) => (
                              <Typography key={e.moment} sx={{ fontSize: 11.5, color: '#c9c9de' }}>· {e.tid} — {e.moment}</Typography>
                            ))}
                          </Stack>
                        )}
                        {refsFor(l.label).length > 0 && (
                          <Stack spacing={0.5}>
                            <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#8b8ba3', textTransform: 'uppercase', letterSpacing: 0.4 }}>Referanser</Typography>
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                              {refsFor(l.label).slice(0, 6).map((im) => (
                                <img key={im.id} src={im.url} alt={im.label || ''} title={im.label || 'Referanse'} onClick={() => setLightbox(im)}
                                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid #3d3d55' }} />
                              ))}
                            </Stack>
                          </Stack>
                        )}
                        {(l.crew || []).length > 0 && (
                          <Stack spacing={0.5}>
                            <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#8b8ba3', textTransform: 'uppercase', letterSpacing: 0.4 }}>Crew her</Typography>
                            {(l.crew || []).map((c) => {
                              const ck = checkins.find((ci) => ci.memberName.trim().toLowerCase() === c.name.trim().toLowerCase());
                              return (
                                <Stack key={c.id || c.name} direction="row" spacing={1} alignItems="center">
                                  <Avatar src={c.avatarUrl || avatarSrc(c.name, 44)} sx={{ width: 22, height: 22, fontSize: 10, bgcolor: '#c084fc', color: '#0d0d16', fontWeight: 800 }}>{c.name.slice(0, 1).toUpperCase()}</Avatar>
                                  <Typography sx={{ fontSize: 12, flex: 1 }}>{c.name}</Typography>
                                  <Typography sx={{ fontSize: 10.5, color: '#8b8ba3' }}>{CREW_ROLE_LABEL[c.crewRole] || c.crewRole}</Typography>
                                  {isReal ? (
                                    <Button size="small" onClick={() => toggleCheckin(l, c, !!ck)} disabled={!!ck && ck.memberName.trim().toLowerCase() !== me}
                                      sx={{ textTransform: 'none', fontSize: 11, minWidth: 76, px: 1, py: 0.25, color: ck ? '#34d399' : '#8b8ba3', border: `1px solid ${ck ? '#34d39966' : '#4b4b66'}`, borderRadius: 1.5 }}>
                                      {ck ? `✓ ${ck.checkedInAt ? new Date(ck.checkedInAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : ''}` : 'Sjekk inn'}
                                    </Button>
                                  ) : (
                                    <Typography sx={{ fontSize: 11, color: '#34d399' }}>{l.label === 'Kirken' && c.name === 'Mia Solberg' ? '✓ inn' : 'demo'}</Typography>
                                  )}
                                </Stack>
                              );
                            })}
                          </Stack>
                        )}
                        <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
                          <Button size="small" startIcon={<Navigation sx={{ fontSize: 14 }} />}
                            onClick={() => navigateToLocation(l)} disabled={navBusyId === l.label}
                            sx={{ flex: 1, textTransform: 'none', fontSize: 11.5, fontWeight: 700, color: ws.accentContrast, bgcolor: ws.accent, '&:hover': { bgcolor: ws.accentHover }, '&.Mui-disabled': { bgcolor: '#3d3d55', color: 'rgba(255,255,255,0.6)' } }}>
                            {navBusyId === l.label ? 'Henter…' : 'Naviger hit'}
                          </Button>
                          {isReal && l.id && (
                            <Button size="small" startIcon={<EditOutlined sx={{ fontSize: 13 }} />} onClick={() => openLocEdit(l)}
                              sx={{ textTransform: 'none', fontSize: 11.5, color: '#c9c9de', borderColor: '#6b6b85', '&:hover': { color: ws.accent, borderColor: ws.accent } }}>
                              Endre adresse
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                    </Popup>
                  </Marker>
                );
              })}

            {(isReal ? crewPositions : SAMPLE_POSITIONS).map((pp) => {
              const fresh = Date.now() - new Date(pp.updatedAt).getTime() < 5 * 60000;
              const member = crewAll.find((c) => c.name.trim().toLowerCase() === pp.memberName.trim().toLowerCase());
              const isMe = pp.memberName.trim().toLowerCase() === me;
              return (
                <Marker key={pp.memberName} position={[pp.lat, pp.lng]} icon={buildCrewPinIcon(pp.memberName, pp.memberRole, fresh, member?.avatarUrl, isMe)}>
                  <Popup className="prod-map-popup">
                    <Stack spacing={0.5} sx={{ minWidth: 170 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{pp.memberName}</Typography>
                        {isMe && <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: '#22d3ee26', color: '#22d3ee', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>Du</Box>}
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: '#9b9bb0' }}>{CREW_ROLE_LABEL[pp.memberRole] || pp.memberRole}{pp.accuracyM ? ` · ${Math.round(pp.accuracyM)} m nøyaktighet` : ''}</Typography>
                      {isMe && distToNext != null && nextLoc && (
                        <Typography sx={{ fontSize: 11.5, color: '#22d3ee' }}>≈ {distToNext.toFixed(1)} km til neste: {nextLoc.label}</Typography>
                      )}
                      <Typography sx={{ fontSize: 11, color: fresh ? '#34d399' : '#8b8ba3' }}>{fresh ? '● Live' : `● Sist ${Math.max(1, Math.round((Date.now() - new Date(pp.updatedAt).getTime()) / 60000))} min siden`}</Typography>
                    </Stack>
                  </Popup>
                </Marker>
              );
            })}

            {fitMarkers.length === 0 && withoutCoords.length > 0 && isReal && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Typography sx={{ fontSize: 12.5, color: ws.textDim, bgcolor: 'rgba(10,10,15,.7)', px: 2, py: 1, borderRadius: 1.5 }}>
                  Vent litt — geokoder lokasjoner…
                </Typography>
              </Box>
            )}
            <FitLocations fitKey={fitKey} markers={fitMarkers} />
          </MapContainer>
          <style>{`
            .leaflet-container { font-family: inherit; background: #101018; }
            .leaflet-popup-content-wrapper.prod-map-popup { background: #15151f; color: #f5f5f8; border-radius: 10px; }
            .prod-map-popup + .leaflet-popup-tip { background: #15151f; }
            .prod-map-popup .leaflet-popup-content { margin: 10px 12px; }
            .leaflet-container .leaflet-popup-close-button { color: #8b8ba3; }
            .leaflet-control-attribution { font-size: 9px; background: rgba(10,10,15,0.7) !important; color: #666; }
            .leaflet-control-attribution a { color: #888; }
            .leaflet-bar a { background: #15151f; color: #f5f5f8; border-color: #3d3d55; }
            .leaflet-bar a:hover { background: #1e1e2c; }
            @keyframes prodPinPulse { 0% { transform: scale(.72); opacity: 1; } 70% { transform: scale(1.3); opacity: 0; } 100% { transform: scale(1.3); opacity: 0; } }
            .prod-pin-pulse { animation: prodPinPulse 1.6s ease-out infinite; }
          `}</style>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', px: 0.5 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 }}>Legende</Typography>
          {[
            { c: '#34d399', l: 'Nå' },
            { c: '#fbbf24', l: 'Neste' },
            { c: '#f87171', l: 'Kritisk' },
            { c: '#3d3d55', l: 'Sted' },
            { c: '#22d3ee', l: 'Live crew / meg' },
          ].map((li) => (
            <Stack key={li.l} direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: li.c, boxShadow: li.c === '#22d3ee' ? '0 0 0 2px rgba(34,211,238,.25)' : 'none' }} />
              <Typography sx={{ fontSize: 11, color: ws.textDim }}>{li.l}</Typography>
            </Stack>
          ))}
          {dayOffset !== 0 && (
            <Typography sx={{ fontSize: 11, color: ws.textFaint, ml: 'auto' }}>
              Viser hendelser for {day.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Typography>
          )}
        </Stack>
      </Stack>
    );
  })();
  // Printbar dagsplan — åpner et print-vennlig vindu med visuell dag-tidslinje,
  // hendelser, vær, lokasjoner/crew og hurtignotater for dagen.
  const printPlan = (opts = printOpts) => {
    const w = window.open('', '_blank', 'width=920,height=720');
    if (!w) return;
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
    const sorted = [...rows].sort((a, b) => a.startMin - b.startMin);
    const locs = isReal ? (locations || []) : SAMPLE_LOCATIONS;
    const crewByLoc = new Map<string, string[]>();
    for (const l of locs) crewByLoc.set(l.label, [...new Set((l.crew || []).map((c) => c.name))]);
    const crewFor = (label: string) => (label && label !== '–' ? (crewByLoc.get(label) || []).join(', ') : '');

    // Status → pill-farger og timeline-bar-farge
    const PILL: Record<string, [string, string, string]> = {
      Ferdig: ['#ecfdf5', '#065f46', '#a7f3d0'],
      'Pågår': ['#fffbeb', '#92400e', '#fde68a'],
      Planlagt: ['#eff6ff', '#1e40af', '#bfdbfe'],
      Kritisk: ['#fef2f2', '#991b1b', '#fecaca'],
    };
    const statusStyle = (s: string) => {
      const c = PILL[s];
      return c ? `background:${c[0]};color:${c[1]};border:1px solid ${c[2]};` : 'color:#374151;';
    };
    const BAR: Record<string, string> = { Ferdig: '#34d399', 'Pågår': '#f59e0b', Planlagt: '#60a5fa', Kritisk: '#f87171' };
    const barColor = (s: string) => BAR[s] || '#9ca3af';

    // Visuell dag-tidslinje (gantt): hendelser som fargede barer på en klokkeskala
    const withTime = sorted.filter((r) => !Number.isNaN(r.startMin) && !Number.isNaN(r.endMin));
    let tStart = Infinity, tEnd = -Infinity;
    for (const r of withTime) { tStart = Math.min(tStart, r.startMin); tEnd = Math.max(tEnd, r.endMin); }
    if (!Number.isFinite(tStart)) { tStart = 8 * 60; tEnd = 18 * 60; }
    const gStart = Math.max(0, Math.floor(tStart / 60) * 60);
    const gEnd = Math.min(24 * 60, Math.ceil(tEnd / 60) * 60);
    const span = Math.max(60, gEnd - gStart);
    const hours: number[] = [];
    for (let h = gStart / 60; h <= gEnd / 60; h++) hours.push(h);
    const pct = (min: number) => ((Math.min(Math.max(min, gStart), gEnd) - gStart) / span) * 100;
    // Lanes slik at overlappende hendelser ikke dekker hverandre
    const lanes: { s: number; e: number }[][] = [];
    const laneOf = (s: number, e: number) => {
      let i = 0;
      for (; i < lanes.length; i++) if (lanes[i].every((x) => e <= x.s || s >= x.e)) break;
      if (i === lanes.length) lanes.push([]);
      lanes[i].push({ s, e });
      return i;
    };
    const laneById: Record<string, number> = {};
    for (const r of withTime) laneById[r.id] = laneOf(r.startMin, r.endMin);
    const tlH = 34 + Math.max(1, lanes.length) * 42;
    const timelineHtml = withTime.length ? `
      <div class="tl" style="height:${tlH}px">
        ${hours.map((h) => `<div class="tl-hour" style="left:${pct(h * 60)}%"><span>${String(h % 24).padStart(2, '0')}:00</span></div>`).join('')}
        ${withTime.map((r) => {
          const left = pct(r.startMin), width = Math.max(pct(r.endMin) - pct(r.startMin), 1.2);
          const show = width > 7;
          return `<div class="tl-bar" style="left:${left}%;width:${width}%;top:${34 + (laneById[r.id] || 0) * 42}px;background:${barColor(r.status[0])};">${show ? `<b>${esc(r.moment)}</b><span>${esc(r.tid)}</span>` : ''}</div>`;
        }).join('')}
      </div>` : '';

    const rowsHtml = sorted.map((r) => {
      const crew = crewFor(r.sted);
      return `<tr><td class="tm">${esc(r.tid)}</td><td><b>${esc(r.moment)}</b></td><td>${r.sted && r.sted !== '–' ? esc(r.sted) : '–'}${crew ? `<div class="sub">${esc(crew)}</div>` : ''}</td><td class="st"><span class="pill" style="${statusStyle(r.status[0])}">${esc(r.status[0])}</span></td><td>${esc(r.notat || '')}</td></tr>`;
    }).join('');

    const crewCount = new Set(locs.flatMap((l) => (l.crew || []).map((c) => c.name.trim().toLowerCase())).filter(Boolean)).size;

    const locsHtml = locs.map((l) => {
      const crew = (l.crew || []).map((c) => `<span class="chip">${esc(c.name)}${c.crewRole ? `<span class="chip-role">${esc(CREW_ROLE_LABEL[c.crewRole] || c.crewRole)}</span>` : ''}</span>`).join('');
      return `<div class="loc"><div class="loc-head"><b>${esc(l.label)}</b>${l.arrivalTime ? `<span class="loc-arr">Ankomst ${esc(l.arrivalTime)}</span>` : ''}</div><div class="loc-addr">${esc([l.address, l.postalCode, l.city].filter(Boolean).join(', ')) || '–'}</div>${crew ? `<div class="loc-crew">${crew}</div>` : ''}</div>`;
    }).join('');

    const fcs = (isReal ? forecast : SAMPLE_FORECAST) || [];
    const todayFc = fcs.find((d: any) => (d.offset ?? 0) === 0) || fcs[0];
    const SYM_EMOJI: Record<string, string> = {
      clearsky: '☀️', fair: '🌤️', partlycloudy: '⛅', cloudy: '☁️', fog: '🌫️',
      rain: '🌧️', lightrain: '🌦️', heavyrain: '🌧️', rainandthunder: '⛈️', sleet: '🌨️',
      snow: '❄️', heavysnow: '❄️', lightrainshowers: '🌦️', lightssleetshowers: '🌨️',
    };
    const sym = (s?: string) => SYM_EMOJI[String(s || '').split('_')[0]] || '🌦️';
    const weatherHtml = fcs.length ? (
      `<div class="weather">
        ${fcs.slice(0, 5).map((d: any) => `<div class="wday"><div class="wsym">${sym(d.symbol)}</div><div class="wlabel">${esc(d.date ? new Date(d.date).toLocaleDateString('nb-NO', { weekday: 'short' }) : `+${d.offset ?? 0} dag`)}</div><div class="wtemp">${d.temperature ?? '–'}°</div><div class="wrain">${d.precipitation ?? 0} mm</div></div>`).join('')}
      </div>`
    ) : '';
    const todayDetail = isReal && weather
      ? `<div class="weather-detail">${esc(weather.location || 'Dagens vær')} · ${sym((weather as any).symbolCode)} ${weather.temperature ?? '–'}° · Vind ${weather.windSpeed ?? '–'} m/s · Luftfuktighet ${weather.humidity ?? '–'}%</div>`
      : '';
    const notesHtml = notes.length ? notes.slice(0, 8).map((n: any) =>
      `<div class="note"><div class="notebody">${esc(n.body)}</div><div class="notemeta">${esc(n.author_name || 'Du')} · ${esc(fmtWhen(n.created_at))}</div></div>`
    ).join('') : '';
    const generated = new Date().toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    w.document.write(`<!doctype html><html><head><title>Dagsplan · ${esc(dayLabel)}</title>
      <style>
        @page { size: A4; margin: 16mm 14mm 18mm; @bottom-center { content: "Dagsplan · " counter(page) " / " counter(pages); font-size: 9px; color: #9ca3af; } }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937; margin: 0; font-size: 12.5px; line-height: 1.45; }
        .accent { height: 6px; border-radius: 999px; background: linear-gradient(90deg, #6366f1, #22d3ee); margin-bottom: 14px; }
        .head { margin-bottom: 4px; }
        .head h1 { font-size: 28px; margin: 0; letter-spacing: -.4px; }
        .head .meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
        .badges { margin-top: 12px; }
        .badge { display: inline-block; font-size: 11px; font-weight: 600; color: #111827; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 10px; margin-right: 6px; margin-bottom: 4px; }
        h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #111827; margin: 24px 0 9px; padding-left: 9px; border-left: 3px solid #6366f1; page-break-after: avoid; }
        h2 .hint { font-weight: 500; text-transform: none; letter-spacing: 0; color: #9ca3af; font-size: 10.5px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #6b7280; padding: 6px 8px; border-bottom: 2px solid #d1d5db; }
        td { padding: 7px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-size: 12.5px; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        tr { page-break-inside: avoid; }
        td.tm { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
        td.st { white-space: nowrap; }
        .sub { color: #6b7280; font-size: 11px; margin-top: 2px; }
        .pill { display: inline-block; font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 9px; white-space: nowrap; }
        .tl { position: relative; border: 1px solid #e5e7eb; border-radius: 10px; background: #fcfcfd; margin-top: 6px; overflow: hidden; }
        .tl-hour { position: absolute; top: 0; bottom: 0; border-left: 1px dashed #e5e7eb; }
        .tl-hour span { position: absolute; top: 8px; transform: translateX(-50%); font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: .4px; }
        .tl-bar { position: absolute; height: 32px; border-radius: 6px; padding: 3px 8px; color: #fff; font-size: 10.5px; line-height: 1.15; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.18); page-break-inside: avoid; }
        .tl-bar b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tl-bar span { display: block; font-size: 9px; opacity: .9; white-space: nowrap; }
        .weather { display: flex; gap: 8px; margin-top: 4px; }
        .wday { flex: 1; text-align: center; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 4px; page-break-inside: avoid; }
        .wday:first-child { border-color: #a5b4fc; background: #eef2ff; }
        .wsym { font-size: 20px; }
        .wlabel { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: .4px; margin-top: 2px; }
        .wtemp { font-size: 15px; font-weight: 700; margin-top: 2px; }
        .wrain { font-size: 10px; color: #6b7280; }
        .weather-detail { margin-top: 8px; font-size: 11.5px; color: #374151; background: #eef2ff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 7px 10px; }
        .locs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
        .loc { border: 1px solid #e5e7eb; border-radius: 10px; padding: 9px 11px; page-break-inside: avoid; }
        .loc-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .loc-head b { font-size: 12.5px; }
        .loc-arr { font-size: 10px; color: #6b7280; white-space: nowrap; }
        .loc-addr { color: #6b7280; font-size: 11px; margin-top: 2px; }
        .loc-crew { margin-top: 7px; }
        .chip { display: inline-block; font-size: 11px; font-weight: 600; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 2px 8px; margin: 0 4px 4px 0; }
        .chip-role { color: #6b7280; font-weight: 500; }
        .note { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 6px; background: #fcfcfd; page-break-inside: avoid; }
        .notebody { font-size: 12.5px; }
        .notemeta { font-size: 10px; color: #9ca3af; margin-top: 3px; }
      </style></head><body>
      <div class="accent"></div>
      <div class="head">
        <h1>Dagsplan</h1>
        <div class="meta">${esc(dayLabel)} · Generert ${esc(generated)}</div>
        <div class="badges">
          <span class="badge">${rows.length} hendelser</span>
          <span class="badge">${locs.length} steder</span>
          <span class="badge">${crewCount} i crew</span>
          ${todayFc ? `<span class="badge">${sym(todayFc.symbol)} ${todayFc.temperature ?? '–'}° · ${todayFc.precipitation ?? 0} mm</span>` : ''}
        </div>
      </div>
      ${opts.timeline && timelineHtml ? `<h2>Dagens løp <span class="hint">— visuell tidslinje</span></h2>${timelineHtml}` : ''}
      ${opts.events ? `<h2>Hendelser</h2><table><thead><tr><th style="width:96px">Tid</th><th>Moment</th><th style="width:22%">Sted</th><th style="width:92px">Status</th><th>Notat</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="5">Ingen hendelser.</td></tr>'}</tbody></table>` : ''}
      ${opts.weather && weatherHtml ? `<h2>Vær</h2>${weatherHtml}${todayDetail}` : ''}
      ${opts.locations && locsHtml ? `<h2>Lokasjoner & crew</h2><div class="locs">${locsHtml}</div>` : ''}
      ${opts.notes && notesHtml ? `<h2>Hurtignotat</h2>${notesHtml}` : ''}
      <script>window.onload = function () { window.print(); };<\/script>
      </body></html>`);
    w.document.close();
  };


  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <WsPageTitle icon={<MapOutlined sx={{ fontSize: 21, color: '#fff' }} />} title="Production Map" sub={dayLabel} />

        {/* Topp-kort */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><CenterFocusStrong sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Dagens fokus</Typography></Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{loading ? 'Laster…' : fokus ? fokus.title : (isReal ? 'Ingen hendelse i dag' : 'Vielse')}</Typography>
                <Typography sx={{ fontSize: 12, color: ws.textDim }}>{loading ? '' : fokus ? (fokus.time + (fokus.durationMinutes ? ' – ' + addMin(fokus.time, fokus.durationMinutes) : '')) : (isReal ? '' : '12:15 – 13:00')}</Typography>
                {(fokus?.location || !isReal) && <Box sx={{ mt: 0.5 }}><WsTag label={fokus?.location || 'Kritisk moment'} tone="accent" /></Box>}
              </Box>
              <Box sx={{ width: 64, ml: 'auto' }}><WsImageGrid columns={1} ratio="4 / 3" addLabel="Bilde" allowAdd={false} /></Box>
            </Stack>
          </WsCard>
          <WsCard pad={1.75} onClick={openCrew} ariaLabel="Åpne crew-detaljer på location" sx={{ cursor: 'pointer', transition: 'border-color .12s', '&:hover': { borderColor: ws.accentBorder } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1} alignItems="center"><Groups sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Crew på location</Typography></Stack>
              <ChevronRight sx={{ fontSize: 16, color: ws.textFaint }} />
            </Stack>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{crewOnline} <Typography component="span" sx={{ fontSize: 14, color: ws.textDim }}>/ {crewTotal}</Typography></Typography>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim, mb: 1 }}>teammedlemmer</Typography>
            {!isReal && (
              <AvatarGroup max={5} sx={{ justifyContent: 'flex-start', '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 10, border: `2px solid ${ws.panelSolid}` } }}>
                {['M', 'D', 'E', 'L', 'N'].map((x, i) => <Avatar key={i}>{x}</Avatar>)}
              </AvatarGroup>
            )}
          </WsCard>
          <WsCard pad={1.75} onClick={openWeather} ariaLabel="Åpne vær- og logistikkdetaljer" sx={{ cursor: 'pointer', transition: 'border-color .12s', '&:hover': { borderColor: ws.accentBorder } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: ws.accentSoft, borderRadius: 1.5, px: 0.9, py: 0.45 }}>
                <Cloud sx={{ fontSize: 17, color: ws.accent }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>Vær & logistikk</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {isReal ? weatherIcon(weather?.symbolCode, { fontSize: 15, color: ws.accent }) : weatherIcon('CloudQueue', { fontSize: 15, color: ws.accent })}
                <ChevronRight sx={{ fontSize: 15, color: ws.textFaint }} />
              </Stack>
            </Stack>
            {isReal ? (
              weather ? (
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{Math.round(weather.temperature ?? 0)} °C</Typography>
                  <Box sx={{ borderLeft: `1px solid ${ws.border}`, pl: 1.5 }}>
                    <Typography sx={{ fontSize: 12, color: ws.textDim }}>{symbolLabel(weather.symbolCode)}</Typography>
                    <Typography sx={{ fontSize: 11, color: ws.textFaint, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                      <Opacity sx={{ fontSize: 12 }} />{weather.precipitation ?? 0} mm · <Air sx={{ fontSize: 12 }} />{weather.windSpeed ?? '–'} m/s
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: ws.textFaint, mt: 1 }}>Åpne for vær & logistikk</Typography>
              )
            ) : (<>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>17 °C</Typography>
                <Box sx={{ borderLeft: `1px solid ${ws.border}`, pl: 1.5 }}>
                  <Typography sx={{ fontSize: 12, color: ws.textDim }}>Delvis skyet</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                    <Opacity sx={{ fontSize: 12 }} />0,2 mm · <Air sx={{ fontSize: 12 }} />3 m/s NØ
                  </Typography>
                </Box>
              </Stack>
            </>)}
          </WsCard>
          <WsCard pad={1.75} onClick={openSync} ariaLabel="Åpne team-synk-detaljer" sx={{ cursor: 'pointer', transition: 'border-color .12s', '&:hover': { borderColor: ws.accentBorder } }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={1} alignItems="center"><Sync sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Team Sync</Typography></Stack>
              <ChevronRight sx={{ fontSize: 16, color: ws.textFaint }} />
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <WsRing value={syncPct ?? 0} size={70} thickness={8} label={syncPct == null ? '–' : `${syncPct}%`} color={syncPct == null ? ws.border : (syncPct >= 80 ? ws.green : ws.amber)} />
              <Box><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{syncPct == null ? (isReal ? 'Synkroniserer…' : 'Synkronisert') : (syncPct >= 80 ? 'Synkronisert' : 'Pågår')}</Typography><Typography sx={{ fontSize: 11, color: ws.textDim }}>{syncMembers.length} medlemmer · {isReal && sync == null ? 'henter…' : `${crewOnline} online`}</Typography></Box>
            </Stack>
          </WsCard>
        </Box>

        {/* Hoved-kort */}
        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <WsPills items={[{ key: 'timeline', label: 'Timeline' }, { key: 'board', label: 'Board' }, { key: 'kart', label: 'Kart' }, { key: 'plan', label: 'Plan' }]} value={view} onChange={(k) => setView(k as ViewKey)} />
              <IconButton size="small" aria-label="Skriv ut dagsplan" onClick={() => setPrintOpen(true)} sx={{ color: ws.textDim, '&:hover': { color: ws.accent } }}><Print sx={{ fontSize: 17 }} /></IconButton>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" aria-label="Forrige dag" onClick={() => setDayOffset((o) => o - 1)} sx={{ color: ws.textDim }}><ChevronLeft fontSize="small" /></IconButton>
              <Typography sx={{ fontSize: 13, color: ws.text, whiteSpace: 'nowrap' }}>{dayLabel}</Typography>
              <IconButton size="small" aria-label="Neste dag" onClick={() => setDayOffset((o) => o + 1)} sx={{ color: ws.textDim }}><ChevronRight fontSize="small" /></IconButton>
              <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={openAdd} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1, '&:hover': { bgcolor: ws.accentSoft } }}>Ny hendelse</Button>
              <Button size="small" startIcon={<Tune sx={{ fontSize: 15 }} />} onClick={(e) => setFilterMenu(e.currentTarget)} sx={{ color: filter !== 'alle' ? ws.accent : ws.textDim, textTransform: 'none', fontWeight: filter !== 'alle' ? 700 : 500 }}>Filtre{filter !== 'alle' ? ` · ${filter}` : ''}</Button>
              <Menu anchorEl={filterMenu} open={!!filterMenu} onClose={() => setFilterMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } }}>
                {FILTERS.map((f) => (
                  <MenuItem key={f.key} selected={filter === f.key} onClick={() => { setFilter(f.key); setFilterMenu(null); }} sx={{ fontSize: 13 }}>{f.label}</MenuItem>
                ))}
              </Menu>
            </Stack>
          </Stack>
          {view === 'timeline' && tableBody}
          {view === 'board' && boardBody}
          {view === 'kart' && kartBody}
          {view === 'plan' && planBody}
        </WsCard>

        {/* Bunn: Kritiske øyeblikk (kun Timeline/Board — Kart viser det i lokasjons-popups, Plan er dekket av Board) */}
        {view !== 'kart' && view !== 'plan' && (
          <WsCard>
            <WsSectionTitle title="Kritiske øyeblikk" action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/shotlist`)} sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <Stack spacing={1}>
              {isReal ? (
                events && events.some((e) => (e.status || '').toLowerCase() === 'kritisk') ? (
                  events.filter((e) => (e.status || '').toLowerCase() === 'kritisk').map((e) => (
                    <Stack
                      key={e.title}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      onClick={() => jumpToMoment(e.title || '')}
                      sx={{ cursor: 'pointer', borderRadius: 1, px: 0.5, mx: -0.5, py: 0.25, '&:hover': { bgcolor: ws.panelAlt } }}
                    >
                      <Typography sx={{ fontSize: 12, color: ws.textDim, width: 44 }}>{e.time}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>{e.title}</Typography>
                        {[e.location, e.description].filter(Boolean).join(' · ') && (
                          <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{[e.location, e.description].filter(Boolean).join(' · ')}</Typography>
                        )}
                      </Box>
                      <WsTag label="Kritisk" tone="red" />
                    </Stack>
                  ))
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 1.5, textAlign: 'center' }}>Ingen kritiske øyeblikk merket ennå.</Typography>
                )
              ) : [
                { t: '12:15', m: 'Vielse', loc: 'Kapell', note: 'Ringveksling + første kyss — ikke gå glipp!', lvl: 'Kritisk', tone: 'red' },
                { t: '16:30', m: 'Golden hour', loc: 'Bryllupsløkka', note: 'Parportretter i solnedgang', lvl: 'Høy', tone: 'amber' },
                { t: '20:15', m: 'Første dans', loc: 'Storeteltet', note: 'Slow-mo + vidvinkel fra podium', lvl: 'Høy', tone: 'amber' },
              ].map((s) => (
                <Stack key={s.m} direction="row" spacing={1} alignItems="center" sx={{ borderRadius: 1, px: 0.5, mx: -0.5, py: 0.25 }}>
                  <Typography sx={{ fontSize: 12, color: ws.textDim, width: 44 }}>{s.t}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 700 }}>{s.m}</Typography>
                    <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{`${s.loc} · ${s.note}`}</Typography>
                  </Box>
                  <WsTag label={s.lvl} tone={s.tone} />
                </Stack>
              ))}
            </Stack>
          </WsCard>
        )}
      </Box>

      {/* Live koordinering (høyre) */}
      <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Live koordinering</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} /><Typography sx={{ fontSize: 11, color: ws.green }}>Live</Typography></Stack>
          </Stack>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 1 }}>{isReal ? 'AKTIVITET' : 'TEAM UPDATES'}</Typography>
          <Stack spacing={1.5}>
            {isReal ? (
              activity.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: ws.textDim, py: 1 }}>Ingen aktivitet ennå — handlinger fra teamet dukker opp her.</Typography>
              ) : (
                activity.map((a) => {
                  const icon = ACT_ICON[a.type] || <CheckCircle sx={{ fontSize: 14, color: ws.green }} />;
                  return (
                    <Stack key={a.id} direction="row" spacing={1}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: ws.panelAlt, color: ws.textFaint }}>{(a.actorName || '?').trim().slice(0, 1).toUpperCase()}</Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="baseline">
                          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>{a.actorName || 'Team'}</Typography>
                          <Typography sx={{ fontSize: 10.5, color: ws.textFaint, whiteSpace: 'nowrap' }}>{fmtClock(a.createdAt)}</Typography>
                          <Box sx={{ ml: 'auto', display: 'inline-flex' }}>{icon}</Box>
                        </Stack>
                        <Typography sx={{ fontSize: 12, color: ws.textDim }}>{a.message}</Typography>
                      </Box>
                    </Stack>
                  );
                })
              )
            ) : UPDATES.map((u, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 11 }}>{u.who[0]}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{u.who}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{u.t}</Typography><CheckCircle sx={{ fontSize: 13, color: ws.green, ml: 'auto' }} /></Stack>
                  <Typography sx={{ fontSize: 12, color: ws.textDim }}>{u.msg}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </WsCard>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <NotificationsActive sx={{ fontSize: 17, color: ws.amber }} />
            <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Varsler & viktige notater</Typography>
            {isReal && notificationPermission === 'default' && (
              <Button size="small" startIcon={<NotificationsActive sx={{ fontSize: 14 }} />} onClick={() => Notification.requestPermission().then(p => setNotificationPermission(p))} sx={{ color: ws.accent, textTransform: 'none' }}>Aktiver varsler</Button>
            )}
            {isReal && notificationPermission === 'denied' && (
              <Typography sx={{ fontSize: 11, color: ws.textFaint }}>Varsler blokkert i nettleseren</Typography>
            )}
          </Stack>
          <Stack spacing={1.25}>
            {isReal ? (
              feedAlerts.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: ws.textDim, py: 2, textAlign: 'center' }}>
                  Ingen varsler for øyeblikket. Kritiske statusendringer, vær-varsler, konflikter og frister dukker opp her automatisk.
                </Typography>
              ) : (
                feedAlerts.map((a) => (
                  <Box
                    key={a.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: ws.panelAlt,
                      border: `1px solid ${ws[a.tone]}40`,
                      transition: 'background-color .15s',
                      cursor: a.navigate ? 'pointer' : 'default',
                    }}
                    onClick={a.navigate}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = ws[a.tone] + '10'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Box sx={{ width: 6, borderRadius: 3, bgcolor: ws[a.tone], flexShrink: 0, mt: 0.5 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</Typography>
                        <Typography sx={{ fontSize: 10.5, color: ws.textFaint, whiteSpace: 'nowrap' }}>{fmtClock(a.createdAt)}</Typography>
                        <Stack direction="row" spacing={0.5} ml="auto">
                          <IconButton
                            size="small"
                            aria-label="Snooze 1 time"
                            onClick={(e) => {
                              e.stopPropagation();
                              const until = Date.now() + 60 * 60 * 1000;
                              const next = new Map(snoozedAlerts);
                              next.set(a.id, Date.now() + 3600000);
                              setSnoozedAlerts(next);
                              try { localStorage.setItem(`pm.alerts.snoozed.${projectId}`, JSON.stringify(Object.fromEntries(next))); } catch {}
                            }}
                            sx={{ color: ws.textFaint, '&:hover': { color: ws.amber, bgcolor: ws.amber + '15' } }}
                          >
                            <Schedule sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            aria-label="Lukk varsel"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Set(dismissedAlerts);
                              next.add(a.id);
                              setDismissedAlerts(next);
                              try { localStorage.setItem(`pm.alerts.dismissed.${projectId}`, JSON.stringify(Array.from(next))); } catch {}
                            }}
                            sx={{ color: ws.textFaint, '&:hover': { color: ws.red, bgcolor: ws.red + '15' } }}
                          >
                            <Close sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Stack>
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{a.actorName || 'Team'}</Typography>
                    </Box>
                  </Box>
                ))
              )
            ) : ALERTS.map((a, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <Box sx={{ width: 6, borderRadius: 3, bgcolor: ws[a.tone as keyof typeof ws] }} />
                <Box sx={{ flex: 1 }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{a.t}</Typography></Stack><Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{a.sub}</Typography></Box>
              </Stack>
            ))}
          </Stack>
        </WsCard>

        <WsCard>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Hurtignotat</Typography>
          <TextField fullWidth size="small" multiline minRows={2} placeholder="Skriv en rask notat…" value={noteText} onChange={(e) => setNoteText(e.target.value)} disabled={!isReal} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button size="small" variant="contained" onClick={addNote} disabled={!isReal || !noteText.trim() || savingNote} startIcon={<Send sx={{ fontSize: 15 }} />} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{savingNote ? 'Lagrer…' : 'Legg til'}</Button>
          </Stack>
          {notes.length > 0 ? (
            <Stack spacing={0.75} sx={{ mt: 1.5 }}>
              {notes.slice(0, 6).map((n: any) => (
                <Box key={n.id} sx={{ p: 1, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                  <Typography sx={{ fontSize: 12 }}>{n.body}</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                    <Typography sx={{ fontSize: 10, color: ws.textFaint, flex: 1 }}>{n.author_name || 'Du'} · {fmtWhen(n.created_at)}</Typography>
                    {user?.id && n.author_id && String(n.author_id) === String(user.id) && (
                      <IconButton size="small" onClick={() => deleteNote(n.id)} sx={{ p: 0.25, color: ws.textFaint, '&:hover': { color: '#f87171' } }} aria-label="Slett notat">
                        <DeleteOutline sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mt: 1.5 }}>Ingen notater ennå — teamets raske notater fra produksjonskartet samles her.</Typography>
          )}
        </WsCard>
      </Box>

      {/* Referanse-lightbox (klikk på bilde i «Referanser & shots») */}
      <Dialog open={!!lightbox} onClose={() => setLightbox(null)} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: ws.panel, border: `1px solid ${ws.border}`, overflow: 'hidden' } }}>
        {lightbox && (() => {
          const list = isReal ? refs.images : SAMPLE_REFS;
          const idx = list.findIndex((im) => im.id === lightbox.id);
          const base = idx === -1 ? 0 : idx;
          const step = (d: number) => {
            if (!list.length) return;
            const next = list[((base + d) % list.length + list.length) % list.length];
            if (next) setLightbox(next);
          };
          return (
            <>
              <Box sx={{ position: 'relative', bgcolor: '#000', textAlign: 'center' }}>
                <img src={lightbox.url} alt={lightbox.label || 'Referanse'} style={{ maxHeight: '68vh', maxWidth: '100%', display: 'inline-block', objectFit: 'contain' }} />
                <IconButton onClick={() => setLightbox(null)} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,.8)' } }} aria-label="Lukk"><Close sx={{ fontSize: 18 }} /></IconButton>
                {list.length > 1 && (
                  <>
                    <IconButton onClick={() => step(-1)} sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,.8)' } }} aria-label="Forrige"><ChevronLeft /></IconButton>
                    <IconButton onClick={() => step(1)} sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,.8)' } }} aria-label="Neste"><ChevronRight /></IconButton>
                  </>
                )}
              </Box>
              <DialogContent sx={{ py: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{lightbox.label || 'Referanse'}</Typography>
                  {list.length > 1 && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{base + 1} / {list.length}</Typography>}
                  <Button size="small" startIcon={<OpenInNew sx={{ fontSize: 14 }} />} onClick={() => { setLightbox(null); navigate(`/workspace/${projectId}/moodboard`); }} sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>
                </Stack>
              </DialogContent>
            </>
          );
        })()}
      </Dialog>

      {/* Print-dialog — velg hva som skal skrives ut */}
      <Dialog open={printOpen} onClose={() => setPrintOpen(false)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, maxWidth: 380 } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Skriv ut dagsplan</DialogTitle>
        <DialogContent sx={{ pt: '4px !important' }}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 1 }}>Velg hvilke seksjoner som skal tas med på utskriften ({dayLabel}).</Typography>
          <FormGroup>
            {([['timeline', 'Dagens løp (tidslinje)'], ['events', 'Hendelser'], ['weather', 'Vær'], ['locations', 'Lokasjoner & crew'], ['notes', 'Hurtignotat']] as [keyof typeof printOpts, string][]).map(([key, label]) => (
              <FormControlLabel key={key} control={<Checkbox size="small" checked={printOpts[key]} onChange={(e) => setPrintOpts((p) => ({ ...p, [key]: e.target.checked }))} sx={{ color: ws.accent, '&.Mui-checked': { color: ws.accent } }} />} label={<Typography sx={{ fontSize: 13 }}>{label}</Typography>} sx={{ '& .MuiFormControlLabel-label': { fontSize: 13 } }} />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setPrintOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
          <Button size="small" variant="contained" startIcon={<Print sx={{ fontSize: 15 }} />} onClick={() => { const o = printOpts; setPrintOpen(false); printPlan(o); }} disabled={!Object.values(printOpts).some(Boolean)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Skriv ut</Button>
        </DialogActions>
      </Dialog>

      {/* Status-meny (klikk på statuspill) */}
      <Menu
        anchorEl={statusMenu?.anchor}
        open={!!statusMenu}
        onClose={() => setStatusMenu(null)}
        PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } }}
      >
        {(['Ferdig', 'Pågår', 'Planlagt', 'Kritisk'] as PlanStatus[]).map((s) => (
          <MenuItem key={s} selected={statusMenu?.row.status[0] === s} sx={{ fontSize: 13 }} onClick={() => statusMenu && changeStatus(statusMenu.row, s)}>{s}</MenuItem>
        ))}
      </Menu>

      {/* Ny/rediger-hendelse-dialog */}
      <Dialog open={!!editor} onClose={() => !savingEvent && setEditor(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: 2, minWidth: { xs: '92vw', sm: 460 } } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>{editor?.mode === 'edit' ? 'Rediger hendelse' : 'Ny hendelse'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <TextField
              label="Tittel" size="small" autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              inputProps={{ 'aria-label': 'Tittel' }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Klokkeslett (HH:MM)" size="small" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                inputProps={{ 'aria-label': 'Klokkeslett' }}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }}
              />
              <TextField
                label="Varighet (min)" type="number" size="small" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                inputProps={{ 'aria-label': 'Varighet' }}
                sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }}
              />
            </Stack>
            <Autocomplete
              freeSolo
              size="small"
              loading={kvLoading}
              loadingText="Søker i Kartverket…"
              options={stedOptions}
              inputValue={form.location}
              onInputChange={(_e, v) => setForm((f) => ({ ...f, location: v }))}
              onChange={(_e, v) => setForm((f) => ({ ...f, location: typeof v === 'string' ? v : (v || '') }))}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }}
              slotProps={{ paper: { sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } }, popper: { sx: { zIndex: 1400 } }, input: { 'aria-label': 'Sted' } }}
              renderInput={(params) => <TextField {...params} label="Sted" />}
            />
            {formLocMatch && (
              <Box sx={{ px: 1.25, py: 1, borderRadius: 1.5, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <Sync sx={{ fontSize: 12, color: ws.accent }} />
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 }}>Synkronisert fra lokasjoner</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Place sx={{ fontSize: 13, color: ws.accent }} />
                  <Typography sx={{ flex: 1, fontSize: 12, color: ws.text }}>{[formLocMatch.address, formLocMatch.postalCode, formLocMatch.city].filter(Boolean).join(', ') || 'Adresse ikke satt'}</Typography>
                </Stack>
                {(formLocMatch.crew?.length ? formLocMatch.crew : []).map((c) => (
                  <Stack key={c.id || c.name} direction="row" spacing={1} alignItems="center" sx={{ ml: 2, py: 0.3 }}>
                    <Avatar sx={{ width: 20, height: 20, fontSize: 10, bgcolor: ws.accentSoft, color: ws.accent }}>{c.name.slice(0, 1)}</Avatar>
                    <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.name}</Typography>
                    <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>{CREW_ROLE_LABEL[c.crewRole] || c.crewRole || 'crew'}</Typography>
                  </Stack>
                ))}
{!formLocMatch.crew?.length && formLocMatch && <Typography sx={{ fontSize: 11, color: ws.textDim, ml: 2 }}>Ingen crew tildelt denne lokasjonen.</Typography>}
            </Box>
            )}
            {kvMatch && !formLocMatch && (
              <Box sx={{ px: 1.25, py: 1, borderRadius: 1.5, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <Place sx={{ fontSize: 12, color: ws.accent }} />
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.4 }}>Kartverket-adresse</Typography>
                </Stack>
                <Typography sx={{ flex: 1, fontSize: 12, color: ws.text }}>{kvMatch.address}</Typography>
                <Typography sx={{ fontSize: 11, color: ws.textDim }}>
                  {[kvMatch.postalCode, kvMatch.poststed, kvMatch.municipality, kvMatch.county].filter(Boolean).join(' · ')}
                </Typography>
                {(kvMatch.coordinates?.lat ?? 0) !== 0 && (
                  <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>
                    {`${Number(kvMatch.coordinates.lat).toFixed(5)}° N, ${Number(kvMatch.coordinates.lng).toFixed(5)}° E`}
                  </Typography>
                )}
              </Box>
            )}
            {(formLocMatch || kvMatch) && (
              <Button size="small" startIcon={<Navigation sx={{ fontSize: 15 }} />} onClick={() => void openNavigation()} disabled={navBusy}
                sx={{ alignSelf: 'flex-start', color: ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1.25, '&:hover': { bgcolor: ws.accentSoft } }}>
                {navBusy ? 'Slår opp adresse…' : 'Naviger til sted'}
              </Button>
            )}
            <TextField
              label="Beskrivelse" size="small" multiline minRows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              inputProps={{ 'aria-label': 'Beskrivelse' }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }}
            />
            <TextField
              select label="Status" size="small" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PlanStatus }))}
              inputProps={{ 'aria-label': 'Status' }}
              SlotProps={{ select: { MenuProps: { PaperProps: { sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } } } } }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint }, '& .MuiSelect-select': { color: ws.text } }}
            >
              {(['Pågår', 'Planlagt', 'Ferdig', 'Kritisk'] as PlanStatus[]).map((s) => (
                <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {editor?.mode === 'edit' && (
            <Button size="small" onClick={deleteEvent} disabled={savingEvent} sx={{ color: ws.red, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.red}55`, borderRadius: 1.5, '&:hover': { bgcolor: `${ws.red}22` } }}>
              {savingEvent ? 'Sletter…' : 'Slett hendelse'}
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => setEditor(null)} disabled={savingEvent} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
          <Button
            size="small" variant="contained" onClick={saveEvent} disabled={savingEvent || !form.title.trim() || !/^\d{2}:\d{2}$/.test(form.time.trim())}
            sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}
          >
            {savingEvent ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vær & logistikk-modal */}
      <Dialog open={weatherOpen} onClose={() => setWeatherOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: 2, minWidth: { xs: '92vw', sm: 520 } } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Cloud sx={{ fontSize: 19, color: ws.accent }} />Vær & logistikk</Stack>
          <Box
            component="a"
            href={`https://www.yr.no/nb/s%C3%B8k?q=${encodeURIComponent(weather?.location || 'Oslo')}`}
            target="_blank" rel="noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 12, color: ws.textFaint, textDecoration: 'none', '&:hover': { color: ws.accent } }}
          >
            yr.no <OpenInNew sx={{ fontSize: 13 }} />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5}>
            {/* Vær nå */}
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                Vær nå · {weather?.location || (isReal ? 'Oslo' : 'Holmenkollen, Oslo')}
              </Typography>
              {isReal ? (
                weatherLoading && !weather ? (
                  <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 1.5 }}>Laster værdata…</Typography>
                ) : weather ? (
                  <>
                    <Stack direction="row" spacing={2} alignItems="center">
                      {weatherIcon(weather.symbolCode, { fontSize: 42, color: ws.accent })}
                      <Box>
                        <Typography sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>{weather.temperature ?? '–'} °C</Typography>
                        <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{symbolLabel(weather.symbolCode)}</Typography>
                      </Box>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75, mt: 1.5 }}>
                      {[
                        { icon: <Air sx={{ fontSize: 13, color: '#60a5fa' }} />, label: 'Vind', value: `${weather.windSpeed ?? '–'} m/s ${compass(weather.windDirection)}` },
                        { icon: <WaterDrop sx={{ fontSize: 13, color: '#38bdf8' }} />, label: 'Nedbør', value: `${weather.precipitation ?? 0} mm` },
                        { icon: <Opacity sx={{ fontSize: 13, color: '#34d399' }} />, label: 'Fuktighet', value: `${weather.humidity ?? '–'} %` },
                        { icon: <WbSunny sx={{ fontSize: 13, color: '#fbbf24' }} />, label: 'UV-indeks', value: `${weather.uvIndex ?? '–'}` },
                        { icon: <Cloud sx={{ fontSize: 13, color: '#94a3b8' }} />, label: 'Skydekke', value: `${weather.cloudCover ?? '–'} %` },
                        { icon: <Speed sx={{ fontSize: 13, color: '#f472b6' }} />, label: 'Trykk', value: `${weather.pressure ?? '–'} hPa` },
                      ].map((s) => (
                        <Box key={s.label} sx={{ p: 1, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ color: 'inherit', display: 'inline-flex' }}>{s.icon}</Box><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{s.label}</Typography></Stack>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{s.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </>
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 1.5 }}>Kunne ikke hente værdata.</Typography>
                )
              ) : (<>
                <Stack direction="row" spacing={2} alignItems="center">
                  {weatherIcon('CloudQueue', { fontSize: 42, color: ws.accent })}
                  <Box>
                    <Typography sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>17 °C</Typography>
                    <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Delvis skyet</Typography>
                  </Box>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75, mt: 1.5 }}>
                  {[
                    { icon: <Air sx={{ fontSize: 13, color: '#60a5fa' }} />, label: 'Vind', value: '3 m/s NØ' },
                    { icon: <WaterDrop sx={{ fontSize: 13, color: '#38bdf8' }} />, label: 'Nedbør', value: '0,2 mm' },
                    { icon: <Opacity sx={{ fontSize: 13, color: '#34d399' }} />, label: 'Fuktighet', value: '58 %' },
                    { icon: <WbSunny sx={{ fontSize: 13, color: '#fbbf24' }} />, label: 'UV-indeks', value: '4' },
                    { icon: <Cloud sx={{ fontSize: 13, color: '#94a3b8' }} />, label: 'Skydekke', value: '45 %' },
                    { icon: <Speed sx={{ fontSize: 13, color: '#f472b6' }} />, label: 'Trykk', value: '1013 hPa' },
                  ].map((s) => (
                    <Box key={s.label} sx={{ p: 1, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ color: 'inherit', display: 'inline-flex' }}>{s.icon}</Box><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{s.label}</Typography></Stack>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{s.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </>)}
            </Box>

            {/* De neste dagene */}
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>De neste dagene</Typography>
              <Stack spacing={0.5}>
                {(isReal ? forecast : SAMPLE_FORECAST)?.slice(0, 7).map((d: any) => {
                  const day = d.date ? new Date(`${d.date}T12:00:00`) : new Date(Date.now() + (d.offset || 0) * 86400000);
                  return (
                    <Stack key={d.date || d.offset} direction="row" spacing={1} alignItems="center" sx={{ py: 0.4 }}>
                      <Typography sx={{ width: 96, fontSize: 12.5, color: ws.textDim }}>{day.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric' })}</Typography>
                      {weatherIcon(d.symbol, { fontSize: 16 })}
                      <Typography sx={{ flex: 1, fontSize: 12 }}>{symbolLabel(d.symbol)}</Typography>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{d.temperature ?? '–'} °C</Typography>
                      {d.precipitation ? <Typography sx={{ fontSize: 11, color: ws.textFaint, width: 42, textAlign: 'right' }}>{d.precipitation} mm</Typography> : <Box sx={{ width: 42 }} />}
                    </Stack>
                  );
                })}
                {isReal && !forecast && !weatherLoading && (
                  <Typography sx={{ fontSize: 12, color: ws.textDim, py: 0.5 }}>Ingen prognose tilgjengelig.</Typography>
                )}
              </Stack>
            </Box>

            {/* Logistikk */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <LocalShipping sx={{ fontSize: 16, color: ws.accent }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Logistikk</Typography>
                </Stack>
                <Typography sx={{ fontSize: 11, color: ws.textFaint, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <Groups sx={{ fontSize: 13 }} />{crewOnline} / {crewTotal} online
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {[...rows].sort((a, b) => a.startMin - b.startMin).slice(0, 4).map((r) => {
                  const addr = locationLine(r.sted, isReal ? locations : SAMPLE_LOCATIONS);
                  const locCrew = (() => {
                    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
                    const all = (isReal ? locations : SAMPLE_LOCATIONS) || [];
                    const hit = all.find((l) => norm(l.label) === norm(r.sted)) || all.find((l) => norm(l.label).includes(norm(r.sted)) || norm(r.sted).includes(norm(l.label)));
                    return hit?.crew || [];
                  })();
                  return (
                    <Box key={r.id || r.moment} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ minWidth: 86, textAlign: 'center', borderRadius: 1, bgcolor: ws.panel, border: `1px solid ${ws.border}`, px: 0.75, py: 0.5 }}>
                          <Typography sx={{ fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{(r.tid || '').split(' – ')[0]}</Typography>
                          <Typography sx={{ fontSize: 9, color: ws.textFaint, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{(r.tid || '').split(' – ')[1] || '…'}</Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.moment}</Typography>
                            <WsTag label={r.status[0]} tone={r.status[1] as 'green' | 'amber' | 'red' | 'blue' | 'accent' | 'neutral'} />
                          </Stack>
                          <Typography sx={{ fontSize: 11, color: ws.textFaint, display: 'inline-flex', alignItems: 'center', gap: 0.4, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                            <Place sx={{ fontSize: 11.5 }} />
                            {r.sted === '–' ? 'Sted ikke satt' : r.sted}{addr ? ` · ${addr}` : ''}
                          </Typography>
                        </Box>
                      </Stack>
                      {locCrew.length > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.85, ml: 0 }}>
                          <AvatarGroup max={4} sx={{ justifyContent: 'flex-start', '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 10, fontWeight: 800 } }}>
                            {locCrew.map((c: any) => (
                              <Avatar
                                key={c.id || c.name}
                                src={c.avatarUrl || roleAvatarSrc(c.name, c.crewRole, 56)}
                                sx={{
                                  bgcolor: CREW_ROLE_COLOR[c.crewRole] || '#a78bfa',
                                  color: '#0d0d16',
                                  border: `2px solid ${ws.panelAlt}`,
                                }}
                              >
                                {roleInitials(c.name)}
                              </Avatar>
                            ))}
                          </AvatarGroup>
                          <Typography sx={{ fontSize: 11, color: ws.textFaint, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {locCrew.slice(0, 2).map((c: any) => `${c.name} · ${CREW_ROLE_LABEL[c.crewRole] || c.crewRole}`).join('  ·  ')}
                            {locCrew.length > 2 ? `  ·  +${locCrew.length - 2} til` : ''}
                          </Typography>
                          <Button size="small" onClick={openCrew} sx={{ minWidth: 0, p: 0.25, color: ws.accent, textTransform: 'none', fontSize: 11, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}>Alle</Button>
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {isReal && weather && (
            <Button size="small" startIcon={<Cached sx={{ fontSize: 15 }} />} onClick={loadWeather} disabled={weatherLoading} sx={{ color: ws.textDim, textTransform: 'none' }}>
              {weatherLoading ? 'Oppdaterer…' : 'Oppdater'}
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => setWeatherOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Crew på location */}
      <Dialog open={crewOpen} onClose={() => setCrewOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: 2, minWidth: { xs: '92vw', sm: 520 } } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Groups sx={{ fontSize: 19, color: ws.accent }} />Crew på location</Stack>
          <Typography sx={{ fontSize: 12, color: ws.textFaint, fontWeight: 500 }}>{crewOnline} / {crewTotal} online</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.75}>
            {(isReal ? locations : SAMPLE_LOCATIONS).map((l) => (
              <Box key={l.label} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                  <Place sx={{ fontSize: 14, color: ws.accent }} />
                  <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{l.label}</Typography>
                  {l.arrivalTime && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>ankomst {l.arrivalTime}</Typography>}
                  {isReal && l.id && (
                    <IconButton size="small" aria-label={`Endre adresse for ${l.label}`} onClick={() => openLocEdit(l)} sx={{ color: ws.textDim, p: 0.25, '&:hover': { color: ws.accent } }}>
                      <EditOutlined sx={{ fontSize: 15 }} />
                    </IconButton>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 2.6, mb: 0.75 }}>
                  <Typography sx={{ flex: 1, fontSize: 11, color: ws.textFaint }}>
                    {[l.address, l.postalCode, l.city].filter(Boolean).join(', ') || 'Adresse ikke satt'}
                  </Typography>
                  <Button size="small" startIcon={<Navigation sx={{ fontSize: 13 }} />} onClick={() => void navigateToLocation(l)} disabled={navBusyId === l.label}
                    sx={{ minWidth: 0, color: ws.accent, textTransform: 'none', fontWeight: 700, fontSize: 11, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1, py: 0.25, '&:hover': { bgcolor: ws.accentSoft } }}>
                    {navBusyId === l.label ? 'Slår opp…' : 'Naviger'}
                  </Button>
                </Stack>
                {(l.crew?.length ? l.crew : []).map((c) => (
                  <Stack key={c.id || c.name} direction="row" spacing={1} alignItems="center" sx={{ ml: 2.6, py: 0.35 }}>
                    <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: ws.accentSoft, color: ws.accent }}>{c.name.slice(0, 1)}</Avatar>
                    <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{c.name}</Typography>
                    <Typography sx={{ fontSize: 11, color: ws.textDim }}>{CREW_ROLE_LABEL[c.crewRole] || c.crewRole || 'crew'}</Typography>
                  </Stack>
                ))}
                {!l.crew?.length && <Typography sx={{ fontSize: 11.5, color: ws.textDim, ml: 2.6 }}>Ingen crew tildelt.</Typography>}
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {isReal && <Button size="small" startIcon={<Cached sx={{ fontSize: 15 }} />} onClick={loadLocations} sx={{ color: ws.textDim, textTransform: 'none' }}>Oppdater</Button>}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => setCrewOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Endre adresse på lokasjon */}
      <Dialog open={!!locEdit} onClose={() => !locSaving && setLocEdit(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: 2, minWidth: { xs: '92vw', sm: 420 } } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Endre adresse — {locEdit?.label || ''}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <TextField size="small" label="Sted / etikett" value={locForm.label} onChange={(e) => setLocForm((f) => ({ ...f, label: e.target.value }))}
              inputProps={{ 'aria-label': 'Sted / etikett' }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }} />
            <TextField size="small" label="Adresse" value={locForm.address} onChange={(e) => setLocForm((f) => ({ ...f, address: e.target.value }))}
              inputProps={{ 'aria-label': 'Adresse' }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }} />
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="Postnr" value={locForm.postalCode} onChange={(e) => setLocForm((f) => ({ ...f, postalCode: e.target.value }))}
                inputProps={{ 'aria-label': 'Postnr' }} sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }} />
              <TextField size="small" label="By" value={locForm.city} onChange={(e) => setLocForm((f) => ({ ...f, city: e.target.value }))}
                inputProps={{ 'aria-label': 'By' }} sx={{ flex: 2, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }} />
            </Stack>
            <TextField size="small" label="Notat" value={locForm.notes} onChange={(e) => setLocForm((f) => ({ ...f, notes: e.target.value }))}
              inputProps={{ 'aria-label': 'Notat' }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, '& .MuiInputLabel-root': { color: ws.textFaint } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => setLocEdit(null)} disabled={locSaving} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
          <Button size="small" variant="contained" onClick={() => void saveLocEdit()} disabled={locSaving || !locForm.label.trim()}
            sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
            {locSaving ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Team Sync-detaljer */}
      <Dialog open={syncOpen} onClose={() => setSyncOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: 2, minWidth: { xs: '92vw', sm: 520 } } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Sync sx={{ fontSize: 19, color: ws.accent }} />Team Sync</Stack>
          <Typography sx={{ fontSize: 12, color: ws.textFaint, fontWeight: 500 }}>{syncOwner?.name || ''}</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>Framdrift</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <WsRing value={syncPct ?? 0} size={84} thickness={9} label={syncPct == null ? '–' : `${syncPct}%`} color={syncPct == null ? ws.border : (syncPct >= 80 ? ws.green : ws.amber)} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{syncPct == null ? (isReal ? 'Synkroniserer…' : 'Synkronisert') : (syncPct >= 80 ? 'Synkronisert' : 'Pågår')}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{crewOnline} / {crewTotal} online</Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {syncReadiness.map((x) => (
                      <Stack key={x.label} direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: x.done ? ws.green : ws.amber }} />
                        <Typography sx={{ flex: 1, fontSize: 12 }}>{x.label}</Typography>
                        <Typography sx={{ fontSize: 12, color: ws.textDim }}>{x.value}</Typography>
                      </Stack>
                    ))}
                    {syncReadiness.length === 0 && (
                      <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>Ingen oppgaver eller sjekkpunkter ennå.</Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>Crew</Typography>
              <Stack spacing={0.5}>
                {syncMembers.map((m) => (
                  <Box key={m.email || m.name} sx={{ py: 0.4 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>{m.name.slice(0, 1)}</Avatar>
                      <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{m.name}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{CREW_ROLE_LABEL[m.crewRole] || m.crewRole}</Typography>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, ml: 1 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: m.online ? ws.green : ws.textFaint }} />
                        <Typography sx={{ fontSize: 10.5, color: m.online ? ws.green : ws.textFaint }}>{m.online ? 'online' : 'offline'}</Typography>
                      </Box>
                    </Stack>
                    <Typography sx={{ fontSize: 10.5, color: ws.textFaint, ml: 3.2, mt: 0.1 }}>
                      sist innlogget {m.online ? 'nå' : lastSeenLabel(m.lastSeen)}
                    </Typography>
                  </Box>
                ))}
                {syncMembers.length === 0 && (
                  <Typography sx={{ fontSize: 12, color: ws.textDim, py: 0.5 }}>Ingen teammedlemmer ennå.</Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {isReal && (
            <Button size="small" startIcon={<ChatBubbleOutline sx={{ fontSize: 15 }} />} onClick={() => void createTeamChat()} disabled={chatBusy}
              sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
              {chatBusy ? 'Oppretter…' : 'Opprett chat for teamet'}
            </Button>
          )}
          {isReal && (
            <Button size="small" startIcon={<Cached sx={{ fontSize: 15 }} />} onClick={loadSync} sx={{ color: ws.textDim, textTransform: 'none' }}>Oppdater</Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => setSyncOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ProduksjonskartTab;