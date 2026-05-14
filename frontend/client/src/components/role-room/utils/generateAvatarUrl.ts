/**
 * generateAvatarUrl — deterministisk avatar-URL fra et seed (typisk navn).
 *
 * Bruker DiceBear-API (gratis, ingen auth) for å lage konsistente
 * portrett-avatarer. Samme seed gir alltid samme bilde. Brukes for å fylle
 * demo-data (Troll-prosjektet) med bilder for alle roller/kandidater/crew
 * uten å hardkode lokale filer som ikke eksisterer.
 *
 * Style-valg:
 *   - 'personas'  — realistiske illustrerte portretter (default)
 *   - 'notionists' — Notion-stil tegnete personer
 *   - 'lorelei'    — feminin illustrasjons-stil
 *   - 'bottts'     — roboter (for selskaper/VFX-studio)
 *   - 'shapes'     — abstrakt fallback
 */

export type AvatarStyle =
  | 'personas'
  | 'notionists'
  | 'lorelei'
  | 'bottts'
  | 'shapes'
  | 'avataaars';

interface AvatarOptions {
  style?: AvatarStyle;
  size?: number;
  /** PNG (raster) eller SVG (vektor). PNG har bredere kompatibilitet. */
  format?: 'svg' | 'png';
}

export function generateAvatarUrl(seed: string, options: AvatarOptions = {}): string {
  const {
    style = 'personas',
    size = 320,
    format = 'svg',
  } = options;

  const safeSeed = encodeURIComponent(seed.trim() || 'anonymous');
  const params = new URLSearchParams({
    seed: safeSeed,
    size: String(size),
  });

  return `https://api.dicebear.com/9.x/${style}/${format}?${params.toString()}`;
}

/**
 * Velg en passende DiceBear-stil basert på rolle/kjønn-hint.
 */
export function pickAvatarStyleForPerson(input: {
  gender?: string;
  age?: number;
  category?: 'role' | 'candidate' | 'crew' | 'studio';
}): AvatarStyle {
  if (input.category === 'studio') return 'bottts';
  if (input.gender === 'female') return 'lorelei';
  return 'personas';
}
