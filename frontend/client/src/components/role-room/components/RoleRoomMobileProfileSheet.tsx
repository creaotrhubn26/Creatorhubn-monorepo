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
  SwapHoriz as ModeIcon,
} from '@mui/icons-material';

import type { RoleRoomViewportMode } from '../hooks/useRoleRoomViewportMode';
import ProfessionModeSwitcher from './ProfessionModeSwitcher';
import { getActiveProfessionMode } from '../config/professionMode';
import RoleRoomOnboardingDialog from './RoleRoomOnboardingDialog';
import RoleRoomMemberDirectoryDialog from './RoleRoomMemberDirectoryDialog';
import { roleRoomMemberProfileService } from '../services/roleRoomMemberProfileService';
import type { RoleRoomMemberProfile } from '../services/roleRoomMemberProfileService';

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
  const usePopover =
    mode === 'tabletPortrait' || mode === 'tabletLandscape' || mode === 'desktop';
  const showWorkspace = Boolean(
    workspaceSummary?.statusLabel || workspaceSummary?.planName || workspaceSummary?.companyName,
  );
  const [modeSwitcherOpen, setModeSwitcherOpen] = React.useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
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
            {memberProfile?.displayName || displayName || email || 'Bruker'}
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
          Rediger profil
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
          Finn medlemmer
        </Button>
      </Stack>

      {showWorkspace ? (
        <>
          <Divider />
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary">
              Arbeidsområde
            </Typography>
            {workspaceSummary?.companyName ? (
              <Typography variant="body2">{workspaceSummary.companyName}</Typography>
            ) : null}
            {workspaceSummary?.planName ? (
              <Typography variant="caption" color="text.secondary">
                Plan: {workspaceSummary.planName}
              </Typography>
            ) : null}
            {workspaceSummary?.statusLabel ? (
              <Typography variant="caption" color="text.secondary">
                Status: {workspaceSummary.statusLabel}
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
              Profesjonsmodus (admin)
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
              Bytt modus (nå: {activeProfessionMode})
            </Button>
          </Stack>
        </>
      ) : null}

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
              Logg ut
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
      <DialogTitle>Bytt profesjonsmodus</DialogTitle>
      <DialogContent dividers>
        <ProfessionModeSwitcher />
      </DialogContent>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={() => setModeSwitcherOpen(false)}>Lukk</Button>
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
            Profil
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Lukk profil"
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
    </>
  );
};

export default RoleRoomMobileProfileSheet;
