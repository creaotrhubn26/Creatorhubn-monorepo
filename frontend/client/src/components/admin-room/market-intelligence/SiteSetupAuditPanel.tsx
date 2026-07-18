/**
 * SiteSetupAuditPanel.tsx — F1 «audit_site_setup» (doc 14)
 *
 * Produsent-verktøy: skriv inn et klient-domene og se hva som allerede er
 * på plass av analytics-/GEO-oppsett — og hva som mangler. Samme audit
 * kjøres etter oppsett som verifisering. Ærlighet i UI: «unknown» vises
 * som «ikke observerbart», aldri som mangel.
 */

import { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Tooltip,
  Typography,
} from "@mui/material";
import {
  TravelExplore as AuditIcon,
} from "@mui/icons-material";

type CapabilityStatus = "implemented" | "partial" | "missing" | "unknown";

interface AuditCapability {
  key: string;
  label: string;
  status: CapabilityStatus;
  details: string;
  recommendation: string | null;
}

interface SiteSetupAudit {
  url: string;
  fetchedAt: string;
  capabilities: AuditCapability[];
  limitations: string[];
}

const STATUS_STYLE: Record<CapabilityStatus, { fg: string; label: string }> = {
  implemented: { fg: "#4ade80", label: "På plass" },
  partial: { fg: "#f59e0b", label: "Delvis" },
  missing: { fg: "#f87171", label: "Mangler" },
  unknown: { fg: "#94a3b8", label: "Ikke observerbart" },
};

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface GeoPlan {
  domain: string;
  platform: string;
  situation: string;
  actions: string[];
  pagesToPrerender: string[];
  robotsLines: string[];
  servingRecipe: string;
  jsonLdTemplate: string;
  notes: string[];
}

export default function SiteSetupAuditPanel() {
  const [url, setUrl] = useState("");
  const [audit, setAudit] = useState<SiteSetupAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<GeoPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const loadPlan = async () => {
    setPlanLoading(true);
    setPlan(null);
    try {
      const r = await fetch("/api/integrations/geo-prerender-plan", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await r.json().catch(() => null);
      if (r.ok && body?.plan) setPlan(body.plan as GeoPlan);
      else setError(`GEO-plan feilet (${body?.error ?? r.status}).`);
    } catch (e) {
      setError(String(e));
    } finally {
      setPlanLoading(false);
    }
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setAudit(null);
    try {
      const r = await fetch("/api/integrations/site-audit", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error === "privat_adresse_avvist" || body?.error === "kun_standardporter"
          ? "Adressen avvist av sikkerhetsvernet — bruk et offentlig domene."
          : `Audit feilet (${body?.error ?? r.status}).`);
        return;
      }
      setAudit(body.audit as SiteSetupAudit);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <AuditIcon sx={{ color: "#4ade80" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Site-audit — analytics & GEO
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Sjekker uautentisert hva et (klient-)domene har av GA4, GTM, Meta
          Pixel, Clarity, consent, sitemap, robots og AI-bot-serving. Kjør
          igjen etter oppsett — samme sjekk er verifiseringen.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <TextField size="small" fullWidth placeholder="klientdomene.no"
            value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) void run(); }} />
          <Button variant="contained" onClick={() => void run()}
            disabled={loading || url.trim().length < 4}>
            {loading ? "Sjekker…" : "Kjør audit"}
          </Button>
        </Stack>

        {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

        {audit && (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              {audit.url} · {new Date(audit.fetchedAt).toLocaleString("nb-NO")}
            </Typography>
            {audit.capabilities.map((c) => {
              const st = STATUS_STYLE[c.status];
              return (
                <Box key={c.key} sx={{
                  border: `1px solid ${st.fg}33`, borderLeft: `3px solid ${st.fg}`,
                  borderRadius: 1.5, p: 1.25,
                }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      {c.label}
                    </Typography>
                    <Chip size="small" label={st.label}
                      sx={{ bgcolor: `${st.fg}1e`, color: st.fg, fontWeight: 700, fontSize: 10, height: 18 }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                    {c.details}
                  </Typography>
                  {c.recommendation && (
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "#f59e0b" }}>
                      → {c.recommendation}
                    </Typography>
                  )}
                </Box>
              );
            })}
            <Tooltip title={audit.limitations.join(" · ")}>
              <Typography variant="caption" color="text.disabled" sx={{ cursor: "help" }}>
                Hva auditen ikke kan se utenfra (hold over)
              </Typography>
            </Tooltip>

            {audit.capabilities.some((c) => c.key === "bot_serving" && c.status !== "implemented") && (
              <Button size="small" variant="outlined" onClick={() => void loadPlan()}
                disabled={planLoading} sx={{ alignSelf: "flex-start" }}>
                {planLoading ? "Lager GEO-plan…" : "Lag GEO-plan (prerendering for AI-boter)"}
              </Button>
            )}

            {plan && (
              <Stack spacing={1} sx={{ border: "1px solid rgba(74,222,128,0.25)", borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  GEO-plan for {plan.domain}
                  <Chip size="small" label={`plattform: ${plan.platform}`}
                    sx={{ ml: 1, bgcolor: "rgba(148,163,184,0.14)", fontSize: 10, height: 18 }} />
                </Typography>
                <Typography variant="caption" color="text.secondary">{plan.situation}</Typography>
                <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                  {plan.actions.map((a, i) => (
                    <Typography key={i} component="li" variant="caption" sx={{ display: "list-item", color: "text.primary" }}>
                      {a}
                    </Typography>
                  ))}
                </Box>
                {plan.pagesToPrerender.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>Prioriterte sider ({plan.pagesToPrerender.length})</Typography>
                    {plan.pagesToPrerender.slice(0, 8).map((p) => (
                      <Typography key={p} variant="caption" color="text.secondary" sx={{ display: "block", fontFamily: "monospace" }}>{p}</Typography>
                    ))}
                  </Box>
                )}
                {[
                  ["robots.txt-linjer", plan.robotsLines.join("\n")],
                  [`Serving-oppskrift (${plan.platform})`, plan.servingRecipe],
                  ["JSON-LD-mal", plan.jsonLdTemplate],
                ].map(([label, content]) => (
                  <Box key={label}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography>
                    <Box component="pre" sx={{
                      m: 0, p: 1, borderRadius: 1, maxHeight: 180, overflow: "auto",
                      bgcolor: "rgba(2,6,23,0.6)", border: "1px solid rgba(148,163,184,0.2)",
                      fontSize: "0.68rem", fontFamily: "monospace", whiteSpace: "pre-wrap", color: "#cbd5e1",
                    }}>{content}</Box>
                  </Box>
                ))}
                {plan.notes.map((n, i) => (
                  <Typography key={i} variant="caption" color="text.disabled">• {n}</Typography>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
