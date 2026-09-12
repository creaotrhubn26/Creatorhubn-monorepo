import type { ReactElement, ReactNode } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { RR_COLORS, RR_RADIUS } from './tokens';

/**
 * The centered, dashed-border empty state used across producer panels (modeled
 * on SocialInboxPanel's "Ingen events ennå" block). Supports an optional action
 * button and an optional row of hint chips.
 *
 * @example
 * <EmptyState
 *   icon={<MoveToInboxIcon sx={{ fontSize: 36 }} />}
 *   title="Ingen events ennå"
 *   description="Når koblede plattformer mottar comments, lander de her."
 *   hints={[
 *     { label: '1. Kontoer koblet', tone: 'accent' },
 *     { label: '2. Webhook subscribed', tone: 'positive' },
 *   ]}
 *   action={{ label: 'Koble konto', onClick: connect }}
 * />
 */
export type EmptyStateHintTone = 'accent' | 'positive' | 'neutral' | 'warning' | 'negative';

export interface EmptyStateHint {
  label: ReactNode;
  /** Color tone for the chip — defaults to 'neutral'. */
  tone?: EmptyStateHintTone;
}

export interface EmptyStateProps {
  /** Optional icon rendered centered above the title (muted). */
  icon?: ReactNode;
  /** Heading line. */
  title: ReactNode;
  /** Optional supporting copy under the title. */
  description?: ReactNode;
  /** Optional leading text shown before the hint chips (e.g. "Sjekk:"). */
  hintsLabel?: ReactNode;
  /** Optional row of hint chips. */
  hints?: EmptyStateHint[];
  /** Optional primary action button. */
  action?: { label: ReactNode; onClick: () => void };
  /** Optional test id on the wrapper. */
  testId?: string;
}

const HINT_TONE: Record<EmptyStateHintTone, { bg: string; color: string; border: string }> = {
  accent: { bg: RR_COLORS.accentBg, color: RR_COLORS.accent, border: '1px solid rgba(34,211,238,0.3)' },
  positive: { bg: 'rgba(134,239,172,0.12)', color: RR_COLORS.positive, border: '1px solid rgba(134,239,172,0.3)' },
  neutral: { bg: 'rgba(148,163,184,0.12)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.25)' },
  warning: { bg: 'rgba(251,191,36,0.12)', color: RR_COLORS.warning, border: '1px solid rgba(251,191,36,0.3)' },
  negative: { bg: 'rgba(248,113,113,0.12)', color: RR_COLORS.negative, border: '1px solid rgba(248,113,113,0.3)' },
};

export default function EmptyState({
  icon,
  title,
  description,
  hintsLabel,
  hints,
  action,
  testId,
}: EmptyStateProps): ReactElement {
  return (
    <Box
      data-testid={testId}
      sx={{
        textAlign: 'center',
        py: 4,
        px: 2,
        color: RR_COLORS.textMuted,
        bgcolor: RR_COLORS.mutedBg,
        borderRadius: RR_RADIUS.panel,
        border: RR_COLORS.dashedBorder,
      }}
    >
      {icon != null ? (
        <Box sx={{ color: RR_COLORS.textFaint, mb: 1, '& .MuiSvgIcon-root': { color: RR_COLORS.textFaint } }}>
          {icon}
        </Box>
      ) : null}
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, mb: 0.5, color: RR_COLORS.heading }}>
        {title}
      </Typography>
      {description != null ? (
        <Typography sx={{ fontSize: '0.78rem', mb: hints?.length || action ? 1.5 : 0, opacity: 0.85 }}>
          {description}
        </Typography>
      ) : null}

      {hints && hints.length > 0 ? (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1.5 }}
        >
          {hintsLabel != null ? (
            <Typography sx={{ color: RR_COLORS.textFaint, fontSize: '0.74rem' }}>{hintsLabel}</Typography>
          ) : null}
          {hints.map((h, i) => {
            const tone = HINT_TONE[h.tone ?? 'neutral'];
            return (
              <Chip
                key={i}
                size="small"
                label={h.label}
                sx={{ fontSize: '0.7rem', bgcolor: tone.bg, color: tone.color, border: tone.border }}
              />
            );
          })}
        </Stack>
      ) : null}

      {action ? (
        <Box sx={{ mt: 2 }}>
          <Button
            size="small"
            variant="contained"
            onClick={action.onClick}
            sx={{
              textTransform: 'none',
              fontSize: '0.78rem',
              bgcolor: RR_COLORS.accentBg,
              color: RR_COLORS.accent,
              boxShadow: 'none',
              '&:hover': { bgcolor: 'rgba(34,211,238,0.22)', boxShadow: 'none' },
            }}
          >
            {action.label}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
