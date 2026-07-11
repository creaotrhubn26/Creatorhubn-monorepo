/**
 * DesignTokensTab — admin-UI for merkevare-tokens per workspace (CreatorHub Design).
 *
 * Rediger farge/font per produkt-workspace. Lagres i DB → render.png + konnektorene
 * blir on-brand uten deploy. 'global' er delt basis alle arver; produkter overstyrer.
 */
import React from 'react';
import {
  Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography, Alert, Divider,
} from '@mui/material';
import WorkspaceNavEditor from './WorkspaceNavEditor';
import WorkspaceCopyEditor from './WorkspaceCopyEditor';

const WORKSPACES = [
  { value: 'global', label: 'Global (delt basis)' },
  { value: 'creatorhub', label: 'CreatorHub' },
  { value: 'theroleroom', label: 'The Role Room' },
  { value: 'leadgrid', label: 'Leadgrid' },
];

const FIELDS: { key: string; label: string; type: 'color' | 'text' }[] = [
  { key: 'accent', label: 'Aksent', type: 'color' },
  { key: 'accentDark', label: 'Aksent (mørk)', type: 'color' },
  { key: 'bgSoft', label: 'Myk bakgrunn', type: 'color' },
  { key: 'text', label: 'Tekstfarge', type: 'color' },
  { key: 'fontFamily', label: 'Font-family', type: 'text' },
];

function b64url(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function DesignTokensTab({ workspace }: { workspace?: string } = {}) {
  // Når shell-en styrer workspace (prop), skjuler vi den egne velgeren.
  const controlled = typeof workspace === 'string' && workspace.length > 0;
  const [wsState, setWs] = React.useState('creatorhub');
  const ws = controlled ? (workspace as string) : wsState;
  const [tokens, setTokens] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewKey, setPreviewKey] = React.useState(0);

  const load = React.useCallback((w: string) => {
    fetch(`/api/design/tokens?ws=${encodeURIComponent(w)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Kunne ikke hente tokens'))))
      .then((d) => setTokens(d.tokens || {}))
      .catch((e) => setMsg({ type: 'error', text: e.message }));
  }, []);
  React.useEffect(() => { load(ws); }, [ws, load]);

  const set = (k: string, v: string) => setTokens((t) => ({ ...t, [k]: v }));

  const save = async () => {
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/design/tokens/${encodeURIComponent(ws)}`, {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokens),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ type: 'error', text: d.error || 'Lagring feilet' }); return; }
      setMsg({ type: 'success', text: `Tokens for «${ws}» lagret. render.png + konnektorer bruker dem umiddelbart.` });
      setPreviewKey((k) => k + 1);
    } catch (e) { setMsg({ type: 'error', text: (e as Error).message }); }
  };

  // Live-preview: donut med workspacets aksent (fra det redigerte feltet).
  const d = b64url({ value: '87%', label: 'Merkevare' });
  const previewSrc = `/api/infographics/render.png?tpl=donut&d=${d}&accent=${encodeURIComponent(tokens.accent || '#2f6df0')}&_=${previewKey}`;

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Design-tokens</Typography>
      <Typography variant="body2" color="text.secondary">
        Merkevaren (farge/font) er data per workspace. Endringer trer i kraft i render.png +
        konnektorene <b>uten deploy</b>. «Global» arves av alle; produkter overstyrer kun det de vil.
      </Typography>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {!controlled && (
        <TextField select label="Workspace" size="small" value={ws} onChange={(e) => setWs(e.target.value)} sx={{ maxWidth: 280 }}>
          {WORKSPACES.map((w) => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
        </TextField>
      )}

      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <Stack spacing={1.5} sx={{ flex: 1 }}>
              {FIELDS.map((f) => (
                <Stack key={f.key} direction="row" spacing={1.5} alignItems="center">
                  {f.type === 'color' && (
                    <input type="color" value={tokens[f.key] || '#000000'} onChange={(e) => set(f.key, e.target.value)}
                      style={{ width: 40, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
                  )}
                  <TextField label={f.label} size="small" value={tokens[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}
                    fullWidth sx={f.type === 'text' ? { fontFamily: 'monospace' } : undefined} />
                </Stack>
              ))}
              <Box>
                <Button variant="contained" onClick={save}>Lagre tokens for «{ws}»</Button>
              </Box>
            </Stack>
            <Box sx={{ minWidth: 280 }}>
              <Typography variant="caption" color="text.secondary">Live-preview (aksent):</Typography>
              <Box sx={{ mt: 0.5, p: 1, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', justifyContent: 'center' }}>
                <img key={previewSrc} src={previewSrc} alt="preview" style={{ maxWidth: '100%', maxHeight: 220 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }} />
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
      {ws === 'creatorhub' && (
        <>
          <Divider />
          <WorkspaceNavEditor workspace="creatorhub" />
          <Divider />
          <WorkspaceCopyEditor workspace="creatorhub" />
        </>
      )}
      <Divider />
      <Typography variant="caption" color="text.secondary">
        Neste steg i CreatorHub Design: justerings-knotter i overlay-editoren skrur på nettopp disse tokenene.
      </Typography>
    </Stack>
  );
}
