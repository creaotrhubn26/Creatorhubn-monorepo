/**
 * WorkspaceCopyEditor — CreatorHub Design (Nivå 2b): rediger Team Workspace-tekstene
 * (knapper, gruppetitler) som DATA. Lagres i design-tokens (ws=creatorhub, nøkkel `copy`).
 * WorkspaceShell.t() slår copy[key] foran locale-ordboka ved neste last. Tomt = standard.
 */
import React from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';

// Redigerbare shell-tekst-nøkler pr. workspace (må matche t()-nøklene i shellen).
type CopyField = { key: string; label: string; def: string };
const COPY_FIELDS_BY_WS: Record<string, CopyField[]> = {
  creatorhub: [
    { key: 'newProject', label: 'Ny-prosjekt-knapp', def: 'Nytt prosjekt' },
    { key: 'clientView', label: 'Kundevisning-knapp', def: 'Kundevisning' },
    { key: 'inviteMember', label: 'Inviter-knapp', def: 'Inviter medlem' },
    { key: 'groupHoved', label: 'Gruppe: hovedmeny', def: 'HOVEDMENY' },
    { key: 'groupRom', label: 'Gruppe: smart rom', def: 'SMART ROM' },
    { key: 'groupKlient', label: 'Gruppe: kundeportal', def: 'KUNDEPORTAL' },
  ],
  // The Role Room klient-shell (ClientWorkspaceShell) — header-strenger (tr()-nøkler).
  theroleroom: [
    { key: 'header.title', label: 'Header-tittel', def: 'The Role Room' },
    { key: 'header.subtitle', label: 'Header-undertittel', def: 'Klient-flate' },
  ],
};

export default function WorkspaceCopyEditor({ workspace = 'creatorhub' }: { workspace?: string } = {}) {
  const COPY_FIELDS = COPY_FIELDS_BY_WS[workspace] ?? COPY_FIELDS_BY_WS.creatorhub;
  const [copy, setCopy] = React.useState<Record<string, string>>({});
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.tokens && d.tokens.copy && typeof d.tokens.copy === 'object') setCopy(d.tokens.copy); })
      .catch(() => {});
  }, [workspace]);

  const set = (k: string, v: string) => setCopy((prev) => {
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
        body: JSON.stringify({ copy }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ type: 'error', text: d.error || 'Lagring feilet' }); return; }
      setMsg({ type: 'success', text: 'Tekstene er lagret. WorkspaceShell bruker dem ved neste last.' });
    } catch (e) { setMsg({ type: 'error', text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Tekster</Typography>
        <Typography variant="body2" color="text.secondary">
          Overstyr knappe- og gruppetekstene i shell-en. Tomt felt = standard (locale). Ingen deploy.
        </Typography>
      </Box>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Stack spacing={1.25}>
        {COPY_FIELDS.map((f) => (
          <Stack key={f.key} direction="row" spacing={1.5} alignItems="center">
            <Typography sx={{ width: 150, flexShrink: 0, fontSize: 13, color: 'text.secondary' }} noWrap>{f.label}</Typography>
            <TextField size="small" fullWidth placeholder={f.def} value={copy[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)} />
          </Stack>
        ))}
      </Stack>

      <Box>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Lagrer…' : 'Lagre tekster'}
        </Button>
      </Box>
    </Stack>
  );
}
