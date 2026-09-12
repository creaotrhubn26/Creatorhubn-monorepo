/**
 * PartnerProgramDashboard.tsx
 *
 * Creatorhub Verified Partner — verifiserings-dashboard som vises ØVERST i
 * redigeringsvendorens arbeidsområde. Pixel-tro mot partnerprogram-designet:
 * hero + partnerstatus, 7-stegs verifiseringsløype, kort-grid (bedriftsinfo,
 * portfolio, testoppdrag, GDPR, betaling, lagring, kommentar) og høyre kolonne
 * (compliance-oversikt, partnernivåer, hvorfor bli partner).
 *
 * FULLSTENDIG TOSPRÅKLIG: locale='en' for utenlandske vendors → hele dashbordet
 * på engelsk (matcher resten av arbeidsområdet). Compliance-status + bedriftsnavn
 * kobles til ekte data fra /api/editing/vendor/me når tilgjengelig.
 */

import React from "react";
import { Box } from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ApartmentIcon from "@mui/icons-material/Apartment";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import TuneIcon from "@mui/icons-material/Tune";
import GppGoodIcon from "@mui/icons-material/GppGood";
import CloudIcon from "@mui/icons-material/Cloud";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import GroupsIcon from "@mui/icons-material/Groups";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import StorefrontIcon from "@mui/icons-material/Storefront";
import VerifiedIcon from "@mui/icons-material/Verified";
import DiamondIcon from "@mui/icons-material/Diamond";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CollectionsIcon from "@mui/icons-material/Collections";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import LockIcon from "@mui/icons-material/Lock";
import SecurityIcon from "@mui/icons-material/Security";
import AutoDeleteIcon from "@mui/icons-material/AutoDelete";
import type { Locale } from "./editingMarketplaceStrings";

// ── Palett (matcher designet) ───────────────────────────────────────────
const C = {
  bg: "#0a0d13",
  panel: "#0e1219",
  panel2: "#111620",
  inset: "#0c0f16",
  border: "rgba(255,255,255,0.07)",
  borderHi: "rgba(245,166,35,0.55)",
  glowHi: "rgba(245,166,35,0.10)",
  ink: "#eceae4",
  sub: "#9aa0ab",
  faint: "#6b7280",
  accent: "#f5a623",
  accent2: "#ff8c00",
  green: "#43c96b",
  greenInk: "#7fe09b",
  amber: "#e0a23a",
};

// ── Tospråklig innhold (no = matcher designbildet, en = utenlandske vendors) ──
const STR = {
  no: {
    heroTitle: "Bli en Creatorhub Verified Partner",
    heroSub: "Eksterne redigeringsselskaper må verifiseres før de kan motta oppdrag fra Creatorhub og vårt nettverk av fotografer og videografer.",
    startVerif: "Start verifisering", seeReqs: "Se krav",
    network: "Join et globalt nettverk av profesjonelle leverandører og skap langsiktige relasjoner.",
    readMore: "Les mer om Partnerprogrammet",
    pill: { done: "Fullført", active: "Pågår", missing: "Mangler", ready: "Klar til vurdering" },
    steps: [
      ["Bedriftsverifisering", "Bekreft organisasjon og kontaktinformasjon."],
      ["Portfolio-gjennomgang", "Send inn eksempler på arbeid og relevant erfaring."],
      ["Kvalitetstest", "Fullfør et testoppdrag og vis din kvalitet."],
      ["GDPR og avtaler", "Signer avtaler og bekreft etterlevelse av krav."],
      ["Lagring og filflyt", "Bekreft sikker lagring og integrasjon med Creatorhub."],
      ["Betaling og utbetaling", "Koble til Stripe eller PayPal for å motta utbetalinger."],
      ["Godkjenning", "Creatorhub vurderer og godkjenner din bedrift."],
    ],
    lblCompanyInfo: "Bedriftsinfo", lblPortfolio: "Portfolio-gjennomgang", lblTest: "Testoppdrag",
    lblGdpr: "GDPR og avtaler", lblStorage: "Lagring og integrasjon", lblComment: "Kommentar fra Creatorhub",
    lblPayment: "Betaling og utbetaling", lblPartnerStatus: "Partnerstatus", lblCompliance: "Compliance-oversikt",
    lblTiers: "Partnernivåer", lblWhy: "Hvorfor bli partner?",
    ci: ["Firmanavn", "Land", "Kontaktperson", "E-post", "Språk", "Tidssone"],
    countryNO: "Norge", countryGB: "Storbritannia", langs: "Norsk, Engelsk", editInfo: "Rediger informasjon",
    submitted: "Innsendt 8 av 12 eksempler", tags: ["Bryllup", "Retusj", "Color grading", "Videoredigering", "+"],
    editSubs: "Se og rediger innsendinger",
    testDesc: "Bryllupsfilm – Highlights (3–5 min)", testDue: "Levert innen: 12. mai 2025",
    rate: ["Kvalitet", "Stilmatch", "Leveringstid", "Filstruktur"], dlBrief: "Last ned brief og materiale",
    gdprRows: ["NDA signert", "Databehandleravtale", "Underleverandørpolicy", "AI-bruk-policy"],
    missing: "Mangler", goAgreements: "Gå til avtaler",
    stRows: ["B2 Backblaze-kompatibel", "2FA aktivert", "Kryptert lagring (at rest)", "Sikker filoverføring", "Slette-rutine"],
    stStat: ["Kompatibel", "Aktivert", "Aktivert", "Aktivert", "Mangler"], testFlow: "Test tilkobling og filflyt",
    commentTxt: "Takk for innsending av portfolio, testoppdrag og resterende dokumenter mangler før vi kan gjennomføre endelig vurdering.",
    partnerMgr: "Partner Manager", lastUpd: "Sist oppdatert:", commentDate: "8. mai 2025",
    payIntro: "Koble til minst én betalingsløsning for å motta betalte oppdrag.",
    connected: "Tilkoblet", canConnect: "Kan kobles til", manage: "Administrer", connect: "Koble til",
    payRows: [["Betalingsmetode", "Konfigurert"], ["Utbetaling", "7 dager (månedlig)"], ["Plattformgebyr", "10 % + MVA"]],
    managePay: "Administrer betaling",
    completed: "Fullført", wellOnWay: "Du er godt på vei!",
    wellOnWaySub: "Fullfør de siste stegene for å bli Creatorhub Verified Partner.",
    nextStep: "Se neste steg", seeHistory: "Se historikk",
    compRows: ["Kvalitet", "Lagring", "GDPR", "Betaling", "Leveranse"], payRequired: "Stripe eller PayPal kreves",
    approved: "Godkjent", partial: "Delvis", seeBenefits: "Se fordeler",
    tierDesc: ["Tilgang til vendor-database", "Motta oppdrag fra Creatorhub", "Prioritet, høyere synlighet og rating", "Eksklusiv tilgang og dedikert support"],
    why: [
      ["Motta oppdrag fra fotografer og videografer", "Tilgang til konkurrerlige digitale oppdrag."],
      ["Sikker filflyt via Creatorhub", "Kryptert overføring og sporbar leveranse i sanntid."],
      ["Lever tilbake til Showcase", "Få eksponering og bygg tillit i nettverket."],
      ["Bygg rating og historikk", "Dokumenter kvalitet og skap langsiktig verdi."],
    ],
  },
  en: {
    heroTitle: "Become a Creatorhub Verified Partner",
    heroSub: "External editing studios must be verified before they can receive jobs from Creatorhub and our network of photographers and videographers.",
    startVerif: "Start verification", seeReqs: "See requirements",
    network: "Join a global network of professional vendors and build long-term relationships.",
    readMore: "Read more about the Partner Program",
    pill: { done: "Completed", active: "In progress", missing: "Missing", ready: "Ready for review" },
    steps: [
      ["Company verification", "Confirm your organisation and contact details."],
      ["Portfolio review", "Submit work samples and relevant experience."],
      ["Quality test", "Complete a test assignment and show your quality."],
      ["GDPR & agreements", "Sign agreements and confirm compliance with our standards."],
      ["Storage & file flow", "Confirm secure storage and integration with Creatorhub."],
      ["Payments & payout", "Connect Stripe or PayPal to receive payouts."],
      ["Approval", "Creatorhub reviews and approves your company."],
    ],
    lblCompanyInfo: "Company info", lblPortfolio: "Portfolio review", lblTest: "Test assignment",
    lblGdpr: "GDPR & agreements", lblStorage: "Storage & integration", lblComment: "Note from Creatorhub",
    lblPayment: "Payments & payout", lblPartnerStatus: "Partner status", lblCompliance: "Compliance overview",
    lblTiers: "Partner tiers", lblWhy: "Why become a partner?",
    ci: ["Company name", "Country", "Contact", "Email", "Languages", "Timezone"],
    countryNO: "Norway", countryGB: "United Kingdom", langs: "Norwegian, English", editInfo: "Edit information",
    submitted: "Submitted 8 of 12 samples", tags: ["Wedding", "Retouch", "Color grading", "Video editing", "+"],
    editSubs: "View & edit submissions",
    testDesc: "Wedding film – Highlights (3–5 min)", testDue: "Due: 12 May 2025",
    rate: ["Quality", "Style match", "Delivery time", "File structure"], dlBrief: "Download brief & materials",
    gdprRows: ["NDA signed", "Data Processing Agreement", "Subcontractor policy", "AI usage policy"],
    missing: "Missing", goAgreements: "Go to agreements",
    stRows: ["B2 Backblaze compatible", "2FA enabled", "Encrypted storage (at rest)", "Secure file transfer", "Deletion routine"],
    stStat: ["Compatible", "Enabled", "Enabled", "Enabled", "Missing"], testFlow: "Test connection & file flow",
    commentTxt: "Thanks for submitting your portfolio. The test assignment and remaining documents are still missing before we can complete the final review.",
    partnerMgr: "Partner Manager", lastUpd: "Last updated:", commentDate: "8 May 2025",
    payIntro: "Connect at least one payment method to receive paid jobs.",
    connected: "Connected", canConnect: "Can be connected", manage: "Manage", connect: "Connect",
    payRows: [["Payment method", "Configured"], ["Payout", "7 days (monthly)"], ["Platform fee", "10% + VAT"]],
    managePay: "Manage payments",
    completed: "Completed", wellOnWay: "You're well on your way!",
    wellOnWaySub: "Complete the final steps to become a Creatorhub Verified Partner.",
    nextStep: "See next step", seeHistory: "See history",
    compRows: ["Quality", "Storage", "GDPR", "Payment", "Delivery"], payRequired: "Stripe or PayPal required",
    approved: "Approved", partial: "Partial", seeBenefits: "See benefits",
    tierDesc: ["Access to the vendor database", "Receive jobs from Creatorhub", "Priority, higher visibility and rating", "Exclusive access and dedicated support"],
    why: [
      ["Receive jobs from photographers and videographers", "Access to competitive digital jobs."],
      ["Secure file flow via Creatorhub", "Encrypted transfer and traceable delivery in real time."],
      ["Deliver back to Showcase", "Get exposure and build trust in the network."],
      ["Build rating and history", "Document quality and create long-term value."],
    ],
  },
} as const;

type MeLike = {
  vendorName?: string | null;
  country?: string | null;
  compliance?: { pillars?: Record<string, { status: string }>; cleared?: boolean; verificationPercent?: number; tier?: string };
  platformFee?: { pct?: number; prototype?: boolean };
} | null | undefined;

interface Props {
  me?: MeLike;
  locale?: Locale;
  onStartVerification?: () => void;
}

type StepState = "done" | "active" | "missing" | "ready";

// ── Små byggeklosser ────────────────────────────────────────────────────
function Panel({ children, sx }: { children: React.ReactNode; sx?: object }) {
  return (
    <Box sx={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: "14px", p: 2, ...sx }}>
      {children}
    </Box>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
      <Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", color: C.sub, textTransform: "uppercase" }}>{children}</Box>
      {action}
    </Box>
  );
}

function GhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <Box component="button" sx={{ font: "inherit", fontSize: 12, fontWeight: 600, color: C.ink, cursor: "pointer",
      background: "transparent", border: `1px solid ${C.border}`, borderRadius: "8px", px: 1.3, py: 0.5,
      transition: "0.15s", "&:hover": { borderColor: C.borderHi } }}>
      {children}
    </Box>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <Box sx={{ display: "inline-flex", color: C.accent }}>
      {[0, 1, 2, 3, 4].map((i) =>
        i < n ? <StarIcon key={i} sx={{ fontSize: 14 }} /> : <StarBorderIcon key={i} sx={{ fontSize: 14, color: C.faint }} />,
      )}
    </Box>
  );
}

// ── Hovedkomponent ──────────────────────────────────────────────────────
export default function PartnerProgramDashboard({ me, locale = "no", onStartVerification }: Props) {
  const s = STR[locale === "en" ? "en" : "no"];
  const pillars = me?.compliance?.pillars ?? {};
  const vendorName = me?.vendorName || "Nordic Edit Studio AS";

  const pillState = (key: string, fallback: StepState): StepState => {
    const st = pillars[key]?.status;
    if (!st) return fallback;
    return st === "approved" || st === "automatic" || st === "not_allowed" ? "done" : fallback;
  };
  const pStat = (key: string, fallback: "ok" | "partial"): "ok" | "partial" => {
    const st = pillars[key]?.status;
    if (!st) return fallback;
    return st === "approved" || st === "automatic" || st === "not_allowed" ? "ok" : "partial";
  };

  const stepIcons = [<ApartmentIcon />, <PhotoLibraryIcon />, <TuneIcon />, <GppGoodIcon />, <CloudIcon />, <ReceiptLongIcon />, <WorkspacePremiumIcon />];
  const stepStates: StepState[] = ["done", "active", "missing", pillState("gdpr", "missing"), "missing", "missing", "ready"];

  const StatusPill = ({ state }: { state: StepState }) => {
    const map: Record<StepState, { col: string; bg: string }> = {
      done: { col: C.greenInk, bg: "rgba(67,201,107,0.12)" },
      active: { col: C.accent, bg: "rgba(245,166,35,0.13)" },
      missing: { col: C.faint, bg: "rgba(255,255,255,0.04)" },
      ready: { col: C.sub, bg: "rgba(255,255,255,0.04)" },
    };
    const m = map[state];
    return (
      <Box sx={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: m.col, background: m.bg, border: `1px solid ${m.col}33`, borderRadius: "7px", px: 1, py: 0.4 }}>
        {s.pill[state]}
      </Box>
    );
  };

  const complianceRows = [
    { label: s.compRows[0], ok: pStat("quality", "ok") },
    { label: s.compRows[1], ok: pStat("storage", "ok") },
    { label: s.compRows[2], ok: pStat("gdpr", "partial") },
    { label: s.compRows[3], sub: s.payRequired, ok: "partial" as const },
    { label: s.compRows[4], ok: pStat("delivery", "ok") },
  ];

  const tierIcons = [<StorefrontIcon />, <VerifiedIcon />, <WorkspacePremiumIcon />, <DiamondIcon />];
  const tierNames = ["Registered Vendor", "Verified Vendor", "Certified Partner", "Premium Partner"];
  const whyIcons = [<EventAvailableIcon />, <CloudUploadIcon />, <CollectionsIcon />, <StarIcon />];

  const TIER_IDX: Record<string, number> = { registered: 0, verified: 1, certified: 2, premium: 3 };
  const activeTierIdx = me?.compliance?.tier != null ? (TIER_IDX[me.compliance.tier] ?? 1) : 1;
  const PROGRESS = me?.compliance?.verificationPercent != null ? me.compliance.verificationPercent : 71;
  // ÉN sannhetskilde for plattform-gebyr (samme env backend charges).
  const feeLabel = me?.platformFee
    ? (me.platformFee.prototype
        ? (locale === "en" ? "0% (prototype)" : "0 % (prototype)")
        : `${me.platformFee.pct ?? 0}%${locale === "en" ? " + VAT" : " + MVA"}`)
    : (locale === "en" ? "10% + VAT" : "10 % + MVA");
  const ring = `conic-gradient(${C.accent} ${PROGRESS * 3.6}deg, rgba(255,255,255,0.08) 0deg)`;

  return (
    <Box sx={{ background: `radial-gradient(circle at 12% -5%, rgba(245,166,35,0.10), transparent 36%), ${C.bg}`,
      border: `1px solid ${C.border}`, borderRadius: "18px", p: { xs: 1.5, md: 2.5 }, mb: 3, color: C.ink, fontFamily: "inherit" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 340px" }, gap: 2 }}>
        {/* ══════════ VENSTRE KOLONNE ══════════ */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          {/* ── Hero ── */}
          <Box sx={{ position: "relative", background: `radial-gradient(circle at 6% 0%, rgba(245,166,35,0.16), transparent 30%), ${C.panel}`,
            border: `1px solid ${C.border}`, borderRadius: "16px", p: { xs: 2, md: 3 }, display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ flex: "none" }}>
              <Box sx={{ width: 86, height: 86, borderRadius: "50%", display: "grid", placeItems: "center",
                background: "radial-gradient(circle, rgba(245,166,35,0.18), transparent 70%)", border: `1px solid ${C.borderHi}` }}>
                <VerifiedUserIcon sx={{ fontSize: 44, color: C.accent }} />
              </Box>
            </Box>
            <Box sx={{ flex: "1 1 340px", minWidth: 0 }}>
              <Box sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, lineHeight: 1.1, mb: 1 }}>{s.heroTitle}</Box>
              <Box sx={{ color: C.sub, fontSize: 14.5, lineHeight: 1.55, maxWidth: 560, mb: 2 }}>{s.heroSub}</Box>
              <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <Box component="button" onClick={onStartVerification}
                  sx={{ font: "inherit", fontWeight: 700, fontSize: 14, color: "#0a0d13", cursor: "pointer",
                    background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, border: "none", borderRadius: "10px",
                    px: 2.2, py: 1.1, display: "inline-flex", alignItems: "center", gap: 0.8, boxShadow: "0 4px 14px rgba(245,166,35,0.32)" }}>
                  {s.startVerif} <ArrowForwardIcon sx={{ fontSize: 17 }} />
                </Box>
                <Box component="button" sx={{ font: "inherit", fontWeight: 600, fontSize: 14, color: C.ink, cursor: "pointer",
                  background: "transparent", border: `1px solid ${C.border}`, borderRadius: "10px", px: 2.2, py: 1.1 }}>
                  {s.seeReqs}
                </Box>
              </Box>
            </Box>
            <Box sx={{ flex: "1 1 230px", minWidth: 0, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: "12px", p: 2, alignSelf: "flex-start" }}>
              <Box sx={{ display: "flex", gap: 1.3 }}>
                <GroupsIcon sx={{ fontSize: 26, color: C.accent, flex: "none" }} />
                <Box sx={{ color: C.sub, fontSize: 13, lineHeight: 1.5 }}>{s.network}</Box>
              </Box>
              <Box sx={{ mt: 1.5, color: C.accent, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.6, cursor: "pointer" }}>
                {s.readMore} <ArrowForwardIcon sx={{ fontSize: 15 }} />
              </Box>
            </Box>
          </Box>

          {/* ── 7-stegs stepper ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", xl: "repeat(7, 1fr)" }, gap: 1.2 }}>
            {s.steps.map((st, idx) => {
              const state = stepStates[idx];
              const hi = state === "active";
              return (
                <Box key={idx} sx={{ position: "relative", background: hi ? `linear-gradient(180deg, ${C.glowHi}, transparent)` : C.panel,
                  border: `1px solid ${hi ? C.borderHi : C.border}`, borderRadius: "12px", p: 1.5,
                  boxShadow: hi ? `0 0 0 1px ${C.borderHi}, 0 6px 20px ${C.glowHi}` : "none" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.2 }}>
                    <Box sx={{ width: 26, height: 26, borderRadius: "8px", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800,
                      color: hi ? "#0a0d13" : C.ink, background: hi ? C.accent : C.inset, border: `1px solid ${hi ? "transparent" : C.border}` }}>
                      {idx + 1}
                    </Box>
                    <Box sx={{ color: hi ? C.accent : C.faint, display: "grid", placeItems: "center", "& svg": { fontSize: 22 } }}>{stepIcons[idx]}</Box>
                  </Box>
                  <Box sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>{idx + 1}. {st[0]}</Box>
                  <Box sx={{ color: C.sub, fontSize: 11.5, lineHeight: 1.45, mb: 1.2, minHeight: 48 }}>{st[1]}</Box>
                  <StatusPill state={state} />
                </Box>
              );
            })}
          </Box>

          {/* ── Kort-grid rad 1 ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "1.1fr 1.3fr 1.1fr 1fr" }, gap: 2 }}>
            {/* Bedriftsinfo */}
            <Panel>
              <SectionLabel action={<StatusPill state="done" />}>{s.lblCompanyInfo}</SectionLabel>
              {[
                [s.ci[0], vendorName],
                [s.ci[1], me?.country === "GB" ? s.countryGB : s.countryNO],
                [s.ci[2], "Erik Johansen"],
                [s.ci[3], "erik@nordicedit.no"],
                [s.ci[4], s.langs],
                [s.ci[5], "CET (Oslo)"],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.6, fontSize: 13, borderBottom: `1px solid ${C.border}` }}>
                  <Box sx={{ color: C.sub }}>{k}</Box>
                  <Box sx={{ fontWeight: 600, textAlign: "right" }}>{v}</Box>
                </Box>
              ))}
              <Box sx={{ mt: 1.5, textAlign: "center" }}><GhostBtn>{s.editInfo}</GhostBtn></Box>
            </Panel>

            {/* Portfolio */}
            <Panel>
              <SectionLabel action={<StatusPill state="active" />}>{s.lblPortfolio}</SectionLabel>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.8 }}>
                {[["#4a3b30", "#6b5240"], ["#2d4055", "#3f6076"], ["#5a4a55", "#7d5a68"], ["#34302a", "#4a4038"], ["#3a2f3a", "#574052"], ["#2a3a3a", "#3d5454"]].map((g, i) => (
                  <Box key={i} sx={{ position: "relative", aspectRatio: "4/3", borderRadius: "7px", background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`, border: `1px solid ${C.border}` }}>
                    {i === 5 && <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.45)", borderRadius: "7px", fontSize: 13, fontWeight: 700 }}>+2</Box>}
                  </Box>
                ))}
              </Box>
              <Box sx={{ color: C.sub, fontSize: 12, mt: 1 }}>{s.submitted}</Box>
              <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", mt: 1 }}>
                {s.tags.map((tg) => <Box key={tg} sx={{ fontSize: 11, color: C.sub, background: C.inset, border: `1px solid ${C.border}`, borderRadius: "6px", px: 0.9, py: 0.3 }}>{tg}</Box>)}
              </Box>
              <Box sx={{ mt: 1.5, textAlign: "center" }}><GhostBtn>{s.editSubs}</GhostBtn></Box>
            </Panel>

            {/* Testoppdrag */}
            <Panel>
              <SectionLabel action={<StatusPill state="missing" />}>{s.lblTest}</SectionLabel>
              <Box sx={{ fontSize: 13, fontWeight: 700 }}>Sample Assignment #1245</Box>
              <Box sx={{ color: C.sub, fontSize: 12, mt: 0.3 }}>{s.testDesc}</Box>
              <Box sx={{ color: C.sub, fontSize: 12, mb: 1.3 }}>{s.testDue}</Box>
              {[[s.rate[0], 4], [s.rate[1], 4], [s.rate[2], 3], [s.rate[3], 4]].map(([label, n]) => (
                <Box key={label as string} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.5, fontSize: 13, borderBottom: `1px solid ${C.border}` }}>
                  <Box sx={{ color: C.ink }}>{label}</Box>
                  <Stars n={n as number} />
                </Box>
              ))}
              <Box sx={{ mt: 1.5, textAlign: "center" }}><GhostBtn>{s.dlBrief}</GhostBtn></Box>
            </Panel>

            {/* GDPR */}
            <Panel>
              <SectionLabel action={<StatusPill state="missing" />}>{s.lblGdpr}</SectionLabel>
              {[[s.gdprRows[0], true], [s.gdprRows[1], true], [s.gdprRows[2], false], [s.gdprRows[3], false]].map(([label, ok]) => (
                <Box key={label as string} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.7, fontSize: 13 }}>
                  <Box sx={{ color: ok ? C.ink : C.amber }}>{label}{!ok && <Box component="span" sx={{ display: "block", fontSize: 10.5, color: C.faint }}>{s.missing}</Box>}</Box>
                  {ok ? <CheckCircleIcon sx={{ fontSize: 18, color: C.green }} /> : <WarningAmberIcon sx={{ fontSize: 18, color: C.amber }} />}
                </Box>
              ))}
              <Box sx={{ mt: 1, textAlign: "center" }}><GhostBtn>{s.goAgreements}</GhostBtn></Box>
            </Panel>
          </Box>

          {/* ── Kort-grid rad 2: Lagring + Kommentar ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1fr" }, gap: 2 }}>
            <Panel>
              <SectionLabel action={<StatusPill state="missing" />}>{s.lblStorage}</SectionLabel>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1 }}>
                {[
                  <Box sx={{ fontSize: 11, fontWeight: 800, color: C.accent }}>B2</Box>,
                  <LockIcon sx={{ fontSize: 18 }} />,
                  <SecurityIcon sx={{ fontSize: 18 }} />,
                  <CloudUploadIcon sx={{ fontSize: 18 }} />,
                  <AutoDeleteIcon sx={{ fontSize: 18 }} />,
                ].map((icon, i) => {
                  const ok = i < 4;
                  return (
                    <Box key={i} sx={{ textAlign: "center" }}>
                      <Box sx={{ color: ok ? C.ink : C.faint, display: "grid", placeItems: "center", height: 26 }}>{icon}</Box>
                      <Box sx={{ fontSize: 10.5, color: C.sub, lineHeight: 1.3, mt: 0.5, minHeight: 40 }}>{s.stRows[i]}</Box>
                      <Box sx={{ fontSize: 10.5, fontWeight: 700, color: ok ? C.greenInk : C.faint }}>{s.stStat[i]}</Box>
                    </Box>
                  );
                })}
              </Box>
              <Box sx={{ mt: 1.5, textAlign: "center" }}><GhostBtn>{s.testFlow}</GhostBtn></Box>
            </Panel>

            <Panel>
              <SectionLabel>{s.lblComment}</SectionLabel>
              <Box sx={{ color: C.ink, fontSize: 13, lineHeight: 1.55, mb: 1.5 }}>{s.commentTxt}</Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                <Box sx={{ width: 38, height: 38, borderRadius: "50%", flex: "none", background: "linear-gradient(135deg,#7d5a68,#574052)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>IL</Box>
                <Box>
                  <Box sx={{ fontSize: 13, fontWeight: 700 }}>Ingrid Larsen</Box>
                  <Box sx={{ fontSize: 11.5, color: C.sub }}>{s.partnerMgr}</Box>
                </Box>
                <Box sx={{ ml: "auto", textAlign: "right", fontSize: 11, color: C.faint }}>{s.lastUpd}<br />{s.commentDate}</Box>
              </Box>
            </Panel>
          </Box>

          {/* Betaling og utbetaling */}
          <Panel>
            <SectionLabel action={<StatusPill state="missing" />}>{s.lblPayment}</SectionLabel>
            <Box sx={{ color: C.sub, fontSize: 12.5, mb: 1.3 }}>{s.payIntro}</Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, background: C.inset, border: `1px solid ${C.border}`, borderRadius: "9px", p: 1 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: "6px", background: "#635bff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, color: "#fff" }}>S</Box>
                <Box sx={{ fontSize: 13, fontWeight: 600 }}>Stripe</Box>
                <Box sx={{ fontSize: 11, color: C.greenInk, display: "inline-flex", alignItems: "center", gap: 0.3 }}><CheckCircleIcon sx={{ fontSize: 13 }} /> {s.connected}</Box>
                <Box sx={{ ml: "auto" }}><GhostBtn>{s.manage}</GhostBtn></Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, background: C.inset, border: `1px solid ${C.border}`, borderRadius: "9px", p: 1 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: "6px", background: "#003087", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, color: "#fff" }}>P</Box>
                <Box sx={{ fontSize: 13, fontWeight: 600 }}>PayPal</Box>
                <Box sx={{ fontSize: 11, color: C.sub }}>{s.canConnect}</Box>
                <Box sx={{ ml: "auto" }}><GhostBtn>{s.connect}</GhostBtn></Box>
              </Box>
            </Box>
            <Box sx={{ mt: 1.3 }}>
              {s.payRows.map((r, i) => (
                <Box key={r[0]} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.6, fontSize: 13, borderBottom: `1px solid ${C.border}` }}>
                  <Box sx={{ color: C.sub }}>{r[0]}</Box>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
                    {i === 2 ? feeLabel : r[1]}
                    {i < 2 && <CheckCircleIcon sx={{ fontSize: 15, color: C.green }} />}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box component="button" sx={{ mt: 1.5, width: "100%", font: "inherit", fontWeight: 700, fontSize: 13.5, color: "#0a0d13", cursor: "pointer",
              background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, border: "none", borderRadius: "10px", py: 1.1 }}>
              {s.managePay}
            </Box>
          </Panel>
        </Box>

        {/* ══════════ HØYRE KOLONNE ══════════ */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Partnerstatus */}
          <Panel>
            <SectionLabel action={<GhostBtn>{s.seeHistory}</GhostBtn>}>{s.lblPartnerStatus}</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Box sx={{ width: 92, height: 92, borderRadius: "50%", flex: "none", background: ring, display: "grid", placeItems: "center" }}>
                <Box sx={{ width: 72, height: 72, borderRadius: "50%", background: C.panel, display: "grid", placeItems: "center", textAlign: "center" }}>
                  <Box>
                    <Box sx={{ fontSize: 20, fontWeight: 800 }}>{PROGRESS}%</Box>
                    <Box sx={{ fontSize: 10, color: C.sub }}>{s.completed}</Box>
                  </Box>
                </Box>
              </Box>
              <Box>
                <Box sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>{s.wellOnWay}</Box>
                <Box sx={{ fontSize: 12, color: C.sub, lineHeight: 1.45 }}>{s.wellOnWaySub}</Box>
              </Box>
            </Box>
            <Box sx={{ mt: 1.5, color: C.accent, fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}>
              {s.nextStep} <ArrowForwardIcon sx={{ fontSize: 15 }} />
            </Box>
          </Panel>

          {/* Compliance-oversikt */}
          <Panel>
            <SectionLabel>{s.lblCompliance}</SectionLabel>
            {complianceRows.map((r) => (
              <Box key={r.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.8, borderBottom: `1px solid ${C.border}` }}>
                <Box sx={{ fontSize: 13 }}>
                  {r.label}
                  {r.sub && <Box component="span" sx={{ color: C.faint, fontSize: 11, ml: 1 }}>{r.sub}</Box>}
                </Box>
                {r.ok === "ok" ? (
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, color: C.greenInk, fontSize: 12.5, fontWeight: 600 }}><CheckCircleIcon sx={{ fontSize: 16 }} /> {s.approved}</Box>
                ) : (
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, color: C.amber, fontSize: 12.5, fontWeight: 600 }}><WarningAmberIcon sx={{ fontSize: 16 }} /> {s.partial}</Box>
                )}
              </Box>
            ))}
          </Panel>

          {/* Partnernivåer */}
          <Panel>
            <SectionLabel action={<GhostBtn>{s.seeBenefits}</GhostBtn>}>{s.lblTiers}</SectionLabel>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {tierNames.map((name, i) => {
                const active = i === activeTierIdx;
                return (
                  <Box key={name} sx={{ display: "flex", alignItems: "center", gap: 1.2, p: 1, borderRadius: "10px",
                    background: active ? "linear-gradient(180deg, rgba(245,166,35,0.12), transparent)" : "transparent",
                    border: `1px solid ${active ? C.borderHi : "transparent"}` }}>
                    <Box sx={{ color: active ? C.accent : C.faint, display: "grid", placeItems: "center", "& svg": { fontSize: 22 } }}>{tierIcons[i]}</Box>
                    <Box sx={{ flex: 1 }}><Box sx={{ fontSize: 13, fontWeight: 700 }}>{name}</Box></Box>
                    <Box sx={{ fontSize: 11, color: C.sub, textAlign: "right", maxWidth: 140 }}>{s.tierDesc[i]}</Box>
                  </Box>
                );
              })}
            </Box>
          </Panel>

          {/* Hvorfor bli partner */}
          <Panel>
            <SectionLabel>{s.lblWhy}</SectionLabel>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              {s.why.map((w, i) => (
                <Box key={w[0]}>
                  <Box sx={{ color: C.accent, mb: 0.5, "& svg": { fontSize: 22 } }}>{whyIcons[i]}</Box>
                  <Box sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, mb: 0.4 }}>{w[0]}</Box>
                  <Box sx={{ fontSize: 11, color: C.sub, lineHeight: 1.4 }}>{w[1]}</Box>
                </Box>
              ))}
            </Box>
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}
