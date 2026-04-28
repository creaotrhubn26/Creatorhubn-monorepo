/**
 * MyTeamsHeader — kompakt indikator + bytter for multi-team-medlemskap.
 *
 * Vises i toppen av DanceWorkspace. Hvis brukeren er i 1 team: viser bare
 * label. Hvis 2+: viser dropdown der man kan bytte aktivt team.
 *
 * Aktivt team styres av URL-param ?team=<orgId>. Default er første team
 * fra listen.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  Menu,
  MenuItem,
  Chip,
} from '@mui/material';
import {
  ExpandMoreOutlined as ExpandIcon,
  GroupsOutlined as TeamIcon,
  CheckCircleOutlined as ActiveIcon,
} from '@mui/icons-material';
import * as svc from './danceTeamService';
import type { DanceTeamMembershipDetail } from './danceTeamService';

const PURPLE_LIGHT = '#a78bfa';
const TEXT_DIM     = 'rgba(229,231,235,0.78)';
const TEXT_MUTED   = 'rgba(229,231,235,0.50)';

interface Props {
  memberships: DanceTeamMembershipDetail[];
  activeTeamOrgId: string | null;
  onSwitchTeam?: (teamOrgId: string) => void;
}

export const MyTeamsHeader: React.FC<Props> = ({ memberships, activeTeamOrgId, onSwitchTeam }) => {
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const active = memberships.find((m) => m.team.teamOrganizationId === activeTeamOrgId)
    ?? memberships[0];

  if (!active) return null;

  if (memberships.length === 1) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: TEXT_DIM }}>
        <TeamIcon sx={{ fontSize: 18, color: PURPLE_LIGHT }} />
        <Typography sx={{ fontSize: 12, color: TEXT_MUTED, letterSpacing: 0.5 }}>
          DITT TEAM
        </Typography>
        <Chip
          label={active.role?.label ?? 'medlem'}
          size="small"
          sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontWeight: 600, height: 20, fontSize: 11 }}
        />
      </Stack>
    );
  }

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ExpandIcon />}
        startIcon={<TeamIcon sx={{ color: PURPLE_LIGHT }} />}
        sx={{
          textTransform: 'none',
          color: 'rgba(237,233,254,0.92)',
          bgcolor: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(167,139,250,0.18)',
          borderRadius: 2,
          px: 1.5, py: 0.5,
          '&:hover': { bgcolor: 'rgba(139,92,246,0.14)' },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
            {active.role?.label ?? 'medlem'}
          </Typography>
          <Chip
            label={`${memberships.length} team`}
            size="small"
            sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: PURPLE_LIGHT, fontWeight: 700, height: 18, fontSize: 10 }}
          />
        </Stack>
      </Button>
      <Menu
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        PaperProps={{ sx: { bgcolor: '#0f0a1c', border: '1px solid rgba(167,139,250,0.18)', minWidth: 240 } }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(167,139,250,0.10)' }}>
          <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
            DINE TEAM
          </Typography>
        </Box>
        {memberships.map((m) => {
          const isActive = m.team.teamOrganizationId === active.team.teamOrganizationId;
          return (
            <MenuItem
              key={m.member.memberRowId}
              selected={isActive}
              onClick={() => {
                setAnchor(null);
                if (!isActive) onSwitchTeam?.(m.team.teamOrganizationId);
              }}
              sx={{ py: 1.25 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, color: 'rgba(237,233,254,0.95)', fontWeight: 600 }}>
                    {m.role?.label ?? 'medlem'}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: TEXT_MUTED }}>
                    {m.team.activeMemberCount} aktiv{m.team.activeMemberCount === 1 ? '' : 'e'} medlem{m.team.activeMemberCount === 1 ? '' : 'mer'}
                  </Typography>
                </Box>
                {isActive ? <ActiveIcon sx={{ fontSize: 18, color: PURPLE_LIGHT }} /> : null}
              </Stack>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

/** Hook som henter alle medlemskap én gang og cacher i en singleton. */
let cachedMemberships: { data: DanceTeamMembershipDetail[]; fetchedAt: number } | null = null;
const MEMBERSHIPS_TTL_MS = 60_000;

export function useMyMemberships(): {
  loading: boolean;
  memberships: DanceTeamMembershipDetail[];
  refresh: () => Promise<void>;
} {
  const [state, setState] = React.useState<{ loading: boolean; data: DanceTeamMembershipDetail[] }>(
    () => ({ loading: !cachedMemberships, data: cachedMemberships?.data ?? [] }),
  );

  const refresh = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await svc.listMyMemberships();
      cachedMemberships = { data, fetchedAt: Date.now() };
      setState({ loading: false, data });
    } catch {
      setState({ loading: false, data: [] });
    }
  }, []);

  React.useEffect(() => {
    if (cachedMemberships && Date.now() - cachedMemberships.fetchedAt < MEMBERSHIPS_TTL_MS) {
      setState({ loading: false, data: cachedMemberships.data });
      return;
    }
    void refresh();
  }, [refresh]);

  return { loading: state.loading, memberships: state.data, refresh };
}

export default MyTeamsHeader;
