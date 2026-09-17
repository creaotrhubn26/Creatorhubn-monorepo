// @vitest-environment jsdom
// Talents, produksjon og utdanning er alle nåbare på URL, men ingenting i
// grensesnittet pekte på dem. En produsent fant aldri Talents; en talent kom
// seg ikke ut av sin egen app uten å logge ut.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SurfaceSwitcher } from './SurfaceSwitcher';

const setLocation = (pathname: string, search = '') => {
  Object.defineProperty(window, 'location', {
    value: { pathname, search, assign: vi.fn() },
    writable: true,
  });
};

const mockGate = (isSuperAdmin: boolean) => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ user: { email: isSuperAdmin ? 'daniel@creatorhubn.com' : 'noen@annen.no' } }),
  })));
};

beforeEach(() => setLocation('/'));
afterEach(() => vi.unstubAllGlobals());

const open = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Bytt flate' }));
  // Menyen, ikke chipen: «Produksjon» står begge steder.
  return within(screen.getByRole('menu'));
};

describe('SurfaceSwitcher', () => {
  it('points a producer at Talents, which was only reachable by URL', async () => {
    mockGate(false);
    render(<SurfaceSwitcher />);

    const menu = open();

    expect(menu.getByText('Talents')).toBeInTheDocument();
    expect(menu.getByText('Produksjon')).toBeInTheDocument();
    expect(menu.getByText('Utdanning')).toBeInTheDocument();
  });

  it('shows where you are instead of leaving you to guess', async () => {
    mockGate(false);
    setLocation('/talents');
    render(<SurfaceSwitcher />);

    const menu = open();

    expect(menu.getByText('du er her')).toBeInTheDocument();
  });

  it('gets a talent back out of the Talents app', async () => {
    mockGate(false);
    setLocation('/talents');
    render(<SurfaceSwitcher />);

    const menu = open();
    fireEvent.click(menu.getByText('Produksjon'));

    expect(window.location.assign).toHaveBeenCalledWith('/');
  });

  it('hides Admin Room from everyone but the product owner', async () => {
    mockGate(false);
    render(<SurfaceSwitcher />);

    const menu = open();

    expect(menu.queryByText('Admin Room')).toBeNull();
  });

  it('offers Admin Room once the server confirms the owner', async () => {
    mockGate(true);
    render(<SurfaceSwitcher />);
    // Vent til serveren har svart før menyen åpnes — porten er asynkron.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const menu = open();

    await waitFor(() => expect(menu.getByText('Admin Room')).toBeInTheDocument());
  });

  it('does nothing when you pick the surface you are already on', async () => {
    mockGate(false);
    render(<SurfaceSwitcher />);

    const menu = open();
    fireEvent.click(menu.getByText('Produksjon'));

    expect(window.location.assign).not.toHaveBeenCalled();
  });
});
