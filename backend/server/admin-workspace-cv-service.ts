import crypto from "node:crypto";

export const CV_CATEGORIES = [
  "identity",
  "experience",
  "education",
  "certification",
  "project",
  "skill",
  "language",
  "award",
  "other",
] as const;

export type CvCategory = (typeof CV_CATEGORIES)[number];

export const CV_VERIFICATION_STATUSES = [
  "source_supported",
  "user_confirmed",
  "needs_confirmation",
  "rejected",
] as const;

export type CvVerificationStatus = (typeof CV_VERIFICATION_STATUSES)[number];

export interface CvClaimDraft {
  category: CvCategory;
  label: string;
  organization: string | null;
  roleTitle: string | null;
  startValue: string | null;
  endValue: string | null;
  description: string | null;
  evidenceText: string;
  sourceUrl: string | null;
  confidence: number;
  verificationStatus: CvVerificationStatus;
  sortOrder: number;
  fingerprint: string;
}

export interface CvQuestionDraft {
  fieldKey: string;
  question: string;
  required: boolean;
  sortOrder: number;
}

export interface CvProfileForRender {
  person_name: string;
  headline: string | null;
  professional_summary: string | null;
  source_url: string | null;
  source_checked_at: string | Date | null;
}

export interface CvClaimForRender {
  category: CvCategory;
  label: string;
  organization?: string | null;
  role_title?: string | null;
  start_value?: string | null;
  end_value?: string | null;
  description?: string | null;
  evidence_text?: string | null;
  verification_status: CvVerificationStatus;
}

export interface CvQuestionForRender {
  question: string;
  answer: string | null;
  status: "open" | "answered";
}

const CATEGORY_HEADINGS: Array<[RegExp, CvCategory]> = [
  [/^(profil|profile|om meg|about|sammendrag|summary)$/iu, "identity"],
  [/^(erfaring|arbeidserfaring|experience|employment|work experience)$/iu, "experience"],
  [/^(utdanning|education|studier)$/iu, "education"],
  [/^(sertifiseringer?|certifications?|lisenser?|licenses?)$/iu, "certification"],
  [/^(prosjekter?|projects?)$/iu, "project"],
  [/^(kompetanse|ferdigheter|skills?|teknologier|technologies)$/iu, "skill"],
  [/^(språk|languages?)$/iu, "language"],
  [/^(utmerkelser?|priser|awards?|honors?)$/iu, "award"],
];

const SOURCE_BOILERPLATE = [
  /^kildetype\s*:/iu,
  /^profil\s*:\s*https?:\/\//iu,
  /^kontrollert\s*:/iu,
  /^viktig\s*:/iu,
  /^linkedin[- ]?kilde/iu,
  /^denne (filen|teksten)/iu,
];

const UNCERTAIN_LANGUAGE = /(?:må bekreftes|ikke (?:synlig|dokumentert|dokumenterer|oppgitt)|ufullstendig|ukjent|må avklares|ikke verifisert|antas|antatt|^eksakt (?:tittel|dato|periode|rolle))/iu;

function cleanInline(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanBlock(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, " ")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*[-*•·]\s+/u, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim()
    .slice(0, maxLength);
}

function categoryFromHeading(line: string): CvCategory | null {
  const normalized = line
    .replace(/^#{1,6}\s*/u, "")
    .replace(/\s*[:：]\s*$/u, "")
    .trim();
  for (const [pattern, category] of CATEGORY_HEADINGS) {
    if (pattern.test(normalized)) return category;
  }
  return null;
}

function looksLikeStandaloneHeading(line: string): boolean {
  const normalized = line.replace(/^#{1,6}\s*/u, "").trim();
  if (line.trim().startsWith("#")) return normalized.length <= 80;
  return normalized.length > 1
    && normalized.length <= 55
    && normalized === normalized.toLocaleUpperCase("nb-NO")
    && /\p{L}/u.test(normalized);
}

function claimFingerprint(category: CvCategory, evidence: string): string {
  return crypto
    .createHash("sha256")
    .update(`${category}\n${evidence.toLocaleLowerCase("nb-NO")}`)
    .digest("hex");
}

function categoryFromContent(evidence: string, fallback: CvCategory): CvCategory {
  if (fallback !== "other") return fallback;
  if (/(?:fagskole|høyskole|universitet|utdanning|bachelor|master|degree|noroff)/iu.test(evidence)) {
    return "education";
  }
  if (/(?:sertifisering|sertifikat|certification|academy|hubspot)/iu.test(evidence)) {
    return "certification";
  }
  if (/(?:arbeidsgiver|technician|tekniker|daglig leder|ansatt|employment|bane nor)/iu.test(evidence)) {
    return "experience";
  }
  if (/(?:produksjon|kundeprosjekt|oppdrag|portfolio|portefølje)/iu.test(evidence)) {
    return "project";
  }
  if (/(?:kompetanse|ferdigheter|skills?|teknologier)/iu.test(evidence)) {
    return "skill";
  }
  return fallback;
}

function splitLabelAndDescription(lines: string[]): { label: string; description: string | null } {
  const firstLine = cleanInline(lines[0], 8_000);
  let labelSource = firstLine;
  let firstLineRemainder = "";
  const sentenceEnd = firstLine.slice(0, 220).match(/^(.{24,180}?[.!?])(?:\s|$)/u);
  if (sentenceEnd && firstLine.slice(sentenceEnd[0].length).trim().length >= 20) {
    labelSource = sentenceEnd[1];
    firstLineRemainder = firstLine.slice(sentenceEnd[0].length).trim();
  } else if (firstLine.length > 180) {
      const boundary = firstLine.slice(0, 180).lastIndexOf(" ");
      const splitAt = boundary >= 80 ? boundary : 180;
      labelSource = `${firstLine.slice(0, splitAt).trim()}…`;
      firstLineRemainder = firstLine.slice(splitAt).trim();
  }
  const descriptionParts = [firstLineRemainder, ...lines.slice(1)].filter(Boolean);
  return {
    label: cleanInline(labelSource, 300),
    description: descriptionParts.length ? cleanBlock(descriptionParts.join("\n"), 4_000) : null,
  };
}

function claimFromBlock(
  block: string[],
  category: CvCategory,
  sourceUrl: string | null,
  sortOrder: number,
): CvClaimDraft | null {
  const evidenceText = cleanBlock(block.join("\n"), 8_000);
  if (!evidenceText || evidenceText.length < 2) return null;
  if (SOURCE_BOILERPLATE.some((pattern) => pattern.test(evidenceText))) return null;
  if (/^https?:\/\/\S+$/iu.test(evidenceText)) return null;

  const lines = evidenceText.split("\n");
  const { label, description } = splitLabelAndDescription(lines);
  if (!label) return null;
  const needsConfirmation = UNCERTAIN_LANGUAGE.test(evidenceText);
  const resolvedCategory = categoryFromContent(evidenceText, category);

  return {
    category: resolvedCategory,
    label,
    organization: null,
    roleTitle: null,
    startValue: null,
    endValue: null,
    description: description || null,
    evidenceText,
    sourceUrl,
    confidence: needsConfirmation ? 0.45 : 0.78,
    verificationStatus: needsConfirmation ? "needs_confirmation" : "source_supported",
    sortOrder,
    fingerprint: claimFingerprint(resolvedCategory, evidenceText),
  };
}

/**
 * Deterministic, local extraction. It deliberately does not fetch a LinkedIn
 * URL. The uploaded project file is the evidence; the URL is provenance only.
 */
export function extractCvClaims(text: string, sourceUrl: string | null): CvClaimDraft[] {
  const lines = text.replace(/\r\n?/gu, "\n").split("\n").slice(0, 20_000);
  const claims: CvClaimDraft[] = [];
  const fingerprints = new Set<string>();
  let category: CvCategory = "identity";
  let block: string[] = [];

  const flush = (): void => {
    if (!block.length || claims.length >= 150) {
      block = [];
      return;
    }
    const claim = claimFromBlock(block, category, sourceUrl, (claims.length + 1) * 10);
    block = [];
    if (!claim || fingerprints.has(claim.fingerprint)) return;
    fingerprints.add(claim.fingerprint);
    claims.push(claim);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const headingCategory = categoryFromHeading(line);
    if (headingCategory) {
      flush();
      category = headingCategory;
      continue;
    }
    if (looksLikeStandaloneHeading(line)) {
      flush();
      category = "other";
      continue;
    }
    block.push(line);
    if (block.join("\n").length >= 4_000) flush();
  }
  flush();

  return claims;
}

export const CV_GAP_QUESTIONS: CvQuestionDraft[] = [
  {
    fieldKey: "current_role",
    question: "Hva er din nåværende rolle, hovedansvar og arbeidsomfang i prosent?",
    required: true,
    sortOrder: 10,
  },
  {
    fieldKey: "employment_history",
    question: "Hvilke tidligere arbeidsgivere, roller og tidsperioder mangler eller må presiseres?",
    required: true,
    sortOrder: 20,
  },
  {
    fieldKey: "sales_results",
    question: "Hvilke konkrete salgsresultater kan dokumenteres med tall, periode og ansvar?",
    required: false,
    sortOrder: 30,
  },
  {
    fieldKey: "marketing_results",
    question: "Hvilke markedsførings- eller innholdsresultater kan dokumenteres?",
    required: false,
    sortOrder: 40,
  },
  {
    fieldKey: "leadgrid_technical_scope",
    question: "Hvilke deler av Leadgrid har du selv utviklet og designet, og med hvilke teknologier?",
    required: true,
    sortOrder: 50,
  },
  {
    fieldKey: "freelance_scope",
    question: "Finnes det relevante oppdrag, kundeprosjekter eller selvstendig arbeid som bør inn i CV-en?",
    required: false,
    sortOrder: 60,
  },
  {
    fieldKey: "availability",
    question: "Når er du tilgjengelig for prosjektet, og er det andre forpliktelser som påvirker kapasiteten?",
    required: true,
    sortOrder: 70,
  },
  {
    fieldKey: "evidence_documents",
    question: "Hvilke attester, vitnemål, porteføljelenker eller andre dokumenter kan underbygge erfaringen?",
    required: false,
    sortOrder: 80,
  },
];

const CATEGORY_LABELS: Record<CvCategory, string> = {
  identity: "Profil",
  experience: "Erfaring",
  education: "Utdanning",
  certification: "Sertifiseringer og lisenser",
  project: "Prosjekter",
  skill: "Kompetanse",
  language: "Språk",
  award: "Utmerkelser",
  other: "Annen relevant informasjon",
};

const VERIFICATION_MARKERS: Record<CvVerificationStatus, string> = {
  source_supported: "Kildestøttet",
  user_confirmed: "Bekreftet",
  needs_confirmation: "Må avklares",
  rejected: "Avvist",
};

function markdownText(value: string | null | undefined): string {
  return cleanBlock(value || "", 20_000).replace(/^#{1,6}\s*/gmu, "");
}

function renderClaim(claim: CvClaimForRender): string {
  const title = markdownText(claim.label);
  const roleAndOrganization = [claim.role_title, claim.organization]
    .map(markdownText)
    .filter(Boolean)
    .join(" · ");
  const period = [claim.start_value, claim.end_value]
    .map(markdownText)
    .filter(Boolean)
    .join("–");
  const details = [roleAndOrganization, period].filter(Boolean).join(" | ");
  const description = markdownText(claim.description);
  return [
    `- **${title}** — _${VERIFICATION_MARKERS[claim.verification_status]}_`,
    details ? `  ${details}` : "",
    description ? `  ${description.replace(/\n/gu, "\n  ")}` : "",
  ].filter(Boolean).join("\n");
}

export function renderCvMarkdown(
  profile: CvProfileForRender,
  claims: CvClaimForRender[],
  questions: CvQuestionForRender[],
): string {
  const acceptedClaims = claims.filter((claim) => claim.verification_status !== "rejected");
  const checkedAt = profile.source_checked_at
    ? new Date(profile.source_checked_at).toLocaleDateString("nb-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;
  const lines = [
    `# CV — ${markdownText(profile.person_name)}`,
    "",
    profile.headline ? `## ${markdownText(profile.headline)}` : "",
    profile.headline ? "" : "",
    profile.professional_summary ? markdownText(profile.professional_summary) : "",
    profile.professional_summary ? "" : "",
    "## Kilde og kvalitet",
    "",
    profile.source_url ? `- Kildeprofil: ${profile.source_url}` : "- Kildeprofil: opplastet prosjektfil",
    checkedAt ? `- Kilden ble gjennomgått: ${checkedAt}` : "",
    "- Fakta merket «Kildestøttet» er hentet fra kildefilen, men ikke bekreftet av personen.",
    "- Fakta merket «Bekreftet» er eksplisitt kontrollert av brukeren.",
    "",
  ].filter((line, index, source) => line !== "" || source[index - 1] !== "");

  for (const category of CV_CATEGORIES) {
    const categoryClaims = acceptedClaims.filter((claim) => claim.category === category);
    if (!categoryClaims.length) continue;
    lines.push(`## ${CATEGORY_LABELS[category]}`, "");
    for (const claim of categoryClaims) lines.push(renderClaim(claim), "");
  }

  const answered = questions.filter((question) => question.status === "answered" && question.answer?.trim());
  if (answered.length) {
    lines.push("## Supplerende, bekreftet informasjon", "");
    for (const question of answered) {
      lines.push(`### ${markdownText(question.question)}`, "", markdownText(question.answer), "");
    }
  }

  const unanswered = questions.filter((question) => question.status === "open" || !question.answer?.trim());
  if (unanswered.length) {
    lines.push("## Åpne avklaringer", "");
    for (const question of unanswered) lines.push(`- [ ] ${markdownText(question.question)}`);
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n{3,}/gu, "\n\n").trim()}\n`;
}
