/**
 * akademiConfig.ts
 *
 * Én kilde til sannhet for Leadgrid Akademi-innholdet på leadgrid.no
 * (docs/integration-audit/13-leadgrid-akademi-eksperter.md).
 *
 * Brukes av:
 *   - LeadgridAkademiPage (hub på /akademi) — lister publiserte artikler
 *   - casting-main.tsx — ruting av /akademi/<slug>
 *   - prerender/geo-prerender-entry.tsx — statisk HTML for AI-crawlere
 *
 * Prinsipp (samme som resten av plattformen): alle tall i artiklene har
 * navngitt kilde. Selvrapporterte påstander brukes ikke.
 */

export interface AkademiArticle {
  key: string;
  /** Ren sti på leadgrid.no, f.eks. '/akademi/velge-crm-feltsalg'. */
  path: string;
  title: string;
  description: string;
  /** Kategorietikett på hub-siden. */
  category: string;
  published: boolean;
  /**
   * 'akademi' = bor under /akademi og rutes/prerendres herfra.
   * 'guide'   = eksisterende frittstående side (egen rute/prerender) som
   *             kun listes på hub-siden.
   */
  source: 'akademi' | 'guide';
}

export const AKADEMI_ARTICLES: AkademiArticle[] = [
  {
    key: 'samarbeid-salg-marked',
    path: '/akademi/samarbeid-salg-marked',
    title: 'Salg og marked som samarbeider: hva tallene faktisk sier | Leadgrid Akademi',
    description:
      'B2B-rapporten (Inbound/MFO/Norstat, 650 norske selskaper): 58 % av virksomheter der salg og marked samarbeider godt når målene sine — mot 28 % der samarbeidet er dårlig. Hva skiller de som lykkes?',
    category: 'B2B-salg',
    published: true,
    source: 'akademi',
  },
  {
    key: 'velge-crm-feltsalg',
    path: '/akademi/velge-crm-feltsalg',
    title: 'Slik velger du CRM for feltsalg i Norge — 7 kriterier | Leadgrid Akademi',
    description:
      'Kriterieguide for norske salgsteam som jobber ute hos kunden: datakilder, mobilapper, kartstøtte, GDPR/EU-lagring, pipeline-flyt, prismodell og norsk språk — og hvorfor generiske CRM ofte feiler i felt.',
    category: 'Verktøy',
    published: true,
    source: 'akademi',
  },
  {
    key: 'skaffe-leads-guide',
    path: '/skaffe-leads-guide',
    title: 'Slik skaffer du flere kunder som håndverker eller liten bedrift — uten dyre annonser',
    description:
      'Egen lead-generering med norske datakilder (Brønnøysundregistrene, SSB) vs. kjøpte leads og annonser — for håndverkere og servicebedrifter.',
    category: 'Leadgenerering',
    published: true,
    source: 'guide',
  },
  {
    key: 'feltsalg-for-salgsteam',
    path: '/feltsalg-for-salgsteam',
    title: 'Feltsalg for salgsteam: territorier, ruter og salgsledelse på kart',
    description:
      'Territorie-fordeling, ruteplanlegging og kundebesøk registrert fra mobil — hvordan moderne feltsalg-team jobber.',
    category: 'Feltsalg',
    published: true,
    source: 'guide',
  },
];

export function getAkademiArticle(key: string): AkademiArticle | undefined {
  return AKADEMI_ARTICLES.find((a) => a.key === key);
}
