/**
 * ClientPortalNotificationPrefs.tsx
 *
 * Toggle-panel i klient-portalen for å konfigurere e-post / SMS / WhatsApp.
 * Henter prefs via /api/leadgrid/portal/:portalToken/notification-prefs.
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Switch, TextField,
  FormControlLabel, Button, Divider, Snackbar, Alert, Chip,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";

interface Prefs {
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
  notify_deliverable_completed: boolean;
  notify_focus_request_received: boolean;
  notify_score_changed: boolean;
  notify_new_finding: boolean;
  notify_monthly_report: boolean;
  unsubscribed_at: string | null;
}

interface Props { portalToken: string; }

export function ClientPortalNotificationPrefs({ portalToken }: Props) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const base = `/api/leadgrid/portal/${portalToken}/notification-prefs`;

  useEffect(() => {
    fetch(base)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setPrefs(d))
      .catch(() => setPrefs(null));
  }, [base]);

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const r = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (r.ok) setSnack({ kind: "ok", msg: "Lagret" });
      else setSnack({ kind: "err", msg: "Kunne ikke lagre" });
    } finally { setSaving(false); }
  };

  const unsubscribe = async () => {
    if (!confirm("Skru av ALLE varsler? Du kan slå dem på igjen senere.")) return;
    const r = await fetch(`${base}/unsubscribe`, { method: "POST" });
    if (r.ok) {
      setPrefs((p) => p ? {
        ...p, notify_email: false, notify_sms: false, notify_whatsapp: false,
        unsubscribed_at: new Date().toISOString(),
      } : p);
      setSnack({ kind: "ok", msg: "Alle varsler er nå avskrudd" });
    }
  };

  if (!prefs) {
    return (
      <Card><CardContent>
        <Typography color="text.secondary">Laster varsels-innstillinger…</Typography>
      </CardContent></Card>
    );
  }

  const upd = (k: keyof Prefs, v: any) => setPrefs((p) => p ? { ...p, [k]: v } : p);

  return (
    <Card sx={{ bgcolor: "rgba(10,5,18,0.92)", color: "#fff",
                border: "1px solid rgba(167,139,250,0.20)" }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Varsler</Typography>
          {prefs.unsubscribed_at && (
            <Chip size="small" label="Avmeldt" color="warning"
                  icon={<NotificationsOffIcon />} />
          )}
        </Stack>

        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2 }}>
          Velg hvordan og når du vil høre fra oss. Du kan endre dette når som helst.
        </Typography>

        {/* Kanal-toggles */}
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <EmailIcon sx={{ color: "#a78bfa" }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>E-post</Typography>
              <TextField fullWidth size="small" sx={{ mt: 1,
                "& .MuiOutlinedInput-root": { color: "#fff",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.20)" } } }}
                value={prefs.contact_email ?? ""}
                onChange={(e) => upd("contact_email", e.target.value)}
                placeholder="din@epost.no" />
            </Box>
            <Switch checked={prefs.notify_email}
                    onChange={(e) => upd("notify_email", e.target.checked)} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <SmsIcon sx={{ color: "#9be15d" }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>SMS</Typography>
              <TextField fullWidth size="small" sx={{ mt: 1,
                "& .MuiOutlinedInput-root": { color: "#fff",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.20)" } } }}
                value={prefs.contact_phone ?? ""}
                onChange={(e) => upd("contact_phone", e.target.value)}
                placeholder="+47 …" />
            </Box>
            <Switch checked={prefs.notify_sms}
                    onChange={(e) => upd("notify_sms", e.target.checked)} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <WhatsAppIcon sx={{ color: "#25D366" }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>WhatsApp</Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                Bruker samme telefonnummer som SMS over
              </Typography>
            </Box>
            <Switch checked={prefs.notify_whatsapp}
                    onChange={(e) => upd("notify_whatsapp", e.target.checked)} />
          </Box>
        </Stack>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.10)", my: 2 }} />

        {/* Event-toggles */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Hva vil du bli varslet om?
        </Typography>
        <Stack spacing={0.5}>
          {[
            ["notify_deliverable_completed", "Leveranse fullført", true],
            ["notify_focus_request_received", "Bekreftelse på fokus-ønske", true],
            ["notify_score_changed", "Markeds-score endret seg", false],
            ["notify_new_finding", "Nye funn i markedsanalysen", true],
            ["notify_monthly_report", "Månedsrapport", true],
          ].map(([key, label, defOn]) => (
            <FormControlLabel key={key as string}
              control={<Switch
                checked={(prefs as any)[key as string]}
                onChange={(e) => upd(key as keyof Prefs, e.target.checked)} />}
              label={<Typography variant="body2">{label as string}</Typography>}
              sx={{ ml: 0, color: "#fff" }} />
          ))}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
          <Button variant="contained" disabled={saving} onClick={save}
                  sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700,
                        flex: 1, "&:hover": { bgcolor: "#9171e6" } }}>
            {saving ? "Lagrer…" : "Lagre"}
          </Button>
          <Button variant="outlined" color="error" onClick={unsubscribe}
                  startIcon={<NotificationsOffIcon />}>
            Skru av alt
          </Button>
        </Stack>

        <Typography variant="caption" sx={{ display: "block", mt: 2,
                    color: "rgba(255,255,255,0.40)", textAlign: "center" }}>
          Vi sender kun varsler du har takket ja til. SMS/WhatsApp via Twilio.
        </Typography>
      </CardContent>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"}
               onClose={() => setSnack(null)}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Card>
  );
}
