// @vitest-environment jsdom
// Hver state komponenten kan være i, inkludert de to som pleier å bli glemt:
// lesningen som feiler, og datoen som ikke er endret.
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChangeImpactPreview } from './ChangeImpactPreview';

const base = {
  projectId: 'project-1',
  dayId: 'day-6',
  currentDate: '2026-09-20',
  targetDate: '2026-09-24',
};

const respondWith = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })));

afterEach(() => vi.unstubAllGlobals());

describe('ChangeImpactPreview', () => {
  it('asks nothing while the date is unchanged', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<ChangeImpactPreview {...base} targetDate="2026-09-20" />);

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks nothing for a half-typed date', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ChangeImpactPreview {...base} targetDate="2026-09" />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says plainly when nothing else hangs on the day', async () => {
    respondWith({ from: '2026-09-20', to: '2026-09-24', impacts: [], blocking: false, unchanged: false });

    render(<ChangeImpactPreview {...base} />);

    await waitFor(() => expect(screen.getByText(/Ingenting annet henger/)).toBeInTheDocument());
  });

  it('lists findings with their action', async () => {
    respondWith({
      from: '2026-09-20',
      to: '2026-09-24',
      blocking: true,
      unchanged: false,
      impacts: [
        { area: 'call_sheet', severity: 'blocking', summary: 'Call sheet er publisert med 2026-09-20.', action: 'Må republiseres etter flyttingen.', count: 1 },
        { area: 'continuity', severity: 'info', summary: '4 kontinuitetsfiler følger dagen.', count: 4 },
      ],
    });

    render(<ChangeImpactPreview {...base} />);

    await waitFor(() => expect(screen.getByText(/Call sheet er publisert/)).toBeInTheDocument());
    expect(screen.getByText('Må republiseres etter flyttingen.')).toBeInTheDocument();
    expect(screen.getByText(/4 kontinuitetsfiler/)).toBeInTheDocument();
    expect(screen.getByText(/Lagring er stengt/)).toBeInTheDocument();
  });

  it('reports blocking upwards so the dialog can close saving', async () => {
    respondWith({
      from: '2026-09-20', to: '2026-09-24', unchanged: false, blocking: true,
      impacts: [{ area: 'call_sheet', severity: 'blocking', summary: 'x', count: 1 }],
    });
    const onBlockingChange = vi.fn();

    render(<ChangeImpactPreview {...base} onBlockingChange={onBlockingChange} />);

    await waitFor(() => expect(onBlockingChange).toHaveBeenCalledWith(true));
  });

  it('treats a failed read as blocking rather than as no impact', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const onBlockingChange = vi.fn();

    render(<ChangeImpactPreview {...base} onBlockingChange={onBlockingChange} />);

    await waitFor(() => expect(screen.getByText(/Kunne ikke sjekke/)).toBeInTheDocument());
    expect(screen.getByText(/Lagring er stengt til vi vet konsekvensen/)).toBeInTheDocument();
    expect(onBlockingChange).toHaveBeenCalledWith(true);
  });

  it('releases the block when the move turns out to be clean', async () => {
    respondWith({ from: '2026-09-20', to: '2026-09-24', impacts: [], blocking: false, unchanged: false });
    const onBlockingChange = vi.fn();

    render(<ChangeImpactPreview {...base} onBlockingChange={onBlockingChange} />);

    await waitFor(() => expect(onBlockingChange).toHaveBeenLastCalledWith(false));
  });

  it('stays quiet for a day that has not been saved yet', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ChangeImpactPreview {...base} dayId={null} currentDate={null} />);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
