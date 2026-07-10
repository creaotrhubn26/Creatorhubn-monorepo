/**
 * leadgrid-losninger.tsx — dedikert løsninger-side for Leadgrid
 *
 * Viser Leadgrid segmentert etter bruksområde (matcher footer-kolonnen
 * "Løsninger" på landingssiden): Salgsteam, Markedsføring, Franchise,
 * Eiendomsmegling. Hvert segment har egen anker-id slik at footer- og
 * landingsside-lenker kan peke direkte til riktig seksjon.
 *
 * Funksjonene som listes per segment er hentet fra de reelle tier-
 * features i leadgrid-pricing.tsx (Lead Map, Territory-grids, Route
 * Planner, Voice Memo, AI Meeting Notes, Forecasting osv.) — ingen
 * påfunne funksjonalitet.
 *
 * Visuelt språk: samme warm-dark + lilla accent som leadgrid-landing.tsx
 * (PALETTE), MUI for konsistens med resten av Leadgrid-flaten. Ingen
 * header/footer-gjenbruk — samme selvstendige mønster som
 * leadgrid-pricing.tsx og leadgrid-connectors.tsx.
 */

import { useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';
import { trackEvent, trackPageView } from '@/utils/ga4-client-tracking';
import {
  Box, Container, Typography, Button, Grid, Stack, Chip,
} from '@mui/material';
import {
  BusinessCenterOutlined,
  CampaignOutlined,
  StorefrontOutlined,
  HomeWorkOutlined,
  MapOutlined,
  ViewKanbanOutlined,
  AutoFixHighOutlined,
  InsightsOutlined,
  GroupsOutlined,
  RouteOutlined,
  MicOutlined,
  DescriptionOutlined,
  FilterAltOutlined,
  HubOutlined,
  AutoGraphOutlined,
  ArrowForwardOutlined,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

// ─── PALETTE (matcher leadgrid-landing.tsx / leadgrid-pricing.tsx) ─────
const PALETTE = {
  bg: '#0b0518',
  bgAlt: '#13082b',
  card: 'rgba(167, 139, 250, 0.06)',
  cardBorder: 'rgba(167, 139, 250, 0.18)',
  cardHi: 'rgba(167, 139, 250, 0.12)',
  accent: '#A78BFA',
  accentBright: '#C084FC',
  text: '#F4F0FF',
  textMuted: 'rgba(244, 240, 255, 0.72)',
  textFaint: 'rgba(244, 240, 255, 0.45)',
};

// ─── SEO helpers (samme mønster som leadgrid-landing.tsx) ──────────────
function setMetaTagByAttr(
  tagName: 'meta' | 'link',
  attrName: 'property' | 'name' | 'rel',
  attrValue: string,
  setAttrs: Record<string, string>,
) {
  let el = document.querySelector(`${tagName}[${attrName}="${attrValue}"]`) as HTMLElement | null;
  if (!el) {
    el = document.createElement(tagName);
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  Object.entries(setAttrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

// ─── Segment-data ───────────────────────────────────────────────────
type MockKind = 'kanban' | 'analytics' | 'territory' | 'route';

interface Segment {
  id: string;
  Icon: SvgIconComponent;
  accent: string;
  label: string;
  headline: string;
  pain: string;
  mock: MockKind;
  features: { Icon: SvgIconComponent; label: string }[];
}

const SEGMENTS: Segment[] = [
  {
    id: 'salgsteam',
    Icon: BusinessCenterOutlined,
    accent: '#A78BFA',
    label: 'Salgsteam',
    headline: 'Selg mer, let mindre.',
    pain: 'Selgerne dine bruker mer tid på å lete etter leads i regneark enn på å faktisk selge.',
    mock: 'kanban',
    features: [
      { Icon: MapOutlined, label: 'Kartbasert leadoversikt — se alle muligheter i ett blikk' },
      { Icon: ViewKanbanOutlined, label: 'Drag-and-drop pipeline med automatiske påminnelser' },
      { Icon: AutoFixHighOutlined, label: 'AI-pitch og oppfølging som faktisk får svar' },
      { Icon: AutoGraphOutlined, label: 'Forecasting og provisjonsoversikt per selger' },
    ],
  },
  {
    id: 'markedsforing',
    Icon: CampaignOutlined,
    accent: '#7ab8ff',
    label: 'Markedsføring',
    headline: 'Fra kampanje til kunde — uten at leads blir liggende.',
    pain: 'Kampanjene genererer leads, men oppfølgingen stopper opp fordi ingen eier prosessen videre.',
    mock: 'analytics',
    features: [
      { Icon: FilterAltOutlined, label: 'Smart segmentering på bransje, størrelse og signaler' },
      { Icon: HubOutlined, label: 'Automatiserte e-post- og SMS-workflows' },
      { Icon: InsightsOutlined, label: 'Analytics-dashboard som viser hva som faktisk konverterer' },
      { Icon: GroupsOutlined, label: 'Webhooks som kobler kampanjeverktøy og CRM sammen' },
    ],
  },
  {
    id: 'franchise',
    Icon: StorefrontOutlined,
    accent: '#ffb86b',
    label: 'Franchise',
    headline: 'Full oversikt — på tvers av alle lokasjoner.',
    pain: 'Flere avdelinger jobber i samme område uten å vite det, og ledelsen mangler samlet rapportering.',
    mock: 'territory',
    features: [
      { Icon: MapOutlined, label: 'Territory-grid med geofence per lokasjon' },
      { Icon: GroupsOutlined, label: 'Multi-bruker og team-roller for hver avdeling' },
      { Icon: InsightsOutlined, label: 'Sentralisert rapportering på tvers av alle team' },
      { Icon: AutoGraphOutlined, label: 'Team-assign og prestasjonssporing i sanntid' },
    ],
  },
  {
    id: 'eiendomsmegling',
    Icon: HomeWorkOutlined,
    accent: '#f472b6',
    label: 'Eiendomsmegling',
    headline: 'Boliger, befaringer og kontakter — samlet på kartet.',
    pain: 'Kontakter, notater fra befaring og oppfølging havner spredt i e-post, SMS og huskelapper.',
    mock: 'route',
    features: [
      { Icon: MapOutlined, label: 'Kartbasert oversikt over objekter og potensielle selgere' },
      { Icon: RouteOutlined, label: 'Ruteplanlegger som fyller opp dagens visningsrunde' },
      { Icon: MicOutlined, label: 'Voice memo rett fra befaring — transkribert automatisk' },
      { Icon: DescriptionOutlined, label: 'AI-møtenotater som fanger opp neste steg' },
    ],
  },
];

// ────────────────────────────────────────────────────────────

export default function LeadgridLosningerPage() {
  useEffect(() => {
    trackPageView('/leadgrid/losninger', 'Leadgrid Løsninger — Salgsteam, Markedsføring, Franchise, Eiendomsmegling');
    trackEvent('leadgrid_solutions_view', {
      referrer: document.referrer || 'direct',
      utm_source: new URLSearchParams(window.location.search).get('utm_source') ?? null,
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') ?? null,
    });
    document.title = 'Leadgrid Løsninger — bygget for hvordan teamet ditt jobber';
    const desc = document.querySelector('meta[name="description"]');
    const content = 'Leadgrid tilpasset salgsteam, markedsføring, franchise og eiendomsmegling. Se hvilke funksjoner som løser akkurat dine utfordringer.';
    if (desc) desc.setAttribute('content', content);
    else {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = content;
      document.head.appendChild(m);
    }
    setMetaTagByAttr('link', 'rel', 'canonical', { href: 'https://theroleroom.com/leadgrid/losninger' });
    setMetaTagByAttr('meta', 'property', 'og:title', { content: 'Leadgrid Løsninger — bygget for hvordan teamet ditt jobber' });
    setMetaTagByAttr('meta', 'property', 'og:description', { content });
    setMetaTagByAttr('meta', 'property', 'og:type', { content: 'website' });
    setMetaTagByAttr('meta', 'property', 'og:url', { content: 'https://theroleroom.com/leadgrid/losninger' });
    setMetaTagByAttr('meta', 'property', 'og:image', { content: 'https://theroleroom.com/leadgrid/og-image.png' });
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: PALETTE.bg, color: PALETTE.text }}>
      {/* ─── Hero ─── */}
      <Box
        sx={{
          background: `radial-gradient(1200px 600px at 50% -100px, ${PALETTE.cardHi}, transparent), ${PALETTE.bg}`,
          py: { xs: 8, md: 12 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Chip
            label="Løsninger"
            sx={{
              bgcolor: PALETTE.cardHi,
              color: PALETTE.accentBright,
              border: `1px solid ${PALETTE.cardBorder}`,
              mb: 4,
              fontWeight: 600,
            }}
          />
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', md: '3.75rem' },
              fontWeight: 700,
              mb: 2,
              background: `linear-gradient(90deg, ${PALETTE.accentBright}, #F472B6)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            }}
          >
            Bygget for hvordan teamet ditt jobber
          </Typography>
          <Typography sx={{ fontSize: '1.25rem', color: PALETTE.textMuted, mb: 5, maxWidth: 640, mx: 'auto' }}>
            Samme kartbaserte kjerne — tilpasset utfordringene til akkurat din bransje.
          </Typography>

          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
            {SEGMENTS.map((s) => (
              <Chip
                key={s.id}
                component="a"
                href={`#${s.id}`}
                clickable
                icon={<s.Icon sx={{ color: `${s.accent} !important`, fontSize: 18 }} />}
                label={s.label}
                sx={{
                  bgcolor: PALETTE.card,
                  color: PALETTE.text,
                  border: `1px solid ${PALETTE.cardBorder}`,
                  fontWeight: 500,
                  '&:hover': { borderColor: s.accent, bgcolor: `${s.accent}1a` },
                }}
              />
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ─── Segmenter ─── */}
      {SEGMENTS.map((segment, i) => (
        <SegmentSection key={segment.id} segment={segment} reverse={i % 2 === 1} alt={i % 2 === 1} />
      ))}

      {/* ─── Final CTA ─── */}
      <Box
        sx={{
          py: { xs: 10, md: 14 },
          background: `linear-gradient(135deg, ${PALETTE.accent}, #EC4899)`,
          color: '#FFF',
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h2" sx={{ fontSize: { xs: '2.25rem', md: '3rem' }, fontWeight: 700, mb: 2 }}>
            Klar for å se det i praksis?
          </Typography>
          <Typography sx={{ fontSize: '1.25rem', opacity: 0.92, mb: 5 }}>
            Gratis å starte. Ingen kortkrav. Sett opp på under 2 minutter.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Link href="/leadgrid?signup=solo_free">
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardOutlined />}
                onClick={() => trackEvent('leadgrid_solutions_final_cta', { cta: 'start_free' })}
                sx={{
                  bgcolor: '#FFF',
                  color: PALETTE.accent,
                  fontWeight: 700,
                  px: 5,
                  py: 1.75,
                  borderRadius: 999,
                  fontSize: '1.05rem',
                  textTransform: 'none',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
                  '&:hover': { bgcolor: '#F8F4FF', transform: 'translateY(-2px)' },
                  transition: 'all 0.2s',
                }}
              >
                Start gratis
              </Button>
            </Link>
            <Link href="/leadgrid/pricing">
              <Button
                variant="outlined"
                size="large"
                onClick={() => trackEvent('leadgrid_solutions_final_cta', { cta: 'see_pricing' })}
                sx={{
                  borderColor: 'rgba(255,255,255,0.6)',
                  color: '#FFF',
                  fontWeight: 700,
                  px: 5,
                  py: 1.75,
                  borderRadius: 999,
                  fontSize: '1.05rem',
                  textTransform: 'none',
                  '&:hover': { borderColor: '#FFF', bgcolor: 'rgba(255,255,255,0.08)' },
                }}
              >
                Se priser
              </Button>
            </Link>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}

// ─── SegmentSection ─────────────────────────────────────────────────
function SegmentSection({ segment, reverse, alt }: { segment: Segment; reverse: boolean; alt: boolean }) {
  const { Icon, accent, label, headline, pain, features } = segment;
  return (
    <Box id={segment.id} sx={{ py: { xs: 8, md: 12 }, bgcolor: alt ? PALETTE.bgAlt : PALETTE.bg, scrollMarginTop: '24px' }}>
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center" direction={reverse ? 'row-reverse' : 'row'}>
          <Grid item xs={12} md={6}>
            <Chip
              icon={<Icon sx={{ color: `${accent} !important` }} />}
              label={label}
              sx={{
                bgcolor: `${accent}1f`,
                color: accent,
                border: `1px solid ${accent}40`,
                fontWeight: 600,
                mb: 3,
              }}
            />
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 28, md: 36 }, mb: 2, color: PALETTE.text, lineHeight: 1.15 }}>
              {headline}
            </Typography>
            <Typography sx={{ color: PALETTE.textMuted, fontSize: 16, lineHeight: 1.7, mb: 4, maxWidth: 480 }}>
              {pain}
            </Typography>
            <Stack spacing={2}>
              {features.map((f) => (
                <Stack direction="row" spacing={1.5} alignItems="flex-start" key={f.label}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: 1.5, flexShrink: 0,
                    bgcolor: `${accent}22`, border: `1px solid ${accent}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <f.Icon sx={{ fontSize: 17, color: accent }} />
                  </Box>
                  <Typography sx={{ color: PALETTE.text, fontSize: 15, pt: 0.4 }}>
                    {f.label}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <MockupFrame accent={accent}>
              <SegmentMock kind={segment.mock} accent={accent} />
            </MockupFrame>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

// ─── App-mockup (samme vindus-ramme-språk som Hero/DeviceComposition
// i leadgrid-landing.tsx) — hvert segment får en skjerm som gjenspeiler
// det faktiske UI-et: pipeline, dashboard, territory-kart, rutekart. ───
function MockupFrame({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        mx: 'auto',
        aspectRatio: '16 / 11',
        borderRadius: 3,
        bgcolor: '#0a0512',
        border: `1px solid ${accent}33`,
        boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${accent}14`,
        overflow: 'hidden',
      }}
    >
      {/* Window-bar — identisk med MockupBrowser i leadgrid-landing.tsx */}
      <Box sx={{
        height: 28, display: 'flex', alignItems: 'center', px: 1.5, gap: 0.8,
        bgcolor: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        {['#ff6058', '#febc2e', '#28c941'].map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
        ))}
      </Box>
      <Box sx={{
        position: 'relative', height: 'calc(100% - 28px)',
        background: `linear-gradient(135deg, #0d0719 0%, #1a0a2e 100%)`,
        p: 1.5,
      }}>
        {children}
      </Box>
    </Box>
  );
}

function MapGrid() {
  return (
    <Box sx={{
      position: 'absolute', inset: 0,
      backgroundImage: `
        linear-gradient(rgba(167, 139, 250, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(167, 139, 250, 0.06) 1px, transparent 1px)
      `,
      backgroundSize: '24px 24px',
    }} />
  );
}

function SegmentMock({ kind, accent }: { kind: MockKind; accent: string }) {
  if (kind === 'kanban') return <KanbanMock accent={accent} />;
  if (kind === 'analytics') return <AnalyticsMock accent={accent} />;
  if (kind === 'territory') return <TerritoryMapMock accent={accent} />;
  return <RouteMapMock accent={accent} />;
}

/** Salgsteam — drag-and-drop pipeline, samme kolonner som Deal Pipeline Kanban */
function KanbanMock({ accent }: { accent: string }) {
  const columns = [
    { title: 'Ny', n: 3 },
    { title: 'Kontaktet', n: 4 },
    { title: 'Møte booket', n: 2 },
    { title: 'Vunnet', n: 1 },
  ];
  return (
    <Stack direction="row" spacing={1} sx={{ height: '100%', position: 'relative' }}>
      {columns.map((col) => (
        <Box key={col.title} sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.6, minWidth: 0 }}>
          <Typography sx={{ fontSize: 8, color: PALETTE.textFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {col.title}
          </Typography>
          {Array.from({ length: col.n }).map((_, i) => (
            <Box key={i} sx={{
              borderRadius: 1, p: 0.7,
              bgcolor: `${accent}14`, border: `1px solid ${accent}2a`,
            }}>
              <Box sx={{ height: 3, width: '70%', bgcolor: 'rgba(255,255,255,0.16)', borderRadius: 1, mb: 0.5 }} />
              <Box sx={{ height: 2, width: '45%', bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
            </Box>
          ))}
        </Box>
      ))}
    </Stack>
  );
}

/** Markedsføring — analytics-dashboard med KPI-tiles + konverteringsgraf */
function AnalyticsMock({ accent }: { accent: string }) {
  const bars = [40, 62, 30, 78, 52, 88, 46, 70];
  const kpis: [string, string][] = [['Leads', '128'], ['Konvertering', '24%'], ['Møter', '19']];
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Stack direction="row" spacing={1}>
        {kpis.map(([label, value]) => (
          <Box key={label} sx={{ flex: 1, borderRadius: 1, p: 1, bgcolor: `${accent}14`, border: `1px solid ${accent}2a` }}>
            <Typography sx={{ fontSize: 7, color: PALETTE.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: accent }}>{value}</Typography>
          </Box>
        ))}
      </Stack>
      <Box sx={{
        flex: 1, borderRadius: 1, p: 1.2,
        bgcolor: `${accent}0d`, border: `1px solid ${accent}22`,
        display: 'flex', alignItems: 'flex-end', gap: 0.6,
      }}>
        {bars.map((h, i) => (
          <Box key={i} sx={{
            flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0',
            bgcolor: accent, opacity: 0.35 + (i / bars.length) * 0.55,
          }} />
        ))}
      </Box>
    </Box>
  );
}

/** Franchise — territory-grid med geofence-soner per lokasjon + team-pins */
function TerritoryMapMock({ accent }: { accent: string }) {
  const zones = [
    { x: '4%', y: '8%', w: '40%', h: '42%', color: accent },
    { x: '52%', y: '6%', w: '44%', h: '38%', color: '#7ab8ff' },
    { x: '8%', y: '56%', w: '40%', h: '38%', color: '#ffb86b' },
    { x: '54%', y: '52%', w: '42%', h: '40%', color: '#9be15d' },
  ];
  const pins = [
    { x: '16%', y: '22%', color: accent },
    { x: '30%', y: '34%', color: accent },
    { x: '68%', y: '18%', color: '#7ab8ff' },
    { x: '80%', y: '30%', color: '#7ab8ff' },
    { x: '20%', y: '68%', color: '#ffb86b' },
    { x: '76%', y: '68%', color: '#9be15d' },
    { x: '84%', y: '80%', color: '#9be15d' },
  ];
  return (
    <Box sx={{ position: 'relative', height: '100%', borderRadius: 1, overflow: 'hidden' }}>
      <MapGrid />
      {zones.map((z, i) => (
        <Box key={i} sx={{
          position: 'absolute', left: z.x, top: z.y, width: z.w, height: z.h,
          borderRadius: 2, bgcolor: `${z.color}1f`, border: `1.5px dashed ${z.color}66`,
        }} />
      ))}
      {pins.map((p, i) => (
        <Box key={i} sx={{
          position: 'absolute', left: p.x, top: p.y,
          width: 10, height: 10, borderRadius: '50% 50% 50% 0',
          bgcolor: p.color, transform: 'rotate(-45deg)',
          boxShadow: `0 0 10px ${p.color}aa`,
        }} />
      ))}
    </Box>
  );
}

/** Eiendomsmegling — ruteplanlegger som binder sammen dagens visningsrunde */
function RouteMapMock({ accent }: { accent: string }) {
  const stops: [number, number][] = [[14, 26], [36, 14], [54, 44], [72, 28], [86, 60]];
  const path = stops.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s[0]} ${s[1]}`).join(' ');
  return (
    <Box sx={{ position: 'relative', height: '100%', borderRadius: 1, overflow: 'hidden' }}>
      <MapGrid />
      <Box
        component="svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <path d={path} fill="none" stroke={accent} strokeWidth={0.8} strokeDasharray="2 2.4" opacity={0.85} />
      </Box>
      {stops.map(([x, y], i) => (
        <Box key={i} sx={{
          position: 'absolute', left: `${x}%`, top: `${y}%`,
          width: 12, height: 12, borderRadius: '50% 50% 50% 0',
          bgcolor: i === stops.length - 1 ? '#9be15d' : accent,
          transform: 'translate(-50%, -100%) rotate(-45deg)',
          boxShadow: `0 0 10px ${accent}aa`,
        }} />
      ))}
    </Box>
  );
}
