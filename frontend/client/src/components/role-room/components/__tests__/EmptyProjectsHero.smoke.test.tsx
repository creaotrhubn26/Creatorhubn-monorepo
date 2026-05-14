// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyProjectsHero } from '../EmptyProjectsHero';

describe('Sprint 6.2 — EmptyProjectsHero', () => {
  it('renders welcome heading with workspace name', () => {
    render(<EmptyProjectsHero workspaceName="The Role Room" onCreateProject={() => {}} />);
    expect(screen.getByText(/Velkommen til The Role Room/)).toBeInTheDocument();
  });

  it('renders primary CTA and triggers onCreateProject when clicked', () => {
    const onCreate = vi.fn();
    render(<EmptyProjectsHero onCreateProject={onCreate} />);
    const cta = screen.getByRole('button', { name: /Opprett ditt første prosjekt/ });
    fireEvent.click(cta);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows demo CTA only when onOpenDemo is provided', () => {
    const { rerender } = render(<EmptyProjectsHero onCreateProject={() => {}} />);
    expect(screen.queryByRole('button', { name: /Se demo-prosjekt/ })).toBeNull();

    const onDemo = vi.fn();
    rerender(<EmptyProjectsHero onCreateProject={() => {}} onOpenDemo={onDemo} />);
    const demo = screen.getByRole('button', { name: /Se demo-prosjekt/ });
    fireEvent.click(demo);
    expect(onDemo).toHaveBeenCalledTimes(1);
  });

  it('uses default workspace name when not provided', () => {
    render(<EmptyProjectsHero onCreateProject={() => {}} />);
    expect(screen.getByText(/Velkommen til Casting Planner/)).toBeInTheDocument();
  });

  it('includes Cmd+K-tipset i footer', () => {
    render(<EmptyProjectsHero onCreateProject={() => {}} />);
    expect(screen.getByText(/Cmd\+K/)).toBeInTheDocument();
  });
});
