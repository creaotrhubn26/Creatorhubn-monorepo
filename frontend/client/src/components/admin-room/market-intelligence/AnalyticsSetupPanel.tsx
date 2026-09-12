/**
 * AnalyticsSetupPanel.tsx — F2+F3 (doc 14)
 *
 * Produsent-verktøy: velg klientens forretningsmål (F3 → event-plan med
 * key events og Meta-bro), legg inn offentlige måle-IDer, og få generert
 * en consent-gatet bootstrap-snippet (F2) klar til å limes inn hos
 * klienten. Kun offentlige IDer — aldri passord eller tokens.
 */

import { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, FormControlLabel,
  Stack, TextField, Typography,
} from "@mui/material";
import {
  Code as SnippetIcon,
  ContentCopy as CopyIcon,
} from "@mui/icons-material";

const GOALS: Array<{ key: string; label: string }> = [
  { key: "lead", label: "Leads (kontaktskjema)" },
  { key: "booking", label: "Booking / demo" },
  { key: "purchase", label: "Kjøp" },
  { key: "signup", label: "Konto-registrering" },
  { key: "newsletter", label: "Nyhetsbrev" },
];

interface PlannedEvent {
  ga4Event: string;
  keyEvent: boolean;
  metaEvent: string | null;
  trigger: string;
  params: string[];
}

interface InstallInstructions {
  channel: string;
  title: string;
  steps: string[];
  builderPrompt: string | null;
}

interface BootstrapResult {
  snippet: string | null;
  eventPlan: PlannedEvent[];
  notes: string[];
  installInstructions?: InstallInstructions | null;
}

const PLATFORMS: Array<{ key: string; label: string }> = [
  { key: "", label: "Plattform (valgfritt)" },
  { key: "lovable", label: "Lovable" },
  { key: "bolt", label: "Bolt.new" },
  { key: "webflow", label: "Webflow" },
  { key: "wix", label: "Wix" },
  { key: "squarespace", label: "Squarespace" },
  { key: "shopify", label: "Shopify" },
  { key: "framer", label: "Framer" },
  { key: "wordpress", label: "WordPress" },
  { key: "nextjs", label: "Next.js" },
  { key: "vite_spa", label: "Vite/React SPA" },
];

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AnalyticsSetupPanel() {
  const [ids, setIds] = useState({ ga4: "", gtm: "", clarity: "", pixel: "" });
  const [platformKey, setPlatformKey] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const [goals, setGoals] = useState<string[]>(["lead"]);
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const body: Record<string, unknown> = { goals };
      if (ids.ga4.trim()) body.ga4MeasurementId = ids.ga4.trim();
      if (ids.gtm.trim()) body.gtmId = ids.gtm.trim();
      if (ids.clarity.trim()) body.clarityProjectId = ids.clarity.trim();
      if (ids.pixel.trim()) body.metaPixelId = ids.pixel.trim();
      if (platformKey) body.platformKey = platformKey;
      const r = await fetch("/api/integrations/analytics-bootstrap", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setError(data?.details?.join(" · ") ?? `Generering feilet (${data?.error ?? r.status}).`);
        return;
      }
      setResult(data as BootstrapResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!result?.snippet) return;
    try {
      await navigator.clipboard.writeText(result.snippet);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const hasAnyId = Object.values(ids).some((v) => v.trim().length > 0);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <SnippetIcon sx={{ color: "#60a5fa" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Analytics-oppsett — event-plan & snippet
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Velg klientens mål og lim inn offentlige måle-IDer (aldri passord).
          Genererer consent-gatet bootstrap etter samme mønster som våre egne
          nettsteder, med Meta-bro fra event-planen.
        </Typography>

        <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {GOALS.map((g) => (
            <FormControlLabel key={g.key}
              control={
                <Checkbox size="small" checked={goals.includes(g.key)}
                  onChange={(e) => setGoals((cur) =>
                    e.target.checked ? [...cur, g.key] : cur.filter((x) => x !== g.key))} />
              }
              label={<Typography variant="body2">{g.label}</Typography>} />
          ))}
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
          <TextField size="small" label="GA4 (G-…)" value={ids.ga4}
            onChange={(e) => setIds((c) => ({ ...c, ga4: e.target.value }))} sx={{ width: 170 }} />
          <TextField size="small" label="GTM (GTM-…)" value={ids.gtm}
            onChange={(e) => setIds((c) => ({ ...c, gtm: e.target.value }))} sx={{ width: 160 }} />
          <TextField size="small" label="Clarity-ID" value={ids.clarity}
            onChange={(e) => setIds((c) => ({ ...c, clarity: e.target.value }))} sx={{ width: 140 }} />
          <TextField size="small" label="Meta Pixel (sifre)" value={ids.pixel}
            onChange={(e) => setIds((c) => ({ ...c, pixel: e.target.value }))} sx={{ width: 170 }} />
          <TextField select size="small" value={platformKey}
            onChange={(e) => setPlatformKey(e.target.value)} sx={{ width: 190 }}
            SelectProps={{ native: true }}>
            {PLATFORMS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </TextField>
          <Button variant="contained" onClick={() => void generate()}
            disabled={loading || !hasAnyId}>
            {loading ? "Genererer…" : "Generer"}
          </Button>
        </Stack>

        {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

        {result && (
          <Stack spacing={1.5}>
            {result.eventPlan.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                  Event-plan ({result.eventPlan.length})
                </Typography>
                <Stack spacing={0.75}>
                  {result.eventPlan.map((ev) => (
                    <Box key={ev.ga4Event} sx={{
                      border: "1px solid rgba(148,163,184,0.2)", borderRadius: 1.5, p: 1,
                    }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700 }}>
                          {ev.ga4Event}
                        </Typography>
                        {ev.keyEvent && (
                          <Chip size="small" label="key event"
                            sx={{ bgcolor: "#4ade801e", color: "#4ade80", fontSize: 10, height: 18, fontWeight: 700 }} />
                        )}
                        {ev.metaEvent && (
                          <Chip size="small" label={`Meta: ${ev.metaEvent}`}
                            sx={{ bgcolor: "#60a5fa1e", color: "#60a5fa", fontSize: 10, height: 18 }} />
                        )}
                        {ev.params.length > 0 && (
                          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                            {ev.params.join(", ")}
                          </Typography>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {ev.trigger}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {result.snippet && (
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Bootstrap-snippet (lim inn i &lt;head&gt;)
                </Typography>
                <Button size="small" startIcon={<CopyIcon />} onClick={() => void copy()}>
                  {copied ? "Kopiert ✓" : "Kopier"}
                </Button>
              </Stack>
              <Box component="pre" sx={{
                m: 0, p: 1.25, borderRadius: 1.5, maxHeight: 260, overflow: "auto",
                bgcolor: "rgba(2,6,23,0.6)", border: "1px solid rgba(148,163,184,0.2)",
                fontSize: "0.7rem", lineHeight: 1.45, fontFamily: "monospace",
                whiteSpace: "pre", color: "#cbd5e1",
              }}>
                {result.snippet}
              </Box>
            </Box>
            )}

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.25 }}>
                Må gjøres i plattform-UI (dekkes ikke av snippeten)
              </Typography>
              {result.notes.map((n, i) => (
                <Typography key={i} variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  • {n}
                </Typography>
              ))}
            </Box>

            {result.installInstructions && (
              <Box sx={{ border: "1px solid rgba(96,165,250,0.3)", borderRadius: 1.5, p: 1.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5, color: "#93c5fd" }}>
                  {result.installInstructions.title}
                </Typography>
                <Box component="ol" sx={{ m: 0, pl: 2.5, mb: result.installInstructions.builderPrompt ? 1 : 0 }}>
                  {result.installInstructions.steps.map((st, i) => (
                    <Typography key={i} component="li" variant="caption" color="text.secondary" sx={{ display: "list-item" }}>
                      {st}
                    </Typography>
                  ))}
                </Box>
                {result.installInstructions.builderPrompt && (
                  <>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>Builder-prompt (snippet innbakt)</Typography>
                      <Button size="small" startIcon={<CopyIcon />}
                        onClick={() => void navigator.clipboard.writeText(result.installInstructions!.builderPrompt!).then(() => setPromptCopied(true)).catch(() => setPromptCopied(false))}>
                        {promptCopied ? "Kopiert ✓" : "Kopier prompt"}
                      </Button>
                    </Stack>
                    <Box component="pre" sx={{
                      m: 0, p: 1.25, borderRadius: 1.5, maxHeight: 200, overflow: "auto",
                      bgcolor: "rgba(2,6,23,0.6)", border: "1px solid rgba(148,163,184,0.2)",
                      fontSize: "0.7rem", lineHeight: 1.45, fontFamily: "monospace",
                      whiteSpace: "pre-wrap", color: "#cbd5e1",
                    }}>
                      {result.installInstructions.builderPrompt}
                    </Box>
                  </>
                )}
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
