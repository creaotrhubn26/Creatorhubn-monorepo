import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  ContentPaste as ContentPasteIcon,
  SelectAll as SelectAllIcon,
} from '@mui/icons-material';
import {
  EDIT_MODULES,
  type EditModuleKey,
  type EnhancementSettings,
} from '../../lib/enhancer-session/module-contract';
import { diffModules } from '../../lib/enhancer-session/edit-clipboard';
import type { EditClipboard } from '../../lib/enhancer-session/types';

export interface EditClipboardBarProps {
  clipboard: EditClipboard | null;
  activeImageName: string | null;
  activeImageSettings: EnhancementSettings | null;
  multiSelectCount: number;
  totalImageCount: number;
  onCopy: () => void;
  onPaste: (targetScope: 'active' | 'selection', modules: EditModuleKey[]) => void;
  onClearClipboard: () => void;
}

const DEFAULT_SELECTION: ReadonlyArray<EditModuleKey> = ['color', 'detail', 'face', 'portrait', 'subject'];

export function EditClipboardBar(props: EditClipboardBarProps) {
  const {
    clipboard,
    activeImageName,
    activeImageSettings,
    multiSelectCount,
    totalImageCount,
    onCopy,
    onPaste,
    onClearClipboard,
  } = props;

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteScope, setPasteScope] = useState<'active' | 'selection'>('active');
  const [enabled, setEnabled] = useState<Set<EditModuleKey>>(() => new Set(DEFAULT_SELECTION));

  const availableModules = useMemo<EditModuleKey[]>(() => {
    if (!clipboard || !activeImageSettings) return EDIT_MODULES.map((m) => m.key);
    const changed = diffModules(activeImageSettings, clipboard.settings);
    return changed.length > 0 ? changed : EDIT_MODULES.map((m) => m.key);
  }, [clipboard, activeImageSettings]);

  const openPaste = (scope: 'active' | 'selection') => {
    setPasteScope(scope);
    setEnabled(new Set(availableModules.filter((m) => DEFAULT_SELECTION.includes(m))));
    setPasteOpen(true);
  };

  const toggle = (key: EditModuleKey) => {
    setEnabled((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const targetScopeLabel =
    pasteScope === 'active'
      ? `Aktivt bilde${activeImageName ? ` · ${activeImageName}` : ''}`
      : multiSelectCount > 0
        ? `Valgte ${multiSelectCount} bilder`
        : `Alle ${totalImageCount} bilder i sesjonen`;

  return (
    <>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyIcon fontSize="small" />}
          onClick={onCopy}
          disabled={!activeImageSettings}
        >
          Kopier redigering
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentPasteIcon fontSize="small" />}
          onClick={() => openPaste('active')}
          disabled={!clipboard || !activeImageSettings}
        >
          Lim inn til aktiv
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SelectAllIcon fontSize="small" />}
          onClick={() => openPaste('selection')}
          disabled={!clipboard || totalImageCount < 2}
        >
          {multiSelectCount > 0 ? `Lim til ${multiSelectCount} valgte` : 'Lim til alle'}
        </Button>
        {clipboard ? (
          <Chip
            size="small"
            variant="outlined"
            label={`Utklippstavle · ${clipboard.sourceName}`}
            onDelete={onClearClipboard}
          />
        ) : null}
      </Stack>

      <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Lim inn redigering</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {targetScopeLabel}
              </Typography>
              {clipboard ? (
                <Typography variant="caption" color="text.secondary">
                  Kilde: {clipboard.sourceName}
                </Typography>
              ) : null}
            </Alert>
            <Typography variant="caption" color="text.secondary">
              Velg hvilke moduler som skal kopieres. Endringer i umerkede moduler beholdes som de er.
            </Typography>
            <Stack spacing={0}>
              {EDIT_MODULES.map((mod) => {
                const changed = availableModules.includes(mod.key);
                return (
                  <FormControlLabel
                    key={mod.key}
                    control={
                      <Checkbox
                        size="small"
                        checked={enabled.has(mod.key)}
                        onChange={() => toggle(mod.key)}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{mod.label}</span>
                        {changed ? null : (
                          <Chip size="small" variant="outlined" label="ingen endring" />
                        )}
                      </Stack>
                    }
                  />
                );
              })}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasteOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={enabled.size === 0}
            onClick={() => {
              onPaste(pasteScope, Array.from(enabled));
              setPasteOpen(false);
            }}
          >
            Lim inn
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
