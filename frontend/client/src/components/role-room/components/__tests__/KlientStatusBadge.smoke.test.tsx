// @ts-nocheck
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KlientStatusBadge } from '../KlientStatusBadge';

describe('Sprint 3.2 — KlientStatusBadge', () => {
  it('renders nothing when status is null', () => {
    const { container } = render(<KlientStatusBadge status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is undefined', () => {
    const { container } = render(<KlientStatusBadge status={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Planlegging" for planning status', () => {
    render(<KlientStatusBadge status="planning" />);
    expect(screen.getByText('Planlegging')).toBeInTheDocument();
  });

  it('renders "Venter klient" for awaiting_client status', () => {
    render(<KlientStatusBadge status="awaiting_client" />);
    expect(screen.getByText('Venter klient')).toBeInTheDocument();
  });

  it('renders "Endringer" for changes_requested status', () => {
    render(<KlientStatusBadge status="changes_requested" />);
    expect(screen.getByText('Endringer')).toBeInTheDocument();
  });

  it('renders "Godkjent" for approved status', () => {
    render(<KlientStatusBadge status="approved" />);
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
  });

  it('sets a descriptive aria-label for screen readers', () => {
    render(<KlientStatusBadge status="awaiting_client" />);
    expect(screen.getByLabelText('Klient-status: Venter klient')).toBeInTheDocument();
  });

  it('supports sm size variant', () => {
    render(<KlientStatusBadge status="approved" size="sm" />);
    expect(screen.getByText('Godkjent')).toBeInTheDocument();
  });
});
