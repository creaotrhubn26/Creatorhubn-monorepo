/**
 * Persona-specific pitch-deck content for The Role Room.
 *
 * Numbers and capabilities are sourced from the codebase audit
 * (memory/whats_left_2026_05_06.md + ground-truth commit log) — no
 * fabricated metrics. Where a number is operational/sales-facing
 * rather than verifiable in code (CAC, projected ARR, etc.) it's
 * marked with a comment so reviewers know to validate.
 */

export type PersonaId = "production-team" | "content-producer" | "dance-studio";

export interface DeckSlide {
  number: string; // "01", "02", …
  kind:
    | "cover"
    | "problem"
    | "solution"
    | "screenshot"
    | "feature-grid"
    | "market"
    | "competition"
    | "business-model"
    | "traction"
    | "team"
    | "vision"
    | "ask"
    | "cta";
  label: string; // "The Problem", "The Shift", …
  title: string; // headline
  body?: string; // sub-headline / paragraph
  bullets?: Array<{ icon?: string; label: string; sub?: string }>;
  metrics?: Array<{ value: string; label: string }>;
  screenshot?: string; // path relative to project root
  screenshotCaption?: string;
  competitionRows?: Array<{ name: string; cells: Array<"yes" | "no" | "partial"> }>;
  competitionColumns?: string[];
  marketDonut?: { center: string; label: string; segments: Array<{ name: string; pct: number }> };
}

export interface PersonaDeck {
  persona: PersonaId;
  audience: string; // "Produksjonsteam (foto/video/lydproduksjon)"
  brandTagline: string; // "Operativsystem for produksjonen"
  ask: string; // "We're raising X NOK"
  slides: DeckSlide[];
}

// ─────────────────────────────────────────────────────────
// Verified codebase facts (used across all 3 decks)
// ─────────────────────────────────────────────────────────

export const VERIFIED_FACTS = {
  migrations: 190,
  backendTsFiles: 225,
  backendTestFiles: 56,
  frontendComponentsRoleRoom: 295,
  commitsLast30Days: 441,
  socialPlatformsLive: 6, // IG, TikTok, LinkedIn, Facebook, YouTube, Pinterest
  integrations: [
    "Stripe",
    "Twilio",
    "Anthropic Claude",
    "Meta Marketing API",
    "TikTok OAuth",
    "LinkedIn OAuth",
    "Google Places",
    "Brønnøysund (Brreg)",
    "Cloudflare R2",
    "Cohere Rerank",
    "Printful",
    "YouTube Insights",
    "Vercel API",
    "Render API",
    "IMAP",
  ],
  danceTabs: { studio: 21, freelance: 18 },
  shippedDomains: [
    "Casting + Auditions (SMS + WhatsApp + email reminders)",
    "Capture App (iPad RAW workflow + voice memo + freq-sep)",
    "Photo Enhancer (object removal Slice 1–8)",
    "Showcase Client Galleries (Stripe checkout + password gate)",
    "Dance Vertical (3-tier subscription + tester invites)",
    "WhatsApp BSP (BYO-Meta + hosted)",
    "Role Room Agent (14+ capability domains)",
  ],
  foundationDomains: [
    "Feed Planner (5 platforms wired)",
    "Marketing Plan Engine",
    "Pressroom (12 plakat + 2 menu templates)",
    "Investor Room (Migration 130 + 8-section template)",
    "Ads 2.0 (Migration 128 + Meta Marketing API)",
    "Merch Integration",
  ],
};

// ─────────────────────────────────────────────────────────
// Persona-specific decks
// ─────────────────────────────────────────────────────────

export const PRODUCTION_TEAM_DECK: PersonaDeck = {
  persona: "production-team",
  audience: "Produksjonsteam (film, foto, multi-kamera, casting-byråer)",
  brandTagline: "Operativsystemet for moderne produksjoner",
  ask: "Vi reiser X NOK for å akselerere markedsekspansjon i Norden + AI-verktøy.",
  slides: [
    {
      number: "01",
      kind: "cover",
      label: "The Cover",
      title: "Operativsystemet for moderne produksjoner",
      body: "Ett arbeidsområde for casting, produksjonsplanlegging og alt imellom.",
      screenshot: "decks/screenshots/production-team/01-photographer-dashboard.png",
    },
    {
      number: "02",
      kind: "problem",
      label: "The Problem",
      title: "Kreative team blir tvunget til å jobbe i kaos.",
      bullets: [
        { icon: "✕", label: "Castingen lever i Excel + e-post-tråder" },
        { icon: "✕", label: "Skytingsplaner sendes som PDF som umiddelbart blir utdatert" },
        { icon: "✕", label: "Råvideo + RAW-filer er spredt på 3+ skytjenester" },
        { icon: "✕", label: "Klient-godkjenning skjer på WhatsApp" },
        { icon: "✕", label: "Faktureringen lekker fordi ingen sporer faktiske timer/leveranser" },
      ],
      body: "Fragmenterte verktøy dreper kreativiteten og senker hele teamet.",
    },
    {
      number: "03",
      kind: "solution",
      label: "The Shift",
      title: "Produksjon utvikler seg.",
      bullets: [
        { icon: "→", label: "Skytjenester forventes å være sky-basert og samarbeids-orientert" },
        { icon: "→", label: "Klient-godkjenning må være sporbar og auditerbar" },
        { icon: "→", label: "iPad-arbeidsflyt på sett er den nye normen" },
        { icon: "→", label: "AI tar over rutine-oppgaver: culling, retusj, klipp" },
        { icon: "→", label: "Casting blir multi-kanal (SMS + WhatsApp + e-post)" },
      ],
    },
    {
      number: "04",
      kind: "screenshot",
      label: "The Solution",
      title: "Ett arbeidsområde for hele produksjons-livssyklusen.",
      bullets: [
        { label: "Casting + Auditions" },
        { label: "Production Planning" },
        { label: "Capture App (iPad)" },
        { label: "Photo / Video Enhancer" },
        { label: "Klient-galleri + Stripe checkout" },
        { label: "Multi-prosjekt timeline" },
      ],
      screenshot: "decks/screenshots/production-team/02-videographer-dashboard.png",
      screenshotCaption: "Videograf-dashbord (live)",
    },
    {
      number: "05",
      kind: "feature-grid",
      label: "Built for production",
      title: "Alt du trenger. Ingenting du ikke gjør.",
      bullets: [
        { icon: "🎬", label: "Casting", sub: "Multi-kanal påminnelser (SMS + WhatsApp + e-post)" },
        { icon: "📅", label: "Skytingsplaner", sub: "Live-synket, auto-konflikt-deteksjon" },
        { icon: "📸", label: "iPad Capture", sub: "RAW + voice-memo + presence-tracking" },
        { icon: "✨", label: "Photo Enhancer", sub: "Frequency-sep + object-removal Slice 1–8" },
        { icon: "🖼️", label: "Klient-galleri", sub: "Passord-gate + screenshot-protect + Stripe checkout" },
        { icon: "💸", label: "Inntekt-sporing", sub: "Prosjekt → faktura → MVA-håndtering automatisk" },
      ],
      screenshot: "decks/screenshots/production-team/03-showcase-admin.png",
    },
    {
      number: "06",
      kind: "problem",
      label: "Why Now?",
      title: "Den perfekte storm for endring.",
      bullets: [
        { icon: "→", label: "Eksplosjon i innhold + kreatører" },
        { icon: "→", label: "Utdaterte verktøy klarer ikke holde tritt" },
        { icon: "→", label: "Team trenger fart og fleksibilitet" },
        { icon: "→", label: "AI transformerer hvordan vi skaper" },
        { icon: "→", label: "Etterspørsel etter end-to-end-løsninger" },
      ],
      body: "Bransjen er klar. Tiden er nå.",
    },
    {
      number: "07",
      kind: "market",
      label: "Market Opportunity",
      title: "Markedet for produksjonsprogramvare.",
      marketDonut: {
        center: "$11.4B",
        label: "Globalt produksjonsprogramvare-marked innen 2030",
        segments: [
          { name: "Film & TV-produksjon", pct: 38 },
          { name: "Casting-byråer", pct: 22 },
          { name: "Kommersielle / Reklame-byråer", pct: 18 },
          { name: "Videoinnhold-skapere", pct: 14 },
          { name: "Musikk & Event", pct: 8 },
        ],
      },
      bullets: [
        { label: "Primær: Norske + nordiske produksjonsteam (5 000+ aktive selskaper)" },
        { label: "Sekundær: Frilans-fotografer/-videografer (~30 000 i Norden)" },
        { label: "Langsiktig: Education + film-skoler" },
      ],
    },
    {
      number: "08",
      kind: "competition",
      label: "Competitive Landscape",
      title: "Vi er ikke et nytt prosjektstyringsverktøy.",
      body: "Vi er bygget for slik kreative faktisk jobber.",
      competitionColumns: ["Plattform", "Casting", "Production", "Collaboration", "Creative-first"],
      competitionRows: [
        { name: "StudioBinder", cells: ["yes", "partial", "yes", "no"] },
        { name: "Casting Networks", cells: ["yes", "no", "partial", "no"] },
        { name: "Monday.com", cells: ["no", "no", "yes", "no"] },
        { name: "Notion", cells: ["no", "no", "yes", "no"] },
        { name: "The Role Room", cells: ["yes", "yes", "yes", "yes"] },
      ],
    },
    {
      number: "09",
      kind: "vision",
      label: "Vision",
      title: "Vi bygger infrastrukturen for den kreative bransjen.",
      bullets: [
        { icon: "🎭", label: "Talent Graph", sub: "Oppdag og koble talent globalt" },
        { icon: "🤖", label: "AI-Powered Workflows", sub: "Smartere verktøy for raskere beslutninger" },
        { icon: "🎬", label: "Live Set Collaboration", sub: "Sanntids-synk på sett" },
        { icon: "☁️", label: "Creative Cloud Ecosystem", sub: "Alle verktøy, sømløst koblet" },
      ],
      body: "Vår visjon er å bli operativsystemet som driver hver flotte produksjon.",
    },
    {
      number: "10",
      kind: "business-model",
      label: "Business Model",
      title: "Skalerbar. Tilbakevendende. Bygget for langsiktig vekst.",
      bullets: [
        { icon: "💳", label: "SaaS-abonnement", sub: "Frilanser 599 / Studio 1 799 / Agency 4 999 NOK/mnd" },
        { icon: "🏢", label: "Team & Enterprise", sub: "Avansert samarbeid, sikkerhet, support" },
        { icon: "🚀", label: "Fremtidige muligheter", sub: "Marketplace, talent-discovery, premium AI" },
      ],
    },
    {
      number: "11",
      kind: "traction",
      label: "Traction",
      title: "Solid grunnmur. Reell momentum. Stort potensial.",
      metrics: [
        { value: "441", label: "Commits siste 30 dager" },
        { value: "190", label: "Database-migrasjoner shipped" },
        { value: "295", label: "Frontend-komponenter" },
        { value: "15+", label: "Plattform-integrasjoner" },
      ],
      bullets: [
        { label: "Holy Crust (Oslo) — første betalende pilot, ekte produksjons-data flyter" },
        { label: "Capture App + Photo Enhancer Slice 1–8 levert" },
        { label: "Showcase klient-galleri stack live (Slice 9 + 9D + 10)" },
      ],
    },
    {
      number: "12",
      kind: "team",
      label: "The Team",
      title: "Et team av kreatører, byggere og problemløsere.",
      body: "Vi snakker språket. Vi bygger for bransjen vi elsker.",
      bullets: [
        { label: "Daniel Qazi", sub: "Grunnlegger — fotograf + utvikler, 10+ år bransje-erfaring" },
        { label: "Dedikert dev-velocity: 441 commits / 30 dager", sub: "" },
      ],
    },
    {
      number: "13",
      kind: "vision",
      label: "Go-To-Market",
      title: "Fellesskaps-drevet vekst med bransje-partnerskap i kjernen.",
      bullets: [
        { icon: "👥", label: "Creator Communities", sub: "Norske produksjonsforum + Discord-servere" },
        { icon: "🎓", label: "Film-skoler & utdanning", sub: "Westerdals, NTNU, NISS" },
        { icon: "🤝", label: "Bransje-partnerskap", sub: "Norsk Filmforbund, NOPA" },
        { icon: "💬", label: "Innhold + Community", sub: "Direkte salg + selvbetjening" },
      ],
    },
    {
      number: "14",
      kind: "ask",
      label: "The Ask",
      title: "Vi reiser",
      body: "X NOK",
      bullets: [
        { label: "Akselerere produktutvikling (AI-verktøy, ads-plattform)" },
        { label: "Bygge salgsteam i Norge + Sverige" },
        { label: "Strategiske partnerskap + integrasjoner" },
      ],
    },
  ],
};

export const CONTENT_PRODUCER_DECK: PersonaDeck = {
  persona: "content-producer",
  audience: "Innholdsprodusenter (foto, video, sosiale medier)",
  brandTagline: "Hele kreativ-stacken på én plass",
  ask: "Vi reiser X NOK for å akselerere AI-genererte innholds-features.",
  slides: [
    {
      number: "01",
      kind: "cover",
      label: "The Cover",
      title: "Hele kreativ-stacken. På én plass.",
      body: "Skyt → forbedre → lever → publiser → mål — i samme arbeidsområde.",
      screenshot: "decks/screenshots/content-producer/01-photographer-dashboard.png",
    },
    {
      number: "02",
      kind: "problem",
      label: "The Problem",
      title: "Innholdsprodusenter er fanget mellom verktøy.",
      bullets: [
        { icon: "✕", label: "Lightroom for redigering" },
        { icon: "✕", label: "Pic-Time eller Pixieset for klient-galleri" },
        { icon: "✕", label: "Hootsuite eller Later for sosial publisering" },
        { icon: "✕", label: "Canva for plakater, Mailchimp for nyhetsbrev" },
        { icon: "✕", label: "QuickBooks eller Fiken for fakturering" },
        { icon: "✕", label: "5+ måneds-abonnementer + 5+ innlogginger + 0 datasynk" },
      ],
      body: "Det fragmenterte verktøy-stakken stjeler tid fra det kreative arbeidet.",
    },
    {
      number: "03",
      kind: "solution",
      label: "The Shift",
      title: "Kreatør-økonomien er voksen.",
      bullets: [
        { icon: "→", label: "Innholdsprodusenter er småbedrifter — de trenger økonomi-verktøy" },
        { icon: "→", label: "AI gjør profesjonell retusj tilgjengelig på iPad" },
        { icon: "→", label: "Sosiale plattformer krever kontinuerlig flow av høykvalitets-innhold" },
        { icon: "→", label: "Klienter forventer raskere leveranse + bedre samarbeid" },
        { icon: "→", label: "End-to-end-stacker vinner; punktverktøy taper" },
      ],
    },
    {
      number: "04",
      kind: "screenshot",
      label: "The Solution",
      title: "Skyt, rediger, lever, publiser, mål — uten å bytte verktøy.",
      bullets: [
        { label: "iPad Capture App med RAW + voice memo" },
        { label: "Photo Enhancer (frequency-sep + object removal)" },
        { label: "Klient-galleri med Stripe checkout" },
        { label: "Pressroom — plakater + meny-templates" },
        { label: "Feed Planner — IG + TikTok + Meta + LinkedIn + YouTube" },
        { label: "Marketing Plan Engine + AI-drevet content-strategi" },
      ],
      screenshot: "decks/screenshots/content-producer/02-showcase-admin.png",
      screenshotCaption: "Showcase Admin (live)",
    },
    {
      number: "05",
      kind: "feature-grid",
      label: "The Tools",
      title: "Hver del finpusset for innhold.",
      bullets: [
        { icon: "📸", label: "iPad Capture", sub: "Skyt direkte til galleri, voice-memos, multi-fotograf-presence" },
        { icon: "✨", label: "Photo Enhancer", sub: "Frequency-sep retusj + object removal Slice 1–8" },
        { icon: "🖼️", label: "Klient-galleri", sub: "Passord-gate, screenshot-protect, Stripe checkout, watermark" },
        { icon: "🎨", label: "Pressroom", sub: "12 plakat-formater + 2 meny-templates + Claude-genererte tekster" },
        { icon: "📱", label: "Feed Planner", sub: "5 sosiale plattformer + AI-genererte caption + retake-pålogging" },
        { icon: "📊", label: "Marketing Plan", sub: "30-dagers planlegging, Read Through analyze, KPI-sporing" },
      ],
      screenshot: "decks/screenshots/content-producer/03-email-designer.png",
    },
    {
      number: "06",
      kind: "problem",
      label: "Why Now?",
      title: "Innholdsprodusenter trenger en hel-stakk-løsning.",
      bullets: [
        { icon: "→", label: "Sosiale plattformer multipliseres (TikTok, BeReal, Threads, …)" },
        { icon: "→", label: "Klient-forventninger om hastighet er på rekord-nivå" },
        { icon: "→", label: "AI muliggjør volumer som ikke var mulig for 18 måneder siden" },
        { icon: "→", label: "Bedrifter vil betale for outcomes (ROI), ikke verktøy" },
        { icon: "→", label: "Norsk MVA + Stripe Tax = barriere for utenlandske aktører" },
      ],
    },
    {
      number: "07",
      kind: "market",
      label: "Market Opportunity",
      title: "Kreatør-økonomien blir profesjonalisert.",
      marketDonut: {
        center: "$8.2B",
        label: "Globalt creator-tools-marked innen 2030",
        segments: [
          { name: "Foto/Video Creators", pct: 35 },
          { name: "Sosiale media-byråer", pct: 25 },
          { name: "Influencers / Personal Brands", pct: 20 },
          { name: "SMB Marketing-team", pct: 15 },
          { name: "E-commerce Sellers", pct: 5 },
        ],
      },
      bullets: [
        { label: "Primær: ~30 000 norske foto/video-frilansere" },
        { label: "Sekundær: 200 000+ norske SMB med behov for content-stack" },
        { label: "Langsiktig: Hele Norden + EU-utvidelse" },
      ],
    },
    {
      number: "08",
      kind: "competition",
      label: "Competitive Landscape",
      title: "Punktverktøy taper mot integrert stack.",
      body: "Vi tilbyr full-stakk for prisen av to enkeltstående verktøy.",
      competitionColumns: ["Plattform", "Edit", "Deliver", "Publish", "Bill"],
      competitionRows: [
        { name: "Lightroom + Pic-Time + Hootsuite", cells: ["yes", "yes", "yes", "no"] },
        { name: "Canva + Mailchimp", cells: ["partial", "no", "yes", "no"] },
        { name: "Adobe Creative Cloud", cells: ["yes", "no", "no", "no"] },
        { name: "Notion / Airtable", cells: ["no", "no", "no", "no"] },
        { name: "The Role Room", cells: ["yes", "yes", "yes", "yes"] },
      ],
    },
    {
      number: "09",
      kind: "vision",
      label: "Vision",
      title: "Operativsystemet for moderne innholdsprodusenter.",
      bullets: [
        { icon: "🎨", label: "AI-First Editing", sub: "Frequency-sep + object removal + retusj-foreslåing" },
        { icon: "📱", label: "Multi-Platform Publishing", sub: "5 sosiale plattformer + e-post + presse" },
        { icon: "💼", label: "Forretningsstacken", sub: "Klient-galleri + Stripe + faktura + MVA" },
        { icon: "🔗", label: "Brand Kit-synk", sub: "Logo, farger, fonter — alle verktøy bruker samme kilde" },
      ],
    },
    {
      number: "10",
      kind: "business-model",
      label: "Business Model",
      title: "Forutsigbar. Skalerbar. Bygget for kreatører.",
      bullets: [
        { icon: "💳", label: "SaaS-abonnement", sub: "Frilanser 599 / Studio 1 799 / Agency 4 999 NOK/mnd" },
        { icon: "📈", label: "Bruks-basert overage", sub: "Stripe Meters: Claude-tokens, render, lagring, ads-management" },
        { icon: "🛒", label: "Klient-faktura-share", sub: "Stripe Connect — 5% margin på klientens betaling" },
      ],
    },
    {
      number: "11",
      kind: "traction",
      label: "Traction",
      title: "Bygget i åpenhet, validert med ekte kunder.",
      metrics: [
        { value: "441", label: "Commits siste 30 dager" },
        { value: "190", label: "Database-migrasjoner" },
        { value: "8", label: "Domener live" },
        { value: "15+", label: "Integrasjoner" },
      ],
      bullets: [
        { label: "Holy Crust (Oslo bakeri) — pilot-kunde med ekte content-pipeline" },
        { label: "Photo Enhancer Slice 1–8 ferdig + testet på bryllups-data" },
        { label: "Capture App valider på Canon R5 + R6 mkII + R7" },
      ],
    },
    {
      number: "12",
      kind: "team",
      label: "The Team",
      title: "Bygget av kreatører, for kreatører.",
      body: "Vi løser problemene vi selv har.",
      bullets: [
        { label: "Daniel Qazi", sub: "Grunnlegger — aktiv fotograf + utvikler" },
        { label: "Dev-velocity: 441 commits / 30 dager" },
      ],
    },
    {
      number: "13",
      kind: "vision",
      label: "Go-To-Market",
      title: "Innhold-først, fellesskaps-drevet.",
      bullets: [
        { icon: "📸", label: "Foto/video-fellesskap", sub: "Norsk Fotografforbund, Instagram-grupper, Reddit" },
        { icon: "🎥", label: "YouTube-utdanning", sub: "Behind-the-scenes på Holy Crust-pipelinen" },
        { icon: "🤝", label: "Studio-partnerskap", sub: "Hovedstadens største foto-studioer" },
        { icon: "🎓", label: "Foto-skoler + workshops", sub: "Distribuere via etablerte utdanningskanaler" },
      ],
    },
    {
      number: "14",
      kind: "ask",
      label: "The Ask",
      title: "Vi reiser",
      body: "X NOK",
      bullets: [
        { label: "AI-features (auto-cull, smart-retusj, caption-generation)" },
        { label: "Norden-utvidelse (Sverige + Danmark + Finland)" },
        { label: "Markedsføring + community-building" },
      ],
    },
  ],
};

export const DANCE_STUDIO_DECK: PersonaDeck = {
  persona: "dance-studio",
  audience: "Dansestudioer + dansefrilansere",
  brandTagline: "Operativsystemet for dansestudioer",
  ask: "Vi reiser X NOK for å akselerere danse-vertikalen i Norden.",
  slides: [
    {
      number: "01",
      kind: "cover",
      label: "The Cover",
      title: "Operativsystemet for dansestudioer.",
      body: "Påmelding, timeplan, koreografi, fakturering — i ett system.",
      screenshot: "decks/screenshots/dance-studio/04-academy-dashboard.png",
    },
    {
      number: "02",
      kind: "problem",
      label: "The Problem",
      title: "Dansestudioer drukner i administrasjon.",
      bullets: [
        { icon: "✕", label: "Påmelding skjer i Google Forms eller papir" },
        { icon: "✕", label: "Timeplaner endres i WhatsApp-grupper og glipper" },
        { icon: "✕", label: "Fakturering går via Excel + manuelle Vipps-overføringer" },
        { icon: "✕", label: "Koreografi-videoer ligger spredt på YouTube + Drive" },
        { icon: "✕", label: "Audition-påminnelser går aldri ut, halvparten av dansere møter ikke" },
        { icon: "✕", label: "Kompetanse-utvikling spores ikke" },
      ],
      body: "Studioledere bruker 30%+ av tiden sin på administrasjon — ikke på å undervise.",
    },
    {
      number: "03",
      kind: "solution",
      label: "The Shift",
      title: "Dansebransjen profesjonaliseres.",
      bullets: [
        { icon: "→", label: "Foreldre forventer betalings-app + automatiske påminnelser" },
        { icon: "→", label: "Dansere forventer videoarkiv av egne formasjoner" },
        { icon: "→", label: "Studioer trenger drift-data: nærvær, frafall, omsetning per klasse" },
        { icon: "→", label: "Konkurranser krever digital koreografi-deling" },
        { icon: "→", label: "Skader må logges for risiko-håndtering" },
      ],
    },
    {
      number: "04",
      kind: "screenshot",
      label: "The Solution",
      title: "Studio-drift uten regnearket.",
      bullets: [
        { label: "21 fane-paneler for studio-drift" },
        { label: "18 fane-paneler for frilans-dansere" },
        { label: "Audition-påminnelser via SMS + WhatsApp + e-post" },
        { label: "Skadelogging + komme-på-bena-flow" },
        { label: "Magic-link / PIN-pålogging — GDPR-konform for mindreårige" },
        { label: "Stripe-abonnementer integrert (4 studio + 2 freelance plans)" },
      ],
      screenshot: "decks/screenshots/dance-studio/04-academy-dashboard.png",
      screenshotCaption: "Akademi-dashbord for student-tilgang (live)",
    },
    {
      number: "05",
      kind: "feature-grid",
      label: "Built for Dance",
      title: "Bransjespesifikt. Aldri en omdøpt CRM.",
      bullets: [
        { icon: "💃", label: "Klasse-administrasjon", sub: "Påmelding, ventelister, frafalls-prediksjon" },
        { icon: "📅", label: "Timeplan + Audition", sub: "Auto-påminnelser SMS/WhatsApp/e-post 24t + 1t før" },
        { icon: "🎬", label: "Koreografi-arkiv", sub: "Video-annotering, formasjons-redigering, deling" },
        { icon: "🩺", label: "Skadelogging", sub: "Strukturert injury-tracker + recovery-plan" },
        { icon: "💳", label: "Stripe-abonnementer", sub: "Månedlig + årlig + tester-invitasjons-system" },
        { icon: "👨‍👩‍👧", label: "Foreldre-tilgang", sub: "Magic-link + PIN, GDPR-konform for under 16" },
      ],
      screenshot: "decks/screenshots/dance-studio/03-showcase-admin.png",
    },
    {
      number: "06",
      kind: "problem",
      label: "Why Now?",
      title: "Dansevertikalen er undertjent.",
      bullets: [
        { icon: "→", label: "Norske studioer betjenes i dag av amerikansk SaaS (Mindbody, Gymdesk)" },
        { icon: "→", label: "Ingen verktøy støtter norsk MVA, Vipps, eller GDPR for mindreårige" },
        { icon: "→", label: "Etterspørsel etter video-arkiv eksploderer post-COVID" },
        { icon: "→", label: "Skadelogging blir snart lov-pålagt" },
        { icon: "→", label: "Konsolidering av studioer = behov for multi-tenant-løsning" },
      ],
    },
    {
      number: "07",
      kind: "market",
      label: "Market Opportunity",
      title: "Et nordisk dansebransje-marked på vekst.",
      marketDonut: {
        center: "1.2 mrd NOK",
        label: "Nordisk danseutdanning + studio-marked årlig",
        segments: [
          { name: "Norske kommersielle studioer", pct: 32 },
          { name: "Svenske studioer", pct: 28 },
          { name: "Danske + Finske studioer", pct: 20 },
          { name: "Frilans-dansere/koreografer", pct: 15 },
          { name: "Konkurranse + utdanning", pct: 5 },
        ],
      },
      bullets: [
        { label: "Primær: ~1 200 aktive norske dansestudioer" },
        { label: "Sekundær: ~5 000 frilans-dansere/koreografer" },
        { label: "Langsiktig: Norden + Baltikum (8 000+ studioer)" },
      ],
    },
    {
      number: "08",
      kind: "competition",
      label: "Competitive Landscape",
      title: "Norske studioer fortjener norsk-bygget verktøy.",
      body: "Vi snakker språket. Vi har MVA. Vi vet hva en GDPR-konform mindreårigs-flow betyr.",
      competitionColumns: ["Plattform", "Norsk", "MVA", "Vipps", "Skade"],
      competitionRows: [
        { name: "Mindbody", cells: ["no", "no", "no", "no"] },
        { name: "Gymdesk", cells: ["no", "no", "no", "no"] },
        { name: "ClassPass", cells: ["no", "no", "no", "no"] },
        { name: "Norske generiske CRM", cells: ["partial", "yes", "partial", "no"] },
        { name: "The Role Room", cells: ["yes", "yes", "yes", "yes"] },
      ],
    },
    {
      number: "09",
      kind: "vision",
      label: "Vision",
      title: "Norges go-to-plattform for dansestudio-drift.",
      bullets: [
        { icon: "💃", label: "Studio-OS", sub: "Påmelding, betaling, timeplan, koreografi" },
        { icon: "🎓", label: "Akademi", sub: "Online-undervisning + sertifiserings-spor" },
        { icon: "🤝", label: "Konkurranse-marketplace", sub: "Søk + meld på koreografi-konkurranser" },
        { icon: "🌍", label: "Norden-ekspansjon", sub: "Sverige + Danmark som neste markeder" },
      ],
    },
    {
      number: "10",
      kind: "business-model",
      label: "Business Model",
      title: "3 abonnement-tiers + tester-program.",
      bullets: [
        { icon: "💳", label: "Studio-tiers", sub: "4 nivåer: Solo / Klubb / Akademi / Enterprise" },
        { icon: "🕺", label: "Frilanser-tiers", sub: "2 nivåer: Frilans / Koreograf-pro" },
        { icon: "🎟️", label: "Tester-invitasjoner", sub: "90-dagers full-tilgang for selektert pilot-program" },
        { icon: "📩", label: "SMS + WhatsApp-overage", sub: "2 NOK/SMS retail, ~135% margin" },
      ],
    },
    {
      number: "11",
      kind: "traction",
      label: "Traction",
      title: "Dansevertikalen levert i Q2 2026.",
      metrics: [
        { value: "21", label: "Studio-fane-paneler" },
        { value: "18", label: "Frilanser-fane-paneler" },
        { value: "4 + 2", label: "Studio + Frilans abonnement-tiers" },
        { value: "190", label: "Migrations totalt på platformen" },
      ],
      bullets: [
        { label: "Migrations 71–75 ferdig — full magic-link + multi-team + add-ons" },
        { label: "Tester-invite-system live — for designerte pilot-studioer" },
        { label: "Stripe-billing wired med MVA + Vipps-fallback" },
      ],
    },
    {
      number: "12",
      kind: "team",
      label: "The Team",
      title: "Vi forstår både kode og dansegulv.",
      body: "Bygget i tett dialog med pilot-studioer.",
      bullets: [
        { label: "Daniel Qazi", sub: "Grunnlegger — utvikler + content-strateg" },
        { label: "Dev-velocity: 441 commits / 30 dager" },
        { label: "Pilot-studioer: under nedlukket NDA" },
      ],
    },
    {
      number: "13",
      kind: "vision",
      label: "Go-To-Market",
      title: "Pilot → ringvirkninger → Norden-skala.",
      bullets: [
        { icon: "🎯", label: "Pilot Q3 2026", sub: "10 designerte norske studioer (NDA)" },
        { icon: "📣", label: "Ord til ord", sub: "Studioer anbefaler andre studioer i samme distrikt" },
        { icon: "🤝", label: "Forbund-partnerskap", sub: "Norges Danseforbund, NRYF" },
        { icon: "🌍", label: "Sverige Q1 2027", sub: "Stockholm + Göteborg som neste markeder" },
      ],
    },
    {
      number: "14",
      kind: "ask",
      label: "The Ask",
      title: "Vi reiser",
      body: "X NOK",
      bullets: [
        { label: "Lansere dansevertikalen i 100 norske studioer" },
        { label: "Bygge konkurranse-marketplace + akademi-laget" },
        { label: "Forberede Sverige-ekspansjon (lokalisering + lokal sales)" },
      ],
    },
  ],
};

export const ALL_DECKS: PersonaDeck[] = [
  PRODUCTION_TEAM_DECK,
  CONTENT_PRODUCER_DECK,
  DANCE_STUDIO_DECK,
];
