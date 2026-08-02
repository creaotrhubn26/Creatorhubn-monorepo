/**
 * ConnectedAppsPanel.tsx — «Tilkoblede apper» i brukerpreferanser.
 *
 * Viser AI-klienter (Claude Desktop/Cursor m.fl.) brukeren har koblet til The
 * Role Room via OAuth («Sign in with The Role Room»), og lar dem trekke tilbake
 * tilgangen. Kaller det sesjons-autentiserte connections-API-et.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Button, Chip, CircularProgress, Card,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material';
import { Link as LinkIcon, Delete as DeleteIcon } from '@mui/icons-material';
import authSessionService from '../services/authSessionService';

const ACCENT = '#8B5CF6';

interface Connection {
  clientId: string;
  clientName: string | null;
  scope: string[];
  connectedAt: string;
  lastActivityAt: string;
  tokenCount: number;
}

const scopeLabel = (scope: string[]): string =>
  scope.includes('projects.write') ? 'Lese og lage utkast' : 'Lese';

const fmtDate = (iso: string): string => {
  try { return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

export function ConnectedAppsPanel() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Connection | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/role-room/mcp/oauth/connections', { headers: authSessionService.getAuthHeadersSync() });
      if (res.status === 401) { setConnections([]); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { connections?: Connection[] };
      setConnections(data.connections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente tilkoblede apper');
      setConnections([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revoke = async (conn: Connection) => {
    setRevoking(conn.clientId); setError(null); setConfirm(null);
    try {
      const res = await fetch(`/api/role-room/mcp/oauth/connections/${encodeURIComponent(conn.clientId)}`, {
        method: 'DELETE', headers: authSessionService.getAuthHeadersSync(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke trekke tilbake tilgangen');
    } finally { setRevoking(null); }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <LinkIcon sx={{ color: ACCENT, fontSize: 20 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Tilkoblede apper</Typography>
      </Stack>
      <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mb: 1.5 }}>
        AI-apper (Claude, Cursor m.fl.) du har gitt tilgang til dine Role Room-data via «Sign in with The Role Room».
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

      {connections === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
      ) : connections.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: 13.5, py: 1 }}>Ingen tilkoblede apper.</Typography>
      ) : (
        <Stack spacing={1}>
          {connections.map((c) => (
            <Card key={c.clientId} variant="outlined" sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 2.5 }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{c.clientName || c.clientId}</Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={scopeLabel(c.scope)} size="small" sx={{ height: 20, bgcolor: 'rgba(139,92,246,0.14)', color: ACCENT, fontWeight: 700, fontSize: 11 }} />
                  <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>Tilkoblet {fmtDate(c.connectedAt)}</Typography>
                </Stack>
              </Box>
              <Button
                size="small" color="error" startIcon={<DeleteIcon />} disabled={revoking === c.clientId}
                onClick={() => setConfirm(c)} sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {revoking === c.clientId ? 'Trekker…' : 'Trekk tilbake'}
              </Button>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Trekk tilbake tilgangen?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14 }}>
            «{confirm?.clientName || confirm?.clientId}» mister umiddelbart tilgang til dine Role Room-data. Appen må kobles til på nytt for å få tilgang igjen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none' }}>Avbryt</Button>
          <Button color="error" variant="contained" onClick={() => confirm && revoke(confirm)} sx={{ textTransform: 'none', fontWeight: 700 }}>Trekk tilbake</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConnectedAppsPanel;
