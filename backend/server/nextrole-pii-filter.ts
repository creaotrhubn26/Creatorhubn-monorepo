/**
 * nextrole-pii-filter.ts
 *
 * Delt PII-filter for ALL AI som behandler bruker-data i NextRole.
 *
 * Tre lag:
 *
 *   1. sanitizeProfileForAI(profile)
 *      Allowlist-basert profil-sammendrag for AI-prompts. Sender KUN
 *      eksplisitt godkjente felt — aldri den rå personal_info-JSONB.
 *      By-bare for location, antall år for erfaring, etc.
 *
 *   2. scrubPII(text)
 *      Regex-basert scrubber for fri-tekst (beskrivelser, achievements,
 *      summary). Fjerner fødselsnumre, telefon, e-post, kontonumre,
 *      og norske postadresser.
 *
 *   3. extractCityOnly(location)
 *      "Storgata 5B, 0182 Oslo" → "Oslo".
 *      "5008 Bergen" → "Bergen". Trimmer postnumre og gateadresser.
 *
 * Brukes av:
 *   • nextrole-career-mentor.ts (Sigrid)
 *   • resume-routes.ts (summarizeResumeForAI)
 *   • nextrole-video-presentations.ts
 *   • nextrole-routes.ts (cover letter generation)
 *
 * Eksporterer også PII_DISCLOSURE — den eksakte teksten som vises til
 * bruker om hva som sendes/ikke sendes. Hold denne oppdatert sammen
 * med implementasjonen så transparens-løftet stemmer.
 */

// ── Disclosure-tekst (brukes i UI for åpenhet) ────────────────────

// Versjon — bump denne hvis sent/notSent endres slik at brukere må
// gjennomgå listen på nytt. Lagres på user_prefs.pii_acknowledged_version
// så vi vet om de har sett gjeldende versjon.
export const PII_DISCLOSURE_VERSION = "1.0";

export const PII_DISCLOSURE = {
  version: PII_DISCLOSURE_VERSION,
  sent: [
    "Profesjonell tittel",
    "Antall års erfaring",
    "By/region (ikke gateadresse)",
    "Utdanningsnivå og fag",
    "Ferdigheter",
    "Beskrivelser av tidligere roller (scrubbet for personlig info)",
    "Selskaps- og institusjonsnavn fra CV",
  ],
  notSent: [
    "Fullt navn",
    "E-postadresse",
    "Telefonnummer",
    "Fødselsnummer eller andre nasjonale ID-er",
    "Profilbilde",
    "Eksakt gateadresse",
    "Kontonumre",
    "LinkedIn-lenke (med personlig brukernavn)",
  ],
  aiProviders: [
    {
      name: "Anthropic Claude",
      purpose: "Karriere-mentor (Sigrid), CV-analyse, søknadsbrev, intervjutrening",
      retention: "Anthropic Enterprise — ingen lagring av prompts/svar utover 30 dager",
    },
    {
      name: "OpenAI Whisper",
      purpose: "Transkripsjon av lyd-/video-opptak fra intervjutrening og video-pitch",
      retention: "Zero Data Retention-avtale — ingen lagring",
    },
  ],
  yourRights: [
    "Trekke samtykke når som helst (slett kontoen via Personvern → Slett NextRole-data)",
    "Laste ned alle data NextRole har om deg (Personvern → Last ned ZIP)",
    "Slette enkelt-sesjoner (mock interview, video, samtaler med Sigrid) individuelt",
    "Få re-anerkjennelse hvis vi utvider hva som sendes (versjon bumper)",
  ],
};

// ── 1. Fri-tekst-scrubber ──────────────────────────────────────────

const FNR_RE = /\b\d{11}\b/g;
const NORWEGIAN_PHONE_RE = /(?:\+?47\s?)?(?:\b[2-9]\d{7}\b|\b\d{3}\s?\d{2}\s?\d{3}\b|\b\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\b)/g;
const EMAIL_RE = /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi;
const ACCOUNT_RE = /\b\d{4}[\.\s]?\d{2}[\.\s]?\d{5}\b/g;
const POSTAL_ADDR_RE = /\b\d{4}\s+[A-ZÆØÅ][a-zæøåA-ZÆØÅ\- ]{2,40}\b/g;
const STREET_ADDR_RE = /\b[A-ZÆØÅ][a-zæøå]+(?:gata|veien|vegen|gate|plassen|svingen|alleen|stien)\s+\d+\w?\b/gi;

export function scrubPII(text: string | null | undefined | unknown): string {
  if (!text || typeof text !== "string") return "";
  return text
    // Fødselsnummer eller annet 11-sifret ID
    .replace(FNR_RE, "[fjernet-id]")
    // Bankkontonummer (XXXX.XX.XXXXX eller XXXX XX XXXXX)
    .replace(ACCOUNT_RE, "[fjernet-kontonr]")
    // E-post
    .replace(EMAIL_RE, "[fjernet-epost]")
    // Telefon (Norge)
    .replace(NORWEGIAN_PHONE_RE, "[fjernet-tlf]")
    // Gateadresser
    .replace(STREET_ADDR_RE, "[fjernet-adresse]")
    // Postnummer + by-pattern (4 siffer + by)
    .replace(POSTAL_ADDR_RE, (match) => {
      // Behold by-navnet, fjern postnummer
      const m = match.match(/\d{4}\s+(.+)/);
      return m ? m[1] : "[postnummer-fjernet]";
    });
}

// ── 2. By-bare extraction ──────────────────────────────────────────

export function extractCityOnly(location: string | null | undefined): string {
  if (!location) return "";
  // Splitt på komma og ta siste segment
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  let last = parts[parts.length - 1];
  // Fjern postnummer (4 siffer)
  last = last.replace(/\b\d{4}\b/g, "").trim();
  // Fjern gateaddresse-mønster
  last = last.replace(STREET_ADDR_RE, "").trim();
  // Hvis det er igjen, returner. Ellers returner første segment scrubbet.
  if (last) return last;
  return parts[0].replace(/\b\d{4}\b/g, "").trim();
}

// ── 3. Allowlist-basert profil-sammendrag ──────────────────────────

export interface SanitizedProfile {
  professionalTitle: string | null;
  yearsExperience: number;
  city: string;
  targetIndustry: string | null;
  roleHistory: {
    title: string;
    /** Selskapsnavn er BEHOLDT som default (brukeren har valgt å oppgi det
     *  og selskapsnavn ER ofte relevant for karriere-vurdering). Hvis
     *  bruker ønsker anonymisering kan kall-stedet bruke anonymizeCompanies=true. */
    company: string;
    yearsInRole: number;
    isCurrent: boolean;
    summary: string;  // scrubbet, max 300 tegn
    achievements: string[];  // scrubbet, max 5 stk
  }[];
  education: {
    level: string;
    field: string | null;
    institution: string;
  }[];
  skills: string[];
  languages: string[];
}

interface RawExperience {
  job_title?: string;
  jobTitle?: string;
  company?: string;
  start_date?: Date | string | null;
  startDate?: Date | string | null;
  end_date?: Date | string | null;
  endDate?: Date | string | null;
  is_current?: boolean;
  isCurrent?: boolean;
  description?: string | null;
  achievements?: string[] | null;
}

interface RawEducation {
  degree?: string;
  field_of_study?: string | null;
  fieldOfStudy?: string | null;
  institution?: string;
}

interface RawSkill {
  name?: string;
  level?: string;
}

interface RawLanguage {
  name?: string;
  proficiency?: string;
}

interface RawResume {
  title?: string;
  target_job_title?: string;
  targetJobTitle?: string;
  target_industry?: string | null;
  targetIndustry?: string | null;
  personal_info?: Record<string, unknown> | null;
  personalInfo?: Record<string, unknown> | null;
}

function readDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

export interface SanitizeOptions {
  /** Anonymiser selskapsnavn til kategorier. Default: false (oppgi selskap). */
  anonymizeCompanies?: boolean;
  /** Maks antall roller å inkludere. Default: 6. */
  maxRoles?: number;
  /** Maks antall achievements per rolle. Default: 5. */
  maxAchievementsPerRole?: number;
  /** Maks antall ferdigheter. Default: 15. */
  maxSkills?: number;
}

export function sanitizeProfileForAI(input: {
  resume: RawResume;
  experiences: RawExperience[];
  education: RawEducation[];
  skills: (string | RawSkill)[];
  languages?: (string | RawLanguage)[];
}, opts: SanitizeOptions = {}): SanitizedProfile {
  const maxRoles = opts.maxRoles ?? 6;
  const maxAch = opts.maxAchievementsPerRole ?? 5;
  const maxSkills = opts.maxSkills ?? 15;

  const personalInfo = (input.resume.personal_info ?? input.resume.personalInfo ?? {}) as Record<string, unknown>;

  const rawLocation = String(personalInfo.location ?? "");
  const rawTitle = String(
    personalInfo.professionalTitle ??
      input.resume.target_job_title ??
      input.resume.targetJobTitle ??
      input.resume.title ??
      "",
  );

  // Beregn samlet erfaring
  let totalMonths = 0;
  for (const e of input.experiences) {
    const start = readDate(e.start_date ?? e.startDate);
    if (!start) continue;
    const end = (e.is_current ?? e.isCurrent)
      ? new Date()
      : readDate(e.end_date ?? e.endDate) ?? new Date();
    const m = monthsBetween(start, end);
    if (m > 0) totalMonths += m;
  }
  const yearsExperience = Math.round(totalMonths / 12);

  // Sort experiences nyeste først
  const sortedExp = [...input.experiences].sort((a, b) => {
    const ad = readDate(a.start_date ?? a.startDate)?.getTime() ?? 0;
    const bd = readDate(b.start_date ?? b.startDate)?.getTime() ?? 0;
    return bd - ad;
  });

  const roleHistory = sortedExp.slice(0, maxRoles).map((e) => {
    const start = readDate(e.start_date ?? e.startDate);
    const end = (e.is_current ?? e.isCurrent)
      ? new Date()
      : readDate(e.end_date ?? e.endDate) ?? new Date();
    const yearsInRole = start
      ? Math.max(0, Math.round(monthsBetween(start, end) / 12))
      : 0;
    const rawCompany = (e.company ?? "").trim();
    const company = opts.anonymizeCompanies
      ? anonymizeCompany(rawCompany)
      : rawCompany;

    return {
      title: scrubPII((e.job_title ?? e.jobTitle ?? "").trim()),
      company,
      yearsInRole,
      isCurrent: Boolean(e.is_current ?? e.isCurrent),
      summary: scrubPII((e.description ?? "").slice(0, 300)),
      achievements: (e.achievements ?? [])
        .slice(0, maxAch)
        .map((a) => scrubPII(a)),
    };
  });

  const education = (input.education ?? []).slice(0, 5).map((ed) => ({
    level: scrubPII((ed.degree ?? "").trim()),
    field: scrubPII((ed.field_of_study ?? ed.fieldOfStudy ?? "") || "") || null,
    institution: scrubPII((ed.institution ?? "").trim()),
  }));

  const skills = (input.skills ?? [])
    .slice(0, maxSkills)
    .map((s) => (typeof s === "string" ? s : (s?.name ?? "")))
    .filter(Boolean)
    .map(scrubPII);

  const languages = (input.languages ?? [])
    .slice(0, 10)
    .map((l) => (typeof l === "string" ? l : (l?.name ?? "")))
    .filter(Boolean);

  return {
    professionalTitle: rawTitle ? scrubPII(rawTitle) : null,
    yearsExperience,
    city: extractCityOnly(rawLocation),
    targetIndustry: (input.resume.target_industry ?? input.resume.targetIndustry ?? null) || null,
    roleHistory,
    education,
    skills,
    languages,
  };
}

// ── 4. Selskaps-anonymisering (opt-in) ─────────────────────────────

/**
 * Erstatter velkjente norske selskapsnavn med bransjekategorier.
 * Kun brukes hvis anonymizeCompanies=true. For ukjente selskap
 * faller vi tilbake på "tidligere arbeidsgiver".
 */
function anonymizeCompany(company: string): string {
  if (!company) return "";
  const low = company.toLowerCase();
  // Banking
  if (/\b(dnb|nordea|sparebank|sparebanken|sbanken|santander)\b/.test(low)) return "norsk bank";
  // Telekom
  if (/\b(telenor|telia|ice|altibox)\b/.test(low)) return "telekom-operatør";
  // Energi
  if (/\b(equinor|hydro|statkraft|fortum|aker bp|vår energi)\b/.test(low)) return "energi-/oljeselskap";
  // Retail
  if (/\b(norgesgruppen|rema|coop|kiwi|menu|spar|elkjøp|power)\b/.test(low)) return "stor norsk detaljhandel";
  // Media
  if (/\b(schibsted|nrk|vg|aftenposten|tv 2|amedia|polaris)\b/.test(low)) return "norsk medieselskap";
  // Tech
  if (/\b(finn|kahoot|cognite|gelato|otovo|opera)\b/.test(low)) return "norsk tech-selskap";
  // Konsulent
  if (/\b(accenture|sopra|capgemini|bouvet|knowit|webstep|miles|netcompany|bekk|fellesdata)\b/.test(low)) return "konsulent-selskap";
  // Helse/offentlig
  if (/\b(helse|sykehus|kommune|fylke|nav|altinn|skatteetaten|udi)\b/.test(low)) return "offentlig sektor";
  // Industri
  if (/\b(kongsberg|nammo|umoe|wilhelmsen)\b/.test(low)) return "norsk industri";
  // SMB - fallback hvis 'AS' i navnet
  if (/\bAS\b/i.test(company)) return "norsk SMB";
  return "tidligere arbeidsgiver";
}

// ── 5. Hjelpefunksjon: format som tekstblokk for Claude-prompt ─────

export function formatSanitizedForPrompt(p: SanitizedProfile): string {
  if (!p.professionalTitle && p.roleHistory.length === 0) {
    return "[Brukeren har ingen utfylt CV ennå.]";
  }
  const lines: string[] = [];
  if (p.professionalTitle) lines.push(`Profesjonell tittel: ${p.professionalTitle}`);
  lines.push(`Erfaring: ${p.yearsExperience} år`);
  if (p.city) lines.push(`By: ${p.city}`);
  if (p.targetIndustry) lines.push(`Målbransje: ${p.targetIndustry}`);

  if (p.roleHistory.length) {
    lines.push("\nROLLE-HISTORIKK (nyeste først):");
    for (const r of p.roleHistory) {
      const tag = r.isCurrent ? " (nåværende)" : "";
      lines.push(`  - ${r.title} hos ${r.company} · ${r.yearsInRole} år${tag}`);
      if (r.summary) lines.push(`      ${r.summary.slice(0, 200)}`);
      for (const a of r.achievements.slice(0, 3)) {
        lines.push(`      • ${a}`);
      }
    }
  }

  if (p.education.length) {
    lines.push("\nUTDANNING:");
    for (const e of p.education) {
      const fld = e.field ? ` i ${e.field}` : "";
      lines.push(`  - ${e.level}${fld} fra ${e.institution}`);
    }
  }

  if (p.skills.length) {
    lines.push(`\nFERDIGHETER: ${p.skills.join(", ")}`);
  }

  if (p.languages.length) {
    lines.push(`SPRÅK: ${p.languages.join(", ")}`);
  }

  return lines.join("\n");
}
