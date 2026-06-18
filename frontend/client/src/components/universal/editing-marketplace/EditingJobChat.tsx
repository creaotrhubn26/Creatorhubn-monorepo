/**
 * EditingJobChat.tsx
 *
 * Gjenbrukbar meldingstråd fotograf <-> vendor pr redigerings-oppdrag.
 * Brukes i vendor-arbeidsområdet (Kommunikasjon) og kan embeddes på fotograf-
 * siden. Poller for nye meldinger. Tospråklig.
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, TextField, Button, Typography, Paper, Alert } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { apiRequest } from "@/lib/queryClient";
import { t, type Locale } from "./editingMarketplaceStrings";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  created_at: string;
}

interface Props {
  jobId: string;
  selfRole: "photographer" | "vendor";
  locale?: Locale;
}

export default function EditingJobChat({ jobId, selfRole, locale = "no" }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const msgQuery = useQuery<{ messages: ChatMessage[]; canMessage: boolean }>({
    queryKey: ["/api/editing/jobs", jobId, "messages"],
    queryFn: () => apiRequest(`/api/editing/jobs/${jobId}/messages`),
    refetchInterval: 8000,
  });
  const messages = msgQuery.data?.messages ?? [];
  const canMessage = msgQuery.data?.canMessage ?? false;

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest(`/api/editing/jobs/${jobId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["/api/editing/jobs", jobId, "messages"] });
    },
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: 360 }}>
      <Box sx={{ flex: 1, overflowY: "auto", p: 1 }}>
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
            {t("chat_empty", locale)}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {messages.map((m) => {
              const mine = m.sender_role === selfRole;
              return (
                <Box key={m.id} sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <Paper
                    sx={{
                      p: 1,
                      px: 1.5,
                      maxWidth: "75%",
                      bgcolor: mine ? "#ff8c0022" : "action.hover",
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body2">{m.body}</Typography>
                  </Paper>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
      {canMessage ? (
        <Box sx={{ display: "flex", gap: 1, pt: 1 }}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("chat_input", locale)}
            size="small"
            fullWidth
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && draft.trim()) {
                e.preventDefault();
                sendMutation.mutate(draft.trim());
              }
            }}
          />
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            disabled={!draft.trim() || sendMutation.isPending}
            onClick={() => draft.trim() && sendMutation.mutate(draft.trim())}
          >
            {t("chat_send", locale)}
          </Button>
        </Box>
      ) : (
        <Alert severity="info" sx={{ mt: 1 }}>
          {t("chat_closed", locale)}
        </Alert>
      )}
    </Box>
  );
}
