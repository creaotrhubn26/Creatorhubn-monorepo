import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CastingProject } from '../../models/casting';
import { CinematographerWorkspace } from './CinematographerWorkspace';

const trollProject: CastingProject = {
  id: 'troll-project',
  name: 'Troll',
  roles: [],
  candidates: [],
  schedules: [],
  locations: [],
  props: [],
  crew: [{ id: 'dop', name: 'Dana', role: 'cinematographer', status: 'confirmed' }],
  sceneBreakdowns: [{ id: 'scene-1', sceneNumber: 1 }],
  shotLists: [],
};

describe('CinematographerWorkspace', () => {
  it('renders the six DoP surfaces and factual source status', () => {
    render(
      <CinematographerWorkspace
        project={trollProject}
        onNavigate={() => {}}
        onOpenFullWorkspace={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Troll' })).toBeInTheDocument();
    expect(screen.getByText('FILMFOTOGRAF · DoP')).toBeInTheDocument();
    expect(screen.getByText('Kun registrerte data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I dag' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Shotplan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lys og utstyr' })).toBeInTheDocument();
    expect(screen.getByText('1 scene mangler registrerte shots')).toBeInTheDocument();
  });

  it('routes role surfaces and the full project through explicit callbacks', () => {
    const onNavigate = vi.fn();
    const onOpenFullWorkspace = vi.fn();
    render(
      <CinematographerWorkspace
        project={trollProject}
        onNavigate={onNavigate}
        onOpenFullWorkspace={onOpenFullWorkspace}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lys og utstyr' }));
    expect(onNavigate).toHaveBeenCalledWith('lighting-equipment');

    fireEvent.click(screen.getByTestId('cinematographer-open-full-workspace'));
    expect(onOpenFullWorkspace).toHaveBeenCalledTimes(1);
  });

  it('disables surfaces removed by project access without firing navigation', () => {
    const onNavigate = vi.fn();
    render(
      <CinematographerWorkspace
        project={trollProject}
        onNavigate={onNavigate}
        onOpenFullWorkspace={() => {}}
        isSurfaceAvailable={(surface) => surface !== 'camera-crew'}
      />,
    );

    const cameraCrew = screen.getByTestId('cinematographer-surface-camera-crew');
    expect(cameraCrew).toBeDisabled();
    fireEvent.click(cameraCrew);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
