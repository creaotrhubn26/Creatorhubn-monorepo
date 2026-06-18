/**
 * leadgrid-developer-application.tsx
 *
 * Offentlig søknadsskjema på /leadgrid/utviklere/soknad.
 * Ingen TRR-konto kreves.
 */

import React, { useEffect, useState } from "react";
import {
  Box, Container, Stack, Typography, Card, CardContent, Button,
  TextField, Checkbox, FormControlLabel, Alert, CircularProgress,
} from "@mui/material";
import HandshakeIcon from "@mui/icons-material/Handshake";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const PALETTE = {
  bg: "#0a0512", accent: "#a78bfa", text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.72)", textFaint: "rgba(244,240,255,0.45)",
};

export default function LeadgridDeveloperApplicationPage() {
  const [submitted, setSubmitted] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [website, setWebsite] = useState("");
  const [useCase, setUseCase] = useState("");
  const [integrationDescription, setIntegrationDescription] = useState("");
  const [expectedMonthlyApiCalls, setExpectedMonthlyApiCalls] = useState<number | "">("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState<{ version: string; body_md: string } | null>(null);

  useEffect(() => {
    document.title = "Leadgrid Developer — Søk om API-tilgang";
    fetch("/api/leadgrid/partner-terms").then((r) => r.ok ? r.json() : null)
      .then((d) => setTerms(d));
  }, []);

  const valid = fullName.length >= 2 && email.includes("@") && email.includes(".")
              && organizationName.length >= 2 && useCase.length >= 20 && agreedToTerms;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/leadgrid/developer-application", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          organizationName: organizationName.trim(),
          website: website.trim() || undefined,
          useCase: useCase.trim(),
          integrationDescription: integrationDescription.trim() || undefined,
          expectedMonthlyApiCalls: expectedMonthlyApiCalls || undefined,
          agreedToTerms,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Noe gikk galt");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
    setSubmitting(false);
  }

  const inputSx = {
    "& .MuiOutlinedInput-root": { color: "#fff",
      "& fieldset": { borderColor: "rgba(255,255,255,0.15)" } },
    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.6)" },
  };

  if (submitted) {
    return (
      <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh",
                  display: "flex", alignItems: "center", py: 8 }}>
        <Container maxWidth="sm">
          <Card sx={{ bgcolor: "rgba(155,225,93,0.10)", border: "1px solid rgba(155,225,93,0.30)" }}>
            <CardContent sx={{ p: 5, textAlign: "center" }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: "#9be15d", mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: "#fff", mb: 2 }}>
                Søknad mottatt
              </Typography>
              <Typography sx={{ color: PALETTE.textMuted, mb: 3 }}>
                Vi har sendt en bekreftelse til <strong style={{ color: "#fff" }}>{email}</strong>.
                Vi svarer innen 3 virkedager.
              </Typography>
              <Button variant="contained" href="/leadgrid/utviklere"
                      sx={{ bgcolor: PALETTE.accent, color: "#0a0512", fontWeight: 700 }}>
                Les developer-dokumentasjonen
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: PALETTE.bg, color: PALETTE.text, minHeight: "100vh", py: 8,
                fontFamily: '-apple-system, "SF Pro Display", "Inter", sans-serif' }}>
      <Container maxWidth="md">
        <Stack alignItems="center" spacing={2} mb={5}>
          <Box sx={{ p: 2, borderRadius: 3, bgcolor: "rgba(167,139,250,0.10)" }}>
            <HandshakeIcon sx={{ fontSize: 48, color: PALETTE.accent }} />
          </Box>
          <Typography variant="overline" sx={{ color: PALETTE.accent, letterSpacing: 2 }}>
            Leadgrid Developer
          </Typography>
          <Typography variant="h3" fontWeight={800} textAlign="center">
            Søk om API-tilgang
          </Typography>
          <Typography variant="body1" textAlign="center" sx={{ color: PALETTE.textMuted, maxWidth: 560 }}>
            Bygger du noe som vil integrere med Leadgrid? Søk her og vi svarer
            innen 3 virkedager med en API-key + dokumentasjon.
          </Typography>
        </Stack>

        <Card sx={{ bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Stack spacing={3}>
              {error && <Alert severity="error">{error}</Alert>}

              <TextField fullWidth required label="Ditt navn" value={fullName}
                         onChange={(e) => setFullName(e.target.value)}
                         sx={inputSx} placeholder="F.eks. Ola Nordmann" />

              <TextField fullWidth required type="email" label="E-post" value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         sx={inputSx} placeholder="ola@bedrift.no"
                         helperText="Vi sender API-keyen og oppdateringer hit."
                         FormHelperTextProps={{ sx: { color: PALETTE.textFaint } }} />

              <TextField fullWidth required label="Organisasjon"
                         value={organizationName}
                         onChange={(e) => setOrganizationName(e.target.value)}
                         sx={inputSx} placeholder="Selskapsnavn eller prosjekt" />

              <TextField fullWidth label="Website (valgfritt)" value={website}
                         onChange={(e) => setWebsite(e.target.value)}
                         sx={inputSx} placeholder="https://dinbedrift.no" />

              <TextField fullWidth required multiline rows={4}
                         label="Hva vil dere bruke API-en til?"
                         value={useCase} onChange={(e) => setUseCase(e.target.value)}
                         sx={inputSx}
                         placeholder="F.eks. 'Vi vil synkronisere våre eksisterende kunder fra HubSpot inn i Leadgrid, og motta webhooks når Leadgrid finner nye behov.'"
                         helperText={`${useCase.length}/2000 tegn (min 20)`}
                         FormHelperTextProps={{ sx: { color: PALETTE.textFaint } }} />

              <TextField fullWidth multiline rows={3}
                         label="Hvilken integrasjon bygger dere? (valgfritt)"
                         value={integrationDescription}
                         onChange={(e) => setIntegrationDescription(e.target.value)}
                         sx={inputSx}
                         placeholder="F.eks. 'CRM-toveis-sync med Salesforce'" />

              <TextField fullWidth type="number"
                         label="Forventet API-volum/mnd (valgfritt)"
                         value={expectedMonthlyApiCalls}
                         onChange={(e) => setExpectedMonthlyApiCalls(
                           e.target.value === "" ? "" : Number(e.target.value),
                         )}
                         sx={inputSx} placeholder="F.eks. 10000" />

              {terms && (
                <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2,
                            maxHeight: 200, overflow: "auto" }}>
                  <Typography variant="caption" sx={{ color: PALETTE.textFaint, display: "block", mb: 1 }}>
                    Vilkår {terms.version}
                  </Typography>
                  <Typography variant="body2" sx={{ color: PALETTE.textMuted,
                              whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>
                    {terms.body_md.substring(0, 1200)}
                    {terms.body_md.length > 1200 && "…"}
                  </Typography>
                </Box>
              )}

              <FormControlLabel
                control={
                  <Checkbox checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            sx={{ color: "rgba(255,255,255,0.4)",
                                  "&.Mui-checked": { color: PALETTE.accent } }} />
                }
                label={
                  <Typography variant="body2">
                    Jeg har lest og godtar partnerskaps-vilkårene
                  </Typography>
                }
              />

              <Button variant="contained" size="large" fullWidth
                      disabled={!valid || submitting} onClick={submit}
                      sx={{ bgcolor: PALETTE.accent, color: "#0a0512",
                            fontWeight: 700, py: 1.5,
                            "&:hover": { bgcolor: "#9171e6" } }}>
                {submitting ? <CircularProgress size={24} sx={{ color: "#0a0512" }} /> : "Send søknad"}
              </Button>

              <Typography variant="caption" sx={{ color: PALETTE.textFaint, textAlign: "center" }}>
                Spørsmål? Send e-post til{" "}
                <a href="mailto:daniel@creatorhubn.com" style={{ color: PALETTE.accent }}>
                  daniel@creatorhubn.com
                </a>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
