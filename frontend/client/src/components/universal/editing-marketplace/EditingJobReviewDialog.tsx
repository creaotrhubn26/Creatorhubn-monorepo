/**
 * EditingJobReviewDialog.tsx
 *
 * Fotografen vurderer en leveranse (1-5 + kommentar) ELLER melder inn en
 * leverings-klage. Anmeldelser driver vendorens rating/tier + discovery;
 * gjentatte klager flagger vendoren (kan føre til avsluttet partnerskap).
 */

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Rating, TextField,
  Stack, ToggleButtonGroup, ToggleButton, MenuItem, Alert, Typography, Box,
} from "@mui/material";
import { apiRequest } from "@/lib/queryClient";

type Locale = "no" | "en";

interface Props {
  jobId: string;
  open: boolean;
  onClose: () => void;
  locale?: Locale;
}

const STR = {
  no: {
    title: "Vurder leveransen", review: "Anmeldelse", complaint: "Meld inn problem",
    rating: "Hvor fornøyd er du?", comment: "Kommentar (valgfritt)",
    category: "Type problem", detail: "Beskriv problemet",
    quality: "Kvalitet", deadline: "Frist", scope: "Omfang", communication: "Kommunikasjon", other: "Annet",
    cancel: "Avbryt", submitReview: "Send anmeldelse", submitComplaint: "Send klage", sending: "Sender…",
    doneR: "Takk for anmeldelsen!", doneC: "Klagen er mottatt. Vi følger opp kvalitet tett.",
    needRating: "Velg en vurdering.", err: "Noe gikk galt.",
    complaintNote: "Gjentatte klager flagger leverandøren og kan føre til at samarbeidet avsluttes.",
  },
  en: {
    title: "Rate the delivery", review: "Review", complaint: "Report a problem",
    rating: "How satisfied are you?", comment: "Comment (optional)",
    category: "Problem type", detail: "Describe the problem",
    quality: "Quality", deadline: "Deadline", scope: "Scope", communication: "Communication", other: "Other",
    cancel: "Cancel", submitReview: "Submit review", submitComplaint: "Submit complaint", sending: "Sending…",
    doneR: "Thanks for your review!", doneC: "Your complaint has been received. We follow quality closely.",
    needRating: "Please pick a rating.", err: "Something went wrong.",
    complaintNote: "Repeated complaints flag the vendor and may lead to the partnership being terminated.",
  },
};

export default function EditingJobReviewDialog({ jobId, open, onClose, locale = "no" }: Props) {
  const s = STR[locale === "en" ? "en" : "no"];
  const qc = useQueryClient();
  const [mode, setMode] = useState<"review" | "complaint">("review");
  const [rating, setRating] = useState<number | null>(4);
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState("quality");
  const [detail, setDetail] = useState("");
  const [done, setDone] = useState<null | "review" | "complaint">(null);
  const [err, setErr] = useState("");

  const submit = useMutation({
    mutationFn: () => {
      if (mode === "review") {
        if (!rating) throw new Error("rating");
        return apiRequest(`/api/editing/jobs/${jobId}/review`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, comment }),
        });
      }
      return apiRequest(`/api/editing/jobs/${jobId}/complaint`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, detail }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/editing/vendors"] });
      setDone(mode);
    },
    onError: (e: unknown) => setErr((e as Error)?.message === "rating" ? s.needRating : s.err),
  });

  const close = () => { setDone(null); setErr(""); onClose(); };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle>{s.title}</DialogTitle>
      <DialogContent>
        {done ? (
          <Alert severity="success" sx={{ mt: 1 }}>{done === "review" ? s.doneR : s.doneC}</Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}>
              <ToggleButton value="review">{s.review}</ToggleButton>
              <ToggleButton value="complaint">{s.complaint}</ToggleButton>
            </ToggleButtonGroup>
            {mode === "review" ? (
              <>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>{s.rating}</Typography>
                  <Rating value={rating} onChange={(_, v) => setRating(v)} size="large" />
                </Box>
                <TextField label={s.comment} value={comment} onChange={(e) => setComment(e.target.value)} multiline minRows={2} fullWidth />
              </>
            ) : (
              <>
                <TextField select label={s.category} value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
                  {["quality", "deadline", "scope", "communication", "other"].map((c) => (
                    <MenuItem key={c} value={c}>{(s as Record<string, string>)[c]}</MenuItem>
                  ))}
                </TextField>
                <TextField label={s.detail} value={detail} onChange={(e) => setDetail(e.target.value)} multiline minRows={3} fullWidth />
                <Alert severity="info" sx={{ "& .MuiAlert-message": { fontSize: 12.5 } }}>{s.complaintNote}</Alert>
              </>
            )}
            {err && <Alert severity="error">{err}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{done ? "OK" : s.cancel}</Button>
        {!done && (
          <Button variant="contained" onClick={() => submit.mutate()} disabled={submit.isPending}
            color={mode === "complaint" ? "warning" : "primary"}>
            {submit.isPending ? s.sending : (mode === "review" ? s.submitReview : s.submitComplaint)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
