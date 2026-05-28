import { memo, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, PlayArrow as PlayArrowIcon } from '@mui/icons-material';

const STORAGE_KEY = 'role-room-exit-intent-dismissed-v1';

interface LandingExitIntentProps {
  enabled: boolean;
  onStartClick: () => void;
}

/**
 * Exit-intent-modal som vises én gang per device når musen forlater
 * viewport-topp (typisk når bruker går mot tabs eller URL-bar). Trigges
 * også ved Page Visibility 'hidden' som mobile fallback.
 *
 * Brukers dismissal lagres i localStorage så den ikke kommer tilbake
 * samme dag.
 */
function LandingExitIntentImpl({ enabled, onStartClick }: LandingExitIntentProps) {
  const [open, setOpen] = useState(false);
  const [alreadyShown, setAlreadyShown] = useState(false);

  // Sjekk om bruker har dismissed tidligere i dag
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const dismissedAt = Number(raw);
        const hoursSince = (Date.now() - dismissedAt) / (1000 * 60 * 60);
        if (hoursSince < 24) setAlreadyShown(true);
      }
    } catch {
      /* localStorage blocked — vis modalen */
    }
  }, []);

  const trigger = useCallback(() => {
    if (!enabled || alreadyShown || open) return;
    setOpen(true);
    setAlreadyShown(true);
  }, [enabled, alreadyShown, open]);

  // Mouse-out-top trigger (desktop)
  useEffect(() => {
    if (!enabled || alreadyShown) return;
    if (typeof document === 'undefined') return;
    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) trigger();
    }
    document.addEventListener('mouseleave', onMouseLeave);
    return () => document.removeEventListener('mouseleave', onMouseLeave);
  }, [enabled, alreadyShown, trigger]);

  // Visibility-change trigger (mobile + tab-switch fallback)
  useEffect(() => {
    if (!enabled || alreadyShown) return;
    if (typeof document === 'undefined') return;
    function onVisibility() {
      // Skip on first load — only trigger if user has been on page > 10s
      const visited = Number(window.sessionStorage.getItem('role-room-landing-visited-at') || '0');
      if (!visited) {
        window.sessionStorage.setItem('role-room-landing-visited-at', String(Date.now()));
        return;
      }
      const elapsed = Date.now() - visited;
      if (document.visibilityState === 'hidden' && elapsed > 10_000) {
        trigger();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, alreadyShown, trigger]);

  function handleClose() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function handleCTA() {
    handleClose();
    onStartClick();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="exit-intent-title"
      PaperProps={{
        sx: {
          bgcolor: 'rgba(8, 10, 18, 0.96)',
          color: '#e2e8f0',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          borderRadius: 3,
          backdropFilter: 'blur(20px)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 1 }}>
        <Box>
          <Typography
            id="exit-intent-title"
            sx={{
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#8b5cf6',
              mb: 0.75,
            }}
          >
            Før du går —
          </Typography>
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem', lineHeight: 1.25 }}>
            Vil du se hvordan The Role Room ser ut i din egen produksjon?
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'rgba(226,232,240,0.6)', ml: 1, mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.96rem', lineHeight: 1.65, mb: 1 }}>
          Hopp inn på 30 sekunder. Du trenger ingen kredittkortinfo — bare en e-post for å lage prosjektet ditt.
          Du kan slette kontoen når som helst.
        </Typography>
        <Typography sx={{ color: 'rgba(167,139,250,0.7)', fontSize: '0.84rem', fontStyle: 'italic' }}>
          Vi sender ingen markedsføring uten samtykke. Personvernerklæringen vår beskriver alt vi gjør med dataene dine.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={handleClose}
          sx={{
            color: 'rgba(200,185,255,0.55)',
            textTransform: 'none',
            fontSize: '0.86rem',
          }}
        >
          Kanskje senere
        </Button>
        <Button
          variant="contained"
          onClick={handleCTA}
          startIcon={<PlayArrowIcon />}
          aria-label="Start The Role Room nå"
          sx={{
            px: 3,
            py: 1.25,
            fontSize: '0.96rem',
            fontWeight: 700,
            borderRadius: 2.5,
            textTransform: 'none',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #9b6cf6 0%, #7376f1 100%)',
            },
          }}
        >
          Start nå — 30 sekunder
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export const LandingExitIntent = memo(LandingExitIntentImpl);
LandingExitIntent.displayName = 'LandingExitIntent';
