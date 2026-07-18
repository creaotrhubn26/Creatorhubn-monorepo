/**
 * SetupGuidesPanel.tsx — F4 «guide_platform_setup» (doc 14)
 *
 * Skreddersydde sjekklister per bedrift: skriv inn domenet, F1-auditen
 * kjøres, og guidene (GSC/GA4/GTM/Pixel/Clarity/Bing) krysses med det som
 * faktisk ble observert — «Trengs / Fiks / Sjekk i kontoen / Verifiser»,
 * med domenet flettet inn i stegene. Stegene selv krever klientens egen
 * innlogging (passord går aldri gjennom oss).
 */

import { useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card,
  CardContent, Chip, Stack, TextField, Typography,
} from "@mui/material";
import {
  Checklist as GuideIcon,
  ExpandMore as ExpandIcon,
} from "@mui/icons-material";

type GuideRelevance = "needed" | "fix" | "check_account" | "verify";

interface GuideStep {
  title: string;
  detail: string;
  warning?: string;
}

interface TailoredGuide {
  key: string;
  label: string;
  requiresLogin: string;
  steps: GuideStep[];
  verification: string;
  relevance: GuideRelevance;
  observed: string;
}

const RELEVANCE_STYLE: Record<GuideRelevance, { fg: string; label: string }> = {
  needed: { fg: "#f87171", label: "Trengs" },
  fix: { fg: "#f59e0b", label: "Fiks avvik" },
  check_account: { fg: "#94a3b8", label: "Sjekk i kontoen" },
  verify: { fg: "#4ade80", label: "Ser ut til å være på plass" },
};

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SetupGuidesPanel() {
  const [url, setUrl] = useState("");
  const [guides, setGuides] = useState<TailoredGuide[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setGuides(null);
    try {
      const r = await fetch("/api/integrations/setup-guides/tailored", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(`Kunne ikke skreddersy (${body?.error ?? r.status}).`);
        return;
      }
      setGuides(body.guides as TailoredGuide[]);
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
          <GuideIcon sx={{ color: "#f59e0b" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Oppsett-guider — skreddersydd per bedrift
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Kjører site-auditen på domenet og sorterer guidene etter hva som
          faktisk trengs. Stegene gjøres i kundens egne kontoer — vi håndterer
          aldri passord.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <TextField size="small" fullWidth placeholder="medside.no"
            value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) void load(); }} />
          <Button variant="contained" onClick={() => void load()}
            disabled={loading || url.trim().length < 4}>
            {loading ? "Skreddersyr…" : "Lag plan"}
          </Button>
        </Stack>

        {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

        {guides && guides.map((g) => {
          const st = RELEVANCE_STYLE[g.relevance];
          return (
            <Accordion key={g.key} disableGutters
              sx={{ bgcolor: "rgba(15,23,42,0.5)", border: `1px solid ${st.fg}2e`, "&:before": { display: "none" }, mb: 0.75, borderRadius: "8px !important" }}>
              <AccordionSummary expandIcon={<ExpandIcon />}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{g.label}</Typography>
                  <Chip size="small" label={st.label}
                    sx={{ bgcolor: `${st.fg}1e`, color: st.fg, fontWeight: 700, fontSize: 10, height: 18 }} />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {g.observed && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, fontStyle: "italic" }}>
                    Auditen så: {g.observed}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: "block", mb: 1, color: "#60a5fa" }}>
                  Krever innlogging: {g.requiresLogin}
                </Typography>
                <Stack component="ol" spacing={1} sx={{ m: 0, pl: 2.5 }}>
                  {g.steps.map((s, i) => (
                    <Box component="li" key={i}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.83rem" }}>{s.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.detail}</Typography>
                      {s.warning && (
                        <Typography variant="caption" sx={{ display: "block", color: "#f59e0b" }}>
                          ⚠ {s.warning}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#4ade80" }}>
                  ✓ {g.verification}
                </Typography>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </CardContent>
    </Card>
  );
}
