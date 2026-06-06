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
});
