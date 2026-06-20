/**
 * PartnerApplicationForm.tsx
 *
 * Offentlig søknadsside for Creatorhub Partner Program (eksterne redigerings-
 * studioer). Tospråklig (no/en, engelsk default). POST → /api/editing/partner-applications.
 * Stilet i Creatorhubs branding (mørk #05060a + varm #ffba6c + Space Grotesk).
 */

import React, { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Button, Stack,
  FormControlLabel, Checkbox, Alert, CircularProgress, Chip, ThemeProvider, createTheme,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PaymentsIcon from "@mui/icons-material/Payments";
import StarIcon from "@mui/icons-material/Star";
import { apiRequest } from "@/lib/queryClient";

type Locale = "no" | "en";

const BRAND = {
  bg: "#05060a", ink: "#f6f2ea", cream: "#fff5e8", accent: "#ffba6c", accent2: "#d07838",
  muted: "rgba(246,242,234,0.66)", border: "rgba(255,255,255,0.12)", card: "rgba(255,255,255,0.04)",
  font: '"Space Grotesk", "Manrope", -apple-system, BlinkMacSystemFont, sans-serif',
};

const EEA = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO"]);
const COUNTRIES = [
  ["NO","Norge / Norway"],["GB","United Kingdom"],["US","United States"],["BD","Bangladesh"],
  ["IN","India"],["DE","Germany"],["SE","Sweden"],["DK","Denmark"],["PL","Poland"],["PH","Philippines"],
  ["PK","Pakistan"],["ES","Spain"],["FR","France"],["NL","Netherlands"],["__other","Other / Annet"],
];

const STR = {
  no: {
    title: "Bli en Creatorhub Verified Partner", sub: "Søknad for eksterne redigeringsselskaper",
    intro: "Bli en del av nettverket av verifiserte redigeringspartnere som leverer til fotografer og videografer i Creatorhub.",
    company: "Firmanavn", country: "Land", contact: "Kontaktperson", email: "E-post", phone: "Telefon",
    website: "Nettside", reg: "Org.nr (om aktuelt)", vat: "MVA-nr (om aktuelt)", team: "Antall i teamet",
    services: "Tjenester dere tilbyr (komma-separert)", pricing: "Prismodell", currency: "Valuta",
    priceRange: "Prisspenn (f.eks. 0.20–3.00 per bilde)", portfolio: "Portfolio-lenke", notes: "Kort om dere",
    consentContact: "Jeg samtykker til at Creatorhub kontakter meg om søknaden.",
    consentPrivacy: "Jeg har lest og godtar personvern-vilkårene.",
    submit: "Send søknad", sending: "Sender…",
    done: "Takk! Søknaden er mottatt. Vi tar kontakt på e-post når den er vurdert.",
    eea: "Utenfor EØS: SCC + Transfer Impact Assessment kreves under onboarding (håndteres senere).",
    err: "Noe gikk galt. Prøv igjen.", req: "Fyll ut påkrevde felt + samtykke.",
    perImage: "Per bilde", perHour: "Per time", perProject: "Per prosjekt", sub2: "Abonnement",
    why: [
      ["Motta oppdrag", "Bli funnet av fotografer og videografer som trenger redigerings-kapasitet."],
      ["Sikker filflyt", "Kryptert overføring via Creatorhub; SCC + TIA for ikke-EØS håndteres i onboarding."],
      ["Få betalt", "Automatisk utbetaling (PayPal/Stripe) når fotografen godkjenner leveransen."],
      ["Bygg rating", "Vi tar kvalitet på alvor — hver leveranse vurderes."],
    ],
  },
  en: {
    title: "Become a Creatorhub Verified Partner", sub: "Application for external editing studios",
    intro: "Join the network of verified editing partners delivering to photographers and videographers across Creatorhub.",
    company: "Company name", country: "Country", contact: "Contact person", email: "Email", phone: "Phone",
    website: "Website", reg: "Reg. number (if any)", vat: "VAT number (if any)", team: "Team size",
    services: "Services you offer (comma-separated)", pricing: "Pricing model", currency: "Currency",
    priceRange: "Price range (e.g. 0.20–3.00 per image)", portfolio: "Portfolio link", notes: "About you",
    consentContact: "I consent to Creatorhub contacting me about this application.",
    consentPrivacy: "I have read and accept the privacy terms.",
    submit: "Submit application", sending: "Sending…",
    done: "Thank you! Your application has been received. We'll email you once it's reviewed.",
    eea: "Outside the EEA: SCC + Transfer Impact Assessment are required during onboarding (handled later).",
    err: "Something went wrong. Please try again.", req: "Fill in required fields + consent.",
    perImage: "Per image", perHour: "Per hour", perProject: "Per project", sub2: "Subscription",
    why: [
      ["Receive jobs", "Get discovered by photographers and videographers who need editing capacity."],
      ["Secure file flow", "Encrypted transfer via Creatorhub; SCC + TIA for non-EEA handled in onboarding."],
      ["Get paid", "Automatic payout (PayPal/Stripe) once the filmmaker approves the delivery."],
      ["Build a rating", "We're serious about quality — every delivery is reviewed."],
    ],
  },
};
const WHY_ICONS = [EventAvailableIcon, CloudUploadIcon, PaymentsIcon, StarIcon];

export default function PartnerApplicationForm() {
  const [locale, setLocale] = useState<Locale>("en");
  const s = STR[locale];
  const theme = useMemo(() => createTheme({
    palette: {
      mode: "dark",
      primary: { main: BRAND.accent },
      background: { default: BRAND.bg, paper: "rgba(255,255,255,0.05)" },
      text: { primary: BRAND.ink, secondary: BRAND.muted },
    },
    typography: { fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, sans-serif' },
    shape: { borderRadius: 12 },
  }), []);

  const [f, setF] = useState({
    companyName: "", country: "GB", contactName: "", contactEmail: "", phone: "", website: "",
    registrationNumber: "", vatNumber: "", teamSize: "", services: "", pricingModel: "per_image",
    currency: "USD", priceRange: "", portfolioUrl: "", notes: "",
  });
  const [consentContact, setConsentContact] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const isForeign = f.country !== "NO";
  const nonEea = f.country !== "__other" && !EEA.has(f.country);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.companyName.trim() || !f.contactName.trim() || !f.contactEmail.includes("@") || !consentPrivacy) {
      setState("error"); setErrMsg(s.req); return;
    }
    setState("sending"); setErrMsg("");
    try {
      await apiRequest("/api/editing/partner-applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          country: f.country === "__other" ? "" : f.country,
          teamSize: f.teamSize ? Number(f.teamSize) : null,
          services: f.services.split(",").map((x) => x.trim()).filter(Boolean),
          consentContact, consentPrivacy: true, locale,
        }),
      });
      setState("done");
    } catch {
      setState("error"); setErrMsg(s.err);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{
        minHeight: "100vh",
        background: `radial-gradient(circle at 80% -5%, rgba(255,186,108,0.16), transparent 32%), radial-gradient(circle at 0% 40%, rgba(208,120,56,0.12), transparent 36%), ${BRAND.bg}`,
        color: BRAND.ink, py: { xs: 3, md: 6 }, px: 2,
      }}>
        <Box sx={{ maxWidth: 760, mx: "auto" }}>
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: "9px", display: "grid", placeItems: "center",
                background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accent2})`, color: "#0b0c10", fontWeight: 800 }}>C</Box>
              <Typography sx={{ fontWeight: 700, letterSpacing: ".5px", color: BRAND.cream }}>Creatorhub</Typography>
            </Box>
            <Button size="small" onClick={() => setLocale(locale === "en" ? "no" : "en")} sx={{ color: BRAND.muted }}>
              {locale === "en" ? "Norsk" : "English"}
            </Button>
          </Box>

          {state === "done" ? (
            <Card sx={{ mt: 4, bgcolor: BRAND.card, border: `1px solid ${BRAND.border}` }}>
              <CardContent sx={{ textAlign: "center", py: 6 }}>
                <VerifiedUserIcon sx={{ fontSize: 48, color: BRAND.accent, mb: 1 }} />
                <Typography sx={{ fontSize: 18 }}>{s.done}</Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Hero */}
              <Box sx={{ textAlign: "center", mt: { xs: 3, md: 5 }, mb: 4 }}>
                <Box sx={{ width: 76, height: 76, borderRadius: "50%", mx: "auto", mb: 2, display: "grid", placeItems: "center",
                  background: "radial-gradient(circle, rgba(255,186,108,0.18), transparent 70%)", border: `1px solid ${BRAND.accent}66` }}>
                  <VerifiedUserIcon sx={{ fontSize: 40, color: BRAND.accent }} />
                </Box>
                <Typography sx={{ fontFamily: BRAND.font, fontWeight: 800, fontSize: { xs: 28, md: 38 }, lineHeight: 1.1, color: BRAND.cream }}>
                  {s.title}
                </Typography>
                <Typography sx={{ color: BRAND.muted, fontSize: 15.5, mt: 1.5, maxWidth: 560, mx: "auto" }}>{s.intro}</Typography>
                <Chip size="small" icon={<VerifiedUserIcon sx={{ fontSize: 15 }} />}
                  label={s.sub}
                  sx={{ mt: 2, color: BRAND.accent, bgcolor: "rgba(255,186,108,0.12)", border: `1px solid ${BRAND.accent}44` }} />
              </Box>

              {/* Hvorfor bli partner — tillits-rad */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4,1fr)" }, gap: 1.5, mb: 4 }}>
                {s.why.map(([t, d], i) => {
                  const Icon = WHY_ICONS[i];
                  return (
                    <Box key={t} sx={{ p: 1.6, bgcolor: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 2.5 }}>
                      <Icon sx={{ color: BRAND.accent, fontSize: 22, mb: 0.5 }} />
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: BRAND.cream }}>{t}</Typography>
                      <Typography sx={{ color: BRAND.muted, fontSize: 12, mt: 0.3, lineHeight: 1.45 }}>{d}</Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* Skjema */}
              <Card sx={{ bgcolor: BRAND.card, border: `1px solid ${BRAND.border}`, backdropFilter: "blur(6px)" }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={2}>
                    <TextField label={s.company} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} required fullWidth />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField select label={s.country} value={f.country} onChange={(e) => set("country", e.target.value)} sx={{ flex: 1 }}>
                        {COUNTRIES.map(([c, label]) => <MenuItem key={c} value={c}>{label}</MenuItem>)}
                      </TextField>
                      <TextField label={s.team} type="number" value={f.teamSize} onChange={(e) => set("teamSize", e.target.value)} sx={{ width: 140 }} />
                    </Stack>
                    {nonEea && <Alert severity="info" sx={{ py: 0.5, bgcolor: "rgba(255,186,108,0.10)", color: BRAND.cream, border: `1px solid ${BRAND.accent}33`, "& .MuiAlert-icon": { color: BRAND.accent } }}>{s.eea}</Alert>}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField label={s.contact} value={f.contactName} onChange={(e) => set("contactName", e.target.value)} required sx={{ flex: 1 }} />
                      <TextField label={s.email} type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} required sx={{ flex: 1 }} />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField label={s.phone} value={f.phone} onChange={(e) => set("phone", e.target.value)} sx={{ flex: 1 }} />
                      <TextField label={s.website} value={f.website} onChange={(e) => set("website", e.target.value)} sx={{ flex: 1 }} placeholder="https://" />
                    </Stack>
                    {isForeign && (
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField label={s.reg} value={f.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} sx={{ flex: 1 }} />
                        <TextField label={s.vat} value={f.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} sx={{ flex: 1 }} />
                      </Stack>
                    )}
                    <TextField label={s.services} value={f.services} onChange={(e) => set("services", e.target.value)} fullWidth placeholder="clipping path, background removal, retouching…" />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField select label={s.pricing} value={f.pricingModel} onChange={(e) => set("pricingModel", e.target.value)} sx={{ flex: 1 }}>
                        <MenuItem value="per_image">{s.perImage}</MenuItem>
                        <MenuItem value="per_hour">{s.perHour}</MenuItem>
                        <MenuItem value="per_project">{s.perProject}</MenuItem>
                        <MenuItem value="subscription">{s.sub2}</MenuItem>
                      </TextField>
                      <TextField select label={s.currency} value={f.currency} onChange={(e) => set("currency", e.target.value)} sx={{ width: 120 }}>
                        {["USD","GBP","EUR","NOK","SEK","DKK"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <TextField label={s.priceRange} value={f.priceRange} onChange={(e) => set("priceRange", e.target.value)} fullWidth />
                    <TextField label={s.portfolio} value={f.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} fullWidth placeholder="https://" />
                    <TextField label={s.notes} value={f.notes} onChange={(e) => set("notes", e.target.value)} multiline minRows={2} fullWidth />
                    <FormControlLabel control={<Checkbox checked={consentContact} onChange={(e) => setConsentContact(e.target.checked)} />} label={<Typography variant="body2" sx={{ color: BRAND.muted }}>{s.consentContact}</Typography>} />
                    <FormControlLabel control={<Checkbox checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />} label={<Typography variant="body2" sx={{ color: BRAND.muted }}>{s.consentPrivacy} *</Typography>} />
                    {state === "error" && <Alert severity="error">{errMsg}</Alert>}
                    <Button variant="contained" size="large" onClick={submit} disabled={state === "sending"}
                      startIcon={state === "sending" ? <CircularProgress size={18} color="inherit" /> : undefined}
                      sx={{ background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accent2})`, color: "#0b0c10", fontWeight: 700, py: 1.2,
                        boxShadow: "0 4px 16px rgba(255,186,108,0.3)", "&:hover": { opacity: 0.92, background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accent2})` } }}>
                      {state === "sending" ? s.sending : s.submit}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
