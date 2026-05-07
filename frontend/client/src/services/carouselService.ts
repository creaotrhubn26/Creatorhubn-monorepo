/**
 * Carousel Service — Frontend API client for the Website-to-Carousel
 * pipeline (backend Slices 1-3). Mirrors roleRoomService's auth pattern.
 */

const BASE = '/api/role-room';

function getApiKey(): string {
  const stored = localStorage.getItem('roleRoomApiKey');
  return stored ?? '';
}

async function carouselFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = getApiKey();
  const authToken =
    localStorage.getItem('creatorhub_auth_token') ||
    localStorage.getItem('authToken') ||
    '';
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.detail || body?.error || '';
    } catch {
      /* ignore */
    }
    const error = new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

// ─────────────────────────────────────────────────────────
// Types — mirror backend shapes
// ─────────────────────────────────────────────────────────

export type CarouselFormat =
  | 'humor' | 'educational' | 'bts'
  | 'customer_story' | 'promo' | 'seasonal' | 'story_insight';

export type CarouselPlatform =
  | 'instagram' | 'facebook' | 'linkedin' | 'pinterest' | 'youtube';

export type LayoutId =
  | 'cover-fullbleed' | 'fullbleed-photo-text' | 'split-50-50'
  | 'centered-quote' | 'tablet-mockup' | 'big-number'
  | 'before-after' | 'list-item';

export type SlideRole = 'cover' | 'context' | 'reveal' | 'point' | 'quote' | 'cta';

export interface BrandProfile {
  url: string;
  fetchedAt: string;
  businessName: string;
  tagline: string;
  description: string;
  toneOfVoice: 'playful' | 'professional' | 'warm' | 'edgy' | 'minimal';
  usps: string[];
  primaryCTA: string;
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  fonts: { heading: string; body: string };
  logoUrl: string | null;
  faviconUrl: string | null;
  productCategories: string[];
  hasShop: boolean;
  hasBlog: boolean;
  socialLinks: Array<{ platform: string; url: string }>;
  industry: string;
  targetAudience: string;
}

export interface CarouselDraftRow {
  id: string;
  user_id: string;
  website_analysis_id: string;
  week_starting: string;
  status: 'generating' | 'ready' | 'partially_approved' | 'published' | 'failed';
  total_posts: number;
  approved_post_count: number;
  created_at: string;
}

export interface CarouselPostRow {
  id: string;
  draft_id: string;
  day_of_week: number;
  format: CarouselFormat;
  primary_platform: CarouselPlatform;
  hook: string;
  narrative: string;
  caption: Record<CarouselPlatform, string>;
  status: 'draft' | 'approved' | 'scheduled' | 'published' | 'rejected';
  scheduled_at: string | null;
  approved_at: string | null;
}

export interface CarouselSlideRow {
  id: string;
  post_id: string;
  slide_index: number;
  role: SlideRole;
  layout: LayoutId;
  text_blocks: Array<{ position: string; style: string; content: string }>;
  image_ref: ImageRef;
  brand_overlays: {
    showLogo: boolean;
    showCounter: boolean;
    counterFormat: string;
    brandName: string;
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
  };
}

export type ImageRef =
  | { strategy: 'brand-asset'; assetId: string; url: string; alt: string }
  | { strategy: 'user-gallery'; galleryId: string; assetId: string; url: string; alt: string }
  | { strategy: 'stock'; provider: 'unsplash' | 'pexels'; photoId: string; url: string; thumbnailUrl: string; attribution: string; attributionUrl: string }
  | { strategy: 'ai'; prompt: string; generatedUrl: string; cost: number; model: string }
  | { strategy: 'color-only'; color: string; textFirst: true };

export interface FullDraftResponse {
  draft: CarouselDraftRow;
  posts: CarouselPostRow[];
  slides: CarouselSlideRow[];
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export async function analyzeWebsite(
  url: string,
  options: { skipClaude?: boolean } = {},
): Promise<{ analysisId: string; cached: boolean; brandProfile: BrandProfile }> {
  return carouselFetch('/carousel/analyze-website', {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
  });
}

export async function generateDraft(
  url: string,
  weekStarting: string,
  options: { skipClaude?: boolean } = {},
): Promise<{ draft: { id: string; posts: CarouselPostRow[] } }> {
  return carouselFetch('/carousel/generate-draft', {
    method: 'POST',
    body: JSON.stringify({ url, weekStarting, ...options }),
  });
}

export async function listDrafts(): Promise<{ drafts: CarouselDraftRow[] }> {
  return carouselFetch('/carousel/drafts', { method: 'GET' });
}

export async function getDraft(draftId: string): Promise<FullDraftResponse> {
  return carouselFetch(`/carousel/drafts/${draftId}`, { method: 'GET' });
}

export async function patchSlide(
  slideId: string,
  patch: { textBlocks?: CarouselSlideRow['text_blocks']; layout?: LayoutId; imageRef?: ImageRef },
): Promise<{ slide: CarouselSlideRow }> {
  return carouselFetch(`/carousel/slides/${slideId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export interface AiImageResult {
  generatedUrl: string;
  prompt: string;
  finalPrompt: string;
  cost: number;
  model: string;
  cached: boolean;
}

export async function generateAiImageForSlide(
  slideId: string,
  body: {
    prompt: string;
    aspectRatio?: '1:1' | '4:5' | '1.91:1' | '2:3';
    brandColors?: { primary: string; secondary: string; accent: string };
    enrichWithBrand?: boolean;
  },
): Promise<{ result: AiImageResult }> {
  return carouselFetch(`/carousel/slides/${slideId}/ai-image`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface GalleryAssetMatch {
  assetId: string;
  galleryId: string;
  url: string;
  thumbnailUrl: string | null;
  alt: string | null;
  capturedAt: string | null;
  score: number;
  matchedOn: Array<'tag' | 'caption' | 'project'>;
}

export async function findGalleryMatchesForSlide(
  slideId: string,
  body: { prompt: string; projectId?: string; limit?: number },
): Promise<{ matches: GalleryAssetMatch[] }> {
  return carouselFetch(`/carousel/slides/${slideId}/gallery-matches`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchPost(
  postId: string,
  patch: {
    caption?: Record<CarouselPlatform, string>;
    hook?: string;
    narrative?: string;
    scheduledAt?: string;
    status?: CarouselPostRow['status'];
  },
): Promise<{ post: CarouselPostRow }> {
  return carouselFetch(`/carousel/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

// ─────────────────────────────────────────────────────────
// Helpers — UI-side
// ─────────────────────────────────────────────────────────

export const FORMAT_DAY_LABELS: Record<CarouselFormat, { day: string; emoji: string; label: string }> = {
  humor: { day: 'Mandag', emoji: '😂', label: 'Humor' },
  educational: { day: 'Tirsdag', emoji: '💡', label: 'Lærerikt' },
  bts: { day: 'Onsdag', emoji: '🎬', label: 'Bak kulissene' },
  customer_story: { day: 'Torsdag', emoji: '⭐', label: 'Kundehistorie' },
  promo: { day: 'Fredag', emoji: '🎯', label: 'Tilbud' },
  seasonal: { day: 'Lørdag', emoji: '☀️', label: 'Sesong' },
  story_insight: { day: 'Søndag', emoji: '✍️', label: 'Innsikt' },
};

export const PLATFORM_LABELS: Record<CarouselPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
};

export const PLATFORM_ASPECTS: Record<CarouselPlatform, { width: number; height: number; label: string }> = {
  instagram: { width: 1080, height: 1080, label: '1:1' },
  facebook: { width: 1200, height: 628, label: '1.91:1' },
  linkedin: { width: 1200, height: 1200, label: '1:1' },
  pinterest: { width: 1000, height: 1500, label: '2:3' },
  youtube: { width: 1280, height: 720, label: '16:9' },
};

export const PLATFORM_CAPTION_LIMIT: Record<CarouselPlatform, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  pinterest: 500,
  youtube: 1500,
};
