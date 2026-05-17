// @ts-nocheck
/**
 * AnimaticHelpDialog — onboarding/help-overlay for animatic-spilleren.
 * Viser shortcuts, touch-gestures og kort flyt-oversikt. Auto-åpnes
 * første gang en bruker ser AnimaticPlayer (via localStorage-flag),
 * og kan åpnes manuelt via ?-knappen i headeren.
 */

import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, HelpOutline } from '@mui/icons-material';

const SEEN_KEY = 'role-room:animatic-help-seen-v1';

export interface AnimaticHelpDialogProps {
  open: boolean;
  onClose: () => void;
  /** Vis "Ikke vis igjen" checkbox + persist til localStorage. */
  enableDismissPersistence?: boolean;
}

interface ShortcutRow {
  combo: string;
  description: string;
}

const KEYBOARD_SHORTCUTS: ShortcutRow[] = [
  { combo: 'Space', description: 'Play / pause' },
  { combo: '←  →', description: 'Forrige / neste frame' },
  { combo: 'R', description: 'Start / stopp opptak' },
  { combo: 'F', description: 'Fullskjerm' },
];

const TOUCH_GESTURES: ShortcutRow[] = [
  { combo: 'Tap på stage', description: 'Play / pause' },
  { combo: 'Sveip venstre', description: 'Neste frame' },
  { combo: 'Sveip høyre', description: 'Forrige frame' },
];

const FLOW_STEPS = [
  { num: 1, label: 'Last opp scratch-track', text: 'Mikrofonknappen 🎤 i kontroll-raden — voiceover/midlertidig musikk for hele scenen.' },
  { num: 2, label: 'Velg lyd per event', text: 'SFX-panelet detekterer events fra frame-tekst. ✨ for CLAP-foreslag, 🧠 for AI-generering, 📤 for egen fil.' },
  { num: 3, label: 'Per-frame voiceover', text: 'Mikrofon-strippen under stagen lar deg sette én voiceover per frame.' },
  { num: 4, label: 'Ta opp', text: 'Trykk ⏺ for å spille inn hele animaticen som WebM med all lyd mikset inn.' },
];

export const AnimaticHelpDialog: React.FC<AnimaticHelpDialogProps> = ({
  open,
  onClose,
  enableDismissPersistence = true,
}) => {
  const handleDismiss = () => {
    if (enableDismissPersistence && typeof localStorage !== 'undefined') {
      try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      data-testid="animatic-help-dialog"
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <HelpOutline sx={{ color: '#a5b4fc' }} />
          <Typography variant="h6" sx={{ flex: 1 }}>
            Animatic-spilleren
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Spill av storyboardet ditt som en enkel video for å teste pacing,
              lyd og dialog før du finpusser tegningene.
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Arbeidsflyt
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {FLOW_STEPS.map((s) => (
                <Stack key={s.num} direction="row" spacing={1} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: 'rgba(165,180,252,0.2)',
                      color: '#a5b4fc',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    {s.num}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {s.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.text}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Tastatur-snarveier
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {KEYBOARD_SHORTCUTS.map((row) => (
                <Stack key={row.combo} direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      minWidth: 70,
                      bgcolor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 0.75,
                      px: 1,
                      py: 0.25,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    {row.combo}
                  </Box>
                  <Typography variant="caption">{row.description}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Touch-gestures (iPad)
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {TOUCH_GESTURES.map((row) => (
                <Stack key={row.combo} direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      minWidth: 120,
                      bgcolor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 0.75,
                      px: 1,
                      py: 0.25,
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    {row.combo}
                  </Box>
                  <Typography variant="caption">{row.description}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Tips: alt du laster opp persisteres per scene i nettleserens IndexedDB.
            Reload eller bytt scene — det er der når du kommer tilbake.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDismiss} variant="contained" data-testid="animatic-help-got-it">
          Forstått
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** Sjekk om bruker har sett help-dialogen før. */
export function hasSeenAnimaticHelp(): boolean {
  if (typeof localStorage === 'undefined') return true; // SSR — ikke åpne
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}
