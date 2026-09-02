import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_CONSTRAINTS,
  BOOTSTRAP_OUTPUT_SCHEMA_HINTS,
  BOOTSTRAP_SYSTEM_PROMPT,
  ROLE_ROOM_AGENT_RESEARCH_SKILLS,
} from './role-room-agent-bootstrap-constraints.js';

// F7: the OpenAI and Claude synthesis paths previously duplicated these lists
// and had DRIFTED — OpenAI had the fieldMetadata provenance rule, Claude had
// the region rules. These tests lock the union so a future edit can't silently
// drop one path's rules again.
describe('shared bootstrap constraints (F7)', () => {
  it('includes the fieldMetadata provenance instruction (was OpenAI-only)', () => {
    expect(BOOTSTRAP_CONSTRAINTS.some((c) => c.includes('fieldMetadata'))).toBe(true);
  });

  it('includes the KRITISK region-regel (was Claude-only)', () => {
    expect(BOOTSTRAP_CONSTRAINTS.some((c) => c.includes('KRITISK region-regel'))).toBe(true);
  });

  it('tells the model to ground marketing on the deterministic marketingSetup', () => {
    expect(BOOTSTRAP_CONSTRAINTS.some((c) => c.includes('marketingSetup'))).toBe(true);
  });

  it('tells the model not to trust a name-only Brreg match for the legal name', () => {
    expect(
      BOOTSTRAP_CONSTRAINTS.some(
        (c) => c.includes('matchedBy') && c.includes('organization_number'),
      ),
    ).toBe(true);
  });

  it('exposes a non-empty system prompt and schema hints', () => {
    expect(BOOTSTRAP_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    expect(BOOTSTRAP_OUTPUT_SCHEMA_HINTS.companyProfile).toContain('businessModel');
    expect(BOOTSTRAP_OUTPUT_SCHEMA_HINTS.companyProfile).toContain('probableLocationAddress');
  });

  it('shares explicit identity, geography, propagation and fail-closed skills across providers', () => {
    expect(ROLE_ROOM_AGENT_RESEARCH_SKILLS.map((skill) => skill.id)).toEqual([
      'resolve_legal_identity',
      'enforce_source_precedence',
      'verify_geographic_relevance',
      'propagate_verified_profile',
      'fail_closed_without_evidence',
    ]);
    for (const skill of ROLE_ROOM_AGENT_RESEARCH_SKILLS) {
      expect(BOOTSTRAP_CONSTRAINTS).toContain(skill.instruction);
    }
  });
});
