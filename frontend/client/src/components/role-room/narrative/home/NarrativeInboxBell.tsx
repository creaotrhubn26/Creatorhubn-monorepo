/**
 * NarrativeInboxBell — bjelle med uleste-badge + popover over prosjektets
 * narrative varsler (review-runder, gater, milepæler). Fase 7b.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Box, Button, IconButton, List, ListItemButton, ListItemText, Popover, Stack, Tooltip, Typography } from '@mui/material';
import { NotificationsNoneOutlined as BellIcon, DoneAll as DoneAllIcon } from '@mui/icons-material';
import { listInbox, markAllInboxRead, markInboxRead } from '../narrativeService';
import type { NarrativeInboxItem } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';

function when(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function NarrativeInboxBell({ projectId, refreshKey = 0, onOpenScene }: { projectId: string; refreshKey?: number; onOpenScene?: (sceneId: string) => void }): React.ReactElement {
  const [items, setItems] = useState<NarrativeInboxItem[]>([]);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setItems(await listInbox(projectId)); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke hente varsler.'); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const unread = items.filter((i) => !i.readAt).length;

  const markRead = async (item: NarrativeInboxItem) => {
    if (!item.readAt) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, readAt: new Date().toISOString() } : x)));
      try { await markInboxRead(projectId, item.id); } catch { /* best effort */ }
    }
    if (item.linkedEntityType === 'narrative_scene' && item.linkedEntityId && onOpenScene) { setAnchor(null); onOpenScene(item.linkedEntityId); }
  };
  const readAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    try { await markAllInboxRead(projectId); } catch { /* best effort */ }
  };

  return (
    <>
      <Tooltip title={unread ? `${unread} uleste varsler` : 'Varsler'}>
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: narrativeColors.textDim, width: { xs: 40, md: 30 }, height: { xs: 40, md: 30 } }} aria-label="Varsler" data-testid="narrative-inbox-bell" data-unread={unread}>
          <Badge badgeContent={unread} color="success" max={99} overlap="circular" sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16, bgcolor: narrativeColors.accent, color: '#03150a', fontWeight: 800 } }}>
            <BellIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} PaperProps={{ sx: { width: 380, maxWidth: '92vw', bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` } }} data-testid="narrative-inbox-popover">
        <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${narrativeColors.borderStrong}` }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, flex: 1 }}>Varsler</Typography>
          <Button size="small" startIcon={<DoneAllIcon sx={{ fontSize: 14 }} />} disabled={!unread} onClick={() => void readAll()} sx={{ color: narrativeColors.accent, fontSize: 11 }} data-testid="narrative-inbox-read-all">Marker alle lest</Button>
        </Stack>
        {error ? <Typography sx={{ p: 2, fontSize: 12, color: narrativeColors.error }}>{error}</Typography> : null}
        {!error && items.length === 0 ? <Typography sx={{ p: 2, fontSize: 12, color: narrativeColors.textDim }}>Ingen varsler ennå. Review-runder, gater og milepæler dukker opp her.</Typography> : null}
        <List dense disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {items.map((item) => (
            <ListItemButton key={item.id} onClick={() => void markRead(item)} data-testid={`narrative-inbox-item-${item.id}`} data-read={item.readAt ? 'true' : 'false'} sx={{ alignItems: 'flex-start', gap: 1, bgcolor: item.readAt ? 'transparent' : 'rgba(34,197,94,0.06)' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', mt: 0.9, flexShrink: 0, bgcolor: item.readAt ? 'transparent' : narrativeColors.accent }} />
              <ListItemText
                primary={item.title}
                secondary={`${item.message ? `${item.message} · ` : ''}${when(item.createdAt)}`}
                primaryTypographyProps={{ fontSize: 13, fontWeight: item.readAt ? 500 : 700, color: narrativeColors.text }}
                secondaryTypographyProps={{ fontSize: 11, color: narrativeColors.textDim }}
              />
            </ListItemButton>
          ))}
        </List>
      </Popover>
    </>
  );
}

export default NarrativeInboxBell;
