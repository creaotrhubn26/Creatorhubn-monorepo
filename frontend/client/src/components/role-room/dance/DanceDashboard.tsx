/**
 * DanceDashboard — første dans-vertikal-komponent (PR #3, MVP).
 *
 * Erstatter ikke noe eksisterende. Vises kun når professionMode er
 * 'dance_studio' eller 'dance_freelance'. Henter etiketter fra
 * branding-tokens som ble lagt til i PR #1.
 *
 * Data er dummy/demo for nå. Når intervju-runden bekrefter retning,
 * kobles widget'ene til faktiske backend-spørringer (eller — for
 * studio-MVP — til en lett ny tabell).
 *
 * Design-konvensjon: følger samme dark-theme + #8b5cf6-accent som
 * resten av Role Room (PMV / LiveSetMode), så studio-eier kjenner
 * igjen layout-en hvis de bytter mellom moder.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
  Button,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  TheaterComedy as TheaterIcon,
  AutoAwesome as AutoAwesomeIcon,
  Mic as AuditionIcon,
  PlaylistAddCheck as ListIcon,
  TrendingUp as TrendingIcon,
  Receipt as InvoiceIcon,
  WorkspacePremium as UnionIcon,
  PlayCircle as PlayIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import useBrandingSettings from '../hooks/useBrandingSettings';
import {
  getActiveProfessionMode,
  isDanceMode,
  type ProfessionMode,
} from '../config/professionMode';

// ─── Demo-data — erstattes med faktiske API-kall i Fase 4 ──────────────

interface UpcomingRehearsal {
  id: string;
  pieceTitle: string;
  date: string; // ISO
  durationMin: number;
  room: string;
  dancers: string[]; // initialer
}

interface UpcomingPerformance {
  id: string;
  title: string;
  date: string;
  venue: string;
  ticketsSold?: number;
  ticketsTotal?: number;
}

interface OpenAudition {
  id: string;
  title: string;
  deadline: string;
  organizer: string;
  applied: boolean;
}

const DEMO_REHEARSALS: UpcomingRehearsal[] = [
  { id: 'r1', pieceTitle: 'Stykke 3 · Arbeiderklassens siste vals', date: '2026-04-26T18:00:00+02:00', durationMin: 135, room: 'Sal B · Bårdar', dancers: ['IN', 'MA', 'SO', 'JK', 'LH'] },
  { id: 'r2', pieceTitle: 'Stykke 5 · Kollapsen',                  date: '2026-04-27T17:30:00+02:00', durationMin: 90,  room: 'Sal A · Bårdar', dancers: ['IN', 'MA'] },
  { id: 'r3', pieceTitle: 'Stykke 7 · Finale (full ensemble)',      date: '2026-04-29T19:00:00+02:00', durationMin: 180, room: 'Hovedsalen',     dancers: ['IN', 'MA', 'SO', 'JK', 'LH', '+1'] },
];

const DEMO_PERFORMANCES: UpcomingPerformance[] = [
  { id: 'p1', title: 'Premiere — "Arbeiderklassen"', date: '2026-05-22T20:00:00+02:00', venue: 'Dansens Hus, Oslo', ticketsSold: 187, ticketsTotal: 240 },
  { id: 'p2', title: 'CODA-festival · short program',  date: '2026-06-05T19:30:00+02:00', venue: 'Sentrum Scene' },
];

const DEMO_AUDITIONS: OpenAudition[] = [
  { id: 'a1', title: 'Carte Blanche høst-sesongen 2026', deadline: '2026-05-04', organizer: 'Carte Blanche',          applied: true  },
  { id: 'a2', title: 'Den Norske Opera — Pas de deux',   deadline: '2026-05-12', organizer: 'Nasjonalballetten',      applied: false },
  { id: 'a3', title: 'Skuda — Sommer-residens 2026',     deadline: '2026-05-18', organizer: 'Skuda',                  applied: false },
];

interface DemoMonthlyStats {
  earningsNok: number;
  earningsDeltaPct: number;
  hoursLogged: number;
  hoursDeltaPct: number;
  unsentInvoices: number;
}

const DEMO_STUDIO_STATS: DemoMonthlyStats = {
  earningsNok: 142_350,
  earningsDeltaPct: 8.2,
  hoursLogged: 187,
  hoursDeltaPct: -3.4,
  unsentInvoices: 4,
};

const DEMO_FREELANCE_STATS: DemoMonthlyStats = {
  earningsNok: 38_700,
  earningsDeltaPct: 12.5,
  hoursLogged: 64,
  hoursDeltaPct: 18.7,
  unsentInvoices: 2,
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('nb-NO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('nb-NO', {
      day: 'numeric',
      month: 'long',
    }).format(d);
  } catch {
    return iso;
  }
}

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((t - now) / 86_400_000));
}

const formatNok = (n: number): string =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n);

// ─── Komponent ────────────────────────────────────────────────────────────

export interface DanceDashboardProps {
  /** Override mode i stedet for å lese fra URL/storage. Brukes i tester og
   *  i Storybook-style preview hvis det legges til senere. */
  modeOverride?: ProfessionMode;
  /** F6-1: når satt, henter dashboardet ekte data fra services i stedet
   *  for demo-data. Null = freelancer-bruker uten prosjekt-scope. */
  projectId?: string | null;
}

export const DanceDashboard: React.FC<DanceDashboardProps> = ({ modeOverride, projectId }) => {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;
  const mode = modeOverride ?? getActiveProfessionMode();

  // F6-1: ekte data fra services. Holder demo-data som fallback hvis
  // listene er tomme (typisk i tester med sparse fixtures).
  const [liveData, setLiveData] = React.useState<{
    rehearsals: UpcomingRehearsal[];
    performances: UpcomingPerformance[];
    auditions: OpenAudition[];
    counts: { choreographies: number; formations: number; dancers: number; clips: number };
  } | null>(null);

  React.useEffect(() => {
    if (!isDanceMode(modeOverride ?? getActiveProfessionMode())) return;
    let cancelled = false;
    void (async () => {
      try {
        const [rehearsalsRaw, performancesRaw, choreos, formations, dancers, auditionsRaw] = await Promise.all([
          import('./danceRehearsalService').then((m) => m.listRehearsals({ projectId: projectId ?? undefined, limit: 10 })),
          import('./danceAdminOpsService').then((m) => m.listPerformances(projectId ?? null)),
          import('./choreographyService').then((m) => m.listChoreographies(projectId ?? undefined)),
          import('./danceFormationService').then((m) => m.listFormations(projectId ?? undefined)),
          import('./dancerProfileService').then((m) => m.listDancerProfiles(projectId ?? undefined)),
          import('./danceAdminOpsService').then((m) => m.listAuditions(projectId ?? null)),
        ]);
        if (cancelled) return;
        const now = Date.now();
        const upcoming: UpcomingRehearsal[] = rehearsalsRaw
          .filter((r) => new Date(r.scheduledAt).getTime() >= now - 86_400_000)
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
          .slice(0, 5)
          .map((r) => ({
            id: r.id,
            pieceTitle: r.title,
            date: r.scheduledAt,
            durationMin: r.estimatedMinutes,
            room: r.location ?? '—',
            dancers: r.invitedDancerIds.slice(0, 6),
          }));
        const upcomingPerf: UpcomingPerformance[] = performancesRaw
          .filter((p) => new Date(p.performanceDate ?? 0).getTime() >= now - 86_400_000)
          .sort((a, b) => new Date(a.performanceDate ?? 0).getTime() - new Date(b.performanceDate ?? 0).getTime())
          .slice(0, 5)
          .map((p) => ({
            id: p.id,
            title: p.title,
            date: p.performanceDate ?? new Date().toISOString(),
            venue: p.venue ?? '—',
            ticketsSold: p.ticketsSold ?? undefined,
            ticketsTotal: p.capacity ?? undefined,
          }));
        const upcomingAud: OpenAudition[] = auditionsRaw
          .filter((a) => a.deadline == null || new Date(a.deadline).getTime() >= now - 86_400_000)
          .sort((a, b) => new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime())
          .slice(0, 5)
          .map((a) => ({
            id: a.id,
            title: a.title,
            deadline: a.deadline ?? '',
            organizer: a.organizer,
            applied: a.applied,
          }));
        setLiveData({
          rehearsals: upcoming,
          performances: upcomingPerf,
          auditions: upcomingAud,
          counts: {
            choreographies: choreos.length,
            formations: formations.length,
            dancers: dancers.length,
            clips: 0, // VideoLibrary mounter sin egen list — vi viser ikke clips her
          },
        });
      } catch {
        // Ignorer feil — beholder fallback til demo-data.
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, modeOverride]);

  // Defensiv: hvis denne komponenten av en eller annen grunn rendres
  // utenfor en dans-mode, vis ingenting fremfor å forvirre brukeren.
  if (!isDanceMode(mode)) return null;

  const isStudio = mode === 'dance_studio';
  const stats = isStudio ? DEMO_STUDIO_STATS : DEMO_FREELANCE_STATS;
  // Bruk live rehearsals hvis de finnes (≥1), ellers fall tilbake til demo.
  const rehearsalsToShow = liveData && liveData.rehearsals.length > 0
    ? liveData.rehearsals
    : DEMO_REHEARSALS;
  const performancesToShow = liveData && liveData.performances.length > 0
    ? liveData.performances
    : DEMO_PERFORMANCES;
  const auditionsToShow = liveData && liveData.auditions.length > 0
    ? liveData.auditions
    : DEMO_AUDITIONS;
  const heading = isStudio
    ? labels.danceProfessionStudioName
    : labels.danceProfessionFreelanceName;

  return (
    <Box
      data-testid="dance-dashboard"
      data-mode={mode}
      sx={{
        p: { xs: 2, md: 3 },
        bgcolor: '#0a0a0a',
        color: '#e5e7eb',
        minHeight: '100%',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* ─── Header ─────────────────────────────────────────────── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
        spacing={1.5}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 10,
              letterSpacing: 2.5,
              color: '#a78bfa',
              fontWeight: 700,
              mb: 0.5,
            }}
          >
            {labels.danceTabDashboard.toUpperCase()} · {heading.toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
            God morgen{isStudio ? ', studio' : ''}.
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#9ca3af', mt: 0.5 }}>
            {rehearsalsToShow.length} {labels.danceTermRehearsalPlural.toLowerCase()} de neste 7 dagene · {performancesToShow.length} {labels.danceTermPerformancePlural.toLowerCase()} planlagt
            {liveData ? (
              <Box component="span" sx={{ color: '#a78bfa', ml: 1 }}>
                · {liveData.counts.choreographies} stykker · {liveData.counts.formations} formasjoner · {liveData.counts.dancers} dansere
              </Box>
            ) : null}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            size="small"
            sx={{ textTransform: 'none', color: '#c4b5fd', borderColor: 'rgba(139,92,246,0.4)' }}
            variant="outlined"
            data-testid="dance-dashboard-ai-summary"
          >
            AI-oppsummering av uka
          </Button>
        </Stack>
      </Stack>

      {/* ─── Stat-kort ──────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 3,
        }}
      >
        <StatCard
          icon={<TrendingIcon />}
          label={isStudio ? 'Inntekt denne måneden' : 'Honorar denne måneden'}
          value={formatNok(stats.earningsNok)}
          deltaPct={stats.earningsDeltaPct}
        />
        <StatCard
          icon={<CalendarIcon />}
          label={isStudio ? 'Undervisningstimer' : 'Arbeidstimer'}
          value={`${stats.hoursLogged} t`}
          deltaPct={stats.hoursDeltaPct}
          deltaLabel="vs forrige måned"
        />
        <StatCard
          icon={<InvoiceIcon />}
          label="Usendte fakturaer"
          value={String(stats.unsentInvoices)}
          accent={stats.unsentInvoices > 0 ? '#fbbf24' : '#34d399'}
        />
        <StatCard
          icon={<UnionIcon />}
          label={labels.danceUnionMembershipStatus}
          value={isStudio ? 'NoDa-arbeidsgiver' : 'Skuda-ansatt'}
          accent="#a78bfa"
        />
      </Box>

      {/* ─── Hovedinnhold: 2 kolonner ───────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 2,
        }}
      >
        {/* ─── Venstre: kommende øvinger + forestillinger ───── */}
        <Stack spacing={2}>
          <SectionCard
            title={`Kommende ${labels.danceTermRehearsalPlural.toLowerCase()}`}
            actionLabel="Se alle"
            actionTabId="rehearsal_log"
            testId="dashboard-section-rehearsals"
            icon={<ListIcon sx={{ fontSize: 18, color: '#a78bfa' }} />}
          >
            <Stack spacing={1}>
              {rehearsalsToShow.map((r) => (
                <Box
                  key={r.id}
                  data-testid={`dance-rehearsal-row-${r.id}`}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: '1px solid #1e2536',
                    bgcolor: 'rgba(139,92,246,0.04)',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                      {r.pieceTitle}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>
                      {formatDateTime(r.date)} · {r.durationMin} min · {r.room}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {r.dancers.slice(0, 4).map((d, idx) => (
                        <Avatar
                          key={d}
                          sx={{
                            width: 22,
                            height: 22,
                            fontSize: 9,
                            bgcolor: '#3b82f6',
                            border: '1px solid #1e2536',
                            ml: idx === 0 ? 0 : -0.75,
                          }}
                        >
                          {d}
                        </Avatar>
                      ))}
                      {r.dancers.length > 4 && (
                        <Avatar
                          sx={{
                            width: 22,
                            height: 22,
                            fontSize: 9,
                            bgcolor: '#374151',
                            border: '1px solid #1e2536',
                            ml: -0.75,
                          }}
                        >
                          +{r.dancers.length - 4}
                        </Avatar>
                      )}
                    </Box>
                    <ChevronRightIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </SectionCard>

          <SectionCard
            title={`Kommende ${labels.danceTermPerformancePlural.toLowerCase()}`}
            actionLabel="Se sesong"
            actionTabId="season"
            testId="dashboard-section-performances"
            icon={<TheaterIcon sx={{ fontSize: 18, color: '#fbbf24' }} />}
          >
            <Stack spacing={1.25}>
              {performancesToShow.map((p) => {
                const sold = p.ticketsSold ?? 0;
                const total = p.ticketsTotal ?? 0;
                const pct = total > 0 ? Math.round((sold / total) * 100) : null;
                return (
                  <Box
                    key={p.id}
                    data-testid={`dance-performance-row-${p.id}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      bgcolor: 'rgba(251, 191, 36, 0.04)',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fde68a' }}>
                          {p.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#9ca3af', mt: 0.25 }}>
                          {formatDateTime(p.date)} · {p.venue}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`om ${daysUntil(p.date)} dager`}
                        sx={{
                          height: 20,
                          fontSize: 10,
                          bgcolor: 'rgba(251,191,36,0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(251,191,36,0.4)',
                        }}
                      />
                    </Stack>
                    {pct !== null && (
                      <Box sx={{ mt: 1 }}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography sx={{ fontSize: 10, color: '#9ca3af' }}>
                            Billettsalg: {sold}/{total}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: '#fde68a', fontWeight: 600 }}>
                            {pct}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 5,
                            borderRadius: 3,
                            bgcolor: 'rgba(251,191,36,0.1)',
                            '& .MuiLinearProgress-bar': { bgcolor: '#fbbf24' },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </SectionCard>
        </Stack>

        {/* ─── Høyre: auditions + AI-handlinger ─────────────── */}
        <Stack spacing={2}>
          {!isStudio && (
            <SectionCard
              title="Åpne auditions"
              actionLabel="Se alle"
              actionTabId="reel"
              testId="dashboard-section-auditions"
              icon={<AuditionIcon sx={{ fontSize: 18, color: '#34d399' }} />}
            >
              <Stack spacing={1}>
                {auditionsToShow.map((a) => (
                  <Box
                    key={a.id}
                    data-testid={`dance-audition-row-${a.id}`}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1px solid #1e2536',
                      bgcolor: a.applied ? 'rgba(52,211,153,0.05)' : '#0f1318',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }} noWrap>
                          {a.title}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: '#9ca3af', mt: 0.25 }}>
                          {a.organizer} · søknadsfrist {formatDate(a.deadline)}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={a.applied ? 'Søkt' : 'Søk nå'}
                        sx={{
                          height: 20,
                          fontSize: 10,
                          bgcolor: a.applied ? 'rgba(52,211,153,0.18)' : 'rgba(139,92,246,0.18)',
                          color: a.applied ? '#34d399' : '#c4b5fd',
                          border: `1px solid ${a.applied ? 'rgba(52,211,153,0.4)' : 'rgba(139,92,246,0.4)'}`,
                        }}
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          {isStudio && (
            <SectionCard
              title={`Aktive ${labels.danceTermClassPlural.toLowerCase()}`}
              actionLabel={`Se ${labels.danceTermStudentPlural.toLowerCase()}`}
              actionTabId="students"
              testId="dashboard-section-classes"
              icon={<PlayIcon sx={{ fontSize: 18, color: '#34d399' }} />}
            >
              <Stack spacing={1}>
                {[
                  { id: 'c1', name: 'Klassisk ballett · barn 7-9', enrolled: 18, capacity: 20, weekday: 'Tirsdag' },
                  { id: 'c2', name: 'Samtidsdans · ungdom',          enrolled: 14, capacity: 16, weekday: 'Onsdag' },
                  { id: 'c3', name: 'Hip-hop · drop-in',             enrolled: 22, capacity: 30, weekday: 'Lørdag' },
                ].map((c) => (
                  <Box
                    key={c.id}
                    data-testid={`dance-class-row-${c.id}`}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1px solid #1e2536',
                      bgcolor: 'rgba(52,211,153,0.04)',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{c.name}</Typography>
                        <Typography sx={{ fontSize: 10, color: '#9ca3af' }}>
                          {c.weekday} · {c.enrolled}/{c.capacity} {labels.danceTermStudentPlural.toLowerCase()}
                        </Typography>
                      </Box>
                      <ChevronRightIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          <SectionCard
            title="CI · forslag denne uka"
            icon={<AutoAwesomeIcon sx={{ fontSize: 18, color: '#a78bfa' }} />}
            tinted
          >
            <Stack spacing={1}>
              <AiHint
                title="Stykke 3 trenger continuity-sjekk"
                body="To kjøringer ble logget uten at AI sammenlignet mot forrige. Kjør sjekken før neste øving."
              />
              <AiHint
                title={isStudio ? '4 fakturaer er klare for utsendelse' : '2 honorarkrav er klare for utsendelse'}
                body="Generer EHF-faktura med ett klikk når økonomi-flyten er aktivert."
              />
              {!isStudio && (
                <AiHint
                  title="Carte Blanche-audition: 8 dager igjen"
                  body="Du har en reel-klipp fra fjorårets samtidsdans-prosjekt som matcher beskrivelsen i utlysningen."
                />
              )}
            </Stack>
          </SectionCard>
        </Stack>
      </Box>

      {/* ─── Footer-notis ──────────────────────────────────── */}
      <Typography
        sx={{
          mt: 3,
          fontSize: 10,
          color: '#4b5563',
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        MVP — data er demo. Kobler til faktiske API-kall etter bruker-intervjuer (se docs/role-room/dans/).
      </Typography>
    </Box>
  );
};

// ─── Sub-komponenter ─────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  deltaPct?: number;
  deltaLabel?: string;
  accent?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, deltaPct, deltaLabel, accent = '#8b5cf6' }) => {
  const positive = deltaPct === undefined || deltaPct >= 0;
  return (
    <Card
      sx={{
        bgcolor: '#0f1318',
        border: '1px solid #1e2536',
        borderRadius: 2,
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
          <Box sx={{ color: accent, display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Typography sx={{ fontSize: 10, color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
            {label}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
          {value}
        </Typography>
        {deltaPct !== undefined && (
          <Typography
            sx={{
              fontSize: 10,
              mt: 0.25,
              color: positive ? '#34d399' : '#f87171',
              fontWeight: 600,
            }}
          >
            {positive ? '↑' : '↓'} {Math.abs(deltaPct)}% {deltaLabel ?? 'vs forrige måned'}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  /** F7+ : når satt, dispatches en CustomEvent som DanceWorkspace fanger
   *  og bytter til target-taben. */
  actionTabId?: string;
  tinted?: boolean;
  children: React.ReactNode;
  testId?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, icon, actionLabel, actionTabId, tinted, children, testId }) => (
  <Card
    data-testid={testId}
    sx={{
      bgcolor: tinted ? 'rgba(139,92,246,0.06)' : '#0f1318',
      border: `1px solid ${tinted ? 'rgba(139,92,246,0.25)' : '#1e2536'}`,
      borderRadius: 2,
      boxShadow: 'none',
    }}
  >
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb', letterSpacing: 0.3 }}>
            {title}
          </Typography>
        </Stack>
        {actionLabel && (
          <Button
            size="small"
            onClick={() => {
              if (!actionTabId) return;
              window.dispatchEvent(new CustomEvent('dance:set-tab', { detail: { tabId: actionTabId } }));
            }}
            data-testid={testId ? `${testId}-action` : undefined}
            sx={{ textTransform: 'none', fontSize: 11, color: '#a78bfa', minWidth: 0, p: 0.5 }}
          >
            {actionLabel}
          </Button>
        )}
      </Stack>
      {children}
    </CardContent>
  </Card>
);

const AiHint: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <Box
    sx={{
      p: 1.25,
      borderRadius: 1.5,
      border: '1px solid rgba(139,92,246,0.25)',
      bgcolor: 'rgba(139,92,246,0.06)',
    }}
  >
    <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>
      {title}
    </Typography>
    <Typography sx={{ fontSize: 11, color: '#cbd5e1', mt: 0.25, lineHeight: 1.4 }}>
      {body}
    </Typography>
  </Box>
);

export default DanceDashboard;
