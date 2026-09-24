import React, { useMemo, useState } from 'react';
import {
  Box, ButtonBase, Chip, Dialog, DialogContent, InputAdornment, Stack,
  TextField, Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import { ws } from '../workspaceTheme';
import { MEDIA_ROOM_SHORTCUTS, type MediaRoomShortcutId } from './mediaRoomShortcuts';

export interface MediaRoomCommand {
  id: MediaRoomShortcutId | string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

interface Props {
  open: boolean;
  mode: 'commands' | 'help';
  locale?: 'no' | 'en';
  commands: MediaRoomCommand[];
  shortcutIds?: MediaRoomShortcutId[];
  onClose: () => void;
}

export default function MediaRoomCommandCenter({ open, mode, locale = 'no', commands, shortcutIds, onClose }: Props) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    if (mode === 'help') {
      return MEDIA_ROOM_SHORTCUTS.filter((shortcut) => !shortcutIds || shortcutIds.includes(shortcut.id)).map((shortcut) => ({
        id: shortcut.id,
        label: locale === 'en' ? shortcut.en : shortcut.no,
        shortcut: shortcut.keys,
        disabled: false,
        run: () => undefined,
      }));
    }
    const normalized = query.trim().toLowerCase();
    return normalized
      ? commands.filter((command) => command.label.toLowerCase().includes(normalized))
      : commands;
  }, [commands, locale, mode, query, shortcutIds]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
      <DialogContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontSize: 17, fontWeight: 850 }}>
              {mode === 'help' ? (locale === 'en' ? 'Keyboard shortcuts' : 'Hurtigtaster') : (locale === 'en' ? 'Commands' : 'Kommandoer')}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>
              {locale === 'en' ? 'Shortcuts are paused while you type.' : 'Hurtigtaster pauses mens du skriver.'}
            </Typography>
          </Box>
          {mode === 'commands' && (
            <TextField autoFocus size="small" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={locale === 'en' ? 'Search commands' : 'Søk i kommandoer'}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
          )}
          <Stack spacing={0.5} sx={{ maxHeight: '58vh', overflowY: 'auto' }}>
            {rows.map((row) => (
              <ButtonBase key={row.id} disabled={row.disabled || mode === 'help'} onClick={() => { row.run(); onClose(); }}
                sx={{ width: '100%', justifyContent: 'space-between', gap: 2, px: 1.25, py: 1,
                  borderRadius: `${ws.radiusSm}px`, border: `1px solid ${ws.borderSoft}`,
                  color: row.disabled ? ws.textFaint : ws.text, textAlign: 'left',
                  '&:hover': { bgcolor: ws.panelAlt, borderColor: ws.accentBorder },
                  '&:focus-visible': { outline: `2px solid ${ws.accent}`, outlineOffset: 1 } }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650 }}>{row.label}</Typography>
                {row.shortcut && <Chip label={row.shortcut} size="small" sx={{ height: 23, color: ws.textDim, bgcolor: ws.panelInput, fontFamily: 'monospace' }} />}
              </ButtonBase>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
