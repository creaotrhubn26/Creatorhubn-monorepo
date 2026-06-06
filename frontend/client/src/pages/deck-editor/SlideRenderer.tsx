/**
 * SlideRenderer — branded render-komponent for hver layout-type.
 *
 * Brukes i to kontekster:
 *   1. Live preview i DeckEditor (split-view ved siden av redigerings-felt)
 *   2. Print-view ved PDF-eksport
 *
 * Alle layouts har et 16:9 aspect-ratio og en lilla gradient-bakgrunn med
 * subtilt glow. Designspråket speiler hero-bildet brukeren ga som referanse.
 */

import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import {
  Verified as VerifiedIcon,
  Group as TeamIcon,
  Lock as LockIcon,
  AutoAwesome as StarIcon,
  TrendingUp as TrendingIcon,
  PersonOutline as PersonIcon,
} from '@mui/icons-material';

const RR_PURPLE = '#a78bfa';
const RR_PURPLE_DARK = '#7c3aed';
const RR_BG_GRADIENT =
  'linear-gradient(135deg, #0a0a14 0%, #1a0f2e 45%, #2a1a4a 100%)';
const SLIDE_PAPER_SX = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  borderRadius: 2,
  background: RR_BG_GRADIENT,
  color: 'rgba(255,255,255,0.92)',
  overflow: 'hidden',
  boxShadow: '0 12px 48px rgba(124,58,237,0.18)',
  border: '1px solid rgba(167,139,250,0.18)',
} as const;

type SlideContent = Record<string, unknown>;

export interface SlideRendererProps {
  layout: string;
  content: SlideContent;
  /** Når satt brukes denne i stedet for default-storrelsen (for thumbnails). */
  density?: 'normal' | 'compact';
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function PillarIcon({ kind }: { kind: string }): JSX.Element {
  const sx = { color: RR_PURPLE, fontSize: 28 };
  if (kind === 'verified') return <VerifiedIcon sx={sx} />;
  if (kind === 'team') return <TeamIcon sx={sx} />;
  if (kind === 'lock') return <LockIcon sx={sx} />;
  if (kind === 'trending') return <TrendingIcon sx={sx} />;
  return <StarIcon sx={sx} />;
}

function BrandLogo({ tagline }: { tagline?: string }): JSX.Element {
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.2,
            background:
              'linear-gradient(135deg, rgba(167,139,250,0.4), rgba(124,58,237,0.6))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(167,139,250,0.5)',
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 22, color: '#fff' }}>R</Typography>
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 16, letterSpacing: 2, color: '#fff' }}>
          THE ROLE ROOM
        </Typography>
      </Stack>
      {tagline && (
        <Typography sx={{ pl: 6.5, fontSize: 12, color: RR_PURPLE, fontWeight: 600 }}>
          {tagline}
        </Typography>
      )}
    </Stack>
  );
}

function CtaButton({
  label,
  variant,
}: {
  label: string;
  variant: 'primary' | 'secondary';
}): JSX.Element {
  if (variant === 'primary') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 3,
          py: 1.2,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${RR_PURPLE_DARK}, ${RR_PURPLE})`,
          fontWeight: 700,
          fontSize: 14,
          color: '#fff',
          boxShadow: '0 4px 18px rgba(124,58,237,0.45)',
        }}
      >
        {label} →
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 3,
        py: 1.2,
        borderRadius: 99,
        fontWeight: 600,
        fontSize: 14,
        color: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      {label}
    </Box>
  );
}

function DashboardMockup({ caption }: { caption?: string }): JSX.Element {
  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        borderRadius: 2,
        border: '1px solid rgba(167,139,250,0.3)',
        background:
          'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(124,58,237,0.05))',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.2,
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>Talent</Typography>
        <Box sx={{ width: 32, height: 14, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.08)' }} />
      </Stack>
      <Stack direction="row" spacing={0.8}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              aspectRatio: '3 / 4',
              borderRadius: 1,
              background:
                'linear-gradient(180deg, rgba(167,139,250,0.18), rgba(167,139,250,0.06))',
              border: '1px solid rgba(167,139,250,0.22)',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                bottom: 4,
                left: 4,
                right: 4,
                height: 10,
                borderRadius: 0.4,
                bgcolor: 'rgba(255,255,255,0.06)',
              }}
            />
          </Box>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
        <Box sx={{ flex: 1, height: 36, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.18)' }} />
        <Box sx={{ width: 80, height: 36, borderRadius: 1, bgcolor: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)' }} />
      </Stack>
      {caption && (
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', mt: 0.3 }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
}

// ─── Layout: hero_pillars ─────────────────────────────────────────────
function HeroPillarsSlide({ content }: { content: SlideContent }): JSX.Element {
  const heading = asString(content.heading);
  const subheading = asString(content.subheading);
  const tagline = asString(content.tagline);
  const pillars = asArray<{ icon?: string; title?: string; subtitle?: string }>(content.pillars);
  const primaryCta = asString(content.primaryCta);
  const secondaryCta = asString(content.secondaryCta);
  const footer = asString(content.footer);

  return (
    <Box sx={SLIDE_PAPER_SX}>
      {/* glow */}
      <Box
        sx={{
          position: 'absolute',
          top: -120,
          left: -80,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.30), transparent 60%)',
        }}
      />
      <Box sx={{ position: 'absolute', inset: 0, p: '4%', display: 'flex', gap: '3%' }}>
        {/* Left: hero copy */}
        <Stack spacing={2.5} sx={{ flex: 1.1, justifyContent: 'space-between' }}>
          <BrandLogo tagline={tagline} />
          <Box>
            <Typography
              sx={{
                fontSize: 'clamp(20px, 3.4cqw, 44px)',
                fontWeight: 800,
                lineHeight: 1.1,
                color: '#fff',
              }}
            >
              {heading}
            </Typography>
            {subheading && (
              <Typography
                sx={{
                  fontSize: 'clamp(16px, 2.8cqw, 36px)',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  background: `linear-gradient(90deg, ${RR_PURPLE}, #ddd6fe)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mt: 0.6,
                }}
              >
                {subheading}
              </Typography>
            )}
          </Box>
          {pillars.length > 0 && (
            <Stack direction="row" spacing={2.5}>
              {pillars.slice(0, 3).map((p, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <PillarIcon kind={asString(p.icon, 'star')} />
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                      {asString(p.title)}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.2 }}>
                      {asString(p.subtitle)}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={1.5} alignItems="center">
            {primaryCta && <CtaButton label={primaryCta} variant="primary" />}
            {secondaryCta && <CtaButton label={secondaryCta} variant="secondary" />}
          </Stack>
          {footer && (
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>🇳🇴 {footer}</Typography>
          )}
        </Stack>
        {/* Right: dashboard mockup */}
        <Box sx={{ flex: 0.95 }}>
          <DashboardMockup />
        </Box>
      </Box>
    </Box>
  );
}

// ─── Layout: problem_centered ─────────────────────────────────────────
function ProblemCenteredSlide({ content }: { content: SlideContent }): JSX.Element {
  const heading = asString(content.heading);
  const body = asString(content.body);
  const points = asArray<string>(content.points);
  return (
    <Box sx={SLIDE_PAPER_SX}>
      <Box sx={{ position: 'absolute', inset: 0, p: '5%', display: 'flex', flexDirection: 'column' }}>
        <BrandLogo />
        <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 'clamp(20px, 3.4cqw, 42px)', fontWeight: 800, color: '#fff' }}>
            {heading}
          </Typography>
          {body && (
            <Typography sx={{ fontSize: 'clamp(12px, 1.6cqw, 18px)', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, maxWidth: '80%' }}>
              {body}
            </Typography>
          )}
          {points.length > 0 && (
            <Stack
              direction="row"
              spacing={2}
              sx={{
                mt: 2,
                flexWrap: 'wrap',
                rowGap: 2,
              }}
            >
              {points.slice(0, 4).map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    flex: '1 1 calc(50% - 16px)',
                    minWidth: 140,
                    p: 2,
                    borderRadius: 1.5,
                    border: '1px solid rgba(167,139,250,0.22)',
                    bgcolor: 'rgba(167,139,250,0.06)',
                  }}
                >
                  <Box sx={{ width: 28, height: 4, bgcolor: RR_PURPLE, mb: 1, borderRadius: 1 }} />
                  <Typography sx={{ fontSize: 'clamp(11px, 1.4cqw, 15px)', color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>
                    {p}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Layout: solution_split ───────────────────────────────────────────
function SolutionSplitSlide({ content }: { content: SlideContent }): JSX.Element {
  const heading = asString(content.heading);
  const body = asString(content.body);
  const bullets = asArray<string>(content.bullets);
  const mockupCaption = asString(content.mockupCaption);
  return (
    <Box sx={SLIDE_PAPER_SX}>
      <Box sx={{ position: 'absolute', inset: 0, p: '4%', display: 'flex', gap: '4%' }}>
        <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center' }}>
          <BrandLogo />
          <Typography sx={{ fontSize: 'clamp(18px, 3cqw, 38px)', fontWeight: 800, color: '#fff' }}>
            {heading}
          </Typography>
          {body && (
            <Typography sx={{ fontSize: 'clamp(12px, 1.5cqw, 16px)', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
              {body}
            </Typography>
          )}
          {bullets.length > 0 && (
            <Stack spacing={1.2}>
              {bullets.slice(0, 5).map((b, i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: RR_PURPLE, mt: 0.8 }} />
                  <Typography sx={{ fontSize: 'clamp(11px, 1.4cqw, 14px)', color: 'rgba(255,255,255,0.92)' }}>
                    {b}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
        <Box sx={{ flex: 1 }}>
          <DashboardMockup caption={mockupCaption} />
        </Box>
      </Box>
    </Box>
  );
}

// ─── Layout: traction_stats ───────────────────────────────────────────
function TractionStatsSlide({ content }: { content: SlideContent }): JSX.Element {
  const heading = asString(content.heading);
  const stats = asArray<{ value?: string; label?: string }>(content.stats);
  const footnote = asString(content.footnote);
  return (
    <Box sx={SLIDE_PAPER_SX}>
      <Box sx={{ position: 'absolute', inset: 0, p: '5%', display: 'flex', flexDirection: 'column' }}>
        <BrandLogo />
        <Stack spacing={3} sx={{ flex: 1, justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 'clamp(20px, 3.4cqw, 42px)', fontWeight: 800, color: '#fff' }}>
            {heading}
          </Typography>
          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              background:
                'linear-gradient(180deg, rgba(167,139,250,0.10), rgba(124,58,237,0.04))',
              border: '1px solid rgba(167,139,250,0.30)',
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(stats.length, 4) || 1}, 1fr)`,
              gap: 3,
            }}
          >
            {stats.slice(0, 6).map((s, i) => (
              <Stack key={i} alignItems="flex-start" spacing={0.4}>
                <Typography
                  sx={{
                    fontSize: 'clamp(22px, 4cqw, 52px)',
                    fontWeight: 800,
                    background: `linear-gradient(90deg, #fff, ${RR_PURPLE})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 1,
                  }}
                >
                  {asString(s.value)}
                </Typography>
                <Typography sx={{ fontSize: 'clamp(10px, 1.2cqw, 14px)', color: 'rgba(255,255,255,0.7)' }}>
                  {asString(s.label)}
                </Typography>
              </Stack>
            ))}
          </Box>
          {footnote && (
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
              {footnote}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Layout: team_grid ────────────────────────────────────────────────
function TeamGridSlide({ content }: { content: SlideContent }): JSX.Element {
  const heading = asString(content.heading);
  const members = asArray<{ name?: string; role?: string; bio?: string }>(content.members);
  return (
    <Box sx={SLIDE_PAPER_SX}>
      <Box sx={{ position: 'absolute', inset: 0, p: '5%', display: 'flex', flexDirection: 'column' }}>
        <BrandLogo />
        <Stack spacing={3} sx={{ flex: 1, justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 'clamp(20px, 3.4cqw, 42px)', fontWeight: 800, color: '#fff' }}>
            {heading}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(members.length || 1, 4)}, 1fr)`,
              gap: 2,
            }}
          >
            {members.slice(0, 4).map((m, i) => (
              <Box
                key={i}
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  border: '1px solid rgba(167,139,250,0.22)',
                  bgcolor: 'rgba(167,139,250,0.05)',
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    background:
                      'linear-gradient(135deg, rgba(167,139,250,0.4), rgba(124,58,237,0.18))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 1.5,
                    maxWidth: 80,
                  }}
                >
                  <PersonIcon sx={{ color: '#fff', opacity: 0.5, fontSize: 28 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: 'clamp(12px, 1.5cqw, 16px)', lineHeight: 1.2 }}>
                  {asString(m.name)}
                </Typography>
                <Typography sx={{ color: RR_PURPLE, fontWeight: 600, fontSize: 'clamp(10px, 1.2cqw, 13px)', mb: 0.5 }}>
                  {asString(m.role)}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(10px, 1.1cqw, 12px)', lineHeight: 1.4 }}>
                  {asString(m.bio)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Layout: ask_cta ──────────────────────────────────────────────────
function AskCtaSlide({ content }: { content: SlideContent }): JSX.Element {
  const heading = asString(content.heading);
  const useOfFunds = asArray<{ label?: string; percent?: number }>(content.useOfFunds);
  const runway = asString(content.runway);
  const ctaPrimary = asString(content.ctaPrimary);
  const ctaSecondary = asString(content.ctaSecondary);
  return (
    <Box sx={SLIDE_PAPER_SX}>
      <Box sx={{ position: 'absolute', inset: 0, p: '5%', display: 'flex', flexDirection: 'column' }}>
        <BrandLogo />
        <Stack spacing={3} sx={{ flex: 1, justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 'clamp(22px, 4cqw, 48px)', fontWeight: 800, color: '#fff' }}>
            {heading}
          </Typography>
          {useOfFunds.length > 0 && (
            <Stack spacing={1.2} sx={{ maxWidth: 460 }}>
              {useOfFunds.slice(0, 5).map((u, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{asString(u.label)}</Typography>
                    <Typography sx={{ fontSize: 13, color: RR_PURPLE, fontWeight: 700 }}>{Number(u.percent ?? 0)}%</Typography>
                  </Stack>
                  <Box sx={{ height: 6, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.06)' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${Math.min(Math.max(Number(u.percent ?? 0), 0), 100)}%`,
                        borderRadius: 99,
                        background: `linear-gradient(90deg, ${RR_PURPLE_DARK}, ${RR_PURPLE})`,
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
          {runway && (
            <Chip
              label={runway}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                bgcolor: 'rgba(167,139,250,0.15)',
                color: '#fff',
                fontWeight: 700,
                border: '1px solid rgba(167,139,250,0.35)',
              }}
            />
          )}
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
            {ctaPrimary && <CtaButton label={ctaPrimary} variant="primary" />}
            {ctaSecondary && (
              <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>{ctaSecondary}</Typography>
            )}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Fallback (standard / title / cta) ────────────────────────────────
function StandardSlide({ content }: { content: SlideContent }): JSX.Element {
  const heading = asString(content.heading);
  const body = asString(content.body);
  return (
    <Box sx={SLIDE_PAPER_SX}>
      <Box sx={{ position: 'absolute', inset: 0, p: '5%', display: 'flex', flexDirection: 'column' }}>
        <BrandLogo />
        <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 'clamp(22px, 4cqw, 46px)', fontWeight: 800, color: '#fff' }}>
            {heading}
          </Typography>
          {body && (
            <Typography
              sx={{
                fontSize: 'clamp(13px, 1.8cqw, 18px)',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {body}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export const SlideRenderer: React.FC<SlideRendererProps> = ({ layout, content }) => {
  switch (layout) {
    case 'hero_pillars':
      return <HeroPillarsSlide content={content} />;
    case 'problem_centered':
      return <ProblemCenteredSlide content={content} />;
    case 'solution_split':
      return <SolutionSplitSlide content={content} />;
    case 'traction_stats':
      return <TractionStatsSlide content={content} />;
    case 'team_grid':
      return <TeamGridSlide content={content} />;
    case 'ask_cta':
      return <AskCtaSlide content={content} />;
    default:
      return <StandardSlide content={content} />;
  }
};

export default SlideRenderer;
