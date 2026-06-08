/**
 * client-ads-discovery-service.ts
 *
 * B1: Site Discovery Service for The Role Room Agent.
 *
 * Innholdsprodusent gir Agent en klient-URL. Tjenesten:
 *   1. Fetcher klientens hovedside + sitemap + robots.txt
 *   2. Ekstraherer struktur-data (meta, schema.org, forms, CTAs, tracking-IDs)
 *   3. Spør Claude (Sonnet) om å analysere bransje + foreslå conversion-actions
 *   4. Returnerer structured discovery-resultat for review i Agent UI
 *
 * Claude's oppgave er todelt:
 *   a) Identifisere bransje (e-commerce / SaaS / restaurant / etc.)
 *   b) Foreslå 3-7 conversion-actions med navn / kategori / value / trigger
 *
 * Forslag lagres ikke automatisk — producer reviewer og tilpasser før
 * vi caller Google Ads API for å auto-opprette dem (B3).
 */

import Anthropic from "@anthropic-ai/sdk";

interface DiscoveryRequest {
  url: string;
  clientName?: string;
}

interface PageSnapshot {
  url: string;
  finalUrl: string | null;
  httpStatus: number;
  title: string | null;
  metaDescription: string | null;
  ogType: string | null;
  ogTitle: string | null;
  detectedGtagIds: string[];      // G-XXX, AW-XXX, GTM-XXX
  formCount: number;
  formActions: string[];
  structuredDataTypes: string[];  // ['Organization', 'SoftwareApplication', etc.]
  cta_phrases: string[];          // Detekterte CTA-tekster
  htmlBytes: number;
}

export interface SuggestedAction {
  action_name: string;
  display_name: string;
  goal_category:
    | "purchase" | "add_to_cart" | "begin_checkout"
    | "submit_lead_form" | "book_appointment" | "sign_up" | "subscribe"
    | "request_quote" | "contact" | "page_view" | "outbound_click" | "other";
  default_value: number;
  currency: string;
  trigger_type: "page_load" | "form_submit" | "click" | "event" | "outbound" | "manual";
  url_pattern?: string;
  trigger_config?: Record<string, unknown>;
  claude_reasoning: string;
}

export interface DiscoveryResult {
  url: string;
  fetched_at: string;
  business_type: string;            // 'ecommerce' | 'saas' | 'healthtech' | etc.
  business_subcategory: string;     // 'b2b-saas-for-clinics' | 'fashion-ecommerce' | etc.
  business_summary: string;         // Klar setning på norsk om hva klienten driver med
  detected_gtag_id: string | null;
  detected_gtm_id: string | null;
  page_snapshot: PageSnapshot;
  suggested_actions: SuggestedAction[];
  notes: string[];                  // Generelle merknader fra Claude
  warnings: string[];               // F.eks. "Site er SPA — vi ser bare meta-tags"
}

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "TheRoleRoomAgent/1.0 (+https://theroleroom.com; ads-discovery)";

/** Trekk ut meta-tag content. */
function extractMeta(html: string, name: string, isProperty = false): string | null {
  const attr = isProperty ? "property" : "name";
  const re = new RegExp(
    `<meta[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

/** Trekk ut tracking-IDer (GA4, Google Ads, GTM). */
function extractTrackingIds(html: string): string[] {
  const re = /G-[A-Z0-9]{8,}|AW-\d{8,}|GTM-[A-Z0-9]{5,}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[0]);
  return Array.from(out);
}

/** Detekter schema.org-typer i JSON-LD. */
function extractStructuredDataTypes(html: string): string[] {
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  const types = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]);
      const stack: unknown[] = Array.isArray(json) ? json : [json];
      while (stack.length) {
        const node = stack.pop();
        if (node && typeof node === "object") {
          const t = (node as Record<string, unknown>)["@type"];
          if (typeof t === "string") types.add(t);
          else if (Array.isArray(t)) t.forEach((v) => typeof v === "string" && types.add(v));
          for (const v of Object.values(node)) {
            if (v && typeof v === "object") stack.push(v);
          }
        }
      }
    } catch { /* ignore parse errors */ }
  }
  return Array.from(types);
}

/** Trekk ut form-action attributter. */
function extractForms(html: string): string[] {
  const re = /<form[^>]*action=["']([^"']+)["']/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return Array.from(out);
}

/** Detekter conversion-relaterte CTA-tekster (button + a). */
function extractCTAPhrases(html: string): string[] {
  const re = />\s*([A-Za-zæøåÆØÅ][A-Za-zæøåÆØÅ\s!?-]{1,40}(?:Book|Kjøp|Buy|Order|Bestill|Kontakt|Tilbud|Quote|Demo|Sign\s?up|Registrer|P[åa]meld|Trial|Pr[øo]v|Last\s?ned|Download)[A-Za-zæøåÆØÅ\s!?-]{0,30})\s*</gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = m[1].trim();
    if (t.length >= 3 && t.length <= 60) out.add(t);
  }
  return Array.from(out).slice(0, 25); // limit
}

/** Hent klient-URL med timeout + følg redirects. */
async function fetchPage(url: string): Promise<PageSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    const finalUrl = r.url;
    const html = await r.text();
    const trackingIds = extractTrackingIds(html);
    return {
      url,
      finalUrl: finalUrl !== url ? finalUrl : null,
      httpStatus: r.status,
      title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null,
      metaDescription: extractMeta(html, "description"),
      ogType: extractMeta(html, "og:type", true),
      ogTitle: extractMeta(html, "og:title", true),
      detectedGtagIds: trackingIds,
      formCount: (html.match(/<form\b/gi) ?? []).length,
      formActions: extractForms(html),
      structuredDataTypes: extractStructuredDataTypes(html),
      cta_phrases: extractCTAPhrases(html),
      htmlBytes: html.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Sjekk om Anthropic API er tilgjengelig. */
function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/** Bygg Claude-prompt og trekk ut JSON. */
async function askClaudeForActions(
  snapshot: PageSnapshot,
  clientName: string | undefined,
): Promise<{
  business_type: string;
  business_subcategory: string;
  business_summary: string;
  suggested_actions: SuggestedAction[];
  notes: string[];
  warnings: string[];
}> {
  const client = getAnthropicClient();
  if (!client) {
    return {
      business_type: "unknown",
      business_subcategory: "unknown",
      business_summary: "ANTHROPIC_API_KEY mangler — kan ikke analysere.",
      suggested_actions: [],
      notes: [],
      warnings: ["Anthropic API ikke konfigurert. Sett ANTHROPIC_API_KEY på serveren."],
    };
  }

  const prompt = `Du er en norsk Google Ads-spesialist som hjelper innholdsprodusenter
sette opp riktig conversion-tracking for deres klienter.

Klientens side-snapshot:
- URL: ${snapshot.url}${snapshot.finalUrl ? ` (redirects til ${snapshot.finalUrl})` : ""}
- HTTP: ${snapshot.httpStatus}
- Klient-navn (oppgitt av producer): ${clientName ?? "ikke oppgitt"}
- Tittel: ${snapshot.title ?? "(ingen)"}
- Meta-beskrivelse: ${snapshot.metaDescription ?? "(ingen)"}
- OpenGraph type: ${snapshot.ogType ?? "(ingen)"}
- OpenGraph tittel: ${snapshot.ogTitle ?? "(ingen)"}
- Detekterte tracking-IDer: ${snapshot.detectedGtagIds.join(", ") || "(ingen)"}
- Antall forms: ${snapshot.formCount}
- Form-actions: ${snapshot.formActions.join(", ") || "(ingen)"}
- Schema.org-typer: ${snapshot.structuredDataTypes.join(", ") || "(ingen)"}
- CTA-fraser detektert: ${snapshot.cta_phrases.join(" | ") || "(ingen)"}
- HTML-størrelse: ${snapshot.htmlBytes} bytes ${snapshot.htmlBytes < 5000 ? "(MULIG SPA — JS rendrer alt klientside)" : ""}

Oppgave:
1. Bestem business_type (ETT av: 'ecommerce', 'saas', 'healthtech', 'fintech',
   'restaurant', 'consulting', 'real_estate', 'education', 'media', 'agency',
   'manufacturing', 'nonprofit', 'other')
2. Bestem business_subcategory (kort: 'b2b-saas-for-clinics', 'fashion-ecommerce',
   'norwegian-restaurant', 'consulting-leadership', etc.)
3. Skriv business_summary (1-2 setninger på norsk om hva klienten driver med)
4. Foreslå 3-7 conversion-actions tilpasset KLIENTENS bransje (ikke generiske)
5. Lever notes (innsikt) og warnings (gjenstander å være obs på)

For hver suggested_action:
- action_name: snake_case (f.eks. 'patient_signup', 'product_purchase')
- display_name: lesbar tekst på norsk (f.eks. "Pasient-registrering")
- goal_category: ETT av Google Ads-godkjente kategorier:
  'purchase', 'add_to_cart', 'begin_checkout', 'submit_lead_form',
  'book_appointment', 'sign_up', 'subscribe', 'request_quote', 'contact',
  'page_view', 'outbound_click', 'other'
- default_value: realistisk NOK-verdi som proxy for LTV i klientens bransje
- currency: 'NOK' (default for norsk marked)
- trigger_type: 'page_load' | 'form_submit' | 'click' | 'event'
- url_pattern (optional): URL-glob f.eks. '/takk-for-bestillingen*'
- claude_reasoning: 1 setning på norsk om hvorfor denne action er viktig for klienten

VIKTIG: Returner KUN ren JSON. Ingen markdown. Ingen forklaring utenfor JSON.
Format:
{
  "business_type": "...",
  "business_subcategory": "...",
  "business_summary": "...",
  "suggested_actions": [ { ... } ],
  "notes": ["...", "..."],
  "warnings": ["..."]
}`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? (textBlock as { text: string }).text.trim() : "";
  // Trim potential ```json fences
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: ReturnType<typeof askClaudeForActions> extends Promise<infer R> ? R : never;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return {
      business_type: "unknown",
      business_subcategory: "unknown",
      business_summary: "Claude returnerte ugyldig JSON — prøv igjen.",
      suggested_actions: [],
      notes: [],
      warnings: [`Parse-feil: ${(e as Error).message}`, `Råstart: ${raw.slice(0, 200)}`],
    };
  }
  return parsed;
}

/** Hovedfunksjon: discovery for én klient-URL. */
export async function discoverClientSite(
  req: DiscoveryRequest,
): Promise<DiscoveryResult> {
  const snapshot = await fetchPage(req.url);
  const claudeOutput = await askClaudeForActions(snapshot, req.clientName);

  const gtag = snapshot.detectedGtagIds.find((id) => id.startsWith("G-")) ?? null;
  const gtm = snapshot.detectedGtagIds.find((id) => id.startsWith("GTM-")) ?? null;

  return {
    url: req.url,
    fetched_at: new Date().toISOString(),
    business_type: claudeOutput.business_type,
    business_subcategory: claudeOutput.business_subcategory,
    business_summary: claudeOutput.business_summary,
    detected_gtag_id: gtag,
    detected_gtm_id: gtm,
    page_snapshot: snapshot,
    suggested_actions: claudeOutput.suggested_actions,
    notes: claudeOutput.notes,
    warnings: claudeOutput.warnings,
  };
}
