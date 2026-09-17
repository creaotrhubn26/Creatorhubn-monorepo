// @vitest-environment jsdom
// «Logg ut» fantes i menyen, men ble bare tegnet hvis skallet fikk en handler
// — og toppen sendte den aldri. En innlogget talent hadde dermed ingen vei ut:
// ikke for å bytte konto, ikke for å logge av på en delt maskin.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TalentsAppShell from './TalentsAppShell';

const baseProps = {
  page: 'dashboard' as const,
  onNavigate: vi.fn(),
  user: { email: 'talent@example.test', name: 'Talent Testesen' },
};

describe('TalentsAppShell account menu', () => {
  it('offers a way out when a logout handler exists', async () => {
    const onLogout = vi.fn();
    render(<TalentsAppShell {...baseProps} onLogout={onLogout}><div /></TalentsAppShell>);

    fireEvent.click(screen.getByRole('button', { name: 'Kontomeny' }));

    const logout = await screen.findByText('Logg ut');
    fireEvent.click(logout);
    expect(onLogout).toHaveBeenCalled();
  });

  it('hides it only when there genuinely is no handler, such as demo mode', async () => {
    render(<TalentsAppShell {...baseProps}><div /></TalentsAppShell>);

    fireEvent.click(screen.getByRole('button', { name: 'Kontomeny' }));

    expect(screen.queryByText('Logg ut')).toBeNull();
  });
});
