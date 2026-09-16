/**
 * role-room-talent-cv-import.ts
 *
 * «Legg inn CV-en, så tar The Role Room seg av resten.»
 *
 * Tar imot en PDF eller Word-fil, henter ut teksten, og lar Claude strukturere
 * den som en skuespiller-CV: krediteringer med rolle, produksjon, regissør og
 * år, pluss profilfelt som bio, by, dramaskole, ferdigheter og språk.
 *
 * 🔑 Denne modulen SKRIVER IKKE til databasen. Den returnerer et forslag som
 * skuespilleren må godkjenne først. To grunner:
 *   1. En språkmodell leser «Regissør: Kari Nordmann» i en plakat like gjerne
 *      som skuespillerens egen rolle. Feil i en casting-profil koster jobber.
 *   2. En CV inneholder ofte fødselsnummer, adresse og referansepersoner som
 *      ikke skal lagres. Skuespilleren må se hva som ble hentet ut.
 *
 * Tekst-uttrekket bruker samme biblioteker som kontrakt-importen
 * (contracts-upload-import-routes.ts): pdf-parse og mammoth.
 */

import { createRequire } from "node:module";
import mammoth from "mammoth";

const _require = createRequire(import.meta.url);
/* eslint-disable @typescript-eslint/no-explicit-any */
const pdfParseModule: any = _require("pdf-parse");

export const CV_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const CV_IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Maks tekst vi sender videre. En CV på 40 sider er en portefølje, ikke en CV. */
const MAX_TEXT_CHARS = 40_000;

export interface CvImportCredit {
  category: "film_tv" | "theatre" | "commercial" | "voice" | "other";
  title: string;
  role_name: string | null;
  role_type: string | null;
  production_company: string | null;
  director: string | null;
  year: number | null;
}

export interface CvImportSuggestion {
  credits: CvImportCredit[];
  profile: {
    display_name: string | null;
    city: string | null;
    bio: string | null;
    drama_school: string | null;
    skills: string[];
    languages: string[];
    dialects: string[];
  };
  /** Felter modellen så, men som vi bevisst ikke foreslår (persondata). */
  skipped: string[];
}

export type CvImportResult =
  | { ok: true; suggestion: CvImportSuggestion; characters: number }
  | { ok: false; reason: "unsupported_type" | "empty_text" | "ai_unavailable" | "ai_failed" };

/** PDF eller DOCX → ren tekst. */
export async function extractCvText(
  buffer: Buffer,
  mimetype: string,
): Promise<string | null> {
  if (mimetype === "application/pdf") {
    const parsed = await pdfParseModule.default(buffer);
    return typeof parsed?.text === "string" ? parsed.text : null;
  }
  if (mimetype === CV_IMPORT_MIME_TYPES[1]) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? null;
  }
  return null;
}

const SYSTEM_PROMPT = `Du strukturerer skuespiller-CV-er for et norsk casting-register.

Du får rå tekst fra en CV. Returner KUN gyldig JSON, uten forklaring og uten
kodeblokk-markering, på dette formatet:

{
  "credits": [
    {
      "category": "film_tv" | "theatre" | "commercial" | "voice" | "other",
      "title": "produksjonens navn",
      "role_name": "rollen skuespilleren spilte, eller null",
      "role_type": "lead" | "supporting" | "featured" | "ensemble" | "voice" | "extra" | null,
      "production_company": "teater eller produksjonsselskap, eller null",
      "director": "regissør, eller null",
      "year": 2024
    }
  ],
  "profile": {
    "display_name": "navn eller null",
    "city": "by eller null",
    "bio": "kort presentasjon på maks 600 tegn, eller null",
    "drama_school": "skuespillerutdanning eller null",
    "skills": ["ferdigheter, f.eks. scenekamp, sang"],
    "languages": ["språk personen behersker"],
    "dialects": ["dialekter"]
  }
}

Viktige regler:
- Dette er en SKUESPILLER-CV, ikke en jobbsøknad. En kreditering er en rolle i
  en produksjon — ikke en stilling hos en arbeidsgiver.
- Er du i tvil om hvem som var regissør og hvem som var skuespiller, sett
  "director" til null. Feil regissør er verre enn ingen regissør.
- Gjett ALDRI på årstall, rolletype eller kategori. Bruk null når teksten ikke
  sier det tydelig.
- Ta ALDRI med fødselsdato, personnummer, adresse, telefonnummer, e-post eller
  navn på referansepersoner. De hører ikke hjemme i et casting-register.
- Skriv verdiene på det språket de står i CV-en.`;

/**
 * Kaller Claude og tolker svaret. Returnerer null hvis modellen ikke er
 * konfigurert eller svaret ikke lot seg tolke — kallstedet bestemmer hva som
 * skjer da, i stedet for at vi gjetter oss til et tomt forslag.
 */
export async function parseCvWithClaude(
  text: string,
): Promise<CvImportSuggestion | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text.slice(0, MAX_TEXT_CHARS) }],
  });

  type ContentBlock = { type: string; text?: string };
  const raw = (response.content as ContentBlock[])
    .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const parsed = tryParseJson<Record<string, unknown>>(raw);
  if (!parsed) return null;
  return normalizeSuggestion(parsed);
}

/** Claude pakker av og til JSON i ```json-fences. Samme mønster som resume-routes. */
function tryParseJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

const CATEGORIES = new Set(["film_tv", "theatre", "commercial", "voice", "other"]);
const ROLE_TYPES = new Set(["lead", "supporting", "featured", "ensemble", "voice", "extra"]);

function str(value: unknown, max = 255): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function strList(value: unknown, max = 25): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v, 80))
    .filter((v): v is string => Boolean(v))
    .slice(0, max);
}

/**
 * Modellens svar er et forslag, ikke et faktum. Alt normaliseres mot de samme
 * reglene som skrive-endepunktene bruker, slik at et forslag aldri kan bære
 * en verdi brukeren ikke kunne lagret selv.
 */
export function normalizeSuggestion(parsed: Record<string, unknown>): CvImportSuggestion {
  const skipped: string[] = [];
  const rawCredits = Array.isArray(parsed.credits) ? parsed.credits : [];
  const currentYear = new Date().getFullYear();

  const credits: CvImportCredit[] = [];
  for (const entry of rawCredits.slice(0, 200)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const title = str(row.title);
    if (!title) continue;

    const category = str(row.category, 30);
    const roleType = str(row.role_type, 40)?.toLowerCase() ?? null;
    const yearRaw = Number(row.year);
    const year =
      Number.isFinite(yearRaw) && yearRaw >= 1888 && yearRaw <= currentYear + 5
        ? Math.round(yearRaw)
        : null;

    credits.push({
      category: category && CATEGORIES.has(category) ? (category as CvImportCredit["category"]) : "other",
      title,
      role_name: str(row.role_name),
      role_type: roleType && ROLE_TYPES.has(roleType) ? roleType : null,
      production_company: str(row.production_company),
      director: str(row.director),
      year,
    });
  }

  const profileRaw = (parsed.profile ?? {}) as Record<string, unknown>;
  // Persondata modellen kan ha plukket opp, men som ikke skal foreslås.
  for (const forbidden of ["email", "phone", "birth_date", "address", "personal_number", "references"]) {
    if (profileRaw[forbidden]) skipped.push(forbidden);
  }

  return {
    credits,
    profile: {
      display_name: str(profileRaw.display_name),
      city: str(profileRaw.city, 120),
      bio: str(profileRaw.bio, 600),
      drama_school: str(profileRaw.drama_school),
      skills: strList(profileRaw.skills),
      languages: strList(profileRaw.languages),
      dialects: strList(profileRaw.dialects),
    },
    skipped,
  };
}

/** Hele kjeden: fil → tekst → forslag. */
export async function importCvFromFile(
  buffer: Buffer,
  mimetype: string,
): Promise<CvImportResult> {
  if (!CV_IMPORT_MIME_TYPES.includes(mimetype)) {
    return { ok: false, reason: "unsupported_type" };
  }

  const text = await extractCvText(buffer, mimetype);
  if (!text || text.trim().length < 40) {
    // En skannet PDF uten tekstlag gir tom streng. Da er OCR svaret, ikke en
    // uforståelig feilmelding.
    return { ok: false, reason: "empty_text" };
  }

  let suggestion: CvImportSuggestion | null;
  try {
    suggestion = await parseCvWithClaude(text);
  } catch (error) {
    console.error("[talents/cv-import] Claude-kall feilet", error);
    return { ok: false, reason: "ai_failed" };
  }
  if (!suggestion) return { ok: false, reason: "ai_unavailable" };

  return { ok: true, suggestion, characters: text.length };
}
