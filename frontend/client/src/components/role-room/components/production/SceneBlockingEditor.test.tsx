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
    vi.spyOn(roleCardService, 'listFrames').mockResolvedValue([]);
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
    vi.spyOn(roleCardService, 'listFrames').mockResolvedValue([]);
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

describe('storyboard-ramme på et kort', () => {
  beforeEach(() => {
    vi.spyOn(roleCardService, 'getBlocking').mockResolvedValue({ planUrl: PLAN, camera: null });
    vi.spyOn(roleCardService, 'list').mockResolvedValue([kort() as never]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('sier fra når scenen ikke har rammer ennå', async () => {
    vi.spyOn(roleCardService, 'listFrames').mockResolvedValue([]);
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);

    fireEvent.click(await screen.findByLabelText('Velg ramme for Statist 3'));
    // En tom meny ser ut som en feil.
    expect(await screen.findByText('Ingen storyboard-rammer i denne scenen ennå.')).toBeInTheDocument();
  });

  it('henter bildet FØRST når rammen velges', async () => {
    vi.spyOn(roleCardService, 'listFrames').mockResolvedValue([
      { id: 'ramme-1', frameId: 'f1', title: 'Bord 3, vidt', hasImage: true, updatedAt: '' },
    ]);
    const bilde = vi.spyOn(roleCardService, 'frameImage').mockResolvedValue('data:image/png;base64,AAAA');
    const oppdater = vi.spyOn(roleCardService, 'update').mockResolvedValue(kort({ frame_image_url: 'data:image/png;base64,AAAA' }) as never);

    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    fireEvent.click(await screen.findByLabelText('Velg ramme for Statist 3'));
    // Listen er tegnet uten å hente noe bilde.
    expect(bilde).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: /Bord 3, vidt/ }));
    await waitFor(() => expect(bilde).toHaveBeenCalledWith('p1', 'ramme-1'));
    await waitFor(() => expect(oppdater).toHaveBeenCalledWith('p1', 'kort-1', { frame_image_url: 'data:image/png;base64,AAAA' }));
  });

  it('lar deg ikke velge en ramme som ikke er tegnet', async () => {
    vi.spyOn(roleCardService, 'listFrames').mockResolvedValue([
      { id: 'ramme-2', frameId: 'f2', title: 'Nærbilde', hasImage: false, updatedAt: '' },
    ]);
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    fireEvent.click(await screen.findByLabelText('Velg ramme for Statist 3'));

    const knapp = await screen.findByRole('button', { name: /Nærbilde/ });
    expect(knapp).toBeDisabled();
    expect(knapp).toHaveTextContent('ikke tegnet ennå');
  });
});

describe('sende lenkene', () => {
  beforeEach(() => {
    vi.spyOn(roleCardService, 'getBlocking').mockResolvedValue({ planUrl: PLAN, camera: null });
    vi.spyOn(roleCardService, 'list').mockResolvedValue([kort() as never]);
    vi.spyOn(roleCardService, 'listFrames').mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('sier hvor mange som IKKE fikk lenken', async () => {
    vi.spyOn(roleCardService, 'send').mockResolvedValue({
      sent: 4,
      sentIds: [],
      skipped: [
        { id: 'a', grunn: 'mangler_epost' },
        { id: 'b', grunn: 'mangler_epost' },
        { id: 'c', grunn: 'alt_sendt' },
      ],
    });
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Send lenkene/ }));

    // Uten dette tror avsenderen at alle fikk beskjed.
    expect(await screen.findByText(/4 sendt · 1 hadde fått den før · 2 mangler e-post/)).toBeInTheDocument();
  });

  it('kan sende på nytt bevisst, ikke ved et uhell', async () => {
    const send = vi.spyOn(roleCardService, 'send').mockResolvedValue({ sent: 1, sentIds: [], skipped: [] });
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Send lenkene/ }));
    await screen.findByText(/1 sendt/);

    expect(send).toHaveBeenCalledWith('p1', 's1', false);
    fireEvent.click(screen.getByRole('button', { name: 'Send på nytt til alle' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith('p1', 's1', true));
  });

  it('kan ikke sende når det ikke finnes kort', async () => {
    vi.spyOn(roleCardService, 'list').mockResolvedValue([]);
    render(<SceneBlockingEditor projectId="p1" sceneId="s1" />);
    expect(await screen.findByRole('button', { name: /Send lenkene/ })).toBeDisabled();
  });
});
