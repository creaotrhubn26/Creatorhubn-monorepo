// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CastingProject } from '../../models/casting';
import { buildLocationManagerOperations } from './locationManagerWorkspaceModel';
import { LocationManagerWorkspace } from './LocationManagerWorkspace';

const { list, save, listMedia, uploadPhoto, getMediaUrl } = vi.hoisted(() => ({
  list: vi.fn(), save: vi.fn(), listMedia: vi.fn(), uploadPhoto: vi.fn(), getMediaUrl: vi.fn(),
}));

vi.mock('../../services/locationManagerService', () => ({
  locationManagerService: { list, save, listMedia, uploadPhoto, getMediaUrl },
  LocationOperationsConflictError: class LocationOperationsConflictError extends Error {},
  LocationOperationsNetworkError: class LocationOperationsNetworkError extends Error {},
}));

const project: CastingProject = {
  id: 'troll', name: 'Troll', currency: 'NOK', roles: [], candidates: [], schedules: [], crew: [], props: [],
  locations: [
    { id: 'dovre', name: 'Dovrefjell', address: 'Dovre', contactInfo: { name: 'Kari Grunneier' } },
    { id: 'oslo', name: 'Oslo rådhus', address: 'Rådhusplassen 1' },
  ],
};

const renderWorkspace = () => render(
  <LocationManagerWorkspace
    project={project}
    onOpenLocations={() => {}}
    onOpenSchedule={() => {}}
    onOpenCrew={() => {}}
    onOpenFullWorkspace={() => {}}
  />,
);

describe('LocationManagerWorkspace', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue([]);
    save.mockReset();
    listMedia.mockReset().mockResolvedValue([]);
    uploadPhoto.mockReset();
    getMediaUrl.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('presents portfolio readiness and the complete field workflow', async () => {
    renderWorkspace();
    expect(await screen.findByTestId('location-manager-workspace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Troll' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Beslutning, eier og dato' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scout Capture' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Teknisk recce' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Klareringsporter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Feltlogistikk' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Risiko og backup' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kostnadskontroll' })).toBeInTheDocument();
    expect(screen.getAllByText('Dovrefjell').length).toBeGreaterThan(0);
  });

  it('keeps advanced workflow sections collapsed on a narrow touch layout', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width:599.95px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    renderWorkspace();

    const clearance = await screen.findByRole('button', { name: /Klareringsporter/ });
    expect(clearance).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(clearance);
    expect(clearance).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Eieravtale og signatur status')).toBeInTheDocument();
  });

  it('saves a changed next action through the conflict-safe endpoint', async () => {
    const savedOperations = buildLocationManagerOperations(project.locations![0], project);
    save.mockImplementation(async (_projectId, _locationId, _version, operations) => ({
      locationId: 'dovre', operations, version: 1, updatedAt: '2026-09-13T12:00:00Z',
    }));
    renderWorkspace();
    await screen.findByRole('heading', { name: 'Klareringsporter' });

    fireEvent.change(screen.getByLabelText('Neste kritiske handling'), { target: { value: 'Ring kommunen før klokken 12.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lagre beredskap' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(
      'troll', 'dovre', 0, expect.objectContaining({ nextAction: 'Ring kommunen før klokken 12.' }),
    ));
    expect(await screen.findByText('Lokasjonsberedskapen er lagret som versjon 1.')).toBeInTheDocument();
    expect(savedOperations.stage).toBe('need');
  });
});
