/**
 * Stripe-konfigurasjonen, lest tilbake fra Stripe.
 *
 * Forskjellen på «variabelen er satt i Render» og «vi fakturerer riktig
 * beløp» er hele poenget med dette kortet. En pris-ID kan peke på en
 * deaktivert pris, feil valuta, eller et månedsbeløp der vi tror vi selger
 * et år — og alt det ser du bare ved å spørre Stripe.
 *
 * Grønt kort betyr at du kan slutte å tenke på det. Derfor kollapser det
 * seg selv når alt er i orden.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, CircularProgress, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { apiRequest } from "@/lib/queryClient";

interface Sjekk {
  label: string;
  envName: string;
  price_id: string | null;
  source: "env" | "fallback" | "mangler";
  stripe: {
    active: boolean;
    currency: string;
    unit_amount: number | null;
    recurring_interval: string | null;
    product_name: string | null;
  } | null;
  problems: string[];
}

function beløp(s: Sjekk): string {
  if (!s.stripe || s.stripe.unit_amount == null) return "—";
  const kr = s.stripe.unit_amount / 100;
  return `${kr.toLocaleString("nb-NO")} ${s.stripe.currency.toUpperCase()}` +
    (s.stripe.recurring_interval ? ` / ${s.stripe.recurring_interval === "year" ? "år" : "mnd"}` : "");
}

export function StripeConfigCard() {
  const [åpen, setÅpen] = useState(false);
  const { data, isLoading, error } = useQuery<{
    ok: boolean; stripe_available: boolean; checks: Sjekk[];
  }>({
    queryKey: ["leadgrid-stripe-konfig"],
    queryFn: () => apiRequest("/api/leadgrid/billing/konfigurasjon"),
    retry: false,
  });

  if (isLoading) return <CircularProgress size={20} />;
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;
  if (!data) return null;

  const avvik = data.checks.filter((c) => c.problems.length > 0);

  return (
    <Box sx={{ mb: 3 }}>
      {!data.stripe_available && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Stripe-nøkkelen er ikke konfigurert på dette miljøet. Listen viser hva
          vi ville brukt, ikke hva Stripe sier.
        </Alert>
      )}
      <Alert
        severity={data.ok ? "success" : "warning"}
        icon={data.ok ? <CheckCircleIcon /> : undefined}
        action={
          <Button size="small" onClick={() => setÅpen((v) => !v)}>
            {åpen ? "Skjul" : "Vis alle"}
          </Button>
        }
      >
        {data.ok
          ? "Stripe-prisene stemmer med det Render er satt opp med."
          : `${avvik.length} av ${data.checks.length} priser må ryddes.`}
      </Alert>

      {(åpen || !data.ok) && (
        <Table size="small" sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>Pris</TableCell>
              <TableCell>Render-variabel</TableCell>
              <TableCell>Beløp i Stripe</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(åpen ? data.checks : avvik).map((c) => (
              <TableRow key={c.envName}>
                <TableCell>
                  {c.label}
                  {c.stripe?.product_name && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {c.stripe.product_name}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                    {c.envName}
                  </Typography>
                  <br />
                  <Chip
                    size="small"
                    label={c.source === "env" ? "fra Render" : c.source === "fallback" ? "innebygd verdi" : "mangler"}
                    color={c.source === "env" ? "success" : "warning"}
                    variant={c.source === "env" ? "filled" : "outlined"}
                  />
                </TableCell>
                <TableCell>{beløp(c)}</TableCell>
                <TableCell>
                  {c.problems.length === 0 ? (
                    <Chip size="small" color="success" label="OK" />
                  ) : (
                    <Stack spacing={0.5}>
                      {c.problems.map((p) => (
                        <Typography key={p} variant="caption" color="warning.main">{p}</Typography>
                      ))}
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

export default StripeConfigCard;
