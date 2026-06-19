/**
 * EmailBrandingTab.tsx
 *
 * Super-admin UI for å konfigurere e-post-branding per org.
 * Brukes av notifyClient() når den sender e-post-varsler til klienter.
 *
 * - Global default-config (Leadgrid)
 * - Per-org overstyringer (kommer fra WABA-config-fanen)
 * - Signatur-variabler (avsender-navn, tittel, telefon, e-post)
 * - Branding (logo, farger)
 * - Footer/disclaimer/adresse
 * - Custom variabler (JSON for org-spesifikke felter)
 * - Live preview
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton,
  TextField, MenuItem, Select, Snackbar, Alert, Tooltip, Chip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Tab, Tabs,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RestoreIcon from "@mui/icons-material/Restore";
import AddIcon from "@mui/icons-material/Add";

interface Branding {
  org_key: string | null;
  from_name: string;
  from_email: string | null;
  reply_to_email: string | null;
  sender_full_name: string | null;
  sender_title: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  brand_name: string;
  brand_logo_url: string | null;
  brand_primary_color: string;
  brand_accent_color: string;
  footer_html: string | null;
  footer_address: string | null;
  custom_variables: Record<string, string>;
}

const EMPTY: Branding = {
  org_key: null,
  from_name: "Leadgrid", from_email: null, reply_to_email: null,
  sender_full_name: null, sender_title: null, sender_phone: null, sender_email: null,
  brand_name: "Leadgrid", brand_logo_url: null,
  brand_primary_color: "#a78bfa", brand_accent_color: "#9be15d",
  footer_html: null, footer_address: null,
  custom_variables: {},
};

export function EmailBrandingTab() {
  const [configs, setConfigs] = useState<Branding[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("__global__");
  const [draft, setDraft] = useState<Branding>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [newOrgKey, setNewOrgKey] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    const r = await fetch("/api/superadmin/email-branding", { credentials: "include" });
    if (r.ok) {
      const j = await r.json();
      setConfigs(j.configs ?? []);
      const target = (j.configs ?? []).find((c: Branding) =>
        (c.org_key ?? "__global__") === selectedKey);
      if (target) setDraft({ ...target });
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  useEffect(() => {
    const target = configs.find((c) => (c.org_key ?? "__global__") === selectedKey);
    if (target) setDraft({ ...target, custom_variables: target.custom_variables ?? {} });
  }, [selectedKey, configs]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/superadmin/email-branding/${encodeURIComponent(selectedKey)}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (r.ok) { setSnack({ kind: "ok", msg: "Lagret" }); await load(); }
      else setSnack({ kind: "err", msg: "Lagring feilet" });
    } finally { setSaving(false); }
  };

  const addOrgConfig = async () => {
    if (!newOrgKey.trim()) return;
    setSelectedKey(newOrgKey.trim());
    setDraft({ ...EMPTY, org_key: newOrgKey.trim() });
    setAddOpen(false);
    setNewOrgKey("");
  };

  const upd = (k: keyof Branding, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="body2">Konfigurasjon:</Typography>
            <Select size="small" value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    sx={{ minWidth: 280 }}>
              <MenuItem value="__global__">
                <strong>Global default (Leadgrid)</strong>
              </MenuItem>
              {configs.filter((c) => c.org_key).map((c) => (
                <MenuItem key={c.org_key} value={c.org_key!}>
                  {c.org_key} ({c.brand_name})
                </MenuItem>
              ))}
            </Select>
            <Button size="small" variant="outlined" startIcon={<AddIcon />}
                    onClick={() => setAddOpen(true)}>
              Ny org-config
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="outlined" startIcon={<VisibilityIcon />}
                    onClick={() => setPreviewing(true)}>
              Forhåndsvis
            </Button>
            <Button size="small" variant="contained" disabled={saving}
                    onClick={save}>
              {saving ? "Lagrer…" : "Lagre"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        {/* Skjema */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Avsender
              </Typography>
              <Stack spacing={2}>
                <TextField label="Fra-navn (vises i mottakers innboks)"
                           value={draft.from_name}
                           onChange={(e) => upd("from_name", e.target.value)}
                           fullWidth size="small" />
                <Stack direction="row" spacing={2}>
                  <TextField label="Fra-adresse (override RESEND_FROM)"
                             value={draft.from_email ?? ""}
                             onChange={(e) => upd("from_email", e.target.value || null)}
                             fullWidth size="small"
                             placeholder="no-reply@dittfirma.no"
                             helperText="Krever at domenet er verifisert hos Resend" />
                  <TextField label="Reply-to"
                             value={draft.reply_to_email ?? ""}
                             onChange={(e) => upd("reply_to_email", e.target.value || null)}
                             fullWidth size="small"
                             placeholder="hei@dittfirma.no" />
                </Stack>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Signatur (vises i bunnen av hver e-post)
              </Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField label="Avsenders fulle navn"
                             value={draft.sender_full_name ?? ""}
                             onChange={(e) => upd("sender_full_name", e.target.value || null)}
                             fullWidth size="small"
                             placeholder="Anna Hansen" />
                  <TextField label="Tittel/rolle"
                             value={draft.sender_title ?? ""}
                             onChange={(e) => upd("sender_title", e.target.value || null)}
                             fullWidth size="small"
                             placeholder="Markedssjef" />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField label="Telefon"
                             value={draft.sender_phone ?? ""}
                             onChange={(e) => upd("sender_phone", e.target.value || null)}
                             fullWidth size="small"
                             placeholder="+47 ..." />
                  <TextField label="Direkte e-post"
                             value={draft.sender_email ?? ""}
                             onChange={(e) => upd("sender_email", e.target.value || null)}
                             fullWidth size="small"
                             placeholder="anna@dittfirma.no" />
                </Stack>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Branding
              </Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField label="Bedriftsnavn (vises i logo-blokken)"
                             value={draft.brand_name}
                             onChange={(e) => upd("brand_name", e.target.value)}
                             fullWidth size="small" />
                  <TextField label="Logo URL"
                             value={draft.brand_logo_url ?? ""}
                             onChange={(e) => upd("brand_logo_url", e.target.value || null)}
                             fullWidth size="small"
                             placeholder="https://..." />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField label="Primær-farge"
                             value={draft.brand_primary_color}
                             onChange={(e) => upd("brand_primary_color", e.target.value)}
                             fullWidth size="small" type="color"
                             InputLabelProps={{ shrink: true }} />
                  <TextField label="Aksent-farge"
                             value={draft.brand_accent_color}
                             onChange={(e) => upd("brand_accent_color", e.target.value)}
                             fullWidth size="small" type="color"
                             InputLabelProps={{ shrink: true }} />
                </Stack>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Footer
              </Typography>
              <Stack spacing={2}>
                <TextField label="Selskaps-adresse"
                           value={draft.footer_address ?? ""}
                           onChange={(e) => upd("footer_address", e.target.value || null)}
                           fullWidth size="small"
                           placeholder="Creatorhubn AS, Karl Johans gate 1, 0154 Oslo" />
                <TextField label="Footer-HTML (avansert)"
                           value={draft.footer_html ?? ""}
                           onChange={(e) => upd("footer_html", e.target.value || null)}
                           fullWidth multiline rows={3} size="small"
                           placeholder="<p>Pant et tre med hver kjøp ...</p>" />
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Custom variabler
                <Tooltip title="JSON-objekt med ekstra felter du kan bruke i fremtidige templates">
                  <span>
                    <Chip size="small" label="Avansert" sx={{ ml: 1, fontSize: 10 }} />
                  </span>
                </Tooltip>
              </Typography>
              <TextField label="JSON"
                         value={JSON.stringify(draft.custom_variables ?? {}, null, 2)}
                         onChange={(e) => {
                           try {
                             upd("custom_variables", JSON.parse(e.target.value || "{}"));
                           } catch { /* invalid JSON, ignore */ }
                         }}
                         fullWidth multiline rows={4} size="small"
                         placeholder='{ "ceo_name": "Daniel Qazi", "support_url": "https://..." }'
                         InputProps={{ sx: { fontFamily: "monospace", fontSize: 12 } }} />
            </CardContent>
          </Card>
        </Box>

        {/* Live preview */}
        <Box sx={{ width: { xs: "100%", lg: 400 } }}>
          <Card sx={{ position: "sticky", top: 16 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Live preview
              </Typography>
              <BrandingPreview branding={draft} />
            </CardContent>
          </Card>
        </Box>
      </Stack>

      {previewing && (
        <Dialog open onClose={() => setPreviewing(false)} maxWidth="md" fullWidth>
          <DialogTitle>Forhåndsvis e-post-rendering</DialogTitle>
          <DialogContent>
            <BrandingPreview branding={draft} large />
          </DialogContent>
          <DialogActions><Button onClick={() => setPreviewing(false)}>Lukk</Button></DialogActions>
        </Dialog>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <DialogTitle>Ny org-branding</DialogTitle>
        <DialogContent>
          <TextField label="Org-key (org_id)" value={newOrgKey}
                     onChange={(e) => setNewOrgKey(e.target.value)}
                     fullWidth size="small" sx={{ mt: 1, minWidth: 320 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Avbryt</Button>
          <Button onClick={addOrgConfig} variant="contained" disabled={!newOrgKey.trim()}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"}
               onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function BrandingPreview({ branding, large }: { branding: Branding; large?: boolean }) {
  return (
    <Box sx={{
      bgcolor: "#fff", color: "#333",
      p: large ? 4 : 2, borderRadius: 1,
      border: "1px solid #ddd",
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      maxWidth: large ? 560 : "100%",
      maxHeight: large ? "70vh" : 480,
      overflow: "auto",
    }}>
      {branding.brand_logo_url ? (
        <img src={branding.brand_logo_url} alt={branding.brand_name}
             style={{ maxHeight: 48, marginBottom: 16 }} />
      ) : (
        <Box sx={{ fontWeight: 700, fontSize: 18, color: branding.brand_primary_color, mb: 2 }}>
          {branding.brand_name}
        </Box>
      )}
      <Box sx={{ fontSize: 20, fontWeight: 700, mb: 1.5, color: "#0a0512" }}>
        Eksempel: Nytt funn i markedsanalysen
      </Box>
      <Box sx={{ fontSize: 15, lineHeight: 1.55, mb: 2 }}>
        Hei Daniel! Vi har et nytt funn i markedsanalysen din: Konkurrenten din har lagt til
        en ny Meta Ads-kampanje. Vi har lagt en anbefaling i portalen din.
      </Box>
      <Box sx={{ my: 3 }}>
        <Box component="span" sx={{
          display: "inline-block", background: branding.brand_primary_color,
          color: "#0a0512", padding: "12px 24px", borderRadius: 1,
          fontWeight: 700, fontSize: 14,
        }}>
          Åpne klient-portalen
        </Box>
      </Box>
      {branding.sender_full_name && (
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid #eee", color: "#444", fontSize: 13 }}>
          Mvh,<br/>
          <strong>{branding.sender_full_name}</strong>
          {branding.sender_title && <><br/>{branding.sender_title}</>}
          {branding.sender_email && (
            <><br/><Box component="a" sx={{ color: branding.brand_primary_color }} href={`mailto:${branding.sender_email}`}>
              {branding.sender_email}
            </Box></>
          )}
          {branding.sender_phone && <><br/>{branding.sender_phone}</>}
          <br/><strong style={{ color: branding.brand_primary_color }}>{branding.brand_name}</strong>
        </Box>
      )}
      <Box sx={{ mt: 4, pt: 2, borderTop: "1px solid #eee", color: "#888", fontSize: 11 }}>
        {branding.footer_html && <Box dangerouslySetInnerHTML={{ __html: branding.footer_html }} />}
        {branding.footer_address && <Box sx={{ mt: 1 }}>{branding.footer_address}</Box>}
      </Box>
    </Box>
  );
}
