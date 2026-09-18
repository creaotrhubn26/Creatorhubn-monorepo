// @vitest-environment jsdom

/**
 * Rollekortet slik statisten møter det.
 *
 * Det som testes er løftet siden gir: at handlingen står der, at kortet
 * IKKE viser andre enn deg, og at de to tilstandene som faktisk oppstår på
 * et sett — død lenke og manglende plantegning — sier noe brukbart i
 * stedet for å vise en tom ramme.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoleCardPage, { isRoleCardPath } from './RoleCardPage';

const DEL = {
  card: {
    person_name: 'Statist 3',
    person_kind: 'extra',
    action: 'Du sitter ved bord 3 med en venn. Når servitøren går forbi, ser du opp og smiler — ikke mot kamera.',
    cue: 'Etter at hovedrollen tar første bit.',
    position: { x: 0.42, y: 0.61 },
    wardrobe: 'Egne klær, mørke farger',
    frame_image_url: 'https://eksempel.test/ramme.jpg',
    call_time: '2026-10-01T07:30:00Z',
  },
  scene: {
    title: 'Pizzarestauranten, kveld',
    setting: 'Restaurant',
    time_of_day: 'NIGHT',
    int_ext: 'INT',
    blocking: { planUrl: 'https://eksempel.test/plan.png', camera: { x: 0.9, y: 0.5 } },
  },
};

const ANDRE_DEL = {
  card: {
    ...DEL.card,
    action: 'Du går forbi i bakgrunnen med en kaffekopp.',
    cue: null,
    call_time: '2026-10-01T11:00:00Z',
  },
  scene: { ...DEL.scene, title: 'Gaten utenfor', int_ext: 'EXT' },
};

const KORT = {
  person: { name: 'Statist 3', kind: 'extra' },
  response: null,
  cards: [DEL],
  meeting: {
    name: 'Pizzeria Roma',
    address: 'Storgata 1, Oslo',
    access_notes: 'Inngang gjennom bakgården.',
    date: '2026-10-01',
  },
  project: { name: 'Pizza – kampanje' },
};

const settSti = (sti: string) => {
  window.history.replaceState({}, '', sti);
};

const svar = (data: unknown, ok = true) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    json: async () => data,
  } as Response);

describe('sti-gjenkjenning', () => {
  afterEach(() => settSti('/'));

  it('kjenner igjen /statist/<token>', () => {
    settSti('/statist/abc123def456ghi');
    expect(isRoleCardPath()).toBe(true);
  });

  it('tar ikke andre stier', () => {
    settSti('/talents');
    expect(isRoleCardPath()).toBe(false);
    settSti('/statist/kort');
    expect(isRoleCardPath()).toBe(false);
  });
});

describe('kortet', () => {
  beforeEach(() => settSti('/statist/abc123def456ghi'));
  afterEach(() => { vi.restoreAllMocks(); settSti('/'); });

  it('viser handlingen, signalet og hvem du er', async () => {
    svar(KORT);
    render(<RoleCardPage />);

    expect(await screen.findByText(/Du sitter ved bord 3/)).toBeInTheDocument();
    expect(screen.getByText('Etter at hovedrollen tar første bit.')).toBeInTheDocument();
    expect(screen.getByText('Statist 3')).toBeInTheDocument();
    expect(screen.getByAltText('Plantegning')).toBeInTheDocument();
  });

  it('markerer DEG på plantegningen', async () => {
    svar(KORT);
    render(<RoleCardPage />);
    expect(await screen.findByText('DU')).toBeInTheDocument();
    // Kameraet er med fordi «fram» ellers er udefinert for den som står der.
    expect(screen.getByText('KAMERA')).toBeInTheDocument();
  });

  it('sier fra når plantegningen ikke er laget ennå', async () => {
    svar({ ...KORT, cards: [{ ...DEL, scene: { ...DEL.scene, blocking: null } }] });
    render(<RoleCardPage />);
    // Vanlig første døgn. En tom ramme ville sett ut som en feil.
    expect(await screen.findByText(/ikke klar ennå/)).toBeInTheDocument();
    expect(screen.queryByAltText('Plantegning')).toBeNull();
  });

  it('sier hvor du skal møte, ikke bare når', async () => {
    svar(KORT);
    render(<RoleCardPage />);
    // Klokkeslett uten adresse er den halvdelen som får folk til å stå feil
    // sted til rett tid.
    expect(await screen.findByText('Pizzeria Roma')).toBeInTheDocument();
    expect(screen.getByText('Storgata 1, Oslo')).toBeInTheDocument();
    expect(screen.getByText('Inngang gjennom bakgården.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vis i kart' })).toHaveAttribute(
      'href',
      expect.stringContaining('Storgata%201%2C%20Oslo'),
    );
  });

  it('viser ingen sted-boks når dagen mangler sted', async () => {
    svar({ ...KORT, meeting: null });
    render(<RoleCardPage />);
    await screen.findByText(/bord 3/);
    // En tom boks med overskriften «Sted» ser ut som noe som ikke lastet.
    expect(screen.queryByText('Sted')).toBeNull();
  });

  it('lar deg svare at du kommer, og sier at det er lagret', async () => {
    const hent = svar(KORT);
    render(<RoleCardPage />);
    await screen.findByText(/bord 3/);

    hent.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ svar: 'kommer', tidspunkt: '2026-10-01T12:00:00Z', melding: null }),
    } as Response);
    fireEvent.click(screen.getByRole('button', { name: 'Jeg kommer' }));

    // Uten kvittering trykker folk en gang til for å være sikre.
    expect(await screen.findByText(/produksjonen vet at du kommer/i)).toBeInTheDocument();
    expect(hent).toHaveBeenLastCalledWith(
      expect.stringContaining('/svar'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('spør om grunn først når svaret er «kan ikke»', async () => {
    const hent = svar(KORT);
    render(<RoleCardPage />);
    await screen.findByText(/bord 3/);
    // Før valget er feltet bare noe å lure på.
    expect(screen.queryByLabelText(/Vil du si hvorfor/)).toBeNull();

    hent.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ svar: 'kan_ikke', tidspunkt: '2026-10-01T12:00:00Z', melding: null }),
    } as Response);
    fireEvent.click(screen.getByRole('button', { name: 'Jeg kan ikke' }));

    expect(await screen.findByLabelText(/Vil du si hvorfor/)).toBeInTheDocument();
  });

  it('lar deg lagre beskjeden uten å måtte klikke utenfor feltet', async () => {
    const hent = svar(KORT);
    render(<RoleCardPage />);
    await screen.findByText(/bord 3/);

    hent.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ svar: 'kan_ikke', tidspunkt: '2026-10-01T12:00:00Z', melding: null }),
    } as Response);
    fireEvent.click(screen.getByRole('button', { name: 'Jeg kan ikke' }));
    const felt = await screen.findByLabelText(/Vil du si hvorfor/);

    fireEvent.change(felt, { target: { value: 'Er syk' } });
    // På en telefon legger folk fra seg mobilen uten å trykke utenfor. Uten en
    // synlig knapp ville teksten forsvunnet uten at noe sa fra.
    const lagre = screen.getByRole('button', { name: 'Lagre beskjeden' });

    hent.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ svar: 'kan_ikke', tidspunkt: '2026-10-01T12:01:00Z', melding: 'Er syk' }),
    } as Response);
    fireEvent.click(lagre);

    expect(await screen.findByText('Beskjeden er lagret.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lagre beskjeden' })).toBeNull();
  });

  it('viser svaret du alt har gitt, i stedet for å spørre på nytt', async () => {
    svar({ ...KORT, response: { svar: 'kommer', tidspunkt: '2026-10-01T12:00:00Z', melding: null } });
    render(<RoleCardPage />);
    expect(await screen.findByText(/Du kan endre svaret/)).toBeInTheDocument();
  });

  it('sier hva som gikk galt og hva du kan gjøre når svaret ikke går gjennom', async () => {
    const hent = svar(KORT);
    render(<RoleCardPage />);
    await screen.findByText(/bord 3/);

    hent.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Klarte ikke å lagre svaret' }) } as Response);
    fireEvent.click(screen.getByRole('button', { name: 'Jeg kommer' }));

    // Personen står kanskje på vei til settet: si hva hen gjør nå.
    expect(await screen.findByText(/si fra til innspillingslederen/)).toBeInTheDocument();
  });

  it('sier hvem du skal spørre når lenken er død', async () => {
    svar({ error: 'Lenken gjelder ikke lenger' }, false);
    render(<RoleCardPage />);
    expect(await screen.findByText('Lenken gjelder ikke lenger')).toBeInTheDocument();
    // Personen står kanskje på settet. Da hjelper det ikke å forklare hvorfor.
    expect(screen.getByText(/innspillingslederen/i)).toBeInTheDocument();
  });

  it('viser alle scenene bak lenken, nummerert og i tidsrekkefølge', async () => {
    svar({ ...KORT, cards: [DEL, ANDRE_DEL] });
    render(<RoleCardPage />);

    // Tre lenker for tre scener var problemet. Én lenke må da vise alle tre.
    expect(await screen.findByText('2 scener denne dagen')).toBeInTheDocument();
    expect(screen.getByText(/bord 3/)).toBeInTheDocument();
    expect(screen.getByText(/kaffekopp/)).toBeInTheDocument();
    expect(screen.getByText(/EXT · Gaten utenfor/)).toBeInTheDocument();
  });

  it('viser stedet én gang, ikke per scene', async () => {
    svar({ ...KORT, cards: [DEL, ANDRE_DEL] });
    render(<RoleCardPage />);
    await screen.findByText('2 scener denne dagen');
    // Stedet hører til dagen. Gjentatt per scene ville lest som flere steder.
    expect(screen.getAllByText('Pizzeria Roma')).toHaveLength(1);
  });

  it('sier eksplisitt at kortet bare gjelder deg', async () => {
    svar(KORT);
    render(<RoleCardPage />);
    await waitFor(() => expect(screen.getByText(/gjelder bare deg/)).toBeInTheDocument());
  });
});
