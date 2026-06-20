/**
 * VendorPayoutCard.tsx
 *
 * Lar en redigeringspartner registrere HVORDAN de skal få betalt:
 *   - PayPal (payout-e-post) → PayPal Payouts
 *   - Stripe Connect (onboarding-lenke) → Stripe Transfer
 *   - Bank/manuell
 * Setter payment_connected (verifiserings-pilaren) når en metode er konfigurert.
 * Tospråklig (no/en). Brukes i vendor-workspace.
 */

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, Typography, RadioGroup, FormControlLabel, Radio, TextField,
  Button, Stack, Alert, Chip, CircularProgress, Box,
} from "@mui/material";
import PaymentsIcon from "@mui/icons-material/Payments";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { apiRequest } from "@/lib/queryClient";

type Locale = "no" | "en";

interface PayoutStatus { method: string; paypalEmailMasked: string | null; paymentConnected: boolean; stripeConnected: boolean; stripeAvailable: boolean; }

const STR = {
  no: {
    title: "Utbetaling", intro: "Velg hvordan du vil få betalt. Utbetaling frigis automatisk når fotografen godkjenner leveransen.",
    connected: "Betaling tilkoblet", notConnected: "Ikke konfigurert",
    paypal: "PayPal", stripe: "Stripe Connect (bankkonto)", bank: "Bank / manuell",
    paypalEmail: "PayPal-e-post (payout)", paypalHelp: "E-posten knyttet til PayPal-kontoen din.",
    stripeHelp: "Du sendes til Stripe for sikker onboarding (bankkonto + ID).",
    bankHelp: "Manuell utbetaling — vi avtaler detaljer direkte.",
    save: "Lagre", connectStripe: "Koble til med Stripe", saving: "Lagrer…", saved: "Lagret!",
    invalidEmail: "Ugyldig e-post.", err: "Noe gikk galt.", current: "Nåværende",
    stripeStarted: "Sender deg til Stripe…", checking: "Sjekker status…",
  },
  en: {
    title: "Payout", intro: "Choose how you want to get paid. Payout is released automatically once the photographer approves the delivery.",
    connected: "Payments connected", notConnected: "Not configured",
    paypal: "PayPal", stripe: "Stripe Connect (bank account)", bank: "Bank / manual",
    paypalEmail: "PayPal email (payout)", paypalHelp: "The email tied to your PayPal account.",
    stripeHelp: "You'll be sent to Stripe for secure onboarding (bank account + ID).",
    bankHelp: "Manual payout — we'll arrange details directly.",
    save: "Save", connectStripe: "Connect with Stripe", saving: "Saving…", saved: "Saved!",
    invalidEmail: "Invalid email.", err: "Something went wrong.", current: "Current",
    stripeStarted: "Sending you to Stripe…", checking: "Checking status…",
  },
};

export default function VendorPayoutCard({ locale = "no" }: { locale?: Locale }) {
  const s = STR[locale === "en" ? "en" : "no"];
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<PayoutStatus>({
    queryKey: ["/api/editing/vendor/payout"],
    queryFn: () => apiRequest("/api/editing/vendor/payout"),
  });

  const [method, setMethod] = useState<string>("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [msg, setMsg] = useState<{ sev: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => { if (data?.method) setMethod(data.method); }, [data?.method]);

  // Retur fra Stripe-onboarding (?payout=done) → sjekk status.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("payout") === "done") {
      setMsg({ sev: "info", text: s.checking });
      apiRequest("/api/editing/vendor/payout/sync-stripe", { method: "POST" })
        .then(() => { qc.invalidateQueries({ queryKey: ["/api/editing/vendor/payout"] }); qc.invalidateQueries({ queryKey: ["/api/editing/vendor/me"] }); setMsg(null); })
        .catch(() => setMsg(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { method };
      if (method === "paypal") body.paypalEmail = paypalEmail;
      if (method === "stripe_connect") body.origin = window.location.origin;
      return apiRequest("/api/editing/vendor/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as Promise<{ ok?: boolean; url?: string }>;
    },
    onSuccess: (r) => {
      if (method === "stripe_connect" && r?.url) { setMsg({ sev: "info", text: s.stripeStarted }); window.location.href = r.url; return; }
      setMsg({ sev: "success", text: s.saved });
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/payout"] });
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/me"] });
    },
    onError: (e: unknown) => setMsg({ sev: "error", text: (e as Error)?.message?.includes("epost") ? s.invalidEmail : s.err }),
  });

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PaymentsIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{s.title}</Typography>
          </Stack>
          {data?.paymentConnected
            ? <Chip size="small" color="success" icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} label={s.connected} />
            : <Chip size="small" variant="outlined" label={s.notConnected} />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{s.intro}</Typography>

        {isLoading ? <CircularProgress size={22} /> : (
          <>
            {data?.paymentConnected && data?.method === "paypal" && data?.paypalEmailMasked && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>{s.current}: PayPal · {data.paypalEmailMasked}</Typography>
            )}
            <RadioGroup value={method} onChange={(e) => setMethod(e.target.value)}>
              <FormControlLabel value="paypal" control={<Radio />} label={s.paypal} />
              {method === "paypal" && (
                <Box sx={{ pl: 4, pb: 1 }}>
                  <TextField size="small" fullWidth label={s.paypalEmail} value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} helperText={s.paypalHelp} sx={{ maxWidth: 380 }} />
                </Box>
              )}
              {data?.stripeAvailable && <FormControlLabel value="stripe_connect" control={<Radio />} label={s.stripe} />}
              {method === "stripe_connect" && <Typography variant="caption" color="text.secondary" sx={{ pl: 4, pb: 1, display: "block" }}>{s.stripeHelp}</Typography>}
              <FormControlLabel value="bank" control={<Radio />} label={s.bank} />
              {method === "bank" && <Typography variant="caption" color="text.secondary" sx={{ pl: 4, pb: 1, display: "block" }}>{s.bankHelp}</Typography>}
            </RadioGroup>

            {msg && <Alert severity={msg.sev} sx={{ mt: 1, mb: 1 }}>{msg.text}</Alert>}

            <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending || (method === "paypal" && !paypalEmail)} sx={{ mt: 1 }}>
              {save.isPending ? s.saving : method === "stripe_connect" ? s.connectStripe : s.save}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
