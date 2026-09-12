/**
 * PartnerLanding.tsx
 *
 * Offentlig partner-landing + katalog (/partner). Markedsfører Creatorhub Editing
 * Partner Program OG viser offentlig katalog over verifiserte partnere (trygge felt
 * fra /api/editing/partners/public). Creatorhub-branding, tospråklig (no/en).
 * SEO + GEO: title/meta + JSON-LD (Organization + WebPage + ItemList + FAQPage).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Chip, Stack, Card, CardContent, Divider, ThemeProvider, createTheme, CircularProgress,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import StarIcon from "@mui/icons-material/Star";
import LockIcon from "@mui/icons-material/Lock";
import PaymentsIcon from "@mui/icons-material/Payments";
import { apiRequest } from "@/lib/queryClient";
import { usePartnerSeo } from "./usePartnerSeo";
import { trackEvent, trackPageView } from "@/utils/ga4-client-tracking";

type Locale = "no" | "en";
const BRAND = {
  bg: "#05060a", ink: "#f6f2ea", cream: "#fff5e8", accent: "#ffba6c", accent2: "#d07838",
  muted: "rgba(246,242,234,0.66)", border: "rgba(255,255,255,0.12)", card: "rgba(255,255,255,0.04)",
  font: '"Space Grotesk", "Manrope", sans-serif',
};
const TIER_META: Record<string, { label: string; color: string }> = {
  registered: { label: "Registered", color: "#9aa0a6" },
  verified: { label: "Verified", color: "#ffba6c" },
  certified: { label: "Certified", color: "#7ed8a0" },
  premium: { label: "Premium", color: "#c9a6ff" },
};

interface PublicPartner {
  vendorName: string; tagline: string | null; logoUrl: string | null; country: string | null;
  isInternational: boolean; rating: number | null; reviewCount: number; turnaroundDays: number | null;
  tier: string; verificationPercent: number;
  services: Array<{ category: string | null; name: string | null; price: number | null; currency: string }>;
}

const STR = {
  no: {
    title: "Verifiserte redigeringspartnere", sub: "Eksterne foto- & video-redigerere — vurdert, sikret og klar for oppdrag.",
    intro: "Creatorhub kobler fotografer og videografer med verifiserte redigeringsstudioer. Hver partner er kvalitetsvurdert, GDPR-sikret og betales først når leveransen er godkjent.",
    becomePartner: "Bli partner", browse: "Se partnere",
    why: [["Kvalitet vurdert", "Hver leveranse anmeldes av fotografen — rating styrer synlighet."], ["GDPR-sikret", "Kryptert overføring, DPA + NDA, auto-sletting. SCC/TIA for ikke-EØS."], ["Betal ved godkjenning", "Utbetaling frigis først når du godkjenner leveransen."]],
    catalog: "Verifiserte partnere", empty: "Ingen partnere er publisert ennå.", verified: "verifisert",
    reviews: "anmeldelser", days: "dager", from: "fra", ctaTitle: "Driver du et redigeringsstudio?", ctaBody: "Søk om å bli verifisert Creatorhub-partner.",
    faqTitle: "Ofte stilte spørsmål",
  },
  en: {
    title: "Verified editing partners", sub: "External photo & video editors — vetted, secured and ready for work.",
    intro: "Creatorhub connects photographers and videographers with verified editing studios. Every partner is quality-reviewed, GDPR-secured, and paid only once the delivery is approved.",
    becomePartner: "Become a partner", browse: "Browse partners",
    why: [["Quality reviewed", "Every delivery is rated by the photographer — ratings drive visibility."], ["GDPR-secured", "Encrypted transfer, DPA + NDA, auto-deletion. SCC/TIA for non-EEA."], ["Paid on approval", "Payout is released only once you approve the delivery."]],
    catalog: "Verified partners", empty: "No partners published yet.", verified: "verified",
    reviews: "reviews", days: "days", from: "from", ctaTitle: "Run an editing studio?", ctaBody: "Apply to become a verified Creatorhub partner.",
    faqTitle: "Frequently asked questions",
  },
};
const WHY_ICONS = [StarIcon, LockIcon, PaymentsIcon];

const FAQ_I18N: Record<Locale, Array<{ q: string; a: string }>> = {
  en: [
    { q: "How do I become a Creatorhub editing partner?", a: "Apply at creatorhubn.com/partner/apply. After approval you receive a private partner portal to complete verification (compliance, secure storage and payments)." },
    { q: "Is there a fee to join?", a: "Prototype testers pay 0% platform fee during the prototype period. Standard partners pay a transparent platform fee per job." },
    { q: "How do partners get paid?", a: "Payouts (PayPal or Stripe) are released automatically once the photographer approves each delivery." },
    { q: "Is client data secure and GDPR-compliant?", a: "Yes — encrypted transfer, job-scoped access, automatic deletion, a signed DPA + NDA. Partners outside the EEA complete SCC and a transfer impact assessment." },
    { q: "Who can become a partner?", a: "External photo and video editing studios — retouching, clipping path, color grading, video editing — delivering to photographers and videographers." },
  ],
  no: [
    { q: "Hvordan blir jeg redigeringspartner i Creatorhub?", a: "Søk på creatorhubn.com/partner/apply. Etter godkjenning får du en privat partnerportal for å fullføre verifisering (compliance, sikker lagring og betaling)." },
    { q: "Koster det noe å bli med?", a: "Prototype-testere betaler 0 % plattformgebyr i prototype-perioden. Vanlige partnere betaler et transparent plattformgebyr per oppdrag." },
    { q: "Hvordan får partnere betalt?", a: "Utbetaling (PayPal eller Stripe) frigis automatisk når fotografen godkjenner hver leveranse." },
    { q: "Er klientdata sikret og GDPR-kompatibelt?", a: "Ja — kryptert overføring, oppdrags-scoped tilgang, automatisk sletting, signert DPA + NDA. Partnere utenfor EØS fullfører SCC og en overførings-vurdering (TIA)." },
    { q: "Hvem kan bli partner?", a: "Eksterne foto- og video-redigeringsstudioer — retusj, clipping path, color grading, video-redigering — som leverer til fotografer og videografer." },
  ],
};

function flag(cc: string | null): string {
  if (!cc || cc.length !== 2) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function PartnerLanding() {
  const [locale, setLocale] = useState<Locale>("no");
  const s = STR[locale];
  const theme = useMemo(() => createTheme({ palette: { mode: "dark", primary: { main: BRAND.accent }, background: { default: BRAND.bg, paper: "#101218" }, text: { primary: BRAND.ink, secondary: BRAND.muted } } }), []);

  const { data, isLoading } = useQuery<{ partners: PublicPartner[] }>({
    queryKey: ["/api/editing/partners/public"],
    queryFn: () => apiRequest("/api/editing/partners/public"),
  });
  const partners = data?.partners || [];

  usePartnerSeo({
    title: locale === "en" ? "Verified Editing Partners — Creatorhub Partner Program" : "Verifiserte redigeringspartnere — Creatorhub Partnerprogram",
    description: locale === "en"
      ? "Browse verified external photo & video editing partners on Creatorhub — vetted, GDPR-secured, rated by photographers. Or apply to become a partner."
      : "Se verifiserte eksterne foto- og video-redigeringspartnere på Creatorhub — vurdert, GDPR-sikret, ratet av fotografer. Eller søk om å bli partner.",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", "@id": "https://creatorhubn.com/#organization", name: "Creatorhub", url: "https://creatorhubn.com", logo: "https://creatorhubn.com/creatorhub-wordmark-light.png" },
        { "@type": "WebPage", "@id": "https://creatorhubn.com/partner", name: "Creatorhub Editing Partner Program", isPartOf: { "@id": "https://creatorhubn.com/#organization" } },
        { "@type": "FAQPage", mainEntity: FAQ_I18N.en.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      ],
    },
    jsonLdId: "partner-landing-jsonld",
  });

  // GEO: dynamisk ItemList over partnere (injiseres når dataen er lastet).
  useEffect(() => {
    if (!partners.length) return;
    const ld = {
      "@context": "https://schema.org", "@type": "ItemList", name: "Verified Creatorhub editing partners",
      itemListElement: partners.slice(0, 50).map((p, i) => ({
        "@type": "ListItem", position: i + 1,
        item: { "@type": "ProfessionalService", name: p.vendorName, aggregateRating: p.reviewCount ? { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount } : undefined, areaServed: p.country || undefined },
      })),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json"; script.id = "partner-itemlist-jsonld"; script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
    return () => { document.getElementById("partner-itemlist-jsonld")?.remove(); };
  }, [partners]);

  useEffect(() => { trackPageView("/partner", "Partner landing"); trackEvent("partner_landing_view"); }, []);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: "100vh", background: `radial-gradient(circle at 80% -5%, rgba(255,186,108,0.16), transparent 32%), radial-gradient(circle at 0% 40%, rgba(208,120,56,0.12), transparent 36%), ${BRAND.bg}`, color: BRAND.ink, py: { xs: 3, md: 5 }, px: 2 }}>
        <Box sx={{ maxWidth: 1040, mx: "auto" }}>
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
            <Box component="img" src="/creatorhub-wordmark-light.png" alt="Creatorhub Norge" sx={{ height: { xs: 30, md: 40 }, width: "auto" }} />
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => setLocale(locale === "en" ? "no" : "en")} sx={{ color: BRAND.muted }}>{locale === "en" ? "Norsk" : "English"}</Button>
              <Button variant="contained" size="small" href="/partner/apply" onClick={() => trackEvent("partner_landing_cta", { where: "header" })} sx={{ background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accent2})`, color: "#0b0c10", fontWeight: 700 }}>{s.becomePartner}</Button>
            </Stack>
          </Box>

          {/* Hero */}
          <Box sx={{ textAlign: "center", mb: 5 }}>
            <Typography sx={{ fontFamily: BRAND.font, fontWeight: 800, fontSize: { xs: 30, md: 46 }, lineHeight: 1.08, color: BRAND.cream }}>{s.title}</Typography>
            <Typography sx={{ color: BRAND.accent, fontSize: { xs: 16, md: 19 }, mt: 1.5, fontWeight: 600 }}>{s.sub}</Typography>
            <Typography sx={{ color: BRAND.muted, fontSize: 15.5, mt: 1.5, maxWidth: 680, mx: "auto" }}>{s.intro}</Typography>
          </Box>

          {/* Verdiløfter */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" }, gap: 2, mb: 6 }}>
            {s.why.map(([t, d], i) => { const Icon = WHY_ICONS[i]; return (
              <Box key={t} sx={{ p: 2.2, bgcolor: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 3 }}>
                <Icon sx={{ color: BRAND.accent, fontSize: 26, mb: 1 }} />
                <Typography sx={{ fontWeight: 700, color: BRAND.cream }}>{t}</Typography>
                <Typography sx={{ color: BRAND.muted, fontSize: 13.5, mt: 0.5 }}>{d}</Typography>
              </Box>
            ); })}
          </Box>

          {/* Katalog */}
          <Typography sx={{ fontFamily: BRAND.font, fontWeight: 800, fontSize: 22, color: BRAND.cream, mb: 2 }}>{s.catalog}</Typography>
          {isLoading ? <CircularProgress size={26} /> : partners.length === 0 ? (
            <Typography color="text.secondary">{s.empty}</Typography>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3,1fr)" }, gap: 2 }}>
              {partners.map((p, i) => {
                const tier = TIER_META[p.tier] || TIER_META.registered;
                const minPrice = p.services.map((x) => x.price).filter((x): x is number => x != null).sort((a, b) => a - b)[0];
                const cur = p.services.find((x) => x.price != null)?.currency || "NOK";
                return (
                  <Card key={i} sx={{ bgcolor: BRAND.card, border: `1px solid ${BRAND.border}` }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography sx={{ fontWeight: 700, color: BRAND.cream }}>{flag(p.country)} {p.vendorName}</Typography>
                        <Chip size="small" label={tier.label} sx={{ color: tier.color, border: `1px solid ${tier.color}55`, bgcolor: "transparent", fontSize: 11 }} />
                      </Stack>
                      {p.tagline && <Typography sx={{ color: BRAND.muted, fontSize: 13, mt: 0.5 }}>{p.tagline}</Typography>}
                      <Stack direction="row" spacing={1.5} sx={{ mt: 1.2, flexWrap: "wrap" }} alignItems="center">
                        <Chip size="small" icon={<VerifiedUserIcon sx={{ fontSize: 14 }} />} label={`${p.verificationPercent}% ${s.verified}`} sx={{ color: BRAND.accent, bgcolor: "rgba(255,186,108,0.12)", fontSize: 11 }} />
                        {p.reviewCount ? <Typography sx={{ color: BRAND.muted, fontSize: 12.5 }}>★ {Number(p.rating).toFixed(1)} ({p.reviewCount} {s.reviews})</Typography> : null}
                        {p.turnaroundDays ? <Typography sx={{ color: BRAND.muted, fontSize: 12.5 }}>· {p.turnaroundDays} {s.days}</Typography> : null}
                      </Stack>
                      {p.services.length > 0 && (
                        <Typography sx={{ color: BRAND.muted, fontSize: 12, mt: 1 }}>
                          {p.services.slice(0, 3).map((x) => x.name).filter(Boolean).join(" · ")}
                          {minPrice != null && <> · {s.from} {minPrice} {cur}</>}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

          {/* CTA */}
          <Box sx={{ mt: 6, p: { xs: 3, md: 4 }, bgcolor: BRAND.card, border: `1px solid ${BRAND.accent}33`, borderRadius: 4, textAlign: "center" }}>
            <Typography sx={{ fontFamily: BRAND.font, fontWeight: 800, fontSize: 22, color: BRAND.cream }}>{s.ctaTitle}</Typography>
            <Typography sx={{ color: BRAND.muted, mt: 0.5, mb: 2 }}>{s.ctaBody}</Typography>
            <Button variant="contained" size="large" href="/partner/apply" onClick={() => trackEvent("partner_landing_cta", { where: "footer" })} sx={{ background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accent2})`, color: "#0b0c10", fontWeight: 700 }}>{s.becomePartner}</Button>
          </Box>

          {/* FAQ (GEO) */}
          <Box sx={{ mt: 6 }}>
            <Typography sx={{ fontFamily: BRAND.font, fontWeight: 800, fontSize: 20, color: BRAND.cream, mb: 2 }}>{s.faqTitle}</Typography>
            {FAQ_I18N[locale].map((f) => (
              <Box key={f.q} sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 700, color: BRAND.accent, fontSize: 15 }}>{f.q}</Typography>
                <Typography sx={{ color: BRAND.muted, fontSize: 14, mt: 0.4 }}>{f.a}</Typography>
                <Divider sx={{ borderColor: BRAND.border, mt: 1.5 }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
