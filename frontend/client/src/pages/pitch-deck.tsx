/**
 * pitch-deck.tsx — /pitch
 *
 * Interaktiv keyboard-navigerbar pitch-deck. 12 slides.
 * - ← → / Space / klikk for navigasjon
 * - Esc lukker fullscreen
 * - Slide-tall + progress-bar
 * - Optimalisert for å deles som lenke til investorer + partnere
 *
 * Hver slide har sin egen Component slik at Daniel kan vri på enkelt-slides
 * uten å scrolle gjennom hele filen.
 */

import {
  Box, Button, Container, IconButton, Stack, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import { useCallback, useEffect, useRef, useState } from 'react';

const palette = {
  bgRoot: '#0a0118',
  bgShell: '#0f0721',
  bgCard: '#150b2e',
  bgElevated: '#1a0f3a',
  border: 'rgba(168, 85, 247, 0.18)',
  borderStrong: 'rgba(168, 85, 247, 0.32)',
  borderSubtle: 'rgba(168, 85, 247, 0.08)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#a855f7',
  accentBright: '#c084fc',
  accentDeep: '#7c3aed',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

// ──────────────────────────────────────────────────────────────────
// Slide-content
// ──────────────────────────────────────────────────────────────────
interface Slide {
  id: string;
  title?: string;
  Component: React.ComponentType;
}

const SLIDES: Slide[] = [
  { id: 'cover', Component: CoverSlide },
  { id: 'problem', title: 'Problem', Component: ProblemSlide },
  { id: 'solution', title: 'Løsning', Component: SolutionSlide },
  { id: 'market', title: 'Marked', Component: MarketSlide },
  { id: 'product', title: 'Produkt', Component: ProductSlide },
  { id: 'differentiator', title: 'Differensiering', Component: DifferentiatorSlide },
  { id: 'business', title: 'Forretningsmodell', Component: BusinessSlide },
  { id: 'gtm', title: 'Go-to-market', Component: GTMSlide },
  { id: 'traction', title: 'Status', Component: TractionSlide },
  { id: 'team', title: 'Team', Component: TeamSlide },
  { id: 'ask', title: 'Ask', Component: AskSlide },
  { id: 'thanks', Component: ThanksSlide },
];

export default function PitchDeckPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goNext = useCallback(() => {
    setCurrent((i) => Math.min(SLIDES.length - 1, i + 1));
  }, []);
  const goPrev = useCallback(() => {
    setCurrent((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard-nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Home') {
        setCurrent(0);
      } else if (e.key === 'End') {
        setCurrent(SLIDES.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  // Fullscreen handlers
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen?.().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // SEO
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'The Role Room — Pitch Deck';
    return () => { document.title = previousTitle; };
  }, []);

  const SlideComponent = SLIDES[current].Component;
  const progress = ((current + 1) / SLIDES.length) * 100;

  return (
    <Box
      ref={containerRef}
      sx={{
        bgcolor: palette.bgRoot,
        color: palette.textPrimary,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={(e) => {
        // Klikk høyre halvdel → next; venstre halvdel → prev
        if (!isMobile && (e.target as HTMLElement).tagName === 'DIV') {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (e.clientX > rect.left + rect.width / 2) goNext();
          else goPrev();
        }
      }}
    >
      {/* Backgound gradient */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at top left, rgba(168, 85, 247, 0.16), transparent 60%),
            radial-gradient(ellipse at bottom right, rgba(217, 70, 239, 0.10), transparent 50%),
            ${palette.bgRoot}
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Progress bar */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: palette.borderSubtle,
          zIndex: 10,
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${progress}%`,
            background: palette.accentGradient,
            transition: 'width 0.3s ease',
          }}
        />
      </Box>

      {/* Top-bar */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: { xs: 2, md: 4 },
          py: 1.6,
          zIndex: 5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 1,
              background: palette.accentGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, color: '#fff',
            }}
          >
            RR
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '0.96rem' }}>
            The Role Room
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ color: palette.textMuted, fontFamily: 'monospace', fontSize: '0.86rem' }}>
            {current + 1} / {SLIDES.length}
          </Typography>
          <IconButton
            onClick={toggleFullscreen}
            sx={{ color: palette.textMuted, '&:hover': { color: palette.accentBright } }}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Stack>
      </Stack>

      {/* Slide-content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, md: 6 },
          py: { xs: 3, md: 4 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Container maxWidth="lg" sx={{ height: '100%' }}>
          <SlideComponent />
        </Container>
      </Box>

      {/* Bottom nav */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: { xs: 2, md: 4 },
          py: 2,
          borderTop: `1px solid ${palette.borderSubtle}`,
          bgcolor: 'rgba(15, 7, 33, 0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 5,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          onClick={goPrev}
          disabled={current === 0}
          startIcon={<ArrowBackIcon />}
          sx={{
            color: palette.textPrimary,
            textTransform: 'none',
            fontWeight: 600,
            '&.Mui-disabled': { color: palette.textMuted, opacity: 0.4 },
          }}
        >
          Forrige
        </Button>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', display: { xs: 'none', sm: 'block' } }}>
          ← → for navigasjon · F for fullskjerm
        </Typography>
        <Button
          onClick={goNext}
          disabled={current === SLIDES.length - 1}
          endIcon={<ArrowForwardIcon />}
          sx={{
            background: current === SLIDES.length - 1 ? 'transparent' : palette.accentGradient,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            px: 2.4,
            '&.Mui-disabled': { background: 'transparent', color: palette.textMuted, opacity: 0.4 },
            '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
          }}
        >
          Neste
        </Button>
      </Stack>
    </Box>
  );
}

// ══════════════════════════════════════════════════════════════════
// SLIDES
// ══════════════════════════════════════════════════════════════════

// ── 1. Cover ─────────────────────────────────────────────────────
function CoverSlide() {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={4} sx={{ height: '100%', textAlign: 'center' }}>
      <Box
        sx={{
          display: 'inline-block',
          background: 'rgba(168,85,247,0.14)',
          border: `1px solid ${palette.borderStrong}`,
          color: palette.accentBright,
          fontWeight: 700,
          fontSize: '0.78rem',
          px: 1.4, py: 0.5,
          borderRadius: 999,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        Pitch · 2026
      </Box>
      <Typography
        component="h1"
        sx={{
          fontSize: { xs: '2.6rem', sm: '3.8rem', md: '5rem' },
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: -0.5,
        }}
      >
        The Role Room
      </Typography>
      <Typography
        sx={{
          background: palette.accentGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontSize: { xs: '1.2rem', md: '1.6rem' },
          fontWeight: 700,
          maxWidth: 760,
        }}
      >
        Operativsystemet for norske skuespillerbyråer
      </Typography>
      <Typography sx={{ color: palette.textMuted, fontSize: '1rem', mt: 2 }}>
        Daniel Qazi · daniel@creatorhubn.com · theroleroom.com
      </Typography>
    </Stack>
  );
}

// ── 2. Problem ───────────────────────────────────────────────────
function ProblemSlide() {
  return (
    <SlideShell label="Problem" icon={LightbulbOutlinedIcon}>
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Norske byråer administrerer talents{' '}
        <Box component="span" sx={{ color: palette.textMuted }}>
          med verktøy bygget for noen andre.
        </Box>
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 4 }}>
        {[
          { stat: '47 %', label: 'av casting-tid forsvinner i e-post' },
          { stat: '~120 GB', label: 'self-tapes spredt på Dropbox/Drive/Vimeo' },
          { stat: '0', label: 'GDPR-audit på hvem som har sett portfolioen' },
        ].map((s) => (
          <Box
            key={s.label}
            sx={{
              flex: 1,
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 3,
              p: 3,
            }}
          >
            <Typography sx={{
              fontSize: { xs: '2.4rem', md: '3.2rem' },
              fontWeight: 800,
              background: palette.accentGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1,
              mb: 1,
            }}>
              {s.stat}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem' }}>
              {s.label}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Box
        sx={{
          borderLeft: `3px solid ${palette.accentBright}`,
          bgcolor: 'rgba(168,85,247,0.08)',
          p: 2.4,
          borderRadius: '0 8px 8px 0',
          maxWidth: 900,
        }}
      >
        <Typography sx={{ color: palette.textPrimary, fontSize: '1.04rem', fontStyle: 'italic', lineHeight: 1.55 }}>
          «Hvor ligger den self-tapen fra Anna for Nora-rollen igjen?
          I Dropbox? På Drive? På privat-Vimeo?»
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', mt: 1.4, fontWeight: 600 }}>
          — Casting-direktør, anonym (intervju mars 2026)
        </Typography>
      </Box>
    </SlideShell>
  );
}

// ── 3. Solution ──────────────────────────────────────────────────
function SolutionSlide() {
  return (
    <SlideShell label="Løsning" icon={AutoAwesomeOutlinedIcon}>
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Talent-register, self-tape-studio, casting-partnership og
        GDPR-audit{' '}
        <Box component="span" sx={{
          background: palette.accentGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          på ett sted.
        </Box>
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 2.4,
          maxWidth: 1080,
        }}
      >
        {[
          { Icon: GroupsOutlinedIcon, title: 'Talent-register', body: 'Talentene fyller selv inn. BankID-verifisert identitet (Q3-2026). Headshots, showreel, ferdigheter.' },
          { Icon: AutoAwesomeOutlinedIcon, title: 'Self-Tape Studio', body: 'Innspilling direkte i nettleseren. Cloudflare Stream + signed URLs. AI-feedback fra Claude Opus 4.7.' },
          { Icon: ShieldOutlinedIcon, title: 'Casting-Partnership', body: 'Foreslå talent til produksjonsteam med ett klikk. Per-prosjekt-consent. Full audit-trail.' },
        ].map((f) => (
          <Box
            key={f.title}
            sx={{
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderStrong}`,
              borderRadius: 3,
              p: 3,
            }}
          >
            <Box
              sx={{
                width: 48, height: 48, borderRadius: 2,
                bgcolor: 'rgba(168,85,247,0.18)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                mb: 2,
              }}
            >
              <f.Icon sx={{ color: palette.accentBright, fontSize: 28 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 1 }}>
              {f.title}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem', lineHeight: 1.55 }}>
              {f.body}
            </Typography>
          </Box>
        ))}
      </Box>
    </SlideShell>
  );
}

// ── 4. Market ────────────────────────────────────────────────────
function MarketSlide() {
  return (
    <SlideShell label="Marked" icon={TrendingUpIcon}>
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        SAM: nordiske casting-byråer.{' '}
        <Box component="span" sx={{ color: palette.textMuted }}>
          Skuespiller-tunge, men ekspanderbart.
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        sx={{ mb: 4 }}
      >
        {[
          { label: 'TAM (Europa)', value: '€ 2.4 B', desc: 'casting-software-marked' },
          { label: 'SAM (Norden)', value: '~€ 80 M', desc: '~350 etablerte byråer' },
          { label: 'SOM (Norge år 1-2)', value: '€ 8 M', desc: '~30 norske byråer kan nås personlig' },
        ].map((m) => (
          <Box
            key={m.label}
            sx={{
              flex: 1,
              bgcolor: palette.bgCard,
              border: `1px solid ${palette.borderSubtle}`,
              borderRadius: 3,
              p: 3,
            }}
          >
            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mb: 1 }}>
              {m.label}
            </Typography>
            <Typography sx={{
              fontSize: { xs: '2rem', md: '2.6rem' },
              fontWeight: 800,
              background: palette.accentGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 0.6,
            }}>
              {m.value}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem' }}>
              {m.desc}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', maxWidth: 900, fontStyle: 'italic' }}>
        Estimater basert på Brønnøysund-data (NACE 90.020) + nordiske
        casting-foreninger (SkuespillerNorge, KonstellationCasting, Nordisk Casting Network).
      </Typography>
    </SlideShell>
  );
}

// ── 5. Product ───────────────────────────────────────────────────
function ProductSlide() {
  return (
    <SlideShell label="Produkt">
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Live i prod nå. Demo: theroleroom.com?demo=1
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
        <Box sx={{ flex: 1 }}>
          <Stack spacing={2}>
            {[
              'Talent Registry med ferdighets-tagging',
              'Self-Tape Studio (MediaRecorder + Cloudflare Stream + AI-feedback)',
              'Partnership-flyt med per-prosjekt-consent',
              'Casting Kanban + Utvelgelse-fane med 📹-badge',
              'Universal CRM + lead-gen via Meta Lead Ads',
              'Story Arc — manus-til-produksjon (siste leveranse)',
              'GDPR-compliant: audit-trail + scope-revoke',
              'Mobile-first iPad og iPhone',
            ].map((f) => (
              <Stack key={f} direction="row" alignItems="center" spacing={1.4}>
                <CheckCircleOutlineIcon sx={{ color: '#34d399' }} />
                <Typography sx={{ color: palette.textPrimary, fontSize: '1rem' }}>
                  {f}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            aspectRatio: '4 / 3',
            bgcolor: palette.bgCard,
            border: `1px solid ${palette.border}`,
            borderRadius: 3,
            p: 2,
            background: `
              radial-gradient(ellipse at center, rgba(168,85,247,0.18), transparent 60%),
              ${palette.bgCard}
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(168,85,247,0.28)',
          }}
        >
          <Stack alignItems="center" spacing={2}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.86rem', color: palette.textMuted }}>
              theroleroom.com
            </Typography>
            <Typography sx={{ fontSize: { xs: '2.4rem', md: '3.4rem' }, fontWeight: 800, color: palette.accentBright, opacity: 0.6 }}>
              {'<UI>'}
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', textAlign: 'center' }}>
              Demo-modus: ?demo=1<br/>
              med Ingrid Nilsen + Northern Lights
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </SlideShell>
  );
}

// ── 6. Differentiator ────────────────────────────────────────────
function DifferentiatorSlide() {
  return (
    <SlideShell label="Differensiering">
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Vi konkurrerer ikke med byrået —{' '}
        <Box component="span" sx={{
          background: palette.accentGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          vi er infrastrukturen.
        </Box>
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr 1fr' },
          gap: 0,
          maxWidth: 1080,
          border: `1px solid ${palette.borderSubtle}`,
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        {/* Header-rad */}
        <Box sx={{ p: 2, bgcolor: palette.bgElevated, borderRight: { md: `1px solid ${palette.borderSubtle}` }, borderBottom: `1px solid ${palette.borderSubtle}` }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Egenskap
          </Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: palette.bgElevated, borderRight: { md: `1px solid ${palette.borderSubtle}` }, borderBottom: `1px solid ${palette.borderSubtle}` }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Spotlight / Backstage
          </Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: 'rgba(168,85,247,0.10)', borderBottom: `1px solid ${palette.borderSubtle}` }}>
          <Typography sx={{ color: palette.accentBright, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            The Role Room
          </Typography>
        </Box>

        {[
          ['Talent-eierskap', 'De', 'Du'],
          ['Norsk språk + GDPR-byrå', 'Nei', 'Ja'],
          ['Self-tape direkte i app', 'Begrenset', 'Ja, CF Stream'],
          ['AI-feedback', 'Nei', 'Claude Opus 4.7'],
          ['Per-prosjekt consent', 'Nei', 'Ja'],
          ['Audit-trail per visning', 'Nei', 'Ja'],
        ].map((row) => (
          <Box key={row[0]} sx={{ display: 'contents' }}>
            <Box sx={{ p: 2, borderRight: { md: `1px solid ${palette.borderSubtle}` }, borderBottom: `1px solid ${palette.borderSubtle}` }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.92rem' }}>
                {row[0]}
              </Typography>
            </Box>
            <Box sx={{ p: 2, borderRight: { md: `1px solid ${palette.borderSubtle}` }, borderBottom: `1px solid ${palette.borderSubtle}` }}>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.92rem' }}>
                {row[1]}
              </Typography>
            </Box>
            <Box sx={{ p: 2, bgcolor: 'rgba(168,85,247,0.06)', borderBottom: `1px solid ${palette.borderSubtle}` }}>
              <Stack direction="row" alignItems="center" spacing={0.8}>
                {row[2].startsWith('Ja') || row[2] === 'Du' || row[2] === 'Claude Opus 4.7' ? (
                  <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18 }} />
                ) : null}
                <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
                  {row[2]}
                </Typography>
              </Stack>
            </Box>
          </Box>
        ))}
      </Box>
    </SlideShell>
  );
}

// ── 7. Business model ────────────────────────────────────────────
function BusinessSlide() {
  return (
    <SlideShell label="Forretningsmodell">
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        SaaS-abonnement.{' '}
        <Box component="span" sx={{ color: palette.textMuted }}>
          Pris per seat per måned.
        </Box>
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {[
          { name: 'Solo Agent', price: '495', unit: 'kr/mnd', desc: '1 bruker · 25 talents' },
          { name: 'Boutique', price: '1 495', unit: 'kr/mnd', desc: '5 brukere · 100 talents', highlighted: true },
          { name: 'Professional', price: '3 495', unit: 'kr/mnd', desc: '20 brukere · ubegrenset · AI' },
          { name: 'Enterprise', price: 'Kontakt', unit: '', desc: 'White-label · SLA' },
        ].map((t) => (
          <Box
            key={t.name}
            sx={{
              bgcolor: t.highlighted ? 'rgba(168,85,247,0.10)' : palette.bgCard,
              border: `1px solid ${t.highlighted ? palette.accentBright : palette.borderSubtle}`,
              borderRadius: 3,
              p: 2.6,
              position: 'relative',
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.04rem', mb: 1 }}>
              {t.name}
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={0.4} sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.8rem' }}>
                {t.price}
              </Typography>
              {t.unit ? (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                  {t.unit}
                </Typography>
              ) : null}
            </Stack>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem' }}>
              {t.desc}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 4, p: 2.4, bgcolor: palette.bgCard, border: `1px solid ${palette.borderSubtle}`, borderRadius: 3, maxWidth: 600 }}>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mb: 1 }}>
          ARR-mål år 1
        </Typography>
        <Stack direction="row" alignItems="baseline" spacing={0.6}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, background: palette.accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            1.8 MNOK
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem' }}>
            (15 byråer × snitt 10k MRR)
          </Typography>
        </Stack>
      </Box>
    </SlideShell>
  );
}

// ── 8. Go-to-market ──────────────────────────────────────────────
function GTMSlide() {
  return (
    <SlideShell label="Go-to-market">
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Personlig outreach + content-pillars{' '}
        <Box component="span" sx={{ color: palette.textMuted }}>
          → demo → trial → kunde
        </Box>
      </Typography>

      <Stack spacing={2.4}>
        {[
          {
            stage: '1',
            title: 'Awareness — content + SEO/GEO',
            body: '5 pillar-artikler (GDPR · Self-tape · AI · Casting-CRM vs Excel · Bransje-survey). JSON-LD FAQPage gjør LLM-er til distribusjons-kanal.',
          },
          {
            stage: '2',
            title: 'Acquisition — 6-touch outreach',
            body: '30 norske byråer i target-listen. Eksisterende outreach-system kjører Claude-personalisert sekvens (verdi → bevis → ressurs → case → demo → break-up).',
          },
          {
            stage: '3',
            title: 'Conversion — 30 min demo + 2 uker trial',
            body: 'Demo med deres egne data (vi forhåndsfyller demo-prosjekt med deres talents). Trial uten kortinformasjon.',
          },
          {
            stage: '4',
            title: 'Retention — partnership-effekter',
            body: 'Når 1 byrå er kunde og bruker partnership mot et produksjonsteam, ber produsenten andre byråer også gå over (network-effekter).',
          },
        ].map((s) => (
          <Stack key={s.stage} direction="row" spacing={3} alignItems="flex-start">
            <Box
              sx={{
                width: 56, height: 56,
                borderRadius: '50%',
                background: palette.accentGradient,
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.4rem',
                flexShrink: 0,
                boxShadow: '0 8px 24px rgba(168,85,247,0.32)',
              }}
            >
              {s.stage}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', mb: 0.6 }}>
                {s.title}
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem', lineHeight: 1.55 }}>
                {s.body}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </SlideShell>
  );
}

// ── 9. Traction ──────────────────────────────────────────────────
function TractionSlide() {
  return (
    <SlideShell label="Status">
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Produkt live nå.{' '}
        <Box component="span" sx={{ color: palette.textMuted }}>
          Pilot-byråer i forhandling.
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mb: 2 }}>
            Bygget og live
          </Typography>
          <Stack spacing={1.4}>
            {[
              ['365+', 'merged PR-er i prod'],
              ['10', 'integrerte Role Room-moduler'],
              ['100+', 'database-tabeller'],
              ['2 demo-byråer', 'Stella + Skuespillersenter setups'],
              ['Live på', 'theroleroom.com'],
            ].map((t) => (
              <Stack key={t[1]} direction="row" alignItems="baseline" spacing={1.4}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: palette.accentBright, minWidth: 110 }}>
                  {t[0]}
                </Typography>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem' }}>
                  {t[1]}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mb: 2 }}>
            Neste 6 måneder
          </Typography>
          <Stack spacing={1.4}>
            {[
              'Pilot med 3 norske byråer',
              '5 pillar-artikler publisert',
              'Meta App Review godkjent (Lead Ads + Messaging)',
              'BankID-verifisering for talents',
              'iPad-native casting-app',
              '€ 30k MRR (10 betalende byråer)',
            ].map((t) => (
              <Stack key={t} direction="row" alignItems="center" spacing={1.2}>
                <FlagOutlinedIcon sx={{ color: palette.accentBright, fontSize: 18 }} />
                <Typography sx={{ color: palette.textPrimary, fontSize: '0.96rem' }}>
                  {t}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Stack>
    </SlideShell>
  );
}

// ── 10. Team ─────────────────────────────────────────────────────
function TeamSlide() {
  return (
    <SlideShell label="Team">
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Solo founder med AI-pair.{' '}
        <Box component="span" sx={{ color: palette.textMuted }}>
          Bygget for å skalere.
        </Box>
      </Typography>

      <Box
        sx={{
          bgcolor: palette.bgCard,
          border: `1px solid ${palette.border}`,
          borderRadius: 3,
          p: { xs: 3, md: 5 },
          maxWidth: 700,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
          <Box
            sx={{
              width: 100, height: 100,
              borderRadius: '50%',
              background: palette.accentGradient,
              display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '2.4rem', color: '#fff',
              flexShrink: 0,
            }}
          >
            DQ
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', mb: 0.6 }}>
              Daniel Qazi
            </Typography>
            <Typography sx={{ color: palette.accentBright, fontWeight: 700, fontSize: '0.96rem', mb: 1.4 }}>
              Founder & Builder
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem', lineHeight: 1.55 }}>
              Solo-utvikler bak hele The Role Room. Bygger med Claude Opus 4.7
              som pair-programmer. 365+ merged PR-er fra grunnen av på under et år.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', mt: 4, maxWidth: 700, fontStyle: 'italic' }}>
        Planlegger 2 nansatte i 2027 (kundeansvarlig + designer) når MRR
        passerer € 30k.
      </Typography>
    </SlideShell>
  );
}

// ── 11. Ask ──────────────────────────────────────────────────────
function AskSlide() {
  return (
    <SlideShell label="Ask">
      <Typography
        sx={{
          fontSize: { xs: '1.8rem', md: '2.6rem' },
          fontWeight: 800,
          lineHeight: 1.15,
          mb: 4,
          maxWidth: 900,
        }}
      >
        Hva vi trenger:{' '}
        <Box component="span" sx={{
          background: palette.accentGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          3 pilot-byråer + 6 måneders runway.
        </Box>
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
      >
        <Box
          sx={{
            flex: 1,
            bgcolor: palette.bgCard,
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: 3,
            p: 3,
          }}
        >
          <Typography sx={{ color: palette.accentBright, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mb: 1.6 }}>
            Pilot-byråer
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '2.4rem', mb: 1 }}>
            3
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
            Etablerte norske skuespillerbyråer som vil teste 6 mnd gratis i
            bytte mot caser, testimonials og produktinput.
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            bgcolor: palette.bgCard,
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: 3,
            p: 3,
          }}
        >
          <Typography sx={{ color: palette.accentBright, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mb: 1.6 }}>
            Distribusjon
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '2.4rem', mb: 1 }}>
            Intro
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
            Til ledende casting-direktører og byrå-eiere. Vi bygger produktet,
            du åpner dører.
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            bgcolor: palette.bgCard,
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: 3,
            p: 3,
          }}
        >
          <Typography sx={{ color: palette.accentBright, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', mb: 1.6 }}>
            Sparring
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '2.4rem', mb: 1 }}>
            6 mnd
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
            Månedlig 1:1 med rådgivere i casting-bransjen for å sikre at
            roadmap stemmer med markedet.
          </Typography>
        </Box>
      </Stack>
    </SlideShell>
  );
}

// ── 12. Thanks ───────────────────────────────────────────────────
function ThanksSlide() {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={4} sx={{ height: '100%', textAlign: 'center' }}>
      <Typography
        sx={{
          fontSize: { xs: '2.6rem', sm: '4rem', md: '5.4rem' },
          fontWeight: 800,
          lineHeight: 1.05,
          background: palette.accentGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Takk.
      </Typography>
      <Typography sx={{ color: palette.textSecondary, fontSize: { xs: '1.04rem', md: '1.4rem' }, maxWidth: 600 }}>
        Spørsmål? Vi prater gjerne.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.04rem' }}>
          daniel@creatorhubn.com
        </Typography>
        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: palette.textMuted, display: { xs: 'none', sm: 'block' } }} />
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.04rem' }}>
          theroleroom.com
        </Typography>
      </Stack>
    </Stack>
  );
}

// ──────────────────────────────────────────────────────────────────
// Shared slide-shell
// ──────────────────────────────────────────────────────────────────
function SlideShell({
  label, icon: Icon, children,
}: {
  label?: string;
  icon?: React.ComponentType<{ sx?: object }>;
  children: React.ReactNode;
}) {
  return (
    <Box>
      {label ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          {Icon ? (
            <Box
              sx={{
                width: 28, height: 28,
                borderRadius: 1,
                bgcolor: 'rgba(168,85,247,0.18)',
                display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon sx={{ color: palette.accentBright, fontSize: 18 }} />
            </Box>
          ) : null}
          <Typography sx={{ color: palette.textMuted, fontWeight: 700, fontSize: '0.82rem', letterSpacing: 1, textTransform: 'uppercase' }}>
            {label}
          </Typography>
        </Stack>
      ) : null}
      {children}
    </Box>
  );
}
