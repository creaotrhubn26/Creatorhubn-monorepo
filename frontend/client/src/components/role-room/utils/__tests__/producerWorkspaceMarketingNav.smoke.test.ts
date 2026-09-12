import { describe, expect, it } from 'vitest';
import {
  getDefaultProducerWorkspaceNavigation,
  normalizeProducerWorkspaceNavigation,
  flattenProducerWorkspacePages,
} from '../producerProjectPlanning';
import type { ProducerWorkspaceNavigation } from '../../models/casting';

const allSurfaces = (nav: ProducerWorkspaceNavigation): string[] =>
  nav.sections.flatMap((section) => flattenProducerWorkspacePages(section).map((page) => page.surface));

describe('Markedsplan som stående workspace-fane', () => {
  it('default-navigasjonen inneholder en marketing-plan-side i en «Markedsføring»-seksjon', () => {
    const nav = getDefaultProducerWorkspaceNavigation();
    expect(allSurfaces(nav)).toContain('marketing-plan');
    const marketingSection = nav.sections.find((section) =>
      flattenProducerWorkspacePages(section).some((page) => page.surface === 'marketing-plan'),
    );
    expect(marketingSection?.title).toBe('Markedsføring');
  });

  it('normalize legger marketing-plan til for eksisterende prosjekter som mangler den (migrasjon)', () => {
    const legacy = getDefaultProducerWorkspaceNavigation();
    // Simuler et eldre prosjekt hvis lagrede nav ble laget før Markedsføring-seksjonen fantes.
    const legacyWithoutMarketing: ProducerWorkspaceNavigation = {
      ...legacy,
      sections: legacy.sections.filter(
        (section) => !flattenProducerWorkspacePages(section).some((page) => page.surface === 'marketing-plan'),
      ),
    };
    expect(allSurfaces(legacyWithoutMarketing)).not.toContain('marketing-plan');

    const normalized = normalizeProducerWorkspaceNavigation(legacyWithoutMarketing);
    expect(allSurfaces(normalized)).toContain('marketing-plan');
  });

  it('normalize dupliserer ikke marketing-plan når den allerede finnes', () => {
    const nav = getDefaultProducerWorkspaceNavigation();
    const normalized = normalizeProducerWorkspaceNavigation(nav);
    const count = allSurfaces(normalized).filter((surface) => surface === 'marketing-plan').length;
    expect(count).toBe(1);
  });

  it('er idempotent — gjentatt normalisering hoper IKKE opp marketing-plan', () => {
    let nav = getDefaultProducerWorkspaceNavigation();
    for (let i = 0; i < 5; i += 1) {
      nav = normalizeProducerWorkspaceNavigation(nav);
    }
    expect(allSurfaces(nav).filter((surface) => surface === 'marketing-plan').length).toBe(1);
  });

  it('selv-helbreder en nav som allerede har akkumulert duplikat-marketing-plan', () => {
    const base = getDefaultProducerWorkspaceNavigation();
    const marketingSection = base.sections.find((section) =>
      flattenProducerWorkspacePages(section).some((page) => page.surface === 'marketing-plan'),
    );
    expect(marketingSection).toBeTruthy();
    // Simuler korrupt nav: tre ekstra marketing-plan-seksjoner (slik bug-en lagde).
    const corrupted: ProducerWorkspaceNavigation = {
      ...base,
      sections: [
        ...base.sections,
        { ...marketingSection!, id: 'dup-1', pages: marketingSection!.pages.map((p) => ({ ...p, id: 'dup-1-page' })) },
        { ...marketingSection!, id: 'dup-2', pages: marketingSection!.pages.map((p) => ({ ...p, id: 'dup-2-page' })) },
        { ...marketingSection!, id: 'dup-3', pages: marketingSection!.pages.map((p) => ({ ...p, id: 'dup-3-page' })) },
      ],
    };
    expect(allSurfaces(corrupted).filter((surface) => surface === 'marketing-plan').length).toBe(4);

    const healed = normalizeProducerWorkspaceNavigation(corrupted);
    expect(allSurfaces(healed).filter((surface) => surface === 'marketing-plan').length).toBe(1);
  });
});
