// @vitest-environment jsdom
// Fanen skal tegne alle states, ikke bare den som virker.
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccessMatrixTab } from './AccessMatrixTab';

const payload = {
  grants: [
    { grant: 'canManageProduction', label: 'Dagskontroll', roles: ['producer'], permissionKeys: ['canManageProduction'] },
    { grant: 'canManageContinuity', label: 'Kontinuitet', roles: ['script_supervisor'], permissionKeys: ['canManageContinuity', 'canComment'] },
  ],
  roles: ['producer', 'script_supervisor'],
  matrix: [
    { role: 'producer', grants: { canManageProduction: true, canManageContinuity: false } },
    { role: 'script_supervisor', grants: { canManageProduction: false, canManageContinuity: true } },
  ],
};

const mockFetch = (impl: () => unknown) => vi.stubGlobal('fetch', vi.fn(impl));

afterEach(() => vi.unstubAllGlobals());

describe('AccessMatrixTab', () => {
  it('renders a row per role with the grants the server reported', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => payload }));

    render(<AccessMatrixTab />);

    // Rollenavnet står i første kolonne, og linsen i den andre. Siden
    // producer-linsen kom til (#2433) heter de to det samme for enkelte
    // roller, så et fritt tekstsøk treffer begge. Vi spør om rollekolonnen.
    const roleColumn = async (): Promise<string[]> => {
      const rows = await screen.findAllByRole('row');
      return rows
        .map((row) => within(row).queryAllByRole('cell')[0]?.textContent ?? '')
        .filter(Boolean);
    };

    await waitFor(async () => expect(await roleColumn()).toContain('producer'));
    expect(await roleColumn()).toContain('script_supervisor');
    expect(screen.getByText('Dagskontroll')).toBeInTheDocument();
  });

  it('shows the explicit permission keys instead of hiding them in code', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => payload }));

    render(<AccessMatrixTab />);

    await waitFor(() => expect(screen.getByText('canComment')).toBeInTheDocument());
  });

  it('explains a refused session rather than rendering an empty table', async () => {
    mockFetch(async () => ({ ok: false, status: 403, json: async () => ({}) }));

    render(<AccessMatrixTab />);

    await waitFor(() => expect(screen.getByText(/Krever produkteier-sesjon/)).toBeInTheDocument());
    expect(screen.getByText('Prøv igjen')).toBeInTheDocument();
  });

  it('offers a retry when the network fails', async () => {
    mockFetch(async () => { throw new Error('offline'); });

    render(<AccessMatrixTab />);

    await waitFor(() => expect(screen.getByText('Prøv igjen')).toBeInTheDocument());
  });

  it('says an empty table means no grants, not open access', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ grants: [], roles: [], matrix: [] }) }));

    render(<AccessMatrixTab />);

    await waitFor(() => expect(screen.getByText(/ikke at tilgangen er åpen/)).toBeInTheDocument());
  });
});
