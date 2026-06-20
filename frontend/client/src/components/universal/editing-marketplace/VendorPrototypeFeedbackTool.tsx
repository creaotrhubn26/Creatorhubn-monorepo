/**
 * VendorPrototypeFeedbackTool.tsx
 *
 * Eget prototype-feedback-verktøy for redigeringspartnere (separat fra det generelle
 * PrototypeFeedbackTool). Tospråklig (no/en). Spør om vendor-spesifikke områder
 * (arbeidsflyt, filoverføring, utbetaling, synlighet). Lagres i prototype_feedback
 * tagget dashboardType='editing-vendor' så admin kan filtrere.
 */

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Rating, Stack, Typography, Alert, Box,
} from "@mui/material";
import FeedbackIcon from "@mui/icons-material/Feedback";
import { apiRequest } from "@/lib/queryClient";

type Locale = "no" | "en";

interface Props {
  locale?: Locale;
  vendorName?: string | null;
  userEmail?: string | null;
  userId?: string | null;
  variant?: "button" | "fab";
}

const STR = {
  no: {
    open: "Gi tilbakemelding", title: "Tilbakemelding fra partner",
    intro: "Du er prototype-tester — innspillene dine former produktet. Hva fungerer, og hva mangler?",
    category: "Område", titleField: "Tittel", desc: "Beskriv (hva skjedde / hva ønsker du)",
    rating: "Hvor fornøyd er du totalt?", cancel: "Avbryt", submit: "Send", sending: "Sender…",
    done: "Takk! Tilbakemeldingen er mottatt.", err: "Noe gikk galt. Prøv igjen.", req: "Fyll ut tittel + beskrivelse.",
    cats: [
      ["workflow", "Redigerings-arbeidsflyt"], ["files", "Filoverføring & lagring"],
      ["payout", "Utbetaling & gebyr"], ["discovery", "Synlighet & oppdrag"],
      ["bug", "Feil / bug"], ["feature", "Ønsket funksjon"], ["general", "Generelt"],
    ],
  },
  en: {
    open: "Give feedback", title: "Partner feedback",
    intro: "You're a prototype tester — your input shapes the product. What works, and what's missing?",
    category: "Area", titleField: "Title", desc: "Describe (what happened / what you'd like)",
    rating: "Overall, how satisfied are you?", cancel: "Cancel", submit: "Send", sending: "Sending…",
    done: "Thank you! Your feedback has been received.", err: "Something went wrong. Please try again.", req: "Fill in title + description.",
    cats: [
      ["workflow", "Editing workflow"], ["files", "File transfer & storage"],
      ["payout", "Payout & fees"], ["discovery", "Discovery & getting jobs"],
      ["bug", "Bug"], ["feature", "Feature request"], ["general", "General"],
    ],
  },
};

export default function VendorPrototypeFeedbackTool({ locale = "no", vendorName, userEmail, userId, variant = "button" }: Props) {
  const s = STR[locale === "en" ? "en" : "no"];
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("workflow");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState<number | null>(4);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = useMutation({
    mutationFn: () => {
      if (!title.trim() || !description.trim()) throw new Error("req");
      return apiRequest("/api/prototype-testing/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType: category, title, description, rating: rating || 5,
          dashboardType: "editing-vendor", profession: "editing_vendor",
          userEmail: userEmail || null, userId: userId || null, userName: vendorName || null,
          tags: ["editing-vendor", "prototype"], priority: category === "bug" ? "high" : "medium",
        }),
      });
    },
    onSuccess: () => setDone(true),
    onError: (e: unknown) => setErr((e as Error)?.message === "req" ? s.req : s.err),
  });

  const close = () => { setOpen(false); setDone(false); setErr(""); setTitle(""); setDescription(""); setRating(4); setCategory("workflow"); };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        startIcon={<FeedbackIcon />}
        variant={variant === "fab" ? "contained" : "outlined"}
        sx={variant === "fab" ? { position: "fixed", bottom: 24, right: 24, zIndex: 1200, borderRadius: 6 } : undefined}
      >
        {s.open}
      </Button>

      <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>{s.title}</DialogTitle>
        <DialogContent>
          {done ? (
            <Alert severity="success" sx={{ mt: 1 }}>{s.done}</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">{s.intro}</Typography>
              <TextField select label={s.category} value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
                {s.cats.map(([v, label]) => <MenuItem key={v} value={v}>{label}</MenuItem>)}
              </TextField>
              <TextField label={s.titleField} value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
              <TextField label={s.desc} value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={3} fullWidth />
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5 }}>{s.rating}</Typography>
                <Rating value={rating} onChange={(_, v) => setRating(v)} size="large" />
              </Box>
              {err && <Alert severity="error">{err}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{done ? "OK" : s.cancel}</Button>
          {!done && <Button variant="contained" onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? s.sending : s.submit}</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}
