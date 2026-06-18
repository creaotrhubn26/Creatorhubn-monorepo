/**
 * ApiAndWebhooksTab.tsx
 *
 * Superadmin-UI for partner-API:
 *   - API-keys (opprett + revoke + se siste-bruk + 7d-calls)
 *   - Webhook-endpoints (CRUD + test-event)
 *   - Delivery-log (siste 100)
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Box, Stack, Typography, Button, Card, CardContent, Chip, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Alert, Snackbar, Tab, Tabs,
  Table, TableHead, TableBody, TableRow, TableCell, CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyIcon from "@mui/icons-material/Key";
import WebhookIcon from "@mui/icons-material/Webhook";
import SendIcon from "@mui/icons-material/Send";
import HistoryIcon from "@mui/icons-material/History";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { apiFetch } from "@/lib/queryClient";

const AVAILABLE_SCOPES = [
  { key: "customers.read", label: "Lese kunder" },
  { key: "customers.write", label: "Opprette kunder" },
  { key: "needs.read", label: "Lese needs" },
  { key: "signals.read", label: "Lese signals" },
  { key: "deliverables.read", label: "Lese deliverables" },
  { key: "organizations.read", label: "Lese org-info" },
  { key: "webhooks.read", label: "Webhook-historikk" },
];

const AVAILABLE_EVENTS = [
  "customer.created",
  "customer.updated",
  "customer.needs_changed",
  "customer.score_changed",
  "deliverable.completed",
  "focus_request.created",
  "partnership.approved",
  "intent_agreement.signed",
];

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  partner_id: string | null;
  organization_id: string | null;
  partner_name: string | null;
  organization_name: string | null;
  is_active: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  calls_7d: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  is_active: boolean;
  partner_id: string | null;
  organization_id: string | null;
  partner_name: string | null;
  organization_name: string | null;
  last_delivery_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
  auto_disabled_at: string | null;
  created_at: string;
}

interface Delivery {
  id: string;
  endpoint_id: string;
  endpoint_url: string;
  event_type: string;
  event_id: string;
  attempt_number: number;
  scheduled_at: string;
  attempted_at: string | null;
  response_status: number | null;
  duration_ms: number | null;
  success: boolean | null;
  error_message: string | null;
  next_retry_at: string | null;
}

export default function ApiAndWebhooksTab() {
  const [subtab, setSubtab] = useState<"keys" | "webhooks" | "deliveries">("keys");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [newEndpointOpen, setNewEndpointOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ raw_key: string; warning: string } | null>(null);
  const [createdSecret, setCreatedSecret] = useState<{ signing_secret: string; warning: string } | null>(null);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, e, d] = await Promise.all([
        apiFetch("/api/superadmin/api-keys"),
        apiFetch("/api/superadmin/webhook-endpoints"),
        apiFetch("/api/superadmin/webhook-deliveries"),
      ]);
      if (k.ok) setKeys((await k.json()).data ?? []);
      if (e.ok) setEndpoints((await e.json()).data ?? []);
      if (d.ok) setDeliveries((await d.json()).data ?? []);
    } catch (err) { setSnackbar({ msg: String(err), severity: "error" }); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setSnackbar({ msg: "Kopiert", severity: "success" }),
      () => setSnackbar({ msg: "Kopiering feilet", severity: "error" }),
    );
  };

  const revokeKey = async (id: string) => {
    if (!window.confirm("Tilbakekall denne API-keyen? Den fungerer ikke etterpå.")) return;
    const r = await apiFetch(`/api/superadmin/api-keys/${id}/revoke`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Manuelt revoked av super-admin" }),
    });
    if (r.ok) { setSnackbar({ msg: "Tilbakekalt", severity: "success" }); load(); }
  };

  const testWebhook = async (id: string) => {
    const r = await apiFetch(`/api/superadmin/webhook-endpoints/${id}/test`, { method: "POST" });
    const d = await r.json();
    if (r.ok) setSnackbar({
      msg: `Test-event sendt (scheduled: ${d.scheduled})`, severity: "success",
    });
    else setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
    setTimeout(load, 2000);
  };

  const toggleEndpoint = async (e: WebhookEndpoint) => {
    await apiFetch(`/api/superadmin/webhook-endpoints/${e.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !e.is_active }),
    });
    load();
  };

  const deleteEndpoint = async (id: string) => {
    if (!window.confirm("Slett dette webhook-endpoint?")) return;
    await apiFetch(`/api/superadmin/webhook-endpoints/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Tabs value={subtab} onChange={(_, v) => setSubtab(v)}
              sx={{ "& .MuiTab-root": { color: "rgba(255,255,255,0.7)", textTransform: "none" } }}>
          <Tab label={`API-keys (${keys.length})`} value="keys" icon={<KeyIcon />} iconPosition="start" />
          <Tab label={`Webhooks (${endpoints.length})`} value="webhooks" icon={<WebhookIcon />} iconPosition="start" />
          <Tab label={`Deliveries (${deliveries.length})`} value="deliveries" icon={<HistoryIcon />} iconPosition="start" />
        </Tabs>
        {subtab !== "deliveries" && (
          <Button variant="contained" startIcon={<AddIcon />}
                  onClick={() => subtab === "keys" ? setNewKeyOpen(true) : setNewEndpointOpen(true)}
                  sx={{ bgcolor: "#9be15d", color: "#0a0e1a", "&:hover": { bgcolor: "#7fb849" } }}>
            {subtab === "keys" ? "Ny API-key" : "Nytt webhook"}
          </Button>
        )}
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : subtab === "keys" ? (
        <KeysList keys={keys} onRevoke={revokeKey} onCopy={copy} />
      ) : subtab === "webhooks" ? (
        <EndpointsList endpoints={endpoints}
                       onTest={testWebhook} onToggle={toggleEndpoint} onDelete={deleteEndpoint} />
      ) : (
        <DeliveriesList deliveries={deliveries} />
      )}

      <NewKeyDialog open={newKeyOpen} onClose={() => setNewKeyOpen(false)}
                    onCreated={(rawKey, warning) => {
                      setNewKeyOpen(false);
                      setCreatedKey({ raw_key: rawKey, warning });
                      load();
                    }}
                    onError={(msg) => setSnackbar({ msg, severity: "error" })} />

      <NewEndpointDialog open={newEndpointOpen} onClose={() => setNewEndpointOpen(false)}
                         onCreated={(secret, warning) => {
                           setNewEndpointOpen(false);
                           setCreatedSecret({ signing_secret: secret, warning });
                           load();
                         }}
                         onError={(msg) => setSnackbar({ msg, severity: "error" })} />

      {createdKey && (
        <Dialog open onClose={() => setCreatedKey(null)} maxWidth="md" fullWidth
                PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
          <DialogTitle>API-key opprettet</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>{createdKey.warning}</Alert>
            <Box sx={{ p: 2, bgcolor: "rgba(155,225,93,0.10)", borderRadius: 2,
                        fontFamily: "monospace", wordBreak: "break-all", border: "1px solid rgba(155,225,93,0.30)" }}>
              {createdKey.raw_key}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => copy(createdKey.raw_key)} startIcon={<ContentCopyIcon />}>Kopier</Button>
            <Button onClick={() => setCreatedKey(null)} variant="contained">Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      {createdSecret && (
        <Dialog open onClose={() => setCreatedSecret(null)} maxWidth="md" fullWidth
                PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
          <DialogTitle>Webhook signing-secret</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>{createdSecret.warning}</Alert>
            <Box sx={{ p: 2, bgcolor: "rgba(155,225,93,0.10)", borderRadius: 2,
                        fontFamily: "monospace", wordBreak: "break-all", border: "1px solid rgba(155,225,93,0.30)" }}>
              {createdSecret.signing_secret}
            </Box>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", mt: 1, display: "block" }}>
              Bruk denne secret for å validere HMAC-SHA256-signaturen i hver webhook (X-Leadgrid-Signature).
              Se developer-docs på /leadgrid/utviklere.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => copy(createdSecret.signing_secret)} startIcon={<ContentCopyIcon />}>Kopier</Button>
            <Button onClick={() => setCreatedSecret(null)} variant="contained">Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}
                message={snackbar?.msg} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

function KeysList({ keys, onRevoke, onCopy }: {
  keys: ApiKey[]; onRevoke: (id: string) => void; onCopy: (text: string) => void;
}) {
  if (keys.length === 0) return <EmptyState text="Ingen API-keys ennå" />;
  return (
    <Stack spacing={1.5}>
      {keys.map((k) => (
        <Card key={k.id} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff",
                                opacity: k.is_active && !k.revoked_at ? 1 : 0.5 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box flex={1}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" mb={0.5}>
                  <Typography variant="h6">{k.name}</Typography>
                  {!k.is_active && <Chip size="small" label="revoked" sx={{ bgcolor: "#ff6b6b", color: "#0a0512", fontWeight: 600 }} />}
                  {k.partner_name && <Chip size="small" label={`partner: ${k.partner_name}`}
                                            sx={{ bgcolor: "rgba(167,139,250,0.15)", color: "#a78bfa" }} />}
                  {k.organization_name && <Chip size="small" label={`org: ${k.organization_name}`}
                                                 sx={{ bgcolor: "rgba(122,184,255,0.15)", color: "#7ab8ff" }} />}
                </Stack>
                <Box sx={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {k.key_prefix}…
                </Box>
                <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" rowGap={0.5}>
                  {k.scopes.map((s) => (
                    <Chip key={s} size="small" label={s}
                          sx={{ height: 18, fontSize: 10, bgcolor: "rgba(155,225,93,0.10)", color: "#9be15d" }} />
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mt: 0.5, display: "block" }}>
                  {Number(k.calls_7d) > 0 && `${k.calls_7d} calls siste 7d · `}
                  {k.last_used_at ? `sist brukt ${new Date(k.last_used_at).toLocaleString("no-NO")}` : "aldri brukt"}
                  {k.expires_at && ` · utløper ${new Date(k.expires_at).toLocaleDateString("no-NO")}`}
                </Typography>
              </Box>
              {k.is_active && (
                <Tooltip title="Tilbakekall">
                  <IconButton onClick={() => onRevoke(k.id)} sx={{ color: "#ff6b6b" }}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function EndpointsList({
  endpoints, onTest, onToggle, onDelete,
}: {
  endpoints: WebhookEndpoint[];
  onTest: (id: string) => void;
  onToggle: (e: WebhookEndpoint) => void;
  onDelete: (id: string) => void;
}) {
  if (endpoints.length === 0) return <EmptyState text="Ingen webhook-endpoints" />;
  return (
    <Stack spacing={1.5}>
      {endpoints.map((e) => (
        <Card key={e.id} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff",
                                border: e.auto_disabled_at ? "1px solid #ff6b6b40" : undefined }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box flex={1}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" mb={0.5}>
                  <Typography variant="h6" sx={{ fontFamily: "monospace", fontSize: 14 }}>
                    {e.url}
                  </Typography>
                  {!e.is_active && <Chip size="small" label="paused" sx={{ bgcolor: "#888", color: "#0a0512" }} />}
                  {e.auto_disabled_at && <Chip size="small" label="auto-disabled (10 fails)"
                                                sx={{ bgcolor: "#ff6b6b", color: "#0a0512", fontWeight: 600 }} />}
                  {e.partner_name && <Chip size="small" label={e.partner_name}
                                            sx={{ bgcolor: "rgba(167,139,250,0.15)", color: "#a78bfa" }} />}
                  {e.organization_name && <Chip size="small" label={e.organization_name}
                                                 sx={{ bgcolor: "rgba(122,184,255,0.15)", color: "#7ab8ff" }} />}
                </Stack>
                {e.description && (
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block" }}>
                    {e.description}
                  </Typography>
                )}
                <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap" rowGap={0.5}>
                  {e.events.length === 0
                    ? <Chip size="small" label="alle events" sx={{ height: 18, fontSize: 10, bgcolor: "rgba(155,225,93,0.10)", color: "#9be15d" }} />
                    : e.events.map((ev) => (
                        <Chip key={ev} size="small" label={ev}
                              sx={{ height: 18, fontSize: 10, bgcolor: "rgba(255,184,107,0.10)", color: "#ffb86b" }} />
                      ))}
                </Stack>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mt: 0.5, display: "block" }}>
                  {e.last_delivery_at
                    ? `sist levert ${new Date(e.last_delivery_at).toLocaleString("no-NO")}`
                    : "aldri levert"}
                  {e.consecutive_failures > 0 && ` · ${e.consecutive_failures} fails på rad`}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Send test-event">
                  <IconButton onClick={() => onTest(e.id)} sx={{ color: "#9be15d" }}>
                    <SendIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={e.is_active ? "Pause" : "Aktiver"}>
                  <IconButton onClick={() => onToggle(e)} sx={{ color: e.is_active ? "#ffb86b" : "#9be15d" }}>
                    {e.is_active ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Slett">
                  <IconButton onClick={() => onDelete(e.id)} sx={{ color: "#ff6b6b" }}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function DeliveriesList({ deliveries }: { deliveries: Delivery[] }) {
  if (deliveries.length === 0) return <EmptyState text="Ingen webhook-leveranser ennå" />;
  return (
    <Card sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {["Tid", "Event", "URL", "Status", "Attempt", "Duration", "Error"].map((h) => (
              <TableCell key={h} sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {deliveries.map((d) => (
            <TableRow key={d.id} sx={{
              "& td": { color: "#fff", borderColor: "rgba(255,255,255,0.05)" },
            }}>
              <TableCell>{d.attempted_at ? new Date(d.attempted_at).toLocaleString("no-NO") : "pending"}</TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{d.event_type}</TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.endpoint_url}
              </TableCell>
              <TableCell>
                <Chip size="small"
                      label={d.response_status ?? (d.success === null ? "pending" : "error")}
                      sx={{
                        bgcolor: d.success === true ? "#9be15d"
                          : d.success === false ? "#ff6b6b"
                          : "#ffb86b",
                        color: "#0a0512", fontWeight: 600,
                      }} />
              </TableCell>
              <TableCell>{d.attempt_number}</TableCell>
              <TableCell>{d.duration_ms ? `${d.duration_ms}ms` : "—"}</TableCell>
              <TableCell sx={{ maxWidth: 250, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {d.error_message?.substring(0, 60) ?? ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
      <CardContent sx={{ textAlign: "center", py: 6 }}>
        <Typography color="rgba(255,255,255,0.6)">{text}</Typography>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// New Key Dialog
// ---------------------------------------------------------------------------

function NewKeyDialog({
  open, onClose, onCreated, onError,
}: {
  open: boolean; onClose: () => void;
  onCreated: (rawKey: string, warning: string) => void;
  onError: (msg: string) => void;
}) {
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [scopes, setScopes] = useState<string[]>(["customers.read"]);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch("/api/superadmin/organizations").then((r) => r.ok ? r.json() : { organizations: [] })
      .then((d) => setOrgs(d.organizations ?? []));
    apiFetch("/api/superadmin/partners").then((r) => r.ok ? r.json() : { partners: [] })
      .then((d) => setPartners(d.partners ?? []));
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/superadmin/api-keys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, organizationId: organizationId || undefined,
          partnerId: partnerId || undefined, scopes,
          expiresInDays: expiresInDays || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error ?? "Feil"); setSubmitting(false); return; }
      onCreated(d.raw_key, d.warning);
      setName(""); setOrganizationId(""); setPartnerId(""); setScopes(["customers.read"]);
    } catch (e: any) { onError(String(e?.message ?? e)); }
    setSubmitting(false);
  };

  const inputSx = {
    "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Ny API-key</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField fullWidth required label="Navn" value={name}
                     onChange={(e) => setName(e.target.value)}
                     placeholder="F.eks. 'medside.no integration'" sx={inputSx} />
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Organisasjon (eller la stå blank for partner)</InputLabel>
            <Select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}
                    label="Organisasjon" sx={{ color: "#fff" }}>
              <MenuItem value="">— ingen —</MenuItem>
              {orgs.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Partner (alternativ til org)</InputLabel>
            <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                    label="Partner" sx={{ color: "#fff" }}>
              <MenuItem value="">— ingen —</MenuItem>
              {partners.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Scopes:</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
            {AVAILABLE_SCOPES.map((s) => (
              <Chip key={s.key} label={s.label} size="small"
                    onClick={() => setScopes((p) => p.includes(s.key) ? p.filter((x) => x !== s.key) : [...p, s.key])}
                    sx={{
                      bgcolor: scopes.includes(s.key) ? "#9be15d" : "rgba(255,255,255,0.06)",
                      color: scopes.includes(s.key) ? "#0a0512" : "rgba(255,255,255,0.7)",
                      cursor: "pointer", fontWeight: scopes.includes(s.key) ? 600 : 400,
                    }} />
            ))}
          </Stack>
          <TextField type="number" label="Utløper om (dager — la stå blank for evig)"
                     value={expiresInDays ?? ""}
                     onChange={(e) => setExpiresInDays(e.target.value === "" ? null : Number(e.target.value))}
                     sx={inputSx} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained"
                disabled={!name || scopes.length === 0 || submitting || (!organizationId && !partnerId)}
                onClick={submit}
                sx={{ bgcolor: "#9be15d", color: "#0a0512", fontWeight: 700 }}>
          {submitting ? "Genererer…" : "Generer key"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// New Endpoint Dialog
// ---------------------------------------------------------------------------

function NewEndpointDialog({
  open, onClose, onCreated, onError,
}: {
  open: boolean; onClose: () => void;
  onCreated: (secret: string, warning: string) => void;
  onError: (msg: string) => void;
}) {
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([]);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch("/api/superadmin/organizations").then((r) => r.ok ? r.json() : { organizations: [] })
      .then((d) => setOrgs(d.organizations ?? []));
    apiFetch("/api/superadmin/partners").then((r) => r.ok ? r.json() : { partners: [] })
      .then((d) => setPartners(d.partners ?? []));
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/superadmin/webhook-endpoints", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url, description: description || undefined,
          organizationId: organizationId || undefined,
          partnerId: partnerId || undefined,
          events,
        }),
      });
      const d = await r.json();
      if (!r.ok) { onError(d.error ?? "Feil"); setSubmitting(false); return; }
      onCreated(d.signing_secret, d.warning);
      setUrl(""); setDescription(""); setOrganizationId(""); setPartnerId(""); setEvents([]);
    } catch (e: any) { onError(String(e?.message ?? e)); }
    setSubmitting(false);
  };

  const inputSx = {
    "& .MuiOutlinedInput-root": { color: "#fff", "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: "#0a0512", color: "#fff" } }}>
      <DialogTitle>Nytt webhook-endpoint</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField fullWidth required label="URL" value={url}
                     onChange={(e) => setUrl(e.target.value)}
                     placeholder="https://api.dinbedrift.no/leadgrid-webhook" sx={inputSx} />
          <TextField fullWidth label="Beskrivelse (valgfritt)"
                     value={description} onChange={(e) => setDescription(e.target.value)} sx={inputSx} />
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Organisasjon</InputLabel>
            <Select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}
                    label="Organisasjon" sx={{ color: "#fff" }}>
              <MenuItem value="">— ingen —</MenuItem>
              {orgs.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel sx={{ color: "rgba(255,255,255,0.6)" }}>Partner (alternativ)</InputLabel>
            <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                    label="Partner" sx={{ color: "#fff" }}>
              <MenuItem value="">— ingen —</MenuItem>
              {partners.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
            Events (tom = alle):
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
            {AVAILABLE_EVENTS.map((ev) => (
              <Chip key={ev} label={ev} size="small"
                    onClick={() => setEvents((p) => p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev])}
                    sx={{
                      bgcolor: events.includes(ev) ? "#ffb86b" : "rgba(255,255,255,0.06)",
                      color: events.includes(ev) ? "#0a0512" : "rgba(255,255,255,0.7)",
                      cursor: "pointer", fontWeight: events.includes(ev) ? 600 : 400, fontSize: 11,
                    }} />
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained"
                disabled={!url || submitting || (!organizationId && !partnerId)}
                onClick={submit}
                sx={{ bgcolor: "#9be15d", color: "#0a0512", fontWeight: 700 }}>
          {submitting ? "Oppretter…" : "Opprett"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
