/**
 * role-room-talent-cv-import.ts
 *
 * «Legg inn CV-en, så tar The Role Room seg av resten.»
 *
 * Tar imot en PDF eller Word-fil, henter ut teksten, og kjenner igjen
 * krediteringer: rolle, produksjon, produksjonsselskap, regissør og år.
 *
 * 🔑 INGEN AI. Uttrekket er rene regler — seksjonsoverskrifter, årstall,
 * skilletegn og nøkkelord. Tre grunner til at det er riktig her:
 *   1. CV-en er personopplysninger. Deterministisk parsing holder teksten
 *      inne i vår egen backend; ingenting forlater huset.
 *   2. Resultatet er forutsigbart. Samme fil gir samme forslag hver gang, og
 *      en feil kan rettes i en regel i stedet for i en prompt.
 *   3. Ingen kostnad per import, ingen API-nøkkel å drifte, ingen ventetid.
 *
 * Til gjengjeld treffer regler dårligere enn en modell på rotete oppsett.
 * Derfor er gjennomgangssteget i UI-et ikke valgfritt: vi foreslår, og
 * skuespilleren bekrefter.
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

const MAX_LINES = 1500;
const MAX_CREDITS = 200;

export type CvCreditCategory = "film_tv" | "theatre" | "commercial" | "voice" | "other";

export interface CvImportCredit {
  category: CvCreditCategory;
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
    drama_school: string | null;
  };
  /** Linjer vi bevisst hoppet over, med grunn — vises i gjennomgangen. */
  skipped: string[];
}

export type CvImportResult =
  | { ok: true; suggestion: CvImportSuggestion; characters: number }
  | { ok: false; reason: "unsupported_type" | "empty_text" };

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

// ── Gjenkjenning ──────────────────────────────────────────────────────

/** Seksjonsoverskrifter, norsk og engelsk. Styrer kategorien på linjene under. */
const SECTION_PATTERNS: Array<{ category: CvCreditCategory; pattern: RegExp }> = [
  { category: "film_tv", pattern: /^(film|tv|film\s*&?\s*tv|film og tv|television|serier?|spillefilm|kortfilm)\b/i },
  { category: "theatre", pattern: /^(teater|theatre|theater|scene|scenekunst|stage)\b/i },
  { category: "commercial", pattern: /^(reklame|reklamefilm|commercials?|kampanjer?)\b/i },
  { category: "voice", pattern: /^(stemme|voice|voice[- ]?over|dubbing|lydbok|audiobook)\b/i },
];

/** Linjer som aldri er krediteringer. Persondata skal ikke inn i registeret. */
const PERSONAL_DATA_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "e-post", pattern: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  { label: "telefon", pattern: /(\+\d{1,3}[\s-]?)?(\d[\s-]?){8,}/ },
  { label: "fødselsdato", pattern: /\b(f\.|født|born|fødselsdato|date of birth)\b/i },
  { label: "personnummer", pattern: /\b\d{6}\s?\d{5}\b/ },
  { label: "adresse", pattern: /\b(gate|gata|veien|vei\b|adresse|address)\b/i },
];

/** Utdanning — plukkes ut som dramaskole, ikke som kreditering. */
const SCHOOL_PATTERN =
  /\b(teaterh(ø|o)gskole[nt]?|skuespillerutdanning|drama\s*school|akademiet for scenekunst|nordisk institutt|khio|lamda|rada|guildhall|nski|b(å|a)rdar|nord universitet)\b/i;

const DIRECTOR_PATTERN =
  /\b(?:regiss(?:ø|o)r|instrukt(?:ø|o)r|director|regi|dir\.)\s*[:\-–]?\s*([^|·,;]+)/i;

const ROLE_HINT_PATTERN = /\b(?:rolle|role|som|as)\s*[:\-–]\s*([^|·,;]+)/i;

const ROLE_TYPE_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  { id: "lead", pattern: /\b(hovedrolle|lead|leading role|title role|tittelrolle)\b/i },
  { id: "supporting", pattern: /\b(birolle|supporting)\b/i },
  { id: "featured", pattern: /\b(medvirkende|featured)\b/i },
  { id: "ensemble", pattern: /\b(ensemble)\b/i },
  { id: "voice", pattern: /\b(stemme|voice)\b/i },
  { id: "extra", pattern: /\b(statist|extra)\b/i },
];

/** Ord som gjør at en del av linjen sannsynligvis er produsent/teater. */
const COMPANY_HINT =
  /\b(teater|theatre|theater|nrk|tv\s?2|netflix|hbo|bbc|viaplay|film|produksjon|productions?|pictures|studios?|as\b|a\/s|ltd|inc|scene|operaen?)\b/i;

const SEPARATOR = /\s*[|·•\t]\s*|\s+[–—]\s+|\s{3,}/;

/**
 * Fødselsnummer skal ALDRI lagres, uansett hvor i CV-en det står.
 *
 * Linjer som ser ut som persondata hoppes allerede over, men et fødselsnummer
 * kan stå midt i en ellers gyldig krediteringslinje («Hamlet | 01019012345»).
 * Derfor fjernes det også fra hver enkelt verdi før den forlater parseren —
 * to uavhengige hindre, fordi ett hull her er et personvernbrudd og ikke en
 * skjønnhetsfeil.
 *
 * Mønsteret dekker 11 siffer sammenhengende eller delt 6+5, med valgfri
 * bindestrek eller mellomrom.
 */
const PERSONAL_NUMBER = /\b\d{6}[\s-]?\d{5}\b/g;

export function stripPersonalNumbers(value: string): string {
  return value.replace(PERSONAL_NUMBER, "").replace(/\s{2,}/g, " ").trim();
}

function cleanPart(value: string): string {
  return stripPersonalNumbers(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–—:,.]+|[-–—:,.]+$/g, "")
    .trim();
}

function findYear(line: string): { year: number | null; withoutYear: string } {
  const currentYear = new Date().getFullYear();
  // Tar første fireside­tall i et rimelig intervall. «2019–2021» gir 2019.
  const match = line.match(/\b(18[8-9]\d|19\d{2}|20\d{2})\b/);
  if (!match) return { year: null, withoutYear: line };
  const year = Number(match[1]);
  if (year < 1888 || year > currentYear + 5) return { year: null, withoutYear: line };
  return {
    year,
    withoutYear: line.replace(/\b(18[8-9]\d|19\d{2}|20\d{2})\s*[–—-]?\s*(\d{2,4})?\b/, " "),
  };
}

function detectRoleType(line: string): string | null {
  for (const { id, pattern } of ROLE_TYPE_PATTERNS) {
    if (pattern.test(line)) return id;
  }
  return null;
}

/**
 * Én linje → én kreditering, eller null hvis linjen ikke ser ut som en.
 *
 * Kravet for å regnes som kreditering er bevisst strengt: enten et årstall,
 * eller minst tre deler adskilt av skilletegn. Løsere regler gjør at
 * overskrifter, adresser og løpende tekst havner i CV-en som falske roller,
 * og det er verre å rydde opp i enn å legge inn en linje manuelt.
 */
export function parseCreditLine(
  rawLine: string,
  category: CvCreditCategory,
): CvImportCredit | null {
  const line = cleanPart(rawLine);
  if (line.length < 4 || line.length > 300) return null;

  const { year, withoutYear } = findYear(line);
  const parts = withoutYear.split(SEPARATOR).map(cleanPart).filter(Boolean);
  if (!year && parts.length < 3) return null;
  if (parts.length === 0) return null;

  let director: string | null = null;
  const directorMatch = line.match(DIRECTOR_PATTERN);
  if (directorMatch?.[1]) director = cleanPart(directorMatch[1]).slice(0, 255) || null;

  let roleName: string | null = null;
  const roleMatch = line.match(ROLE_HINT_PATTERN);
  if (roleMatch) roleName = cleanPart(roleMatch[1]).slice(0, 255) || null;

  // Deler som allerede er brukt til regi eller rolle skal ikke også bli tittel.
  const remaining = parts.filter((part) => {
    if (DIRECTOR_PATTERN.test(part)) return false;
    if (roleName && part.toLowerCase().includes(roleName.toLowerCase())) return false;
    return true;
  });

  const title = cleanPart(remaining[0] ?? parts[0] ?? "").slice(0, 255);
  if (!title) return null;

  let company: string | null = null;
  for (const part of remaining.slice(1)) {
    if (COMPANY_HINT.test(part)) {
      company = part.slice(0, 255);
      break;
    }
  }
  if (!company && remaining.length > 1) company = remaining[1].slice(0, 255);

  // Ingen eksplisitt «rolle:»? Da er en tredje del oftest rollenavnet.
  if (!roleName && remaining.length > 2) {
    const candidate = remaining.find((part, index) => index > 1 && part !== company);
    if (candidate) roleName = candidate.slice(0, 255);
  }

  return {
    category,
    title,
    role_name: roleName,
    role_type: detectRoleType(line),
    production_company: company,
    director,
    year,
  };
}

/** Hele teksten → forslag. Rene regler, ingen nettverkskall. */
export function parseCvText(text: string): CvImportSuggestion {
  const lines = text.split(/\r?\n/).slice(0, MAX_LINES);
  const credits: CvImportCredit[] = [];
  const skipped = new Set<string>();
  let category: CvCreditCategory = "other";
  let dramaSchool: string | null = null;

  for (const rawLine of lines) {
    const line = cleanPart(rawLine);
    if (!line) continue;

    const heading = SECTION_PATTERNS.find((s) => s.pattern.test(line) && line.length < 40);
    if (heading) {
      category = heading.category;
      continue;
    }

    if (!dramaSchool && SCHOOL_PATTERN.test(line)) {
      dramaSchool = line.slice(0, 255);
      continue;
    }

    const personal = PERSONAL_DATA_PATTERNS.find((p) => p.pattern.test(line));
    if (personal) {
      // Meldes i gjennomgangen, men lagres aldri.
      skipped.add(personal.label);
      continue;
    }

    if (credits.length >= MAX_CREDITS) break;
    const credit = parseCreditLine(line, category);
    if (credit) credits.push(credit);
  }

  return {
    credits,
    profile: { drama_school: dramaSchool },
    skipped: Array.from(skipped),
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

  return { ok: true, suggestion: parseCvText(text), characters: text.length };
}
