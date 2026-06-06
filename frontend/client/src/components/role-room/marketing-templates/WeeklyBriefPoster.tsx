/**
 * WeeklyBriefPoster — Role Room-branded 4:5 marketing-poster for nyhetsbrev-
 * promo (LinkedIn / Instagram feed). Pure visuell komponent som tar fullt
 * strukturert WeeklyBriefFields og rendrer det.
 *
 * Designspråket speiler hero-bildet brukeren ga som referanse: editorial
 * serif headline med lilla gradient på ett ord, 4 content-cards med ikon,
 * abonnement-CTA med QR-kode, og sosial-media-footer.
 */

import React, { forwardRef, useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  BarChart as ChartIcon,
  Movie as MovieIcon,
  Shield as ShieldIcon,
  PersonOutline as PersonIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingIcon,
  AutoAwesome as StarIcon,
  Group as TeamIcon,
  Email as EmailIcon,
  LinkedIn as LinkedInIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';

const RR_PURPLE = '#a78bfa';
const RR_PURPLE_DARK = '#7c3aed';

export type WeeklyBriefCardIcon =
  | 'chart'
  | 'film'
  | 'shield'
  | 'person'
  | 'calendar'
  | 'trending'
  | 'star'
  | 'team';

export interface WeeklyBriefCard {
  icon: WeeklyBriefCardIcon;
  title: string;
  description: string;
}

export type SocialIcon = 'linkedin' | 'instagram' | 'youtube' | 'email';

export interface WeeklyBriefFields {
  /** Stor headline-tittel (4-6 ord). En del kan markeres som accent via accentText */
  headline: string;
  /** Ord/uttrykk i headline som skal ha lilla gradient (eks. "Norwegian"). Tom = ingen accent. */
  accentText?: string;
  /** Underlinje (1-2 setninger). Substrings i highlights får farge-accent. */
  subheading?: string;
  /** Ord i subheading som skal markeres med lilla (case-sensitive). */
  subheadingHighlights?: string[];
  /** 1-4 cards. Brikker som ikke får plass kuttes. */
  cards: WeeklyBriefCard[];
  /** Tittel på abonnement-blokken nederst */
  ctaTitle?: string;
  /** Accent-ord i CTA-tittelen (eks. "ukentlig innsikt") */
  ctaTitleAccent?: string;
  /** CTA-undertekst */
  ctaSubtitle?: string;
  /** URL som QR-koden skal lede til */
  qrUrl?: string;
  /** Footer venstre — typisk domene */
  footerLeft?: string;
  /** Footer midt — typisk tagline */
  footerCenter?: string;
  /** Footer-sosialer (icon-array) */
  socialIcons?: SocialIcon[];
}

export type WeeklyBriefVariant = 'standard' | 'minimal' | 'editorial';

export interface WeeklyBriefVariantDef {
  id: WeeklyBriefVariant;
  label: string;
  description: string;
}

export const WEEKLY_BRIEF_VARIANTS: WeeklyBriefVariantDef[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: '4-card grid + QR + sosialer. Speiler referansebildet 1:1.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Kun headline + CTA + QR. Best for sterke kvotater eller hero-bilder.',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: '2-card grid + større sitat-stripe under. For founder-perspektiv-posts.',
  },
];

export const CARD_ICON_OPTIONS: WeeklyBriefCardIcon[] = [
  'chart', 'film', 'shield', 'person', 'calendar', 'trending', 'star', 'team',
];

function CardIcon({ kind }: { kind: WeeklyBriefCardIcon }): JSX.Element {
  const sx = { color: RR_PURPLE, fontSize: '5.4cqw' };
  switch (kind) {
    case 'chart': return <ChartIcon sx={sx} />;
    case 'film': return <MovieIcon sx={sx} />;
    case 'shield': return <ShieldIcon sx={sx} />;
    case 'person': return <PersonIcon sx={sx} />;
    case 'calendar': return <CalendarIcon sx={sx} />;
    case 'trending': return <TrendingIcon sx={sx} />;
    case 'team': return <TeamIcon sx={sx} />;
    default: return <StarIcon sx={sx} />;
  }
}

function SocialIconRender({ kind }: { kind: SocialIcon }): JSX.Element {
  const sx = { color: RR_PURPLE, fontSize: '3.6cqw' };
  switch (kind) {
    case 'linkedin': return <LinkedInIcon sx={sx} />;
    case 'instagram': return <InstagramIcon sx={sx} />;
    case 'youtube': return <YouTubeIcon sx={sx} />;
    case 'email': return <EmailIcon sx={sx} />;
  }
}

/**
 * Splitter headline rundt accent-uttrykket og rendrer accent-delen som
 * lilla gradient. Beholder case-sensitivity og whitespace.
 */
function HeadlineWithAccent({
  text,
  accent,
}: { text: string; accent?: string }): JSX.Element {
  if (!accent || !text.includes(accent)) {
    return <>{text}</>;
  }
  const idx = text.indexOf(accent);
  const before = text.slice(0, idx);
  const after = text.slice(idx + accent.length);
  return (
    <>
      {before}
      <Box
        component="span"
        sx={{
          background: `linear-gradient(180deg, ${RR_PURPLE}, ${RR_PURPLE_DARK})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {accent}
      </Box>
      {after}
    </>
  );
}

/**
 * Markerer flere substrings med lilla farge (ikke gradient — den brukes
 * bare for headline). Splitter på første match, så rekurserer.
 */
function HighlightedText({
  text,
  highlights,
}: { text: string; highlights?: string[] }): JSX.Element {
  if (!highlights || highlights.length === 0) return <>{text}</>;
  const sorted = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return <>{text}</>;
  const accent = sorted[0];
  const idx = text.indexOf(accent);
  if (idx < 0) return <HighlightedText text={text} highlights={sorted.slice(1)} />;
  const before = text.slice(0, idx);
  const after = text.slice(idx + accent.length);
  return (
    <>
      <HighlightedText text={before} highlights={sorted} />
      <Box component="span" sx={{ color: RR_PURPLE, fontWeight: 700 }}>
        {accent}
      </Box>
      <HighlightedText text={after} highlights={sorted} />
    </>
  );
}

/**
 * Genererer en QR-PNG som data-URL via `qrcode`. Falbacker til en placeholder
 * hvis URL'en er tom eller QR-gen feiler.
 */
function useQrCodeDataUrl(url: string | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!url || url.trim().length === 0) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(url.trim(), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
      color: { dark: '#ffffff', light: '#00000000' },
    })
      .then((d) => { if (!cancelled) setDataUrl(d); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [url]);
  return dataUrl;
}

const POSTER_BG =
  'radial-gradient(circle at 15% 10%, rgba(167,139,250,0.30), transparent 40%),' +
  ' radial-gradient(circle at 95% 105%, rgba(124,58,237,0.22), transparent 50%),' +
  ' linear-gradient(180deg, #0a0a14 0%, #0e0820 50%, #1a0f2e 100%)';

export interface WeeklyBriefPosterProps {
  fields: WeeklyBriefFields;
  width?: number | string;
  variant?: WeeklyBriefVariant;
}

export const WeeklyBriefPoster = forwardRef<HTMLDivElement, WeeklyBriefPosterProps>(
  function WeeklyBriefPoster({ fields, width = '100%', variant = 'standard' }, ref) {
    const {
      headline,
      accentText,
      subheading,
      subheadingHighlights,
      cards,
      ctaTitle = 'Abonner for ukentlig innsikt',
      ctaTitleAccent = 'ukentlig innsikt',
      ctaSubtitle = 'Hold deg oppdatert. Ta bedre beslutninger. Bygg sterkere produksjoner.',
      qrUrl,
      footerLeft = 'theroleroom.no',
      footerCenter = 'Casting. Roles. Together.',
      socialIcons = ['linkedin', 'instagram', 'youtube'],
    } = fields;

    const qrDataUrl = useQrCodeDataUrl(qrUrl);

    const cardsToShow = variant === 'editorial' ? cards.slice(0, 2) : cards.slice(0, 4);
    const showCards = variant !== 'minimal' && cardsToShow.length > 0;
    const cardColumns = variant === 'editorial' ? 2 : Math.min(cardsToShow.length || 1, 4);

    return (
      <Box
        ref={ref}
        sx={{
          width,
          aspectRatio: '4 / 5',
          containerType: 'inline-size',
          background: POSTER_BG,
          color: '#fff',
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
          boxShadow: '0 20px 60px rgba(124,58,237,0.25)',
          border: '1px solid rgba(167,139,250,0.20)',
        }}
      >
        {/* Subtilt scanline-glow over toppen */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 75% 5%, rgba(167,139,250,0.18), transparent 35%)',
            pointerEvents: 'none',
          }}
        />

        <Stack
          spacing="3cqw"
          sx={{
            position: 'relative',
            zIndex: 1,
            p: '4.5cqw',
            height: '100%',
            justifyContent: 'space-between',
          }}
        >
          {/* ── Logo + tagline ─────────────────────────────────── */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              sx={{
                width: '11cqw',
                height: '11cqw',
                borderRadius: '2.2cqw',
                background:
                  'linear-gradient(135deg, rgba(167,139,250,0.50), rgba(124,58,237,0.75))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(167,139,250,0.55)',
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '6cqw', color: '#fff' }}>R</Typography>
            </Box>
            <Stack spacing={0}>
              <Typography sx={{ fontWeight: 800, fontSize: '3.4cqw', letterSpacing: '0.25cqw', color: '#fff' }}>
                THE ROLE ROOM
              </Typography>
              <Typography sx={{ fontSize: '1.9cqw', color: RR_PURPLE, fontWeight: 600 }}>
                Casting. Roles. Together.
              </Typography>
            </Stack>
          </Stack>

          {/* ── Editorial headline ──────────────────────────────── */}
          <Box>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif',
                fontSize: 'clamp(20px, 11cqw, 96px)',
                fontWeight: 800,
                lineHeight: 0.96,
                color: '#fff',
                letterSpacing: '-0.04em',
              }}
            >
              <HeadlineWithAccent text={headline} accent={accentText} />
            </Typography>
            {/* Decorative divider with sparkle */}
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mt: '1.5cqw', width: '70%' }}>
              <Box sx={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${RR_PURPLE}, transparent)` }} />
              <Box sx={{ color: RR_PURPLE, fontSize: '2.6cqw' }}>✦</Box>
              <Box sx={{ flex: 1, height: 1.5, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.4))' }} />
            </Stack>
          </Box>

          {/* ── Subheading ──────────────────────────────────────── */}
          {subheading && (
            <Typography
              sx={{
                fontSize: '2.6cqw',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.4,
                maxWidth: '85%',
              }}
            >
              <HighlightedText text={subheading} highlights={subheadingHighlights} />
            </Typography>
          )}

          {/* ── Cards grid ──────────────────────────────────────── */}
          {showCards && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cardColumns}, 1fr)`,
                gap: '1.8cqw',
              }}
            >
              {cardsToShow.map((card, i) => (
                <BriefCard key={i} card={card} />
              ))}
            </Box>
          )}

          {/* ── Subscription CTA + QR ───────────────────────────── */}
          <Box
            sx={{
              p: '3cqw',
              borderRadius: '2.4cqw',
              border: '1px solid rgba(167,139,250,0.25)',
              background:
                'linear-gradient(180deg, rgba(167,139,250,0.10), rgba(124,58,237,0.04))',
              display: 'flex',
              alignItems: 'center',
              gap: '3cqw',
            }}
          >
            <Box
              sx={{
                width: '10cqw',
                height: '10cqw',
                borderRadius: '50%',
                background: 'rgba(167,139,250,0.18)',
                border: '1px solid rgba(167,139,250,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EmailIcon sx={{ color: RR_PURPLE, fontSize: '5cqw' }} />
            </Box>
            <Stack spacing="0.6cqw" sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '3cqw', color: '#fff', lineHeight: 1.2 }}>
                <HighlightedText text={ctaTitle} highlights={ctaTitleAccent ? [ctaTitleAccent] : undefined} />
              </Typography>
              <Typography sx={{ fontSize: '2cqw', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                {ctaSubtitle}
              </Typography>
            </Stack>
            {qrDataUrl ? (
              <Box
                component="img"
                src={qrDataUrl}
                alt="QR-kode for abonnement"
                sx={{
                  width: '15cqw',
                  height: '15cqw',
                  flexShrink: 0,
                  borderRadius: '1.4cqw',
                  border: '1px solid rgba(167,139,250,0.35)',
                  background: 'rgba(124,58,237,0.18)',
                  p: '0.5cqw',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '15cqw',
                  height: '15cqw',
                  flexShrink: 0,
                  borderRadius: '1.4cqw',
                  border: '1px dashed rgba(167,139,250,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '1.6cqw',
                  textAlign: 'center',
                  p: '1cqw',
                }}
              >
                QR ▢
              </Box>
            )}
          </Box>

          {/* ── Footer ─────────────────────────────────────────── */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ color: RR_PURPLE, fontSize: '2.2cqw', fontWeight: 600 }}>
              {footerLeft}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '2cqw' }}>
              {footerCenter}
            </Typography>
            <Stack direction="row" spacing={1.2}>
              {socialIcons.map((s, i) => (
                <Box
                  key={i}
                  sx={{
                    width: '5cqw',
                    height: '5cqw',
                    borderRadius: '50%',
                    background: 'rgba(167,139,250,0.12)',
                    border: '1px solid rgba(167,139,250,0.30)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SocialIconRender kind={s} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Box>
    );
  },
);

function BriefCard({ card }: { card: WeeklyBriefCard }): JSX.Element {
  return (
    <Box
      sx={{
        p: '2.4cqw',
        borderRadius: '2.4cqw',
        border: '1px solid rgba(167,139,250,0.22)',
        background:
          'linear-gradient(180deg, rgba(167,139,250,0.10), rgba(167,139,250,0.02))',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.4cqw',
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          width: '9cqw',
          height: '9cqw',
          borderRadius: '50%',
          background: 'rgba(167,139,250,0.20)',
          border: '1px solid rgba(167,139,250,0.40)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CardIcon kind={card.icon} />
      </Box>
      <Typography
        sx={{
          fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif',
          fontSize: '3.4cqw',
          fontWeight: 700,
          lineHeight: 1.1,
          color: '#fff',
        }}
      >
        {card.title}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.9cqw',
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.4,
          flex: 1,
        }}
      >
        {card.description}
      </Typography>
      <ArrowIcon sx={{ color: RR_PURPLE, fontSize: '3cqw', alignSelf: 'flex-start' }} />
    </Box>
  );
}

export default WeeklyBriefPoster;
