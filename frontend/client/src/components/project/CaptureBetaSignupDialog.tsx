/**
 * CaptureBetaSignupDialog.tsx
 *
 * Påmelding til iPad Capture-app beta (TestFlight). Samler navn + e-post + enhet,
 * sender til /api/capture-beta/signup.
 */

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  Alert,
} from "@mui/material";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export default function CaptureBetaSignupDialog({ open, onClose, defaultEmail }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState(defaultEmail || "");
  const [device, setDevice] = useState("");
  const [done, setDone] = useState(false);

  const signup = useMutation({
    mutationFn: () =>
      apiRequest("/api/capture-beta/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, device, note: "Capture iPad beta" }),
      }),
    onSuccess: () => setDone(true),
  });

  const close = () => {
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle>Test Capture-appen (iPad)</DialogTitle>
      <DialogContent dividers>
        {done ? (
          <Alert severity="success">
            Takk! Du er meldt på. Vi sender en TestFlight-invitasjon til {email} så snart appen er klar.
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              iPad Capture-appen tar backup og monitorering rett fra settet. Meld deg på beta-testingen
              (TestFlight) — vi gir deg beskjed når den er klar.
            </Typography>
            <TextField label="Navn" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth />
            <TextField
              label="E-post (Apple-ID til TestFlight)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              fullWidth
              required
            />
            <TextField
              label="iPad-modell (valgfritt)"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              placeholder="f.eks. iPad Pro 11"
              size="small"
              fullWidth
            />
            {signup.isError && <Alert severity="error">Kunne ikke melde på. Prøv igjen.</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{done ? "Lukk" : "Avbryt"}</Button>
        {!done && (
          <Button
            variant="contained"
            disabled={!email.includes("@") || signup.isPending}
            onClick={() => signup.mutate()}
          >
            {signup.isPending ? "Melder på…" : "Meld meg på"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
