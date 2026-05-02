/**
 * Cross-platform social Publisher interface.
 *
 * Hver plattform-implementasjon (InstagramPublisher, FacebookPagePublisher,
 * TikTokPublisher, ...) implementerer dette samme grensesnittet, slik at
 * Feed Planner og Marketing Plan kan publisere på tvers av alle plattformer
 * via én enhetlig dispatcher uten å vite om plattform-spesifikke detaljer.
 *
 * Dette er foundation-laget for Brandwatch-style e2e marketing-løsning:
 *   1. Feed Planner produserer SocialPostInput-objekter
 *   2. Dispatcher router til riktig Publisher basert på platform
 *   3. Publisher kaller plattform-spesifikk Graph API
 *   4. Publish-resultatet returnerer normalisert PublishResult med
 *      external_post_id som senere brukes til å fetche metrics og koble
 *      sammen webhook-events fra social_events-tabellen.
 */

export type SocialPlatform =
  | 'instagram'
  | 'facebook_page'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'
  | 'x'
  | 'threads'
  | 'pinterest';

export type SocialMediaKind =
  | 'image'
  | 'reel'
  | 'video'
  | 'carousel'
  | 'story'
  | 'text'
  | 'link';

export interface SocialPostInput {
  /** Connection-ID i underliggende plattform-tabell. Publisher ber om
   *  fersk token + scope-info via getConnection() på sin egen side. */
  connectionId: string;
  /** Brukeren som publisherer (audit + rate-limiting). */
  userId: string;
  /** Prosjekt-tilhørighet for cross-referencing til marketing plan. */
  projectId: string;
  /** Original post-id i Feed Planner (role_room_feed_plans.posts[i].id). */
  feedPlanPostId?: string;
  /** Innholds-type. Plattformer som ikke støtter typen returnerer
   *  PublishResult med ok=false + reason='unsupported_media_kind'. */
  mediaKind: SocialMediaKind;
  caption: string;
  /** Single image data-URL eller URL. */
  imageUrl?: string;
  /** 2-10 image data-URLs / URLs for carousel. */
  imageUrls?: string[];
  /** Video data-URL / URL for reel/video. */
  videoUrl?: string;
  /** Plattform-spesifikke felter (link-target, thumbnail, location, etc.). */
  extras?: Record<string, unknown>;
  /** Plan tidspunkt for fyring. Hvis null → publisher umiddelbart. */
  scheduledFor?: Date | null;
}

export type PublishResultStatus =
  | 'queued'
  | 'published'
  | 'scheduled'
  | 'failed'
  | 'rate_limited'
  | 'unsupported';

export interface PublishResult {
  ok: boolean;
  status: PublishResultStatus;
  /** Plattform-native post-ID, populeres ved 'published'. */
  externalPostId?: string;
  /** Plattform-native account-ID hvor posten ligger (f.eks. YouTube
   *  channel ID, IG ig_business_account_id). Hvis publisher kjenner
   *  account-id-en uten egen DB-lookup, settes den her — dispatcher
   *  bruker den til social_metrics-recording uten ekstra round-trip. */
  accountId?: string;
  /** Permalenke til posten på plattformen, for verifikasjon i UI. */
  permalink?: string;
  /** Job-ID i intern queue, populeres ved 'queued' eller 'scheduled'. */
  jobId?: string;
  /** Maskin-lesbart feilkode for retry-logikk og UI-meldinger. */
  reason?: string;
  /** Fri-tekst feilmelding for logging. */
  error?: string;
  /** Rå plattform-svar for debugging. */
  raw?: unknown;
}

/**
 * Plattform-agnostisk metric-snapshot. Hver Publisher implementerer
 * fetchInsights() for sin plattform og normaliserer til denne shapen
 * før innsetting i social_metrics-tabellen.
 */
export interface MetricSnapshot {
  metricName: string;
  metricValue: number | null;
  metricValueText?: string | null;
  scope: 'post' | 'reel' | 'story' | 'video' | 'account' | 'page';
  recordedAt: Date;
  raw?: unknown;
}

export interface FetchInsightsInput {
  connectionId: string;
  externalPostId?: string;
  scope: MetricSnapshot['scope'];
}

/**
 * Hver plattform-implementasjon må eksportere ett objekt som matcher
 * dette grensesnittet. Dispatcher (social-publish-dispatcher.ts) holder
 * et map { [platform]: SocialPublisher } og router publish-kall.
 */
export interface SocialPublisher {
  readonly platform: SocialPlatform;

  /** Validér input mot plattform-spesifikke regler. Returner null hvis
   *  OK, ellers en kort feilmelding (caption-for-lang, mangler video, etc.). */
  validate(post: SocialPostInput): string | null;

  /** Publisher posten. Kan returnere status='queued' hvis plattformen
   *  bruker container-flow (IG/TikTok), 'published' hvis direkte. */
  publish(post: SocialPostInput): Promise<PublishResult>;

  /** Hent insights/analytics for en gitt post eller konto. */
  fetchInsights(input: FetchInsightsInput): Promise<MetricSnapshot[]>;
}

/**
 * Registry — fylles ved app-start (registerPublisher kalles fra hver
 * plattform-implementasjon). Sørger for at dispatcher kan finne riktig
 * publisher uten kompilerings-tids-kobling.
 */
const publisherRegistry = new Map<SocialPlatform, SocialPublisher>();

export function registerPublisher(publisher: SocialPublisher): void {
  publisherRegistry.set(publisher.platform, publisher);
}

export function getPublisher(platform: SocialPlatform): SocialPublisher | null {
  return publisherRegistry.get(platform) ?? null;
}

export function listRegisteredPlatforms(): SocialPlatform[] {
  return Array.from(publisherRegistry.keys());
}

/**
 * Dispatcher entry-point. Router post til riktig publisher basert på
 * platform-felt. Bruker fra Feed Planner / Marketing Plan / cron-worker.
 */
export async function dispatchPublish(
  platform: SocialPlatform,
  post: SocialPostInput,
): Promise<PublishResult> {
  const publisher = getPublisher(platform);
  if (!publisher) {
    return {
      ok: false,
      status: 'unsupported',
      reason: 'platform_not_registered',
      error: `No publisher registered for platform "${platform}". Available: ${listRegisteredPlatforms().join(', ') || '(none)'}`,
    };
  }
  const validationError = publisher.validate(post);
  if (validationError) {
    return {
      ok: false,
      status: 'failed',
      reason: 'validation_failed',
      error: validationError,
    };
  }
  return publisher.publish(post);
}

export async function dispatchFetchInsights(
  platform: SocialPlatform,
  input: FetchInsightsInput,
): Promise<MetricSnapshot[]> {
  const publisher = getPublisher(platform);
  if (!publisher) return [];
  return publisher.fetchInsights(input);
}
