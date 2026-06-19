/**
 * LeadMapMyDayPanel.tsx
 *
 * "Min dag" — salgskonsulentens daglige arbeidsliste:
 *   - Kvote-progresjon denne måneden
 *   - Mine assigned leads (sortert etter prioritet + valgfri distanse)
 *   - Naviger til hver lead via Google Maps
 *   - Hurtig-handlinger: Ring, E-post, Logg besøk
 *
 * Sorteringer:
 *   - Default: forfalt follow-up > Claude-rank > AI-score > sist contact
 *   - Med GPS-fix: kort kjørerute først (Claude rank 1 overstyrer)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Grid2 as Grid, IconButton, LinearProgress, Stack, Tooltip, Typography,
} from '@mui/material';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import NavigationOutlinedIcon from '@mui/icons-material/NavigationOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';

interface WorkloadLead {
  id: string;
  name: string;
  lead_category: string | null;
  lead_status: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  logo_url: string | null;
  ai_opportunity_score: number | null;
  claude_recommendation_rank: number | null;
  claude_recommendation_reason: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  assigned_at: string | null;
  distance_km: number | null;
}

interface QuotaProgress {
  yearMonth: string;
  targetNok: number;
  achievedNok: number;
  remainingNok: number;
  progressPct: number | null;
  projectedNok: number;
  wonCount: number;
  meetingsBooked: number;
  commissionEarnedNok: number;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rr_lead_map_active_org');
}

const STATUS_LABEL: Record<string, string> = {
  unvisited: 'Ikke besøkt',
  visited: 'Besøkt',
  return: 'Returner',
  not_present: 'Ikke til stede',
  declined: 'Avvist',
  interested: 'Interessert',
  meeting_booked: 'Møte booket',
  proposal_sent: 'Tilbud sendt',
  won: 'Vunnet',
  lost: 'Tapt',
};

const STATUS_COLOR: Record<string, string> = {
  unvisited: '#9ca3af',
  visited: '#a78bfa',
  return: '#fbbf24',
  not_present: '#94a3b8',
  declined: '#f87171',
  interested: '#34d399',
  meeting_booked: '#60a5fa',
  proposal_sent: '#c084fc',
  won: '#34d399',
  lost: '#6b7280',
};

function formatNok(n: number): string {
  return n.toLocaleString('nb-NO') + ' kr';
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(Math.abs(diff) / 60000);
  const future = diff < 0;
  if (mins < 1) return 'akkurat nå';
  if (mins < 60) return future ? `om ${mins} min` : `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return future ? `om ${hrs} t` : `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  return future ? `om ${days} d` : `${days} d siden`;
}

export default function LeadMapMyDayPanel() {
  const [orgId, setOrgId] = useState<string | null>(getActiveOrgId());
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [leads, setLeads] = useState<WorkloadLead[]>([]);
  const [quota, setQuota] = useState<QuotaProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo<HeadersInit>(
    () => ({ Authorization: `Bearer ${getAuthToken()}` }),
    [],
  );

  // ─── GPS for distanse-sortering ────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { /* nektet — vi sorterer på prioritet uten distanse */ },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ─── Load workload + quota ─────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (orgId) qs.set('organization_id', orgId);
      if (position) {
        qs.set('lat', String(position.lat));
        qs.set('lng', String(position.lng));
      }
      const [wRes, qRes] = await Promise.all([
        fetch(`/api/admin-room/lead-map/me/workload?${qs.toString()}`, { headers }),
        orgId
          ? fetch(`/api/admin-room/lead-map/me/quota?organization_id=${orgId}`, { headers })
          : Promise.resolve(null),
      ]);
      if (wRes.ok) {
        const j = await wRes.json();
        setLeads(j.leads ?? []);
      }
      if (qRes?.ok) {
        const j = await qRes.json();
        setQuota(j);
      }
    } catch (err) {
      setError(`Lasting feilet: ${String(err)}`);
    } finally { setLoading(false); }
  }, [orgId, position, headers]);

  useEffect(() => { void load(); }, [load]);

  // Re-load når orgId endres
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rr_lead_map_active_org') setOrgId(getActiveOrgId());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const overdueLeads = leads.filter(
    (l) => l.next_follow_up_at && new Date(l.next_follow_up_at) < new Date(),
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
        Min dag
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Mine tildelte leads sortert etter prioritet
        {position && ' — også optimalisert for kort kjørerute fra din posisjon'}
      </Typography>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

      {/* ─── Kvote-progresjon ─────────────────────────────────── */}
      {quota && quota.targetNok > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <EmojiEventsOutlinedIcon sx={{ color: '#f97316', fontSize: 32 }} />
              <Box flexGrow={1}>
                <Typography variant="h6">Kvote {quota.yearMonth}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatNok(quota.achievedNok)} av {formatNok(quota.targetNok)}
                  {quota.progressPct !== null && ` (${quota.progressPct}%)`}
                </Typography>
              </Box>
              <Box textAlign="right">
                <Typography variant="caption" color="text.secondary">
                  Projeksjon m/ dagens tempo
                </Typography>
                <Typography variant="body1" sx={{
                  color: quota.projectedNok >= quota.targetNok ? '#34d399' : '#fbbf24',
                  fontWeight: 700,
                }}>
                  {formatNok(quota.projectedNok)}
                </Typography>
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, quota.progressPct ?? 0)}
              sx={{
                height: 12, borderRadius: 6,
                bgcolor: 'rgba(192,132,252,0.15)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: (quota.progressPct ?? 0) >= 100 ? '#34d399' : '#c084fc',
                },
              }}
              aria-label={`Kvote-progresjon ${quota.progressPct ?? 0}%`}
            />
            <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Vunnet</Typography>
                <Typography variant="h6">{quota.wonCount}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Møter denne mnd</Typography>
                <Typography variant="h6">{quota.meetingsBooked}</Typography>
              </Box>
              {quota.commissionEarnedNok > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Provisjon opptjent</Typography>
                  <Typography variant="h6" sx={{ color: '#34d399' }}>
                    {formatNok(quota.commissionEarnedNok)}
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ─── Sammendrag-kort ──────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <TrendingUpIcon sx={{ color: '#c084fc' }} />
                <Box>
                  <Typography variant="overline" color="text.secondary">Mine leads</Typography>
                  <Typography variant="h5">{leads.length}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <EventBusyOutlinedIcon sx={{ color: '#f87171' }} />
                <Box>
                  <Typography variant="overline" color="text.secondary">Forfalt</Typography>
                  <Typography variant="h5" sx={{ color: '#f87171' }}>
                    {overdueLeads.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AutoAwesomeOutlinedIcon sx={{ color: '#fbbf24' }} />
                <Box>
                  <Typography variant="overline" color="text.secondary">Topp Claude-pri</Typography>
                  <Typography variant="h5">
                    {leads.filter((l) => l.claude_recommendation_rank && l.claude_recommendation_rank <= 5).length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <MyLocationOutlinedIcon sx={{ color: '#34d399' }} />
                <Box>
                  <Typography variant="overline" color="text.secondary">Innen 5 km</Typography>
                  <Typography variant="h5">
                    {position
                      ? leads.filter((l) => l.distance_km !== null && l.distance_km < 5).length
                      : '—'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ─── Lead-liste ──────────────────────────────────────── */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Lead-prioritet
      </Typography>

      {loading && <CircularProgress />}

      {!loading && leads.length === 0 && (
        <Alert severity="info">
          Ingen tildelte leads. Salgssjefen kan tildele leads via auto-assign
          eller manuelt fra kartet.
        </Alert>
      )}

      <Stack spacing={1.5}>
        {leads.map((lead) => {
          const isOverdue = lead.next_follow_up_at
            && new Date(lead.next_follow_up_at) < new Date();
          const navUrl = position && lead.latitude && lead.longitude
            ? `https://www.google.com/maps/dir/?api=1&origin=${position.lat},${position.lng}&destination=${lead.latitude},${lead.longitude}&travelmode=driving`
            : null;
          return (
            <Card key={lead.id} variant="outlined" sx={{
              borderColor: isOverdue ? '#f87171' : undefined,
              borderWidth: isOverdue ? 2 : 1,
            }}>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  {/* Logo */}
                  <Avatar
                    src={lead.logo_url ?? undefined}
                    variant="rounded"
                    sx={{ width: 56, height: 56, bgcolor: '#fff' }}
                  >
                    <LanguageOutlinedIcon />
                  </Avatar>

                  {/* Hovedinnhold */}
                  <Box flexGrow={1}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                      <Typography variant="subtitle1">{lead.name}</Typography>
                      <Chip
                        label={STATUS_LABEL[lead.lead_status] ?? lead.lead_status}
                        size="small"
                        sx={{
                          bgcolor: `${STATUS_COLOR[lead.lead_status] ?? '#9ca3af'}22`,
                          color: STATUS_COLOR[lead.lead_status] ?? '#9ca3af',
                        }}
                      />
                      {lead.claude_recommendation_rank && lead.claude_recommendation_rank <= 5 && (
                        <Chip
                          icon={<AutoAwesomeOutlinedIcon />}
                          label={`#${lead.claude_recommendation_rank}`}
                          size="small"
                          sx={{ bgcolor: '#fbbf2422', color: '#fbbf24' }}
                          aria-label={`Claude prioritet ${lead.claude_recommendation_rank}`}
                        />
                      )}
                      {isOverdue && (
                        <Chip
                          icon={<EventBusyOutlinedIcon />}
                          label="Forfalt"
                          size="small"
                          sx={{ bgcolor: '#f8717122', color: '#f87171' }}
                        />
                      )}
                    </Stack>
                    {lead.lead_category && (
                      <Typography variant="caption" color="text.secondary">
                        {lead.lead_category}
                      </Typography>
                    )}
                    {lead.address && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {lead.address}{lead.city && `, ${lead.city}`}
                      </Typography>
                    )}
                    {lead.claude_recommendation_reason && (
                      <Typography variant="body2" sx={{
                        mt: 1, p: 1,
                        bgcolor: 'rgba(251,191,36,0.08)',
                        borderLeft: '3px solid #fbbf24',
                        fontStyle: 'italic',
                      }}>
                        {lead.claude_recommendation_reason}
                      </Typography>
                    )}
                    {(lead.next_follow_up_at || lead.last_contacted_at) && (
                      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                        {lead.next_follow_up_at && (
                          <Typography variant="caption" color={isOverdue ? '#f87171' : 'text.secondary'}>
                            Follow-up {formatRelative(lead.next_follow_up_at)}
                          </Typography>
                        )}
                        {lead.last_contacted_at && (
                          <Typography variant="caption" color="text.secondary">
                            Sist kontakt {formatRelative(lead.last_contacted_at)}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </Box>

                  {/* Distanse + handlinger */}
                  <Box minWidth={{ sm: 140 }} textAlign={{ xs: 'left', sm: 'right' }}>
                    {lead.distance_km !== null && (
                      <Box sx={{
                        mb: 1, p: 1,
                        bgcolor: 'rgba(192,132,252,0.10)',
                        borderRadius: 1,
                      }}>
                        <Typography variant="h6" sx={{ color: '#c084fc', lineHeight: 1 }}>
                          {lead.distance_km < 1
                            ? `${Math.round(lead.distance_km * 1000)} m`
                            : lead.distance_km < 10
                              ? `${lead.distance_km.toFixed(1).replace('.', ',')} km`
                              : `${Math.round(lead.distance_km)} km`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          unna
                        </Typography>
                      </Box>
                    )}
                    <Stack direction="row" spacing={0.5} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                      {navUrl && (
                        <Tooltip title="Naviger m/ Google Maps">
                          <IconButton size="small" component="a"
                            href={navUrl} target="_blank" rel="noopener noreferrer"
                            aria-label={`Naviger til ${lead.name}`}>
                            <NavigationOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {lead.phone && (
                        <Tooltip title={`Ring ${lead.phone}`}>
                          <IconButton size="small" component="a" href={`tel:${lead.phone}`}
                            aria-label={`Ring ${lead.name}`}>
                            <PhoneOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {lead.email && (
                        <Tooltip title={`E-post ${lead.email}`}>
                          <IconButton size="small" component="a" href={`mailto:${lead.email}`}
                            aria-label={`E-post ${lead.name}`}>
                            <EmailOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {lead.website_url && (
                        <Tooltip title="Åpne nettside">
                          <IconButton size="small" component="a"
                            href={lead.website_url} target="_blank" rel="noopener noreferrer"
                            aria-label={`Åpne nettside for ${lead.name}`}>
                            <LanguageOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {/* Refresh-knapp */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button onClick={load} disabled={loading}>
          {loading ? 'Oppdaterer…' : 'Oppdater liste'}
        </Button>
      </Box>
    </Box>
  );
}
