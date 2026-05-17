/**
 * Creator-discovery for marketing-plan posts — item #165 ekte fiks.
 *
 * To kilder:
 *   1. Kuratert norwegian-creators.json (28 kjente skapere per kategori).
 *      Honest baseline når vi ikke har koblet konto.
 *   2. Instagram Business Discovery API (når IG-konto er koblet) for å
 *      hente live-stats om competitor/inspirasjon-handles. Krever
 *      ig_user_id og long-lived token.
 *
 * Returnerer kombinert liste — kuratert først (alltid tilgjengelig),
 * IG-data appendet hvis tilgjengelig. Brukeren får aldri null-state.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CuratedCreator {
  handle: string;
  displayName: string;
  platforms: Array<"instagram" | "tiktok" | "youtube" | "facebook" | "website">;
  categories: string[];
  followerTier: "nano" | "micro" | "mid" | "macro" | "mega";
  audienceGender: "mostly_male" | "mostly_female" | "mixed";
  primaryLanguage: string;
  notes?: string;
}

interface CreatorDb {
  _meta: { version: number; description: string; lastUpdated: string; source: string };
  creators: CuratedCreator[];
}

let cachedDb: CreatorDb | null = null;
function loadDb(): CreatorDb {
  if (cachedDb) return cachedDb;
  try {
    const filePath = path.join(__dirname, "data", "norwegian-creators.json");
    const raw = fs.readFileSync(filePath, "utf8");
    cachedDb = JSON.parse(raw) as CreatorDb;
  } catch (error) {
    console.error("[role-room-creator-discovery] failed to load creators DB", error);
    cachedDb = {
      _meta: { version: 0, description: "fallback", lastUpdated: "", source: "" },
      creators: [],
    };
  }
  return cachedDb;
}

/** Maps en bransje-streng + post-platform til relevante creators.
 *  Scoring:
 *    +3 hvis platform matcher post.primaryPlatform
 *    +2 per category som matcher industry-keywords
 *    +1 hvis primaryLanguage === 'norwegian' (lokalrelevans)
 *  Returnerer topp-N rangert etter score (default 8). */
export function findCreatorsForPost(input: {
  industry: string | null;
  primaryPlatform: string | null;
  hook: string;
  limit?: number;
}): Array<CuratedCreator & { score: number; matchedCategories: string[] }> {
  const db = loadDb();
  const limit = input.limit ?? 8;
  const platform = input.primaryPlatform ?? "instagram";

  // Bygg category-keywords fra industry + hook
  const industryNorm = (input.industry ?? "").toLowerCase();
  const hookNorm = input.hook.toLowerCase();
  const keywords: string[] = [];
  const KEYWORD_MAP: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /restaurant|servering|mat|kafé|pizza|burger|sushi/, category: "mat" },
    { pattern: /frisør|skjønnhet|salong|makeup|hud|beauty/, category: "beauty" },
    { pattern: /gym|fitness|trening|crossfit|løp|yoga/, category: "trening" },
    { pattern: /mote|klær|sko|stil|outfit/, category: "mote" },
    { pattern: /interior|hjem|design|møbel|hytta/, category: "interior" },
    { pattern: /barn|familie|baby|barnehage|foreldreskap/, category: "familie" },
    { pattern: /reise|tur|fjell|natur|friluft|hytte/, category: "friluft" },
    { pattern: /tech|teknologi|gadget|software|app/, category: "tech" },
    { pattern: /bil|automotive|elbil|tesla|verksted/, category: "bil" },
    { pattern: /musikk|konsert|festival|band/, category: "musikk" },
    { pattern: /helse|trening|kosthold|mental/, category: "mental_helse" },
  ];
  for (const km of KEYWORD_MAP) {
    if (km.pattern.test(industryNorm) || km.pattern.test(hookNorm)) {
      keywords.push(km.category);
    }
  }
  // Fallback til "lifestyle" hvis ingen match
  if (keywords.length === 0) keywords.push("lifestyle");

  const scored = db.creators.map((c) => {
    let score = 0;
    const matchedCategories: string[] = [];
    if (c.platforms.includes(platform as "instagram")) score += 3;
    for (const kw of keywords) {
      if (c.categories.includes(kw)) {
        score += 2;
        matchedCategories.push(kw);
      }
    }
    if (c.primaryLanguage === "norwegian") score += 1;
    return { ...c, score, matchedCategories };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Optional: Instagram Business Discovery API — henter live-stats for
 *  en annen IG-konto når vi har koblet IG-konto for dette prosjektet.
 *  Krever ig_user_id og long-lived access token fra
 *  role_room_instagram_connections-tabellen. Returnerer null hvis konto
 *  ikke koblet eller API kaster.
 *
 *  Endpoint: GET /{ig-user-id}?fields=business_discovery.username({target}){...}
 *
 *  NB: target-kontoen MÅ være Business eller Creator-account, ellers
 *  returnerer Meta tom respons (uten error).
 */
export interface InstagramDiscoveryResult {
  username: string;
  followersCount: number;
  mediaCount: number;
  biography: string | null;
  profilePictureUrl: string | null;
}

export async function fetchInstagramDiscovery(
  igUserId: string,
  accessToken: string,
  targetUsername: string,
): Promise<InstagramDiscoveryResult | null> {
  if (!igUserId || !accessToken || !targetUsername) return null;
  // Strip @ hvis det er der
  const target = targetUsername.replace(/^@/, "");
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId)}` +
    `?fields=business_discovery.username(${encodeURIComponent(target)})%7Busername,followers_count,media_count,biography,profile_picture_url%7D` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const payload = await response.json() as { business_discovery?: Record<string, unknown> };
    const bd = payload.business_discovery;
    if (!bd) return null;
    return {
      username: String(bd.username ?? target),
      followersCount: Number(bd.followers_count ?? 0),
      mediaCount: Number(bd.media_count ?? 0),
      biography: typeof bd.biography === "string" ? bd.biography : null,
      profilePictureUrl: typeof bd.profile_picture_url === "string" ? bd.profile_picture_url : null,
    };
  } catch (error) {
    console.error("[role-room-creator-discovery] IG discovery failed", {
      target,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
