/**
 * AlertsInboxTab.tsx — admin-alerts inbox i /superadmin.
 *
 * Viser unread admin-alerts m/ severity-coding + acknowledge-button.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Stack, Typography, Card, CardContent, Chip, IconButton, Tooltip,
  Snackbar, Button, CircularProgress,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import RefreshIcon from "@mui/icons-material/Refresh";
import { apiFetch } from "@/lib/queryClient";

interface Alert {
  id: string;
  partner_id: string | null;
  application_id: string | null;
  partner_name: string | null;
  app_org_name: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  meta: Record<string, any>;
  created_at: string;
}

const SEVERITY_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  info:     { color: "#7ab8ff", icon: <InfoIcon />,    label: "Info" },
  warning:  { color: "#ffb86b", icon: <WarningIcon />, label: "Warning" },
  critical: { color: "#ff6b6b", icon: <ErrorIcon />,   label: "Critical" },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  new_application:           "Ny søknad",
  scope_change_request:      "Scope-endring forespurt",
  webhook_high_failure:      "Webhook høy feilrate",
  api_usage_anomaly:         "API-bruks-anomali",
  webhook_url_changed:       "Webhook-URL endret",
  dpa_missing:               "DPA mangler",
  reverification_due_soon:   "Re-verifisering forfaller",
  reverification_overdue:    "Re-verifisering forfalt",
  high_error_rate:           "Høy feilrate",
  customer_complaint:        "Kunde-klage",
};

export default function AlertsInboxTab() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch("/api/superadmin/partner-alerts");
      if (r.ok) setAlerts((await r.json()).alerts ?? []);
    } catch (e) { setSnackbar(String(e)); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (id: string) => {
    const r = await apiFetch(`/api/superadmin/partner-alerts/${id}/acknowledge`, { method: "POST" });
    if (r.ok) {
      setSnackbar("Acknowledged");
      load();
    }
  };

  const acknowledgeAll = async () => {
    if (!window.confirm("Markér alle alerts som acknowledged?")) return;
    for (const a of alerts) {
      await apiFetch(`/api/superadmin/partner-alerts/${a.id}/acknowledge`, { method: "POST" });
    }
    setSnackbar("Alle acknowledged");
    load();
  };

  const counts = {
    info: alerts.filter((a) => a.severity === "info").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    critical: alerts.filter((a) => a.severity === "critical").length,
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6">Innboks</Typography>
          <Stack direction="row" spacing={1}>
            {Object.entries(counts).map(([sev, n]) => (
              <Chip key={sev} size="small"
                    label={`${n} ${SEVERITY_META[sev].label}`}
                    sx={{ bgcolor: `${SEVERITY_META[sev].color}20`,
                          color: SEVERITY_META[sev].color,
                          fontWeight: 600 }} />
            ))}
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={load} sx={{ color: "rgba(255,255,255,0.7)" }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {alerts.length > 0 && (
            <Button variant="outlined" size="small" onClick={acknowledgeAll}
                    sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>
              Acknowledge alle
            </Button>
          )}
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : alerts.length === 0 ? (
        <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", color: "#fff" }}>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <CheckIcon sx={{ fontSize: 48, color: "#9be15d", mb: 1 }} />
            <Typography variant="h6">Innboks er tom</Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
              Alle alerts er acknowledged.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {alerts.map((a) => {
            const sev = SEVERITY_META[a.severity];
            return (
              <Card key={a.id} sx={{ bgcolor: "rgba(255,255,255,0.04)", color: "#fff",
                                      borderLeft: `4px solid ${sev.color}` }}>
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" spacing={2}>
                    <Box sx={{ color: sev.color, mt: 0.5 }}>{sev.icon}</Box>
                    <Box flex={1}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={0.5} flexWrap="wrap">
                        <Typography sx={{ fontWeight: 600 }}>
                          {ALERT_TYPE_LABELS[a.alert_type] ?? a.alert_type}
                        </Typography>
                        <Chip size="small" label={sev.label}
                              sx={{ bgcolor: sev.color, color: "#0a0512", fontWeight: 700,
                                    height: 20, fontSize: 11 }} />
                        {(a.partner_name || a.app_org_name) && (
                          <Chip size="small"
                                label={a.partner_name ?? a.app_org_name}
                                sx={{ bgcolor: "rgba(167,139,250,0.20)", color: "#a78bfa" }} />
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
                        {a.message}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mt: 0.5 }}>
                        {new Date(a.created_at).toLocaleString("no-NO")}
                      </Typography>
                    </Box>
                    <Tooltip title="Acknowledge">
                      <IconButton onClick={() => acknowledge(a.id)}
                                  sx={{ color: "#9be15d" }}>
                        <CheckIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Snackbar open={!!snackbar} autoHideDuration={3000} onClose={() => setSnackbar(null)}
                message={snackbar} />
    </Box>
  );
}
