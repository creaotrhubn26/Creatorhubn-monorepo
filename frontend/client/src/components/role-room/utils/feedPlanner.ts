import type {
  RoleRoomAgentBrandColor,
  RoleRoomAgentProducerBootstrapResult,
  RoleRoomFeedBrandSnapshot,
  RoleRoomFeedPlatform,
  RoleRoomFeedPost,
  RoleRoomFeedPostConcept,
} from '../services/roleRoomAgentService';

export const FEED_POST_CONCEPT_ORDER: RoleRoomFeedPostConcept[] = [
  'product_highlight',
  'behind_the_scenes',
  'testimonial',
  'promo',
  'educational',
  'announcement',
];

export const CONCEPT_LABELS: Record<RoleRoomFeedPostConcept, string> = {
  product_highlight: 'Produkt',
  behind_the_scenes: 'Bak kulissene',
  testimonial: 'Kundehistorie',
  promo: 'Tilbud',
  educational: 'Lær noe',
  announcement: 'Nyhet',
};

const CONCEPT_CTA_DEFAULTS: Record<RoleRoomFeedPostConcept, string> = {
  product_highlight: 'Se utvalget i bio',
  behind_the_scenes: 'Besøk oss',
  testimonial: 'Les flere historier',
  promo: 'Bestill nå',
  educational: 'Lagre innlegget',
  announcement: 'Les mer',
};

const CONCEPT_HASHTAG_HINTS: Record<RoleRoomFeedPostConcept, string[]> = {
  product_highlight: ['produkt', 'utvalg', 'kvalitet'],
  behind_the_scenes: ['bakkulissene', 'teamet', 'hverdag'],
  testimonial: ['kundehistorie', 'anbefalt', 'fornoyd'],
  promo: ['tilbud', 'kampanje', 'aktuelt'],
  educational: ['tips', 'visste_du', 'guide'],
  announcement: ['nyhet', 'aktuelt', 'viktig'],
};

const CONCEPT_IMAGE_STYLES: Record<RoleRoomFeedPostConcept, string> = {
  product_highlight: 'Ren flatlay-komposisjon med produkt i sentrum',
  behind_the_scenes: 'Autentisk arbeidssnapshot med naturlig lys',
  testimonial: 'Portrett av kunden med sitat-overlay',
  promo: 'Stor typografi med brand-farge som bakgrunn',
  educational: 'Ikonbasert info-grafikk med tre punkter',
  announcement: 'Bold hero-bilde med kort tittel',
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function slugHashtag(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .toLowerCase();
}

function pickColor(colors: RoleRoomAgentBrandColor[], index: number, fallback: string): string {
  if (colors.length === 0) return fallback;
  const entry = colors[index % colors.length];
  return entry?.hex || fallback;
}

export function deriveBrandSnapshot(
  bootstrap: RoleRoomAgentProducerBootstrapResult,
): RoleRoomFeedBrandSnapshot {
  const brandGuide = bootstrap.planningDraft?.brandGuide;
  const colors = Array.isArray(brandGuide?.colors) ? brandGuide.colors : [];
  return {
    companyName: bootstrap.companyProfile?.companyName ?? null,
    logoUrl: brandGuide?.logoUrl || bootstrap.companyProfile?.logoUrl || null,
    primaryColor: colors[0]?.hex ?? null,
    secondaryColor: colors[1]?.hex ?? null,
    accentColor: colors[2]?.hex ?? null,
    toneOfVoice: brandGuide?.toneOfVoice ?? null,
    visualStyle: brandGuide?.visualStyle ?? null,
  };
}

type GenerateOptions = {
  count?: number;
  rotate?: boolean;
};

type BootstrapDerived = {
  companyName: string;
  offerings: string[];
  audience: string[];
  tone: string;
  keyMessage: string;
  brandColors: RoleRoomAgentBrandColor[];
  companyHashtag: string;
  industryHashtag: string;
};

function deriveBootstrapData(bootstrap: RoleRoomAgentProducerBootstrapResult): BootstrapDerived {
  return {
    companyName: bootstrap.companyProfile?.companyName || 'Merket',
    offerings: Array.isArray(bootstrap.companyProfile?.offerings)
      ? bootstrap.companyProfile.offerings.filter(hasText)
      : [],
    audience: Array.isArray(bootstrap.companyProfile?.targetAudience)
      ? bootstrap.companyProfile.targetAudience.filter(hasText)
      : [],
    tone: bootstrap.planningDraft?.brandGuide?.toneOfVoice || 'Tydelig og varm',
    keyMessage: bootstrap.intakeDraft?.keyMessage || bootstrap.companyProfile?.summary || '',
    brandColors: Array.isArray(bootstrap.planningDraft?.brandGuide?.colors)
      ? bootstrap.planningDraft.brandGuide.colors.filter((entry) => Boolean(entry?.hex))
      : [],
    companyHashtag: slugHashtag(bootstrap.companyProfile?.companyName || ''),
    industryHashtag: slugHashtag(bootstrap.companyProfile?.industry || ''),
  };
}

export function buildFeedPost(
  bootstrap: RoleRoomAgentProducerBootstrapResult,
  options: {
    id: string;
    index: number;
    concept: RoleRoomFeedPostConcept;
    platform: RoleRoomFeedPlatform;
  },
): RoleRoomFeedPost {
  const derived = deriveBootstrapData(bootstrap);
  const { id, index, concept } = options;
  const offering = derived.offerings[index % Math.max(derived.offerings.length, 1)] || 'Tjenesten vår';
  const audienceSegment = derived.audience[index % Math.max(derived.audience.length, 1)] || 'nærmiljøet';

  const title = buildTitle(concept, offering, derived.companyName, audienceSegment, derived.keyMessage);
  const caption = buildCaption(concept, offering, audienceSegment, derived.keyMessage, derived.tone);
  const hashtags = [derived.companyHashtag, derived.industryHashtag, ...CONCEPT_HASHTAG_HINTS[concept]]
    .filter(hasText)
    .map((entry) => (entry.startsWith('#') ? entry : `#${entry}`));

  const backgroundColor = pickColor(derived.brandColors, index, index % 2 === 0 ? '#0f172a' : '#1e293b');
  const accentColor = pickColor(derived.brandColors, index + 1, '#22d3ee');

  return {
    id,
    concept,
    title,
    caption,
    hashtags,
    callToAction: CONCEPT_CTA_DEFAULTS[concept],
    imageStyle: CONCEPT_IMAGE_STYLES[concept],
    scheduledFor: null,
    backgroundColor,
    accentColor,
    textColor: '#f8fafc',
    logoPlacement: index % 3 === 0 ? 'top-left' : index % 3 === 1 ? 'bottom-right' : 'top-right',
    mediaType: concept === 'behind_the_scenes' ? 'reel' : 'image',
    locked: false,
  };
}

export function generateFeedPostsFromBootstrap(
  bootstrap: RoleRoomAgentProducerBootstrapResult,
  platform: RoleRoomFeedPlatform,
  options: GenerateOptions = {},
): RoleRoomFeedPost[] {
  const count = options.count ?? 12;
  const rotationOffset = options.rotate ? Math.floor(Math.random() * FEED_POST_CONCEPT_ORDER.length) : 0;

  const posts: RoleRoomFeedPost[] = [];
  for (let index = 0; index < count; index += 1) {
    const concept = FEED_POST_CONCEPT_ORDER[(index + rotationOffset) % FEED_POST_CONCEPT_ORDER.length];
    posts.push(
      buildFeedPost(bootstrap, {
        id: `${platform}-post-${index + 1}`,
        index,
        concept,
        platform,
      }),
    );
  }

  return posts;
}

/**
 * Suggest ISO dates for each post using a Man/Ons/Fre cadence starting from
 * the first upcoming Monday. Deterministic — respects manually scheduled
 * posts by skipping their assignments.
 */
export function buildDefaultSchedule(posts: RoleRoomFeedPost[], startDate: Date = new Date()): RoleRoomFeedPost[] {
  const cadenceDays = [1, 3, 5]; // Monday, Wednesday, Friday (JS Sunday=0)
  const baseline = new Date(startDate);
  baseline.setHours(9, 0, 0, 0);
  const dayOfWeek = baseline.getDay();
  // Advance to next Monday if we're past Friday.
  const daysUntilMonday = dayOfWeek === 1 ? 0 : ((8 - dayOfWeek) % 7 || 7);
  baseline.setDate(baseline.getDate() + daysUntilMonday);

  const schedule: Date[] = [];
  let weekCursor = new Date(baseline);
  while (schedule.length < posts.length) {
    for (const offset of cadenceDays) {
      const monday = new Date(weekCursor);
      const date = new Date(monday);
      date.setDate(monday.getDate() + (offset - 1));
      schedule.push(date);
      if (schedule.length >= posts.length) break;
    }
    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  return posts.map((post, index) => {
    if (post.scheduledFor) return post;
    const date = schedule[index];
    return { ...post, scheduledFor: date.toISOString() };
  });
}

function buildTitle(
  concept: RoleRoomFeedPostConcept,
  offering: string,
  companyName: string,
  audience: string,
  keyMessage: string,
): string {
  switch (concept) {
    case 'product_highlight':
      return offering.length > 48 ? `${offering.slice(0, 45)}…` : offering;
    case 'behind_the_scenes':
      return `Slik jobber ${companyName}`;
    case 'testimonial':
      return `«Derfor valgte vi ${companyName}»`;
    case 'promo':
      return offering ? `Akkurat nå: ${offering}` : 'Akkurat nå hos oss';
    case 'educational':
      return keyMessage ? keyMessage.split('.')[0].slice(0, 60) : `3 grunner for ${audience}`;
    case 'announcement':
      return `Nyhet for ${audience}`;
    default:
      return companyName;
  }
}

function buildCaption(
  concept: RoleRoomFeedPostConcept,
  offering: string,
  audience: string,
  keyMessage: string,
  tone: string,
): string {
  const head = keyMessage ? keyMessage.split('.').slice(0, 1).join('.').trim() : '';
  const base = head ? `${head}.` : '';
  switch (concept) {
    case 'product_highlight':
      return `${base} Fokus i dag: ${offering}. Laget for ${audience}.`.trim();
    case 'behind_the_scenes':
      return `${base} Et lite innblikk i hvordan vi gjør ting. Tone: ${tone}.`.trim();
    case 'testimonial':
      return `${base} En kundehistorie som viser hvorfor ${audience} velger oss.`.trim();
    case 'promo':
      return `${base} Gå ikke glipp av dette — aktuelt nå for ${audience}.`.trim();
    case 'educational':
      return `${base} Kort guide for ${audience}. Lagre innlegget for senere.`.trim();
    case 'announcement':
      return `${base} Noe nytt å dele med ${audience} i dag.`.trim();
    default:
      return base;
  }
}
