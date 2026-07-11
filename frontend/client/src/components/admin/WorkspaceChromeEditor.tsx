/**
 * WorkspaceChromeEditor — CreatorHub Design (Fase B): rediger shell-chrome-paletten
 * (bakgrunn, sidebar, panel, ramme, tekst) som DATA. Lagres i design-tokens under
 * `chrome`-namespace (ws=creatorhub). WorkspaceShell setter --ws-* på :root fra chrome
 * ved neste last. Tomt felt = den mørke standard-literalen (fallback i workspaceTheme).
 * Tekst-felt (ikke color-picker) fordi flere verdier er rgba m/ alpha.
 */
import React from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';

// Redigerbare chrome-nøkler (må matche WS_CHROME_VAR i WorkspaceShell + ALLOWED i store).
const CHROME_FIELDS: { key: string; label: string; def: string }[] = [
  { key: 'bg', label: 'App-bakgrunn', def: '#0a0f1a' },
  { key: 'bgSidebar', label: 'Sidebar', def: '#0b1120' },
  { key: 'panelSolid', label: 'Panel / kort', def: '#0f1729' },
  { key: 'panel', label: 'Panel (glass)', def: 'rgba(15,23,42,0.72)' },
  { key: 'border', label: 'Ramme', def: 'rgba(255,255,255,0.12)' },
  { key: 'text', label: 'Tekst', def: 'rgba(255,255,255,0.95)' },
  { key: 'textDim', label: 'Tekst (dempet)', def: 'rgba(255,255,255,0.62)' },
];

export default function WorkspaceChromeEditor({ workspace = 'creatorhub' }: { workspace?: string } = {}) {
  const [chrome, setChrome] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.tokens && d.tokens.chrome && typeof d.tokens.chrome === 'object') setChrome(d.tokens.chrome); })
      .catch(() => {});
  }, [workspace]);

  const set = (k: string, v: string) => setChrome((prev) => {
    const next = { ...prev };
    if (v === '') delete next[k]; else next[k] = v;
    return next;
  });

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/design/tokens/${encodeURIComponent(workspace)}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chrome }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ type: 'error', text: d.error || 'Lagring feilet' }); return; }
      setMsg({ type: 'success', text: 'Chrome-paletten er lagret. WorkspaceShell bruker den ved neste last.' });
    } catch (e) { setMsg({ type: 'error', text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Shell-palett</Typography>
        <Typography variant="body2" color="text.secondary">
          Overstyr bakgrunn, panel, ramme og tekst i Team Workspace-shell-en som data. Tomt felt =
          standard (mørk). Aksepterer hex eller rgba(). Ingen deploy.
        </Typography>
      </Box>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Stack spacing={1.25}>
        {CHROME_FIELDS.map((f) => (
          <Stack key={f.key} direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ width: 150, flexShrink: 0, fontSize: 13, color: 'text.secondary' }} noWrap>{f.label}</Typography>
            <Box sx={{ width: 28, height: 28, flexShrink: 0, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: chrome[f.key] || f.def }} />
            <TextField size="small" fullWidth placeholder={f.def} value={chrome[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)} sx={{ fontFamily: 'monospace' }} />
          </Stack>
        ))}
      </Stack>

      <Box>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Lagrer…' : 'Lagre shell-palett'}
        </Button>
      </Box>
    </Stack>
  );
}
