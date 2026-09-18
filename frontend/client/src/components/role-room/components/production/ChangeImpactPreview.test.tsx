// @vitest-environment jsdom
// Hver state komponenten kan være i, inkludert de to som pleier å bli glemt:
// lesningen som feiler, og datoen som ikke er endret.
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChangeImpactPreview, changeHeadline, emptyImpactText } from './ChangeImpactPreview';

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

  it('says the day moved under us and blocks, rather than overwriting a colleague', async () => {
    // Skjemaet ble åpnet på 2026-09-20, men serveren svarer 2026-09-22.
    respondWith({ from: '2026-09-22', to: '2026-09-24', impacts: [], blocking: false, unchanged: false });
    const onBlockingChange = vi.fn();

    render(<ChangeImpactPreview {...base} onBlockingChange={onBlockingChange} />);

    await waitFor(() => expect(screen.getByText(/flyttet til 2026-09-22 av noen andre/)).toBeInTheDocument());
    expect(onBlockingChange).toHaveBeenCalledWith(true);
  });

  it('does not cry stale when the server agrees with the form', async () => {
    respondWith({ from: '2026-09-20', to: '2026-09-24', impacts: [], blocking: false, unchanged: false });

    render(<ChangeImpactPreview {...base} />);

    await waitFor(() => expect(screen.getByText(/Ingenting annet henger/)).toBeInTheDocument());
    expect(screen.queryByText(/av noen andre/)).toBeNull();
  });

  it('hides the impact list while the form is stale — the old list is about a date that no longer applies', async () => {
    respondWith({
      from: '2026-09-22', to: '2026-09-24', unchanged: false, blocking: true,
      impacts: [{ area: 'call_sheet', severity: 'blocking', summary: 'Call sheet er publisert.', count: 1 }],
    });

    render(<ChangeImpactPreview {...base} />);

    await waitFor(() => expect(screen.getByText(/av noen andre/)).toBeInTheDocument());
    expect(screen.queryByText('Call sheet er publisert.')).toBeNull();
  });

  it('asks about a location change even when the date stays put', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({
        from: '2026-09-20', to: '2026-09-20', impacts: [], blocking: false, unchanged: false,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ChangeImpactPreview
        {...base}
        targetDate="2026-09-20"
        currentLocationId="loc-old"
        targetLocationId="loc-new"
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('locationId=loc-new');
    expect(url).not.toContain('date=');
  });

  it('says nothing hangs on the old location when a location move is clean', async () => {
    respondWith({ from: '2026-09-20', to: '2026-09-20', impacts: [], blocking: false, unchanged: false });

    render(
      <ChangeImpactPreview
        {...base}
        targetDate="2026-09-20"
        currentLocationId="loc-old"
        targetLocationId="loc-new"
      />,
    );

    await waitFor(() => expect(screen.getByText(/gamle lokasjonen/)).toBeInTheDocument());
  });

  it('does not report a stale day for a pure location change', async () => {
    // Serveren svarer med en annen dato enn skjemaet, men datoen er ikke det
    // brukeren endrer — da er ikke skjemaet foreldet på den måten.
    respondWith({ from: '2026-09-22', to: '2026-09-22', impacts: [], blocking: false, unchanged: false });

    render(
      <ChangeImpactPreview
        {...base}
        targetDate="2026-09-20"
        currentLocationId="loc-old"
        targetLocationId="loc-new"
      />,
    );

    await waitFor(() => expect(screen.getByText(/gamle lokasjonen/)).toBeInTheDocument());
    expect(screen.queryByText(/av noen andre/)).toBeNull();
  });

  it('asks once for both when date and location change together', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({
        from: '2026-09-20', to: '2026-09-24', blocking: false, unchanged: false,
        impacts: [{ area: 'location_readiness', severity: 'warning', summary: 'Ingen tillatelse registrert.', count: 0 }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ChangeImpactPreview
        {...base}
        currentLocationId="loc-old"
        targetLocationId="loc-new"
      />,
    );

    await waitFor(() => expect(screen.getByText(/Ny dato og ny lokasjon påvirker/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('date=2026-09-24');
    expect(url).toContain('locationId=loc-new');
  });
});

describe('ChangeImpactPreview ved sceneendring', () => {
  const sceneBase = {
    projectId: 'project-1',
    dayId: 'day-6',
    currentDate: '2026-09-20',
    targetDate: '2026-09-20',
    currentSceneIds: ['scene-1', 'scene-2'],
  };

  it('spør ikke når de samme scenene kommer tilbake i en annen rekkefølge', () => {
    // Rekkefølgen betyr ingenting for hva som brekker.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ChangeImpactPreview {...sceneBase} targetSceneIds={['scene-2', 'scene-1']} />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('spør ikke når scenene ikke redigeres i det hele tatt', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<ChangeImpactPreview {...sceneBase} targetSceneIds={null} />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ber om konsekvensen når en scene fjernes', async () => {
    respondWith({
      from: '2026-09-20',
      to: '2026-09-20',
      fromSceneIds: ['scene-1', 'scene-2'],
      toSceneIds: ['scene-1'],
      impacts: [{
        area: 'scene_cast',
        severity: 'warning',
        summary: '3 roller er knyttet til scenene som fjernes.',
        action: 'Gi beskjed hvis noen ikke lenger skal møte.',
        count: 3,
      }],
      blocking: false,
      unchanged: false,
    });

    render(<ChangeImpactPreview {...sceneBase} targetSceneIds={['scene-1']} />);

    expect(await screen.findByText('3 roller er knyttet til scenene som fjernes.')).toBeInTheDocument();
    const url = String((globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(url).toContain('sceneIds=scene-1');
  });

  it('behandler en tømt sceneliste som en ekte endring', async () => {
    // «Ingen scener igjen» er et valg, ikke et fravær av valg.
    respondWith({
      from: '2026-09-20',
      to: '2026-09-20',
      fromSceneIds: ['scene-1', 'scene-2'],
      toSceneIds: [],
      impacts: [],
      blocking: false,
      unchanged: false,
    });

    render(<ChangeImpactPreview {...sceneBase} targetSceneIds={[]} />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const url = String((globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(url).toContain('sceneIds=');
  });

  it('stenger lagring når en sceneendring blokkerer', async () => {
    respondWith({
      from: '2026-09-20',
      to: '2026-09-20',
      fromSceneIds: ['scene-1', 'scene-2'],
      toSceneIds: ['scene-1'],
      impacts: [{
        area: 'continuity',
        severity: 'blocking',
        summary: '2 kontinuitetsfiler er skutt på scener som fjernes.',
        action: 'Flytt bevisene til dagen scenen faktisk skytes.',
        count: 2,
      }],
      blocking: true,
      unchanged: false,
    });
    const onBlockingChange = vi.fn();

    render(
      <ChangeImpactPreview
        {...sceneBase}
        targetSceneIds={['scene-1']}
        onBlockingChange={onBlockingChange}
      />,
    );

    expect(await screen.findByText('2 kontinuitetsfiler er skutt på scener som fjernes.')).toBeInTheDocument();
    await waitFor(() => expect(onBlockingChange).toHaveBeenCalledWith(true));
  });
});

describe('changeHeadline', () => {
  const base = { dateChanged: false, locationChanged: false, scenesChanged: false, from: '2026-01-27', to: '2026-02-03' };

  it('navngir en datoflytting med begge datoene', () => {
    expect(changeHeadline({ ...base, dateChanged: true }))
      .toBe('Flytting fra 2026-01-27 til 2026-02-03 påvirker:');
  });

  it('navngir en sceneendring som scener, ikke som lokasjon', () => {
    // Overskriften sa «Ny lokasjon påvirker:» over funn om scener. Feil
    // setning over riktige funn er verre enn ingen setning.
    expect(changeHeadline({ ...base, scenesChanged: true })).toBe('Endrede scener påvirker:');
  });

  it('navngir en lokasjonsendring', () => {
    expect(changeHeadline({ ...base, locationChanged: true })).toBe('Ny lokasjon påvirker:');
  });

  it('lister alle tre når alt er endret', () => {
    expect(changeHeadline({ ...base, dateChanged: true, locationChanged: true, scenesChanged: true }))
      .toBe('Ny dato, ny lokasjon og endrede scener påvirker:');
  });
});

describe('emptyImpactText', () => {
  const base = { dateChanged: false, locationChanged: false, scenesChanged: false, from: '2026-01-27', to: '2026-02-03' };

  it('peker på datoen når det er datoen som flyttes', () => {
    expect(emptyImpactText({ ...base, dateChanged: true }))
      .toBe('Ingenting annet henger på 2026-01-27. Endringen berører bare dagen selv.');
  });

  it('peker på scenene når det er scenene som endres', () => {
    expect(emptyImpactText({ ...base, scenesChanged: true }))
      .toBe('Ingenting annet henger på scenene som endres. Endringen berører bare dagen selv.');
  });
});
