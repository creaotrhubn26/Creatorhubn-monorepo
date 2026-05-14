/**
 * CommandPalette — Cmd+K/Ctrl+K global søk og navigasjon.
 *
 * Generisk: konsumenten gir oss en liste av `CommandPaletteItem` (prosjekter,
 * kandidater, tab-bytte, etc.) og vi viser dem gruppert per kategori med
 * tastatur-navigasjon (piler + Enter, Esc lukker).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  InputAdornment,
  Chip,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  category: string;
  keywords?: string[];
  icon?: ReactNode;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  placeholder?: string;
  emptyHint?: string;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

function scoreItem(item: CommandPaletteItem, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 1;

  const haystack = [
    item.label,
    item.description ?? '',
    item.category,
    ...(item.keywords ?? []),
  ].join(' ').toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (!haystack.includes(token)) return 0;
    // Boost matches at word boundary or label start
    if (item.label.toLowerCase().startsWith(token)) score += 3;
    else if (item.label.toLowerCase().includes(token)) score += 2;
    else score += 1;
  }
  return score;
}

export const CommandPalette = ({
  open,
  onClose,
  items,
  placeholder = 'Søk prosjekter, kandidater, tab-er…',
  emptyHint = 'Ingen treff. Prøv et annet søkeord.',
}: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset state when palette opens/closes
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlightIndex(0);
      // Focus input after Dialog mounts
      const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const filtered = useMemo(() => {
    const queryTokens = tokenize(query);
    return items
      .map((item) => ({ item, score: scoreItem(item, queryTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .map((entry) => entry.item);
  }, [items, query]);

  // Group by category while preserving sort order
  const grouped = useMemo(() => {
    const groups: Array<{ category: string; items: CommandPaletteItem[] }> = [];
    const indexByCategory = new Map<string, number>();
    for (const item of filtered) {
      const existing = indexByCategory.get(item.category);
      if (existing === undefined) {
        indexByCategory.set(item.category, groups.length);
        groups.push({ category: item.category, items: [item] });
      } else {
        groups[existing].items.push(item);
      }
    }
    return groups;
  }, [filtered]);

  // Clamp highlight to valid range whenever results change
  useEffect(() => {
    if (highlightIndex >= filtered.length) {
      setHighlightIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, highlightIndex]);

  // Scroll active row into view
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[data-command-palette-active="true"]');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, filtered.length]);

  const handleSelect = useCallback((item: CommandPaletteItem) => {
    onClose();
    // Defer the action so the Dialog has time to unmount cleanly
    window.setTimeout(() => item.onSelect(), 0);
  }, [onClose]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = filtered[highlightIndex];
      if (target) handleSelect(target);
    }
  }, [filtered, handleSelect, highlightIndex]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f172a',
          color: '#fff',
          border: '1px solid rgba(184,107,255,0.32)',
          borderRadius: 2,
        },
        onKeyDown: handleKeyDown,
      }}
      sx={{ '& .MuiBackdrop-root': { bgcolor: 'rgba(0,0,0,0.55)' } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlightIndex(0);
            }}
            placeholder={placeholder}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
              sx: {
                color: '#fff',
                fontSize: '1.05rem',
                '& input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
              },
            }}
          />
        </Box>

        <Box ref={listContainerRef} sx={{ maxHeight: 440, overflowY: 'auto', py: 1 }}>
          {filtered.length === 0 ? (
            <Box sx={{ px: 3, py: 5, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>
              <Typography variant="body2">{emptyHint}</Typography>
            </Box>
          ) : (
            grouped.map((group) => (
              <Box key={group.category} sx={{ mb: 1 }}>
                <Typography
                  variant="overline"
                  sx={{
                    px: 2,
                    color: 'rgba(255,255,255,0.45)',
                    letterSpacing: 1,
                    fontSize: '0.7rem',
                  }}
                >
                  {group.category}
                </Typography>
                <List dense sx={{ py: 0.5 }}>
                  {group.items.map((item) => {
                    const flatIndex = filtered.indexOf(item);
                    const isActive = flatIndex === highlightIndex;
                    return (
                      <ListItemButton
                        key={item.id}
                        data-command-palette-active={isActive ? 'true' : 'false'}
                        selected={isActive}
                        onMouseEnter={() => setHighlightIndex(flatIndex)}
                        onClick={() => handleSelect(item)}
                        sx={{
                          mx: 1,
                          borderRadius: 1,
                          '&.Mui-selected': {
                            bgcolor: 'rgba(184,107,255,0.18)',
                          },
                          '&.Mui-selected:hover': {
                            bgcolor: 'rgba(184,107,255,0.24)',
                          },
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.05)',
                          },
                        }}
                      >
                        {item.icon && (
                          <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.7)' }}>
                            {item.icon}
                          </Box>
                        )}
                        <ListItemText
                          primary={item.label}
                          secondary={item.description}
                          primaryTypographyProps={{ sx: { color: '#fff', fontWeight: 500, fontSize: '0.95rem' } }}
                          secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' } }}
                        />
                        <Chip
                          label={item.category}
                          size="small"
                          sx={{
                            ml: 1,
                            bgcolor: 'rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '0.7rem',
                            height: 22,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Box>
            ))
          )}
        </Box>

        <Box
          sx={{
            px: 2,
            py: 1,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: 2,
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          <span>↑↓ for å navigere</span>
          <span>↵ for å velge</span>
          <span>Esc for å lukke</span>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
