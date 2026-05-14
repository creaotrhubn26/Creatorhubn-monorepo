// @ts-nocheck
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleRoomFeedbackFab } from '../RoleRoomFeedbackFab';

describe('Sprint 6.16 — RoleRoomFeedbackFab', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders the floating button', () => {
    render(<RoleRoomFeedbackFab />);
    expect(screen.getByLabelText('Åpne tilbakemelding')).toBeInTheDocument();
  });

  it('does not render when hidden=true', () => {
    render(<RoleRoomFeedbackFab hidden />);
    expect(screen.queryByLabelText('Åpne tilbakemelding')).toBeNull();
  });

  it('opens dialog when clicked', () => {
    render(<RoleRoomFeedbackFab />);
    fireEvent.click(screen.getByLabelText('Åpne tilbakemelding'));
    expect(screen.getByText('Gi tilbakemelding')).toBeInTheDocument();
    expect(screen.getByLabelText(/Kort tittel/)).toBeInTheDocument();
  });

  it('blocks submit until title and description meet min lengths', async () => {
    render(<RoleRoomFeedbackFab />);
    fireEvent.click(screen.getByLabelText('Åpne tilbakemelding'));

    const submit = screen.getByRole('button', { name: /Send ticket/ });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Kort tittel/), {
      target: { value: 'En tittel' },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Detaljert beskrivelse/), {
      target: { value: 'Kort tekst her som er lang nok' },
    });
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('submits payload with context to default endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'ticket-123' }),
    });
    global.fetch = fetchMock as never;

    render(
      <RoleRoomFeedbackFab
        user={{ id: 42, email: 'tester@example.com', name: 'Test Tester' }}
        currentTabLabel="Roller"
        currentProjectId="proj-abc"
        currentProjectName="Demo Prosjekt"
      />,
    );
    fireEvent.click(screen.getByLabelText('Åpne tilbakemelding'));
    fireEvent.change(screen.getByLabelText(/Kort tittel/), {
      target: { value: 'Test-bug' },
    });
    fireEvent.change(screen.getByLabelText(/Detaljert beskrivelse/), {
      target: { value: 'Detaljer om denne bug-en, lang nok tekst.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send ticket/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/role-room/tickets');
    expect(options.method).toBe('POST');
    const payload = JSON.parse(options.body as string);
    expect(payload).toMatchObject({
      category: 'bug',
      priority: 'medium',
      title: 'Test-bug',
      user: { id: '42', email: 'tester@example.com', name: 'Test Tester' },
      context: {
        tabLabel: 'Roller',
        projectId: 'proj-abc',
        projectName: 'Demo Prosjekt',
        viewportWidth: expect.any(Number),
        userAgent: expect.any(String),
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Ticketen din er registrert/)).toBeInTheDocument();
    });
  });

  it('shows helpful error when backend is not deployed (404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    }) as never;

    render(<RoleRoomFeedbackFab />);
    fireEvent.click(screen.getByLabelText('Åpne tilbakemelding'));
    fireEvent.change(screen.getByLabelText(/Kort tittel/), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText(/Detaljert beskrivelse/), {
      target: { value: 'Tekst som er lang nok her' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send ticket/ }));

    await waitFor(() => {
      expect(screen.getByText(/ikke deployet ennå/)).toBeInTheDocument();
    });
  });
});
