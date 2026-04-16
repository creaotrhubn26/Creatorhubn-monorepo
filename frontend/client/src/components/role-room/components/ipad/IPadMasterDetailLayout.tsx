// @ts-nocheck
/**
 * IPadMasterDetailLayout — reusable split-view shell for Role Room iPad
 * surfaces. Used by Godkjenning (fase 6) and intended for Planner and
 * Prosjektrom in later fases.
 *
 * Covers backlog items:
 *  - 051: left column for list/navigation, right column for work area
 *  - 052: portrait = two-step (list then detail slide-over)
 *  - 053: landscape = true master-detail
 *  - 063: iPad-specific empty state with quick actions (via emptyDetail slot)
 *  - 065: safe-area handled via .rr-ipad-split (role-room-mobile.css)
 *  - 071: portrait slide-over is centered sheet with max width
 *
 * Non-goals (deferred):
 *  - 061: resizable sidepanel — hardcoded width for now
 *  - 060: "pin panel" for notes
 *  - 067: Apple Pencil annotation
 */

import React from 'react';
import { Box, Dialog, DialogContent, IconButton, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Close as CloseIcon } from '@mui/icons-material';

import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';

interface IPadMasterDetailLayoutProps {
  mode: RoleRoomViewportMode;
  master: React.ReactNode;
  detail: React.ReactNode;
  /** Slot rendered on the right when nothing is selected on landscape iPad. */
  emptyDetail?: React.ReactNode;
  hasSelection: boolean;
  onCloseDetail: () => void;
  detailTitle?: string;

  /** Caller controls this — when false the layout falls through to master-only.
   *  Typical use: pass `mode === 'tabletLandscape' || mode === 'tabletPortrait'`. */
  enabled: boolean;
}

export const IPadMasterDetailLayout: React.FC<IPadMasterDetailLayoutProps> = ({
  mode,
  master,
  detail,
  emptyDetail,
  hasSelection,
  onCloseDetail,
  detailTitle,
  enabled,
}) => {
  if (!enabled) {
    // Phone or desktop — caller owns the overlay/detail surface.
    return <>{master}</>;
  }

  if (mode === 'tabletLandscape') {
    return (
      <Box
        className="rr-ipad-split rr-ipad-split--landscape"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box className="rr-ipad-split__master">{master}</Box>
        <Box
          className="rr-ipad-split__detail"
          sx={{
            borderRadius: 'var(--rr-card-radius, 16px)',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            minHeight: 400,
            overflow: 'hidden',
          }}
        >
          {hasSelection ? detail : (emptyDetail ?? <DefaultEmptyDetail />)}
        </Box>
      </Box>
    );
  }

  // Tablet portrait: master always visible, detail slides over as centered dialog.
  return (
    <>
      {master}
      <Dialog
        open={hasSelection}
        onClose={onCloseDetail}
        fullWidth
        maxWidth="sm"
        aria-label={detailTitle ?? 'Detalj'}
        PaperProps={{
          sx: {
            m: 2,
            borderRadius: 'var(--rr-card-radius, 16px)',
            maxHeight: 'var(--rr-modal-max-height, calc(100dvh - 48px))',
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1 }}>
            <IconButton
              aria-label="Tilbake til liste"
              onClick={onCloseDetail}
              sx={{
                width: 'var(--rr-touch-target-min, 44px)',
                height: 'var(--rr-touch-target-min, 44px)',
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1, pl: 0.5 }} noWrap>
              {detailTitle ?? 'Detalj'}
            </Typography>
            <IconButton
              aria-label="Lukk"
              onClick={onCloseDetail}
              sx={{
                width: 'var(--rr-touch-target-min, 44px)',
                height: 'var(--rr-touch-target-min, 44px)',
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          {detail}
        </DialogContent>
      </Dialog>
    </>
  );
};

const DefaultEmptyDetail: React.FC = () => (
  <Box
    sx={{
      p: 4,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
    }}
  >
    <Typography variant="body2" color="text.secondary">
      Velg en oppføring fra listen for å se detaljer.
    </Typography>
  </Box>
);

export default IPadMasterDetailLayout;
