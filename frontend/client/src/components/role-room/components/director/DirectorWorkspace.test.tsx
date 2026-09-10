import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CastingProject } from '../../models/casting';
import { DirectorWorkspace } from './DirectorWorkspace';

const trollProject: CastingProject = {
  id: 'troll-project',
  name: 'Troll',
  roles: [{ id: 'role-1', name: 'Nora', status: 'open' }],
  candidates: [{ id: 'candidate-1', name: 'Ada', status: 'shortlist' }],
  crew: [],
  schedules: [],
  locations: [],
  props: [],
  sceneBreakdowns: [{ id: 'scene-1', sceneNumber: 1 }],
};

describe('DirectorWorkspace', () => {
  it('renders the six director surfaces and labels Today as current', () => {
    render(
      <DirectorWorkspace
        project={trollProject}
        roles={trollProject.roles}
        candidates={trollProject.candidates}
        schedules={trollProject.schedules}
        onNavigate={() => {}}
        onOpenFullWorkspace={() => {}}
      />,
    );

    expect(screen.getByTestId('director-workspace')).toBeInTheDocument();
    expect(screen.getByText('Ingen AI-antakelser')).toBeInTheDocument();
    expect(screen.getByTestId('director-surface-today')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('director-surface-post')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Scener' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Casting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'På sett' })).toBeInTheDocument();
  });

  it('routes surfaces and the full workspace through explicit callbacks', () => {
    const onNavigate = vi.fn();
    const onOpenFullWorkspace = vi.fn();
    render(
      <DirectorWorkspace
        project={trollProject}
        roles={trollProject.roles}
        candidates={trollProject.candidates}
        schedules={trollProject.schedules}
        onNavigate={onNavigate}
        onOpenFullWorkspace={onOpenFullWorkspace}
      />,
    );

    fireEvent.click(screen.getByTestId('director-surface-visual-plan'));
    fireEvent.click(screen.getByTestId('director-open-full-workspace'));

    expect(onNavigate).toHaveBeenCalledWith('visual-plan');
    expect(onOpenFullWorkspace).toHaveBeenCalledTimes(1);
  });
});
