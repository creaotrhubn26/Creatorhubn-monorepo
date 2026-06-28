/**
 * AgentCommandPalette — Cmd/Ctrl+K "jump to anywhere" for the 17-tab agent
 * dialog. Lists every tab grouped by the 6 producer workflow phases (from
 * agentTabs.ts), with the secondary "tool" tabs under an Avansert group, plus
 * type-to-filter and arrow-key navigation. Selecting a row switches the tab.
 *
 * Purely additive: it does not touch the existing <Tabs> strip or the
 * step-through navigation — it's a faster path on top of them.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Dialog, InputBase, List, ListItemButton, Typography } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import {
  AGENT_TAB_GROUPS,
  AGENT_TABS,
  ADVANCED_TAB_IDS,
  type TabId,
} from './agentTabs';
import { RR_COLORS } from './ui';

export interface AgentCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Whether the chat tab is available (depends on currentUserId). */
  includeChat?: boolean;
  onSelect: (tab: TabId) => void;
}

interface PaletteRow {
  id: TabId;
  label: string;
  group: string;
}

const GROUP_LABEL: Record<string, string> = {
  research: 'Research',
  markedsplan: 'Markedsplan',
  feed: 'Feed',
  inbox: 'Inbox',
  leads: 'Leads',
  analytics: 'Analytics',
  avansert: 'Avansert',
  chat: 'Chat',
};

function buildRows(includeChat: boolean): PaletteRow[] {
  const rows: PaletteRow[] = [];
  // Primary tabs, grouped by workflow phase order.
  for (const group of AGENT_TAB_GROUPS) {
    for (const id of group.primaryTabs) {
      rows.push({ id, label: AGENT_TABS[id]?.label ?? id, group: group.id });
    }
  }
  if (includeChat) {
    rows.push({ id: 'chat' as TabId, label: AGENT_TABS['chat' as TabId]?.label ?? 'Chat', group: 'chat' });
  }
  // Advanced/tool tabs last.
  for (const id of ADVANCED_TAB_IDS) {
    rows.push({ id, label: AGENT_TABS[id]?.label ?? id, group: 'avansert' });
  }
  return rows;
}

export default function AgentCommandPalette({
  open,
  onClose,
  includeChat = true,
  onSelect,
}: AgentCommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const allRows = useMemo(() => buildRows(includeChat), [includeChat]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) => r.label.toLowerCase().includes(q) || (GROUP_LABEL[r.group] ?? '').toLowerCase().includes(q),
    );
  }, [allRows, query]);

  // Reset and focus on open.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after the dialog paints.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Keep the active index in range as the filtered list shrinks.
  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const choose = (row: PaletteRow | undefined) => {
    if (!row) return;
    onSelect(row.id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(rows[active]);
    }
  };

  let lastGroup = '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          bgcolor: 'rgba(2,6,23,0.98)',
          border: RR_COLORS.accentBorder,
          borderRadius: 2,
          backgroundImage: 'none',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.6,
          py: 1.2,
          borderBottom: '1px solid rgba(148,163,184,0.18)',
        }}
      >
        <SearchIcon sx={{ color: RR_COLORS.accent ?? '#22d3ee', fontSize: 20 }} />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Hopp til fane …"
          fullWidth
          sx={{ color: '#f1f5f9', fontSize: '0.95rem' }}
        />
      </Box>
      <List dense sx={{ maxHeight: 360, overflow: 'auto', py: 0.5 }}>
        {rows.length === 0 ? (
          <Box sx={{ px: 2, py: 2, color: 'rgba(226,232,240,0.55)', fontSize: '0.85rem' }}>
            Ingen treff
          </Box>
        ) : (
          rows.map((row, idx) => {
            const showGroup = row.group !== lastGroup;
            lastGroup = row.group;
            return (
              <React.Fragment key={row.id}>
                {showGroup ? (
                  <Typography
                    sx={{
                      px: 2,
                      pt: 1,
                      pb: 0.4,
                      color: 'rgba(226,232,240,0.45)',
                      fontSize: '0.66rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                    }}
                  >
                    {GROUP_LABEL[row.group] ?? row.group}
                  </Typography>
                ) : null}
                <ListItemButton
                  selected={idx === active}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => choose(row)}
                  sx={{
                    mx: 1,
                    borderRadius: 1.2,
                    color: '#e2e8f0',
                    '&.Mui-selected': { bgcolor: 'rgba(34,211,238,0.12)' },
                    '&.Mui-selected:hover': { bgcolor: 'rgba(34,211,238,0.18)' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.88rem' }}>{row.label}</Typography>
                </ListItemButton>
              </React.Fragment>
            );
          })
        )}
      </List>
    </Dialog>
  );
}
