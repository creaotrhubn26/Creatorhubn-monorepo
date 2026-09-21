// @vitest-environment jsdom

/**
 * «Dine rollekort» på talentets forside.
 *
 * Det som testes er tilstandene som faktisk oppstår: ingen kort (det vanlige,
 * fordi de fleste kort går til folk uten konto), og kort med tid og sted.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MineRollekort from './MineRollekort';

const svar = (kort: unknown[]) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ kort }),
  } as Response);

const kort = (over: Record<string, unknown> = {}) => ({
  id: 'k1', token: 'token-abc', person_name: 'Kari',
  action: 'Du sitter ved bord 3.', cue: null, call_time: '2026-10-01T07:30:00Z',
  response: null, scene_title: 'Pizzarestauranten', int_ext: 'INT',
  project_name: 'Pizza – kampanje', day_date: '2026-10-01',
  location_name: 'Pizzeria Roma', location_address: 'Storgata 1', ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('MineRollekort', () => {
  it('tegner ingenting når du ikke har kort', async () => {
    svar([]);
    const { container } = render(<MineRollekort />);
    // En tom ramme ville sett ut som at noe mangler. De fleste kort går til
    // folk uten konto, og det er ikke en feil.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('viser produksjon, handling, tid og sted', async () => {
    svar([kort()]);
    render(<MineRollekort />);
    expect(await screen.findByText('Pizza – kampanje')).toBeInTheDocument();
    expect(screen.getByText(/bord 3/)).toBeInTheDocument();
    expect(screen.getByText(/Oppmøte/)).toBeInTheDocument();
    expect(screen.getByText('Pizzeria Roma')).toBeInTheDocument();
  });

  it('lenker til selve kortet, som er bygget for settet', async () => {
    svar([kort()]);
    render(<MineRollekort />);
    const lenke = await screen.findByRole('link', { name: 'Åpne kortet' });
    expect(lenke).toHaveAttribute('href', '/statist/token-abc');
  });

  it('minner deg på hva du har svart', async () => {
    svar([kort({ response: 'kommer' })]);
    render(<MineRollekort />);
    // Lett å glemme, og svaret kan endres inne på kortet.
    expect(await screen.findByText(/du kommer/i)).toBeInTheDocument();
  });
});
