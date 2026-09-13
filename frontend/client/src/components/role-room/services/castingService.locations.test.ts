// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CastingProject, Location } from '../models/casting';
import { castingService } from './castingService';

const location: Location = {
  id: 'location-1',
  projectId: 'project-1',
  name: 'Trollskogen',
};

const createProject = (): CastingProject => ({
  id: 'project-1',
  name: 'Troll',
  roles: [],
  candidates: [],
  crew: [],
  schedules: [],
  locations: [{ ...location }],
  props: [],
});

describe('castingService location persistence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves an updated location without mutating the cached project object', async () => {
    const cachedProject = createProject();
    vi.spyOn(castingService, 'getProject').mockResolvedValue(cachedProject);
    const saveProject = vi.spyOn(castingService, 'saveProject').mockResolvedValue();
    const propertyAnalysis = {
      photographySpots: [],
      droneRestrictions: { allowed: false, restrictions: ['Ikke verifisert'], noFlyZones: [] },
      weatherExposure: {},
      accessAnalysis: {},
      analysisMeta: { operationalStatus: 'unverified' as const, propertySource: 'kartverket' as const },
    };

    await castingService.saveLocation('project-1', { ...location, propertyAnalysis });

    expect(cachedProject.locations?.[0].propertyAnalysis).toBeUndefined();
    expect(saveProject).toHaveBeenCalledWith(expect.objectContaining({
      locations: [expect.objectContaining({ id: 'location-1', propertyAnalysis })],
    }));
  });

  it('deletes a location without mutating the cached project object', async () => {
    const cachedProject = createProject();
    vi.spyOn(castingService, 'getProject').mockResolvedValue(cachedProject);
    const saveProject = vi.spyOn(castingService, 'saveProject').mockResolvedValue();

    await castingService.deleteLocation('project-1', 'location-1');

    expect(cachedProject.locations).toHaveLength(1);
    expect(saveProject).toHaveBeenCalledWith(expect.objectContaining({ locations: [] }));
  });
});
