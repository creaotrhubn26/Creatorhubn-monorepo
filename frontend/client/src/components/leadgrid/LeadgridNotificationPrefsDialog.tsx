/**
 * LeadgridNotificationPrefsDialog.tsx
 *
 * Bruker kan velge hvordan de vil motta tildelings-varsler.
 */

import React, { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography,
  Switch, FormControlLabel, Divider, Button, TextField, Box, Chip, Alert,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

interface Prefs {
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_sms: boolean;
  notify_in_app: boolean;
  notify_on_assigned_team_leader: boolean;
  notify_on_assigned_as_rep: boolean;
  notify_on_lead_status_change: boolean;
  notify_on_lead_won: boolean;
  notify_on_lead_lost: boolean;
  notify_on_assignment_seen_status: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export function LeadgridNotificationPrefsDialog({ open, onClose }: {
  open: boolean; onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/leadgrid/my-notification-prefs", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(setPrefs);
  }, [open]);

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      const r = await fetch("/api/leadgrid/my-notification-prefs", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (r.ok) onClose();
    } finally { setSaving(false); }
  };

  const upd = (k: keyof Prefs, v: any) => setPrefs((p) => p ? { ...p, [k]: v } : p);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Varsels-innstillinger</DialogTitle>
      <DialogContent dividers>
        {!prefs ? (
          <Box sx={{ p: 4, textAlign: "center" }}>Laster…</Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Hvor vil du bli varslet?
            </Typography>
            <Stack spacing={1}>
              <ChannelRow icon={<NotificationsActiveIcon sx={{ color: "#a78bfa" }} />}
                          label="In-app (varsler-klokken)"
                          checked={prefs.notify_in_app}
                          onChange={(v) => upd("notify_in_app", v)}
                          description="Vises i toppen av Admin Room" />
              <ChannelRow icon={<EmailIcon sx={{ color: "#a78bfa" }} />}
                          label="E-post"
                          checked={prefs.notify_email}
                          onChange={(v) => upd("notify_email", v)}
                          description="Sendt fra Leadgrid via Resend" />
              <ChannelRow icon={<WhatsAppIcon sx={{ color: "#25D366" }} />}
                          label="WhatsApp"
                          checked={prefs.notify_whatsapp}
                          onChange={(v) => upd("notify_whatsapp", v)}
                          description="Krever telefonnummer på din profil" />
            </Stack>

            <Divider />

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Hvilke event-typer?
            </Typography>
            <FormControlLabel
              control={<Switch checked={prefs.notify_on_assigned_team_leader}
                                onChange={(e) => upd("notify_on_assigned_team_leader", e.target.checked)} />}
              label="Når jeg blir teamleder for en ny lead" />
            <FormControlLabel
              control={<Switch checked={prefs.notify_on_assigned_as_rep}
                                onChange={(e) => upd("notify_on_assigned_as_rep", e.target.checked)} />}
              label="Når jeg blir tildelt som salgskonsulent/promotør" />
            <FormControlLabel
              control={<Switch checked={prefs.notify_on_lead_status_change}
                                onChange={(e) => upd("notify_on_lead_status_change", e.target.checked)} />}
              label="Status-endringer på leads jeg eier" />
            <FormControlLabel
              control={<Switch checked={prefs.notify_on_lead_won}
                                onChange={(e) => upd("notify_on_lead_won", e.target.checked)} />}
              label="Når en lead jeg eier blir vunnet 🎉" />
            <FormControlLabel
              control={<Switch checked={prefs.notify_on_lead_lost}
                                onChange={(e) => upd("notify_on_lead_lost", e.target.checked)} />}
              label="Når en lead blir tapt" />
            <FormControlLabel
              control={<Switch checked={prefs.notify_on_assignment_seen_status}
                                onChange={(e) => upd("notify_on_assignment_seen_status", e.target.checked)} />}
              label="Når teammedlemmer åpner leads jeg har tildelt dem" />

            <Divider />

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Stille-tider (valgfri)
            </Typography>
            <Alert severity="info" sx={{ fontSize: 13 }}>
              I stille-tider lagres in-app-varsler, men du får ikke e-post/WhatsApp.
              In-app vises uten lyd/push.
            </Alert>
            <Stack direction="row" spacing={2}>
              <TextField label="Start" type="time" size="small"
                         InputLabelProps={{ shrink: true }}
                         value={prefs.quiet_hours_start ?? ""}
                         onChange={(e) => upd("quiet_hours_start", e.target.value || null)} />
              <TextField label="Slutt" type="time" size="small"
                         InputLabelProps={{ shrink: true }}
                         value={prefs.quiet_hours_end ?? ""}
                         onChange={(e) => upd("quiet_hours_end", e.target.value || null)} />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={save} disabled={!prefs || saving}>
          {saving ? "Lagrer…" : "Lagre"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ChannelRow({ icon, label, description, checked, onChange }: {
  icon: React.ReactNode; label: string; description: string;
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 2,
      p: 1.5, border: "1px solid", borderColor: checked ? "primary.main" : "divider",
      borderRadius: 1, transition: "all 0.15s",
    }}>
      <Box sx={{ pt: 0.3 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </Box>
  );
}
