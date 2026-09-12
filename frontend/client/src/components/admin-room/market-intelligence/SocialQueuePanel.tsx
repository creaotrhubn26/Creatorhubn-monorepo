/**
 * SocialQueuePanel.tsx — synlighets-sløyfen i MI
 *
 * Innsiktsdrevne poster i godkjennings-kø: composer lager utkast fra
 * plattformens egne tall (tall-validert i backend), DU godkjenner,
 * publiserer (manuelt kopier-og-lim i v1) og markerer publisert — som
 * automatisk logger posten i GEO-eksperimentloggen. Sløyfen lukkes.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  Campaign as QueueIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  ContentCopy as CopyIcon,
  Publish as PublishIcon,
} from "@mui/icons-material";

interface QueuedPost {
  id: string;
  solution: string;
  platform: string;
  body: string;
  status: "draft" | "approved" | "published" | "failed" | "rejected";
  external_url: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  draft: { label: "Utkast", color: "#60a5fa" },
  approved: { label: "Godkjent", color: "#f59e0b" },
  published: { label: "Publisert", color: "#4ade80" },
  failed: { label: "Feilet", color: "#f87171" },
  rejected: { label: "Avvist", color: "#94a3b8" },
};

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SocialQueuePanel() {
  const [posts, setPosts] = useState<QueuedPost[]>([]);
  const [solution, setSolution] = useState("creatorhub");
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [publishUrl, setPublishUrl] = useState<Record<string, string>>({});
  const [verifyFor, setVerifyFor] = useState<QueuedPost | null>(null);
  const [identity, setIdentity] = useState<{ ok: boolean; name?: string | null; memberId?: string; reason?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const openVerifyBridge = async (post: QueuedPost) => {
    setVerifyFor(post);
    setIdentity(null);
    setVerifying(true);
    try {
      const r = await fetch("/api/integrations/social-queue/verify-identity", {
        credentials: "include", headers: authHeaders(),
      });
      setIdentity(r.ok ? (await r.json()).identity : { ok: false, reason: `http_${r.status}` });
    } catch (e) {
      setIdentity({ ok: false, reason: String(e) });
    } finally {
      setVerifying(false);
    }
  };

  const confirmPublish = async () => {
    if (!verifyFor || !identity?.ok || !identity.memberId) return;
    setVerifying(true);
    try {
      const r = await fetch(`/api/integrations/social-queue/${verifyFor.id}/publish`, {
        method: "POST", credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ verifiedMemberId: identity.memberId }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null);
        setError(`LinkedIn-publisering: ${b?.error ?? r.status}`);
      }
      setVerifyFor(null);
      await load();
    } finally {
      setVerifying(false);
    }
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/integrations/social-queue", { credentials: "include", headers: authHeaders() });
    if (r.ok) setPosts((await r.json()).posts ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const compose = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/integrations/social-queue/compose", {
        method: "POST", credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ solution, angle: angle.trim() || undefined }),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null);
        setError(String(b?.error ?? r.status).startsWith("utkast_")
          ? "Composeren brukte tall uten kilde og ble avvist — prøv igjen."
          : `Kunne ikke komponere (${b?.error ?? r.status})`);
        return;
      }
      await load();
    } finally { setBusy(false); }
  };

  const transition = async (id: string, status: string, extra: Record<string, unknown> = {}) => {
    const r = await fetch(`/api/integrations/social-queue/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => null);
      setError(`Overgang avvist: ${b?.error ?? r.status}`);
    }
    await load();
  };

  const copyBody = async (post: QueuedPost) => {
    await navigator.clipboard.writeText(post.body);
    setCopied(post.id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <QueueIcon sx={{ color: "#f472b6" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Synlighets-kø — innsikt som innhold
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · tall-validert · du godkjenner alt · publisering logges som GEO-eksperiment
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          <Select size="small" value={solution} onChange={(e) => setSolution(e.target.value)}>
            <MenuItem value="creatorhub">CreatorHub</MenuItem>
            <MenuItem value="theroleroom">The Role Room</MenuItem>
            <MenuItem value="leadgrid">Leadgrid</MenuItem>
          </Select>
          <TextField size="small" placeholder="Vinkel (valgfritt, f.eks. «marginene i bransjen»)"
            value={angle} onChange={(e) => setAngle(e.target.value)} sx={{ minWidth: 280 }} />
          <Button variant="contained" onClick={() => void compose()} disabled={busy}
            startIcon={busy ? <CircularProgress size={14} /> : undefined}>
            Lag utkast (LinkedIn + IG)
          </Button>
        </Stack>
        {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

        <Stack spacing={1}>
          {posts.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Ingen poster i køen — lag det første utkastet fra bransjetallene.
            </Typography>
          )}
          {posts.map((p) => {
            const st = STATUS_STYLE[p.status];
            return (
              <Box key={p.id} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${st.color}33`, borderLeft: `3px solid ${st.color}` }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={st.label}
                    sx={{ bgcolor: `${st.color}22`, color: st.color, fontWeight: 700, height: 20, fontSize: 10 }} />
                  <Chip size="small" variant="outlined" label={p.platform} sx={{ height: 20, fontSize: 10 }} />
                  <Typography variant="caption" color="text.secondary">{p.solution}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title={copied === p.id ? "Kopiert ✓" : "Kopier tekst"}>
                    <IconButton size="small" onClick={() => void copyBody(p)}><CopyIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  {p.status === "draft" && (
                    <>
                      <Tooltip title="Godkjenn">
                        <IconButton size="small" sx={{ color: "#4ade80" }}
                          onClick={() => void transition(p.id, "approved")}><ApproveIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Avvis">
                        <IconButton size="small" onClick={() => void transition(p.id, "rejected")}><RejectIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </>
                  )}
                </Stack>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontSize: "0.82rem" }}>
                  {p.body}
                </Typography>
                {p.status === "approved" && !p.external_url && (
                  <Button size="small" variant="outlined" sx={{ mt: 1, mr: 1 }}
                    onClick={async () => {
                      const r = await fetch(`/api/integrations/social-queue/${p.id}/send-to-cockpit`, {
                        method: "POST", credentials: "include", headers: authHeaders(),
                      });
                      if (!r.ok) {
                        const b = await r.json().catch(() => null);
                        setError(`Cockpit-broen: ${b?.error ?? r.status}`);
                      }
                      await load();
                    }}>
                    Send til Cockpit
                  </Button>
                )}
                {p.status === "approved" && p.platform === "linkedin" && (
                  <Button size="small" variant="contained" sx={{ mt: 1, mr: 1 }}
                    onClick={() => void openVerifyBridge(p)}>
                    Publiser via LinkedIn…
                  </Button>
                )}
                {p.status === "approved" && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                    <TextField size="small" placeholder="Lim inn post-URL etter publisering"
                      value={publishUrl[p.id] ?? ""}
                      onChange={(e) => setPublishUrl((u) => ({ ...u, [p.id]: e.target.value }))}
                      sx={{ flex: 1 }} />
                    <Button size="small" variant="contained" startIcon={<PublishIcon />}
                      onClick={() => void transition(p.id, "published", { externalUrl: publishUrl[p.id] || undefined })}>
                      Marker publisert
                    </Button>
                  </Stack>
                )}
                {p.status === "failed" && (
                  <Alert severity="warning" sx={{ mt: 1, fontSize: "0.75rem" }}>
                    {"Publisering feilet"} — godkjenn på nytt for å prøve igjen.
                  </Alert>
                )}
                {p.status === "published" && p.external_url && (
                  <Typography variant="caption" sx={{ color: "#4ade80" }}>
                    ✓ Logget som GEO-eksperiment · <a href={p.external_url} target="_blank" rel="noreferrer" style={{ color: "#4ade80" }}>åpne posten</a>
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      </CardContent>

      <Dialog open={verifyFor !== null} onClose={() => setVerifyFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "1rem" }}>Bekreft publisering</DialogTitle>
        <DialogContent>
          {verifying && !identity && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2">Verifiserer LinkedIn-tilkoblingen…</Typography>
            </Stack>
          )}
          {identity?.ok && (
            <>
              <Alert severity="info" sx={{ mb: 1 }}>
                Tilkoblingen er verifisert live mot LinkedIn. Du publiserer som:{" "}
                <strong>{identity.name ?? "ukjent navn"}</strong>
              </Alert>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", maxHeight: 160, overflowY: "auto", p: 1, bgcolor: "rgba(148,163,184,0.06)", borderRadius: 1 }}>
                {verifyFor?.body}
              </Typography>
            </>
          )}
          {identity && !identity.ok && (
            <Alert severity="warning">
              {identity.reason === "not_connected" && "Ingen LinkedIn-tilkobling funnet — koble til i Role Room-innstillingene først."}
              {identity.reason === "reconnect_required" && "LinkedIn-tokenet er utløpt eller trukket — logg inn på LinkedIn på nytt i Role Room-innstillingene."}
              {identity.reason !== "not_connected" && identity.reason !== "reconnect_required" && `Verifisering feilet (${identity.reason}) — prøv igjen.`}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyFor(null)}>Avbryt</Button>
          <Button variant="contained" disabled={!identity?.ok || verifying}
            onClick={() => void confirmPublish()}>
            {verifying ? "Publiserer…" : `Publiser som ${identity?.ok ? (identity.name ?? "meg") : "…"}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
