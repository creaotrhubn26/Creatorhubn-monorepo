import type { ReactElement, ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { RR_COLORS, RR_TYPE } from './tokens';

/**
 * The header row every producer panel repeats: an accent-colored icon, a strong
 * title, an optional muted subtitle, and an optional right-aligned actions slot
 * (refresh button, filters, etc). Mirrors the header in SocialInboxPanel /
 * SocialAnalyticsPanel exactly.
 *
 * @example
 * <PanelHeader
 *   icon={<MoveToInboxIcon />}
 *   title="Inbox"
 *   subtitle={`${count} hendelser`}
 *   actions={
 *     <Tooltip title="Oppdater">
 *       <IconButton size="small" onClick={refresh}><RefreshIcon /></IconButton>
 *     </Tooltip>
 *   }
 * />
 */
export interface PanelHeaderProps {
  /** Header icon — rendered in the accent color at default size. */
  icon: ReactElement;
  /** Strong heading text (~1.05rem / 800). */
  title: ReactNode;
  /** Optional muted line under the title. */
  subtitle?: ReactNode;
  /** Optional right-aligned slot (buttons, filters). */
  actions?: ReactNode;
  /** Optional test id on the wrapping row. */
  testId?: string;
}

export default function PanelHeader({
  icon,
  title,
  subtitle,
  actions,
  testId,
}: PanelHeaderProps): ReactElement {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="space-between"
      data-testid={testId}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          sx={{
            color: RR_COLORS.accent,
            display: 'flex',
            alignItems: 'center',
            '& .MuiSvgIcon-root': { color: RR_COLORS.accent },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ ...RR_TYPE.header, color: RR_COLORS.headingStrong }}>
            {title}
          </Typography>
          {subtitle != null ? (
            <Typography sx={{ ...RR_TYPE.body, color: RR_COLORS.textMuted }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Stack>
      {actions != null ? (
        <Box sx={{ flexShrink: 0 }}>{actions}</Box>
      ) : null}
    </Stack>
  );
}
