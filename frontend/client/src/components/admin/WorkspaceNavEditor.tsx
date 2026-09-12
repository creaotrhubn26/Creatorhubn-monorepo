/**
 * WorkspaceNavEditor — CreatorHub Design (Nivå 2): rediger Team Workspace-navigasjonen
 * som DATA. Patch pr. WS_NAV-key (label / badge / skjul / rekkefølge) → lagres i
 * design-tokens (ws=creatorhub, nøkkel `nav`). WorkspaceShell slår patchen på WS_NAV
 * ved neste last (applyNavOverrides). Tomt felt = standard (fallback).
 */
import React from 'react';
import {
  Alert, Box, Button, Checkbox, Divider, Stack, TextField, Typography,
} from '@mui/material';
import { WS_NAV } from '../workspace/workspaceTheme';

type NavPatch = { label?: string; badge?: number; hidden?: boolean; order?: number };

const GROUP_LABEL: Record<string, string> = {
  hoved: 'Hovedmeny', rom: 'Smart rom', klient: 'Kundeportal',
  faner: 'Klient-faner', producer: 'Producer-dashbord',
};

// The Role Room-nav-flaten: klient-shell (ClientWorkspaceShell TABS) + producer-dashbord
// (RoleRoomDashboardPanel TAB_DEFS). Delt `theroleroom`-nav-namespace pr. nøkkel — en label/hidden
// pr. key gjelder overalt nøkkelen rendres. Delte nøkler (roles/approval/brief/economy) står i klient-
// gruppa (én rad = én key). Producer-gruppa har kun producer-eksklusive faner.
const ROLEROOM_NAV: Array<{ key: string; label: string; group: string }> = [
  // Klient-faner (delte nøkler bor her)
  { key: 'economy', label: 'Økonomi', group: 'faner' },
  { key: 'approval', label: 'Godkjenning', group: 'faner' },
  { key: 'messages', label: 'Meldinger', group: 'faner' },
  { key: 'brief', label: 'Brief', group: 'faner' },
  { key: 'merkevare', label: 'Merkevare', group: 'faner' },
  { key: 'meetings', label: 'Møter', group: 'faner' },
  { key: 'content', label: 'Content Planner', group: 'faner' },
  { key: 'vault', label: 'Tilganger', group: 'faner' },
  { key: 'team', label: 'Team', group: 'faner' },
  { key: 'roles', label: 'Roller', group: 'faner' },
  { key: 'plan', label: 'Plan', group: 'faner' },
  { key: 'marketing-plan', label: 'Markedsplan', group: 'faner' },
  // Producer-eksklusive faner (RoleRoomDashboardPanel)
  { key: 'candidates', label: 'Kandidater', group: 'producer' },
  { key: 'crew', label: 'Crew', group: 'producer' },
  { key: 'schedule', label: 'Tidsplan', group: 'producer' },
  { key: 'publishing', label: 'Publisering', group: 'producer' },
  { key: 'carousel', label: 'Ukescontent', group: 'producer' },
  { key: 'planner', label: 'Planner', group: 'producer' },
  { key: 'shooting', label: 'Skyting', group: 'producer' },
  { key: 'shotlist', label: 'Shotliste', group: 'producer' },
  { key: 'mannskap', label: 'Mannskap', group: 'producer' },
  { key: 'agent', label: 'Agent', group: 'producer' },
  { key: 'admin-room', label: 'Admin Room', group: 'producer' },
];

export default function WorkspaceNavEditor({ workspace = 'creatorhub' }: { workspace?: string } = {}) {
  const [ov, setOv] = React.useState<Record<string, NavPatch>>({});
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.tokens && d.tokens.nav && typeof d.tokens.nav === 'object') setOv(d.tokens.nav); })
      .catch(() => {});
  }, [workspace]);

  const patch = (key: string, field: keyof NavPatch, value: unknown) => {
    setOv((prev) => {
      const next = { ...prev, [key]: { ...prev[key] } };
      if (value === '' || value == null || value === false) delete (next[key] as any)[field];
      else (next[key] as any)[field] = value;
      if (Object.keys(next[key]).length === 0) delete next[key];
      return next;
    });
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/design/tokens/${encodeURIComponent(workspace)}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nav: ov }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ type: 'error', text: d.error || 'Lagring feilet' }); return; }
      setMsg({ type: 'success', text: 'Navigasjonen er lagret. WorkspaceShell bruker den ved neste last.' });
    } catch (e) { setMsg({ type: 'error', text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  const navItems: Array<{ key: string; label: string; group: string }> =
    workspace === 'theroleroom' ? ROLEROOM_NAV : WS_NAV.map((n) => ({ key: n.key, label: n.label, group: n.group }));
  const groups: string[] = workspace === 'theroleroom' ? ['faner', 'producer'] : ['hoved', 'rom', 'klient'];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Navigasjon</Typography>
        <Typography variant="body2" color="text.secondary">
          Overstyr menyen som data — endre navn, tell-badge, skjul en flate
          eller endre rekkefølge. Tomt felt = standard. Ingen deploy.
        </Typography>
      </Box>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {groups.map((g) => {
        const items = navItems.filter((n) => n.group === g);
        if (!items.length) return null;
        return (
          <Box key={g}>
            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.8, color: 'text.secondary' }}>
              {GROUP_LABEL[g].toUpperCase()}
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={0.5} sx={{ mt: 0.5 }}>
              {items.map((n) => {
                const p = ov[n.key] || {};
                return (
                  <Stack key={n.key} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
                    <Typography sx={{ width: 130, flexShrink: 0, fontSize: 13, color: 'text.secondary' }} noWrap>
                      {n.label}
                    </Typography>
                    <TextField size="small" placeholder={n.label} value={p.label ?? ''}
                      onChange={(e) => patch(n.key, 'label', e.target.value)} sx={{ flex: 1 }} />
                    <TextField size="small" type="number" placeholder="badge" value={p.badge ?? ''}
                      onChange={(e) => patch(n.key, 'badge', e.target.value === '' ? '' : Number(e.target.value))}
                      sx={{ width: 84 }} />
                    <TextField size="small" type="number" placeholder="rekkef." value={p.order ?? ''}
                      onChange={(e) => patch(n.key, 'order', e.target.value === '' ? '' : Number(e.target.value))}
                      sx={{ width: 84 }} />
                    <Stack direction="row" alignItems="center" sx={{ width: 78 }}>
                      <Checkbox size="small" checked={!!p.hidden} onChange={(e) => patch(n.key, 'hidden', e.target.checked)} />
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Skjul</Typography>
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        );
      })}

      <Box>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Lagrer…' : 'Lagre navigasjon'}
        </Button>
      </Box>
    </Stack>
  );
}
