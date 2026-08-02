/**
 * WorkspaceMetricsEditor — CreatorHub Design: definer DYNAMISKE infographic-kilder («marketing-metrics»)
 * som DATA. Hver metric = { key, value, label }. Infographics satt inn med kilde-nøkkelen
 * (?source=<key>) fletter server-side med disse → «koblet opp»: endre tallet ett sted, alle
 * infographics som bruker nøkkelen oppdateres (innen cache-TTL). Lagres i design-tokens `metrics`.
 */
import React from 'react';
import { Alert, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';

type Row = { key: string; value: string; label: string };

export default function WorkspaceMetricsEditor({ workspace = 'creatorhub' }: { workspace?: string } = {}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/design/tokens?ws=${encodeURIComponent(workspace)}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const m = d?.tokens?.metrics;
        if (m && typeof m === 'object') {
          setRows(Object.entries(m).map(([key, v]: [string, any]) => ({ key, value: String(v?.value ?? ''), label: String(v?.label ?? '') })));
        }
      })
      .catch(() => {});
  }, [workspace]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { key: '', value: '', label: '' }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true); setMsg(null);
    const metrics: Record<string, { value: string; label: string }> = {};
    for (const r of rows) {
      const key = r.key.trim();
      if (!/^[A-Za-z0-9_-]{1,60}$/.test(key)) continue;
      metrics[key] = { value: r.value, label: r.label };
    }
    try {
      const res = await fetch(`/api/admin/design/tokens/${encodeURIComponent(workspace)}`, {
        method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ type: 'error', text: d.error || 'Lagring feilet' }); return; }
      setMsg({ type: 'success', text: `${Object.keys(metrics).length} metric lagret. Infographics med ?source=<nøkkel> oppdateres.` });
    } catch (e) { setMsg({ type: 'error', text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Dynamiske infographic-kilder (metrics)</Typography>
        <Typography variant="body2" color="text.secondary">
          Definer navngitte tall (nøkkel · verdi · etikett). Sett inn en infographic med «Dynamisk kilde =
          nøkkel» i editoren → den henter alltid gjeldende verdi. Endre tallet her → alle infographics
          som bruker nøkkelen oppdateres, uten deploy.
        </Typography>
      </Box>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Stack spacing={1}>
        {rows.map((r, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="center">
            <TextField size="small" label="Nøkkel" placeholder="active_leads" value={r.key} onChange={(e) => setRow(i, { key: e.target.value })} sx={{ width: 180 }} />
            <TextField size="small" label="Verdi" placeholder="1200+" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} sx={{ width: 120 }} />
            <TextField size="small" label="Etikett" placeholder="Leads generert" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} fullWidth />
            <IconButton aria-label="Fjern" size="small" onClick={() => removeRow(i)}><DeleteIcon fontSize="small" /></IconButton>
          </Stack>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={addRow} sx={{ alignSelf: 'flex-start' }}>Legg til metric</Button>
      </Stack>
      <Box>
        <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Lagrer…' : 'Lagre metrics'}</Button>
      </Box>
    </Stack>
  );
}
