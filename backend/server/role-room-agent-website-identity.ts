// Pure website -> legal-entity extraction for Role Room research.
// Kept dependency-free so the high-trust identity boundary can be tested
// without loading the full agent pipeline.

export type RoleRoomWebsiteLegalIdentity = {
  organizationNumber: string | null;
  legalName: string | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** Validate a 9-digit Norwegian organization number with mod-11. */
export function isValidNorwegianOrganizationNumber(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let index = 0; index < 8; index += 1) {
    sum += Number(digits[index]) * weights[index];
  }
  const remainder = sum % 11;
  const checksum = remainder === 0 ? 0 : 11 - remainder;
  return checksum !== 10 && checksum === Number(digits[8]);
}

function extractOrganizationNumber(text: string): string | null {
  const labelled = text.match(
    /(?:org\.?\s*nr\.?|organisasjonsnummer|orgnr|mva)\s*[:.]?\s*(?:no)?\s*((?:\d[\s.-]?){9})/i,
  );
  if (labelled) {
    const digits = labelled[1].replace(/\D/g, "");
    if (isValidNorwegianOrganizationNumber(digits)) return digits;
  }

  const candidates = text.match(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}\b/g) ?? [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (isValidNorwegianOrganizationNumber(digits)) return digits;
  }
  return null;
}

const LEGAL_ENTITY_TYPES = new Set([
  "organization",
  "corporation",
  "localbusiness",
  "medicalorganization",
]);

function jsonLdTypes(record: Record<string, unknown>): string[] {
  const raw = record["@type"];
  return (Array.isArray(raw) ? raw : [raw])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
}

function collectJsonLdLegalNames(value: unknown, output: Array<{ name: string; priority: number }>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonLdLegalNames(entry, output));
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const isLegalEntity = jsonLdTypes(record).some((type) => LEGAL_ENTITY_TYPES.has(type));
  if (isLegalEntity) {
    if (typeof record.legalName === "string" && normalizeWhitespace(record.legalName)) {
      output.push({ name: normalizeWhitespace(record.legalName), priority: 100 });
    }
    if (typeof record.name === "string" && normalizeWhitespace(record.name)) {
      output.push({ name: normalizeWhitespace(record.name), priority: 70 });
    }
  }

  Object.values(record).forEach((entry) => collectJsonLdLegalNames(entry, output));
}

function extractJsonLdLegalName(html: string): string | null {
  const candidates: Array<{ name: string; priority: number }> = [];
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      collectJsonLdLegalNames(JSON.parse(decodeHtmlEntities(match[1]).trim()), candidates);
    } catch {
      // Invalid JSON-LD is common; visible legal footer text remains a fallback.
    }
  }
  return candidates.sort((left, right) => right.priority - left.priority)[0]?.name ?? null;
}

function extractFooterLegalName(text: string): string | null {
  const entityName = "([A-ZÆØÅ][A-Za-zÆØÅæøå0-9&.'’.-]*(?:\\s+[A-ZÆØÅa-zæøå0-9&.'’.-]+){0,5}\\s+(?:AS|ASA|ANS|DA|SA|NUF|ENK))";
  const contextualPatterns = [
    new RegExp(`(?:©|copyright)[^.!?]{0,80}?${entityName}`, "i"),
    new RegExp(`(?:drives|drevet|eies|eid)\\s+av\\s+${entityName}`, "i"),
  ];
  for (const pattern of contextualPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return normalizeWhitespace(match[1]);
  }
  return null;
}

/**
 * Extract high-trust Norwegian legal identity signals from a website.
 * JSON-LD legalName wins; conservative copyright/ownership copy is fallback.
 */
export function extractWebsiteLegalIdentityFromHtml(html: string): RoleRoomWebsiteLegalIdentity {
  if (!html) return { organizationNumber: null, legalName: null };
  const visibleText = normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " "),
    ),
  );
  return {
    organizationNumber: extractOrganizationNumber(visibleText),
    legalName: extractJsonLdLegalName(html) || extractFooterLegalName(visibleText),
  };
}
