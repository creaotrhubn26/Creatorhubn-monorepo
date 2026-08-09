// @ts-nocheck
/**
 * RoleRoomMobileProfileSheet — profile + workspace info for mobile + iPad + desktop.
 *
 * Covers backlog items:
 *  - 039/040: workspace + Google status inside profile modal on mobile
 *  - 045: logout as secondary action with extra spacing (destructive-gap)
 *  - Dans-vertikal: admin-only profession-mode switcher inside profile modal.
 *
 * Phone: fullscreen bottom sheet. iPad/desktop: popover anchored to profile button.
 */

import React, { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  StorageOutlined as StorageOutlinedIcon,
  SwapHoriz as ModeIcon,
  EventAvailable as EventAvailableIcon,
} from '@mui/icons-material';
import { IconButton as MuiIconButton } from '@mui/material';

import type { RoleRoomViewportMode } from '../hooks/useRoleRoomViewportMode';
import ProfessionModeSwitcher from './ProfessionModeSwitcher';
import { getActiveProfessionMode } from '../config/professionMode';
import RoleRoomOnboardingDialog from './RoleRoomOnboardingDialog';
import RoleRoomMemberDirectoryDialog from './RoleRoomMemberDirectoryDialog';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import RoleRoomStoragePanel from './RoleRoomStoragePanel';
import { roleRoomMemberProfileService } from '../services/roleRoomMemberProfileService';
import type { RoleRoomMemberProfile } from '../services/roleRoomMemberProfileService';
import { useT } from '../../../i18n';

interface ProfileWorkspaceSummary {
  companyName?: string | null;
  planName?: string | null;
  statusLabel?: string | null;
}

interface RoleRoomMobileProfileSheetProps {
  open: boolean;
  onClose: () => void;
  mode: RoleRoomViewportMode;
  anchorEl?: HTMLElement | null;
  displayName?: string | null;
  email?: string | null;
  roleLabel?: string | null;
  workspaceSummary?: ProfileWorkspaceSummary | null;
  onLogout?: () => void;
  /** Admin-only: vis profession-mode-switcher i profilen. */
  isAdmin?: boolean;
}

function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length === 1) return source.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const RoleRoomMobileProfileSheet: React.FC<RoleRoomMobileProfileSheetProps> = ({
  open,
  onClose,
  mode,
  anchorEl,
  displayName,
  email,
  roleLabel,
  workspaceSummary,
  onLogout,
  isAdmin,
}) => {
  const { t } = useT();
  const usePopover =
    mode === 'tabletPortrait' || mode === 'tabletLandscape' || mode === 'desktop';
  const showWorkspace = Boolean(
    workspaceSummary?.statusLabel || workspaceSummary?.planName || workspaceSummary?.companyName,
  );
  const [modeSwitcherOpen, setModeSwitcherOpen] = React.useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [memberProfile, setMemberProfile] = useState<RoleRoomMemberProfile | null>(null);
  const activeProfessionMode = getActiveProfessionMode();

  // Hent Role Room-medlemsprofil når sheeten åpnes (image + bio + roller)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const profile = await roleRoomMemberProfileService.getMyProfile();
        if (!cancelled) setMemberProfile(profile);
      } catch {
        if (!cancelled) setMemberProfile(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, editOpen]);

  const profileImageUrl = memberProfile?.profileImageUrl ?? null;
  const bioShort = memberProfile?.bio
    ? memberProfile.bio.length > 140 ? memberProfile.bio.slice(0, 137) + '…' : memberProfile.bio
    : null;
  const topProfessions = memberProfile?.professions?.slice(0, 4) ?? [];

  const body = (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar src={profileImageUrl ?? undefined} sx={{ width: 56, height: 56, bgcolor: '#6366f1', fontSize: '1rem' }}>
          {profileImageUrl ? null : initialsOf(memberProfile?.displayName ?? displayName, email) || <PersonIcon />}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {memberProfile?.displayName || displayName || email || t('mobProfile.userFallback')}
          </Typography>
          {email ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {email}
            </Typography>
          ) : null}
          {roleLabel ? (
            <Typography variant="caption" color="text.secondary">
              {roleLabel}
            </Typography>
          ) : null}
        </Box>
      </Stack>

      {(bioShort || topProfessions.length > 0) && (
        <Box>
          {bioShort && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: topProfessions.length > 0 ? 1 : 0 }}>
              {bioShort}
            </Typography>
          )}
          {topProfessions.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {topProfessions.map((p) => (
                <Chip key={p} label={p} size="small"
                      sx={{ bgcolor: 'rgba(139,92,246,0.12)', color: '#6d28d9', fontWeight: 600 }} />
              ))}
            </Stack>
          )}
        </Box>
      )}

      <Stack spacing={1}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setEditOpen(true)}
          sx={{
            minHeight: 'var(--rr-touch-target-min, 44px)',
            justifyContent: 'flex-start',
            borderColor: 'rgba(124,58,237,0.35)',
            color: '#6d28d9',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {t('mobProfile.editProfile')}
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<GroupIcon />}
          onClick={() => setDirectoryOpen(true)}
          sx={{
            minHeight: 'var(--rr-touch-target-min, 44px)',
            justifyContent: 'flex-start',
            borderColor: 'rgba(124,58,237,0.35)',
            color: '#6d28d9',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {t('mobProfile.findMembers')}
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<EventAvailableIcon />}
          onClick={() => setAvailabilityOpen(true)}
          sx={{
            minHeight: 'var(--rr-touch-target-min, 44px)',
            justifyContent: 'flex-start',
            borderColor: 'rgba(124,58,237,0.35)',
            color: '#6d28d9',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {t('mobProfile.myAvailability')}
        </Button>
      </Stack>

      {showWorkspace ? (
        <>
          <Divider />
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary">
              {t('mobProfile.workspace')}
            </Typography>
            {workspaceSummary?.companyName ? (
              <Typography variant="body2">{workspaceSummary.companyName}</Typography>
            ) : null}
            {workspaceSummary?.planName ? (
              <Typography variant="caption" color="text.secondary">
                {t('mobProfile.plan', { plan: workspaceSummary.planName })}
              </Typography>
            ) : null}
            {workspaceSummary?.statusLabel ? (
              <Typography variant="caption" color="text.secondary">
                {t('mobProfile.status', { status: workspaceSummary.statusLabel })}
              </Typography>
            ) : null}
          </Stack>
        </>
      ) : null}

      {isAdmin ? (
        <>
          <Divider />
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">
              {t('mobProfile.professionModeAdmin')}
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ModeIcon />}
              onClick={() => setModeSwitcherOpen(true)}
              sx={{
                minHeight: 'var(--rr-touch-target-min, 44px)',
                justifyContent: 'flex-start',
                borderColor: 'rgba(124,58,237,0.35)',
                color: '#6d28d9',
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {t('mobProfile.switchMode', { mode: activeProfessionMode })}
            </Button>
          </Stack>
        </>
      ) : null}

      <Divider />
      <Button
        fullWidth
        variant="outlined"
        startIcon={<StorageOutlinedIcon />}
        onClick={() => setStorageOpen(true)}
        sx={{
          minHeight: 'var(--rr-touch-target-min, 44px)',
          justifyContent: 'flex-start',
          borderColor: 'rgba(168,85,247,0.35)',
          color: '#a855f7',
          textTransform: 'none',
          fontWeight: 600,
        }}
      >
        {t('mobProfile.storageLabel')}
      </Button>

      {onLogout ? (
        <>
          <Divider />
          {/* Extra margin-top per item 377: spacing rundt destruktive handlinger */}
          <Box sx={{ mt: 'var(--rr-touch-target-destructive-gap, 16px)' }}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={() => {
                onLogout();
                onClose();
              }}
              sx={{
                minHeight: 'var(--rr-touch-target-min, 44px)',
                justifyContent: 'flex-start',
              }}
            >
              {t('mobProfile.logout')}
            </Button>
          </Box>
        </>
      ) : null}
    </Stack>
  );

  const modeSwitcherDialog = isAdmin ? (
    <Dialog
      open={modeSwitcherOpen}
      onClose={() => setModeSwitcherOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{t('mobProfile.switchProfessionModeTitle')}</DialogTitle>
      <DialogContent dividers>
        <ProfessionModeSwitcher />
      </DialogContent>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => setModeSwitcherOpen(false)}>{t('mobProfile.close')}</Button>
      </Box>
    </Dialog>
  ) : null;

  const editDialog = (
    <RoleRoomOnboardingDialog
      open={editOpen}
      mode="edit"
      onComplete={() => setEditOpen(false)}
      onClose={() => setEditOpen(false)}
    />
  );

  const directoryDialog = (
    <RoleRoomMemberDirectoryDialog
      open={directoryOpen}
      onClose={() => setDirectoryOpen(false)}
    />
  );

  const availabilityDialog = (
    <Dialog
      open={availabilityOpen}
      onClose={() => setAvailabilityOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#0a0118', color: '#f5f3ff' } }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('mobProfile.myAvailability')}
        <MuiIconButton onClick={() => setAvailabilityOpen(false)} sx={{ color: '#c4b5fd' }}>
          <CloseIcon />
        </MuiIconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'rgba(245,243,255,0.7)', mb: 2 }}>
          {t('mobProfile.availabilityHelp')}
        </Typography>
        <AvailabilityCalendar editable months={2} />
      </DialogContent>
    </Dialog>
  );

  const storageDialog = (
    <Dialog
      open={storageOpen}
      onClose={() => setStorageOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#0a0118', color: '#f5f3ff' } }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('mobProfile.storage')}
        <MuiIconButton onClick={() => setStorageOpen(false)} sx={{ color: '#c4b5fd' }}>
          <CloseIcon />
        </MuiIconButton>
      </DialogTitle>
      <DialogContent>
        <RoleRoomStoragePanel />
      </DialogContent>
    </Dialog>
  );

  if (usePopover) {
    return (
      <>
        <Popover
          open={open}
          anchorEl={anchorEl ?? null}
          onClose={onClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.5,
                width: 'min(360px, 92vw)',
                borderRadius: 2,
              },
            },
          }}
        >
          {body}
        </Popover>
        {modeSwitcherDialog}
        {editDialog}
        {directoryDialog}
        {availabilityDialog}
        {storageDialog}
      </>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        aria-labelledby="rr-profile-title"
        PaperProps={{
          className: 'rr-mobile-sheet',
          sx: {
            margin: 0,
            borderTopLeftRadius: 'var(--rr-bottom-sheet-radius, 16px)',
            borderTopRightRadius: 'var(--rr-bottom-sheet-radius, 16px)',
          },
        }}
      >
        <DialogTitle
          id="rr-profile-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pt: 'calc(var(--rr-safe-top, 0px) + 12px)',
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            {t('mobProfile.profileTitle')}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label={t('mobProfile.closeProfile')}
            sx={{
              width: 'var(--rr-touch-target-min, 44px)',
              height: 'var(--rr-touch-target-min, 44px)',
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 0, pb: 'var(--rr-safe-bottom, 0px)' }}>{body}</DialogContent>
      </Dialog>
      {modeSwitcherDialog}
      {editDialog}
      {directoryDialog}
      {storageDialog}
    </>
  );
};

export default RoleRoomMobileProfileSheet;
