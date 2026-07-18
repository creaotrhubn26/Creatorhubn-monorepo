/**
 * analytics-bootstrap.ts — F2 «generate_analytics_bootstrap» +
 * F3 «generate_event_plan» (doc 14, del 2)
 *
 * F3 er en DETERMINISTISK katalog: forretningsmål → navngitte GA4-events,
 * key-event-anbefaling og Meta-standardevent-mapping (samme bro som vår
 * egen META_STANDARD_EVENT_MAP i ga4-client-tracking.ts). Ingen LLM —
 * event-taksonomi skal være forutsigbar og lik hver gang.
 *
 * F2 renderer én selvstendig HTML-blokk etter mønsteret i vårt eget
 * index.html-bootstrap: consent-gatet lasting med analytics/marketing-
 * skille (Meta Pixel krever MARKETING-samtykke — strengere enn analytics),
 * tom ID = ikke last, window.trackEvent → gtag + fbq i ett kall.
 *
 * Redelighet: snippeten later aldri som den er en CMP. Consent-koblingen
 * er eksplisitt (window.applyConsent kalles fra kundens banner/CMP), og
 * notatene sier hva som IKKE er dekket (GTM-publisering, key events i
 * GA4-UI, purchase-låsen).
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// F3: Event-plan (deterministisk katalog)
// ─────────────────────────────────────────────────────────────────────

export const BUSINESS_GOALS = ["lead", "booking", "purchase", "signup", "newsletter"] as const;
export type BusinessGoal = (typeof BUSINESS_GOALS)[number];

export interface PlannedEvent {
  ga4Event: string;
  /** Skal markeres som key event i GA4-UI (purchase er system-låst). */
  keyEvent: boolean;
  /** Meta-standardevent den brolegges til (null = kun GA4). */
  metaEvent: string | null;
  /** Når skal eventet fyres? Menneskelig beskrivelse til implementasjonen. */
  trigger: string;
  /** Felt som bør sendes med (value/currency for kjøp). */
  params: string[];
}

const GOAL_CATALOG: Record<BusinessGoal, PlannedEvent[]> = {
  lead: [
    {
      ga4Event: "lead_submitted", keyEvent: true, metaEvent: "Lead",
      trigger: "Kontakt-/leadskjema sendt inn (etter validering, før takkeside).",
      params: ["form_id"],
    },
  ],
  booking: [
    {
      ga4Event: "book_demo_clicked", keyEvent: false, metaEvent: "Lead",
      trigger: "Klikk på «book demo/møte»-CTA (intensjon).",
      params: ["cta_location"],
    },
    {
      ga4Event: "book_demo_submitted", keyEvent: true, metaEvent: "Lead",
      trigger: "Bookingskjema fullført/kalendertid valgt.",
      params: [],
    },
  ],
  purchase: [
    {
      ga4Event: "begin_checkout", keyEvent: false, metaEvent: "InitiateCheckout",
      trigger: "Kunden starter utsjekk.",
      params: ["value", "currency"],
    },
    {
      ga4Event: "purchase", keyEvent: true, metaEvent: "Purchase",
      trigger: "Betaling bekreftet (kvitteringsside/webhook-bekreftelse).",
      params: ["value", "currency", "transaction_id"],
    },
  ],
  signup: [
    {
      ga4Event: "signup_completed", keyEvent: true, metaEvent: "CompleteRegistration",
      trigger: "Konto opprettet og bekreftet.",
      params: [],
    },
  ],
  newsletter: [
    {
      // Meta «Subscribe» er for betalte abonnement — nyhetsbrev er Lead.
      ga4Event: "newsletter_subscribed", keyEvent: false, metaEvent: "Lead",
      trigger: "Nyhetsbrev-påmelding bekreftet.",
      params: [],
    },
  ],
};

export function buildEventPlan(goals: BusinessGoal[]): PlannedEvent[] {
  const seen = new Set<string>();
  const plan: PlannedEvent[] = [];
  for (const goal of goals) {
    for (const ev of GOAL_CATALOG[goal] ?? []) {
      if (seen.has(ev.ga4Event)) continue;
      seen.add(ev.ga4Event);
      plan.push(ev);
    }
  }
  return plan;
}

// ─────────────────────────────────────────────────────────────────────
// F2: Snippet-generator
// ─────────────────────────────────────────────────────────────────────

export const bootstrapInputSchema = z
  .object({
    ga4MeasurementId: z.string().regex(/^G-[A-Z0-9]{4,14}$/, "ugyldig GA4-ID (G-…)").optional(),
    gtmId: z.string().regex(/^GTM-[A-Z0-9]{4,10}$/, "ugyldig GTM-ID (GTM-…)").optional(),
    clarityProjectId: z.string().regex(/^[a-z0-9]{6,20}$/, "ugyldig Clarity-ID").optional(),
    metaPixelId: z.string().regex(/^\d{8,20}$/, "ugyldig pixel-ID (kun sifre)").optional(),
    consentMode: z.enum(["gated", "always"]).default("gated"),
    goals: z.array(z.enum(BUSINESS_GOALS)).default([]),
  })
  .strict()
  // Minst én ID (snippet) ELLER minst ett mål (ren event-plan, F3 alene —
  // chat-verktøyet generate_event_plan trenger planen uten IDer).
  .refine((v) => v.ga4MeasurementId || v.gtmId || v.clarityProjectId || v.metaPixelId || v.goals.length > 0, {
    message: "minst_en_id_eller_mal_kreves",
  });

export type BootstrapInput = z.infer<typeof bootstrapInputSchema>;

export interface BootstrapResult {
  snippet: string;
  eventPlan: PlannedEvent[];
  /** Det som IKKE dekkes av snippeten — må gjøres i plattform-UI (F4). */
  notes: string[];
}

export function renderAnalyticsBootstrap(input: BootstrapInput): BootstrapResult {
  const eventPlan = buildEventPlan(input.goals);
  const metaMap = Object.fromEntries(
    eventPlan.filter((e) => e.metaEvent).map((e) => [e.ga4Event, e.metaEvent]),
  );

  const lines: string[] = [];
  lines.push("<!-- Analytics-bootstrap — generert av The Role Room (doc 14 F2).");
  lines.push("     Consent-gatet: kall window.applyConsent({analytics, marketing})");
  lines.push("     fra cookie-banneret/CMP-en. Ingenting lastes før samtykke. -->");
  lines.push("<script>");
  lines.push("(function () {");
  lines.push("  var CONFIG = {");
  lines.push(`    ga4: ${JSON.stringify(input.ga4MeasurementId ?? "")},`);
  lines.push(`    gtm: ${JSON.stringify(input.gtmId ?? "")},`);
  lines.push(`    clarity: ${JSON.stringify(input.clarityProjectId ?? "")},`);
  lines.push(`    metaPixel: ${JSON.stringify(input.metaPixelId ?? "")}`);
  lines.push("  };");
  lines.push("  var loaded = { analytics: false, marketing: false };");
  lines.push("  function addScript(src) {");
  lines.push("    var s = document.createElement('script');");
  lines.push("    s.async = true; s.src = src;");
  lines.push("    document.head.appendChild(s);");
  lines.push("  }");
  lines.push("  function loadAnalytics() {");
  lines.push("    if (loaded.analytics) return; loaded.analytics = true;");
  lines.push("    if (CONFIG.ga4) {");
  lines.push("      window.dataLayer = window.dataLayer || [];");
  lines.push("      window.gtag = window.gtag || function () { dataLayer.push(arguments); };");
  lines.push("      gtag('js', new Date());");
  lines.push("      gtag('config', CONFIG.ga4);");
  lines.push("      addScript('https://www.googletagmanager.com/gtag/js?id=' + CONFIG.ga4);");
  lines.push("    }");
  lines.push("    if (CONFIG.gtm) {");
  lines.push("      window.dataLayer = window.dataLayer || [];");
  lines.push("      dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });");
  lines.push("      addScript('https://www.googletagmanager.com/gtm.js?id=' + CONFIG.gtm);");
  lines.push("    }");
  lines.push("    if (CONFIG.clarity) {");
  lines.push("      window.clarity = window.clarity || function () { (clarity.q = clarity.q || []).push(arguments); };");
  lines.push("      addScript('https://www.clarity.ms/tag/' + CONFIG.clarity);");
  lines.push("    }");
  lines.push("  }");
  lines.push("  function loadMarketing() {");
  lines.push("    if (loaded.marketing) return; loaded.marketing = true;");
  lines.push("    if (CONFIG.metaPixel) {");
  lines.push("      if (!window.fbq) {");
  lines.push("        var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };");
  lines.push("        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];");
  lines.push("        addScript('https://connect.facebook.net/en_US/fbevents.js');");
  lines.push("      }");
  lines.push("      fbq('init', CONFIG.metaPixel);");
  lines.push("      fbq('track', 'PageView');");
  lines.push("    }");
  lines.push("  }");
  lines.push(`  var META_EVENT_MAP = ${JSON.stringify(metaMap)};`);
  lines.push("  window.trackEvent = function (name, params) {");
  lines.push("    params = params || {};");
  lines.push("    // Meta først: fbq finnes kun ved marketing-samtykke — try/catch, aldri blokkér GA4.");
  lines.push("    try {");
  lines.push("      if (window.fbq && loaded.marketing && META_EVENT_MAP[name]) {");
  lines.push("        var v = params.value != null ? params.value : (params.amount != null ? params.amount : params.price);");
  lines.push("        fbq('track', META_EVENT_MAP[name], v != null ? { value: v, currency: params.currency || 'NOK' } : {});");
  lines.push("      }");
  lines.push("    } catch (e) {}");
  lines.push("    try { if (window.gtag) gtag('event', name, params); } catch (e) {}");
  lines.push("  };");
  lines.push("  window.applyConsent = function (consent) {");
  lines.push("    consent = consent || {};");
  lines.push("    if (consent.analytics) loadAnalytics();");
  lines.push("    if (consent.marketing) loadMarketing();");
  lines.push("  };");
  if (input.consentMode === "always") {
    lines.push("  // consentMode=always: kun for markeder/oppsett uten samtykkekrav.");
    lines.push("  loadAnalytics();");
    lines.push("  loadMarketing();");
  } else {
    lines.push("  // Gated: ingenting lastes før window.applyConsent kalles fra banneret.");
  }
  lines.push("})();");
  lines.push("</script>");

  const notes: string[] = [
    "Koble CMP-en/banneret til window.applyConsent({analytics: bool, marketing: bool}) — Meta Pixel krever marketing-samtykke (strengere enn analytics).",
  ];
  if (input.gtmId) {
    notes.push("GTM-containeren må ha en PUBLISERT versjon — en upublisert container serverer ingenting.");
  }
  const keyEvents = eventPlan.filter((e) => e.keyEvent).map((e) => e.ga4Event);
  if (keyEvents.length > 0) {
    notes.push(`Marker som key events i GA4-UI: ${keyEvents.join(", ")}. NB: «purchase» er system-låst i GA4 og kan ikke av-markeres.`);
  }
  if (input.metaPixelId) {
    notes.push("Pixelen er KOBLET, ikke aktivert for annonser — oppsett og kampanje-aktivering er separate beslutninger.");
  }
  notes.push("Verifiser etterpå med site-auditen (F1) + GA4 DebugView.");

  return { snippet: lines.join("\n"), eventPlan, notes };
}
