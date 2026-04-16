import { describe, expect, it } from 'vitest';
import {
  buildBackendPseudonymMap,
  countScrubbed,
  type PseudonymizableEntity,
} from './role-room-pseudonymize.js';

describe('buildBackendPseudonymMap', () => {
  it('returns pass-through map when no entities are given', () => {
    const map = buildBackendPseudonymMap([]);
    const input = 'Hei, dette er en test med ingen kandidater.';
    expect(map.toPlaceholder(input)).toBe(input);
    expect(map.assignments).toEqual([]);
    expect(map.categoriesTouched).toEqual([]);
  });

  it('replaces candidate name with a stable placeholder', () => {
    const entities: PseudonymizableEntity[] = [
      { id: 'c1', name: 'Ola Nordmann' },
    ];
    const map = buildBackendPseudonymMap(entities);
    const result = map.toPlaceholder('Ola Nordmann passer godt for rollen.');
    expect(result).toBe('{{candidate_1}} passer godt for rollen.');
    expect(map.assignments).toHaveLength(1);
    expect(map.categoriesTouched).toContain('candidate_name_pseudo');
  });

  it('roundtrips placeholder back to real value via fromPlaceholder', () => {
    const entities: PseudonymizableEntity[] = [
      { id: 'c1', name: 'Kari Hansen', email: 'kari@example.com' },
    ];
    const map = buildBackendPseudonymMap(entities);
    const masked = map.toPlaceholder('Kari Hansen har epost kari@example.com.');
    expect(masked).toBe('{{candidate_1}} har epost {{candidate_1_email}}.');
    expect(map.fromPlaceholder(masked)).toBe('Kari Hansen har epost kari@example.com.');
  });

  it('uses a different prefix for crew', () => {
    const entities: PseudonymizableEntity[] = [
      { id: 'x1', name: 'Bob Boom', role: 'boom' },
    ];
    const map = buildBackendPseudonymMap(entities, 'crew');
    expect(map.toPlaceholder('Bob Boom kommer kl 07:00.')).toBe(
      '{{crew_1}} kommer kl 07:00.',
    );
    expect(map.categoriesTouched).toContain('crew_name_pseudo');
  });

  it('scrubs unprovided emails in the backstop regex', () => {
    const map = buildBackendPseudonymMap([]);
    const masked = map.toPlaceholder('Send til noen@annen.no, takk.');
    expect(masked).toBe('Send til [[email_redacted]], takk.');
  });

  it('scrubs unprovided long phone numbers but keeps short digit runs alone', () => {
    const map = buildBackendPseudonymMap([]);
    expect(map.toPlaceholder('Ring meg på 47 12 34 56 78.')).toContain('[[phone_redacted]]');
    // 5-digit postal code is too short to be a phone — should stay.
    expect(map.toPlaceholder('Postnummer 0150.')).toBe('Postnummer 0150.');
  });

  it('escapes regex metacharacters in the real value when replacing', () => {
    const entities: PseudonymizableEntity[] = [
      { id: 'c1', name: 'Ola (Ola) Nordmann' },
    ];
    const map = buildBackendPseudonymMap(entities);
    // Should not throw, and should replace the literal parenthesised name.
    expect(map.toPlaceholder('Se Ola (Ola) Nordmann!')).toBe('Se {{candidate_1}}!');
  });

  it('does not corrupt already-placeholder text via fromPlaceholder', () => {
    const entities: PseudonymizableEntity[] = [
      { id: 'c1', name: 'Kari' },
    ];
    const map = buildBackendPseudonymMap(entities);
    // Text that happens to contain unrelated {{...}} braces should survive.
    const input = '{{candidate_2}} er ikke i denne mappingen, men {{candidate_1}} er.';
    expect(map.fromPlaceholder(input)).toBe(
      '{{candidate_2}} er ikke i denne mappingen, men Kari er.',
    );
  });
});

describe('countScrubbed', () => {
  it('counts emails and phones in input text', () => {
    const counts = countScrubbed('Skriv til a@b.no eller ring +47 123 456 78 i dag.');
    expect(counts.emails).toBe(1);
    expect(counts.phones).toBeGreaterThanOrEqual(1);
  });

  it('ignores short numeric sequences', () => {
    const counts = countScrubbed('Rom 42 kl 09:00.');
    expect(counts.phones).toBe(0);
  });
});
