// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoleRoomEmptyState } from '../RoleRoomEmptyState';

// Sprint 1.2 smoke — verifiserer at empty-state-komponenten som Storyboard,
// Roller og Kandidater alle deler honors title/subtitle/CTA-kontrakten.
describe('Sprint 1.2 — RoleRoomEmptyState contract used by Storyboard', () => {
  it('renders title, subtitle and CTA matching Storyboard usage', () => {
    const onAction = vi.fn();
    render(
      <RoleRoomEmptyState
        iconSrc="/fake-storyboard.png"
        title="Bygg storyboardet ditt"
        subtitle="Hver frame representerer ett shot."
        color="#b86bff"
        buttonLabel="Opprett første frame"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Bygg storyboardet ditt')).toBeInTheDocument();
    expect(screen.getByText(/Hver frame representerer/)).toBeInTheDocument();

    const cta = screen.getByRole('button', { name: /Opprett første frame/ });
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits CTA when buttonLabel is missing (Storyboard fallback safety)', () => {
    render(
      <RoleRoomEmptyState
        iconSrc="/fake.png"
        title="Tom"
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
