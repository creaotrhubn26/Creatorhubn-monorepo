/**
 * CommandPalette — Cmd+K / Ctrl+K spotlight-stil søk for RoleRoom.
 *
 * Brukerflyt:
 *   1. Cmd+K (eller "/"-tast som fallback) → modal åpnes
 *   2. Bruker skriver f.eks. "klass" → fuzzy-match mot alle paneler
 *      + handlinger
 *   3. Pil opp/ned navigerer, Enter velger
 *   4. Escape lukker
 *
 * Designprinsipper:
 *   • Tastatur-først (mus er sekundært)
 *   • Fuzzy-match (matcher selv om du skriver feil)
 *   • Vis kategori (panel / handling / dokumentasjon)
 *   • Maks 7-8 treff vist samtidig — slipper å bla
 *
 * Hvordan kommandoer registreres:
 *   Du kan utvide kommando-listen via `useCommandRegistry`-hook eller
 *   ved å sende ekstra commands prop ved montering. Default-lista
 *   under dekker DanceWorkspace-paneler. Andre workspaces kan utvide.
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Dialog, Box, TextField, List, ListItemButton, ListItemText,
  Typography, Chip, Stack, InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  KeyboardReturn as EnterIcon,
} from '@mui/icons-material';

export interface Command {
  id: string;
  label: string;
  /** Sekundær beskrivelse vist under label */
  description?: string;
  /** Kategori-tag som vises som chip */
  category: 'Drift' | 'Kreativt' | 'Forretning' | 'Admin' | 'Handling' | 'Hjelp' | 'Hopp til';
  /** Søke-aliaser (vekter ekstra ord matcher) */
  keywords?: string[];
  /** Icon vises til venstre i listen */
  icon?: React.ReactNode;
  /** Trigger når valgt — enten URL eller funksjon */
  href?: string;
  onSelect?: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  /** Modifier-tast for åpning. Default: Meta (Cmd på Mac) eller Ctrl */
  hotkey?: { key: string; meta?: boolean; ctrl?: boolean } | { key: 'slash' };
}

function fuzzyMatch(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500;
  if (t.includes(q)) return 250;
  // Alle bokstaver i query må forekomme i rekkefølge i text (klassisk fuzzy)
  let i = 0;
  let lastIdx = -1;
  let gaps = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, lastIdx + 1);
    if (idx === -1) return 0;
    if (lastIdx >= 0) gaps += idx - lastIdx - 1;
    lastIdx = idx;
    i += 1;
  }
  if (i === q.length) {
    // Score basert på lavt antall gaps + tett match-distanse
    return Math.max(10, 200 - gaps * 5);
  }
  return 0;
}

function rankCommand(query: string, command: Command): number {
  let score = fuzzyMatch(query, command.label);
  if (command.description) {
    score = Math.max(score, fuzzyMatch(query, command.description) * 0.6);
  }
  for (const kw of command.keywords ?? []) {
    score = Math.max(score, fuzzyMatch(query, kw) * 0.8);
  }
  // Liten boost for "Hopp til"-kategorier (vanligste use-case)
  if (command.category === 'Hopp til') score *= 1.1;
  return score;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands,
  hotkey,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey-listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const isInputElement =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (hotkey && 'key' in hotkey && hotkey.key === 'slash') {
        if (e.key === '/' && !isInputElement) {
          e.preventDefault();
          setOpen(true);
        }
      } else {
        // Default: Cmd+K (Mac) eller Ctrl+K (Win/Linux)
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hotkey]);

  // Fokus input når modal åpnes
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Rangerte treff
  const ranked = useMemo(() => {
    if (!query.trim()) {
      // Uten query: vis topp 15 "Hopp til"-paneler først
      return commands.slice(0, 15);
    }
    return commands
      .map((c) => ({ command: c, score: rankCommand(query, c) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => r.command);
  }, [query, commands]);

  const executeCommand = useCallback(
    (cmd: Command) => {
      setOpen(false);
      if (cmd.onSelect) {
        cmd.onSelect();
      } else if (cmd.href) {
        if (cmd.href.startsWith('http')) {
          window.open(cmd.href, '_blank', 'noopener');
        } else {
          window.location.href = cmd.href;
        }
      }
    },
    [],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(ranked.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = ranked[selectedIndex];
      if (cmd) executeCommand(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Reset selected når listen endres
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          mt: '15vh',
          alignSelf: 'flex-start',
          bgcolor: '#0a0a0a',
          border: '1px solid rgba(245, 184, 46, 0.4)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          variant="standard"
          placeholder="Søk paneler, handlinger, dokumentasjon..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#F5B82E' }} />
              </InputAdornment>
            ),
            sx: { fontSize: '1.05rem', py: 0.5 },
          }}
        />
      </Box>

      <List sx={{ maxHeight: '50vh', overflowY: 'auto', py: 0 }}>
        {ranked.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Ingen treff for "{query}"
            </Typography>
          </Box>
        ) : (
          ranked.map((cmd, i) => (
            <ListItemButton
              key={cmd.id}
              selected={i === selectedIndex}
              onClick={() => executeCommand(cmd)}
              onMouseEnter={() => setSelectedIndex(i)}
              sx={{
                py: 1.2,
                px: 2,
                borderLeft: i === selectedIndex ? '3px solid #F5B82E' : '3px solid transparent',
                bgcolor: i === selectedIndex ? 'rgba(245, 184, 46, 0.08)' : 'transparent',
              }}
            >
              {cmd.icon && (
                <Box sx={{ mr: 1.5, color: '#F5B82E', display: 'flex' }}>{cmd.icon}</Box>
              )}
              <ListItemText
                primary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {cmd.label}
                    </Typography>
                    <Chip
                      label={cmd.category}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        bgcolor: 'rgba(245, 184, 46, 0.15)',
                        color: '#F5B82E',
                      }}
                    />
                  </Stack>
                }
                secondary={
                  cmd.description && (
                    <Typography
                      variant="caption"
                      color="text.disabled"
                      sx={{ display: 'block', mt: 0.3 }}
                    >
                      {cmd.description}
                    </Typography>
                  )
                }
              />
            </ListItemButton>
          ))
        )}
      </List>

      <Stack
        direction="row"
        spacing={2}
        sx={{
          px: 2,
          py: 1,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          bgcolor: 'rgba(0,0,0,0.3)',
        }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box
            component="kbd"
            sx={{
              px: 0.5,
              borderRadius: 0.5,
              bgcolor: 'rgba(255,255,255,0.08)',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            ↑↓
          </Box>
          <Typography variant="caption" color="text.disabled">
            Naviger
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <EnterIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled">
            Velg
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Box
            component="kbd"
            sx={{
              px: 0.5,
              borderRadius: 0.5,
              bgcolor: 'rgba(255,255,255,0.08)',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          >
            Esc
          </Box>
          <Typography variant="caption" color="text.disabled">
            Lukk
          </Typography>
        </Stack>
      </Stack>
    </Dialog>
  );
};

export default CommandPalette;
