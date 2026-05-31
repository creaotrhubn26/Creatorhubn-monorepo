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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, IconButton, Popover, List, ListItemButton, ListItemIcon, ListItemText,
  Divider, Typography, Stack, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button,
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  PlayCircleOutline as TourIcon,
  ChatBubbleOutline as ChatIcon,
  Email as EmailIcon,
  AutoAwesome as WhatsNewIcon,
  KeyboardOutlined as KeyboardIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

export type WhatsNewKind = 'feature' | 'fix' | 'improvement';

export interface WhatsNewItem {
  /** Visningsdato, f.eks. "2026-05-29" */
  date?: string;
  kind?: WhatsNewKind;
  title: string;
  description?: string;
}

export interface HelpButtonProps {
  /** Custom support-e-post. Default: support@theroleroom.com */
  supportEmail?: string;
  /** Hvis satt, viser "Vis hvordan"-knapp som åpner en in-app tour */
  onStartTour?: () => void;
  /** URL til changelog/whats-new-side. Brukes kun hvis whatsNew/mode ikke er satt. */
  changelogUrl?: string;
  /**
   * Hvis satt overstyrer changelogUrl: "Hva er nytt" åpner en modal med
   * disse oppføringene i stedet for å sende brukeren ut til en URL.
   * Hvis `mode` også er satt brukes oppføringene som fallback under
   * lasting / ved nettverksfeil.
   */
  whatsNew?: WhatsNewItem[];
  /**
   * Hvis satt henter HelpButton publiserte "Hva er nytt"-oppføringer fra
   * `/api/whats-new?mode=...` (administreres fra Admin Room). En badge
   * vises på knappen når det finnes uleste oppføringer.
   * Foreslåtte verdier: 'dance' | 'casting' | 'post_agent' | 'live_set'
   * | 'ads' | 'global'.
   */
  mode?: string;
  /** Modal-tittel når whatsNew er satt. Default: "Hva er nytt" */
  whatsNewTitle?: string;
  /** Skjul på enkelte ruter (f.eks. login) */
  hide?: boolean;
}

interface RemoteWhatsNewEntry {
  id: string;
  mode: string;
  kind: string;
  date: string | null;
  title: string;
  description: string | null;
}

function lastSeenKey(mode: string): string {
  return `whats_new_last_seen_${mode}`;
}

function entryFingerprint(items: WhatsNewItem[]): string {
  return items
    .map((e) => `${e.date ?? ''}|${e.title}`)
    .join('||');
}

const KIND_LABELS: Record<WhatsNewKind, string> = {
  feature: 'Nytt',
  improvement: 'Forbedret',
  fix: 'Fikset',
};

const KIND_COLORS: Record<WhatsNewKind, string> = {
  feature: '#F5B82E',
  improvement: '#7DD3FC',
  fix: '#86EFAC',
};

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
  whatsNew,
  mode,
  whatsNewTitle = 'Hva er nytt',
  hide = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [remoteEntries, setRemoteEntries] = useState<WhatsNewItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const open = !!anchorEl;

  // Hent server-side oppføringer hvis `mode` er satt.
  // Inkluderer ALLTID 'global' så plattformbrede ting vises i hver modus.
  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    (async () => {
      try {
        const modeParam = mode === 'global' ? 'global' : `${mode},global`;
        const res = await fetch(`/api/whats-new?mode=${encodeURIComponent(modeParam)}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const body = (await res.json()) as { items?: RemoteWhatsNewEntry[] };
        if (cancelled) return;
        const items: WhatsNewItem[] = (body.items ?? []).map((e) => ({
          date: e.date ?? undefined,
          kind:
            e.kind === 'feature' || e.kind === 'fix' || e.kind === 'improvement'
              ? e.kind
              : 'feature',
          title: e.title,
          description: e.description ?? undefined,
        }));
        setRemoteEntries(items);
      } catch {
        // Stille fallback til props.whatsNew
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const effectiveEntries: WhatsNewItem[] = remoteEntries ?? whatsNew ?? [];
  const hasWhatsNewModal = effectiveEntries.length > 0;
  const showWhatsNewEntry = hasWhatsNewModal || Boolean(changelogUrl);
  const fingerprint = useMemo(() => entryFingerprint(effectiveEntries), [effectiveEntries]);

  // Badge: vis "ny"-prikk hvis fingerprint ≠ siste sett-fingerprint
  useEffect(() => {
    if (!mode || !hasWhatsNewModal || typeof window === 'undefined') {
      setUnreadCount(0);
      return;
    }
    try {
      const lastSeen = window.localStorage.getItem(lastSeenKey(mode));
      setUnreadCount(lastSeen !== fingerprint ? effectiveEntries.length : 0);
    } catch {
      setUnreadCount(effectiveEntries.length);
    }
  }, [mode, hasWhatsNewModal, fingerprint, effectiveEntries.length]);

  const markWhatsNewSeen = (): void => {
    if (!mode || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(lastSeenKey(mode), fingerprint);
    } catch {
      // ignore
    }
    setUnreadCount(0);
  };

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
        <Badge
          color="warning"
          variant="dot"
          invisible={unreadCount === 0}
          overlap="circular"
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label={unreadCount > 0 ? `Åpne hjelp (${unreadCount} nye)` : 'Åpne hjelp'}
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
        </Badge>
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

            {showWhatsNewEntry && (
              <>
                <Divider sx={{ my: 1 }} />
                {hasWhatsNewModal ? (
                  <ListItemButton
                    onClick={() => {
                      setAnchorEl(null);
                      setWhatsNewOpen(true);
                      markWhatsNewSeen();
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: '#F5B82E' }}>
                      <WhatsNewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={whatsNewTitle}
                      secondary="Siste oppdateringer"
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                ) : (
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
                      primary={whatsNewTitle}
                      secondary="Siste oppdateringer"
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                )}
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

      {hasWhatsNewModal && (
        <Dialog
          open={whatsNewOpen}
          onClose={() => setWhatsNewOpen(false)}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: {
              sx: {
                bgcolor: '#141414',
                color: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(245, 184, 46, 0.25)',
              },
            },
          }}
        >
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              pr: 1,
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center">
              <WhatsNewIcon sx={{ color: '#F5B82E' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {whatsNewTitle}
              </Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={() => setWhatsNewOpen(false)}
              sx={{ color: 'rgba(255,255,255,0.6)' }}
              aria-label="Lukk"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Stack spacing={2}>
              {effectiveEntries.map((item, i) => {
                const kind = item.kind ?? 'feature';
                return (
                  <Box
                    key={i}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        label={KIND_LABELS[kind]}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          bgcolor: `${KIND_COLORS[kind]}22`,
                          color: KIND_COLORS[kind],
                          border: `1px solid ${KIND_COLORS[kind]}55`,
                        }}
                      />
                      {item.date && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                          {item.date}
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: item.description ? 0.5 : 0 }}>
                      {item.title}
                    </Typography>
                    {item.description && (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block' }}>
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 1.5 }}>
            <Button onClick={() => setWhatsNewOpen(false)} sx={{ color: '#F5B82E' }}>
              Lukk
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default HelpButton;
