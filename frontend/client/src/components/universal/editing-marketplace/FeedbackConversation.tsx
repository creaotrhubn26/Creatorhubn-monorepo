/**
 * FeedbackConversation.tsx
 *
 * Trådet feedback-SAMTALE som chat-bobler — delt mellom vendor-workspace og
 * admin-panelet. Vendor og Creatorhub (admin = menneske, system = varm
 * kvittering) svarer fram og tilbake. Åpningen (selve tilbakemeldingen) og evt.
 * admin_notes vises som de første boblene, så hele konteksten er én samtale.
 */

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, TextField, Button, Skeleton, Chip, Avatar } from "@mui/material";
import { apiRequest } from "@/lib/queryClient";

interface Msg {
  id: string;
  senderRole: string;
  senderName: string | null;
  body: string;
  createdAt: string;
}
interface ThreadData {
  success: boolean;
  feedback: {
    id: string;
    title: string;
    description: string;
    status: string;
    adminNotes: string | null;
    rating: number;
    feedbackType: string;
    vendorName: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  messages: Msg[];
}

function fmtTime(iso: string, en: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(en ? "en-US" : "nb-NO", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString(en ? "en-US" : "nb-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function FeedbackConversation({
  feedbackId,
  locale = "no",
  viewer,
}: {
  feedbackId: string;
  locale?: "no" | "en";
  viewer: "vendor" | "admin";
}) {
  const en = locale === "en";
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const key = ["/api/prototype-testing/feedback", feedbackId, "messages"];

  const thread = useQuery<ThreadData>({
    queryKey: key,
    queryFn: () => apiRequest(`/api/prototype-testing/feedback/${feedbackId}/messages`),
  });

  const reply = useMutation({
    mutationFn: (bodyText: string) =>
      apiRequest(`/api/prototype-testing/feedback/${feedbackId}/messages`, {
        method: "POST",
        body: { body: bodyText },
      }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const fb = thread.data?.feedback;
  const msgs = thread.data?.messages ?? [];

  type Bubble = { side: "left" | "right"; name: string; body: string; at: string; system?: boolean };
  const bubbles: Bubble[] = [];
  if (fb) {
    bubbles.push({
      side: viewer === "vendor" ? "right" : "left",
      name: fb.vendorName || (en ? "Tester" : "Tester"),
      body: fb.description,
      at: fb.createdAt,
    });
    if (fb.adminNotes) {
      bubbles.push({
        side: viewer === "vendor" ? "left" : "right",
        name: "Creatorhub",
        body: fb.adminNotes,
        at: fb.updatedAt,
      });
    }
  }
  for (const m of msgs) {
    const mineRight = viewer === "vendor" ? m.senderRole === "vendor" : m.senderRole === "admin";
    bubbles.push({
      side: mineRight ? "right" : "left",
      name: m.senderName || (m.senderRole === "system" ? "Creatorhub" : m.senderRole),
      body: m.body,
      at: m.createdAt,
      system: m.senderRole === "system",
    });
  }

  // Auto-scroll til nyeste melding når tråden lastes/oppdateres.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [bubbles.length, thread.isLoading]);

  const send = () => {
    const t = draft.trim();
    if (t && !reply.isPending) reply.mutate(t);
  };

  return (
    <Box>
      {fb ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
            {fb.title}
          </Typography>
          <Chip size="small" variant="outlined" label={fb.status} />
        </Stack>
      ) : null}

      <Box
        sx={{
          maxHeight: 360,
          overflowY: "auto",
          mb: 1.5,
          p: 1,
          borderRadius: 1.5,
          bgcolor: "action.hover",
        }}
      >
        {thread.isLoading ? (
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" width="70%" height={48} />
            <Skeleton variant="rounded" width="55%" height={40} sx={{ ml: "auto" }} />
            <Skeleton variant="rounded" width="64%" height={44} />
          </Stack>
        ) : bubbles.length === 0 ? (
          <Stack alignItems="center" spacing={0.5} sx={{ py: 3 }}>
            <Typography variant="h5" aria-hidden>💬</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              {en
                ? "Start the conversation — we're listening."
                : "Start samtalen — vi lytter."}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1.25}>
            {bubbles.map((b, i) => (
              <Stack
                key={i}
                direction={b.side === "right" ? "row-reverse" : "row"}
                spacing={1}
                alignItems="flex-end"
              >
                <Avatar
                  sx={{
                    width: 26,
                    height: 26,
                    fontSize: 11,
                    bgcolor: b.side === "right" ? "primary.main" : b.system ? "success.main" : "grey.500",
                  }}
                >
                  {initials(b.name)}
                </Avatar>
                <Box sx={{ maxWidth: "78%" }}>
                  <Box
                    sx={{
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 2,
                      bgcolor: b.side === "right" ? "primary.main" : b.system ? "success.light" : "background.paper",
                      color: b.side === "right" ? "primary.contrastText" : "text.primary",
                      border: b.side === "right" ? "none" : "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block", opacity: 0.85 }}>
                      {b.name}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {b.body}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.25, textAlign: b.side === "right" ? "right" : "left", fontSize: 10 }}
                  >
                    {fmtTime(b.at, en)}
                  </Typography>
                </Box>
              </Stack>
            ))}
            <div ref={bottomRef} />
          </Stack>
        )}
      </Box>

      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={4}
          placeholder={en ? "Write a reply…  (Enter to send)" : "Skriv et svar…  (Enter for å sende)"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={reply.isPending}
        />
        <Button variant="contained" disabled={reply.isPending || !draft.trim()} onClick={send}>
          {reply.isPending ? "…" : en ? "Send" : "Send"}
        </Button>
      </Stack>
      {reply.isError ? (
        <Typography variant="caption" color="error">
          {en ? "Could not send — try again." : "Kunne ikke sende — prøv igjen."}
        </Typography>
      ) : null}
    </Box>
  );
}
