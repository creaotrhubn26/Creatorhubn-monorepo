/**
 * VendorPrototypeFeedbackTool.tsx
 *
 * Eget prototype-feedback-verktøy for redigeringspartnere (separat fra det generelle
 * PrototypeFeedbackTool). Tospråklig (no/en). Spør om vendor-spesifikke områder
 * (arbeidsflyt, filoverføring, utbetaling, synlighet). Lagres i prototype_feedback
 * tagget dashboardType='editing-vendor' så admin kan filtrere.
 */

import React, { useState, useEffect } from "react";
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
  // Lar en ekstern guide åpne verktøyet interaktivt: når tokenet øker, åpner
  // dialogen seg. `guided` viser i tillegg en steg-for-steg bruksanvisning inni.
  autoOpenToken?: number;
  guided?: boolean;
}

const STR = {
  no: {
    open: "Gi tilbakemelding", title: "Tilbakemelding fra partner",
    intro: "Du er prototype-tester — innspillene dine former produktet. Hva fungerer, og hva mangler?",
    category: "Område", titleField: "Tittel", desc: "Beskriv (hva skjedde / hva ønsker du)",
    rating: "Hvor fornøyd er du totalt?", cancel: "Avbryt", submit: "Send", sending: "Sender…",
    done: "Takk! Tilbakemeldingen er mottatt.", err: "Noe gikk galt. Prøv igjen.", req: "Fyll ut tittel + beskrivelse.",
    guideTitle: "Slik gir du tilbakemelding (30 sekunder)",
    guideSteps: [
      "Velg Område — hva gjelder det? (arbeidsflyt, filer, utbetaling, synlighet, bug …)",
      "Tittel — én linje som oppsummerer.",
      "Beskriv — hva skjedde, eller hva ønsker du? Vær gjerne konkret.",
      "Vurdering — totalinntrykket ditt akkurat nå.",
      "Send — vi leser alt, og du ser status under «Mine tilbakemeldinger».",
    ],
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
    guideTitle: "How to give feedback (30 seconds)",
    guideSteps: [
      "Pick an Area — what's it about? (workflow, files, payout, discovery, bug …)",
      "Title — one line that sums it up.",
      "Describe — what happened, or what you'd like? Be concrete.",
      "Rating — your overall impression right now.",
      "Send — we read everything, and you'll see the status under “My feedback”.",
    ],
    cats: [
      ["workflow", "Editing workflow"], ["files", "File transfer & storage"],
      ["payout", "Payout & fees"], ["discovery", "Discovery & getting jobs"],
      ["bug", "Bug"], ["feature", "Feature request"], ["general", "General"],
    ],
  },
};

export default function VendorPrototypeFeedbackTool({ locale = "no", vendorName, userEmail, userId, variant = "button", autoOpenToken, guided }: Props) {
  const s = STR[locale === "en" ? "en" : "no"];
  const [open, setOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [category, setCategory] = useState("workflow");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState<number | null>(4);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // Ekstern guide kan åpne verktøyet (token øker) — vis bruksanvisningen når
  // åpningen er guidet.
  useEffect(() => {
    if (autoOpenToken && autoOpenToken > 0) {
      setOpen(true);
      setShowGuide(!!guided);
    }
    // bevisst kun avhengig av tokenet — vi vil reagere på endring, ikke på guided
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenToken]);

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

  const close = () => { setOpen(false); setShowGuide(false); setDone(false); setErr(""); setTitle(""); setDescription(""); setRating(4); setCategory("workflow"); };

  return (
    <>
      <Button
        onClick={() => { setShowGuide(false); setOpen(true); }}
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
              {showGuide ? (
                <Alert severity="info" icon={false} sx={{ "& ol": { m: 0, pl: 2.5 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>{s.guideTitle}</Typography>
                  <ol>
                    {s.guideSteps.map((step, i) => (
                      <li key={i}><Typography variant="body2" component="span">{step}</Typography></li>
                    ))}
                  </ol>
                </Alert>
              ) : null}
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
