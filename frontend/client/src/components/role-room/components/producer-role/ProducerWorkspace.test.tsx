import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CastingProject } from '../../models/casting';
import { ProducerWorkspace } from './ProducerWorkspace';

const project = {
  id: 'project-1',
  name: 'Troll',
  roles: [],
  candidates: [],
  schedules: [],
  crew: [],
  locations: [],
  props: [],
} as CastingProject;

describe('ProducerWorkspace', () => {
  it('hides economy without an economy grant', () => {
    render(
      <ProducerWorkspace
        project={project}
        canViewEconomy={false}
        onNavigate={() => {}}
        onOpenFullWorkspace={() => {}}
      />,
    );

    expect(screen.queryByTestId('producer-target-economy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('producer-action-economy')).not.toBeInTheDocument();
  });

  it('exposes economy to authorized producers and routes the action', () => {
    const onNavigate = vi.fn();
    render(
      <ProducerWorkspace
        project={project}
        canViewEconomy
        onNavigate={onNavigate}
        onOpenFullWorkspace={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId('producer-target-economy'));
    expect(onNavigate).toHaveBeenCalledWith('economy');
  });
});
