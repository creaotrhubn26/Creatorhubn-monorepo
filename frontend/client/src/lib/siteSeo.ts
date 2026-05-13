type SiteKey = 'creatorhub' | 'role-room';

interface SiteDefinition {
  key: SiteKey;
  name: string;
  origin: string;
  locale: string;
  themeColor: string;
  defaultImageUrl: string;
  logoUrl: string;
  contactEmail: string;
}

interface SeoMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  site: SiteDefinition;
}

const CREATORHUB_HOSTS = new Set(['creatorhubn.com', 'www.creatorhubn.com']);
const ROLE_ROOM_HOSTS = new Set(['theroleroom.com', 'www.theroleroom.com']);

const CREATORHUB_SITE: SiteDefinition = {
  key: 'creatorhub',
  name: 'CreatorHub Norge',
  origin: 'https://creatorhubn.com',
  locale: 'nb_NO',
  themeColor: '#17120f',
  defaultImageUrl: 'https://creatorhubn.com/landing_backdrop_with_logo.png',
  logoUrl: 'https://creatorhubn.com/creatorhub-wordmark-light.png',
  contactEmail: 'hello@creatorhubn.com',
};

const ROLE_ROOM_SITE: SiteDefinition = {
  key: 'role-room',
  name: 'The Role Room',
  origin: 'https://theroleroom.com',
  locale: 'no_NO',
  themeColor: '#121218',
  defaultImageUrl:
    'https://theroleroom.com/role-room-assets/landing_backdrop_with_logo.webp',
  logoUrl: 'https://theroleroom.com/TheRoleRoom_App_Logo.png',
  contactEmail: 'support@theroleroom.com',
};

const CREATORHUB_PUBLIC_CANONICAL_PATHS = new Set([
  '/',
  '/about',
  '/about-us',
  '/pricing',
  '/academy',
  '/community',
  '/news',
  '/request-access',
  '/creatorhub-innovasjon',
  '/privacy-policy',
  '/terms-and-conditions',
  '/cookie-policy',
  '/data-deletion',
]);

const CREATORHUB_NOINDEX_PATTERNS = [
  /^\/admin(?:$|\/)/,
  /^\/visual-cms-admin(?:$|\/)/,
  /^\/equipment-admin(?:$|\/)/,
  /^\/showcase-admin(?:$|\/)/,
  /^\/login(?:$|\/)/,
  /^\/dashboard(?:$|\/)/,
  /^\/settings(?:$|\/)/,
  /^\/subscription(?:$|\/)/,
  /^\/subscription-selection(?:$|\/)/,
  /^\/contracts(?:$|\/)/,
  /^\/client(?:$|\/)/,
  /^\/vendor-dashboard(?:$|\/)/,
  /^\/academy-dashboard(?:$|\/)/,
  /^\/academy\/(?!$)/,
  /^\/visual-editor(?:$|[-/])/,
  /^\/wiremock(?:$|\/)/,
  /^\/oauth(?:$|[-/])/,
  /^\/auth(?:$|\/)/,
  /^\/verification-demo(?:$|\/)/,
  /^\/integration-test(?:$|\/)/,
  /^\/camera-selection-test(?:$|\/)/,
  /^\/lightroom-simulator(?:$|\/)/,
  /^\/contextual-photography-tips(?:$|\/)/,
];

const ROLE_ROOM_PUBLIC_PATHS = new Set([
  '/',
  '/talentportal',
  '/utdanningsinstitusjon',
  '/alternatives',
  '/vs-studiobinder',
  '/vs-castingnetworks',
  '/vs-moviemagic',
  '/vs-yamdu',
  '/vs-setkeeper',
  '/for-studenter',
  '/film-tv-utdanning',
  '/casting-director-utdanning',
  '/regissor-verktoy',
  '/produksjonsledelse-studie',
  '/innholdsprodusenter',
  '/innholdsproduksjon-studie',
  '/dansestudio',
]);

const ROLE_ROOM_NOINDEX_PATTERNS = [
  /^\/admin(?:$|\/)/,
  /^\/api(?:$|\/)/,
  /^\/activate(?:$|\/)/,
  /^\/login(?:$|\/)/,
];

function normalizeHostname(hostname: string | null | undefined): string {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizePathname(pathname: string | null | undefined): string {
  if (typeof pathname !== 'string' || !pathname.trim()) {
    return '/';
  }

  const normalized = pathname.trim();
  if (normalized === '/') {
    return '/';
  }

  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function resolveSite(hostname: string | null | undefined): SiteDefinition {
  const normalizedHostname = normalizeHostname(hostname);
  return ROLE_ROOM_HOSTS.has(normalizedHostname) ? ROLE_ROOM_SITE : CREATORHUB_SITE;
}

function matchesAnyPattern(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(pathname));
}

function buildCreatorHubSeo(pathname: string): SeoMetadata {
  const canonicalPath = pathname === '/about-us' ? '/about' : pathname;
  const base = {
    site: CREATORHUB_SITE,
    canonicalUrl: `${CREATORHUB_SITE.origin}${canonicalPath === '/' ? '/' : canonicalPath}`,
    robots:
      CREATORHUB_PUBLIC_CANONICAL_PATHS.has(pathname) &&
      !matchesAnyPattern(pathname, CREATORHUB_NOINDEX_PATTERNS)
        ? 'index,follow'
        : 'noindex,follow',
  };

  switch (pathname) {
    case '/':
      return {
        ...base,
        title: 'CreatorHub Norge | Plattform for skapere, team og Academy',
        description:
          'CreatorHub samler prosjektstyring, abonnementsflyt, kundeopplevelse, Academy og CreatorHub Community i én plattform for skapere og kreative team.',
      };
    case '/about':
    case '/about-us':
      return {
        ...base,
        title: 'Om CreatorHub AS | Plattform for kreativ drift og vekst',
        description:
          'Les om CreatorHub AS, plattformmodellen vår og hvordan CreatorHub samler prosjektstyring, produkter og community i ett økosystem.',
      };
    case '/pricing':
      return {
        ...base,
        title: 'Priser | CreatorHub Norge',
        description:
          'Sammenlign CreatorHub-planene, se månedlig og årlig pris, og velg riktig oppsett for skapere, team og virksomheter.',
      };
    case '/academy':
      return {
        ...base,
        title: 'CreatorHub Academy | Kurs og faglig utvikling',
        description:
          'CreatorHub Academy samler kurs, læringsløp og faglig utvikling for skapere som vil bygge ferdigheter og struktur.',
      };
    case '/community':
      return {
        ...base,
        title: 'CreatorHub Community | Nettverk og samarbeid',
        description:
          'Bli med i CreatorHub Community for samarbeid, samtaler og deling av erfaringer mellom skapere og kreative fagmiljøer.',
      };
    case '/news':
      return {
        ...base,
        title: 'Nyheter | CreatorHub Norge',
        description:
          'Følg produktnyheter, lanseringer og oppdateringer fra CreatorHub Norge.',
      };
    case '/request-access':
      return {
        ...base,
        title: 'Be om tilgang | CreatorHub Norge',
        description:
          'Send en forespørsel om tilgang til CreatorHub og beskriv hvordan du vil bruke plattformen.',
      };
    case '/creatorhub-innovasjon':
      return {
        ...base,
        title: 'Creatorhub Innovasjon | Produkter utviklet av Creatorhub AS',
        description:
          'Utforsk Creatorhub Innovasjon og se hvordan Tidum presenteres som et produkt utviklet av Creatorhub AS.',
      };
    case '/privacy-policy':
      return {
        ...base,
        title: 'Personvernerklæring | CreatorHub Norge',
        description:
          'Les hvordan CreatorHub Norge behandler personopplysninger, cookies og sikkerhetstiltak.',
      };
    case '/terms-and-conditions':
      return {
        ...base,
        title: 'Vilkår og betingelser | CreatorHub Norge',
        description:
          'Les abonnementsvilkår, refusjonspolicy og bruksvilkår for CreatorHub Norge.',
      };
    case '/data-deletion':
      return {
        ...base,
        title: 'Sletting av data | CreatorHub Norge',
        description:
          'Les hvordan du ber om sletting av personopplysninger og hvilke data CreatorHub beholder etter lovpålagte krav.',
      };
    default:
      return {
        ...base,
        title: 'CreatorHub Norge',
        description:
          'CreatorHub samler kreative arbeidsflyter, læring og samarbeid i én norsk plattform.',
      };
  }
}

function buildRoleRoomSeo(pathname: string): SeoMetadata {
  const canonicalPath = ROLE_ROOM_PUBLIC_PATHS.has(pathname) ? pathname : '/';
  const base = {
    site: ROLE_ROOM_SITE,
    canonicalUrl: `${ROLE_ROOM_SITE.origin}${canonicalPath === '/' ? '/' : canonicalPath}`,
    robots:
      ROLE_ROOM_PUBLIC_PATHS.has(pathname) &&
      !matchesAnyPattern(pathname, ROLE_ROOM_NOINDEX_PATTERNS)
        ? 'index,follow'
        : 'noindex,follow',
  };

  switch (pathname) {
    case '/talentportal':
      return {
        ...base,
        title: 'Talentportal | The Role Room',
        description:
          'Talentportalen i The Role Room gir produksjoner og talenter en strukturert vei inn i casting, forespørsler og oppfølging.',
      };
    case '/utdanningsinstitusjon':
      return {
        ...base,
        title: 'For utdanningsinstitusjoner | The Role Room',
        description:
          'The Role Room for utdanningsinstitusjoner kobler studenter, fagmiljø og produksjonsplanlegging i en strukturert arbeidsflate.',
      };
    case '/':
    default:
      return {
        ...base,
        title: 'The Role Room | Casting, crew og produksjonsplanlegging',
        description:
          'The Role Room er produksjonsflaten i CreatorHub for casting, team, talentportal og koordinering av opptaksdager.',
      };
  }
}

function upsertMeta(
  selector: string,
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string,
) {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function upsertStructuredData(id: string, payload: Record<string, unknown>) {
  if (typeof document === 'undefined') return;

  let element = document.head.querySelector<HTMLScriptElement>(
    `script[data-seo-ld="${id}"]`,
  );
  if (!element) {
    element = document.createElement('script');
    element.type = 'application/ld+json';
    element.setAttribute('data-seo-ld', id);
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(payload);
}

function buildStructuredData(metadata: SeoMetadata) {
  const websiteId = `${metadata.site.origin}/#website`;
  const organizationId = `${metadata.site.origin}/#organization`;

  return {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': organizationId,
      name: metadata.site.name,
      url: metadata.site.origin,
      logo: metadata.site.logoUrl,
      email: metadata.site.contactEmail,
    },
    website: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': websiteId,
      url: metadata.site.origin,
      name: metadata.site.name,
      inLanguage: metadata.site.locale,
      publisher: {
        '@id': organizationId,
      },
    },
    webpage: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: metadata.canonicalUrl,
      name: metadata.title,
      description: metadata.description,
      isPartOf: {
        '@id': websiteId,
      },
      about: {
        '@id': organizationId,
      },
      inLanguage: metadata.site.locale,
    },
  };
}

export function resolveSeoMetadata(
  hostname: string | null | undefined,
  pathname: string | null | undefined,
): SeoMetadata {
  const site = resolveSite(hostname);
  const normalizedPath = normalizePathname(pathname);
  return site.key === 'role-room'
    ? buildRoleRoomSeo(normalizedPath)
    : buildCreatorHubSeo(normalizedPath);
}

export function syncSiteSeo({
  hostname,
  pathname,
}: {
  hostname: string | null | undefined;
  pathname: string | null | undefined;
}) {
  if (typeof document === 'undefined') {
    return;
  }

  const metadata = resolveSeoMetadata(hostname, pathname);
  const structuredData = buildStructuredData(metadata);

  document.title = metadata.title;
  document.documentElement.lang = metadata.site.key === 'role-room' ? 'no' : 'nb';

  upsertMeta('meta[name="description"]', 'name', 'description', metadata.description);
  upsertMeta('meta[name="robots"]', 'name', 'robots', metadata.robots);
  upsertMeta('meta[name="googlebot"]', 'name', 'googlebot', metadata.robots);
  upsertMeta('meta[name="theme-color"]', 'name', 'theme-color', metadata.site.themeColor);
  upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', metadata.site.name);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', metadata.title);
  upsertMeta(
    'meta[property="og:description"]',
    'property',
    'og:description',
    metadata.description,
  );
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', metadata.canonicalUrl);
  upsertMeta(
    'meta[property="og:image"]',
    'property',
    'og:image',
    metadata.site.defaultImageUrl,
  );
  upsertMeta(
    'meta[property="og:locale"]',
    'property',
    'og:locale',
    metadata.site.locale,
  );
  upsertMeta(
    'meta[name="twitter:card"]',
    'name',
    'twitter:card',
    'summary_large_image',
  );
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', metadata.title);
  upsertMeta(
    'meta[name="twitter:description"]',
    'name',
    'twitter:description',
    metadata.description,
  );
  upsertMeta(
    'meta[name="twitter:image"]',
    'name',
    'twitter:image',
    metadata.site.defaultImageUrl,
  );
  upsertLink('canonical', metadata.canonicalUrl);

  upsertStructuredData('organization', structuredData.organization);
  upsertStructuredData('website', structuredData.website);
  upsertStructuredData('webpage', structuredData.webpage);
}
