// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlannerBreadcrumb } from '../PlannerBreadcrumb';

describe('Sprint 2.2 — PlannerBreadcrumb', () => {
  it('renders nothing when hidden=true', () => {
    const { container } = render(
      <PlannerBreadcrumb hidden segments={[{ label: 'Casting Planner' }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when segments is empty', () => {
    const { container } = render(<PlannerBreadcrumb segments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all segments with chevrons between them', () => {
    render(
      <PlannerBreadcrumb
        segments={[
          { label: 'Casting Planner' },
          { label: 'Stille storm' },
          { label: 'Kandidater' },
        ]}
      />,
    );
    expect(screen.getByText('Casting Planner')).toBeInTheDocument();
    expect(screen.getByText('Stille storm')).toBeInTheDocument();
    expect(screen.getByText('Kandidater')).toBeInTheDocument();
    // Chevrons are aria-hidden SVGs — we just verify the breadcrumb structure
    expect(screen.getByRole('navigation', { name: 'Brødsmuler' })).toBeInTheDocument();
  });

  it('marks the last segment as aria-current="page"', () => {
    render(
      <PlannerBreadcrumb
        segments={[
          { label: 'Casting Planner' },
          { label: 'Stille storm' },
          { label: 'Roller' },
        ]}
      />,
    );
    const current = screen.getByText('Roller');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Casting Planner')).not.toHaveAttribute('aria-current');
  });

  it('makes non-last segments interactive (button + onClick fires)', () => {
    const onRoot = vi.fn();
    const onProject = vi.fn();
    render(
      <PlannerBreadcrumb
        segments={[
          { label: 'Casting Planner', onClick: onRoot },
          { label: 'Stille storm', onClick: onProject },
          { label: 'Kandidater' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Casting Planner'));
    fireEvent.click(screen.getByText('Stille storm'));
    expect(onRoot).toHaveBeenCalledTimes(1);
    expect(onProject).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when the last segment is clicked (it is current page)', () => {
    const lastClick = vi.fn();
    render(
      <PlannerBreadcrumb
        segments={[
          { label: 'Root' },
          { label: 'Current', onClick: lastClick },
        ]}
      />,
    );
    // Even with onClick provided, last segment is rendered as <span>, not button.
    fireEvent.click(screen.getByText('Current'));
    expect(lastClick).not.toHaveBeenCalled();
  });

  it('respects custom ariaLabel for accessibility', () => {
    render(
      <PlannerBreadcrumb
        segments={[
          { label: 'Casting Planner' },
          { label: 'Stille storm', onClick: () => {}, ariaLabel: 'Bytt prosjekt' },
          { label: 'Roller' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Bytt prosjekt')).toBeInTheDocument();
  });
});
