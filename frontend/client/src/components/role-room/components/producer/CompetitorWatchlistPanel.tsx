/**
 * CompetitorWatchlistPanel — Page Metadata 2.0 Fase 1.
 *
 * Watchlist-CRUD for konkurrent-/inspirasjons-brands per prosjekt.
 * Plassert i Research-Accordion. Snapshot-fetcher kommer i Fase 1.5;
 * inntil da viser metrics "—" og bruker registrerer brands manuelt.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Paper, Select,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from "@mui/icons-material";

interface WatchlistEntry {
  id: string; project_id: string; user_id: string; brand_name: string;
  platform: "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube";
  external_id: string; added_at: string; last_fetched_at: string | null;
  metadata: Record<string, unknown> | null;
  latest_followers?: string | null; latest_fetched?: string | null;
}

const PLATFORMS: Array<{ id: WatchlistEntry["platform"]; label: string; placeholder: string }> = [
  { id: "facebook", label: "Facebook", placeholder: "Page ID (siffer-streng)" },
  { id: "instagram", label: "Instagram", placeholder: "IG Business User ID" },
  { id: "tiktok", label: "TikTok", placeholder: "@brukernavn" },
  { id: "linkedin", label: "LinkedIn", placeholder: "urn:li:organization:..." },
  { id: "youtube", label: "YouTube", placeholder: "Channel ID (UC...)" },
];

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = localStorage.getItem("roleRoomApiKey") ?? "";
  const authToken = localStorage.getItem("creatorhub_auth_token") ||
    localStorage.getItem("authToken") || localStorage.getItem("auth_token") ||
    localStorage.getItem("token") || "";
  if (apiKey) headers["x-api-key"] = apiKey;
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return headers;
}

export default function CompetitorWatchlistPanel({ projectId }: { projectId: string }) {
  const [list, setList] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBrand, setAddBrand] = useState("");
  const [addPlatform, setAddPlatform] = useState<WatchlistEntry["platform"]>("facebook");
  const [addExtId, setAddExtId] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`/api/role-room/competitors/watchlist?projectId=${encodeURIComponent(projectId)}`, { headers: authHeaders() });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as { watchlist: WatchlistEntry[] };
      setList(json.watchlist ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const submitAdd = useCallback(async () => {
    if (!addBrand.trim() || !addExtId.trim()) return;
    setAddLoading(true); setError(null);
    try {
      const resp = await fetch("/api/role-room/competitors/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ projectId, brandName: addBrand.trim(), platform: addPlatform, externalId: addExtId.trim() }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`add feilet (${resp.status}): ${text.slice(0, 150)}`);
      }
      setAddOpen(false); setAddBrand(""); setAddExtId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setAddLoading(false); }
  }, [addBrand, addExtId, addPlatform, projectId, refresh]);

  const removeEntry = useCallback(async (id: string) => {
    if (!confirm("Fjerne fra watchlist?")) return;
    try {
      const resp = await fetch(`/api/role-room/competitors/watchlist/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!resp.ok && resp.status !== 204) {
        const text = await resp.text();
        throw new Error(`delete feilet (${resp.status}): ${text.slice(0, 150)}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [refresh]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>Konkurrent-watchlist</Typography>
        <Chip size="small" label="FASE 1 — fetch i 1.5" variant="outlined" sx={{ fontSize: 10 }} />
        <Tooltip title="Refresh"><span><IconButton size="small" onClick={refresh} disabled={loading}>{loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}</IconButton></span></Tooltip>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>Legg til</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        Konkurrenter/inspirasjons-brands for vedvarende observasjon. Daglig snapshot + trend-grafer kommer i Fase 1.5.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      {list.length === 0 && !loading ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", py: 2 }}>
          Ingen konkurrenter watchlistet på dette prosjektet ennå.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead><TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Brand</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Platform</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>External ID</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Følgere</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Sist hentet</TableCell>
            <TableCell />
          </TableRow></TableHead>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.brand_name}</TableCell>
                <TableCell><Chip size="small" label={row.platform} variant="outlined" /></TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{row.external_id}</TableCell>
                <TableCell align="right">{row.latest_followers ? Number(row.latest_followers).toLocaleString("no") : "—"}</TableCell>
                <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>{row.last_fetched_at ? new Date(row.last_fetched_at).toLocaleString("no") : "—"}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => removeEntry(row.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til konkurrent</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Brand-navn" fullWidth value={addBrand} onChange={(e) => setAddBrand(e.target.value)} autoFocus />
            <FormControl fullWidth>
              <InputLabel>Platform</InputLabel>
              <Select label="Platform" value={addPlatform} onChange={(e) => setAddPlatform(e.target.value as WatchlistEntry["platform"])}>
                {PLATFORMS.map((p) => (<MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField label="External ID" fullWidth value={addExtId} onChange={(e) => setAddExtId(e.target.value)}
              placeholder={PLATFORMS.find((p) => p.id === addPlatform)?.placeholder ?? ""}
              helperText="Plattform-spesifikk ID — Fase 1.5 leverer en finder-helper per plattform."
              sx={{ "& input": { fontFamily: "monospace", fontSize: 12 } }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={addLoading}>Avbryt</Button>
          <Button variant="contained" onClick={submitAdd} disabled={!addBrand.trim() || !addExtId.trim() || addLoading}
            startIcon={addLoading ? <CircularProgress size={14} /> : <AddIcon />}>
            {addLoading ? "Legger til…" : "Legg til"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
