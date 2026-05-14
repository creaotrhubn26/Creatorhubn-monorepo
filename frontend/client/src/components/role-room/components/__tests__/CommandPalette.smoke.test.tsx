// @ts-nocheck
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette, type CommandPaletteItem } from '../CommandPalette';

const buildItems = (overrides: Partial<CommandPaletteItem>[] = []): CommandPaletteItem[] => [
  { id: 't:0', label: 'Oversikt', category: 'Tab', onSelect: vi.fn() },
  { id: 't:1', label: 'Kandidater', category: 'Tab', keywords: ['candidates'], onSelect: vi.fn() },
  { id: 'p:proj-1', label: 'Stille storm', category: 'Prosjekt', onSelect: vi.fn() },
  { id: 'p:proj-2', label: 'Vinterlys', category: 'Prosjekt', onSelect: vi.fn() },
  { id: 'c:cand-1', label: 'Lise Hansen', category: 'Kandidat', description: 'lise@example.com', onSelect: vi.fn() },
  { id: 'c:cand-2', label: 'Ola Nordmann', category: 'Kandidat', onSelect: vi.fn() },
  ...overrides as CommandPaletteItem[],
];

describe('Sprint 2.1 — CommandPalette', () => {
  it('renders nothing when closed', () => {
    render(<CommandPalette open={false} onClose={() => {}} items={buildItems()} />);
    expect(screen.queryByPlaceholderText(/Søk prosjekter/)).toBeNull();
  });

  it('shows all items grouped by category when open and query is empty', () => {
    render(<CommandPalette open onClose={() => {}} items={buildItems()} />);
    expect(screen.getByText('Oversikt')).toBeInTheDocument();
    expect(screen.getByText('Stille storm')).toBeInTheDocument();
    expect(screen.getByText('Lise Hansen')).toBeInTheDocument();
    // Each category text appears both as overline header and per-row Chip.
    // 'Tab' has 2 tab-items → 1 header + 2 chips = 3 matches.
    expect(screen.getAllByText('Tab').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Prosjekt').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Kandidat').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by label substring (case-insensitive)', () => {
    render(<CommandPalette open onClose={() => {}} items={buildItems()} />);
    const input = screen.getByPlaceholderText(/Søk prosjekter/);
    fireEvent.change(input, { target: { value: 'vinter' } });
    expect(screen.getByText('Vinterlys')).toBeInTheDocument();
    expect(screen.queryByText('Stille storm')).toBeNull();
    expect(screen.queryByText('Lise Hansen')).toBeNull();
  });

  it('filters by keyword (e.g. "candidates" matches Kandidater-tab)', () => {
    render(<CommandPalette open onClose={() => {}} items={buildItems()} />);
    fireEvent.change(screen.getByPlaceholderText(/Søk prosjekter/), {
      target: { value: 'candidates' },
    });
    expect(screen.getByText('Kandidater')).toBeInTheDocument();
  });

  it('filters by description (e.g. email)', () => {
    render(<CommandPalette open onClose={() => {}} items={buildItems()} />);
    fireEvent.change(screen.getByPlaceholderText(/Søk prosjekter/), {
      target: { value: 'lise@' },
    });
    expect(screen.getByText('Lise Hansen')).toBeInTheDocument();
    expect(screen.queryByText('Ola Nordmann')).toBeNull();
  });

  it('shows empty-hint when query has no matches', () => {
    render(<CommandPalette open onClose={() => {}} items={buildItems()} />);
    fireEvent.change(screen.getByPlaceholderText(/Søk prosjekter/), {
      target: { value: 'zzz-nonexistent-zzz' },
    });
    expect(screen.getByText(/Ingen treff/)).toBeInTheDocument();
  });

  it('invokes onSelect on click and then closes', async () => {
    const projectSelect = vi.fn();
    const onClose = vi.fn();
    const items = buildItems().map((item) =>
      item.id === 'p:proj-1' ? { ...item, onSelect: projectSelect } : item,
    );
    render(<CommandPalette open onClose={onClose} items={items} />);
    fireEvent.click(screen.getByText('Stille storm'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // onSelect is deferred via setTimeout(0). With real timers this resolves
    // on the next macrotask — waitFor polls until the assertion holds.
    await waitFor(() => expect(projectSelect).toHaveBeenCalledTimes(1));
  });

  it('ArrowDown + Enter selects the next item', async () => {
    const firstSelect = vi.fn();
    const secondSelect = vi.fn();
    const items: CommandPaletteItem[] = [
      { id: 'a', label: 'Alpha', category: 'Tab', onSelect: firstSelect },
      { id: 'b', label: 'Bravo', category: 'Tab', onSelect: secondSelect },
    ];
    render(<CommandPalette open onClose={() => {}} items={items} />);
    const dialog = document.querySelector('.MuiDialog-paper') as HTMLElement;
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'Enter' });
    await waitFor(() => expect(secondSelect).toHaveBeenCalledTimes(1));
    expect(firstSelect).not.toHaveBeenCalled();
  });
});
