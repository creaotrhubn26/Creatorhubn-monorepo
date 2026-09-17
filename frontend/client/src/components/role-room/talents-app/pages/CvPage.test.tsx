/**
 * CV-siden — det som kan miste data.
 *
 * Sletting fjerner raden med én gang og utsetter kallet til serveren i seks
 * sekunder. Det er den mekanismen som gjør «Angre» ekte, og den har tre
 * utfall som må holde: angret sletting skal aldri nå serveren, uangret
 * sletting skal nå den, og forlater du siden i mellomtiden skal den fortsatt
 * skje. De to siste er lette å ødelegge uten at noen merker det før en rad
 * dukker opp igjen.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CvPage from './CvPage';
import roleRoomTalentsService, { type TalentCredit } from '../../services/roleRoomTalentsService';

const CREDIT: TalentCredit = {
  id: 'credit-1',
  talent_id: 'talent-1',
  category: 'theatre',
  title: 'Et dukkehjem',
  role_name: 'Nora',
  role_type: 'lead',
  production_company: 'Nationaltheatret',
  production_org_number: null,
  director: 'Eirik Stubø',
  format: null,
  year: 2023,
  sort_order: 1,
  notes: null,
  external_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as unknown as TalentCredit;

const ANDRE: TalentCredit = { ...CREDIT, id: 'credit-2', title: 'Hedda Gabler', sort_order: 2 };

describe('CvPage — sletting og angring', () => {
  let deleteCredit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(roleRoomTalentsService, 'fetchMyCredits').mockResolvedValue([CREDIT, ANDRE]);
    vi.spyOn(roleRoomTalentsService, 'fetchMyTalent').mockResolvedValue(null);
    deleteCredit = vi
      .spyOn(roleRoomTalentsService, 'deleteCredit')
      .mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('venter med å slette, slik at angring faktisk angrer', async () => {
    render(<CvPage demoMode={false} />);

    await screen.findByText('Et dukkehjem');
    fireEvent.click(screen.getByLabelText('Slett Et dukkehjem'));

    // Raden er borte fra skjermen med én gang …
    expect(screen.queryByText('Et dukkehjem')).toBeNull();
    // … men ingenting er sendt til serveren ennå.
    expect(deleteCredit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Angre' }));
    act(() => { vi.advanceTimersByTime(10_000); });

    await screen.findByText('Et dukkehjem');
    expect(deleteCredit).not.toHaveBeenCalled();
  });

  it('sletter for alvor når ingen angrer', async () => {
    render(<CvPage demoMode={false} />);

    await screen.findByText('Et dukkehjem');
    fireEvent.click(screen.getByLabelText('Slett Et dukkehjem'));

    act(() => { vi.advanceTimersByTime(6_100); });

    await waitFor(() => expect(deleteCredit).toHaveBeenCalledWith('credit-1'));
  });

  it('sender den utsatte slettingen når siden forlates', async () => {
    const view = render(<CvPage demoMode={false} />);

    await screen.findByText('Et dukkehjem');
    fireEvent.click(screen.getByLabelText('Slett Et dukkehjem'));
    expect(deleteCredit).not.toHaveBeenCalled();

    // Uten dette ville raden kommet tilbake ved neste besøk, uten at noen
    // ba om det.
    view.unmount();

    await waitFor(() => expect(deleteCredit).toHaveBeenCalledWith('credit-1'));
  });
});
