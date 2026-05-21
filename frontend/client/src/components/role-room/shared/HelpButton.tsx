/**
 * HelpButton — permanent "?"-knapp nederst-høyre i RoleRoom.
 *
 * Klikk → popover med:
 *   • "Vis hvordan" (link til docs eller in-app tour)
 *   • "Snakk med support" (mailto eller chat-widget hvis tilgjengelig)
 *   • "Hva er nytt" (changelog-snippets eller release notes)
 *   • "Tastatursnarveier" (lister ⌘K, /, ?, etc.)
 *
 * Designprinsipper:
 *   • Fixed bottom-right på alle sider — alltid synlig
 *   • Mobil: mindre, tar mindre plass
 *   • Hide-on-scroll-down, show-on-scroll-up (optional UX)
 *   • Subtilt amber-glow så den ikke konkurrerer med primary actions
 */

import React, { useState } from 'react';
import {
  Box, IconButton, Popover, List, ListItemButton, ListItemIcon, ListItemText,
  Divider, Typography, Stack, Chip,
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  PlayCircleOutline as TourIcon,
  ChatBubbleOutline as ChatIcon,
  Email as EmailIcon,
  AutoAwesome as WhatsNewIcon,
  KeyboardOutlined as KeyboardIcon,
} from '@mui/icons-material';

export interface HelpButtonProps {
  /** Custom support-e-post. Default: support@theroleroom.com */
  supportEmail?: string;
  /** Hvis satt, viser "Vis hvordan"-knapp som åpner en in-app tour */
  onStartTour?: () => void;
  /** URL til changelog/whats-new-side */
  changelogUrl?: string;
  /** Skjul på enkelte ruter (f.eks. login) */
  hide?: boolean;
}

const KEYBOARD_SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Søk paneler og handlinger' },
  { keys: ['/'], description: 'Hurtigsøk (alternative)' },
  { keys: ['Esc'], description: 'Lukk modal eller popup' },
  { keys: ['?'], description: 'Vis denne hjelp-menyen' },
];

export const HelpButton: React.FC<HelpButtonProps> = ({
  supportEmail = 'support@theroleroom.com',
  onStartTour,
  changelogUrl,
  hide = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const open = !!anchorEl;

  // Globalt: "?"-tasten åpner hjelp-menyen
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // Faux-anchor i bunn-høyre slik at popoveren plasserer seg riktig
        const fakeAnchor = document.getElementById('help-button-root') as HTMLElement | null;
        if (fakeAnchor) setAnchorEl(fakeAnchor);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (hide) return null;

  return (
    <>
      <Box
        id="help-button-root"
        sx={{
          position: 'fixed',
          bottom: { xs: 16, md: 24 },
          right: { xs: 16, md: 24 },
          zIndex: 1300,
        }}
      >
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Åpne hjelp"
          sx={{
            bgcolor: '#1a1a1a',
            color: '#F5B82E',
            border: '1px solid rgba(245, 184, 46, 0.3)',
            boxShadow: '0 4px 16px rgba(245, 184, 46, 0.15)',
            '&:hover': {
              bgcolor: '#2a2a2a',
              borderColor: '#F5B82E',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.15s ease',
            width: 48,
            height: 48,
          }}
        >
          <HelpIcon />
        </IconButton>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: -1,
              ml: 0,
              minWidth: 280,
              bgcolor: '#1a1a1a',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            },
          },
        }}
      >
        {!shortcutsOpen ? (
          <List sx={{ py: 1 }}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#F5B82E', letterSpacing: 1 }}>
                TRENGER DU HJELP?
              </Typography>
            </Box>

            {onStartTour && (
              <ListItemButton
                onClick={() => {
                  onStartTour();
                  setAnchorEl(null);
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#F5B82E' }}>
                  <TourIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Vis meg hvordan"
                  secondary="Kort gjennomgang av denne siden"
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            )}

            <ListItemButton
              onClick={() => {
                setShortcutsOpen(true);
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: '#F5B82E' }}>
                <KeyboardIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Tastatursnarveier"
                secondary="⌘K, /, ?, Esc og flere"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItemButton>

            <ListItemButton
              component="a"
              href={`mailto:${supportEmail}?subject=The%20Role%20Room%20support`}
              onClick={() => setAnchorEl(null)}
            >
              <ListItemIcon sx={{ minWidth: 36, color: '#F5B82E' }}>
                <EmailIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Snakk med support"
                secondary={supportEmail}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItemButton>

            {changelogUrl && (
              <>
                <Divider sx={{ my: 1 }} />
                <ListItemButton
                  component="a"
                  href={changelogUrl}
                  target="_blank"
                  rel="noopener"
                  onClick={() => setAnchorEl(null)}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: '#F5B82E' }}>
                    <WhatsNewIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Hva er nytt"
                    secondary="Siste oppdateringer"
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              </>
            )}
          </List>
        ) : (
          // Tastatursnarveier-visning
          <Box sx={{ p: 2, minWidth: 280 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#F5B82E', letterSpacing: 1 }}>
                TASTATURSNARVEIER
              </Typography>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ cursor: 'pointer', '&:hover': { color: '#F5B82E' } }}
                onClick={() => setShortcutsOpen(false)}
              >
                ← Tilbake
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              {KEYBOARD_SHORTCUTS.map((s, i) => (
                <Stack key={i} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption">{s.description}</Typography>
                  <Stack direction="row" spacing={0.3}>
                    {s.keys.map((k, ki) => (
                      <Box
                        key={ki}
                        component="kbd"
                        sx={{
                          px: 0.7,
                          py: 0.2,
                          borderRadius: 0.5,
                          bgcolor: 'rgba(255,255,255,0.08)',
                          fontSize: 11,
                          fontFamily: 'monospace',
                        }}
                      >
                        {k}
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default HelpButton;
