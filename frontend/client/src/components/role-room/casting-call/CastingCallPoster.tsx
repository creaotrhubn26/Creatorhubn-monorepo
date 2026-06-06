/**
 * CastingCallPoster — Role Room-branded 9:16 sharable poster for en åpen
 * casting-rolle. Brukes som Story/Reel-format-asset for sosial-media-
 * distribusjon.
 *
 * Pure visuell komponent. Tar inn fullt strukturert PosterFields og
 * rendrer det. PNG-eksport håndteres av kalleren (typisk html2canvas
 * mot det ytterste boksen).
 */

import React, { forwardRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  Verified as VerifiedIcon,
  Movie as MovieIcon,
  TheaterComedy as DramaIcon,
  PersonOutline as PersonIcon,
  Place as PlaceIcon,
  CalendarToday as CalendarIcon,
  Shield as ShieldIcon,
  Send as SendIcon,
  ArrowForward as ArrowIcon,
  FormatQuote as QuoteIcon,
  LiveTv as TvIcon,
  PhotoCamera as CameraIcon,
  RadioButtonChecked as DotIcon,
} from '@mui/icons-material';

const RR_PURPLE = '#a78bfa';
const RR_PURPLE_DARK = '#7c3aed';

export interface PosterStat {
  /** Felt-tittel, f.eks. "PRODUKSJON" eller "ALDER" */
  label: string;
  /** Verdi vist under tittelen, f.eks. "Nordlys" eller "25-35" */
  value: string;
  /** Ikon-key — se POSTER_STAT_ICONS for tilgjengelige verdier */
  icon?: PosterStatIcon;
  /** Sett true for å gjøre raden full-bredde (f.eks. STATUS) */
  fullWidth?: boolean;
  /** Vises som verifisert-badge ved siden av verdien (f.eks. "Verified casting") */
  verifiedBadge?: boolean;
}

export type PosterStatIcon =
  | 'production'
  | 'format'
  | 'genre'
  | 'age'
  | 'location'
  | 'calendar'
  | 'shield'
  | 'tv'
  | 'camera';

export interface PosterFields {
  /** Pill-chip øverst, default "CASTING CALL" */
  badge?: string;
  /** Hvit headline-linje, default "Open role" */
  headline?: string;
  /** Lilla gradient-linje (rolle-navnet) */
  roleName: string;
  /** Fakta-grid (typisk 6 stats i 2 kolonner + 1 full-bredde status) */
  stats: PosterStat[];
  /** Sitat-blokk (rolle-beskrivelse i kort form) */
  quote?: string;
  /** Apply-CTA-tekst, default "Apply now" */
  ctaLabel?: string;
  /** Apply-link (vises ikke i poster, men brukes av delelink) */
  applyUrl?: string;
  /** Tagline nederst, default "Casting. Roles. Together." */
  tagline?: string;
  /** Footer-tekst, default "Verified by The Role Room" */
  footerVerified?: string;
}

export const POSTER_STAT_ICON_OPTIONS: PosterStatIcon[] = [
  'production',
  'format',
  'genre',
  'age',
  'location',
  'calendar',
  'shield',
  'tv',
  'camera',
];

function StatIcon({ kind }: { kind: PosterStatIcon | undefined }): JSX.Element {
  const sx = { color: RR_PURPLE, fontSize: 22 };
  switch (kind) {
    case 'production':
      return <MovieIcon sx={sx} />;
    case 'format':
      return <CameraIcon sx={sx} />;
    case 'genre':
      return <DramaIcon sx={sx} />;
    case 'age':
      return <PersonIcon sx={sx} />;
    case 'location':
      return <PlaceIcon sx={sx} />;
    case 'calendar':
      return <CalendarIcon sx={sx} />;
    case 'shield':
      return <ShieldIcon sx={sx} />;
    case 'tv':
      return <TvIcon sx={sx} />;
    case 'camera':
      return <CameraIcon sx={sx} />;
    default:
      return <DotIcon sx={sx} />;
  }
}

export type CastingCallPosterVariant = 'standard' | 'minimal' | 'quote_first';

export interface CastingCallPosterVariantDef {
  id: CastingCallPosterVariant;
  label: string;
  description: string;
}

export const CASTING_CALL_POSTER_VARIANTS: CastingCallPosterVariantDef[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Headline + fakta-grid + sitat + CTA. Brukes som default.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Kun headline + rolle-navn + Apply-CTA. Best for tease-posts.',
  },
  {
    id: 'quote_first',
    label: 'Sitat-først',
    description: 'Stort sitat dominerer, fakta-grid er kompakt nederst.',
  },
];

export interface CastingCallPosterProps {
  fields: PosterFields;
  /** Width-styring; default = 100% av containeren */
  width?: number | string;
  /** Variant — kontrollerer hvilke seksjoner som rendres og rekkefølge */
  variant?: CastingCallPosterVariant;
}

const POSTER_BG =
  'radial-gradient(circle at 20% 12%, rgba(167,139,250,0.30), transparent 45%),' +
  ' radial-gradient(circle at 95% 90%, rgba(124,58,237,0.22), transparent 50%),' +
  ' linear-gradient(180deg, #0a0a14 0%, #100923 50%, #1a0f2e 100%)';

export const CastingCallPoster = forwardRef<HTMLDivElement, CastingCallPosterProps>(
  function CastingCallPoster({ fields, width = '100%', variant = 'standard' }, ref) {
    const {
      badge = 'CASTING CALL',
      headline = 'Open role',
      roleName,
      stats,
      quote,
      ctaLabel = 'Apply now',
      tagline = 'Casting. Roles. Together.',
      footerVerified = 'Verified by The Role Room',
    } = fields;

    // Splitt stats i full-width vs grid-rader for layout
    const gridStats = stats.filter((s) => !s.fullWidth);
    const fullWidthStats = stats.filter((s) => s.fullWidth);

    // Variant-flagg styrer hvilke seksjoner som vises og rekkefølge.
    // Minimal: kun headline + rolle + CTA + footer.
    // Quote-first: sitat over fakta-grid (omvendt), og fakta-grid komprimeres.
    const showStats = variant !== 'minimal';
    const showQuote = variant !== 'minimal' && !!quote;
    const quoteFirst = variant === 'quote_first';
    const compactStats = variant === 'quote_first';

    return (
      <Box
        ref={ref}
        sx={{
          width,
          aspectRatio: '9 / 16',
          containerType: 'inline-size',
          background: POSTER_BG,
          color: '#fff',
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
          boxShadow: '0 20px 60px rgba(124,58,237,0.25)',
          border: '1px solid rgba(167,139,250,0.18)',
        }}
      >
        {/* Subtilt scanline/grain ville krevd shader; bruker bare et glow-overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.10), transparent 35%)',
            pointerEvents: 'none',
          }}
        />

        <Stack
          spacing="4cqw"
          sx={{
            position: 'relative',
            zIndex: 1,
            p: '6cqw',
            height: '100%',
            justifyContent: 'space-between',
          }}
        >
          {/* ── Header: logo + tagline ───────────────────────────── */}
          <Stack alignItems="center" spacing="1cqw">
            <Stack direction="row" alignItems="center" spacing={1.4}>
              <Box
                sx={{
                  width: '10cqw',
                  height: '10cqw',
                  borderRadius: '2cqw',
                  background:
                    'linear-gradient(135deg, rgba(167,139,250,0.45), rgba(124,58,237,0.7))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(167,139,250,0.5)',
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: '5.5cqw', color: '#fff' }}>R</Typography>
              </Box>
              <Stack spacing={0}>
                <Typography sx={{ fontWeight: 800, fontSize: '4.4cqw', letterSpacing: '0.3cqw', color: '#fff' }}>
                  THE ROLE ROOM
                </Typography>
                <Typography sx={{ fontSize: '2.4cqw', color: RR_PURPLE, fontWeight: 600 }}>
                  {tagline}
                </Typography>
              </Stack>
            </Stack>
          </Stack>

          {/* ── Badge + headline ─────────────────────────────────── */}
          <Stack alignItems="center" spacing="2cqw">
            <Box
              sx={{
                px: '4cqw',
                py: '1.2cqw',
                borderRadius: 99,
                border: '1px solid rgba(167,139,250,0.45)',
                background: 'rgba(167,139,250,0.10)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1.4cqw',
              }}
            >
              <Box
                sx={{
                  width: '1.8cqw',
                  height: '1.8cqw',
                  borderRadius: '50%',
                  bgcolor: RR_PURPLE,
                  boxShadow: `0 0 8px ${RR_PURPLE}`,
                }}
              />
              <Typography sx={{ fontWeight: 700, letterSpacing: '0.4cqw', fontSize: '2.8cqw', color: '#fff' }}>
                {badge}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: '9cqw',
                fontWeight: 800,
                lineHeight: 1.0,
                color: '#fff',
                textAlign: 'center',
              }}
            >
              {headline}
            </Typography>
            <Typography
              sx={{
                fontSize: '8.4cqw',
                fontWeight: 800,
                lineHeight: 1.0,
                background: `linear-gradient(90deg, ${RR_PURPLE}, #ddd6fe)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textAlign: 'center',
              }}
            >
              {roleName}
            </Typography>
            {/* divider + sparkle */}
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ width: '60%', mt: '0.6cqw' }}>
              <Box sx={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5))' }} />
              <Box sx={{ color: RR_PURPLE, fontSize: '3cqw' }}>✦</Box>
              <Box sx={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(167,139,250,0.5), transparent)' }} />
            </Stack>
          </Stack>

          {/* ── Quote først (quote_first-variant) ───────────────── */}
          {showQuote && quoteFirst && (
            <Box
              sx={{
                position: 'relative',
                p: '5cqw',
                borderRadius: '2.4cqw',
                border: '1px solid rgba(167,139,250,0.28)',
                background:
                  'linear-gradient(180deg, rgba(167,139,250,0.12), rgba(167,139,250,0.04))',
                overflow: 'hidden',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <QuoteIcon sx={{ color: RR_PURPLE, fontSize: '8cqw' }} />
                <Typography
                  sx={{
                    fontSize: '4.4cqw',
                    lineHeight: 1.4,
                    color: '#fff',
                    fontStyle: 'italic',
                    fontWeight: 500,
                  }}
                >
                  {quote}
                </Typography>
              </Stack>
            </Box>
          )}

          {/* ── Stats grid (skjules helt for minimal) ─────────────── */}
          {showStats && (
            <Stack spacing="2cqw">
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: compactStats ? '1.4cqw' : '2cqw',
                }}
              >
                {gridStats.map((stat, i) => (
                  <StatCard key={i} stat={stat} compact={compactStats} />
                ))}
              </Box>
              {fullWidthStats.map((stat, i) => (
                <StatCard key={`fw-${i}`} stat={stat} fullWidth compact={compactStats} />
              ))}
            </Stack>
          )}

          {/* ── Quote etter stats (standard) ───────────────────── */}
          {showQuote && !quoteFirst && (
            <Box
              sx={{
                position: 'relative',
                p: '4cqw',
                borderRadius: '2.4cqw',
                border: '1px solid rgba(167,139,250,0.20)',
                background:
                  'linear-gradient(180deg, rgba(167,139,250,0.06), rgba(167,139,250,0.02))',
                overflow: 'hidden',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <QuoteIcon sx={{ color: RR_PURPLE, fontSize: '6cqw' }} />
                <Typography
                  sx={{
                    fontSize: '3.3cqw',
                    lineHeight: 1.45,
                    color: 'rgba(255,255,255,0.92)',
                    fontStyle: 'italic',
                  }}
                >
                  {quote}
                </Typography>
              </Stack>
            </Box>
          )}

          {/* ── CTA ──────────────────────────────────────────────── */}
          <Stack alignItems="center" spacing="2cqw">
            <Box
              sx={{
                width: '100%',
                py: '4cqw',
                borderRadius: 99,
                background: `linear-gradient(90deg, ${RR_PURPLE_DARK}, ${RR_PURPLE})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3cqw',
                boxShadow: `0 8px 32px rgba(124,58,237,0.45)`,
              }}
            >
              <SendIcon sx={{ color: '#fff', fontSize: '5cqw' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '5cqw', color: '#fff' }}>
                {ctaLabel}
              </Typography>
              <ArrowIcon sx={{ color: '#fff', fontSize: '5cqw' }} />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <ShieldIcon sx={{ color: RR_PURPLE, fontSize: '3.4cqw' }} />
              <Typography sx={{ color: RR_PURPLE, fontSize: '2.6cqw', fontWeight: 600 }}>
                {footerVerified}
              </Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '2.4cqw' }}>{tagline}</Typography>
          </Stack>
        </Stack>
      </Box>
    );
  },
);

interface StatCardProps {
  stat: PosterStat;
  fullWidth?: boolean;
  compact?: boolean;
}

function StatCard({ stat, fullWidth, compact }: StatCardProps): JSX.Element {
  return (
    <Box
      sx={{
        p: compact ? '2.2cqw' : '3cqw',
        borderRadius: '2.4cqw',
        border: '1px solid rgba(167,139,250,0.20)',
        background:
          'linear-gradient(180deg, rgba(167,139,250,0.08), rgba(167,139,250,0.02))',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '2cqw' : '3cqw',
        minWidth: 0,
        ...(fullWidth ? { gridColumn: '1 / -1' } : {}),
      }}
    >
      <Box
        sx={{
          width: compact ? '7.5cqw' : '10cqw',
          height: compact ? '7.5cqw' : '10cqw',
          borderRadius: '2cqw',
          background: 'rgba(167,139,250,0.18)',
          border: '1px solid rgba(167,139,250,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <StatIcon kind={stat.icon} />
      </Box>
      <Stack spacing="0.4cqw" sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            color: RR_PURPLE,
            fontSize: compact ? '2cqw' : '2.4cqw',
            fontWeight: 700,
            letterSpacing: '0.3cqw',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          {stat.label}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            sx={{
              color: '#fff',
              fontSize: compact ? '3cqw' : '3.8cqw',
              fontWeight: 800,
              lineHeight: 1.1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {stat.value}
          </Typography>
          {stat.verifiedBadge && (
            <VerifiedIcon sx={{ color: RR_PURPLE, fontSize: '3.4cqw', flexShrink: 0 }} />
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export default CastingCallPoster;
