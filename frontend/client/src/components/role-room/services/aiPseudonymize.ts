/**
 * Frontend pseudonymization layer for AI calls.
 *
 * GDPR Art. 5.1c (data minimization) + Art. 25 (privacy by design):
 * when the Role Room Agent needs to reason about candidates or crew we
 * never send real names/emails/phones to the LLM. This module replaces
 * identifiers with stable placeholders on the way in, and restores them on
 * the way back out when rendering responses.
 *
 * Guarantees:
 *   - Deterministic within a single call: {{candidate_1}} always maps back
 *     to the same real identity.
 *   - Pseudonyms are scoped per-call and never persisted.
 *   - Email and phone are regex-scrubbed as a backstop even if callers
 *     forget to pass entities explicitly.
 */

export interface PseudonymizableEntity {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface PseudonymMap {
  toPlaceholder(value: string): string;
  fromPlaceholder(value: string): string;
  /** Placeholders assigned during this call, for audit logging. */
  assignments: Array<{ placeholder: string; real: string; field: 'name' | 'email' | 'phone' }>;
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{6,}\d)/g;

export function buildPseudonymMap(entities: PseudonymizableEntity[], prefix = 'candidate'): PseudonymMap {
  const real2placeholder = new Map<string, string>();
  const placeholder2real = new Map<string, string>();
  const assignments: PseudonymMap['assignments'] = [];

  entities.forEach((entity, index) => {
    const placeholder = `{{${prefix}_${index + 1}}}`;
    if (entity.name) {
      real2placeholder.set(entity.name, placeholder);
      placeholder2real.set(placeholder, entity.name);
      assignments.push({ placeholder, real: entity.name, field: 'name' });
    }
    if (entity.email) {
      const emailPlaceholder = `{{${prefix}_${index + 1}_email}}`;
      real2placeholder.set(entity.email, emailPlaceholder);
      placeholder2real.set(emailPlaceholder, entity.email);
      assignments.push({ placeholder: emailPlaceholder, real: entity.email, field: 'email' });
    }
    if (entity.phone) {
      const phonePlaceholder = `{{${prefix}_${index + 1}_phone}}`;
      real2placeholder.set(entity.phone, phonePlaceholder);
      placeholder2real.set(phonePlaceholder, entity.phone);
      assignments.push({ placeholder: phonePlaceholder, real: entity.phone, field: 'phone' });
    }
  });

  return {
    toPlaceholder(value: string): string {
      if (!value) return value;
      let output = value;
      // Replace entity fields first so exact matches are consumed before regex.
      for (const [real, placeholder] of real2placeholder) {
        // Escape special regex chars in real values.
        const escaped = real.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output.replace(new RegExp(escaped, 'g'), placeholder);
      }
      // Backstop: scrub any leftover emails / phones we don't have explicit entities for.
      output = output.replace(EMAIL_REGEX, '[[email_redacted]]');
      output = output.replace(PHONE_REGEX, (match) => {
        // Skip short numeric sequences that are dates or scene numbers.
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
  };
}

/** Return the list of PII fields that will actually be sent given these entities
 *  and text. Useful for displaying the AI transparency banner (item 13.2f). */
export function describePiiExposure(
  entities: PseudonymizableEntity[],
  originalText: string,
): { fields: string[]; entityCount: number; emailsScrubbed: number; phonesScrubbed: number } {
  const fields = new Set<string>();
  for (const entity of entities) {
    if (entity.name) fields.add('kandidatnavn (pseudonymisert)');
    if (entity.email) fields.add('e-post (pseudonymisert)');
    if (entity.phone) fields.add('telefon (pseudonymisert)');
    if (entity.role) fields.add('rolle');
  }
  const emailsInText = originalText.match(EMAIL_REGEX) ?? [];
  const phonesInText = (originalText.match(PHONE_REGEX) ?? []).filter((m) => m.replace(/\D/g, '').length >= 7);
  return {
    fields: Array.from(fields),
    entityCount: entities.length,
    emailsScrubbed: emailsInText.length,
    phonesScrubbed: phonesInText.length,
  };
}
