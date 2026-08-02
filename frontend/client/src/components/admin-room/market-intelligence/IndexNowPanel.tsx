/**
 * IndexNowPanel.tsx — F6 «submit_indexnow» (doc 14)
 *
 * Meld inn URL-er til IndexNow (Bing = ChatGPT-søkeindeksen) — den eneste
 * søke-innmeldingen som ikke krever klient-OAuth. Nøkkelfilen for VÅRE
 * domener ligger i repoet (public/<key>.txt, servert på alle hostene);
 * for klient-domener må filen deployes hos klienten først.
 */

import { useState } from "react";
import {
  Alert, Button, Card, CardContent, Stack, TextField, Typography,
} from "@mui/material";
import { Send as SubmitIcon } from "@mui/icons-material";

/** Nøkkelen er offentlig by design (hostet i klartekst på domenet). */
const OWN_KEY = "a9ac5c44b95de2e87781907267a60f07";
const OWN_HOSTS = ["theroleroom.com", "leadgrid.no", "creatorhubn.com"];

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function IndexNowPanel() {
  const [host, setHost] = useState(OWN_HOSTS[0]);
  const [key, setKey] = useState(OWN_KEY);
  const [urls, setUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setOutcome(null);
    try {
      const r = await fetch("/api/integrations/indexnow/submit", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          host: host.trim(),
          key: key.trim(),
          urls: urls.split(/\n+/).map((u) => u.trim()).filter(Boolean),
        }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.submitted) {
        setOutcome({ ok: false, text: body?.detail ?? `Innmelding feilet (${body?.error ?? r.status}).` });
        return;
      }
      setOutcome({ ok: true, text: `${body.urlCount} URL-er meldt inn (HTTP ${body.status}). ${body.detail}` });
    } catch (e) {
      setOutcome({ ok: false, text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const urlCount = urls.split(/\n+/).map((u) => u.trim()).filter(Boolean).length;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <SubmitIcon sx={{ color: "#22d3ee" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            IndexNow — meld inn til Bing/ChatGPT-indeksen
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Én URL per linje (maks 100, samme host som nøkkelen). Egne domener
          er forhåndsutfylt — for klient-domener må nøkkelfilen (
          <code>https://&lt;host&gt;/&lt;nøkkel&gt;.txt</code>) deployes hos
          klienten først.
        </Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <TextField size="small" label="Host" value={host}
            onChange={(e) => setHost(e.target.value)} sx={{ width: 200 }} />
          <TextField size="small" label="Nøkkel (hex)" value={key}
            onChange={(e) => setKey(e.target.value)} sx={{ flex: 1, minWidth: 240 }} />
        </Stack>
        <TextField multiline minRows={3} maxRows={8} fullWidth size="small"
          placeholder={"https://theroleroom.com/casting-oslo\nhttps://theroleroom.com/statister"}
          value={urls} onChange={(e) => setUrls(e.target.value)} sx={{ mb: 1 }} />

        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="contained" onClick={() => void submit()}
            disabled={busy || urlCount === 0 || urlCount > 100}>
            {busy ? "Melder inn…" : `Meld inn ${urlCount || ""} URL-er`}
          </Button>
          <Typography variant="caption" color="text.disabled">
            Ekstern innsending — skjer først når du klikker.
          </Typography>
        </Stack>

        {outcome && (
          <Alert severity={outcome.ok ? "success" : "warning"} sx={{ mt: 1 }}>
            {outcome.text}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
