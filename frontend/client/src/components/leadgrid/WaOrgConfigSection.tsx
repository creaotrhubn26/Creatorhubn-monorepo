/**
 * WaOrgConfigSection.tsx
 *
 * Multi-tenant WABA-config-fane: la org-en sette egen WhatsApp Cloud
 * API-credentials (WABA ID + phone number ID + access token).
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

interface OrgConfig {
  org_key: string;
  business_account_id: string;
  phone_number_id: string;
  display_name: string;
  template_language: string;
  last_validated_at: string | null;
  last_validation_error: string | null;
  provider: string | null;
}

interface Props {
  onSnack: (s: { kind: "ok" | "err"; msg: string }) => void;
}

export function WaOrgConfigSection({ onSnack }: Props) {
  const [configs, setConfigs] = useState<OrgConfig[]>([]);
  const [editing, setEditing] = useState<OrgConfig | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const r = await fetch("/api/superadmin/wa-org-configs", { credentials: "include" });
    if (r.ok) setConfigs((await r.json()).configs ?? []);
  };

  useEffect(() => { load(); }, []);

  const del = async (org_key: string) => {
    if (!confirm(`Slett WABA-config for "${org_key}"?`)) return;
    const r = await fetch(`/api/superadmin/wa-org-configs/${encodeURIComponent(org_key)}`, {
      method: "DELETE", credentials: "include",
    });
    if (r.ok) { onSnack({ kind: "ok", msg: "Slettet" }); load(); }
    else onSnack({ kind: "err", msg: "Sletting feilet" });
  };

  return (
    <>
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              Per-org WhatsApp-config
            </Typography>
            <Button variant="contained" size="small" startIcon={<AddIcon />}
                    onClick={() => setCreating(true)}>
              Ny org-config
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Hver kunde-organisasjon kan kjøre på egen WhatsApp Business-konto.
            Templates på deres WABA blir tilgjengelige i Templates-fanen via org-velgeren.
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Org-key</TableCell>
                <TableCell>Display name</TableCell>
                <TableCell>Phone Number ID</TableCell>
                <TableCell>WABA ID</TableCell>
                <TableCell>Språk</TableCell>
                <TableCell>Validert</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((c) => (
                <TableRow key={c.org_key} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      {c.org_key}
                    </Typography>
                  </TableCell>
                  <TableCell>{c.display_name}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                      {c.phone_number_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                      {c.business_account_id}
                    </Typography>
                  </TableCell>
                  <TableCell>{c.template_language}</TableCell>
                  <TableCell>
                    {c.last_validation_error ? (
                      <Tooltip title={c.last_validation_error}>
                        <Chip size="small" color="error" icon={<ErrorIcon />} label="Feil" />
                      </Tooltip>
                    ) : c.last_validated_at ? (
                      <Chip size="small" color="success" icon={<CheckCircleIcon />} label="OK" />
                    ) : (
                      <Chip size="small" label="Ikke validert" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditing(c)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => del(c.org_key)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary"
                                sx={{ textAlign: "center", py: 4 }}>
                      Ingen org-configs ennå. Leadgrid sender via env-default-WABA.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(editing || creating) && (
        <ConfigDialog config={editing} onClose={() => { setEditing(null); setCreating(false); }}
                      onSaved={() => { setEditing(null); setCreating(false); load();
                                        onSnack({ kind: "ok", msg: "Lagret" }); }} />
      )}
    </>
  );
}

function ConfigDialog({ config, onClose, onSaved }: {
  config: OrgConfig | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    org_key: config?.org_key ?? "",
    business_account_id: config?.business_account_id ?? "",
    phone_number_id: config?.phone_number_id ?? "",
    access_token: "",
    display_name: config?.display_name ?? "",
    template_language: config?.template_language ?? "nb",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const r = await fetch(`/api/superadmin/wa-org-configs/${encodeURIComponent(form.org_key)}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) onSaved();
      else { const j = await r.json(); setError(j?.error ?? "Ukjent feil"); }
    } finally { setSaving(false); }
  };

  const upd = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{config ? "Rediger" : "Ny"} org-config</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Org-key (vanligvis organization_id)"
                     value={form.org_key} onChange={(e) => upd("org_key", e.target.value)}
                     disabled={!!config} fullWidth size="small" />
          <TextField label="WABA ID (Business Account ID)" value={form.business_account_id}
                     onChange={(e) => upd("business_account_id", e.target.value)}
                     fullWidth size="small" />
          <TextField label="Phone Number ID" value={form.phone_number_id}
                     onChange={(e) => upd("phone_number_id", e.target.value)}
                     fullWidth size="small" />
          <TextField label={`Access token ${config ? "(bare hvis du vil oppdatere)" : ""}`}
                     value={form.access_token}
                     onChange={(e) => upd("access_token", e.target.value)}
                     fullWidth size="small" type="password"
                     placeholder={config ? "(uendret)" : "EAA..."} />
          <TextField label="Display name (kun internt)" value={form.display_name}
                     onChange={(e) => upd("display_name", e.target.value)}
                     fullWidth size="small" />
          <TextField label="Template-språk" value={form.template_language}
                     onChange={(e) => upd("template_language", e.target.value)}
                     fullWidth size="small" select
                     SelectProps={{ native: true }}>
            <option value="nb">Norsk (nb)</option>
            <option value="en">English (en)</option>
            <option value="sv">Svenska (sv)</option>
            <option value="da">Dansk (da)</option>
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={save}
                disabled={!form.org_key || !form.business_account_id || !form.phone_number_id || saving}>
          {saving ? "Lagrer…" : "Lagre"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
