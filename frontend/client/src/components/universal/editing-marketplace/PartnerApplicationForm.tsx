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
  FormControlLabel, Checkbox, Alert, CircularProgress, Chip, ThemeProvider, createTheme, Autocomplete,
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

// Landskode (dial code) per land — settes automatisk på telefon ved landsvalg.
const DIAL: Record<string, string> = {
  NO: "+47", GB: "+44", US: "+1", BD: "+880", IN: "+91", DE: "+49", SE: "+46",
  DK: "+45", PL: "+48", PH: "+63", PK: "+92", ES: "+34", FR: "+33", NL: "+31",
};

interface BrregCompany { navn: string; organisasjonsnummer: string; }

// Vanlige redigerings-tjenester — ett-trykks-chips (verdi = engelsk kanonisk).
const SERVICE_OPTIONS: Array<{ v: string; no: string; en: string }> = [
  { v: "Clipping path", no: "Clipping path", en: "Clipping path" },
  { v: "Background removal", no: "Bakgrunnsfjerning", en: "Background removal" },
  { v: "Retouching", no: "Retusjering", en: "Retouching" },
  { v: "Ghost mannequin", no: "Ghost mannequin", en: "Ghost mannequin" },
  { v: "Color grading", no: "Color grading", en: "Color grading" },
  { v: "Color correction", no: "Fargekorreksjon", en: "Color correction" },
  { v: "Shadow/reflection", no: "Skygge/refleksjon", en: "Shadow/reflection" },
  { v: "Dust/scratch removal", no: "Støv/riper-fjerning", en: "Dust/scratch removal" },
  { v: "Jewelry retouching", no: "Smykke-retusjering", en: "Jewelry retouching" },
  { v: "Video editing", no: "Video-redigering", en: "Video editing" },
];

// Valuta per land — settes automatisk ved landsvalg (samme som katalogen).
function currencyForCountry(cc: string): string {
  const c = (cc || "").toUpperCase();
  if (c === "NO") return "NOK"; if (c === "GB" || c === "UK") return "GBP";
  if (c === "US") return "USD"; if (c === "SE") return "SEK"; if (c === "DK") return "DKK";
  const eea = ["AT","BE","BG","HR","CY","CZ","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","IS","LI"];
  return eea.includes(c) ? "EUR" : "USD";
}

export default function PartnerApplicationForm() {
  const [locale, setLocale] = useState<Locale>("en");
  const s = STR[locale];
  const theme = useMemo(() => createTheme({
    palette: {
      mode: "dark",
      primary: { main: BRAND.accent },
      background: { default: BRAND.bg, paper: "#101218" },
      text: { primary: BRAND.ink, secondary: BRAND.muted },
    },
    typography: { fontFamily: '"Manrope", -apple-system, BlinkMacSystemFont, sans-serif' },
    shape: { borderRadius: 12 },
    components: {
      // Select-/meny-dropdowns MÅ være ugjennomsiktige (ellers ser man feltene bak).
      MuiMenu: { styleOverrides: { paper: { backgroundColor: "#101218", backgroundImage: "none", border: "1px solid rgba(255,255,255,0.14)" } } },
      MuiPopover: { styleOverrides: { paper: { backgroundColor: "#101218", backgroundImage: "none" } } },
    },
  }), []);

  const [f, setF] = useState({
    companyName: "", country: "GB", contactName: "", contactEmail: "", phone: "+44", website: "",
    registrationNumber: "", vatNumber: "", teamSize: "", services: "", pricingModel: "per_image",
    currency: "USD", priceRange: "", portfolioUrl: "", notes: "",
  });
  const [consentContact, setConsentContact] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [dupMsg, setDupMsg] = useState("");

  const isForeign = f.country !== "NO";
  const nonEea = f.country !== "__other" && !EEA.has(f.country);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  // #9 inline-validering
  const emailValid = !f.contactEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contactEmail);
  const urlOk = (u: string) => !u || /^https?:\/\//i.test(u);
  // #10 landsflagg-emoji fra ISO-landkode
  const flagEmoji = (cc: string) => cc && cc.length === 2
    ? String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
    : "🏳️";
  const selectedServices = f.services.split(",").map((x) => x.trim()).filter(Boolean);

  // Brreg-søk (kun Norge): søk på bedriftsnavn → autofyll navn + org.nr.
  const [brregOptions, setBrregOptions] = useState<BrregCompany[]>([]);
  const [brregLoading, setBrregLoading] = useState(false);
  const brregTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBrreg = (term: string) => {
    if (brregTimer.current) clearTimeout(brregTimer.current);
    if (!term || term.trim().length < 2) { setBrregOptions([]); return; }
    brregTimer.current = setTimeout(async () => {
      setBrregLoading(true);
      try {
        const r = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(term.trim())}*&size=10`);
        const j = await r.json();
        const list = j?._embedded?.enheter || [];
        setBrregOptions(list.map((e: { navn: string; organisasjonsnummer: string }) => ({ navn: e.navn, organisasjonsnummer: e.organisasjonsnummer })));
      } catch { setBrregOptions([]); } finally { setBrregLoading(false); }
    }, 300);
  };

  // Landsvalg: sett landskode på telefon automatisk + nullstill org.nr for ikke-Norge.
  const onCountryChange = (cc: string) => {
    setF((p) => {
      const prevDial = DIAL[p.country] || "";
      const dial = DIAL[cc] || "";
      const phone = !p.phone.trim() || p.phone.trim() === prevDial ? dial : p.phone;
      return { ...p, country: cc, phone, currency: currencyForCountry(cc), registrationNumber: cc === "NO" ? p.registrationNumber : "" };
    });
    setBrregOptions([]);
  };

  // #8 Gjenopprett kladd ved åpning; ellers auto-detekter land fra nettleser-locale.
  React.useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem("partner_application_draft") || "null");
      if (draft && typeof draft === "object" && draft.companyName !== undefined) { setF((p) => ({ ...p, ...draft })); return; }
    } catch { /* ignore */ }
    // Forhåndsutfyll fra invitasjons-lenke (?email=&company=&name=).
    try {
      const q = new URLSearchParams(window.location.search);
      const qEmail = q.get("email"); const qCompany = q.get("company"); const qName = q.get("name");
      if (qEmail || qCompany || qName) {
        setF((p) => ({ ...p, contactEmail: qEmail || p.contactEmail, companyName: qCompany || p.companyName, contactName: qName || p.contactName }));
      }
    } catch { /* ignore */ }
    const region = (navigator.language || "").split("-")[1]?.toUpperCase();
    if (region && DIAL[region]) onCountryChange(region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // #8 Lagre kladd (debounced) — mister ikke fremdrift.
  React.useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem("partner_application_draft", JSON.stringify(f)); } catch { /* */ } }, 400);
    return () => clearTimeout(t);
  }, [f]);

  async function submit() {
    if (!f.companyName.trim() || !f.contactName.trim() || !emailValid || !f.contactEmail || !consentPrivacy
        || !urlOk(f.website) || !urlOk(f.portfolioUrl)) {
      setState("error"); setErrMsg(s.req); return;
    }
    setState("sending"); setErrMsg("");
    try {
      const resp = (await apiRequest("/api/editing/partner-applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          country: f.country === "__other" ? "" : f.country,
          teamSize: f.teamSize ? Number(f.teamSize) : null,
          services: selectedServices,
          consentContact, consentPrivacy: true, locale,
        }),
      })) as { ok?: boolean; alreadyReceived?: boolean; alreadyApproved?: boolean; reopened?: boolean };
      setDupMsg(
        resp?.alreadyApproved
          ? (locale === "en" ? "You're already an approved Creatorhub partner — check your inbox for your portal link (we can resend it on request)." : "Du er allerede godkjent Creatorhub-partner — sjekk innboksen for portal-lenken (vi kan sende den på nytt ved behov).")
          : resp?.alreadyReceived
            ? (locale === "en" ? "We already have an active application from this email — we'll be in touch." : "Vi har allerede en aktiv søknad fra denne e-posten — vi tar kontakt.")
            : "",
      );
      try { localStorage.removeItem("partner_application_draft"); } catch { /* */ }
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
            <Box component="img" src="/creatorhub-wordmark-light.png" alt="Creatorhub Norge" sx={{ height: { xs: 34, md: 44 }, width: "auto" }} />
            <Button size="small" onClick={() => setLocale(locale === "en" ? "no" : "en")} sx={{ color: BRAND.muted }}>
              {locale === "en" ? "Norsk" : "English"}
            </Button>
          </Box>

          {state === "done" ? (
            <Card sx={{ mt: 4, bgcolor: BRAND.card, border: `1px solid ${BRAND.border}` }}>
              <CardContent sx={{ textAlign: "center", py: 6 }}>
                <VerifiedUserIcon sx={{ fontSize: 48, color: BRAND.accent, mb: 1 }} />
                <Typography sx={{ fontSize: 18 }}>{dupMsg || s.done}</Typography>
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
                    {f.country === "NO" ? (
                      <Autocomplete
                        freeSolo
                        options={brregOptions}
                        loading={brregLoading}
                        filterOptions={(x) => x}
                        getOptionLabel={(o) => (typeof o === "string" ? o : o.navn)}
                        inputValue={f.companyName}
                        onInputChange={(_, v, reason) => { if (reason === "input") { set("companyName", v); searchBrreg(v); } }}
                        onChange={(_, val) => { if (val && typeof val !== "string") setF((p) => ({ ...p, companyName: val.navn, registrationNumber: val.organisasjonsnummer, vatNumber: `NO${val.organisasjonsnummer}MVA` })); }}
                        renderOption={(props, o) => (
                          <li {...props} key={o.organisasjonsnummer}>
                            {o.navn} <span style={{ opacity: 0.55, marginLeft: 6, fontSize: 12 }}>· {o.organisasjonsnummer}</span>
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField {...params} label={locale === "en" ? "Company name (search Brønnøysund)" : "Firmanavn (søk i Brønnøysund)"} required
                            InputProps={{ ...params.InputProps, endAdornment: <>{brregLoading ? <CircularProgress size={18} /> : null}{params.InputProps.endAdornment}</> }} />
                        )}
                        fullWidth
                      />
                    ) : (
                      <TextField label={s.company} value={f.companyName} onChange={(e) => set("companyName", e.target.value)} required fullWidth />
                    )}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField select label={s.country} value={f.country} onChange={(e) => onCountryChange(e.target.value)} sx={{ flex: 1 }}>
                        {COUNTRIES.map(([c, label]) => <MenuItem key={c} value={c}>{label}</MenuItem>)}
                      </TextField>
                      <TextField label={s.team} type="number" value={f.teamSize} onChange={(e) => set("teamSize", e.target.value)} sx={{ width: 140 }} />
                    </Stack>
                    {nonEea && <Alert severity="info" sx={{ py: 0.5, bgcolor: "rgba(255,186,108,0.10)", color: BRAND.cream, border: `1px solid ${BRAND.accent}33`, "& .MuiAlert-icon": { color: BRAND.accent } }}>{s.eea}</Alert>}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField label={s.contact} value={f.contactName} onChange={(e) => set("contactName", e.target.value)} required sx={{ flex: 1 }} />
                      <TextField label={s.email} type="email" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} required sx={{ flex: 1 }}
                        error={!emailValid} helperText={!emailValid ? (locale === "en" ? "Invalid email address" : "Ugyldig e-postadresse") : ""} />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField label={s.phone} value={f.phone} onChange={(e) => set("phone", e.target.value)} sx={{ flex: 1 }}
                        InputProps={{ startAdornment: <Box component="span" sx={{ mr: 1, fontSize: 18 }} aria-hidden>{flagEmoji(f.country)}</Box> }} />
                      <TextField label={s.website} value={f.website} onChange={(e) => set("website", e.target.value)} sx={{ flex: 1 }} placeholder="https://"
                        error={!urlOk(f.website)} helperText={!urlOk(f.website) ? (locale === "en" ? "Must start with http(s)://" : "Må starte med http(s)://") : ""} />
                    </Stack>
                    {/* Org.nr/MVA vises for alle; for Norge auto-fylles de fra Brønnøysund. */}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField label={s.reg} value={f.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} sx={{ flex: 1 }} />
                      <TextField label={s.vat} value={f.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} sx={{ flex: 1 }} />
                    </Stack>
                    <Autocomplete
                      multiple freeSolo
                      options={SERVICE_OPTIONS.map((o) => o.v)}
                      value={selectedServices}
                      onChange={(_, val) => set("services", (val as string[]).join(", "))}
                      getOptionLabel={(o) => { const m = SERVICE_OPTIONS.find((x) => x.v === o); return m ? (locale === "en" ? m.en : m.no) : String(o); }}
                      renderInput={(params) => (
                        <TextField {...params} label={s.services}
                          placeholder={selectedServices.length ? "" : (locale === "en" ? "Pick or type…" : "Velg eller skriv…")}
                          helperText={locale === "en" ? "Tap to select; type to add your own" : "Trykk for å velge; skriv for å legge til egne"} />
                      )}
                      fullWidth
                    />
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
                    <TextField label={s.portfolio} value={f.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} fullWidth placeholder="https://"
                      error={!urlOk(f.portfolioUrl)} helperText={!urlOk(f.portfolioUrl) ? (locale === "en" ? "Must start with http(s)://" : "Må starte med http(s)://") : ""} />
                    <TextField label={s.notes} value={f.notes} onChange={(e) => set("notes", e.target.value)} multiline minRows={2} fullWidth />
                    <FormControlLabel control={<Checkbox checked={consentContact} onChange={(e) => setConsentContact(e.target.checked)} />} label={<Typography variant="body2" sx={{ color: BRAND.muted }}>{s.consentContact}</Typography>} />
                    <FormControlLabel control={<Checkbox checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />} label={
                      <Typography variant="body2" sx={{ color: BRAND.muted }}>
                        {s.consentPrivacy}{" "}
                        <Box component="a" href="/partner/terms" target="_blank" rel="noopener" sx={{ color: BRAND.accent, textDecoration: "underline" }}>
                          {locale === "en" ? "Read terms & privacy" : "Les vilkår og personvern"}
                        </Box> *
                      </Typography>
                    } />
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
