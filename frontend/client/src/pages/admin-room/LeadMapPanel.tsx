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
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
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

  const updateStatus = async (newStatus: LeadStatus) => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      const r = await fetch(`/api/admin-room/lead-map/leads/${selected.id}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        setLeads((prev) => prev.map((l) => l.id === selected.id ? { ...l, status: newStatus } : l));
        setSelected((prev) => prev ? { ...prev, status: newStatus } : null);
        void fetchMeta();
      }
    } finally {
      setUpdatingStatus(false);
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
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.4 }}>
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
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: palette.textPrimary }}>
                Lead Map
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, fontStyle: 'italic' }}>
                Discover. Connect. Create Opportunity.
              </Typography>
            </Stack>
          </Stack>
          <Tooltip title="Oppdater">
            <IconButton onClick={() => { void fetchLeads(boundsRef.current ?? undefined); void fetchMeta(); }} sx={{ color: palette.textSecondary }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Metric-cards */}
        {metrics && (
          <Stack direction="row" spacing={1.4} sx={{ mb: 2.4 }}>
            {[
              { label: 'Total Leads',     value: metrics.totalLeads,      color: palette.amber },
              { label: 'Follow-ups',      value: metrics.followUpsDue,    color: '#fb923c' },
              { label: 'Meetings',        value: metrics.meetingsBooked,  color: '#a78bfa' },
              { label: 'Conversion Rate', value: `${metrics.conversionRate}%`, color: '#34d399' },
            ].map((m) => (
              <Box key={m.label} sx={{
                flex: 1, p: 1.8, borderRadius: 1.6,
                bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
                position: 'relative', overflow: 'hidden',
                '&::after': {
                  content: '""', position: 'absolute', top: 0, right: 0,
                  width: 80, height: 80, borderRadius: '50%',
                  background: `radial-gradient(circle, ${m.color}22 0%, transparent 70%)`,
                  pointerEvents: 'none',
                },
              }}>
                <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {m.label}
                </Typography>
                <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: m.color, lineHeight: 1.1, mt: 0.4 }}>
                  {m.value}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}

        {/* Filter chips */}
        <Stack direction="row" spacing={0.8} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.8 }} useFlexGap>
          {ALL_STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const active = statusFilter.includes(s);
            return (
              <Chip
                key={s} label={meta.label}
                size="small"
                onClick={() => setStatusFilter((prev) =>
                  prev.includes(s) ? prev.filter((p) => p !== s) : [...prev, s]
                )}
                sx={{
                  bgcolor: active ? meta.color : meta.bg,
                  color: active ? '#0a0a0f' : meta.color,
                  fontWeight: 700, fontSize: '0.68rem',
                  border: `1px solid ${meta.color}`,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: meta.color, color: '#0a0a0f' },
                }}
              />
            );
          })}
        </Stack>

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
                    click: () => setSelected(lead),
                  }}
                >
                  <Popup>
                    <strong>{lead.name}</strong><br />
                    {lead.category}<br />
                    {lead.address}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Status-legend overlay */}
            <Box sx={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
              p: 1.4, borderRadius: 1.2,
              bgcolor: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)',
              border: `1px solid ${palette.borderStrong}`,
              maxWidth: 240,
            }}>
              <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', mb: 0.6 }}>
                Status
              </Typography>
              <Stack spacing={0.4}>
                {PRIMARY_STATUSES.map((s) => {
                  const meta = STATUS_META[s];
                  const count = metrics?.statusCounts?.[s] ?? 0;
                  return (
                    <Stack key={s} direction="row" alignItems="center" spacing={0.8}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color }} />
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textSecondary, flex: 1 }}>
                        {meta.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted, fontWeight: 700 }}>
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
          {selected && (
            <Box sx={{
              width: { xs: '100%', md: 360 }, height: 540,
              borderRadius: 1.6, overflowY: 'auto',
              border: `1px solid ${palette.borderStrong}`,
              bgcolor: palette.bgSubtle, p: 2,
            }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.4 }}>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: palette.textPrimary }}>
                    {selected.name}
                  </Typography>
                  {selected.category && (
                    <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                      {selected.category}
                    </Typography>
                  )}
                  <Chip
                    size="small"
                    label={STATUS_META[selected.status].label}
                    sx={{
                      mt: 0.6, alignSelf: 'flex-start',
                      bgcolor: STATUS_META[selected.status].bg,
                      color: STATUS_META[selected.status].color,
                      fontWeight: 700, fontSize: '0.68rem',
                    }}
                  />
                </Stack>
                <IconButton size="small" onClick={() => setSelected(null)} sx={{ color: palette.textMuted }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>

              {selected.address && (
                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.4 }}>
                  <PlaceOutlinedIcon sx={{ color: palette.textMuted, fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                    {selected.address}{selected.city && `, ${selected.city}`}
                  </Typography>
                </Stack>
              )}

              {selected.googleRating && (
                <Stack direction="row" spacing={0.4} alignItems="center" sx={{ mb: 0.4 }}>
                  <StarOutlineIcon sx={{ color: palette.amber, fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.78rem', color: palette.amber, fontWeight: 700 }}>
                    {selected.googleRating}
                  </Typography>
                </Stack>
              )}

              {selected.nextAction && (
                <Box sx={{ mt: 1.4, p: 1, borderRadius: 1, bgcolor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.32)' }}>
                  <Typography sx={{ fontSize: '0.66rem', color: palette.amber, fontWeight: 700, textTransform: 'uppercase' }}>
                    Neste handling
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem', color: palette.textPrimary, mt: 0.2 }}>
                    {selected.nextAction}
                  </Typography>
                </Box>
              )}

              {selected.lastVisitAt && (
                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1 }}>
                  <HistoryToggleOffOutlinedIcon sx={{ color: palette.textMuted, fontSize: 14 }} />
                  <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                    Sist besøkt {formatRelative(selected.lastVisitAt)}
                  </Typography>
                </Stack>
              )}

              {/* Status-knapper */}
              <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 700, textTransform: 'uppercase', mt: 2, mb: 0.8 }}>
                Oppdater status
              </Typography>
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                {PRIMARY_STATUSES.map((s) => {
                  const meta = STATUS_META[s];
                  return (
                    <Button
                      key={s} size="small" variant="contained"
                      onClick={() => updateStatus(s)}
                      disabled={updatingStatus || selected.status === s}
                      sx={{
                        bgcolor: meta.color, color: '#0a0a0f',
                        fontWeight: 700, fontSize: '0.7rem',
                        textTransform: 'none', minWidth: 0, px: 1.2,
                        '&:hover': { bgcolor: meta.color, filter: 'brightness(0.9)' },
                        '&:disabled': { bgcolor: meta.bg, color: meta.color, opacity: 1 },
                      }}
                    >
                      {meta.label}
                    </Button>
                  );
                })}
              </Stack>

              {/* Links */}
              {(selected.websiteUrl || selected.instagramUrl) && (
                <Stack direction="row" spacing={0.6} sx={{ mt: 2 }}>
                  {selected.websiteUrl && (
                    <Button
                      size="small" variant="outlined"
                      startIcon={<LanguageOutlinedIcon sx={{ fontSize: 14 }} />}
                      onClick={() => window.open(selected.websiteUrl!, '_blank')}
                      sx={{ color: palette.accent, borderColor: palette.borderStrong, fontSize: '0.72rem' }}
                    >
                      Website
                    </Button>
                  )}
                </Stack>
              )}

              {selected.notes && (
                <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, mt: 2, whiteSpace: 'pre-wrap' }}>
                  {selected.notes}
                </Typography>
              )}
            </Box>
          )}
        </Stack>

        {/* Activity feed */}
        <Box sx={{ mt: 2.4, p: 2, borderRadius: 1.6, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
          <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: palette.textPrimary, mb: 1 }}>
            Recent activity
          </Typography>
          {activities.length === 0 ? (
            <Typography sx={{ fontSize: '0.76rem', color: palette.textMuted, fontStyle: 'italic' }}>
              Ingen aktivitet ennå.
            </Typography>
          ) : (
            <Stack spacing={0.6}>
              {activities.slice(0, 8).map((a) => (
                <Stack key={a.id} direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: palette.amber }} />
                  <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary, flex: 1 }}>
                    <strong style={{ color: palette.textPrimary }}>{a.customerName ?? 'Lead'}</strong>
                    {' · '}{a.description ?? a.activityType}
                    {a.userName && <span style={{ color: palette.textMuted }}> · {a.userName}</span>}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, whiteSpace: 'nowrap' }}>
                    {formatRelative(a.createdAt)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
