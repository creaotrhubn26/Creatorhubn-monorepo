/**
 * PartnerTerms.tsx
 *
 * Vilkår + personvern for Creatorhub Partner Program (eksterne redigerings-
 * studioer). Dekker Creatorhub Partner Standard (kvalitet/lagring/GDPR/leveranse
 * + SCC/TIA for ikke-EØS + DPA/NDA + ingen underleverandør/portfolio-bruk),
 * betaling/utbetaling, kvalitet/anmeldelser, og personvern for søkere.
 * Tospråklig (no/en), Creatorhub-branding. Lenkes fra samtykket på apply-siden.
 */

import React, { useState } from "react";
import { Box, Typography, Button, Divider, ThemeProvider, createTheme } from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { usePartnerSeo } from "./usePartnerSeo";

type Locale = "no" | "en";
const BRAND = {
  bg: "#05060a", ink: "#f6f2ea", cream: "#fff5e8", accent: "#ffba6c", accent2: "#d07838",
  muted: "rgba(246,242,234,0.7)", border: "rgba(255,255,255,0.12)", card: "rgba(255,255,255,0.04)",
  font: '"Space Grotesk", "Manrope", sans-serif',
};

const CONTENT = {
  no: {
    title: "Partnerprogram — vilkår og personvern",
    updated: "Sist oppdatert",
    sections: [
      ["1. Creatorhub Partner Standard", [
        "Som verifisert redigeringspartner forplikter du deg til fire pilarer: Kvalitet (levere til avtalt teknisk standard; fotografen godkjenner hver leveranse før klient ser den), Lagring (kun sikker overføring via godkjent B2-lagring; oppdrags-scoped tilgang; midlertidige filer slettes automatisk etter levering), GDPR (signert databehandleravtale (DPA) + NDA; filer brukes KUN til redigeringen — aldri portfolio, markedsføring, AI-trening eller deling med tredjepart uten skriftlig samtykke), og Leveranse (alt leveres tilbake gjennom Creatorhub Showcase; aldri direkte til sluttkunde).",
      ]],
      ["2. Tredjeland (utenfor EØS)", [
        "Er studioet ditt utenfor EØS, kreves Standard Contractual Clauses (SCC) + en Transfer Impact Assessment (TIA) før du blir «cleared» og synlig for fotografer. Dette håndteres i onboarding.",
      ]],
      ["3. Underleverandører", [
        "Du kan ikke bruke underleverandører uten Creatorhubs skriftlige forhåndsgodkjenning. Du er ansvarlig for at egne ansatte/representanter overholder disse vilkårene.",
      ]],
      ["4. Betaling og utbetaling", [
        "Fotografen betaler inn til sikret depot (escrow). Utbetalingen frigis til deg automatisk (PayPal/Stripe) først når fotografen godkjenner leveransen. Plattformgebyr opplyses i portalen (0 % under prototype-perioden). Grensekryssende: snudd avregning — andelen din utbetales uten norsk MVA; du selv-avregner lokalt.",
      ]],
      ["5. Kvalitet, anmeldelser og avslutning", [
        "Hver leveranse vurderes av fotografen. Vi tar kvalitet på alvor: gjentatte leverings-klager flagger studioet ditt, og partnerskapet kan avsluttes. Flaggede partnere skjules fra discovery til forholdet er ryddet.",
      ]],
      ["6. Personvern for søkere", [
        "Når du sender en søknad behandler vi kontaktopplysningene dine (firmanavn, kontaktperson, e-post, telefon, nettside) for å vurdere søknaden. Rettslig grunnlag er ditt samtykke. Vi lagrer IP/enhet og samtykke-tidspunkt som dokumentasjon. Avviste/trukne søknader slettes etter 30 dager. Du kan når som helst be om innsyn, retting eller sletting ved å kontakte oss.",
      ]],
      ["7. Vår DPA er gjeldende avtale", [
        "Creatorhubs databehandleravtale (DPA) og NDA er den gjeldende avtalen for behandling av personopplysninger i redigerings-flyten. Har studioet ditt en egen NDA, kan den registreres og spores som motpart-dokument, men erstatter ikke vår DPA.",
      ]],
    ],
    contact: "Spørsmål? Kontakt",
    back: "Tilbake til søknaden",
  },
  en: {
    title: "Partner Program — Terms & Privacy",
    updated: "Last updated",
    sections: [
      ["1. Creatorhub Partner Standard", [
        "As a verified editing partner you commit to four pillars: Quality (deliver to the agreed technical standard; the photographer approves every delivery before the client sees it), Storage (secure transfer only via approved B2 storage; job-scoped access; temporary files auto-deleted after delivery), GDPR (signed Data Processing Agreement (DPA) + NDA; files used ONLY for the edit — never for portfolio, marketing, AI training or sharing with third parties without written consent), and Delivery (everything returns through Creatorhub Showcase; never directly to the end client).",
      ]],
      ["2. Outside the EEA", [
        "If your studio is outside the EEA, Standard Contractual Clauses (SCC) + a Transfer Impact Assessment (TIA) are required before you become 'cleared' and visible to photographers. Handled during onboarding.",
      ]],
      ["3. Subcontractors", [
        "You may not use subcontractors without Creatorhub's prior written approval. You are responsible for ensuring your own staff/representatives comply with these terms.",
      ]],
      ["4. Payments and payout", [
        "The photographer pays into secure escrow. Your payout is released automatically (PayPal/Stripe) only once the photographer approves the delivery. The platform fee is shown in the portal (0% during the prototype period). Cross-border: reverse charge — your share is paid without Norwegian VAT; you self-account locally.",
      ]],
      ["5. Quality, reviews and termination", [
        "Every delivery is reviewed by the photographer. We're serious about quality: repeated delivery complaints flag your studio, and the partnership may be terminated. Flagged partners are hidden from discovery until resolved.",
      ]],
      ["6. Privacy for applicants", [
        "When you submit an application we process your contact details (company name, contact person, email, phone, website) to assess the application. The legal basis is your consent. We store IP/device and consent timestamp as documentation. Rejected/withdrawn applications are deleted after 30 days. You may request access, correction or deletion at any time by contacting us.",
      ]],
      ["7. Our DPA is the governing agreement", [
        "Creatorhub's Data Processing Agreement (DPA) and NDA are the governing agreement for processing personal data in the editing flow. If your studio has its own NDA, it can be registered and tracked as a counterpart document, but it does not replace our DPA.",
      ]],
    ],
    contact: "Questions? Contact",
    back: "Back to the application",
  },
};

export default function PartnerTerms() {
  const [locale, setLocale] = useState<Locale>("en");
  const c = CONTENT[locale];
  usePartnerSeo({
    title: "Partner Program — Terms & Privacy | Creatorhub",
    description: "Creatorhub Partner Standard, payouts and applicant privacy for the Creatorhub editing Partner Program — quality, storage, GDPR (DPA/NDA, SCC/TIA), reviews and termination.",
    jsonLdId: "partner-terms-jsonld",
  });
  const theme = createTheme({ palette: { mode: "dark", primary: { main: BRAND.accent }, background: { default: BRAND.bg } } });

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{
        minHeight: "100vh",
        background: `radial-gradient(circle at 80% -5%, rgba(255,186,108,0.14), transparent 32%), ${BRAND.bg}`,
        color: BRAND.ink, py: { xs: 3, md: 6 }, px: 2,
      }}>
        <Box sx={{ maxWidth: 760, mx: "auto" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Box component="img" src="/creatorhub-wordmark-light.png" alt="Creatorhub Norge" sx={{ height: { xs: 30, md: 38 }, width: "auto" }} />
            <Button size="small" onClick={() => setLocale(locale === "en" ? "no" : "en")} sx={{ color: BRAND.muted }}>
              {locale === "en" ? "Norsk" : "English"}
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 1 }}>
            <VerifiedUserIcon sx={{ color: BRAND.accent, fontSize: 30 }} />
            <Typography sx={{ fontFamily: BRAND.font, fontWeight: 800, fontSize: { xs: 24, md: 30 }, color: BRAND.cream }}>
              {c.title}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: BRAND.muted }}>{c.updated}: 2026-06-20</Typography>

          <Box sx={{ mt: 3 }}>
            {c.sections.map(([heading, paras]) => (
              <Box key={heading as string} sx={{ mb: 3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: BRAND.accent, mb: 0.8 }}>{heading}</Typography>
                {(paras as string[]).map((p, i) => (
                  <Typography key={i} sx={{ color: BRAND.muted, fontSize: 14.5, lineHeight: 1.6, mb: 1 }}>{p}</Typography>
                ))}
                <Divider sx={{ borderColor: BRAND.border, mt: 1 }} />
              </Box>
            ))}
          </Box>

          <Typography sx={{ color: BRAND.muted, fontSize: 13, mt: 2 }}>
            {c.contact}: <a href="mailto:partner@creatorhubn.com" style={{ color: BRAND.accent }}>partner@creatorhubn.com</a>
          </Typography>
          <Button href="/partner/apply" sx={{ mt: 3, color: BRAND.accent }}>← {c.back}</Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
