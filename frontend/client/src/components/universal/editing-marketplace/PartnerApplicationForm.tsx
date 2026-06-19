/**
 * PartnerApplicationForm.tsx
 *
 * Offentlig søknadsskjema for Creatorhub Partner Program (eksterne redigerings-
 * studioer). Tospråklig (no/en, engelsk default). POST → /api/editing/partner-applications.
 * is_foreign/SCC+TIA-notis er server-derivert; her vises kun en lese-notis for ikke-EØS.
 */

import React, { useState } from "react";
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Button, Stack,
  FormControlLabel, Checkbox, Alert, CircularProgress, Chip,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { apiRequest } from "@/lib/queryClient";

type Locale = "no" | "en";

const EEA = new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO"]);
const COUNTRIES = [
  ["NO","Norge / Norway"],["GB","United Kingdom"],["US","United States"],["BD","Bangladesh"],
  ["IN","India"],["DE","Germany"],["SE","Sweden"],["DK","Denmark"],["PL","Poland"],["PH","Philippines"],
  ["PK","Pakistan"],["ES","Spain"],["FR","France"],["NL","Netherlands"],["__other","Other / Annet"],
];

const STR = {
  no: {
    title: "Bli en Creatorhub Verified Partner", sub: "Søknad for eksterne redigeringsselskaper",
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
  },
  en: {
    title: "Become a Creatorhub Verified Partner", sub: "Application for external editing studios",
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
  },
};

export default function PartnerApplicationForm() {
  const [locale, setLocale] = useState<Locale>("en");
  const s = STR[locale];
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

  if (state === "done") {
    return (
      <Box sx={{ maxWidth: 560, mx: "auto", p: 3 }}>
        <Alert severity="success" icon={<VerifiedUserIcon />}>{s.done}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{s.title}</Typography>
          <Typography variant="body2" color="text.secondary">{s.sub}</Typography>
        </Box>
        <Button size="small" onClick={() => setLocale(locale === "en" ? "no" : "en")}>
          {locale === "en" ? "Norsk" : "English"}
        </Button>
      </Box>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <TextField label={s.company} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} required fullWidth />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select label={s.country} value={f.country} onChange={(e) => set("country", e.target.value)} sx={{ flex: 1 }}>
                {COUNTRIES.map(([c, label]) => <MenuItem key={c} value={c}>{label}</MenuItem>)}
              </TextField>
              <TextField label={s.team} type="number" value={f.teamSize} onChange={(e) => set("teamSize", e.target.value)} sx={{ width: 140 }} />
            </Stack>
            {nonEea && <Alert severity="info" sx={{ py: 0.5 }}>{s.eea}</Alert>}
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
            <TextField label={s.services} value={f.services} onChange={(e) => set("services", e.target.value)} fullWidth
              placeholder="clipping path, background removal, retouching…" />
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
            <FormControlLabel control={<Checkbox checked={consentContact} onChange={(e) => setConsentContact(e.target.checked)} />} label={<Typography variant="body2">{s.consentContact}</Typography>} />
            <FormControlLabel control={<Checkbox checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />} label={<Typography variant="body2">{s.consentPrivacy} *</Typography>} />
            {state === "error" && <Alert severity="error">{errMsg}</Alert>}
            <Button variant="contained" size="large" onClick={submit} disabled={state === "sending"}
              startIcon={state === "sending" ? <CircularProgress size={18} color="inherit" /> : undefined}>
              {state === "sending" ? s.sending : s.submit}
            </Button>
            <Chip size="small" variant="outlined" icon={<VerifiedUserIcon sx={{ fontSize: 16 }} />}
              label={isForeign ? "International vendor — extra GDPR controls apply" : "Norsk leverandør"} sx={{ alignSelf: "flex-start" }} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
