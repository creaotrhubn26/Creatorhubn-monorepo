/**
 * EditingJobActions.tsx
 *
 * EGEN, frittstående «smarte handlinger»-løsning for redigerings-oppdrag —
 * inspirert av (men IKKE koblet til) Role Rooms «Actions». Viser kontekst- og
 * rolle-bevisste hurtighandlinger rett i job-chatten, som kaller de EKSISTERENDE
 * oppdrags-endepunktene. Slik chatter og handler fotograf/vendor på ett sted, og
 * handlingene treffer ekte status + varsler (ingen frakoblet kopi).
 *
 * Utvidbar: legg til nye handlinger i ACTIONS-registeret nedenfor.
 */

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Stack, Button, TextField, Typography, Collapse } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import { apiRequest } from "@/lib/queryClient";
import type { Locale } from "./editingMarketplaceStrings";

type Role = "photographer" | "vendor";

interface ActionDef {
  id: string;
  label: { no: string; en: string };
  hint?: { no: string; en: string };
  icon: React.ReactNode;
  roles: Role[];
  statuses: string[];
  color: "primary" | "success" | "warning";
  reason?: { no: string; en: string }; // hvis satt → krever en kort begrunnelse
  build: (reason: string) => { url: string; body?: Record<string, unknown> };
}

const ACTIONS: ActionDef[] = [
  {
    id: "deliver",
    label: { no: "Lever oppdrag", en: "Deliver job" },
    hint: { no: "Send ferdig redigering til fotografen", en: "Send the finished edit to the photographer" },
    icon: <SendIcon fontSize="small" />,
    roles: ["vendor"],
    statuses: ["in_progress"],
    color: "primary",
    build: (jobId) => ({ url: `/api/editing/jobs/${jobId}/deliver` }),
  },
  {
    id: "approve",
    label: { no: "Godkjenn levering", en: "Approve delivery" },
    hint: { no: "Godkjenn det vendoren leverte", en: "Approve what the vendor delivered" },
    icon: <CheckCircleIcon fontSize="small" />,
    roles: ["photographer"],
    statuses: ["delivered"],
    color: "success",
    build: (jobId) => ({ url: `/api/editing/jobs/${jobId}/approve` }),
  },
  {
    id: "request_revision",
    label: { no: "Be om revisjon", en: "Request revision" },
    hint: { no: "Meld fra om hva som bør endres", en: "Tell them what should change" },
    icon: <ReplayIcon fontSize="small" />,
    roles: ["photographer"],
    statuses: ["delivered"],
    color: "warning",
    reason: { no: "Hva bør endres?", en: "What should change?" },
    build: (jobId, reason) => ({
      url: `/api/editing/jobs/${jobId}/complaint`,
      body: { category: "scope", detail: reason },
    }),
  },
];

export default function EditingJobActions({
  jobId,
  selfRole,
  jobStatus,
  locale = "no",
  onActed,
}: {
  jobId: string;
  selfRole: Role;
  jobStatus: string;
  locale?: Locale;
  onActed?: () => void;
}) {
  const en = locale === "en";
  const qc = useQueryClient();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [doneId, setDoneId] = useState<string | null>(null);

  const available = ACTIONS.filter(
    (a) => a.roles.includes(selfRole) && a.statuses.includes(jobStatus),
  );

  const act = useMutation({
    mutationFn: (a: ActionDef) => {
      const { url, body } = a.build(jobId, reason.trim());
      return apiRequest(url, { method: "POST", body: body ?? {} });
    },
    onSuccess: (_d, a) => {
      setDoneId(a.id);
      setReasonFor(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["/api/editing/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/editing/jobs", jobId, "messages"] });
      onActed?.();
    },
  });

  if (available.length === 0) return null;

  const trigger = (a: ActionDef) => {
    if (a.reason) {
      setReasonFor(reasonFor === a.id ? null : a.id);
      return;
    }
    act.mutate(a);
  };

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {en ? "Quick actions" : "Hurtighandlinger"}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {available.map((a) => (
          <Button
            key={a.id}
            size="small"
            variant={doneId === a.id ? "outlined" : "contained"}
            color={a.color}
            startIcon={a.icon}
            disabled={act.isPending}
            onClick={() => trigger(a)}
            title={a.hint ? (en ? a.hint.en : a.hint.no) : undefined}
          >
            {en ? a.label.en : a.label.no}
          </Button>
        ))}
      </Stack>

      {available.map((a) =>
        a.reason ? (
          <Collapse key={`r-${a.id}`} in={reasonFor === a.id} unmountOnExit>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="flex-end">
              <TextField
                size="small"
                fullWidth
                multiline
                maxRows={3}
                autoFocus
                placeholder={en ? a.reason.en : a.reason.no}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={act.isPending}
              />
              <Button
                size="small"
                variant="contained"
                color={a.color}
                disabled={act.isPending || !reason.trim()}
                onClick={() => act.mutate(a)}
              >
                {en ? "Send" : "Send"}
              </Button>
            </Stack>
          </Collapse>
        ) : null,
      )}

      {act.isError ? (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {en ? "Action failed — try again." : "Handlingen feilet — prøv igjen."}
        </Typography>
      ) : null}
    </Box>
  );
}
