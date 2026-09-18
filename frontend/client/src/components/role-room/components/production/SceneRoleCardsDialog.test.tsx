// @vitest-environment jsdom

/**
 * Inngangen fra produksjonsdagen til scenebyggeren.
 *
 * Det som testes er de tre tilstandene dagen faktisk har: ingen scener
 * (rollekort er et steg for tidlig), én scene (valget er et ekstra klikk),
 * og flere scener (da trengs valget).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SceneRoleCardsDialog from './SceneRoleCardsDialog';
import roleCardService from '../../services/roleCardService';

vi.spyOn(roleCardService, 'getBlocking').mockResolvedValue(null);
vi.spyOn(roleCardService, 'list').mockResolvedValue([]);

afterEach(() => vi.clearAllMocks());

const vis = (scenes: Array<{ id: string; title: string }>) =>
  render(
    <SceneRoleCardsDialog
      open
      onClose={() => {}}
      projectId="p1"
      dayLabel="torsdag 1. oktober"
      scenes={scenes}
    />,
  );

describe('SceneRoleCardsDialog', () => {
  it('sier fra når dagen ikke har scener ennå', () => {
    vis([]);
    // Rollekort uten scene er et steg for tidlig — da skal ikke byggeren åpne.
    expect(screen.getByText('Ingen scener på denne dagen ennå')).toBeInTheDocument();
    expect(screen.queryByText(/Scenebygger/)).toBeNull();
  });

  it('hopper over valget når dagen har én scene', async () => {
    vis([{ id: 's1', title: 'Pizzarestauranten, kveld' }]);
    // Et valg med ett alternativ er ikke et valg.
    expect(await screen.findByText(/Scenebygger — Pizzarestauranten, kveld/)).toBeInTheDocument();
    expect(screen.queryByText('Hvilken scene?')).toBeNull();
  });

  it('lar deg velge når dagen har flere scener', async () => {
    vis([
      { id: 's1', title: 'Pizzarestauranten, kveld' },
      { id: 's2', title: 'Gaten utenfor' },
    ]);
    expect(screen.getByText('Hvilken scene?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Gaten utenfor'));
    expect(await screen.findByText(/Scenebygger — Gaten utenfor/)).toBeInTheDocument();
    // Og tilbake, uten å lukke dialogen.
    expect(screen.getByLabelText('Tilbake til scenevalg')).toBeInTheDocument();
  });

  it('sier hva lenken betyr, så avsenderen vet hva hen deler', () => {
    vis([{ id: 's1', title: 'Scene 1' }]);
    expect(screen.getByText(/ser bare sitt eget kort/)).toBeInTheDocument();
  });
});
