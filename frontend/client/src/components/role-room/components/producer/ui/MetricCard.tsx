import type { ReactElement, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { RR_COLORS, RR_RADIUS, RR_TYPE } from './tokens';

/**
 * The KPI card from SocialAnalyticsPanel: an uppercase tracked label, a big
 * value, an optional caption, and an accent-colored left border. Designed to be
 * laid out in a flex-wrap row of cards.
 *
 * @example
 * <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
 *   <MetricCard label="Events 7d" value="1.2K" caption="42 ulest" accent="#22d3ee" />
 *   <MetricCard label="Positive 30d" value="318" accent="#86efac" />
 * </Stack>
 */
export interface MetricCardProps {
  /** Uppercase label above the value. */
  label: ReactNode;
  /** Big value text. */
  value: ReactNode;
  /** Optional caption under the value. */
  caption?: ReactNode;
  /** Left-border accent color — defaults to the cyan accent. */
  accent?: string;
  /** Optional test id. */
  testId?: string;
}

export default function MetricCard({
  label,
  value,
  caption,
  accent,
  testId,
}: MetricCardProps): ReactElement {
  return (
    <Box
      data-testid={testId}
      sx={{
        flex: '1 1 160px',
        minWidth: 160,
        p: 1.4,
        borderRadius: RR_RADIUS.panel,
        bgcolor: RR_COLORS.cardBg,
        border: RR_COLORS.border,
        borderLeft: `3px solid ${accent ?? RR_COLORS.accent}`,
      }}
    >
      <Typography sx={{ ...RR_TYPE.label, color: RR_COLORS.textFaint }}>{label}</Typography>
      <Typography sx={{ ...RR_TYPE.metricValue, color: RR_COLORS.heading, mt: 0.3 }}>
        {value}
      </Typography>
      {caption != null ? (
        <Typography sx={{ color: RR_COLORS.textFaint, fontSize: '0.72rem', mt: 0.2 }}>
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}
