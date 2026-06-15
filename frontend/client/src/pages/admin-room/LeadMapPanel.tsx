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
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
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

interface Metrics {
  totalLeads: number;
  followUpsDue: number;
  meetingsBooked: number;
  conversionRate: number;
  statusCounts: Record<string, number>;
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

const palette = {
  bg: '#0a0a0f',
  bgPanel: '#150b2e',
  bgSubtle: 'rgba(168,85,247,0.04)',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#c084fc',
  amber: '#fbbf24',
};

// Carto Dark Matter — gratis dark-tiles (OSM-data, CC-BY-SA)
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; <a href="https://carto.com/attributions">CARTO</a> · <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

// Lag pin-icon for én status. Cached i Map så vi ikke re-genererer på hver render.
const pinIconCache = new Map<string, L.DivIcon>();
function makePinIcon(status: LeadStatus, selected: boolean): L.DivIcon {
  const key = `${status}-${selected ? 1 : 0}`;
  const cached = pinIconCache.get(key);
  if (cached) return cached;
  const meta = STATUS_META[status];
  const glow = selected
    ? `0 0 0 4px ${palette.amber}aa, 0 0 24px ${palette.amber}cc`
    : `0 1px 3px rgba(0,0,0,0.6)`;
  const html = `
    <div style="
      width: ${selected ? 22 : 18}px;
      height: ${selected ? 22 : 18}px;
      border-radius: 50%;
      background: ${meta.color};
      border: 2px solid #0a0a0f;
      box-shadow: ${glow};
      transition: all 160ms ease;
    "></div>`;
  const icon = L.divIcon({
    html, className: '', iconSize: [22, 22], iconAnchor: [11, 11],
  });
  pinIconCache.set(key, icon);
  return icon;
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
  const [leads, setLeads] = useState<MapLead[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapLead | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const boundsRef = useRef<L.LatLngBounds | null>(null);

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
  }, [statusFilter]);

  const fetchMeta = useCallback(async () => {
    try {
      const [mRes, aRes] = await Promise.all([
        fetch('/api/admin-room/lead-map/metrics', { credentials: 'include', headers: authHeaders() }),
        fetch('/api/admin-room/lead-map/activities?limit=20', { credentials: 'include', headers: authHeaders() }),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (aRes.ok) {
        const a = await aRes.json();
        setActivities(a.activities ?? []);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => { fetchLeads(); fetchMeta(); }, [fetchLeads, fetchMeta]);

  const handleBoundsChange = useCallback((b: L.LatLngBounds) => {
    boundsRef.current = b;
    fetchLeads(b);
  }, [fetchLeads]);

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
        body: JSON.stringify({ place, leadCategory: place.category }),
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

  const filteredLeads = useMemo(() =>
    statusFilter.length > 0 ? leads.filter((l) => statusFilter.includes(l.status)) : leads,
    [leads, statusFilter],
  );

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
              <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: palette.textPrimary, lineHeight: 1.1 }}>
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
              May 12 – May 18, 2025
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={() => setPlacesOpen(true)}
              startIcon={<SearchOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: palette.amber, borderColor: 'rgba(251,191,36,0.4)', fontWeight: 700, fontSize: '0.78rem' }}
            >
              Discover leads
            </Button>
            <Tooltip title="Oppdater">
              <IconButton onClick={() => { void fetchLeads(boundsRef.current ?? undefined); void fetchMeta(); }} sx={{ color: palette.textSecondary }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

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
              trend: '+18%',
            },
            {
              label: 'Follow-ups',
              value: metrics?.followUpsDue ?? 0,
              icon: <RefreshIcon sx={{ fontSize: 18 }} />,
              color: '#fb923c',
              trend: '+12%',
            },
            {
              label: 'Meetings',
              value: metrics?.meetingsBooked ?? 0,
              icon: <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />,
              color: '#a78bfa',
              trend: '+20%',
            },
            {
              label: 'Conversion Rate',
              value: metrics ? `${metrics.conversionRate}%` : '0%',
              icon: <PieChartOutlineIcon sx={{ fontSize: 18 }} />,
              color: '#34d399',
              trend: '+6.3%',
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
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ position: 'relative', zIndex: 1, mb: 0.6 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: `${m.color}1f`, color: m.color,
                }}>
                  {m.icon}
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {m.label}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: '1.95rem', fontWeight: 800, color: m.color, lineHeight: 1.1, position: 'relative', zIndex: 1 }}>
                {m.value}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.4} sx={{ mt: 0.6, position: 'relative', zIndex: 1 }}>
                <TrendingUpIcon sx={{ fontSize: 14, color: '#34d399' }} />
                <Typography sx={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700 }}>
                  {m.trend}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted }}>
                  from last month
                </Typography>
              </Stack>
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
              {filteredLeads.map((lead) => (
                <Marker
                  key={lead.id}
                  position={[lead.latitude, lead.longitude]}
                  icon={makePinIcon(lead.status, selected?.id === lead.id)}
                  eventHandlers={{
                    click: () => { setSelected(lead); setQuickStatusFor(lead); },
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

          {/* Detail-panel */}
          {selected ? (
            <Box sx={{
              width: { xs: '100%', md: 400 }, height: 540,
              borderRadius: 1.6, overflowY: 'auto',
              border: `1px solid ${palette.borderStrong}`,
              bgcolor: palette.bgSubtle, p: 2,
            }}>
              {/* Header med avatar + navn + close */}
              <Stack direction="row" alignItems="flex-start" spacing={1.4} sx={{ mb: 1.6 }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: 1.4, flexShrink: 0,
                  bgcolor: `${STATUS_META[selected.status].color}22`,
                  border: `1px solid ${STATUS_META[selected.status].color}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: STATUS_META[selected.status].color,
                  fontWeight: 800, fontSize: '1.1rem',
                }}>
                  {(selected.name?.[0] ?? '?').toUpperCase()}
                </Box>
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
                      Assigned Rep
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', color: palette.textSecondary }}>
                      Alex Morgan
                    </Typography>
                  </Stack>
                </Stack>

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

              {/* UPDATE STATUS — 6 quick-buttons */}
              <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.8 }}>
                Update Status
              </Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0.6, mb: 2,
              }}>
                {PRIMARY_STATUSES.map((s) => {
                  const meta = STATUS_META[s];
                  const active = selected.status === s;
                  return (
                    <Button
                      key={s} size="small" variant={active ? 'contained' : 'outlined'}
                      onClick={() => updateStatus(s)}
                      disabled={updatingStatus || active}
                      sx={{
                        bgcolor: active ? meta.color : meta.bg,
                        color: active ? '#0a0a0f' : meta.color,
                        borderColor: meta.color,
                        fontWeight: 700, fontSize: '0.7rem',
                        textTransform: 'none', minWidth: 0, px: 0.8,
                        '&:hover': { bgcolor: meta.color, color: '#0a0a0f', borderColor: meta.color },
                        '&:disabled': { bgcolor: meta.color, color: '#0a0a0f', opacity: 1 },
                      }}
                    >
                      {meta.label}
                    </Button>
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

        {/* Recent Activity — horisontale kort */}
        <Box sx={{ mt: 2.4, p: 2, borderRadius: 1.6, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: palette.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                const accent = isWon
                  ? STATUS_META.won.color
                  : isMeeting
                  ? STATUS_META.meeting_booked.color
                  : isDeclined
                  ? STATUS_META.declined.color
                  : isReturn
                  ? STATUS_META.return.color
                  : palette.amber;
                return (
                  <Box key={a.id} sx={{
                    p: 1.4, borderRadius: 1.2,
                    bgcolor: 'rgba(10,10,15,0.4)',
                    border: `1px solid ${palette.border}`,
                    borderTop: `2px solid ${accent}`,
                    minHeight: 92, display: 'flex', flexDirection: 'column',
                  }}>
                    <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.6 }}>
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%', bgcolor: accent,
                        boxShadow: `0 0 6px ${accent}99`,
                      }} />
                      <Typography sx={{ fontSize: '0.66rem', color: accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {a.activityType.replace(/_/g, ' ')}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.8rem', color: palette.textPrimary, fontWeight: 700, lineHeight: 1.2 }}>
                      {a.customerName ?? 'Lead'}
                    </Typography>
                    {a.description && (
                      <Typography sx={{
                        fontSize: '0.72rem', color: palette.textSecondary, mt: 0.2,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {a.description}
                      </Typography>
                    )}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 'auto', pt: 0.6 }}>
                      {a.userName ? (
                        <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted }}>
                          {a.userName}
                        </Typography>
                      ) : <span />}
                      <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 700 }}>
                        {formatRelative(a.createdAt)}
                      </Typography>
                    </Stack>
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
