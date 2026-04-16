// @ts-nocheck
/**
 * RoleRoomMobileTopBar — compact sticky topbar for mobile + iPad.
 *
 * Covers backlog items 026, 033, 034, 038, 046, 049:
 *  - 026: compact mobile topbar with project name, status, one primary action
 *  - 033: active role shown as compact pill
 *  - 034: profile/icon buttons meet 44px touch target (via .rr-mobile-topbar CSS)
 *  - 038: sync status as small icon, not full text line
 *  - 046: aria-labels on all icon buttons
 *  - 049: lives above the tab surface so it doesn't re-mount on tab change
 *
 * Presentational only — state is owned by RoleRoomDashboardPanel.
 */

import React from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  CloudSync as CloudSyncIcon,
  ExpandMore as ExpandMoreIcon,
  Inbox as InboxIcon,
  Person as PersonIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

export type MobileSyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface RoleRoomMobileTopBarProps {
  projectName: string | null;
  projectCount: number;
  activeRoleLabel?: string | null;
  syncStatus?: MobileSyncStatus;
  onOpenProjectSwitcher: (anchor: HTMLElement) => void;
  onRefresh: () => void;
  onCreateProject: () => void;
  refreshDisabled?: boolean;

  /** Item 042: show a chip when workspace was restored from last session. */
  restoredFromSession?: boolean;
  onDismissRestoredChip?: () => void;

  /** Item 028: Innboks top action. */
  onOpenInbox?: (anchor: HTMLElement) => void;
  inboxUnreadCount?: number;

  /** Item 028: Profil top action. */
  onOpenProfile?: (anchor: HTMLElement) => void;
  profileInitials?: string | null;
}

const SYNC_ICON: Record<MobileSyncStatus, React.ReactNode> = {
  idle: <CloudDoneIcon fontSize="small" />,
  syncing: <CloudSyncIcon fontSize="small" />,
  success: <CloudDoneIcon fontSize="small" />,
  error: <CloudOffIcon fontSize="small" />,
  offline: <CloudOffIcon fontSize="small" />,
};

const SYNC_LABEL: Record<MobileSyncStatus, string> = {
  idle: 'Synkronisert',
  syncing: 'Synkroniserer …',
  success: 'Synkronisert',
  error: 'Synkroniseringsfeil',
  offline: 'Frakoblet',
};

export const RoleRoomMobileTopBar: React.FC<RoleRoomMobileTopBarProps> = ({
  projectName,
  projectCount,
  activeRoleLabel,
  syncStatus = 'idle',
  onOpenProjectSwitcher,
  onRefresh,
  onCreateProject,
  refreshDisabled,
  restoredFromSession,
  onDismissRestoredChip,
  onOpenInbox,
  inboxUnreadCount = 0,
  onOpenProfile,
  profileInitials,
}) => {
  const projectLabel = projectName ?? (projectCount === 0 ? 'Ingen prosjekter' : 'Velg prosjekt');
  const switcherDisabled = projectCount === 0;

  return (
    <Box
      className="rr-mobile-topbar"
      component="header"
      role="banner"
      aria-label="The Role Room topbar"
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ flex: 1, minWidth: 0 }}
      >
        <Button
          onClick={(event) => onOpenProjectSwitcher(event.currentTarget)}
          disabled={switcherDisabled}
          endIcon={switcherDisabled ? null : <ExpandMoreIcon fontSize="small" />}
          aria-haspopup="dialog"
          aria-label={`Bytt prosjekt. Aktivt prosjekt: ${projectLabel}`}
          sx={{
            textTransform: 'none',
            color: 'inherit',
            px: 1,
            py: 0.5,
            minHeight: 'var(--rr-touch-target-min, 44px)',
            maxWidth: '100%',
            justifyContent: 'flex-start',
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={700}
            noWrap
            sx={{ maxWidth: '60vw' }}
          >
            {projectLabel}
          </Typography>
        </Button>

        {activeRoleLabel ? (
          <Chip
            size="small"
            label={activeRoleLabel}
            className="rr-mobile-topbar__role-pill"
            aria-label={`Aktiv rolle: ${activeRoleLabel}`}
            sx={{
              fontWeight: 600,
              bgcolor: 'rgba(124,58,237,0.12)',
              color: '#6d28d9',
              maxWidth: 140,
            }}
          />
        ) : null}

        {restoredFromSession ? (
          <Chip
            size="small"
            icon={<PlayArrowIcon fontSize="small" />}
            label="Fortsetter siste økt"
            onDelete={onDismissRestoredChip}
            aria-label="Arbeidsområdet er gjenopprettet fra siste økt"
            sx={{
              fontWeight: 600,
              bgcolor: 'rgba(16,185,129,0.12)',
              color: '#047857',
            }}
          />
        ) : null}
      </Stack>

      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Tooltip title={SYNC_LABEL[syncStatus]}>
          <Box
            aria-label={SYNC_LABEL[syncStatus]}
            role="status"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--rr-touch-target-min, 44px)',
              height: 'var(--rr-touch-target-min, 44px)',
              color:
                syncStatus === 'error' || syncStatus === 'offline'
                  ? '#b91c1c'
                  : syncStatus === 'syncing'
                    ? '#6366f1'
                    : '#16a34a',
            }}
          >
            {syncStatus === 'syncing' ? (
              <CircularProgress size={18} thickness={5} color="inherit" />
            ) : (
              SYNC_ICON[syncStatus]
            )}
          </Box>
        </Tooltip>

        <Tooltip title="Oppdater">
          <span>
            <IconButton
              onClick={onRefresh}
              disabled={refreshDisabled}
              aria-label="Oppdater prosjekter"
              sx={{
                width: 'var(--rr-touch-target-min, 44px)',
                height: 'var(--rr-touch-target-min, 44px)',
              }}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>

        {onOpenInbox ? (
          <Tooltip title="Innboks">
            <IconButton
              onClick={(event) => onOpenInbox(event.currentTarget)}
              aria-label={
                inboxUnreadCount > 0
                  ? `Innboks, ${inboxUnreadCount} uleste varsler`
                  : 'Innboks'
              }
              sx={{
                width: 'var(--rr-touch-target-min, 44px)',
                height: 'var(--rr-touch-target-min, 44px)',
              }}
            >
              <Badge
                color="error"
                badgeContent={inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                invisible={inboxUnreadCount === 0}
                overlap="circular"
              >
                <InboxIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        ) : null}

        {onOpenProfile ? (
          <Tooltip title="Profil">
            <IconButton
              onClick={(event) => onOpenProfile(event.currentTarget)}
              aria-label="Åpne profilmeny"
              sx={{
                width: 'var(--rr-touch-target-min, 44px)',
                height: 'var(--rr-touch-target-min, 44px)',
                p: 0,
              }}
            >
              {profileInitials ? (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: 14,
                    fontWeight: 700,
                    bgcolor: '#6366f1',
                  }}
                >
                  {profileInitials}
                </Avatar>
              ) : (
                <PersonIcon />
              )}
            </IconButton>
          </Tooltip>
        ) : null}

        <Tooltip title="Nytt prosjekt">
          <IconButton
            onClick={onCreateProject}
            aria-label="Opprett nytt prosjekt"
            sx={{
              width: 'var(--rr-touch-target-min, 44px)',
              height: 'var(--rr-touch-target-min, 44px)',
              color: '#fff',
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' },
            }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};

export default RoleRoomMobileTopBar;
