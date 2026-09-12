/**
 * MarketingFeedPoster — Role Room-branded 4:5 marketing-poster for
 * sosial-media-distribusjon (LinkedIn / Instagram feed). Pure visuell
 * komponent; rendrer det templates-/editor-laget mater inn.
 *
 * Generisk nok til å brukes for ulike templates (Weekly Brief, event-
 * annonse, product-launch). Theme + variant velges separat.
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
import { getTheme, type MarketingPosterTheme } from './themes';

const BRAND_LOGO_URL = '/TheRoleRoom_App_Logo.png';

export type PosterCardIcon =
  | 'chart'
  | 'film'
  | 'shield'
  | 'person'
  | 'calendar'
  | 'trending'
  | 'star'
  | 'team';

export interface PosterCard {
  icon: PosterCardIcon;
  title: string;
  description: string;
  /** Valgfri bakgrunns-bilde-URL (vises bak ikon/tekst med mørk overlay). */
  bgImageUrl?: string;
}

export type SocialIcon = 'linkedin' | 'instagram' | 'youtube' | 'email';

export interface MarketingPosterFields {
  headline: string;
  accentText?: string;
  subheading?: string;
  subheadingHighlights?: string[];
  cards: PosterCard[];
  ctaTitle?: string;
  ctaTitleAccent?: string;
  ctaSubtitle?: string;
  qrUrl?: string;
  footerLeft?: string;
  footerCenter?: string;
  socialIcons?: SocialIcon[];
}

export type PosterVariant = 'standard' | 'minimal' | 'editorial';

export interface PosterVariantDef {
  id: PosterVariant;
  label: string;
  description: string;
}

export const POSTER_VARIANTS: PosterVariantDef[] = [
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

export const CARD_ICON_OPTIONS: PosterCardIcon[] = [
  'chart', 'film', 'shield', 'person', 'calendar', 'trending', 'star', 'team',
];

function CardIconRender({ kind, color }: { kind: PosterCardIcon; color: string }): JSX.Element {
  const sx = { color, fontSize: '5.4cqw' };
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

function SocialIconRender({ kind, color }: { kind: SocialIcon; color: string }): JSX.Element {
  const sx = { color, fontSize: '3.6cqw' };
  switch (kind) {
    case 'linkedin': return <LinkedInIcon sx={sx} />;
    case 'instagram': return <InstagramIcon sx={sx} />;
    case 'youtube': return <YouTubeIcon sx={sx} />;
    case 'email': return <EmailIcon sx={sx} />;
  }
}

function HeadlineWithAccent({
  text,
  accent,
  accentColor,
  accentColorDark,
}: { text: string; accent?: string; accentColor: string; accentColorDark: string }): JSX.Element {
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
          background: `linear-gradient(180deg, ${accentColor}, ${accentColorDark})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
        // a11y fallback — WebkitBackgroundClip skjuler teksten i visse SR-er
        aria-label={accent}
      >
        {accent}
      </Box>
      {after}
    </>
  );
}

function HighlightedText({
  text,
  highlights,
  color,
}: { text: string; highlights?: string[]; color: string }): JSX.Element {
  if (!highlights || highlights.length === 0) return <>{text}</>;
  const sorted = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return <>{text}</>;
  const accent = sorted[0];
  const idx = text.indexOf(accent);
  if (idx < 0) return <HighlightedText text={text} highlights={sorted.slice(1)} color={color} />;
  const before = text.slice(0, idx);
  const after = text.slice(idx + accent.length);
  return (
    <>
      <HighlightedText text={before} highlights={sorted} color={color} />
      <Box component="span" sx={{ color, fontWeight: 700 }}>
        {accent}
      </Box>
      <HighlightedText text={after} highlights={sorted} color={color} />
    </>
  );
}

/**
 * Synchron QR-cache + async generator. Holder en in-memory cache så samme
 * URL kun genereres én gang og er klar ved eksport-tidspunktet.
 *
 * Returnerer { dataUrl, ready }-tuple. `ready` blir true når URL er
 * generert eller når URL er tom. Editor venter på `ready === true` før
 * html2canvas-snapshot.
 */
const qrCache = new Map<string, string>();
const qrPromises = new Map<string, Promise<string | null>>();

export function preloadQrCode(url: string): Promise<string | null> {
  const key = url.trim();
  if (!key) return Promise.resolve(null);
  if (qrCache.has(key)) return Promise.resolve(qrCache.get(key) ?? null);
  if (qrPromises.has(key)) return qrPromises.get(key)!;
  const p = QRCode.toDataURL(key, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: { dark: '#ffffff', light: '#00000000' },
  })
    .then((d) => {
      qrCache.set(key, d);
      qrPromises.delete(key);
      return d;
    })
    .catch(() => {
      qrPromises.delete(key);
      return null;
    });
  qrPromises.set(key, p);
  return p;
}

function useQrCodeDataUrl(url: string | undefined): { dataUrl: string | null; ready: boolean } {
  const key = (url ?? '').trim();
  const cached = key ? qrCache.get(key) ?? null : null;
  const [dataUrl, setDataUrl] = useState<string | null>(cached);
  const [ready, setReady] = useState<boolean>(!key || cached !== null);
  useEffect(() => {
    if (!key) {
      setDataUrl(null);
      setReady(true);
      return;
    }
    const cachedNow = qrCache.get(key);
    if (cachedNow) {
      setDataUrl(cachedNow);
      setReady(true);
      return;
    }
    setReady(false);
    let cancelled = false;
    void preloadQrCode(key).then((d) => {
      if (cancelled) return;
      setDataUrl(d);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return { dataUrl, ready };
}

export interface MarketingFeedPosterProps {
  fields: MarketingPosterFields;
  width?: number | string;
  variant?: PosterVariant;
  theme?: MarketingPosterTheme;
}

export const MarketingFeedPoster = forwardRef<HTMLDivElement, MarketingFeedPosterProps>(
  function MarketingFeedPoster(
    { fields, width = '100%', variant = 'standard', theme = 'purple' },
    ref,
  ) {
    const t = getTheme(theme);
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

    const { dataUrl: qrDataUrl } = useQrCodeDataUrl(qrUrl);

    const cardsToShow = variant === 'editorial' ? cards.slice(0, 2) : cards.slice(0, 4);
    const showCards = variant !== 'minimal' && cardsToShow.length > 0;
    const cardColumns = variant === 'editorial' ? 2 : Math.min(cardsToShow.length || 1, 4);

    return (
      <Box
        ref={ref}
        data-testid="marketing-poster-root"
        data-theme={theme}
        sx={{
          width,
          // min-aspect garanterer 4:5 men lar content vokse om
          // 4 cards + lang headline krever det.
          minHeight: `calc(${typeof width === 'number' ? `${width}px` : width} * 5 / 4)`,
          containerType: 'inline-size',
          background: t.background,
          color: '#fff',
          borderRadius: 2,
          overflow: 'visible',
          position: 'relative',
          fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
          boxShadow: t.shadow,
          border: `1px solid rgba(${t.glowRgb}, 0.20)`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 75% 5%, rgba(${t.glowRgb},0.18), transparent 35%)`,
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
          {/* Brand-stripe — ekte Role Room-logo + tagline */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              component="img"
              src={BRAND_LOGO_URL}
              alt="The Role Room"
              crossOrigin="anonymous"
              sx={{
                width: '14cqw',
                height: '14cqw',
                objectFit: 'contain',
                filter: `drop-shadow(0 0 4px rgba(${t.glowRgb},0.25))`,
                flexShrink: 0,
              }}
            />
            <Stack spacing={0}>
              <Typography sx={{ fontWeight: 800, fontSize: '3.4cqw', letterSpacing: '0.25cqw', color: '#fff' }}>
                THE ROLE ROOM
              </Typography>
              <Typography sx={{ fontSize: '1.9cqw', color: t.accent, fontWeight: 600 }}>
                Casting. Roles. Together.
              </Typography>
            </Stack>
          </Stack>

          <Box>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", "Times New Roman", Georgia, serif',
                fontSize: 'clamp(20px, 9cqw, 80px)',
                fontWeight: 800,
                lineHeight: 0.98,
                color: '#fff',
                letterSpacing: '-0.04em',
                whiteSpace: 'pre-line',
              }}
            >
              <HeadlineWithAccent
                text={headline}
                accent={accentText}
                accentColor={t.accent}
                accentColorDark={t.accentDark}
              />
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mt: '1.5cqw', width: '70%' }}>
              <Box sx={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, ${t.accent}, transparent)` }} />
              <Box sx={{ color: t.accent, fontSize: '2.6cqw' }}>✦</Box>
              <Box sx={{ flex: 1, height: 1.5, background: `linear-gradient(90deg, transparent, rgba(${t.glowRgb},0.4))` }} />
            </Stack>
          </Box>

          {subheading && (
            <Typography
              sx={{
                fontSize: '2.6cqw',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.4,
                maxWidth: '85%',
              }}
            >
              <HighlightedText text={subheading} highlights={subheadingHighlights} color={t.accent} />
            </Typography>
          )}

          {showCards && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cardColumns}, 1fr)`,
                gap: '1.8cqw',
              }}
            >
              {cardsToShow.map((card, i) => (
                <BriefCard key={i} card={card} accent={t.accent} glowRgb={t.glowRgb} />
              ))}
            </Box>
          )}

          <Box
            sx={{
              p: '3cqw',
              borderRadius: '2.4cqw',
              border: `1px solid rgba(${t.glowRgb},0.25)`,
              background:
                `linear-gradient(180deg, rgba(${t.glowRgb},0.10), rgba(${t.glowRgb},0.04))`,
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
                background: `rgba(${t.glowRgb},0.18)`,
                border: `1px solid rgba(${t.glowRgb},0.35)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EmailIcon sx={{ color: t.accent, fontSize: '5cqw' }} />
            </Box>
            <Stack spacing="0.6cqw" sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '3cqw', color: '#fff', lineHeight: 1.2 }}>
                <HighlightedText
                  text={ctaTitle}
                  highlights={ctaTitleAccent ? [ctaTitleAccent] : undefined}
                  color={t.accent}
                />
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
                  border: `1px solid rgba(${t.glowRgb},0.35)`,
                  background: `rgba(${t.glowRgb},0.18)`,
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
                  border: `1px dashed rgba(${t.glowRgb},0.4)`,
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

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ color: t.accent, fontSize: '2.2cqw', fontWeight: 600 }}>
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
                    background: `rgba(${t.glowRgb},0.12)`,
                    border: `1px solid rgba(${t.glowRgb},0.30)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SocialIconRender kind={s} color={t.accent} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Box>
    );
  },
);

function BriefCard({
  card,
  accent,
  glowRgb,
}: { card: PosterCard; accent: string; glowRgb: string }): JSX.Element {
  return (
    <Box
      sx={{
        p: '2.4cqw',
        borderRadius: '2.4cqw',
        border: `1px solid rgba(${glowRgb},0.22)`,
        background: card.bgImageUrl
          ? `linear-gradient(180deg, rgba(10,10,20,0.55), rgba(10,10,20,0.85)), url(${card.bgImageUrl})`
          : `linear-gradient(180deg, rgba(${glowRgb},0.10), rgba(${glowRgb},0.02))`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
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
          background: `rgba(${glowRgb},0.20)`,
          border: `1px solid rgba(${glowRgb},0.40)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CardIconRender kind={card.icon} color={accent} />
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
      <ArrowIcon sx={{ color: accent, fontSize: '3cqw', alignSelf: 'flex-start' }} />
    </Box>
  );
}

// ── Backwards-compat re-eksporter ────────────────────────────────────
// Beholdt så eksisterende WeeklyBriefEditor + spec fortsatt kompilerer
// uten endring. Slettes når alle call-sites er migrert til de nye navnene.
export type WeeklyBriefCardIcon = PosterCardIcon;
export type WeeklyBriefCard = PosterCard;
export type WeeklyBriefFields = MarketingPosterFields;
export type WeeklyBriefVariant = PosterVariant;
export type WeeklyBriefVariantDef = PosterVariantDef;
export const WEEKLY_BRIEF_VARIANTS = POSTER_VARIANTS;
export const WeeklyBriefPoster = MarketingFeedPoster;

export default MarketingFeedPoster;
