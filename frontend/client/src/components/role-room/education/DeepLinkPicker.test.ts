import { describe, expect, it } from 'vitest';
import { buildPublishPayload, buildErrorMessage, consequenceHint, canPublishForm } from './DeepLinkPicker';

const BASE_FORM = {
  productionId: 'prod-1', cohortId: 'cohort-1', artifactKind: 'story-arc', artifactView: 'story-logic',
  title: '  Skriv en Story Logic i dag  ', brief: '', dueAt: '', learningGoals: '',
  isArbeidskrav: false, isExam: false, vurderingsform: '',
};

describe('buildPublishPayload', () => {
  it('sender rikt payload (productionId + projectId) når en eksisterende produksjon er valgt', () => {
    const payload = buildPublishPayload(BASE_FORM, false, 'proj-1');
    expect(payload).toMatchObject({
      title: 'Skriv en Story Logic i dag',
      cohortId: 'cohort-1',
      productionId: 'prod-1',
      projectId: 'proj-1',
      createProduction: undefined,
      artifactKind: 'story-arc',
      artifactView: 'story-logic',
    });
  });

  it('sender createProduction:true og utelater productionId/projectId når «opprett ny» er valgt', () => {
    const payload = buildPublishPayload(BASE_FORM, true, 'proj-1');
    expect(payload.createProduction).toBe(true);
    expect(payload.productionId).toBeUndefined();
    expect(payload.projectId).toBeUndefined();
  });

  it('utelater artifactView når artefakt ikke er story-arc (backend-guard speilet client-side)', () => {
    const payload = buildPublishPayload({ ...BASE_FORM, artifactKind: 'storyboard' }, false, 'proj-1');
    expect(payload.artifactView).toBeUndefined();
  });

  it('trimmer tittel og konverterer tomme valgfrie felt til undefined (ikke tomme strenger)', () => {
    const payload = buildPublishPayload({ ...BASE_FORM, brief: '  ', dueAt: '', vurderingsform: '' }, false, 'proj-1');
    expect(payload.title).toBe('Skriv en Story Logic i dag');
    expect(payload.brief).toBeUndefined();
    expect(payload.dueAt).toBeUndefined();
    expect(payload.vurderingsform).toBeUndefined();
  });
});

describe('canPublishForm (Task 7-review: kull er PÅKREVD, ikke bare synlig-valgfritt)', () => {
  it('true når produksjon + tittel + kull er satt', () => {
    expect(canPublishForm(BASE_FORM, false, false)).toBe(true);
  });
  it('false uten kull SELV OM produksjon + tittel er satt (hindrer stille legacy-fallback/tomt production_id)', () => {
    expect(canPublishForm({ ...BASE_FORM, cohortId: '' }, false, false)).toBe(false);
  });
  it('false uten tittel', () => {
    expect(canPublishForm({ ...BASE_FORM, title: '   ' }, false, false)).toBe(false);
  });
  it('false uten produksjon og ikke i «opprett ny»-modus', () => {
    expect(canPublishForm({ ...BASE_FORM, productionId: '' }, false, false)).toBe(false);
  });
  it('true i «opprett ny»-modus uten productionId, forutsatt tittel + kull', () => {
    expect(canPublishForm({ ...BASE_FORM, productionId: '' }, true, false)).toBe(true);
  });
  it('false mens publisering pågår', () => {
    expect(canPublishForm(BASE_FORM, false, true)).toBe(false);
  });
});

describe('consequenceHint', () => {
  it('Story Arc + Story Logic → «Studenten lander rett i Story Logic.»', () => {
    expect(consequenceHint('story-arc', 'story-logic')).toBe('Studenten lander rett i Story Logic.');
  });
  it('Story Arc + tomt steg → studio-hub-varianten', () => {
    expect(consequenceHint('story-arc', '')).toBe('Studenten lander i Story Arc-studio.');
  });
  it('tomt artefakt → «Studenten åpner produksjonen.»', () => {
    expect(consequenceHint('', '')).toBe('Studenten åpner produksjonen.');
  });
});

describe('buildErrorMessage', () => {
  it('tredelt formel: hva → tilstand → hva nå, ingen utropstegn', () => {
    const msg = buildErrorMessage('cohort_not_found', 'Canvas');
    expect(msg).toBe('Kunne ikke publisere: valgt kull ble ikke funnet. Ingenting ble lagt til i Canvas. Sjekk at produksjon og kull er valgt, og prøv igjen.');
    expect(msg).not.toContain('!');
  });
  it('ukjent feilkode faller tilbake til generisk teknisk-feil-tekst', () => {
    expect(buildErrorMessage('some_unmapped_code', null)).toContain('en teknisk feil oppstod');
  });
  it('cohort_required (backendens rike sti uten kull) → «kull mangler»', () => {
    expect(buildErrorMessage('cohort_required', 'Moodle')).toContain('kull mangler');
  });
});
