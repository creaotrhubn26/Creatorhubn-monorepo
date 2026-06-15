/**
 * ObservabilityPanel.tsx
 *
 * Sentry-erstatning i Admin Room. Viser alle backend + frontend errors
 * i én tabell med:
 *   - Live KPI-stripe (siste 24t, unresolved, per source, per status)
 *   - Filtre (source, level, status, endpoint-søk, user-email)
 *   - Top endpoints med flest errors
 *   - Stack-trace + meta + user-context per rad
 *   - "Åpne Clarity-session"-knapp (direct link)
 *   - "Mark as resolved" + reopen + delete
 *   - Auto-refresh 30 sek
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Select, Snackbar, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoMode as AutoRefreshIcon,
  CheckCircle as ResolveIcon,
  DeleteOutline as DeleteIcon,
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  OpenInNew as ExternalLinkIcon,
  PlayCircle as ClarityIcon,
  Refresh as RefreshIcon,
  ReplayCircleFilled as ReopenIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";

const CLARITY_PROJECT_ID = "wqgcu06tz0"; // theroleroom prosjekt

interface LoggedError {
  id: string;
  level: "error" | "warning" | "info";
  source: "backend" | "frontend";
  statusCode: number | null;
  endpoint: string | null;
  message: string;
  errorName: string | null;
  stack: string | null;
  userId: string | null;
  userEmail: string | null;
  claritySessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  url: string | null;
  meta: Record<string, unknown>;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolvedNote: string | null;
}

interface Stats {
  total24h: number;
  unresolvedTotal: number;
  bySource: Array<{ source: "backend" | "frontend"; count: number }>;
  byStatus: Array<{ statusCode: number; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("creatorhub_auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const LEVEL_COLOR = {
  error: "#fda4af",
  warning: "#fbbf24",
  info: "#60a5fa",
} as const;

const SOURCE_COLOR = {
  backend: "#a78bfa",
  frontend: "#34d399",
} as const;

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s siden`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m siden`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}t siden`;
  const day = Math.floor(hr / 24);
  return `${day}d siden`;
}

/** Bygger Clarity-dashboard-URL — filtrert på user_id om mulig. */
function clarityUrl(sessionId?: string | null, userEmail?: string | null): string {
  const base = `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/recordings`;
  if (sessionId) {
    return `${base}/${sessionId}`;
  }
  if (userEmail) {
    return `${base}?filters=${encodeURIComponent(JSON.stringify({ identifier: userEmail }))}`;
  }
  return base;
}

interface ErrorRowProps {
  err: LoggedError;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}

function ErrorRow({ err, onResolve, onReopen, onDelete }: ErrorRowProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow
        hover
        sx={{
          opacity: err.resolvedAt ? 0.5 : 1,
          "& > *": { borderBottom: "unset" },
        }}
      >
        <TableCell sx={{ width: 24 }}>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.3 }}>
            <Chip size="small" label={err.source}
              sx={{ bgcolor: `${SOURCE_COLOR[err.source]}22`, color: SOURCE_COLOR[err.source], fontSize: 9, height: 18 }} />
            {err.statusCode && (
              <Chip size="small" label={err.statusCode}
                sx={{ bgcolor: `${LEVEL_COLOR[err.level]}22`, color: LEVEL_COLOR[err.level], fontSize: 9, height: 18 }} />
            )}
            {err.occurrenceCount > 1 && (
              <Chip size="small" label={`×${err.occurrenceCount}`}
                sx={{ bgcolor: "rgba(251, 191, 36, 0.18)", color: "#fbbf24", fontSize: 9, height: 18, fontWeight: 700 }} />
            )}
          </Stack>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>
            {err.message.length > 80 ? err.message.slice(0, 80) + "…" : err.message}
          </Typography>
          {err.endpoint && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 10 }}>
              {err.endpoint}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          {err.userEmail ? (
            <Typography variant="caption">{err.userEmail}</Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">—</Typography>
          )}
        </TableCell>
        <TableCell>
          <Tooltip title={new Date(err.lastSeenAt).toLocaleString("nb-NO")}>
            <Typography variant="caption">{relativeTime(err.lastSeenAt)}</Typography>
          </Tooltip>
        </TableCell>
        <TableCell align="right">
          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            {(err.userEmail || err.claritySessionId) && (
              <Tooltip title="Åpne Clarity session replay">
                <IconButton
                  size="small"
                  href={clarityUrl(err.claritySessionId, err.userEmail)}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ color: "#fbbf24" }}
                >
                  <ClarityIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {err.resolvedAt ? (
              <Tooltip title="Gjenåpne">
                <IconButton size="small" onClick={() => onReopen(err.id)} sx={{ color: "#60a5fa" }}>
                  <ReopenIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Marker som løst">
                <IconButton size="small" onClick={() => onResolve(err.id)} sx={{ color: "#34d399" }}>
                  <ResolveIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Slett">
              <IconButton size="small" onClick={() => onDelete(err.id)} sx={{ color: "#fda4af" }}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0 }}>
            <Collapse in={expanded}>
              <Box sx={{ py: 2, px: 1, bgcolor: "rgba(0,0,0,0.2)" }}>
                <Stack spacing={1.5}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {err.errorName ? `${err.errorName}: ` : ""}{err.message}
                  </Typography>
                  {err.stack && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa" }}>
                        Stack trace
                      </Typography>
                      <Box component="pre" sx={{
                        bgcolor: "rgba(0,0,0,0.4)", p: 1, borderRadius: 1,
                        fontSize: 10, fontFamily: "monospace", overflowX: "auto",
                        maxHeight: 250, m: 0, color: "#cbd5e1",
                      }}>
                        {err.stack}
                      </Box>
                    </Box>
                  )}
                  <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", gap: 1 }}>
                    {err.url && (
                      <Box>
                        <Typography variant="caption" sx={{ display: "block", color: "#94a3b8" }}>URL</Typography>
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{err.url}</Typography>
                      </Box>
                    )}
                    {err.ip && (
                      <Box>
                        <Typography variant="caption" sx={{ display: "block", color: "#94a3b8" }}>IP</Typography>
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{err.ip}</Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" sx={{ display: "block", color: "#94a3b8" }}>Først sett</Typography>
                      <Typography variant="caption">{new Date(err.firstSeenAt).toLocaleString("nb-NO")}</Typography>
                    </Box>
                  </Stack>
                  {err.meta && Object.keys(err.meta).length > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa" }}>
                        Meta
                      </Typography>
                      <Box component="pre" sx={{
                        bgcolor: "rgba(0,0,0,0.4)", p: 1, borderRadius: 1,
                        fontSize: 10, fontFamily: "monospace", m: 0, color: "#cbd5e1",
                        overflowX: "auto",
                      }}>
                        {JSON.stringify(err.meta, null, 2)}
                      </Box>
                    </Box>
                  )}
                  {err.resolvedAt && err.resolvedNote && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      Løst {relativeTime(err.resolvedAt)} — {err.resolvedNote}
                    </Alert>
                  )}
                </Stack>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────

export default function ObservabilityPanel() {
  const [errors, setErrors] = useState<LoggedError[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  // Filter state
  const [showResolved, setShowResolved] = useState(false);
  const [filterSource, setFilterSource] = useState<"all" | "backend" | "frontend">("all");
  const [filterEndpoint, setFilterEndpoint] = useState("");
  const [filterUserEmail, setFilterUserEmail] = useState("");
  const [hoursAgo, setHoursAgo] = useState<24 | 72 | 168 | 0>(24);

  const [autoRefresh, setAutoRefresh] = useState(true);

  // Resolve dialog
  const [resolveTarget, setResolveTarget] = useState<LoggedError | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showResolved) params.set("showResolved", "true");
      if (filterSource !== "all") params.set("source", filterSource);
      if (filterEndpoint) params.set("endpoint", filterEndpoint);
      if (filterUserEmail) params.set("userEmail", filterUserEmail);
      if (hoursAgo > 0) params.set("hoursAgo", String(hoursAgo));

      const [errResp, statsResp] = await Promise.all([
        fetch(`/api/admin-room/errors?${params}`, { credentials: "include", headers: authHeaders() }),
        fetch(`/api/admin-room/errors/stats`, { credentials: "include", headers: authHeaders() }),
      ]);

      if (!errResp.ok) {
        const body = await errResp.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${errResp.status}`);
        return;
      }
      const errBody = await errResp.json();
      setErrors(errBody.errors ?? []);

      if (statsResp.ok) {
        const sBody = await statsResp.json();
        setStats(sBody.stats);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [showResolved, filterSource, filterEndpoint, filterUserEmail, hoursAgo]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-refresh hvert 30 sek
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { void fetchData(); }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const handleResolve = async () => {
    if (!resolveTarget) return;
    try {
      const r = await fetch(`/api/admin-room/errors/${resolveTarget.id}/resolve`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ note: resolveNote }),
      });
      if (r.ok) {
        setSnack("Markert som løst");
        setResolveTarget(null);
        setResolveNote("");
        void fetchData();
      } else {
        setSnack("Feil ved markering");
      }
    } catch (e) {
      setSnack(`Feil: ${e}`);
    }
  };

  const handleReopen = async (id: string) => {
    await fetch(`/api/admin-room/errors/${id}/reopen`, {
      method: "PATCH", credentials: "include", headers: authHeaders(),
    });
    void fetchData();
    setSnack("Gjenåpnet");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Slett denne feilen permanent?")) return;
    await fetch(`/api/admin-room/errors/${id}`, {
      method: "DELETE", credentials: "include", headers: authHeaders(),
    });
    void fetchData();
    setSnack("Slettet");
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningIcon sx={{ color: "#fbbf24" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Observability
          </Typography>
          <Chip size="small" label="Errors · Sessions · Health"
            sx={{ bgcolor: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", fontSize: 10, fontWeight: 700 }} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<AutoRefreshIcon />}
            onClick={() => setAutoRefresh(!autoRefresh)}
            sx={{ color: autoRefresh ? "#34d399" : "text.secondary" }}
          >
            Auto-refresh {autoRefresh ? "PÅ" : "AV"}
          </Button>
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => fetchData()}>
            Oppdater
          </Button>
          <Button
            size="small" variant="outlined"
            startIcon={<ExternalLinkIcon sx={{ fontSize: 14 }} />}
            href={`https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}/dashboard`}
            target="_blank" rel="noreferrer"
            sx={{ borderColor: "#fbbf24", color: "#fbbf24" }}
          >
            Clarity dashboard
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Alle backend (500/401) og frontend (JS-crash) errors siste 24t. Gruppert per
        fingerprint — samme feil incrementer count i stedet for å spamme lista.
        Klikk Clarity-ikon for å se brukerens skjerm-replay.
      </Typography>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI-stripe */}
      {stats && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Siste 24t</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "#fbbf24" }}>
                {stats.total24h}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Uløste totalt</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "#fda4af" }}>
                {stats.unresolvedTotal}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Per kilde</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                {stats.bySource.map((s) => (
                  <Chip key={s.source} size="small"
                    label={`${s.source}: ${s.count}`}
                    sx={{ bgcolor: `${SOURCE_COLOR[s.source]}22`, color: SOURCE_COLOR[s.source], fontWeight: 700 }} />
                ))}
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Top status-koder</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                {stats.byStatus.slice(0, 4).map((s) => (
                  <Chip key={s.statusCode} size="small"
                    label={`${s.statusCode}: ${s.count}`}
                    sx={{ bgcolor: "rgba(253, 164, 175, 0.2)", color: "#fda4af", fontWeight: 700 }} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}

      {/* Top endpoints */}
      {stats && stats.topEndpoints.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Top endpoints siste 24t
            </Typography>
            <Stack spacing={0.5}>
              {stats.topEndpoints.slice(0, 5).map((e) => (
                <Stack key={e.endpoint} direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ cursor: "pointer", "&:hover": { opacity: 0.8 } }}
                  onClick={() => setFilterEndpoint(e.endpoint)}
                >
                  <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 11 }}>
                    {e.endpoint}
                  </Typography>
                  <Chip size="small" label={e.count}
                    sx={{ bgcolor: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", fontWeight: 700, height: 18 }} />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Filtre */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Select size="small" value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
              sx={{ minWidth: 120 }}>
              <MenuItem value="all">Alle kilder</MenuItem>
              <MenuItem value="backend">Backend</MenuItem>
              <MenuItem value="frontend">Frontend</MenuItem>
            </Select>
            <Select size="small" value={hoursAgo}
              onChange={(e) => setHoursAgo(Number(e.target.value) as typeof hoursAgo)}
              sx={{ minWidth: 110 }}>
              <MenuItem value={24}>Siste 24t</MenuItem>
              <MenuItem value={72}>Siste 3 dager</MenuItem>
              <MenuItem value={168}>Siste 7 dager</MenuItem>
              <MenuItem value={0}>Alt</MenuItem>
            </Select>
            <TextField size="small" placeholder="Endpoint…"
              value={filterEndpoint}
              onChange={(e) => setFilterEndpoint(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 14, mr: 0.5, color: "text.secondary" }} /> }}
              sx={{ minWidth: 180 }} />
            <TextField size="small" placeholder="Bruker-email…"
              value={filterUserEmail}
              onChange={(e) => setFilterUserEmail(e.target.value)}
              sx={{ minWidth: 180 }} />
            <Button size="small"
              onClick={() => setShowResolved(!showResolved)}
              sx={{ color: showResolved ? "#34d399" : "text.secondary" }}>
              {showResolved ? "Vis kun uløste" : "Inkluder løste"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Errors table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : errors.length === 0 ? (
        <Alert severity="success">
          🎉 Ingen uløste feil i valgt periode. Bra jobbet.
        </Alert>
      ) : (
        <TableContainer component={Card}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Type</TableCell>
                <TableCell>Feil</TableCell>
                <TableCell>Bruker</TableCell>
                <TableCell>Sist sett</TableCell>
                <TableCell align="right">Handling</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {errors.map((err) => (
                <ErrorRow key={err.id} err={err}
                  onResolve={(id) => setResolveTarget(errors.find((e) => e.id === id) ?? null)}
                  onReopen={handleReopen}
                  onDelete={handleDelete}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Resolve dialog */}
      <Dialog open={!!resolveTarget} onClose={() => setResolveTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Marker som løst</DialogTitle>
        <DialogContent>
          {resolveTarget && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {resolveTarget.message}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {resolveTarget.endpoint} · {resolveTarget.occurrenceCount} forekomster
              </Typography>
            </Box>
          )}
          <TextField
            label="Hva ble løst? (valgfritt)"
            fullWidth multiline rows={2}
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="F.eks. 'Fikset CORS-config i PR #558'"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveTarget(null)}>Avbryt</Button>
          <Button variant="contained" onClick={handleResolve}
            sx={{ bgcolor: "#34d399", color: "#0a0a0f", "&:hover": { bgcolor: "#10b981" } }}>
            Marker løst
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000}
        onClose={() => setSnack(null)} message={snack} />
    </Box>
  );
}
