/**
 * VendorNdaCard.tsx
 *
 * Lar en vendor registrere sin EGEN NDA (lov-valg + lenke) — f.eks. utenlandske
 * studioer med egen lov-valgt NDA (Orbit: tysk lov). Vår DPA/NDA er fortsatt den
 * gjeldende avtalen; dette spores som motpart-dokument.
 */

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, Typography, TextField, Button, Stack, Alert } from "@mui/material";
import { apiRequest } from "@/lib/queryClient";

type Locale = "no" | "en";

export default function VendorNdaCard({ locale = "no" }: { locale?: Locale }) {
  const en = locale === "en";
  const [governingLaw, setGoverningLaw] = useState("");
  const [url, setUrl] = useState("");
  const [done, setDone] = useState(false);

  const save = useMutation({
    mutationFn: () => apiRequest("/api/editing/vendor/nda", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ governingLaw, url }),
    }),
    onSuccess: () => setDone(true),
  });

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {en ? "Your own NDA (optional)" : "Din egen NDA (valgfritt)"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {en
            ? "If your company has its own NDA, register it here. Creatorhub's DPA/NDA remains the governing agreement; yours is tracked as a counterpart document for legal review."
            : "Har bedriften din en egen NDA, registrer den her. Creatorhubs DPA/NDA er fortsatt gjeldende avtale; din spores som motpart-dokument for juridisk gjennomgang."}
        </Typography>
        {done ? (
          <Alert severity="success">{en ? "Saved — thank you." : "Lagret — takk."}</Alert>
        ) : (
          <Stack spacing={2}>
            <TextField label={en ? "Governing law (e.g. Germany)" : "Lov-valg (f.eks. Tyskland)"} value={governingLaw} onChange={(e) => setGoverningLaw(e.target.value)} size="small" fullWidth />
            <TextField label={en ? "Link to your NDA (https://)" : "Lenke til din NDA (https://)"} value={url} onChange={(e) => setUrl(e.target.value)} size="small" fullWidth placeholder="https://" />
            <Button variant="outlined" onClick={() => save.mutate()} disabled={save.isPending} sx={{ alignSelf: "flex-start" }}>
              {save.isPending ? (en ? "Saving…" : "Lagrer…") : (en ? "Register NDA" : "Registrer NDA")}
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
