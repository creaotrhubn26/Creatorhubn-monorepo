/**
 * industryTemplates.ts
 *
 * Bransje-spesifikke pre-fylte achievement-eksempler for NextRole.
 *
 * Hver bransje har 3-4 typiske roller, og hver rolle har 5-6
 * kvantifiserte achievement-bullets brukeren kan velge fra eller
 * tilpasse. Reduserer fritt-ark-paralyse for førstegangs CV-byggere.
 *
 * Brukerflyt: ved opprettelse av ny CV (eller fra editor) velger
 * brukeren bransje → ser eksempler → klikker for å sette dem inn.
 *
 * Norsk arbeidsmarked: eksemplene er skrevet med STAR-format og bruker
 * tall (kroner, prosent, antall, tid) der det er realistisk.
 */

export interface IndustryRole {
  key: string;
  label: string;
  exampleTitle: string;
  achievements: string[];
}

export interface Industry {
  key: string;
  label: string;
  description: string;
  roles: IndustryRole[];
  /** Foreslåtte ferdigheter for hele bransjen (kan velges som ferdigheter) */
  suggestedSkills: string[];
}

export const INDUSTRY_TEMPLATES: Industry[] = [
  {
    key: "it_developer",
    label: "IT / Utvikling",
    description: "Utviklere, devops, dataingeniører",
    suggestedSkills: [
      "TypeScript", "React", "Node.js", "Python", "Go", "Docker",
      "Kubernetes", "AWS", "PostgreSQL", "Git", "CI/CD", "Agile/Scrum",
    ],
    roles: [
      {
        key: "fullstack",
        label: "Fullstack-utvikler",
        exampleTitle: "Senior Fullstack-utvikler",
        achievements: [
          "Reduserte byggetid for hovedapplikasjonen fra 12 til 3 minutter (75% raskere) ved å introdusere parallel testing og Docker-layer-cache",
          "Ledet migrering fra Express.js til Node.js + Fastify, økte gjennomstrømning med 40% (fra 5k til 7k req/sec)",
          "Bygget komponentbibliotek brukt av 8 produktteam, reduserte tid fra design til levering med 30%",
          "Sto for produksjonsovervåkning og oncall — løste 95% av P1-saker innen SLA på 30 min",
          "Mentorerte 3 juniorutviklere fra trainee til selvstendig kontributør på 6 måneder",
        ],
      },
      {
        key: "frontend",
        label: "Frontend-utvikler",
        exampleTitle: "Frontend-utvikler",
        achievements: [
          "Implementerte WCAG 2.1 AA-tilgjengelighet på hovednettstedet, økte Lighthouse accessibility-score fra 64 til 98",
          "Forkortet First Contentful Paint fra 3.2s til 0.9s gjennom code-splitting og bilde-optimalisering",
          "Bygget design-system med 60+ komponenter (React + Storybook) brukt av 4 team",
          "Konverterte legacy AngularJS-app til React, fullført 4 måneder under estimat",
          "Økte mobil-konvertering med 22% etter A/B-test av ny checkout-flyt",
        ],
      },
      {
        key: "devops",
        label: "DevOps / SRE",
        exampleTitle: "DevOps-ingeniør",
        achievements: [
          "Migrerte infrastruktur fra fysiske servere til AWS EKS, kuttet driftskostnader 35% (NOK 1.2M årlig)",
          "Bygget GitOps-pipeline med ArgoCD — deploymenter ble 4x raskere og rollback under 60 sekunder",
          "Innførte SLO-baserte alarmer i Prometheus, redusert false-positive-pages med 80%",
          "Sto for sikkerhetsherding (SOC 2 Type II oppnådd 2024) — null kritiske funn i ekstern revisjon",
          "Skrev IaC for hele prod-miljøet i Terraform (90+ moduler), null manuelle ressurser igjen",
        ],
      },
      {
        key: "data",
        label: "Dataingeniør / ML",
        exampleTitle: "Dataingeniør",
        achievements: [
          "Bygget ETL-pipeline (Airflow + dbt) som prosesserer 200M events/dag med 99.95% pålitelighet",
          "Reduserte data-warehouse-kostnad 45% (NOK 600k/år) ved å innføre incremental models og partition-pruning",
          "Lansert intern self-service analytics — antall data-spørringer fra forretning økte 6x",
          "Tunet PostgreSQL-cluster (50 TB) — query-latens median 80ms ned fra 450ms",
          "Implementerte data-quality-monitoring med Great Expectations, fanget 3 kritiske bugs før prod",
        ],
      },
    ],
  },
  {
    key: "healthcare",
    label: "Helse / Omsorg",
    description: "Sykepleiere, helsefagarbeidere, helsepersonell",
    suggestedSkills: [
      "Pasientsentrert omsorg", "Medikamenthåndtering", "Akuttmedisin",
      "Dokumentasjon (DIPS/Helseplattformen)", "Tverrfaglig samarbeid",
      "Sårbehandling", "Pårørendekontakt", "HLR-sertifisert",
    ],
    roles: [
      {
        key: "nurse_hospital",
        label: "Sykepleier (sykehus)",
        exampleTitle: "Sykepleier",
        achievements: [
          "Ansvarlig for 6-8 pasienter per vakt på medisinsk sengepost, koordinerte tverrfaglig oppfølging med leger, fysio og sosionomer",
          "Innførte ny rutine for fall-forebygging — antall fallhendelser sank 38% over 6 måneder",
          "Mentorerte 4 sykepleiestudenter gjennom praksisperioder, alle bestått med toppkarakterer",
          "Deltok i utvikling av lokal prosedyre for tidlig identifikasjon av sepsis (SIRS-screening)",
          "Sto for vaktansvar 2 ganger ukentlig — koordinerte 12-personers vaktteam og pasientstrøm",
        ],
      },
      {
        key: "nurse_specialist",
        label: "Spesialsykepleier",
        exampleTitle: "Intensivsykepleier",
        achievements: [
          "Ansvar for intensiv-pasienter med behov for respirator, dialyse og avansert overvåkning",
          "Underviste 25 sykepleiere i avansert HLR — alle bestått sertifisering",
          "Bidro til implementering av tidlig mobilisering-protokoll, reduserte gjennomsnittlig liggetid med 1.8 dager",
          "Deltok i forskningsprosjekt om delirium-forebygging — medforfatter på artikkel i Sykepleien",
        ],
      },
      {
        key: "carer",
        label: "Helsefagarbeider",
        exampleTitle: "Helsefagarbeider",
        achievements: [
          "Ansvarlig for daglig pleie og oppfølging av 12 beboere på sykehjem, inkludert medikamenthåndtering",
          "Bygget tillitsrelasjon med beboere med demens — pårørende-tilfredshet økte fra 7.2 til 8.9 (av 10)",
          "Tok initiativ til aktivitetsgruppe — 80% av beboerne deltok ukentlig, mot 30% tidligere",
          "Sto for opplæring av 6 sommervikarer per år i grunnleggende pleieprosedyrer",
        ],
      },
    ],
  },
  {
    key: "teaching",
    label: "Undervisning",
    description: "Lærere, undervisere, pedagoger",
    suggestedSkills: [
      "Klasseledelse", "Differensiert undervisning", "Vurdering for læring",
      "Foreldrekommunikasjon", "Digitale læremidler", "Spesialpedagogikk",
      "Læreplanutvikling", "Konfliktløsning",
    ],
    roles: [
      {
        key: "grunnskole",
        label: "Grunnskolelærer",
        exampleTitle: "Grunnskolelærer (1.-7. trinn)",
        achievements: [
          "Kontaktlærer for 26 elever på 4. trinn — kartla og fulgte opp 3 elever med leseutfordringer som alle nådde grunnleggende lesenivå innen vårsemesteret",
          "Innførte stasjonsbasert matematikkundervisning — gjennomsnittlig nasjonalprøve-score i klassen økte 12% over 2 år",
          "Ledet skolens DKS-utvalg (Den kulturelle skolesekken) — arrangerte 8 forestillinger årlig",
          "Veiledet 2 lærerstudenter i praksis, begge fikk anbefaling om fast ansettelse etter endt utdanning",
        ],
      },
      {
        key: "videregaende",
        label: "Lærer videregående",
        exampleTitle: "Lektor",
        achievements: [
          "Underviste i historie og samfunnsfag for 5 klasser (130 elever) — eksamenskarakter-snitt 4.3 mot landsgjennomsnitt 3.8",
          "Utviklet tverrfaglig prosjekt om bærekraft som ble adoptert av 3 andre videregående skoler",
          "Initierte og ledet skolens fagmentor-ordning — 22 elever fikk tilpasset støtte gjennom skoleåret",
        ],
      },
      {
        key: "spesped",
        label: "Spesialpedagog",
        exampleTitle: "Spesialpedagog",
        achievements: [
          "Utarbeidet og fulgte opp individuelle opplæringsplaner (IOP) for 18 elever med ulike utfordringer",
          "Implementerte struktur-program for elev med ASD — eleven fullførte grunnskolen med ordinære fag",
          "Underviste foreldre i strukturerte verktøy hjemme — 90% rapporterte bedre familie-rutiner ved oppfølging",
        ],
      },
    ],
  },
  {
    key: "marketing",
    label: "Markedsføring",
    description: "Markedsførere, content, kommunikasjon",
    suggestedSkills: [
      "SEO", "SEM (Google Ads)", "Sosiale medier-strategi", "Innholdsproduksjon",
      "Markedsanalyse", "CRM (HubSpot/Salesforce)", "GA4", "A/B-testing",
      "Brand management", "Kampanjeplanlegging",
    ],
    roles: [
      {
        key: "content_manager",
        label: "Content Manager",
        exampleTitle: "Senior Content Manager",
        achievements: [
          "Bygget innholdsstrategi som økte organisk trafikk 340% (fra 12k til 53k månedlige besøk) på 18 måneder",
          "Ledet redaksjonelt team på 4 personer + freelancere — produserte 80+ artikler årlig",
          "Implementerte AI-drevet content-prosess som kuttet produksjonstid 40% uten kvalitetstap",
          "Lansert ny podcast (12 episoder) — 4.7-stjerners snitt og 45 000 nedlastinger i år 1",
        ],
      },
      {
        key: "growth_marketer",
        label: "Growth marketer",
        exampleTitle: "Growth Marketer",
        achievements: [
          "Reduserte CAC fra NOK 850 til NOK 420 (51%) gjennom strukturert A/B-testing av landing pages",
          "Bygget life-cycle email-strategi (Customer.io) som økte 30-dagers retention med 18%",
          "Lansert referral-program som genererte 22% av nye signups i Q3-Q4",
          "Drev SEM-budsjett på NOK 4M/år — ROAS 3.8x mot benchmark 2.5x",
        ],
      },
      {
        key: "social_media",
        label: "Social Media Manager",
        exampleTitle: "Social Media Manager",
        achievements: [
          "Vokste Instagram fra 8k til 47k følgere på 12 måneder gjennom konsistent storytelling og samarbeid med 30 mikro-influencers",
          "Lansert TikTok-strategi som genererte 2.4M visninger og 1100 nye kunder i kvartalet",
          "Bygget community management-prosedyrer — svartid på DM ned fra 18t til 2t",
        ],
      },
    ],
  },
  {
    key: "sales",
    label: "Salg",
    description: "Selgere, key account, business development",
    suggestedSkills: [
      "B2B-salg", "Account management", "CRM (Salesforce/HubSpot)",
      "Forhandling", "Pipeline management", "Lead-kvalifisering",
      "Solution selling", "Kundepleie",
    ],
    roles: [
      {
        key: "account_manager",
        label: "Key Account Manager",
        exampleTitle: "Key Account Manager",
        achievements: [
          "Ansvarlig for portefølje på 25 enterprise-kunder (NOK 180M ARR) — beholdte 96% (industribenchmark 88%)",
          "Vokste største kunde fra NOK 4M til NOK 11M ARR over 2 år gjennom strategisk upsell",
          "Lukket 3 NOK 5M+ avtaler gjennom året — hvert med 8+ måneders salgsperiode",
          "Bidro til forbedring av onboarding-prosess som reduserte time-to-value fra 90 til 45 dager",
        ],
      },
      {
        key: "sdr",
        label: "Sales Development Rep",
        exampleTitle: "SDR",
        achievements: [
          "Genererte 240 SQL-er per kvartal (140% av kvote) gjennom kald outbound (telefon + LinkedIn + e-post)",
          "Lukket 18 deals selvstendig med snitt NOK 85k ARR per deal",
          "Bygget personlig outbound-prosess som ble adoptert av hele teamet på 8 SDR-er",
        ],
      },
    ],
  },
  {
    key: "project_management",
    label: "Prosjektledelse",
    description: "Prosjektledere, scrum-mastere, program managers",
    suggestedSkills: [
      "Prosjektledelse (PMI/PRINCE2)", "Scrum/Kanban", "Risikostyring",
      "Budsjettstyring", "Stakeholder-håndtering", "MS Project / Jira",
      "Endringsledelse", "Tverrfaglig samarbeid",
    ],
    roles: [
      {
        key: "project_manager",
        label: "Prosjektleder",
        exampleTitle: "Prosjektleder",
        achievements: [
          "Leverte digital transformasjons-prosjekt (NOK 12M budsjett, 18 personer) på tid og 6% under budsjett",
          "Innførte hybrid Agile/Waterfall-metodikk som reduserte time-to-delivery med 30%",
          "Koordinerte stakeholders på tvers av 5 avdelinger og 2 eksterne leverandører",
          "Bygget standardisert prosjektmal som ble adoptert av PMO og brukt på 20+ prosjekter",
        ],
      },
      {
        key: "scrum_master",
        label: "Scrum Master",
        exampleTitle: "Scrum Master / Agile Coach",
        achievements: [
          "Coachet 3 utviklingsteam — gjennomsnittlig velocity økte 25% og sprint-commitment stabilitet fra 65% til 92%",
          "Innførte OKR-praksis på avdelingsnivå (45 personer) — 80% gjennomføringsgrad i første kvartal",
          "Trente 12 nyansatte i Scrum-prinsipper og facilitering",
        ],
      },
    ],
  },
  {
    key: "finance",
    label: "Regnskap og finans",
    description: "Regnskap, revisor, controller, finansanalytikere",
    suggestedSkills: [
      "Regnskap (NRS/IFRS)", "Excel (avansert)", "Power BI",
      "ERP-systemer (SAP/Visma)", "Skatt og avgift", "Budsjettering",
      "Konsernregnskap", "Internkontroll",
    ],
    roles: [
      {
        key: "regnskap",
        label: "Regnskapsfører",
        exampleTitle: "Regnskapsfører",
        achievements: [
          "Ansvarlig for løpende regnskap for 28 SMB-klienter (omsetning 5-80 MNOK) — alle leveranser i tide og uten korreksjoner i offentlige rapporter",
          "Implementerte ny digital faktura-flyt for klient-portefølje — kuttet behandlingstid 60%",
          "Veiledet 4 klienter gjennom strukturendring (omdanning AS → konsern) inkludert skatteoptimering",
        ],
      },
      {
        key: "controller",
        label: "Controller",
        exampleTitle: "Senior Controller",
        achievements: [
          "Ansvar for konsernrapportering (4 selskaper, 220M NOK omsetning) månedlig — alltid levert innen dag 5",
          "Bygget BI-rapporter (Power BI) som ga ledelsen real-time innsikt — reduserte ad-hoc-spørsmål med 70%",
          "Identifiserte og rettet feilaktige avskrivnings-rutiner — reklassifisering ga NOK 1.4M skattereduksjon",
          "Drev strukturert månedsavslutnings-prosess — implementerte close-checklist som reduserte avslutningstid fra 9 til 4 dager",
        ],
      },
    ],
  },
  {
    key: "consulting",
    label: "Konsulent / Rådgivning",
    description: "Management-konsulenter, fagrådgivere",
    suggestedSkills: [
      "Strategi", "Forretningsanalyse", "Datadrevet beslutningsstøtte",
      "Workshop-fasilitering", "Endringsledelse", "Stakeholder management",
      "Markedsanalyse", "Excel/PowerPoint (avansert)",
    ],
    roles: [
      {
        key: "consultant",
        label: "Bedriftsrådgiver",
        exampleTitle: "Senior Bedriftsrådgiver",
        achievements: [
          "Leverte vekststrategi for industriell kunde (omsetning 800 MNOK) som ga 22% topplinje-vekst i implementeringsåret",
          "Ledet 8-personers prosjektteam gjennom 6-måneders due diligence (oppkjøp på 1.2 mrd NOK)",
          "Utviklet pricing-rammeverk for SaaS-kunde — gjennomsnittlig kontraktsverdi økte 35%",
          "Underviste 60+ kunder i strategiske workshops om markedsposisjonering",
        ],
      },
    ],
  },
  {
    key: "service_hospitality",
    label: "Service / Restaurant",
    description: "Servitører, kokker, hotell, butikk",
    suggestedSkills: [
      "Kundeservice", "Kassesystem-håndtering", "Lagerstyring",
      "Mattilsynets retningslinjer", "Teamarbeid under press",
      "Vinkunnskap", "Allergen-håndtering", "Norsk og engelsk",
    ],
    roles: [
      {
        key: "servitor",
        label: "Servitør",
        exampleTitle: "Headwaiter",
        achievements: [
          "Ledet 6-personers serveringsteam på fine-dining-restaurant (60 plasser, 4x i uka fullt)",
          "Trente nyansatte i meny, vinanbefalinger og service-standard — gjennomsnittlig opplæringstid fra 6 til 3 uker",
          "Beholdt 4.8/5-stjerners på TripAdvisor gjennom 18 måneder",
          "Sto for ukentlig vininventar (verdi NOK 200k) — null svinn ut over normalverdier",
        ],
      },
      {
        key: "butikk",
        label: "Butikkmedarbeider",
        exampleTitle: "Butikkmedarbeider / KAM",
        achievements: [
          "Topp-5 selger i kjeden i 6 av 12 måneder — overgikk salgsmål med 18% i 2025",
          "Holdt produkt-demonstrasjoner for 30+ kunder ukentlig — konvertering 24% (snitt for kjeden 14%)",
          "Sto for varepåfyll og visual merchandising — sikret 99% tilgjengelighet på topp-50-varer",
        ],
      },
    ],
  },
  {
    key: "hr",
    label: "HR / Personal",
    description: "HR-rådgivere, rekrutterere, talent",
    suggestedSkills: [
      "Rekruttering", "Personalpolitikk", "Lønn og pensjon",
      "Arbeidsrett", "HMS", "Performance management",
      "Lederstøtte", "Onboarding-design",
    ],
    roles: [
      {
        key: "hr_advisor",
        label: "HR-rådgiver",
        exampleTitle: "HR-rådgiver",
        achievements: [
          "Ansvarlig for HR-funksjon i selskap med 180 ansatte — fra rekruttering til offboarding",
          "Reduserte gjennomsnittlig time-to-hire fra 38 til 24 dager gjennom strukturert pipeline-prosess",
          "Innførte engasjements-undersøkelser (kvartalsvis) — eNPS økte fra +12 til +34 over 18 måneder",
          "Håndterte 6 avskjedssaker gjennom året i samråd med advokat — ingen påklaget til arbeidstilsynet",
        ],
      },
      {
        key: "recruiter",
        label: "Rekrutterer",
        exampleTitle: "Senior Tech Recruiter",
        achievements: [
          "Lukket 28 senior tech-ansettelser i 2025 (115% av kvote) — sourcing 70% via LinkedIn + interne henvendelser",
          "Bygget talent-pipeline for kritiske roller (SRE, ML-engineer) — reduserte fill-time fra 90 til 50 dager",
          "Trente 6 hiring managers i strukturert intervjuteknikk — kandidat-NPS økte med 18 punkter",
        ],
      },
    ],
  },
];

/** Hjelpefunksjon: hent én bransje by key */
export function getIndustryByKey(key: string): Industry | null {
  return INDUSTRY_TEMPLATES.find((i) => i.key === key) ?? null;
}
