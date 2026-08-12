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
import { useT } from '../../../../i18n';

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

export const AnimaticHelpDialog: React.FC<AnimaticHelpDialogProps> = ({
  open,
  onClose,
  enableDismissPersistence = true,
}) => {
  const { t } = useT();

  const KEYBOARD_SHORTCUTS: ShortcutRow[] = React.useMemo(() => [
    { combo: 'Space', description: t('animaticHelp.kbPlayPause') },
    { combo: '←  →', description: t('animaticHelp.kbFrames') },
    { combo: 'R', description: t('animaticHelp.kbRecord') },
    { combo: 'F', description: t('animaticHelp.kbFullscreen') },
  ], [t]);

  const TOUCH_GESTURES: ShortcutRow[] = React.useMemo(() => [
    { combo: t('animaticHelp.touchTapCombo'), description: t('animaticHelp.kbPlayPause') },
    { combo: t('animaticHelp.touchSwipeLeftCombo'), description: t('animaticHelp.touchNext') },
    { combo: t('animaticHelp.touchSwipeRightCombo'), description: t('animaticHelp.touchPrev') },
  ], [t]);

  const FLOW_STEPS = React.useMemo(() => [
    { num: 1, label: t('animaticHelp.flow1Label'), text: t('animaticHelp.flow1Text') },
    { num: 2, label: t('animaticHelp.flow2Label'), text: t('animaticHelp.flow2Text') },
    { num: 3, label: t('animaticHelp.flow3Label'), text: t('animaticHelp.flow3Text') },
    { num: 4, label: t('animaticHelp.flow4Label'), text: t('animaticHelp.flow4Text') },
  ], [t]);

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
            {t('animaticHelp.title')}
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
              {t('animaticHelp.intro')}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('animaticHelp.sectionFlow')}
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
              {t('animaticHelp.sectionKeyboard')}
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
              {t('animaticHelp.sectionTouch')}
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
            {t('animaticHelp.tipPersist')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDismiss} variant="contained" data-testid="animatic-help-got-it">
          {t('animaticHelp.gotIt')}
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
