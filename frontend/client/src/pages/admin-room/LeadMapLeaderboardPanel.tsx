/**
 * LeadMapLeaderboardPanel.tsx
 *
 * Team-leaderboard for Salgssjef/Teamleder/Admin (PR #619+).
 *
 * Viser rangering av salgs-konsulenter etter periode + valgfritt
 * team-filter. Top 3 fremhevet med medalje-farger. Hver rad har:
 *   - Avatar + navn + tittel + team
 *   - Kvote-progress-bar
 *   - Won-count, Møter, Close-rate
 *   - Active leads
 *
 * Topp-summary-kort viser org-totaler.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Badge, Box, Card, CardContent, Chip, CircularProgress,
  Grid, LinearProgress, MenuItem, Select, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup,
  Tooltip, Typography,
} from '@mui/material';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { usePermissions } from './usePermissions';
import LeadMapAutoAssignDialog from './LeadMapAutoAssignDialog';
import LeadMapQuotaDialog from './LeadMapQuotaDialog';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  title: string | null;
  role: string;
  salesTeamId: string | null;
  teamName: string | null;
  territory: string | null;
  targetNok: number;
  achievedNok: number;
  wonCount: number;
  lostCount: number;
  meetingsCount: number;
  leadsAssigned: number;
  leadsActive: number;
  progressPct: number | null;
  closeRate: number | null;
}

interface LeaderboardSummary {
  period: string;
  totalTargetNok: number;
  totalAchievedNok: number;
  progressPct: number | null;
  totalWon: number;
  totalLost: number;
  totalMeetings: number;
  activeSellers: number;
  closeRate: number | null;
}

interface TeamOption {
  id: string;
  name: string;
}

type Period = 'this_month' | 'last_30d' | 'ytd';
type SortBy = 'progress' | 'achieved' | 'won' | 'meetings';

function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rr_lead_map_active_org');
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

function formatNok(n: number): string {
  return n.toLocaleString('nb-NO') + ' kr';
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  salgssjef: 'Salgssjef',
  teamleder: 'Teamleder',
  salgskonsulent: 'Salgskonsulent',
  promotor: 'Promotør',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#c084fc',
  salgssjef: '#f97316',
  teamleder: '#fbbf24',
  salgskonsulent: '#34d399',
  promotor: '#60a5fa',
};

/** Medalje for top 3 — gull, sølv, bronse */
function medalForRank(rank: number): { color: string; label: string } | null {
  if (rank === 1) return { color: '#fbbf24', label: 'Gull' };
  if (rank === 2) return { color: '#cbd5e1', label: 'Sølv' };
  if (rank === 3) return { color: '#d97706', label: 'Bronse' };
  return null;
}

export default function LeadMapLeaderboardPanel() {
  const { role: myRole } = usePermissions();
  const [orgId, setOrgId] = useState<string | null>(getActiveOrgId());
  const [period, setPeriod] = useState<Period>('this_month');
  const [sortBy, setSortBy] = useState<SortBy>('progress');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [summary, setSummary] = useState<LeaderboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);

  const headers = useMemo<HeadersInit>(
    () => ({ Authorization: `Bearer ${getAuthToken()}` }),
    [],
  );

  // ─── Load org-id endring ────────────────────────────────────────
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rr_lead_map_active_org') setOrgId(getActiveOrgId());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ─── Load teams ─────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/admin-room/lead-map/organizations/${orgId}/teams`,
          { headers },
        );
        if (r.ok) {
          const j = await r.json();
          setTeams(j.teams ?? []);
        }
      } catch { /* noop */ }
    })();
  }, [orgId, headers]);

  // ─── Load leaderboard + summary ─────────────────────────────────
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ period, sort: sortBy });
      if (teamFilter) qs.set('team_id', teamFilter);
      const [lbRes, sumRes] = await Promise.all([
        fetch(`/api/admin-room/lead-map/organizations/${orgId}/leaderboard?${qs.toString()}`, { headers }),
        fetch(`/api/admin-room/lead-map/organizations/${orgId}/leaderboard-summary?period=${period}`, { headers }),
      ]);
      if (!lbRes.ok) {
        const j = await lbRes.json().catch(() => ({}));
        if (lbRes.status === 403) {
          throw new Error('Du har ikke tilgang til leaderboard. Kontakt admin/salgssjef.');
        }
        throw new Error(j.error ?? `HTTP ${lbRes.status}`);
      }
      const lbJson = await lbRes.json();
      setEntries(lbJson.leaderboard ?? []);
      if (sumRes.ok) {
        setSummary(await sumRes.json());
      }
    } catch (err) {
      setError(String(err));
    } finally { setLoading(false); }
  }, [orgId, period, sortBy, teamFilter, headers]);

  useEffect(() => { void load(); }, [load]);

  // ─── Tilgangs-sjekk ─────────────────────────────────────────────
  const hasAccess = myRole && ['admin', 'salgssjef', 'teamleder'].includes(myRole);

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Team-leaderboard er kun for admin, salgssjef og teamleder.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1 }} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
            Team-leaderboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rangering av salgs-konsulenter etter periode + valgfritt team-filter
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {myRole === 'admin' || myRole === 'salgssjef' ? (
            <Button
              variant="outlined"
              startIcon={<AutoFixHighOutlinedIcon />}
              onClick={() => setAutoAssignOpen(true)}
            >
              Auto-tildel
            </Button>
          ) : null}
          {(['admin', 'salgssjef', 'teamleder'] as string[]).includes(myRole ?? '') && (
            <Button
              variant="outlined"
              startIcon={<EmojiEventsOutlinedIcon />}
              onClick={() => setQuotaOpen(true)}
            >
              Sett kvoter
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ─── Filter-rad ──────────────────────────────────────────── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, val) => val && setPeriod(val)}
          size="small"
          aria-label="Periode"
        >
          <ToggleButton value="this_month">Denne mnd</ToggleButton>
          <ToggleButton value="last_30d">Siste 30 d</ToggleButton>
          <ToggleButton value="ytd">I år</ToggleButton>
        </ToggleButtonGroup>

        {teams.length > 0 && (
          <Select
            size="small"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            displayEmpty
            sx={{ minWidth: 200 }}
            inputProps={{ 'aria-label': 'Team-filter' }}
          >
            <MenuItem value="">Alle team</MenuItem>
            {teams.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
            ))}
          </Select>
        )}

        <Select
          size="small"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          sx={{ minWidth: 180 }}
          inputProps={{ 'aria-label': 'Sortér etter' }}
        >
          <MenuItem value="progress">Kvote-progresjon</MenuItem>
          <MenuItem value="achieved">Omsetning</MenuItem>
          <MenuItem value="won">Antall vunnet</MenuItem>
          <MenuItem value="meetings">Antall møter</MenuItem>
        </Select>
      </Stack>

      {/* ─── Summary-kort ────────────────────────────────────────── */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <SummaryTile
              icon={<TrendingUpIcon sx={{ color: '#c084fc' }} />}
              label="Omsetning"
              value={formatNok(summary.totalAchievedNok)}
              sub={summary.totalTargetNok > 0
                ? `av ${formatNok(summary.totalTargetNok)} mål`
                : undefined}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <SummaryTile
              icon={<EmojiEventsOutlinedIcon sx={{ color: '#f97316' }} />}
              label="Vunnet"
              value={`${summary.totalWon}`}
              sub={summary.closeRate !== null ? `${summary.closeRate}% close-rate` : undefined}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <SummaryTile
              icon={<GroupsOutlinedIcon sx={{ color: '#34d399' }} />}
              label="Møter"
              value={`${summary.totalMeetings}`}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <SummaryTile
              icon={<WorkspacePremiumIcon sx={{ color: '#fbbf24' }} />}
              label="Aktive selgere"
              value={`${summary.activeSellers}`}
              sub={summary.progressPct !== null ? `${summary.progressPct}% snitt` : undefined}
            />
          </Grid>
        </Grid>
      )}

      {/* ─── Tabell ─────────────────────────────────────────────── */}
      <Card>
        <CardContent>
          {loading && entries.length === 0 ? (
            <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>
          ) : entries.length === 0 ? (
            <Alert severity="info">
              Ingen salgs-konsulenter funnet i denne org-en/teamet.
            </Alert>
          ) : (
            <Table size="small" aria-label="Team-leaderboard">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 60 }}>#</TableCell>
                  <TableCell>Selger</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>Kvote-progresjon</TableCell>
                  <TableCell align="right">Vunnet</TableCell>
                  <TableCell align="right">Møter</TableCell>
                  <TableCell align="right">Aktive leads</TableCell>
                  <TableCell align="right">Close-rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => {
                  const medal = medalForRank(entry.rank);
                  return (
                    <TableRow key={entry.userId} hover>
                      <TableCell>
                        {medal ? (
                          <Tooltip title={medal.label}>
                            <MilitaryTechIcon sx={{ color: medal.color, fontSize: 28 }} />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {entry.rank}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            src={entry.avatarUrl ?? undefined}
                            sx={{
                              width: 36, height: 36,
                              border: medal ? `2px solid ${medal.color}` : undefined,
                            }}
                          >
                            {(entry.displayName ?? entry.email ?? '?')[0]}
                          </Avatar>
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {entry.displayName ?? entry.email}
                              </Typography>
                              <Chip
                                label={ROLE_LABEL[entry.role] ?? entry.role}
                                size="small"
                                sx={{
                                  height: 18, fontSize: '0.65rem',
                                  bgcolor: `${ROLE_COLOR[entry.role] ?? '#a78bfa'}22`,
                                  color: ROLE_COLOR[entry.role] ?? '#a78bfa',
                                }}
                              />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {entry.title ?? '—'}
                              {entry.teamName && ` · ${entry.teamName}`}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {formatNok(entry.achievedNok)}
                            </Typography>
                            {entry.progressPct !== null && (
                              <Typography variant="caption" color="text.secondary">
                                {entry.progressPct}%
                              </Typography>
                            )}
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, entry.progressPct ?? 0)}
                            sx={{
                              height: 6, borderRadius: 3,
                              bgcolor: 'rgba(192,132,252,0.15)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: (entry.progressPct ?? 0) >= 100
                                  ? '#34d399'
                                  : (entry.progressPct ?? 0) >= 70
                                    ? '#c084fc'
                                    : '#fbbf24',
                              },
                            }}
                            aria-label={`${entry.displayName ?? ''} kvote ${entry.progressPct ?? 0}%`}
                          />
                          {entry.targetNok > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                              Mål {formatNok(entry.targetNok)}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.wonCount}
                        </Typography>
                        {entry.lostCount > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            / {entry.lostCount} tapt
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">{entry.meetingsCount}</TableCell>
                      <TableCell align="right">
                        <Badge badgeContent={entry.leadsActive} color="primary" max={999}>
                          <Box sx={{ width: 24 }} />
                        </Badge>
                      </TableCell>
                      <TableCell align="right">
                        {entry.closeRate !== null ? (
                          <Chip
                            label={`${entry.closeRate}%`}
                            size="small"
                            sx={{
                              bgcolor: entry.closeRate >= 50
                                ? '#34d39922' : entry.closeRate >= 25
                                  ? '#fbbf2422' : '#f8717122',
                              color: entry.closeRate >= 50
                                ? '#34d399' : entry.closeRate >= 25
                                  ? '#fbbf24' : '#f87171',
                            }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LeadMapAutoAssignDialog
        open={autoAssignOpen}
        organizationId={orgId}
        onClose={() => setAutoAssignOpen(false)}
        onAssigned={() => { void load(); }}
      />
      <LeadMapQuotaDialog
        open={quotaOpen}
        organizationId={orgId}
        onClose={() => setQuotaOpen(false)}
        onSaved={() => { void load(); }}
      />
    </Box>
  );
}

function SummaryTile({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {icon}
          <Box>
            <Typography variant="overline" color="text.secondary">{label}</Typography>
            <Typography variant="h6">{value}</Typography>
            {sub && (
              <Typography variant="caption" color="text.secondary">{sub}</Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
