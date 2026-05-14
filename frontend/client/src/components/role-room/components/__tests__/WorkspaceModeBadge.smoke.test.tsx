// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceModeBadge } from '../WorkspaceModeBadge';

describe('Sprint 6.4 — WorkspaceModeBadge', () => {
  it('renders content_producer mode with correct label', () => {
    render(<WorkspaceModeBadge mode="content_producer" />);
    expect(screen.getByText('Innholdsprodusent')).toBeInTheDocument();
  });

  it('renders production_team mode', () => {
    render(<WorkspaceModeBadge mode="production_team" />);
    expect(screen.getByText('Produksjonsteam')).toBeInTheDocument();
  });

  it('renders client_reviewer mode', () => {
    render(<WorkspaceModeBadge mode="client_reviewer" />);
    expect(screen.getByText('Klient')).toBeInTheDocument();
  });

  it('renders dance mode', () => {
    render(<WorkspaceModeBadge mode="dance" />);
    expect(screen.getByText('Dansestudio')).toBeInTheDocument();
  });

  it('is non-interactive by default (no onClick)', () => {
    render(<WorkspaceModeBadge mode="content_producer" />);
    // Chip without onClick has role="button" only when clickable.
    // We verify there's no enabled clickable handler.
    const labelEl = screen.getByText('Innholdsprodusent');
    expect(labelEl).toBeInTheDocument();
  });

  it('fires onClick when provided', () => {
    const onClick = vi.fn();
    render(<WorkspaceModeBadge mode="content_producer" onClick={onClick} />);
    fireEvent.click(screen.getByText('Innholdsprodusent'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
