/**
 * Backend pseudonymization layer for Role Room Agent.
 *
 * Mirrors frontend/.../services/aiPseudonymize.ts. Intentionally duplicated
 * because every Claude call MUST pass through this on the backend regardless
 * of whether the frontend already scrubbed — defense in depth per
 * docs/role-room/ai-gdpr-dpia.md § 4.2 ("belt-and-suspenders").
 */

export interface PseudonymizableEntity {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface BackendPseudonymMap {
  toPlaceholder(value: string): string;
  fromPlaceholder(value: string): string;
  assignments: Array<{ placeholder: string; real: string; field: 'name' | 'email' | 'phone' }>;
  /** For audit logging — what categories of PII actually got pseudonymized. */
  categoriesTouched: string[];
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{6,}\d)/g;

export function buildBackendPseudonymMap(
  entities: PseudonymizableEntity[],
  prefix: 'candidate' | 'crew' = 'candidate',
): BackendPseudonymMap {
  const real2placeholder = new Map<string, string>();
  const placeholder2real = new Map<string, string>();
  const assignments: BackendPseudonymMap['assignments'] = [];
  const categories = new Set<string>();

  entities.forEach((entity, index) => {
    const base = `${prefix}_${index + 1}`;
    if (entity.name) {
      const p = `{{${base}}}`;
      real2placeholder.set(entity.name, p);
      placeholder2real.set(p, entity.name);
      assignments.push({ placeholder: p, real: entity.name, field: 'name' });
      categories.add(`${prefix}_name_pseudo`);
    }
    if (entity.email) {
      const p = `{{${base}_email}}`;
      real2placeholder.set(entity.email, p);
      placeholder2real.set(p, entity.email);
      assignments.push({ placeholder: p, real: entity.email, field: 'email' });
      categories.add(`${prefix}_email_pseudo`);
    }
    if (entity.phone) {
      const p = `{{${base}_phone}}`;
      real2placeholder.set(entity.phone, p);
      placeholder2real.set(p, entity.phone);
      assignments.push({ placeholder: p, real: entity.phone, field: 'phone' });
      categories.add(`${prefix}_phone_pseudo`);
    }
  });

  return {
    toPlaceholder(value: string): string {
      if (!value) return value;
      let output = value;
      for (const [real, placeholder] of real2placeholder) {
        const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output.replace(new RegExp(escaped, 'g'), placeholder);
      }
      // Backstop — scrub any leftover emails/phones the caller forgot to provide as entities.
      output = output.replace(EMAIL_REGEX, '[[email_redacted]]');
      output = output.replace(PHONE_REGEX, (match) => {
        const digits = match.replace(/\D/g, '');
        if (digits.length < 7) return match;
        return '[[phone_redacted]]';
      });
      return output;
    },
    fromPlaceholder(value: string): string {
      if (!value) return value;
      let output = value;
      for (const [placeholder, real] of placeholder2real) {
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output.replace(new RegExp(escaped, 'g'), real);
      }
      return output;
    },
    assignments,
    categoriesTouched: Array.from(categories),
  };
}

/** Count scrubbed emails/phones in the text for audit stats. */
export function countScrubbed(text: string): { emails: number; phones: number } {
  const emails = (text.match(EMAIL_REGEX) ?? []).length;
  const phones = (text.match(PHONE_REGEX) ?? []).filter(
    (m) => m.replace(/\D/g, '').length >= 7,
  ).length;
  return { emails, phones };
}
