// @ts-nocheck
/**
 * RoleRoomBottomNav — telefon-eksklusiv bunn-nav for Role Room.
 *
 * Vises kun på phone-viewport (< 600px). Caller kontrollerer dette via
 * `visible`-prop. Renderer 4 primære destinasjoner + "Mer…" som åpner et
 * bottom sheet med alle resterende faner.
 *
 * Konfigurasjonen avhenger av brukerens prosjekt-rolle (UserRoleType) — se
 * `bottomNavConfigForRole`. Default-fallback brukes når rolle ikke er kjent.
 *
 * Backlog coverage:
 *  - Påvirker ikke desktop og iPad direkte; rene mobil-rules.
 *  - 044 — visuell touch-feedback (CSS-basert active-state).
 *  - 046 — aria-labels på alle nav-knapper.
 *  - 015 — bottom sheet for "Mer…" respekterer max-height og safe-area.
 *
 * Non-goals (deferred):
 *  - Persistent active-tab via URL (item 064).
 *  - Auto-show siste 3 brukte (item 041 quick-switch).
 */

import React, { useState } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  MoreHoriz as MoreIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

import type { UserRoleType } from '../../models/casting';

export interface BottomNavItem {
  value: string;
  label: string;
  Icon: SvgIconComponent;
}

interface RoleRoomBottomNavProps {
  visible: boolean;
  primaryItems: BottomNavItem[];
  overflowItems: BottomNavItem[];
  value: string;
  onChange: (next: string) => void;
}

const NAV_HEIGHT = 64;

export const RoleRoomBottomNav: React.FC<RoleRoomBottomNavProps> = ({
  visible,
  primaryItems,
  overflowItems,
  value,
  onChange,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);

  if (!visible) return null;

  // Cap primary at 4 so we always have room for "Mer…"
  const trimmedPrimary = primaryItems.slice(0, 4);
  const allOverflow = [
    ...primaryItems.slice(4),
    ...overflowItems,
  ];

  const isActiveInOverflow = allOverflow.some((it) => it.value === value);

  return (
    <>
      <Box
        component="nav"
        aria-label="Bunn-navigasjon"
        className="rr-bottom-nav"
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.appBar + 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          alignItems: 'stretch',
          height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          bgcolor: 'rgba(15,12,33,0.96)',
          backdropFilter: 'saturate(180%) blur(12px)',
          WebkitBackdropFilter: 'saturate(180%) blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {trimmedPrimary.map((item) => {
          const ItemIcon = item.Icon;
          const isActive = item.value === value;
          return (
            <Box
              key={item.value}
              component="button"
              onClick={() => onChange(item.value)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.25,
                bgcolor: 'transparent',
                color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.72)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'color 0.15s ease, transform 0.12s ease',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                position: 'relative',
                '&::before': isActive
                  ? {
                      content: '""',
                      position: 'absolute',
                      top: 4,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 24,
                      height: 3,
                      borderRadius: 1.5,
                      bgcolor: '#a78bfa',
                    }
                  : undefined,
                '&:active': {
                  transform: 'scale(0.94)',
                  color: '#a78bfa',
                },
                '&:focus-visible': {
                  outline: '3px solid #8b5cf6',
                  outlineOffset: -2,
                },
              }}
            >
              <ItemIcon sx={{ fontSize: 22 }} />
              <Typography
                component="span"
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: isActive ? 600 : 500,
                  lineHeight: 1.1,
                  letterSpacing: 0.1,
                }}
              >
                {item.label}
              </Typography>
            </Box>
          );
        })}

        {/* "Mer…" knapp */}
        <Box
          component="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Vis flere seksjoner"
          aria-haspopup="dialog"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            bgcolor: 'transparent',
            color: isActiveInOverflow ? '#a78bfa' : 'rgba(255,255,255,0.72)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'color 0.15s ease, transform 0.12s ease',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            position: 'relative',
            '&::before': isActiveInOverflow
              ? {
                  content: '""',
                  position: 'absolute',
                  top: 4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24,
                  height: 3,
                  borderRadius: 1.5,
                  bgcolor: '#a78bfa',
                }
              : undefined,
            '&:active': {
              transform: 'scale(0.94)',
              color: '#a78bfa',
            },
            '&:focus-visible': {
              outline: '3px solid #8b5cf6',
              outlineOffset: -2,
            },
          }}
        >
          <MoreIcon sx={{ fontSize: 22 }} />
          <Typography
            component="span"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: isActiveInOverflow ? 600 : 500,
              lineHeight: 1.1,
              letterSpacing: 0.1,
            }}
          >
            Mer
          </Typography>
        </Box>
      </Box>

      {/* "Mer…" bottom sheet */}
      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 'var(--rr-bottom-sheet-radius, 16px)',
            borderTopRightRadius: 'var(--rr-bottom-sheet-radius, 16px)',
            bgcolor: '#16112c',
            color: 'rgba(255,255,255,0.92)',
            maxHeight: 'var(--rr-modal-max-height, 80dvh)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5, pb: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.18)',
              mx: 'auto',
              position: 'absolute',
              top: 6,
              left: 0,
              right: 0,
            }}
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
            Flere seksjoner
          </Typography>
          <IconButton
            onClick={() => setMoreOpen(false)}
            aria-label="Lukk"
            sx={{
              color: 'inherit',
              minWidth: 44,
              minHeight: 44,
              WebkitTapHighlightColor: 'transparent',
              '&:active': { transform: 'scale(0.94)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <List sx={{ pb: 2 }}>
          {allOverflow.map((item) => {
            const ItemIcon = item.Icon;
            const isActive = item.value === value;
            return (
              <ListItemButton
                key={item.value}
                onClick={() => {
                  onChange(item.value);
                  setMoreOpen(false);
                }}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  py: 1.5,
                  px: 2,
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  bgcolor: isActive ? 'rgba(167,139,250,0.12)' : 'transparent',
                  '&:active': { bgcolor: 'rgba(167,139,250,0.18)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 44, color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.72)' }}>
                  <ItemIcon />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.92)',
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>
    </>
  );
};

/**
 * Returnerer 4 primære destinasjoner per brukerrolle. Resten havner i "Mer…"
 * automatisk. Caller passerer ALL faner og denne fn velger primær subset.
 */
export function bottomNavConfigForRole(role: UserRoleType | null | undefined): string[] {
  switch (role) {
    case 'casting_director':
    case 'director':
      return ['roles', 'candidates', 'schedule', 'brief'];
    case 'producer':
    case 'production_manager':
      return ['roles', 'schedule', 'crew', 'approval'];
    case 'camera_team':
      return ['shooting', 'shotlist', 'schedule', 'crew'];
    case 'content_producer':
      return ['candidates', 'brief', 'planner', 'approval'];
    case 'client_reviewer':
    case 'agency':
      return ['approval', 'brief', 'roles', 'schedule'];
    case 'writer':
    case 'script_editor':
    case 'reader':
      return ['brief', 'roles', 'candidates', 'agent'];
    default:
      return ['roles', 'candidates', 'schedule', 'brief'];
  }
}

export default RoleRoomBottomNav;
