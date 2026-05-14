// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreprodSubTabStrip } from '../PreprodSubTabStrip';

const tabs = [
  { tabIndex: 6, label: 'Lokasjoner' },
  { tabIndex: 7, label: 'Produksjonsplan' },
  { tabIndex: 8, label: 'Team' },
  { tabIndex: 9, label: 'Rekvisitter' },
];

describe('Sprint 6.8 — PreprodSubTabStrip', () => {
  it('renders nothing when activeTab is not in the pre-prod group', () => {
    const { container } = render(
      <PreprodSubTabStrip activeTab={0} preprodTabs={tabs} onSelectTab={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all 4 sub-tabs + Pre-prod heading when active', () => {
    render(
      <PreprodSubTabStrip activeTab={6} preprodTabs={tabs} onSelectTab={() => {}} />,
    );
    expect(screen.getByText('Pre-prod')).toBeInTheDocument();
    expect(screen.getByText('Lokasjoner')).toBeInTheDocument();
    expect(screen.getByText('Produksjonsplan')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText('Rekvisitter')).toBeInTheDocument();
  });

  it('marks the currently-active sub-tab with aria-current="page"', () => {
    render(
      <PreprodSubTabStrip activeTab={8} preprodTabs={tabs} onSelectTab={() => {}} />,
    );
    const teamChip = screen.getByText('Team').closest('[aria-current]');
    expect(teamChip).toHaveAttribute('aria-current', 'page');
    const otherChip = screen.getByText('Lokasjoner').closest('[role]');
    expect(otherChip).not.toHaveAttribute('aria-current', 'page');
  });

  it('fires onSelectTab when an inactive sub-tab is clicked', () => {
    const onSelect = vi.fn();
    render(
      <PreprodSubTabStrip activeTab={6} preprodTabs={tabs} onSelectTab={onSelect} />,
    );
    fireEvent.click(screen.getByText('Team'));
    expect(onSelect).toHaveBeenCalledWith(8);
  });

  it('does NOT fire onSelectTab when the active sub-tab is clicked again', () => {
    const onSelect = vi.fn();
    render(
      <PreprodSubTabStrip activeTab={6} preprodTabs={tabs} onSelectTab={onSelect} />,
    );
    fireEvent.click(screen.getByText('Lokasjoner'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders nothing when hidden=true even if in group', () => {
    const { container } = render(
      <PreprodSubTabStrip activeTab={6} preprodTabs={tabs} onSelectTab={() => {}} hidden />,
    );
    expect(container.firstChild).toBeNull();
  });
});
