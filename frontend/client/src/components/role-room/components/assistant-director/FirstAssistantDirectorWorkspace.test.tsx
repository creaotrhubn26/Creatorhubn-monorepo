import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CastingProject } from '../../models/casting';
import { FirstAssistantDirectorWorkspace } from './FirstAssistantDirectorWorkspace';

const trollProject: CastingProject = {
  id: 'troll-project',
  name: 'Troll',
  roles: [],
  candidates: [],
  schedules: [],
  locations: [],
  props: [],
  crew: [],
  sceneBreakdowns: [{ id: 'scene-1', sceneNumber: 1 }],
};

describe('FirstAssistantDirectorWorkspace', () => {
  it('renders the six 1st AD surfaces and factual source status', () => {
    render(
      <FirstAssistantDirectorWorkspace
        project={trollProject}
        onNavigate={() => {}}
        onOpenFullWorkspace={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Troll' })).toBeInTheDocument();
    expect(screen.getByText('1ST AD · INNSPILLINGSLEDELSE')).toBeInTheDocument();
    expect(screen.getByText('Kun registrerte data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I dag' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Stripboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Callsheet' })).toBeInTheDocument();
    expect(screen.getByText('1 scene er ikke planlagt')).toBeInTheDocument();
  });

  it('routes role surfaces and the full project through explicit callbacks', () => {
    const onNavigate = vi.fn();
    const onOpenFullWorkspace = vi.fn();
    render(
      <FirstAssistantDirectorWorkspace
        project={trollProject}
        onNavigate={onNavigate}
        onOpenFullWorkspace={onOpenFullWorkspace}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Opptaksplan' }));
    expect(onNavigate).toHaveBeenCalledWith('shooting-plan');

    fireEvent.click(screen.getByTestId('first-ad-open-full-workspace'));
    expect(onOpenFullWorkspace).toHaveBeenCalledTimes(1);
  });

  it('disables surfaces removed by project access', () => {
    const onNavigate = vi.fn();
    render(
      <FirstAssistantDirectorWorkspace
        project={trollProject}
        onNavigate={onNavigate}
        onOpenFullWorkspace={() => {}}
        isSurfaceAvailable={(surface) => surface !== 'call-sheet'}
      />,
    );

    const callSheet = screen.getByTestId('first-ad-surface-call-sheet');
    expect(callSheet).toBeDisabled();
    fireEvent.click(callSheet);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
