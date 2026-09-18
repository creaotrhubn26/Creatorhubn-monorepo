// @vitest-environment jsdom

/**
 * Scenebyggeren.
 *
 * Testene dekker det som skiller denne flaten fra et skjema: at du PEKER
 * der personen står og at punktet lagres normalisert, at et kort ikke kan
 * lages uten handling, og at tomtilstandene sier hva som mangler i stedet
 * for å vise en tom ramme.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SceneBlockingEditor from './SceneBlockingEditor';
import roleCardService from '../../services/roleCardService';

const PLAN = 'https://eksempel.test/plan.png';

const kort = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'kort-1', project_id: 'p1', scene_id: 's1', person_name: 'Statist 3', person_kind: 'extra',
  action: 'Du sitter ved bord 3.', cue: null, position: { x: 0.4, y: 0.6 }, wardrobe: null,
  frame_image_url: null, call_time: null, sort_order: 0, token: 'token-abc', revoked_at: null, ...over,
});

describe('uten plantegning', () => {
  beforeEach(() => {
    vi.spyOn(roleCardService, 'getBlocking').mockResolvedValue(null);
    vi.spyOn(roleCardService, 'list').mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('ber om plantegningen i stedet for å vise en tom flate', async () => {
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    expect(await screen.findByText('Legg inn plantegningen først')).toBeInTheDocument();
    // Uten bilde er det ingenting å peke på — da skal ikke lerretet finnes.
    expect(screen.queryByTestId('plantegning')).toBeNull();
  });

  it('lagrer plantegningen når adressen fylles ut', async () => {
    const lagre = vi.spyOn(roleCardService, 'saveBlocking').mockResolvedValue({ planUrl: PLAN, camera: null });
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);

    fireEvent.change(await screen.findByLabelText('Adresse til bildet'), { target: { value: PLAN } });
    fireEvent.click(screen.getByRole('button', { name: 'Legg inn' }));

    await waitFor(() => expect(lagre).toHaveBeenCalledWith('p1', 's1', expect.objectContaining({ planUrl: PLAN })));
  });
});

describe('med plantegning', () => {
  beforeEach(() => {
    vi.spyOn(roleCardService, 'getBlocking').mockResolvedValue({ planUrl: PLAN, camera: null });
    vi.spyOn(roleCardService, 'list').mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('sier hvor du skal klikke, og for hvilken modus', async () => {
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    expect(await screen.findByText(/Klikk i planen der personen står/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Plasser kamera/ }));
    expect(screen.getByText(/Klikk i planen der kameraet står/)).toBeInTheDocument();
  });

  it('åpner skjemaet der du pekte, ikke før', async () => {
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    const plan = await screen.findByTestId('plantegning');

    expect(screen.queryByLabelText('Dette gjør du')).toBeNull();
    fireEvent.click(plan, { clientX: 50, clientY: 50 });
    // Først peker du, så skriver du — motsatt rekkefølge ville tvunget deg
    // til å huske hvor du skulle peke mens du fylte ut.
    expect(await screen.findByLabelText('Navn')).toBeInTheDocument();
  });

  it('lager ikke kort uten handling', async () => {
    const lag = vi.spyOn(roleCardService, 'create');
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    fireEvent.click(await screen.findByTestId('plantegning'), { clientX: 10, clientY: 10 });

    fireEvent.change(await screen.findByLabelText('Navn'), { target: { value: 'Statist 3' } });
    const knapp = screen.getByRole('button', { name: /Lag kort/ });
    expect(knapp).toBeDisabled();
    expect(lag).not.toHaveBeenCalled();
  });

  it('lagrer posisjonen normalisert, så planen kan byttes', async () => {
    const lag = vi.spyOn(roleCardService, 'create').mockResolvedValue(kort() as never);
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    const plan = await screen.findByTestId('plantegning');
    // jsdom gir null-størrelse på elementer; vi styrer rammen selv.
    vi.spyOn(plan, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);

    fireEvent.click(plan, { clientX: 100, clientY: 25 });
    fireEvent.change(await screen.findByLabelText('Navn'), { target: { value: 'Statist 3' } });
    fireEvent.change(screen.getByLabelText('Dette gjør du'), { target: { value: 'Reis deg når døren går.' } });
    fireEvent.click(screen.getByRole('button', { name: /Lag kort/ }));

    await waitFor(() => expect(lag).toHaveBeenCalledWith('p1', expect.objectContaining({
      position: { x: 0.5, y: 0.25 },
      action: 'Reis deg når døren går.',
    })));
  });

  it('viser lenken først når kortet finnes', async () => {
    vi.spyOn(roleCardService, 'list').mockResolvedValue([kort() as never]);
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    // En lenke som ikke virker ennå er verre enn ingen lenke — den blir sendt.
    expect(await screen.findByRole('button', { name: 'Kopier lenken' })).toBeInTheDocument();
  });

  it('markerer kort som ikke er plassert i planen', async () => {
    vi.spyOn(roleCardService, 'list').mockResolvedValue([kort({ position: null }) as never]);
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    expect(await screen.findByText('Ikke plassert i planen ennå.')).toBeInTheDocument();
  });
});
