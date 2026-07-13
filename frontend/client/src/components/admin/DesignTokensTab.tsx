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
import WorkspaceChromeEditor from './WorkspaceChromeEditor';
import WorkspaceTokenAudit from './WorkspaceTokenAudit';
import WorkspaceMetricsEditor from './WorkspaceMetricsEditor';
import { useAuth } from '@/hooks/useAuth';

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
  { key: 'landingAccent', label: 'Landingsside-aksent', type: 'color' },
  { key: 'landingBg', label: 'Landingsside-bakgrunn', type: 'color' },
  { key: 'landingText', label: 'Landingsside-tekst', type: 'color' },
  { key: 'portalAccent', label: 'Portal-aksent (Role Room)', type: 'color' },
  { key: 'cyanAccent', label: 'Cyan-aksent (Role Room-arbeidsflate)', type: 'color' },
  { key: 'violetAccent', label: 'Fiolett-aksent (Role Room)', type: 'color' },
  { key: 'notifBg', label: 'Notifikasjon: bakgrunn', type: 'color' },
  { key: 'notifText', label: 'Notifikasjon: tekst', type: 'color' },
  { key: 'notifRadius', label: 'Notifikasjon: radius (f.eks. 12px)', type: 'text' },
  { key: 'notifShadow', label: 'Notifikasjon: skygge (box-shadow)', type: 'text' },
  { key: 'notifBorder', label: 'Notifikasjon: ramme (f.eks. 1px solid #333)', type: 'text' },
  { key: 'fontFamily', label: 'Font-family', type: 'text' },
];

function b64url(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function DesignTokensTab({ workspace }: { workspace?: string } = {}) {
  // Når shell-en styrer workspace (prop), skjuler vi den egne velgeren.
  const controlled = typeof workspace === 'string' && workspace.length > 0;
  // Rolle-tier (Fase D): kun super_admin ser reset/undo (destruktive governance-ops).
  const isSuperAdmin = (useAuth() as any)?.user?.role === 'super_admin';
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

  // Fase D: tilbakestill workspacet til standard (fjern overstyringer, re-seed merkevare).
  // Bekreft-på-klikk (to trinn) i stedet for window.confirm (blokkerer ikke, a11y-vennlig).
  const [resetArm, setResetArm] = React.useState(false);
  const reset = async () => {
    if (!resetArm) { setResetArm(true); return; }
    setResetArm(false); setMsg(null);
    try {
      const r = await fetch(`/api/admin/design/tokens/${encodeURIComponent(ws)}`, { method: 'DELETE', credentials: 'same-origin' });
      const dd = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ type: 'error', text: dd.error || 'Tilbakestilling feilet' }); return; }
      setMsg({ type: 'success', text: `«${ws}» tilbakestilt til standard.` });
      load(ws); setPreviewKey((k) => k + 1);
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
                      aria-label={`${f.label} — fargevelger`}
                      style={{ width: 40, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
                  )}
                  <TextField label={f.label} size="small" value={tokens[f.key] || ''} onChange={(e) => set(f.key, e.target.value)}
                    fullWidth sx={f.type === 'text' ? { fontFamily: 'monospace' } : undefined} />
                </Stack>
              ))}
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button variant="contained" onClick={save}>Lagre tokens for «{ws}»</Button>
                {isSuperAdmin && (
                  <Button variant="outlined" color="warning" onClick={reset} onBlur={() => setResetArm(false)}
                    aria-label={resetArm ? 'Bekreft: tilbakestill workspace til standard' : 'Tilbakestill workspace til standard (super_admin)'}>
                    {resetArm ? 'Sikker? Klikk igjen' : 'Tilbakestill til standard'}
                  </Button>
                )}
              </Stack>
            </Stack>
            <Box sx={{ minWidth: 280 }}>
              <Typography variant="caption" color="text.secondary">Live-preview (aksent):</Typography>
              <Box sx={{ mt: 0.5, p: 1, bgcolor: 'grey.100', borderRadius: 1, display: 'flex', justifyContent: 'center' }}>
                <img key={previewSrc} src={previewSrc} alt="preview" style={{ maxWidth: '100%', maxHeight: 220 }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                Notifikasjon-preview (gjelder alle toasts/meldinger ved lagring):
              </Typography>
              <Alert severity="success" sx={{
                mt: 0.5,
                backgroundColor: tokens.notifBg || undefined,
                color: tokens.notifText || undefined,
                borderRadius: tokens.notifRadius || undefined,
                boxShadow: tokens.notifShadow || undefined,
                border: tokens.notifBorder || undefined,
              }}>Lagret ✓</Alert>
            </Box>
          </Stack>
        </CardContent>
      </Card>
      {ws === 'creatorhub' && (
        <>
          <Divider />
          <WorkspaceChromeEditor workspace="creatorhub" />
          <Divider />
          <WorkspaceNavEditor workspace="creatorhub" />
          <Divider />
          <WorkspaceCopyEditor workspace="creatorhub" />
        </>
      )}
      {ws === 'theroleroom' && (
        <>
          <Divider />
          <WorkspaceChromeEditor workspace="theroleroom" />
          <Divider />
          <WorkspaceNavEditor workspace="theroleroom" />
          <Divider />
          <WorkspaceCopyEditor workspace="theroleroom" />
        </>
      )}
      <Divider />
      <WorkspaceMetricsEditor workspace={ws} />
      <Divider />
      <WorkspaceTokenAudit workspace={ws} refreshKey={previewKey} undoAllowed={isSuperAdmin}
        onReverted={() => { load(ws); setPreviewKey((k) => k + 1); setMsg({ type: 'success', text: 'Siste endring angret.' }); }} />
      <Divider />
      <Typography variant="caption" color="text.secondary">
        Neste steg i CreatorHub Design: justerings-knotter i overlay-editoren skrur på nettopp disse tokenene.
      </Typography>
    </Stack>
  );
}
