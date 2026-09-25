import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PhotoRoomTab from './PhotoRoomTab';

const apiRequest = vi.fn();
vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
vi.mock('../AiBuyCreditsModal', () => ({ default: () => null }));

const assets = Array.from({ length: 42 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  filename: `photo-${index + 1}.jpg`,
  rating: 0,
  flagged: false,
  rejected: false,
  reviewStatus: null,
  clientCommentCount: 0,
  thumbUrl: `/thumb-${index + 1}.jpg`,
  fullUrl: `/full-${index + 1}.jpg`,
  exif: {},
}));

const room = {
  hasSession: true,
  stats: { total: 42, pending: 42, approved: 0, needsEdit: 0, comments: 0 },
  commentScopes: { all: 0, internal: 0, client: 0 },
  folders: [],
  gallery: null,
  pageInfo: { offset: 0, limit: 80, total: 42, hasMore: false },
  assets,
};

describe('PhotoRoomTab unified review flow', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/workspace/project-1/photo-room');
    window.localStorage?.clear?.();
    apiRequest.mockReset();
    apiRequest.mockImplementation((url: string) => {
      if (url.includes('/photo-review')) return Promise.resolve(room);
      if (url.includes('/photo-comments')) return Promise.resolve({ comments: [] });
      if (url.includes('/ai/jobs')) return Promise.resolve({ jobs: [] });
      if (url.includes('/ai/config')) return Promise.resolve({ enabled: false });
      if (url.includes('/ai/credits')) return Promise.resolve({ packs: [] });
      return Promise.resolve({});
    });
  });

  it('renders beyond the former 40-photo cutoff and scopes comments to the selected asset', async () => {
    render(<PhotoRoomTab projectId="project-1" />);
    expect(await screen.findByRole('button', { name: /photo-42\.jpg/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /photo-2\.jpg/i }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      `/api/projects/project-1/photo-comments?assetId=${assets[1].id}`,
    ));
  });

  it('keeps mutations disabled while allowing local comparison for a read-only viewer', async () => {
    render(<PhotoRoomTab projectId="project-1" readOnly />);
    expect(await screen.findByText(/Du har lesetilgang/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'valgt: photo-1.jpg' }));
    expect(screen.getByRole('button', { name: 'Be om endringer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send til kunde' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'valgt: photo-2.jpg' }));
    expect(screen.getByRole('button', { name: 'Sammenlign' })).toBeEnabled();
  });

  it('opens review mode with the keyboard without firing while typing', async () => {
    render(<PhotoRoomTab projectId="project-1" />);
    expect(await screen.findByRole('button', { name: /photo-1\.jpg/i })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'e' });
    expect(await screen.findByAltText('photo-1.jpg')).toBeTruthy();
    const search = screen.getByPlaceholderText('Søk etter filnavn');
    fireEvent.keyDown(search, { key: 'g' });
    expect(screen.getByAltText('photo-1.jpg')).toBeTruthy();
  });

  it('gives filters accessible names without applying listbox-only state to image buttons', async () => {
    render(<PhotoRoomTab projectId="project-1" />);
    const firstPhoto = await screen.findByRole('button', { name: /photo-1\.jpg/i });
    expect(firstPhoto).not.toHaveAttribute('aria-selected');
    expect(screen.getByRole('combobox', { name: 'Alle statuser' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Sortering' })).toBeTruthy();
  });
});
