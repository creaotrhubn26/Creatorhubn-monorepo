/**
 * ProduksjonskartTab — design #3 (Production Map), dark CreatorHub.
 * Dagens fokus / Crew / Vær / Team Sync + tre ekte visninger (Timeline / Board / Kart)
 * Kart-visningen viser et ekte Leaflet-kart med lokasjons-pins + crew-avatarer.
 * + Live koordinering (høyre) + Kritiske øyeblikk / Referanser.
 */
import React, { useState } from 'react';
import { Box, Stack, Typography, Avatar, AvatarGroup, IconButton, Button, TextField, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete } from '@mui/material';
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
import Add from '@mui/icons-material/Add';
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
import Print from '@mui/icons-material/Print';
import MyLocation from '@mui/icons-material/MyLocation';
import Air from '@mui/icons-material/Air';
import WaterDrop from '@mui/icons-material/WaterDrop';
import Opacity from '@mui/icons-material/Opacity';
import Speed from '@mui/icons-material/Speed';
import LocalShipping from '@mui/icons-material/LocalShipping';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsSectionTitle, WsRing, WsPills, WsTag, WsTable, WsImageGrid } from '../ui';
import { useProjectImages } from '../useProjectImages';
import { externalDataService } from '@/services/ExternalDataService';

type PlanStatus = 'Ferdig' | 'Pågår' | 'Planlagt' | 'Kritisk';
type ViewKey = 'timeline' | 'board' | 'kart' | 'plan';
type FilterKey = 'alle' | PlanStatus;

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
}

interface WeddingEvent {
  id?: string;
  title?: string;
  time?: string;
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

/** Live-posisjons-pin for crew (rolle-farget ring + grønn prikk hvis fersk) */
const buildCrewPinIcon = (name: string, role: string, fresh: boolean, avatarUrl?: string): L.DivIcon => {
  const color = CREW_ROLE_COLOR[role] || '#a78bfa';
  const src = avatarUrl || avatarSrc(name, 40);
  const inner = `<img src="${escHtml(src)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;display:block" onerror="this.style.display='none'" />`;
  const html = `<div style="position:relative;width:44px;height:44px;">
      <div style="position:absolute;inset:0;border-radius:50%;border:3px solid ${color};box-shadow:0 0 0 2px rgba(0,0,0,.55), 0 0 18px ${color}66;background:#0a0a0f;display:flex;align-items:center;justify-content:center;overflow:hidden;">${inner}</div>
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
  React.useEffect(() => { try { localStorage.setItem('pm.view', view); } catch { /* */ } }, [view]);
  React.useEffect(() => { try { localStorage.setItem('pm.filter', filter); } catch { /* */ } }, [filter]);
  const refs = useProjectImages(projectId, 'references');
  const isReal = projectId && projectId !== 'sample';
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
    } catch (e: any) {
      window.alert(e?.message || 'Kunne ikke lagre notat');
    } finally {
      setSavingNote(false);
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
    loadNotes();
  }, [isReal, reloadEvents]);

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
        } else {
          await apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}/events`, { method: 'POST', body });
        }
        setEditor(null);
        reloadEvents();
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
        };
      })
    : sampleRows;

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
    if (filtered.length === 0) return <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2.5, textAlign: 'center' }}>{`Ingen hendelser med status «${filter}».`}</Typography>;
    const valid = filtered.filter((r) => !Number.isNaN(r.startMin) && r.endMin > r.startMin);
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
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const showNow = isReal && dayOffset === 0 && nowMin >= dayStart && nowMin <= dayEnd;
    return (
      <Box sx={{ overflowX: 'auto', '&::-webkit-scrollbar': { height: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: ws.border, borderRadius: 4 } }}>
        <Box sx={{ display: 'flex', minWidth: 760 }}>
          <Box sx={{ width: 118, flexShrink: 0, pt: 1.5 }}>
            {lanes.map((l) => (
              <Box key={l} data-ws-lane={l} sx={{ height: 58, display: 'flex', alignItems: 'center', px: 1, fontSize: 11.5, fontWeight: 700, color: ws.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: `1px solid ${ws.borderSoft}` }}>{l}</Box>
            ))}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ height: 26, position: 'relative' }}>
              {ticks.map((tk) => (
                <Box key={tk.t} sx={{ position: 'absolute', left: `${xPct(tk.t)}%`, top: 0, bottom: 0, transform: 'translateX(-50%)', zIndex: 3 }}>
                  {tk.label && <Box sx={{ width: 1, bgcolor: ws.border, height: 5, mx: 'auto' }} />}
                  {tk.label && <Typography sx={{ position: 'absolute', top: 7, left: 0, transform: 'translateX(-50%)', fontSize: 10, color: ws.textFaint, whiteSpace: 'nowrap' }}>{`${String(Math.floor(tk.t / 60)).padStart(2, '0')}:00`}</Typography>}
                </Box>
              ))}
            </Box>
            <Box sx={{ position: 'relative' }}>
              {lanes.map((l) => (
                <Box key={l} data-ws-lane-track={l} sx={{ position: 'relative', height: 58, borderBottom: `1px solid ${ws.borderSoft}`, overflow: 'hidden' }}>
                  {ticks.filter((tk) => tk.label).map((tk) => (
                    <Box key={tk.t} sx={{ position: 'absolute', left: `${xPct(tk.t)}%`, top: 0, bottom: 0, width: 1, bgcolor: 'rgba(255,255,255,0.04)' }} />
                  ))}
                  {valid.filter((r) => r.sted === l).map((r) => (
                    <Box key={r.id || r.moment} data-ws-kart-block={r.moment} title={`${r.moment} · ${r.tid}`} onClick={() => openEdit(r)} sx={{ cursor: 'pointer',
                      position: 'absolute', top: 7, bottom: 7, left: `${xPct(r.startMin)}%`, width: `${Math.max(2.5, xPct(r.endMin) - xPct(r.startMin))}%`, minWidth: 74,
                      borderRadius: 1, bgcolor: `${toneHex(r.status[1])}22`, borderLeft: `3px solid ${toneHex(r.status[1])}`, px: 0.75,
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', '&:hover': { outline: `1px solid ${ws.accentBorder}` } }}>
                      <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 800 }}>{r.moment}</Typography>
                      <Typography noWrap sx={{ fontSize: 10, color: ws.textFaint }}>{r.tid}</Typography>
                    </Box>
                  ))}
                </Box>
              ))}
              {showNow && (
                <Box sx={{ position: 'absolute', top: -26, bottom: 0, left: `${xPct(nowMin)}%`, width: 1.5, bgcolor: ws.amber, zIndex: 2, pointerEvents: 'none' }}>
                  <Typography sx={{ position: 'absolute', top: 2, left: 4, fontSize: 10, fontWeight: 700, color: ws.amber }}>Nå</Typography>
                </Box>
              )}
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
    const evsForSted = (label: string) => rows.filter((r) => r.sted && r.sted !== '–' && norm(r.sted) === norm(label));

    // Nåværende/neste lokasjon ut fra hendelsenes status og klokkeslett
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    let currentLabel: string | null = null;
    let nextLabel: string | null = null;
    let criticalLabels = new Set<string>();
    for (const r of rows) {
      if (!r.sted || r.sted === '–' || Number.isNaN(r.startMin)) continue;
      if (r.status[0] === 'Kritisk' || r.status[1] === 'red') criticalLabels.add(norm(r.sted));
      if (dayOffset !== 0) continue;
      if ((r.status[0] === 'Pågår') || (r.startMin <= nowMin && nowMin < r.endMin)) { if (!currentLabel) currentLabel = norm(r.sted); }
      else if (r.startMin > nowMin && !nextLabel) nextLabel = norm(r.sted);
    }

    // Rute-linje: lokasjoner sortert etter tidligste hendelse
    const ordered = [...list].sort((a, b) => {
      const ta = Math.min(...evsForSted(a.label).map((r) => r.startMin), Infinity);
      const tb = Math.min(...evsForSted(b.label).map((r) => r.startMin), Infinity);
      return (Number.isFinite(ta) ? ta : 100000) - (Number.isFinite(tb) ? tb : 100000);
    });
    const routePts = ordered.filter((l) => l.lat != null && l.lng != null).map((l) => [l.lat as number, l.lng as number] as [number, number]);

    const geoCoded = list.filter((l) => l.lat != null && l.lng != null);
    const withoutCoords = list.filter((l) => l.lat == null || l.lng == null);
    const total = list.length;
    const crewCount = crewAll.length;
    const checkedInCount = checkins.length;
    const freshPositions = crewPositions.filter((pp) => Date.now() - new Date(pp.updatedAt).getTime() < 5 * 60000);
    const fitKey = geoCoded.map((x) => `${x.lat!.toFixed(5)},${x.lng!.toFixed(5)}`).join('|');
    const fitMarkers = geoCoded.map((x) => [x.lat as number, x.lng as number] as [number, number]);
    const me = myCrewName.trim().toLowerCase();

    return (
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: ws.textDim }}>
            {total} lokasjoner · {crewCount} i crew · {checkedInCount} sjekket inn
            {freshPositions.length > 0 && ` · ${freshPositions.length} live`}
            {withoutCoords.length > 0 && !isReal && ' · demodata'}
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
                          <Button size="small" variant="outlined" startIcon={<Navigation sx={{ fontSize: 14 }} />}
                            onClick={() => navigateToLocation(l)} disabled={navBusyId === l.label}
                            sx={{ flex: 1, textTransform: 'none', fontSize: 11.5, color: '#f5f5f8', borderColor: '#4b4b66', '&:hover': { borderColor: ws.accent, color: ws.accent } }}>
                            {navBusyId === l.label ? 'Henter…' : 'Naviger hit'}
                          </Button>
                          {isReal && l.id && (
                            <Button size="small" startIcon={<EditOutlined sx={{ fontSize: 13 }} />} onClick={() => openLocEdit(l)}
                              sx={{ textTransform: 'none', fontSize: 11.5, color: '#8b8ba3', borderColor: '#4b4b66', '&:hover': { color: ws.accent } }}>
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
              return (
                <Marker key={pp.memberName} position={[pp.lat, pp.lng]} icon={buildCrewPinIcon(pp.memberName, pp.memberRole, fresh, member?.avatarUrl)}>
                  <Popup className="prod-map-popup">
                    <Stack spacing={0.5} sx={{ minWidth: 170 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{pp.memberName}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#9b9bb0' }}>{CREW_ROLE_LABEL[pp.memberRole] || pp.memberRole}{pp.accuracyM ? ` · ${Math.round(pp.accuracyM)} m nøyaktighet` : ''}</Typography>
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
          `}</style>
        </Box>
      </Stack>
    );
  })();
  // Printbar dagsplan — åpner et print-vennlig vindu
  const printPlan = () => {
    const w = window.open('', '_blank', 'width=920,height=720');
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rowsHtml = rows.map((r) =>
      `<tr><td>${esc(r.tid)}</td><td><b>${esc(r.moment)}</b><br><span style="color:#666">${esc(r.sub || '')}</span></td><td>${esc(r.status[0])}</td><td>${esc(r.notat || '')}</td></tr>`
    ).join('');
    const locs = isReal ? (locations || []) : SAMPLE_LOCATIONS;
    const locsHtml = locs.map((l) =>
      `<tr><td>${esc(l.label)}</td><td>${esc([l.address, l.postalCode, l.city].filter(Boolean).join(', ')) || '–'}</td><td>${(l.crew || []).map((c) => esc(c.name)).join(', ') || '–'}</td></tr>`
    ).join('');
    w.document.write(`<!doctype html><html><head><title>Dagsplan · ${esc(dayLabel)}</title>
      <style>
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 32px; }
        h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 13px; text-transform: uppercase; color: #555; margin: 28px 0 6px; letter-spacing: .5px; }
        table { width: 100%; border-collapse: collapse; } th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #ddd; font-size: 13px; vertical-align: top; }
        th { background: #f4f4f4; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h1>Dagsplan — ${esc(dayLabel)}</h1>
      <div style="font-size:12px;color:#777">${esc(dayLabel)}</div>
      <h2>Hendelser</h2>
      <table><thead><tr><th style="width:130px">Tid</th><th>Moment</th><th style="width:90px">Status</th><th>Notat</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="4">Ingen hendelser.</td></tr>'}</tbody></table>
      <h2>Lokasjoner & crew</h2>
      <table><thead><tr><th>Sted</th><th>Adresse</th><th>Crew</th></tr></thead><tbody>${locsHtml || '<tr><td colspan="3">Ingen lokasjoner.</td></tr>'}</tbody></table>
      <script>window.onload = function () { window.print(); };<\/script>
      </body></html>`);
    w.document.close();
  };


  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>Production Map</Typography>

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
              <IconButton size="small" aria-label="Skriv ut dagsplan" onClick={printPlan} sx={{ color: ws.textDim, '&:hover': { color: ws.accent } }}><Print sx={{ fontSize: 17 }} /></IconButton>
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

        {/* Bunn: Kritiske øyeblikk + Referanser */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <WsCard>
            <WsSectionTitle title="Kritiske øyeblikk" action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/shotlist`)} sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <Stack spacing={1}>
              {isReal ? (
                events && events.some((e) => (e.status || '').toLowerCase() === 'kritisk') ? (
                  events.filter((e) => (e.status || '').toLowerCase() === 'kritisk').map((e) => (
                    <Stack key={e.title} direction="row" spacing={1} alignItems="center"><Typography sx={{ fontSize: 12, color: ws.textDim, width: 44 }}>{e.time}</Typography><Typography sx={{ fontSize: 13, flex: 1 }}>{e.title}</Typography><WsTag label="Kritisk" tone="red" /></Stack>
                  ))
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 1.5, textAlign: 'center' }}>Ingen kritiske øyeblikk merket ennå.</Typography>
                )
              ) : [['12:15', 'Vielse', 'Kritisk', 'red'], ['16:30', 'Golden hour', 'Høy', 'amber'], ['20:15', 'Første dans', 'Høy', 'amber']].map(([t, m, lvl, tone]) => (
                <Stack key={t} direction="row" spacing={1} alignItems="center"><Typography sx={{ fontSize: 12, color: ws.textDim, width: 44 }}>{t}</Typography><Typography sx={{ fontSize: 13, flex: 1 }}>{m}</Typography><WsTag label={lvl} tone={tone} /></Stack>
              ))}
            </Stack>
          </WsCard>
          <WsCard>
            <WsSectionTitle title="Referanser & shots" action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/moodboard`)} sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <WsImageGrid columns={4} addLabel="Legg til" images={refs.images} onUpload={refs.onUpload} />
          </WsCard>
        </Box>
      </Box>

      {/* Live koordinering (høyre) */}
      <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Live koordinering</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} /><Typography sx={{ fontSize: 11, color: ws.green }}>Live</Typography></Stack>
          </Stack>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 1 }}>TEAM UPDATES</Typography>
          <Stack spacing={1.5}>
            {isReal && <Typography sx={{ fontSize: 12, color: ws.textDim, py: 1 }}>Ingen live-oppdateringer ennå.</Typography>}
            {!isReal && UPDATES.map((u, i) => (
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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}><NotificationsActive sx={{ fontSize: 17, color: ws.amber }} /><Typography sx={{ fontSize: 14, fontWeight: 700 }}>Varsler & viktige notater</Typography></Stack>
          <Stack spacing={1.25}>
            {isReal && <Typography sx={{ fontSize: 12, color: ws.textDim, py: 1 }}>Ingen varsler.</Typography>}
            {!isReal && ALERTS.map((a, i) => (
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
          {notes.length > 0 && (
            <Stack spacing={0.75} sx={{ mt: 1.5 }}>
              {notes.slice(0, 6).map((n: any) => (
                <Box key={n.id} sx={{ p: 1, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                  <Typography sx={{ fontSize: 12 }}>{n.body}</Typography>
                  <Typography sx={{ fontSize: 10, color: ws.textFaint, mt: 0.25 }}>{n.author_name || 'Du'}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </WsCard>
      </Box>

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