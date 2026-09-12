/**
 * MorningBriefCard.tsx — butlerens morgenbrief (JARVIS J1)
 *
 * Dagens brief øverst i MI: skrevet av butleren etter nattens
 * detektorkjøring, siterings-validert mot nattens fakta. Stille netter
 * sier ærlig «stille natt» — uten AI-kostnad.
 */

import { useEffect, useState } from "react";
import { Box, Chip, Collapse, IconButton, Stack, Typography } from "@mui/material";
import {
  ExpandMore as ExpandIcon,
  WbTwilight as MorningIcon,
} from "@mui/icons-material";

interface Brief {
  brief_date: string;
  content: string;
  facts: Array<{ n: number; category: string; text: string }>;
  kind: "generated" | "quiet";
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("creatorhub_auth_token") ?? localStorage.getItem("token") ?? "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MorningBriefCard() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [showFacts, setShowFacts] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/integrations/morning-brief", {
          credentials: "include",
          headers: authHeaders(),
        });
        if (r.ok) setBrief((await r.json()).brief ?? null);
      } catch {
        /* briefen er hyggelig-å-ha — feiler stille */
      }
    })();
  }, []);

  if (!brief) return null;

  return (
    <Box sx={{
      p: 2, borderRadius: 2,
      background: "linear-gradient(135deg, rgba(192,132,252,0.10), rgba(96,165,250,0.06))",
      border: "1px solid rgba(192,132,252,0.3)",
    }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <MorningIcon sx={{ color: "#c084fc" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Morgenbrief · {new Date(brief.brief_date).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })}
        </Typography>
        {brief.kind === "quiet" && (
          <Chip size="small" label="stille natt" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
        )}
        <Box sx={{ flex: 1 }} />
        {brief.facts.length > 0 && (
          <IconButton size="small" onClick={() => setShowFacts(!showFacts)}
            sx={{ transform: showFacts ? "rotate(180deg)" : "none" }}>
            <ExpandIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontSize: "0.87rem" }}>
        {brief.content}
      </Typography>
      <Collapse in={showFacts}>
        <Box sx={{ mt: 1, pt: 1, borderTop: "1px solid rgba(192,132,252,0.2)" }}>
          {brief.facts.map((f) => (
            <Typography key={f.n} variant="caption" sx={{ display: "block", fontFamily: "monospace", opacity: 0.75 }}>
              [{f.n}] ({f.category}) {f.text}
            </Typography>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
