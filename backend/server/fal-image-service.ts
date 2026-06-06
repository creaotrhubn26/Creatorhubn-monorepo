/**
 * fal-image-service.ts
 *
 * FAL.ai-integrasjon for hero/feature-bilder til landingssider + admin-UI.
 * Bruker FLUX-pro for editorial-stil-bilder.
 *
 * Brukes av:
 *   - Admin Room "Brand Studio" for å generere hero-bilder
 *   - Marketing-posters (allerede bygd) for å re-generere bakgrunner
 *
 * Env: FAL_API_KEY (kreves)
 */

interface FalImageOptions {
  prompt: string;
  /** Bilde-størrelse — default 1280x720 (16:9). */
  width?: number;
  height?: number;
  /** Antall bilder å generere — default 1. */
  num_images?: number;
  /** Style-modifier (legges på slutten av prompt for konsistens). */
  style?: 'editorial' | 'cinematic' | 'studio' | 'lifestyle';
}

export interface FalImageResult {
  imageUrl: string;
  width: number;
  height: number;
  prompt: string;
}

const STYLE_SUFFIX: Record<NonNullable<FalImageOptions['style']>, string> = {
  editorial: ', editorial photography, magazine cover style, sharp focus, professional lighting',
  cinematic: ', cinematic, anamorphic lens, dramatic lighting, film grain',
  studio: ', studio photography, soft box lighting, clean background, high detail',
  lifestyle: ', natural lighting, candid moment, authentic',
};

export function isFalConfigured(): boolean {
  return !!(process.env.FAL_API_KEY?.trim());
}

/**
 * Generer bilde via FAL.ai. Returnerer CDN-URL.
 * Bilde lagres ikke automatisk i Cloudflare R2 — det er caller-ansvar.
 */
export async function generateImage(opts: FalImageOptions): Promise<FalImageResult> {
  const apiKey = process.env.FAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('fal_not_configured: FAL_API_KEY mangler på serveren');
  }

  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const styleSuffix = opts.style ? STYLE_SUFFIX[opts.style] : '';
  const prompt = `${opts.prompt}${styleSuffix}`;

  // FAL.ai FLUX-pro endepunkt
  const response = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: { width, height },
      num_images: opts.num_images ?? 1,
      enable_safety_checker: true,
      safety_tolerance: '2',
      output_format: 'jpeg',
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`fal_error: ${response.status} ${text.slice(0, 400)}`);
  }

  const data = await response.json() as {
    images?: Array<{ url: string; width: number; height: number }>;
  };
  const first = data.images?.[0];
  if (!first) throw new Error('fal_no_image_returned');

  return {
    imageUrl: first.url,
    width: first.width,
    height: first.height,
    prompt,
  };
}

/**
 * Prompt-bibliotek for The Role Room sin marketing.
 * Bruk: `await generateImage(MARKETING_PROMPTS.agency_hero)`
 */
export const MARKETING_PROMPTS = {
  agency_hero: {
    prompt: 'Norwegian casting agency director working at modern Scandinavian-design desk with MacBook and dual monitors showing dashboard interface, soft window light from left, cozy upscale Oslo office with plants and warm wood accents',
    style: 'editorial' as const,
    width: 1600,
    height: 900,
  },
  self_tape_feature: {
    prompt: 'Young Scandinavian actor in front of ring-light setup recording self-tape on iPhone in neutral home studio, soft natural lighting, focused expression mid-performance',
    style: 'cinematic' as const,
    width: 1280,
    height: 720,
  },
  talent_registry_feature: {
    prompt: 'Editorial portrait grid of diverse Nordic talents with neutral grey background, headshot style, photographer studio lighting',
    style: 'studio' as const,
    width: 1280,
    height: 960,
  },
  partnership_feature: {
    prompt: 'Two professionals in their thirties shaking hands across a desk in modern Scandinavian creative agency, soft afternoon light, looking confident and warm',
    style: 'lifestyle' as const,
    width: 1280,
    height: 720,
  },
} as const;
