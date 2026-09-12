/**
 * EditingJobChat.tsx
 *
 * Gjenbrukbar meldingstråd fotograf <-> vendor pr redigerings-oppdrag.
 * Brukes i vendor-arbeidsområdet (Kommunikasjon) og kan embeddes på fotograf-
 * siden. Poller for nye meldinger. Tospråklig.
 */

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, TextField, Button, Typography, Paper, Alert, Skeleton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { apiRequest } from "@/lib/queryClient";
import { t, type Locale } from "./editingMarketplaceStrings";
import EditingJobActions from "./EditingJobActions";

function fmtChatTime(iso: string, locale: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  const loc = locale === "en" ? "en-US" : "nb-NO";
  return sameDay
    ? d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString(loc, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

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
  /** Oppdrags-status — driver de kontekst-bevisste hurtighandlingene. */
  jobStatus?: string;
}

export default function EditingJobChat({ jobId, selfRole, locale = "no", jobStatus }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const msgQuery = useQuery<{ messages: ChatMessage[]; canMessage: boolean }>({
    queryKey: ["/api/editing/jobs", jobId, "messages"],
    queryFn: () => apiRequest(`/api/editing/jobs/${jobId}/messages`),
    refetchInterval: 8000,
  });
  const messages = msgQuery.data?.messages ?? [];
  const canMessage = msgQuery.data?.canMessage ?? false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

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
        {msgQuery.isLoading ? (
          <Stack spacing={1}>
            <Skeleton variant="rounded" width="62%" height={38} />
            <Skeleton variant="rounded" width="48%" height={34} sx={{ ml: "auto" }} />
            <Skeleton variant="rounded" width="58%" height={36} />
          </Stack>
        ) : messages.length === 0 ? (
          <Stack alignItems="center" spacing={0.5} sx={{ mt: 4 }}>
            <Typography variant="h5" aria-hidden>💬</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              {t("chat_empty", locale)}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1}>
            {messages.map((m) => {
              const mine = m.sender_role === selfRole;
              return (
                <Box key={m.id} sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <Box sx={{ maxWidth: "75%" }}>
                    <Paper
                      sx={{
                        p: 1,
                        px: 1.5,
                        bgcolor: mine ? "#ff8c0022" : "action.hover",
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {m.body}
                      </Typography>
                    </Paper>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 0.25, textAlign: mine ? "right" : "left", fontSize: 10 }}
                    >
                      {fmtChatTime(m.created_at, locale)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </Stack>
        )}
      </Box>
      {jobStatus ? (
        <Box sx={{ pt: 1 }}>
          <EditingJobActions jobId={jobId} selfRole={selfRole} jobStatus={jobStatus} locale={locale} />
        </Box>
      ) : null}
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
