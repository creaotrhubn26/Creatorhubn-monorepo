/**
 * leadgrid-client-portal.tsx — public visning for klient (theroleroom.com/c/{token})
 *
 * Klienten trenger IKKE The Role Room-konto. Token-basert tilgang.
 * Backend: /api/leadgrid-client/:token (+ accept / focus / seen).
 *
 * Designet for premium-tillit:
 *   - Backdrop7 (selger m/ pin-rute) som hero
 *   - Leadgrid-stemme ("Vi tråler, Vi skårer, Vi leverer")
 *   - Composite score m/ farge-coding
 *   - Liste over needs m/ "Be om fokus på dette"-checkbox
 *   - Liste over signals (positive/negative)
 *   - Liste over deliverables m/ progress
 *   - PoweredByLeadgridBanner i bunnen (skjules for Agency+)
 */

import React, { useEffect, useState } from "react";
import {
  Box, Container, Stack, Typography, Button, Chip, Card, CardContent,
  CircularProgress, Alert, Checkbox, FormControlLabel, Divider, LinearProgress,
  Snackbar, Avatar,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import LockClockIcon from "@mui/icons-material/LockClock";
import VerifiedIcon from "@mui/icons-material/Verified";
import { PoweredByLeadgridBanner } from "@/components/leadgrid/PoweredByLeadgridBanner";

interface PortalData {
  token_meta: {
    accepted: boolean;
    first_visit: boolean;
    invited_name: string | null;
    invited_email: string | null;
  };
  organization: { name: string; description: string | null };
  customer: {
    name: string | null;
    website_url: string | null;
    logo_url: string | null;
    industry: string | null;
  };
  leadgrid_value: {
    tagline: string;
    one_liner: string;
    three_steps: Array<{ title: string; body: string }>;
  };
  audit: {
    composite_score: number | null;
    needs: Array<{
      need_type: string;
      priority: number;
      status: string;
      focus_status: string | null;
      label?: string;
      tagline?: string;
    }>;
    signals: {
      positive: Array<{ signal_type: string; label: string; raw_value: string | null }>;
      negative: Array<{ signal_type: string; label: string; raw_value: string | null }>;
    };
  };
  deliverables: Array<{
    id: string;
    title: string | null;
    client_summary: string | null;
    status: string;
    target_date: string | null;
    completed_at: string | null;
    related_need_type: string | null;
  }>;
  org_plan?: string;
}

export default function LeadgridClientPortalPage() {
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [focusBusy, setFocusBusy] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  useEffect(() => {
    // Path-form: /c/{token}
    const m = window.location.pathname.match(/^\/c\/([A-Za-z0-9_-]+)/);
    if (m) {
      setToken(m[1]);
      load(m[1]);
    } else {
      setError("Ugyldig lenke");
      setLoading(false);
    }
  }, []);

  async function load(t: string) {
    try {
      const r = await fetch(`/api/leadgrid-client/${t}`);
      if (r.status === 410) { setError("Lenken er utløpt. Be om en ny."); setLoading(false); return; }
      if (r.status === 404) { setError("Lenken finnes ikke."); setLoading(false); return; }
      if (!r.ok) { setError(`Kunne ikke laste portalen (HTTP ${r.status})`); setLoading(false); return; }
      const d = await r.json();
      setData(d);
      // Logg visning
      try { await fetch(`/api/leadgrid-client/${t}/seen`, { method: "POST" }); } catch {}
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally { setLoading(false); }
  }

  async function acceptInvite() {
    setAccepting(true);
    try {
      const r = await fetch(`/api/leadgrid-client/${token}/accept`, { method: "POST" });
      if (r.ok) {
        setSnackbar({ msg: "Velkommen — du er nå koblet til portalen", severity: "success" });
        load(token);
      } else {
        const d = await r.json();
        setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
      }
    } catch (e: any) {
      setSnackbar({ msg: String(e?.message ?? e), severity: "error" });
    }
    setAccepting(false);
  }

  async function requestFocus(need_type: string, requested: boolean) {
    setFocusBusy(need_type);
    try {
      const r = await fetch(`/api/leadgrid-client/${token}/focus`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ need_type, requested }),
      });
      if (r.ok) {
        setSnackbar({
          msg: requested
            ? "Bedt om fokus — vi setter i gang"
            : "Fokus-forespørselen er trukket tilbake",
          severity: "success",
        });
        load(token);
      } else {
        const d = await r.json();
        setSnackbar({ msg: d.error ?? "Feil", severity: "error" });
      }
    } catch (e: any) {
      setSnackbar({ msg: String(e?.message ?? e), severity: "error" });
    }
    setFocusBusy(null);
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#0a0512", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: "#a78bfa" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#0a0512", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", p: 4 }}>
        <Card sx={{ maxWidth: 480, bgcolor: "rgba(255,255,255,0.05)", color: "#fff" }}>
          <CardContent>
            <Stack alignItems="center" spacing={2}>
              <LockClockIcon sx={{ fontSize: 56, color: "#ffb86b" }} />
              <Typography variant="h6">{error}</Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.6)">
                Ta kontakt med oss for en ny lenke.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!data) return null;

  const score = data.audit.composite_score ?? 0;
  const scoreColor = score >= 70 ? "#9be15d" : score >= 40 ? "#ffb86b" : "#ff6b6b";
  const showWelcome = data.token_meta.first_visit && !data.token_meta.accepted;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0a0512", color: "#fff" }}>
      {/* Hero med Backdrop7 + customer-info */}
      <Box sx={{
        position: "relative",
        minHeight: 280,
        background: `
          linear-gradient(180deg, rgba(10,5,18,0.5) 0%, rgba(10,5,18,0.95) 100%),
          url('/leadgrid/backdrop7.png') center/cover
        `,
        backgroundColor: "#0a0512",
        pt: 8, pb: 6,
      }}>
        <Container maxWidth="md">
          <Stack alignItems="center" spacing={3}>
            {data.customer.logo_url && (
              <Box component="img" src={data.customer.logo_url} alt={data.customer.name ?? ""}
                   sx={{ width: 80, height: 80, borderRadius: 2, objectFit: "contain", bgcolor: "#fff", p: 1 }} />
            )}
            <Stack alignItems="center" spacing={1}>
              <Typography variant="overline" sx={{ color: "#a78bfa", letterSpacing: 2 }}>
                {data.organization.name}
              </Typography>
              <Typography variant="h3" textAlign="center" sx={{ fontWeight: 800 }}>
                {data.customer.name ?? "Din Leadgrid-portal"}
              </Typography>
              {data.customer.website_url && (
                <Typography variant="body2" color="rgba(255,255,255,0.6)">
                  {data.customer.website_url}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ pb: 8 }}>
        {/* Velkomst-banner (første gang) */}
        {showWelcome && (
          <Card sx={{ mt: -4, mb: 4, bgcolor: "rgba(167,139,250,0.10)", color: "#fff",
                       border: "1px solid rgba(167,139,250,0.30)", position: "relative", zIndex: 1 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" mb={1}>
                Hei{data.token_meta.invited_name ? ` ${data.token_meta.invited_name}` : ""}, velkommen!
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", mb: 2 }}>
                {data.organization.name} har koblet deg til din egen Leadgrid-portal.
                Her ser du hva vi har funnet, hva som leveres, og du kan be om fokus på spesifikke behov.
              </Typography>
              <Button variant="contained" disabled={accepting} onClick={acceptInvite}
                      sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700,
                            "&:hover": { bgcolor: "#9171e6" } }}>
                {accepting ? "Aksepterer …" : "Bekreft og kom i gang"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Hva er Leadgrid? */}
        <Card sx={{ mt: showWelcome ? 0 : -4, mb: 4, bgcolor: "rgba(255,255,255,0.04)",
                     color: "#fff", position: "relative", zIndex: 1 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="overline" sx={{ color: "#a78bfa", letterSpacing: 2 }}>
              Hva er Leadgrid
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
              {data.leadgrid_value.tagline}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", mb: 3 }}>
              {data.leadgrid_value.one_liner}
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              {data.leadgrid_value.three_steps.map((s, i) => (
                <Box key={i} sx={{ flex: 1, p: 2,
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 2, bgcolor: "rgba(255,255,255,0.02)" }}>
                  <Typography sx={{ color: "#a78bfa", fontWeight: 700, mb: 0.5 }}>{s.title}</Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>{s.body}</Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Composite score */}
        {data.audit.composite_score != null && (
          <Card sx={{ mb: 4, bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" alignItems="center" spacing={3}>
                <Box sx={{
                  width: 100, height: 100, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  bgcolor: `${scoreColor}22`, border: `3px solid ${scoreColor}`,
                }}>
                  <Typography variant="h3" sx={{ fontWeight: 800, color: scoreColor }}>
                    {score}
                  </Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)" }}>
                    Leadgrid-score
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {score >= 70 ? "Sterk digital tilstedeværelse"
                      : score >= 40 ? "Klare muligheter for vekst"
                      : "Stort potensial — flere åpenbare hull"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                    Score 0-100 basert på {data.audit.needs.length} behov + {data.audit.signals.positive.length + data.audit.signals.negative.length} signaler
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Needs — m/ fokus-checkbox */}
        {data.audit.needs.length > 0 && (
          <Card sx={{ mb: 4, bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="overline" sx={{ color: "#ffb86b", letterSpacing: 2 }}>
                Vi har funnet
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                {data.audit.needs.length} behov
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 3 }}>
                Huk av de du vil vi skal prioritere — vi setter i gang umiddelbart.
              </Typography>
              <Stack spacing={1.5}>
                {data.audit.needs.map((n) => {
                  const isFocused = n.focus_status === "pending" || n.focus_status === "acknowledged"
                                 || n.focus_status === "in_progress";
                  const priorityColor = n.priority >= 80 ? "#ff6b6b"
                                      : n.priority >= 60 ? "#ffb86b" : "#7ab8ff";
                  return (
                    <Box key={n.need_type} sx={{ p: 2,
                          border: `1px solid ${isFocused ? "#a78bfa50" : "rgba(255,255,255,0.08)"}`,
                          bgcolor: isFocused ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.02)",
                          borderRadius: 2 }}>
                      <Stack direction="row" alignItems="flex-start" spacing={2}>
                        <Checkbox
                          checked={isFocused}
                          disabled={focusBusy === n.need_type}
                          onChange={(e) => requestFocus(n.need_type, e.target.checked)}
                          sx={{ color: "rgba(255,255,255,0.4)",
                                "&.Mui-checked": { color: "#a78bfa" }, p: 0.5 }}
                        />
                        <Box flex={1}>
                          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" mb={0.5}>
                            <Typography sx={{ fontWeight: 600 }}>
                              {n.label ?? n.need_type}
                            </Typography>
                            <Chip size="small" label={`P${n.priority}`}
                                  sx={{ bgcolor: priorityColor, color: "#0a0512", fontWeight: 700, height: 18, fontSize: 10 }} />
                            {isFocused && (
                              <Chip size="small" label="under arbeid" icon={<CheckCircleIcon fontSize="small" />}
                                    sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 600 }} />
                            )}
                          </Stack>
                          {n.tagline && (
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)" }}>
                              {n.tagline}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Signals */}
        {(data.audit.signals.positive.length > 0 || data.audit.signals.negative.length > 0) && (
          <Card sx={{ mb: 4, bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.6)", letterSpacing: 2 }}>
                Vi har observert
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={3} mt={2}>
                {data.audit.signals.positive.length > 0 && (
                  <Box flex={1}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                      <TrendingUpIcon sx={{ color: "#9be15d" }} />
                      <Typography variant="subtitle1" sx={{ color: "#9be15d", fontWeight: 600 }}>
                        Det som fungerer
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {data.audit.signals.positive.map((s) => (
                        <Stack direction="row" key={s.signal_type} alignItems="center" spacing={1}>
                          <CheckCircleIcon sx={{ fontSize: 16, color: "#9be15d" }} />
                          <Typography variant="body2">{s.label}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
                {data.audit.signals.negative.length > 0 && (
                  <Box flex={1}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                      <TrendingDownIcon sx={{ color: "#ff6b6b" }} />
                      <Typography variant="subtitle1" sx={{ color: "#ff6b6b", fontWeight: 600 }}>
                        Det vi vil rette
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {data.audit.signals.negative.map((s) => (
                        <Stack direction="row" key={s.signal_type} alignItems="center" spacing={1}>
                          <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: "#ff6b6b" }} />
                          <Typography variant="body2">{s.label}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Deliverables */}
        {data.deliverables.length > 0 && (
          <Card sx={{ mb: 4, bgcolor: "rgba(255,255,255,0.04)", color: "#fff" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="overline" sx={{ color: "#9be15d", letterSpacing: 2 }}>
                Vi leverer
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                {data.deliverables.filter((d) => d.status === "completed").length} av {data.deliverables.length} ferdig
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(data.deliverables.filter((d) => d.status === "completed").length / data.deliverables.length) * 100}
                sx={{ mb: 3, height: 8, borderRadius: 4, bgcolor: "rgba(255,255,255,0.08)",
                      "& .MuiLinearProgress-bar": { bgcolor: "#9be15d" } }}
              />
              <Stack spacing={1.5}>
                {data.deliverables.map((d) => {
                  const isDone = d.status === "completed";
                  const isActive = d.status === "in_progress" || d.status === "ready_for_review";
                  return (
                    <Box key={d.id} sx={{ p: 2,
                          border: `1px solid ${isActive ? "#a78bfa50" : "rgba(255,255,255,0.08)"}`,
                          bgcolor: isActive ? "rgba(167,139,250,0.05)" : "rgba(255,255,255,0.02)",
                          borderRadius: 2 }}>
                      <Stack direction="row" spacing={2} alignItems="flex-start">
                        {isDone
                          ? <VerifiedIcon sx={{ color: "#9be15d" }} />
                          : isActive
                            ? <Box sx={{ width: 22, height: 22, borderRadius: "50%",
                                          border: "2px solid #a78bfa", bgcolor: "transparent" }} />
                            : <RadioButtonUncheckedIcon sx={{ color: "rgba(255,255,255,0.3)" }} />}
                        <Box flex={1}>
                          <Typography sx={{ fontWeight: 600 }}>{d.title ?? "Leveranse"}</Typography>
                          {d.client_summary && (
                            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)", mt: 0.3 }}>
                              {d.client_summary}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} mt={0.5}>
                            <Chip size="small" label={d.status}
                                  sx={{ bgcolor: isDone ? "#9be15d" : isActive ? "#a78bfa" : "rgba(255,255,255,0.08)",
                                        color: isDone || isActive ? "#0a0512" : "rgba(255,255,255,0.7)",
                                        fontWeight: 600, height: 18, fontSize: 10 }} />
                            {d.target_date && (
                              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                                {new Date(d.target_date).toLocaleDateString("no-NO")}
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Powered by Leadgrid */}
        <PoweredByLeadgridBanner orgPlan={data.org_plan} variant="footer" />
      </Container>

      <Snackbar
        open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}
        message={snackbar?.msg}
      />
    </Box>
  );
}
