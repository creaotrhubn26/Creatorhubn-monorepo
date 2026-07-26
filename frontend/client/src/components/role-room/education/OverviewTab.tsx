/**
 * OverviewTab.tsx — faglærer-forsiden (redesign).
 *
 * Aggregert dashbord: KPI-kort, kull-fremdrift (donut), kommende aktiviteter,
 * nylige oppgaver, aktivitetsfeed og hurtighandlinger. Kortene er klikkbare og
 * ruter til riktig fane. Ekte tall fra /education/overview; seksjoner uten data
 * enda viser tomtilstander (workspacet er ferskt til kull/oppgaver opprettes).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Card, CardActionArea, Chip, Button, Divider,
  CircularProgress, Alert, IconButton,
} from '@mui/material';
import {
  Schedule as DueIcon, Grading as ReviewIcon, ErrorOutline as MissingIcon,
  MovieCreation as ProductionIcon, Groups as CohortIcon, Add as AddIcon,
  Assignment as AssignmentIcon, CalendarMonth as CalendarIcon,
  ChevronRight as ChevronIcon, PersonAdd as InviteIcon, MenuBook as LibraryIcon,
  HelpOutline as HelpIcon, AutoAwesome as SparkleIcon, Close as CloseIcon,
  Circle as DotIcon,
} from '@mui/icons-material';
import { educationOverviewService, type OverviewData } from './educationOverviewService';

const ACCENT = '#8B5CF6';
const CARD_BG = 'rgba(255,255,255,0.035)';
const CARD_BORDER = '1px solid rgba(255,255,255,0.08)';

type TabId = 'overview' | 'cohorts' | 'productions' | 'assignments' | 'fagstoff' | 'assessment' | 'portfolio' | 'faculty';

interface ActivityItem { id: string; title: string; source: string; when: string; icon: React.ReactNode; }

// Onboarding-/system-feed vises til ekte aktivitet finnes (matcher fersk workspace).
const WELCOME_FEED: ActivityItem[] = [
  { id: 'w1', title: 'Velkommen til The Role Room!', source: 'System', when: '2 u siden', icon: <SparkleIcon sx={{ fontSize: 16 }} /> },
  { id: 'w2', title: 'Kom i gang med workspace', source: 'System', when: '2 u siden', icon: <CohortIcon sx={{ fontSize: 16 }} /> },
  { id: 'w3', title: 'Tips: Opprett ditt første kull', source: 'System', when: '2 u siden', icon: <AssignmentIcon sx={{ fontSize: 16 }} /> },
  { id: 'w4', title: 'Tips: Lag din første oppgave', source: 'System', when: '2 u siden', icon: <AssignmentIcon sx={{ fontSize: 16 }} /> },
];

function Panel({ title, action, children, sx }: { title: string; action?: React.ReactNode; children: React.ReactNode; sx?: object }) {
  return (
    <Card sx={{ bgcolor: CARD_BG, border: CARD_BORDER, borderRadius: 3, p: 2.5, display: 'flex', flexDirection: 'column', ...sx }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Card>
  );
}

function SeeAllLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button onClick={onClick} endIcon={<ChevronIcon sx={{ fontSize: '16px !important' }} />}
      sx={{ color: ACCENT, textTransform: 'none', fontSize: 12.5, fontWeight: 600, p: 0.5, minWidth: 0, '&:hover': { bgcolor: 'transparent', color: '#a78bfa' } }}>
      {label}
    </Button>
  );
}

function EmptyBlock({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ flex: 1, textAlign: 'center', py: 3, minHeight: 150 }}>
      <Box sx={{ color: 'rgba(167,139,250,0.55)', '& svg': { fontSize: 40 } }}>{icon}</Box>
      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', maxWidth: 260 }}>{subtitle}</Typography>
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Stack>
  );
}

/** SVG-donut for studentfremdrift. Tom → grå ring med «—%». */
function ProgressDonut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const size = 132, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  const done = total > 0 ? Math.round(((segments.find((s) => s.label === 'Vurdert')?.value ?? 0) / total) * 100) : null;
  return (
    <Stack direction="row" spacing={2.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          {total > 0 && segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
                strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += len;
            return el;
          })}
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{done === null ? '—' : `${done}%`}</Typography>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>Gjennomføring</Typography>
        </Box>
      </Box>
      <Stack spacing={0.75} sx={{ flex: 1, minWidth: 130 }}>
        {segments.map((s) => (
          <Stack key={s.label} direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <DotIcon sx={{ fontSize: 10, color: s.color }} />
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>{s.label}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{total > 0 ? s.value : '—'}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export function OverviewTab({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipDismissed, setTipDismissed] = useState(false);

  useEffect(() => {
    void educationOverviewService.getOverview()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kunne ikke hente oversikt'))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;
  const kpis = useMemo(() => [
    { id: 'frister', label: 'Frister denne uken', value: stats?.dueThisWeek ?? 0, icon: <DueIcon />, color: ACCENT, tab: 'assignments' as TabId,
      hint: (stats?.dueThisWeek ?? 0) === 0 ? 'Ingen frister de neste 7 dagene' : 'Neste 7 dager' },
    { id: 'vurdering', label: 'Til vurdering', value: stats?.toReview ?? 0, icon: <ReviewIcon />, color: '#10b981', tab: 'assessment' as TabId,
      hint: (stats?.toReview ?? 0) === 0 ? 'Ingen innleveringer venter' : 'Innleveringer venter' },
    { id: 'mangler', label: 'Manglende innleveringer', value: stats?.missingSubmissions ?? 0, icon: <MissingIcon />, color: (stats?.missingSubmissions ?? 0) > 0 ? '#f59e0b' : ACCENT, tab: 'assessment' as TabId,
      hint: (stats?.missingSubmissions ?? 0) === 0 ? 'Alt er levert – flott jobb!' : 'Følg opp studentene' },
    { id: 'produksjoner', label: 'Aktive produksjoner', value: stats?.productions ?? 0, icon: <ProductionIcon />, color: ACCENT, tab: 'productions' as TabId,
      hint: (stats?.productions ?? 0) === 0 ? 'Ingen aktive produksjoner' : 'I gang nå' },
  ], [stats]);

  const donutSegments = [
    { label: 'Ikke startet', value: 0, color: 'rgba(255,255,255,0.4)' },
    { label: 'Påbegynt', value: 0, color: '#f59e0b' },
    { label: 'Levert', value: data?.reviewQueue.length ?? 0, color: '#38bdf8' },
    { label: 'Vurdert', value: 0, color: '#10b981' },
  ];
  const donutTotal = donutSegments.reduce((a, s) => a + s.value, 0);

  const quickActions = [
    { label: 'Inviter studenter', sub: 'Send invitasjoner til studenter', icon: <InviteIcon />, onClick: () => onNavigate('cohorts') },
    { label: 'Lag ny oppgave', sub: 'Opprett en oppgave for studentene', icon: <AssignmentIcon />, onClick: () => onNavigate('assignments') },
    { label: 'Del fagstoff', sub: 'Last opp og del ressurser', icon: <LibraryIcon />, onClick: () => onNavigate('fagstoff') },
    { label: 'Start produksjon', sub: 'Opprett en ny produksjon', icon: <ProductionIcon />, onClick: () => onNavigate('productions') },
    { label: 'Trenger du hjelp?', sub: 'Besøk hjelpesenteret vårt', icon: <HelpIcon />, onClick: () => onNavigate('fagstoff') },
  ];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;

  return (
    <Box sx={{ display: 'grid', gap: 2.5, maxWidth: 1320 }}>
      {/* Header + primærhandlinger */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography data-edit-id="edu-ov-title" variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Utdannings-workspace</Typography>
            <Chip data-edit-id="edu-ov-rolechip" label="Faglærer" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.22)', color: '#e9d5ff', fontWeight: 700 }} />
          </Stack>
          <Typography data-edit-id="edu-ov-subtitle" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, mt: 0.5 }}>
            Undervisning, studentproduksjoner og samarbeid med eksterne oppdragsgivere — i én flate.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <Button variant="contained" startIcon={<CohortIcon />} onClick={() => onNavigate('cohorts')}
            sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 2 }}>
            Opprett kull
          </Button>
          <Button variant="outlined" startIcon={<AssignmentIcon />} onClick={() => onNavigate('assignments')}
            sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2, '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' } }}>
            Ny oppgave
          </Button>
          <Button variant="outlined" startIcon={<ProductionIcon />} onClick={() => onNavigate('productions')}
            sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2, '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' } }}>
            Start produksjon
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Første-gangs-hero (kinematisk backdrop) når workspacet er helt tomt */}
      {firstRun && (
        <Box sx={{
          position: 'relative', overflow: 'hidden', borderRadius: 3, minHeight: 210, display: 'flex', alignItems: 'center',
          border: '1px solid rgba(139,92,246,0.28)',
          backgroundImage: 'linear-gradient(90deg, rgba(9,7,14,0.94) 0%, rgba(9,7,14,0.62) 46%, rgba(9,7,14,0.12) 100%), url(/trr-edu-hero-bg.png)',
          backgroundSize: 'cover', backgroundPosition: 'center right',
        }}>
          <Box sx={{ p: { xs: 3, md: 4 }, maxWidth: 620 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', letterSpacing: 0.6, textTransform: 'uppercase', mb: 1 }}>Kom i gang</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Velkommen til utdannings-workspacet</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 14.5, mb: 2.5, maxWidth: 520 }}>
              Opprett ditt første kull, legg inn studentene og start en produksjon. Undervisning, oppgaver og vurdering samles her — koblet rett til skolens LMS.
            </Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button variant="contained" startIcon={<CohortIcon />} onClick={() => onNavigate('cohorts')}
                sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                Opprett ditt første kull
              </Button>
              <Button variant="outlined" startIcon={<AssignmentIcon />} onClick={() => onNavigate('assignments')}
                sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: 2, '&:hover': { borderColor: 'rgba(255,255,255,0.35)' } }}>
                Lag en oppgave
              </Button>
            </Stack>
          </Box>
        </Box>
      )}

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        {kpis.map((k) => (
          <Card key={k.label} sx={{ bgcolor: CARD_BG, border: CARD_BORDER, borderRadius: 3 }}>
            <CardActionArea onClick={() => onNavigate(k.tab)} sx={{ p: 2.25, borderRadius: 3 }}>
              <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${k.color}22`, color: k.color, flexShrink: 0, '& svg': { fontSize: 22 } }}>{k.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{k.value}</Typography>
                  <Typography data-edit-id={`edu-ov-kpi-${k.id}-label`} sx={{ fontSize: 13.5, fontWeight: 600, mt: 0.5 }}>{k.label}</Typography>
                  <Typography data-edit-id={`edu-ov-kpi-${k.id}-hint`} sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.25 }}>{k.hint}</Typography>
                </Box>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      {/* Rad: Kull & fremdrift (bred) + Kommende aktiviteter */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <Panel title="Kull & fremdrift" action={<SeeAllLink label="Se alle kull" onClick={() => onNavigate('cohorts')} />}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, alignItems: 'center' }}>
            <EmptyBlock icon={<CohortIcon />} title="Ingen kull ennå" subtitle="Opprett ditt første kull for å komme i gang."
              action={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onNavigate('cohorts')}
                sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', borderRadius: 2 }}>Opprett ditt første kull</Button>} />
            <Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>Studentfremdrift (alle kull)</Typography>
              <ProgressDonut segments={donutSegments} total={donutTotal} />
            </Box>
          </Box>
        </Panel>

        <Panel title="Kommende aktiviteter" action={<SeeAllLink label="Se kalender" onClick={() => onNavigate('assignments')} />}>
          <EmptyBlock icon={<CalendarIcon />} title="Ingen kommende aktiviteter" subtitle="Du er helt oppdatert!" />
        </Panel>
      </Box>

      {/* Rad: Nylige oppgaver + Nylig aktivitet + Hurtighandlinger */}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        <Panel title="Nylige oppgaver" action={<SeeAllLink label="Se alle oppgaver" onClick={() => onNavigate('assignments')} />}>
          <EmptyBlock icon={<AssignmentIcon />} title="Ingen oppgaver ennå" subtitle="Opprett en oppgave for å gi studentene noe å jobbe med."
            action={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onNavigate('assignments')}
              sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', borderRadius: 2 }}>Opprett ny oppgave</Button>} />
        </Panel>

        <Panel title="Nylig aktivitet" action={<SeeAllLink label="Se all aktivitet" onClick={() => onNavigate('assessment')} />}>
          <Stack divider={<Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />}>
            {WELCOME_FEED.map((a) => (
              <Stack key={a.id} direction="row" alignItems="center" spacing={1.25} sx={{ py: 1.1 }}>
                <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', flexShrink: 0 }}>{a.icon}</Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{a.source}</Typography>
                </Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>{a.when}</Typography>
              </Stack>
            ))}
          </Stack>
        </Panel>

        <Panel title="Hurtighandlinger">
          <Stack spacing={1}>
            {quickActions.map((q) => (
              <Card key={q.label} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: CARD_BORDER, borderRadius: 2 }}>
                <CardActionArea onClick={q.onClick} sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1.25}>
                    <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(139,92,246,0.16)', color: '#c4b5fd', flexShrink: 0, '& svg': { fontSize: 18 } }}>{q.icon}</Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{q.label}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.sub}</Typography>
                    </Box>
                    <ChevronIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }} />
                  </Stack>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </Panel>
      </Box>

      {/* Tips-banner */}
      {!tipDismissed && (
        <Card sx={{ bgcolor: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3, p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(139,92,246,0.25)', color: '#e9d5ff', flexShrink: 0 }}><SparkleIcon /></Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Tips: Opprett et kull</Typography>
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)' }}>Organiser studentene dine i kull for enklere samarbeid og oppfølging.</Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => onNavigate('cohorts')}
              sx={{ borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>Kom i gang</Button>
            <IconButton size="small" onClick={() => setTipDismissed(true)} sx={{ color: 'rgba(255,255,255,0.4)' }}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
        </Card>
      )}
    </Box>
  );
}

export default OverviewTab;
