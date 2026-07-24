import { describe, expect, it } from 'vitest';
import { buildAiDisclosure } from '../src/ai/disclosure.js';

describe('buildAiDisclosure', () => {
  it('med KI aktiv: markerer bilagslesing aktiv og navngir modellen', () => {
    const d = buildAiDisclosure({ aiExtraction: true, aiModel: 'claude-sonnet-4-6', emailScanningActive: true });
    expect(d.usesAi).toBe(true);
    const bilag = d.uses.find((u) => u.id === 'bilagslesing')!;
    expect(bilag.active).toBe(true);
    expect(bilag.model).toBe('claude-sonnet-4-6');
    const epost = d.uses.find((u) => u.id === 'epostfiltrering')!;
    expect(epost.active).toBe(true);
    // De fire prinsippene er alltid til stede.
    expect(d.principles.map((p) => p.key)).toEqual([
      'transparens',
      'dokumentasjon',
      'menneskelig-kontroll',
      'tydelig-ki',
    ]);
    // Menneskelig kontroll er eksplisitt.
    expect(d.humanOversight.toLowerCase()).toContain('godkjenning');
  });

  it('uten e-postskanning: e-postfiltrering er inaktiv, bilagslesing kan fortsatt være aktiv', () => {
    const d = buildAiDisclosure({ aiExtraction: true, aiModel: 'claude-sonnet-4-6', emailScanningActive: false });
    expect(d.uses.find((u) => u.id === 'bilagslesing')!.active).toBe(true);
    expect(d.uses.find((u) => u.id === 'epostfiltrering')!.active).toBe(false);
  });

  it('uten KI: usesAi=false og all KI-bruk markert inaktiv', () => {
    const d = buildAiDisclosure({ aiExtraction: false, aiModel: 'claude-sonnet-4-6', emailScanningActive: true });
    expect(d.usesAi).toBe(false);
    expect(d.uses.every((u) => !u.active)).toBe(true);
    expect(d.headline).toContain('ikke aktiv');
  });

  it('lister begrensninger og at KI aldri bokfører selv', () => {
    const d = buildAiDisclosure({ aiExtraction: true, aiModel: 'claude-sonnet-4-6', emailScanningActive: true });
    expect(d.limitations.length).toBeGreaterThan(0);
    expect(d.headline.toLowerCase()).toContain('bokfører aldri');
  });
});
