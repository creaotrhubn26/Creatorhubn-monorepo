// @vitest-environment jsdom

/**
 * Rollekortet slik statisten møter det.
 *
 * Det som testes er løftet siden gir: at handlingen står der, at kortet
 * IKKE viser andre enn deg, og at de to tilstandene som faktisk oppstår på
 * et sett — død lenke og manglende plantegning — sier noe brukbart i
 * stedet for å vise en tom ramme.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RoleCardPage, { isRoleCardPath } from './RoleCardPage';

const KORT = {
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
    svar({ ...KORT, scene: { ...KORT.scene, blocking: null } });
    render(<RoleCardPage />);
    // Vanlig første døgn. En tom ramme ville sett ut som en feil.
    expect(await screen.findByText(/ikke klar ennå/)).toBeInTheDocument();
    expect(screen.queryByAltText('Plantegning')).toBeNull();
  });

  it('sier hvem du skal spørre når lenken er død', async () => {
    svar({ error: 'Lenken gjelder ikke lenger' }, false);
    render(<RoleCardPage />);
    expect(await screen.findByText('Lenken gjelder ikke lenger')).toBeInTheDocument();
    // Personen står kanskje på settet. Da hjelper det ikke å forklare hvorfor.
    expect(screen.getByText(/innspillingslederen/i)).toBeInTheDocument();
  });

  it('sier eksplisitt at kortet bare gjelder deg', async () => {
    svar(KORT);
    render(<RoleCardPage />);
    await waitFor(() => expect(screen.getByText(/gjelder bare deg/)).toBeInTheDocument());
  });
});
