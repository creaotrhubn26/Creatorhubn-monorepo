/**
 * FeedbackConversation.tsx
 *
 * Trådet feedback-SAMTALE som chat-bobler — delt mellom vendor-workspace og
 * admin-panelet. Vendor og Creatorhub (admin = menneske, system = varm
 * kvittering) svarer fram og tilbake. Åpningen (selve tilbakemeldingen) og evt.
 * admin_notes vises som de første boblene, så hele konteksten er én samtale.
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Typography, TextField, Button, CircularProgress, Chip } from "@mui/material";
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

  type Bubble = { side: "left" | "right"; name: string; body: string; system?: boolean };
  const bubbles: Bubble[] = [];
  if (fb) {
    // Åpningen: selve tilbakemeldingen. For vendor er den «min» (høyre).
    bubbles.push({
      side: viewer === "vendor" ? "right" : "left",
      name: fb.vendorName || (en ? "Tester" : "Tester"),
      body: fb.description,
    });
    if (fb.adminNotes) {
      bubbles.push({
        side: viewer === "vendor" ? "left" : "right",
        name: "Creatorhub",
        body: fb.adminNotes,
      });
    }
  }
  for (const m of msgs) {
    const mineRight = viewer === "vendor" ? m.senderRole === "vendor" : m.senderRole === "admin";
    bubbles.push({
      side: mineRight ? "right" : "left",
      name: m.senderName || (m.senderRole === "system" ? "Creatorhub" : m.senderRole),
      body: m.body,
      system: m.senderRole === "system",
    });
  }

  return (
    <Box>
      {thread.isLoading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack spacing={1} sx={{ maxHeight: 340, overflowY: "auto", mb: 1.5, pr: 0.5 }}>
          {fb ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {fb.title}
              </Typography>
              <Chip size="small" variant="outlined" label={fb.status} />
            </Stack>
          ) : null}
          {bubbles.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              {en ? "No messages yet." : "Ingen meldinger ennå."}
            </Typography>
          ) : null}
          {bubbles.map((b, i) => (
            <Box key={i} sx={{ display: "flex", justifyContent: b.side === "right" ? "flex-end" : "flex-start" }}>
              <Box
                sx={{
                  maxWidth: "82%",
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: b.side === "right" ? "primary.main" : b.system ? "success.light" : "action.hover",
                  color: b.side === "right" ? "primary.contrastText" : "text.primary",
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: "block", opacity: 0.85 }}>
                  {b.name}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {b.body}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={4}
          placeholder={en ? "Write a reply…" : "Skriv et svar…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={reply.isPending}
        />
        <Button
          variant="contained"
          disabled={reply.isPending || !draft.trim()}
          onClick={() => reply.mutate(draft.trim())}
        >
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
