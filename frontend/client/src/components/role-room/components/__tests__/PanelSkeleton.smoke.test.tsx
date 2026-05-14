// @ts-nocheck
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelSkeleton } from '../PanelSkeleton';

describe('Sprint 4.1 — PanelSkeleton', () => {
  it('renders an aria-busy status region by default', () => {
    render(<PanelSkeleton />);
    const region = screen.getByRole('status', { name: 'Laster innhold' });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-busy', 'true');
  });

  it('supports custom ariaLabel for context-specific messaging', () => {
    render(<PanelSkeleton ariaLabel="Laster Story Logic" />);
    expect(screen.getByRole('status', { name: 'Laster Story Logic' })).toBeInTheDocument();
  });

  it.each([
    ['panel'],
    ['list'],
    ['grid'],
    ['form'],
    ['kanban'],
  ])('renders without crashing for variant=%s', (variant) => {
    const { container } = render(<PanelSkeleton variant={variant as never} />);
    // MUI Skeleton root has class MuiSkeleton-root
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('honors count prop for list variant', () => {
    const { container } = render(<PanelSkeleton variant="list" count={3} />);
    // Each list row has avatar + 2 text + 1 chip = 4 skeletons. 3 rows → 12.
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(3 * 4);
  });

  it('honors count prop for form variant', () => {
    const { container } = render(<PanelSkeleton variant="form" count={2} />);
    // Each form row has label + input = 2 skeletons. 2 rows → 4.
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(4);
  });
});
