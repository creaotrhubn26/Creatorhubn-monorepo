/**
 * DanceCheatSheet — modal med alle keybinds + workflow-tips for DanceFlow.
 *
 * Audit-v2 I2: «Jeg kan ikke huske om det er Cmd+Z eller Ctrl+Z». Trigget
 * med `?`-tast (uten Shift på US-layout = `/`-tast med Shift). Vi binder
 * Shift+/ og spør om brukeren faktisk trykket «?».
 *
 * Selvstendig komponent — kan mountes på toppnivå (DanceWorkspace eller
 * FormationsTabBody). Lytter globalt på keydown, viser modal, lukkes på
 * Escape eller bakgrunns-klikk.
 */
import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { Close as CloseIcon, Help as HelpIcon } from '@mui/icons-material';

import { danceFlowColors } from './danceFlowTheme';
import { useT } from '../../../i18n';

interface KeyBindGroup {
  id: string;
  title: string;
  binds: ReadonlyArray<{ keys: string; description: string }>;
}

export interface DanceCheatSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DanceCheatSheet({ open, onClose }: DanceCheatSheetProps): React.ReactElement {
  const { t } = useT();

  const KEYBIND_GROUPS: readonly KeyBindGroup[] = React.useMemo(() => [
    {
      id: 'video',
      title: t('danceCheat.grpVideo'),
      binds: [
        { keys: 'Space', description: t('danceCheat.dPlayPause') },
        { keys: 'J / K / L', description: t('danceCheat.dJKL') },
        { keys: '← / →', description: t('danceCheat.dArrows') },
        { keys: ', / .', description: t('danceCheat.dComma') },
      ],
    },
    {
      id: 'timeline',
      title: t('danceCheat.grpTimeline'),
      binds: [
        { keys: t('danceCheat.kClickBg'), description: t('danceCheat.dClickBg') },
        { keys: t('danceCheat.kDblBg'), description: t('danceCheat.dDblBg') },
        { keys: t('danceCheat.kClickBlock'), description: t('danceCheat.dClickBlock') },
      ],
    },
    {
      id: 'formation',
      title: t('danceCheat.grpFormation'),
      binds: [
        { keys: 'Drag puck', description: t('danceCheat.dDragPuck') },
        { keys: '⌘ Z', description: t('danceCheat.dUndo') },
        { keys: '⌘ ⇧ Z', description: t('danceCheat.dRedo') },
        { keys: 'Enter', description: t('danceCheat.dEnter') },
      ],
    },
    {
      id: 'navigation',
      title: t('danceCheat.grpNav'),
      binds: [
        { keys: 'Tab', description: t('danceCheat.dTab') },
        { keys: 'Swipe', description: t('danceCheat.dSwipe') },
        { keys: '⌘ K', description: t('danceCheat.dCmdK') },
      ],
    },
    {
      id: 'export',
      title: t('danceCheat.grpExport'),
      binds: [
        { keys: t('danceCheat.kExportPng'), description: t('danceCheat.dExportPng') },
        { keys: t('danceCheat.kExportBackup'), description: t('danceCheat.dExportBackup') },
        { keys: t('danceCheat.kExportStage'), description: t('danceCheat.dExportStage') },
      ],
    },
    {
      id: 'tips',
      title: t('danceCheat.grpTips'),
      binds: [
        { keys: 'BPM-counts', description: t('danceCheat.dBpm') },
        { keys: 'Show IDs', description: t('danceCheat.dShowIds') },
        { keys: 'Show Paths', description: t('danceCheat.dShowPaths') },
        { keys: 'Curve-mode', description: t('danceCheat.dCurve') },
        { keys: '? (Shift + /)', description: t('danceCheat.dCheat') },
      ],
    },
  ], [t]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-testid="dance-cheat-sheet"
      PaperProps={{
        sx: {
          bgcolor: danceFlowColors.bgPanel,
          color: danceFlowColors.textPrimary,
          border: `1px solid ${danceFlowColors.borderStrong}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
          py: 1.5,
        }}
      >
        <HelpIcon sx={{ color: danceFlowColors.lavender, fontSize: 22 }} />
        <Typography component="span" sx={{ flex: 1, fontWeight: 700, fontSize: 16 }}>
          DanceFlow keybinds & tips
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t('danceCheat.closeAria')} data-testid="dance-cheat-sheet-close">
          <CloseIcon sx={{ color: danceFlowColors.textMuted }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          {KEYBIND_GROUPS.map((group) => (
            <Box key={group.id} data-testid={`cheat-sheet-group-${group.id}`}>
              <Typography
                variant="overline"
                sx={{
                  color: danceFlowColors.lavender,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  display: 'block',
                  mb: 1,
                  fontSize: 11,
                }}
              >
                {group.title}
              </Typography>
              <Stack spacing={0.75}>
                {group.binds.map((b) => (
                  <Box
                    key={b.keys}
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 1.5,
                      fontSize: 12,
                    }}
                  >
                    <Box
                      sx={{
                        fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: 11,
                        fontWeight: 600,
                        color: danceFlowColors.gold,
                        bgcolor: 'rgba(251,191,36,0.08)',
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.5,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        minWidth: 110,
                      }}
                    >
                      {b.keys}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: danceFlowColors.textSecondary, fontSize: 12, lineHeight: 1.5 }}
                    >
                      {b.description}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

/**
 * useDanceCheatSheet — global `?`-keybind + state-håndtering. Kall i en
 * parent som vil tilby cheat-sheeten (FormationsTabBody er anbefalt sted).
 * Returnerer `{ open, setOpen, CheatSheet }` der CheatSheet er render-prop.
 */
export function useDanceCheatSheet(): {
  open: boolean;
  setOpen: (v: boolean) => void;
  CheatSheet: React.ReactElement;
} {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Ignorer i input/textarea/contentEditable
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      // ?-tast — på US-layout: Shift + /. Sjekk e.key === '?' direkte.
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return {
    open,
    setOpen,
    CheatSheet: <DanceCheatSheet open={open} onClose={() => setOpen(false)} />,
  };
}

export default DanceCheatSheet;
