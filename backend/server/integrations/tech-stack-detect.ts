/**
 * tech-stack-detect.ts — plattform-fingeravtrykk + kanal-riktige
 * oppsett-instruksjoner (Daniels idé: «finn ut hva slags kodesystem som
 * er brukt, f.eks. Lovable, og kom med riktige prompter»).
 *
 * Deterministisk signatur-matching mot HTML + svar-headere — hver
 * deteksjon bærer evidensen sin (hvilke signaler som traff), aldri
 * gjetting. Poenget nedstrøms: installasjonsKANALEN følger plattformen:
 *
 *   - AI-byggere (Lovable, Bolt, v0): instruksen ER en prompt som limes
 *     rett i builder-chatten — med snippeten innbakt.
 *   - Site-byggere (Wix, Squarespace, Webflow, Shopify): klikk-sti til
 *     «Custom code»-innstillingen — koden røres aldri direkte.
 *   - CMS (WordPress): plugin eller hook.
 *   - Rammeverk (Next/Vite/…): utvikler-instruks mot index/layout.
 */

export type StackCategory = "ai_builder" | "site_builder" | "cms" | "framework" | "unknown";

export interface TechStack {
  key: string;
  label: string;
  category: StackCategory;
  /** Signalene som traff — deteksjonen skal kunne verifiseres. */
  evidence: string[];
}

interface StackSignature {
  key: string;
  label: string;
  category: StackCategory;
  /** [beskrivelse, test] — test kjøres mot html (h) og headere (hd). */
  signals: Array<[string, (h: string, hd: Record<string, string>) => boolean]>;
}

const header = (hd: Record<string, string>, name: string): string => hd[name] ?? "";

/** Rekkefølgen er presedens: mest spesifikke signaturer først. */
const SIGNATURES: StackSignature[] = [
  {
    key: "lovable",
    label: "Lovable",
    category: "ai_builder",
    signals: [
      ["lovable.app-host eller lovable-prosjektreferanse", (h) => /lovable\.app|lovable-uploads|lovableproject\.com/i.test(h)],
      ["gptengineer-scriptet (Lovables badge/runtime)", (h) => /cdn\.gpteng\.co|gptengineer/i.test(h)],
      ["generator-meta Lovable", (h) => /<meta[^>]+content=["'][^"']*lovable/i.test(h)],
    ],
  },
  {
    key: "bolt",
    label: "Bolt.new",
    category: "ai_builder",
    signals: [["bolt.new-referanse", (h) => /bolt\.new|stackblitz/i.test(h)]],
  },
  {
    key: "framer",
    label: "Framer",
    category: "site_builder",
    signals: [
      ["framerusercontent-assets", (h) => /framerusercontent\.com|framer\.com\/m\//i.test(h)],
      ["generator-meta Framer", (h) => /<meta[^>]+generator[^>]+Framer/i.test(h)],
    ],
  },
  {
    key: "webflow",
    label: "Webflow",
    category: "site_builder",
    signals: [
      ["data-wf-domain/webflow.js", (h) => /data-wf-domain|webflow\.js|assets\.website-files\.com/i.test(h)],
      ["generator-meta Webflow", (h) => /<meta[^>]+generator[^>]+Webflow/i.test(h)],
    ],
  },
  {
    key: "wix",
    label: "Wix",
    category: "site_builder",
    signals: [
      ["wixstatic/wixsite-assets", (h) => /wixstatic\.com|wixsite\.com|wix-code/i.test(h)],
      ["X-Wix-headere", (_h, hd) => Object.keys(hd).some((k) => k.startsWith("x-wix"))],
    ],
  },
  {
    key: "squarespace",
    label: "Squarespace",
    category: "site_builder",
    signals: [
      ["squarespace-assets/config", (h) => /squarespace\.com|squarespace-cdn|Static\.SQUARESPACE_CONTEXT/i.test(h)],
    ],
  },
  {
    key: "shopify",
    label: "Shopify",
    category: "site_builder",
    signals: [
      ["cdn.shopify/Shopify-objektet", (h) => /cdn\.shopify\.com|Shopify\.theme/i.test(h)],
      ["x-shopid-header", (_h, hd) => Boolean(header(hd, "x-shopid") || header(hd, "x-shopify-stage"))],
    ],
  },
  {
    key: "wordpress",
    label: "WordPress",
    category: "cms",
    signals: [
      ["wp-content/wp-json-stier", (h) => /\/wp-content\/|\/wp-json|\/wp-includes\//i.test(h)],
      ["generator-meta WordPress", (h) => /<meta[^>]+generator[^>]+WordPress/i.test(h)],
    ],
  },
  {
    key: "nextjs",
    label: "Next.js",
    category: "framework",
    signals: [
      ["__NEXT_DATA__/_next-assets", (h) => /__NEXT_DATA__|\/_next\//i.test(h)],
    ],
  },
  {
    key: "vite_spa",
    label: "Vite/React SPA",
    category: "framework",
    signals: [
      ["vite-bundle + rot-element", (h) => /\/assets\/index-[a-z0-9]+\.js/i.test(h) && /<div id=["']root["']/i.test(h)],
    ],
  },
];

export function detectTechStack(html: string, headers: Record<string, string> = {}): TechStack {
  for (const sig of SIGNATURES) {
    const hits = sig.signals.filter(([, test]) => test(html, headers)).map(([label]) => label);
    if (hits.length > 0) {
      return { key: sig.key, label: sig.label, category: sig.category, evidence: hits };
    }
  }
  return { key: "unknown", label: "Ukjent plattform", category: "unknown", evidence: [] };
}

/** Gjenskap stack fra nøkkel (endepunkter som får platformKey fra UI). */
export function stackFromKey(key: string): TechStack {
  const sig = SIGNATURES.find((s) => s.key === key);
  if (!sig) return { key: "unknown", label: "Ukjent plattform", category: "unknown", evidence: [] };
  return { key: sig.key, label: sig.label, category: sig.category, evidence: [] };
}

export const KNOWN_STACKS: Array<{ key: string; label: string }> = [
  ...SIGNATURES.map((s) => ({ key: s.key, label: s.label })),
  { key: "unknown", label: "Ukjent/annet" },
];

// ─────────────────────────────────────────────────────────────────────
// Kanal-riktige instruksjoner
// ─────────────────────────────────────────────────────────────────────

export type InstallChannel = "builder_prompt" | "settings_ui" | "code";

export interface InstallInstructions {
  channel: InstallChannel;
  title: string;
  steps: string[];
  /** Ferdig prompt for AI-byggere — limes rett i builder-chatten. */
  builderPrompt: string | null;
}

/** Bygg instruksjoner for å få snippet + ev. GSC-metatag inn på siden. */
export function buildInstallInstructions(
  stack: TechStack,
  opts: { snippet?: string | null; gscMetaTag?: string | null },
): InstallInstructions {
  const blocks: string[] = [];
  if (opts.gscMetaTag) blocks.push(opts.gscMetaTag);
  if (opts.snippet) blocks.push(opts.snippet);
  const combined = blocks.join("\n\n");

  if (stack.category === "ai_builder") {
    const prompt = [
      `Legg følgende ${opts.gscMetaTag && opts.snippet ? "metatag og script-blokk" : opts.gscMetaTag ? "metatag" : "script-blokk"} inn i <head> i index.html.`,
      "Ikke endre noe av innholdet i blokken — ID-er og rekkefølge skal beholdes nøyaktig som de står.",
      "Ikke legg til andre analytics-verktøy, og ikke pakk koden inn i egne consent-løsninger — blokken håndterer samtykke selv via window.applyConsent.",
      "",
      combined || "[lim inn snippet fra Analytics-oppsett-panelet her]",
    ].join("\n");
    return {
      channel: "builder_prompt",
      title: `${stack.label}: lim denne prompten i builder-chatten`,
      steps: [
        `Åpne prosjektet i ${stack.label} og lim prompten under inn i chatten.`,
        "Verifiser i preview at blokken ligger i <head> (vis kildekode).",
        "Publiser, og kjør site-auditen på nytt som kvittering.",
      ],
      builderPrompt: prompt,
    };
  }

  if (stack.category === "site_builder") {
    const path: Record<string, string> = {
      webflow: "Site settings → Custom code → Head code",
      wix: "Settings → Custom code → «Add custom code» (Head, alle sider)",
      squarespace: "Settings → Advanced → Code injection → Header",
      shopify: "Online Store → Themes → Edit code → theme.liquid (i <head>)",
      framer: "Site settings → General → Custom code → Start of <head>",
    };
    return {
      channel: "settings_ui",
      title: `${stack.label}: lim koden inn i Custom code-innstillingen`,
      steps: [
        `Gå til ${path[stack.key] ?? "plattformens Custom code-innstilling for <head>"}.`,
        "Lim inn blokken(e) under, lagre og publiser.",
        "NB: enkelte planer krever betalt abonnement for custom code.",
        "Kjør site-auditen på nytt som kvittering.",
      ],
      builderPrompt: null,
    };
  }

  if (stack.key === "wordpress") {
    return {
      channel: "code",
      title: "WordPress: header-injeksjon via plugin eller tema",
      steps: [
        "Enklest: plugin av typen «insert headers and footers» → lim blokken(e) i Header-feltet.",
        "Alternativt for utvikler: wp_head-hook i child-temaets functions.php.",
        "Unngå å redigere temaets header.php direkte — overskrives ved oppdatering.",
        "Kjør site-auditen på nytt som kvittering.",
      ],
      builderPrompt: null,
    };
  }

  return {
    channel: "code",
    title: `${stack.category === "framework" ? stack.label : "Ukjent plattform"}: legg blokken i <head> i kildekoden`,
    steps: [
      stack.key === "nextjs"
        ? "Next.js: legg blokken i app/layout (head) eller pages/_document."
        : "Legg blokken i <head> i index.html/rot-malen.",
      "Deploy, og kjør site-auditen på nytt som kvittering.",
    ],
    builderPrompt: null,
  };
}
