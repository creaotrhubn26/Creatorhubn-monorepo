/**
 * WorkspaceTokenAudit — CreatorHub Design (Fase D governance): endringslogg for et
 * workspaces design-tokens. Leser append-only admin_activity_log (entity_type='design_tokens')
 * → hvem endret hvilke token-grupper når. Oppdateres når `refreshKey` endres (etter lagring).
 */
import React from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';

type AuditEntry = {
  user_id: string;
  action: string;
  summary: string | null;
  details: { email?: string | null; keys?: string[] } | null;
  created_at: string;
};

function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const s = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (s < 60) return `${s}s siden`;
    const m = Math.round(s / 60); if (m < 60) return `${m} min siden`;
    const h = Math.round(m / 60); if (h < 24) return `${h} t siden`;
    return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function WorkspaceTokenAudit({ workspace, refreshKey = 0, onReverted }: { workspace: string; refreshKey?: number; onReverted?: () => void }) {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const canUndo = entries.some((e) => e.action === 'updated');

  const undo = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/design/tokens/${encodeURIComponent(workspace)}/undo`, { method: 'POST', credentials: 'same-origin' });
      if (r.ok) onReverted?.(); // parent laster tokens + bumper refreshKey → loggen re-hentes
    } catch { /* ignorer */ }
    finally { setBusy(false); }
  };

  React.useEffect(() => {
    let live = true;
    fetch(`/api/admin/design/tokens/${encodeURIComponent(workspace)}/audit`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => { if (live) { setEntries(Array.isArray(d.entries) ? d.entries : []); setLoaded(true); } })
      .catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [workspace, refreshKey]);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Endringslogg</Typography>
          <Typography variant="body2" color="text.secondary">
            Hvem endret hvilke tokens når — append-only revisjonsspor for «{workspace}». Governance for
            flatene som nå styres av data.
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={undo} disabled={!canUndo || busy}
          aria-label={`Angre siste design-token-endring for ${workspace}`} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          {busy ? 'Angrer…' : 'Angre siste endring'}
        </Button>
      </Stack>
      {loaded && entries.length === 0 && (
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          Ingen registrerte endringer enda.
        </Typography>
      )}
      <Stack spacing={1}>
        {entries.map((e, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{e.summary || 'Endret design-tokens'}</Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                {(e.details?.keys || []).map((k) => <Chip key={k} label={k} size="small" variant="outlined" />)}
              </Stack>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>{e.details?.email || e.user_id}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>{timeAgo(e.created_at)}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
