/**
 * LinkedInPublisher — implementerer SocialPublisher mot LinkedIn UGC API.
 *
 * Hva som er støttet i denne første versjonen:
 *   ✓ Text-only post (member-level, via /v2/ugcPosts)
 *   ✓ Lookup av eksisterende encrypted token fra role_room_linkedin_connections
 *   ✓ AES-256-GCM-decrypt med samme nøkkel som role-room-routes bruker
 *
 * Kommer i fremtidig versjon:
 *   - Image post (krever to-stegs upload via /v2/assets?action=registerUpload)
 *   - Video post (samme to-stegs flow)
 *   - Company page-publish (requires w_organization_social scope)
 *   - LinkedIn-insights henting (krever andre scopes)
 *
 * Denne modulen er bevisst minimal og defensiv — text-publish er det
 * mest brukte mediet på LinkedIn, og vi får full multi-platform-stack
 * uten å måtte implementere imageupload-flyten i samme runde.
 */

import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type {
  FetchInsightsInput,
  MetricSnapshot,
  PublishResult,
  SocialPlatform,
  SocialPostInput,
  SocialPublisher,
} from './social-publisher.js';
import { registerPublisher } from './social-publisher.js';

const LINKEDIN_API_VERSION = '202404'; // bumpe når Meta deprecates
const LINKEDIN_UGC_ENDPOINT = 'https://api.linkedin.com/v2/ugcPosts';
const LINKEDIN_ASSETS_REGISTER_ENDPOINT = 'https://api.linkedin.com/v2/assets?action=registerUpload';
const LINKEDIN_ASSETS_BASE = 'https://api.linkedin.com/v2/assets';
const LINKEDIN_CAPTION_HARD_CAP = 3000;
// LinkedIn image specs: PNG, JPEG, GIF; max 100 MB; preferred 1200×627
// (1.91:1) for shared content.
const LINKEDIN_IMAGE_BYTES_CAP = 100 * 1024 * 1024;
// LinkedIn video specs: MP4 preferred, single-PUT cap er 200 MB
// (større filer krever chunked multipart-upload, ikke implementert ennå).
// Max varighet 10 min, min 3 sek, min oppløsning 256×144 — vi validerer
// kun byte-størrelse her; format-valideringen gjøres av LinkedIn.
const LINKEDIN_VIDEO_BYTES_CAP = 200 * 1024 * 1024;
// Polling-konstanter for video-prosessering på LinkedIn.
const LINKEDIN_ASSET_POLL_INTERVAL_MS = 5_000;
const LINKEDIN_ASSET_POLL_TIMEOUT_MS = 90_000;

// Same key-derivation som role-room-routes.ts bruker. Holdes lokalt
// her så vi unngår sirkulær import av rute-laget.
function deriveLinkedInEncryptionKey(): Buffer | null {
  const secret =
    process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptLinkedInToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = deriveLinkedInEncryptionKey();
  if (!key) return null;
  const [version, ivPart, tagPart, encryptedPart] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

interface LinkedInConnectionRow {
  id: string;
  user_id: string;
  linkedin_member_id: string | null;
  access_token_encrypted: string | null;
  expiry_date: Date | null;
  connection_state: string;
}

async function loadLinkedInConnection(
  pool: Pool,
  userId: string,
): Promise<{
  memberId: string;
  accessToken: string;
  scopes: string[];
} | null> {
  try {
    const result = await pool.query<LinkedInConnectionRow & { scopes: string[] | null }>(
      `SELECT id, user_id, linkedin_member_id, access_token_encrypted, expiry_date,
              connection_state, scopes
         FROM role_room_linkedin_connections
        WHERE user_id = $1 AND project_id IS NULL AND connection_state IN ('connected', 'active')
        LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row || !row.linkedin_member_id || !row.access_token_encrypted) return null;
    const accessToken = decryptLinkedInToken(row.access_token_encrypted);
    if (!accessToken) return null;
    return {
      memberId: row.linkedin_member_id,
      accessToken,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
    };
  } catch (error) {
    console.warn('[linkedin-publish] loadLinkedInConnection failed', error);
    return null;
  }
}

export interface LinkedInManagedCompany {
  urn: string; // urn:li:organization:12345
  id: string;
  name: string | null;
  vanityName: string | null;
  logoUrl: string | null;
  role: string; // ADMINISTRATOR | DIRECT_SPONSORED_CONTENT_POSTER | etc
}

interface LinkedInOrgAclElement {
  organization?: string; // urn:li:organization:12345
  organization$DASH$?: {
    id?: number;
    localizedName?: string;
    vanityName?: string;
    logoV2?: { 'original~'?: { elements?: Array<{ identifiers?: Array<{ identifier?: string }> }> } };
  };
  role?: string;
  state?: string;
}

/**
 * Hent organisasjoner brukeren har ADMINISTRATOR-rolle på. Brukes av
 * Feed Planner-UI til "Publish as"-dropdown og av publish-flyten til
 * å validere at brukeren faktisk har rettighet til å publisere som
 * den valgte organisasjonen.
 *
 * Krever `w_organization_social` scope. Hvis tokenet ikke har det,
 * returnerer LinkedIn 403 og vi returnerer tom liste.
 */
export async function listLinkedInCompanies(
  accessToken: string,
): Promise<LinkedInManagedCompany[]> {
  try {
    // /v2/organizationAcls støtter ikke decoration via projection alene —
    // vi gjør én aclQuery + en organization-lookup per orgId. For brukere
    // med <10 orgs er dette akseptabelt; vi kan optimere senere.
    const aclUrl =
      'https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED';
    const aclResp = await fetch(aclUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!aclResp.ok) {
      const text = await aclResp.text().catch(() => '');
      console.warn(
        `[linkedin-publish] organizationAcls failed ${aclResp.status}: ${text.slice(0, 200)}`,
      );
      return [];
    }
    const aclBody = (await aclResp.json()) as { elements?: LinkedInOrgAclElement[] };
    const elements = aclBody.elements ?? [];

    const companies: LinkedInManagedCompany[] = [];
    for (const el of elements) {
      if (!el.organization) continue;
      const id = el.organization.replace('urn:li:organization:', '');
      try {
        const orgUrl = `${LINKEDIN_ASSETS_BASE.replace('/assets', '/organizations')}/${encodeURIComponent(id)}?projection=(id,localizedName,vanityName,logoV2(original~:playableStreams))`;
        const orgResp = await fetch(orgUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        if (!orgResp.ok) continue;
        const orgBody = (await orgResp.json()) as {
          id?: number;
          localizedName?: string;
          vanityName?: string;
          logoV2?: {
            'original~'?: {
              elements?: Array<{ identifiers?: Array<{ identifier?: string }> }>;
            };
          };
        };
        const logoElements = orgBody.logoV2?.['original~']?.elements ?? [];
        let logoUrl: string | null = null;
        for (const logoEl of logoElements) {
          for (const ident of logoEl.identifiers ?? []) {
            if (typeof ident.identifier === 'string' && ident.identifier.startsWith('http')) {
              logoUrl = ident.identifier;
              break;
            }
          }
          if (logoUrl) break;
        }
        companies.push({
          urn: el.organization,
          id,
          name: orgBody.localizedName ?? null,
          vanityName: orgBody.vanityName ?? null,
          logoUrl,
          role: el.role ?? 'ADMINISTRATOR',
        });
      } catch (orgErr) {
        console.warn('[linkedin-publish] organization lookup threw', orgErr);
      }
    }
    return companies;
  } catch (error) {
    console.warn('[linkedin-publish] listLinkedInCompanies threw', error);
    return [];
  }
}

/**
 * Public helper: list orgs for en gitt bruker. Brukes av
 * /api/role-room/linkedin/companies-endepunktet.
 */
export async function listManagedCompaniesForUser(
  pool: Pool,
  userId: string,
): Promise<{ companies: LinkedInManagedCompany[]; scopeMissing: boolean }> {
  const conn = await loadLinkedInConnection(pool, userId);
  if (!conn) return { companies: [], scopeMissing: false };
  const hasScope = conn.scopes.includes('w_organization_social');
  if (!hasScope) {
    return { companies: [], scopeMissing: true };
  }
  const companies = await listLinkedInCompanies(conn.accessToken);
  return { companies, scopeMissing: false };
}

interface LinkedInUgcMediaItem {
  status: 'READY';
  description?: { text: string };
  /** For IMAGE: digitalmediaAsset URN. For ARTICLE: ikke satt — bruk
   *  originalUrl i stedet. */
  media?: string;
  /** For ARTICLE: URL-en som skal previewes. LinkedIn henter Open Graph-
   *  metadata serverside og rendrer link-card automatisk. */
  originalUrl?: string;
  title?: { text: string };
}

interface LinkedInUgcPayload {
  author: string;
  lifecycleState: 'PUBLISHED' | 'DRAFT';
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: string };
      shareMediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' | 'ARTICLE';
      media?: LinkedInUgcMediaItem[];
    };
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' | 'CONNECTIONS';
  };
}

interface LinkedInUploadRegistration {
  uploadUrl: string;
  assetUrn: string;
}

function decodeImageDataUrl(
  dataUrl: string,
): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) return null;
  return { mimeType: match[1], buffer };
}

function decodeVideoDataUrl(
  dataUrl: string,
): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(video\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) return null;
  return { mimeType: match[1], buffer };
}

type LinkedInRecipe =
  | 'urn:li:digitalmediaRecipe:feedshare-image'
  | 'urn:li:digitalmediaRecipe:feedshare-video';

/**
 * Steg 1 av media-upload: be LinkedIn om en upload-URL + asset-URN for
 * en gitt recipe (image eller video). Bruker SYNCHRONOUS_UPLOAD-mekanismen
 * som returnerer én PUT-URL — chunked multipart kommer hvis vi trenger
 * å støtte filer >200 MB.
 */
async function registerMediaUpload(
  accessToken: string,
  ownerUrn: string, // 'urn:li:person:X' eller 'urn:li:organization:Y'
  recipe: LinkedInRecipe,
): Promise<LinkedInUploadRegistration | null> {
  try {
    const response = await fetch(LINKEDIN_ASSETS_REGISTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          owner: ownerUrn,
          recipes: [recipe],
          serviceRelationships: [
            {
              identifier: 'urn:li:userGeneratedContent',
              relationshipType: 'OWNER',
            },
          ],
          supportedUploadMechanism: ['SYNCHRONOUS_UPLOAD'],
        },
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(
        `[linkedin-publish] registerMediaUpload(${recipe}) failed ${response.status}: ${text.slice(0, 200)}`,
      );
      return null;
    }
    const body = (await response.json()) as {
      value?: {
        asset?: string;
        uploadMechanism?: {
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: {
            uploadUrl?: string;
          };
        };
      };
    };
    const uploadUrl =
      body.value?.uploadMechanism?.[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ]?.uploadUrl ?? null;
    const assetUrn = body.value?.asset ?? null;
    if (!uploadUrl || !assetUrn) return null;
    return { uploadUrl, assetUrn };
  } catch (error) {
    console.warn('[linkedin-publish] registerMediaUpload threw', error);
    return null;
  }
}

/**
 * Steg 2: PUT raw media bytes til upload-URL fra steg 1. Brukes for
 * både image og video (samme HTTP-mønster, kun byte-content + mime
 * varierer). Returnerer true ved 2xx.
 */
async function uploadMediaBytes(
  uploadUrl: string,
  accessToken: string,
  buffer: Buffer,
  mimeType: string,
): Promise<boolean> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(buffer),
    });
    if (!response.ok && response.status !== 201) {
      const text = await response.text().catch(() => '');
      console.warn(
        `[linkedin-publish] uploadMediaBytes failed ${response.status}: ${text.slice(0, 200)}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[linkedin-publish] uploadMediaBytes threw', error);
    return false;
  }
}

/**
 * Steg 3 (kun video): poll asset-status til AVAILABLE. LinkedIn behandler
 * video asynkront (transcoding, thumbnail-generation, content moderation).
 * UGC-post kalt før status=AVAILABLE feiler med "media not ready".
 *
 * Returns true når asset er klar, false ved timeout eller permanent feil.
 */
async function waitForAssetReady(
  accessToken: string,
  assetUrn: string,
  recipe: LinkedInRecipe,
): Promise<boolean> {
  const assetId = assetUrn.replace('urn:li:digitalmediaAsset:', '');
  const startedAt = Date.now();
  while (Date.now() - startedAt < LINKEDIN_ASSET_POLL_TIMEOUT_MS) {
    try {
      const url = `${LINKEDIN_ASSETS_BASE}/${encodeURIComponent(assetId)}?projection=(id,recipes)`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      if (!response.ok) {
        await new Promise((r) => setTimeout(r, LINKEDIN_ASSET_POLL_INTERVAL_MS));
        continue;
      }
      const body = (await response.json()) as {
        recipes?: Array<{ recipe?: string; status?: string }>;
      };
      const matched = (body.recipes ?? []).find((r) => r.recipe === recipe);
      if (matched?.status === 'AVAILABLE') return true;
      if (matched?.status === 'FAILED') {
        console.warn(`[linkedin-publish] asset ${assetUrn} processing FAILED`);
        return false;
      }
      // Fortsatt PROCESSING — vent og prøv igjen
      await new Promise((r) => setTimeout(r, LINKEDIN_ASSET_POLL_INTERVAL_MS));
    } catch (error) {
      console.warn('[linkedin-publish] waitForAssetReady poll threw', error);
      await new Promise((r) => setTimeout(r, LINKEDIN_ASSET_POLL_INTERVAL_MS));
    }
  }
  console.warn(
    `[linkedin-publish] asset ${assetUrn} did not become AVAILABLE within ${LINKEDIN_ASSET_POLL_TIMEOUT_MS / 1000}s`,
  );
  return false;
}

interface PostUgcOptions {
  /** Asset-URN fra registerUpload (IMAGE-mode). Eksklusivt med articleUrl
   *  og videoAssetUrn. */
  mediaAssetUrn?: string;
  /** Asset-URN for VIDEO-mode (etter at status=AVAILABLE er bekreftet). */
  videoAssetUrn?: string;
  /** URL for ARTICLE-mode. LinkedIn henter Open Graph automatisk. */
  articleUrl?: string;
  articleTitle?: string;
  articleDescription?: string;
}

async function postUgc(
  accessToken: string,
  authorUrn: string, // 'urn:li:person:X' eller 'urn:li:organization:Y'
  caption: string,
  options: PostUgcOptions = {},
): Promise<{
  ok: boolean;
  postId: string | null;
  status: number;
  error: string | null;
  raw: unknown;
}> {
  let shareMediaCategory: 'NONE' | 'IMAGE' | 'VIDEO' | 'ARTICLE' = 'NONE';
  let media: LinkedInUgcMediaItem[] | undefined;

  if (options.articleUrl) {
    shareMediaCategory = 'ARTICLE';
    media = [
      {
        status: 'READY',
        originalUrl: options.articleUrl,
        ...(options.articleTitle ? { title: { text: options.articleTitle } } : {}),
        ...(options.articleDescription
          ? { description: { text: options.articleDescription } }
          : {}),
      },
    ];
  } else if (options.videoAssetUrn) {
    shareMediaCategory = 'VIDEO';
    media = [
      {
        status: 'READY',
        media: options.videoAssetUrn,
      },
    ];
  } else if (options.mediaAssetUrn) {
    shareMediaCategory = 'IMAGE';
    media = [
      {
        status: 'READY',
        media: options.mediaAssetUrn,
      },
    ];
  }

  const shareContent: LinkedInUgcPayload['specificContent']['com.linkedin.ugc.ShareContent'] = {
    shareCommentary: { text: caption },
    shareMediaCategory,
  };
  if (media) shareContent.media = media;

  const payload: LinkedInUgcPayload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent,
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  try {
    const response = await fetch(LINKEDIN_UGC_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep raw */
    }

    if (!response.ok) {
      const message =
        (parsed as { message?: string } | null)?.message ??
        `LinkedIn API returnerte ${response.status}`;
      return {
        ok: false,
        postId: null,
        status: response.status,
        error: message,
        raw: parsed ?? text,
      };
    }

    // LinkedIn returnerer post-id i `id`-feltet eller i x-restli-id-header
    const headerId = response.headers.get('x-restli-id');
    const bodyId =
      typeof (parsed as { id?: string } | null)?.id === 'string'
        ? (parsed as { id: string }).id
        : null;
    const postId = bodyId ?? headerId ?? null;

    return {
      ok: true,
      postId,
      status: response.status,
      error: null,
      raw: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      postId: null,
      status: 0,
      error: (error as Error).message,
      raw: null,
    };
  }
}

export function makeLinkedInPublisher(pool: Pool): SocialPublisher {
  const platform: SocialPlatform = 'linkedin';

  return {
    platform,

    validate(post: SocialPostInput): string | null {
      // LinkedIn UGC støtter nå text + image + video + reel + link.
      // Carousel finnes ikke som native UGC-type på LinkedIn.
      if (
        post.mediaKind !== 'text' &&
        post.mediaKind !== 'image' &&
        post.mediaKind !== 'video' &&
        post.mediaKind !== 'reel' &&
        post.mediaKind !== 'link'
      ) {
        return `LinkedIn publisher støtter text, image, video og link (fikk: ${post.mediaKind}). Carousel støttes ikke som native UGC.`;
      }
      if (!post.caption || !post.caption.trim()) {
        return 'LinkedIn-posten må ha tekst-innhold';
      }
      if (post.caption.length > LINKEDIN_CAPTION_HARD_CAP) {
        return `Caption må være under ${LINKEDIN_CAPTION_HARD_CAP} tegn (fikk ${post.caption.length})`;
      }
      // Company-publish: hvis brukeren spesifiserte en organisasjons-URN
      // i extras, valider at den har riktig format. Faktisk admin-rolle
      // sjekkes ved publish-tidspunkt mot LinkedIn.
      const companyUrn = (post.extras?.linkedInOrganizationUrn as string | undefined) ?? null;
      if (companyUrn && !companyUrn.startsWith('urn:li:organization:')) {
        return 'extras.linkedInOrganizationUrn må starte med "urn:li:organization:"';
      }
      if (post.mediaKind === 'image') {
        if (!post.imageUrl) {
          return 'image-post krever imageUrl (data:image/*;base64,…)';
        }
        const decoded = decodeImageDataUrl(post.imageUrl);
        if (!decoded) {
          return 'imageUrl må være data:image/*;base64,… (PNG/JPEG/GIF)';
        }
        if (decoded.buffer.length > LINKEDIN_IMAGE_BYTES_CAP) {
          return `Image er over ${LINKEDIN_IMAGE_BYTES_CAP / 1024 / 1024} MB`;
        }
      }
      if (post.mediaKind === 'video' || post.mediaKind === 'reel') {
        if (!post.videoUrl) {
          return 'video-post krever videoUrl (data:video/*;base64,…)';
        }
        const decoded = decodeVideoDataUrl(post.videoUrl);
        if (!decoded) {
          return 'videoUrl må være data:video/*;base64,… (MP4 anbefalt)';
        }
        if (decoded.buffer.length > LINKEDIN_VIDEO_BYTES_CAP) {
          return `Video er over ${LINKEDIN_VIDEO_BYTES_CAP / 1024 / 1024} MB (single-PUT cap). Chunked upload kommer senere for større filer.`;
        }
      }
      if (post.mediaKind === 'link') {
        const link = (post.extras?.link as string | undefined) ?? null;
        if (!link) {
          return 'link-post krever extras.link (en gyldig http(s)://-URL)';
        }
        if (!/^https?:\/\//i.test(link)) {
          return 'extras.link må være en absolutt URL (http:// eller https://)';
        }
      }
      return null;
    },

    async publish(post: SocialPostInput): Promise<PublishResult> {
      // For LinkedIn er connectionId = userId (én kobling per bruker
      // i role_room_linkedin_connections). Vi bruker post.userId som
      // primary key for å finne tokenet.
      const conn = await loadLinkedInConnection(pool, post.userId);
      if (!conn) {
        return {
          ok: false,
          status: 'failed',
          reason: 'connection_not_found',
          error: 'Ingen aktiv LinkedIn-tilkobling funnet for brukeren. Koble til på nytt.',
        };
      }

      // Author-URN: standard er person (member-level publish). Hvis
      // extras.linkedInOrganizationUrn er satt, bruker vi den (company-page
      // publish). Krever w_organization_social i scope.
      const companyUrn =
        (post.extras?.linkedInOrganizationUrn as string | undefined) ?? null;
      const authorUrn = companyUrn ?? `urn:li:person:${conn.memberId}`;

      // Scope-sjekk for company-publish — short-circuit med klar feilmelding
      // før vi kaller LinkedIn (som ville returnert 403 uansett, men da
      // uten norsk forklaring).
      if (companyUrn && !conn.scopes.includes('w_organization_social')) {
        return {
          ok: false,
          status: 'failed',
          reason: 'scope_missing',
          error:
            'Tilkoblingen mangler "w_organization_social"-scope. Re-connect LinkedIn for å publisere som bedrift.',
        };
      }

      // Bygg postUgc-options basert på mediaKind:
      //   image          → to-stegs upload (registerUpload + PUT bytes)
      //   video / reel   → tre-stegs (registerUpload + PUT + status-poll)
      //   link           → URL fra extras, LinkedIn henter Open Graph
      //   text           → ingen media, kun shareCommentary
      const ugcOptions: PostUgcOptions = {};

      if (post.mediaKind === 'image' && post.imageUrl) {
        const decoded = decodeImageDataUrl(post.imageUrl);
        if (!decoded) {
          return {
            ok: false,
            status: 'failed',
            reason: 'invalid_data_url',
            error: 'imageUrl må være data:image/*;base64,…',
          };
        }
        const registration = await registerMediaUpload(
          conn.accessToken,
          authorUrn,
          'urn:li:digitalmediaRecipe:feedshare-image',
        );
        if (!registration) {
          return {
            ok: false,
            status: 'failed',
            reason: 'register_upload_failed',
            error: 'LinkedIn avviste registerUpload — sjekk scope w_member_social.',
          };
        }
        const uploaded = await uploadMediaBytes(
          registration.uploadUrl,
          conn.accessToken,
          decoded.buffer,
          decoded.mimeType,
        );
        if (!uploaded) {
          return {
            ok: false,
            status: 'failed',
            reason: 'image_upload_failed',
            error: 'Bildet ble ikke lastet opp til LinkedIn assets.',
          };
        }
        ugcOptions.mediaAssetUrn = registration.assetUrn;
      } else if ((post.mediaKind === 'video' || post.mediaKind === 'reel') && post.videoUrl) {
        const decoded = decodeVideoDataUrl(post.videoUrl);
        if (!decoded) {
          return {
            ok: false,
            status: 'failed',
            reason: 'invalid_data_url',
            error: 'videoUrl må være data:video/*;base64,…',
          };
        }
        const registration = await registerMediaUpload(
          conn.accessToken,
          authorUrn,
          'urn:li:digitalmediaRecipe:feedshare-video',
        );
        if (!registration) {
          return {
            ok: false,
            status: 'failed',
            reason: 'register_upload_failed',
            error: 'LinkedIn avviste video-registerUpload — sjekk scope w_member_social.',
          };
        }
        const uploaded = await uploadMediaBytes(
          registration.uploadUrl,
          conn.accessToken,
          decoded.buffer,
          decoded.mimeType,
        );
        if (!uploaded) {
          return {
            ok: false,
            status: 'failed',
            reason: 'video_upload_failed',
            error: 'Videoen ble ikke lastet opp til LinkedIn assets.',
          };
        }
        // LinkedIn behandler video asynkront — vi må vente til status=AVAILABLE
        // før vi kan bruke asset-URN i ugcPost. Polling-timeout 90s.
        const ready = await waitForAssetReady(
          conn.accessToken,
          registration.assetUrn,
          'urn:li:digitalmediaRecipe:feedshare-video',
        );
        if (!ready) {
          return {
            ok: false,
            status: 'failed',
            reason: 'video_processing_timeout',
            error: 'LinkedIn klarte ikke å prosessere videoen innen 90 sekunder. Prøv en mindre fil eller annen format.',
          };
        }
        ugcOptions.videoAssetUrn = registration.assetUrn;
      } else if (post.mediaKind === 'link') {
        const link = (post.extras?.link as string | undefined) ?? null;
        if (!link) {
          return {
            ok: false,
            status: 'failed',
            reason: 'missing_link',
            error: 'extras.link er påkrevd for link-post',
          };
        }
        ugcOptions.articleUrl = link;
        // Tittel og beskrivelse er valgfritt — LinkedIn faller tilbake
        // til Open Graph-data fra siden hvis vi ikke sender egen.
        const title = (post.extras?.linkTitle as string | undefined) ?? null;
        const description = (post.extras?.linkDescription as string | undefined) ?? null;
        if (title) ugcOptions.articleTitle = title;
        if (description) ugcOptions.articleDescription = description;
      }

      // LinkedIn API støtter ikke schedulert publishing for member-level
      // poster via UGC endpoint. Hvis scheduledFor er satt, må scheduler-
      // worker plukke jobben på riktig tidspunkt — vi publiserer rett her.
      const result = await postUgc(
        conn.accessToken,
        authorUrn, // person-URN ELLER organization-URN avhengig av om
        //         // companyUrn ble sendt med i extras
        post.caption,
        ugcOptions,
      );

      if (!result.ok) {
        return {
          ok: false,
          status: 'failed',
          reason:
            result.status === 401 || result.status === 403
              ? 'auth_failed'
              : result.status === 429
                ? 'rate_limited'
                : 'linkedin_api_error',
          error: result.error ?? 'LinkedIn publish feilet',
          raw: result.raw,
        };
      }

      const cleanPostId = result.postId
        ? String(result.postId).replace('urn:li:share:', '').replace('urn:li:ugcPost:', '')
        : undefined;

      return {
        ok: true,
        status: 'published',
        externalPostId: cleanPostId,
        permalink: cleanPostId
          ? `https://www.linkedin.com/feed/update/urn:li:ugcPost:${cleanPostId}/`
          : undefined,
        raw: result.raw,
      };
    },

    async fetchInsights(_input: FetchInsightsInput): Promise<MetricSnapshot[]> {
      // LinkedIn-insights for member-level poster krever 'r_member_social'
      // scope og /v2/socialActions/{shareUrn}/socialMetadata-endepunktet.
      // Implementeres når scope-utvidelse er gjort.
      return [];
    },
  };
}

export function registerLinkedInPublisher(pool: Pool): void {
  registerPublisher(makeLinkedInPublisher(pool));
}
