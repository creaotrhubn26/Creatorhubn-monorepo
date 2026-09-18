/**
 * BoardSidebar — brett-liste gruppert på mappe-sti, opprett/gi nytt navn/slett.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreHoriz as MoreIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { htmlToText, type NarrativeBoard, type NarrativeGraph } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';

export interface BoardSidebarProps {
  graph: NarrativeGraph;
  activeBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (name: string, folderPath?: string) => Promise<void>;
  onRenameBoard: (boardId: string, name: string) => Promise<void>;
  onDeleteBoard: (boardId: string) => Promise<void>;
  onJumpToElement: (elementId: string) => void;
}

export function BoardSidebar({
  graph, activeBoardId, onSelectBoard, onCreateBoard, onRenameBoard, onDeleteBoard, onJumpToElement,
}: BoardSidebarProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [menu, setMenu] = useState<{ anchor: HTMLElement; boardId: string } | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, NarrativeBoard[]>();
    for (const b of graph.boards) {
      const list = map.get(b.folderPath) ?? [];
      list.push(b);
      map.set(b.folderPath, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'nb'));
  }, [graph.boards]);

  const elementCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of graph.elements) m.set(e.boardId, (m.get(e.boardId) ?? 0) + 1);
    return m;
  }, [graph.elements]);

  const q = query.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!q) return [];
    return graph.elements
      .filter((e) =>
        htmlToText(e.titleHtml).toLowerCase().includes(q)
        || htmlToText(e.contentHtml).toLowerCase().includes(q)
        || (e.customId ?? '').toLowerCase().includes(q))
      .slice(0, 30);
  }, [graph.elements, q]);

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    await onCreateBoard(name);
    setNewName('');
    setCreating(false);
  };

  return (
    <Box
      data-testid="narrative-board-sidebar"
      sx={{
        width: 240, flex: '0 0 240px', display: 'flex', flexDirection: 'column',
        bgcolor: narrativeColors.bgPanel, borderRight: `1px solid ${narrativeColors.borderStrong}`, minHeight: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 1, borderBottom: `1px solid ${narrativeColors.borderStrong}` }}>
        <SearchIcon sx={{ fontSize: 16, color: narrativeColors.textDim }} />
        <InputBase
          placeholder="Søk elementer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: 1, fontSize: 12, color: narrativeColors.text }}
          inputProps={{ 'aria-label': 'Søk elementer', 'data-testid': 'narrative-search' }}
        />
      </Box>

      {q ? (
        <List dense sx={{ overflowY: 'auto', flex: 1 }}>
          {searchHits.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 1, fontSize: 12, color: narrativeColors.textDim }}>Ingen treff.</Typography>
          ) : searchHits.map((e) => (
            <ListItemButton key={e.id} onClick={() => onJumpToElement(e.id)} sx={{ py: 0.5 }}>
              <ListItemText
                primary={htmlToText(e.titleHtml) || 'Uten tittel'}
                secondary={graph.boards.find((b) => b.id === e.boardId)?.name ?? ''}
                primaryTypographyProps={{ fontSize: 12, color: narrativeColors.text }}
                secondaryTypographyProps={{ fontSize: 10, color: narrativeColors.textDim }}
              />
            </ListItemButton>
          ))}
        </List>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.75 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: narrativeColors.textDim, flex: 1 }}>BRETT</Typography>
            <Tooltip title="Nytt brett">
              <IconButton size="small" onClick={() => setCreating(true)} sx={{ color: narrativeColors.accent }} aria-label="Nytt brett" data-testid="narrative-new-board">
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {creating ? (
            <Box sx={{ px: 1.5, pb: 1 }}>
              <InputBase
                autoFocus
                placeholder="Navn på brettet"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submitCreate(); if (e.key === 'Escape') setCreating(false); }}
                onBlur={() => void submitCreate()}
                sx={{ width: '100%', fontSize: 12, color: narrativeColors.text, px: 1, py: 0.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)' }}
                inputProps={{ 'data-testid': 'narrative-new-board-name' }}
              />
            </Box>
          ) : null}
          <List dense sx={{ overflowY: 'auto', flex: 1, py: 0 }}>
            {graph.boards.length === 0 && !creating ? (
              <Typography sx={{ px: 1.5, py: 1, fontSize: 12, color: narrativeColors.textDim }}>
                Ingen brett ennå. Opprett det første for å begynne å tegne historien.
              </Typography>
            ) : null}
            {groups.map(([folder, boards]) => (
              <React.Fragment key={folder || '__root'}>
                {folder ? (
                  <Typography sx={{ px: 1.5, pt: 1, pb: 0.25, fontSize: 10, color: narrativeColors.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {folder}
                  </Typography>
                ) : null}
                {boards.map((b) => (
                  <ListItemButton
                    key={b.id}
                    selected={b.id === activeBoardId}
                    onClick={() => onSelectBoard(b.id)}
                    data-testid={`narrative-board-${b.id}`}
                    sx={{
                      py: 0.5, pr: 0.5,
                      '&.Mui-selected': { bgcolor: narrativeColors.accentSoft, '&:hover': { bgcolor: narrativeColors.accentSoft } },
                    }}
                  >
                    <ListItemText
                      primary={b.name}
                      secondary={`${elementCount.get(b.id) ?? 0} elementer`}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: b.id === activeBoardId ? 700 : 500, color: narrativeColors.text, noWrap: true }}
                      secondaryTypographyProps={{ fontSize: 10, color: narrativeColors.textDim }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, boardId: b.id }); }}
                      sx={{ color: narrativeColors.textDim }}
                      aria-label="Brett-meny"
                    >
                      <MoreIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </ListItemButton>
                ))}
              </React.Fragment>
            ))}
          </List>
        </>
      )}

      <Menu open={!!menu} anchorEl={menu?.anchor ?? null} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={async () => {
            if (!menu) return;
            const current = graph.boards.find((b) => b.id === menu.boardId);
            const name = window.prompt('Nytt navn på brettet', current?.name ?? '');
            setMenu(null);
            if (name && name.trim()) await onRenameBoard(menu.boardId, name.trim());
          }}
        >
          Gi nytt navn
        </MenuItem>
        <MenuItem
          onClick={async () => {
            if (!menu) return;
            setMenu(null);
            if (window.confirm('Slette brettet og alle elementene på det?')) await onDeleteBoard(menu.boardId);
          }}
          sx={{ color: narrativeColors.error }}
        >
          Slett brett
        </MenuItem>
      </Menu>
    </Box>
  );
}
