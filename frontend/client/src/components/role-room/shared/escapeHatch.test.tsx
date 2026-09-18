// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chip } from '@mui/material';
import RoleRoomUXLayer from './RoleRoomUXLayer';

/**
 * Veien ut av en flate er ikke en pynt-detalj — den er forskjellen på at en
 * bruker kan bytte app og at hun må logge ut for å komme seg videre.
 * `surfaceContract.test.ts` sjekker at velgeren står i filen. Denne sjekker at
 * den faktisk rendres, i alle oppsettene skallet kan monteres med. Den
 * statiske sjekken var grønn hele tiden mens velgeren lå bak `mode ||
 * customHeader`.
 */
describe('vei ut av produksjonsskallet', () => {
  beforeEach(() => {
    // SurfaceSwitcher spør serveren om sesjonen for å avgjøre om Admin Room
    // skal vises. Et vanlig, ikke-produkteier-svar holder her.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ user: { email: 'produsent@example.test' } }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const escapeHatch = () => screen.queryByRole('button', { name: 'Bytt flate' });

  it('viser flatevelgeren i en workspace med profesjonsmodus', () => {
    render(
      <RoleRoomUXLayer workspaceId="casting-planner-v1" mode="film">
        <div>innhold</div>
      </RoleRoomUXLayer>,
    );
    expect(escapeHatch()).toBeInTheDocument();
  });

  it('viser den også i en workspace uten modus', () => {
    // Toppraden lå bak `mode || customHeader`. En portal uten modus fikk
    // dermed ingen topprad, og ingen vei ut.
    render(
      <RoleRoomUXLayer workspaceId="talent-portal-v1">
        <div>innhold</div>
      </RoleRoomUXLayer>,
    );
    expect(escapeHatch()).toBeInTheDocument();
  });

  it('beholder den når flaten har sin egen header', () => {
    // `customHeader` erstattet tidligere hele venstresiden, flatevelgeren
    // inkludert. Nå står den egne headeren ved siden av, ikke i stedet for.
    render(
      <RoleRoomUXLayer
        workspaceId="agency-portal-v1"
        customHeader={<Chip label="Agentur" />}
      >
        <div>innhold</div>
      </RoleRoomUXLayer>,
    );
    expect(escapeHatch()).toBeInTheDocument();
    expect(screen.getByText('Agentur')).toBeInTheDocument();
  });

  it('rendrer innholdet uansett', () => {
    render(
      <RoleRoomUXLayer workspaceId="casting-planner-v1" mode="film">
        <div>innhold</div>
      </RoleRoomUXLayer>,
    );
    expect(screen.getByText('innhold')).toBeInTheDocument();
  });
});
