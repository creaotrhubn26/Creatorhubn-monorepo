/**
 * ButlerChatPanel.tsx — JARVIS J2: samtalen (BETA)
 *
 * Chat med butleren over egne data. Hvert svar viser verktøy-sporet
 * (hvilke oppslag butleren gjorde) — svar uten oppslag merkes ærlig
 * «uten oppslag». Kun lesing i denne versjonen.
 */

import { useRef, useState } from "react";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Stack,
  TextField, Typography,
} from "@mui/material";
import {
  AutoFixHigh as ButlerIcon,
  Send as SendIcon,
} from "@mui/icons-material";

interface Msg {
  role: "user" | "assistant";
  content: string;
  toolTrace?: Array<{ tool: string }>;
}

const TOOL_LABELS: Record<string, string> = {
  get_insights: "innsikter",
  get_opportunity_scores: "opportunity score",
  get_tenders: "anbud",
  get_lead_dossier: "lead-dossier",
  get_prospects: "prospekter",
  get_market_requirements: "markedskrav",
  get_ai_usage: "forbruk",
};

const SUGGESTIONS = [
  "Hva bør jeg se på i dag?",
  "Hvilke anbud har frist snart?",
  "Hvordan ligger dansevertikalen an?",
];

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ButlerChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/integrations/butler/chat", {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content: c }) => ({ role, content: c })) }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setMessages((m) => [...m, {
          role: "assistant",
          content: `Beklager — noe gikk galt (${body?.error ?? r.status}).`,
        }]);
        return;
      }
      setMessages((m) => [...m, {
        role: "assistant",
        content: body.result.reply,
        toolTrace: body.result.toolTrace,
      }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Nettverksfeil: ${String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <ButlerIcon sx={{ color: "#c084fc" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Spør butleren
          </Typography>
          <Chip label="BETA" size="small"
            sx={{ bgcolor: "#c084fc22", color: "#c084fc", fontWeight: 700, height: 18, fontSize: 10 }} />
          <Typography variant="caption" color="text.secondary">
            · kun lesing — svarene viser hvilke oppslag som ble gjort
          </Typography>
        </Stack>

        {messages.length === 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
            {SUGGESTIONS.map((sug) => (
              <Chip key={sug} label={sug} size="small" variant="outlined"
                onClick={() => void send(sug)} sx={{ cursor: "pointer" }} />
            ))}
          </Stack>
        )}

        {messages.length > 0 && (
          <Box ref={scrollRef} sx={{ maxHeight: 340, overflowY: "auto", mb: 1.5, pr: 0.5 }}>
            <Stack spacing={1}>
              {messages.map((m, i) => (
                <Box key={i} sx={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  p: 1.2, borderRadius: 1.5,
                  bgcolor: m.role === "user" ? "rgba(96,165,250,0.12)" : "rgba(192,132,252,0.08)",
                  borderLeft: m.role === "assistant" ? "2px solid #c084fc" : "none",
                }}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
                    {m.content}
                  </Typography>
                  {m.role === "assistant" && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                      {(m.toolTrace?.length ?? 0) === 0 ? (
                        <Chip label="uten oppslag" size="small" variant="outlined"
                          sx={{ height: 16, fontSize: 9, opacity: 0.6 }} />
                      ) : (
                        m.toolTrace!.map((t, j) => (
                          <Chip key={j} label={`↳ ${TOOL_LABELS[t.tool] ?? t.tool}`} size="small"
                            sx={{ height: 16, fontSize: 9, bgcolor: "rgba(192,132,252,0.12)", color: "#c084fc" }} />
                        ))
                      )}
                    </Stack>
                  )}
                </Box>
              ))}
              {loading && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={14} sx={{ color: "#c084fc" }} />
                  <Typography variant="caption" color="text.secondary">butleren slår opp…</Typography>
                </Stack>
              )}
            </Stack>
          </Box>
        )}

        <Stack direction="row" spacing={1}>
          <TextField fullWidth size="small" placeholder="Spør om dataene dine…"
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            disabled={loading} />
          <Button variant="contained" onClick={() => void send(input)} disabled={loading || !input.trim()}
            sx={{ minWidth: 44 }}>
            <SendIcon fontSize="small" />
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
