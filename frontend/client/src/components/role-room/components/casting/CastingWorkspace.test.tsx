import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CastingWorkspace } from './CastingWorkspace';

describe('CastingWorkspace', () => {
  it('renders the evidence-based overview and routes touch targets through one callback', () => {
    const onNavigate = vi.fn();
    render(
      <CastingWorkspace
        project={{ id: 'project-1', name: 'Troll', roles: [], candidates: [], schedules: [], crew: [], locations: [], props: [] }}
        roles={[{ id: 'role-1', name: 'NORA', status: 'casting' }]}
        candidates={[{ id: 'candidate-1', name: 'Ada', status: 'shortlist' }]}
        schedules={[]}
        onNavigate={onNavigate}
        onOpenFullWorkspace={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Troll' })).toBeInTheDocument();
    expect(screen.getByText('1 registrerte roller')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('casting-target-roles'));
    expect(onNavigate).toHaveBeenCalledWith('roles');
  });
});
