/**
 * CommandPalette — ⌘K / Ctrl+K hopp-til-flate.
 *
 * Topp-baren annonserte tidligere «⌘K» ved siden av et `disabled`
 * søkefelt uten handler. Med ~35 flater i workspacet er hopp-til den
 * navigasjonen som faktisk sparer tid, og registeret finnes allerede
 * (workspaceItems.ts) — så dette er en liste og en match, ikke en
 * søkemotor.
 *
 * Dette søker i FLATER, ikke i innhold. Teksten sier det, så ingen tror
 * de søker i saker og dokumenter.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

import { BRAND } from './brand';
import {
  searchWorkspaceItems,
  type WorkspaceItemId,
  type WorkspaceItemMeta,
} from './workspaceItems';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: WorkspaceItemId) => void;
}

const MAX_RESULTS = 12;

export function CommandPalette({ open, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => searchWorkspaceItems(query).slice(0, MAX_RESULTS), [query]);

  // Nullstill ved hver åpning — paletten skal alltid starte blank.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Hold markert rad i syne ved piltast-navigasjon.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, results.length]);

  const commit = useCallback(
    (item: WorkspaceItemMeta | undefined) => {
      if (!item) return;
      onSelect(item.id);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commit(results[activeIndex]);
      }
      // Escape håndteres av Dialog.onClose.
    },
    [results, activeIndex, commit],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#150a29',
            border: `1px solid ${BRAND.borderHover}`,
            borderRadius: 3,
            backgroundImage: 'none',
            mt: -10,
          },
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.border}` }}
      >
        <SearchOutlinedIcon sx={{ color: BRAND.accent, fontSize: 20 }} />
        <InputBase
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hopp til flate…"
          inputProps={{ 'aria-label': 'Hopp til flate' }}
          sx={{
            flex: 1,
            color: BRAND.text,
            fontSize: '0.95rem',
            '& input::placeholder': { color: BRAND.textDim, opacity: 1 },
          }}
        />
        <Chip
          label="ESC"
          size="small"
          sx={{
            height: 18,
            fontSize: '0.62rem',
            bgcolor: 'rgba(167, 139, 250, 0.16)',
            color: '#ddd6fe',
          }}
        />
      </Stack>

      <Box ref={listRef} sx={{ maxHeight: 380, overflowY: 'auto', py: 1 }}>
        {results.length === 0 ? (
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.84rem', px: 2, py: 3 }}>
            Ingen flate matcher «{query}».
          </Typography>
        ) : (
          results.map((item, index) => {
            const active = index === activeIndex;
            return (
              <Stack
                key={item.id}
                data-index={index}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(item)}
                sx={{
                  px: 2,
                  py: 1,
                  mx: 1,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  bgcolor: active ? BRAND.selectedBg : 'transparent',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      color: item.status === 'planned' ? BRAND.textMuted : BRAND.text,
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </Typography>
                  {item.status === 'planned' ? (
                    <Chip
                      label="Kommer"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.6rem',
                        bgcolor: 'rgba(241, 245, 249, 0.08)',
                        color: BRAND.textDim,
                      }}
                    />
                  ) : null}
                </Stack>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ color: BRAND.textDim, fontSize: '0.72rem' }}>
                    {item.group}
                  </Typography>
                  {active ? (
                    <KeyboardReturnIcon sx={{ color: BRAND.accent, fontSize: 14 }} />
                  ) : null}
                </Stack>
              </Stack>
            );
          })
        )}
      </Box>

      <Typography
        sx={{
          px: 2,
          py: 1,
          borderTop: `1px solid ${BRAND.border}`,
          color: BRAND.textDim,
          fontSize: '0.7rem',
        }}
      >
        Søker i workspace-flater — ikke i innholdet i dem.
      </Typography>
    </Dialog>
  );
}

export default CommandPalette;
